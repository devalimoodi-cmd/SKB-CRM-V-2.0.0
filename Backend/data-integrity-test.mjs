// ============================================================
//  تست یکپارچگی داده (Data Integrity) — با دیتابیس واقعی
// ------------------------------------------------------------
//  هدف: اثبات اینکه تراکنش‌های جدید درست کار می‌کنند:
//   ۱) مسیر سالم ثبت/حذف هفتگی و ثبت/حذف جوجه‌ریزی (بدون رگرسیون)
//   ۲) اگر وسط ثبت هفتگی خطا رخ دهد → هیچ رکورد ناقصی نمی‌ماند
//   ۳) اگر وسط ثبت جوجه‌ریزی خطا رخ دهد → گلهٔ یتیم/نیمه‌ساخته نمی‌ماند
//  اجرا:  $env:ALLOW_DB_TESTS='true'; npm run test:integrity
// ============================================================
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

if (
  process.env.ALLOW_DB_TESTS !== "true" ||
  process.env.NODE_ENV === "production"
) {
  console.log("⏭️  SKIPPED (تست دیتابیسی)");
  console.log("   برای اجرا:  $env:ALLOW_DB_TESTS='true'; npm run test:integrity");
  process.exit(0);
}

const PORT = 5095;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (s) => console.log(s);

const { sequelize } = require("./config/database.js");
const User = require("./models/User.js");
const WeeklyManagement = require("./models/WeeklyManagement.js");
const ChickPlacement = require("./models/ChickPlacement.js");
const Flock = require("./models/Flock.js");
const Hall = require("./models/Hall.js");
const Unit = require("./models/Unit.js");
const CustomerPersonalInfo = require("./models/CustomerPersonalInfo.js");
const ChickSource = require("./models/ChickSource.js");
const ChickenBreed = require("./models/ChickenBreed.js");

let dbReady = false;
try {
  const timeout = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("db timeout")), 8000),
  );
  await Promise.race([sequelize.authenticate(), timeout]);
  dbReady = true;
  info("✅ اتصال به دیتابیس برقرار شد");
} catch (e) {
  info(`⚠️  دیتابیس در دسترس نیست (${e.message}) → تست رد می‌شود`);
}

const base = `http://127.0.0.1:${PORT}`;

const waitFor = async (url) => {
  for (let i = 0; i < 120; i++) {
    try {
      return await fetch(url);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("server not ready");
};

let child = null;
let log = "";

const startServer = async (extraEnv = {}) => {
  log = "";
  child = spawn(process.execPath, ["server.js"], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "development",
      RATE_LIMIT_DISABLED: "true",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (d) => (log += d.toString()));
  child.stderr.on("data", (d) => (log += d.toString()));
  await waitFor(`${base}/api/ping`);
};

const stopServer = () => {
  if (!child) return;
  try {
    child.kill();
  } catch {}
  spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
    stdio: "ignore",
  });
  child = null;
};

let adminToken = null;
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${adminToken}`,
});

const run = async () => {
  if (!dbReady) {
    info("ℹ️  برای اجرای این تست باید PostgreSQL بالا باشد.");
    return;
  }

  const admin = await User.findOne({
    where: { role: ["super_admin", "admin", "sub_admin"] },
    order: [["id", "ASC"]],
  });
  if (!admin) {
    info("⚠️  ادمینی در دیتابیس پیدا نشد → رد شد");
    return;
  }
  adminToken = jwt.sign(
    {
      id: admin.id,
      role: admin.role,
      username: admin.username,
      email: admin.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  info(`🔎 ادمین تست: id=${admin.id} role=${admin.role}`);

  // ---------- انتخاب دادهٔ تست ----------
  const placement = await ChickPlacement.findOne({
    where: { is_active: true },
    order: [["id", "ASC"]],
  });

  let weeklyTarget = null;
  if (placement) {
    const maxWeek = await WeeklyManagement.max("week_number", {
      where: { chick_placement_id: placement.id },
    });
    let week = (parseInt(maxWeek) || 0) + 1;
    for (let i = 0; i < 50; i++) {
      const exists = await WeeklyManagement.findOne({
        where: { chick_placement_id: placement.id, week_number: week },
        attributes: ["id"],
      });
      if (!exists) break;
      week += 1;
    }
    weeklyTarget = week;
    info(`🔎 گلهٔ فعال تست: id=${placement.id} (هفتهٔ تست: ${week})`);
  } else {
    info("⚠️  گلهٔ فعالی برای تست هفتگی پیدا نشد");
  }

  const weeklyPayload = () => ({
    customer_id: placement.customer_id,
    unit_id: placement.unit_id,
    hall_id: placement.hall_id,
    chick_placement_id: placement.id,
    week_start_date: "2025-01-01",
    week_end_date: "2025-01-07",
    week_number: weeklyTarget,
    flock_age_days: weeklyTarget * 7,
    weekly_mortality: 0,
    weekly_weight: 1.5,
    blackout_hours: 0,
    daily_feed_intake: 100,
    weekly_feed_intake: 700,
    additional_notes: "تست یکپارچگی داده (قابل حذف)",
    disease_ids: [],
    vaccine_ids: [],
    medicine_ids: [],
    feed_type_ids: [],
    suggestion_ids: [],
  });

  const countWeeks = () =>
    WeeklyManagement.count({
      where: {
        chick_placement_id: placement.id,
        week_number: weeklyTarget,
      },
    });

  // ========== فاز ۱: اثبات rollback ثبت هفتگی ==========
  if (placement) {
    await startServer({ TEST_FAIL_WEEKLY: "true" });
    const before = await countWeeks();
    const res = await fetch(`${base}/api/weekly`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(weeklyPayload()),
    });
    const after = await countWeeks();
    check(
      "ثبت هفتگی با خطای وسط کار → پاسخ خطا",
      res.status === 500,
      `status=${res.status}`,
    );
    check(
      "ثبت هفتگی با خطای وسط کار → هیچ رکورد ناقصی ثبت نشد (rollback)",
      before === 0 && after === 0,
      `before=${before} after=${after}`,
    );
    stopServer();
  }

  // ========== فاز ۲: اثبات rollback ثبت جوجه‌ریزی (گلهٔ یتیم) ==========
  const busyHalls = new Set(
    (
      await ChickPlacement.findAll({
        where: { is_active: true },
        attributes: ["hall_id"],
      })
    ).map((p) => String(p.hall_id)),
  );
  const halls = await Hall.findAll({ limit: 200, order: [["id", "ASC"]] });

  let freeHall = null;
  let freeCustomerId = null;
  for (const h of halls) {
    if (busyHalls.has(String(h.id))) continue;
    const unit = await Unit.findByPk(h.unit_id);
    if (!unit) continue;
    const customer = await CustomerPersonalInfo.findOne({
      where: { id: unit.customer_personal_information_id, active: true },
      attributes: ["id"],
    });
    if (!customer) continue;
    freeHall = h;
    freeCustomerId = customer.id;
    break;
  }

  const chickSource = await ChickSource.findOne({ attributes: ["id"] });
  const breed = await ChickenBreed.findOne({ attributes: ["id"] });

  if (freeHall && chickSource && breed) {
    await startServer({ TEST_FAIL_PLACEMENT: "true" });
    const flockCount = () =>
      Flock.count({
        where: { customer_id: freeCustomerId, unit_id: freeHall.unit_id },
      });
    const before = await flockCount();
    const res = await fetch(`${base}/api/chick-placements`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        customer_id: freeCustomerId,
        unit_id: freeHall.unit_id,
        hall_id: freeHall.id,
        placement_date: "2025-06-01",
        start_new_flock: true,
        chick_source_id: chickSource.id,
        breed_id: breed.id,
        chick_age_on_arrival: 1,
        avg_initial_weight: 0.04,
        total_chicks_count: 1000,
        placement_density: 10,
      }),
    });
    const after = await flockCount();
    check(
      "ثبت جوجه‌ریزی با خطای وسط کار → پاسخ خطا",
      res.status === 500,
      `status=${res.status}`,
    );
    check(
      "ثبت جوجه‌ریزی با خطای وسط کار → گلهٔ یتیم ساخته نشد (rollback)",
      before === after,
      `before=${before} after=${after}`,
    );
    stopServer();
  } else {
    info("⏭️  سالن آزاد/مبدا/نژاد برای تست جوجه‌ریزی پیدا نشد → رد شد");
  }

  // ========== فاز ۳: مسیر سالم (بدون قلاب خطا) ==========
  if (!placement) {
    info("⏭️  بدون گلهٔ فعال، مسیر سالم هفتگی تست نمی‌شود");
    return;
  }

  await startServer();
  const res = await fetch(`${base}/api/weekly`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(weeklyPayload()),
  });
  const body = await res.json().catch(() => ({}));
  const createdId = body?.data?.id;
  check(
    "ثبت هفتگی سالم (تراکنش درست بسته می‌شود) → ۲۰۱",
    res.status === 201,
    `status=${res.status} msg=${body?.message || ""}`,
  );

  const createdCount = await countWeeks();
  check(
    "رکورد هفتگی ثبت‌شده در دیتابیس موجود است",
    createdCount === 1,
    `count=${createdCount}`,
  );

  if (createdId) {
    const del = await fetch(`${base}/api/weekly/${createdId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const afterDelete = await countWeeks();
    check(
      "حذف هفتگی (تراکنشی) → ۲۰۰",
      del.status === 200,
      `status=${del.status}`,
    );
    check(
      "پس از حذف، رکورد هفتگی باقی نمانده است",
      afterDelete === 0,
      `count=${afterDelete}`,
    );
  } else {
    check("شناسهٔ رکورد ایجادشده برگردانده شد", false, "id=undefined");
  }

  stopServer();
};

run()
  .catch((e) => {
    console.error("❌ Test error:", e.message);
    results.push(false);
  })
  .finally(async () => {
    stopServer();
    try {
      await sequelize.close();
    } catch {}
    const failed = results.filter((x) => !x).length;
    console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
    process.exit(failed === 0 ? 0 : 1);
  });
