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
// POST /api/users/login         → "login" (مرحلهٔ ۱: رمز)
// POST /api/users/login/verify  → "login" (مرحلهٔ ۲: کد پیامکی — فاز ۱۳.۱)
// POST /api/users/logout        → "logout"
const isAuthEvent = (path) => {
  const clean = String(path || "").toLowerCase();
  if (!clean) return null;
  // ⚠️ باید قبل از الگوی «/login$» بیاید (چون مسیر طولانی‌تر است)
  if (/\/users\/login\/verify$/.test(clean)) return "login";
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

// ===== هویتِ «ورود موفق» از بدنهٔ پاسخ =====
// روت ورود عمومی است ⇒ req.user خالی می‌ماند و کاربرِ واردشده فقط داخل
// پاسخ است: { data: { user: {...}, token } }. توکن هرگز برداشته نمی‌شود.
const actorFromPayload = (body) => {
  if (!body || typeof body !== "object") return null;
  const candidates = [body.data?.user, body.user, body.data];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const id = candidate.id ?? candidate.user_id ?? null;
    if (!id) continue;
    return {
      id,
      username: candidate.username ?? null,
      role: candidate.role ?? null,
    };
  }
  return null;
};

// ===== شناسهٔ رکوردِ ساخته‌شده از بدنهٔ پاسخ (فاز ۱۲.۴.۲) =====
// چرا؟ برای POST هیچ شناسه‌ای در URL نیست (`POST /api/users`) ⇒ ردیف با
// entity_id=null ذخیره می‌شد و تب «تغییرات این رکورد» برای رکورد تازه‌ساخته‌شده
// خالی می‌ماند. پاسخِ موفق شناسه را دارد:
//   { data: { id: 12 } } · { id: 9 } · { data: { user: { id: 3 } } } …
// ⚠️ فقط کلیدهای شناخته‌شده خوانده می‌شود (نه هر کلیدی) تا بدنهٔ بزرگ/تصادفی
//    ستون entity_id را آلوده نکند؛ و مقدار باید «عدد مثبت» یا UUID باشد.
const ENTITY_ID_KEYS = [
  "id",
  "entity_id",
  "user_id",
  "customer_id",
  "hall_id",
  "flock_id",
];
const ENTITY_ID_CONTAINERS = ["user", "customer", "hall", "flock", "unit"];

const normalizeEntityId = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? String(value) : null;
  }
  // آبجکت/آرایه/تابع هرگز شناسه نیست (بدنهٔ نامعتبر نباید ستون را آلوده کند)
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > MAX_ENTITY_ID) return null;
  if (/^\d+$/.test(text)) return Number(text) > 0 ? text : null;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
  ) {
    return text;
  }
  return null;
};

const entityIdFromPayload = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  // صریح‌ترین شکل: { entity_id } / { data: { entity_id } }
  const explicit = normalizeEntityId(body.entity_id ?? body.data?.entity_id);
  if (explicit) return explicit;

  const containers = [body, body.data];
  for (const container of containers) {
    if (!container || typeof container !== "object" || Array.isArray(container)) {
      continue;
    }

    for (const key of ENTITY_ID_KEYS) {
      const candidate = normalizeEntityId(container[key]);
      if (candidate) return candidate;
    }

    for (const key of ENTITY_ID_CONTAINERS) {
      const nested = container[key];
      if (!nested || typeof nested !== "object" || Array.isArray(nested)) continue;
      const candidate = normalizeEntityId(nested.id);
      if (candidate) return candidate;
    }
  }

  return null;
};

// ===== شناسهٔ مشتریِ مرتبط (موج ۱۲.۵) =====
// چرا؟ «همهٔ تغییرات این مشتری» بدون ستون customer_id ممکن نبود: ردیف سالن/
// گله/هفته‌نامه فقط entity_id خودش را داشت. این تابع همان انتساب را از
// بدنهٔ درخواست (که فرانت‌اند از قبل customer_id را می‌فرستد) می‌گیرد.
//   ⚠️ خودانتسابی: روی خودِ مشتری (entity=customers) ⇒ customer_id=entity_id
//   ⚠️ فقط عدد صحیح مثبت؛ UUID/رشته/آبجکت ⇒ null (ستون INTEGER است)
const CUSTOMER_ID_KEYS = ["customer_id", "customerId"];
const MAX_CUSTOMER_ID = 2147483647; // سقف INTEGER پستگرس

const normalizeCustomerId = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 && value <= MAX_CUSTOMER_ID
      ? value
      : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || !/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_CUSTOMER_ID
    ? parsed
    : null;
};

// اولین شناسهٔ مشتریِ معتبر از یک آبجکت (بدنه/پارام/کوئری)
const customerIdFromContainer = (container) => {
  if (!container || typeof container !== "object" || Array.isArray(container)) {
    return null;
  }
  for (const key of CUSTOMER_ID_KEYS) {
    const candidate = normalizeCustomerId(container[key]);
    if (candidate) return candidate;
  }
  // شکل تودرتو: { customer: { id } }
  const nested = container.customer;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const candidate = normalizeCustomerId(nested.id);
    if (candidate) return candidate;
  }
  return null;
};

/**
 * انتساب ردیف به مشتری.
 * اولویت (مستند و ثابت):
 *   ۱) خودِ مشتری  : entity==="customers" ⇒ entity_id یا entityIdHint
 *   ۲) بدنهٔ درخواست: customer_id / customerId / customer.id
 *   ۳) پارامتر مسیر : customerId / customer_id
 *   ۴) query        : customer_id / customerId
 *   ۵) بدنهٔ پاسخ   : customer_id / customerId (برای POST که بدنه ندارد)
 * هر مقدار نامعتبر ⇒ null (نه استثنا).
 */
const customerIdFromRequest = ({
  body = null,
  params = null,
  query = null,
  responseBody = null,
  entity = null,
  entityId = null,
} = {}) => {
  if (String(entity || "") === "customers") {
    const self = normalizeCustomerId(entityId);
    if (self) return self;
  }

  const fromBody = customerIdFromContainer(body);
  if (fromBody) return fromBody;

  const fromParams = customerIdFromContainer(params);
  if (fromParams) return fromParams;

  const fromQuery = customerIdFromContainer(query);
  if (fromQuery) return fromQuery;

  const fromResponse = customerIdFromContainer(
    responseBody?.data && typeof responseBody.data === "object"
      ? responseBody.data
      : responseBody,
  );
  if (fromResponse) return fromResponse;

  return null;
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
  entityIdHint = null,
  customerId = null,
}) => {
  const { path, entity, entityId } = parsePath(originalUrl);
  const normalizedMethod = normalizeMethod(method) || "GET";
  // ⭐ اگر فراخوان رویداد ورود/خروج را پاس نداد، خودمان از مسیر تشخیص می‌دهیم
  //    (یک منبع حقیقت: isAuthEvent) — وگرنه ورود با action="create" ثبت می‌شد.
  const resolvedAuthEvent = authEvent || isAuthEvent(path);
  const action = actionFor(normalizedMethod, resolvedAuthEvent);
  const success = isSuccess(statusCode);

  // ⭐ شناسهٔ رکورد: اولویت با مسیر (PUT/DELETE مثل قبل) و اگر مسیر شناسه
  //    نداشت (POST) از بدنهٔ پاسخ گرفته می‌شود (فاز ۱۲.۴.۲).
  const resolvedEntityId = entityId
    ? clip(entityId, MAX_ENTITY_ID)
    : normalizeEntityId(entityIdHint);

  // برای ورود ناموفق (یا درخواست بدون هویت) نامِ تلاش‌شده را نگه می‌داریم
  const username = actor?.username || actorHint || null;

  // ⭐ انتساب به مشتری (موج ۱۲.۵): مقدارِ آماده از میدل‌ور می‌آید؛ اگر
  //    نرسید، خودمان از همین مسیر/بدنه تلاش می‌کنیم (خودانتسابی مشتری).
  const resolvedCustomerId =
    normalizeCustomerId(customerId) ||
    (entity === "customers" ? normalizeCustomerId(resolvedEntityId) : null);

  return {
    user_id: actor?.id ?? null,
    username: clip(username, MAX_USERNAME),
    role: clip(actor?.role, MAX_ROLE),
    action,
    method: normalizedMethod,
    path: clip(path, MAX_PATH),
    route: clip(routePath, MAX_ROUTE),
    entity: clip(entity, MAX_ENTITY),
    entity_id: resolvedEntityId,
    customer_id: resolvedCustomerId,
    status_code: Number.isFinite(Number(statusCode)) ? Number(statusCode) : null,
    success,
    ip: clip(ip, MAX_IP),
    user_agent: clip(userAgent, MAX_USER_AGENT),
    session_id: clip(sessionId, MAX_SESSION_ID),
    fields: details,
    summary: describeEvent({
      action,
      entity,
      entityId: resolvedEntityId,
      success,
      statusCode,
    }),
    duration_ms: Number.isFinite(Number(durationMs)) ? Number(durationMs) : null,
  };
};

// ===== نمایش یک ردیف برای API (⚠️ session_id هرگز بیرون نمی‌رود) =====
const buildItem = (row, now = Date.now()) => {
  const plain = row?.toJSON ? row.toJSON() : row || {};
  // ⚠️ نمونهٔ Sequelize کلید `createdAt` می‌دهد (underscored فقط نام ستون است)
  //    و ردیف خام دیتابیس `created_at` ⇒ هر دو پوشش داده می‌شوند.
  const rawCreatedAt = plain.created_at ?? plain.createdAt ?? null;
  const createdAt = rawCreatedAt ? new Date(rawCreatedAt) : null;
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
    // ⭐ موج ۱۲.۵: مشتریِ مرتبط (برای تب «همهٔ تغییرات این مشتری» و deep-link)
    customer_id: normalizeCustomerId(plain.customer_id),
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
  actorFromPayload,
  entityIdFromPayload,
  normalizeEntityId,
  normalizeCustomerId,
  customerIdFromRequest,
  buildEntry,
  buildItem,
  buildSummary,
};

