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
// value === null ⇒ «این بخش برای این حساب بسته است» ⇒ کارت رندر نمی‌شود
const countOrZero = (value) => (value === null || value === undefined ? 0 : value);

export const counterCards = (counters = {}) => [
  {
    key: "halls",
    label: "سالن‌ها",
    value: counters.active_halls === null ? null : countOrZero(counters.active_halls),
    total: counters.halls === null ? null : countOrZero(counters.halls),
    icon: "fa-warehouse",
  },
  {
    key: "flocks",
    label: "گله‌های فعال",
    value: counters.active_flocks === null ? null : countOrZero(counters.active_flocks),
    total: null,
    icon: "fa-egg",
  },
  {
    key: "weeks",
    label: "هفته‌های ثبت‌شده",
    value: counters.weeks_recorded === null ? null : countOrZero(counters.weeks_recorded),
    total: null,
    icon: "fa-chart-line",
  },
  {
    key: "visits",
    label: "بازدیدهای خوانده‌نشده",
    value: counters.unread_visits === null ? null : countOrZero(counters.unread_visits),
    total: null,
    icon: "fa-clipboard-list",
  },
];

export const renderCounters = (counters = {}) =>
  counterCards(counters)
    .filter((card) => card.value !== null)
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
// ============================================================
// ✅ موج ۱۳.۱۰ — «مدارک من»
// ------------------------------------------------------------
//  ❌ هیچ تگ فرم و هیچ دکمهٔ submit ساخته نمی‌شود: پورتال با
//     رویدادهای delegation کار می‌کند و ارسال صفحه‌ای وجود ندارد.
//  🔒 هر متن/نام فایل از escapeHtml عبور می‌کند (نام فایل را مشتری
//     انتخاب می‌کند، پس «دادهٔ کاربر» است).
// ============================================================
export const DOCUMENT_KIND_ICONS = {
  id_card: "fa-id-card",
  license: "fa-file-signature",
  invoice: "fa-file-invoice",
  other: "fa-paperclip",
};

// حجم خوانا (هم‌قاعده با سرور)
export const formatFileSize = (bytes) => {
  const value = Number(bytes) || 0;
  if (value <= 0) return "۰";
  const kb = value / 1024;
  if (kb < 1024) return `${toPersianNumber(Math.max(1, Math.round(kb)))} کیلوبایت`;
  return `${toPersianNumber((kb / 1024).toFixed(1))} مگابایت`;
};

// نوار سهمیه: «۳ از ۱۰ مدرک · ۴.۲ از ۲۵ مگابایت»
export const renderDocumentQuota = (meta = {}) => {
  const count = Number(meta.count) || 0;
  const maxCount = Number(meta.max_count) || 10;
  const totalBytes = Number(meta.total_bytes) || 0;
  const maxTotal = Number(meta.max_total_bytes) || 0;
  const percent = maxTotal > 0 ? Math.min(100, Math.round((totalBytes / maxTotal) * 100)) : 0;

  return `
    <div class="portal-docs__quota">
      <div class="portal-docs__quota-text">
        <i class="fas fa-folder-open" aria-hidden="true"></i>
        <span>${toPersianNumber(count)} از ${toPersianNumber(maxCount)} مدرک</span>
        <span class="portal-docs__dot">·</span>
        <span>${formatFileSize(totalBytes)} از ${formatFileSize(maxTotal)}</span>
      </div>
      <div class="portal-docs__quota-bar" role="presentation">
        <span style="width:${percent}%"></span>
      </div>
    </div>
  `;
};

// فرم آپلود (بدون تگ فرم) — فقط وقتی مجوز آپلود باز است
export const renderDocumentUploadBox = ({ canUpload = false, kinds = [] } = {}) => {
  if (!canUpload) {
    return `
      <div class="portal-docs__locked">
        <i class="fas fa-lock" aria-hidden="true"></i>
        <span>ارسال مدرک تازه از سوی مدیر برای حساب شما بسته شده است. برای ثبت مدرک با کارشناس خود تماس بگیرید.</span>
      </div>
    `;
  }

  const options = (kinds.length ? kinds : [{ key: "other", label: "سایر مدارک" }])
    .map(
      (item) =>
        `<option value="${escapeHtml(item.key)}">${escapeHtml(item.label)}</option>`,
    )
    .join("");

  return `
    <div class="portal-docs__form" id="portalDocsForm">
      <div class="portal-docs__row">
        <label class="portal-docs__label" for="portalDocsKind">نوع مدرک</label>
        <select class="portal-docs__select" id="portalDocsKind">${options}</select>
      </div>
      <div class="portal-docs__row">
        <label class="portal-docs__label" for="portalDocsTitle">عنوان (اختیاری)</label>
        <input class="portal-docs__input" id="portalDocsTitle" type="text"
          maxlength="120" placeholder="مثلاً: کارت ملی به‌نام" />
      </div>
      <div class="portal-docs__row">
        <label class="portal-docs__label" for="portalDocsFile">فایل</label>
        <input class="portal-docs__file" id="portalDocsFile" type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf" />
      </div>
      <div class="portal-docs__actions">
        <button type="button" class="portal-btn portal-btn--primary" data-docs-upload>
          <i class="fas fa-cloud-arrow-up" aria-hidden="true"></i> ارسال مدرک
        </button>
        <span class="portal-docs__hint">
          حداکثر ۵ مگابایت · JPG/PNG/WEBP/PDF · تا ۱۰ مدرک
        </span>
      </div>
      <div class="portal-docs__progress" id="portalDocsProgress" hidden>
        <div class="portal-docs__bar"><span id="portalDocsBar" style="width:0%"></span></div>
        <span class="portal-docs__percent" id="portalDocsPercent">۰٪</span>
      </div>
      <div class="portal-docs__error" id="portalDocsError"></div>
    </div>
  `;
};

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

// ============================================================
// ✅ موج ۱۳.۸ — «پروفایل من»
// ------------------------------------------------------------
//  ⚠️ گارد ۱۳.۸ (test:customer-portal) هنوز «هیچ فرم HTML» و
//     «هیچ دکمهٔ ارسالِ فرم» را در پورتال ممنوع می‌کند.
//     پس ویرایش با دکمهٔ type="button" و attributeهای data-profile-*
//     انجام می‌شود؛ سرویس مقادیر را می‌خواند و PATCH می‌فرستد.
//  🔒 موبایل فقط نمایشی (ماسک‌شده) است و ویرایشش مسیر پیامکی جدا دارد.
// ============================================================

// برچسب‌ها هم‌راستا با Backend/services/portalProfileRules.js (PROFILE_FIELDS)
export const PROFILE_FIELD_LABELS = {
  full_name: "نام و نام خانوادگی",
  farm_name: "نام مرغداری",
  collection_name: "نام مجموعه",
  national_code: "کد ملی",
  email: "ایمیل",
  date_of_birth: "تاریخ تولد",
  experience_years: "سابقهٔ کار",
  education_level: "سطح تحصیلات",
  gender: "جنسیت",
  province: "استان",
  county: "شهرستان",
  postal_code: "کد پستی",
  farm_address: "آدرس مرغداری",
  messaging_number: "شمارهٔ پیام‌رسان",
  skb_how_know: "نحوهٔ آشنایی با شرکت",
};

const profileFieldValue = (profile, field) =>
  text(((profile && profile.fields) || {})[field]);

// ترتیب فیلدهای فرم (همان ترتیب برچسب‌ها = همان ترتیب فهرست سفید سرور)
const PROFILE_EDITABLE_ORDER = Object.keys(PROFILE_FIELD_LABELS);

// کارت خواندنی پروفایل (همیشه؛ با یا بدون مجوز ویرایش)
export const renderProfileCard = (profile = {}, opts = {}) => {
  const fields = profile.fields || {};
  const rows = Object.keys(PROFILE_FIELD_LABELS)
    .map((field) => {
      const value = text(fields[field]).trim();
      return `
      <li class="portal-row portal-row--kv" data-profile-view="${escapeHtml(field)}">
        <span class="portal-row__key">${escapeHtml(PROFILE_FIELD_LABELS[field])}</span>
        <span class="portal-row__value">${value ? escapeHtml(value) : "—"}</span>
      </li>`;
    })
    .join("");

  const mobileMasked = text(profile.mobile && profile.mobile.masked);
  const typeName = text(profile.customer_type && profile.customer_type.name);

  return `
    <div class="portal-profile" id="portalProfileView">
      <div class="portal-profile__head">
        <span class="portal-badge portal-badge--${profile.active ? "active" : "inactive"}">
          ${profile.active ? "پروندهٔ فعال" : "پروندهٔ غیرفعال"}
        </span>
        ${profile.customer_code ? `<span class="portal-chip">کد مشتری: ${faNumber(profile.customer_code)}</span>` : ""}
        ${typeName ? `<span class="portal-chip">${escapeHtml(typeName)}</span>` : ""}
        ${
          profile.edited_by_customer
            ? `<span class="portal-chip portal-chip--info">آخرین ویرایش: خودم</span>`
            : ""
        }
      </div>
      <ul class="portal-list">
        <li class="portal-row portal-row--kv">
          <span class="portal-row__key">شمارهٔ موبایل</span>
          <span class="portal-row__value">
            ${mobileMasked ? escapeHtml(mobileMasked) : "—"}
            <span class="portal-chip portal-chip--muted">فقط با کد پیامکی تغییر می‌کند</span>
          </span>
        </li>
        ${rows}
      </ul>
      ${
        opts.canEdit
          ? `<div class="portal-profile__actions">
               <button type="button" class="portal-btn portal-btn--primary" data-profile-edit>
                 <i class="fas fa-pen" aria-hidden="true"></i> ویرایش اطلاعات
               </button>
               <button type="button" class="portal-btn" data-profile-mobile-open>
                 <i class="fas fa-mobile-screen" aria-hidden="true"></i> تغییر شمارهٔ موبایل
               </button>
             </div>`
          : `<p class="portal-profile__locked">
               <i class="fas fa-lock" aria-hidden="true"></i>
               ویرایش پروفایل برای حساب شما بسته است؛ برای تغییر اطلاعات با کارشناس تماس بگیرید.
             </p>`
      }
    </div>`;
};

// ویرایشگر پروفایل — ورودی‌های data-profile-field (بدون form)
const profileInput = (field, profile, { disabled = false } = {}) => {
  const label = PROFILE_FIELD_LABELS[field];
  const value = profileFieldValue(profile, field);
  const common = `data-profile-field="${escapeHtml(field)}" ${disabled ? "disabled" : ""}`;

  if (field === "gender") {
    const choices = ["", "مرد", "زن"];
    return `
      <label class="portal-field">
        <span class="portal-field__label">${escapeHtml(label)}</span>
        <select class="portal-field__input" ${common}>
          ${choices
            .map(
              (choice) =>
                `<option value="${escapeHtml(choice)}"${
                  choice === value ? " selected" : ""
                }>${choice ? escapeHtml(choice) : "انتخاب کنید"}</option>`,
            )
            .join("")}
        </select>
      </label>`;
  }

  if (field === "farm_address") {
    return `
      <label class="portal-field portal-field--wide">
        <span class="portal-field__label">${escapeHtml(label)}</span>
        <textarea class="portal-field__input" rows="3" ${common}>${escapeHtml(value)}</textarea>
      </label>`;
  }

  const type = field === "email" ? "email" : field === "date_of_birth" ? "date" : "text";
  const numeric = ["national_code", "postal_code", "messaging_number"].includes(field);
  return `
    <label class="portal-field">
      <span class="portal-field__label">${escapeHtml(label)}</span>
      <input class="portal-field__input" type="${type}"
        ${numeric ? 'inputmode="numeric" autocomplete="off"' : ""}
        value="${escapeHtml(value)}" ${common}>
    </label>`;
};

export const renderProfileEditor = (profile = {}, opts = {}) => `
  <div class="portal-profile portal-profile--edit" id="portalProfileEditor">
    <div class="portal-profile__head">
      <span class="portal-chip portal-chip--info">
        <i class="fas fa-circle-info" aria-hidden="true"></i>
        تغییرات پس از ذخیره بی‌درنگ اعمال می‌شود و کارشناس شما آن را می‌بیند.
      </span>
    </div>
    <div class="portal-form-grid">
      ${PROFILE_EDITABLE_ORDER.map((field) =>
        profileInput(field, profile, { disabled: Boolean(opts.disabled) }),
      ).join("")}
    </div>
    <div class="portal-profile__errors" id="portalProfileErrors" role="alert"></div>
    <div class="portal-profile__actions">
      <button type="button" class="portal-btn portal-btn--primary" data-profile-save>
        <i class="fas fa-floppy-disk" aria-hidden="true"></i> ذخیرهٔ تغییرات
      </button>
      <button type="button" class="portal-btn" data-profile-cancel>
        <i class="fas fa-xmark" aria-hidden="true"></i> انصراف
      </button>
    </div>
    <p class="portal-profile__note">
      <i class="fas fa-lock" aria-hidden="true"></i>
      کد پرونده، نوع مشتری، وضعیت و شمارهٔ موبایل از این فرم قابل تغییر نیستند.
    </p>
  </div>`;

// ============================================================
// تغییر شمارهٔ موبایل — دو مرحله با کد پیامکی
// ============================================================
export const renderMobileChangePanel = (profile = {}, opts = {}) => {
  const stage = opts.stage === "confirm" ? "confirm" : "request";
  const masked = text(profile.mobile && profile.mobile.masked) || "—";

  if (stage === "confirm") {
    return `
      <div class="portal-profile portal-profile--mobile" id="portalMobilePanel">
        <p class="portal-profile__note">
          کد پیامکی ارسال‌شده به شمارهٔ جدید را وارد کنید.
        </p>
        <label class="portal-field">
          <span class="portal-field__label">کد ۶ رقمی</span>
          <input class="portal-field__input portal-field__input--code" inputmode="numeric"
            autocomplete="one-time-code" maxlength="6" data-mobile-code>
        </label>
        <div class="portal-profile__errors" id="portalMobileErrors" role="alert"></div>
        <div class="portal-profile__actions">
          <button type="button" class="portal-btn portal-btn--primary" data-mobile-confirm>
            <i class="fas fa-circle-check" aria-hidden="true"></i> تأیید و تغییر شماره
          </button>
          <button type="button" class="portal-btn" data-mobile-resend>
            <i class="fas fa-rotate-right" aria-hidden="true"></i> ارسال دوباره
          </button>
          <button type="button" class="portal-btn" data-mobile-cancel>انصراف</button>
        </div>
      </div>`;
  }

  return `
    <div class="portal-profile portal-profile--mobile" id="portalMobilePanel">
      <p class="portal-profile__note">
        شمارهٔ فعلی: <strong>${escapeHtml(masked)}</strong> — شمارهٔ جدید باید مال خودتان
        باشد؛ کد تأیید به همان شماره ارسال می‌شود.
      </p>
      <label class="portal-field">
        <span class="portal-field__label">شمارهٔ موبایل جدید</span>
        <input class="portal-field__input" type="tel" inputmode="numeric" autocomplete="off"
          maxlength="11" placeholder="09xxxxxxxxx" data-mobile-input>
      </label>
      <div class="portal-profile__errors" id="portalMobileErrors" role="alert"></div>
      <div class="portal-profile__actions">
        <button type="button" class="portal-btn portal-btn--primary" data-mobile-request>
          <i class="fas fa-paper-plane" aria-hidden="true"></i> ارسال کد تأیید
        </button>
        <button type="button" class="portal-btn" data-mobile-cancel>انصراف</button>
      </div>
    </div>`;
};

// ============================================================
// ✅ موج ۱۳.۸ — «داشبورد تحلیلی من»
// ------------------------------------------------------------
//  ورودی همه از /portal/dashboard/* می‌آید (اسکوپ‌شده به پروندهٔ خودم).
//  نمودار هم SVG دست‌ساز است — بدون هیچ کتابخانهٔ تازه (هم‌قاعده با ۱۳.۴).
//  🔒 اگر مدیری نموداری را ببندد (customer.portal.chart.*)، همان نمودار
//     این‌جا رندر نمی‌شود (opts.charts از سرور).
// ============================================================

// فهرست گزینه‌های نمودار (گله‌های خودم)
export const renderDashboardOptions = (options = {}, opts = {}) => {
  const flocks = Array.isArray(options.flocks) ? options.flocks : [];
  const selected = text(opts.selectedFlockGroupId);

  const flockOptions = flocks
    .map((row) => {
      const id = text(row.id);
      const number = text(row.flock_number);
      const label = number ? `گلهٔ ${toPersianNumber(Number(number) || number)}` : `گلهٔ ${id}`;
      return `<option value="${escapeHtml(id)}"${id === selected ? " selected" : ""}>${escapeHtml(label)}${
        row.is_active ? " — فعال" : ""
      }</option>`;
    })
    .join("");

  return `
    <div class="portal-dash__toolbar">
      <label class="portal-field portal-field--inline">
        <span class="portal-field__label">گله</span>
        <select class="portal-field__input" data-dashboard-flock>
          <option value=""${selected ? "" : " selected"}>همهٔ گله‌های من</option>
          ${flockOptions}
        </select>
      </label>
      <button type="button" class="portal-btn portal-btn--primary" data-dashboard-apply>
        <i class="fas fa-chart-simple" aria-hidden="true"></i> نمایش نمودارها
      </button>
      ${
        opts.canExport
          ? `<button type="button" class="portal-btn" data-dashboard-export>
               <i class="fas fa-file-csv" aria-hidden="true"></i> خروجی CSV
             </button>`
          : ""
      }
    </div>
    ${
      flocks.length === 0
        ? `<p class="portal-dash__empty">گله‌ای برای نمایش نمودار در پروندهٔ شما ثبت نشده است.</p>`
        : ""
    }`;
};

// شمارنده‌های «خودم» (بدون هیچ آمار سایر مشتریان)
export const renderDashboardSummary = (summary = {}) => {
  const cards = [
    { key: "active_flocks", label: "گلهٔ فعال", value: summary.active_flocks, icon: "fa-egg" },
    { key: "halls", label: "سالن", value: summary.halls, icon: "fa-warehouse" },
    { key: "weeks", label: "هفتهٔ ثبت‌شده", value: summary.weeks_recorded, icon: "fa-calendar-week" },
    { key: "latest_week", label: "آخرین هفته", value: summary.latest_week, icon: "fa-flag-checkered" },
  ]
    .filter((card) => card.value !== null && card.value !== undefined)
    .map(
      (card) => `
      <article class="portal-kpi" data-kpi="${escapeHtml(card.key)}">
        <i class="fas ${escapeHtml(card.icon)} portal-kpi__icon" aria-hidden="true"></i>
        <div class="portal-kpi__value">${faNumber(card.value)}</div>
        <div class="portal-kpi__label">${escapeHtml(card.label)}</div>
      </article>`,
    )
    .join("");

  const extras = [
    summary.avg_weekly_weight !== undefined
      ? `میانگین وزن هفتگی: ${faNumber(summary.avg_weekly_weight)} گرم`
      : null,
    summary.total_mortality !== undefined
      ? `مجموع تلفات: ${faNumber(summary.total_mortality)}`
      : null,
    summary.total_feed !== undefined
      ? `مجموع دان: ${faNumber(summary.total_feed)} کیلوگرم`
      : null,
  ].filter(Boolean);

  return `
    <div class="portal-kpis portal-kpis--dash">${cards}</div>
    ${
      extras.length
        ? `<p class="portal-dash__extras">${extras.map(escapeHtml).join(" · ")}</p>`
        : ""
    }`;
};

// نمودار خطی چندسری (SVG) — وزن چند گله/سالن روی هم
const dashboardLineChart = (series = [], { title = "", unit = "" } = {}) => {
  const valid = series.filter(
    (row) => Array.isArray(row.values) && row.values.some((v) => Number(v) > 0),
  );
  if (valid.length === 0) {
    return `<p class="portal-chart__empty">داده‌ای برای «${escapeHtml(title)}» ثبت نشده است.</p>`;
  }

  const count = valid[0].values.length;
  const allValues = valid.flatMap((row) => row.values.map((v) => Number(v) || 0));
  const maxY = Math.max(...allValues, 1);
  const W = 640;
  const H = 190;
  const PAD_X = 36;
  const PAD_Y = 24;
  const stepX = (W - PAD_X * 2) / Math.max(1, count - 1);
  const palette = ["#2f6fed", "#16a34a", "#d97706", "#7c3aed", "#dc2626"];

  const lines = valid
    .slice(0, palette.length)
    .map((row, index) => {
      const points = row.values
        .map((value, i) => {
          const cx = PAD_X + stepX * i;
          const cy = H - PAD_Y - ((Number(value) || 0) / maxY) * (H - PAD_Y * 2);
          return `${cx.toFixed(1)},${cy.toFixed(1)}`;
        })
        .join(" ");
      return `<polyline class="portal-chart__line" style="stroke:${palette[index]}" points="${points}"></polyline>`;
    })
    .join("");

  const legend = valid
    .slice(0, palette.length)
    .map(
      (row, index) =>
        `<span class="portal-chart__legend-item"><i style="background:${palette[index]}"></i>${escapeHtml(
          text(row.name) || `سری ${index + 1}`,
        )}</span>`,
    )
    .join("");

  return `
    <div class="portal-chart__head">
      <span class="portal-chart__title">${escapeHtml(title)}</span>
      <span class="portal-chart__range">بیشینه: ${faNumber(maxY)}${unit ? ` ${escapeHtml(unit)}` : ""}</span>
    </div>
    <svg class="portal-chart__svg" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="${escapeHtml(title)}">
      <line class="portal-chart__axis" x1="${PAD_X}" y1="${H - PAD_Y}"
        x2="${W - PAD_X}" y2="${H - PAD_Y}"></line>
      ${lines}
    </svg>
    <div class="portal-chart__legend">${legend}</div>`;
};

// نمودار میله‌ای (SVG) — تلفات/دان سری اول
const dashboardBarChart = (series = [], { title = "", unit = "" } = {}) => {
  const row = series.find((item) => Array.isArray(item.values) && item.values.length);
  if (!row) {
    return `<p class="portal-chart__empty">داده‌ای برای «${escapeHtml(title)}» ثبت نشده است.</p>`;
  }
  const values = row.values.map((v) => Number(v) || 0);
  const maxY = Math.max(...values, 1);
  const W = 640;
  const H = 170;
  const PAD_X = 30;
  const PAD_Y = 20;
  const slot = (W - PAD_X * 2) / Math.max(1, values.length);
  const barWidth = Math.max(4, slot * 0.6);

  const bars = values
    .map((value, index) => {
      const height = (value / maxY) * (H - PAD_Y * 2);
      const x = PAD_X + slot * index + (slot - barWidth) / 2;
      const y = H - PAD_Y - height;
      return `<rect class="portal-chart__bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
        width="${barWidth.toFixed(1)}" height="${Math.max(1, height).toFixed(1)}" rx="3">
        <title>${escapeHtml(faNumber(value))}${unit ? ` ${escapeHtml(unit)}` : ""}</title>
      </rect>`;
    })
    .join("");

  return `
    <div class="portal-chart__head">
      <span class="portal-chart__title">${escapeHtml(title)}</span>
      <span class="portal-chart__range">بیشینه: ${faNumber(maxY)}${unit ? ` ${escapeHtml(unit)}` : ""}</span>
    </div>
    <svg class="portal-chart__svg" viewBox="0 0 ${W} ${H}" role="img"
      aria-label="${escapeHtml(title)}">
      <line class="portal-chart__axis" x1="${PAD_X}" y1="${H - PAD_Y}"
        x2="${W - PAD_X}" y2="${H - PAD_Y}"></line>
      ${bars}
    </svg>`;
};

// برچسب سری: «گلهٔ ۳ · سالن A» یا «کل گله (۲ سالن)»
const flockSeriesName = (flockInfo = {}) => {
  const parts = [];
  if (flockInfo.flockNumber) parts.push(`گلهٔ ${toPersianNumber(Number(flockInfo.flockNumber) || flockInfo.flockNumber)}`);
  if (flockInfo.hallName) parts.push(text(flockInfo.hallName));
  return parts.join(" · ") || "گله";
};

const seriesFrom = (flocks = [], key) =>
  flocks.map((row) => ({
    name: flockSeriesName(row.flockInfo || {}),
    values: Array.isArray(row.data && row.data[key]) ? row.data[key] : [],
  }));

// «افزایش وزن هفتگی» از تفاضل وزن‌های ثبت‌شده
const gainSeriesFrom = (flocks = []) =>
  flocks.map((row) => {
    const weights = Array.isArray(row.data && row.data.weighting) ? row.data.weighting : [];
    const gains = weights.map((value, index) => {
      if (index === 0) return 0;
      const diff = Number(value) - Number(weights[index - 1]);
      return Number.isFinite(diff) && diff > 0 ? Number(diff.toFixed(1)) : 0;
    });
    return { name: flockSeriesName(row.flockInfo || {}), values: gains };
  });

// FCR تقریبی هفتگی: دان مصرفی ÷ (وزن زنده ÷ ۱۰۰۰)
// ⚠️ برچسب صریح «تقریبی» — عدد قطعی FCR به «تعداد جوجه» نیاز دارد.
const fcrSeriesFrom = (flocks = []) =>
  flocks.map((row) => {
    const feed = Array.isArray(row.data && row.data.feed) ? row.data.feed : [];
    const weights = Array.isArray(row.data && row.data.weighting) ? row.data.weighting : [];
    const values = feed.map((value, index) => {
      const weightKg = (Number(weights[index]) || 0) / 1000;
      if (weightKg <= 0) return 0;
      const ratio = Number(value) / weightKg;
      return Number.isFinite(ratio) ? Number(ratio.toFixed(2)) : 0;
    });
    return { name: flockSeriesName(row.flockInfo || {}), values };
  });

// ✅ ۱۳.۲۳ — سری‌های نمودار برای Chart.js (portal.charts.js)
//  🔒 عمداً همین سه تابع بالا استفاده می‌شوند تا نمودار SVG و نمودار
//     تعاملی هرگز دو عدد متفاوت نشان ندهند (یک منبع، دو ارائه).
export const farmChartSeries = {
  weight: (flocks = []) => seriesFrom(flocks, "weighting"),
  loss: (flocks = []) => seriesFrom(flocks, "loss"),
  feed: (flocks = []) => seriesFrom(flocks, "feed"),
  gain: (flocks = []) => gainSeriesFrom(flocks),
  fcr: (flocks = []) => fcrSeriesFrom(flocks),
};

// جدول مقایسهٔ خلاصهٔ گله‌ها (خودم با خودم — تصمیم کارفرما در ۱۳.۸)
export const renderDashboardTable = (data = {}, opts = {}) => {
  const flocks = Array.isArray(data.flocks) ? data.flocks : [];
  if (flocks.length === 0) {
    return `<p class="portal-dash__empty">داده‌ای برای مقایسهٔ گله‌ها وجود ندارد.</p>`;
  }

  const rows = flocks
    .map((row) => {
      const info = row.flockInfo || {};
      const summary = row.summary || {};
      return `
      <tr>
        <td>${escapeHtml(flockSeriesName(info))}</td>
        <td>${jalaliDate(info.placementDate)}</td>
        <td>${faNumber(summary.totalWeeks)}</td>
        <td>${faNumber(summary.avgWeight)}</td>
        <td>${faNumber(summary.maxWeight)}</td>
        <td>${faNumber(summary.totalLoss)}</td>
        <td>${faNumber(summary.totalFeed)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="portal-dash__table-wrap">
      <table class="portal-table">
        <thead>
          <tr>
            <th>گله / سالن</th>
            <th>جوجه‌ریزی</th>
            <th>هفته</th>
            <th>میانگین وزن</th>
            <th>بیشترین وزن</th>
            <th>تلفات</th>
            <th>دان (کیلو)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${
      opts.canCompare === false
        ? `<p class="portal-dash__empty">مقایسهٔ گله‌ها برای حساب شما بسته است.</p>`
        : ""
    }`;
};

// صفحهٔ نمودارها: هر نمودار فقط اگر کلیدش از سرور مجاز آمده باشد
export const renderDashboardCharts = (data = {}, opts = {}) => {
  const charts = opts.charts || {};
  const flocks = Array.isArray(data.flocks) ? data.flocks : [];

  if (flocks.length === 0) {
    return `<p class="portal-dash__empty">برای این انتخاب داده‌ای ثبت نشده است.</p>`;
  }

  const blocks = [];

  if (charts.weight !== false) {
    blocks.push(
      dashboardLineChart(seriesFrom(flocks, "weighting"), {
        title: "وزن هفتگی (گرم)",
        unit: "گرم",
      }),
    );
  }
  if (charts.gain) {
    blocks.push(
      dashboardLineChart(gainSeriesFrom(flocks), {
        title: "افزایش وزن هفتگی (گرم)",
        unit: "گرم",
      }),
    );
  }
  if (charts.mortality !== false) {
    blocks.push(
      dashboardBarChart(seriesFrom(flocks, "loss"), { title: "تلفات هفتگی (قطعه)" }),
    );
  }
  if (charts.feed !== false) {
    blocks.push(
      dashboardBarChart(seriesFrom(flocks, "feed"), { title: "مصرف دان هفتگی (کیلوگرم)" }),
    );
  }
  if (charts.fcr) {
    blocks.push(
      dashboardBarChart(fcrSeriesFrom(flocks), {
        title: "ضریب تبدیل غذایی — تقریبی",
      }),
    );
  }

  if (blocks.length === 0) {
    return `<p class="portal-dash__empty">نمایش نمودارها برای حساب شما بسته است.</p>`;
  }

  return `
    <div class="portal-chart" id="portalDashChartWeight">${blocks[0]}</div>
    ${blocks
      .slice(1)
      .map((html, index) => `<div class="portal-chart" data-dash-extra="${index + 1}">${html}</div>`)
      .join("")}`;
};

// مقایسه با استاندارد نژاد — از /dashboard/analysis (وزن واقعی vs هدف)
export const renderStandardsChart = (analysis = {}, opts = {}) => {
  if (opts.charts && opts.charts.standards === false) return "";
  const flocks = Array.isArray(analysis.flocks) ? analysis.flocks : [];
  if (flocks.length === 0) {
    return `<p class="portal-chart__empty">دادهٔ استانداردی برای نمایش وجود ندارد.</p>`;
  }

  const flock = flocks[0];
  const standards = Array.isArray(flock.standards) ? flock.standards : [];
  const weeks = Array.isArray(flock.weeks) ? flock.weeks : [];
  if (standards.length === 0 || weeks.length === 0) {
    return `<p class="portal-chart__empty">استاندارد نژاد برای این گله ثبت نشده است.</p>`;
  }

  const byWeek = new Map(standards.map((row) => [Number(row.week_number), row]));
  const labels = weeks.map((row) => Number(row.week_number));
  const actual = weeks.map((row) => Number(row.weekly_weight) || 0);
  const target = labels.map((week) => Number((byWeek.get(week) || {}).target_weight) || 0);
  const minBand = labels.map((week) => Number((byWeek.get(week) || {}).min_weight) || 0);
  const maxBand = labels.map((week) => Number((byWeek.get(week) || {}).max_weight) || 0);

  const series = [
    { name: "وزن واقعی", values: actual },
    { name: "وزن هدف", values: target },
    { name: "حداقل استاندارد", values: minBand },
    { name: "حداکثر استاندارد", values: maxBand },
  ];

  return dashboardLineChart(series, {
    title: `مقایسه با استاندارد ${text(flock.flock && flock.flock.breedName) || "نژاد"} (گرم)`,
    unit: "گرم",
  });
};

// خروجی CSV از همان دادهٔ صفحه (بدون اندپوینت اضافه)
// 🔒 فقط دادهٔ خودِ مشتری؛ خروجی هم کلاینتی ساخته می‌شود (هیچ فایلی در سرور نیست).
// پاک‌سازی سلول CSV: گیومه‌گذاری + خنثی‌سازی کاما/خط جدید
const CSV_SAFE = (value) => `"${text(value).replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;

export const buildDashboardCsv = (data = {}) => {
  const flocks = Array.isArray(data.flocks) ? data.flocks : [];
  const header = [
    "گله/سالن",
    "جوجه‌ریزی",
    "هفته",
    "وزن (گرم)",
    "تلفات",
    "دان (کیلوگرم)",
  ];

  const lines = [header.join(",")];
  flocks.forEach((row) => {
    const info = row.flockInfo || {};
    const labels = Array.isArray(row.data && row.data.weekNumbers)
      ? row.data.weekNumbers
      : [];
    const weights = Array.isArray(row.data && row.data.weighting) ? row.data.weighting : [];
    const loss = Array.isArray(row.data && row.data.loss) ? row.data.loss : [];
    const feed = Array.isArray(row.data && row.data.feed) ? row.data.feed : [];

    labels.forEach((week, index) => {
      lines.push(
        [
          CSV_SAFE(flockSeriesName(info)),
          CSV_SAFE(text(info.placementDate).slice(0, 10)),
          CSV_SAFE(toPersianNumber(Number(week) || week)),
          CSV_SAFE(weights[index] ?? ""),
          CSV_SAFE(loss[index] ?? ""),
          CSV_SAFE(feed[index] ?? ""),
        ].join(","),
      );
    });
  });

  return lines.join("\r\n");
};

// ============================================================
// ✅ موج ۱۳.۱۰ — ردیف و فهرست «مدارک من»
// ------------------------------------------------------------
// 🔒 حذف دو مرحله‌ای: اولین کلیک فقط دکمه را به «تأیید حذف» تبدیل
//    می‌کند (بدون window.confirm — پورتال هیچ alert/confirm بومی
//    ندارد). حذف در سرور «نرم» است و فایل برای بازبینی می‌ماند،
//    ولی متن دکمه همین را به مشتری می‌گوید تا انتظار درستی داشته باشد.
// ============================================================
export const renderDocumentRow = (item = {}, opts = {}) => {
  const canDelete = opts.canDelete === true;
  const pending = String(opts.pendingDelete ?? "") === String(item.id ?? "");
  const kind = text(item.kind) || "other";
  const icon = DOCUMENT_KIND_ICONS[kind] || DOCUMENT_KIND_ICONS.other;
  const name = text(item.file_name) || "فایل";

  const actions = [
    `<button type="button" class="portal-btn portal-btn--ghost" data-docs-download="${escapeHtml(item.id)}" data-docs-name="${escapeHtml(name)}">
       <i class="fas fa-download" aria-hidden="true"></i> دانلود
     </button>`,
  ];

  if (canDelete && pending) {
    actions.push(
      `<button type="button" class="portal-btn portal-btn--danger" data-docs-delete-confirm="${escapeHtml(item.id)}">
         تأیید حذف
       </button>`,
      `<button type="button" class="portal-btn portal-btn--ghost" data-docs-delete-cancel="1">
         انصراف
       </button>`,
    );
  } else if (canDelete) {
    actions.push(
      `<button type="button" class="portal-btn portal-btn--ghost portal-btn--muted" data-docs-delete="${escapeHtml(item.id)}">
         <i class="fas fa-trash-can" aria-hidden="true"></i> حذف از فهرست
       </button>`,
    );
  }

  return `
    <li class="portal-docs__item${pending ? " is-pending" : ""}">
      <div class="portal-docs__meta">
        <span class="portal-docs__kind">
          <i class="fas ${icon}" aria-hidden="true"></i> ${escapeHtml(item.kind_label || kind)}
        </span>
        <strong class="portal-docs__title">${escapeHtml(item.title || "مدرک بدون عنوان")}</strong>
        <span class="portal-docs__sub">
          ${escapeHtml(name)} · ${formatFileSize(item.file_size)} · ${jalaliDate(text(item.created_at).slice(0, 10))}
        </span>
        ${pending ? `<span class="portal-docs__confirm">اگر حذف کنید، مدرک از فهرست شما پنهان می‌شود (نسخهٔ بایگانی برای کارشناس می‌ماند).</span>` : ""}
      </div>
      <div class="portal-docs__item-actions">${actions.join("")}</div>
    </li>
  `;
};

export const renderDocumentList = (items = [], opts = {}) => {
  const rows = Array.isArray(items) ? items : [];
  if (rows.length === 0) {
    return `<li class="portal-empty">هنوز مدرکی ارسال نکرده‌اید. با دکمهٔ بالا می‌توانید کارت ملی، جواز یا فاکتور را بفرستید.</li>`;
  }
  return rows.map((item) => renderDocumentRow(item, opts)).join("");
};




