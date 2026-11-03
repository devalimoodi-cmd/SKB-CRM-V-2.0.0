// ============================================================
// middleware/activityLog.js
// «ردّ فعالیت» — ثبت خودکار هر تغییر وضعیت (فاز ۱۲.۲)
// ------------------------------------------------------------
// چرا میدل‌ور و نه فراخوانی در کنترلرها؟
//   • یک نقطه، همهٔ مسیرها ⇒ هیچ روتی «یادش نمی‌رود» لاگ بزند
//   • ورود/خروج بدون دست‌زدن به userController ثبت می‌شود
//   • ورودِ ناموفق (۴۰۱) هم دیده می‌شود (نام تلاش‌شده از بدنه)
// ------------------------------------------------------------
// ⚠️ کار انجام‌شده روی `res.on("finish")` است ⇒ پاسخ کاربر پیش از
//    نوشتن لاگ ارسال شده؛ هیچ تأخیری به تجربهٔ کاربر اضافه نمی‌شود.
// ⚠️ خودِ پنل «ردّ فعالیت» و heartbeat حضور در skip list هستند تا
//    حلقهٔ بازخورد (لاگِ خواندنِ لاگ) ایجاد نشود.
// ⚠️ اگر ACTIVITY_LOG_ENABLED=false باشد، این میدل‌ور فقط next() است.
// ============================================================
"use strict";

const rules = require("../services/activityRules");
const activityService = require("../services/activityService");

// مسیرهایی که هرگز ثبت نمی‌شوند (خودِ لاگ + حضور + وضعیت سلامت)
const SKIP_PREFIXES = [
  "/api/activity",
  "/api/presence/heartbeat",
  "/api/presence/offline",
  "/api/server-status",
];
const SKIP_EXACT = ["/", "/health", "/api/ping"];

// مسیر بدون query و بدون اسلش انتهایی (حروف کوچک)
const normalizePath = (originalUrl) => {
  const [withoutQuery] = String(originalUrl || "").split("?");
  const trimmed = withoutQuery.replace(/\/+$/, "");
  return (trimmed || "/").toLowerCase();
};

// آیا این درخواست باید نادیده گرفته شود؟
const shouldSkip = (originalUrl) => {
  const path = normalizePath(originalUrl);
  if (SKIP_EXACT.includes(path)) return true;
  return SKIP_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
};

// آی‌پی/مرورگر درخواست (v4/v6 و X-Forwarded-For)
const fromRequest = (req) => {
  const forwarded = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ip = forwarded || req?.ip || req?.socket?.remoteAddress || null;
  return {
    ip,
    userAgent: req?.headers?.["user-agent"] || null,
  };
};

// نام تلاش‌شده در ورود ناموفق (بدون ذخیرهٔ رمز — فقط username/email)
const actorHintFrom = (body) => {
  if (!body || typeof body !== "object") return null;
  const hint = body.username || body.email || null;
  return hint ? String(hint).slice(0, 100) : null;
};

// الگوی مسیر Express (برای الگوکاوی؛ مسیر واقعی جدا ذخیره می‌شود)
const routePattern = (req) => {
  const raw = req.route?.path;
  if (!raw) return null;
  const pattern = Array.isArray(raw) ? raw[0] : raw;
  return pattern ? String(pattern) : null;
};

// مدت پردازش تا لحظهٔ پایان پاسخ (میلی‌ثانیه)
const durationMsSince = (startedAt) => {
  try {
    return Number(process.hrtime.bigint() - startedAt) / 1e6;
  } catch {
    return null;
  }
};

const activityLog = (req, res, next) => {
  if (!rules.isEnabled()) return next();

  const startedAt = process.hrtime.bigint();

  // مسیر بدون query (login?x=1 هم باید «ورود» شناخته شود)
  const { path } = rules.parsePath(req.originalUrl);
  const authEvent = rules.isAuthEvent(path);

  // ⭐ برای «ورود موفق» بازیگر از بدنهٔ پاسخ خوانده می‌شود (روت عمومی است و
  //    req.user خالی می‌ماند) تا ردیف، شناسه/نام/نقشِ واقعیِ واردشده را داشته باشد.
  let capturedActor = null;
  if (authEvent === "login") {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        capturedActor = capturedActor || rules.actorFromPayload(body);
      } catch {
        // بی‌اهمیت — ثبت لاگ نباید پاسخ را خراب کند
      }
      return originalJson(body);
    };
  }

  // ⭐ شناسهٔ رکوردِ ساخته‌شده (فاز ۱۲.۴.۲): برای POST هیچ شناسه‌ای در URL نیست،
  //    پس از بدنهٔ پاسخِ موفق خوانده می‌شود تا تب «تغییرات این رکورد» برای
  //    رکورد تازه‌ساخته‌شده هم پر باشد. فقط برای تغییر وضعیت (نه ورود/خروج).
  // ⭐ موج ۱۲.۵: همین پاسخ می‌تواند customer_id را هم داشته باشد.
  let capturedEntityId = null;
  let capturedCustomerId = null;
  if (rules.isMutation(req.method) && !authEvent) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      try {
        capturedEntityId = capturedEntityId || rules.entityIdFromPayload(body);
        capturedCustomerId =
          capturedCustomerId ||
          rules.customerIdFromRequest({ responseBody: body });
      } catch {
        // بی‌اهمیت — ثبت لاگ نباید پاسخ را خراب کند
      }
      return originalJson(body);
    };
  }

  res.on("finish", () => {
    try {
      if (shouldSkip(req.originalUrl)) return;

      const method = req.method;
      const recordable = rules.shouldRecord({
        method,
        enabled: true, // isEnabled بالاتر چک شد
        recordMethods: rules.recordMethods(),
        logReads: rules.logsReads(),
      });
      if (!recordable) return;

      const { ip, userAgent } = fromRequest(req);
      const parsedRoute = rules.parsePath(req.originalUrl);

      // ⭐ موج ۱۲.۵: انتساب به مشتری — فقط از داده‌های همین درخواست
      //    (بدون هیچ کوئری؛ استنتاج گران‌تر در زمان flush انجام می‌شود).
      const customerId = rules.customerIdFromRequest({
        body: req.body,
        params: req.params,
        query: req.query,
        responseBody: capturedCustomerId
          ? { customer_id: capturedCustomerId }
          : null,
        entity: parsedRoute.entity,
        // برای POST شناسه در URL نیست؛ از پاسخ خوانده می‌شود
        entityId: parsedRoute.entityId || capturedEntityId,
      });

      activityService.record(
        rules.buildEntry({
          method,
          originalUrl: req.originalUrl,
          routePath: routePattern(req),
          statusCode: res.statusCode,
          actor: req.user || capturedActor || null,
          actorHint: actorHintFrom(req.body),
          ip,
          userAgent,
          sessionId: req.sessionId || null,
          durationMs: durationMsSince(startedAt),
          details: rules.buildDetails(req.body, {
            logValues: rules.logsValues(),
          }),
          authEvent,
          entityIdHint: capturedEntityId,
          customerId,
        }),
      );
    } catch (error) {
      // ثبت لاگ هرگز نباید پاسخ کاربر را خراب کند
      console.warn("⚠️ خطا در ثبت ردّ فعالیت:", error.message);
    }
  });

  next();
};

module.exports = activityLog;
module.exports.activityLog = activityLog;
module.exports.shouldSkip = shouldSkip;
module.exports.fromRequest = fromRequest;
module.exports.actorHintFrom = actorHintFrom;
module.exports.routePattern = routePattern;
