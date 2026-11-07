// ============================================================
// controllers/loginOtpController.js
// مرحلهٔ ۲ ورود: اعتبارسنجی کد پیامکی و صدور نشست/توکن (فاز ۱۳.۱)
// ------------------------------------------------------------
// ⭐ نکتهٔ کلیدی معماری:
//    «ساخت نشست» و «صدور توکن» فقط اینجا انجام می‌شود، نه در
//    مرحلهٔ ۱ (رمز عبور). پس کسی که فقط رمز را می‌داند، هیچ
//    توکن/نشستی در دست ندارد.
// ------------------------------------------------------------
// 🔒 کنترل‌های اضافی پس از تایید کد:
//    • وضعیت حساب دوباره بررسی می‌شود (ممکن است بین دو مرحله
//      مدیر کاربر را غیرفعال کرده باشد)
//    • قفل حساب بررسی می‌شود (OTP نباید راه دورزدن قفل باشد)
// ============================================================
"use strict";

const User = require("../models/User");
const sessionService = require("../services/sessionService");
const otpService = require("../services/otpService");
const { getTokenExpiryDate } = require("../utils/token");
const { successResponse, errorResponse } = require("../utils/response");

// صفحهٔ مقصد بر اساس نقش — یک منبع حقیقت برای فرانت‌اند
// (در فاز ۱۳.۳ مشتری به «/portal» منتقل می‌شود)
const landingForRole = (role, user = null) => {
  if (role === "super_admin" || role === "admin") return "/admin";
  if (role === "sub_admin" || role === "expert") return "/";

  // ✅ فاز ۱۳.۰: حساب مشتری مستقیم به پروندهٔ خودش می‌رود
  //    (پیش‌تر «/customer-info» بدون id بود و صفحه پیام
  //     «شناسه مشتری یافت نشد» می‌داد)
  const customerId = Number(user?.customer_id);
  if (Number.isInteger(customerId) && customerId > 0) {
    return `/customer-info?id=${customerId}`;
  }

  // حساب بدون پرونده (پیوند داده نشده) ⇒ همان صفحهٔ قبلی،
  // فرانت‌اند پیام روشنِ «حساب متصل نیست» را نشان می‌دهد.
  return "/customer-info";
};

// پیام‌های فارسی دلایل شکست (بدون افشای اطلاعات حساس)
const REASON_MESSAGES = {
  invalid_input: "کد وارد‌شده معتبر نیست",
  not_found: "این درخواست ورود یافت نشد؛ دوباره از ابتدا وارد شوید",
  used: "این کد قبلاً استفاده شده است؛ دوباره وارد شوید",
  expired: "کد منقضی شده است؛ دوباره وارد شوید یا کد جدید بگیرید",
  blocked: "تعداد تلاش‌های اشتباه زیاد بود؛ دوباره از ابتدا وارد شوید",
  invalid: "کد وارد‌شده اشتباه است",
  hourly_limit: "تعداد درخواست کد در یک ساعت گذشته زیاد بوده است",
  resend_limit: "سقف ارسال مجدد کد در این ورود پر شده است",
  too_soon: "برای ارسال مجدد کمی صبر کنید",
  sms_failed: "ارسال پیامک ناموفق بود؛ لطفاً بعداً تلاش کنید",
  db_error: "خطای موقت در سیستم؛ لطفاً بعداً تلاش کنید",
};

const messageFor = (reason) =>
  REASON_MESSAGES[reason] || "خطا در فرایند ورود";

// از درخواست: ip / user-agent (هم‌الگو با sessionService.fromRequest)
const fromRequest = (req) => {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ip = forwarded || req?.ip || req?.socket?.remoteAddress || null;
  return { ip, userAgent: req?.headers?.["user-agent"] || null };
};

// ============================================
// POST /api/users/login/verify
// ============================================
const verifyLogin = async (req, res) => {
  try {
    const challengeId = req.body?.challenge_id || req.body?.challengeId;
    const code = req.body?.code || req.body?.otp;

    const result = await otpService.verifyChallenge({ challengeId, code });

    if (!result.ok) {
      const status =
        result.reason === "not_found"
          ? 404
          : result.reason === "blocked" || result.reason === "used"
            ? 429
            : result.reason === "db_error"
              ? 503
              : 401;

      return errorResponse(res, messageFor(result.reason), status, {
        reason: result.reason,
        attempts_left: result.attemptsLeft,
      });
    }

    // ✅ کد درست است ⇒ کاربر را تازه از دیتابیس می‌خوانیم
    const user = await User.findByPk(result.challenge.user_id);
    if (!user) {
      return errorResponse(res, messageFor("not_found"), 404);
    }

    if (user.status !== "active") {
      return errorResponse(res, "حساب کاربری شما فعال نیست", 403);
    }

    // ⛔ OTP نباید راه دورزدن قفل حساب شود
    if (user.isLocked()) {
      return errorResponse(
        res,
        "حساب کاربری شما قفل است؛ با پشتیبانی تماس بگیرید",
        423,
      );
    }

    // ✅ از این نقطه به بعد، «ورود واقعی» است
    if (user.failed_login_attempts > 0 || user.locked_until) {
      await user.resetFailedAttempts();
    }

    const { ip, userAgent } = fromRequest(req);
    const session = await sessionService.start({
      user,
      ip,
      userAgent,
      endPrevious: process.env.ENFORCE_SINGLE_SESSION === "true",
    });

    const token = user.generateToken(session ? { sid: session.sid } : {});

    await user.update({
      last_login: new Date(),
      last_login_ip: ip ? String(ip).slice(0, 45) : user.last_login_ip,
      token,
      token_expires_at: getTokenExpiryDate(),
      last_seen_at: new Date(),
      online_status: true,
    });

    return successResponse(
      res,
      {
        user: user.toJSON(),
        token,
        landing: landingForRole(user.role, user),
      },
      "ورود با موفقیت انجام شد",
    );
  } catch (error) {
    console.error("خطا در تایید کد ورود:", error);
    return errorResponse(res, "خطای موقت در سیستم؛ بعداً تلاش کنید", 500);
  }
};

// ============================================
// POST /api/users/login/resend
// ============================================
const resendLoginCode = async (req, res) => {
  try {
    const challengeId = req.body?.challenge_id || req.body?.challengeId;
    const result = await otpService.resend({ challengeId });

    if (!result.ok) {
      const status =
        result.reason === "too_soon"
          ? 429
          : result.reason === "not_found"
            ? 404
            : 400;

      return errorResponse(res, messageFor(result.reason), status, {
        reason: result.reason,
        wait_seconds: result.waitSeconds,
      });
    }

    return successResponse(
      res,
      {
        expires_in: result.expiresIn,
        resend_after: result.resendAfter,
        masked_mobile: result.maskedMobile,
      },
      "کد جدید ارسال شد",
    );
  } catch (error) {
    console.error("خطا در ارسال مجدد کد ورود:", error);
    return errorResponse(res, "خطای موقت در سیستم؛ بعداً تلاش کنید", 500);
  }
};

// ============================================
// POST /api/users/login/cancel
// ============================================
const cancelLogin = async (req, res) => {
  try {
    const challengeId = req.body?.challenge_id || req.body?.challengeId;
    const result = await otpService.cancel({ challengeId });

    if (!result.ok) {
      return errorResponse(res, messageFor(result.reason), 400, {
        reason: result.reason,
      });
    }

    return successResponse(res, null, "درخواست ورود لغو شد");
  } catch (error) {
    console.error("خطا در لغو ورود:", error);
    return errorResponse(res, "خطای موقت در سیستم؛ بعداً تلاش کنید", 500);
  }
};

module.exports = {
  landingForRole,
  messageFor,
  fromRequest,
  verifyLogin,
  resendLoginCode,
  cancelLogin,
};
