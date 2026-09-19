// تست موقت (E2E با دیتابیس واقعی) — بعداً حذف می‌شود
// هدف: اثبات اینکه کاربر کم‌دسترسی نمی‌تواند کاربر بسازد/ویرایش کند،
//       ولی ادمین‌ها (پنل مدیریت) دسترسی خود را از دست نداده‌اند.
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

const PORT = 5094;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (s) => console.log(s);

// ===== ۱) اتصال به دیتابیس =====
// ✅ محافظ: این تست به دیتابیس واقعی وصل می‌شود و تغییرات موقت ایجاد می‌کند
// بنابراین فقط با اجازهٔ صریح اجرا می‌شود (تا اشتباهی روی سرور اصلی اجرا نشود).
if (process.env.ALLOW_DB_TESTS !== "true" || process.env.NODE_ENV === "production") {
  console.log("⏭️  SKIPPED (تست دیتابیسی)");
  console.log("   برای اجرا:  set ALLOW_DB_TESTS=true && npm run test:db");
  process.exit(0);
}

const { sequelize } = require("./config/database.js");
const User = require("./models/User.js");
// ✅ «تغییرات جدید / What's New»
const ReleaseNoteItem = require("./models/ReleaseNoteItem.js");
const ReleaseNoteView = require("./models/ReleaseNoteView.js");
// ✅ مشتریان (برای بررسی شمارهٔ مشتری و پاکسازی داده تستی)
const CustomerPersonalInfo = require("./models/CustomerPersonalInfo.js");

let dbReady = false;
try {
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("db timeout")), 8000),
  );
  await Promise.race([sequelize.authenticate(), timeout]);
  dbReady = true;
  info("✅ اتصال به دیتابیس برقرار شد");
} catch (e) {
  info(`⚠️  دیتابیس در دسترس نیست (${e.message}) → تست E2E رد می‌شود`);
}

const child = dbReady
  ? spawn(process.execPath, ["server.js"], {
      cwd: import.meta.dirname,
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: "development", // برای دیدن پیام‌های دقیق در تست‌ها
        RATE_LIMIT_DISABLED: "true", // برای اینکه محدودیت نرخ وسط تست مزاحم نشود
        LOGIN_MAX_ATTEMPTS: "2", // برای تست سریع قفل حساب
        LOGIN_LOCK_MINUTES: "15",
        CAPTCHA_ENABLED: "true",
        CAPTCHA_DEBUG: "true", // تا پاسخ درست کپچا در محیط تست برگردد
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
  : null;

let log = "";
if (child) {
  child.stdout.on("data", (d) => (log += d.toString()));
  child.stderr.on("data", (d) => (log += d.toString()));
}

const base = `http://127.0.0.1:${PORT}`;
const waitFor = async (url, opts) => {
  for (let i = 0; i < 100; i++) {
    try {
      return await fetch(url, opts);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("server not ready");
};

const run = async () => {
  if (!dbReady) {
    info("ℹ️  برای اجرای این تست باید PostgreSQL بالا باشد.");
    return;
  }

  const tokenFor = (user) =>
    jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

  const low = await User.findOne({
    where: { role: ["customer", "expert"] },
    order: [["id", "ASC"]],
  });
  const admin = await User.findOne({
    where: { role: ["super_admin", "admin", "sub_admin"] },
  });

  if (!low || !admin) {
    info(
      `⚠️  کاربر کم‌دسترسی یا ادمین در دیتابیس پیدا نشد (low=${!!low} admin=${!!admin}) → رد شد`,
    );
    return;
  }
  info(`🔎 کاربر کم‌دسترسی: id=${low.id} role=${low.role}`);
  info(`🔎 ادمین: id=${admin.id} role=${admin.role}`);

  const lowToken = tokenFor(low);
  const adminToken = tokenFor(admin);
  const authHeaders = (t) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${t}`,
  });

  await waitFor(`${base}/api/ping`);

  // ===== ۱) کاربر کم‌دسترسی =====
  let r = await fetch(`${base}/api/users`, { headers: authHeaders(lowToken) });
  check(
    "کاربر کم‌دسترسی: لیست کاربران ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/users/register`, {
    method: "POST",
    headers: authHeaders(lowToken),
    body: JSON.stringify({
      first_name: "x",
      last_name: "y",
      username: "__hacker__",
      email: "hacker@test.local",
      password: "123456",
      mobile_number: "09999999999",
      role: "super_admin",
    }),
  });
  check(
    "کاربر کم‌دسترسی: ساخت کاربر ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/users/${admin.id}`, {
    method: "PUT",
    headers: authHeaders(lowToken),
    body: JSON.stringify({ role: "super_admin" }),
  });
  check(
    "کاربر کم‌دسترسی: ویرایش کاربر دیگر ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/users/${admin.id}`, {
    method: "DELETE",
    headers: authHeaders(lowToken),
  });
  check(
    "کاربر کم‌دسترسی: حذف کاربر دیگر ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  // خودش نباید بتواند نقشش را بالا ببرد (فیلدهای حساس حذف می‌شوند)
  r = await fetch(`${base}/api/users/${low.id}`, {
    method: "PUT",
    headers: authHeaders(lowToken),
    body: JSON.stringify({ role: "super_admin", status: "active" }),
  });
  const afterSelf = await User.findByPk(low.id);
  check(
    "کاربر کم‌دسترسی: نمی‌تواند نقش خودش را ارتقا دهد",
    afterSelf.role === low.role,
    `status=${r.status} role=${afterSelf.role}`,
  );

  // ===== ۲) ادمین =====
  r = await fetch(`${base}/api/users?limit=1`, { headers: authHeaders(adminToken) });
  check(
    "ادمین: لیست کاربران (پنل مدیریت سالم است)",
    r.status === 200,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/users/by-role/expert`, {
    headers: authHeaders(adminToken),
  });
  check("ادمین: دریافت کاربران بر اساس نقش", r.status === 200, `status=${r.status}`);

  r = await fetch(`${base}/api/users/${low.id}`, {
    headers: authHeaders(adminToken),
  });
  check("ادمین: مشاهدهٔ اطلاعات یک کاربر", r.status === 200, `status=${r.status}`);

  // PATCH (همان چیزی که پنل مدیریت برای تغییر وضعیت می‌فرستد و قبلاً ۴۰۴ می‌گرفت)
  r = await fetch(`${base}/api/users/${low.id}`, {
    method: "PATCH",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ status: low.status }),
  });
  check(
    "ادمین: PATCH کاربر (تغییر وضعیت - قبلاً ۴۰۴ بود)",
    r.status === 200,
    `status=${r.status}`,
  );

  // ===== ۳) وضعیت آنلاین خودِ کاربر =====
  // ===== نشت داده: مسیرهای مشتری و دیکشنری برای کاربران وارد‌شده باید باز باشند =====
  r = await fetch(`${base}/api/customers?limit=1`, {
    headers: authHeaders(adminToken),
  });
  check("ادمین: لیست مشتری‌ها", r.status === 200, `status=${r.status}`);

  r = await fetch(`${base}/api/dictionary/hall-types`, {
    headers: authHeaders(adminToken),
  });
  check("ادمین: دیکشنری hall-types", r.status === 200, `status=${r.status}`);

  r = await fetch(`${base}/api/dictionary/experts`, {
    headers: authHeaders(adminToken),
  });
  check("ادمین: لیست کارشناسان", r.status === 200, `status=${r.status}`);

  const expert = await User.findOne({ where: { role: "expert" } });
  if (expert) {
    const expertToken = tokenFor(expert);
    r = await fetch(`${base}/api/dictionary/hall-types`, {
      headers: authHeaders(expertToken),
    });
    check(
      "کارشناس: دیکشنری hall-types (فرم‌ها نباید بشکنند)",
      r.status === 200,
      `status=${r.status}`,
    );

    r = await fetch(`${base}/api/customers?limit=1`, {
      headers: authHeaders(expertToken),
    });
    check("کارشناس: لیست مشتری‌ها", r.status === 200, `status=${r.status}`);
  } else {
    info("ℹ️ کاربر کارشناس در دیتابیس نبود → تست کارشناس رد شد");
  }

  // ===== قفل حساب پس از تلاش‌های ناموفق (LOGIN_MAX_ATTEMPTS=2 در این تست) =====
  const beforeLockState = await User.findByPk(low.id, {
    attributes: ["failed_login_attempts", "locked_until"],
  });

  // ✅ گرفتن کد امنیتی جدید (در محیط تست، پاسخ درست هم برمی‌گردد)
  const getCaptcha = async () => {
    const res = await fetch(`${base}/api/captcha`);
    const json = await res.json().catch(() => ({}));
    const data = json?.data || {};
    return { id: data.id, answer: data.debugAnswer };
  };

  const wrongLogin = async (captcha = null) => {
    const item = captcha || (await getCaptcha());

    return fetch(`${base}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: low.username,
        password: "__wrong__",
        captcha_id: item.id,
        captcha_answer: item.answer,
      }),
    });
  };

  // ✅ کپچا: در محیط تست پاسخ درست هم برای تست برمی‌گردد (CAPTCHA_DEBUG)
  const firstCaptcha = await getCaptcha();
  check(
    "کپچا: چالش با debugAnswer در محیط تست برگردانده می‌شود",
    !!firstCaptcha.id && !!firstCaptcha.answer,
    `id=${firstCaptcha.id ? "ok" : "-"} answer=${firstCaptcha.answer || "-"}`,
  );

  const wrongCaptchaAttempt = await wrongLogin({
    id: firstCaptcha.id,
    answer: "ZZZZZ",
  });
  check(
    "کپچا: پاسخ اشتباه → 400 (قبل از بررسی رمز)",
    wrongCaptchaAttempt.status === 400,
    `status=${wrongCaptchaAttempt.status}`,
  );

  await low.update({ failed_login_attempts: 0, locked_until: null });

  const firstWrong = await wrongLogin();
  const firstBody = await firstWrong.json().catch(() => ({}));
  check(
    "ورود با رمز اشتباه → 401 با تعداد تلاش باقی‌مانده",
    firstWrong.status === 401 &&
      /تلاش باقی مانده/.test(String(firstBody.message)),
    `status=${firstWrong.status} msg=${String(firstBody.message).slice(0, 50)}`,
  );

  const secondWrong = await wrongLogin();
  const secondBody = await secondWrong.json().catch(() => ({}));
  check(
    "رسیدن به سقف تلاش → حساب قفل میشود (423)",
    secondWrong.status === 423,
    `status=${secondWrong.status} msg=${String(secondBody.message).slice(0, 50)}`,
  );

  const afterLockDb = await User.findByPk(low.id, {
    attributes: ["failed_login_attempts", "locked_until"],
  });
  check(
    "قفل حساب در دیتابیس ثبت شد",
    afterLockDb.failed_login_attempts >= 2 && !!afterLockDb.locked_until,
    `attempts=${afterLockDb.failed_login_attempts} locked=${!!afterLockDb.locked_until}`,
  );

  const lockedAttempt = await wrongLogin();
  const lockedBody = await lockedAttempt.json().catch(() => ({}));
  check(
    "حساب قفلشده حتی با درخواست جدید هم رد میشود (423)",
    lockedAttempt.status === 423 && /قفل/.test(String(lockedBody.message)),
    `status=${lockedAttempt.status}`,
  );

  const unlockRes = await fetch(`${base}/api/users/${low.id}/unlock`, {
    method: "POST",
    headers: authHeaders(adminToken),
  });
  check(
    "ادمین میتواند قفل حساب را باز کند",
    unlockRes.status === 200,
    `status=${unlockRes.status}`,
  );

  const afterUnlockDb = await User.findByPk(low.id, {
    attributes: ["failed_login_attempts", "locked_until"],
  });
  check(
    "پس از بازکردن قفل، شمارنده صفر شد",
    afterUnlockDb.failed_login_attempts === 0 &&
      afterUnlockDb.locked_until === null,
    `attempts=${afterUnlockDb.failed_login_attempts} locked=${!!afterUnlockDb.locked_until}`,
  );

  // 🧹 بازگرداندن وضعیت قبلی دیتابیس
  await low.update({
    failed_login_attempts: beforeLockState.failed_login_attempts || 0,
    locked_until: beforeLockState.locked_until || null,
  });

  r = await fetch(`${base}/api/users/${low.id}/online-status`, {
    method: "PATCH",
    headers: authHeaders(lowToken),
    body: JSON.stringify({ status: false }),
  });
  check(
    "کاربر: تغییر وضعیت آنلاین خودش (PATCH قبلاً ۴۰۴ بود)",
    r.status === 200,
    `status=${r.status}`,
  );

  // ===== مسیرهای حساس پیامک: کاربر کم‌دسترسی نباید دسترسی داشته باشد =====
  r = await fetch(`${base}/api/sms/verify`, {
    method: "POST",
    headers: authHeaders(lowToken),
    body: JSON.stringify({ mobile: "09120000000" }),
  });
  check(
    "کاربر کم‌دسترسی: ارسال کد تأیید پیامک ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/sms/lines`, { headers: authHeaders(lowToken) });
  check(
    "کاربر کم‌دسترسی: مشاهدهٔ خطوط پیامک ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/sms/received`, { headers: authHeaders(lowToken) });
  check(
    "کاربر کم‌دسترسی: صندوق پیام‌های دریافتی ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/sms/lines`, { headers: authHeaders(adminToken) });
  check(
    "ادمین: مسیر خطوط پیامک رد نمی‌شود (۴۰۳ نمی‌گیرد)",
    r.status !== 403 && r.status !== 401,
    `status=${r.status}`,
  );

  // ===== نظرات و پیشنهادات (گفتگوی کاربر ↔ ادمین) =====
  let suggestionId = null;

  r = await fetch(`${base}/api/suggestions`, {
    method: "POST",
    headers: authHeaders(lowToken),
    body: JSON.stringify({
      subject: "suggestion",
      title: "تست خودکار — پیشنهاد",
      body: "این پیام توسط تست خودکار ساخته شده است.",
    }),
  });
  const suggestionBody = await r.json().catch(() => ({}));
  suggestionId = suggestionBody?.data?.id || null;
  check(
    "کاربر: ثبت نظر/پیشنهاد → ۲۰۱",
    r.status === 201 && Boolean(suggestionId),
    `status=${r.status} id=${suggestionId}`,
  );

  r = await fetch(`${base}/api/suggestions`, { headers: authHeaders(lowToken) });
  check(
    "کاربر کم‌دسترسی: فهرست ادمینِ نظرات ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/suggestions/mine`, {
    headers: authHeaders(lowToken),
  });
  const mineBody = await r.json().catch(() => ({}));
  check(
    "کاربر: فهرست پیام‌های خودش → ۲۰۰",
    r.status === 200 &&
      Array.isArray(mineBody?.data?.items) &&
      mineBody.data.items.length >= 1,
    `status=${r.status} items=${mineBody?.data?.items?.length}`,
  );

  r = await fetch(`${base}/api/suggestions/${admin.id}`, {
    headers: authHeaders(adminToken),
  });
  check(
    "ادمین نمی‌تواند از روت کاربریِ گفتگوی دیگری استفاده کند (۴۰۴)",
    r.status === 404,
    `status=${r.status}`,
  );

  if (suggestionId) {
    r = await fetch(`${base}/api/suggestions`, { headers: authHeaders(adminToken) });
    const adminListBody = await r.json().catch(() => ({}));
    check(
      "ادمین: فهرست نظرات + شمارندهٔ نخوانده → ۲۰۰",
      r.status === 200 &&
        Array.isArray(adminListBody?.data?.items) &&
        Number(adminListBody?.data?.counts?.admin_unread || 0) >= 1,
      `status=${r.status} unread=${adminListBody?.data?.counts?.admin_unread}`,
    );

    r = await fetch(`${base}/api/suggestions/${suggestionId}/admin`, {
      headers: authHeaders(adminToken),
    });
    const adminThreadBody = await r.json().catch(() => ({}));
    check(
      "ادمین: مشاهدهٔ گفتگو + علامت خوانده‌شدن → ۲۰۰",
      r.status === 200 &&
        adminThreadBody?.data?.suggestion?.admin_unread === false,
      `status=${r.status} admin_unread=${adminThreadBody?.data?.suggestion?.admin_unread}`,
    );

    r = await fetch(`${base}/api/suggestions/${suggestionId}/admin-reply`, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify({ body: "پاسخ تست خودکار به کاربر." }),
    });
    check(
      "ادمین: ارسال پاسخ → ۲۰۱",
      r.status === 201,
      `status=${r.status}`,
    );

    r = await fetch(`${base}/api/suggestions/unread-count`, {
      headers: authHeaders(lowToken),
    });
    const unreadBody = await r.json().catch(() => ({}));
    check(
      "بج پاکت کاربر با پاسخ ادمین بالا می‌رود (user_unread)",
      r.status === 200 && Number(unreadBody?.data?.count || 0) >= 1,
      `count=${unreadBody?.data?.count}`,
    );

    r = await fetch(`${base}/api/suggestions/${suggestionId}/read`, {
      method: "POST",
      headers: authHeaders(lowToken),
      body: JSON.stringify({}),
    });
    check("کاربر: علامت خوانده‌شدن → ۲۰۰", r.status === 200, `status=${r.status}`);

    r = await fetch(`${base}/api/suggestions/unread-count`, {
      headers: authHeaders(lowToken),
    });
    const unreadAfter = await r.json().catch(() => ({}));
    check(
      "پس از خواندن، بج کاربر صفر می‌شود",
      Number(unreadAfter?.data?.count || 0) === 0,
      `count=${unreadAfter?.data?.count}`,
    );

    // ===== ✅ حذف پیام‌های گفتگو (قابلیت جدید پنل ادمین) =====
    r = await fetch(`${base}/api/suggestions/${suggestionId}/admin`, {
      headers: authHeaders(adminToken),
    });
    const threadNow = (await r.json().catch(() => ({})))?.data?.messages || [];
    const firstUserMsgId = threadNow.find((m) => m.sender_type === "user")?.id;
    const adminMsgId = [...threadNow]
      .reverse()
      .find((m) => m.sender_type === "admin")?.id;

    r = await fetch(
      `${base}/api/suggestions/${suggestionId}/messages/${adminMsgId}`,
      { method: "DELETE", headers: authHeaders(lowToken) },
    );
    check(
      "کاربر کم‌دسترسی: حذف پیام گفتگو ممنوع (۴۰۳)",
      r.status === 403,
      `status=${r.status}`,
    );

    r = await fetch(
      `${base}/api/suggestions/${suggestionId}/messages/${firstUserMsgId}`,
      { method: "DELETE", headers: authHeaders(adminToken) },
    );
    check(
      "ادمین: حذف پیام اول گفتگو ممنوع (۴۰۰)",
      r.status === 400,
      `status=${r.status}`,
    );

    r = await fetch(
      `${base}/api/suggestions/${suggestionId}/messages/${adminMsgId}`,
      { method: "DELETE", headers: authHeaders(adminToken) },
    );
    const delMsgBody = await r.json().catch(() => ({}));
    check(
      "ادمین: حذف یک پیام گفتگو → ۲۰۰ و کاهش messages_count",
      r.status === 200 &&
        delMsgBody?.data?.thread_deleted === false &&
        Number(delMsgBody?.data?.suggestion?.messages_count || 0) === 1,
      `status=${r.status} count=${delMsgBody?.data?.suggestion?.messages_count}`,
    );

    r = await fetch(`${base}/api/suggestions/${suggestionId}/messages/999999`, {
      method: "DELETE",
      headers: authHeaders(adminToken),
    });
    check(
      "ادمین: حذف پیام ناموجود در گفتگو → ۴۰۴",
      r.status === 404,
      `status=${r.status}`,
    );

    // ===== ✅ ضد تکرار: همان پیام دوباره ثبت نشود (باگ ارسال دوبار) =====
    r = await fetch(`${base}/api/suggestions`, {
      method: "POST",
      headers: authHeaders(lowToken),
      body: JSON.stringify({
        subject: "suggestion",
        title: "تست خودکار — پیشنهاد",
        body: "این پیام توسط تست خودکار ساخته شده است.",
      }),
    });
    const duplicateBody = await r.json().catch(() => ({}));
    check(
      "ثبت دوبارهٔ همان پیام → رکورد تکراری ساخته نمی‌شود",
      r.status === 200 &&
        duplicateBody?.data?.duplicate === true &&
        Number(duplicateBody?.data?.id) === Number(suggestionId),
      `status=${r.status} id=${duplicateBody?.data?.id} dup=${duplicateBody?.data?.duplicate}`,
    );

    r = await fetch(`${base}/api/suggestions/${suggestionId}`, {
      method: "DELETE",
      headers: authHeaders(adminToken),
    });
    check(
      "ادمین: حذف گفتگوی تستی → ۲۰۰ (پاک‌سازی)",
      r.status === 200,
      `status=${r.status}`,
    );
  }

  // ===== ✅ تنظیمات نمایشی: لودر سیستمی (کلاسیک / لوگوی ستاره کیان) =====
  r = await fetch(`${base}/api/public/ui-settings`);
  const publicBefore = await r.json().catch(() => ({}));
  check(
    "تنظیمات نمایشی (لودر) بدون ورود در دسترس است",
    r.status === 200 &&
      ["classic", "logo"].includes(publicBefore?.data?.loader_style),
    `status=${r.status} loader=${publicBefore?.data?.loader_style}`,
  );

  r = await fetch(`${base}/api/settings/loader_style`, {
    method: "PUT",
    headers: authHeaders(lowToken),
    body: JSON.stringify({ value: "logo" }),
  });
  check(
    "کاربر کم‌دسترسی: تغییر لودر سیستمی ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );

  r = await fetch(`${base}/api/settings/loader_style`, {
    method: "PUT",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ value: "logo" }),
  });
  const logoBody = await r.json().catch(() => ({}));
  check(
    "ادمین: فعال‌سازی لودر لوگوی ستاره کیان → ۲۰۰",
    r.status === 200 && logoBody?.data?.value === "logo",
    `status=${r.status} value=${logoBody?.data?.value}`,
  );

  r = await fetch(`${base}/api/public/ui-settings`);
  const publicAfter = await r.json().catch(() => ({}));
  check(
    "تنظیم جدید لودر در اندپوینت عمومی منعکس می‌شود",
    publicAfter?.data?.loader_style === "logo",
    `loader=${publicAfter?.data?.loader_style}`,
  );

  r = await fetch(`${base}/api/settings/loader_style`, {
    method: "PUT",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ value: "مقدار-نامعتبر" }),
  });
  const invalidLoaderBody = await r.json().catch(() => ({}));
  check(
    "مقدار نامعتبر لودر → بازگشت به پیش‌فرض (classic)",
    r.status === 200 && invalidLoaderBody?.data?.value === "classic",
    `status=${r.status} value=${invalidLoaderBody?.data?.value}`,
  );

  // ============================================
  // ✅ «تغییرات جدید / What's New»
  // ============================================
  const superAdmin = await User.findOne({ where: { role: "super_admin" } });
  const otherAdmin = await User.findOne({
    where: { role: ["admin", "sub_admin"] },
  });

  if (!superAdmin) {
    info("⚠️  سوپر ادمین در دیتابیس پیدا نشد → تست «تغییرات جدید» رد شد");
  } else {
    const saToken = tokenFor(superAdmin);
    const testVersion = `9.${(Date.now() % 900) + 100}.0`;
    let releaseId = null;

    // ۱) ساخت نسخه (پیش‌نویس) — فقط سوپر ادمین
    r = await fetch(`${base}/api/releases`, {
      method: "POST",
      headers: authHeaders(saToken),
      body: JSON.stringify({
        version: testVersion,
        title: "تست خودکار تغییرات",
        description: "این نسخه توسط تست خودکار ساخته شده است",
        audience: "all",
        items: [
          { category: "new", title: "آیتم تست ۱", description: "توضیح تست", tag: "جدید" },
          { category: "fixed", title: "آیتم تست ۲", description: "توضیح تست", tag: "رفع باگ" },
        ],
      }),
    });
    const createBody = await r.json().catch(() => ({}));
    releaseId = createBody?.data?.release?.id || null;
    check(
      "سوپر ادمین: ساخت نسخهٔ تغییرات (پیش‌نویس) → ۲۰۱",
      r.status === 201 && !!releaseId && createBody?.data?.release?.status === "draft",
      `status=${r.status} id=${releaseId}`,
    );

    // ۲) نسخهٔ تکراری → ۴۰۹
    r = await fetch(`${base}/api/releases`, {
      method: "POST",
      headers: authHeaders(saToken),
      body: JSON.stringify({
        version: testVersion,
        items: [{ category: "new", title: "تکراری" }],
      }),
    });
    check("سوپر ادمین: شمارهٔ نسخهٔ تکراری → ۴۰۹", r.status === 409, `status=${r.status}`);

    // ۳) نسخهٔ بدون آیتم → ۴۰۰
    r = await fetch(`${base}/api/releases`, {
      method: "POST",
      headers: authHeaders(saToken),
      body: JSON.stringify({ version: "8.8.8", items: [] }),
    });
    check("سوپر ادمین: نسخهٔ بدون آیتم → ۴۰۰", r.status === 400, `status=${r.status}`);

    // ۴) شمارهٔ نسخهٔ نامعتبر → ۴۰۰
    r = await fetch(`${base}/api/releases`, {
      method: "POST",
      headers: authHeaders(saToken),
      body: JSON.stringify({
        version: "abc",
        items: [{ category: "new", title: "x" }],
      }),
    });
    check("سوپر ادمین: شمارهٔ نسخهٔ نامعتبر → ۴۰۰", r.status === 400, `status=${r.status}`);

    // ۵) پیش‌نویس برای کاربر دیده نمی‌شود
    r = await fetch(`${base}/api/releases/unseen`, { headers: authHeaders(lowToken) });
    const draftUnseen = await r.json().catch(() => ({}));
    check(
      "کاربر: نسخهٔ پیش‌نویس در /unseen دیده نمی‌شود",
      r.status === 200 && draftUnseen?.data?.release?.version !== testVersion,
      `version=${draftUnseen?.data?.release?.version}`,
    );

    // ۶) کاربر عادی: فهرست مدیریتی و ساخت ممنوع
    r = await fetch(`${base}/api/releases`, { headers: authHeaders(lowToken) });
    check(
      "کاربر عادی: فهرست مدیریتی نسخه‌ها ممنوع (۴۰۳)",
      r.status === 403,
      `status=${r.status}`,
    );

    r = await fetch(`${base}/api/releases`, {
      method: "POST",
      headers: authHeaders(lowToken),
      body: JSON.stringify({
        version: "8.8.7",
        items: [{ category: "new", title: "x" }],
      }),
    });
    check(
      "کاربر عادی: ساخت نسخهٔ تغییرات ممنوع (۴۰۳)",
      r.status === 403,
      `status=${r.status}`,
    );

    if (releaseId) {
      // ۷) انتشار نسخه
      r = await fetch(`${base}/api/releases/${releaseId}/publish`, {
        method: "POST",
        headers: authHeaders(saToken),
        body: JSON.stringify({}),
      });
      const pubBody = await r.json().catch(() => ({}));
      check(
        "سوپر ادمین: انتشار نسخه → ۲۰۰",
        r.status === 200 &&
          pubBody?.data?.release?.status === "published" &&
          pubBody?.data?.scheduled === false,
        `status=${r.status}`,
      );

      // ۸) کاربر: نسخه در /unseen می‌آید (با آیتم‌ها)
      r = await fetch(`${base}/api/releases/unseen`, { headers: authHeaders(lowToken) });
      const unseenBody = await r.json().catch(() => ({}));
      check(
        "کاربر: پس از انتشار، نسخه در /unseen می‌آید",
        r.status === 200 &&
          unseenBody?.data?.release?.version === testVersion &&
          (unseenBody?.data?.release?.items || []).length === 2,
        `version=${unseenBody?.data?.release?.version} items=${(unseenBody?.data?.release?.items || []).length}`,
      );

      // ۹) ثبت بازدید
      r = await fetch(`${base}/api/releases/${releaseId}/seen`, {
        method: "POST",
        headers: authHeaders(lowToken),
        body: JSON.stringify({}),
      });
      check("کاربر: ثبت بازدید نسخه → ۲۰۰", r.status === 200, `status=${r.status}`);

      // ۱۰) پس از دیدن، دیگر خودکار نمایش داده نمی‌شود
      r = await fetch(`${base}/api/releases/unseen`, { headers: authHeaders(lowToken) });
      const afterSeenBody = await r.json().catch(() => ({}));
      check(
        "کاربر: پس از دیدن، نسخه دیگر خودکار نمایش داده نمی‌شود",
        afterSeenBody?.data?.release?.version !== testVersion,
        `version=${afterSeenBody?.data?.release?.version}`,
      );

      // ۱۱) تاریخچه: seen = true
      r = await fetch(`${base}/api/releases/history`, { headers: authHeaders(lowToken) });
      const historyBody = await r.json().catch(() => ({}));
      const histItem = (historyBody?.data?.items || []).find(
        (item) => item.version === testVersion,
      );
      check(
        "کاربر: نسخهٔ دیده‌شده در تاریخچه با seen=true",
        r.status === 200 && histItem?.seen === true,
        `status=${r.status} seen=${histItem?.seen}`,
      );

      // ۱۲) «دیگر نشان نده»
      r = await fetch(`${base}/api/releases/${releaseId}/seen`, {
        method: "POST",
        headers: authHeaders(lowToken),
        body: JSON.stringify({ dont_show_again: true }),
      });
      const dismissBody = await r.json().catch(() => ({}));
      check(
        "کاربر: ثبت «دیگر نشان نده» → dont_show_again=true",
        r.status === 200 && dismissBody?.data?.dont_show_again === true,
        `dont_show_again=${dismissBody?.data?.dont_show_again}`,
      );

      // ۱۳) انتشار مجدد (resend) → رسیدهای دیدن پاک می‌شوند
      r = await fetch(`${base}/api/releases/${releaseId}/publish`, {
        method: "POST",
        headers: authHeaders(saToken),
        body: JSON.stringify({ resend: true }),
      });
      const resendBody = await r.json().catch(() => ({}));
      check(
        "سوپر ادمین: «انتشار مجدد» رسیدهای دیدن را پاک می‌کند",
        r.status === 200 && Number(resendBody?.data?.views_reset || 0) >= 1,
        `views_reset=${resendBody?.data?.views_reset}`,
      );

      // ۱۴) مخاطب admins → برای کاربر نامرئی
      r = await fetch(`${base}/api/releases/${releaseId}`, {
        method: "PATCH",
        headers: authHeaders(saToken),
        body: JSON.stringify({ audience: "admins" }),
      });
      check("سوپر ادمین: تغییر مخاطب به «ادمین‌ها» → ۲۰۰", r.status === 200, `status=${r.status}`);

      r = await fetch(`${base}/api/releases/unseen`, { headers: authHeaders(lowToken) });
      const audienceBody = await r.json().catch(() => ({}));
      check(
        "مخاطب admins: نسخه برای مشتری/کارشناس نامرئی است",
        audienceBody?.data?.release?.version !== testVersion,
        `version=${audienceBody?.data?.release?.version}`,
      );

      // ۱۵) آمار نسخه با ادمین ساده
      r = await fetch(`${base}/api/releases/${releaseId}/stats`, {
        headers: authHeaders(adminToken),
      });
      check("ادمین: مشاهدهٔ آمار یک نسخه → ۲۰۰", r.status === 200, `status=${r.status}`);

      // ۱۶) ادمین غیر سوپر: نوشتن ممنوع / خواندن مجاز
      if (otherAdmin) {
        const oaToken = tokenFor(otherAdmin);

        r = await fetch(`${base}/api/releases/${releaseId}`, {
          method: "PATCH",
          headers: authHeaders(oaToken),
          body: JSON.stringify({ title: "دستکاری" }),
        });
        check(
          "ادمین غیر سوپر: ویرایش نسخه ممنوع (۴۰۳)",
          r.status === 403,
          `status=${r.status}`,
        );

        r = await fetch(`${base}/api/releases/${releaseId}/publish`, {
          method: "POST",
          headers: authHeaders(oaToken),
          body: JSON.stringify({}),
        });
        check(
          "ادمین غیر سوپر: انتشار نسخه ممنوع (۴۰۳)",
          r.status === 403,
          `status=${r.status}`,
        );

        r = await fetch(`${base}/api/releases/${releaseId}`, {
          method: "DELETE",
          headers: authHeaders(oaToken),
        });
        check(
          "ادمین غیر سوپر: حذف نسخه ممنوع (۴۰۳)",
          r.status === 403,
          `status=${r.status}`,
        );

        r = await fetch(`${base}/api/releases`, { headers: authHeaders(oaToken) });
        check(
          "ادمین غیر سوپر: فهرست نسخه‌ها (فقط خواندن) → ۲۰۰",
          r.status === 200,
          `status=${r.status}`,
        );
      } else {
        info("ℹ️  ادمین غیر سوپر (admin/sub_admin) در دیتابیس نبود → برخی بررسی‌ها رد شد");
      }

      // ۱۷) پاکسازی: حذف نسخه + بررسی حذف آبشاری
      r = await fetch(`${base}/api/releases/${releaseId}`, {
        method: "DELETE",
        headers: authHeaders(saToken),
      });
      check("سوپر ادمین: حذف نسخه → ۲۰۰", r.status === 200, `status=${r.status}`);

      const leftItems = await ReleaseNoteItem.count({
        where: { release_note_id: releaseId },
      });
      const leftViews = await ReleaseNoteView.count({
        where: { release_note_id: releaseId },
      });
      check(
        "حذف نسخه: آیتم‌ها و رسیدهای دیدن هم پاک شدند",
        leftItems === 0 && leftViews === 0,
        `items=${leftItems} views=${leftViews}`,
      );
    }
  }

  // ============================================
  // ✅ شمارهٔ مشتری: ترتیبی بودن + نسوختن شماره در ثبت ناموفق
  // (بود: کد از nextval سکانس می‌آمد و هر ثبت ناموفق/حذف، یک شماره را
  //  برای همیشه می‌سوزاند ⇒ شماره‌ها غیرترتیبی می‌شدند)
  // ============================================
  const codeStamp = String(Date.now()).slice(-7);
  const createdCustomerIds = [];
  const testMobile = (index) =>
    `09${codeStamp}${String(index).padStart(2, "0")}`;
  const customerPayload = (index) => ({
    full_name: `مشتری تست شماره ${index}`,
    collection_name: `مجموعه تست ${index}`,
    farm_name: `فارم تست ${index}`,
    email: `e2e-customer-${index}-${codeStamp}@e2e.local`,
    mobile_number: testMobile(index),
    province: "خراسان جنوبی",
    county: "بیرجند",
    farm_address: "آدرس تست برای بررسی شمارهٔ مشتری",
    postal_code: String(9876543210 + index),
    experience_years: 3,
    education_level: "کارشناسی",
    sales_department: "فروش",
    gender: "مرد",
  });
  const registerTestCustomer = (index) =>
    fetch(`${base}/api/customers/register`, {
      method: "POST",
      headers: authHeaders(adminToken),
      body: JSON.stringify(customerPayload(index)),
    });

  const maxCodeBefore = Number(
    (await CustomerPersonalInfo.max("customer_code")) || 0,
  );

  // ۱) مشتری اول → بزرگ‌ترین شماره + ۱
  let codeRes = await registerTestCustomer(1);
  const custABody = await codeRes.json().catch(() => ({}));
  const custA = custABody?.data || {};
  if (custA.id) createdCustomerIds.push(custA.id);
  check(
    "شمارهٔ مشتری: مشتری جدید «بزرگ‌ترین شماره + ۱» می‌گیرد",
    codeRes.status === 201 &&
      Number(custA.customer_code) === maxCodeBefore + 1,
    `status=${codeRes.status} code=${custA.customer_code} (قبل: ${maxCodeBefore})`,
  );

  // ۲) مشتری دوم → شمارهٔ بعدی (پشت‌سرهم)
  codeRes = await registerTestCustomer(2);
  const custBBody = await codeRes.json().catch(() => ({}));
  const custB = custBBody?.data || {};
  if (custB.id) createdCustomerIds.push(custB.id);
  check(
    "شمارهٔ مشتری: شمارهٔ بعدی پشت‌سرهم است (بدون پرش)",
    codeRes.status === 201 &&
      Number(custB.customer_code) === Number(custA.customer_code) + 1,
    `first=${custA.customer_code} second=${custB.customer_code}`,
  );

  // ۳) ثبت ناموفق (موبایل تکراری) نباید شماره بسوزاند
  const duplicateRes = await registerTestCustomer(1);
  check(
    "شمارهٔ مشتری: ثبت با موبایل تکراری رد می‌شود (۴۰۰)",
    duplicateRes.status === 400,
    `status=${duplicateRes.status}`,
  );

  codeRes = await registerTestCustomer(3);
  const custCBody = await codeRes.json().catch(() => ({}));
  const custC = custCBody?.data || {};
  if (custC.id) createdCustomerIds.push(custC.id);
  check(
    "شمارهٔ مشتری: ثبت ناموفق هیچ شماره‌ای را نمی‌سوزاند",
    codeRes.status === 201 &&
      Number(custC.customer_code) === Number(custB.customer_code) + 1,
    `second=${custB.customer_code} third=${custC.customer_code}`,
  );

  // ۴) جستجو با «شمارهٔ مشتری» (ستون ۰)
  r = await fetch(
    `${base}/api/customers?limit=50&search=${custA.customer_code}&searchColumn=0`,
    { headers: authHeaders(adminToken) },
  );
  const byCodeBody = await r.json().catch(() => ({}));
  const byCodeRows = byCodeBody?.data?.customers || [];
  check(
    "جستجو با «شمارهٔ مشتری» همان مشتری را برمی‌گرداند",
    r.status === 200 &&
      byCodeRows.length >= 1 &&
      byCodeRows.every((row) =>
        String(row.customer_code ?? "").includes(String(custA.customer_code)),
      ),
    `status=${r.status} rows=${byCodeRows.length}`,
  );

  r = await fetch(
    `${base}/api/customers?limit=50&search=${custB.customer_code}&searchColumn=all`,
    { headers: authHeaders(adminToken) },
  );
  const allByCodeBody = await r.json().catch(() => ({}));
  check(
    "حالت «همه ستون‌ها» هم با شمارهٔ مشتری پیدا می‌کند",
    r.status === 200 &&
      Number(allByCodeBody?.data?.pagination?.total || 0) >= 1,
    `total=${allByCodeBody?.data?.pagination?.total}`,
  );

  // ۵) فهرست، شمارهٔ مشتری را برمی‌گرداند (ستون اول جدول)
  r = await fetch(`${base}/api/customers?limit=5`, {
    headers: authHeaders(adminToken),
  });
  const listedBody = await r.json().catch(() => ({}));
  const listedRows = listedBody?.data?.customers || [];
  check(
    "فهرست مشتریان شامل «شمارهٔ مشتری» است (ستون اول جدول)",
    r.status === 200 &&
      listedRows.length > 0 &&
      listedRows.every((row) => Number.isFinite(Number(row.customer_code))),
    `rows=${listedRows.length}`,
  );

  // ۶) پاکسازی مشتریان تستی
  if (createdCustomerIds.length) {
    await CustomerPersonalInfo.destroy({
      where: { id: createdCustomerIds },
    });
    const left = await CustomerPersonalInfo.count({
      where: { id: createdCustomerIds },
    });
    check(
      "پاکسازی: مشتریان تستی حذف شدند",
      left === 0,
      `deleted=${createdCustomerIds.length}`,
    );
  }

  // ============================================
  // ✅ جستجوی زندهٔ لیست مشتریان
  // (بود: پارامترهای search/searchColumn در بک‌اند نادیده گرفته می‌شدند
  //  و جدول هرگز فیلتر نمی‌شد)
  // ============================================
  r = await fetch(`${base}/api/customers?limit=5`, {
    headers: authHeaders(adminToken),
  });
  const allCustomersBody = await r.json().catch(() => ({}));
  const baselineTotal = Number(allCustomersBody?.data?.pagination?.total || 0);
  const sampleCustomer = (allCustomersBody?.data?.customers || [])[0] || null;

  check(
    "ادمین: فهرست مشتریان (بدون فیلتر) → ۲۰۰",
    r.status === 200 && Array.isArray(allCustomersBody?.data?.customers),
    `status=${r.status} total=${baselineTotal}`,
  );

  if (sampleCustomer && baselineTotal > 0) {
    const needle = String(
      sampleCustomer.full_name || sampleCustomer.collection_name || "",
    )
      .trim()
      .slice(0, 4);

    // ۱) جستجوی عمومی در همهٔ ستون‌ها
    r = await fetch(
      `${base}/api/customers?limit=50&search=${encodeURIComponent(needle)}&searchColumn=all`,
      { headers: authHeaders(adminToken) },
    );
    const searchAllBody = await r.json().catch(() => ({}));
    const searchAllTotal = Number(
      searchAllBody?.data?.pagination?.total || 0,
    );
    const searchAllRows = searchAllBody?.data?.customers || [];
    check(
      "جستجوی زنده: فیلتر اعمال می‌شود (فقط ردیف‌های منطبق)",
      r.status === 200 &&
        searchAllTotal > 0 &&
        searchAllTotal <= baselineTotal,
      `status=${r.status} needle=${needle} total=${searchAllTotal} (بی‌فیلتر=${baselineTotal})`,
    );
    check(
      "جستجوی زنده: ردیف‌های برگشتی شامل عبارت هستند",
      searchAllRows.length > 0 &&
        searchAllRows.every((row) =>
          [
            row.id,
            row.collection_name,
            row.full_name,
            row.farm_name,
            row.mobile_number,
            row.messaging_number,
            row.education_level,
            row.gender,
            row.province,
            row.county,
          ]
            .filter((value) => value !== null && value !== undefined)
            .some((value) => String(value).includes(needle)),
        ),
      `rows=${searchAllRows.length}`,
    );

    // ۲) جستجو در یک ستون مشخص (نام مشتری = ۲)
    r = await fetch(
      `${base}/api/customers?limit=50&search=${encodeURIComponent(needle)}&searchColumn=2`,
      { headers: authHeaders(adminToken) },
    );
    const columnBody = await r.json().catch(() => ({}));
    const columnRows = columnBody?.data?.customers || [];
    check(
      "جستجو در ستون مشخص (نام مشتری): فقط همان ستون فیلتر می‌شود",
      r.status === 200 &&
        columnRows.length > 0 &&
        columnRows.every((row) =>
          String(row.full_name || "").includes(needle),
        ),
      `status=${r.status} rows=${columnRows.length}`,
    );

    // ۳) همان عبارت در ستون تحصیلات (۶) → باید نتیجهٔ متفاوت/خالی بدهد
    r = await fetch(
      `${base}/api/customers?limit=50&search=${encodeURIComponent(needle)}&searchColumn=6`,
      { headers: authHeaders(adminToken) },
    );
    const otherColumnBody = await r.json().catch(() => ({}));
    check(
      "جستجو در ستون نامرتبط، نتیجهٔ ستون نام را برنمی‌گرداند",
      r.status === 200 &&
        Number(otherColumnBody?.data?.pagination?.total || 0) <
          Math.max(searchAllTotal, 1),
      `total=${otherColumnBody?.data?.pagination?.total}`,
    );

    // ۴) ارقام فارسی → لاتین (جستجوی شمارهٔ تماس)
    const phone = String(sampleCustomer.mobile_number || "").replace(/\D/g, "");
    if (phone.length >= 4) {
      const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
      const tail = phone.slice(-4);
      const persianTail = tail
        .split("")
        .map((digit) => persianDigits[Number(digit)])
        .join("");

      r = await fetch(
        `${base}/api/customers?limit=50&search=${encodeURIComponent(persianTail)}&searchColumn=4`,
        { headers: authHeaders(adminToken) },
      );
      const phoneBody = await r.json().catch(() => ({}));
      check(
        "جستجوی زنده: ارقام فارسی هم پیدا می‌کند (نرمال‌سازی)",
        r.status === 200 && Number(phoneBody?.data?.pagination?.total || 0) >= 1,
        `search=${persianTail} total=${phoneBody?.data?.pagination?.total}`,
      );
    } else {
      info("ℹ️  مشتری نمونه شمارهٔ تماس ندارد → بررسی ارقام فارسی رد شد");
    }

    // ۵) کاراکتر wildcard نباید همه‌چیز را برگرداند
    r = await fetch(
      `${base}/api/customers?limit=50&search=${encodeURIComponent("%")}&searchColumn=all`,
      { headers: authHeaders(adminToken) },
    );
    const wildcardBody = await r.json().catch(() => ({}));
    check(
      "جستجوی زنده: ورودی % به wildcard تبدیل نمی‌شود",
      r.status === 200 &&
        Number(wildcardBody?.data?.pagination?.total || 0) < baselineTotal,
      `total=${wildcardBody?.data?.pagination?.total}`,
    );

    // ۶) جستجوی خالی = بدون فیلتر
    r = await fetch(`${base}/api/customers?limit=5&search=`, {
      headers: authHeaders(adminToken),
    });
    const emptyBody = await r.json().catch(() => ({}));
    check(
      "جستجوی خالی: همان تعداد بدون فیلتر برمی‌گردد",
      r.status === 200 &&
        Number(emptyBody?.data?.pagination?.total || 0) === baselineTotal,
      `total=${emptyBody?.data?.pagination?.total}`,
    );
  } else {
    info("ℹ️  مشتری‌ای در دیتابیس نبود → بررسی‌های جستجو رد شد");
  }

  r = await fetch(`${base}/api/server-status`, {
    headers: authHeaders(adminToken),
  });
  const statusBody = await r.json().catch(() => ({}));
  check(
    "GET /api/server-status → ساختار دیتابیس سالم گزارش می‌شود",
    r.status === 200 &&
      statusBody?.data?.schema?.ok === true &&
      Array.isArray(statusBody?.data?.schema?.missingTables) &&
      statusBody.data.schema.missingTables.length === 0,
    `status=${r.status} ok=${statusBody?.data?.schema?.ok} missing=${JSON.stringify(
      statusBody?.data?.schema?.missingTables,
    )}`,
  );

  r = await fetch(`${base}/api/users/${admin.id}/online-status`, {
    method: "PUT",
    headers: authHeaders(lowToken),
    body: JSON.stringify({ status: false }),
  });
  check(
    "کاربر کم‌دسترسی: تغییر وضعیت آنلاین دیگران ممنوع (۴۰۳)",
    r.status === 403,
    `status=${r.status}`,
  );
};

run()
  .catch((e) => {
    console.error("❌ Test error:", e.message);
    results.push(false);
  })
  .finally(async () => {
    if (child) {
      try {
        child.kill();
      } catch {}
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    }
    try {
      await sequelize.close();
    } catch {}
    const failed = results.filter((x) => !x).length;
    console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
    process.exit(failed === 0 ? 0 : 1);
  });
