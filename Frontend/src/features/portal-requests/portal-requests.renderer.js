// ============================================================
// features/portal-requests/portal-requests.renderer.js
// رندر صف «درخواست‌های پورتال» در پنل مدیریت — موج ۱۳.۱۱
// ------------------------------------------------------------
// 🔒 قواعد:
//  ۱) هر مقدار از سرور با esc() پاک می‌شود (متن مشتری ورودی آزاد
//     است: نام واحد/سالن/توضیح ⇒ ریسک XSS).
//  ۲) برچسب‌ها از یک نقشهٔ ثابت می‌آیند (نه از کلید خام payload).
//  ۳) شمارندهٔ «در انتظار» جدا از فهرست برگردانده می‌شود (badge منو).
// ============================================================
import { jalaliDate } from "../portal/portal.renderer.js";
// ✅ ۱۳.۱۶: نمایش «نامدار» payload — همان منبعی که کارت‌های پورتال
// استفاده می‌کنند (برچسب/نوع/دیکشنری از spec فرم مشتق می‌شود).
import {
  PAYLOAD_DICT_OF,
  PAYLOAD_FIELD_META,
  PAYLOAD_LABEL,
  dictionaryNameOf,
  equipmentRowsOf,
  payloadContextRowsOf,
  payloadIdRowsOf,
  payloadRowsOf,
} from "../portal/portal.payload.js";

const esc = (value) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const REQUEST_TYPE_LABELS = {
  unit_create: "ثبت واحد مرغداری",
  hall_create: "ثبت سالن",
  placement_create: "ثبت جوجه‌ریزی",
  // ✅ ۱۳.۱۳
  unit_update: "ویرایش واحد مرغداری",
  unit_delete: "حذف واحد مرغداری",
  hall_update: "ویرایش سالن",
  hall_delete: "حذف سالن",
  hall_physical_save: "ثبت اطلاعات فیزیکی سالن",
  hall_system_save: "ثبت سیستم‌های سالن",
  hall_water_feed_save: "ثبت آب‌خوری و دان‌خوری",
  hall_hygiene_save: "ثبت بهداشت سالن",
  // ✅ ۱۳.۱۴
  placement_update: "ویرایش جوجه‌ریزی",
  placement_delete: "حذف جوجه‌ریزی",
  placement_activate: "فعال‌سازی دوره",
  placement_deactivate: "پایان دوره",
  weekly_create: "ثبت اطلاعات هفتگی",
  weekly_update: "ویرایش اطلاعات هفتگی",
  weekly_delete: "حذف اطلاعات هفتگی",
};

// ✅ ۱۳.۱۳/۱۳.۱۴: انواع «حذف» — مودال بازبینی هشدار قرمز نشان می‌دهد
export const DESTRUCTIVE_TYPE_KEYS = [
  "unit_delete",
  "hall_delete",
  "placement_delete",
  "weekly_delete",
];

// کلیدهای آرایه‌ای payload (در گرید ویرایش پیش از تأیید نمی‌آیند)
export const LIST_PAYLOAD_KEYS = [
  "items",
  "disease_ids",
  "vaccine_ids",
  "medicine_ids",
  "feed_type_ids",
  "suggestion_ids",
];

export const REQUEST_STATUS_LABELS = {
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

const STATUS_TONE = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "muted",
};

// برچسب فارسی هر کلید payload — ✅ ۱۳.۱۶ از منبع مشترک می‌آید
// ------------------------------------------------------------
//  پیش از این، این نقشه ۷۲ کلید را دستی تکرار می‌کرد و برچسبی متفاوت از
//  پورتال داشت («شناسهٔ واحد» در برابر «واحد»). حالا از
//  `portal.payload.js` مشتق می‌شود که خودش برچسب را از spec فرم
//  (`FARM_FIELD_LABEL`) می‌گیرد ⇒ یک منبع برای برچسب/نوع/دیکشنری.
export const PAYLOAD_LABELS = Object.keys(PAYLOAD_FIELD_META).reduce(
  (acc, key) => {
    acc[key] = PAYLOAD_LABEL(key);
    return acc;
  },
  {},
);

// کلیدهایی که کارشناس می‌تواند پیش از تأیید ویرایش کند (همهٔ payload)
// ✅ ۱۳.۱۳: کلیدهای آرایه‌ای بیرون می‌مانند (ورودی متنی برای آرایه
// معنا ندارد و بازنویسی آن، دادهٔ تجهیزات را خراب می‌کند).
export const EDITABLE_PAYLOAD_KEYS = Object.keys(PAYLOAD_LABELS).filter(
  (key) => !LIST_PAYLOAD_KEYS.includes(key),
);

const badge = (status) => {
  const tone = STATUS_TONE[status] || "muted";
  const label = REQUEST_STATUS_LABELS[status] || status;
  return `<span class="prq-badge prq-badge--${esc(tone)}">${esc(label)}</span>`;
};

// ✅ ۱۳.۱۶: خلاصهٔ ستون «مقادیر» — نام دیکشنری و نام آیتم‌ها
// ------------------------------------------------------------
//  پیش از این: `breed_id: 3` و «۵ مورد». حالا: «نژاد: راس ۳۰۸» و
//  «بیماری‌ها: نیوکاسل، برونشیت».
const QUEUE_SUMMARY_LIMIT = 5;
const QUEUE_ID_GROUP_LIMIT = 2;
const QUEUE_ID_ITEM_LIMIT = 3;

const summaryListHtml = (rows = []) =>
  rows
    .map(
      (row) =>
        `<li><span>${esc(row.label)}</span><strong>${esc(row.text)}</strong></li>`,
    )
    .join("");

const payloadSummary = (payload = {}, dictionaries = {}) => {
  const rows = payloadRowsOf(payload, dictionaries).slice(0, QUEUE_SUMMARY_LIMIT);

  const idRows = payloadIdRowsOf(payload, dictionaries)
    .slice(0, QUEUE_ID_GROUP_LIMIT)
    .map((group) => {
      const names = group.items.map((item) => item.name);
      const shown = names.slice(0, QUEUE_ID_ITEM_LIMIT).join("، ");
      const more = names.length > QUEUE_ID_ITEM_LIMIT ? " …" : "";
      return { label: group.label, text: `${shown}${more}` };
    });

  const all = [...rows, ...idRows];
  return all.length ? `<ul class="prq-summary">${summaryListHtml(all)}</ul>` : "";
};

const rowActions = (item, canReview) => {
  if (item.status !== "pending") {
    return `<span class="prq-muted">${
      item.reject_reason ? `دلیل: ${esc(item.reject_reason)}` : "—"
    }</span>`;
  }
  if (!canReview) {
    return `<span class="prq-muted">فقط مشاهده</span>`;
  }
  return `
    <button type="button" class="prq-btn prq-btn--ok" data-prq-approve="${esc(item.id)}">
      <i class="fas fa-check"></i> تأیید
    </button>
    <button type="button" class="prq-btn prq-btn--danger" data-prq-reject="${esc(item.id)}">
      <i class="fas fa-xmark"></i> رد
    </button>`;
};

export const renderQueue = ({
  items = [],
  pagination = {},
  canReview = false,
  dictionaries = {},
} = {}) => {
  if (!items.length) {
    return `
      <div class="prq-empty">
        <i class="fas fa-inbox"></i>
        <p>درخواستی با این فیلترها نیست.</p>
      </div>`;
  }

  const rows = items
    .map(
      (item) => `
      <tr>
        <td>#${esc(item.id)}</td>
        <td>
          <strong>${esc(REQUEST_TYPE_LABELS[item.type] || item.type)}</strong>
          <div class="prq-sub">پرونده: ${esc(item.customer_id)}</div>
        </td>
        <td><ul class="prq-summary">${payloadSummary(item.payload, dictionaries)}</ul></td>
        <td>${esc(jalaliDate(item.created_at))}</td>
        <td>${badge(item.status)}</td>
        <td class="prq-actions">${rowActions(item, canReview)}</td>
      </tr>`,
    )
    .join("");

  const total = Number(pagination.total) || items.length;
  const page = Number(pagination.page) || 1;
  const pages = Number(pagination.pages) || 1;

  return `
    <div class="prq-table-wrap">
      <table class="prq-table">
        <thead>
          <tr>
            <th>#</th>
            <th>نوع</th>
            <th>خلاصهٔ مقادیر</th>
            <th>تاریخ ثبت</th>
            <th>وضعیت</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="prq-pager">
      <span>${esc(total)} درخواست · صفحهٔ ${esc(page)} از ${esc(pages)}</span>
      <div>
        <button type="button" class="prq-btn" data-prq-page="${Math.max(1, page - 1)}" ${
          page <= 1 ? "disabled" : ""
        }>قبلی</button>
        <button type="button" class="prq-btn" data-prq-page="${Math.min(pages, page + 1)}" ${
          page >= pages ? "disabled" : ""
        }>بعدی</button>
      </div>
    </div>`;
};

// فیلدهای ویرایش payload پیش از تأیید (کارشناس می‌تواند اصلاح کند)
// ✅ ۱۳.۱۳: کلیدهای آرایه‌ای (مثل items) ورودی متنی نمی‌گیرند؛ فقط
// تعدادشان نمایش داده می‌شود (ویرایش آن‌ها فقط از فرم پورتال است).
// ✅ ۱۳.۱۶: برچسب از منبع مشترک + زیر هر شناسهٔ دیکشنری، نام فعلی
// («فعلی: راس ۳۰۸») تا کارشناس بداند عدد ۳ چه معنایی دارد.
export const renderPayloadEditor = (payload = {}, dictionaries = {}) => {
  const source = payload && typeof payload === "object" ? payload : {};
  const listNotes = LIST_PAYLOAD_KEYS.filter(
    (key) => Array.isArray(source[key]) && source[key].length > 0,
  )
    .map(
      (key) =>
        `<p class="prq-sub">${esc(PAYLOAD_LABELS[key] || key)}: ${esc(
          source[key].length,
        )} ردیف — ویرایش فقط از پورتال</p>`,
    )
    .join("");

  const fields = Object.entries(source)
    .filter(([key]) => !LIST_PAYLOAD_KEYS.includes(key))
    .map(([key, value]) => {
      const isBoolean = typeof value === "boolean";
      const dictKey = PAYLOAD_DICT_OF(key);
      const dictName = dictKey ? dictionaryNameOf(dictionaries, dictKey, value) : "";
      const inputType =
        typeof value === "number" || key.endsWith("_id") ? "number" : "text";
      return `
        <label class="prq-field" for="prqField_${esc(key)}">
          <span>${esc(PAYLOAD_LABELS[key] || key)}</span>
          ${
            isBoolean
              ? `<input type="checkbox" id="prqField_${esc(key)}" ${
                  value ? "checked" : ""
                } data-prq-key="${esc(key)}" data-prq-type="boolean" />`
              : `<input type="${inputType}" id="prqField_${esc(key)}"
                   value="${esc(value)}" data-prq-key="${esc(key)}"
                   data-prq-type="${inputType === "number" ? "number" : "text"}" />`
          }
          ${dictName ? `<span class="prq-hint">فعلی: ${esc(dictName)}</span>` : ""}
        </label>`;
    })
    .join("");

  return `${listNotes}${fields}`;
};

// ============================================
// ✅ ۱۳.۱۶ — «زمینهٔ درخواست» + «چکیدهٔ کامل» پیش از تأیید
// ------------------------------------------------------------
//  چرا لازم بود؟ کارشناس بدون این بلوک، ده نوع هفتگی/جزئیات سالن را
//  با دیدنِ `hall_id: 12` و «۵ مورد» تأیید می‌کرد.
//
//  🔒 همهٔ مقادیر از سرور می‌آیند و پیش از درج از `esc` می‌گذرند
//     (نام واحد/سالن متن آزاد مشتری است ⇒ ریسک XSS).
//  🔒 خروجی هیچ تگ `<form>` ندارد (الگوی «بدون فرم» پروژه).
// ============================================
export const renderRequestSummary = (
  request = {},
  { dictionaries = {}, context = {} } = {},
) => {
  const payload = request.payload || {};
  const contextRows = payloadContextRowsOf(payload, context);
  const rows = payloadRowsOf(payload, dictionaries);
  const idRows = payloadIdRowsOf(payload, dictionaries);
  const items = equipmentRowsOf(payload);

  const kv = (list) =>
    list.length
      ? `<ul class="prq-kv">${list
          .map(
            (row) =>
              `<li><span>${esc(row.label)}</span><strong>${esc(row.text)}</strong></li>`,
          )
          .join("")}</ul>`
      : "";

  const idsHtml = idRows.length
    ? `<div class="prq-id-groups">
         ${idRows
           .map(
             (group) => `<div class="prq-id-group">
               <span class="prq-id-label">${esc(group.label)}</span>
               <span class="prq-chips">
                 ${group.items
                   .map((item) => `<span class="prq-chip">${esc(item.name)}</span>`)
                   .join("")}
               </span>
             </div>`,
           )
           .join("")}
       </div>`
    : "";

  const itemsHtml = items.length
    ? `<table class="prq-items">
         <caption>ردیف‌های تجهیزات این درخواست</caption>
         <thead>
           <tr><th>#</th><th>دسته</th><th>مشخصات</th><th>اندازه</th><th>ظرفیت</th><th>تعداد</th></tr>
         </thead>
         <tbody>
           ${items
             .map(
               (row) => `<tr>
                 <td>${esc(row.index)}</td>
                 <td>${esc(row.category)}</td>
                 <td>${esc(row.spec || "—")}</td>
                 <td>${esc(row.size || "—")}</td>
                 <td>${esc(row.capacity || "—")}</td>
                 <td>${esc(row.quantity || "—")}</td>
               </tr>`,
             )
             .join("")}
         </tbody>
       </table>`
    : "";

  if (!contextRows.length && !rows.length && !idRows.length && !items.length) {
    return "";
  }

  return `
    <section class="prq-review-summary">
      ${
        contextRows.length
          ? `<h4 class="prq-section-title">زمینهٔ درخواست</h4>
             ${kv(contextRows)}`
          : ""
      }
      ${
        rows.length
          ? `<h4 class="prq-section-title">مقادیر درخواست</h4>
             ${kv(rows)}`
          : ""
      }
      ${idsHtml}
      ${itemsHtml}
    </section>`;
};

export const renderReviewModalBody = (
  request = {},
  { dictionaries = {}, context = {} } = {},
) => `
  <div class="prq-review-head">
    ${badge(request.status)}
    <strong>${esc(REQUEST_TYPE_LABELS[request.type] || request.type)}</strong>
    <span class="prq-sub">پروندهٔ ${esc(request.customer_id)} · ثبت ${esc(
      jalaliDate(request.created_at),
    )}</span>
  </div>
  ${
    DESTRUCTIVE_TYPE_KEYS.includes(request.type)
      ? `<p class="prq-warn"><i class="fas fa-triangle-exclamation"></i> ${
          request.type === "unit_delete"
            ? "این درخواست حذف است و سالن‌ها، دوره‌ها، هفته‌ها و بازدیدهای واحد هم حذف می‌شوند؛ بازگشت‌پذیر نیست."
            : request.type === "placement_delete"
              ? "این درخواست حذف دوره است و هفته‌های ثبت‌شدهٔ آن هم حذف می‌شوند؛ بازگشت‌پذیر نیست."
              : request.type === "weekly_delete"
                ? "این درخواست حذف یک هفته و آیتم‌های وابستهٔ آن است؛ بازگشت‌پذیر نیست."
                : "این درخواست حذف است؛ بازگشت‌پذیر نیست."
        }</p>`
      : ""
  }
  ${request.note ? `<p class="prq-note">📝 ${esc(request.note)}</p>` : ""}
  ${renderRequestSummary(request, { dictionaries, context })}
  <h4 class="prq-section-title">اصلاح مقادیر پیش از تأیید (اختیاری)</h4>
  <div class="prq-fields" id="prqPayloadFields">
    ${renderPayloadEditor(request.payload, dictionaries)}
  </div>
  <label class="prq-field prq-field--wide" for="prqRejectReason">
    <span>دلیل رد (در صورت رد کردن — اجباری)</span>
    <textarea id="prqRejectReason" rows="2" maxlength="300"></textarea>
  </label>`;
