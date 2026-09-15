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
