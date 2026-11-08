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
const CustomerType = require("../models/CustomerType");
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
    const [flag, autoFlag] = await Promise.all([
      settingsController.readSetting("registration_enabled"),
      // ✅ موج ۱۳.۷.۳ — «تأیید خودکار» فقط برای متن پیام موفقیت لازم است
      settingsController.readSetting("registration_auto_approve"),
    ]);
    return successResponse(
      res,
      {
        enabled: rules.isRegistrationEnabled(flag),
        auto_approve: rules.isAutoApproveEnabled(autoFlag),
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
// GET /api/registrations/customer-types  (عمومی)
// ------------------------------------------------------------
// فرم /register برای کشوی «نوع مشتری» به دیکشنری نیاز دارد، ولی مسیر
// مدیریتی /api/dictionaries/customer-types مجوز dictionary.customer-types.view
// می‌خواهد. پس یک نسخهٔ عمومی و **حداقلی** اینجا ساخته شد:
//   • فقط انواع «فعال»
//   • فقط دو ستون id و name (بدون description/sort_order/تاریخ/سازنده)
//   • پشت لیمیتر سبک (ضدّ اسکرپ دیکشنری)
// ============================================
const PUBLIC_CUSTOMER_TYPES_LIMIT = 100;

const getPublicCustomerTypes = async (req, res) => {
  try {
    const rows = await CustomerType.findAll({
      where: { active: true },
      attributes: ["id", "name"],
      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
      limit: PUBLIC_CUSTOMER_TYPES_LIMIT,
    });

    const items = (rows || []).map((row) => ({ id: row.id, name: row.name }));

    // فهرست کم‌تغییر است ⇒ کش کوتاه سمت مرورگر/پروکسی (فقط همین پاسخ عمومی)
    res.set("Cache-Control", "public, max-age=300");
    return successResponse(res, items, "فهرست انواع مشتری دریافت شد");
  } catch (error) {
    console.error("❌ خطا در دریافت انواع مشتری برای فرم ثبت‌نام:", error);
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

    // ۱-ب) پرچم «تأیید خودکار» (موج ۱۳.۷.۳) — فقط پس از باز بودن ثبت‌نام
    const autoFlag = await settingsController.readSetting("registration_auto_approve");
    const autoApprove = rules.isAutoApproveEnabled(autoFlag);

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

    // ۶) تأیید خودکار (موج ۱۳.۷.۳)
    //    ⚠️ شکست آن، ثبت‌نام را باطل نمی‌کند: ردیف pending می‌ماند، تراکنش
    //    تأیید رول‌بک می‌شود و دلیل در auto_approve_error ثبت می‌گردد.
    let auto = null;
    if (autoApprove) {
      auto = await service.autoApproveRequest(created.request);
    }

    // ۷) پاسخ حداقلی: بدون شناسهٔ داخلی و بدون توکن
    const view = rules.publicRequestView(auto?.ok === true);
    return successResponse(res, view, view.message, 201);
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
// GET /api/registrations/settings  (مدیر)
// ------------------------------------------------------------
// ✅ موج ۱۳.۷.۳ — سوییچ «تأیید خودکار» در کارت «درخواست‌های ثبت‌نام».
// برای رندر درست سوییچ، فرانت باید هم مقدار فعلی و هم «اجازهٔ تغییر»
// را بداند؛ پس هر دو در یک پاسخ می‌آیند.
// ============================================
const getReviewSettings = async (req, res) => {
  try {
    const [autoFlag, canReview, canRegisterCustomer] = await Promise.all([
      settingsController.readSetting("registration_auto_approve"),
      userHasPermission(req, "users.registrations.review"),
      userHasPermission(req, "customers.register"),
    ]);

    return successResponse(
      res,
      {
        auto_approve: rules.isAutoApproveEnabled(autoFlag),
        // روشن‌کردن سوییچ = ساخت خودکار پروندهٔ مشتری بدون بازبینی
        // ⇒ هم مجوز بازبینی و هم مجوز ثبت مشتری لازم است
        can_review: canReview,
        can_register_customer: canRegisterCustomer,
        can_toggle: canReview && canRegisterCustomer,
      },
      "تنظیمات صف ثبت‌نام دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در خواندن تنظیمات صف ثبت‌نام:", error);
    return errorResponse(res, error.message, 500);
  }
};

// ============================================
// PUT /api/registrations/settings  (مدیر)
// ------------------------------------------------------------
// 🔒 برخلاف PUT /api/settings/:key (که settings.edit می‌خواهد)، این مسیر
//    مستقیماً «اجازهٔ ساخت خودکار پروندهٔ مشتری» می‌دهد؛ پس:
//      • تغییر (روشن یا خاموش) ⇒ users.registrations.review
//      • روشن‌کردن ⇒ additionally customers.register
//    مقدار از طریق settingsController.writeSetting ذخیره می‌شود تا همان
//    اعتبارسنجی/نرمال‌سازی درِ تنظیمات اجرا شود.
// ============================================
const updateReviewSettings = async (req, res) => {
  try {
    const canReview = await userHasPermission(req, "users.registrations.review");
    if (!canReview) {
      return errorResponse(
        res,
        "برای تغییر تنظیمات صف ثبت‌نام، مجوز «بازبینی درخواست‌های ثبت‌نام» لازم است",
        403,
      );
    }

    const raw = req.body?.auto_approve;
    if (raw === undefined || raw === null) {
      return errorResponse(res, "مقدار «تأیید خودکار» ارسال نشده است", 400);
    }
    const desired = rules.isAutoApproveEnabled(raw);

    if (desired) {
      const canRegisterCustomer = await userHasPermission(req, "customers.register");
      if (!canRegisterCustomer) {
        return errorResponse(
          res,
          "برای روشن‌کردن «تأیید خودکار»، مجوز «ثبت مشتری جدید» لازم است (تأیید خودکار پروندهٔ مشتری می‌سازد)",
          403,
        );
      }
    }

    const written = await settingsController.writeSetting(
      "registration_auto_approve",
      desired,
      req.user?.id ?? null,
    );
    if (!written.ok) {
      return errorResponse(res, written.message, 400);
    }

    // ممیزی سبک: چه کسی این پرچم را روشن/خاموش کرد
    console.warn(
      `🔁 [registration] «تأیید خودکار ثبت‌نام» توسط کاربر ${req.user?.id ?? "?"} ${
        desired ? "روشن" : "خاموش"
      } شد`,
    );

    return successResponse(
      res,
      { auto_approve: written.value === true },
      desired
        ? "«تأیید خودکار ثبت‌نام» روشن شد؛ ثبت‌نام‌های تازه بی‌درنگ تأیید می‌شوند"
        : "«تأیید خودکار ثبت‌نام» خاموش شد؛ درخواست‌های تازه در صف بازبینی می‌مانند",
    );
  } catch (error) {
    console.error("❌ خطا در بروزرسانی تنظیمات صف ثبت‌نام:", error);
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
  getPublicCustomerTypes,
  publicRegister,
  listRegistrations,
  getPendingCount,
  getReviewSettings,
  updateReviewSettings,
  approveRegistration,
  rejectRegistration,
};
