// ============================================================
// services/portalDashboardScope.js
// مرزِ «داشبورد من» در پورتال مشتری — موج ۱۳.۱۰.۱
// ------------------------------------------------------------
//  چرا فایل جدا و بدون وابستگی؟
//   • همان الگوی portalDocumentRules/portalOwnershipRules: منطق خالص
//     می‌ماند تا هم کنترلر از آن استفاده کند، هم گارد تست بتواند آن را
//     **اجرا** کند (بدون دیتابیس و بدون HTTP).
//
// 🔒 مسئله‌ای که این ماژول حل می‌کند (باگ ۵۰۰ موج ۱۳.۸):
//   Express 5، `req.query` را فقط‌خواندنی (getter-only) تعریف می‌کند
//   (node_modules/express/lib/request.js) و هر بار آن را از req.url
//   از نو می‌سازد. پس:
//       req.query = { ... }        ❌ TypeError: Cannot set property query
//   و کنترلر پورتال با همین انتساب، به‌جای نمودار، ۵۰۰ برمی‌گرداند.
//   راه‌حل: به req دست نمی‌زنیم؛ یک «درخواست پروکسی» می‌سازیم که همه
//   چیز را از req اصلی به ارث می‌برد و فقط query خودش را دارد
//   ⇒ منطق سنگین dashboardController بدون هیچ تغییری واگذار می‌شود.
//
// 🔒 فهرست سفید کوئری (تنها چیزی که از کلاینت عبور می‌کند):
//   flockId · flockGroupId · scope="all"
//   بقیهٔ پارامترها (از جمله هر customer_id/customerId کلاینت) دور
//   ریخته می‌شوند و `customerId` **همیشه** از اسکوپ توکن تحمیل می‌شود.
// ============================================================
"use strict";

// شناسهٔ گله/جوجه‌ریزی: فقط عدد صحیح مثبت و کوتاه
const ROW_ID_PATTERN = /^\d{1,9}$/;

const ALLOWED_QUERY_KEYS = ["flockId", "flockGroupId"];

// تنها اسکوپ مجاز از سمت کلاینت: «همهٔ گله‌های من» (شامل دوره‌های بسته)
const ALLOWED_SCOPES = ["all"];

// شناسهٔ پروندهٔ مشتری که middleware/portalOwnership تعیین کرده است
const scopeIdOf = (req) => {
  const raw =
    (req && (req.portalScopeId ?? req.customerScopeId ?? req.customerScope?.customerId)) ||
    null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// ساخت کوئری اجباری: سفیدشدهٔ کلاینت + customerId تحمیلی
const forcedQuery = (req) => {
  const source = (req && req.query) || {};
  const query = {};

  ALLOWED_QUERY_KEYS.forEach((key) => {
    const value = source[key];
    // فقط رشته/عدد ساده؛ آرایه و آبجکت (`?flockId[]=`) دور ریخته می‌شوند
    if (typeof value !== "string" && typeof value !== "number") return;
    const raw = String(value).trim();
    if (!ROW_ID_PATTERN.test(raw)) return;
    query[key] = raw;
  });

  const scope = String((source && source.scope) ?? "")
    .trim()
    .toLowerCase();
  if (ALLOWED_SCOPES.includes(scope)) query.scope = scope;

  const customerId = scopeIdOf(req);
  if (customerId) query.customerId = String(customerId);

  return query;
};

// درخواست پروکسی: req اصلی دست‌نخورده می‌ماند (بدون تغییر در Express 5)
const scopedRequest = (req) => {
  const proxy = Object.create(req || null);
  Object.defineProperty(proxy, "query", {
    value: forcedQuery(req),
    writable: true,
    enumerable: true,
    configurable: true,
  });
  return proxy;
};

module.exports = {
  ROW_ID_PATTERN,
  ALLOWED_QUERY_KEYS,
  ALLOWED_SCOPES,
  scopeIdOf,
  forcedQuery,
  scopedRequest,
};
