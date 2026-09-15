// تست موقت (اولویت ۳ و ۴) — بعداً حذف می‌شود
// پوشش: مسیر عکس پروفایل، محدودیت حجم/نوع، فیلد آپلود گزارش، خروج و نشست
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

const PORT_OPEN = 5092; // بدون اجبار نشست تکی
const PORT_SINGLE = 5091; // با ENFORCE_SINGLE_SESSION=true

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (s) => console.log(s);

// ✅ محافظ: این تست به دیتابیس واقعی وصل می‌شود و تغییرات موقت ایجاد می‌کند
// بنابراین فقط با اجازهٔ صریح اجرا می‌شود (تا اشتباهی روی سرور اصلی اجرا نشود).
if (process.env.ALLOW_DB_TESTS !== "true" || process.env.NODE_ENV === "production") {
  console.log("⏭️  SKIPPED (تست دیتابیسی)");
  console.log("   برای اجرا:  set ALLOW_DB_TESTS=true && npm run test:uploads");
  process.exit(0);
}

const { sequelize } = require("./config/database.js");
const User = require("./models/User.js");

let dbReady = false;
try {
  await Promise.race([
    sequelize.authenticate(),
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
  ]);
  dbReady = true;
} catch (e) {
  info(`⚠️  دیتابیس در دسترس نیست (${e.message}) → تست رد می‌شود`);
}

const servers = [];
const startBackend = (port, extraEnv = {}) => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: import.meta.dirname,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development", // تا پیام خطاها برای تست قابل خواندن باشد
      RATE_LIMIT_DISABLED: "true",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  servers.push(child);
  return child;
};

const waitFor = async (url, opts) => {
  for (let i = 0; i < 100; i++) {
    try {
      return await fetch(url, opts);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("not ready: " + url);
};

const PNG_SMALL = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4, 5, 6, 7, 8,
]);

const listFilesRecursive = (dir, acc = []) => {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFilesRecursive(full, acc);
    else acc.push(full);
  }
  return acc;
};

const uploadsBefore = listFilesRecursive("uploads");

const run = async () => {
  if (!dbReady) return;

  const admin = await User.findOne({
    where: { role: ["super_admin", "admin", "sub_admin"] },
  });
  const low = await User.findOne({ where: { role: ["expert", "customer"] } });
  if (!admin || !low) {
    info("⚠️  کاربر ادمین/کم‌دسترسی پیدا نشد → رد شد");
    return;
  }

  const originalAdminToken = admin.token;
  const originalLowToken = low.token;
  const originalLowOnline = low.online_status;

  const tokenFor = (u, extra = {}) =>
    jwt.sign(
      {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        ...extra,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

  // =========================================================
  // بخش ۱: آپلودها (بدون اجبار نشست تکی)
  // =========================================================
  const base1 = `http://127.0.0.1:${PORT_OPEN}`;
  startBackend(PORT_OPEN);
  await waitFor(`${base1}/api/ping`);

  const adminToken = tokenFor(admin);
  const adminAuth = { Authorization: `Bearer ${adminToken}` };

  const unique = Date.now();
  const fd = new FormData();
  fd.append("first_name", "تست");
  fd.append("last_name", "آپلود");
  fd.append("username", `__test_upload_${unique}__`);
  fd.append("email", `test_upload_${unique}@local.test`);
  fd.append("password", "123456");
  fd.append("mobile_number", "09120000000");
  fd.append("role", "expert");
  fd.append(
    "profile_image",
    new Blob([PNG_SMALL], { type: "image/png" }),
    "avatar.png",
  );

  const reg = await fetch(`${base1}/api/users/register`, {
    method: "POST",
    headers: adminAuth,
    body: fd,
  });
  const regBody = await reg.json().catch(() => ({}));
  const createdUser = regBody?.data?.user;
  const profileUrl = createdUser?.profile_image;

  check(
    "ثبت کاربر با عکس پروفایل → ۲۰۱",
    reg.status === 201,
    `status=${reg.status} msg=${String(regBody.message).slice(0, 40)}`,
  );
  check(
    "مسیر عکس پروفایل درست ساخته شد (uploads/profile_images)",
    typeof profileUrl === "string" &&
      profileUrl.startsWith("/uploads/profile_images/"),
    String(profileUrl),
  );

  if (profileUrl) {
    const diskPath = path.join(import.meta.dirname, profileUrl.replace(/^\//, ""));
    check("فایل عکس روی دیسک وجود دارد", fs.existsSync(diskPath), diskPath);

    const imgRes = await fetch(`${base1}${profileUrl}`);
    check(
      "عکس از طریق URL قابل دریافت است (200)",
      imgRes.status === 200,
      `status=${imgRes.status}`,
    );
  }

  // فایل بزرگ (۶ مگابایت) → باید رد شود
  const bigFd = new FormData();
  bigFd.append("username", `__test_big_${unique}__`);
  bigFd.append(
    "profile_image",
    new Blob([Buffer.alloc(6 * 1024 * 1024, 1)], { type: "image/png" }),
    "big.png",
  );
  const bigRes = await fetch(`${base1}/api/users/register`, {
    method: "POST",
    headers: adminAuth,
    body: bigFd,
  });
  const bigBody = await bigRes.json().catch(() => ({}));
  check(
    "فایل ۶ مگابایتی رد می‌شود (سقف ۵ مگابایت)",
    bigRes.status === 400 && /حجم فایل/.test(String(bigBody.message)),
    `status=${bigRes.status} msg=${String(bigBody.message).slice(0, 40)}`,
  );

  // فایل غیرتصویری → باید رد شود
  const txtFd = new FormData();
  txtFd.append("username", `__test_txt_${unique}__`);
  txtFd.append(
    "profile_image",
    new Blob([Buffer.from("hello")], { type: "text/plain" }),
    "note.txt",
  );
  const txtRes = await fetch(`${base1}/api/users/register`, {
    method: "POST",
    headers: adminAuth,
    body: txtFd,
  });
  const txtBody = await txtRes.json().catch(() => ({}));
  check(
    "فایل غیرتصویری برای عکس پروفایل رد می‌شود",
    txtRes.status === 400 && /تصویر/.test(String(txtBody.message)),
    `status=${txtRes.status}`,
  );

  // فیلد درست گزارش بازدید (`files`) پذیرفته میشود
  const vrFd = new FormData();
  vrFd.append("customer_id", "1");
  vrFd.append("report_text", "تست");
  vrFd.append(
    "files",
    new Blob([PNG_SMALL], { type: "image/png" }),
    "report.png",
  );
  const vrWrongFd = new FormData();
  vrWrongFd.append("wrongfield", new Blob([PNG_SMALL], { type: "image/png" }), "x.png");

  const vrOk = await fetch(`${base1}/api/visit-reports`, {
    method: "POST",
    headers: adminAuth,
    body: vrFd,
  });
  const vrOkBody = await vrOk.json().catch(() => ({}));
  check(
    "آپلود گزارش با فیلد «files» پذیرفته میشود (خطای multer ندارد)",
    !/Unexpected field/i.test(JSON.stringify(vrOkBody)),
    `status=${vrOk.status}`,
  );

  const vrBad = await fetch(`${base1}/api/visit-reports`, {
    method: "POST",
    headers: adminAuth,
    body: vrWrongFd,
  });
  const vrBadBody = await vrBad.json().catch(() => ({}));
  check(
    "فیلد ناشناخته در آپلود گزارش رد میشود (Unexpected field)",
    vrBad.status === 400 && /Unexpected|ناشناخته/i.test(JSON.stringify(vrBadBody)),
    `status=${vrBad.status}`,
  );

  // وضعیت آنلاین با هر دو نام فیلد
  const put1 = await fetch(`${base1}/api/users/${low.id}/online-status`, {
    method: "PATCH",
    headers: { ...adminAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ status: true }),
  });
  const after1 = await User.findByPk(low.id, { attributes: ["online_status"] });
  check(
    "وضعیت آنلاین با نام «status» کار میکند",
    put1.status === 200 && after1.online_status === true,
    `status=${put1.status} value=${after1.online_status}`,
  );

  const put2 = await fetch(`${base1}/api/users/${low.id}/online-status`, {
    method: "PUT",
    headers: { ...adminAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ online_status: false }),
  });
  const after2 = await User.findByPk(low.id, { attributes: ["online_status"] });
  check(
    "وضعیت آنلاین با نام «online_status» کار میکند",
    put2.status === 200 && after2.online_status === false,
    `status=${put2.status} value=${after2.online_status}`,
  );

  // پاکسازی کاربر تستی
  if (createdUser?.id) {
    const del = await fetch(`${base1}/api/users/${createdUser.id}`, {
      method: "DELETE",
      headers: adminAuth,
    });
    check("حذف کاربر تستی", del.status === 200, `status=${del.status}`);
  }

  // =========================================================
  // بخش ۲: خروج + نشست تکی
  // =========================================================
  const base2 = `http://127.0.0.1:${PORT_SINGLE}`;
  startBackend(PORT_SINGLE, { ENFORCE_SINGLE_SESSION: "true" });
  await waitFor(`${base2}/api/ping`);

  const sessionToken = tokenFor(low);
  await low.update({ token: sessionToken });

  const okRes = await fetch(`${base2}/api/users`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  check(
    "با ENFORCE_SINGLE_SESSION: توکن ذخیرهشده پذیرفته میشود",
    okRes.status === 403,
    `status=${okRes.status}`,
  );

  const otherToken = tokenFor(low, { nonce: "different-session" });
  const otherRes = await fetch(`${base2}/api/bookmarks`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  check(
    "توکن دیگر همان کاربر رد میشود (نشست تکی)",
    otherRes.status === 401,
    `status=${otherRes.status}`,
  );

  const logoutRes = await fetch(`${base2}/api/users/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  check("خروج از حساب (POST /users/logout) → 200", logoutRes.status === 200, `status=${logoutRes.status}`);

  const afterLogoutDb = await User.findByPk(low.id, {
    attributes: ["token", "token_expires_at"],
  });
  check(
    "توکن در دیتابیس پس از خروج پاک شد",
    afterLogoutDb.token === null,
    `token=${afterLogoutDb.token ? "set" : "null"}`,
  );

  const reuseRes = await fetch(`${base2}/api/users/${low.id}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  check(
    "توکن باطلشده دیگر کار نمیکند (۴۰۱)",
    reuseRes.status === 401,
    `status=${reuseRes.status}`,
  );

  // بازگرداندن مقادیر اصلی دیتابیس
  await User.update(
    { token: originalAdminToken },
    { where: { id: admin.id }, silent: true },
  );
  await User.update(
    { token: originalLowToken, online_status: originalLowOnline },
    { where: { id: low.id }, silent: true },
  );
  info("♻️ مقادیر اصلی دیتابیس بازگردانده شد");
};

run()
  .catch((e) => {
    console.error("❌ Test error:", e.message);
    results.push(false);
  })
  .finally(async () => {
    servers.forEach((child) => {
      try {
        child.kill();
      } catch {}
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    });

    // پاکسازی فایلهای آپلودشده در این تست
    const uploadsAfter = listFilesRecursive("uploads");
    const created = uploadsAfter.filter((f) => !uploadsBefore.includes(f));
    created.forEach((f) => {
      try {
        fs.unlinkSync(f);
      } catch {}
    });
    if (created.length) info(`🧹 ${created.length} فایل تستی حذف شد`);

    try {
      await sequelize.close();
    } catch {}

    const failed = results.filter((x) => !x).length;
    console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
    process.exit(failed === 0 ? 0 : 1);
  });
