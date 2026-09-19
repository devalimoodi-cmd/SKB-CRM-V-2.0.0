// تست موقت (Unit) — بعداً حذف می‌شود
// بررسی لایهٔ مجوزدهی و پاک‌سازی پیام خطاها
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const auth = require("./middleware/auth.js");
const { errorResponse } = require("./utils/response.js");

// ===== ابزار ساخت req/res جعلی =====
const fakeRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
};

const runMiddleware = (mw, req) => {
  const res = fakeRes();
  let nextCalled = false;
  mw(req, res, () => (nextCalled = true));
  return { res, nextCalled };
};

// ===== ۱) authorize =====
const authorize = auth.authorize("admin", "super_admin");
check(
  "authorize: نقش مجاز → عبور می‌کند",
  runMiddleware(authorize, { user: { id: 1, role: "admin" } }).nextCalled,
);
check(
  "authorize: نقش غیرمجاز → 403",
  runMiddleware(authorize, { user: { id: 1, role: "customer" } }).res
    .statusCode === 403,
);
check(
  "authorize: بدون کاربر → 401",
  runMiddleware(authorize, {}).res.statusCode === 401,
);

// ===== ۲) authorizeSelfOr =====
const selfOrAdmin = auth.authorizeSelfOr("admin", "super_admin", "sub_admin");
check(
  "authorizeSelfOr: کاربر روی منبع خودش → عبور می‌کند",
  runMiddleware(selfOrAdmin, { user: { id: 7, role: "expert" }, params: { id: "7" } })
    .nextCalled,
);
check(
  'authorizeSelfOr: کاربر روی منبع دیگران → 403',
  runMiddleware(selfOrAdmin, { user: { id: 7, role: "expert" }, params: { id: "9" } })
    .res.statusCode === 403,
);
check(
  "authorizeSelfOr: ادمین روی منبع دیگران → عبور می‌کند",
  runMiddleware(selfOrAdmin, { user: { id: 7, role: "admin" }, params: { id: "9" } })
    .nextCalled,
);
check(
  "authorizeSelfOr: بدون کاربر → 401",
  runMiddleware(selfOrAdmin, { params: { id: "9" } }).res.statusCode === 401,
);

// ===== ۳) نقش‌ها =====
check(
  "ADMIN_ROLES شامل super_admin/admin/sub_admin است",
  ["super_admin", "admin", "sub_admin"].every((r) =>
    auth.ADMIN_ROLES.includes(r),
  ),
);

// ===== ۴) پاک‌سازی پیام خطای ۵۰۰ =====
process.env.NODE_ENV = "production";
let res = fakeRes();
errorResponse(res, "SequelizeConnectionError: password authentication failed", 500);
const prodMessage = res.body.message;
check(
  "در production جزئیات خطای داخلی لو نمی‌رود",
  !prodMessage.includes("Sequelize") && !prodMessage.includes("password"),
  prodMessage.slice(0, 40),
);

process.env.NODE_ENV = "development";
res = fakeRes();
errorResponse(res, "SequelizeConnectionError: جزئیات", 500);
check(
  "در development متن اصلی خطا برای دیباگ می‌ماند",
  res.body.message.includes("Sequelize"),
);

// ===== ۵) خطای کاربر (۴xx) نباید پاک شود =====
process.env.NODE_ENV = "production";
res = fakeRes();
errorResponse(res, "این نام کاربری قبلاً ثبت شده است", 400);
check(
  "پیام خطاهای ۴xx (اعتبارسنجی) دست‌نخورده می‌ماند",
  res.body.message === "این نام کاربری قبلاً ثبت شده است",
  res.body.message,
);

// ===== ۶) سقف صفحه‌بندی =====
const { parsePagination } = require("./utils/pagination.js");

const bigLimit = parsePagination({ limit: "999999", page: "3" });
check(
  "parsePagination سقف limit را اعمال می‌کند (۱۰۰)",
  bigLimit.limit === 100 && bigLimit.offset === 200,
  `limit=${bigLimit.limit} offset=${bigLimit.offset}`,
);

const badPage = parsePagination({ page: "-5" });
check(
  "parsePagination صفحهٔ نامعتبر را ۱ می‌کند",
  badPage.page === 1 && badPage.limit === 20,
  `page=${badPage.page} limit=${badPage.limit}`,
);

const custom = parsePagination({ limit: "5" }, { defaultLimit: 50 });
check(
  "parsePagination پیش‌فرض سفارشی را حفظ می‌کند",
  custom.limit === 5 && parsePagination({}, { defaultLimit: 50 }).limit === 50,
  `limit=${custom.limit}`,
);

// ===== ۷) هدر HSTS =====
const { applySecurityHeaders } = require("./middleware/rateLimit.js");
const fakeResForHeaders = () => {
  const headers = {};
  return {
    headers,
    setHeader: (k, v) => (headers[k] = v),
    removeHeader: (k) => delete headers[k],
  };
};

process.env.ENABLE_HSTS = "true";
let hstsRes = fakeResForHeaders();
applySecurityHeaders({ secure: true, headers: {} }, hstsRes, () => {});
check(
  "HSTS با HTTPS و ENABLE_HSTS=true تنظیم می‌شود",
  String(hstsRes.headers["Strict-Transport-Security"] || "").includes(
    "max-age=31536000",
  ),
  String(hstsRes.headers["Strict-Transport-Security"] || "-"),
);

let httpRes = fakeResForHeaders();
applySecurityHeaders({ secure: false, headers: {} }, httpRes, () => {});
check(
  "HSTS روی HTTP تنظیم نمی‌شود",
  !httpRes.headers["Strict-Transport-Security"],
);

process.env.ENABLE_HSTS = "false";
let disabledRes = fakeResForHeaders();
applySecurityHeaders({ secure: true, headers: {} }, disabledRes, () => {});
check(
  "HSTS با ENABLE_HSTS=false تنظیم نمی‌شود",
  !disabledRes.headers["Strict-Transport-Security"],
);
check(
  "هدرهای امنیتی پایه همیشه تنظیم می‌شوند",
  disabledRes.headers["X-Content-Type-Options"] === "nosniff" &&
    disabledRes.headers["X-Frame-Options"] === "SAMEORIGIN",
);

// ===== ۸) کپچا =====
process.env.CAPTCHA_ENABLED = "true";
process.env.CAPTCHA_LENGTH = "5";
process.env.CAPTCHA_TTL_MINUTES = "5";

const captcha = require("./utils/captcha.js");
const challenge = captcha.createChallenge();

check(
  "کپچا: چالش ساخته می‌شود (id + تصویر SVG)",
  !!challenge.id && challenge.svg.startsWith("<svg"),
  `svg=${challenge.svg.length} بایت`,
);
check(
  "کپچا: طول کد مطابق تنظیمات است",
  challenge.code.length === 5,
  `len=${challenge.code.length}`,
);
check(
  "کپچا: پاسخ درست پذیرفته می‌شود",
  captcha.verifyChallenge(challenge.id, challenge.code).ok === true,
);
check(
  "کپچا: یک‌بارمصرف است (استفادهٔ دوم رد می‌شود)",
  captcha.verifyChallenge(challenge.id, challenge.code).ok === false,
);

const challenge2 = captcha.createChallenge();
check(
  "کپچا: پاسخ اشتباه رد می‌شود",
  captcha.verifyChallenge(challenge2.id, "ZZZZZ").ok === false,
);
check(
  "کپچا: پاسخ با حروف کوچک هم پذیرفته می‌شود",
  (() => {
    const item = captcha.createChallenge();
    return captcha.verifyChallenge(item.id, item.code.toLowerCase()).ok === true;
  })(),
);
check(
  "کپچا: id نامعتبر رد می‌شود",
  captcha.verifyChallenge("deadbeef", "ABCDE").ok === false,
);
check(
  "کپچا: پاسخ خالی رد می‌شود",
  captcha.verifyChallenge(captcha.createChallenge().id, "").ok === false,
);

// انقضا: با جلو بردن زمان، کد باید رد شود
const realNow = Date.now;
const expiring = captcha.createChallenge();
Date.now = () => realNow() + 6 * 60 * 1000; // ۶ دقیقه بعد
check(
  "کپچا: کد منقضی‌شده رد می‌شود",
  captcha.verifyChallenge(expiring.id, expiring.code).ok === false,
);
Date.now = realNow;

process.env.CAPTCHA_ENABLED = "false";
check("کپچا: با CAPTCHA_ENABLED=false غیرفعال می‌شود", captcha.isEnabled() === false);
process.env.CAPTCHA_ENABLED = "true";

// ===== ۱۰) ایمن‌سازی خروجی HTML (XSS) =====
const { pathToFileURL } = require("node:url");
const nodePath = require("node:path");
const { spawnSync } = require("node:child_process");

const stringUtils = await import(
  pathToFileURL(
    nodePath.join(
      import.meta.dirname,
      "..",
      "Frontend",
      "src",
      "core",
      "utils",
      "string.utils.js",
    ),
  ).href
);
const { escapeHtml, escapeJsAttr, sanitizeHtmlDocument } = stringUtils;

check(
  "escapeHtml: تگ HTML را بی‌اثر می‌کند",
  escapeHtml('<img src=x onerror="alert(1)">') ===
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
);
check("escapeHtml: کوتیشن تک هم escape می‌شود", escapeHtml("a'b") === "a&#39;b");
check(
  "escapeHtml: null/undefined → رشتهٔ خالی",
  escapeHtml(null) === "" && escapeHtml(undefined) === "",
);

const origJsValue = "O'Brien \"x\" </script>";
const jsAttr = escapeJsAttr(origJsValue);
check(
  "escapeJsAttr: داخل اتریبیوت onclick امن است (بدون کوتیشن/تگ خام)",
  !/["<>]/.test(jsAttr) && jsAttr.startsWith("&quot;"),
);
// شبیه‌سازی تجزیهٔ مرورگر: اتریبیوت HTML → رشتهٔ JS
const decodedJsAttr = jsAttr
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, "&");
let jsAttrValue = null;
let jsAttrValid = true;
try {
  jsAttrValue = new Function(`return (${decodedJsAttr});`)();
} catch {
  jsAttrValid = false;
}
check("escapeJsAttr: بعد از decode مرورگر، رشتهٔ JS معتبر است", jsAttrValid);
check(
  "escapeJsAttr: مقدار اصلی پس از decode مرورگر برمی‌گردد",
  jsAttrValue === origJsValue,
);

const evilDoc =
  '<!doctype html><html><body><h1><img src=x onerror="steal()"></h1>' +
  "<script>fetch('//evil')</script>" +
  "<script>window.onload = function() { window.print(); }</" +
  "script><a href=\"javascript:alert(1)\">x</a></body></html>";
const cleanDoc = sanitizeHtmlDocument(evilDoc);
check(
  "sanitizeHtmlDocument: اسکریپت مخرب حذف می‌شود",
  !cleanDoc.includes("fetch('//evil')"),
);
check(
  "sanitizeHtmlDocument: هندلر onerror حذف می‌شود",
  !/onerror/i.test(cleanDoc),
);
check(
  "sanitizeHtmlDocument: آدرس javascript: بی‌اثر می‌شود",
  !/javascript:/i.test(cleanDoc),
);
check(
  "sanitizeHtmlDocument: اسکریپت چاپ خودکار گزارش حفظ می‌شود",
  cleanDoc.includes("window.print()"),
);
check("sanitizeHtmlDocument: محتوای گزارش حفظ می‌شود", cleanDoc.includes("<h1>"));

// ===== ۱۱) محافظ‌های پروسه =====
const { installProcessGuards } = require("./utils/processGuards.js");
check(
  "processGuards: فقط یک‌بار نصب می‌شود (idempotent)",
  installProcessGuards() === true && installProcessGuards() === false,
);

const guardPath = require.resolve("./utils/processGuards.js");

const rejectionRun = spawnSync(
  process.execPath,
  [
    "-e",
    `const { installProcessGuards } = require(${JSON.stringify(guardPath)});
     installProcessGuards();
     Promise.reject(new Error("boom-rejection"));
     setTimeout(() => console.log("ALIVE"), 60);`,
  ],
  { encoding: "utf8" },
);
check(
  "processGuards: rejection مدیریت‌نشده لاگ می‌شود",
  /Unhandled Promise Rejection/.test(
    String(rejectionRun.stdout) + String(rejectionRun.stderr),
  ),
);
check(
  "processGuards: پس از rejection سرور زنده می‌ماند",
  rejectionRun.status === 0 && /ALIVE/.test(String(rejectionRun.stdout)),
);

const exceptionRun = spawnSync(
  process.execPath,
  [
    "-e",
    `const { installProcessGuards } = require(${JSON.stringify(guardPath)});
     installProcessGuards();
     setTimeout(() => { throw new Error("boom-exception"); }, 10);`,
  ],
  { encoding: "utf8" },
);
check(
  "processGuards: uncaughtException لاگ و خروج با کد ۱",
  exceptionRun.status === 1 &&
    /Uncaught Exception/.test(String(exceptionRun.stderr)),
);

// ===== ۷) جستجوی لیست مشتریان (utils/search.js) =====
// ✅ این ماژول علت اصلی «کار نکردن سرچ زنده» بود: پارامترهای
// search/searchColumn در بک‌اند نادیده گرفته می‌شدند.
const { Op } = require("sequelize");
const search = require("./utils/search.js");

check(
  "search: ارقام فارسی → لاتین",
  search.normalizeSearchText("۰۹۱۲۳۴۵۶۷۸۹") === "09123456789",
  search.normalizeSearchText("۰۹۱۲۳۴۵۶۷۸۹"),
);
check(
  "search: ارقام عربی → لاتین",
  search.normalizeSearchText("٠٩١٢") === "0912",
  search.normalizeSearchText("٠٩١٢"),
);
check(
  "search: ي/ك عربی → ی/ک فارسی",
  search.normalizeSearchText("يك") === "یک",
  search.normalizeSearchText("يك"),
);
check(
  "search: فاصله‌های تکراری یکی می‌شوند",
  search.normalizeSearchText("  علی   رضا ") === "علی رضا",
  search.normalizeSearchText("  علی   رضا "),
);
check(
  "search: عبارت خیلی طولانی بریده می‌شود",
  search.normalizeSearchText("x".repeat(200)).length ===
    search.MAX_TERM_LENGTH,
);
check(
  "search: escapeLike کاراکترهای wildcard را بی‌اثر می‌کند",
  search.escapeLike("50%_a\\b") === "50\\%\\_a\\\\b",
  search.escapeLike("50%_a\\b"),
);
check(
  "search: تاریخ شمسی ۱۴۰۳/۰۱/۰۱ → 2024-03-20",
  (() => {
    const g = search.jalaliToGregorian(1403, 1, 1);
    return g.gy === 2024 && g.gm === 3 && g.gd === 20;
  })(),
  JSON.stringify(search.jalaliToGregorian(1403, 1, 1)),
);
check(
  "search: بازهٔ روز شمسی درست ساخته می‌شود",
  (() => {
    const range = search.parseJalaliDayRange("۱۴۰۳/۰۱/۰۱");
    return (
      !!range &&
      range.start.toISOString().startsWith("2024-03-20T00:00:00") &&
      range.end.toISOString().startsWith("2024-03-21T00:00:00")
    );
  })(),
);
check(
  "search: بازهٔ روز میلادی (ISO) هم پذیرفته می‌شود",
  (() => {
    const range = search.parseIsoDayRange("2026-03-21");
    return (
      !!range && range.start.toISOString().startsWith("2026-03-21T00:00:00")
    );
  })(),
);
check(
  "search: عبارت خالی → بدون فیلتر (null)",
  search.buildCustomerSearchWhere("", "all") === null &&
    search.buildCustomerSearchWhere("   ", "2") === null,
);
check(
  "search: حالت «همه ستون‌ها» شرط OR می‌سازد",
  (() => {
    const w = search.buildCustomerSearchWhere("رضا", "all");
    return !!w && Object.getOwnPropertySymbols(w).length > 0;
  })(),
);
check(
  "search: ستون «وضعیت» فعال/غیرفعال را می‌فهمد",
  (() => {
    const on = search.buildCustomerSearchWhere("فعال", "11");
    const off = search.buildCustomerSearchWhere("غیرفعال", "11");
    return on?.active === true && off?.active === false;
  })(),
);
check(
  "search: ستون تاریخ، ورودی شمسی را به بازهٔ میلادی تبدیل می‌کند",
  (() => {
    const w = search.buildCustomerSearchWhere("۱۴۰۳/۰۱/۰۱", "10");
    const range = w?.created_at;
    return (
      !!range &&
      range[Op.gte]?.toISOString().startsWith("2024-03-20") &&
      range[Op.lt]?.toISOString().startsWith("2024-03-21")
    );
  })(),
);
check(
  "search: ستون تلفن، عدد فارسی را به لاتین تبدیل و پیدا می‌کند",
  (() => {
    const w = search.buildCustomerSearchWhere("۰۹۱۲", "4");
    const pattern = w?.mobile_number?.[Op.iLike];
    return pattern === "%0912%";
  })(),
);
check(
  "search: ستون تلفن با فاصله/خط تیره هم پیدا می‌کند (دو شرط)",
  (() => {
    const spaced = search.buildCustomerSearchWhere("0912 345", "4");
    const dashed = search.buildCustomerSearchWhere("0912-345", "5");
    return (
      (spaced?.[Op.or] || []).length >= 2 &&
      (dashed?.[Op.or] || []).length >= 2
    );
  })(),
);
check(
  "search: ورودی شامل % و _ به wildcard تبدیل نمی‌شود",
  (() => {
    const w = search.buildCustomerSearchWhere("100%", "1");
    const pattern = w?.collection_name?.[Op.iLike];
    return typeof pattern === "string" && pattern.includes("\\%") && pattern !== "%100%%";
  })(),
);
check(
  "search: ستون نامعتبر → مثل «همه ستون‌ها» فیلتر می‌کند",
  (() => {
    const w = search.buildCustomerSearchWhere("رضا", "999");
    return !!w && Object.getOwnPropertySymbols(w).length > 0;
  })(),
);

check(
  "search: نگاشت ستون ۰ = شماره مشتری (customer_code)",
  search.CUSTOMER_SEARCH_COLUMNS["0"].field === "customer_code",
  search.CUSTOMER_SEARCH_COLUMNS["0"].field,
);
check(
  "search: جستجوی «شماره مشتری» شرط عددی روی customer_code می‌سازد",
  (() => {
    const w = search.buildCustomerSearchWhere("1001", "0");
    return !!w && Object.getOwnPropertySymbols(w).length > 0 && !!w[Op.and];
  })(),
);
check(
  "search: شمارهٔ مشتری در حالت «همه ستون‌ها» هم جستجو می‌شود",
  (() => {
    const w = search.buildCustomerSearchWhere("1002", "all");
    return !!w && (w[Op.or] || []).length > 0;
  })(),
);

// ===== ۱۲) حریم خصوصی لاگ‌ها (PII) =====
// ✅ بود: کل req.body در ثبت مشتری لاگ می‌شد (موبایل/کد ملی/ایمیل در لاگ پروداکشن)
const fsMod = require("node:fs");
const customerControllerSrc = fsMod.readFileSync(
  nodePath.join(import.meta.dirname, "controllers", "customerRegistrationController.js"),
  "utf8",
);
check(
  "لاگ PII: کل req.body در ثبت مشتری لاگ نمی‌شود",
  !/console\.(log|info|warn|error)\(\s*[^)]*req\.body\s*\)/.test(
    customerControllerSrc,
  ),
);
check(
  "لاگ PII: لاگ ثبت مشتری فقط در محیط غیر production است",
  customerControllerSrc.includes('process.env.NODE_ENV !== "production"'),
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
