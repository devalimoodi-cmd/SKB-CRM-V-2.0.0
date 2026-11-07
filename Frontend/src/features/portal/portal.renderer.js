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
// ============================================================
// فهرست‌های کامل (فاز ۱۳.۳) — صفحه‌بندی‌شده و فقط خواندنی
// ------------------------------------------------------------
// ⚠️ همان قواعد: escapeHtml + اعداد فارسی + تاریخ شمسی.
//    هیچ فیلد حساسی در خروجی سرور نیست (کد ملی، آدرس، متن بازدید …)
//    و هیچ دکمهٔ ایجاد/ویرایش/حذف در این بخش‌ها ساخته نمی‌شود.
// ============================================================

export const renderEmpty = (message) => emptyRow(message);

const hallRow = (row) => `
  <li class="portal-row">
    <span class="portal-row__title">${escapeHtml(text(row.hall_name) || "بدون نام")}</span>
    <span class="portal-row__sub">
      ${row.hall_number === null || row.hall_number === undefined ? "" : `شماره: ${faNumber(row.hall_number)} ·`}
      ظرفیت: ${faNumber(row.nominal_capacity)} قطعه
    </span>
    <span class="portal-badge portal-badge--${row.is_active ? "active" : "inactive"}">${
      row.is_active ? "فعال" : "غیرفعال"
    }</span>
  </li>`;

export const renderHallList = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) {
    return renderEmpty("سالنی برای این پرونده ثبت نشده است");
  }
  return list.map(hallRow).join("");
};

const flockRow = (row) => `
  <li class="portal-row">
    <span class="portal-row__title">گلهٔ ${faNumber(row.flock_number ?? 0)}</span>
    <span class="portal-row__sub">
      جوجه‌ریزی: ${jalaliDate(row.placement_date)}${
        row.ended_at ? ` · پایان: ${jalaliDate(row.ended_at)}` : ""
      }
    </span>
    <span class="portal-badge portal-badge--${escapeHtml(text(row.status) || "unknown")}">${escapeHtml(statusLabel(row.status))}</span>
  </li>`;

export const renderFlockList = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) {
    return renderEmpty("گله‌ای برای این پرونده ثبت نشده است");
  }
  return list.map(flockRow).join("");
};

// دکمهٔ «جزئیات» — فقط یک GET دیگر (هیچ داده‌ای تغییر نمی‌کند)
const detailButton = (kind, id, label = "جزئیات") => `
    <button type="button" class="portal-row__open" data-portal-open="${escapeHtml(kind)}"
      data-portal-id="${escapeHtml(String(id))}">
      <i class="fas fa-circle-info" aria-hidden="true"></i> ${escapeHtml(label)}
    </button>`;

const weekRow = (row) => `
  <li class="portal-row">
    <span class="portal-row__title">
      هفتهٔ ${faNumber(row.week_number ?? 0)}${
        text(row.hall_name).trim()
          ? ` <small class="portal-row__hall">${escapeHtml(text(row.hall_name).trim())}</small>`
          : ""
      }
    </span>
    <span class="portal-row__sub">${jalaliDate(row.week_start_date)} تا ${jalaliDate(row.week_end_date)}</span>
    <span class="portal-row__sub">
      سن: ${faNumber(row.flock_age_days)} روز · وزن: ${faNumber(row.weekly_weight)} گرم ·
      تلفات: ${faNumber(row.weekly_mortality)} · دان: ${faNumber(row.weekly_feed_intake)} کیلو
    </span>
    ${detailButton("week", row.id)}
  </li>`;

export const renderWeekList = (list = []) => {
  if (!Array.isArray(list) || list.length === 0) {
    return renderEmpty("هفتهٔ مدیریتی ثبت نشده است");
  }
  return list.map(weekRow).join("");
};

// ۱۳.۴: نشانه‌های کمک‌کنندهٔ ردیف بازدید (متن گزارش هرگز در فهرست نمی‌آید)
const visitHint = (row) => {
  const parts = [];
  if (row.has_report) parts.push("متن گزارش ثبت شده");
  const count = Number(row.attachment_count) || 0;
  if (count > 0) parts.push(`${toPersianNumber(count)} پیوست`);
  return parts.length
    ? parts.join(" · ")
    : "گزارش و پیوست‌ها از طریق کارشناس خدمت ارائه می‌شود";
};

const visitRow = (row, opts = {}) => {
  const canOpen =
    opts.canViewReport !== false &&
    (Boolean(row.has_report) || Number(row.attachment_count) > 0);
  return `
  <li class="portal-row">
    <span class="portal-row__title">بازدید ${jalaliDate(row.visit_date)}</span>
    <span class="portal-row__sub">${escapeHtml(visitHint(row))}</span>
    <span class="portal-badge portal-badge--${escapeHtml(text(row.status) || "unknown")}">${escapeHtml(statusLabel(row.status))}</span>
    ${canOpen ? detailButton("visit", row.id, "مشاهدهٔ گزارش") : ""}
  </li>`;
};

export const renderVisitList = (list = [], opts = {}) => {
  if (!Array.isArray(list) || list.length === 0) {
    return renderEmpty("بازدیدی برای این پرونده ثبت نشده است");
  }
  return list.map((row) => visitRow(row, opts)).join("");
};

// ===== «نمایش بیشتر» — تنها دکمهٔ فهرست‌ها و فقط یک GET دیگر =====
export const renderPager = (pagination = {}, key = "") => {
  const page = Number(pagination.page) || 1;
  const pages = Number(pagination.pages) || 0;
  const total = Number(pagination.total) || 0;

  if (pages <= page) {
    return total > 0
      ? `<p class="portal-pager__end">همهٔ ${faNumber(total)} ردیف نمایش داده شد</p>`
      : "";
  }

  return `
    <div class="portal-pager">
      <button type="button" class="portal-more" data-portal-more="${escapeHtml(key)}">
        <i class="fas fa-chevron-down" aria-hidden="true"></i> نمایش بیشتر
      </button>
      <span class="portal-pager__count">صفحهٔ ${faNumber(page)} از ${faNumber(pages)}</span>
    </div>`;
};

// ============================================================
// ۱۳.۴ — پنل جزئیات: هفتهٔ مدیریتی / بازدید
// ------------------------------------------------------------
// ❌ هیچ دکمهٔ نوشتنی (ثبت/ویرایش/حذف) در این بخش نیست؛
//    تنها اکشن‌ها: «دریافت پیوست» (GET با توکن) و «بستن».
// ============================================================

const detailRow = (label, value) => `
    <div class="portal-detail__row">
      <span class="portal-detail__label">${escapeHtml(label)}</span>
      <span class="portal-detail__value">${value}</span>
    </div>`;

// فهرست نام‌های کاتالوگ (بیماری/واکسن/دارو/دان) به‌شکل چیپ خوانا
const nameChips = (list, emptyText) => {
  const items = Array.isArray(list)
    ? list.filter((item) => item && text(item.name).trim())
    : [];
  if (items.length === 0) {
    return `<span class="portal-detail__muted">${escapeHtml(emptyText)}</span>`;
  }
  return items
    .map((item) => `<span class="portal-chip">${escapeHtml(text(item.name).trim())}</span>`)
    .join("");
};

const WEEK_GROUPS = [
  { key: "diseases", label: "بیماری‌های ثبت‌شده", icon: "fa-virus", empty: "بیماری‌ای ثبت نشده است" },
  { key: "vaccines", label: "واکسن‌ها", icon: "fa-syringe", empty: "واکسنی ثبت نشده است" },
  { key: "medicines", label: "داروها", icon: "fa-pills", empty: "دارویی ثبت نشده است" },
  { key: "feeds", label: "دان مصرفی", icon: "fa-wheat-awn", empty: "نوع دانی ثبت نشده است" },
];

export const renderWeekDetail = (week = {}) => {
  const hall = text(week.hall_name).trim();
  return `
    <div class="portal-detail__title">
      هفتهٔ ${faNumber(week.week_number ?? 0)}${hall ? ` — ${escapeHtml(hall)}` : ""}
    </div>
    ${detailRow("بازهٔ هفته", `${jalaliDate(week.week_start_date)} تا ${jalaliDate(week.week_end_date)}`)}
    ${detailRow("سن گله", `${faNumber(week.flock_age_days)} روز`)}
    ${detailRow("وزن هفتگی", `${faNumber(week.weekly_weight)} گرم`)}
    ${detailRow("تلفات", faNumber(week.weekly_mortality))}
    ${detailRow("مصرف دان", `${faNumber(week.weekly_feed_intake)} کیلو`)}
    <div class="portal-detail__groups">
      ${WEEK_GROUPS.map(
        (group) => `
        <section class="portal-detail__group">
          <div class="portal-detail__group-head">
            <i class="fas ${escapeHtml(group.icon)}" aria-hidden="true"></i>
            <span>${escapeHtml(group.label)}</span>
          </div>
          <div class="portal-detail__chips">${nameChips(week[group.key], group.empty)}</div>
        </section>`,
      ).join("")}
    </div>`;
};

// اندازهٔ خوانای فایل (بایت ⇒ کیلو/مگا)
const readableSize = (bytes) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${toPersianNumber(size)} بایت`;
  if (size < 1024 * 1024) return `${toPersianNumber(Math.round(size / 1024))} کیلوبایت`;
  return `${toPersianNumber((size / (1024 * 1024)).toFixed(1))} مگابایت`;
};


export const renderAttachments = (list = [], visitId = "", opts = {}) => {
  const rows = Array.isArray(list) ? list : [];
  if (rows.length === 0) {
    return `<p class="portal-detail__muted">پیوستی برای این بازدید ثبت نشده است.</p>`;
  }
  if (opts.canViewReport === false) {
    return `<p class="portal-detail__muted">دریافت پیوست‌ها برای نقش شما بسته است.</p>`;
  }

  return `
    <ul class="portal-attachments">
      ${rows
        .map((row) => {
          const name = text(row.file_name).trim() || "پیوست";
          const size = readableSize(row.file_size);
          return `
        <li class="portal-attachments__row">
          <i class="fas fa-file-arrow-down" aria-hidden="true"></i>
          <span class="portal-attachments__name">${escapeHtml(name)}</span>
          ${size ? `<span class="portal-attachments__size">${escapeHtml(size)}</span>` : ""}
          <button type="button" class="portal-attachments__btn"
            data-portal-attachment="${escapeHtml(String(row.id))}"
            data-portal-visit="${escapeHtml(String(visitId))}"
            data-portal-name="${escapeHtml(name)}">
            <i class="fas fa-download" aria-hidden="true"></i> دریافت
          </button>
        </li>`;
        })
        .join("")}
    </ul>`;
};

export const renderVisitDetail = (visit = {}, attachments = [], opts = {}) => {
  const allowed = opts.canViewReport !== false;
  const reportText = text(visit.report_text).trim();
  const halls = Array.isArray(visit.hall_names)
    ? visit.hall_names.filter((name) => text(name).trim())
    : [];
  const safeReport = escapeHtml(reportText).replace(/\r?\n/g, "<br>");

  return `
    <div class="portal-detail__title">بازدید ${jalaliDate(visit.visit_date)}</div>
    ${detailRow(
      "وضعیت",
      `<span class="portal-badge portal-badge--${escapeHtml(text(visit.status) || "unknown")}">${escapeHtml(statusLabel(visit.status))}</span>`,
    )}
    ${detailRow(
      "سالن‌های بازدیدشده",
      halls.length
        ? halls.map((name) => `<span class="portal-chip">${escapeHtml(text(name).trim())}</span>`).join("")
        : `<span class="portal-detail__muted">ثبت نشده</span>`,
    )}
    <section class="portal-detail__group">
      <div class="portal-detail__group-head">
        <i class="fas fa-file-lines" aria-hidden="true"></i>
        <span>متن گزارش کارشناس</span>
      </div>
      <div class="portal-detail__report">${
        allowed
          ? safeReport || `<span class="portal-detail__muted">متنی برای این بازدید ثبت نشده است.</span>`
          : `<span class="portal-detail__muted">مشاهدهٔ متن گزارش برای نقش شما بسته است.</span>`
      }</div>
    </section>
    <section class="portal-detail__group">
      <div class="portal-detail__group-head">
        <i class="fas fa-paperclip" aria-hidden="true"></i>
        <span>پیوست‌ها</span>
      </div>
      ${renderAttachments(attachments, visit.id, { canViewReport: allowed })}
    </section>`;
};


// ============================================================
// نمودار روند وزن هفتگی — SVG دست‌ساز (بدون هیچ کتابخانهٔ تازه)
// ------------------------------------------------------------
// ورودی: همان ردیف‌های تب «هفته‌های مدیریتی» (حداکثر ۲۰ تای آخر)
// ⇒ صفر اندپوینت اضافه، صفر وابستگی.
// ============================================================
export const renderWeeklyChart = (items = []) => {
  const rows = (Array.isArray(items) ? items : [])
    .filter((row) => Number.isFinite(Number(row.weekly_weight)))
    .slice(-20);

  if (rows.length < 2) {
    return `<p class="portal-chart__empty">برای رسم نمودار به حداقل دو هفتهٔ ثبت‌شده با وزن نیاز است.</p>`;
  }

  const W = 640;
  const H = 180;
  const PAD_X = 34;
  const PAD_Y = 26;
  const values = rows.map((row) => Number(row.weekly_weight));
  const maxY = Math.max(...values);
  const minY = Math.min(...values);
  const spanY = maxY - minY || 1;
  const stepX = (W - PAD_X * 2) / Math.max(1, rows.length - 1);

  const points = rows.map((row, index) => {
    const weight = Number(row.weekly_weight);
    const cx = PAD_X + stepX * index;
    const cy = H - PAD_Y - ((weight - minY) / spanY) * (H - PAD_Y * 2);
    return {
      cx: Number(cx.toFixed(1)),
      cy: Number(cy.toFixed(1)),
      week: Number(row.week_number) || index + 1,
      weight,
    };
  });

  const polyline = points.map((point) => `${point.cx},${point.cy}`).join(" ");
  const dots = points
    .map(
      (point) =>
        `<circle class="portal-chart__dot" cx="${point.cx}" cy="${point.cy}" r="3"><title>هفتهٔ ${escapeHtml(faNumber(point.week))}: ${escapeHtml(faNumber(point.weight))} گرم</title></circle>`,
    )
    .join("");

  return `
    <div class="portal-chart__head">
      <span class="portal-chart__title">روند وزن هفتگی (گرم)</span>
      <span class="portal-chart__range">${faNumber(minY)} تا ${faNumber(maxY)}</span>
    </div>
    <svg class="portal-chart__svg" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="روند وزن هفتگی گله">
      <line class="portal-chart__axis" x1="${PAD_X}" y1="${H - PAD_Y}"
        x2="${W - PAD_X}" y2="${H - PAD_Y}"></line>
      <polyline class="portal-chart__line" points="${polyline}"></polyline>
      ${dots}
    </svg>
    <p class="portal-chart__hint">
      ${faNumber(points.length)} هفتهٔ آخر از دادهٔ همین صفحه — برای دیدن همهٔ هفته‌ها «نمایش بیشتر» را بزنید.
    </p>`;
};

