// ============================================================
//  تست انتها-به-انتها «ردّ فعالیت» (Activity Log) — دیتابیسی و دستی
// ------------------------------------------------------------
//  ⭐ معیار اثباتِ کار (proof of work):
//     یک تغییر وضعیت واقعی روی API ⇒ یک ردیف در activity_logs
//     که «چه کسی، چه زمانی، کدام موجودیت» را می‌گوید؛
//     و رمز عبور هرگز در آن ردیف نیست.
//
//  چه چیزی اثبات می‌شود؟
//    ۱) ورود موفق ⇒ ردیف با action=login و success=true
//    ۲) درخواست نامعتبر (۴۰۰) هم ثبت می‌شود با success=false
//    ۳) ورود ناموفق ⇒ ردیف login با success=false و نام تلاش‌شده
//    ۴) ⭐ رمز عبور در ستون fields ذخیره نمی‌شود (*** جای آن است)
//    ۵) فیلترها کار می‌کنند (action / success / user_id / entity / entity_id)
//    ۶) خلاصهٔ آماری با شمارش درست
//    ۷) جزئیات یک ردیف + ⭐ نبودِ session_id در پاسخ API
//    ۸) نگهبان‌های دسترسی: بدون توکن ۴۰۱ · نقش غیرِمدیریتی ۴۰۳
//    ۹) پاک‌سازی نگهداشت: ردیف قدیمی‌تر از retention حذف می‌شود
//   ۱۰) خودِ /api/activity در لاگ ثبت نمی‌شود (ضد حلقه)
//
//  اجرا:
//    $env:ALLOW_DB_TESTS='true'; npm run test:activity:e2e
//  ⚠️ کاربر و ردیف‌های آزمایشی در پایان پاک می‌شوند.
// ============================================================
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { QueryTypes } from "sequelize";

const require = createRequire(import.meta.url);

const PORT = 5097;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "ActivTest1234";
const USERNAME = `activity_e2e_${Date.now()}`;

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (text) => console.log(text);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (
  process.env.ALLOW_DB_TESTS !== "true" ||
  process.env.NODE_ENV === "production"
) {
  console.log("⏭️  SKIPPED (تست دیتابیسی)");
  console.log("   برای اجرا:  $env:ALLOW_DB_TESTS='true'; npm run test:activity:e2e");
  process.exit(0);
}

const { sequelize } = require("./config/database.js");
const User = require("./models/User.js");
const ActivityLog = require("./models/ActivityLog.js");
// ⭐ موج ۱۲.۵: برای سنجش مستقل resolver «مشتریِ مرتبط»
const Bookmark = require("./models/Bookmark.js");
const CustomerPersonalInfo = require("./models/CustomerPersonalInfo.js");
const activityService = require("./services/activityService.js");
const rules = require("./services/activityRules.js");
const customerResolver = require("./services/activityCustomerResolver.js");

let dbReady = false;
try {
  await Promise.race([
    sequelize.authenticate(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 8000),
    ),
  ]);
  dbReady = true;
} catch (error) {
  info(`⚠️  دیتابیس در دسترس نیست (${error.message}) → تست رد می‌شود`);
}

const servers = [];
const startBackend = () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "development", // متن خطاها برای تست خوانا باشد
      RATE_LIMIT_DISABLED: "true",
      CAPTCHA_ENABLED: "false",
      ENFORCE_SINGLE_SESSION: "false",
      PERMISSIONS_ENFORCE: "false", // ۴۰۳ نقش را با authorize(...ADMIN_ROLES) می‌سنجیم
      // ⭐ بافر کوتاه تا ردیف‌ها سریع در دیتابیس بنشینند
      ACTIVITY_LOG_ENABLED: "true",
      ACTIVITY_FLUSH_MS: "50",
      ACTIVITY_BUFFER_MAX: "5",
      ACTIVITY_LOG_VALUES: "true", // تا ماسک‌شدن رمز واقعاً سنجیده شود
      ACTIVITY_LOG_READS: "false",
      ACTIVITY_PURGE_INTERVAL_HOURS: "0", // پاک‌سازی دستی در تست
      SESSION_TOUCH_THROTTLE_SECONDS: "1",
      PRESENCE_TOUCH_THROTTLE_SECONDS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  servers.push(child);
  return child;
};

const waitFor = async (url) => {
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(url);
      if (res.status > 0) return true;
    } catch {
      // سرور هنوز بالا نیامده
    }
    await sleep(200);
  }
  return false;
};

const stopAll = async () => {
  servers.forEach((child) => {
    try {
      child.kill();
    } catch {
      // بی‌اهمیت
    }
  });
  try {
    await sequelize.close();
  } catch {
    // بی‌اهمیت
  }
};

const { Op } = require("sequelize");

const postJson = (path, token, body = {}) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const jsonOf = (res) => res.json().catch(() => ({}));

let seq = 0;
const uniqueSuffix = () => `${Date.now().toString().slice(-6)}${seq++}`;

const createTempUser = async (role, prefix) => {
  const suffix = uniqueSuffix();
  return User.create({
    first_name: "آزمون",
    last_name: "ردّ فعالیت",
    username: `${prefix}-${suffix}`,
    email: `${prefix}-${suffix}@example.invalid`,
    password: PASSWORD,
    mobile_number: `09${String(suffix).padStart(9, "0").slice(-9)}`,
    role,
    status: "active",
  });
};

// ============================================================
// اجرای تست
// ============================================================
const run = async () => {
  if (!dbReady) return;

  let adminUser = null;
  let expertUser = null;
  const touchedUserIds = [];

  try {
    adminUser = await createTempUser("admin", USERNAME);
    expertUser = await createTempUser("expert", `${USERNAME}_x`);
    touchedUserIds.push(adminUser.id, expertUser.id);

    startBackend();
    await waitFor(`${BASE}/api/ping`);

    // ===== ۱) ورود ناموفق (رمز غلط) =====
    const badLogin = await postJson("/api/users/login", null, {
      username: adminUser.username,
      password: "wrong-password-123",
    });
    check(
      "ورود ناموفق: پاسخ ۴۰۱ (و باید در ردّ فعالیت ثبت شود)",
      badLogin.status === 401,
      `status=${badLogin.status}`,
    );

    // ===== ۲) ورود موفق =====
    const login = await postJson("/api/users/login", null, {
      username: adminUser.username,
      password: PASSWORD,
    });
    const adminToken = (await jsonOf(login))?.data?.token || "";
    check(
      "ورود موفق: توکن دریافت شد",
      login.status === 200 && Boolean(adminToken),
      `status=${login.status}`,
    );

    // ===== ۳) یک تغییر وضعیت نامعتبر (۴۰۰) — باید هم ثبت شود =====
    // مسیر واقعی + توکن ⇒ req.user ست می‌شود و ردیف با user_id ثبت می‌شود
    const badWrite = await postJson("/api/users/register", adminToken, {});
    check(
      "درخواست نامعتبر: پاسخ ۴xx (ثبت با success=false)",
      badWrite.status >= 400 && badWrite.status < 500,
      `status=${badWrite.status}`,
    );

    // ===== ۴) ورود کارشناس (برای نگهبان نقش) =====
    const expertLogin = await postJson("/api/users/login", null, {
      username: expertUser.username,
      password: PASSWORD,
    });
    const expertToken = (await jsonOf(expertLogin))?.data?.token || "";
    check(
      "ورود کارشناس: توکن دریافت شد",
      expertLogin.status === 200 && Boolean(expertToken),
    );

    // ⭐ صبر تا بافر بنویسد (ACTIVITY_FLUSH_MS=50)
    await sleep(900);

    // ===== ۵) ردیف ورود موفق در دیتابیس =====
    const loginRow = await ActivityLog.findOne({
      where: { action: "login", user_id: adminUser.id },
      order: [["id", "DESC"]],
    });
    check(
      "⭐ دیتابیس: ورود موفق ⇒ ردیف login با success=true و آی‌پی/مرورگر",
      Boolean(loginRow) &&
        loginRow.success === true &&
        loginRow.username === adminUser.username &&
        loginRow.role === "admin" &&
        Boolean(loginRow.ip) &&
        Boolean(loginRow.user_agent),
      loginRow ? `id=${loginRow.id} ip=${loginRow.ip}` : "no-row",
    );

    // ===== ۶) ردیف ورود ناموفق =====
    const failedLoginRow = await ActivityLog.findOne({
      where: { action: "login", success: false, username: adminUser.username },
      order: [["id", "DESC"]],
    });
    check(
      "⭐ دیتابیس: ورود ناموفق با نام تلاش‌شده ثبت شد (user_id تهی)",
      Boolean(failedLoginRow) &&
        failedLoginRow.user_id === null &&
        failedLoginRow.status_code === 401,
      failedLoginRow ? `id=${failedLoginRow.id}` : "no-row",
    );

    // ===== ۷) ⭐ رمز هرگز ذخیره نمی‌شود =====
    const fieldsJson = JSON.stringify(loginRow?.fields || {});
    check(
      "⭐ امنیت: رمز عبور در ستون fields نیست (فقط ***)",
      Boolean(loginRow) &&
        fieldsJson.includes("***") &&
        !fieldsJson.includes(PASSWORD) &&
        !fieldsJson.includes("wrong-password-123"),
      fieldsJson.slice(0, 120),
    );

    // ===== ۸) تغییر نامعتبر هم ثبت شده =====
    const writeRow = await ActivityLog.findOne({
      where: { user_id: adminUser.id, method: "POST", success: false },
      order: [["id", "DESC"]],
    });
    check(
      "⭐ دیتابیس: تلاش ناموفق تغییر (POST) هم با success=false ثبت شد",
      Boolean(writeRow) && writeRow.status_code >= 400,
      writeRow ? `${writeRow.method} ${writeRow.path} (${writeRow.status_code})` : "no-row",
    );

    // ===== ۹) فهرست از مسیر API =====
    const listRes = await get("/api/activity?limit=50", adminToken);
    const listBody = await jsonOf(listRes);
    const activities = listBody?.data?.activities || [];
    check(
      "API: فهرست ردّ فعالیت ۲۰۰ + activities و config",
      listRes.status === 200 &&
        Array.isArray(activities) &&
        activities.length >= 3 &&
        // ⭐ زمان باید واقعی باشد (نبودِ at یعنی خواندن اشتباه نام ستون)
        activities.every((row) => Boolean(row.at) && Number.isFinite(row.seconds_ago)) &&
        Boolean(listBody?.data?.config),
      `status=${listRes.status} rows=${activities.length}`,
    );

    // ===== ۱۰) فیلتر action =====
    const onlyLogin = await jsonOf(
      await get("/api/activity?action=login&limit=50", adminToken),
    );
    const loginItems = onlyLogin?.data?.activities || [];
    check(
      "API: فیلتر action=login فقط رویدادهای ورود را می‌دهد",
      loginItems.length > 0 && loginItems.every((row) => row.action === "login"),
      `rows=${loginItems.length}`,
    );

    // ===== ۱۱) فیلتر success=false =====
    const onlyFail = await jsonOf(
      await get("/api/activity?success=false&limit=50", adminToken),
    );
    const failItems = onlyFail?.data?.activities || [];
    check(
      "API: فیلتر success=false فقط ناموفق‌ها را می‌دهد",
      failItems.length > 0 && failItems.every((row) => row.success === false),
      `rows=${failItems.length}`,
    );

    // ===== ۱۲) فیلتر user_id =====
    const onlyMine = await jsonOf(
      await get(`/api/activity?user_id=${adminUser.id}&limit=50`, adminToken),
    );
    const mineItems = onlyMine?.data?.activities || [];
    check(
      "API: فیلتر user_id فقط ردیف‌های همان کاربر را می‌دهد",
      mineItems.length > 0 && mineItems.every((row) => row.actor.id === adminUser.id),
      `rows=${mineItems.length}`,
    );

    // ===== ⭐ فیلترهای ۱۲.۳: entity / entity_id / success=true =====
    //   چرا این‌ها مهم‌اند؟ پنل «فعالیت کاربران» و تب تاریخچهٔ ۱۲.۴
    //   دقیقاً روی همین دو فیلتر سوار می‌شوند (entity + entity_id).
    const entityStamp = Date.now();
    const entityRow = await ActivityLog.create({
      action: "update",
      method: "PUT",
      path: `/api/customers/${entityStamp}`,
      route: "/api/customers/:id",
      entity: "customers",
      entity_id: String(entityStamp),
      success: true,
      status_code: 200,
      username: `${USERNAME}_entity`,
      summary: "تست فیلتر موجودیت",
    });

    const byEntity = await jsonOf(
      await get("/api/activity?entity=customers&limit=50", adminToken),
    );
    const entityItems = byEntity?.data?.activities || [];
    check(
      "⭐ API: فیلتر entity فقط ردیف‌های همان موجودیت را می‌دهد",
      entityItems.length > 0 &&
        entityItems.every((row) => row.entity === "customers") &&
        entityItems.some((row) => String(row.entity_id) === String(entityStamp)),
      `rows=${entityItems.length}`,
    );

    const byEntityId = await jsonOf(
      await get(
        `/api/activity?entity=customers&entity_id=${entityStamp}&limit=50`,
        adminToken,
      ),
    );
    const entityIdItems = byEntityId?.data?.activities || [];
    check(
      "⭐ API: فیلتر entity + entity_id فقط همان رکورد را می‌دهد (پایهٔ تب تاریخچه)",
      entityIdItems.length === 1 &&
        String(entityIdItems[0].entity_id) === String(entityStamp) &&
        Boolean(entityIdItems[0].at),
      `rows=${entityIdItems.length}`,
    );

    const onlySuccess = await jsonOf(
      await get("/api/activity?success=true&limit=50", adminToken),
    );
    const okItems = onlySuccess?.data?.activities || [];
    check(
      "API: فیلتر success=true قرینهٔ success=false است (فقط موفق‌ها)",
      okItems.length > 0 && okItems.every((row) => row.success === true),
      `rows=${okItems.length}`,
    );

    // پاک‌سازی ردیف ساختگی همین بخش (تست نباید اثری بگذارد)
    await ActivityLog.destroy({ where: { id: entityRow.id } });

    // ===== ⭐ ۱۲.۴.۲: شناسهٔ رکوردِ ساخته‌شده (POST) =====
    //   چرا؟ `POST /api/users` هیچ شناسه‌ای در URL ندارد ⇒ پیش‌تر entity_id=null
    //   ذخیره می‌شد و تب «تغییرات این رکورد» برای رکورد تازه‌ساخته‌شده خالی بود.
    check(
      "⭐ ۱۲.۴.۲ از بدنهٔ پاسخ: { data: { id } } ⇒ شناسه",
      rules.entityIdFromPayload({ data: { id: 12 } }) === "12",
      `got=${rules.entityIdFromPayload({ data: { id: 12 } })}`,
    );
    check(
      "⭐ ۱۲.۴.۲ از بدنهٔ پاسخ: { id: \"9\" } ⇒ شناسه",
      rules.entityIdFromPayload({ id: "9" }) === "9",
    );
    check(
      "⭐ ۱۲.۴.۲ از بدنهٔ پاسخ: { data: { user: { id } } } ⇒ شناسه",
      rules.entityIdFromPayload({ data: { user: { id: 3 } } }) === "3",
    );
    check(
      "⭐ ۱۲.۴.۲ از بدنهٔ پاسخ: { data: { customer: { id } } } ⇒ شناسه",
      rules.entityIdFromPayload({ data: { customer: { id: "7" } } }) === "7",
    );
    check(
      "⭐ ۱۲.۴.۲ از بدنهٔ پاسخ: بدنهٔ نامعتبر ⇒ null (ستون آلوده نمی‌شود)",
      rules.entityIdFromPayload({ data: { id: {} } }) === null &&
        rules.entityIdFromPayload({ data: { id: "x".repeat(80) } }) === null &&
        rules.entityIdFromPayload({ data: { id: 0 } }) === null &&
        rules.entityIdFromPayload({ data: { id: -3 } }) === null &&
        rules.entityIdFromPayload({}) === null &&
        rules.entityIdFromPayload(null) === null,
    );

    const hintEntry = rules.buildEntry({
      method: "POST",
      originalUrl: "/api/users",
      statusCode: 201,
      entityIdHint: "12",
    });
    check(
      "⭐ ۱۲.۴.۲ buildEntry: POST بدون شناسه در URL ⇒ شناسهٔ بدنه + شرح فارسی",
      hintEntry.entity_id === "12" && hintEntry.summary.includes("#12"),
      `entity_id=${hintEntry.entity_id} summary=${hintEntry.summary}`,
    );

    const urlWins = rules.buildEntry({
      method: "PUT",
      originalUrl: "/api/users/5",
      statusCode: 200,
      entityIdHint: "9",
    });
    check(
      "⭐ ۱۲.۴.۲ buildEntry: شناسهٔ مسیر بر بدنهٔ پاسخ اولویت دارد (بدون رگرسیون)",
      urlWins.entity_id === "5" && !urlWins.summary.includes("#9"),
      `entity_id=${urlWins.entity_id}`,
    );

    check(
      " ۱۲.۴.۲ buildEntry: POST بدون هیچ شناسه‌ای ⇒ entity_id=null (رفتار قبلی)",
      rules.buildEntry({
        method: "POST",
        originalUrl: "/api/users",
        statusCode: 201,
      }).entity_id === null,
    );

    // ===== ⭐ ۱۲.۴.۲ (E2E): ایجاد واقعی کاربر ⇒ ردیف با entity_id = شناسهٔ کاربر =====
    const newUserSuffix = uniqueSuffix();
    const newUsername = `${USERNAME}_new-${newUserSuffix}`;
    const created = await postJson("/api/users/register", adminToken, {
      first_name: "آزمون",
      last_name: "شناسهٔ رکورد",
      username: newUsername,
      email: `${newUsername}@example.invalid`,
      password: PASSWORD,
      mobile_number: `09${String(newUserSuffix).padStart(9, "0").slice(-9)}`,
      role: "expert",
    });
    const createdBody = await jsonOf(created);
    const createdUserId = createdBody?.data?.user?.id ?? null;
    check(
      "⭐ ۱۲.۴.۲ E2E: ایجاد کاربر پاسخ ۲۰۱ و شناسهٔ کاربر جدید را می‌دهد",
      created.status === 201 && Boolean(createdUserId),
      `status=${created.status} id=${createdUserId}`,
    );

    await sleep(700); // فرصت flush بافر لاگ
    const createRow = await ActivityLog.findOne({
      where: {
        method: "POST",
        path: "/api/users/register",
        entity: "users",
        user_id: adminUser.id,
      },
      order: [["id", "DESC"]],
    });
    check(
      "⭐ ۱۲.۴.۲ E2E: ردیف «ایجاد» با entity_id = شناسهٔ رکورد ساخته‌شده ذخیره می‌شود",
      Boolean(createRow) &&
        String(createRow.entity_id) === String(createdUserId) &&
        createRow.success === true,
      `entity_id=${createRow?.entity_id} expected=${createdUserId}`,
    );

    const byCreatedId = await jsonOf(
      await get(`/api/activity?entity=users&entity_id=${createdUserId}&limit=50`, adminToken),
    );
    check(
      "⭐ ۱۲.۴.۲ E2E: API با entity + entity_id رکورد تازه‌ساخته‌شده را برمی‌گرداند (تب تاریخچه)",
      (byCreatedId?.data?.activities || []).length >= 1 &&
        (byCreatedId?.data?.activities || []).every(
          (row) => String(row.entity_id) === String(createdUserId),
        ),
      `rows=${(byCreatedId?.data?.activities || []).length}`,
    );

    // پاک‌سازی کاربر ساخته‌شده در همین بخش
    if (createdUserId) {
      try {
        await ActivityLog.destroy({ where: { entity: "users", entity_id: String(createdUserId) } });
        await User.destroy({ where: { username: newUsername } });
      } catch {
        // بی‌اهمیت
      }
    }
    // ===== ⭐ ۱۲.۵: «همهٔ تغییرات این مشتری» =====
    //  ۱) منطق خالص: انتساب مشتری از بدنه/مسیر/پاسخ و خودانتسابی مشتری
    //  ۲) میدل‌ور: POST با customer_id ⇒ ردیف با customer_id (حتی ناموفق)
    //  ۳) resolver در flush: ردیف‌های زیرمجموعه از جدول خودشان پر می‌شوند
    //  ۴) API: ?customer_id= فقط ردیف‌های همان مشتری را می‌دهد

    check(
      "⭐ ۱۲.۵ rules: شناسهٔ مشتری فقط عدد صحیح مثبت پذیرفته می‌شود",
      rules.normalizeCustomerId("12") === 12 &&
        rules.normalizeCustomerId(12) === 12 &&
        rules.normalizeCustomerId("0") === null &&
        rules.normalizeCustomerId("12.5") === null &&
        rules.normalizeCustomerId("abc") === null &&
        rules.normalizeCustomerId("a1b2c3d4-0000-1111-2222-333344445555") === null &&
        rules.normalizeCustomerId(null) === null,
    );

    check(
      "⭐ ۱۲.۵ rules: خودانتسابی مشتری از مسیر (entity=customers)",
      rules.customerIdFromRequest({ entity: "customers", entityId: "77" }) === 77,
    );

    check(
      "⭐ ۱۲.۵ rules: customer_id از بدنه بر پارامتر/کوئری اولویت دارد",
      rules.customerIdFromRequest({
        body: { customer_id: 5 },
        params: { customerId: "6" },
        query: { customer_id: "7" },
      }) === 5,
    );

    check(
      "⭐ ۱۲.۵ buildEntry: customerId در ردیف می‌نشیند و در buildItem می‌ماند",
      (() => {
        const entry = rules.buildEntry({
          method: "POST",
          originalUrl: "/api/halls",
          statusCode: 201,
          customerId: 5,
          entityIdHint: "88",
        });
        const item = rules.buildItem({
          id: 1,
          action: "create",
          entity: "halls",
          entity_id: "88",
          customer_id: entry.customer_id,
          success: true,
          created_at: new Date(),
        });
        return entry.customer_id === 5 && item.customer_id === 5;
      })(),
    );

    // ردیف «مشتری ناموجود» نمی‌سازیم؛ فقط یک شناسهٔ بزرگِ بی‌برخورد انتخاب
    // می‌کنیم تا فیلتر و resolver روی داده‌ی واقعی سنجیده شوند.
    const ghostCustomerId = 900000000 + (Date.now() % 90000000);

    // ===== ۲) میدل‌ور: customer_id از بدنهٔ درخواست =====
    const ghostResponse = await postJson("/api/bookmarks", adminToken, {
      title: "آزمون ۱۲.۵ — مشتری ناموجود",
      customer_id: ghostCustomerId,
    });
    check(
      "⭐ ۱۲.۵ E2E: ساخت بوکمارک با مشتری ناموجود ⇒ ۴۰۴ (بدون ساخت رکورد)",
      ghostResponse.status === 404,
      `status=${ghostResponse.status}`,
    );

    await sleep(700);
    const ghostRow = await ActivityLog.findOne({
      where: {
        method: "POST",
        path: "/api/bookmarks",
        user_id: adminUser.id,
      },
      order: [["id", "DESC"]],
    });
    check(
      "⭐ ۱۲.۵ E2E: میدل‌ور customer_id را روی ردیف (حتی ناموفق) ثبت می‌کند",
      Boolean(ghostRow) &&
        ghostRow.customer_id === ghostCustomerId &&
        ghostRow.success === false,
      `customer_id=${ghostRow?.customer_id} expected=${ghostCustomerId}`,
    );

    // ===== ۳) resolver: پر کردن customer_id در زمان flush =====
    // ⚠️ bookmarks.customer_id کلید خارجی دارد ⇒ برای ساخت رکورد باید مشتری
    //    واقعی باشد. شناسهٔ «مشتری ناموجود» بالا فقط برای ردیف لاگ استفاده شد
    //    (ستون activity_logs.customer_id عمداً FK ندارد).
    const realCustomer = await CustomerPersonalInfo.findOne({
      order: [["id", "ASC"]],
    });
    check(
      "⭐ ۱۲.۵ E2E: مشتری واقعی برای آزمون resolver موجود است",
      Boolean(realCustomer?.id),
      realCustomer ? `customer_id=${realCustomer.id}` : "no-customer",
    );

    const bookmarkRow = await Bookmark.create({
      title: "آزمون ۱۲.۵ — resolver",
      type: "bookmark",
      priority: "medium",
      status: "active",
      customer_id: realCustomer.id,
      created_by: adminUser.id,
    });

    // ردیف را «می‌سازیم ولی ذخیره نمی‌کنیم» تا استنتاج دقیقاً مثل flush
    // (پیش از INSERT) اعمال شود، سپس همان ردیف با customer_id ذخیره می‌شود.
    const resolverRow = ActivityLog.build({
      action: "update",
      method: "PUT",
      path: "/api/bookmarks",
      route: "/api/bookmarks/:id",
      entity: "bookmarks",
      entity_id: String(bookmarkRow.id),
      customer_id: null,
      success: true,
      status_code: 200,
      username: `${USERNAME}_resolver`,
      summary: "تست استنتاج مشتری",
    });

    const filled = await customerResolver.resolveCustomerIds([resolverRow]);
    await resolverRow.save();
    check(
      "⭐ ۱۲.۵ resolver: customer_id ردیف از جدول موجودیت پر می‌شود (بدون کوئری در مسیر پاسخ)",
      filled >= 1 && resolverRow.customer_id === realCustomer.id,
      `filled=${filled} customer_id=${resolverRow.customer_id} expected=${realCustomer.id}`,
    );

    // زیرمنبع سالن: hall_id → halls.customer_id (مسیر JOIN واقعی)
    const hallSystemSample = (
      await sequelize.query(
        `SELECT hs.id AS hs_id, h.customer_id AS customer_id
           FROM hall_systems hs
           INNER JOIN halls h ON h.id = hs.hall_id
          WHERE h.customer_id IS NOT NULL
          LIMIT 1`,
        { type: QueryTypes.SELECT },
      )
    )[0];

    if (hallSystemSample) {
      const derived = {
        entity: "hall-systems",
        entity_id: String(hallSystemSample.hs_id),
        customer_id: null,
      };
      const filledHall = await customerResolver.resolveCustomerIds([derived]);
      check(
        "⭐ ۱۲.۵ resolver: زیرمنبع سالن (hall-systems) از سالن به مشتری می‌رسد",
        filledHall === 1 &&
          derived.customer_id === Number(hallSystemSample.customer_id),
        `filled=${filledHall} customer_id=${derived.customer_id} expected=${hallSystemSample.customer_id}`,
      );
    } else {
      check(
        "⭐ ۱۲.۵ resolver: SQL زیرمنبع سالن به halls JOIN می‌شود (نمونهٔ داده نبود)",
        customerResolver
          .buildSql(customerResolver.CUSTOMER_SOURCES["hall-systems"])
          .includes('INNER JOIN "halls"'),
      );
    }

    const untouched = {
      entity: "bookmarks",
      entity_id: String(bookmarkRow.id),
      customer_id: 3,
    };
    await customerResolver.resolveCustomerIds([untouched]);
    check(
      "⭐ ۱۲.۵ resolver: ردیف دارای customer_id دست‌نخورده می‌ماند",
      untouched.customer_id === 3,
    );

    // ===== ۴) API: فیلتر customer_id =====
    const byCustomer = await jsonOf(
      await get(`/api/activity?customer_id=${ghostCustomerId}&limit=50`, adminToken),
    );
    const customerItems = byCustomer?.data?.activities || [];
    check(
      "⭐ ۱۲.۵ E2E: API با customer_id ردیف‌های «همان مشتری» را می‌دهد (حتی ردیف ناموفق)",
      customerItems.length >= 1 &&
        customerItems.every((row) => Number(row.customer_id) === ghostCustomerId),
      `rows=${customerItems.length}`,
    );

    const byRealCustomer = await jsonOf(
      await get(`/api/activity?customer_id=${realCustomer.id}&limit=50`, adminToken),
    );
    const realItems = byRealCustomer?.data?.activities || [];
    check(
      "⭐ ۱۲.۵ E2E: ردیفِ customer_id استنتاج‌شده هم در فیلتر مشتری دیده می‌شود",
      realItems.length >= 1 &&
        realItems.every((row) => Number(row.customer_id) === Number(realCustomer.id)) &&
        realItems.some((row) => String(row.id) === String(resolverRow.id)),
      `rows=${realItems.length}`,
    );

    const noCustomerFilter = await jsonOf(
      await get("/api/activity?customer_id=&limit=50", adminToken),
    );
    check(
      "⭐ ۱۲.۵ E2E: customer_id خالی ⇒ فیلتر اعمال نمی‌شود (رفتار قبلی)",
      (noCustomerFilter?.data?.activities || []).some((row) => row.customer_id == null),
      `rows=${(noCustomerFilter?.data?.activities || []).length}`,
    );

    const badCustomer = await get("/api/activity?customer_id=abc&limit=5", adminToken);
    check(
      "⭐ ۱۲.۵ E2E: customer_id نامعتبر ⇒ فیلتر نادیده (بدون ۵۰۰)",
      badCustomer.status === 200,
      `status=${badCustomer.status}`,
    );

    // پاک‌سازی آثار همین بخش
    try {
      await ActivityLog.destroy({ where: { id: resolverRow.id } });
      await ActivityLog.destroy({ where: { customer_id: ghostCustomerId } });
      await Bookmark.destroy({ where: { id: bookmarkRow.id } });
    } catch {
      // بی‌اهمیت
    }



    // ===== ۱۳) خلاصه =====
    const summary = (await jsonOf(await get("/api/activity/summary", adminToken)))
      ?.data;
    check(
      "API: خلاصهٔ آماری شمارش موفق/ناموفق و کلیدهای فارسی را می‌دهد",
      Boolean(summary) &&
        summary.total >= 3 &&
        summary.failed >= 1 &&
        summary.success >= 1 &&
        typeof summary.by_action === "object",
      summary ? `total=${summary.total} ok=${summary.success} fail=${summary.failed}` : "no-data",
    );

    // ===== ۱۴) جزئیات + ⭐ نبودِ session_id =====
    const detailRes = await get(`/api/activity/${loginRow.id}`, adminToken);
    const detailText = await detailRes.text();
    check(
      "⭐ API: جزئیات ردیف ۲۰۰ است و ستون داخلی session_id را لو نمی‌دهد",
      detailRes.status === 200 &&
        !detailText.includes("session_id") &&
        detailText.includes(String(loginRow.id)),
      `status=${detailRes.status}`,
    );

    // ===== ۱۵) نگهبان دسترسی: بدون توکن =====
    const anonymous = await get("/api/activity");
    check("نگهبان: بدون توکن ۴۰۱", anonymous.status === 401, `status=${anonymous.status}`);

    // ===== ۱۶) نگهبان دسترسی: نقش کارشناس =====
    const expertRes = await get("/api/activity", expertToken);
    check(
      "نگهبان: نقش expert پاسخ ۴۰۳ می‌گیرد (فقط مدیران)",
      expertRes.status === 403,
      `status=${expertRes.status}`,
    );

    // ===== ۱۷) ⭐ ضد حلقه: خودِ /api/activity ثبت نمی‌شود =====
    const loopRows = await ActivityLog.count({
      where: { path: { [Op.like]: "/api/activity%" } },
    });
    check(
      "⭐ ضد حلقه: هیچ ردیفی برای خودِ /api/activity ساخته نشده",
      loopRows === 0,
      `rows=${loopRows}`,
    );

    // ===== ۱۸) heartbeat حضور ثبت نمی‌شود (skip list) =====
    await postJson("/api/presence/heartbeat", adminToken, {});
    await sleep(700);
    const heartbeatRows = await ActivityLog.count({
      where: { path: { [Op.like]: "%presence%" } },
    });
    check(
      "ضد نویز: heartbeat حضور در ردّ فعالیت ثبت نمی‌شود",
      heartbeatRows === 0,
      `rows=${heartbeatRows}`,
    );

    // ===== ۱۹) پاک‌سازی نگهداشت =====
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const oldRow = await ActivityLog.create({
      action: "create",
      method: "POST",
      path: "/api/legacy-test",
      success: true,
      username: `${USERNAME}_old`,
      // ⚠️ نام صفت Sequelize (createdAt) — با created_at زمانِ دلخواه ست نمی‌شد
      createdAt: oldDate,
      updatedAt: oldDate,
    });
    const purged = await activityService.purgeExpired({ retentionDaysValue: 180 });
    const oldStillThere = await ActivityLog.findByPk(oldRow.id);
    check(
      "⭐ نگهداشت: ردیف قدیمی‌تر از RETENTION حذف می‌شود و ردیف‌های تازه می‌مانند",
      purged >= 1 && oldStillThere === null,
      `purged=${purged}`,
    );

    // ===== ۲۰) خروج کاربر =====
    const logout = await postJson("/api/users/logout", adminToken, {});
    await sleep(700);
    const logoutRow = await ActivityLog.findOne({
      where: { action: "logout", user_id: adminUser.id },
      order: [["id", "DESC"]],
    });
    check(
      "⭐ دیتابیس: خروج کاربر ⇒ ردیف logout با success=true",
      logout.status === 200 && Boolean(logoutRow) && logoutRow.success === true,
      `status=${logout.status}`,
    );

  } finally {
    // ============================================================
    // پاک‌سازی
    // ============================================================
    if (touchedUserIds.length > 0) {
      try {
        await ActivityLog.destroy({
          where: { user_id: { [Op.in]: touchedUserIds } },
        });
        await ActivityLog.destroy({
          where: { username: { [Op.like]: `${USERNAME}%` } },
        });
      } catch {
        // بی‌اهمیت
      }
    }
    try {
      await User.destroy({ where: { username: { [Op.like]: `${USERNAME}%` } } });
    } catch {
      // بی‌اهمیت
    }

    await stopAll();

    const passed = results.filter(Boolean).length;
    const failed = results.length - passed;
    console.log("");
    if (failed === 0) {
      console.log(`ACTIVITY-E2E-PASS — ${passed}/${results.length} بررسی موفق`);
    } else {
      console.log(`ACTIVITY-E2E-FAIL — ${failed} بررسی ناموفق از ${results.length}`);
    }
    process.exitCode = failed === 0 ? 0 : 1;
  }
};

await run();

