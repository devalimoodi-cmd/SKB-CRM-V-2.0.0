// ============================================================
// services/otpService.js
// «کد یک‌بارمصرف ورود» — هستهٔ ورود دومرحله‌ای (فاز ۱۳.۱)
// ------------------------------------------------------------
// نقش این سرویس:
//   ۱) ساختنِ «چالش» پس از تاییدِ رمز عبور (مرحلهٔ ۱ ورود)
//   ۲) ارسال کد ۶ رقمی با قالب verify سرویس sms.ir
//   ۳) اعتبارسنجی کد (مرحلهٔ ۲) — یک‌بارمصرف، با سقف تلاش
//   ۴) ارسال مجدد / لغو / پاک‌سازی نگهداری
// ------------------------------------------------------------
// 🔒 تصمیم‌های امنیتی (غیرقابل مذاکره):
//   • کد خام هرگز ذخیره/لاگ نمی‌شود؛ فقط SHA-256(code + ":" + OTP_PEPPER)
//   • مقایسه با timingSafeEqual ⇒ مقاوم به حملات زمان‌سنجی
//   • سقف تلاش ⇒ ۶ رقم با ۵ تلاش قابل کرک نیست
//   • چالش یک‌بارمصرف ⇒ ضدّ replay
//   • سقف ارسال ساعتی + فاصلهٔ ارسال مجدد ⇒ ضدّ SMS-bombing و هزینه
//   • هر خطای این سرویس «fail-closed» است (بدون کد = بدون ورود)،
//     ولی هیچ‌گاه سرور را crash نمی‌کند
// ------------------------------------------------------------
// ⚠️ اگر جدول login_challenges وجود نداشته باشد (مایگریشن اجرا نشده)،
//    به‌جای خطای ۵۰۰ یک پیام فارسی روشن برمی‌گردد.
// ============================================================
"use strict";

const { Op } = require("sequelize");
const LoginChallenge = require("../models/LoginChallenge");
const User = require("../models/User");
const SmsLog = require("../models/SmsLog");
const smsService = require("./smsService");

// ✅ منطق خالص (هش/ماسک/سقف‌ها/تشخیص وضعیت) در otpRules.js است:
//    ⇒ تست گارد بدون دیتابیس آن را می‌سنجد و قانون‌ها یک‌جا می‌مانند
//      (هم‌الگو با sessionRules.js و activityRules.js).
const {
  DEFAULT_TEMPLATE_ID,
  TEMPLATE_ENV,
  PARAM_NAME,
  PARAM_OTP,
  PARAM_TIME,
  ttlSeconds,
  ttlMinutes,
  resendSeconds,
  maxAttempts,
  maxPerHour,
  maxResends,
  retentionDays,
  purgeIntervalHours,
  isEnforced,
  testCode,
  hashCode,
  safeEqualHex,
  newCode,
  newChallengeId,
  maskMobile,
  hashText,
  displayName,
  templateIdFor,
  challengeProblem,
  canResend,
  normalizeCode,
} = require("./otpRules");



// ============================================
// ارسال کد با قالب verify سرویس sms.ir
// ------------------------------------------------------------
// 🔒 متن ثبت‌شده در sms_logs عمداً «کد» را ندارد.
// ============================================
const sendCode = async (user, code, purpose = "login") => {
  const templateId = templateIdFor(purpose);
  if (!templateId) {
    return { success: false, error: "قالب پیامک کد ورود تنظیم نشده است" };
  }

  const mobile = String(user?.mobile_number || "").trim();
  if (!/^09[0-9]{9}$/.test(mobile)) {
    return {
      success: false,
      error: "شمارهٔ موبایل معتبری برای این کاربر ثبت نشده است",
    };
  }

  const result = await smsService.sendVerify(mobile, templateId, [
    { name: PARAM_NAME, value: displayName(user) },
    { name: PARAM_OTP, value: String(code) },
    { name: PARAM_TIME, value: String(ttlMinutes()) },
  ]);

  try {
    await SmsLog.create({
      mobile,
      message: "کد یک‌بارمصرف ورود (مقدار کد در لاگ ذخیره نمی‌شود)",
      type: `otp_${purpose}`,
      template_id: templateId,
      status: result.success ? "sent" : "failed",
      message_id: result.messageId ? String(result.messageId) : null,
      error: result.success ? null : String(result.error || "").slice(0, 500),
      sent_at: new Date(),
    });
  } catch {
    // ثبت لاگ پیامک هرگز نباید مسیر ورود را خراب کند
  }

  return result;
};

// ============================================
// ساخت چالش (مرحلهٔ ۱ ورود)
// ============================================
const createChallenge = async ({
  user,
  purpose = "login",
  ip = null,
  userAgent = null,
} = {}) => {
  if (!user?.id) return { ok: false, reason: "invalid_user" };

  const now = Date.now();

  try {
    // ✅ سقف ساعتی (ضدّ SMS-bombing و کنترل هزینه)
    const hourAgo = new Date(now - 60 * 60 * 1000);
    const recent = await LoginChallenge.count({
      where: {
        user_id: user.id,
        purpose,
        created_at: { [Op.gte]: hourAgo },
      },
    });
    if (recent >= maxPerHour()) return { ok: false, reason: "hourly_limit" };

    // ✅ تنها یک چالش باز برای هر کاربر/هدف
    await LoginChallenge.update(
      { status: "cancelled" },
      { where: { user_id: user.id, purpose, status: "pending" } },
    );

    // کد تست (فقط بیرون production) یا کد تصادفی امن
    const code = testCode() || newCode();
    const ttl = ttlSeconds();

    const row = await LoginChallenge.create({
      challenge_id: newChallengeId(),
      user_id: user.id,
      username: String(user.username || "").slice(0, 100) || null,
      role: String(user.role || "").slice(0, 20) || null,
      purpose,
      code_hash: hashCode(code),
      attempts: 0,
      max_attempts: maxAttempts(),
      resend_count: 0,
      expires_at: new Date(now + ttl * 1000),
      last_sent_at: new Date(now),
      mobile_masked: maskMobile(user.mobile_number),
      ip: ip ? String(ip).slice(0, 64) : null,
      ua_hash: hashText(userAgent),
      status: "pending",
    });

    const delivery = await sendCode(user, code, purpose);
    if (!delivery.success) {
      await row.update({ status: "failed" });
      return { ok: false, reason: "sms_failed", error: delivery.error };
    }

    return {
      ok: true,
      challenge: row,
      expiresIn: ttl,
      resendAfter: resendSeconds(),
    };
  } catch (error) {
    return { ok: false, reason: "db_error", error: error.message };
  }
};

// ============================================
// اعتبارسنجی کد (مرحلهٔ ۲ ورود)
// ============================================
const verifyChallenge = async ({ challengeId, code } = {}) => {
  const id = String(challengeId || "").trim();
  // ✅ ارقام فارسی هم پذیرفته می‌شوند؛ خروجی همیشه ۶ رقم لاتین است
  const entered = normalizeCode(code);

  if (!id || !entered) {
    return { ok: false, reason: "invalid_input" };
  }

  try {
    const row = await LoginChallenge.findOne({
      where: { challenge_id: id },
    });

    // ✅ وضعیت/انقضا/سقف تلاش با قانون مشترک otpRules سنجیده می‌شود
    const problem = challengeProblem(row);
    if (problem) {
      if (row && problem === "expired" && row.status === "pending") {
        await row.update({ status: "expired" });
      }
      if (row && problem === "blocked" && row.status === "pending") {
        await row.update({ status: "blocked" });
      }
      return { ok: false, reason: problem };
    }

    const limit = row.max_attempts || maxAttempts();
    const expected = hashCode(entered);
    const fixed = testCode();
    const matches =
      safeEqualHex(expected, row.code_hash) ||
      (fixed !== null && entered === fixed);

    if (!matches) {
      const attempts = (row.attempts || 0) + 1;
      const blocked = attempts >= limit;
      await row.update({ attempts, status: blocked ? "blocked" : "pending" });
      return {
        ok: false,
        reason: blocked ? "blocked" : "invalid",
        attemptsLeft: Math.max(0, limit - attempts),
      };
    }

    // ✅ یک‌بارمصرف: مصرف همین‌جا ثبت می‌شود (ضدّ replay)
    await row.update({ status: "consumed", used_at: new Date() });
    return { ok: true, challenge: row };
  } catch (error) {
    return { ok: false, reason: "db_error", error: error.message };
  }
};

// ============================================
// ارسال مجدد کد (با فاصلهٔ اجباری)
// ============================================
const resend = async ({ challengeId, user = null } = {}) => {
  const id = String(challengeId || "").trim();
  if (!id) return { ok: false, reason: "invalid_input" };

  try {
    const row = await LoginChallenge.findOne({ where: { challenge_id: id } });

    // ✅ «آیا ارسال مجدد مجاز است؟» — قانون مشترک otpRules
    //    (وضعیت چالش + سقف ارسال مجدد + فاصلهٔ اجباری)
    const verdict = canResend({ row });
    if (!verdict.ok) {
      return {
        ok: false,
        reason: verdict.reason,
        waitSeconds: verdict.waitSeconds,
      };
    }

    const target =
      user && user.id === row.user_id ? user : await User.findByPk(row.user_id);
    if (!target) return { ok: false, reason: "not_found" };

    const code = testCode() || newCode();
    const now = Date.now();

    await row.update({
      code_hash: hashCode(code),
      expires_at: new Date(now + ttlSeconds() * 1000),
      last_sent_at: new Date(now),
      resend_count: (row.resend_count || 0) + 1,
      attempts: 0,
    });

    const delivery = await sendCode(target, code, row.purpose);
    if (!delivery.success) {
      return { ok: false, reason: "sms_failed", error: delivery.error };
    }

    return {
      ok: true,
      expiresIn: ttlSeconds(),
      resendAfter: resendSeconds(),
      maskedMobile: row.mobile_masked,
    };
  } catch (error) {
    return { ok: false, reason: "db_error", error: error.message };
  }
};

// ============================================
// لغو چالش (دکمهٔ «بازگشت» در صفحهٔ ورود)
// ============================================
const cancel = async ({ challengeId } = {}) => {
  const id = String(challengeId || "").trim();
  if (!id) return { ok: false, reason: "invalid_input" };

  try {
    const row = await LoginChallenge.findOne({ where: { challenge_id: id } });
    if (!row) return { ok: false, reason: "not_found" };
    if (row.status === "pending") {
      await row.update({ status: "cancelled" });
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "db_error", error: error.message };
  }
};

// ============================================
// پاک‌سازی نگهداری (چالش‌های کهنه)
// ============================================
const purgeExpired = async () => {
  try {
    const cutoff = new Date(Date.now() - retentionDays() * 24 * 60 * 60 * 1000);

    // چالش‌های «باز» که مدت‌ها گذشته ⇒ منقضی علامت می‌خورند
    await LoginChallenge.update(
      { status: "expired" },
      {
        where: {
          status: "pending",
          expires_at: { [Op.lt]: new Date(Date.now() - 60 * 60 * 1000) },
        },
      },
    );

    const deleted = await LoginChallenge.destroy({
      where: { created_at: { [Op.lt]: cutoff } },
    });

    return { deleted };
  } catch (error) {
    return { deleted: 0, error: error.message };
  }
};

// اجرای دوره‌ای پاک‌سازی (پیش‌فرض هر ۶ ساعت) — مانند activityService
let housekeepingTimer = null;

const startHousekeeping = () => {
  if (housekeepingTimer) return housekeepingTimer;

  const hours = purgeIntervalHours();
  housekeepingTimer = setInterval(() => {
    purgeExpired().catch(() => {});
  }, hours * 60 * 60 * 1000);

  if (typeof housekeepingTimer.unref === "function") {
    housekeepingTimer.unref();
  }

  return housekeepingTimer;
};

const stopHousekeeping = () => {
  if (housekeepingTimer) clearInterval(housekeepingTimer);
  housekeepingTimer = null;
};

module.exports = {
  // ---- ثابت‌ها و تنظیمات (برای تست/گارد ایستا) ----
  DEFAULT_TEMPLATE_ID,
  PARAM_NAME,
  PARAM_OTP,
  PARAM_TIME,
  ttlSeconds,
  ttlMinutes,
  resendSeconds,
  maxAttempts,
  maxPerHour,
  maxResends,
  retentionDays,
  isEnforced,
  testCode,
  // ---- ابزارهای خالص ----
  hashCode,
  safeEqualHex,
  newCode,
  maskMobile,
  hashText,
  displayName,
  templateIdFor,
  // ---- گردش‌کار ----
  sendCode,
  createChallenge,
  verifyChallenge,
  resend,
  cancel,
  purgeExpired,
  startHousekeeping,
  stopHousekeeping,
};


