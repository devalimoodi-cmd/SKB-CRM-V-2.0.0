// ============================================================
// features/activity-log/activity-log.view.js
// «فعالیت کاربران» — منطق خالص و بدون DOM (فاز ۱۲.۳)
// ------------------------------------------------------------
//  ⭐ چرا از رندرر جدا است؟
//     • بدون مرورگر قابل آزمون است (گیت: test:activity:panel)
//     • باگ‌های واقعی همین‌جا گرفته می‌شوند:
//        ۱) فیلتر success=false که با `if (success)` ساده گم می‌شد
//        ۲) CSV بدون BOM ⇒ متن فارسی در اکسل به‌هم‌ریخته باز می‌شد
//        ۳) «لینک مرده» به رکوردی که صفحهٔ مقصد یا مجوزش را ندارد
//        ۴) زمان نسبی خام («۳۷۲۵ ثانیه پیش») به‌جای «یک ساعت پیش»
//  ⚠️ این فایل هیچ عنصری از DOM را لمس نمی‌کند (هم‌الگوی
//     Backend/services/activityRules.js).
// ============================================================
import { toPersianNumber } from "../../core/utils/string.utils.js";
import { convertPersianToGregorian } from "../../core/utils/date.utils.js";

// ===== الگوی تاریخ میلادیِ استاندارد (آنچه به API می‌رود) =====
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// ===== ورودی فیلتر تاریخ (متن شمسی) ⇒ ISO میلادی (موج ۱۲.۴.۲) =====
//  • «۱۴۰۴/۰۸/۱۲» یا «1404/8/12» (اسلش) ⇒ تاریخ شمسی، تبدیل می‌شود
//  • «2025-11-03» (خط تیره) ⇒ همان ISO میلادی، دست‌نخورده برمی‌گردد
//  • نامعتبر ⇒ متن خام برمی‌گردد تا validateFilters خطای روشن بدهد
//    (هرگز بازهٔ غلط بی‌سرصدا به API نمی‌رود)
export const persianDateFilterToIso = (value) => {
  const raw = text(value);
  if (!raw) return "";
  if (ISO_DATE.test(raw)) return raw;

  const iso = convertPersianToGregorian(raw);
  if (!iso) return raw;

  // محافظ منطقی: تاریخ شمسیِ درست به میلادیِ ۱۹۰۰..۲۲۰۰ می‌رسد؛
  // اگر نه، ورودی معنادار نبوده (مثلاً کاربر خودش میلادی با اسلش نوشته).
  const year = Number(iso.slice(0, 4));
  return year >= 1900 && year <= 2200 ? iso : raw;
};

// ===== عنوان فارسی عمل‌ها (هم‌راستا با ACTION_TITLES بک‌اند) =====
export const ACTION_LABELS = {
  create: "ایجاد",
  update: "ویرایش",
  delete: "حذف",
  read: "مشاهده",
  login: "ورود",
  logout: "خروج",
};

// ===== عنوان فارسی نقش‌ها (خروجی actor.role در API) =====
const ROLE_LABELS = {
  super_admin: "مدیر اصلی",
  admin: "مدیر",
  sub_admin: "مدیر میانی",
  expert: "کارشناس",
  customer: "مشتری",
};

// ===== حالت خالی فیلترها (یک منبع برای «پاک‌کردن فیلترها») =====
export const EMPTY_FILTERS = {
  action: "",
  success: "",
  userId: "",
  entity: "",
  entityId: "",
  // ⭐ موج ۱۲.۵ — «همهٔ تغییرات یک مشتری»
  customerId: "",
  from: "",
  to: "",
};

const text = (value) => String(value ?? "").trim();

const toInt = (value) => {
  const n = Number(text(value));
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

// ⭐ موج ۱۲.۵: شناسهٔ مشتری باید «عدد صحیحِ خالص» باشد
//   (toInt عمداً ۱.۵ را به ۱ می‌بُرد ⇒ فیلتر روی مشتریِ اشتباه اعمال می‌شد؛
//    ستون سمت سرور INTEGER است و مقدار اعشاری/کاما آنجا نادیده گرفته می‌شود.)
const toIdInt = (value) => {
  const raw = text(value);
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

// ===== فیلتر UI → ورودی activityService.list =====
//   ⚠️ success باید boolean بماند؛ `success === false` با if ساده حذف
//      می‌شد و «فقط ناموفق‌ها» بی‌سرصدا به «همه» تبدیل می‌شد.
export const buildQuery = (filters = {}, { page = 1, limit = 25 } = {}) => {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const query = {
    page: toInt(page) || 1,
    limit: toInt(limit) || 25,
  };

  if (text(f.action)) query.action = text(f.action);
  if (text(f.entity)) query.entity = text(f.entity);
  if (text(f.entityId)) query.entityId = text(f.entityId);
  if (text(f.from)) query.from = text(f.from);
  if (text(f.to)) query.to = text(f.to);

  const userId = toInt(f.userId);
  if (userId) query.userId = userId;

  // ⭐ موج ۱۲.۵: فیلتر مشتری (ستون INTEGER سمت سرور)
  const customerId = toIdInt(f.customerId);
  if (customerId) query.customerId = customerId;

  if (f.success === true || f.success === "true") query.success = true;
  else if (f.success === false || f.success === "false") query.success = false;

  return query;
};

// ===== اعتبارسنجی سبک سمت کلاینت (خطای سرور را زودتر به کاربر می‌گوییم) =====
export const validateFilters = (filters = {}) => {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  const errors = [];

  if (text(f.userId) && !toInt(f.userId)) {
    errors.push("«شناسهٔ کاربر» باید عددی بزرگ‌تر از صفر باشد");
  }

  // ⭐ موج ۱۲.۵: همان قاعده برای مشتری (ستون INTEGER است)
  if (text(f.customerId) && !toIdInt(f.customerId)) {
    errors.push("«شناسهٔ مشتری» باید عددی بزرگ‌تر از صفر باشد");
  }

  // ⭐ موج ۱۲.۴.۲: فقط ISO میلادی به API می‌رود. تاریخ شمسی/نامعتبر باید
  //    همین‌جا خطا بدهد، وگرنه بازه بی‌سرصدا نتیجهٔ خالی برمی‌گرداند.
  const from = text(f.from);
  const to = text(f.to);
  if (from && !ISO_DATE.test(from)) {
    errors.push("تاریخ «از» معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱)");
  }
  if (to && !ISO_DATE.test(to)) {
    errors.push("تاریخ «تا» معتبر نیست (نمونه: ۱۴۰۴/۰۱/۰۱)");
  }
  if (ISO_DATE.test(from) && ISO_DATE.test(to) && from > to) {
    errors.push("تاریخ «از» نباید بعد از تاریخ «تا» باشد");
  }

  return errors;
};

// ===== تعداد فیلترهای فعال (نشان «فیلتر فعال» کنار دکمهٔ پاک‌کردن) =====
export const activeFilterCount = (filters = {}) => {
  const f = { ...EMPTY_FILTERS, ...(filters || {}) };
  return Object.keys(EMPTY_FILTERS).filter((key) => text(f[key]) !== "").length;
};


// ===== زمان نسبی فارسی از seconds_ago سرور =====
//   سرور `seconds_ago` می‌دهد (نه محاسبهٔ سمت کلاینت) تا ساعتِ مرورگر
//   کاربر نتیجه را منحرف نکند.
export const timeAgo = (seconds) => {
  // ⚠️ null/"" با Number به ۰ تبدیل می‌شوند و «چند لحظه پیش» دروغ می‌شد
  if (seconds === null || seconds === undefined || seconds === "") return "—";

  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "—";
  if (s < 60) return "چند لحظه پیش";

  const minutes = Math.floor(s / 60);
  if (minutes < 60) return `${toPersianNumber(minutes)} دقیقه پیش`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toPersianNumber(hours)} ساعت پیش`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${toPersianNumber(days)} روز پیش`;

  return `${toPersianNumber(Math.floor(days / 30))} ماه پیش`;
};

// ===== برچسب بازیگر: «نام (نقش)» یا «ناشناس» =====
export const actorLabel = (actor = {}) => {
  const username = text(actor?.username);
  if (!username) return "ناشناس";
  const role = ROLE_LABELS[actor?.role] || "";
  return role ? `${username} (${role})` : username;
};

// ===== فیلدهای تغییرکرده (بدون مقدار — حریم خصوصی) =====
//   با ACTIVITY_LOG_VALUES=false سرور فقط «نام فیلدها» را ذخیره می‌کند؛
//   اگر روزی مقدارها هم فعال شوند، این‌جا باز هم فقط کلیدها نمایش داده می‌شوند.
export const fieldsChips = (fields) => {
  if (!fields) return [];
  if (Array.isArray(fields)) return fields.map((item) => String(item));
  if (typeof fields === "object") return Object.keys(fields);
  return [];
};

// ===== گزینه‌های فیلتر «نوع عمل» از خلاصهٔ سرور =====
export const buildActionOptions = (byAction = {}, selected = "") => {
  const counts = byAction && typeof byAction === "object" ? byAction : {};
  const keys = new Set([...Object.keys(ACTION_LABELS), ...Object.keys(counts)]);
  return Array.from(keys)
    .filter(Boolean)
    .map((value) => ({
      value,
      label: ACTION_LABELS[value] || value,
      count: Number(counts[value] || 0),
      selected: value === selected,
    }));
};

// ===== CSV (خروجی اکسل) =====
//   ⚠️ BOM لازم است وگرنه اکسل فایل را ANSI می‌خواند و فارسی خراب می‌شود.
const CSV_HEADERS = [
  "شناسه",
  "زمان",
  "کاربر",
  "نقش",
  "عمل",
  "موجودیت",
  "شناسهٔ موجودیت",
  "متد",
  "وضعیت",
  "خلاصه",
  "آی‌پی",
];

const csvCell = (value) => {
  const raw = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
};

export const buildCsv = (items = []) => {
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const actor = item?.actor || {};
    return [
      item?.id,
      item?.at,
      actor.username || "ناشناس",
      ROLE_LABELS[actor.role] || actor.role || "",
      item?.action_title || ACTION_LABELS[item?.action] || item?.action || "",
      item?.entity_title || item?.entity || "",
      item?.entity_id,
      item?.method,
      item?.status_label,
      item?.summary,
      item?.ip,
    ].map(csvCell);
  });

  return (
    "\uFEFF" +
    [CSV_HEADERS.join(","), ...rows.map((row) => row.join(","))].join("\r\n")
  );
};

// ===== لینک رکورد هدف (allowlist کوچک و قابل گسترش) =====
//   فقط موجودیت‌هایی که «صفحهٔ مقصد واقعی» دارند لینک می‌گیرند؛ بقیه «—»
//   می‌مانند تا هیچ لینک مرده‌ای ساخته نشود.
//   ⚠️ مجوز مقصد هم سنجیده می‌شود (تابع can تزریق می‌شود تا این فایل خالص بماند).
//   ⭐ موج ۱۲.۵: موجودیت‌های زیرمجموعهٔ مشتری (سالن/گله/هفته‌نامه/بازدید)
//      صفحهٔ اختصاصی ندارند؛ مقصدشان «پروندهٔ مشتری» است و پارامترشان
//      customer_id ردیف (نه entity_id) ⇒ usesCustomer: true.
const DEEP_LINK_RULES = {
  customers: {
    path: "/pages/customer-info.html",
    param: "id",
    permission: "customer.basic.view",
    label: "مشاهدهٔ پروندهٔ مشتری",
  },
  halls: {
    path: "/pages/customer-info.html",
    param: "id",
    permission: "customer.basic.view",
    label: "پروندهٔ مشتری این سالن",
    usesCustomer: true,
  },
  flocks: {
    path: "/pages/customer-info.html",
    param: "id",
    permission: "customer.basic.view",
    label: "پروندهٔ مشتری این گله",
    usesCustomer: true,
  },
  weekly: {
    path: "/pages/customer-info.html",
    param: "id",
    permission: "customer.basic.view",
    label: "پروندهٔ مشتری این هفته‌نامه",
    usesCustomer: true,
  },
  "visit-reports": {
    path: "/pages/customer-info.html",
    param: "id",
    permission: "customer.basic.view",
    label: "پروندهٔ مشتری این بازدید",
    usesCustomer: true,
  },
};

export const deepLinkFor = (item = {}, can = () => true) => {
  const rule = DEEP_LINK_RULES[item?.entity];
  if (!rule) return null;

  // برای زیرمجموعه‌ها شناسهٔ مشتری مقصد است؛ برای خود مشتری، entity_id
  const rawId = rule.usesCustomer ? item?.customer_id : item?.entity_id;
  const targetId = rule.usesCustomer ? toInt(rawId) : text(rawId);
  if (!targetId) return null;
  if (typeof can === "function" && !can(rule.permission)) return null;

  return {
    href: `${rule.path}?${rule.param}=${encodeURIComponent(targetId)}`,
    label: rule.label,
    permission: rule.permission,
  };
};

// ============================================================
// موج ۱۲.۴.۱ — «تاریخچه در بستر» (منطق خالص، بدون DOM)
// ------------------------------------------------------------
//  ⭐ مسئلهٔ واقعی: ردّ فعالیت از ۱۲.۳ در پنل دیده می‌شد، ولی برای
//     پاسخ به «چه کسی این رکورد را عوض کرد؟» کاربر باید خودش منو را
//     باز می‌کرد و فیلترها را دستی می‌زد ⇒ در عمل هیچ‌کس این کار را
//     نمی‌کرد و ردّ فعالیت دوباره «دادهٔ بی‌مصرف» می‌شد.
//  • historyContext    : نرمال‌سازی + برش هم‌سقف سرور
//  • historyQuery      : زمینه → فیلتر مجاز (allowlist کلید)
//  • historyTitle/Stats: عنوان و «۱۲ رویداد · ۲ ناموفق · آخرین: …»
//  • pack/readHandoff  : پل امن «پروندهٔ مشتری → پنل» روی sessionStorage
//  ⚠️ هر ورودی از بیرون (URL/sessionStorage) نامعتبر ⇒ null (نه استثنا).
// ============================================================

// سقف‌ها هم‌راستا با اعتبارسنجی سرور (طول entity/entity_id در API)
const MAX_ENTITY = 80;
const MAX_ENTITY_ID = 64;
const MAX_TITLE = 120;
const MAX_HANDOFF_LENGTH = 600;

export const HISTORY_LIMIT = 20;

export const HISTORY_MODES = {
  changes: "تغییرات این رکورد",
  actor: "فعالیت‌های این کاربر",
  // ⭐ موج ۱۲.۵ — «همهٔ تغییرات یک مشتری» (سالن/گله/هفته‌نامه/بازدید + خود مشتری)
  customer: "همهٔ تغییرات این مشتری",
};

// کلید یک‌بارمصرف پل بین صفحه‌ها
export const HISTORY_HANDOFF_KEY = "skb_activity_history";

const cut = (value, max) => text(value).slice(0, max);

// ===== زمینهٔ «تاریخچه» =====
//   ⭐ شناسهٔ موجودیت یا شناسهٔ مشتری لازم است؛ بدون هیچ‌کدام هیچ فیلتری
//      معنا ندارد (همان اشتباهی که فیلترِ خالی می‌فرستد و کل تاریخچه را
//      می‌آورد). ⚠️ این گارد از ۱۲.۴.۱ دست‌نخورده می‌ماند: زمینهٔ خالی ⇒ null.
//   ⭐ موج ۱۲.۵: customerId اختیاری است و تب سوم را فعال می‌کند؛ اگر
//      entityId بیاید ولی entity نباشد، زمینه بی‌معناست ⇒ null.
export const historyContext = (input = {}) => {
  const source = input && typeof input === "object" ? input : {};
  const entity = cut(source.entity, MAX_ENTITY);
  const entityId = cut(source.entityId, MAX_ENTITY_ID);
  const customerId = toIdInt(source.customerId);
  if (!entityId && !customerId) return null;
  if (entityId && !entity) return null;

  return {
    entity,
    entityId,
    customerId,
    userId: toInt(source.userId),
    title: cut(source.title, MAX_TITLE),
  };
};

// ===== زمینه → فیلتر (فقط کلیدهای مجاز بیرون می‌روند) =====
export const historyQuery = (ctx, mode = "changes") => {
  if (!ctx) return null;

  // تب «فعالیت‌های این کاربر»: فقط user_id (شامل ورود/خروج)
  //   ⚠️ بدون userId ⇒ به «تغییرات این رکورد» برمی‌گردد (رفتار ۱۲.۴)
  if (mode === "actor") {
    const userId = toInt(ctx.userId);
    if (userId) return { userId };
  }

  // تب «همهٔ تغییرات این مشتری»: فقط customer_id (موج ۱۲.۵)
  //   ⚠️ بدون customerId ⇒ همان fallback بالا (برگشت به «تغییرات»)
  if (mode === "customer") {
    const customerId = toInt(ctx.customerId);
    if (customerId) return { customerId };
  }

  if (!ctx.entity || !ctx.entityId) return null;
  return { entity: ctx.entity, entityId: ctx.entityId };
};

const contextLabel = (ctx) => {
  if (!ctx) return "";
  if (text(ctx.title)) return text(ctx.title);
  if (text(ctx.entityId)) {
    return text(ctx.entity) === "customers"
      ? `مشتری #${text(ctx.entityId)}`
      : `#${text(ctx.entityId)}`;
  }
  return ctx.customerId ? `مشتری #${text(ctx.customerId)}` : "";
};

export const historyTitle = (ctx, mode = "changes") => {
  const label = contextLabel(ctx);
  if (!label) return "";

  if (mode === "actor") return `فعالیت‌های ${label}`;
  if (mode === "customer") return `همهٔ تغییرات ${label}`;
  return `تاریخچهٔ تغییرات ${label}`;
};

// ===== آمار یک‌خطیِ بالای فهرست تاریخچه =====
export const historyStats = (items = []) => {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  const total = list.length;
  const failed = list.filter((item) => item.success === false).length;

  if (!total) {
    return {
      total: 0,
      failed: 0,
      hasFailure: false,
      lastAgo: "",
      label: "رویدادی ثبت نشده",
    };
  }

  const lastAgo = timeAgo(list[0]?.seconds_ago);
  return {
    total,
    failed,
    hasFailure: failed > 0,
    lastAgo,
    label: `${toPersianNumber(total)} رویداد · ${toPersianNumber(failed)} ناموفق · آخرین: ${lastAgo}`,
  };
};

// ===== پل بین صفحه‌ها (sessionStorage) =====
//   ⚠️ allowlist کلید: حتی اگر کسی دادهٔ دستکاری‌شده بنویسد، فقط همین
//      پنج کلید خوانده می‌شود (ضدِ prototype pollution و ضدِ فیلتر جعلی).
//      ⭐ customerId در موج ۱۲.۵ اضافه شد تا تب «همهٔ تغییرات این مشتری»
//      پس از انتقال بین صفحه‌ها هم زنده بماند.
const HANDOFF_KEYS = ["entity", "entityId", "customerId", "userId", "title"];

export const packHistoryHandoff = (ctx) => {
  const safe = historyContext(ctx);
  if (!safe) return "";

  const payload = {};
  HANDOFF_KEYS.forEach((key) => {
    const value = safe[key];
    if (value !== null && value !== undefined && value !== "") {
      payload[key] = value;
    }
  });

  try {
    return JSON.stringify(payload);
  } catch {
    return "";
  }
};

export const readHistoryHandoff = (raw) => {
  const value = text(raw);
  if (!value || value.length > MAX_HANDOFF_LENGTH || value[0] !== "{") {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const picked = {};
    HANDOFF_KEYS.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) return;
      const item = parsed[key];
      if (item === null || item === undefined) return;
      if (typeof item === "object" || typeof item === "function") return;
      picked[key] = item;
    });

    return historyContext(picked);
  } catch {
    return null;
  }
};
