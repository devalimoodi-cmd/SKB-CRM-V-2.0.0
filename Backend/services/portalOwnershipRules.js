// ============================================================
// services/portalOwnershipRules.js
// «مالکیت ردیف» برای پورتال مشتری — فاز ۱۳.۸ (منطق خالص)
// ------------------------------------------------------------
//  چرا جدا از middleware؟
//   • تصمیم «این ردیف مال همین مشتری است؟» باید بدون دیتابیس و
//     بدون Express تست شود (هم‌الگو با customerScopeRules).
//   • هر پاسخ رد، یک «کد» و یک «دلیل» دارد تا فرانت/لاگ یکسان بفهمند.
//
// 🔒 قواعد:
//  ۱) تنها منبع اسکوپ = req.customerScopeId (ساخته‌شده از توکن).
//  ۲) شناسهٔ ردیف فقط از پارامتر/کوئریِ همان مسیر خوانده می‌شود و
//     همیشه *همراه* با customer_id در همان WHERE می‌آید.
//  ۳) ردیف غیرخودی → ۴۰۴ (نه ۴۰۳) تا وجود آن ردیف لو نرود.
// ============================================================
"use strict";

const OWNERSHIP_CODES = {
  unauthenticated: "PORTAL_SCOPE_UNAUTHENTICATED",
  missing_scope: "PORTAL_SCOPE_MISSING",
  not_owner: "PORTAL_SCOPE_DENIED",
  bad_id: "PORTAL_ROW_ID_INVALID",
  row_missing: "PORTAL_ROW_NOT_FOUND",
};

const OWNERSHIP_MESSAGES = {
  unauthenticated: "احراز هویت نشده است",
  missing_scope:
    "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
  not_owner: "این ردیف در پروندهٔ شما یافت نشد",
  bad_id: "شناسهٔ ارسالی نامعتبر است",
  row_missing: "این ردیف یافت نشد",
};

// شناسهٔ ردیف: فقط عدد صحیح مثبت و کوتاه (ضد سرریز/تزریق)
const ROW_ID_PATTERN = /^\d{1,9}$/;

const parseRowId = (value) => {
  const raw = String(value === null || value === undefined ? "" : value).trim();
  if (!ROW_ID_PATTERN.test(raw)) return null;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : null;
};

// شناسهٔ اسکوپ (customer_id) — هر چیز غیرعددی = null
const normalizeScopeId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// آیا این مقدار «خالی» است؟ (کوئری اختیاری که فرستاده نشده)
const isAbsent = (value) =>
  value === null || value === undefined || String(value).trim() === "";

// تصمیم مالکیت روی ردیفِ خوانده‌شده
// خروجی: { ok, reason }
const ownershipDecision = ({ row, scopeId, field = "customer_id" } = {}) => {
  const scope = normalizeScopeId(scopeId);
  if (!scope) return { ok: false, reason: "missing_scope" };
  if (!row) return { ok: false, reason: "row_missing" };

  const plain = typeof row.get === "function" ? row.get({ plain: true }) : row;
  const owner = normalizeScopeId(plain?.[field]);
  if (!owner || owner !== scope) return { ok: false, reason: "not_owner" };

  return { ok: true, reason: null };
};

// تصمیم «کوئری مرجع» (flockId / flockGroupId …): غایب = مجاز
const referenceDecision = ({ value, scopeId } = {}) => {
  if (isAbsent(value)) return { ok: true, reason: null, id: null };
  const id = parseRowId(value);
  if (!id) return { ok: false, reason: "bad_id", id: null };
  if (!normalizeScopeId(scopeId)) return { ok: false, reason: "missing_scope", id };
  return { ok: true, reason: null, id };
};

const ownershipPayload = (reason) => ({
  success: false,
  code: OWNERSHIP_CODES[reason] || OWNERSHIP_CODES.not_owner,
  reason: reason || "not_owner",
  message: OWNERSHIP_MESSAGES[reason] || OWNERSHIP_MESSAGES.not_owner,
  timestamp: new Date().toISOString(),
});

// یک خط لاگ کوتاه و بی‌دادهٔ حساس
const ownershipAuditLine = ({ userId, role, reason, method, url, rowId } = {}) =>
  `🚫 [portal:ownership] ${method || "-"} ${url || "-"} — کاربر ${
    userId ?? "-"
  } (${role ?? "-"}) دلیل=${reason || "-"} ردیف=${rowId ?? "-"}`;

// کد وضعیت HTTP برای هر دلیل (۴۰۴ برای «مال من نیست»)
const ownershipStatus = (reason) => {
  if (reason === "unauthenticated") return 401;
  if (reason === "missing_scope") return 403;
  if (reason === "bad_id") return 400;
  return 404;
};

module.exports = {
  OWNERSHIP_CODES,
  OWNERSHIP_MESSAGES,
  ROW_ID_PATTERN,
  parseRowId,
  normalizeScopeId,
  isAbsent,
  ownershipDecision,
  referenceDecision,
  ownershipPayload,
  ownershipAuditLine,
  ownershipStatus,
};
