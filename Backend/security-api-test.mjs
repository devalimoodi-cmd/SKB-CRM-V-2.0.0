// تست موقت (API) — بعداً حذف می‌شود
// بک‌اند بدون دیتابیس اجرا می‌شود (DB_PORT اشتباه) تا فقط لایهٔ امنیت/محدودیت تست شود
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PORT = 5095;
const LOGIN_MAX = 3; // برای تست سریع محدودیت ورود
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const child = spawn(process.execPath, ["server.js"], {
  cwd: import.meta.dirname,
  env: {
    ...process.env,
    PORT: String(PORT),
    DB_PORT: "5999", // دیتابیس در دسترس نیست
    NODE_ENV: "production",
    LOGIN_RATE_MAX: String(LOGIN_MAX),
    RATE_LIMIT_DISABLED: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (d) => (log += d.toString()));
child.stderr.on("data", (d) => (log += d.toString()));

const base = `http://127.0.0.1:${PORT}`;

const waitFor = async (url, opts) => {
  for (let i = 0; i < 80; i++) {
    try {
      return await fetch(url, opts);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("server not ready: " + url);
};

const run = async () => {
  // ۱) endpoint عمومی + هدرهای امنیتی
  const ping = await waitFor(`${base}/api/ping`);
  const pingJson = await ping.json();
  check("GET /api/ping → 200", ping.status === 200 && pingJson.success === true);
  check(
    "هدر امنیتی X-Content-Type-Options",
    ping.headers.get("x-content-type-options") === "nosniff",
  );
  check(
    "هدر X-Powered-By حذف شده",
    ping.headers.get("x-powered-by") === null,
    String(ping.headers.get("x-powered-by")),
  );

  // ۲) مسیر محافظت‌شده بدون توکن → 401
  const users = await fetch(`${base}/api/users`);
  check("GET /api/users بدون توکن → 401", users.status === 401, `status=${users.status}`);

  const userById = await fetch(`${base}/api/users/1`);
  check(
    "GET /api/users/1 بدون توکن → 401",
    userById.status === 401,
    `status=${userById.status}`,
  );

  const delUser = await fetch(`${base}/api/users/1`, { method: "DELETE" });
  check(
    "DELETE /api/users/1 بدون توکن → 401",
    delUser.status === 401,
    `status=${delUser.status}`,
  );

  const register = await fetch(`${base}/api/users/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "hacker", role: "super_admin" }),
  });
  check(
    "POST /api/users/register بدون توکن → 401 (قبلاً باز بود)",
    register.status === 401,
    `status=${register.status}`,
  );

  // ۳) محدودیت ورود: تلاش‌های ناموفق
  // ۳) نشت داده: مشتریها و دیکشنری نباید بدون توکن قابل خواندن باشند
  const customers = await fetch(`${base}/api/customers`);
  check(
    "GET /api/customers بدون توکن → 401 (قبلاً باز بود)",
    customers.status === 401,
    `status=${customers.status}`,
  );

  const customerById = await fetch(`${base}/api/customers/1`);
  check(
    "GET /api/customers/1 بدون توکن → 401 (قبلاً باز بود)",
    customerById.status === 401,
    `status=${customerById.status}`,
  );

  const dictHallTypes = await fetch(`${base}/api/dictionary/hall-types`);
  check(
    "GET /api/dictionary/hall-types بدون توکن → 401",
    dictHallTypes.status === 401,
    `status=${dictHallTypes.status}`,
  );

  const dictExperts = await fetch(`${base}/api/dictionary/experts`);
  check(
    "GET /api/dictionary/experts بدون توکن → 401 (نشت موبایل/نام کاربری)",
    dictExperts.status === 401,
    `status=${dictExperts.status}`,
  );

  // ۴) کپچا (کد امنیتی صفحهٔ ورود)
  const captchaRes = await fetch(`${base}/api/captcha`);
  const captchaJson = await captchaRes.json().catch(() => ({}));
  const captchaData = captchaJson?.data || {};
  check(
    "GET /api/captcha → 200 با تصویر SVG و شناسه",
    captchaRes.status === 200 &&
      !!captchaData.id &&
      String(captchaData.svg || "").startsWith("<svg"),
    `status=${captchaRes.status} svg=${String(captchaData.svg || "").length}`,
  );
  check(
    "پاسخ درست کپچا در production لو نمی‌رود",
    captchaData.debugAnswer === undefined,
    String(captchaData.debugAnswer || "-"),
  );

  const loginNoCaptcha = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "nobody", password: "wrong" }),
  });
  const loginNoCaptchaBody = await loginNoCaptcha.json().catch(() => ({}));
  check(
    "ورود بدون کپچا → 400 (ضد حملهٔ خودکار)",
    loginNoCaptcha.status === 400,
    `status=${loginNoCaptcha.status} msg=${String(loginNoCaptchaBody.message).slice(0, 40)}`,
  );

  const loginBadCaptcha = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "nobody",
      password: "wrong",
      captcha_id: "deadbeefdeadbeef",
      captcha_answer: "ZZZZZ",
    }),
  });
  check(
    "ورود با کپچای نامعتبر → 400",
    loginBadCaptcha.status === 400,
    `status=${loginBadCaptcha.status}`,
  );

  const statuses = [];
  for (let i = 0; i < LOGIN_MAX + 1; i++) {
    const r = await fetch(`${base}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nobody", password: "wrong" }),
    });
    statuses.push(r.status);
    if (r.status === 429) {
      const body = await r.json();
      check(
        "پیام ۴۲۹ فارسی و قابل‌فهم است",
        typeof body.message === "string" && body.message.length > 10,
        body.message.slice(0, 45),
      );
    }
  }
  check(
    `محدودیت ورود فعال است (${LOGIN_MAX} تلاش مجاز)`,
    statuses[LOGIN_MAX] === 429,
    `statuses=${statuses.join(",")}`,
  );

  // ۴) پیام خطای داخلی لو نمی‌رود (NODE_ENV=production)
  const firstLogin = await fetch(`${base}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "nobody", password: "wrong" }),
  }).then((r) => r.json().catch(() => ({})));
  const msg = String(firstLogin.message || "");
  check(
    "پیام خطای سرور عمومی است (جزئیات دیتابیس لو نمی‌رود)",
    !/Sequelize|ECONNREFUSED|password|relation/i.test(msg),
    msg.slice(0, 60) || `(429 از محدودیت نرخ - قابل قبول)`,
  );

  // ۵) مسیر ناموجود → 404 (محدودیت نرخ روتینگ را خراب نکرده)
  const notFound = await fetch(`${base}/api/does-not-exist`);
  check("مسیر ناموجود → 404", notFound.status === 404, `status=${notFound.status}`);

  // ۶) امنیت مسیر /uploads (فایل‌های آپلودی)
  const uploadsDir = path.join(import.meta.dirname, "uploads");
  const tempFiles = [
    ["__sec_test_image.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00])],
    ["__sec_test_page.html", Buffer.from("<script>alert(1)</script>")],
    ["__sec_test_icon.svg", Buffer.from("<svg onload=alert(1)></svg>")],
    ["__sec_test_doc.docx", Buffer.from("dummy-docx")],
  ];

  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    for (const [name, content] of tempFiles) {
      fs.writeFileSync(path.join(uploadsDir, name), content);
    }

    const imgRes = await fetch(`${base}/uploads/__sec_test_image.jpg`);
    check(
      "فایل تصویری آپلودی سرو می‌شود (۲۰۰)",
      imgRes.status === 200,
      `status=${imgRes.status}`,
    );
    check(
      "هدر nosniff روی فایل‌های آپلودی",
      imgRes.headers.get("x-content-type-options") === "nosniff",
    );
    check(
      "تصویر به‌صورت inline سرو می‌شود (نه دانلود)",
      !/attachment/i.test(imgRes.headers.get("content-disposition") || ""),
      String(imgRes.headers.get("content-disposition")),
    );

    const htmlRes = await fetch(`${base}/uploads/__sec_test_page.html`);
    check(
      "فایل HTML آپلودشده هرگز سرو نمی‌شود (۴۰۴)",
      htmlRes.status === 404,
      `status=${htmlRes.status}`,
    );

    const svgRes = await fetch(`${base}/uploads/__sec_test_icon.svg`);
    check(
      "فایل SVG آپلودشده سرو نمی‌شود (۴۰۴)",
      svgRes.status === 404,
      `status=${svgRes.status}`,
    );

    const docRes = await fetch(`${base}/uploads/__sec_test_doc.docx`);
    check(
      "فایل غیرتصویری با Content-Disposition: attachment دانلود می‌شود",
      docRes.status === 200 &&
        /attachment/i.test(docRes.headers.get("content-disposition") || ""),
      `status=${docRes.status} cd=${docRes.headers.get("content-disposition")}`,
    );
  } finally {
    for (const [name] of tempFiles) {
      try {
        fs.unlinkSync(path.join(uploadsDir, name));
      } catch {
        /* فایل ممکن است ساخته نشده باشد */
      }
    }
  }

  // ۷) «نظرات و پیشنهادات» — همهٔ روت‌ها نیاز به ورود دارند
  const sugCreate = await fetch(`${base}/api/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "تست", body: "متن تست" }),
  });
  check(
    "POST /api/suggestions بدون توکن → ۴۰۱",
    sugCreate.status === 401,
    `status=${sugCreate.status}`,
  );

  const sugMine = await fetch(`${base}/api/suggestions/mine`);
  check(
    "GET /api/suggestions/mine بدون توکن → ۴۰۱",
    sugMine.status === 401,
    `status=${sugMine.status}`,
  );

  const sugUnread = await fetch(`${base}/api/suggestions/unread-count`);
  check(
    "GET /api/suggestions/unread-count بدون توکن → ۴۰۱",
    sugUnread.status === 401,
    `status=${sugUnread.status}`,
  );

  const sugAdminList = await fetch(`${base}/api/suggestions`);
  check(
    "GET /api/suggestions (فهرست ادمین) بدون توکن → ۴۰۱",
    sugAdminList.status === 401,
    `status=${sugAdminList.status}`,
  );

  const sugDeleteMessage = await fetch(
    `${base}/api/suggestions/1/messages/1`,
    { method: "DELETE" },
  );
  check(
    "DELETE /api/suggestions/:id/messages/:messageId بدون توکن → ۴۰۱",
    sugDeleteMessage.status === 401,
    `status=${sugDeleteMessage.status}`,
  );

  // ۸ب) جستجوی لیست مشتریان — پارامترهای جستجو نباید مسیر را باز کنند
  const customersSearch = await fetch(
    `${base}/api/customers?search=test&searchColumn=all&page=1&limit=5`,
  );
  check(
    "GET /api/customers?search=… بدون توکن → ۴۰۱",
    customersSearch.status === 401,
    `status=${customersSearch.status}`,
  );

  // ۸) «تغییرات جدید / What's New» — همهٔ روت‌ها نیاز به ورود دارند
  const relUnseen = await fetch(`${base}/api/releases/unseen`);
  check(
    "GET /api/releases/unseen بدون توکن → ۴۰۱",
    relUnseen.status === 401,
    `status=${relUnseen.status}`,
  );

  const relHistory = await fetch(`${base}/api/releases/history`);
  check(
    "GET /api/releases/history بدون توکن → ۴۰۱",
    relHistory.status === 401,
    `status=${relHistory.status}`,
  );

  const relSeen = await fetch(`${base}/api/releases/1/seen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dont_show_again: true }),
  });
  check(
    "POST /api/releases/:id/seen بدون توکن → ۴۰۱",
    relSeen.status === 401,
    `status=${relSeen.status}`,
  );

  const relList = await fetch(`${base}/api/releases`);
  check(
    "GET /api/releases (فهرست مدیریتی) بدون توکن → ۴۰۱",
    relList.status === 401,
    `status=${relList.status}`,
  );

  const relCreate = await fetch(`${base}/api/releases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      version: "9.9.9",
      items: [{ category: "new", title: "تست" }],
    }),
  });
  check(
    "POST /api/releases بدون توکن → ۴۰۱",
    relCreate.status === 401,
    `status=${relCreate.status}`,
  );

  const relPublish = await fetch(`${base}/api/releases/1/publish`, {
    method: "POST",
  });
  check(
    "POST /api/releases/:id/publish بدون توکن → ۴۰۱",
    relPublish.status === 401,
    `status=${relPublish.status}`,
  );

  const relStats = await fetch(`${base}/api/releases/1/stats`);
  check(
    "GET /api/releases/:id/stats بدون توکن → ۴۰۱",
    relStats.status === 401,
    `status=${relStats.status}`,
  );

  const relDelete = await fetch(`${base}/api/releases/1`, { method: "DELETE" });
  check(
    "DELETE /api/releases/:id بدون توکن → ۴۰۱",
    relDelete.status === 401,
    `status=${relDelete.status}`,
  );

  // ۹) تنظیمات نمایشی عمومی (لودر سیستمی) — باید بدون توکن در دسترس باشند
  const uiSettings = await fetch(`${base}/api/public/ui-settings`);
  const uiBody = await uiSettings.json().catch(() => ({}));
  check(
    "GET /api/public/ui-settings بدون توکن → ۲۰۰ (لودر معتبر)",
    uiSettings.status === 200 &&
      ["classic", "logo"].includes(uiBody?.data?.loader_style),
    `status=${uiSettings.status} loader=${uiBody?.data?.loader_style}`,
  );
};

run()
  .catch((e) => {
    console.error("❌ Test error:", e.message);
    results.push(false);
  })
  .finally(() => {
    try {
      child.kill();
    } catch {}
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    const failed = results.filter((x) => !x).length;
    console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
    process.exit(failed === 0 ? 0 : 1);
  });
