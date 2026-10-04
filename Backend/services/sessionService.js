"use strict";

// ============================================================
// services/sessionService.js
// «نشست‌های کاربران» — لایهٔ نوشتن/خواندن روی دیتابیس (فاز ۱۲.۱)
// ------------------------------------------------------------
// • start({ user, ip, userAgent }) : یک ردیف نشست + `sid` یکتا می‌سازد
//                                    (sid داخل توکن JWT می‌رود)
// • touch(sid)                     : «این نشست هنوز زنده است؟» + تازه‌کردن
//                                    آخرین فعالیت — با throttle حافظه‌ای
//                                    (به‌طور پیش‌فرض یک‌بار در SESSION_TOUCH_THROTTLE_SECONDS)
// • endBySid / endAllForUser       : بستن یک نشست / همهٔ نشست‌های یک کاربر
// • revoke / list / mine / summary : مسیرهای مدیریتی و «نشست‌های من»
// • purgeExpired()                 : پاک‌سازی نگهداری (SESSION_RETENTION_DAYS)
// ------------------------------------------------------------
// ⭐ چرا این ماژول باگ را رفع می‌کند؟
//   قبلاً «خروج از همهٔ دستگاه‌ها» فقط `users.token` را بازنویسی می‌کرد.
//   چون هر دستگاه توکن مستقل خودش را دارد و (با
//   ENFORCE_SINGLE_SESSION=false) توکن ذخیره‌شده چک نمی‌شود، هیچ
//   دستگاه دیگری واقعاً بیرون نمی‌افتاد. حالا بستنِ ردیف نشست ⇒ ۴۰۱ فوری.
// ------------------------------------------------------------
// ⚠️ اصول طراحی:
//   ۱) `touch` هرگز نباید درخواست را خطادار کند: همهٔ خطاها بلعیده و
//      به‌عنوان «زنده» تفسیر می‌شوند (به‌جز «نشست بسته شده»).
//   ۲) اگر مایگریشن اجرا نشده باشد، سرویس crash نمی‌کند؛ یک‌بار هشدار
//      می‌دهد و با backoff از کوئری صرف‌نظر می‌کند (مثل presenceService).
//   ۳) `revokedSids` (در حافظهٔ همین پروسه) بلافاصله بعد از بستنِ یک
//      نشست پُر می‌شود ⇒ روی همان پروسه، ۴۰۱ آنی است. برای چند-پروسه،
//      بررسی دیتابیس (همین throttle) تا SESSION_TOUCH_THROTTLE_SECONDS
//      بعدی آن را می‌گیرد.
// ============================================================

const { Op } = require("sequelize");
const crypto = require("crypto");
const UserSession = require("../models/UserSession");
const rules = require("./sessionRules");

// sid → آخرین لحظهٔ نوشتن (ms) — فقط در حافظهٔ همین پروسه
const lastTouchAt = new Map();

// sid باطل‌شده → لحظهٔ انقضای نگه‌داری در حافظهٔ همین پروسه
// (بعد از انقضا، بررسی دیتابیس دوباره آن را تشخیص می‌دهد)
const revokedSids = new Map();
const REVOKED_MEMORY_TTL_MS = 5 * 60 * 1000;

// اگر جدول وجود نداشت (مایگریشن اجرا نشده)، لاگ اسپم نکنیم
let tableMissingUntil = 0;
const TABLE_MISSING_BACKOFF_MS = 60 * 1000;

const isMissingTableError = (error) =>
  error?.name === "SequelizeDatabaseError" &&
  /relation .*user_sessions.* does not exist/i.test(String(error?.message || ""));

const handleError = (message, error) => {
  if (isMissingTableError(error)) {
    tableMissingUntil = Date.now() + TABLE_MISSING_BACKOFF_MS;
    console.warn(
      "⚠️ [sessions] جدول user_sessions وجود ندارد؛ مایگریشن را اجرا کنید: npm run db:migrate",
    );
    return;
  }
  console.warn(`⚠️ [sessions] ${message}:`, error?.message || error);
};

// ============================================
// ابزارها
// ============================================

// شناسهٔ یکتای نشست (۳۲ بایت تصادفی → ۶۴ کاراکتر hex)
const newSid = () => crypto.randomBytes(32).toString("hex");

// سقف طول مقادیر متنی (مطابق ستون‌های دیتابیس)
const clip = (value, max) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
};

// استخراج ip / user-agent از درخواست (v4/v6 و x-forwarded-for)
const fromRequest = (req) => {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ip = forwarded || req?.ip || req?.socket?.remoteAddress || null;
  return {
    ip: clip(ip, 64),
    userAgent: clip(req?.headers?.["user-agent"], 500),
  };
};

// ============================================
// حافظهٔ sidهای باطل‌شده
// ============================================
const pruneRevoked = (now = Date.now()) => {
  if (revokedSids.size === 0) return;
  for (const [sid, until] of revokedSids) {
    if (now >= until) revokedSids.delete(sid);
  }
};

const markRevoked = (sid) => {
  if (!sid) return;
  const now = Date.now();
  pruneRevoked(now);
  revokedSids.set(sid, now + REVOKED_MEMORY_TTL_MS);
};

const isRevoked = (sid) => {
  if (!sid) return false;
  const until = revokedSids.get(sid);
  if (!until) return false;
  if (Date.now() >= until) {
    revokedSids.delete(sid);
    return false;
  }
  return true;
};

// ============================================
// شروع نشست (ورود موفق / صدور توکنِ تازه برای خودِ کاربر)
// ------------------------------------------------------------
// خروجی: ردیف نشست (شامل sid) — یا null اگر ثبت ممکن نبود.
// ⚠️ ورود هرگز نباید فقط به‌خاطر خطای این جدول شکست بخورد.
// ============================================
const start = async ({
  user,
  ip = null,
  userAgent = null,
  endPrevious = false,
} = {}) => {
  if (!user?.id) return null;

  try {
    // با ENFORCE_SINGLE_SESSION=true ورود جدید نشست‌های بازِ قبلی را می‌بندد
    if (endPrevious) {
      await endAllForUser(user.id, { reason: "replaced" });
    }

    const now = new Date();
    const session = await UserSession.create({
      user_id: user.id,
      username: clip(user.username, 100),
      role: clip(user.role, 20),
      sid: newSid(),
      ip: clip(ip, 64),
      user_agent: clip(userAgent, 500),
      started_at: now,
      last_activity_at: now,
    });

    lastTouchAt.set(session.sid, now.getTime());
    return session;
  } catch (error) {
    handleError("ثبت نشست ناموفق بود", error);
    return null;
  }
};

// ============================================
// ⭐ بررسی «زنده بودن» نشست + تازه‌کردن آخرین فعالیت
// ------------------------------------------------------------
// خروجی:
//   true  = نشست زنده است (و در صورت رسیدن بازه، آخرین فعالیت تازه شد)
//   false = نشست بسته/باطل شده ⇒ میدل‌ور باید ۴۰۱ بدهد
// ------------------------------------------------------------
// سبکی مسیر درخواست:
//   • داخل بازهٔ throttle (پیش‌فرض ۶۰s): فقط حافظه — هیچ کوئری‌ای نمی‌زنیم
//   • خارج از بازه: یک UPDATE که هم‌زمان «آخرین فعالیت» را می‌نویسد و
//     هم تعداد ردیف‌های تأثیرگرفته را برمی‌گرداند
//     ⇒ اگر ۰ بود یعنی نشست در دیتابیس بسته شده (خروج در دستگاه دیگر /
//       باطل‌شدن توسط مدیر) و همان لحظه باطل علامت می‌خورد.
// ============================================
const touch = async (sid) => {
  // توکن‌های قدیمی (بدون sid) دست‌نخورده کار می‌کنند ⇒ استقرار بی‌دردسر
  if (!sid) return true;

  if (isRevoked(sid)) return false;

  const now = Date.now();

  // مایگریشن اجرا نشده ⇒ رفتار قبلی (بدون سخت‌گیری)
  if (now < tableMissingUntil) return true;

  // داخل بازهٔ throttle: حالت/بازبودن نشست از حافظه تعیین می‌شود
  if (!rules.shouldTouch(lastTouchAt.get(sid), now)) return true;

  lastTouchAt.set(sid, now);

  try {
    const [affected] = await UserSession.update(
      { last_activity_at: new Date(now) },
      { where: { sid, ended_at: null }, silent: true },
    );

    if (affected === 0) {
      // ردیف نشست بسته شده (یا وجود ندارد) ⇒ توکن باید بی‌اعتبار شود
      markRevoked(sid);
      lastTouchAt.delete(sid);
      return false;
    }

    return true;
  } catch (error) {
    handleError("بروزرسانی فعالیت نشست ناموفق بود", error);
    // خطای گذرا هرگز نباید کاربر را بیرون بیندازد
    return true;
  }
};

// ============================================
// بستن نشست‌ها
// ============================================

// همهٔ sidهای بازِ یک کاربر (برای پاک‌کردن throttle و باطل‌کردن حافظه‌ای)
const activeSidsFor = async (userId) => {
  try {
    const rows = await UserSession.findAll({
      where: { user_id: userId, ended_at: null },
      attributes: ["sid"],
      raw: true,
    });
    return rows.map((row) => row.sid);
  } catch (error) {
    handleError("خواندن نشست‌های فعال ناموفق بود", error);
    return [];
  }
};

// بستن همهٔ نشست‌های بازِ یک کاربر
// reason: logout | revoked | replaced | password_change | role_change | reset
const endAllForUser = async (userId, { reason = "logout", endedBy = null } = {}) => {
  if (!userId) return 0;

  try {
    const sids = await activeSidsFor(userId);
    const now = new Date();

    const [affected] = await UserSession.update(
      { ended_at: now, end_reason: reason, ended_by: endedBy },
      { where: { user_id: userId, ended_at: null }, silent: true },
    );

    sids.forEach((sid) => {
      markRevoked(sid);
      lastTouchAt.delete(sid);
    });

    return affected;
  } catch (error) {
    handleError("بستن نشست‌های کاربر ناموفق بود", error);
    return 0;
  }
};

// بستن «همین نشست» (خروج کاربر از این دستگاه)
const endBySid = async (sid, { reason = "logout", endedBy = null } = {}) => {
  if (!sid) return null;

  try {
    const session = await UserSession.findOne({
      where: { sid, ended_at: null },
    });

    markRevoked(sid);
    lastTouchAt.delete(sid);

    if (!session) return null;

    await session.update(
      { ended_at: new Date(), end_reason: reason, ended_by: endedBy },
      { silent: true },
    );
    return session;
  } catch (error) {
    handleError("بستن نشست ناموفق بود", error);
    return null;
  }
};

// بستن یک نشست مشخص با id (مسیر مدیریتی: POST /sessions/:id/revoke)
const revoke = async (sessionId, { reason = "revoked", endedBy = null } = {}) => {
  try {
    const session = await UserSession.findByPk(sessionId);
    if (!session) return null;

    // از قبل بسته است ⇒ کاری لازم نیست (ولی باطل‌بودن حافظه‌ای تأیید میشود)
    if (!rules.isActive(session)) {
      markRevoked(session.sid);
      return session;
    }

    await session.update(
      { ended_at: new Date(), end_reason: reason, ended_by: endedBy },
      { silent: true },
    );

    markRevoked(session.sid);
    lastTouchAt.delete(session.sid);
    return session;
  } catch (error) {
    handleError("باطل‌کردن نشست ناموفق بود", error);
    return null;
  }
};

// ============================================
// خواندن
// ============================================

// سقف ردیف‌های برگشتی (این جدول «یک ردیف به‌ازای هر ورود» است؛ کوچک می‌ماند)
const MINE_LIMIT = 50;
const SUMMARY_LIMIT = 1000;

// فهرست نشست‌ها (پنل مدیریت، صفحه‌بندی‌شده)
const list = async ({ where = {}, limit = 20, offset = 0 } = {}) => {
  const { count, rows } = await UserSession.findAndCountAll({
    where,
    order: [
      ["last_activity_at", "DESC"],
      ["id", "DESC"],
    ],
    limit,
    offset,
  });

  return { count, rows };
};

// نشست‌های «من» — با علامت‌گذاری نشست جاری (همین دستگاه)
const mine = async (userId, { currentSid = null } = {}) => {
  const rows = await UserSession.findAll({
    where: { user_id: userId },
    order: [
      ["last_activity_at", "DESC"],
      ["id", "DESC"],
    ],
    limit: MINE_LIMIT,
  });

  return rules.buildSummary(rows, Date.now(), { currentSid });
};

// خلاصهٔ نشست‌ها (سرِ پنل مدیریت)
const summary = async ({ active_only = false } = {}) => {
  const rows = await UserSession.findAll({
    where: active_only ? { ended_at: null } : {},
    order: [["last_activity_at", "DESC"]],
    limit: SUMMARY_LIMIT,
  });

  return rules.buildSummary(rows);
};

// ============================================
// نگهداری: حذف نشست‌های بسته‌شدهٔ قدیمی‌تر از SESSION_RETENTION_DAYS
// ------------------------------------------------------------
// در این فاز زمان‌بندی خودکار ندارد (پنل مدیریت ۱۲.۳ آن را صدا می‌زند).
// ============================================
const purgeExpired = async (now = Date.now()) => {
  const cutoff = new Date(now - rules.RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    return await UserSession.destroy({
      where: { ended_at: { [Op.lt]: cutoff } },
    });
  } catch (error) {
    handleError("پاک‌سازی نشست‌های قدیمی ناموفق بود", error);
    return 0;
  }
};

module.exports = {
  // قواعد خالص، دوباره صادر می‌شوند تا مصرف‌کننده یک import داشته باشد
  ...rules,
  start,
  touch,
  endBySid,
  endAllForUser,
  revoke,
  list,
  mine,
  summary,
  purgeExpired,
  isRevoked,
  fromRequest,
  // نگهبان تست: ریست وضعیت داخلی (فقط برای تست‌ها)
  _reset: () => {
    lastTouchAt.clear();
    revokedSids.clear();
    tableMissingUntil = 0;
  },
};
