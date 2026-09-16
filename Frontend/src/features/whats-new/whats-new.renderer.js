// ============================================================
// features/whats-new/whats-new.renderer.js
// رندر مشترک «تغییرات جدید» — هم مودال کاربر و هم پیش‌نمایش پنل ادمین
// از همین توابع استفاده می‌کنند تا ظاهرشان همیشه یکی باشد.
// ============================================================
import {
  escapeHtml,
  toPersianNumber,
} from "../../core/utils/string.utils.js";

// ===== دسته‌بندی‌ها (ترتیب نمایش هم همین است) =====
export const CATEGORY_META = {
  new: { label: "ویژگی‌های جدید", short: "جدید", icon: "fa-star" },
  improved: { label: "بهبودها", short: "بهبود", icon: "fa-arrow-up" },
  fixed: { label: "رفع باگ‌ها", short: "رفع باگ", icon: "fa-bug" },
  security: { label: "امنیت", short: "امنیت", icon: "fa-shield-alt" },
};

export const CATEGORY_ORDER = ["new", "improved", "fixed", "security"];

export const AUDIENCE_LABELS = {
  all: "همهٔ کاربران",
  customers: "مشتریان",
  experts: "کارشناسان",
  admins: "ادمین‌ها",
};

export const STATUS_LABELS = {
  draft: "پیش‌نویس",
  published: "منتشرشده",
  archived: "آرشیو",
};

export const audienceLabel = (key) => AUDIENCE_LABELS[key] || key || "—";
export const statusLabel = (key) => STATUS_LABELS[key] || key || "—";

// ===== گروه‌بندی آیتم‌ها بر اساس دسته =====
export const groupItems = (items = []) => {
  const grouped = { new: [], improved: [], fixed: [], security: [] };
  (items || []).forEach((item) => {
    const category = grouped[item?.category] ? item.category : "new";
    grouped[category].push(item);
  });
  return grouped;
};

// ===== شمارهٔ نسخه با ارقام فارسی =====
export const versionLabel = (version) => toPersianNumber(version || "—");

// ===== بخش‌های مودال (دسته‌بندی‌شده) =====
export const renderBody = (release, { emptyText = "هنوز آیتمی اضافه نشده است" } = {}) => {
  const grouped = groupItems(release?.items || []);

  const sections = CATEGORY_ORDER.filter(
    (key) => grouped[key].length > 0,
  ).map((key) => {
    const meta = CATEGORY_META[key];
    const rows = grouped[key]
      .map(
        (item) => `
          <div class="wn-item">
            <span class="wn-item-bullet"></span>
            <div class="wn-item-content">
              <div class="wn-item-title">${escapeHtml(item.title)}</div>
              ${item.description ? `<div class="wn-item-desc">${escapeHtml(item.description)}</div>` : ""}
              ${
                item.tag
                  ? `<span class="wn-item-tag ${key}"><i class="fas ${meta.icon}"></i> ${escapeHtml(item.tag)}</span>`
                  : ""
              }
            </div>
          </div>`,
      )
      .join("");

    return `
      <section class="wn-section">
        <header class="wn-section-head">
          <span class="wn-section-icon ${key}"><i class="fas ${meta.icon}"></i></span>
          <span class="wn-section-title">${escapeHtml(meta.label)}</span>
          <span class="wn-section-count">${toPersianNumber(grouped[key].length)} مورد</span>
        </header>
        <div class="wn-section-list">${rows}</div>
      </section>`;
  });

  if (!sections.length) {
    return `
      <div class="wn-empty">
        <i class="fas fa-inbox"></i>
        <p>${escapeHtml(emptyText)}</p>
      </div>`;
  }

  return sections.join("");
};

// ============================================================
// مودال کامل تغییرات
//   mode = "user"    → دکمه‌ها فعال (مودال کاربر)
//   mode = "preview" → دکمه‌ها غیرفعال (پیش‌نمایش پنل ادمین)
// ============================================================
export const renderModal = (release, { mode = "user", emptyText } = {}) => {
  const isPreview = mode === "preview";
  const title = escapeHtml(release?.title || "تغییرات جدید");
  const description = escapeHtml(release?.description || "");
  const version = versionLabel(release?.version);

  return `
    <div class="wn-modal-topbar"></div>

    <header class="wn-modal-head">
      <span class="wn-modal-icon"><i class="fas fa-gift"></i></span>
      <div class="wn-modal-head-text">
        <h3>
          ${title}
          <span class="wn-version-badge">نسخه ${version}</span>
        </h3>
        ${description ? `<p>${description}</p>` : ""}
      </div>
      ${
        isPreview
          ? ""
          : `<button type="button" class="wn-close" data-wn-action="close" aria-label="بستن">&times;</button>`
      }
    </header>

    <div class="wn-modal-body" data-wn-body>
      ${renderBody(release, { emptyText })}
    </div>

    <footer class="wn-modal-foot">
      <label class="wn-checkbox">
        <input type="checkbox" data-wn-dont-show ${isPreview ? "disabled" : ""}>
        <span>دیگر نشان نده</span>
      </label>
      <div class="wn-foot-actions">
        <button type="button" class="wn-btn wn-btn-ghost" data-wn-action="close" ${isPreview ? "disabled" : ""}>
          <i class="fas fa-times"></i> بستن
        </button>
        <button type="button" class="wn-btn wn-btn-primary" data-wn-action="confirm" ${isPreview ? "disabled" : ""}>
          <i class="fas fa-check"></i> متوجه شدم
        </button>
      </div>
    </footer>`;
};

// ===== کارت خلاصهٔ یک نسخه (برای فهرست تاریخچه در پنل ادمین) =====
export const renderSummaryRow = (release) => {
  const counts = CATEGORY_ORDER.map((key) => {
    const total = (release?.items || []).filter((i) => i.category === key).length;
    if (!total) return "";
    return `<span class="wn-chip ${key}">${escapeHtml(CATEGORY_META[key].short)}: ${toPersianNumber(total)}</span>`;
  }).join("");

  return `
    <div class="wn-summary">
      <div class="wn-summary-head">
        <strong>${escapeHtml(release?.title || "تغییرات جدید")}</strong>
        <span class="wn-version-badge">نسخه ${versionLabel(release?.version)}</span>
        <span class="wn-status ${release?.status}">${escapeHtml(statusLabel(release?.status))}</span>
      </div>
      <div class="wn-summary-chips">${counts}</div>
    </div>`;
};
