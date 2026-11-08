// ============================================================
// services/portalDocumentRules.js
// قواعد خالص «مدارک من» (پورتال مشتری) — موج ۱۳.۱۰
// ------------------------------------------------------------
//  چرا فایل جدا و بدون وابستگی؟
//   • همان الگوی portalProfileRules/portalOwnershipRules: منطق در یک
//     ماژول خالص می‌ماند تا هم کنترلر از آن استفاده کند، هم گارد تست
//     بتواند مقادیر را مستقیماً بخواند (بدون دیتابیس/HTTP).
//   • هیچ `fs` اینجا لازم نیست: رزرو مسیر و نوشتن فایل کار
//     middleware/upload.js است و **حذف فایل در کل موج وجود ندارد**
//     (حذف نرم = فقط ردیف؛ فایل برای ممیزی می‌ماند).
//
// 🔒 سقف‌ها (منبع واحد حقیقت برای کلاینت و سرور):
//   • هر فایل: ۵ مگابایت
//   • هر پرونده: ۱۰ مدرک و ۲۵ مگابایت مجموع
//   • فقط jpeg/png/webp/pdf (نه zip، نه اجرایی، نه ویدیو)
// ============================================================
"use strict";

const path = require("path");

// ===== نوع‌های مدرک (کلید انگلیسی = آنچه در DB می‌نشیند) =====
const DOCUMENT_KINDS = [
  { key: "id_card", label: "کارت ملی / مدارک هویتی" },
  { key: "license", label: "جواز / پروانه بهره‌برداری" },
  { key: "invoice", label: "فاکتور / مدارک مالی" },
  { key: "other", label: "سایر مدارک" },
];

const DOCUMENT_KIND_KEYS = DOCUMENT_KINDS.map((item) => item.key);
const DEFAULT_DOCUMENT_KIND = "other";
const DEFAULT_DOCUMENT_TITLE = "مدرک بدون عنوان";
const MAX_TITLE_LENGTH = 120;

// ===== سقف‌ها =====
const DOCUMENT_MAX_FILE_BYTES = 5 * 1024 * 1024; // ۵MB
const DOCUMENT_MAX_COUNT = 10; // ۱۰ مدرک در هر پرونده
const DOCUMENT_MAX_TOTAL_BYTES = 25 * 1024 * 1024; // ۲۵MB مجموع

// ===== فهرست سفید نوع فایل (mime ⇒ پسوند روی دیسک) =====
// ⚠️ پسوند از همین نگاشت ساخته می‌شود، نه از نام فایل کاربر
//    (نام کاربر می‌تواند `.php`/`.svg`/مسیر باشد).
const DOCUMENT_MIME_EXT = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

const DOCUMENT_ALLOWED_MIME = Object.keys(DOCUMENT_MIME_EXT);

// پیشوند نام فایل روی دیسک: doc_<timestamp>_<random><ext>
const DOCUMENT_FILE_PREFIX = "doc";

// پوشهٔ خصوصی (زیر Backend) — هرگز زیر uploads/ نمی‌رود
const DOCUMENT_STORAGE_DIRNAME = "portal_documents";
const PRIVATE_DIRNAME = "private";

// ===== پیام‌ها (فارسی، برای نمایش مستقیم به مشتری) =====
const DOCUMENT_MESSAGES = {
  no_file: "فایلی برای آپلود انتخاب نشده است",
  bad_mime: "فقط تصویر (JPG/PNG/WEBP) یا PDF مجاز است",
  too_large: "حجم فایل بیشتر از ۵ مگابایت است",
  too_many: "حداکثر ۱۰ مدرک برای هر پرونده قابل ثبت است",
  quota_full:
    "ظرفیت مدارک پرونده تکمیل شده است (۲۵ مگابایت). برای ثبت مدرک تازه، ابتدا یکی از مدارک را حذف کنید.",
  not_found: "مدرک موردنظر یافت نشد",
  bad_id: "شناسهٔ مدرک نامعتبر است",
  path_denied: "دسترسی به فایل این مدرک مجاز نیست",
  file_missing: "فایل این مدرک در سرور موجود نیست",
  unlinked: "حساب شما به پروندهٔ مشتری متصل نیست",
};

// ساخت مسیر ریشهٔ پوشهٔ خصوصی — مستقل از cwd (مثل pm2/ویندوز/لینوکس)
const documentStorageRoot = () =>
  path.join(__dirname, "..", PRIVATE_DIRNAME, DOCUMENT_STORAGE_DIRNAME);

// پوشهٔ هر پرونده: customer_<scopeId>
const documentCustomerDir = (scopeId) =>
  path.join(documentStorageRoot(), `customer_${Number(scopeId)}`);

// ============================================
// ۱) عنوان: پاک‌سازی و پیش‌فرض
// ------------------------------------------------------------
// • حذف کاراکترهای کنترلی و `<>` (بن‌بست XSS در صورت رندر نادرست)
// • جمع‌کردن فاصله‌های تکراری و بریدن به سقف ۱۲۰
// • خالی ⇒ عنوان پیش‌فرض (نه خطا: مشتری نباید به‌خاطر یک برچسب
//   کل آپلود را از دست بدهد)
// ============================================
const sanitizeTitle = (raw) => {
  const clean = String(raw === null || raw === undefined ? "" : raw)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return DEFAULT_DOCUMENT_TITLE;
  return clean.slice(0, MAX_TITLE_LENGTH);
};

// ============================================
// ۲) نوع مدرک: نامعتبر ⇒ other (fail-safe، نه خطا)
// ============================================
const normalizeKind = (raw) => {
  const key = String(raw === null || raw === undefined ? "" : raw)
    .trim()
    .toLowerCase();
  return DOCUMENT_KIND_KEYS.includes(key) ? key : DEFAULT_DOCUMENT_KIND;
};

const kindLabel = (key) => {
  const found = DOCUMENT_KINDS.find((item) => item.key === key);
  return found ? found.label : DEFAULT_DOCUMENT_KIND;
};

// ============================================
// ۳) بررسی نوع فایل
// ============================================
const mimeDecision = (mime) => {
  const value = String(mime || "")
    .trim()
    .toLowerCase();
  const ext = DOCUMENT_MIME_EXT[value];
  if (!ext) return { ok: false, reason: "bad_mime", ext: "" };
  return { ok: true, reason: "ok", ext };
};

// ============================================
// ۴) سهمیه — پیش از نوشتن فایل سنجیده می‌شود
// ------------------------------------------------------------
// چرا «رزرو حداکثر حجم فایل»؟
//   سهمیه باید **پیش** از multer سنجیده شود تا فایلی که رد می‌شود
//   اصلاً روی دیسک نوشته نشود (هیچ فایل یتیمی هم باقی نمی‌ماند و
//   هیچ unlink ای لازم نیست). پس فرض می‌کنیم فایل تازه حداکثر
//   ۵ مگابایت است؛ اگر با همین فرض جا نبود، پاسخ «ظرفیت پر» است.
//   نتیجه: حجم مجموع هرگز از ۲۵ مگابایت رد نمی‌شود.
// ============================================
const quotaDecision = ({ count = 0, totalBytes = 0 } = {}) => {
  const safeCount = Number(count) || 0;
  const safeTotal = Number(totalBytes) || 0;

  if (safeCount >= DOCUMENT_MAX_COUNT) {
    return {
      ok: false,
      reason: "too_many",
      count: safeCount,
      totalBytes: safeTotal,
    };
  }
  if (safeTotal + DOCUMENT_MAX_FILE_BYTES > DOCUMENT_MAX_TOTAL_BYTES) {
    return {
      ok: false,
      reason: "quota_full",
      count: safeCount,
      totalBytes: safeTotal,
    };
  }
  return { ok: true, reason: "ok", count: safeCount, totalBytes: safeTotal };
};

// ============================================
// ۵) حجم خوانا برای UI
// ============================================
const formatBytes = (bytes) => {
  const value = Number(bytes) || 0;
  if (value <= 0) return "۰";
  const kb = value / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} کیلوبایت`;
  return `${(kb / 1024).toFixed(1)} مگابایت`;
};

// ============================================
// ۶) خروجی امن یک مدرک برای کلاینت
// ------------------------------------------------------------
// 🔒 عمداً غایب: file_path (مسیر دیسک)، customer_id (شناسهٔ پرونده)
// ============================================
const documentView = (row) => {
  if (!row) return null;
  const value =
    typeof row.get === "function" ? row.get({ plain: true }) : { ...row };

  const createdAt = value.created_at
    ? new Date(value.created_at).toISOString()
    : null;

  return {
    id: Number(value.id),
    title: value.title || DEFAULT_DOCUMENT_TITLE,
    kind: value.kind || DEFAULT_DOCUMENT_KIND,
    kind_label: kindLabel(value.kind),
    file_name: value.file_name || "",
    file_size: Number(value.file_size) || 0,
    file_size_label: formatBytes(value.file_size),
    mime_type: value.mime_type || "",
    is_image: String(value.mime_type || "").startsWith("image/"),
    created_at: createdAt,
  };
};

// ============================================
// ۷) شناسهٔ ردیف (هم‌قاعده با portalController)
// ============================================
const ROW_ID_PATTERN = /^\d{1,9}$/;

const parseRowId = (value) => {
  const raw = String(value === null || value === undefined ? "" : value).trim();
  if (!ROW_ID_PATTERN.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

// ============================================
// ۸) مرزِ مسیر — ضد path traversal
// ------------------------------------------------------------
// مسیر ذخیره‌شده در DB نسبی است (مثل customer_12/doc_1_5.pdf).
// اگر روزی ردیفی مسیر مطلق یا `../` داشت، اینجا رد می‌شود و فایل
// هرگز خوانده نمی‌شود (پاسخ ۴۰۳، بدون لو دادن مسیر).
// ============================================
const resolveStoredPath = (relativePath) => {
  const raw = String(relativePath || "").trim();
  if (!raw) return null;
  if (path.isAbsolute(raw)) return null;
  if (raw.includes("\0") || raw.includes("..")) return null;

  const root = documentStorageRoot();
  const resolved = path.resolve(root, raw);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!resolved.startsWith(rootWithSep)) return null;
  return resolved;
};

module.exports = {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_KEYS,
  DEFAULT_DOCUMENT_KIND,
  DEFAULT_DOCUMENT_TITLE,
  MAX_TITLE_LENGTH,
  DOCUMENT_MAX_FILE_BYTES,
  DOCUMENT_MAX_COUNT,
  DOCUMENT_MAX_TOTAL_BYTES,
  DOCUMENT_MIME_EXT,
  DOCUMENT_ALLOWED_MIME,
  DOCUMENT_FILE_PREFIX,
  DOCUMENT_STORAGE_DIRNAME,
  DOCUMENT_MESSAGES,
  documentStorageRoot,
  documentCustomerDir,
  sanitizeTitle,
  normalizeKind,
  kindLabel,
  mimeDecision,
  quotaDecision,
  formatBytes,
  documentView,
  parseRowId,
  resolveStoredPath,
};
