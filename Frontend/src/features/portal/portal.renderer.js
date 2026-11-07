// ============================================================
// features/portal/portal.renderer.js
// رندر «پورتال مشتری» — بدون هیچ عملیات نوشتنی (فاز ۱۳.۲)
// ------------------------------------------------------------
//  ⭐ چرا رندرر جدا از سرویس؟
//     • خروجی HTML قابل بازرسی در گارد است (test:portal)
//     • همهٔ متن‌های ورودی از escapeHtml عبور می‌کنند
//       (نام مشتری/نام مزرعه توسط ادمین وارد می‌شود، نه کاربر؛
//        با این حال «اعتماد به دادهٔ ذخیره‌شده» عادت بدی است)
//  ❌ این فایل هیچ دکمهٔ «ایجاد/ویرایش/حذف» تولید نمی‌کند؛
//     پورتال ۱۳.۲ فقط خواندنی است.
// ============================================================
import { escapeHtml, toPersianNumber } from "../../core/utils/string.utils.js";
import { convertGregorianToPersian } from "../../core/utils/date.utils.js";

// ===== برچسب فارسی وضعیت‌ها (هم‌راستا با بک‌اند) =====
export const STATUS_LABELS = {
  active: "فعال",
  pending: "در انتظار",
  completed: "پایان‌یافته",
  cancelled: "لغو‌شده",
  inactive: "غیرفعال",
  unread: "خوانده‌نشده",
  read: "خوانده‌شده",
  archived: "بایگانی",
};

const text = (value) => (value === null || value === undefined ? "" : String(value));

// تاریخ میلادی ISO ⇒ شمسی کوتاه («۱۴۰۴/۰۸/۱۲»)
export const jalaliDate = (value) => {
  const iso = text(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const jalali = convertGregorianToPersian(iso);
  return jalali || "—";
};

// عدد با ارقام فارسی (null ⇒ «—»)
export const faNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return toPersianNumber(parsed);
};

export const statusLabel = (status) =>
  STATUS_LABELS[text(status).trim()] || text(status) || "—";

// ===== کارت‌های آماری (داده → مدل، بدون DOM) =====
export const counterCards = (counters = {}) => [
  {
    key: "halls",
    label: "سالن‌ها",
    value: counters.active_halls ?? 0,
    total: counters.halls ?? 0,
    icon: "fa-warehouse",
  },
  {
    key: "flocks",
    label: "گله‌های فعال",
    value: counters.active_flocks ?? 0,
    total: null,
    icon: "fa-egg",
  },
  {
    key: "weeks",
    label: "هفته‌های ثبت‌شده",
    value: counters.weeks_recorded ?? 0,
    total: null,
    icon: "fa-chart-line",
  },
  {
    key: "visits",
    label: "بازدیدهای خوانده‌نشده",
    value: counters.unread_visits ?? 0,
    total: null,
    icon: "fa-clipboard-list",
  },
];

export const renderCounters = (counters = {}) =>
  counterCards(counters)
    .map(
      (card) => `
      <article class="portal-kpi" data-kpi="${escapeHtml(card.key)}">
        <i class="fas ${escapeHtml(card.icon)} portal-kpi__icon" aria-hidden="true"></i>
        <div class="portal-kpi__value">${faNumber(card.value)}</div>
        <div class="portal-kpi__label">${escapeHtml(card.label)}</div>
        ${
          card.total === null
            ? ""
            : `<div class="portal-kpi__meta">از ${faNumber(card.total)} سالن</div>`
        }
      </article>`,
    )
    .join("");

// ===== سرصفحهٔ پرونده =====
export const renderHero = (customer = {}) => {
  const farm = text(customer.farm_name).trim();
  const code = text(customer.customer_code).trim();
  const place = [text(customer.province).trim(), text(customer.county).trim()]
    .filter(Boolean)
    .join(" — ");

  return `
    <div class="portal-hero__title">
      <h1 class="portal-hero__name">${escapeHtml(text(customer.full_name) || "مشتری گرامی")}</h1>
      ${farm ? `<p class="portal-hero__farm">${escapeHtml(farm)}</p>` : ""}
    </div>
    <div class="portal-hero__meta">
      ${code ? `<span><i class="fas fa-hashtag"></i>کد مشتری: ${faNumber(code)}</span>` : ""}
      ${place ? `<span><i class="fas fa-location-dot"></i>${escapeHtml(place)}</span>` : ""}
      <span><i class="fas fa-circle-check"></i>${escapeHtml(statusLabel(customer.status))}</span>
    </div>`;
};

// ===== حالت‌های غیرعادی =====
export const renderNotice = (title, message, type = "info") => `
  <div class="portal-notice portal-notice--${escapeHtml(type)}" role="status">
    <i class="fas ${type === "error" ? "fa-triangle-exclamation" : "fa-circle-info"}"></i>
    <div>
      <div class="portal-notice__title">${escapeHtml(title)}</div>
      <div class="portal-notice__text">${escapeHtml(message)}</div>
    </div>
  </div>`;


// ===== فهرست‌های کوتاه (۳ ردیف آخر از سرور) =====
const emptyRow = (message) =>
  `<li class="portal-empty">${escapeHtml(message)}</li>`;

export const renderFlocks = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) {
    return emptyRow("گله‌ای ثبت نشده است");
  }
  return list
    .map(
      (row) => `
      <li class="portal-row">
        <span class="portal-row__title">گلهٔ ${faNumber(row.flock_number ?? 0)}</span>
        <span class="portal-row__sub">جوجه‌ریزی: ${jalaliDate(row.placement_date)}</span>
        <span class="portal-badge portal-badge--${escapeHtml(text(row.status) || "unknown")}">${escapeHtml(statusLabel(row.status))}</span>
      </li>`,
    )
    .join("");
};

export const renderWeeks = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) {
    return emptyRow("هفته‌ای ثبت نشده است");
  }
  return list
    .map(
      (row) => `
      <li class="portal-row">
        <span class="portal-row__title">هفتهٔ ${faNumber(row.week_number ?? 0)}</span>
        <span class="portal-row__sub">${jalaliDate(row.week_start_date)} تا ${jalaliDate(row.week_end_date)}</span>
        <span class="portal-row__sub">وزن: ${faNumber(row.weekly_weight)} گرم · تلفات: ${faNumber(row.weekly_mortality)}</span>
      </li>`,
    )
    .join("");
};

export const renderVisits = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) {
    return emptyRow("بازدیدی ثبت نشده است");
  }
  return list
    .map(
      (row) => `
      <li class="portal-row">
        <span class="portal-row__title">بازدید ${jalaliDate(row.visit_date)}</span>
        <span class="portal-badge portal-badge--${escapeHtml(text(row.status) || "unknown")}">${escapeHtml(statusLabel(row.status))}</span>
      </li>`,
    )
    .join("");
};
