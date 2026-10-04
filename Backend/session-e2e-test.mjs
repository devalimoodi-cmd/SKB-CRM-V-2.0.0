// ============================================================
//  تست انتها-به-انتها «نشست‌های کاربران» (Sessions) — دیتابیسی و دستی
// ------------------------------------------------------------
//  ⭐ معیار اثباتِ کار (proof of work):
//     بعد از POST /api/sessions/:id/revoke، توکنِ همان دستگاه ۴۰۱ می‌گیرد
//     در حالی که توکن دستگاه دیگر همچنان ۲۰۰ می‌گیرد.
//
//  چه چیزی اثبات می‌شود؟
//    ۱) ورود واقعی یک ردیف user_sessions با sid می‌سازد و sid داخل JWT می‌رود
//    ۲) دو ورود = دو نشست مستقل (چند-دستگاهی، بدون ENFORCE_SINGLE_SESSION)
//    ۳) /sessions/mine فقط نشست‌های خودم را می‌دهد و «همین دستگاه» را علامت می‌زند
//    ۴) ⭐ بستن یک نشست ⇒ ۴۰۱ شدن همان دستگاه، بی‌اثر روی دستگاه دیگر
//    ۵) بستن همهٔ نشست‌های یک کاربر (revoke-all)
//    ۶) خروج (logout) نشست همین دستگاه را می‌بندد
//    ۷) نگهبان‌های دسترسی: بدون توکن ۴۰۱ · نقش کم‌دسترسی ۴۰۳ · هر کاربر /mine خودش
//
//  اجرا:
//    $env:ALLOW_DB_TESTS='true'; npm run test:sessions:e2e
//  ⚠️ کاربران آزمایشی و نشست‌هایشان در پایان پاک می‌شوند.
// ============================================================
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

const PORT = 5096;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = "SessTest1234";

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
  console.log("   برای اجرا:  $env:ALLOW_DB_TESTS='true'; npm run test:sessions:e2e");
  process.exit(0);
}

const { sequelize } = require("./config/database.js");
const User = require("./models/User.js");
const UserSession = require("./models/UserSession.js");

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
      NODE_ENV: "development", // تا متن خطاها برای تست خوانا باشد
      RATE_LIMIT_DISABLED: "true",
      CAPTCHA_ENABLED: "false",
      ENFORCE_SINGLE_SESSION: "false", // چند-دستگاهی = سناریوی اصلی این فاز
      PERMISSIONS_ENFORCE: "false",
      // throttle کوتاه تا «بررسی دیتابیس» هر درخواست انجام شود
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

// توکنِ ساختگی (برای نقش کم‌دسترسی: فقط دروازهٔ نقش آزمایش می‌شود، نه نشست)
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

const decodeSid = (token) => {
  try {
    return jwt.decode(token)?.sid || null;
  } catch {
    return null;
  }
};

// ساخت آزمودنی‌ها (کاربر موقت) — در پایان پاک می‌شوند
let seq = 0;
const uniqueSuffix = () => `${Date.now().toString().slice(-6)}${seq++}`;

const createTempUser = async (role) => {
  const suffix = uniqueSuffix();
  return User.create({
    first_name: "آزمون",
    last_name: "نشست",
    username: `sess-test-${suffix}`,
    email: `sess-test-${suffix}@example.invalid`,
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

  try {
    adminUser = await createTempUser("admin");
    expertUser = await createTempUser("expert");

    startBackend();
    await waitFor(`${BASE}/api/ping`);

    // ===== ۱) ورود دستگاه A =====
    const loginA = await postJson("/api/users/login", null, {
      username: adminUser.username,
      password: PASSWORD,
    });
    const bodyA = await jsonOf(loginA);
    const tokenA = bodyA?.data?.token || "";
    const sidA = decodeSid(tokenA);

    check(
      "ورود دستگاه A: پاسخ ۲۰۰ و توکن شامل sid نشست است",
      loginA.status === 200 && Boolean(sidA),
      `status=${loginA.status} sid=${sidA ? `${sidA.slice(0, 8)}…` : "none"}`,
    );

    const rowA = sidA
      ? await UserSession.findOne({ where: { sid: sidA } })
      : null;
    check(
      "دیتابیس: ردیف نشست ساخته شد (کاربر · عکس username/role · user_agent · باز)",
      Boolean(rowA) &&
        Number(rowA.user_id) === Number(adminUser.id) &&
        rowA.username === adminUser.username &&
        rowA.role === "admin" &&
        rowA.ended_at === null &&
        Boolean(rowA.user_agent) &&
        Boolean(rowA.started_at) &&
        Boolean(rowA.last_activity_at),
      `ip=${rowA?.ip || "null"}`,
    );

    // ===== ۲) ورود دستگاه B (نشست مستقل) =====
    const loginB = await postJson("/api/users/login", null, {
      username: adminUser.username,
      password: PASSWORD,
    });
    const tokenB = (await jsonOf(loginB))?.data?.token || "";
    const sidB = decodeSid(tokenB);

    const activeCount = await UserSession.count({
      where: { user_id: adminUser.id, ended_at: null },
    });
    check(
      "⭐ دو ورود = دو نشست فعالِ مستقل (بدون ENFORCE_SINGLE_SESSION)",
      Boolean(sidA) && Boolean(sidB) && sidA !== sidB && activeCount === 2,
      `active=${activeCount}`,
    );

    // ===== ۳) نشست‌های خودم =====
    const mineA = await get("/api/sessions/mine", tokenA);
    const mineBodyA = await jsonOf(mineA);
    const sessionsA = mineBodyA?.data?.sessions || [];
    const currentCount = sessionsA.filter((session) => session.current).length;

    check(
      "نشست‌های من: دو نشست + فقط یکی «همین دستگاه» + بدون لو رفتن sid",
      mineA.status === 200 &&
        mineBodyA?.data?.total === 2 &&
        currentCount === 1 &&
        !JSON.stringify(mineBodyA).includes('"sid"'),
      `total=${mineBodyA?.data?.total} current=${currentCount}`,
    );

    check(
      "نشست‌های من: دستگاهِ شناسایی‌شده و «چند ثانیه پیش» در پاسخ هست",
      sessionsA.length > 0 &&
        sessionsA.every((s) => typeof s.device === "string" && s.device.length > 0) &&
        sessionsA.every((s) => Number.isInteger(s.seconds_since_activity)),
      `device=${sessionsA[0]?.device}`,
    );

    // ===== ۴) مسیرهای مدیریتی =====
    const list = await get("/api/sessions", tokenB);
    const listBody = await jsonOf(list);
    check(
      "فهرست مدیریتی نشست‌ها: ۲۰۰ + صفحه‌بندی + آرایهٔ نشست‌ها",
      list.status === 200 &&
        Number(listBody?.data?.pagination?.total) >= 2 &&
        Array.isArray(listBody?.data?.sessions),
      `total=${listBody?.data?.pagination?.total}`,
    );

    const summary = await get("/api/sessions/summary", tokenB);
    const summaryBody = await jsonOf(summary);
    check(
      "خلاصهٔ نشست‌ها: ۲۰۰ + شمارش نشست‌های فعال",
      summary.status === 200 && Number(summaryBody?.data?.active) >= 2,
      `active=${summaryBody?.data?.active}`,
    );

    // ===== ۵) ⭐ اثبات کار: بستن نشست دستگاه A (با توکنِ دستگاه B) =====
    // «current» همان نشستی است که توکنِ A به آن گره خورده ⇒ مدیر از دستگاه B
    // نشستِ دستگاه A را می‌بندد و فقط همان دستگاه بیرون می‌افتد.
    const sessionAId = sessionsA.find((session) => session.current)?.id ?? null;
    const revoke = await postJson(
      `/api/sessions/${sessionAId}/revoke`,
      tokenB,
      {},
    );
    check(
      "بستن نشست: پاسخ ۲۰۰",
      Boolean(sessionAId) && revoke.status === 200,
      `status=${revoke.status} id=${sessionAId}`,
    );

    await sleep(150);
    const afterA = await get("/api/sessions/mine", tokenA);
    const afterB = await get("/api/sessions/mine", tokenB);
    check(
      "⭐⭐ اثبات کار: توکنِ دستگاه بسته‌شده ۴۰۱ و دستگاه دیگر همچنان ۲۰۰",
      afterA.status === 401 && afterB.status === 200,
      `revoked=${afterA.status} other=${afterB.status}`,
    );

    const rowAAfter = sidA
      ? await UserSession.findOne({ where: { sid: sidA } })
      : null;
    check(
      "دیتابیس: نشست بسته‌شده «پایان + دلیل + بستن‌کننده» را دارد",
      Boolean(rowAAfter?.ended_at) &&
        rowAAfter?.end_reason === "revoked" &&
        Number(rowAAfter?.ended_by) === Number(adminUser.id),
      `reason=${rowAAfter?.end_reason}`,
    );

    // ===== ۶) خروج: نشست همین دستگاه بسته می‌شود =====
    const logout = await postJson("/api/users/logout", tokenB, {});
    await sleep(150);
    const afterLogout = await get("/api/sessions/mine", tokenB);
    check(
      "خروج: نشست همین دستگاه بسته می‌شود (توکن بعد از خروج ۴۰۱)",
      logout.status === 200 && afterLogout.status === 401,
      `logout=${logout.status} after=${afterLogout.status}`,
    );

    // ===== ۷) بستن همهٔ نشست‌های یک کاربر =====
    const loginC = await postJson("/api/users/login", null, {
      username: adminUser.username,
      password: PASSWORD,
    });
    const tokenC = (await jsonOf(loginC))?.data?.token || "";
    // توکن بدون sid ⇒ فقط دروازهٔ نقش/مجوز آزمایش می‌شود
    const adminToken = tokenFor(adminUser);

    const revokeAll = await postJson(
      `/api/sessions/users/${adminUser.id}/revoke-all`,
      adminToken,
      {},
    );
    const revokeAllBody = await jsonOf(revokeAll);
    await sleep(150);
    const afterC = await get("/api/sessions/mine", tokenC);

    check(
      "بستن همهٔ نشست‌های کاربر: ۲۰۰ و توکنِ آن دستگاه ۴۰۱ می‌شود",
      revokeAll.status === 200 &&
        Number(revokeAllBody?.data?.ended) >= 1 &&
        afterC.status === 401,
      `ended=${revokeAllBody?.data?.ended} after=${afterC.status}`,
    );

    // ===== ۸) نگهبان‌های احراز هویت/دسترسی =====
    const noTokenMine = await get("/api/sessions/mine", null);
    const noTokenList = await get("/api/sessions", null);
    check(
      "امنیت: بدون توکن ⇒ ۴۰۱ (نشست‌های من و فهرست مدیریتی)",
      noTokenMine.status === 401 && noTokenList.status === 401,
      `mine=${noTokenMine.status} list=${noTokenList.status}`,
    );

    const expertToken = tokenFor(expertUser);
    const expertMine = await get("/api/sessions/mine", expertToken);
    const expertMineBody = await jsonOf(expertMine);
    check(
      "دسترسی: هر کاربرِ لاگین‌شده /mine خودش را دارد (کاربر بدون نشست ⇒ total=0)",
      expertMine.status === 200 && expertMineBody?.data?.total === 0,
      `status=${expertMine.status} total=${expertMineBody?.data?.total}`,
    );

    const expertList = await get("/api/sessions", expertToken);
    const expertRevoke = await postJson(
      `/api/sessions/${sessionAId}/revoke`,
      expertToken,
      {},
    );
    check(
      "دسترسی: نقش غیرِمدیریتی ⇒ ۴۰۳ برای فهرست و بستن نشست",
      expertList.status === 403 && expertRevoke.status === 403,
      `list=${expertList.status} revoke=${expertRevoke.status}`,
    );
  } finally {
    // پاک‌سازی: نشست‌ها و کاربران آزمایشی (دیتابیس تمیز بماند)
    for (const user of [adminUser, expertUser]) {
      if (!user) continue;
      try {
        await UserSession.destroy({ where: { user_id: user.id } });
        await user.destroy();
      } catch {
        /* بی‌صدا */
      }
    }
  }
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
      } بررسی e2e نشست`,
    );
    process.exitCode = failed === 0 ? 0 : 1;
  });
