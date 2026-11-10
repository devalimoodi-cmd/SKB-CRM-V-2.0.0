// ============================================================
// features/portal/portal.views.js
// نماهای خواندنی ناوبری پورتال — موج ۱۳.۱۷
// ------------------------------------------------------------
//  چهار پنل تازه که با «منوی» ۱۳.۱۷ باز می‌شوند:
//    units       → واحدهای من            (GET /portal/farm/options)
//    hallDetail  → ۴ بخش جزئیات سالن     (GET /portal/farm/halls/:id)
//    placements  → دوره‌های جوجه‌ریزی من   (options + /farm/placements/:id)
//    soon        → «به‌زودی» برای ۳ بخش بی‌اندپوینت (بدون هیچ درخواست)
//
//  🔒 قواعد سخت این فایل:
//   ۱) هیچ POST/PATCH/DELETE — فقط سه GET بالا (گارد تست می‌سنجد).
//   ۲) هیچ برچسب فارسی سخت‌کد برای فیلدها؛ همه از portal.payload.js
//      (PAYLOAD_LABEL / PAYLOAD_KIND / PAYLOAD_DICT_OF) ⇒ یک منبع
//      برچسب، هم‌راستا با فرم‌های ۱۳.۱۶.
//   ۳) شناسهٔ سالن/دوره فقط از پاسخ همان GET‌ها (options/details)
//      می‌آید و با rowId در portal.api اعتبارسنجی می‌شود؛ هیچ شناسه‌ای
//      از URL یا ورودی آزاد خوانده نمی‌شود (ضد IDOR).
//   ۴) پنل soon هیچ درخواستی نمی‌فرستد و هیچ دادهٔ ساختگی نشان نمی‌دهد.
//   ۵) هر رندر کامل escape می‌شود (esc) — داده از DB می‌آید.
// ============================================================
import { portalApi } from "./portal.api.js";
import { renderNotice } from "./portal.renderer.js";
import {
  PAYLOAD_LABEL,
  PAYLOAD_KIND,
  PAYLOAD_DICT_OF,
  dictionaryNameOf,
} from "./portal.payload.js";
// ✅ فهرست/برچسب فیلدهای هر بخش سالن از همان مشخصات فرم ۱۳.۱۶ می‌آید
//    (یک منبع؛ هیچ فهرست ستون دومی در این فایل ساخته نمی‌شود)
import { farmSpecOf } from "./portal.farm.rules.js";
// برای واگذاری بارگذاری تب‌های قبلی (فارم/مدارک/پروفایل/داشبورد)
import { portalFarmMixin } from "./portal.farm.js";

// ============================================================
// پیکربندی چهار پنل تازه — کلید = مقدار data-portal-panel در HTML
// ------------------------------------------------------------
//  permission  → کلید «لایهٔ منو» (دیده‌شدن پنل)
//  permissionAny → اگر آیتمی با چند مسیر مشترک است (پنل soon)
//  requires    → کلید «لایهٔ محتوا» که سرور هم اجرا می‌کند
// ============================================================
export const VIEW_TABS = {
  units: {
    permission: "customer.portal.menu.farm.units",
    title: "واحدها",
    bodyId: "portalUnitsBody",
    statusId: "portalUnitsStatus",
    requires: "customer.portal.farm",
  },
  hallDetail: {
    permission: "customer.portal.menu.farm.physical",
    permissionAny: [
      "customer.portal.menu.farm.physical",
      "customer.portal.menu.farm.systems",
      "customer.portal.menu.farm.waterFeed",
      "customer.portal.menu.farm.hygiene",
    ],
    title: "جزئیات سالن",
    bodyId: "portalHallDetailBody",
    statusId: "portalHallDetailStatus",
    requires: "customer.portal.farm",
  },
  placements: {
    permission: "customer.portal.menu.hatchery.placements",
    title: "دوره‌های جوجه‌ریزی",
    bodyId: "portalPlacementsBody",
    statusId: "portalPlacementsStatus",
    requires: "customer.portal.farm",
  },
  soon: {
    permission: "customer.portal.menu.hatchery.hygiene",
    permissionAny: [
      "customer.portal.menu.hatchery.hygiene",
      "customer.portal.menu.hatchery.completion",
      "customer.portal.menu.reports.final",
    ],
    title: "به‌زودی",
    bodyId: "portalSoonBody",
    statusId: "",
    requires: "",
  },
};

// متن «به‌زودی» — به تفکیک مسیر (صادقانه: چه چیزی نیست و کِی می‌آید)
export const SOON_VIEWS = {
  "#/hatchery/hygiene": {
    title: "ضدعفونی دوره",
    lead: "تاریخچهٔ ضدعفونی هر دوره هنوز در پورتال نمایش داده نمی‌شود.",
    text: "این بخش در موج بعدی فعال می‌شود: پس از آن می‌توانید تاریخ، نوع مادهٔ ضدعفونی و بازهٔ کار را برای هر دوره ببینید. فعلاً همین اطلاعات را می‌توانید از کارشناس خود بخواهید.",
  },
  "#/hatchery/completion": {
    title: "پایان دوره",
    lead: "پروندهٔ «پایان دوره» هنوز در پورتال نیست.",
    text: "این بخش در موج بعدی فعال می‌شود: شاخص‌های نهایی دوره (تلفات کل، ضریب تبدیل، وزن نهایی) و وضعیت تسویه. تا آن زمان گزارش کارشناس در بخش «گزارش‌ها» در دسترس است.",
  },
  "#/reports/final": {
    title: "گزارش نهایی دوره",
    lead: "گزارش تجمیعی نهایی هنوز در پورتال تولید نمی‌شود.",
    text: "این بخش در موج بعدی فعال می‌شود و خلاصهٔ یک‌صفحه‌ای هر دوره (نمودار وزن، تلفات، دارو/واکسن و توصیه‌ها) را نشان می‌دهد. فعلاً گزارش‌های بازدید کارشناس در دسترس‌اند.",
  },
};

// برچسب فارسی فیلدها — تنها منبع: portal.payload.js
const labelOf = (key) => {
  const label = PAYLOAD_LABEL(key);
  return label ? String(label) : String(key || "");
};

const kindOf = (key) => String(PAYLOAD_KIND(key) || "text");

// escape کامل (هم‌الگو با portal.renderer.js)
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

const payloadDataOf = (payload) => (payload && payload.data ? payload.data : {});

// عدد خوانا (اعداد لاتین با جداکننده)
const num = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toLocaleString("en-US");
};

// تاریخ ISO → رشتهٔ کوتاه (بدون وابستگی به datepicker)
const dateOf = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
};

// بله/خیر برای فیلدهای boolean
const yesNo = (value) => {
  if (value === true) return "بله";
  if (value === false) return "خیر";
  return "";
};

// نمایش یک مقدار با توجه به نوع/دیکشنریِ همان کلید
const valueOf = (key, raw, dictionaries) => {
  const kind = kindOf(key);
  if (raw === null || raw === undefined || raw === "") return "—";
  if (kind === "boolean") return yesNo(raw) || "—";
  if (kind === "date") return esc(dateOf(raw)) || "—";
  if (kind === "id") {
    const listKey = PAYLOAD_DICT_OF(key);
    const name = listKey
      ? dictionaryNameOf(dictionaries || {}, listKey, raw)
      : "";
    return name ? esc(name) : "—";
  }
  if (kind === "number") {
    const text = num(raw);
    return text || esc(raw);
  }
  return esc(raw);
};

// ============================================================
// بخش‌های «جزئیات سالن» — همان چهار نوع فرم ۱۳.۱۳/۱۳.۱۴/۱۳.۱۵
// ------------------------------------------------------------
//  🔑 فهرست فیلدهای هر جدول از `farmSpecOf(type)` می‌آید (نه دستی):
//     ⇒ اگر فردا فیلدی به فرم اضافه شود، این جدول هم خودکار همان را
//       نشان می‌دهد. `hall_id` (انتخاب سالن)، `note` (توضیح برای
//       کارشناس) و `items` (ردیف‌های تجهیزات) ستون جدول نیستند.
// ============================================================
export const HALL_SECTION_TYPES = {
  physical: "hall_physical_save",
  system: "hall_system_save",
  water_feed: "hall_water_feed_save",
  hygiene: "hall_hygiene_save",
};

export const HALL_SECTION_LABELS = {
  physical: "اطلاعات فیزیکی سالن",
  system: "سیستم‌های سالن",
  water_feed: "آب‌خوری و دان‌خوری",
  hygiene: "بهداشت سالن",
};

const SECTION_SKIP_KEYS = ["hall_id", "note", "items"];

// کلیدهای نمایشی هر بخش (خالص و قابل تست)
export const hallSectionKeys = (section) => {
  const type = HALL_SECTION_TYPES[section];
  if (!type) return [];
  return farmSpecOf(type)
    .map((field) => field.key)
    .filter((key) => !SECTION_SKIP_KEYS.includes(key));
};

// کلیدهای «دوره» برای جدول جزئیات (هم‌ترتیب با attributes سرور)
export const PLACEMENT_DETAIL_KEYS = [
  "placement_date",
  "chick_source_id",
  "breed_id",
  "chick_age_on_arrival",
  "avg_initial_weight",
  "total_chicks_count",
  "placement_density",
  "is_active",
];

// کلیدهای هفته (ستون‌های weeklyDetails سرور)
export const PLACEMENT_WEEK_KEYS = [
  "week_number",
  "week_start_date",
  "week_end_date",
  "flock_age_days",
  "weekly_mortality",
  "weekly_weight",
];

// برچسب کلیدهایی که در «فهرست مشترک payload» نیستند
const EXTRA_LABELS = { is_active: "فعال" };
const labelFor = (key) => EXTRA_LABELS[key] || labelOf(key);

// ============================================================
// ۱) واحدهای من
// ============================================================
const unitCard = (unit) => {
  const rows = [
    ["hall_count", unit.hall_count],
    ["capacity", unit.capacity],
    ["manager_name", unit.manager_name],
    ["manager_phone", unit.manager_phone],
    ["address", unit.address],
    ["longitude", unit.longitude],
    ["latitude", unit.latitude],
    ["is_active", unit.is_active],
  ]
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(
      ([key, value]) =>
        `<span>${esc(labelFor(key))}: <strong>${valueOf(key, value)}</strong></span>`,
    )
    .join("");

  return `<div class="portal-views__card" data-view-unit="${esc(unit.id)}">
    <div class="portal-views__card-head">
      <i class="fas fa-warehouse" aria-hidden="true"></i>
      <span>${esc(unit.unit_name || "واحد بدون نام")}</span>
    </div>
    <div class="portal-views__meta">${rows || "<span>اطلاعات تکمیلی ثبت نشده است.</span>"}</div>
  </div>`;
};

export const renderUnitsView = (units) => {
  const rows = Array.isArray(units) ? units : [];
  if (!rows.length) {
    return renderNotice(
      "واحدی برای این پرونده ثبت نشده است",
      "اگر واحدی دارید که این‌جا نیست، از بخش «درخواست‌های من» درخواست ثبت واحد بفرستید.",
      "info",
    );
  }
  return `<div class="portal-views__grid" data-view-units>${rows.map(unitCard).join("")}</div>`;
};

// ============================================================
// ۲) جزئیات سالن (چهار بخش)
// ============================================================
const hallOptions = (halls, selectedId) => {
  const rows = Array.isArray(halls) ? halls : [];
  return rows
    .map((hall) => {
      const name = hall.hall_name || "سالن بدون نام";
      const number = hall.hall_number ? ` — ${hall.hall_number}` : "";
      const selected = String(hall.id) === String(selectedId) ? " selected" : "";
      return `<option value="${esc(hall.id)}"${selected}>${esc(name + number)}</option>`;
    })
    .join("");
};

const fieldRows = (keys, source, dictionaries) =>
  keys
    .map((key) => {
      const raw = source ? source[key] : null;
      const empty = raw === null || raw === undefined || raw === "";
      return `<tr>
        <th scope="row">${esc(labelFor(key))}</th>
        <td>${empty ? "—" : valueOf(key, raw, dictionaries)}</td>
      </tr>`;
    })
    .join("");

// ردیف‌های تجهیزات (HallSystemItem) — فقط خواندن
const itemsTable = (items) => {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return "";
  const head =
    "<tr><th>#</th><th>دسته</th><th>مشخصه</th><th>تعداد</th><th>اندازه</th><th>ظرفیت</th></tr>";
  const body = rows
    .map(
      (item, index) => `<tr>
        <td>${index + 1}</td>
        <td>${esc(item.category || "—")}</td>
        <td>${esc(item.spec || "—")}</td>
        <td>${esc(item.quantity ?? "—")}</td>
        <td>${esc(item.size || "—")}</td>
        <td>${esc(item.capacity || "—")}</td>
      </tr>`,
    )
    .join("");
  return `<div class="portal-views__table-wrap">
    <table class="portal-table" data-view-items>
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
};

export const renderHallDetailView = ({
  section = "physical",
  halls = [],
  selectedHallId = "",
  detail = null,
  dictionaries = {},
} = {}) => {
  if (!halls.length) {
    return renderNotice(
      "سالنی برای نمایش نیست",
      "برای این پرونده سالنی ثبت نشده است؛ ابتدا از بخش «درخواست‌های من» درخواست ثبت سالن بفرستید.",
      "info",
    );
  }

  const label = HALL_SECTION_LABELS[section] || HALL_SECTION_LABELS.physical;
  const data = detail && detail.details ? detail.details[section] : null;

  const toolbar = `<div class="portal-views__toolbar">
    <div class="portal-views__field">
      <label for="portalHallDetailSelect">سالن</label>
      <select id="portalHallDetailSelect" data-view-hall>
        ${hallOptions(halls, selectedHallId)}
      </select>
    </div>
  </div>`;

  if (!data) {
    return `${toolbar}<div class="portal-views__empty">
      <i class="fas fa-circle-info" aria-hidden="true"></i>
      برای این سالن، بخش «${esc(label)}» هنوز ثبت نشده است.
    </div>`;
  }

  return `${toolbar}
    <div class="portal-views__table-wrap">
      <table class="portal-table" data-view-section="${esc(section)}">
        <tbody>${fieldRows(hallSectionKeys(section), data, dictionaries)}</tbody>
      </table>
    </div>
    ${section === "system" ? itemsTable(data.items) : ""}
    <p class="portal-views__note">
      <i class="fas fa-lock" aria-hidden="true"></i>
      این اطلاعات فقط خواندنی است؛ برای اصلاح، از بخش «درخواست‌های من» درخواست ویرایش بفرستید.
    </p>`;
};

// ============================================================
// ۳) دوره‌های جوجه‌ریزی
// ============================================================
const placementCard = (placement) => `<div class="portal-views__card"
    data-view-placement-card="${esc(placement.id)}">
    <div class="portal-views__card-head">
      <i class="fas fa-egg" aria-hidden="true"></i>
      <span>دورهٔ ${esc(dateOf(placement.placement_date) || "بدون تاریخ")}</span>
    </div>
    <div class="portal-views__meta">
      <span>${esc(labelFor("flock_number"))}: <strong>${valueOf(
        "flock_number",
        placement.flock_number,
      )}</strong></span>
      <span>${esc(labelFor("total_chicks_count"))}: <strong>${valueOf(
        "total_chicks_count",
        placement.total_chicks_count,
      )}</strong></span>
      <span>${esc(labelFor("is_active"))}: <strong>${valueOf(
        "is_active",
        placement.is_active,
      )}</strong></span>
    </div>
    <div class="portal-views__note">
      <button type="button" class="portal-btn" data-view-placement="${esc(placement.id)}">
        <i class="fas fa-list" aria-hidden="true"></i>
        مشاهدهٔ جزئیات و هفته‌ها
      </button>
    </div>
  </div>`;

export const renderPlacementsView = ({
  placements = [],
  detail = null,
  dictionaries = {},
} = {}) => {
  const rows = Array.isArray(placements) ? placements : [];
  const list = rows.length
    ? `<div class="portal-views__grid" data-view-placements>${rows
        .map(placementCard)
        .join("")}</div>`
    : renderNotice(
        "دوره‌ای ثبت نشده است",
        "برای این پرونده هنوز دورهٔ جوجه‌ریزی ثبت نشده است.",
        "info",
      );

  const weeks =
    Array.isArray(detail && detail.weeklies) && detail.weeklies.length
      ? `<div class="portal-views__table-wrap">
           <table class="portal-table" data-view-placement-weeks>
             <thead><tr>${PLACEMENT_WEEK_KEYS.map(
               (key) => `<th>${esc(labelFor(key))}</th>`,
             ).join("")}</tr></thead>
             <tbody>${detail.weeklies
               .map(
                 (week) =>
                   `<tr>${PLACEMENT_WEEK_KEYS.map(
                     (key) => `<td>${valueOf(key, week[key])}</td>`,
                   ).join("")}</tr>`,
               )
               .join("")}</tbody>
           </table>
         </div>`
      : `<div class="portal-views__empty">
           <i class="fas fa-circle-info" aria-hidden="true"></i>
           برای این دوره هنوز هفته‌ای ثبت نشده است.
         </div>`;

  const detailHtml = detail
    ? `<div class="portal-views__table-wrap">
         <table class="portal-table" data-view-placement-detail>
           <tbody>${fieldRows(
             PLACEMENT_DETAIL_KEYS,
             detail.placement || {},
             dictionaries,
           )}</tbody>
         </table>
       </div>${weeks}`
    : "";

  return `${list}${detailHtml}`;
};

// ============================================================
// ۴) «به‌زودی» — بدون هیچ درخواست/دادهٔ ساختگی
// ============================================================
export const renderSoonView = (route) => {
  const conf = SOON_VIEWS[route] || {
    title: "به‌زودی",
    lead: "این بخش هنوز در پورتال فعال نشده است.",
    text: "دادهٔ این بخش پس از افزودن مسیر رسمی پورتال (با همان کنترل دسترسی) نمایش داده می‌شود.",
  };
  return `<div class="portal-views__soon" data-view-soon="${esc(route)}">
    <p><strong>${esc(conf.title)}</strong></p>
    <p>${esc(conf.lead)}</p>
    <p>${esc(conf.text)}</p>
  </div>`;
};

// پیام خطای خوانا (بدون نمایش متن خام HTTP)
const viewErrorMessage = (error) => {
  const message = String((error && error.message) || "").trim();
  if (!message || /^HTTP error/i.test(message)) {
    return "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.";
  }
  return message;
};

// ============================================================
// mixin — متدها روی PortalService.prototype سوار می‌شوند
// ============================================================
export const portalViewsMixin = {
  // ===== وضعیت داخلی چهار نمای تازه =====
  initViews() {
    if (!this.extra || typeof this.extra !== "object") this.extra = {};

    this.extra.units = { loaded: false, loading: false };
    this.extra.hallDetail = {
      loaded: false,
      loading: false,
      halls: [],
      hallId: "",
      section: "physical",
      detail: null,
      dictionaries: {},
      cache: new Map(),
    };
    this.extra.placements = {
      loaded: false,
      loading: false,
      placements: [],
      detail: null,
      dictionaries: {},
    };
    this.extra.soon = { loaded: true, loading: false };

    // کش مشترک options (یک GET برای سه پنل)
    this.unitsCache = null;
    this.viewsBound = false;
  },

  // ===== اتصال رویدادها (یک‌بار) =====
  bindViews() {
    if (this.viewsBound) return;
    if (typeof document === "undefined" || !document.addEventListener) return;
    this.viewsBound = true;

    const hallBody = this.el(VIEW_TABS.hallDetail.bodyId);
    if (hallBody) {
      // فقط «تغییر سالن» — گزینه‌ها از سرور می‌آیند، نه ورودی آزاد
      hallBody.addEventListener("change", (event) => {
        const select = event.target.closest("[data-view-hall]");
        if (!select) return null;
        return this.selectHallForDetail(select.value);
      });
    }

    const placementsBody = this.el(VIEW_TABS.placements.bodyId);
    if (placementsBody) {
      placementsBody.addEventListener("click", (event) => {
        const button = event.target.closest("[data-view-placement]");
        if (!button) return null;
        event.preventDefault();
        return this.openPlacementDetail(
          button.getAttribute("data-view-placement"),
        );
      });
    }
  },

  // ===== ورود پنل: همهٔ تب‌های خاص از همین نقطه می‌گذرند =====
  async loadExtraTab(key) {
    if (key === "units") return this.loadUnitsView();
    if (key === "hallDetail") return this.loadHallDetailView();
    if (key === "placements") return this.loadPlacementsView();
    if (key === "soon") return this.loadSoonView();
    // فارم/مدارک/پروفایل/داشبورد ⇒ همان منطق لایه‌های قبلی
    return portalFarmMixin.loadExtraTab.call(this, key);
  },

  // ===== لایهٔ محتوا (همان کلیدی که سرور ۴۰۳ می‌دهد) =====
  canViewContent(conf) {
    if (!conf || !conf.requires) return true;
    return Boolean(this.canPermission(conf.requires));
  },

  // پیام «محتوای این بخش بسته است»
  renderViewDenied(key) {
    const conf = VIEW_TABS[key];
    const body = conf ? this.el(conf.bodyId) : null;
    if (body) {
      body.innerHTML = renderNotice(
        "این بخش برای شما بسته است",
        "دسترسی دادهٔ این بخش توسط مدیر سیستم بسته شده است. منو فقط نمایش است؛ داده با کلید محتوایی کنترل می‌شود.",
        "info",
      );
    }
  },

  // options با کش (units + halls + placements + dictionaries)
  async farmOptionsCached() {
    if (this.unitsCache) return this.unitsCache;
    const data = payloadDataOf(await portalApi.getFarmOptions());
    const options = data.options || {};
    this.unitsCache = {
      units: options.units || [],
      halls: options.halls || [],
      placements: options.placements || [],
      dictionaries: options.dictionaries || {},
    };
    return this.unitsCache;
  },

  // ===== ۱) واحدها =====
  async loadUnitsView() {
    const state = this.extra.units;
    if (!state || state.loading) return;
    state.loading = true;
    this.setExtraStatus("units", "loading");

    try {
      if (!this.canViewContent(VIEW_TABS.units)) {
        state.loaded = true;
        this.setExtraStatus("units", "ready");
        this.renderViewDenied("units");
        return;
      }
      const options = await this.farmOptionsCached();
      state.loaded = true;
      this.setExtraStatus("units", "ready");
      this.renderUnits(options.units);
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus("units", "error", viewErrorMessage(error));
    } finally {
      state.loading = false;
    }
  },

  renderUnits(units) {
    const body = this.el(VIEW_TABS.units.bodyId);
    if (body) body.innerHTML = renderUnitsView(units);
  },

  // ===== ۲) جزئیات سالن (چهار بخش) =====
  async loadHallDetailView() {
    const state = this.extra.hallDetail;
    if (!state || state.loading) return;
    state.loading = true;
    this.setExtraStatus("hallDetail", "loading");

    try {
      if (!this.canViewContent(VIEW_TABS.hallDetail)) {
        state.loaded = true;
        this.setExtraStatus("hallDetail", "ready");
        this.renderViewDenied("hallDetail");
        return;
      }
      const options = await this.farmOptionsCached();
      state.halls = options.halls;
      state.dictionaries = options.dictionaries;
      state.loaded = true;
      this.setExtraStatus("hallDetail", "ready");
      await this.renderHallDetailSection(state.section);
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus("hallDetail", "error", viewErrorMessage(error));
    } finally {
      state.loading = false;
    }
  },

  // انتخاب سالن — فقط اگر در فهرست مجازِ سرور باشد
  selectHallForDetail(rawId) {
    const state = this.extra.hallDetail;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return null;
    const allowed = state.halls.some((hall) => String(hall.id) === id);
    if (!allowed) return null;
    state.hallId = id;
    return this.renderHallDetailSection(state.section);
  },

  async renderHallDetailSection(rawSection) {
    const state = this.extra.hallDetail;
    const body = this.el(VIEW_TABS.hallDetail.bodyId);
    if (!state || !body) return;

    const section = HALL_SECTION_LABELS[rawSection] ? rawSection : "physical";
    state.section = section;

    if (!state.halls.length) {
      body.innerHTML = renderHallDetailView({ section, halls: [] });
      return;
    }

    if (!state.hallId) state.hallId = String(state.halls[0].id);

    const cacheKey = String(state.hallId);
    if (!state.cache.has(cacheKey)) {
      body.innerHTML = `<div class="portal-views__loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت…
      </div>`;
      try {
        const detail = payloadDataOf(
          await portalApi.getFarmHallDetails(state.hallId),
        );
        state.cache.set(cacheKey, detail);
      } catch (error) {
        body.innerHTML = renderNotice(
          "دریافت جزئیات سالن ناموفق بود",
          viewErrorMessage(error),
          "error",
        );
        return;
      }
    }

    state.detail = state.cache.get(cacheKey) || null;
    body.innerHTML = renderHallDetailView({
      section,
      halls: state.halls,
      selectedHallId: state.hallId,
      detail: state.detail,
      dictionaries: state.dictionaries,
    });

    const title = this.el("portalHallDetailTitle");
    if (title) title.textContent = HALL_SECTION_LABELS[section];
  },

  // ===== ۳) دوره‌های جوجه‌ریزی =====
  async loadPlacementsView() {
    const state = this.extra.placements;
    if (!state || state.loading) return;
    state.loading = true;
    this.setExtraStatus("placements", "loading");

    try {
      if (!this.canViewContent(VIEW_TABS.placements)) {
        state.loaded = true;
        this.setExtraStatus("placements", "ready");
        this.renderViewDenied("placements");
        return;
      }
      const options = await this.farmOptionsCached();
      state.placements = options.placements;
      state.dictionaries = options.dictionaries;
      state.loaded = true;
      this.setExtraStatus("placements", "ready");
      this.renderPlacements();
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus("placements", "error", viewErrorMessage(error));
    } finally {
      state.loading = false;
    }
  },

  renderPlacements() {
    const state = this.extra.placements;
    const body = this.el(VIEW_TABS.placements.bodyId);
    if (!state || !body) return;
    body.innerHTML = renderPlacementsView({
      placements: state.placements,
      detail: state.detail,
      dictionaries: state.dictionaries,
    });
  },

  // جزئیات یک دوره — شناسه فقط از فهرست «دوره‌های خودم» پذیرفته می‌شود
  async openPlacementDetail(rawId) {
    const state = this.extra.placements;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return null;
    const placement = state.placements.find((row) => String(row.id) === id);
    if (!placement) return null;
    if (state.detail && String((state.detail.placement || {}).id) === id) {
      return this.renderPlacements();
    }

    const body = this.el(VIEW_TABS.placements.bodyId);
    if (body) {
      body.innerHTML = `<div class="portal-views__loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت جزئیات دوره…
      </div>`;
    }

    try {
      state.detail = payloadDataOf(
        await portalApi.getFarmPlacementDetails(placement.id),
      );
    } catch (error) {
      state.detail = null;
      if (body) {
        body.innerHTML = renderNotice(
          "دریافت جزئیات دوره ناموفق بود",
          viewErrorMessage(error),
          "error",
        );
      }
      return null;
    }

    return this.renderPlacements();
  },

  // ===== ۴) «به‌زودی» (بدون درخواست) =====
  loadSoonView() {
    const entry = this.routeEntry || null;
    return this.renderSoon(entry && entry.route ? entry.route : "");
  },

  renderSoon(route) {
    const key = String(route || "");
    const body = this.el(VIEW_TABS.soon.bodyId);
    if (body) body.innerHTML = renderSoonView(key);
    const title = this.el("portalSoonTitle");
    const conf = SOON_VIEWS[key];
    if (title) title.textContent = conf ? conf.title : VIEW_TABS.soon.title;
    return key;
  },

  // ===== پس از فعال‌شدن مسیر (پوسته صدا می‌زند) =====
  //  هدف: جابه‌جایی بین دو مسیرِ هم‌پنل (physical → systems) پنل را
  //  دوباره از سرور نگیرد؛ فقط همان بخش از کش رندر شود.
  applyRouteView(entry) {
    if (!entry || typeof entry !== "object") return "";
    const state = this.extra || {};

    if (entry.panel === "hallDetail") {
      const section = HALL_SECTION_LABELS[entry.section]
        ? entry.section
        : "physical";
      if (state.hallDetail && state.hallDetail.loaded) {
        this.renderHallDetailSection(section);
      } else if (state.hallDetail) {
        state.hallDetail.section = section;
      }
      return section;
    }

    if (entry.panel === "soon") return this.renderSoon(entry.route);

    if (entry.panel === "placements" && state.placements && state.placements.loaded) {
      this.renderPlacements();
      return "placements";
    }

    if (entry.panel === "units" && state.units && state.units.loaded && this.unitsCache) {
      this.renderUnits(this.unitsCache.units);
      return "units";
    }

    // «ثبت هفته» = تب درخواست‌ها با نوع weekly_create — فقط اگر عوض شده
    if (entry.farmType && this.farm && this.farm.activeType !== entry.farmType) {
      this.switchFarmType(entry.farmType);
      return entry.farmType;
    }

    return "";
  },
};

// متدهای این فایل روی PortalService.prototype سوار می‌شوند
// ⚠️ ترتیب مهم است: بعد از applyPortalFarm اجرا شود تا loadExtraTab
//    این فایل بتواند نسخهٔ فارم (و لایه‌های قبلی‌اش) را صدا بزند.
export const applyPortalViews = (ServiceClass) => {
  Object.assign(ServiceClass.prototype, portalViewsMixin);
};
