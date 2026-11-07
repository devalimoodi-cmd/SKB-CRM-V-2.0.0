// ============================================================
// controllers/registrationController.js
// «ثبت‌نام عمومی مشتری» + «صف تأیید مدیر» — فاز ۱۳.۶
// ------------------------------------------------------------
// نقش این کنترلر فقط «ترجمه» است:
//   • قواعد خالص  → services/registrationRules.js
//   • دسترسی داده → services/registrationService.js
//   • این فایل: پرچم تنظیمات، کپچا، مجوز اختصاصی، نگاشت خطا به HTTP
// ------------------------------------------------------------
// 🔒 نکات امنیتی:
//   • POST /api/registrations عمومی است ولی: rate-limit + کپچا + پرچم
//     registration_enabled + فیلدهای سفید. توکن صادر نمی‌شود.
//   • تأیید **دو** مجوز می‌خواهد: users.registrations.review (روت) و
//     users.customer.link (اینجا، چون پروندهٔ مشتری الزامی است).
//   • هیچ پاسخی password_hash یا ip/user_agent را برنمی‌گرداند.
// ============================================================
"use strict";

const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
const { verifyChallenge, isEnabled: isCaptchaEnabled } = require("../utils/captcha");
const { userHasPermission } = require("../middleware/permissions");
const settingsController = require("./settingsController");
const rules = require("../services/registrationRules");
const service = require("../services/registrationService");

const REGISTRATION_CLOSED_MESSAGE =
  "ثبت‌نام عمومی در حال حاضر بسته است. برای دریافت حساب با پشتیبانی تماس بگیرید.";

// ============================================
// ترجمهٔ کد خطای سرویس به HTTP
// ============================================
const STATUS_BY_CODE = {
  NOT_FOUND: 404,
  ALREADY_REVIEWED: 409,
  CUSTOMER_LINK_TAKEN: 409,
  INVALID_CUSTOMER: 400,
  CUSTOMER_NOT_FOUND: 400,
  INVALID_REASON: 400,
  INVALID_STATE: 400,
  DUPLICATE_EMAIL: 400,
  DUPLICATE_USERNAME: 400,
  DUPLICATE_MOBILE_NUMBER: 400,
  DUPLICATE: 400,
  // پروندهٔ مشتری تازه (موج ۱۳.۷)
  INVALID_MODE: 400,
  INVALID_NEW_CUSTOMER: 400,
  CUSTOMER_TYPE_NOT_FOUND: 400,
  CUSTOMER_TYPE_INACTIVE: 400,
  CUSTOMER_INVALID: 400,
  CUSTOMER_MOBILE_TAKEN: 409,
  CUSTOMER_EMAIL_TAKEN: 409,
};

const sendServiceError = (res, result) => {
  const status = STATUS_BY_CODE[result.code] || 400;
  return errorResponse(res, result.message, status, result.errors);
};

// ============================================
// GET /api/registrations/config  (عمومی)
// ------------------------------------------------------------
// صفحهٔ /register پیش از هر کاری می‌پرسد: «ثبت‌نام باز است؟ کپچا لازم است؟»
// ⇒ یک منبع حقیقت برای فرانت و سرور؛ هیچ دادهٔ حساسی ندارد.
// ============================================
const getPublicConfig = async (req, res) => {
  try {
    const flag = await settingsController.readSetting("registration_enabled");
    return successResponse(
      res,
      {
        enabled: rules.isRegistrationEnabled(flag),
        captcha_enabled: isCaptchaEnabled(),
        min_password_length: rules.MIN_PASSWORD_LENGTH,
      },
      "پیکربندی ثبت‌نام دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در خواندن پیکربندی ثبت‌نام:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ============================================
// POST /api/registrations  (عمومی)
// ============================================
const publicRegister = async (req, res) => {
  try {
    // ۱) پرچم سراسری — بسته‌بودن با پیام روشن (نه ۴۰۴ گمراه‌کننده)
    const flag = await settingsController.readSetting("registration_enabled");
    if (!rules.isRegistrationEnabled(flag)) {
      return errorResponse(res, REGISTRATION_CLOSED_MESSAGE, 403);
    }

    // ۲) کپچا (اگر فعال باشد) — پیش از هر خواندن از دیتابیس
    if (isCaptchaEnabled()) {
      const captchaId = req.body?.captcha_id ?? req.body?.captchaId;
      const captchaAnswer = req.body?.captcha_answer ?? req.body?.captchaAnswer;
      const result = verifyChallenge(captchaId, captchaAnswer);
      if (!result.ok) {
        const message =
          result.reason === "expired"
            ? "کد امنیتی منقضی شده است؛ تصویر تازه بگیرید"
            : "کد امنیتی درست نیست";
        return errorResponse(res, message, 400);
      }
    }

    // ۳) فیلدهای سفید + اعتبارسنجی
    const validation = rules.validateRegistration(req.body || {});
    if (!validation.ok) {
      return errorResponse(res, "اطلاعات فرم کامل یا معتبر نیست", 400, validation.errors);
    }

    // ۴) تلاش برای ست‌کردن فیلدهای ممنوع فقط لاگ می‌شود (هرگز اعمال نمی‌شود)
    const forbidden = rules.forbiddenFieldsIn(req.body || {});
    if (forbidden.length) {
      console.warn(
        `⚠️ [registration] تلاش برای ست‌کردن فیلدهای ممنوع از IP ${req.ip}: ${forbidden.join(", ")}`,
      );
    }

    // ۵) ساخت درخواست (هش رمز + بررسی تکراری‌ها)
    const created = await service.createRequest(validation.values, {
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    if (!created.ok) {
      return errorResponse(res, created.message, 400, {
        [created.field || "form"]: created.message,
      });
    }

    // ۶) پاسخ حداقلی: بدون شناسهٔ داخلی و بدون توکن
    return successResponse(res, rules.publicRequestView(), rules.publicRequestView().message, 201);
  } catch (error) {
    console.error("❌ خطا در ثبت درخواست ثبت‌نام:", error);
    return errorResponse(res, error.message, 500);
  }
};


// ============================================
// GET /api/registrations?status=pending  (مدیر)
// ============================================
const listRegistrations = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });
    const status = rules.normalizeStatusFilter(req.query.status);

    const { rows, count } = await service.listRequests({ status, limit, offset });

    return successResponse(
      res,
      {
        items: (rows || []).map((row) => rules.adminRequestView(row)),
        total: count,
        page,
        limit,
        status: status || "all",
      },
      "فهرست درخواست‌های ثبت‌نام دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در فهرست درخواست‌های ثبت‌نام:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ============================================
// GET /api/registrations/pending-count  (بج منوی مدیر)
// ============================================
const getPendingCount = async (req, res) => {
  try {
    const count = await service.pendingCount();
    return successResponse(res, { count }, "تعداد درخواست‌های در انتظار دریافت شد");
  } catch (error) {
    console.error("❌ خطا در شمارش درخواست‌های ثبت‌نام:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ============================================
// POST /api/registrations/:id/approve  (مدیر)
// ------------------------------------------------------------
// ⚠️ دو شرط: مجوز روت (users.registrations.review) **و** مجوز پیوند
//    پروندهٔ مشتری (users.customer.link) — چون تأیید بدون پیوند، مشتریِ
//    فعالِ بی‌پورتال می‌سازد.
// ⚠️ حالت «ساخت پروندهٔ تازه» (customer_mode='new') **یک شرط سوم** هم دارد:
//    customers.register — کسی که مجوز ثبت مشتری ندارد نباید با تأیید
//    ثبت‌نام، پروندهٔ مشتری بسازد (موج ۱۳.۷).
// ============================================
const approveRegistration = async (req, res) => {
  try {
    const canLink = await userHasPermission(req, "users.customer.link");
    if (!canLink) {
      return errorResponse(
        res,
        "برای تأیید ثبت‌نام، مجوز «تعیین پروندهٔ مشتری برای حساب کاربر» لازم است",
        403,
      );
    }

    const customerMode = rules.normalizeCustomerMode(req.body?.customer_mode);
    if (!customerMode) {
      return errorResponse(res, "حالت پروندهٔ مشتری نامعتبر است", 400);
    }

    if (customerMode === rules.CUSTOMER_MODE.NEW) {
      const canRegisterCustomer = await userHasPermission(req, "customers.register");
      if (!canRegisterCustomer) {
        return errorResponse(
          res,
          "برای ساخت پروندهٔ مشتری تازه، مجوز «ثبت مشتری جدید» لازم است؛ یا پروندهٔ موجود را انتخاب کنید",
          403,
        );
      }
    }

    const result = await service.approveRequest({
      id: req.params.id,
      reviewerId: req.user?.id ?? null,
      customerId: req.body?.customer_id,
      customerMode,
      newCustomer: req.body?.customer,
    });

    if (!result.ok) return sendServiceError(res, result);

    return successResponse(
      res,
      {
        request: rules.adminRequestView(result.request),
        customer: {
          id: result.customerId,
          created: result.customerCreated === true,
        },
        user: {
          id: result.user.id,
          username: result.user.username,
          full_name: `${result.user.first_name} ${result.user.last_name}`.trim(),
          role: result.user.role,
          status: result.user.status,
          customer_id: result.user.customer_id,
        },
      },
      result.customerCreated
        ? "درخواست تأیید شد؛ پروندهٔ مشتری تازه ساخته و حساب کاربر به آن متصل شد"
        : "درخواست تأیید شد و حساب مشتری ساخته شد",
    );
  } catch (error) {
    console.error("❌ خطا در تأیید درخواست ثبت‌نام:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ============================================
// POST /api/registrations/:id/reject  (مدیر)
// ============================================
const rejectRegistration = async (req, res) => {
  try {
    const result = await service.rejectRequest({
      id: req.params.id,
      reviewerId: req.user?.id ?? null,
      reason: req.body?.reason,
    });

    if (!result.ok) return sendServiceError(res, result);

    return successResponse(
      res,
      rules.adminRequestView(result.request),
      "درخواست ثبت‌نام رد شد",
    );
  } catch (error) {
    console.error("❌ خطا در رد درخواست ثبت‌نام:", error);
    return errorResponse(res, error.message, 500);
  }
};

module.exports = {
  REGISTRATION_CLOSED_MESSAGE,
  getPublicConfig,
  publicRegister,
  listRegistrations,
  getPendingCount,
  approveRegistration,
  rejectRegistration,
};
