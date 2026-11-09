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
};

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

// برچسب فارسی هر کلید payload (برای نمایش و ویرایش پیش از تأیید)
export const PAYLOAD_LABELS = {
  unit_name: "نام واحد",
  address: "آدرس",
  hall_count: "تعداد سالن",
  capacity: "ظرفیت (قطعه)",
  longitude: "طول جغرافیایی",
  latitude: "عرض جغرافیایی",
  manager_name: "نام مدیر",
  manager_phone: "تلفن مدیر",
  note: "توضیح مشتری",
  unit_id: "شناسهٔ واحد",
  hall_name: "نام سالن",
  hall_number: "شمارهٔ سالن",
  nominal_capacity: "ظرفیت اسمی",
  altitude_above_sea: "ارتفاع از دریا",
  hall_type_id: "نوع سالن",
  construction_year: "سال ساخت",
  operator_name: "نام اپراتور",
  hall_id: "شناسهٔ سالن",
  placement_date: "تاریخ جوجه‌ریزی",
  chick_source_id: "مبدأ جوجه",
  breed_id: "نژاد",
  chick_age_on_arrival: "سن در ورود",
  avg_initial_weight: "میانگین وزن اولیه",
  total_chicks_count: "تعداد جوجه",
  placement_density: "تراکم",
  flock_id: "شناسهٔ گله",
  start_new_flock: "شروع گلهٔ جدید",
};

// کلیدهایی که کارشناس می‌تواند پیش از تأیید ویرایش کند (همهٔ payload)
export const EDITABLE_PAYLOAD_KEYS = Object.keys(PAYLOAD_LABELS);

const badge = (status) => {
  const tone = STATUS_TONE[status] || "muted";
  const label = REQUEST_STATUS_LABELS[status] || status;
  return `<span class="prq-badge prq-badge--${esc(tone)}">${esc(label)}</span>`;
};

const payloadSummary = (payload = {}) =>
  Object.entries(payload)
    .filter(([key, value]) => key !== "note" && value !== null && value !== "")
    .slice(0, 5)
    .map(
      ([key, value]) =>
        `<li><span>${esc(PAYLOAD_LABELS[key] || key)}</span><strong>${esc(value)}</strong></li>`,
    )
    .join("");

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

export const renderQueue = ({ items = [], pagination = {}, canReview = false } = {}) => {
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
        <td><ul class="prq-summary">${payloadSummary(item.payload)}</ul></td>
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
export const renderPayloadEditor = (payload = {}) =>
  Object.entries(payload && typeof payload === "object" ? payload : {})
    .map(([key, value]) => {
      const isBoolean = typeof value === "boolean";
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
        </label>`;
    })
    .join("");

export const renderReviewModalBody = (request = {}) => `
  <div class="prq-review-head">
    ${badge(request.status)}
    <strong>${esc(REQUEST_TYPE_LABELS[request.type] || request.type)}</strong>
    <span class="prq-sub">پروندهٔ ${esc(request.customer_id)} · ثبت ${esc(
      jalaliDate(request.created_at),
    )}</span>
  </div>
  ${request.note ? `<p class="prq-note">📝 ${esc(request.note)}</p>` : ""}
  <div class="prq-fields" id="prqPayloadFields">
    ${renderPayloadEditor(request.payload)}
  </div>
  <label class="prq-field prq-field--wide" for="prqRejectReason">
    <span>دلیل رد (در صورت رد کردن — اجباری)</span>
    <textarea id="prqRejectReason" rows="2" maxlength="300"></textarea>
  </label>`;
