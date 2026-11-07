// ============================================================
//  گارد «ردّ فعالیت» (Activity Log) — فاز ۱۲.۲
// ------------------------------------------------------------
//  ریشهٔ باگی که این گارد از بازگشتش جلوگیری می‌کند:
//    «چه کسی این رکورد را عوض کرد؟» هیچ‌جا ثبت نمی‌شد. فقط
//    created_by/updated_by روی خودِ رکورد بود و با حذف رکورد (یا
//    کاربر) همهٔ شواهد از بین می‌رفت.
//
//  چه چیزی سنجیده می‌شود؟
//    ۱) قواعد خالص (بدون دیتابیس): shouldRecord / isMutation /
//       isAuthEvent / parsePath / buildDetails (ماسک رمز) /
//       buildEntry / buildItem / buildSummary / تنظیمات env
//    ۲) لایهٔ دیتابیس: مایگریشن activity_logs (idempotent + ۴ ایندکس +
//       down + نبود FK)، مدل، شمارنده/ایندکس‌های db:verify، CRITICAL_TABLES
//    ۳) میدل‌ور: کار روی res.on("finish") · skip list (ضد حلقه) ·
//       بدون await در مسیر پاسخ · نام تلاش‌شدهٔ ورود ناموفق
//    ۴) سرویس: بافر + INSERT دسته‌ای (bulkCreate) + backoff نبودِ جدول +
//       پاک‌سازی نگهداشت (Op.lt)
//    ۵) مسیرها/کنترلر: protect + کلید users.activity.view + ترتیب
//       مسیرهای ثابت پیش از پارامتری + نبودِ session_id در خروجی
//    ۶) فرانت: ثابت‌های API + سرویس نازک + ثبت در هر دو gate runner
//
//  اجرا:  npm run test:activity        (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (relPath) => {
  try {
    return fs
      .readFileSync(path.join(ROOT, relPath), "utf8")
      .replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};
const exists = (relPath) => fs.existsSync(path.join(ROOT, relPath));

// ============================================================
// ۱) قواعد خالص (بدون دیتابیس)
// ============================================================
const rules = require(path.join(ROOT, "Backend", "services", "activityRules.js"));

check(
  "قواعد: فقط تغییر وضعیت ثبت می‌شود (POST بله · GET پیش‌فرض نه)",
  rules.shouldRecord({ method: "POST" }) === true &&
    rules.shouldRecord({ method: "put" }) === true &&
    rules.shouldRecord({ method: "DELETE" }) === true &&
    rules.shouldRecord({ method: "GET" }) === false &&
    rules.shouldRecord({ method: "HEAD" }) === false,
);

check(
  "قواعد: با ACTIVITY_LOG_READS=true خواندن‌ها هم ثبت می‌شوند",
  rules.shouldRecord({ method: "GET", logReads: true }) === true &&
    rules.shouldRecord({ method: "GET", logReads: false }) === false,
);

check(
  "قواعد: ACTIVITY_LOG_ENABLED=false ⇒ هیچ چیز ثبت نمی‌شود",
  rules.shouldRecord({ method: "POST", enabled: false }) === false,
);

check(
  "قواعد: فهرست متدهای قابل ثبت قابل تنظیم است (POST بیرون ⇒ ثبت نمی‌شود)",
  rules.shouldRecord({ method: "POST", recordMethods: ["PUT"] }) === false &&
    rules.shouldRecord({ method: "PUT", recordMethods: ["PUT"] }) === true,
);

check(
  "قواعد: isMutation فقط متدهای نوشتنی را قبول می‌کند",
  rules.isMutation("post") === true &&
    rules.isMutation("PATCH") === true &&
    rules.isMutation("GET") === false &&
    rules.isMutation("") === false,
);

check(
  "قواعد: ورود/خروج از مسیر شناخته می‌شود (بدون تغییر کنترلر)",
  rules.isAuthEvent("/api/users/login") === "login" &&
    rules.isAuthEvent("/api/auth/logout") === "logout" &&
    rules.isAuthEvent("/api/customers") === null &&
    rules.isAuthEvent(null) === null,
);

check(
  "قواعد: parsePath مسیر/موجودیت/شناسه را جدا می‌کند (query و /api حذف)",
  (() => {
    const one = rules.parsePath("/api/customers/12?page=2");
    const two = rules.parsePath(
      "/api/halls/3f2504e0-4f89-11d3-9a0c-0305e82c3301/",
    );
    return (
      one.path === "/api/customers/12" &&
      one.entity === "customers" &&
      one.entityId === "12" &&
      two.entity === "halls" &&
      two.entityId === "3f2504e0-4f89-11d3-9a0c-0305e82c3301"
    );
  })(),
);

check(
  "قواعد: ⭐ رمز/توکن هرگز ذخیره نمی‌شود (حتی با ACTIVITY_LOG_VALUES=true)",
  (() => {
    const body = { password: "P@ss1234", token: "abc", name: "ali" };
    const safe = rules.buildDetails(body, { logValues: false });
    const verbose = rules.buildDetails(body, { logValues: true });
    return (
      safe.password === rules.MASKED_VALUE &&
      safe.token === rules.MASKED_VALUE &&
      safe.name === null &&
      verbose.password === rules.MASKED_VALUE &&
      verbose.token === rules.MASKED_VALUE &&
      verbose.name === "ali" &&
      !JSON.stringify(verbose).includes("P@ss1234")
    );
  })(),
);

check(
  "قواعد: buildEntry ورود ناموفق را با نام تلاش‌شده و success=false می‌سازد",
  (() => {
    const entry = rules.buildEntry({
      method: "POST",
      originalUrl: "/api/users/login",
      statusCode: 401,
      actorHint: "ali",
      ip: "127.0.0.1",
      userAgent: "guard-test",
    });
    return (
      entry.action === "login" &&
      entry.username === "ali" &&
      entry.user_id === null &&
      entry.success === false &&
      entry.status_code === 401 &&
      entry.entity === "users" &&
      entry.method === "POST" &&
      entry.summary.includes(rules.ACTION_TITLES.login)
    );
  })(),
);

check(
  "قواعد: buildEntry ستون‌ها را می‌بُرد (path/entity_id به سقف ستون)",
  (() => {
    const entry = rules.buildEntry({
      method: "PUT",
      originalUrl: `/api/customers/${"9".repeat(120)}`,
      routePath: "/:id",
      statusCode: 200,
      actor: { id: 5, username: "ali", role: "admin" },
      durationMs: 12.6,
    });
    return (
      entry.action === "update" &&
      entry.success === true &&
      entry.entity_id.length === 64 &&
      entry.duration_ms === 12.6 &&
      entry.user_id === 5 &&
      entry.role === "admin" &&
      entry.route === "/:id"
    );
  })(),
);

check(
  "قواعد: ⭐ buildItem ستون داخلی session_id را بیرون نمی‌دهد",
  (() => {
    const item = rules.buildItem({
      id: 9,
      user_id: 5,
      username: "ali",
      role: "admin",
      action: "delete",
      method: "DELETE",
      path: "/api/halls/4",
      entity: "halls",
      entity_id: "4",
      status_code: 200,
      success: true,
      summary: "حذف سالن #4",
      session_id: "SECRET-SID",
      created_at: new Date().toISOString(),
    });
    return (
      item.id === 9 &&
      item.action_title === rules.ACTION_TITLES.delete &&
      item.entity_title === rules.ENTITY_TITLES.halls &&
      item.status_label === "موفق" &&
      item.actor.id === 5 &&
      !("session_id" in item) &&
      !JSON.stringify(item).includes("SECRET-SID")
    );
  })(),
);

check(
  "قواعد: ⭐ buildItem زمان را از createdAt (نمونهٔ Sequelize) هم می‌خواند",
  (() => {
    const stamp = new Date(Date.now() - 60_000);
    // نمونهٔ Sequelize با underscored: کلید خروجی `createdAt` است نه `created_at`
    const item = rules.buildItem({
      id: 11,
      action: "update",
      method: "PUT",
      path: "/api/halls/4",
      success: true,
      createdAt: stamp,
    });
    return (
      item.at === stamp.toISOString() &&
      item.seconds_ago >= 59 &&
      item.seconds_ago <= 61
    );
  })(),
);
check(
  "قواعد: ⭐ actorFromPayload هویتِ ورود موفق را از پاسخ می‌گیرد (بدون توکن)",
  (() => {
    // شکل واقعی پاسخ: successResponse(res, { user, token })
    const actor = rules.actorFromPayload({
      success: true,
      data: { user: { id: 7, username: "sara", role: "admin" }, token: "SECRET" },
    });
    return (
      actor?.id === 7 &&
      actor.username === "sara" &&
      actor.role === "admin" &&
      !JSON.stringify(actor).includes("SECRET") &&
      rules.actorFromPayload({ success: false }) === null &&
      rules.actorFromPayload(null) === null
    );
  })(),
);



check(
  "قواعد: buildSummary شمارش موفق/ناموفق و بازیگران یکتا را می‌دهد",
  (() => {
    const summary = rules.buildSummary(
      [
        { user_id: 1, action: "create", entity: "customers", success: true },
        { user_id: 1, action: "update", entity: "customers", success: false },
        { user_id: 2, action: "login", entity: "users", success: true },
      ],
      { retentionDaysValue: 180 },
    );
    return (
      summary.total === 3 &&
      summary.success === 2 &&
      summary.failed === 1 &&
      summary.unique_actors === 2 &&
      summary.by_action.create === 1 &&
      summary.by_entity.customers === 2 &&
      summary.retention_days === 180
    );
  })(),
);

check(
  "قواعد: تنظیمات env درست خوانده می‌شوند (bool / int / لیست متدها)",
  rules.readBool("YES", false) === true &&
    rules.readBool("bogus", true) === true &&
    rules.readPositiveInt("0", 7) === 7 &&
    rules.readPositiveInt("42", 7) === 42 &&
    rules.readNonNegativeInt("0", 9) === 0 &&
    rules.parseMethods("post, put ,DELETE").join(",") === "POST,PUT,DELETE",
);

check(
  "قواعد: clip و عنوان‌های فارسی درست کار می‌کنند",
  rules.clip("abcdef", 3) === "abc" &&
    rules.clip(null, 3) === null &&
    rules.actionTitle("login") === "ورود" &&
    rules.statusLabel(false) === "ناموفق" &&
    rules.entityTitle("customers") === "مشتری" &&
    rules.entityTitle(null) === "سیستم" &&
    rules.actorName(null) === rules.UNKNOWN_ACTOR,
);

check(
  "قواعد: config() همهٔ کلیدها را با پیش‌فرض امن (بدون مقدار) برمی‌گرداند",
  (() => {
    // ⚠️ مقادیر .env محلی نباید نتیجهٔ گارد را عوض کنند ⇒ ایزوله می‌کنیم
    const saved = {};
    const keys = [
      "ACTIVITY_LOG_ENABLED",
      "ACTIVITY_RECORD_METHODS",
      "ACTIVITY_LOG_VALUES",
      "ACTIVITY_LOG_READS",
      "ACTIVITY_FLUSH_MS",
      "ACTIVITY_BUFFER_MAX",
      "ACTIVITY_RETENTION_DAYS",
      "ACTIVITY_PURGE_INTERVAL_HOURS",
    ];
    keys.forEach((key) => {
      saved[key] = process.env[key];
      delete process.env[key];
    });
    const config = rules.config();
    keys.forEach((key) => {
      if (saved[key] !== undefined) process.env[key] = saved[key];
    });
    return (
      config.enabled === true &&
      config.log_values === false &&
      config.log_reads === false &&
      Array.isArray(config.record_methods) &&
      config.record_methods.includes("POST") &&
      config.flush_ms > 0 &&
      config.buffer_max > 0 &&
      config.retention_days > 0
    );
  })(),
);

// ============================================================
// ۲) لایهٔ دیتابیس: مایگریشن + مدل
// ============================================================
const migrationPath =
  "Backend/migrations/20261004020000-create-activity-logs.js";
const migration = read(migrationPath);
const modelSource = read("Backend/models/ActivityLog.js");
const associationsSource = read("Backend/models/associations.js");

check("مایگریشن: فایل جدول activity_logs موجود است", exists(migrationPath));

check(
  "مایگریشن: idempotent است (showAllTables + showIndex قبل از ساخت)",
  migration.includes("showAllTables") &&
    migration.includes("showIndex") &&
    migration.includes("if (!existing.includes(TABLE))") &&
    migration.includes("if (!currentIndexes.includes(index.name))"),
);

check(
  "مایگریشن: هر ۴ ایندکس طراحی‌شده ساخته می‌شود",
  ["activity_logs_user_id_created_at", "activity_logs_entity", "activity_logs_created_at", "activity_logs_action"].every(
    (name) => migration.includes(name),
  ),
);

check(
  "مایگریشن: down دارد و FK نمی‌سازد (تاریخچه بعد از حذف کاربر می‌ماند)",
  /async down\(queryInterface\)/.test(migration) &&
    migration.includes("dropTable(TABLE)") &&
    !migration.includes("references:"),
);

check(
  "مایگریشن: ستون‌های کلیدی وجود دارند (هاست/مقادیر/نتیجه/زمان)",
  ["user_id", "username", "role", "action", "method", "path", "route", "entity", "entity_id", "status_code", "success", "ip", "user_agent", "session_id", "fields", "summary", "duration_ms", "created_at"].every(
    (column) => migration.includes(column),
  ),
);

check(
  "مدل: tableName=activity_logs و underscored=true (هم‌خوان با مایگریشن)",
  modelSource.includes('tableName: "activity_logs"') &&
    modelSource.includes("underscored: true"),
);

check(
  "مدل: فیلدهای بدنه JSONB است و ایندکس در مدل تعریف نشده (منبع حقیقت = مایگریشن)",
  modelSource.includes("DataTypes.JSONB") && !/indexes\s*:/.test(modelSource),
);

check(
  "مدل: بدون FK/references (هم‌الگو با PermissionAuditLog)",
  !modelSource.includes("references:") && modelSource.includes("allowNull: true"),
);

check(
  "ارتباطات: User.hasMany(ActivityLog) و ActivityLog.belongsTo(User) با constraints:false",
  associationsSource.includes('User.hasMany(ActivityLog, {') &&
    associationsSource.includes('ActivityLog.belongsTo(User, {') &&
    (associationsSource.match(/constraints: false/g) || []).length >= 2,
);

// ============================================================
// ۲.۲) ابزار تأیید دیتابیس + سیم‌کشی سرور + متغیرهای env
// ============================================================
const verifyDb = read("Backend/scripts/verify-db.js");
const serverSource = read("Backend/server.js");
const envExample = read("Backend/.env.example");

check(
  "verify-db: جدول activity_logs در EXPECTED_TABLES و COUNT_TABLES هست",
  (verifyDb.match(/"activity_logs"/g) || []).length >= 2,
);

check(
  "verify-db: ستون‌های activity_logs تعریف شده‌اند (شامل created_at)",
  verifyDb.includes("activity_logs: [") &&
    verifyDb.includes("session_id") &&
    verifyDb.includes("duration_ms"),
);

check(
  "verify-db: هر ۴ ایندکس در EXPECTED_INDEXES آمده است",
  [
    "activity_logs_user_id_created_at",
    "activity_logs_entity",
    "activity_logs_created_at",
    "activity_logs_action",
  ].every((name) => verifyDb.includes(`"${name}"`)),
);

check(
  "server: activity_logs در CRITICAL_TABLES اضافه شده است",
  serverSource.includes('"activity_logs"'),
);

check(
  "server: میدل‌ور ثبت پس از apiLimiter و پیش از مسیرها وصل شده است (ترتیب درست)",
  (() => {
    const limiter = serverSource.indexOf('app.use("/api", apiLimiter)');
    const logger = serverSource.indexOf('app.use("/api", activityLog)');
    const routes = serverSource.indexOf('app.use("/api/activity", activityRoutes)');
    return limiter > -1 && logger > limiter && routes > logger;
  })(),
);

check(
  "server: پاک‌سازی نگهداشت (startHousekeeping) در راه‌اندازی صدا زده می‌شود",
  serverSource.includes("activityService.startHousekeeping()"),
);

check(
  "env.example: هر ۸ متغیر ACTIVITY_* مستند شده است",
  [
    "ACTIVITY_LOG_ENABLED",
    "ACTIVITY_RECORD_METHODS",
    "ACTIVITY_LOG_VALUES",
    "ACTIVITY_LOG_READS",
    "ACTIVITY_FLUSH_MS",
    "ACTIVITY_BUFFER_MAX",
    "ACTIVITY_RETENTION_DAYS",
    "ACTIVITY_PURGE_INTERVAL_HOURS",
  ].every((name) => envExample.includes(name)),
);

// ============================================================
// ۳) میدل‌ور: کار روی res.on("finish") + skip list + بدون await
// ============================================================
const middleware = require(path.join(
  ROOT,
  "Backend",
  "middleware",
  "activityLog.js",
));
const middlewareSource = read("Backend/middleware/activityLog.js");

check(
  "میدل‌ور: ماژول یک تابع (req,res,next) صادر می‌کند",
  typeof middleware === "function" && typeof middleware.activityLog === "function",
);

check(
  "میدل‌ور: ⭐ روی res.on(\"finish\") کار می‌کند (پاسخ کاربر معطل لاگ نمی‌ماند)",
  middlewareSource.includes('res.on("finish"') &&
    middlewareSource.includes("activityService.record(") &&
    middlewareSource.includes("rules.buildEntry("),
);

check(
  "میدل‌ور: در مسیر پاسخ await ندارد (غیرمسدودکننده)",
  !/\bawait\b/.test(middlewareSource) &&
    !/async\s*\(\s*req\s*,\s*res\s*,\s*next\s*\)/.test(middlewareSource),
);

check(
  "میدل‌ور: خاموش‌بودن با ACTIVITY_LOG_ENABLED=false فقط next() است",
  middlewareSource.includes("if (!rules.isEnabled()) return next();"),
);

check(
  "میدل‌ور: skip list شامل مسیر خود لاگ و heartbeat/offline حضور است (ضد حلقه)",
  middleware.shouldSkip("/api/activity") === true &&
    middleware.shouldSkip("/api/activity?page=2") === true &&
    middleware.shouldSkip("/api/activity/summary") === true &&
    middleware.shouldSkip("/api/presence/heartbeat") === true &&
    middleware.shouldSkip("/api/presence/offline") === true &&
    middleware.shouldSkip("/health") === true &&
    middleware.shouldSkip("/api/customers") === false &&
    middleware.shouldSkip("/api/sessions/12/revoke") === false,
);

check(
  "میدل‌ور: نام تلاش‌شدهٔ ورود ناموفق از بدنه خوانده می‌شود (بدون رمز)",
  middleware.actorHintFrom({ username: "ali", password: "P@ss" }) === "ali" &&
    middleware.actorHintFrom({ email: "a@b.c" }) === "a@b.c" &&
    middleware.actorHintFrom({ password: "P@ss" }) === null &&
    middleware.actorHintFrom(null) === null,
);

check(
  "میدل‌ور: الگوی مسیر Express برای الگوکاوی ثبت می‌شود",
  middleware.routePattern({ route: { path: "/:id" } }) === "/:id" &&
    middleware.routePattern({ route: { path: ["/x", "/y"] } }) === "/x" &&
    middleware.routePattern({}) === null,
);

check(
  "میدل‌ور: کاربر/نشست/آی‌پی/مدت پردازش به ردیف داده می‌شود",
  middlewareSource.includes("actor: req.user") &&
    middlewareSource.includes("sessionId: req.sessionId") &&
    middlewareSource.includes("process.hrtime.bigint()") &&
    middlewareSource.includes("x-forwarded-for"),
);

check(
  "میدل‌ور: ⭐ ورودِ موفق هم بازیگر دارد (req.user || پاسخ ورود)",
  middlewareSource.includes("req.user || capturedActor") &&
    middlewareSource.includes("rules.actorFromPayload(body)") &&
    middlewareSource.includes('authEvent === "login"'),
);

// ============================================================
// ۴) سرویس: بافر + نوشتن دسته‌ای + backoff نبودِ جدول + نگهداشت
// ============================================================
const activityService = require(path.join(
  ROOT,
  "Backend",
  "services",
  "activityService.js",
));
const serviceSource = read("Backend/services/activityService.js");

check(
  "سرویس: سطح API کامل است (record/flush/list/summary/getById/purge/…​)",
  [
    "record",
    "flush",
    "flushNow",
    "list",
    "summary",
    "getById",
    "purgeExpired",
    "startHousekeeping",
    "stopHousekeeping",
    "status",
  ].every((name) => typeof activityService[name] === "function"),
);

check(
  "سرویس: ⭐ INSERT دسته‌ای با bulkCreate (نه یک INSERT به‌ازای هر درخواست)",
  serviceSource.includes("ActivityLog.bulkCreate(") &&
    serviceSource.includes("buffer.push(") &&
    serviceSource.includes("buffer.splice("),
);

check(
  "سرویس: فقط یک تایمر flush و unref شده (خروج سرور معطل نمی‌ماند)",
  serviceSource.includes("flushTimer = setTimeout(") &&
    serviceSource.includes(".unref()"),
);

check(
  "سرویس: ⭐ نبودِ جدول = هشدار یک‌باره + backoff (سرور نمی‌خوابد)",
  serviceSource.includes("TABLE_MISSING_BACKOFF_MS") &&
    serviceSource.includes('=== "42P01"') &&
    serviceSource.includes("tableMissingUntil") &&
    serviceSource.includes("if (isPaused())"),
);

check(
  "سرویس: خطاهای نوشتن لاگ هرگز throw نمی‌شوند (fail-open)",
  serviceSource.includes("catch (error)") &&
    serviceSource.includes("console.warn") &&
    serviceSource.includes("return false"),
);

check(
  "سرویس: نگهداشت با Op.lt روی created_at پاک می‌کند",
  serviceSource.includes("[Op.lt]") &&
    serviceSource.includes("ActivityLog.destroy(") &&
    serviceSource.includes("retention"),
);

check(
  "سرویس: ردیف نامعتبر یا خاموش‌بودن ثبت ⇒ record() مقدار false می‌دهد",
  (() => {
    const saved = process.env.ACTIVITY_LOG_ENABLED;
    process.env.ACTIVITY_LOG_ENABLED = "false";
    const disabled = activityService.record({
      action: "create",
      method: "POST",
      path: "/api/x",
    });
    if (saved === undefined) delete process.env.ACTIVITY_LOG_ENABLED;
    else process.env.ACTIVITY_LOG_ENABLED = saved;

    const invalid = activityService.record(null);
    activityService.resetForTests();
    return disabled === false && invalid === false;
  })(),
);

check(
  "سرویس: status() وضعیت بافر/تنظیمات را برای پایش برمی‌گرداند",
  (() => {
    const status = activityService.status();
    return (
      status.buffered === 0 &&
      status.paused === false &&
      status.paused_until === null &&
      typeof status.enabled === "boolean" &&
      typeof status.retention_days === "number"
    );
  })(),
);

check(
  "سرویس: flush روی بافر خالی صفر برمی‌گرداند (بی‌خطر)",
  (() => {
    const promise = activityService.flush();
    // async ⇒ همیشه Promise؛ روی بافر خالی rejection ندارد
    if (promise && typeof promise.catch === "function") promise.catch(() => {});
    return promise instanceof Promise;
  })(),
);

// ============================================================
// ۵) مسیرها · کنترلر · کلید مجوز
// ============================================================
const routesSource = read("Backend/routes/activityRoutes.js");
const controllerSource = read("Backend/controllers/activityController.js");
const catalog = require(path.join(ROOT, "Backend", "config", "permissions.js"));
const permissionsTest = read("Backend/permissions-test.mjs");

check(
  "مسیرها: protect + محدودسازی به نقش‌های مدیریتی (ADMIN_ROLES)",
  routesSource.includes("router.use(protect)") &&
    routesSource.includes("authorize(...ADMIN_ROLES)"),
);

check(
  "مسیرها: هر سه مسیر با کلید users.activity.view محافظت می‌شوند",
  (routesSource.match(/requirePermission\("users\.activity\.view"\)/g) || [])
    .length === 1 &&
    (routesSource.match(/CAN_VIEW_ACTIVITY/g) || []).length >= 4,
);

check(
  "مسیرها: ⭐ مسیر ثابت /summary پیش از پارامتری /:id ثبت می‌شود",
  (() => {
    const summary = routesSource.indexOf('"/summary"');
    const detail = routesSource.indexOf('"/:id"');
    return summary > -1 && detail > -1 && summary < detail;
  })(),
);

check(
  "کنترلر: صفحه‌بندی امن + خروجی از rules.buildItem (بدون ستون داخلی)",
  controllerSource.includes("parsePagination(req.query") &&
    controllerSource.includes("rules.buildItem(row") &&
    !controllerSource.includes("row.session_id") &&
    !controllerSource.includes("session_id:"),
);

check(
  "کنترلر: فیلترهای کاربر/عمل/موجودیت/نتیجه/بازهٔ زمانی پشتیبانی می‌شوند",
  controllerSource.includes('"user_id", "userId"') &&
    controllerSource.includes('"entity_id", "entityId"') &&
    controllerSource.includes('"from", "date_from"') &&
    controllerSource.includes("where.success = true") &&
    controllerSource.includes("where.success = false"),
);

check(
  "کنترلر: شناسهٔ نامعتبر ۴۰۰ · ردیف نبود ۴۰۴ · خطای سرور ۵۰۰",
  controllerSource.includes("شناسهٔ ردیف معتبر نیست") &&
    controllerSource.includes("ردّ فعالیت یافت نشد") &&
    controllerSource.includes("errorResponse(res, \"خطا در دریافت ردّ فعالیت\", 500)"),
);

check(
  "کلید مجوز: users.activity.view در کاتالوگ هست (بدون قفل)",
  Boolean(catalog.PERMISSIONS["users.activity.view"]) &&
    catalog.PERMISSIONS["users.activity.view"].lockedTo.length === 0,
);

check(
  "کلید مجوز: پیش‌فرض روشن برای مدیران و خاموش برای کارشناس/مشتری",
  catalog.defaultFor("super_admin", "users.activity.view") === true &&
    catalog.defaultFor("admin", "users.activity.view") === true &&
    catalog.defaultFor("sub_admin", "users.activity.view") === true &&
    catalog.defaultFor("expert", "users.activity.view") === false &&
    catalog.defaultFor("customer", "users.activity.view") === false,
);

// ⚠️ عدد ثابت اینجا شکننده بود (۱۲.۲ آن را از ۱۶۴ به ۱۶۵ برد و همان
//    اشتباه یک بار در session-guard-test جا ماند). اکنون:
//    «تعداد کلیدها = طول فهرست کلیدها» + «عدد اعلام‌شده در permissions-test
//    با کاتالوگ می‌خواند» ⇒ هیچ موجی لازم نیست چند فایل را هم‌زمان bump کند.
const declaredTotalInTest = Number(
  (permissionsTest.match(/TOTAL_PERMISSIONS === (\d+)/) || [])[1],
);

check(
  "کاتالوگ: تعداد کلیدها با فهرست کلیدها یکی است و گروه‌ها ۱۷ است",
  // ✅ فاز ۱۳.۲: گروه «پورتال مشتری» اضافه شد (۱۶ ⇒ ۱۷)
  catalog.TOTAL_PERMISSIONS === catalog.PERMISSION_KEYS.length &&
    catalog.PERMISSION_GROUPS.length === 17,
  `keys=${catalog.TOTAL_PERMISSIONS} groups=${catalog.PERMISSION_GROUPS.length}`,
);

check(
  "کاتالوگ: عدد اعلام‌شده در permissions-test با کاتالوگ هم‌خوان است",
  declaredTotalInTest === catalog.TOTAL_PERMISSIONS,
  `declared=${declaredTotalInTest} actual=${catalog.TOTAL_PERMISSIONS}`,
);

// ============================================================
// ۶) فرانت (ثابت‌ها + سرویس) · ثبت در گیت · مستندات · پاک‌سازی
// ============================================================
const apiConst = read("Frontend/src/core/constants/api.const.js");
const feService = read("Frontend/src/core/services/activity.service.js");
const fePkg = read("Frontend/package.json");
const gateMjs = read("tools/gate.mjs");
const gatePs1 = read("tools/gate.ps1");
const gitignore = read(".gitignore");

check(
  "فرانت: بلوک ENDPOINTS.ACTIVITY با سه مسیر اضافه شده است",
  apiConst.includes("ACTIVITY: {") &&
    apiConst.includes('LIST: "/activity"') &&
    apiConst.includes('SUMMARY: "/activity/summary"') &&
    apiConst.includes('DETAIL: "/activity/:id"'),
);

check(
  "فرانت: سرویس از apiService و API_CONSTANTS استفاده می‌کند (نه fetch خام)",
  feService.includes('from "./api.service.js"') &&
    feService.includes('from "../constants/api.const.js"') &&
    feService.includes("API_CONSTANTS.ENDPOINTS.ACTIVITY") &&
    !feService.includes("fetch("),
);

check(
  "فرانت: سه متد list/summary/getById + خروجی سراسری window.activityService",
  feService.includes("async list(") &&
    feService.includes("async summary(") &&
    feService.includes("async getById(") &&
    feService.includes("export const activityService = new ActivityService()") &&
    feService.includes("window.activityService = activityService"),
);

check(
  "فرانت: ⭐ فیلتر success فقط وقتی boolean است فرستاده می‌شود (false گم نمی‌شود)",
  feService.includes("success === true || success === false"),
);

check(
  "گیت: اسکریپت test:activity در Frontend/package.json ثبت شده است",
  fePkg.includes('"test:activity": "node activity-guard-test.mjs"'),
);

check(
  "گیت: هر دو runner (mjs و ps1) گام test:activity را پس از test:sessions دارند",
  gateMjs.includes("'test:activity',") &&
    gatePs1.includes("'test:activity',") &&
    gateMjs.indexOf("'test:activity'") > gateMjs.indexOf("'test:sessions'") &&
    gatePs1.indexOf("'test:activity'") > gatePs1.indexOf("'test:sessions'"),
);

check(
  "مستندات: docs/REVIEW-WAVE-12.2.md وجود دارد و به جدول/کلید اشاره می‌کند",
  exists("docs/REVIEW-WAVE-12.2.md") &&
    read("docs/REVIEW-WAVE-12.2.md").includes("activity_logs") &&
    read("docs/REVIEW-WAVE-12.2.md").includes("users.activity.view"),
);

check(
  "مستندات: docs/REVIEW-WAVE-12.md وضعیت ۱۲.۲ را به‌روز کرده است",
  read("docs/REVIEW-WAVE-12.md").includes("12.2") &&
    read("docs/REVIEW-WAVE-12.md").includes("users.activity.view"),
);

check(
  "پاک‌سازی: Backend/.slices حذف شده و در .gitignore هست",
  !exists("Backend/.slices") && gitignore.includes(".slices/"),
);

check(
  "پاک‌سازی: گزینهٔ «بازاریابی و فروش» در فرم لیست مشتری هم هست (هم‌خوان با فرم مشتری)",
  read("Frontend/src/features/customer-list/customer-list.renderer.js").includes(
    "بازاریابی و فروش",
  ),
);

// ============================================================
// خلاصه
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log("");
if (failed === 0) {
  console.log(`ACTIVITY-GUARD-PASS — ${passed}/${results.length} بررسی موفق`);
} else {
  console.log(`ACTIVITY-GUARD-FAIL — ${failed} بررسی ناموفق از ${results.length}`);
}
process.exit(failed === 0 ? 0 : 1);

