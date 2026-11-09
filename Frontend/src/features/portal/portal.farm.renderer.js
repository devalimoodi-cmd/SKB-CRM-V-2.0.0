// ============================================================
// features/portal/portal.farm.renderer.js
// رندر «درخواست‌های فارم» در پورتال مشتری — موج ۱۳.۱۱
// ------------------------------------------------------------
//  چرا فایل رندر جدا؟
//   • portal.renderer.js (~۱۲۰۰ خط) رندرهای پورتال را دارد؛ فرم
//     سه‌نوعیِ درخواست + فهرست وضعیت‌ها نگرانی جداست و با mixin
//     (portal.farm.js) یک‌جا می‌آید.
//
// 🔒 قواعد:
//  ۱) هر مقدار متنی از سرور با esc() پاک می‌شود (XSS).
//  ۲) هیچ تگ فرمی ساخته نمی‌شود (ثبت با دکمهٔ type="button" و JS).
//  ۳) شناسهٔ واحد/سالن/گله/دیکشنری فقط از پاسخ سرور می‌آید.
//  ۴) دکمهٔ «لغو» فقط برای درخواست pending و فقط اگر مجوزش باشد.
// ============================================================
import { faNumber, jalaliDate } from "./portal.renderer.js";

// پاک‌سازی متن برای درج در HTML
const esc = (value) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const STATUS_TONE = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "muted",
};

const STATUS_LABEL = {
  pending: "در انتظار تأیید کارشناس",
  approved: "تأییدشده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

// ============================================================
// مشخصات فرم هر نوع درخواست (یک منبع برای رندر و خواندن مقادیر)
// ============================================================
export const FARM_FORM_SPEC = {
  unit_create: [
    { key: "unit_name", label: "نام واحد", type: "text", required: true },
    { key: "address", label: "آدرس واحد", type: "text", required: true },
    { key: "hall_count", label: "تعداد سالن", type: "number", required: true },
    { key: "capacity", label: "ظرفیت (قطعه)", type: "number", required: true },
    { key: "manager_name", label: "نام مدیر واحد", type: "text" },
    { key: "manager_phone", label: "تلفن مدیر (۱۱ رقم)", type: "tel" },
    { key: "note", label: "توضیح برای کارشناس", type: "textarea" },
  ],
  hall_create: [
    { key: "unit_id", label: "واحد", type: "unit", required: true },
    { key: "hall_name", label: "نام سالن", type: "text", required: true },
    {
      key: "hall_number",
      label: "شمارهٔ سالن (خالی = خودکار)",
      type: "number",
    },
    { key: "nominal_capacity", label: "ظرفیت اسمی (قطعه)", type: "number" },
    { key: "construction_year", label: "سال ساخت", type: "number" },
    { key: "operator_name", label: "نام اپراتور", type: "text" },
    { key: "note", label: "توضیح برای کارشناس", type: "textarea" },
  ],
  placement_create: [
    { key: "unit_id", label: "واحد", type: "unit", required: true },
    { key: "hall_id", label: "سالن", type: "hall", required: true },
    {
      key: "placement_date",
      label: "تاریخ جوجه‌ریزی",
      type: "date",
      required: true,
    },
    {
      key: "chick_source_id",
      label: "مبدأ جوجه",
      type: "source",
      required: true,
    },
    { key: "breed_id", label: "نژاد", type: "breed", required: true },
    {
      key: "avg_initial_weight",
      label: "میانگین وزن اولیه (گرم)",
      type: "number",
      required: true,
    },
    {
      key: "total_chicks_count",
      label: "تعداد کل جوجه",
      type: "number",
      required: true,
    },
    { key: "chick_age_on_arrival", label: "سن در ورود (روز)", type: "number" },
    { key: "placement_density", label: "تراکم (قطعه در متر)", type: "number" },
    { key: "flock_id", label: "افزودن به گلهٔ موجود", type: "flock" },
    {
      key: "start_new_flock",
      label: "شروع گلهٔ جدید",
      type: "check",
    },
    { key: "note", label: "توضیح برای کارشناس", type: "textarea" },
  ],
};

// شناسهٔ فیلد ورودی هر کلید (portal.farm.js از همین می‌خواند)
export const farmFieldId = (key) => `farmField_${key}`;

// برچسب فارسی فیلدها (برای خلاصهٔ payload در فهرست)
const FIELD_LABEL = FARM_FORM_SPEC.unit_create
  .concat(FARM_FORM_SPEC.hall_create, FARM_FORM_SPEC.placement_create)
  .reduce((acc, field) => {
    if (!acc[field.key]) acc[field.key] = field.label;
    return acc;
  }, {});
// ============================================================
// قطعات رندر
// ============================================================
const optionList = (items = [], { valueKey = "id", labelKey = "name", selected = "" } = {}) =>
  items
    .map((item) => {
      const value = String(item[valueKey] ?? "");
      const isSelected = String(selected ?? "") === value;
      return `<option value="${esc(value)}"${isSelected ? " selected" : ""}>${esc(item[labelKey] ?? value)}</option>`;
    })
    .join("");

// گروه‌بندی سالن‌ها/گله‌ها بر اساس واحد
const groupedOptions = (items = [], units = [], { labelOf } = {}) => {
  const unitName = new Map(
    units.map((unit) => [String(unit.id), unit.unit_name || `واحد ${unit.id}`]),
  );
  const groups = new Map();
  items.forEach((item) => {
    const key = String(item.unit_id ?? "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.entries()]
    .map(([unitId, rows]) => {
      const title = unitName.get(unitId) || "بدون واحد";
      const options = rows
        .map(
          (row) =>
            `<option value="${esc(row.id)}">${esc(labelOf ? labelOf(row) : row.name || row.id)}</option>`,
        )
        .join("");
      return `<optgroup label="${esc(title)}">${options}</optgroup>`;
    })
    .join("");
};

const fieldInput = (field, options) => {
  const id = farmFieldId(field.key);
  const required = field.required ? " required" : "";
  const star = field.required
    ? '<span class="portal-farm__req" aria-hidden="true">*</span>'
    : "";

  if (field.type === "textarea") {
    return `
      <label class="portal-farm__field" for="${id}">
        <span>${esc(field.label)}</span>
        <textarea id="${id}" rows="2" maxlength="300"></textarea>
      </label>`;
  }

  if (field.type === "unit") {
    const units = options.units || [];
    return `
      <label class="portal-farm__field" for="${id}">
        <span>${esc(field.label)}${star}</span>
        <select id="${id}"${required}>
          <option value="">— انتخاب کنید —</option>
          ${optionList(units, { valueKey: "id", labelKey: "unit_name" })}
        </select>
      </label>`;
  }

  if (field.type === "hall") {
    const halls = options.halls || [];
    return `
      <label class="portal-farm__field" for="${id}">
        <span>${esc(field.label)}${star}</span>
        <select id="${id}"${required}>
          <option value="">— انتخاب کنید —</option>
          ${groupedOptions(halls, options.units || [], {
            labelOf: (row) => row.hall_name || `سالن ${row.id}`,
          })}
        </select>
      </label>`;
  }

  if (field.type === "flock") {
    const flocks = options.flocks || [];
    if (!flocks.length) {
      return `
      <label class="portal-farm__field" for="${id}">
        <span>${esc(field.label)}</span>
        <select id="${id}" disabled>
          <option value="">گلهٔ فعالی ندارید — گلهٔ جدید ساخته می‌شود</option>
        </select>
      </label>`;
    }
    return `
      <label class="portal-farm__field" for="${id}">
        <span>${esc(field.label)}</span>
        <select id="${id}">
          <option value="">— خودکار (جدیدترین گلهٔ فعال) —</option>
          ${groupedOptions(flocks, options.units || [], {
            labelOf: (row) =>
              `گله ${row.flock_number}${row.placement_date ? ` — ${jalaliDate(row.placement_date)}` : ""}`,
          })}
        </select>
      </label>`;
  }

  const dictionary = {
    source: "chick_sources",
    breed: "breeds",
  }[field.type];

  if (dictionary) {
    const items = (options.dictionaries && options.dictionaries[dictionary]) || [];
    return `
      <label class="portal-farm__field" for="${id}">
        <span>${esc(field.label)}${star}</span>
        <select id="${id}"${required}>
          <option value="">— انتخاب کنید —</option>
          ${optionList(items)}
        </select>
      </label>`;
  }

  if (field.type === "check") {
    return `
      <label class="portal-farm__check" for="${id}">
        <input type="checkbox" id="${id}" />
        <span>${esc(field.label)}</span>
      </label>`;
  }

  const inputType = field.type === "number" ? "number" : field.type === "tel" ? "tel" : field.type === "date" ? "date" : "text";
  const extra = field.type === "number" ? ' step="any" min="0"' : "";
  return `
      <label class="portal-farm__field" for="${id}">
        <span>${esc(field.label)}${star}</span>
        <input type="${inputType}" id="${id}"${extra}${required} />
      </label>`;
};
// خلاصهٔ خوانای payload برای فهرست
const payloadSummary = (payload = {}) => {
  const rows = Object.entries(payload)
    .filter(([key, value]) => key !== "note" && value !== null && value !== "")
    .slice(0, 6)
    .map(
      ([key, value]) =>
        `<li><span>${esc(FIELD_LABEL[key] || key)}</span><strong>${esc(value)}</strong></li>`,
    )
    .join("");
  return rows ? `<ul class="portal-farm__summary">${rows}</ul>` : "";
};

const statusBadge = (status) => {
  const tone = STATUS_TONE[status] || "muted";
  const label = STATUS_LABEL[status] || status;
  return `<span class="portal-farm__badge portal-farm__badge--${esc(tone)}">${esc(label)}</span>`;
};

const requestCard = (item = {}, { canCancel = false, pendingCancelId = "" } = {}) => {
  const isCancelling = String(pendingCancelId) === String(item.id);
  const note = item.note
    ? `<p class="portal-farm__note">📝 ${esc(item.note)}</p>`
    : "";
  const reject = item.reject_reason
    ? `<p class="portal-farm__reject">دلیل رد: ${esc(item.reject_reason)}</p>`
    : "";
  const result = item.result_summary
    ? `<p class="portal-farm__result">✅ ${esc(item.result_summary)}</p>`
    : "";

  const actions =
    canCancel && item.status === "pending"
      ? isCancelling
        ? `<div class="portal-farm__confirm">
             <span>این درخواست لغو شود؟</span>
             <button type="button" class="btn btn-sm btn-outline" data-farm-cancel-cancel>بستن</button>
             <button type="button" class="btn btn-sm btn-danger" data-farm-cancel-confirm="${esc(item.id)}">بله، لغو کن</button>
           </div>`
        : `<button type="button" class="btn btn-sm btn-outline" data-farm-cancel="${esc(item.id)}">لغو درخواست</button>`
      : "";

  return `
    <article class="portal-farm__card">
      <header class="portal-farm__card-head">
        <div>
          <h4><i class="fas ${esc(item.type === "unit_create" ? "fa-building" : item.type === "hall_create" ? "fa-warehouse" : "fa-egg")}" aria-hidden="true"></i>
            ${esc(item.type_label || item.type)}</h4>
          <small>ثبت: ${esc(jalaliDate(item.created_at))}${
            item.reviewed_at ? ` · بررسی: ${esc(jalaliDate(item.reviewed_at))}` : ""
          }</small>
        </div>
        ${statusBadge(item.status)}
      </header>
      ${payloadSummary(item.payload)}
      ${note}
      ${result}
      ${reject}
      ${actions}
    </article>`;
};

// ============================================================
// رندر اصلی
// ============================================================
export const renderFarmPanel = ({
  options = {},
  meta = {},
  items = [],
  activeType = "unit_create",
  canRequest = false,
  canCancel = false,
  pendingCancelId = "",
  error = "",
} = {}) => {
  const counts = meta.counts || {};
  const limits = meta.limits || {};
  const maxPending = Number(limits.max_pending) || 10;
  const pending = Number(counts.pending) || 0;
  const types =
    Array.isArray(meta.types) && meta.types.length
      ? meta.types
      : Object.keys(FARM_FORM_SPEC).map((key) => ({ key, label: key }));

  const typeTabs = types
    .map(
      (type) => `
      <button type="button"
        class="portal-farm__type${type.key === activeType ? " is-active" : ""}"
        data-farm-type="${esc(type.key)}">
        <i class="fas ${esc(type.icon || "fa-plus")}" aria-hidden="true"></i>
        <span>${esc(type.label)}</span>
      </button>`,
    )
    .join("");

  const spec = FARM_FORM_SPEC[activeType] || FARM_FORM_SPEC.unit_create;
  const formFields = spec.map((field) => fieldInput(field, options)).join("");

  const quotaReached = pending >= maxPending;
  const submitBox = canRequest
    ? quotaReached
      ? `<p class="portal-farm__warn">سقف ${faNumber(maxPending)} درخواست در انتظار پر شده است؛ تا تعیین تکلیف درخواست‌های قبلی، درخواست تازه ثبت نمی‌شود.</p>`
      : `<div class="portal-farm__actions">
           <button type="button" class="btn btn-primary" data-farm-submit>ارسال درخواست برای بررسی کارشناس</button>
           <span class="portal-farm__hint">تا تأیید کارشناس، هیچ داده‌ای در سیستم ثبت نمی‌شود.</span>
         </div>`
    : "";

  const list = items.length
    ? items.map((item) => requestCard(item, { canCancel, pendingCancelId })).join("")
    : `<p class="portal-farm__empty">هنوز درخواستی ثبت نکرده‌اید.</p>`;

  return `
    <section class="portal-farm">
      <div class="portal-farm__head">
        <h3>درخواست تازه</h3>
        <span class="portal-farm__counter">${faNumber(pending)} در انتظار · سقف ${faNumber(maxPending)}</span>
      </div>

      <div class="portal-farm__types" role="tablist">${typeTabs}</div>

      ${
        canRequest
          ? `<div class="portal-farm__form" role="group" aria-label="فرم درخواست">
               ${formFields}
               ${submitBox}
             </div>`
          : `<p class="portal-farm__warn">ثبت درخواست برای حساب شما بسته است. برای فعال‌سازی با مدیر سیستم تماس بگیرید.</p>`
      }

      <div class="portal-farm__error" role="alert">${error ? esc(error) : ""}</div>

      <div class="portal-farm__head">
        <h3>درخواست‌های من</h3>
      </div>
      <div class="portal-farm__list">${list}</div>
    </section>`;
};


