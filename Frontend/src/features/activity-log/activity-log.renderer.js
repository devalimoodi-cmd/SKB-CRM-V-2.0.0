// ============================================================
// features/activity-log/activity-log.renderer.js
// «فعالیت کاربران» — ساخت HTML (فاز ۱۲.۳)
// ------------------------------------------------------------
//  ⚠️ قاعدهٔ امنیتی: هر مقدارِ آمده از سرور (username / ip / path /
//     user_agent / summary / entity_id) قبل از نشستن در HTML از
//     escapeHtml عبور می‌کند؛ هیچ innerHTML خامی با دادهٔ کاربر نداریم.
//  ⚠️ کلاسِ رنگِ عمل از کلید سرور ساخته نمی‌شود بلکه از whitelist
//     ACTION_LABELS می‌آید (جلوگیری از تزریق class).
// ============================================================
import { escapeHtml, toPersianNumber } from "../../core/utils/string.utils.js";
import { formatDate } from "../../core/utils/date.utils.js";
import {
  ACTION_LABELS,
  HISTORY_MODES,
  actorLabel,
  buildActionOptions,
  deepLinkFor,
  fieldsChips,
  timeAgo,
} from "./activity-log.view.js";

const n = (value) => toPersianNumber(Number(value) || 0);

const stamp = (iso) => (iso ? formatDate(iso, "YYYY/MM/DD HH:mm") : "—");

const toneOfAction = (action) =>
  Object.prototype.hasOwnProperty.call(ACTION_LABELS, action) ? action : "other";

// ===== اسکلت کامل بخش (یک‌بار ساخته می‌شود) =====
export const renderShell = () => `
  <div class="alp-header">
    <div class="alp-header-text">
      <h3><i class="fas fa-history"></i> فعالیت کاربران</h3>
      <p>
        هر تغییر وضعیت (ایجاد/ویرایش/حذف) و هر ورود/خروج به‌طور خودکار ثبت می‌شود؛
        این صفحه فقط «خواندن» آن تاریخچه است.
      </p>
    </div>
    <div class="alp-header-actions">
      <button type="button" class="alp-btn" id="alpRefresh" title="به‌روزرسانی">
        <i class="fas fa-rotate"></i> به‌روزرسانی
      </button>
      <button type="button" class="alp-btn" id="alpExport" title="خروجی CSV">
        <i class="fas fa-file-csv"></i> خروجی CSV
      </button>
    </div>
  </div>

  <div class="alp-summary" id="alpSummary"></div>

  <div class="alp-filterbar">
    <div class="alp-field">
      <label for="alpAction">نوع عمل</label>
      <select id="alpAction"></select>
    </div>
    <div class="alp-field">
      <label for="alpSuccess">وضعیت</label>
      <select id="alpSuccess">
        <option value="">همه</option>
        <option value="true">موفق</option>
        <option value="false">ناموفق</option>
      </select>
    </div>
    <div class="alp-field">
      <label for="alpUserId">شناسهٔ کاربر</label>
      <input type="number" min="1" id="alpUserId" dir="ltr" placeholder="مثلاً 12">
    </div>
    <div class="alp-field">
      <label for="alpEntity">موجودیت</label>
      <input type="text" id="alpEntity" dir="ltr" placeholder="customers" list="alpEntityList">
      <datalist id="alpEntityList"></datalist>
    </div>
    <div class="alp-field">
      <label for="alpEntityId">شناسهٔ موجودیت</label>
      <input type="text" id="alpEntityId" dir="ltr" placeholder="مثلاً 34">
    </div>
    <div class="alp-field">
      <label for="alpCustomerId">شناسهٔ مشتری</label>
      <input type="number" min="1" id="alpCustomerId" dir="ltr" placeholder="مثلاً 12">
    </div>
    <div class="alp-field">
      <label for="alpFrom">از تاریخ (شمسی)</label>
      <input
        type="text"
        id="alpFrom"
        dir="ltr"
        autocomplete="off"
        placeholder="۱۴۰۴/۰۱/۰۱"
      >
    </div>
    <div class="alp-field">
      <label for="alpTo">تا تاریخ (شمسی)</label>
      <input
        type="text"
        id="alpTo"
        dir="ltr"
        autocomplete="off"
        placeholder="۱۴۰۴/۰۱/۰۱"
      >
    </div>
    <div class="alp-field alp-field-narrow">
      <label for="alpLimit">تعداد در صفحه</label>
      <select id="alpLimit">
        <option value="25">۲۵</option>
        <option value="50">۵۰</option>
        <option value="100">۱۰۰</option>
      </select>
    </div>
    <div class="alp-filter-actions">
      <button type="button" class="alp-btn alp-btn-primary" id="alpApply">
        <i class="fas fa-filter"></i> اعمال فیلتر
      </button>
      <button type="button" class="alp-btn" id="alpReset">
        <i class="fas fa-eraser"></i> پاک‌کردن
      </button>
      <span class="alp-filter-count" id="alpFilterCount"></span>
    </div>
  </div>

  <div class="alp-status" id="alpStatus"></div>

  <div class="alp-table-wrap" id="alpTableWrap"></div>

  <div class="alp-pager" id="alpPager"></div>

  <div class="alp-modal" id="alpDetailModal">
    <div class="alp-modal-card" role="dialog" aria-modal="true" aria-label="جزئیات فعالیت">
      <div class="alp-modal-head">
        <h4><i class="fas fa-circle-info"></i> جزئیات رویداد</h4>
        <button type="button" class="alp-modal-close" id="alpDetailClose" aria-label="بستن">
          <i class="fas fa-xmark"></i>
        </button>
      </div>
      <div class="alp-modal-body" id="alpDetailBody"></div>
    </div>
  </div>
`;

// ===== کارت‌های خلاصه =====
export const renderSummary = (summary = {}) => {
  if (!summary || !Number.isFinite(Number(summary.total))) {
    return `<div class="alp-summary-empty">خلاصهٔ آماری در دسترس نیست.</div>`;
  }

  const cards = [
    { key: "total", label: "کل رویدادها", value: n(summary.total), icon: "fa-list" },
    { key: "success", label: "موفق", value: n(summary.success), icon: "fa-circle-check" },
    { key: "failed", label: "ناموفق", value: n(summary.failed), icon: "fa-circle-exclamation" },
    { key: "actors", label: "کاربران یکتا", value: n(summary.unique_actors), icon: "fa-users" },
  ];

  const retention = Number(summary.retention_days)
    ? `<span class="alp-summary-hint"><i class="fas fa-clock-rotate-left"></i> نگهداشت ${n(
        summary.retention_days,
      )} روز</span>`
    : "";

  return `
    <div class="alp-summary-grid">
      ${cards
        .map(
          (card) => `
        <div class="alp-stat alp-stat-${card.key}">
          <i class="fas ${card.icon}"></i>
          <div>
            <span class="alp-stat-value">${card.value}</span>
            <span class="alp-stat-label">${escapeHtml(card.label)}</span>
          </div>
        </div>`,
        )
        .join("")}
    </div>
    <div class="alp-summary-meta">
      ${retention}
      <span class="alp-summary-hint">
        <i class="fas fa-database"></i> آخرین محاسبه: ${escapeHtml(stamp(summary.generated_at))}
      </span>
    </div>
  `;
};

// ===== گزینه‌های فیلتر عمل (از خلاصهٔ سرور) =====
export const renderActionOptions = (byAction = {}, selected = "") => {
  const options = buildActionOptions(byAction, selected);
  const rows = options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${option.selected ? " selected" : ""}>${
          escapeHtml(option.label)
        }${option.count ? ` (${n(option.count)})` : ""}</option>`,
    )
    .join("");
  return `<option value="">همه</option>${rows}`;
};

// ===== گزینه‌های datalist موجودیت‌ها =====
export const renderEntityOptions = (byEntity = {}) =>
  Object.keys(byEntity && typeof byEntity === "object" ? byEntity : {})
    .filter(Boolean)
    .map((key) => `<option value="${escapeHtml(key)}"></option>`)
    .join("");

// ===== یک ردیف جدول =====
const renderRow = (item = {}, { can } = {}) => {
  const link = deepLinkFor(item, typeof can === "function" ? can : () => true);
  const chips = fieldsChips(item.fields);
  const id = Number(item.id) || 0;

  return `
    <tr class="alp-row" data-activity-id="${id}" title="برای دیدن جزئیات کلیک کنید">
      <td class="alp-time">
        <span class="alp-time-abs">${escapeHtml(stamp(item.at))}</span>
        <span class="alp-time-rel">${escapeHtml(timeAgo(item.seconds_ago))}</span>
      </td>
      <td><span class="alp-actor">${escapeHtml(actorLabel(item.actor))}</span></td>
      <td>
        <span class="alp-action alp-action-${toneOfAction(item.action)}">
          ${escapeHtml(item.action_title || ACTION_LABELS[item.action] || "—")}
        </span>
      </td>
      <td>
        <span class="alp-entity">${escapeHtml(item.entity_title || item.entity || "—")}</span>
        ${item.entity_id ? `<span class="alp-entity-id">#${escapeHtml(item.entity_id)}</span>` : ""}
        ${item.customer_id ? `<span class="alp-customer-id" title="شناسهٔ مشتری مرتبط">مشتری #${n(item.customer_id)}</span>` : ""}
      </td>
      <td><code class="alp-method">${escapeHtml(item.method || "—")}</code></td>
      <td>
        <span class="alp-badge ${item.success ? "alp-badge-success" : "alp-badge-danger"}">
          ${escapeHtml(item.status_label || (item.success ? "موفق" : "ناموفق"))}
        </span>
      </td>
      <td class="alp-summary-cell">
        <span class="alp-summary-text">${escapeHtml(item.summary || "—")}</span>
        ${chips.length ? `<span class="alp-chips-count">${n(chips.length)} فیلد</span>` : ""}
      </td>
      <td>
        ${
          link
            ? `<a class="alp-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${escapeHtml(
                link.label,
              )}</a>`
            : `<span class="alp-muted">—</span>`
        }
      </td>
    </tr>`;
};

// ===== جدول کامل (یا حالت خالی) =====
export const renderTable = (items = [], { can } = {}) => {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return `
      <div class="alp-empty">
        <i class="fas fa-inbox"></i>
        <p>رویدادی با این فیلترها پیدا نشد.</p>
        <span>تا اولین تغییر یا ورود/خروج، این جدول خالی می‌ماند.</span>
      </div>`;
  }

  return `
    <table class="data-table alp-table">
      <thead>
        <tr>
          <th>زمان</th>
          <th>کاربر</th>
          <th>عمل</th>
          <th>موجودیت</th>
          <th>متد</th>
          <th>وضعیت</th>
          <th>خلاصه</th>
          <th>رکورد</th>
        </tr>
      </thead>
      <tbody>${list.map((item) => renderRow(item, { can })).join("")}</tbody>
    </table>`;
};

// ===== صفحه‌بندی =====
export const renderPager = (pagination = {}, currentPage = 1) => {
  const total = Number(pagination.total) || 0;
  const totalPages = Math.max(1, Number(pagination.total_pages) || 1);
  const page = Math.min(Math.max(1, Number(currentPage) || 1), totalPages);

  return `
    <button type="button" class="alp-btn alp-pager-btn" data-page="${page - 1}"
      ${page <= 1 ? "disabled" : ""}>
      <i class="fas fa-chevron-right"></i> قبلی
    </button>
    <span class="alp-pager-info">صفحهٔ ${n(page)} از ${n(totalPages)} · ${n(total)} ردیف</span>
    <button type="button" class="alp-btn alp-pager-btn" data-page="${page + 1}"
      ${page >= totalPages ? "disabled" : ""}>
      بعدی <i class="fas fa-chevron-left"></i>
    </button>`;
};

// ===== پیام وضعیت (خطا/هشدار) =====
export const renderNotice = (message, tone = "info") =>
  `<div class="alp-notice alp-notice-${tone === "error" ? "error" : "info"}">${escapeHtml(
    message,
  )}</div>`;

// ===== مودال جزئیات یک رویداد =====
export const renderDetail = (item = {}, { can } = {}) => {
  if (!item || !item.id) return renderNotice("این رویداد پیدا نشد.", "error");

  const link = deepLinkFor(item, typeof can === "function" ? can : () => true);
  const chips = fieldsChips(item.fields);
  const rows = [
    ["شناسه", String(item.id)],
    ["زمان دقیق", stamp(item.at)],
    ["زمان نسبی", timeAgo(item.seconds_ago)],
    ["کاربر", actorLabel(item.actor)],
    ["نقش", item.actor?.role || "—"],
    ["عمل", item.action_title || ACTION_LABELS[item.action] || "—"],
    ["موجودیت", item.entity_title || item.entity || "—"],
    ["شناسهٔ موجودیت", item.entity_id || "—"],
    ["شناسهٔ مشتری", item.customer_id ? `#${n(item.customer_id)}` : "—"],
    ["متد", item.method || "—"],
    ["مسیر", item.path || "—"],
    ["مسیر ثبت‌شده", item.route || "—"],
    [
      "کد وضعیت",
      item.status_code === null || item.status_code === undefined
        ? "—"
        : String(item.status_code),
    ],
    [
      "مدت پاسخ",
      item.duration_ms === null || item.duration_ms === undefined
        ? "—"
        : `${n(item.duration_ms)} ms`,
    ],
    ["آی‌پی", item.ip || "—"],
  ];

  return `
    <div class="alp-detail-status">
      <span class="alp-badge ${item.success ? "alp-badge-success" : "alp-badge-danger"}">
        ${escapeHtml(item.status_label || (item.success ? "موفق" : "ناموفق"))}
      </span>
      ${
        link
          ? `<a class="alp-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${escapeHtml(
              link.label,
            )}</a>`
          : ""
      }
    </div>
    <dl class="alp-detail-list">
      ${rows
        .map(
          ([key, value]) => `
        <div class="alp-detail-row">
          <dt>${escapeHtml(key)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`,
        )
        .join("")}
    </dl>
    <div class="alp-detail-block">
      <h5><i class="fas fa-pen-to-square"></i> فیلدهای تغییرکرده (${n(chips.length)})</h5>
      ${
        chips.length
          ? `<div class="alp-chips">${chips
              .map((name) => `<span class="alp-chip">${escapeHtml(name)}</span>`)
              .join("")}</div>`
          : `<p class="alp-muted">فیلدی ثبت نشده است.</p>`
      }
      <p class="alp-hint">
        <i class="fas fa-shield-halved"></i>
        فقط «نام فیلدها» ثبت می‌شود؛ مقدار رمز/توکن هیچ‌گاه ذخیره نمی‌شود.
      </p>
    </div>
    <div class="alp-detail-block">
      <h5><i class="fas fa-comment-dots"></i> خلاصه</h5>
      <p class="alp-detail-summary">${escapeHtml(item.summary || "—")}</p>
    </div>
    <div class="alp-detail-block">
      <h5><i class="fas fa-desktop"></i> مرورگر / user-agent</h5>
      <p class="alp-detail-ua" dir="ltr">${escapeHtml(item.user_agent || "—")}</p>
    </div>`;
};



// ============================================================
// موج ۱۲.۴.۱ — دیالوگ «تاریخچه» (در بستر هر صفحه)
// ------------------------------------------------------------
//  ⭐ همین مارک‌آپ در دو جا مصرف می‌شود: پنل ادمین (دکمهٔ ردیف
//     کاربران) و پروندهٔ مشتری (دکمهٔ هدر) ⇒ یک UI، دو نقطهٔ ورود.
//  ⚠️ عمداً فقط از کلاس‌های alp-hist-* استفاده می‌کند (نه data-table
//     یا alp-table): صفحهٔ پروندهٔ مشتری استایل پنل را لود نمی‌کند،
//     پس هر کلاس مشترک آن‌جا بی‌استایل می‌ماند.
//  ⚠️ امنیت: همان قاعدهٔ جدول اصلی — هر مقدار سرور از escapeHtml
//     عبور می‌کند و tone از whitelist می‌آید (نه از کلید خام).
// ============================================================

// ===== اسکلت دیالوگ (یک‌بار در body ساخته می‌شود) =====
export const renderHistoryShell = () => `
  <div class="alp-hist" id="alpHistModal" aria-hidden="true">
    <div class="alp-hist-card" role="dialog" aria-modal="true" aria-labelledby="alpHistTitle">
      <div class="alp-hist-head">
        <h4 id="alpHistTitle">تاریخچه</h4>
        <button type="button" class="alp-hist-close" id="alpHistClose" title="بستن" aria-label="بستن">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="alp-hist-tabs" id="alpHistTabs"></div>
      <div class="alp-hist-stats" id="alpHistStats"></div>
      <div class="alp-hist-body" id="alpHistBody"></div>
      <div class="alp-hist-foot">
        <button type="button" class="alp-hist-btn" id="alpHistOpenFull">
          <i class="fas fa-up-right-from-square"></i> مشاهدهٔ کامل در پنل
        </button>
        <button type="button" class="alp-hist-btn" id="alpHistExport">
          <i class="fas fa-file-csv"></i> خروجی CSV
        </button>
      </div>
    </div>
  </div>`;

// ===== تب‌ها: «تغییرات این رکورد» / «فعالیت‌های این کاربر» / «همهٔ تغییرات مشتری» =====
//   ⚠️ تب کاربر فقط با userId می‌آید و تب مشتری فقط با customerId
//      (موج ۱۲.۵) — تا هیچ تبی با فیلتر خالی رندر نشود.
export const renderHistoryTabs = (ctx, active = "changes") => {
  // ⚠️ «تغییرات این رکورد» همیشه هست (قرارداد ۱۲.۴: تب اول)
  const modes = ["changes"];
  if (ctx && ctx.customerId) modes.push("customer");
  if (ctx && ctx.userId) modes.push("actor");

  return modes
    .map(
      (mode) => `
      <button type="button" class="alp-hist-tab${mode === active ? " active" : ""}" data-mode="${mode}">
        ${escapeHtml(HISTORY_MODES[mode] || mode)}
      </button>`,
    )
    .join("");
};

// ===== یک ردیف تاریخچه =====
const renderHistoryRow = (item = {}, can = () => true) => {
  const link = deepLinkFor(item, can);
  const chips = fieldsChips(item.fields);
  const id = Number(item.id) || 0;
  const tone = toneOfAction(item.action);

  return `
    <div class="alp-hist-row" data-activity-id="${id}">
      <div class="alp-hist-when">
        <span class="alp-hist-abs">${escapeHtml(stamp(item.at))}</span>
        <span class="alp-hist-rel">${escapeHtml(timeAgo(item.seconds_ago))}</span>
      </div>
      <div class="alp-hist-line">
        <span class="alp-hist-action" data-tone="${tone}">
          ${escapeHtml(item.action_title || ACTION_LABELS[item.action] || "—")}
        </span>
        <span class="alp-hist-actor">${escapeHtml(actorLabel(item.actor))}</span>
        <span class="alp-hist-status ${item.success ? "ok" : "fail"}">
          ${escapeHtml(item.status_label || (item.success ? "موفق" : "ناموفق"))}
        </span>
      </div>
      <div class="alp-hist-summary">
        ${escapeHtml(item.summary || "—")}
        ${chips.length ? `<span class="alp-hist-chips">${n(chips.length)} فیلد</span>` : ""}
      </div>
      <div class="alp-hist-target">
        <span class="alp-hist-entity">${escapeHtml(item.entity_title || item.entity || "—")}</span>
        ${item.entity_id ? `<span class="alp-hist-entity-id">#${escapeHtml(item.entity_id)}</span>` : ""}
        ${
          item.customer_id
            ? `<span class="alp-hist-customer" title="شناسهٔ مشتری مرتبط">مشتری #${n(item.customer_id)}</span>`
            : ""
        }
        ${
          link
            ? `<a class="alp-hist-link" href="${escapeHtml(link.href)}" target="_blank" rel="noopener">${escapeHtml(
                link.label,
              )}</a>`
            : ""
        }
      </div>
    </div>`;
};

// ===== فهرست تاریخچه (یا پیام خالی/خطا) =====
export const renderHistoryList = (payload, { can } = {}) => {
  if (!payload) return renderNotice("تاریخچه‌ای برای نمایش وجود ندارد.", "error");

  const items = Array.isArray(payload.activities) ? payload.activities : [];
  if (!items.length) {
    return renderNotice(
      "برای این رکورد تا امروز تغییری ثبت نشده است. از اولین ویرایش، این فهرست پر می‌شود.",
    );
  }

  const guard = typeof can === "function" ? can : () => true;
  return `<div class="alp-hist-list">${items
    .map((item) => renderHistoryRow(item, guard))
    .join("")}</div>`;
};

