// ============================================================
// features/portal/portal.farm.renderer.js
// رندر «درخواست‌های فارم» در پورتال مشتری — موج ۱۳.۱۱ → ۱۳.۱۵
// ------------------------------------------------------------
//  چرا فایل رندر جدا؟
//   • portal.renderer.js رندرهای عمومی پورتال را دارد؛ فرم ۱۸ نوعیِ
//     درخواست + فهرست وضعیت‌ها نگرانی جداست و با mixin (portal.farm.js)
//     یک‌جا می‌آید.
//
// 🔒 قواعد:
//  ۱) هر مقدار متنی از سرور با esc() پاک می‌شود (XSS).
//  ۲) هیچ تگ فرمی ساخته نمی‌شود (ثبت با دکمهٔ type="button" و JS).
//  ۳) شناسهٔ واحد/سالن/دوره/دیکشنری فقط از پاسخ سرور می‌آید.
//  ۴) دکمهٔ «لغو» فقط برای درخواست pending و فقط اگر مجوزش باشد.
//  ۵) ✅ ۱۳.۱۵: مشخصات فرم‌ها از `portal.farm.rules.js` می‌آید
//     (یک منبع با payload) — این فایل فقط «چطور رندر شود» را می‌داند.
//  ۶) ✅ ۱۳.۱۵: چهار نوع حذفی بنر قرمز + تأیید دوم دارند
//     (هم‌راستا با DESTRUCTIVE_TYPES سرور).
// ============================================================
import { faNumber, jalaliDate } from "./portal.renderer.js";
import {
  FARM_FIELD_LABEL,
  FARM_FORM_GROUPS,
  FARM_FORM_SPEC,
  FARM_MAX_LIST_ITEMS,
  farmFieldId,
  farmIsDestructive,
  farmSpecOf,
  farmTypeMeta,
} from "./portal.farm.rules.js";
import { weekOptionText } from "./portal.farm.weeks.js";

// بازصادرات برای portal.farm.js و گاردها (یک منبع، دو نام)
export { FARM_FORM_SPEC, farmFieldId };

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

// دسته‌های ردیف تجهیزات — آینهٔ SYSTEM_ITEM_CATEGORIES سرور
const ITEM_CATEGORIES = [
  { key: "heating", label: "گرمایش" },
  { key: "cooling", label: "سرمایش" },
  { key: "ventilation", label: "تهویه" },
  { key: "fan", label: "فن" },
  { key: "sanitary", label: "بهداشتی" },
  { key: "lighting", label: "روشنایی" },
];

// فیلدهایی که تمام عرض فرم را می‌گیرند
const WIDE_TYPES = ["textarea", "items", "multi", "radio"];


// ============================================================
// قطعات رندر عمومی
// ============================================================
const valueOf = (values, key) => {
  const source = values && typeof values === "object" ? values : {};
  const raw = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : "";
  return raw === null || raw === undefined ? "" : raw;
};

const optionList = (
  items = [],
  { valueKey = "id", labelKey = "name", selected = "", emptyLabel = "" } = {},
) => {
  const rows = Array.isArray(items) ? items : [];
  const body = rows
    .map((item) => {
      const value = String(item[valueKey] ?? "");
      const isSelected = String(selected ?? "") === value;
      return `<option value="${esc(value)}"${isSelected ? " selected" : ""}>${esc(
        item[labelKey] ?? value,
      )}</option>`;
    })
    .join("");
  const empty = emptyLabel
    ? `<option value="">${esc(emptyLabel)}</option>`
    : "";
  return `${empty}${body}`;
};

const unitsOf = (options) => (options && options.units) || [];
const hallsOf = (options) => (options && options.halls) || [];
const dictOf = (options, key) =>
  (options && options.dictionaries && options.dictionaries[key]) || [];

// برچسب خوانای سالن (برای فهرست‌های کشویی و خلاصه‌ها)
const hallLabel = (row = {}) => row.hall_name || `سالن ${row.id}`;

// گروه‌بندی سالن‌ها/گله‌ها بر اساس واحد
const groupedOptions = (
  items = [],
  units = [],
  { labelOf, flagKey = "" } = {},
) => {
  const unitName = new Map(
    (units || []).map((unit) => [
      String(unit.id),
      unit.unit_name || `واحد ${unit.id}`,
    ]),
  );
  const groups = new Map();
  (items || []).forEach((item) => {
    const key = String(item.unit_id ?? "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  return [...groups.entries()]
    .map(([unitId, rows]) => {
      const title = unitName.get(unitId) || "بدون واحد";
      const options = rows
        .map((row) => {
          const done = flagKey && row[flagKey] ? " ✓" : "";
          const label = labelOf ? labelOf(row) : row.name || row.id;
          return `<option value="${esc(row.id)}">${esc(`${label}${done}`)}</option>`;
        })
        .join("");
      return `<optgroup label="${esc(title)}">${options}</optgroup>`;
    })
    .join("");
};

// برچسب دوره: «سالن — تاریخ — تعداد (فعال)»
const placementLabel = (options, row = {}) => {
  const hall = hallsOf(options).find(
    (item) => String(item.id) === String(row.hall_id),
  );
  const parts = [hall ? hallLabel(hall) : `سالن ${row.hall_id ?? "?"}`];
  if (row.placement_date) parts.push(jalaliDate(row.placement_date));
  if (row.total_chicks_count) {
    parts.push(`${faNumber(row.total_chicks_count)} قطعه`);
  }
  return `${parts.join(" — ")}${row.is_active ? " (فعال)" : ""}`;
};

// گزینه‌های دوره با فیلتر فعال/غیرفعال (فرم هفته فقط دورهٔ فعال را می‌پذیرد)
const placementOptions = (options, { filter = "all", selected = "" } = {}) => {
  const rows = ((options && options.placements) || []).filter((row) => {
    if (filter === "active") return Boolean(row.is_active);
    if (filter === "inactive") return !row.is_active;
    return true;
  });
  if (!rows.length) {
    return `<option value="">دوره‌ای با این فیلتر ندارید</option>`;
  }
  return rows
    .map((row) => {
      const value = String(row.id);
      return `<option value="${esc(value)}"${
        String(selected ?? "") === value ? " selected" : ""
      }>${esc(placementLabel(options, row))}</option>`;
    })
    .join("");
};

// گزینه‌های هفته (از جزئیات دورهٔ انتخاب‌شده)
const weekOptions = (weeks = [], selected = "") => {
  const rows = Array.isArray(weeks) ? weeks : [];
  if (!rows.length) {
    return `<option value="">هفته‌ای ثبت نشده است</option>`;
  }
  return rows
    .map((row) => {
      const value = String(row.id);
      return `<option value="${esc(value)}"${
        String(selected ?? "") === value ? " selected" : ""
      }>${esc(weekOptionText(row))}</option>`;
    })
    .join("");
};

// قالب مشترک هر فیلد (برچسب + ورودی + راهنما)
const fieldBox = (field, inner, { wide = false, asLabel = true } = {}) => {
  const id = farmFieldId(field.key);
  const star = field.required
    ? '<span class="portal-farm__req" aria-hidden="true">*</span>'
    : "";
  const hint = field.hint
    ? `<small class="portal-farm__help">${esc(field.hint)}</small>`
    : "";
  const classes = `portal-farm__field${wide ? " portal-farm__field--wide" : ""}`;

  if (!asLabel) {
    return `
      <div class="${classes}" data-farm-field="${esc(field.key)}">
        <span>${esc(field.label)}${star}</span>
        ${inner}
        ${hint}
      </div>`;
  }

  return `
      <label class="${classes}" for="${id}">
        <span>${esc(field.label)}${star}</span>
        ${inner}
        ${hint}
      </label>`;
};

// ویژگی‌های عددی ورودی (حدها از spec می‌آید؛ longitude/latitude حد ندارند)
const numberAttrs = (field) => {
  const step = field.step === undefined ? "any" : field.step;
  const parts = [` step="${step}"`];
  if (field.min !== undefined) parts.push(` min="${field.min}"`);
  if (field.max !== undefined) parts.push(` max="${field.max}"`);
  return parts.join("");
};

// ============================================================
// رندر فیلدها (هر نوع یک شاخه — بدون قالب تکراری)
// ============================================================
// پرچم «این بخش جزئیات قبلاً ثبت شده» برای هر حوزهٔ سالن
const flagKeyOf = (type) =>
  ({
    hall_physical_save: "has_physical",
    hall_system_save: "has_system",
    hall_water_feed_save: "has_water_feed",
    hall_hygiene_save: "has_hygiene",
  })[type] || "";

// ردیف‌های تجهیزات (اگر مقداری نبود، یک ردیف خالی نشان می‌دهیم)
const itemRowsOf = (values) => {
  const rows =
    values && Array.isArray(values.items) ? values.items.filter(Boolean) : [];
  return rows.length ? rows : [{}];
};

export const farmItemRowHtml = (row = {}, index = 0) => `
  <div class="portal-farm__item-row" data-farm-item-row>
    <select data-farm-item-field="category" aria-label="دستهٔ تجهیز">
      <option value="">— دسته —</option>
      ${ITEM_CATEGORIES.map(
        (item) =>
          `<option value="${esc(item.key)}"${
            row.category === item.key ? " selected" : ""
          }>${esc(item.label)}</option>`,
      ).join("")}
    </select>
    <input type="text" data-farm-item-field="spec" placeholder="مشخصه"
      maxlength="100" value="${esc(row.spec ?? "")}" />
    <input type="number" data-farm-item-field="quantity" placeholder="تعداد"
      min="0" step="1" value="${esc(row.quantity ?? "")}" />
    <input type="text" data-farm-item-field="size" placeholder="اندازه"
      maxlength="50" value="${esc(row.size ?? "")}" />
    <input type="text" data-farm-item-field="capacity" placeholder="ظرفیت"
      maxlength="50" value="${esc(row.capacity ?? "")}" />
    <input type="hidden" data-farm-item-field="type_id" value="${esc(row.type_id ?? "")}" />
    <button type="button" class="btn btn-sm btn-outline" data-farm-item-remove="${index}"
      aria-label="حذف ردیف">×</button>
  </div>`;

const itemsRepeater = (field, values) => `
  <div class="portal-farm__items" data-farm-items>
    ${itemRowsOf(values).map((row, index) => farmItemRowHtml(row, index)).join("")}
    <div class="portal-farm__items-foot">
      <button type="button" class="btn btn-sm btn-outline" data-farm-item-add>+ افزودن ردیف</button>
      <small class="portal-farm__help">حداکثر ${faNumber(FARM_MAX_LIST_ITEMS)} ردیف · ردیف بدون دسته ذخیره نمی‌شود · برای نگه‌داشتن ردیف‌های قبلی، این بخش را خالی رها کنید.</small>
    </div>
  </div>`;

// پنج گروه شناسهٔ هفتگی (چک‌باکس — روی موبایل قابل استفاده‌تر از multi-select)
const multiBox = (field, options, values) => {
  const items = dictOf(options, field.dict);
  if (!items.length) {
    return `<p class="portal-farm__help">گزینه‌ای برای این بخش تعریف نشده است.</p>`;
  }
  const chosen = Array.isArray(values[field.key])
    ? values[field.key].map((item) => String(item))
    : [];
  const boxes = items
    .map((item) => {
      const value = String(item.id);
      return `<label class="portal-farm__multi-item">
          <input type="checkbox" data-farm-multi-value="${esc(value)}"${
            chosen.includes(value) ? " checked" : ""
          } />
          <span>${esc(item.name ?? value)}</span>
        </label>`;
    })
    .join("");
  return `<div class="portal-farm__multi" data-farm-multi="${esc(field.key)}">${boxes}</div>`;
};

const radioBox = (field, values) => {
  const current = String(valueOf(values, field.key));
  const options = field.options || [];
  const boxes = options
    .map(
      (item) => `<label class="portal-farm__radio-item">
        <input type="radio" name="${farmFieldId(field.key)}"
          value="${esc(item.value)}"${current === item.value ? " checked" : ""} />
        <span>${esc(item.label)}</span>
      </label>`,
    )
    .join("");
  return `<div class="portal-farm__radio" data-farm-radio="${esc(field.key)}">${boxes}</div>`;
};

export const fieldInput = (field, ctx = {}) => {
  const options = ctx.options || {};
  const values = ctx.values || {};
  const weeks = ctx.weeks || [];
  const activeType = ctx.activeType || "";
  const id = farmFieldId(field.key);
  const required = field.required ? " required" : "";
  const selected = String(valueOf(values, field.key));
  const wide = WIDE_TYPES.includes(field.type);

  if (field.type === "textarea") {
    const maxLength = field.maxLength || 300;
    return fieldBox(
      field,
      `<textarea id="${id}" rows="${field.rows || 2}" maxlength="${maxLength}">${esc(
        valueOf(values, field.key),
      )}</textarea>`,
      { wide: true },
    );
  }

  if (field.type === "unit") {
    return fieldBox(
      field,
      `<select id="${id}"${required}>
        <option value="">— انتخاب کنید —</option>
        ${optionList(unitsOf(options), {
          valueKey: "id",
          labelKey: "unit_name",
          selected,
        })}
      </select>`,
    );
  }

  if (field.type === "hall") {
    return fieldBox(
      field,
      `<select id="${id}"${required}>
        <option value="">— انتخاب کنید —</option>
        ${groupedOptions(hallsOf(options), unitsOf(options), {
          labelOf: hallLabel,
          flagKey: flagKeyOf(activeType),
        })}
      </select>`,
    );
  }

  if (field.type === "placement") {
    return fieldBox(
      field,
      `<select id="${id}"${required}>
        ${placementOptions(options, {
          filter: field.filter || "all",
          selected,
        })}
      </select>`,
    );
  }

  if (field.type === "week") {
    return fieldBox(
      field,
      `<select id="${id}"${required}>
        <option value="">— انتخاب هفته —</option>
        ${weekOptions(weeks, selected)}
      </select>`,
    );
  }

  if (field.type === "flock") {
    const flocks = (options && options.flocks) || [];
    if (!flocks.length) {
      return fieldBox(
        field,
        `<select id="${id}" disabled>
          <option value="">گلهٔ فعالی ندارید — گلهٔ جدید ساخته می‌شود</option>
        </select>`,
      );
    }
    return fieldBox(
      field,
      `<select id="${id}">
        <option value="">— خودکار (جدیدترین گلهٔ فعال) —</option>
        ${groupedOptions(flocks, unitsOf(options), {
          labelOf: (row) =>
            `گله ${row.flock_number}${
              row.placement_date ? ` — ${jalaliDate(row.placement_date)}` : ""
            }`,
        })}
      </select>`,
    );
  }

  if (field.type === "dict") {
    return fieldBox(
      field,
      `<select id="${id}"${required}>
        <option value="">— انتخاب کنید —</option>
        ${optionList(dictOf(options, field.dict), { selected })}
      </select>`,
    );
  }

  if (field.type === "check") {
    return `
      <label class="portal-farm__check" for="${id}">
        <input type="checkbox" id="${id}"${
          valueOf(values, field.key) === true ? " checked" : ""
        } />
        <span>${esc(field.label)}</span>
      </label>`;
  }

  if (field.type === "radio") {
    return fieldBox(field, radioBox(field, values), {
      wide: true,
      asLabel: false,
    });
  }

  if (field.type === "multi") {
    return fieldBox(field, multiBox(field, options, values), {
      wide: true,
      asLabel: false,
    });
  }

  if (field.type === "items") {
    return fieldBox(field, itemsRepeater(field, values), {
      wide: true,
      asLabel: false,
    });
  }

  if (field.type === "static") {
    return fieldBox(
      field,
      `<input type="text" id="${id}" readonly value="${esc(
        valueOf(values, field.key),
      )}" />`,
    );
  }

  const inputType =
    field.type === "number"
      ? "number"
      : field.type === "tel"
        ? "tel"
        : field.type === "date"
          ? "date"
          : "text";
  const extra = field.type === "number" ? numberAttrs(field) : "";
  const maxLength = field.maxLength ? ` maxlength="${field.maxLength}"` : "";

  return fieldBox(
    field,
    `<input type="${inputType}" id="${id}"${extra}${maxLength}${required}
      value="${esc(valueOf(values, field.key))}" />`,
    { wide },
  );
};

// ============================================================
// خلاصهٔ خوانای payload برای فهرست درخواست‌های من
// ============================================================
const summaryValueOf = (value) => {
  if (Array.isArray(value)) {
    return value.length ? `${faNumber(value.length)} مورد` : "";
  }
  if (value === true) return "بله";
  if (value === false) return "خیر";
  if (value && typeof value === "object") return "";
  return String(value ?? "").trim();
};

const payloadSummary = (payload = {}) => {
  const rows = Object.entries(payload && typeof payload === "object" ? payload : {})
    .filter(([key]) => key !== "note" && key !== "confirm_name")
    .map(([key, value]) => {
      const text = summaryValueOf(value);
      if (!text) return "";
      return `<li><span>${esc(FARM_FIELD_LABEL[key] || key)}</span><strong>${esc(
        text,
      )}</strong></li>`;
    })
    .filter(Boolean)
    .slice(0, 8)
    .join("");
  return rows ? `<ul class="portal-farm__summary">${rows}</ul>` : "";
};

const statusBadge = (status) => {
  const tone = STATUS_TONE[status] || "muted";
  const label = STATUS_LABEL[status] || status;
  return `<span class="portal-farm__badge portal-farm__badge--${esc(tone)}">${esc(
    label,
  )}</span>`;
};

const requestCard = (item = {}, { canCancel = false, pendingCancelId = "" } = {}) => {
  const isCancelling = String(pendingCancelId) === String(item.id);
  const meta = farmTypeMeta(item.type) || {};
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
             <button type="button" class="btn btn-sm btn-danger" data-farm-cancel-confirm="${esc(
               item.id,
             )}">بله، لغو کن</button>
           </div>`
        : `<button type="button" class="btn btn-sm btn-outline" data-farm-cancel="${esc(
            item.id,
          )}">لغو درخواست</button>`
      : "";

  return `
    <article class="portal-farm__card${
      farmIsDestructive(item.type) ? " portal-farm__card--danger" : ""
    }">
      <header class="portal-farm__card-head">
        <div>
          <h4><i class="fas ${esc(meta.icon || "fa-file-lines")}" aria-hidden="true"></i>
            ${esc(item.type_label || meta.label || item.type)}</h4>
          <small>ثبت: ${esc(jalaliDate(item.created_at))}${
            item.reviewed_at
              ? ` · بررسی: ${esc(jalaliDate(item.reviewed_at))}`
              : ""
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
// پیام هشدار هر نوع حذفی (متن کوتاه و روشن — بدون واژهٔ فنی)
const DANGER_HINT = {
  unit_delete:
    "با تأیید کارشناس، این واحد همراه همهٔ سالن‌ها، دوره‌ها، هفته‌ها و بازدیدهای آن حذف می‌شود.",
  hall_delete:
    "سالن از واحد حذف می‌شود؛ سوابق هفته‌ها و بازدیدها دست‌نخورده می‌ماند.",
  placement_delete:
    "این دوره به‌همراه همهٔ هفته‌های ثبت‌شدهٔ آن حذف می‌شود.",
  weekly_delete:
    "این هفته و آیتم‌های وابستهٔ آن (بیماری/واکسن/دارو/خوراک/پیشنهاد) حذف می‌شود.",
};

const typeTabHtml = (type, activeType) => `
  <button type="button"
    class="portal-farm__type${type.key === activeType ? " is-active" : ""}"
    role="tab"
    aria-selected="${type.key === activeType ? "true" : "false"}"
    data-farm-type="${esc(type.key)}">
    <i class="fas ${esc(type.icon || "fa-plus")}" aria-hidden="true"></i>
    <span>${esc(type.label || type.key)}</span>
    ${
      type.destructive
        ? '<i class="fas fa-triangle-exclamation portal-farm__type-warn" aria-hidden="true"></i>'
        : ""
    }
  </button>`;

// تب‌های گروه‌بندی‌شده (۵ گروه · ۱۸ نوع)
const groupedTabsHtml = (typeMap, activeType) =>
  FARM_FORM_GROUPS.map((group) => {
    const types = group.types
      .filter((key) => typeMap.has(key))
      .map((key) => typeMap.get(key));
    if (!types.length) return "";
    return `
      <div class="portal-farm__group">
        <h4 class="portal-farm__group-title">
          <i class="fas ${esc(group.icon)}" aria-hidden="true"></i>
          <span>${esc(group.label)}</span>
        </h4>
        <div class="portal-farm__types" role="tablist" aria-label="${esc(group.label)}">
          ${types.map((type) => typeTabHtml(type, activeType)).join("")}
        </div>
      </div>`;
  }).join("");

export const renderFarmPanel = ({
  options = {},
  meta = {},
  items = [],
  activeType = "unit_create",
  canRequest = false,
  canCancel = false,
  pendingCancelId = "",
  error = "",
  values = {},
  weeks = [],
  loading = false,
  prefillNote = "",
  confirmOpen = false,
} = {}) => {
  const counts = meta.counts || {};
  const limits = meta.limits || {};
  const maxPending = Number(limits.max_pending) || 10;
  const pending = Number(counts.pending) || 0;

  // ⚠️ فقط نوع‌هایی تب می‌گیرند که فرم کلاینت دارند (۱۸ نوع از ۱۳.۱۵).
  //    اگر روزی سرور نوع تازه‌ای اضافه کرد، تب بی‌فرم ساخته نمی‌شود.
  const serverTypes = Array.isArray(meta.types)
    ? meta.types.filter((item) => item && FARM_FORM_SPEC[item.key])
    : [];
  const types = serverTypes.length
    ? serverTypes
    : Object.keys(FARM_FORM_SPEC).map((key) => ({ key, label: key }));
  const typeMap = new Map(types.map((type) => [type.key, type]));

  const activeMeta = typeMap.get(activeType) || farmTypeMeta(activeType) || {};
  const spec = farmSpecOf(activeType);
  const destructive = farmIsDestructive(activeType);
  const formFields = spec
    .map((field) => fieldInput(field, { options, values, weeks, activeType }))
    .join("");

  const dangerBanner = destructive
    ? `<p class="portal-farm__danger">
         <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
         <span>${esc(DANGER_HINT[activeType] || "این درخواست بازگشت‌ناپذیر است.")}</span>
       </p>`
    : "";

  const prefillLine = loading
    ? `<p class="portal-farm__loading">در حال بارگذاری مقادیر فعلی…</p>`
    : prefillNote
      ? `<p class="portal-farm__hint">${esc(prefillNote)}</p>`
      : "";

  const quotaReached = pending >= maxPending;
  const confirmPanel = `
    <div class="portal-farm__confirm portal-farm__confirm--danger">
      <span>درخواست «${esc(activeMeta.label || activeType)}» ثبت شود؟ پس از تأیید کارشناس بازگشت‌ناپذیر است.</span>
      <button type="button" class="btn btn-sm btn-outline" data-farm-abort>بستن</button>
      <button type="button" class="btn btn-sm btn-danger" data-farm-submit>بله، ثبت کن</button>
    </div>`;

  const actions = destructive
    ? `<div class="portal-farm__actions">
         <button type="button" class="btn btn-danger" data-farm-submit>ثبت درخواست حذف برای بررسی کارشناس</button>
         <span class="portal-farm__hint">حذف فقط با تأیید کارشناس انجام می‌شود.</span>
       </div>`
    : `<div class="portal-farm__actions">
         <button type="button" class="btn btn-primary" data-farm-submit>ارسال درخواست برای بررسی کارشناس</button>
         <span class="portal-farm__hint">تا تأیید کارشناس، هیچ داده‌ای در سیستم ثبت نمی‌شود.</span>
       </div>`;

  const submitBox = canRequest
    ? quotaReached
      ? `<p class="portal-farm__warn">سقف ${faNumber(maxPending)} درخواست در انتظار پر شده است؛ تا تعیین تکلیف درخواست‌های قبلی، درخواست تازه ثبت نمی‌شود.</p>`
      : destructive && confirmOpen
        ? confirmPanel
        : actions
    : "";

  const list = items.length
    ? items
        .map((item) => requestCard(item, { canCancel, pendingCancelId }))
        .join("")
    : `<p class="portal-farm__empty">هنوز درخواستی ثبت نکرده‌اید.</p>`;

  return `
    <section class="portal-farm">
      <div class="portal-farm__head">
        <h3>درخواست تازه</h3>
        <span class="portal-farm__counter">${faNumber(pending)} در انتظار · سقف ${faNumber(maxPending)}</span>
      </div>

      <div class="portal-farm__groups">${groupedTabsHtml(typeMap, activeType)}</div>

      ${
        canRequest
          ? `<div class="portal-farm__form" role="group" aria-label="فرم درخواست"
                 data-farm-active-type="${esc(activeType)}">
               <p class="portal-farm__title">
                 <i class="fas ${esc(activeMeta.icon || "fa-file-lines")}" aria-hidden="true"></i>
                 <span>${esc(activeMeta.label || activeType)}</span>
               </p>
               ${dangerBanner}
               ${prefillLine}
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

