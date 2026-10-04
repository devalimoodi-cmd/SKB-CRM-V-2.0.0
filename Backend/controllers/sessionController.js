// ============================================================
// controllers/sessionController.js
// «نشست‌های کاربران» (فاز ۱۲.۱) — لایهٔ HTTP
// ------------------------------------------------------------
// • GET  /api/sessions              : فهرست نشست‌ها (مدیر + مجوز)
// • GET  /api/sessions/summary      : خلاصه (مدیر + مجوز)
// • GET  /api/sessions/mine         : نشست‌های خودم (هر کاربر لاگین‌شده)
// • POST /api/sessions/:id/revoke   : بستن یک نشست (مدیر + مجوز)
// • POST /api/sessions/users/:userId/revoke-all : بستن همهٔ نشست‌های یک کاربر
// ------------------------------------------------------------
// ⚠️ هویت همیشه از توکن می‌آید (req.user / req.sessionId)؛ هیچ‌جا
//    «چه کسی را ببند» از توکنِ نشستِ هدف گرفته نمی‌شود.
// ============================================================
const sessionService = require("../services/sessionService");
const { parsePagination } = require("../utils/pagination");
const { successResponse, errorResponse } = require("../utils/response");

const isTruthy = (value) => String(value ?? "").toLowerCase() === "true";

// ===== فهرست نشست‌ها (پنل مدیریت) =====
const list = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const where = {};

    const userId = req.query.user_id || req.query.userId;
    if (userId) where.user_id = userId;

    // ?active_only=true ⇒ فقط نشست‌های باز
    if (isTruthy(req.query.active_only ?? req.query.activeOnly)) {
      where.ended_at = null;
    }

    const { count, rows } = await sessionService.list({ where, limit, offset });
    const summary = sessionService.buildSummary(rows, Date.now(), {
      currentSid: req.sessionId,
    });

    return successResponse(
      res,
      {
        sessions: summary.sessions,
        active: summary.active,
        ended: summary.ended,
        unique_users: summary.unique_users,
        touch_throttle_seconds: summary.touch_throttle_seconds,
        retention_days: summary.retention_days,
        pagination: {
          page,
          limit,
          total: count,
          total_pages: Math.max(1, Math.ceil(count / limit)),
        },
      },
      "فهرست نشست‌های کاربران",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت نشست‌ها:", error.message);
    return errorResponse(res, "خطا در دریافت فهرست نشست‌ها", 500);
  }
};

// ===== خلاصهٔ نشست‌ها =====
const summary = async (req, res) => {
  try {
    const data = await sessionService.summary({
      active_only: isTruthy(req.query.active_only ?? req.query.activeOnly),
    });

    return successResponse(res, data, "خلاصهٔ نشست‌های کاربران");
  } catch (error) {
    console.error("❌ خطا در خلاصهٔ نشست‌ها:", error.message);
    return errorResponse(res, "خطا در دریافت خلاصهٔ نشست‌ها", 500);
  }
};

// ===== نشست‌های «من» (همین دستگاه با علامت current مشخص می‌شود) =====
const mine = async (req, res) => {
  try {
    const data = await sessionService.mine(req.user.id, {
      currentSid: req.sessionId,
    });

    return successResponse(res, data, "نشست‌های من");
  } catch (error) {
    console.error("❌ خطا در دریافت نشست‌های کاربر:", error.message);
    return errorResponse(res, "خطا در دریافت نشست‌ها", 500);
  }
};

// ===== بستن یک نشست مشخص =====
const revoke = async (req, res) => {
  try {
    const session = await sessionService.revoke(req.params.id, {
      reason: "revoked",
      endedBy: req.user?.id ?? null,
    });

    if (!session) return errorResponse(res, "نشست یافت نشد", 404);

    return successResponse(
      res,
      {
        session: sessionService.buildItem(session, Date.now(), {
          currentSid: req.sessionId,
        }),
      },
      "نشست بسته شد و آن دستگاه از سیستم خارج می‌شود",
    );
  } catch (error) {
    console.error("❌ خطا در بستن نشست:", error.message);
    return errorResponse(res, "خطا در بستن نشست", 500);
  }
};

// ===== بستن همهٔ نشست‌های یک کاربر =====
const revokeAll = async (req, res) => {
  try {
    const { userId } = req.params;

    const ended = await sessionService.endAllForUser(userId, {
      reason: "revoked",
      endedBy: req.user?.id ?? null,
    });

    return successResponse(
      res,
      { user_id: Number(userId), ended },
      ended > 0
        ? `${ended} نشست بسته شد`
        : "نشست بازی برای این کاربر وجود نداشت",
    );
  } catch (error) {
    console.error("❌ خطا در بستن نشست‌های کاربر:", error.message);
    return errorResponse(res, "خطا در بستن نشست‌های کاربر", 500);
  }
};

module.exports = {
  list,
  summary,
  mine,
  revoke,
  revokeAll,
};
