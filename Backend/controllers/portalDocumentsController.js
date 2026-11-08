// ============================================================
// controllers/portalDocumentsController.js
// «مدارک من» — آپلود/حذف نرم/دانلود مدارک مشتری (موج ۱۳.۱۰)
// ------------------------------------------------------------
// 🔒 قواعد تغییرناپذیر (هم‌راستا با بقیهٔ پورتال):
//  ۱) `customer_id` **فقط** از `req.customerScopeId` می‌آید (توکن).
//     هیچ مسیری شناسهٔ مشتری را از بدنه/کوئری نمی‌خواند.
//  ۲) هر کوئری با همان `customer_id` همراه است؛ ردیف غیرخودی ⇒ ۴۰۴
//     (وجود ردیف مشتری دیگر لو نمی‌رود).
//  ۳) فایل در پوشهٔ خصوصی است و فقط با توکن از همین کنترلر بیرون
//     می‌آید؛ مسیر ذخیره‌شده هرگز در خروجی API نمی‌آید.
//  ۴) حذف **نرم** است: `deleted_by` نوشته و سپس `destroy()` می‌شود
//     (paranoid) ⇒ فایل روی دیسک می‌ماند و هیچ UNLINK ای رخ نمی‌دهد.
//  ۵) سهمیه (۱۰ مدرک / ۲۵MB) پیش از نوشتن فایل سنجیده می‌شود تا
//     هیچ فایل یتیمی ساخته نشود.
// ============================================================
"use strict";

const fs = require("fs");
const path = require("path");
const PortalDocument = require("../models/PortalDocument");
const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
const { fixUnicodeName } = require("../middleware/upload");
const {
  DOCUMENT_KINDS,
  DOCUMENT_MESSAGES,
  DOCUMENT_MAX_FILE_BYTES,
  DOCUMENT_MAX_COUNT,
  DOCUMENT_MAX_TOTAL_BYTES,
  documentView,
  mimeDecision,
  normalizeKind,
  quotaDecision,
  resolveStoredPath,
  sanitizeTitle,
} = require("../services/portalDocumentRules");

// شناسهٔ پروندهٔ همین کاربر — فقط از توکن
const scopeIdOf = (req) => {
  const id = Number(req.customerScopeId || req.portalScopeId || 0);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// ============================================
// سهمیهٔ فعلی پرونده (پارانوید ⇒ مدارک حذف‌شده شمرده نمی‌شوند)
// ============================================
const quotaOf = async (customerId) => {
  const where = { customer_id: customerId };
  const [count, totalBytes] = await Promise.all([
    PortalDocument.count({ where }),
    PortalDocument.sum("file_size", { where }),
  ]);
  return { count: Number(count) || 0, totalBytes: Number(totalBytes) || 0 };
};

// متای مشترک فهرست/آپلود برای UI (سقف‌ها یک منبع: سرویس قواعد)
const quotaMeta = ({ count = 0, totalBytes = 0 } = {}) => ({
  count: Number(count) || 0,
  max_count: DOCUMENT_MAX_COUNT,
  total_bytes: Number(totalBytes) || 0,
  max_total_bytes: DOCUMENT_MAX_TOTAL_BYTES,
  max_file_bytes: DOCUMENT_MAX_FILE_BYTES,
  kinds: DOCUMENT_KINDS.map((item) => ({ key: item.key, label: item.label })),
});

// ============================================
// میان‌افزار سهمیه — **پیش از** multer اجرا می‌شود
// ------------------------------------------------------------
// اگر ظرفیت پر باشد، حتی یک بایت از فایل روی دیسک نوشته نمی‌شود.
// ============================================
const ensureDocumentQuota = async (req, res, next) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, DOCUMENT_MESSAGES.unlinked, 403);

    const decision = quotaDecision(await quotaOf(customerId));
    if (!decision.ok) {
      return errorResponse(res, DOCUMENT_MESSAGES[decision.reason], 400);
    }

    req.portalDocumentQuota = decision;
    return next();
  } catch (error) {
    console.error("❌ خطا در بررسی سهمیهٔ مدارک پورتال:", error.message);
    return errorResponse(res, "خطا در بررسی ظرفیت مدارک", 500);
  }
};

// ============================================
// GET /api/portal/documents
// ============================================
const listMyDocuments = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, DOCUMENT_MESSAGES.unlinked, 403);

    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    // 🔒 attributes صریح: file_path هرگز به کلاینت نمی‌رود
    const { rows, count } = await PortalDocument.findAndCountAll({
      where: { customer_id: customerId },
      attributes: [
        "id",
        "title",
        "kind",
        "file_name",
        "file_size",
        "mime_type",
        "created_at",
      ],
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    const meta = quotaMeta(await quotaOf(customerId));
    const pages = Math.max(1, Math.ceil((Number(count) || 0) / limit));

    return successResponse(
      res,
      {
        items: rows.map((row) => documentView(row)),
        pagination: {
          page,
          limit,
          total: Number(count) || 0,
          pages,
        },
        meta,
      },
      "فهرست مدارک شما",
    );
  } catch (error) {
    console.error("❌ خطا در فهرست مدارک پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت فهرست مدارک", 500);
  }
};

// ============================================
// POST /api/portal/documents   (multer: فیلد file)
// ------------------------------------------------------------
// ⚠️ ترتیب در مسیر: سهمیه ← multer ← همین کنترلر.
//    اگر فایلی نرسد، هیچ ردیفی ساخته نمی‌شود.
// ============================================
const uploadMyDocument = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, DOCUMENT_MESSAGES.unlinked, 403);

    const file = req.file;
    if (!file) return errorResponse(res, DOCUMENT_MESSAGES.no_file, 400);

    // دوباره‌سنجی نوع فایل (دفاع لایه‌دوم؛ فیلتر multer هم همین را دارد)
    const decision = mimeDecision(file.mimetype);
    if (!decision.ok) return errorResponse(res, DOCUMENT_MESSAGES.bad_mime, 400);

    const relativePath =
      req.portalDocumentRelativePath || path.basename(file.path || "");

    // نام نمایشی: نام اصلی مشتری، اصلاح encoding فارسی، بی‌مسیر و کوتاه
    const displayName =
      path
        .basename(String(fixUnicodeName(file.originalname) || "document"))
        .replace(/[<>]/g, "")
        .slice(0, 255) || "document";

    const row = await PortalDocument.create({
      customer_id: customerId, // 🔒 همیشه از توکن
      uploaded_by: req.user && req.user.id ? req.user.id : null,
      title: sanitizeTitle(req.body && req.body.title),
      kind: normalizeKind(req.body && req.body.kind),
      file_name: displayName,
      file_path: relativePath,
      file_size: Number(file.size) || 0,
      mime_type: String(file.mimetype || "").toLowerCase(),
    });

    console.info(
      `📄 [portal] مدرک ${row.id} برای پرونده ${customerId} ثبت شد (${file.size || 0} بایت)`,
    );

    return successResponse(
      res,
      {
        document: documentView(row),
        meta: quotaMeta(await quotaOf(customerId)),
      },
      "مدرک با موفقیت ثبت شد",
      201,
    );
  } catch (error) {
    console.error("❌ خطا در ثبت مدرک پورتال:", error.message);
    return errorResponse(res, "خطا در ثبت مدرک", 500);
  }
};

// ============================================
// DELETE /api/portal/documents/:id      ← حذف نرم
// ------------------------------------------------------------
// 🔒 چرا حذف قطعی نیست؟
//   مدرک هویتی/جواز سند است؛ اگر مشتری اشتباهی حذف کند یا اختلافی
//   پیش بیاید، کارشناس باید بتواند اصل فایل را ببیند. پس فقط ردیف
//   از دید مشتری پنهان می‌شود (paranoid) و «چه کسی حذف کرد» ثبت
//   می‌شود. ❌ هیچ فایلی از دیسک پاک نمی‌شود (بدون unlink).
// ============================================
const deleteMyDocument = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, DOCUMENT_MESSAGES.unlinked, 403);

    // ردیف مالکیت‌سنجی‌شده از requireOwnedRow (۴۰۴ برای غیرخودی)
    const row = req.ownedRow;
    if (!row) return errorResponse(res, DOCUMENT_MESSAGES.not_found, 404);

    await row.update({ deleted_by: req.user && req.user.id ? req.user.id : null });
    await row.destroy(); // ← حذف نرم: deleted_at پر می‌شود، فایل می‌ماند

    console.info(
      `🗂️ [portal] مدرک ${row.id} پرونده ${customerId} به‌صورت نرم حذف شد (فایل نگه داشته شد)`,
    );

    return successResponse(
      res,
      { id: Number(row.id), deleted: true },
      "مدرک از فهرست شما حذف شد (نسخهٔ بایگانی برای بازبینی کارشناس نگه داشته می‌شود)",
    );
  } catch (error) {
    console.error("❌ خطا در حذف مدرک پورتال:", error.message);
    return errorResponse(res, "خطا در حذف مدرک", 500);
  }
};

// ============================================
// GET /api/portal/documents/:id/file
// ------------------------------------------------------------
// 🔒 سه سد: مالکیت ردیف (requireOwnedRow) ← مرزِ مسیر ← وجود فایل.
//    پاسخ همیشه با Content-Disposition: attachment می‌آید (res.download)
//    تا فایل در مرورگر «اجرا/نمایش درون‌خطی» نشود.
// ============================================
const downloadMyDocument = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, DOCUMENT_MESSAGES.unlinked, 403);

    const row = req.ownedRow;
    if (!row) return errorResponse(res, DOCUMENT_MESSAGES.not_found, 404);

    const resolved = resolveStoredPath(row.file_path);
    if (!resolved) {
      console.warn(
        `⚠️ [portal] مسیر مدرک خارج از پوشهٔ خصوصی بود (id=${row.id})`,
      );
      return errorResponse(res, DOCUMENT_MESSAGES.path_denied, 403);
    }

    if (!fs.existsSync(resolved)) {
      return errorResponse(res, DOCUMENT_MESSAGES.file_missing, 404);
    }

    console.info(
      `📎 [portal] دانلود مدرک ${row.id} برای پرونده ${customerId}`,
    );

    const downloadName =
      path.basename(String(row.file_name || "").trim()) ||
      path.basename(resolved);

    return res.download(resolved, downloadName);
  } catch (error) {
    console.error("❌ خطا در دانلود مدرک پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت فایل مدرک", 500);
  }
};

module.exports = {
  ensureDocumentQuota,
  listMyDocuments,
  uploadMyDocument,
  deleteMyDocument,
  downloadMyDocument,
};
