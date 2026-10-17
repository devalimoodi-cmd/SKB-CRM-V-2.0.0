"use strict";

// ============================================================
// services/activityRules.js
// «ردّ فعالیت» (Activity Log) — منطق خالص، بدون دیتابیس (فاز ۱۲.۲)
// ------------------------------------------------------------
// ⭐ این فایل هیچ `require`ای ندارد (نه دیتابیس، نه express) تا:
//   • در گیت/تست بدون هیچ استابی قابل آزمون باشد
//   • هرگز باعث وابستگی حلقه‌ای نشود
// ------------------------------------------------------------
// چه چیزی «فعالیت» است؟
//   هر تغییرِ وضعیت (POST/PUT/PATCH/DELETE) + ورود/خروج.
//   خواندن‌ها (GET) به‌طور پیش‌فرض ثبت نمی‌شوند (ACTIVITY_LOG_READS=false)
//   چون حجم ردّ فعالیت را چند برابر می‌کنند بدون ارزشِ حسابرسی.
// ------------------------------------------------------------
// ⚠️ حریم خصوصی داده‌ها:
//   پیش‌فرض ACTIVITY_LOG_VALUES=false است ⇒ فقط «نام فیلدها» ذخیره می‌شود،
//   نه مقدارشان. حتی در حالت true، فیلدهای حساس (رمز/توکن/کپچا) با
//   MASKED_VALUE جایگزین می‌شوند تا رمز هرگز در دیتابیس نیفتد.
// ============================================================

// ===== متدهای HTTP =====
const READ_METHODS = ["GET", "HEAD", "OPTIONS"];
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const ALL_METHODS = [...READ_METHODS, ...WRITE_METHODS];

// ===== پیش‌فرض‌ها =====
const DEFAULT_ENABLED = true;
const DEFAULT_RECORD_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const DEFAULT_LOG_VALUES = false;
const DEFAULT_LOG_READS = false;
const DEFAULT_FLUSH_MS = 700;
const DEFAULT_BUFFER_MAX = 500;
const DEFAULT_RETENTION_DAYS = 180;
const DEFAULT_PURGE_INTERVAL_HOURS = 24;
const DEFAULT_MAX_FIELDS = 40;

// ===== سقف طول ستون‌ها (هم‌راستا با مایگریشن/مدل) =====
const MAX_PATH = 300;
const MAX_ROUTE = 300;
const MAX_ENTITY = 80;
const MAX_ENTITY_ID = 64;
const MAX_USERNAME = 100;
const MAX_ROLE = 20;
const MAX_IP = 64;
const MAX_USER_AGENT = 500;
const MAX_SESSION_ID = 64;
const MAX_SUMMARY = 500;
const MAX_VALUE_LENGTH = 200;

// ===== عنوان‌های فارسی =====
const ACTION_TITLES = {
  create: "ایجاد",
  update: "ویرایش",
  delete: "حذف",
  read: "مشاهده",
  login: "ورود",
  logout: "خروج",
};

const SUCCESS_LABEL = "موفق";
const FAILURE_LABEL = "ناموفق";

const UNKNOWN_ACTOR = "ناشناس";

// نگاشت متد → عمل اصلی (وقتی رویداد احراز هویت نیست)
const ACTION_FOR_METHOD = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
  GET: "read",
};

// ===== فیلدهای حساس (هرگز مقدارشان ذخیره نمی‌شود) =====
const MASKED_VALUE = "***";
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|captcha|otp|authorization|api[_-]?key)/i;

// ===== عنوان فارسی «موجودیت» (اولین بخش مسیر بعد از /api) =====
const ENTITY_TITLES = {
  users: "کاربر",
  auth: "احراز هویت",
  sessions: "نشست",
  activity: "ردّ فعالیت",
  presence: "حضور",
  customers: "مشتری",
  units: "واحد",
  halls: "سالن",
  flocks: "گله",
  "flock-completions": "پایان دوره",
  "chick-placements": "جوجه‌ریزی",
  weekly: "مدیریت هفتگی",
  "visit-reports": "گزارش بازدید",
  bookmarks: "بوکمارک",
  suggestions: "نظرات و پیشنهادات",
  releases: "تغییرات جدید",
  permissions: "سطوح دسترسی",
  settings: "تنظیمات",
  dictionary: "دیکشنری",
  "breed-standards": "استاندارد وزنی",
  sms: "پیامک",
  cities: "شهر",
  dashboard: "داشبورد",
  weather: "آب‌وهوا",
  uploads: "فایل",
  "customer-personal-information": "اطلاعات مشتری",
};

// ===== ابزارهای خواندن تنظیمات از env =====
const readBool = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return fallback;
};

const readPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const readNonNegativeInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

// نرمال‌سازی نام متد (بزرگ‌حرف/بی‌فاصله) — null اگر نامعتبر باشد
const normalizeMethod = (value) => {
  const method = String(value || "").trim().toUpperCase();
  return ALL_METHODS.includes(method) ? method : null;
};

// تبدیل "POST, put ,DELETE" یا آرایه ⇒ آرایهٔ متدهای معتبر
const parseMethods = (value, fallback = DEFAULT_RECORD_METHODS) => {
  const source = Array.isArray(value) ? value : String(value || "").split(",");
  const methods = source.map(normalizeMethod).filter(Boolean);
  return methods.length > 0 ? Array.from(new Set(methods)) : [...fallback];
};

// ===== آیا این درخواست باید ثبت شود؟ =====
const shouldRecord = ({
  method,
  enabled = DEFAULT_ENABLED,
  recordMethods = DEFAULT_RECORD_METHODS,
  logReads = DEFAULT_LOG_READS,
}) => {
  if (!enabled) return false;
  const normalized = normalizeMethod(method);
  if (!normalized) return false;
  if (READ_METHODS.includes(normalized)) return logReads === true;
  return parseMethods(recordMethods).includes(normalized);
};

// ===== شناسایی رویداد ورود/خروج (مسیرِ بدون تغییر در کنترلر) =====
// POST /api/users/login  → "login"
// POST /api/users/logout → "logout"
const isAuthEvent = (path) => {
  const clean = String(path || "").toLowerCase();
  if (!clean) return null;
  if (/\/users\/login$/.test(clean) || /\/auth\/login$/.test(clean)) return "login";
  if (/\/users\/logout$/.test(clean) || /\/auth\/logout$/.test(clean)) return "logout";
  return null;
};

// ===== برش امن رشته (ستون‌های دیتابیس سقف دارند) =====
const clip = (value, max) => {
  if (value === undefined || value === null) return null;
  const text = String(value);
  return text.length > max ? text.slice(0, max) : text;
};

// ===== تجزیهٔ مسیر: path · query · entity · entity_id =====
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;

const parsePath = (originalUrl) => {
  const raw = String(originalUrl || "");
  const [withoutQuery] = raw.split("?");
  const path = withoutQuery.replace(/\/+$/, "") || "/";

  // حذف پیشوند /api (اگر باشد)
  const trimmed = path.replace(/^\/api(?=\/|$)/, "");
  const segments = trimmed.split("/").filter(Boolean);

  const entity = segments[0] || null;

  // شناسه: اولین بخشِ عددی/یو‌یو‌آی‌دی‌مانند بعد از موجودیت
  let entityId = null;
  for (let index = 1; index < segments.length; index += 1) {
    const segment = segments[index];
    if (/^\d+$/.test(segment) || UUID_LIKE.test(segment)) {
      entityId = segment;
      break;
    }
  }

  return { path, entity, entityId };
};

const entityTitle = (entity) => {
  if (!entity) return "سیستم";
  return ENTITY_TITLES[entity] || entity;
};

// ===== عمل (action) =====
const actionFor = (method, authEvent = null) => {
  if (authEvent) return authEvent;
  return ACTION_FOR_METHOD[normalizeMethod(method)] || "read";
};

const actionTitle = (action) => ACTION_TITLES[action] || action || "رویداد";

// ===== موفقیت‌آمیز بودن پاسخ =====
const isSuccess = (statusCode) => {
  const code = Number(statusCode);
  return Number.isFinite(code) && code >= 200 && code < 400;
};

const statusLabel = (success) => (success ? SUCCESS_LABEL : FAILURE_LABEL);

// ===== جزئیات بدنه: فقط نام فیلدها (مقدار فقط اگر ACTIVITY_LOG_VALUES=true) =====
const normalizeDetailValue = (value, logValues) => {
  if (!logValues) return null;
  if (value === null || value === undefined) return null;
  const type = typeof value;
  if (type === "string" || type === "number" || type === "boolean") {
    return clip(value, MAX_VALUE_LENGTH);
  }
  try {
    return clip(JSON.stringify(value), MAX_VALUE_LENGTH);
  } catch {
    return "[unserializable]";
  }
};

const buildDetails = (
  body,
  { logValues = DEFAULT_LOG_VALUES, maxFields = DEFAULT_MAX_FIELDS } = {},
) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const keys = Object.keys(body);
  const details = {};
  let kept = 0;

  for (const key of keys) {
    if (kept >= maxFields) break;
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      // ⛔ رمز/توکن هرگز ذخیره نمی‌شود (حتی در حالت recordValues)
      details[key] = MASKED_VALUE;
    } else {
      details[key] = normalizeDetailValue(body[key], logValues);
    }
    kept += 1;
  }

  return kept > 0 ? details : null;
};

// ===== شرح فارسی رویداد (برای نمایش سریع در پنل) =====
const describeEvent = ({ action, entity, entityId, success, statusCode }) => {
  const target = entityId ? `${entityTitle(entity)} #${entityId}` : entityTitle(entity);
  const base = `${actionTitle(action)} ${target}`;
  return clip(success ? base : `${base} — ناموفق (${statusCode})`, MAX_SUMMARY);
};

// ===== نام نمایشی کاربر (با fallback امن) =====
const actorName = (actor) => {
  if (!actor) return UNKNOWN_ACTOR;
  const full = [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim();
  return full || actor.username || UNKNOWN_ACTOR;
};

// ===== ساخت ردیف آمادهٔ ذخیره (نرمال‌سازی + برش) =====
const buildEntry = ({
  method,
  originalUrl,
  routePath = null,
  statusCode = null,
  actor = null,
  actorHint = null,
  ip = null,
  userAgent = null,
  sessionId = null,
  durationMs = null,
  details = null,
  authEvent = null,
}) => {
  const { path, entity, entityId } = parsePath(originalUrl);
  const normalizedMethod = normalizeMethod(method) || "GET";
  const action = actionFor(normalizedMethod, authEvent);
  const success = isSuccess(statusCode);

  // برای ورود ناموفق (یا درخواست بدون هویت) نامِ تلاش‌شده را نگه می‌داریم
  const username = actor?.username || actorHint || null;

  return {
    user_id: actor?.id ?? null,
    username: clip(username, MAX_USERNAME),
    role: clip(actor?.role, MAX_ROLE),
    action,
    method: normalizedMethod,
    path: clip(path, MAX_PATH),
    route: clip(routePath, MAX_ROUTE),
    entity: clip(entity, MAX_ENTITY),
    entity_id: clip(entityId, MAX_ENTITY_ID),
    status_code: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
    success,
    ip: clip(ip, MAX_IP),
    user_agent: clip(userAgent, MAX_USER_AGENT),
    session_id: clip(sessionId, MAX_SESSION_ID),
    fields: details,
    summary: describeEvent({
      action,
      entity,
      entityId,
      success,
      statusCode,
    }),
    duration_ms: Number.isFinite(Number(durationMs)) ? Number(durationMs) : null,
  };
};

// ===== نمایش یک ردیف برای API (⚠️ session_id هرگز بیرون نمی‌رود) =====
const buildItem = (row, now = Date.now()) => {
  const plain = row?.toJSON ? row.toJSON() : row || {};
  const createdAt = plain.created_at ? new Date(plain.created_at) : null;
  const success = plain.success === true;

  return {
    id: plain.id,
    at: createdAt ? createdAt.toISOString() : null,
    seconds_ago: createdAt
      ? Math.max(0, Math.round((now - createdAt.getTime()) / 1000))
      : null,
    action: plain.action,
    action_title: actionTitle(plain.action),
    method: plain.method,
    path: plain.path,
    route: plain.route,
    entity: plain.entity,
    entity_title: entityTitle(plain.entity),
    entity_id: plain.entity_id,
    status_code: plain.status_code,
    success,
    status_label: statusLabel(success),
    actor: {
      id: plain.user_id ?? null,
      username: plain.username || null,
      role: plain.role || null,
    },
    ip: plain.ip || null,
    user_agent: plain.user_agent || null,
    fields: plain.fields || null,
    summary: plain.summary || null,
    duration_ms: plain.duration_ms ?? null,
  };
};

// ===== خلاصهٔ آماری (سرِ پنل «فعالیت کاربران») =====
const buildSummary = (
  rows = [],
  { now = Date.now(), retentionDaysValue = null } = {},
) => {
  const byAction = {};
  const byEntity = {};
  const actors = new Set();
  let success = 0;
  let failed = 0;

  rows.forEach((row) => {
    const plain = row?.toJSON ? row.toJSON() : row || {};
    if (plain.success === true) success += 1;
    else failed += 1;

    const action = plain.action || "unknown";
    byAction[action] = (byAction[action] || 0) + 1;

    const entity = plain.entity || "unknown";
    byEntity[entity] = (byEntity[entity] || 0) + 1;

    if (plain.user_id !== null && plain.user_id !== undefined) {
      actors.add(String(plain.user_id));
    }
  });

  return {
    total: rows.length,
    success,
    failed,
    unique_actors: actors.size,
    by_action: byAction,
    by_entity: byEntity,
    generated_at: new Date(now).toISOString(),
    retention_days: retentionDaysValue,
  };
};

// ===== تنظیمات (در لحظهٔ فراخوانی خوانده می‌شود ⇒ تست‌پذیر) =====
const isEnabled = () =>
  readBool(process.env.ACTIVITY_LOG_ENABLED, DEFAULT_ENABLED);
const recordMethods = () =>
  parseMethods(process.env.ACTIVITY_RECORD_METHODS, DEFAULT_RECORD_METHODS);
const logsValues = () =>
  readBool(process.env.ACTIVITY_LOG_VALUES, DEFAULT_LOG_VALUES);
const logsReads = () =>
  readBool(process.env.ACTIVITY_LOG_READS, DEFAULT_LOG_READS);
const flushMs = () =>
  readPositiveInt(process.env.ACTIVITY_FLUSH_MS, DEFAULT_FLUSH_MS);
const bufferMax = () =>
  readPositiveInt(process.env.ACTIVITY_BUFFER_MAX, DEFAULT_BUFFER_MAX);
const retentionDays = () =>
  readPositiveInt(process.env.ACTIVITY_RETENTION_DAYS, DEFAULT_RETENTION_DAYS);
const purgeIntervalHours = () =>
  readNonNegativeInt(
    process.env.ACTIVITY_PURGE_INTERVAL_HOURS,
    DEFAULT_PURGE_INTERVAL_HOURS,
  );

// آیا این متد «تغییر وضعیت» است؟
const isMutation = (method) => WRITE_METHODS.includes(normalizeMethod(method));

// عکس لحظه‌ای تنظیمات (برای ذخیره در لاگ/پاسخ API)
const config = () => ({
  enabled: isEnabled(),
  record_methods: recordMethods(),
  log_values: logsValues(),
  log_reads: logsReads(),
  flush_ms: flushMs(),
  buffer_max: bufferMax(),
  retention_days: retentionDays(),
  purge_interval_hours: purgeIntervalHours(),
});

module.exports = {
  // ثابت‌ها
  READ_METHODS,
  WRITE_METHODS,
  ALL_METHODS,
  ACTION_TITLES,
  ENTITY_TITLES,
  SENSITIVE_KEY_PATTERN,
  MASKED_VALUE,
  UNKNOWN_ACTOR,
  DEFAULT_RECORD_METHODS,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_FLUSH_MS,
  DEFAULT_BUFFER_MAX,
  DEFAULT_PURGE_INTERVAL_HOURS,

  // تنظیمات
  isEnabled,
  recordMethods,
  logsValues,
  logsReads,
  flushMs,
  bufferMax,
  retentionDays,
  purgeIntervalHours,
  config,

  // کمکی‌ها
  readBool,
  readPositiveInt,
  readNonNegativeInt,
  parseMethods,
  normalizeMethod,
  shouldRecord,
  isMutation,
  isAuthEvent,
  parsePath,
  entityTitle,
  actionFor,
  actionTitle,
  isSuccess,
  statusLabel,
  actorName,
  clip,
  buildDetails,
  describeEvent,
  buildEntry,
  buildItem,
  buildSummary,
};

