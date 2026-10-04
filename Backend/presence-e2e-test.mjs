// ============================================================
//  تست انتها-به-انتها «حضور کاربران» (Presence) — دیتابیسی و دستی
// ------------------------------------------------------------
//  چه چیزی اثبات می‌شود؟
//    ۱) heartbeat واقعاً last_seen_at را در دیتابیس می‌نویسد
//    ۲) /presence/summary کاربر آنلاین را «آنلاین» نشان می‌دهد
//    ۳) /presence/offline وضعیت را آفلاین می‌کند ولی «آخرین فعالیت» را حفظ می‌کند
//    ۴) ⭐ کاربری که activity کهنه دارد (پنجرهٔ آنلاین گذشته) آفلاین دیده می‌شود
//       — یعنی باگ «آنلاین همیشه» دیگر برنمی‌گردد
//    ۵) بدون توکن ۴۰۱ و برای نقش غیرِمدیریتی ۴۰۳ می‌دهد
//
//  اجرا:
//    $env:ALLOW_DB_TESTS='true'; npm run test:presence:e2e
//  ⚠️ تغییراتش موقت است و در پایان بازگردانی می‌شود.
// ============================================================
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

const PORT = 5095;
// پنجرهٔ آنلاین خیلی کوتاه تا تست سریع باشد (دقیقاً همان مسیر تولید)
const WINDOW_SECONDS = 2;
const TOUCH_THROTTLE_SECONDS = 1;
const BASE = `http://127.0.0.1:${PORT}`;

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
  console.log("   برای اجرا:  $env:ALLOW_DB_TESTS='true'; npm run test:presence:e2e");
  process.exit(0);
}

const { sequelize } = require("./config/database.js");
const User = require("./models/User.js");

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
const startBackend = (extraEnv = {}) => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "development", // تا متن خطاها برای تست خوانا باشد
      RATE_LIMIT_DISABLED: "true",
      ENFORCE_SINGLE_SESSION: "false",
      PERMISSIONS_ENFORCE: "false",
      PRESENCE_ONLINE_WINDOW_SECONDS: String(WINDOW_SECONDS),
      PRESENCE_TOUCH_THROTTLE_SECONDS: String(TOUCH_THROTTLE_SECONDS),
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  servers.push(child);
  return child;
};

const waitFor = async (url) => {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch {
      /* هنوز بالا نیامده */
    }
    await sleep(250);
  }
  throw new Error(`سرور آماده نشد: ${url}`);
};

const tokenFor = (user) =>
  jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

const post = (path, token) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: "{}",
  });

const get = (path, token) =>
  fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const findInSummary = (body, userId) =>
  (body?.data?.users || []).find((user) => user.id === userId) || null;

// ============================================================
// اجرای تست
// ============================================================
const run = async () => {
  if (!dbReady) return;

  const admin = await User.findOne({
    where: { role: ["super_admin", "admin", "sub_admin"] },
  });
  const low = await User.findOne({ where: { role: ["expert", "customer"] } });

  if (!admin) {
    info("⚠️  کاربر مدیر پیدا نشد → رد شد");
    return;
  }

  // بازگردانی وضعیت اولیه در پایان (تست نباید ردی از خودش بگذارد)
  const original = {
    token: admin.token,
    online_status: admin.online_status,
    last_seen_at: admin.last_seen_at,
    updated_at: admin.updated_at,
  };
  const lowOriginal = low
    ? { online_status: low.online_status, last_seen_at: low.last_seen_at }
    : null;

  const adminToken = tokenFor(admin);
  // با ENFORCE_SINGLE_SESSION=true هم توکنِ تستی معتبر باشد
  await admin.update({ token: adminToken }, { silent: true });

  startBackend();
  // ⚠️ /health پشت protect است (۴۰۱ بدون توکن)؛ انتظار روی /api/ping عمومی
  await waitFor(`${BASE}/api/ping`);

  // ===== ۱) heartbeat =====
  const beat = await post("/api/presence/heartbeat", adminToken);
  const beatBody = await beat.json().catch(() => ({}));
  check(
    "heartbeat: پاسخ ۲۰۰ + پنجرهٔ آنلاین در پاسخ",
    beat.status === 200 &&
      beatBody?.data?.online === true &&
      beatBody?.data?.window_seconds === WINDOW_SECONDS,
    `status=${beat.status} window=${beatBody?.data?.window_seconds}`,
  );

  await sleep(300);
  const afterBeat = await User.findByPk(admin.id, {
    attributes: ["online_status", "last_seen_at"],
  });
  const beatAge = afterBeat.last_seen_at
    ? (Date.now() - new Date(afterBeat.last_seen_at).getTime()) / 1000
    : null;
  check(
    "heartbeat: last_seen_at در دیتابیس نوشته شد و online_status=true است",
    afterBeat.online_status === true &&
      beatAge !== null &&
      beatAge >= 0 &&
      beatAge < 10,
    `online=${afterBeat.online_status} age=${beatAge?.toFixed(1)}s`,
  );

  // ===== ۲) summary =====
  const summary = await get("/api/presence/summary", adminToken);
  const summaryBody = await summary.json().catch(() => ({}));
  const me = findInSummary(summaryBody, admin.id);
  check(
    "summary: کاربرِ تازه‌فعال «آنلاین» دیده می‌شود",
    summary.status === 200 && me?.online === true,
    `status=${summary.status} online=${me?.online}`,
  );
  check(
    "summary: شمارش آنلاین‌ها و پنجرهٔ آنلاین درست است",
    summaryBody?.data?.window_seconds === WINDOW_SECONDS &&
      Number.isInteger(summaryBody?.data?.online) &&
      summaryBody?.data?.online >= 1,
    `online=${summaryBody?.data?.online} total=${summaryBody?.data?.total}`,
  );

  // ===== ۳) offline =====
  const offline = await post("/api/presence/offline", adminToken);
  check("offline: پاسخ ۲۰۰", offline.status === 200, `status=${offline.status}`);

  const afterOffline = await User.findByPk(admin.id, {
    attributes: ["online_status", "last_seen_at"],
  });
  check(
    "offline: online_status=false شد ولی «آخرین فعالیت» حفظ شد (پاک نشد)",
    afterOffline.online_status === false && afterOffline.last_seen_at !== null,
    `online=${afterOffline.online_status} last_seen=${
      afterOffline.last_seen_at ? "set" : "null"
    }`,
  );

  const summary2 = await get("/api/presence/summary", adminToken);
  const me2 = findInSummary(await summary2.json().catch(() => ({})), admin.id);
  check(
    "summary: کاربرِ آفلاین‌شده «آفلاین» دیده می‌شود",
    me2?.online === false,
    `online=${me2?.online}`,
  );

  // ===== ۴) ⭐ باگ «آنلاین همیشه» =====
  // وضعیت صریح آنلاین، ولی فعالیتِ کهنه‌تر از پنجره ⇒ باید آفلاین باشد
  await admin.update(
    {
      online_status: true,
      last_seen_at: new Date(Date.now() - (WINDOW_SECONDS + 30) * 1000),
    },
    { silent: true },
  );
  const summary3 = await get("/api/presence/summary", adminToken);
  const me3 = findInSummary(await summary3.json().catch(() => ({})), admin.id);
  check(
    "⭐ رفع باگ: فعالیتِ کهنه (خارج از پنجره) ⇒ آفلاین (نه «آنلاین همیشه»)",
    me3?.online === false && me3?.online_status === true,
    `online=${me3?.online} online_status=${me3?.online_status} age=${
      me3?.seconds_since_last_seen
    }s`,
  );

  // ===== ۵) نگهبان احراز هویت/دسترسی =====
  const noTokenBeat = await post("/api/presence/heartbeat", null);
  check(
    "امنیت: heartbeat بدون توکن ⇒ ۴۰۱",
    noTokenBeat.status === 401,
    `status=${noTokenBeat.status}`,
  );

  const noTokenSummary = await get("/api/presence/summary", null);
  check(
    "امنیت: summary بدون توکن ⇒ ۴۰۱",
    noTokenSummary.status === 401,
    `status=${noTokenSummary.status}`,
  );

  if (low) {
    const lowToken = tokenFor(low);
    const lowSummary = await get("/api/presence/summary", lowToken);
    check(
      "دسترسی: نقش کم‌دسترسی (expert/customer) ⇒ summary ۴۰۳",
      lowSummary.status === 403,
      `status=${lowSummary.status} role=${low.role}`,
    );

    const lowBeat = await post("/api/presence/heartbeat", lowToken);
    check(
      "دسترسی: هر کاربر می‌تواند حضور خودش را تازه کند (heartbeat ۲۰۰)",
      lowBeat.status === 200,
      `status=${lowBeat.status}`,
    );

    if (lowOriginal) {
      await low.update(lowOriginal, { silent: true });
    }
  }

  // بازگردانی کاربر مدیر
  await admin.update(original, { silent: true });
};

run()
  .catch((error) => {
    check("اجرای تست بدون خطای غیرمنتظره", false, error.message);
  })
  .finally(async () => {
    servers.forEach((child) => {
      try {
        child.kill();
      } catch {
        /* بی‌صدا */
      }
    });
    try {
      await sequelize.close();
    } catch {
      /* بی‌صدا */
    }

    const failed = results.filter((ok) => !ok).length;
    console.log("");
    console.log(
      `${failed === 0 ? "✅ ALL PASS" : `❌ ${failed} FAILED`} — ${
        results.length
      } بررسی e2e حضور`,
    );
    process.exitCode = failed === 0 ? 0 : 1;
  });
