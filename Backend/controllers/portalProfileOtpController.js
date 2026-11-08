// ============================================================
// controllers/portalProfileOtpController.js
// «تغییر شمارهٔ موبایل از پورتال مشتری با کد پیامکی» — فاز ۱۳.۸
// ------------------------------------------------------------
//  چرا مسیر جدا از PUT /api/portal/profile؟
//   شمارهٔ موبایل هم شناسهٔ ورود است (users.mobile_number یکتا) و هم
//   کلید تماس شرکت با مشتری. تغییرش نباید با یک PATCH ساده انجام شود؛
//   باید ثابت شود کاربر «دسترسی به شمارهٔ جدید» دارد.
//
// 🔒 قواعد:
//  ۱) کد همیشه به شمارهٔ **جدید** می‌رود، ولی چالش به user_id فعلی
//     بسته می‌شود (خدمات otpService.createChallenge).
//  ۲) شمارهٔ جدید در ستون payload همان چالش ذخیره می‌شود (مایگریشن
//     20261108000004) — نه در حافظهٔ سرور.
//  ۳) تأیید نهایی فقط برای چالشی که purpose=profile_mobile و
//     user_id == همان کاربر جاری باشد (ضدّ استفادهٔ چالش دیگران).
//  ۴) شمارهٔ جدید نباید در پروندهٔ مشتری دیگری یا حساب کاربری دیگری باشد.
//  ۵) در یک تراکنش، هم پروندهٔ مشتری و هم کاربرِ متصل به‌روز می‌شوند
//     تا ورودِ بعدی با شمارهٔ قدیمی نشکند.
// ============================================================
"use strict";

const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const User = require("../models/User");
const LoginChallenge = require("../models/LoginChallenge");
const otpService = require("../services/otpService");
const { canResend } = require("../services/otpRules");
const {
  PROFILE_MOBILE_PURPOSE,
  validateMobileChange,
  normalizeMobileInput,
} = require("../services/portalProfileRules");
const { maskMobile } = require("../services/registrationRules");
const { successResponse, errorResponse } = require("../utils/response");

// شناسهٔ اسکوپ (فقط از توکن — middleware آن را نشانده است)
const scopeIdOf = (req) => {
  const raw = req.portalScopeId ?? req.customerScopeId ?? req.customerScope?.customerId;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const clientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  null;

// آیا شمارهٔ جدید نزد کسی دیگر (پرونده یا کاربر) ثبت شده است؟
const mobileTakenBy = async ({ mobile, customerId, userId }) => {
  const otherCustomer = await CustomerPersonalInfo.count({
    where: { mobile_number: mobile, id: { [Op.ne]: customerId } },
  });
  if (otherCustomer > 0) return "customer";

  const otherUser = await User.count({
    where: { mobile_number: mobile, id: { [Op.ne]: userId } },
  });
  if (otherUser > 0) return "user";

  return null;
};

const conflictResponse = (res) =>
  res.status(409).json({
    success: false,
    code: "PORTAL_MOBILE_TAKEN",
    message:
      "این شمارهٔ موبایل قبلاً در سیستم ثبت شده است؛ برای تغییر با دفتر شرکت تماس بگیرید",
    timestamp: new Date().toISOString(),
  });

// ============================================
// POST /api/portal/profile/mobile/request
// بدنه: { mobile_number }
// خروجی: { challenge_id, mobile_masked, expires_in, resend_after }
// ============================================
const requestMobileChange = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) {
      return errorResponse(
        res,
        "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
        403,
      );
    }

    const customer = await CustomerPersonalInfo.findByPk(customerId, {
      attributes: ["id", "mobile_number", "full_name"],
    });
    if (!customer) return errorResponse(res, "پروندهٔ مشتری یافت نشد", 404);

    const verdict = validateMobileChange({
      current: customer.mobile_number,
      next: req.body?.mobile_number,
    });
    if (!verdict.ok) {
      return res.status(400).json({
        success: false,
        message: verdict.errors.mobile_number,
        errors: verdict.errors,
      });
    }

    const taken = await mobileTakenBy({
      mobile: verdict.next,
      customerId,
      userId: req.user.id,
    });
    if (taken) return conflictResponse(res);

    // فاصلهٔ ارسال مجدد (همان قانون ورود — otpRules.canResend)
    const pending = await LoginChallenge.findOne({
      where: { user_id: req.user.id, purpose: PROFILE_MOBILE_PURPOSE, status: "pending" },
      order: [["id", "DESC"]],
    });
    if (pending) {
      const gate = canResend({ row: pending });
      if (!gate.ok && gate.reason === "too_soon") {
        return res.status(429).json({
          success: false,
          code: "PORTAL_OTP_TOO_SOON",
          message: `برای ارسال کد جدید ${gate.waitSeconds} ثانیه صبر کنید`,
          wait_seconds: gate.waitSeconds,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // چالش برای همان کاربر، ولی ارسال به شمارهٔ جدید
    // (sendCode شماره را از شیء user می‌خواند ⇒ شیء سبکِ هدفمند)
    const target = {
      id: req.user.id,
      username: req.user.username,
      role: req.user.role,
      full_name: customer.full_name || req.user.full_name,
      mobile_number: verdict.next,
    };

    const challenge = await otpService.createChallenge({
      user: target,
      purpose: PROFILE_MOBILE_PURPOSE,
      ip: clientIp(req),
      userAgent: req.headers["user-agent"] || null,
    });

    if (!challenge.ok) {
      const reasons = {
        hourly_limit: "تعداد درخواست کد در ساعت گذشته زیاد بوده است؛ بعداً تلاش کنید",
        sms_failed: "ارسال پیامک ناموفق بود؛ لطفاً دوباره تلاش کنید",
      };
      return res.status(429).json({
        success: false,
        code: "PORTAL_OTP_FAILED",
        reason: challenge.reason,
        message:
          reasons[challenge.reason] ||
          "امکان ارسال کد تأیید نیست؛ کمی بعد دوباره تلاش کنید",
        timestamp: new Date().toISOString(),
      });
    }

    // 🔒 شمارهٔ جدید فقط این‌جا و فقط برای همین purpose ذخیره می‌شود
    await challenge.challenge.update({
      payload: {
        mobile_number: verdict.next,
        requested_at: new Date().toISOString(),
      },
    });

    return successResponse(
      res,
      {
        challenge_id: challenge.challenge.challenge_id,
        mobile_masked: maskMobile(verdict.next),
        expires_in: challenge.expiresIn,
        resend_after: challenge.resendAfter,
        purpose: PROFILE_MOBILE_PURPOSE,
      },
      "کد تأیید به شمارهٔ جدید ارسال شد",
    );
  } catch (error) {
    console.error("❌ خطا در درخواست تغییر موبایل پورتال:", error.message);
    return errorResponse(res, "خطا در ارسال کد تأیید", 500);
  }
};

// ============================================
// POST /api/portal/profile/mobile/confirm
// بدنه: { challenge_id, code }
// ============================================
const confirmMobileChange = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) {
      return errorResponse(
        res,
        "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
        403,
      );
    }

    const result = await otpService.verifyChallenge({
      challengeId: req.body?.challenge_id,
      code: req.body?.code,
    });

    if (!result.ok) {
      const messages = {
        invalid: "کد وارد‌شده درست نیست",
        blocked: "تعداد تلاش‌های ناموفق زیاد بود؛ کد جدید بگیرید",
        expired: "کد منقضی شده است؛ کد جدید بگیرید",
        invalid_input: "کد تأیید را کامل وارد کنید",
      };
      return res.status(400).json({
        success: false,
        code: "PORTAL_OTP_INVALID",
        reason: result.reason,
        attempts_left: result.attemptsLeft ?? null,
        message: messages[result.reason] || "کد تأیید معتبر نیست",
        timestamp: new Date().toISOString(),
      });
    }

    const challengeRow = result.challenge;

    // 🔒 چالش باید از نوع «تغییر موبایل» و متعلق به همین کاربر باشد
    if (
      !challengeRow ||
      challengeRow.purpose !== PROFILE_MOBILE_PURPOSE ||
      Number(challengeRow.user_id) !== Number(req.user.id)
    ) {
      console.warn(
        `🚫 [portal:mobile] چالش نامرتبط: challenge=${challengeRow?.challenge_id ?? "-"} purpose=${
          challengeRow?.purpose ?? "-"
        } user=${req.user.id}`,
      );
      return res.status(403).json({
        success: false,
        code: "PORTAL_OTP_MISMATCH",
        message: "این کد برای تغییر شمارهٔ شما صادر نشده است",
        timestamp: new Date().toISOString(),
      });
    }

    const next = normalizeMobileInput(challengeRow.payload?.mobile_number);
    const verdict = validateMobileChange({
      current: (await CustomerPersonalInfo.findByPk(customerId, {
        attributes: ["id", "mobile_number"],
      }))?.mobile_number,
      next,
    });
    if (!verdict.ok) {
      return res.status(400).json({
        success: false,
        message: verdict.errors.mobile_number,
        errors: verdict.errors,
      });
    }

    const taken = await mobileTakenBy({
      mobile: verdict.next,
      customerId,
      userId: req.user.id,
    });
    if (taken) return conflictResponse(res);

    // ✅ یک تراکنش: پروندهٔ مشتری + حساب کاربری (ورود با شماره)
    await sequelize.transaction(async (transaction) => {
      await CustomerPersonalInfo.update(
        { mobile_number: verdict.next, updated_by: req.user.id },
        { where: { id: customerId }, transaction },
      );
      await User.update(
        { mobile_number: verdict.next },
        { where: { id: req.user.id }, transaction },
      );
    });

    console.info(
      `📱 [portal:mobile] شمارهٔ پرونده ${customerId} توسط کاربر ${req.user.id} تغییر کرد`,
    );

    return successResponse(
      res,
      {
        mobile_number: verdict.next,
        mobile_masked: maskMobile(verdict.next),
        // ⚠️ توکن فعلی معتبر می‌ماند؛ ورودهای بعدی با شمارهٔ جدید است
        requires_relogin: false,
      },
      "شمارهٔ موبایل با موفقیت تغییر کرد",
    );
  } catch (error) {
    console.error("❌ خطا در تأیید تغییر موبایل پورتال:", error.message);
    return errorResponse(res, "خطا در تغییر شمارهٔ موبایل", 500);
  }
};

module.exports = {
  requestMobileChange,
  confirmMobileChange,
};
