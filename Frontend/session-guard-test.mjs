// ============================================================
//  گارد «نشست‌های کاربران» (Sessions) — فاز ۱۲.۱
// ------------------------------------------------------------
//  ریشهٔ باگی که این گارد از بازگشتش جلوگیری می‌کند:
//    دکمهٔ «خروج از همهٔ دستگاه‌ها» فقط `users.token` را بازنویسی
//    می‌کرد. چون هر دستگاه توکن مستقل خودش را دارد و (با
//    ENFORCE_SINGLE_SESSION=false) توکن ذخیره‌شده چک نمی‌شود،
//    عملاً هیچ دستگاه دیگری بیرون نمی‌افتاد ⇒ «خروج» نمایشی بود.
//
//  چه چیزی سنجیده می‌شود؟
//    ۱) توابع خالصِ نشست (بدون دیتابیس): isActive / shouldTouch /
//       describeDevice / statusLabel / buildItem / buildSummary
//    ۲) لایهٔ دیتابیس: مایگریشن user_sessions (idempotent + ایندکس)،
//       مدل، مایگریشن‌شمار (db:verify) و نبودِ FK (ماندن تاریخچه)
//    ۳) میدل‌ور: بررسی `sid` توکن روی هر درخواست (+ ۴۰۱ وقتی بسته شده)
//    ۴) مسیرها: mine/summary/list/revoke/revoke-all + protect + کلید مجوز
//    ۵) سیم‌کشی: ورود → ساخت نشست · خروج/تغییر رمز/بازنشانی/تغییر نقش → بستن
//    ۶) فرانت: ثابت‌ها + سرویس نازک روی apiService + ثبت در هر دو gate runner
//
//  اجرا:  npm run test:sessions        (در پوشهٔ Frontend)
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
const rules = require(
  path.join(ROOT, "Backend", "services", "sessionRules.js"),
);
const NOW = 1_700_000_000_000; // زمان ثابت برای تست قطعی (flaky نشود)

check(
  "قواعد: throttle نوشتن و پنجرهٔ نگهداری عدد مثبت‌اند",
  rules.TOUCH_THROTTLE_SECONDS > 0 && rules.RETENTION_DAYS > 0,
  `throttle=${rules.TOUCH_THROTTLE_SECONDS}s retention=${rules.RETENTION_DAYS}d`,
);

check(
  "قواعد: ⭐ نشستِ باز، «فعال» است (ended_at ندارد) و نشستِ بسته‌شده فعال نیست",
  rules.isActive({ id: 1, ended_at: null }) === true &&
    rules.isActive({ id: 1, ended_at: new Date(NOW) }) === false &&
    rules.isActive(null) === false,
);

check(
  "قواعد: throttle نوشتن کار می‌کند (بار اول بله، بلافاصله نه، بعد از بازه بله)",
  rules.shouldTouch(0, NOW, 60_000) === true &&
    rules.shouldTouch(NOW - 1000, NOW, 60_000) === false &&
    rules.shouldTouch(NOW - 60_000, NOW, 60_000) === true,
);

check(
  "قواعد: secondsSince تاریخِ ISO/Date/null را می‌فهمد",
  rules.secondsSince(new Date(NOW - 90_000).toISOString(), NOW) === 90 &&
    rules.secondsSince(new Date(NOW - 5000), NOW) === 5 &&
    rules.secondsSince(null, NOW) === null,
);

check(
  "قواعد: تشخیص دستگاه (Chrome/Windows · Edge · iPhone قبل از Mac · ناشناس)",
  rules.describeDevice(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
  ) === "کروم · ویندوز" &&
    rules.describeDevice(
      "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0",
    ) === "Edge · ویندوز" &&
    rules.describeDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    ) === "سافاری · آیفون" &&
    rules.describeDevice("") === rules.UNKNOWN_DEVICE &&
    rules.describeDevice(null) === rules.UNKNOWN_DEVICE,
);

check(
  "قواعد: برچسب وضعیت بر پایهٔ دلیل بسته‌شدن ساخته می‌شود",
  rules.statusLabel({ ended_at: null }) === "فعال" &&
    rules.statusLabel({ ended_at: new Date(NOW), end_reason: "revoked" }) ===
      rules.END_REASON_TITLES.revoked &&
    rules.statusLabel({
      ended_at: new Date(NOW),
      end_reason: null,
    }) === rules.DEFAULT_END_REASON_TITLE &&
    Object.keys(rules.END_REASON_TITLES).length >= 6,
);

const SAMPLE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";

const openItem = rules.buildItem(
  {
    id: 7,
    user_id: 3,
    username: "ali",
    role: "admin",
    sid: "abc",
    ip: "127.0.0.1",
    user_agent: SAMPLE_UA,
    started_at: new Date(NOW - 600_000),
    last_activity_at: new Date(NOW - 60_000),
    ended_at: null,
    end_reason: null,
    ended_by: null,
  },
  NOW,
  { currentSid: "abc" },
);

check(
  "قواعد: نمای نشست — نشست جاری علامت می‌خورد، دستگاه فارسی می‌شود و sid لو نمی‌رود",
  openItem.active === true &&
    openItem.current === true &&
    openItem.device === "کروم · ویندوز" &&
    openItem.seconds_since_activity === 60 &&
    openItem.status === "active" &&
    openItem.status_label === "فعال" &&
    openItem.sid === undefined,
);

const closedItem = rules.buildItem(
  {
    id: 8,
    user_id: 3,
    username: "ali",
    role: "admin",
    sid: "xyz",
    user_agent: SAMPLE_UA,
    last_activity_at: new Date(NOW - 60_000),
    ended_at: new Date(NOW - 30_000),
    end_reason: "revoked",
    ended_by: 1,
  },
  NOW,
  { currentSid: "abc" },
);

check(
  "قواعد: نمای نشستِ بسته‌شده — دلیل فارسی، نداشتن علامت جاری، ended_by",
  closedItem.active === false &&
    closedItem.current === false &&
    closedItem.status === "ended" &&
    closedItem.end_reason_title === rules.END_REASON_TITLES.revoked &&
    closedItem.ended_by === 1,
);

check(
  "قواعد: خلاصهٔ نشست‌ها (شمارش + کاربران یکتا + مرتب‌سازی: فعال‌ها اول، تازه‌ترین اول)",
  (() => {
    const summary = rules.buildSummary(
      [
        {
          id: 1,
          user_id: 1,
          sid: "s1",
          last_activity_at: new Date(NOW - 300_000),
          ended_at: null,
        },
        {
          id: 2,
          user_id: 2,
          sid: "s2",
          last_activity_at: new Date(NOW - 60_000),
          ended_at: new Date(NOW - 30_000),
          end_reason: "logout",
        },
        {
          id: 3,
          user_id: 1,
          sid: "s3",
          last_activity_at: new Date(NOW - 10_000),
          ended_at: null,
        },
        {
          id: 4,
          user_id: 3,
          sid: "s4",
          last_activity_at: new Date(NOW - 100_000),
          ended_at: null,
        },
      ],
      NOW,
      { currentSid: "s3" },
    );

    const order = summary.sessions.map((item) => item.id).join(",");
    return (
      summary.total === 4 &&
      summary.active === 3 &&
      summary.ended === 1 &&
      summary.unique_users === 3 &&
      order === "3,4,1,2" &&
      summary.sessions[0].current === true &&
      summary.touch_throttle_seconds > 0 &&
      summary.retention_days > 0 &&
      // ⚠️ هیچ sidای در خروجی نباشد
      !JSON.stringify(summary).includes('"sid"')
    );
  })(),
);

// ============================================================
// ۲) لایهٔ دیتابیس (مایگریشن · مدل · verify-db)
// ============================================================
const migrationPath =
  "Backend/migrations/20261004010000-create-user-sessions.js";
const migrationSource = read(migrationPath);

check("مایگریشن: فایل ایجاد جدول user_sessions وجود دارد", exists(migrationPath));

check(
  "مایگریشن: جدول + ایندکس‌ها (sid یکتا · user_id+ended_at · last_activity_at) ساخته می‌شوند",
  /createTable\(\s*"user_sessions"/.test(migrationSource) &&
    /addIndex\(\s*"user_sessions",\s*\["sid"\]/.test(migrationSource) &&
    /unique:\s*true/.test(migrationSource) &&
    /"user_sessions_user_id_ended_at"/.test(migrationSource) &&
    /"user_sessions_last_activity_at"/.test(migrationSource),
);

check(
  "مایگریشن: idempotent است (showAllTables/showIndex قبل از تغییر) و down دارد",
  /showAllTables\(\)/.test(migrationSource) &&
    /showIndex\(/.test(migrationSource) &&
    /dropTable\(\s*"user_sessions"\s*\)/.test(migrationSource),
);

check(
  "مایگریشن: ⭐ هیچ FOREIGN KEY به users ندارد (تاریخچه بعد از حذف کاربر می‌ماند)",
  !/references:/.test(migrationSource) && /بدون FK/.test(migrationSource),
);

const modelSource = read("Backend/models/UserSession.js");
check(
  "مدل: UserSession با ستون‌های کلیدی و نام جدول user_sessions تعریف شده است",
  exists("Backend/models/UserSession.js") &&
    /tableName:\s*"user_sessions"/.test(modelSource) &&
    /underscored:\s*true/.test(modelSource) &&
    /sid:/.test(modelSource) &&
    /user_agent:/.test(modelSource) &&
    /ended_at:/.test(modelSource) &&
    /end_reason:/.test(modelSource) &&
    /ended_by:/.test(modelSource),
);

const associationsSource = read("Backend/models/associations.js");
check(
  "ارتباطات: User/UserSession با constraints:false وصل شده‌اند (بدون CASCADE)",
  /User\.hasMany\(UserSession/.test(associationsSource) &&
    /UserSession\.belongsTo\(User/.test(associationsSource) &&
    /constraints:\s*false/.test(associationsSource),
);

const verifySource = read("Backend/scripts/verify-db.js");
check(
  "مایگریشن‌شمار: db:verify جدول/ستون‌ها/ایندکس‌های user_sessions را می‌شناسد",
  /"user_sessions",\s*\r?\n\s*"SequelizeMeta"/.test(verifySource) &&
    /user_sessions:\s*\[/.test(verifySource) &&
    /user_sessions_sid_unique/.test(verifySource) &&
    /user_sessions_user_id_ended_at/.test(verifySource) &&
    /user_sessions_last_activity_at/.test(verifySource) &&
    (verifySource.match(/user_sessions/g) || []).length >= 6,
);

check(
  "server.js: user_sessions جزو جدول‌های حیاتی /api/server-status است",
  /CRITICAL_TABLES[\s\S]{0,900}"user_sessions"/.test(read("Backend/server.js")),
);

// ============================================================
// ۳) سرویس و میدل‌ور (بررسی `sid` روی هر درخواست)
// ============================================================
const serviceSource = read("Backend/services/sessionService.js");

check(
  "سرویس: همهٔ عملیات لازم را دارد (start/touch/endBySid/endAllForUser/revoke/list/mine/summary/purgeExpired)",
  [
    "const start",
    "const touch",
    "const endBySid",
    "const endAllForUser",
    "const revoke",
    "const list",
    "const mine",
    "const summary",
    "const purgeExpired",
  ].every((token) => serviceSource.includes(token)),
);

check(
  "سرویس: نوشتنِ «آخرین فعالیت» هم‌زمان «باز بودن» نشست را چک می‌کند (where sid AND ended_at IS NULL)",
  /rules\.shouldTouch\(/.test(serviceSource) &&
    /where:\s*\{\s*sid,\s*ended_at:\s*null\s*\}/.test(serviceSource) &&
    /affected\s*===\s*0/.test(serviceSource),
);

check(
  "سرویس: ثبتِ توکن‌های باطل در حافظه (۴۰۱ آنی) + backoff وقتی جدول نیست",
  /const revokedSids = new Map\(\)/.test(serviceSource) &&
    /const markRevoked = /.test(serviceSource) &&
    /const isRevoked = /.test(serviceSource) &&
    /isMissingTableError/.test(serviceSource),
);

const authSource = read("Backend/middleware/auth.js");

check(
  "میدل‌ور: sid توکن خوانده می‌شود و روی req.sessionId می‌نشیند",
  /req\.sessionId\s*=\s*decoded\.sid/.test(authSource),
);

check(
  "میدل‌ور: ⭐ نشستِ بسته‌شده ⇒ ۴۰۱ (توکنِ دستگاه باطل‌شده دیگر کار نمی‌کند)",
  /sessionService"\)[\s\S]{0,160}?touch\(req\.sessionId\)/.test(authSource) &&
    /if\s*\(!alive\)[\s\S]{0,400}?status\(401\)/.test(authSource) &&
    /نشست شما بسته شده/.test(authSource),
);

const userModelSource = read("Backend/models/User.js");
check(
  "مدل کاربر: generateToken امضای افزودنی (sid) را می‌پذیرد",
  /generateToken\s*=\s*function\s*\(extra\s*=\s*\{\}\)/.test(userModelSource) &&
    /\.\.\.extra/.test(userModelSource),
);

// ============================================================
// ۴) مسیرها و کنترلر
// ============================================================
const routesSource = read("Backend/routes/sessionRoutes.js");

check(
  "مسیرها: هر پنج endpoint وجود دارند (mine / summary / list / revoke / revoke-all)",
  /get\(\s*"\/mine"/.test(routesSource) &&
    /get\(\s*"\/summary"/.test(routesSource) &&
    /get\(\s*"\/"/.test(routesSource) &&
    /post\(\s*"\/:id\/revoke"/.test(routesSource) &&
    /post\(\s*"\/users\/:userId\/revoke-all"/.test(routesSource),
);

check(
  "مسیرها: همه زیر protect هستند و مسیرهای ثابت پیش از مسیرهای پارامتری ثبت شده‌اند",
  /router\.use\(protect\)/.test(routesSource) &&
    routesSource.indexOf('"/mine"') < routesSource.indexOf('"/:id/revoke"'),
);

check(
  "مسیرها: مشاهده با کلید users.onlineStatus.view · بستن با کلید جدید users.sessions.revoke",
  /requirePermission\(\s*"users\.onlineStatus\.view"\s*\)/.test(routesSource) &&
    /requirePermission\(\s*"users\.sessions\.revoke"\s*\)/.test(routesSource) &&
    /ADMIN_ONLY/.test(routesSource),
);

check(
  "مسیرها: «نشست‌های من» برای همهٔ کاربرانِ لاگین‌شده باز است (بدون ADMIN_ONLY در همان خط)",
  /get\(\s*"\/mine",\s*sessionController\.mine\s*\)/.test(routesSource),
);

check(
  "کاتالوگ: کلید مجوز جدید در کاتالوگ هست و قفل‌نشده است (تست permissions-test)",
  /users\.sessions\.revoke/.test(read("Backend/config/permissions.js")) &&
    /TOTAL_PERMISSIONS === 164/.test(read("Backend/permissions-test.mjs")),
);

check(
  "server.js: روت‌های نشست mount شده‌اند",
  /app\.use\(\s*"\/api\/sessions",\s*sessionRoutes\s*\)/.test(
    read("Backend/server.js"),
  ),
);

const controllerSource = read("Backend/controllers/sessionController.js");
check(
  "کنترلر: پنج عملگر + استفاده از قواعد خالص (buildSummary/buildItem)",
  ["const list", "const summary", "const mine", "const revoke", "const revokeAll"].every(
    (token) => controllerSource.includes(token),
  ) &&
    /buildSummary\(/.test(controllerSource) &&
    /buildItem\(/.test(controllerSource) &&
    /parsePagination\(req\.query/.test(controllerSource),
);

// ============================================================
// ۵) سیم‌کشی ورود/خروج/تغییر رمز/بازنشانی/تغییر نقش
// ============================================================
const userControllerSource = read("Backend/controllers/userController.js");

check(
  "سیم‌کشی: ⭐ ورود، یک ردیف نشست می‌سازد و sid را داخل توکن می‌گذارد",
  /sessionService\.start\(/.test(userControllerSource) &&
    /generateToken\(session \? \{ sid: session\.sid \} : \{\}\)/.test(
      userControllerSource,
    ),
);

check(
  "سیم‌کشی: خروج، نشست همین دستگاه را می‌بندد (endBySid با sid توکن)",
  /sessionService\.endBySid\(req\.sessionId/.test(userControllerSource),
);

check(
  "سیم‌کشی: ⭐ تغییر رمز / بازنشانی توکن / تغییر نقش همهٔ نشست‌های باز را می‌بندند",
  /endAllForUser\(user\.id,\s*\{\s*reason:\s*"password_change"/.test(
    userControllerSource,
  ) &&
    /reason:\s*"reset"/.test(userControllerSource) &&
    /reason:\s*"role_change"/.test(userControllerSource),
);

// ============================================================
// ۶) فرانت‌اند · تنظیمات · ثبت گارد
// ============================================================
const apiConstSource = read("Frontend/src/core/constants/api.const.js");

check(
  "ثابت‌ها: بلوک SESSIONS با ۵ مسیر در api.const.js ثبت شده است",
  /SESSIONS:\s*\{[\s\S]{0,700}?"\/sessions\/mine"[\s\S]{0,300}?"\/sessions\/summary"[\s\S]{0,300}?"\/sessions\/:id\/revoke"[\s\S]{0,300}?"\/sessions\/users\/:userId\/revoke-all"/.test(
    apiConstSource,
  ),
);

const sessionServiceSource = read(
  "Frontend/src/core/services/session.service.js",
);

check(
  "فرانت: سرویس نشست نازک روی apiService است (توست/۴۰۱ هوشمند — بدون fetch خام)",
  /from\s+"\.\/api\.service\.js"/.test(sessionServiceSource) &&
    !/fetch\(/.test(sessionServiceSource) &&
    /API_CONSTANTS\.ENDPOINTS\.SESSIONS/.test(sessionServiceSource) &&
    /window\.sessionService/.test(sessionServiceSource),
);

check(
  "فرانت: سرویس نشست پنج عملیات را پوشش می‌دهد (mine/list/summary/revoke/revokeAll)",
  ["async mine", "async list", "async summary", "async revoke", "async revokeAll"].every(
    (token) => sessionServiceSource.includes(token),
  ),
);

check(
  "تنظیمات: متغیرهای محیطی نشست در .env.example مستند شده‌اند",
  /^SESSION_TOUCH_THROTTLE_SECONDS=\d+/m.test(read("Backend/.env.example")) &&
    /^SESSION_RETENTION_DAYS=\d+/m.test(read("Backend/.env.example")),
);

const frontendPkg = JSON.parse(read("Frontend/package.json") || "{}");
const backendPkg = JSON.parse(read("Backend/package.json") || "{}");

check(
  "ثبت: test:sessions در Frontend/package.json و هر دو gate runner هست",
  Boolean(frontendPkg.scripts?.["test:sessions"]) &&
    /'test:sessions'/.test(read("tools/gate.mjs")) &&
    /'test:sessions'/.test(read("tools/gate.ps1")),
);

check(
  "ثبت: تست e2e دیتابیسی نشست‌ها در Backend تعریف شده است",
  Boolean(backendPkg.scripts?.["test:sessions:e2e"]) &&
    exists("Backend/session-e2e-test.mjs"),
);

// ============================================================
// جمع‌بندی
// ============================================================
const failed = results.filter((ok) => !ok).length;
console.log("");
console.log(
  `${failed === 0 ? "✅ ALL PASS" : `❌ ${failed} FAILED`} — ${results.length} بررسی نشست`,
);
process.exitCode = failed === 0 ? 0 : 1;
