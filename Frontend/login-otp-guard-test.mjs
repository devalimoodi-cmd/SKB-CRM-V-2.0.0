// ============================================================
//  گارد «ورود دومرحله‌ای با کد پیامکی» (OTP) — فاز ۱۳.۱
// ------------------------------------------------------------
//  ریشهٔ خطری که این گارد از بازگشتش جلوگیری می‌کند:
//    اگر مرحلهٔ ۱ (رمز) توکن صادر کند، «دو مرحله‌ای» فقط نمایشی
//    است؛ کسی که رمز را دارد (فیشینگ/لو رفتن دیتابیس) بدون
//    دسترسی به گوشی وارد می‌شود. همچنین اگر کد خام در
//    `sms_logs` نوشته شود، هر کسی با دسترسی خواندنی به دیتابیس
//    می‌تواند وارد شود.
//
//  چه چیزی سنجیده می‌شود؟
//    ۱) منطق خالص otpRules (بدون دیتابیس): هش+فلفل، مقایسه،
//       ماسک موبایل، نرمال‌سازی کد، ترتیب بررسی وضعیت چالش و
//       قاعدهٔ ارسال مجدد (فاصله/Sسقف)
//    ۲) امنیت تولید کد: بدون Math.random، فقط crypto.randomInt
//    ۳) نبودِ «کد خام» در لاگ پیامک (SmsLog) و در مدل/مایگریشن
//    ۴) ترتیب دو مرحله در کنترلرها: مرحلهٔ ۱ هیچ توکن/نشستی
//       نمی‌سازد؛ نشست و توکن فقط در loginOtpController
//    ۵) مسیرها: login/verify · login/resend · login/cancel با
//       محدودیت نرخ + نبودِ مسیر محافظت‌شده (protect) روی آن‌ها
//    ۶) ورودی ورود: نام کاربری، ایمیل و شمارهٔ موبایل
//    ۷) فرانت: مرحلهٔ دوم (کد، شمارش معکوس، ارسال مجدد، بازگشت)
//       و حذف «مرا به خاطر بسپار»
//    ۸) دیتابیس: جدول/ایندکس‌ها در مایگریشن، مدل و db:verify
//
//  اجرا:  npm run test:login-otp      (در پوشهٔ Frontend)
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
// ۰) فایل‌های این فاز موجودند
// ============================================================
const FILES = {
  rules: "Backend/services/otpRules.js",
  service: "Backend/services/otpService.js",
  model: "Backend/models/LoginChallenge.js",
  migration: "Backend/migrations/20261006000000-create-login-challenges.js",
  controller: "Backend/controllers/loginOtpController.js",
  userController: "Backend/controllers/userController.js",
  routes: "Backend/routes/userRoutes.js",
  rateLimit: "Backend/middleware/rateLimit.js",
  env: "Backend/.env.example",
  verifyDb: "Backend/scripts/verify-db.js",
  server: "Backend/server.js",
  loginPage: "Frontend/src/pages/login.html",
  authService: "Frontend/src/core/services/auth.service.js",
  apiConst: "Frontend/src/core/constants/api.const.js",
};

check(
  "پرونده‌های فاز ۱۳.۱ موجودند (سرویس/مدل/مایگریشن/کنترلر/صفحهٔ ورود)",
  Object.values(FILES).every((rel) => exists(rel)),
  Object.entries(FILES)
    .filter(([, rel]) => !exists(rel))
    .map(([k]) => k)
    .join(","),
);

const rules = read(FILES.rules);
const service = read(FILES.service);
const model = read(FILES.model);
const migration = read(FILES.migration);
const controller = read(FILES.controller);
const userController = read(FILES.userController);
const routes = read(FILES.routes);
const rateLimit = read(FILES.rateLimit);
const envExample = read(FILES.env);
const verifyDb = read(FILES.verifyDb);
const serverJs = read(FILES.server);
const loginPage = read(FILES.loginPage);
const authService = read(FILES.authService);
const apiConst = read(FILES.apiConst);

console.log(`- قواعد خوانده شد: ${rules.split("\n").length} خط`);

// ============================================================
// ۱) منطق خالص (بدون دیتابیس)
// ============================================================
const R = require(path.join(ROOT, "Backend", "services", "otpRules.js"));

const ENV_KEYS = [
  "LOGIN_OTP_TTL_SECONDS",
  "LOGIN_OTP_RESEND_SECONDS",
  "LOGIN_OTP_MAX_ATTEMPTS",
  "LOGIN_OTP_MAX_PER_HOUR",
  "LOGIN_OTP_MAX_RESENDS",
  "LOGIN_OTP_RETENTION_DAYS",
  "LOGIN_OTP_PURGE_INTERVAL_HOURS",
  "LOGIN_OTP_ENFORCE",
  "LOGIN_OTP_TEST_CODE",
  "SMS_TEMPLATE_OTP_LOGIN",
  "OTP_PEPPER",
  "NODE_ENV",
];
const SAVED = {};
for (const key of ENV_KEYS) SAVED[key] = process.env[key];
const resetEnv = () => {
  for (const key of ENV_KEYS) delete process.env[key];
};
const restoreEnv = () => {
  for (const key of ENV_KEYS) {
    if (SAVED[key] === undefined) delete process.env[key];
    else process.env[key] = SAVED[key];
  }
};

// --- پیش‌فرض‌ها (وقتی .env چیزی نگفته) ---
resetEnv();

check(
  "قواعد: پیش‌فرض‌ها همان تصمیم‌های قفل‌شده‌اند (TTL=۱۸۰ · resend=۶۰ · attempts=۵ · hourly=۸)",
  R.ttlSeconds() === 180 &&
    R.resendSeconds() === 60 &&
    R.maxAttempts() === 5 &&
    R.maxPerHour() === 8 &&
    R.maxResends() === 5,
  `ttl=${R.ttlSeconds()} resend=${R.resendSeconds()} attempts=${R.maxAttempts()} hourly=${R.maxPerHour()}`,
);

check(
  "قواعد: دقیقه‌های اعلام‌شده در قالب از TTL ساخته می‌شود (۱۸۰s ⇒ ۳ دقیقه)",
  R.ttlMinutes() === 3,
  `minutes=${R.ttlMinutes()}`,
);

// --- بازنویسی با .env ---
process.env.LOGIN_OTP_TTL_SECONDS = "300";
process.env.LOGIN_OTP_RESEND_SECONDS = "90";
process.env.LOGIN_OTP_MAX_ATTEMPTS = "3";
check(
  "قواعد: مقدار .env بر پیش‌فرض مقدم است (و مقدار نامعتبر نادیده گرفته می‌شود)",
  R.ttlSeconds() === 300 &&
    R.ttlMinutes() === 5 &&
    R.resendSeconds() === 90 &&
    R.maxAttempts() === 3 &&
    R.positiveInt("abc", 7) === 7 &&
    R.positiveInt(-5, 7) === 7 &&
    R.positiveInt("0", 7) === 7,
);
resetEnv();

// --- «امن به‌صورت پیش‌فرض» ---
process.env.NODE_ENV = "production";
const enforcedInProd = R.isEnforced();
process.env.NODE_ENV = "development";
const enforcedInDev = R.isEnforced();
process.env.LOGIN_OTP_ENFORCE = "false";
const forcedOff = R.isEnforced();
process.env.LOGIN_OTP_ENFORCE = "true";
const forcedOn = R.isEnforced();
resetEnv();

check(
  "قواعد: ⭐ پیش‌فرض امن (production روشن، توسعه خاموش) + .env همیشه برنده",
  enforcedInProd === true &&
    enforcedInDev === false &&
    forcedOff === false &&
    forcedOn === true,
  `prod=${enforcedInProd} dev=${enforcedInDev} off=${forcedOff} on=${forcedOn}`,
);

// --- کد تست فقط بیرون از production ---
process.env.LOGIN_OTP_TEST_CODE = "111111";
process.env.NODE_ENV = "production";
const testInProd = R.testCode();
process.env.NODE_ENV = "test";
const testInTest = R.testCode();
resetEnv();

check(
  "قواعد: کد تست فقط بیرون از production پذیرفته می‌شود",
  testInProd === null && testInTest === "111111",
  `prod=${testInProd} test=${testInTest}`,
);

// --- هش + فلفل ---
process.env.OTP_PEPPER = "pepper-A";
const hashA1 = R.hashCode("123456");
const hashA2 = R.hashCode(123456); // عدد و رشته یکسان هش می‌شوند
process.env.OTP_PEPPER = "pepper-B";
const hashB = R.hashCode("123456");
resetEnv();
const hashNoPepper = R.hashCode("123456");

check(
  "قواعد: کد به‌صورت SHA-256(code + ':' + OTP_PEPPER) هش می‌شود (۶۴ کاراکتر hex)",
  /^[0-9a-f]{64}$/.test(hashA1) && hashA1 === hashA2,
);

check(
  "قواعد: ⭐ تغییر فلفل، هش را عوض می‌کند (هش‌های لو رفته بی‌مصرف می‌شوند)",
  hashA1 !== hashB && hashA1 !== hashNoPepper && hashB !== hashNoPepper,
);

check(
  "قواعد: کد خام هرگز در هش دیده نمی‌شود",
  !hashA1.includes("123456") && !hashB.includes("123456"),
);

// --- مقایسهٔ ثابت‌زمان ---
check(
  "قواعد: safeEqualHex درست است (مساوی/نامساوی/ورودی نامعتبر)",
  R.safeEqualHex(hashA1, hashA1) === true &&
    R.safeEqualHex(hashA1, hashB) === false &&
    R.safeEqualHex(hashA1, hashA1.slice(0, -2)) === false &&
    R.safeEqualHex(null, hashA1) === false &&
    R.safeEqualHex("zz", "zz") === false,
);

// --- تولید کد ---
const samples = Array.from({ length: 300 }, () => R.newCode());
check(
  "قواعد: کد تولیدی همیشه ۶ رقمی است (۳۰۰ نمونه)",
  samples.every((code) => /^[1-9][0-9]{5}$/.test(code)),
  `sample=${samples[0]}`,
);

check(
  "قواعد: شناسهٔ چالش تصادفی و ۴۸ کاراکتری است",
  R.newChallengeId().length === 48 &&
    R.newChallengeId() !== R.newChallengeId(),
);

// --- ماسک موبایل ---
check(
  "قواعد: شمارهٔ موبایل ماسک می‌شود (۴ رقم اول + ۴ رقم آخر)",
  R.maskMobile("09121234567") === "0912***4567" &&
    R.maskMobile("") === "" &&
    R.maskMobile(null) === "",
  R.maskMobile("09121234567"),
);

// --- نرمال‌سازی کد ---
check(
  "قواعد: کد ورودی نرمال می‌شود (ارقام فارسی · فاصله · ورودی ناقص)",
  R.normalizeCode("۱۲۳۴۵۶") === "123456" &&
    R.normalizeCode(" 123 456 ") === "123456" &&
    R.normalizeCode("12345") === "" &&
    R.normalizeCode("1234567") === "" &&
    R.normalizeCode(null) === "",
  `${R.normalizeCode("۱۲۳۴۵۶")}|${R.normalizeCode("12345")}`,
);

// --- تشخیص وضعیت چالش (ترتیب بررسی‌ها مهم است) ---
const NOW = 1_700_000_000_000;
const healthy = {
  status: "pending",
  expires_at: new Date(NOW + 60_000),
  attempts: 0,
  max_attempts: 5,
  resend_count: 0,
  last_sent_at: new Date(NOW - 70_000),
};

check(
  "قواعد: چالش ناشناخته ⇒ not_found و چالش سالم ⇒ بدون مشکل (null)",
  R.challengeProblem(null, NOW) === "not_found" &&
    R.challengeProblem({ ...healthy }, NOW) === null,
);

check(
  "قواعد: ⭐ چالش مصرف‌شده ⇒ used (یک‌بارمصرف · ضدّ replay)",
  R.challengeProblem({ ...healthy, status: "consumed" }, NOW) === "used",
);

check(
  "قواعد: چالش مسدود ⇒ blocked · لغوشده/ناموفق ⇒ expired",
  R.challengeProblem({ ...healthy, status: "blocked" }, NOW) === "blocked" &&
    R.challengeProblem({ ...healthy, status: "cancelled" }, NOW) ===
      "expired" &&
    R.challengeProblem({ ...healthy, status: "failed" }, NOW) === "expired",
);

check(
  "قواعد: انقضای زمانی و سقف تلاش سنجیده می‌شوند",
  R.challengeProblem({ ...healthy, expires_at: new Date(NOW - 1000) }, NOW) ===
    "expired" &&
    R.challengeProblem({ ...healthy, attempts: 5 }, NOW) === "blocked" &&
    R.challengeProblem({ ...healthy, expires_at: "not-a-date" }, NOW) ===
      "expired",
);

// --- ارسال مجدد ---
const tooSoon = R.canResend({
  row: { ...healthy, last_sent_at: new Date(NOW - 10_000) },
  now: NOW,
});
const resendAllowed = R.canResend({ row: healthy, now: NOW });
const resendLimited = R.canResend({
  row: { ...healthy, resend_count: R.maxResends() },
  now: NOW,
});
const resendUsed = R.canResend({
  row: { ...healthy, status: "consumed" },
  now: NOW,
});

check(
  "قواعد: ⭐ ارسال مجدد فاصلهٔ اجباری دارد (۶۰ ثانیه) و ثانیهٔ انتظار برمی‌گرداند",
  tooSoon.ok === false &&
    tooSoon.reason === "too_soon" &&
    tooSoon.waitSeconds === 50,
  `wait=${tooSoon.waitSeconds}`,
);

check(
  "قواعد: ارسال مجدد پس از پایان فاصله مجاز است",
  resendAllowed.ok === true,
);

check(
  "قواعد: سقف ارسال مجدد و چالش مصرف‌شده اجازهٔ ارسال نمی‌دهند",
  resendLimited.ok === false &&
    resendLimited.reason === "resend_limit" &&
    resendUsed.ok === false &&
    resendUsed.reason === "used",
);

// --- قالب پیامک ---
const defaultTemplate = R.templateIdFor("login");
process.env.SMS_TEMPLATE_OTP_LOGIN = "514103";
const envTemplate = R.templateIdFor("login");
process.env.SMS_TEMPLATE_OTP_LOGIN = "abc";
const badTemplate = R.templateIdFor("login");
resetEnv();

check(
  "قواعد: قالب پیش‌فرض ورود = 514103 و مقدار نامعتبر ⇒ null (نه ارسال با قالب اشتباه)",
  R.DEFAULT_TEMPLATE_ID === 514103 &&
    defaultTemplate === 514103 &&
    envTemplate === 514103 &&
    badTemplate === null,
  `default=${defaultTemplate} bad=${badTemplate}`,
);

check(
  "قواعد: نام پارامترهای قالب NAME/OTP/TIME است (تأییدشده با کارفرما)",
  R.PARAM_NAME === "NAME" && R.PARAM_OTP === "OTP" && R.PARAM_TIME === "TIME",
);

restoreEnv();

// ============================================================
// ۲) امنیت تولید و ثبت کد
// ============================================================
check(
  "سرویس: تولید کد/شناسه فقط با crypto است (هیچ Math.random در مسیر OTP نیست)",
  !/Math\.random/.test(service) &&
    !/Math\.random/.test(rules) &&
    /crypto\.randomInt/.test(rules) &&
    /crypto\.randomBytes/.test(rules),
);

check(
  "سرویس: مقایسهٔ کد با timingSafeEqual (مقاوم به حملهٔ زمان‌سنجی)",
  /timingSafeEqual/.test(rules) && /safeEqualHex\(/.test(service),
);

const smsLogBlock = (service.match(/SmsLog\.create\(\{[\s\S]*?\n {4}\}\)/) || [
  "",
])[0];
check(
  "سرویس: ⭐ کد خام در sms_logs نوشته نمی‌شود (لاگ بدون مقدار کد)",
  smsLogBlock.length > 0 &&
    !/\bcode\b/i.test(smsLogBlock) &&
    !/\$\{code\}/.test(smsLogBlock) &&
    /مقدار کد در لاگ ذخیره نمی‌شود/.test(service),
  `block=${smsLogBlock.replace(/\s+/g, " ").slice(0, 60)}`,
);

check(
  "مدل/مایگریشن: فقط code_hash دارند و هیچ ستون «code» خامی وجود ندارد",
  /code_hash/.test(model) &&
    /code_hash/.test(migration) &&
    !/\bcode:\s*\{/.test(model) &&
    !/\bcode:\s*\{/.test(migration),
);

check(
  "مدل: بدون FK به users (تاریخچهٔ چالش‌ها پس از حذف کاربر می‌ماند)",
  !/references\s*:/.test(model) && !/FOREIGN KEY/i.test(model),
);

check(
  "سرویس: تنظیمات از .env خوانده می‌شود (TTL · فاصلهٔ ارسال مجدد · سقف‌ها)",
  /LOGIN_OTP_TTL_SECONDS/.test(rules) &&
    /LOGIN_OTP_RESEND_SECONDS/.test(rules) &&
    /LOGIN_OTP_MAX_ATTEMPTS/.test(rules) &&
    /LOGIN_OTP_MAX_PER_HOUR/.test(rules) &&
    /LOGIN_OTP_MAX_RESENDS/.test(rules) &&
    /OTP_PEPPER/.test(rules),
);

check(
  "سرویس: ارسال با قالب verify سرویس sms.ir و پارامترهای NAME/OTP/TIME",
  /sendVerify\(/.test(service) &&
    /PARAM_NAME,\s*value:\s*displayName/.test(service) &&
    /PARAM_OTP,\s*value:\s*String\(code\)/.test(service),
);

// ============================================================
// ۳) ⭐ ترتیب دو مرحله (اصلی‌ترین ادعای این فاز)
// ============================================================
const otpBranchStart = userController.indexOf("if (otpService.isEnforced())");
const legacyStart = userController.indexOf(
  "// ✅ «نشست» (فاز ۱۲.۱): برای این ورود یک ردیف نشست ساخته می‌شود",
);
const otpBranch =
  otpBranchStart >= 0 && legacyStart > otpBranchStart
    ? userController.slice(otpBranchStart, legacyStart)
    : "";

check(
  "کنترلر ورود: شاخهٔ OTP وجود دارد و «requires_otp» برمی‌گرداند",
  otpBranch.includes("requires_otp: true") &&
    otpBranch.includes("challenge_id") &&
    otpBranch.includes("masked_mobile") &&
    otpBranch.includes("createChallenge"),
);

check(
  "کنترلر ورود: ⭐ در شاخهٔ OTP هیچ توکن/نشستی صادر نمی‌شود",
  otpBranch.length > 0 &&
    !/generateToken/.test(otpBranch) &&
    !/sessionService\.start/.test(otpBranch) &&
    !/setToken/.test(otpBranch),
);

check(
  "کنترلر ورود: شاخهٔ قدیمی (OTP خاموش) توکن و نشست می‌سازد",
  legacyStart > 0 &&
    /sessionService\.start/.test(userController.slice(legacyStart)) &&
    /generateToken/.test(userController.slice(legacyStart)),
);

check(
  "کنترلر مرحلهٔ ۲: نشست + توکن + زمان ورود همین‌جا ساخته می‌شود",
  /sessionService\.start\(/.test(controller) &&
    /generateToken\(/.test(controller) &&
    /last_login:\s*new Date\(\)/.test(controller),
);

check(
  "کنترلر مرحلهٔ ۲: رمز عبور نمی‌گیرد (اعتبارش فقط challenge_id + کد است)",
  !/comparePassword/.test(controller) && !/req\.body\.password/.test(controller),
);

check(
  "کنترلر مرحلهٔ ۲: پس از تایید کد، وضعیت حساب و قفل دوباره بررسی می‌شود",
  /user\.status !== "active"/.test(controller) &&
    /user\.isLocked\(\)/.test(controller),
);

check(
  "کنترلر مرحلهٔ ۲: برای هر نقش مقصد ورود مشخص است (admin · داشبورد · customer-info)",
  /landingForRole/.test(controller) &&
    /"\/admin"/.test(controller) &&
    /"\/customer-info"/.test(controller),
);

// ============================================================
// ۴) ورودی ورود: نام کاربری / ایمیل / موبایل
// ============================================================
check(
  "ورود مرحلهٔ ۱: شناسه می‌تواند نام کاربری، ایمیل یا شمارهٔ موبایل باشد",
  /looksLikeMobile/.test(userController) &&
    /mobile_number:\s*identifier/.test(userController) &&
    /\{ username: identifier \}/.test(userController) &&
    /\{ email: identifier/.test(userController),
);

// ============================================================
// ۵) مسیرها و محدودیت نرخ
// ============================================================
const protectIndex = routes.indexOf("router.use(protect");
const verifyIndex = routes.indexOf('router.post("/login/verify"');
const resendIndex = routes.indexOf('router.post("/login/resend"');
const cancelIndex = routes.indexOf('router.post("/login/cancel"');

check(
  "مسیرها: login/verify · login/resend · login/cancel تعریف شده‌اند",
  verifyIndex > 0 && resendIndex > 0 && cancelIndex > 0,
);

check(
  "مسیرها: ⭐ هر سه مسیر OTP «عمومی» هستند (قبل از protect) و محدودیت نرخ دارند",
  protectIndex > 0 &&
    verifyIndex < protectIndex &&
    resendIndex < protectIndex &&
    cancelIndex < protectIndex &&
    /"\/login\/verify", otpLimiter/.test(routes) &&
    /"\/login\/resend", otpLimiter/.test(routes) &&
    /"\/login\/cancel", otpLimiter/.test(routes),
);

check(
  "محدودیت نرخ: otpLimiter ساخته و صادر شده است (پنجرهٔ ۶۰ ثانیه‌ای)",
  /const otpLimiter = createRateLimiter\(\{/.test(rateLimit) &&
    /windowMs:\s*60\s*\*\s*1000/.test(rateLimit) &&
    /otpLimiter,/.test(rateLimit),
);

// ============================================================
// ۶) تنظیمات مستند در .env.example
// ============================================================
const envKeys = [
  "LOGIN_OTP_ENFORCE",
  "OTP_PEPPER",
  "SMS_TEMPLATE_OTP_LOGIN=514103",
  "LOGIN_OTP_TTL_SECONDS=180",
  "LOGIN_OTP_RESEND_SECONDS=60",
  "LOGIN_OTP_MAX_ATTEMPTS=5",
  "LOGIN_OTP_MAX_PER_HOUR=8",
  "LOGIN_OTP_MAX_RESENDS=5",
  "LOGIN_OTP_TEST_CODE",
];
const missingEnvKeys = envKeys.filter((key) => !envExample.includes(key));

check(
  ".env.example: همهٔ کلیدهای OTP مستند شده‌اند (قالب ورود = 514103)",
  missingEnvKeys.length === 0,
  missingEnvKeys.join(","),
);

// ============================================================
// ۷) فرانت‌اند: مرحلهٔ دوم روی همان صفحهٔ ورود
// ============================================================
check(
  "صفحهٔ ورود: مرحلهٔ دوم (کد · شمارش معکوس · ارسال مجدد · بازگشت) در HTML هست",
  /id="otpForm"/.test(loginPage) &&
    /id="otpCode"/.test(loginPage) &&
    /id="otpCountdown"/.test(loginPage) &&
    /id="otpResend"/.test(loginPage) &&
    /id="otpBack"/.test(loginPage) &&
    /id="otpMobile"/.test(loginPage),
);

check(
  "صفحهٔ ورود: ⭐ «مرا به خاطر بسپار» حذف شده است (کد پیامکی برای همهٔ نقش‌ها اجباری است)",
  !/id="rememberMe"/.test(loginPage) &&
    !/مرا به خاطر بسپار/.test(loginPage),
);

check(
  "صفحهٔ ورود: شمارش معکوس و ارسال مجدد با توابع مشخص مدیریت می‌شوند",
  /function startCountdown/.test(loginPage) &&
    /function startResendCooldown/.test(loginPage) &&
    /function showOtpStep/.test(loginPage) &&
    /function backToLoginStep/.test(loginPage),
);

check(
  "صفحهٔ ورود: مرحلهٔ ۲ سرویس‌های auth را صدا می‌زند (verify/resend/cancel)",
  /verifyLoginOtp\(/.test(loginPage) &&
    /resendLoginOtp\(/.test(loginPage) &&
    /cancelLoginOtp\(/.test(loginPage),
);

check(
  "صفحهٔ ورود: ورودی ورود «نام کاربری، ایمیل یا موبایل» را اعلام می‌کند",
  /شمارهٔ موبایل/.test(loginPage),
);

// ترتیب: تا وقتی مرحلهٔ ۱ توکن نداده، هیچ چیزی ذخیره نمی‌شود
const loginFnStart = authService.indexOf("async login(username");
const verifyFnStart = authService.indexOf("async verifyLoginOtp(");
const loginFnBody =
  loginFnStart >= 0 && verifyFnStart > loginFnStart
    ? authService.slice(loginFnStart, verifyFnStart)
    : "";

check(
  "سرویس احراز هویت: ⭐ مرحلهٔ ۱ توکن را ذخیره نمی‌کند (فقط challengeId برمی‌گرداند)",
  loginFnBody.length > 0 &&
    /requiresOtp: true/.test(loginFnBody) &&
    /challengeId:/.test(loginFnBody) &&
    !/setToken\(/.test(loginFnBody) &&
    !/presenceService\.start\(/.test(loginFnBody),
);

check(
  "سرویس احراز هویت: ذخیرهٔ توکن/کاربر و شروع heartbeat فقط در _finishLogin است",
  /async _finishLogin\(data\)/.test(authService) &&
    /_finishLogin\(response\.data\)/.test(authService),
);

check(
  "ثابت‌های API: مسیرهای verify/resend/cancel ثبت شده‌اند",
  /LOGIN_VERIFY:\s*"\/users\/login\/verify"/.test(apiConst) &&
    /LOGIN_RESEND:\s*"\/users\/login\/resend"/.test(apiConst) &&
    /LOGIN_CANCEL:\s*"\/users\/login\/cancel"/.test(apiConst),
);

// ============================================================
// ۸) دیتابیس: مایگریشن · مدل · db:verify
// ============================================================
const expectedIndexes = [
  "login_challenges_challenge_id_unique",
  "login_challenges_user_status",
  "login_challenges_expires_at",
];
const missingIndexes = expectedIndexes.filter(
  (name) => !verifyDb.includes(name) || !migration.includes(name),
);

check(
  "مایگریشن: جدول login_challenges با سه ایندکس لازم شناخته شده است",
  missingIndexes.length === 0 &&
    /createTable\("login_challenges"/.test(migration) &&
    /dropTable\("login_challenges"\)/.test(migration),
  missingIndexes.join(","),
);

check(
  "مایگریشن: idempotent است (قبل از ساخت/ایندکس‌گذاری وجود را بررسی می‌کند)",
  /showAllTables\(\)/.test(migration) &&
    /showIndex\(/.test(migration) &&
    /if \(!existing\.includes\("login_challenges"\)\)/.test(migration),
);

check(
  "مدل: جدول/ستون‌های کلیدی درست تعریف شده‌اند (challenge_id یکتا · status · expires_at)",
  /tableName:\s*"login_challenges"/.test(model) &&
    /challenge_id/.test(model) &&
    /expires_at/.test(model) &&
    /status/.test(model),
);

check(
  "db:verify: جدول و ستون‌های login_challenges سنجیده می‌شوند",
  /"login_challenges",/.test(verifyDb) &&
    /login_challenges:\s*\[/.test(verifyDb) &&
    /"code_hash",/.test(verifyDb),
);

check(
  "server: پاک‌سازی دوره‌ای چالش‌های ورود راه‌اندازی می‌شود (بدون crash)",
  /otpService\.startHousekeeping\(\)/.test(serverJs) &&
    /try \{/.test(serverJs),
);

// ============================================================
// ۹) فعالیت: ورودِ مرحلهٔ ۲ هم به‌عنوان «ورود» ثبت می‌شود
// ============================================================
const activityRules = read("Backend/services/activityRules.js");
check(
  "ردّ فعالیت: مسیر login/verify هم رویداد «login» حساب می‌شود",
  /\\\/users\\\/login\\\/verify\$/.test(activityRules),
);

// ============================================================
// خلاصه
// ============================================================
const failed = results.filter((ok) => !ok).length;
console.log(
  `\n${failed === 0 ? "✅" : "❌"} ${results.length - failed}/${results.length} بررسی موفق`,
);

if (failed > 0) {
  console.log("FAIL - گارد ورود دومرحله‌ای شکست خورد");
  process.exit(1);
}
console.log("PASS - گارد ورود دومرحله‌ای (OTP) سالم است");
