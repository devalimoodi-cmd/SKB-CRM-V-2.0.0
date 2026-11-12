// ============================================================
// features/portal/portal.views.js
// نماهای خواندنی ناوبری پورتال — موج ۱۳.۱۷
// ------------------------------------------------------------
//  چهار پنل که با «منوی» ۱۳.۱۷ باز می‌شوند (۱۳.۲۱ بازآرایی‌شده):
//    units       → واحدهای من (آکاردئون واحد ← سالن)  (GET /portal/farm/options)
//    halls       → سالن‌ها با چهار بخش جزئیات تنبل      (GET /portal/farm/halls/:id)
//    placements  → دوره‌های جوجه‌ریزی من (آکاردئون گله)  (options + /farm/placements/:id)
//    tickets     → ارسال تیکت روی سامانهٔ پیشنهادها      (Suggestion/SuggestionMessage)
//    soon        → «به‌زودی» برای بخش‌های بی‌اندپوینت (بدون هیچ درخواست)
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
import {
  renderNotice,
  renderEmpty,
  renderFlockList,
  renderWeekList,
} from "./portal.renderer.js";
import {
  PAYLOAD_LABEL,
  PAYLOAD_KIND,
  PAYLOAD_DICT_OF,
  dictionaryNameOf,
} from "./portal.payload.js";
// ✅ فهرست/برچسب فیلدهای هر بخش سالن از همان مشخصات فرم ۱۳.۱۶ می‌آید
//    (یک منبع؛ هیچ فهرست ستون دومی در این فایل ساخته نمی‌شود)
import { farmPanelOfType, farmSpecOf } from "./portal.farm.rules.js";
// برای واگذاری بارگذاری تب‌های قبلی (فارم/مدارک/پروفایل/داشبورد)
import { portalFarmMixin } from "./portal.farm.js";
// ✅ ۱۳.۲۱ — آکاردئون/درخت خالص + جدول ریسپانسیو + پنل تیکت
import {
  buildUnitTree,
  groupPlacementsByFlock,
  groupWeeksByFlock,
  treeAccordion,
  treeTotals,
} from "./portal.tree.js";
import { decorateTables } from "./portal.table.js";
import { TICKETS_TAB } from "./portal.tickets.js";

// ✅ ۱۳.۱۹: اندازهٔ صفحهٔ «پایان دوره» (سرور سقف ۵۰ می‌گذارد)
const COMPLETION_PAGE = 20;

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
  // ✅ ۱۳.۲۱ — «سالن‌ها» از فهرست صفحه‌بندی‌شدهٔ service به یک نمای
  //    آکاردئونی منتقل شد: هر سالن ← چهار بخش (فیزیکی/سیستم‌ها/آب‌خوری/
  //    بهداشت). کلید محتوا همان customer.portal.halls است و چهار کلید
  //    منوی قبلی، گیت نمایش هر بخش‌اند (بدون مسیر تازه).
  halls: {
    permission: "customer.portal.menu.farm.halls",
    title: "سالن‌ها",
    bodyId: "portalHallsBody",
    statusId: "portalHallsStatus",
    requires: "customer.portal.halls",
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
    permissionAny: ["customer.portal.menu.hatchery.hygiene"],
    title: "به‌زودی",
    bodyId: "portalSoonBody",
    statusId: "",
    requires: "",
  },
  // ✅ ۱۳.۱۹ — «پایان دوره»: فهرست دوره‌های بسته‌شده + شاخص‌های نهایی
  completion: {
    permission: "customer.portal.menu.hatchery.completion",
    title: "پایان دوره",
    bodyId: "portalCompletionBody",
    statusId: "portalCompletionStatus",
    requires: "customer.portal.completion",
  },
  // ✅ ۱۳.۱۹ — «گزارش نهایی دوره»: انتخاب دوره + گزارش تفصیلی
  //  🔒 دو کلید لازم است: فهرست (customer.portal.completion) برای
  //     انتخابگر و گزارش تفصیلی (…completion.report) برای خودِ گزارش.
  finalReport: {
    permission: "customer.portal.menu.reports.final",
    title: "گزارش نهایی دوره",
    bodyId: "portalFinalBody",
    statusId: "portalFinalStatus",
    requiresAll: [
      "customer.portal.completion",
      "customer.portal.completion.report",
    ],
  },
  // ✅ ۱۳.۲۱ — «ارسال تیکت» (منطق و رندر در portal.tickets.js)
  tickets: TICKETS_TAB,
};

// متن «به‌زودی» — به تفکیک مسیر (صادقانه: چه چیزی نیست و چرا)
// ✅ ۱۳.۱۹: «پایان دوره» و «گزارش نهایی دوره» پنل واقعی گرفتند و از
//    این فهرست بیرون رفتند؛ فقط «ضدعفونی دوره» ماند (بدون جدول تاریخچه).
export const SOON_VIEWS = {
  "#/hatchery/hygiene": {
    title: "ضدعفونی دوره",
    lead: "تاریخچهٔ ضدعفونی هر دوره در پورتال نمایش داده نمی‌شود.",
    text: "در پایگاه داده فقط «وضعیت فعلی» بهداشت هر سالن نگه‌داری می‌شود، نه سابقهٔ دوره‌به‌دوره؛ بنابراین نمودار تاریخچه ساخته نمی‌شود و دادهٔ ساختگی هم نشان نمی‌دهیم. وضعیت فعلی هر سالن را از «مزرعهٔ من → بهداشت» ببینید و سابقهٔ قبلی را از کارشناس خود بخواهید.",
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
// ------------------------------------------------------------
//  ✅ ۱۳.۲۱ — آکاردئون: هر واحد یک <details> با اطلاعات تکمیلی،
//  فهرست سالن‌های همان واحد و دکمه‌های ثبت/ویرایش/حذف.
//  ⚠️ هیچ دادهٔ تازه‌ای ساخته نمی‌شود: همین فیلدهای options.
// ============================================================
const unitMetaRows = (unit) => {
  const rows = [
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

  return rows
    ? `<div class="portal-views__meta">${rows}</div>`
    : `<div class="portal-views__note">اطلاعات تکمیلی این واحد ثبت نشده است.</div>`;
};

// دکمه‌های اقدام هر ردیف — همه به «شیت درخواست» وصل می‌شوند (بدون فرم تازه)
const farmActionButton = (action, label, icon, attrs = "") =>
  `<button type="button" class="portal-btn portal-btn--sm" data-farm-action="${esc(
    action,
  )}"${attrs ? " " + attrs : ""}><i class="fas ${esc(icon)}" aria-hidden="true"></i> ${esc(
    label,
  )}</button>`;

// یک سالن داخل آکاردئون واحد: نام + دکمه‌های اقدام + پرش به آکاردئون سالن
const hallRow = (hall, canWrite) => {
  const id = esc(hall.id);
  const actions = canWrite
    ? `<div class="portal-acc__row-actions">
        ${farmActionButton("hall_update", "ویرایش", "fa-pen-to-square", `data-farm-hall="${id}"`)}
        ${farmActionButton("hall_delete", "حذف", "fa-trash-can", `data-farm-hall="${id}"`)}
      </div>`
    : "";
  return `<li class="portal-acc__row" data-hall-id="${id}">
    <span class="portal-acc__row-title">
      <i class="fas fa-warehouse" aria-hidden="true"></i>
      ${esc(hall.name)}
    </span>
    <a class="portal-acc__row-link" href="#/farm/halls" data-hall-focus="${id}">جزئیات سالن</a>
    ${actions}
  </li>`;
};

export const renderUnitsView = (units, options = {}) => {
  const tree = buildUnitTree({ units, halls: options.halls });
  const canWrite = options.canWrite === true;

  if (!tree.length) {
    return renderNotice(
      "واحدی برای این پرونده ثبت نشده است",
      canWrite
        ? "برای ثبت واحد، دکمهٔ «ثبت واحد» در بالای همین صفحه را بزنید؛ درخواست برای تأیید کارشناس می‌رود."
        : "اگر واحدی دارید که این‌جا نیست، با کارشناس خود تماس بگیرید.",
      "info",
    );
  }

  const totals = treeTotals(tree);
  const toolbar = `<div class="portal-views__toolbar">
    <div class="portal-views__note">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      ${esc(totals.units)} واحد · ${esc(totals.halls)} سالن
    </div>
    ${
      canWrite
        ? farmActionButton("unit_create", "ثبت واحد", "fa-plus")
        : ""
    }
  </div>`;

  const blocks = tree
    .map((unit) => {
      const badge = `${unit.halls.length} سالن`;
      const actions = canWrite
        ? [
            farmActionButton("unit_update", "ویرایش واحد", "fa-pen-to-square", `data-farm-unit="${esc(unit.id)}"`),
            farmActionButton("unit_delete", "حذف واحد", "fa-trash-can", `data-farm-unit="${esc(unit.id)}"`),
            farmActionButton("hall_create", "ثبت سالن", "fa-plus", `data-farm-unit="${esc(unit.id)}"`),
          ].join("")
        : "";

      const body = `${unitMetaRows(unit.raw)}${
        unit.halls.length
          ? `<ul class="portal-acc__rows">${unit.halls
              .map((hall) => hallRow(hall, canWrite))
              .join("")}</ul>`
          : `<div class="portal-views__empty">
              <i class="fas fa-circle-info" aria-hidden="true"></i>
              برای این واحد سالنی ثبت نشده است${
                canWrite ? "؛ با دکمهٔ «ثبت سالن» درخواست بفرستید." : "."
              }
            </div>`
      }`;

      return treeAccordion({
        id: `unit-${unit.id}`,
        title: unit.name,
        badge,
        actions,
        body,
        level: 1,
      });
    })
    .join("");

  return `${toolbar}<div class="portal-acc__stack" data-view-units>${blocks}</div>`;
};

// ============================================================
// ۲) جزئیات سالن — سازندهٔ ردیف‌های «کلید/مقدار» و جدول تجهیزات
// ------------------------------------------------------------
//  ✅ ۱۳.۲۱: انتخاب‌گر سالن (hallOptions) حذف شد؛ آکاردئون خودِ
//  سالن‌ها جای آن را گرفت (بدون <select> و بدون درخواست اضافه).
// ============================================================
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

// ============================================================
// ۲) آکاردئون سالن ← چهار بخش
// ------------------------------------------------------------
//  ⚠️ ۱۳.۲۱: پنل جداگانهٔ «hallDetail» حذف شد. هر سالن یک <details>
//  است و داخل آن چهار بخش. دادهٔ هر سالن **تنبل** می‌آید: تا کاربر
//  سالن را باز نکند هیچ درخواستی فرستاده نمی‌شود (همان درس ۱۳.۱۷).
//  گیت هر بخش = کلید منوی همان بخش (sections از تنظیمات مجاز می‌آید).
// ============================================================
const sectionBody = (section, detail, dictionaries) => {
  const data = detail && detail.details ? detail.details[section] : null;
  if (!data) {
    return `<div class="portal-views__empty">
      <i class="fas fa-circle-info" aria-hidden="true"></i>
      بخش «${esc(HALL_SECTION_LABELS[section])}» هنوز ثبت نشده است.
    </div>`;
  }

  return `<div class="portal-views__table-wrap">
      <table class="portal-table" data-view-section="${esc(section)}">
        <tbody>${fieldRows(hallSectionKeys(section), data, dictionaries)}</tbody>
      </table>
    </div>
    ${section === "system" ? itemsTable(data.items) : ""}`;
};

export const renderHallsAccordion = ({
  halls = [],
  details = {},
  dictionaries = {},
  sections = [],
  canWrite = false,
  pending = {},
  errors = {},
} = {}) => {
  const rows = Array.isArray(halls) ? halls : [];
  if (!rows.length) {
    return renderNotice(
      "سالنی برای نمایش نیست",
      canWrite
        ? "برای ثبت سالن، از بخش «واحدها» دکمهٔ «ثبت سالن» همان واحد را بزنید."
        : "برای این پرونده سالنی ثبت نشده است.",
      "info",
    );
  }

  const allowed = sections.filter((section) => HALL_SECTION_TYPES[section]);

  const blocks = rows.map((hall) => {
    const hallId = String(hall.id);
    const detail = details[hallId] || null;
    const error = String(errors[hallId] || "");

    const actions = canWrite
      ? [
          farmActionButton("hall_update", "ویرایش سالن", "fa-pen-to-square", `data-farm-hall="${esc(hallId)}"`),
          farmActionButton("hall_delete", "حذف سالن", "fa-trash-can", `data-farm-hall="${esc(hallId)}"`),
        ].join("")
      : "";

    // ۱) خطای همان سالن (بقیهٔ سالن‌ها سالم می‌مانند)
    // ۲) در حال دریافت
    // ۳) داده آمده ⇒ چهار بخش (فقط بخش‌های مجاز)
    // ۴) هنوز باز نشده ⇒ هیچ درخواستی نرفته
    let body = "";
    if (error) {
      body = `<div class="portal-views__note portal-views__note--error">
        <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
        ${esc(error)}
      </div>`;
    } else if (!detail && pending[hallId]) {
      body = `<div class="portal-views__loading" data-hall-pending="${esc(hallId)}">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت بخش‌ها…
      </div>`;
    } else if (detail && !allowed.length) {
      body = `<div class="portal-views__empty">
        <i class="fas fa-lock" aria-hidden="true"></i>
        نمایش بخش‌های این سالن برای نقش شما بسته است.
      </div>`;
    } else if (detail) {
      body = `<div class="portal-acc__stack">${allowed
        .map((section) =>
          treeAccordion({
            id: `hall-${hallId}-${section}`,
            title: HALL_SECTION_LABELS[section],
            level: 2,
            actions: canWrite
              ? farmActionButton(
                  HALL_SECTION_TYPES[section],
                  "ثبت/ویرایش",
                  "fa-pen",
                  `data-farm-hall="${esc(hallId)}"`,
                )
              : "",
            body: sectionBody(section, detail, dictionaries),
          }),
        )
        .join("")}</div>`;
    } else {
      body = `<div class="portal-views__loading" data-hall-closed="${esc(hallId)}">
        <i class="fas fa-circle-info" aria-hidden="true"></i>
        برای دیدن بخش‌ها، همین سالن را باز کنید (تا آن‌وقت هیچ درخواستی فرستاده نمی‌شود).
      </div>`;
    }

    return treeAccordion({
      id: `hall-${hallId}`,
      title: hall.hall_name || hall.name || "سالن بدون نام",
      subtitle: hall.unit_name ? `واحد: ${hall.unit_name}` : "",
      badge: allowed.length ? `${allowed.length} بخش` : "",
      actions,
      body,
      level: 1,
    });
  });

  return `<div class="portal-acc__stack" data-view-halls>${blocks.join("")}</div>`;
};

// ============================================================
// ۳) دوره‌های جوجه‌ریزی — آکاردئون «گله ← دوره‌ها» (۱۳.۲۱)
// ============================================================
// هر دوره داخل آکاردئون گله — همان دکمهٔ «جزئیات» (رویداد موجود)
const placementItem = (placement) => `<li class="portal-acc__row" data-view-placement-card="${esc(
  placement.id,
)}">
  <span class="portal-acc__row-title">
    <i class="fas fa-egg" aria-hidden="true"></i>
    دورهٔ ${esc(dateOf(placement.placement_date) || "بدون تاریخ")}
  </span>
  <span class="portal-acc__row-meta">
    ${esc(labelFor("total_chicks_count"))}: ${valueOf("total_chicks_count", placement.total_chicks_count)}
    · ${esc(labelFor("is_active"))}: ${valueOf("is_active", placement.is_active)}
  </span>
  <button type="button" class="portal-btn portal-btn--sm" data-view-placement="${esc(
    placement.id,
  )}">
    <i class="fas fa-list" aria-hidden="true"></i>
    جزئیات و هفته‌ها
  </button>
</li>`;

export const renderPlacementsView = ({
  placements = [],
  detail = null,
  dictionaries = {},
} = {}) => {
  const rows = Array.isArray(placements) ? placements : [];
  const groups = groupPlacementsByFlock(rows);

  const list = rows.length
    ? `<div class="portal-acc__stack" data-view-placements>${groups
        .map((group) =>
          treeAccordion({
            id: `flock-${group.key}`,
            title: group.label,
            badge: `${group.placements.length} دوره`,
            level: 1,
            body: `<ul class="portal-acc__rows">${group.placements
              .map(placementItem)
              .join("")}</ul>`,
          }),
        )
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

// ============================================================
// ۵) «پایان دوره» — فهرست دوره‌های بسته‌شده (✅ ۱۳.۱۹)
// ------------------------------------------------------------
//  🔑 برچسب/یکای هر شاخص از پاسخ سرور (meta.metrics) می‌آید ⇒ این
//     فایل هیچ فهرست برچسب دومی برای این اعداد نمی‌سازد.
// ============================================================
const metricText = (metric, value) => {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return esc(value);
  if (metric && metric.kind === "int") return num(Math.round(parsed));
  const digits =
    metric && Number.isInteger(metric.digits) ? metric.digits : 2;
  return num(Number(parsed.toFixed(digits)));
};

// کارت‌های شاخص (KPI) — مشترک بین «پایان دوره» و «گزارش نهایی»
const kpiGrid = (metrics = [], source = {}, tag = "completion") =>
  `<div class="portal-views__kpi-grid" data-view-kpi-grid="${esc(tag)}">${(
    Array.isArray(metrics) ? metrics : []
  )
    .filter((metric) => metric && metric.key)
    .map(
      (metric) => `<div class="portal-kpi" data-view-kpi="${esc(metric.key)}">
        <span class="portal-kpi__label">${esc(metric.label)}</span>
        <span class="portal-kpi__value">${metricText(
          metric,
          source ? source[metric.key] : null,
        )}</span>
        ${
          metric.unit
            ? `<span class="portal-kpi__unit">${esc(metric.unit)}</span>`
            : ""
        }
      </div>`,
    )
    .join("")}</div>`;

const completionCard = (item, metrics, canReport) => {
  const date = dateOf(item.completion_date) || "بدون تاریخ";
  const typeLabel = String(item.completion_type_label || "").trim();
  const confirmed = item.confirmed_by_customer
    ? "تأییدشده توسط شما"
    : "تأیید شما ثبت نشده";
  return `<div class="portal-views__card" data-view-completion="${esc(item.id)}">
    <div class="portal-views__card-head">
      <i class="fas fa-flag-checkered" aria-hidden="true"></i>
      <span>دورهٔ ${esc(date)}</span>
    </div>
    <div class="portal-views__meta">
      ${typeLabel ? `<span class="portal-chip">${esc(typeLabel)}</span>` : ""}
      <span class="portal-chip">${esc(confirmed)}</span>
      <span>شمارهٔ گله: <strong>${esc(item.flock_id ?? "—")}</strong></span>
    </div>
    ${kpiGrid(metrics, item, "completion")}
    ${
      canReport
        ? `<div class="portal-views__note">
             <button type="button" class="portal-btn" data-view-completion-report="${esc(
               item.id,
             )}">
               <i class="fas fa-file-lines" aria-hidden="true"></i>
               گزارش نهایی این دوره
             </button>
           </div>`
        : `<p class="portal-views__note">
             <i class="fas fa-lock" aria-hidden="true"></i>
             گزارش تفصیلی این دوره برای حساب شما بسته است.
           </p>`
    }
  </div>`;
};

export const renderCompletionView = ({
  items = [],
  metrics = [],
  pagination = null,
  canReport = false,
} = {}) => {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    return renderNotice(
      "پایان دوره‌ای ثبت نشده است",
      "وقتی کارشناس پایان یک دوره را ثبت کند، شاخص‌های نهایی همان دوره (زنده‌مانی، ضریب تبدیل، وزن و خوراک) این‌جا نمایش داده می‌شود.",
      "info",
    );
  }

  const page = Number(pagination && pagination.page) || 1;
  const pages = Number(pagination && pagination.pages) || 1;
  const more =
    page < pages
      ? `<div class="portal-views__toolbar">
           <button type="button" class="portal-btn" data-view-completion-more>
             <i class="fas fa-angles-down" aria-hidden="true"></i>
             نمایش دوره‌های قدیمی‌تر
           </button>
         </div>`
      : "";

  return `<div class="portal-views__grid" data-view-completions>${rows
    .map((item) => completionCard(item, metrics, canReport))
    .join("")}</div>${more}<p class="portal-views__note">
    <i class="fas fa-circle-info" aria-hidden="true"></i>
    اعداد این بخش همان چیزی است که کارشناس در فرم پایان دوره ثبت کرده؛
    اطلاعات مالی (درآمد/هزینه/سود) در پورتال نمایش داده نمی‌شود.
  </p>`;
};

// ============================================================
// ۶) «گزارش نهایی دوره» — روند، ریز سالن‌ها، دارو/واکسن (✅ ۱۳.۱۹)
// ------------------------------------------------------------
//  ⚠️ برچسب‌های این بخش عمداً همین‌جا نوشته شده‌اند: این فیلدها در
//     مشخصات فرم‌های ۱۳.۱۶ (portal.payload.js) نیستند، پس منبع
//     برچسبی برایشان وجود ندارد. یک منبع = همین فایل.
// ============================================================
const REPORT_FIELD_LABELS = {
  completion_date: "تاریخ ثبت پایان دوره",
  completion_type: "نوع پایان دوره",
  slaughter_date: "تاریخ کشتار",
  slaughter_end_date: "پایان کشتار",
  slaughter_age_days: "سن کشتار (روز)",
  slaughter_age_end_days: "سن پایان کشتار (روز)",
  slaughter_age_method: "مبنای سن کشتار",
  slaughterhouse_name: "کشتارگاه",
  transport_mortality: "تلفات حمل",
  total_sent: "کل ارسال به کشتار",
  total_live_weight: "وزن زندهٔ کل (کیلوگرم)",
  avg_live_weight: "میانگین وزن زنده (کیلوگرم)",
  final_week_number: "آخرین هفتهٔ ثبت‌شده",
  feed_basis: "مبنای خوراک",
  flock_id: "شمارهٔ گله",
};

const reportLabel = (key) => REPORT_FIELD_LABELS[key] || labelFor(key);

const FEED_BASIS_LABELS = {
  system: "داده‌های سیستمی (هفته‌های ثبت‌شده)",
  declared: "اطلاعات اعلامی مرغدار",
};

// ردیف‌های «اطلاعات کشتار/دوره» — فقط مقدارهای موجود
const reportMetaRows = (completion) => {
  const keys = [
    "completion_date",
    "completion_type",
    "slaughter_date",
    "slaughter_age_days",
    "slaughter_age_end_days",
    "slaughter_age_method",
    "slaughterhouse_name",
    "transport_mortality",
    "total_sent",
    "total_live_weight",
    "avg_live_weight",
    "final_week_number",
    "feed_basis",
  ];
  return keys
    .map((key) => {
      let raw = completion ? completion[key] : null;
      if (key === "completion_type") raw = completion && completion.completion_type_label;
      if (key === "feed_basis") raw = FEED_BASIS_LABELS[raw] || raw;
      return [key, raw];
    })
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(
      ([key, value]) => `<tr>
        <th scope="row">${esc(reportLabel(key))}</th>
        <td>${esc(typeof value === "number" ? num(value) : value)}</td>
      </tr>`,
    )
    .join("");
};

// محدودهٔ عددی یک سری (برای مقیاس نمودار)
const seriesRange = (values) => {
  const numbers = (Array.isArray(values) ? values : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!numbers.length) return null;
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
};

// خط سری روی SVG (بدون کتابخانه؛ اعداد فقط از پاسخ سرور)
const seriesPoints = (values, { width, height, pad, min, max }) => {
  const rows = Array.isArray(values) ? values : [];
  const span = max - min > 0 ? max - min : 1;
  const usable = height - pad * 2;
  const points = [];
  rows.forEach((value, index) => {
    if (value === null || value === undefined) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const x =
      rows.length > 1
        ? pad + (index / (rows.length - 1)) * (width - pad * 2)
        : width / 2;
    const y = height - pad - ((parsed - min) / span) * usable;
    points.push(`${Math.round(x)},${Math.round(y)}`);
  });
  return points.join(" ");
};

// نمودار روند هفتگی: وزن (فیروزه‌ای) و ضریب تبدیل (نارنجی)
export const renderTrendChart = (trend) => {
  const weeks = trend && Array.isArray(trend.weeks) ? trend.weeks : [];
  if (weeks.length < 2) return "";

  const width = 560;
  const height = 180;
  const pad = 18;
  const weightRange = seriesRange(trend.weight);
  const fcrRange = seriesRange(trend.fcr);
  if (!weightRange && !fcrRange) return "";

  const weightLine = weightRange
    ? seriesPoints(trend.weight, { width, height, pad, ...weightRange })
    : "";
  const fcrLine = fcrRange
    ? seriesPoints(trend.fcr, { width, height, pad, ...fcrRange })
    : "";

  return `<div class="portal-trend" data-view-trend>
    <div class="portal-trend__legend">
      <span class="portal-trend__key portal-trend__key--weight">وزن (کیلوگرم)</span>
      <span class="portal-trend__key portal-trend__key--fcr">ضریب تبدیل</span>
      <span class="portal-trend__weeks">هفته ${esc(weeks[0])} تا ${esc(
        weeks[weeks.length - 1],
      )}</span>
    </div>
    <svg viewBox="0 0 ${width} ${height}" role="img"
      aria-label="روند وزن و ضریب تبدیل هفته‌های این دوره">
      ${
        weightLine
          ? `<polyline class="portal-trend__line portal-trend__line--weight" points="${weightLine}" />`
          : ""
      }
      ${
        fcrLine
          ? `<polyline class="portal-trend__line portal-trend__line--fcr" points="${fcrLine}" />`
          : ""
      }
    </svg>
  </div>`;
};

// ریز سالن‌ها — هر ستون برچسبش از سرور (meta.hall_metrics) می‌آید
const hallsTable = (halls, hallMetrics) => {
  const rows = Array.isArray(halls) ? halls : [];
  if (!rows.length) {
    return `<div class="portal-views__empty">
      <i class="fas fa-circle-info" aria-hidden="true"></i>
      ریز سالن‌ها برای این دوره ثبت نشده است.
    </div>`;
  }
  const metrics = (Array.isArray(hallMetrics) ? hallMetrics : []).filter(
    (metric) => metric && metric.key,
  );
  return `<div class="portal-views__table-wrap">
    <table class="portal-table" data-view-report-halls>
      <thead><tr>
        <th>سالن</th>
        ${metrics
          .map(
            (metric) =>
              `<th>${esc(metric.label)}${
                metric.unit ? ` (${esc(metric.unit)})` : ""
              }</th>`,
          )
          .join("")}
      </tr></thead>
      <tbody>${rows
        .map(
          (hall) => `<tr>
            <td>${esc(hall.hall_name || `سالن ${hall.hall_id ?? ""}`)}</td>
            ${metrics
              .map((metric) => `<td>${metricText(metric, hall[metric.key])}</td>`)
              .join("")}
          </tr>`,
        )
        .join("")}</tbody>
    </table>
  </div>`;
};

// جمع دارو/واکسن — فقط نام و تعداد (شناسه‌ای نمایش داده نمی‌شود)
const usageChips = (rows, emptyText) => {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    return `<span class="portal-views__note">${esc(emptyText)}</span>`;
  }
  return `<div class="portal-views__meta">${list
    .map(
      (item) =>
        `<span class="portal-chip">${esc(item.name)} × ${esc(item.count)}</span>`,
    )
    .join("")}</div>`;
};

// ردیف مقایسهٔ «محاسبهٔ سیستمی» با «عدد ثبت‌شده»
const compareRow = (label, computed, stored, digits = 2) => {
  const text = (value) =>
    value === null || value === undefined || value === ""
      ? "—"
      : num(Number(Number(value).toFixed(digits)));
  return `<tr>
    <th scope="row">${esc(label)}</th>
    <td>${text(computed)}</td>
    <td>${text(stored)}</td>
  </tr>`;
};

const reportSelect = (items, selectedId) => {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return "";
  const options = rows
    .map((item) => {
      const label = `${dateOf(item.completion_date) || "بدون تاریخ"}${
        item.completion_type_label ? ` — ${item.completion_type_label}` : ""
      }`;
      const selected = String(item.id) === String(selectedId) ? " selected" : "";
      return `<option value="${esc(item.id)}"${selected}>${esc(label)}</option>`;
    })
    .join("");
  return `<div class="portal-views__toolbar">
    <div class="portal-views__field">
      <label for="portalFinalSelect">دوره</label>
      <select id="portalFinalSelect" data-view-report-select>${options}</select>
    </div>
  </div>`;
};

export const renderFinalReportView = ({
  items = [],
  metrics = [],
  hallMetrics = [],
  report = null,
  selectedId = "",
} = {}) => {
  const rows = Array.isArray(items) ? items : [];
  const toolbar = reportSelect(rows, selectedId || (rows[0] && rows[0].id) || "");

  if (!rows.length) {
    return `${toolbar}${renderNotice(
      "دوره‌ای برای گزارش نیست",
      "گزارش نهایی وقتی ساخته می‌شود که کارشناس پایان یک دوره را ثبت کرده باشد.",
      "info",
    )}`;
  }

  if (!report || !report.completion) {
    return `${toolbar}${renderNotice(
      "گزارش نهایی این دوره در دسترس نیست",
      "برای دیدن گزارش، یکی از دوره‌های فهرست بالا را انتخاب کنید یا بعداً دوباره تلاش کنید.",
      "info",
    )}`;
  }

  const completion = report.completion;
  const totals = report.totals || {};
  const stored = report.stored || {};

  // اعداد «محاسبه‌شده» (از هفته‌ها) و در نبود آن‌ها «ثبت‌شده»
  const summarySource = {
    initial_chicks_count: totals.initialChicks,
    final_chicks_count: totals.finalChicks,
    survival_percent: totals.survivalRate,
    final_fcr: totals.fcr,
    final_avg_weight: totals.lastWeight,
    total_feed_intake: totals.totalFeed,
    adg_grams: stored.adg_grams,
    epi: stored.epi,
    slaughter_age_days: totals.ageDays,
  };

  const notices = (Array.isArray(report.notices) ? report.notices : [])
    .map(
      (text) =>
        `<li><i class="fas fa-circle-info" aria-hidden="true"></i> ${esc(
          text,
        )}</li>`,
    )
    .join("");

  return `${toolbar}
  <div class="portal-report" data-view-final-report="${esc(completion.id)}">
    <div class="portal-views__card-head">
      <i class="fas fa-flag-checkered" aria-hidden="true"></i>
      <span>گزارش دورهٔ ${esc(dateOf(completion.completion_date) || "بدون تاریخ")}</span>
    </div>
    <div class="portal-views__meta">
      <span>شمارهٔ گله: <strong>${esc(completion.flock_id ?? "—")}</strong></span>
      ${
        completion.completion_type_label
          ? `<span class="portal-chip">${esc(completion.completion_type_label)}</span>`
          : ""
      }
      <span>هفته‌های ثبت‌شده: <strong>${esc(
        (report.weekly && report.weekly.weeks_count) || 0,
      )}</strong></span>
    </div>

    ${
      notices
        ? `<ul class="portal-views__notices" data-view-report-notices>${notices}</ul>`
        : ""
    }

    ${kpiGrid(metrics, summarySource, "final")}

    <div class="portal-views__table-wrap">
      <table class="portal-table" data-view-report-compare>
        <thead><tr>
          <th>شاخص</th>
          <th>محاسبه از هفته‌ها</th>
          <th>ثبت‌شده در پایان دوره</th>
        </tr></thead>
        <tbody>
          ${compareRow("ضریب تبدیل", totals.fcr, stored.final_fcr, 2)}
          ${compareRow("درصد زنده‌مانی", totals.survivalRate, stored.survival_percent, 2)}
          ${compareRow("درصد تلفات", totals.mortalityRate, stored.mortality_rate, 2)}
          ${compareRow("خوراک کل (کیلوگرم)", totals.totalFeed, stored.total_feed_intake, 2)}
          ${compareRow("وزن نهایی (کیلوگرم)", totals.lastWeight, stored.final_avg_weight, 3)}
        </tbody>
      </table>
    </div>

    ${
      renderTrendChart(report.trend) ||
      `<div class="portal-views__empty">
         <i class="fas fa-chart-line" aria-hidden="true"></i>
         برای رسم روند، دست‌کم دو هفتهٔ ثبت‌شده لازم است.
       </div>`
    }

    <h4 class="portal-report__title">ریز سالن‌ها</h4>
    ${hallsTable(report.halls, hallMetrics)}

    <h4 class="portal-report__title">دارو و واکسن مصرفی</h4>
    <div class="portal-report__row">
      <span class="portal-report__label">دارو:</span>
      ${usageChips(report.medicines, "دارویی برای این دوره ثبت نشده است.")}
    </div>
    <div class="portal-report__row">
      <span class="portal-report__label">واکسن:</span>
      ${usageChips(report.vaccines, "واکسنی برای این دوره ثبت نشده است.")}
    </div>

    <h4 class="portal-report__title">اطلاعات دوره و کشتار</h4>
    <div class="portal-views__table-wrap">
      <table class="portal-table" data-view-report-meta>
        <tbody>${reportMetaRows(completion)}</tbody>
      </table>
    </div>

    <p class="portal-views__note">
      <i class="fas fa-circle-info" aria-hidden="true"></i>
      «محاسبه از هفته‌ها» با همان موتور شاخص‌های سیستم انجام می‌شود؛ اگر با
      عدد ثبت‌شدهٔ کارشناس تفاوت داشت، هر دو نمایش داده می‌شود.
      اطلاعات مالی (درآمد/هزینه/سود) در پورتال نمایش داده نمی‌شود.
    </p>
  </div>`;
};

// __APPEND__

const viewErrorMessage = (error) => {
  const message = String((error && error.message) || "").trim();
  if (!message || /^HTTP error/i.test(message)) {
    return "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.";
  }
  return message;
};

// ============================================================
// ۴) آکاردئون گله‌ها و هفته‌ها (۱۳.۲۱)
// ------------------------------------------------------------
//  «مدیریت هفتگی» و «جوجه‌ریزی» هر کدام یک سطح بالاتر گرفتند:
//  گله ← ردیف‌های همان گله. ردیف‌ها همان رندرکنندهٔ ۱۳.۳/۱۳.۴
//  هستند (بدون تکرار برچسب/عدد/تاریخ) و دکمهٔ «جزئیات» هفته هم
//  همان `data-portal-open="week"` قبلی است — صفر اندپوینت تازه.
// ============================================================
export const renderWeeksTree = (items = []) => {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return renderEmpty("هفتهٔ مدیریتی ثبت نشده است");

  const groups = groupWeeksByFlock(rows);
  return groups
    .map(
      (group) =>
        `<li class="portal-acc__entry">${treeAccordion({
          id: `weeks-${group.key}`,
          title: group.label,
          badge: `${group.weeks.length} هفته`,
          level: 1,
          body: `<ul class="portal-list">${renderWeekList(group.weeks)}</ul>`,
        })}</li>`,
    )
    .join("");
};

export const renderFlocksTree = (items = []) => {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return renderEmpty("گله‌ای برای این پرونده ثبت نشده است");

  return rows
    .map((row) => {
      const number =
        row.flock_number === null || row.flock_number === undefined
          ? ""
          : String(row.flock_number);
      const subtitle = row.placement_date ? dateOf(row.placement_date) : "";
      return `<li class="portal-acc__entry">${treeAccordion({
        id: `flock-row-${row.id}`,
        title: number ? `گلهٔ ${number}` : "گلهٔ بدون شماره",
        subtitle,
        badge: row.ended_at ? "پایان‌یافته" : "در جریان",
        level: 1,
        body: `<ul class="portal-list">${renderFlockList([row])}</ul>`,
      })}</li>`;
    })
    .join("");
};

// ============================================================
// mixin — متدها روی PortalService.prototype سوار می‌شوند
// ============================================================
export const portalViewsMixin = {
  // ===== وضعیت داخلی چهار نمای تازه =====
  initViews() {
    if (!this.extra || typeof this.extra !== "object") this.extra = {};

    this.extra.units = { loaded: false, loading: false };
    // ✅ ۱۳.۲۱ — «سالن‌ها» آکاردئونی شد: فهرست سالن‌ها + جزئیات تنبلِ هر
    //  سالن. `details` کش همان پاسخ /farm/halls/:id است (هر سالن یک‌بار)
    //  و `pending` ضد درخواست هم‌زمان برای همان سالن.
    this.extra.halls = {
      loaded: false,
      loading: false,
      halls: [],
      dictionaries: {},
      details: {},
      pending: {},
      errors: {},
    };
    this.extra.placements = {
      loaded: false,
      loading: false,
      placements: [],
      detail: null,
      dictionaries: {},
    };
    this.extra.soon = { loaded: true, loading: false };
    // ✅ ۱۳.۱۹ — «پایان دوره» و «گزارش نهایی دوره»
    this.extra.completion = {
      loaded: false,
      loading: false,
      items: [],
      metrics: [],
      pagination: null,
      page: 1,
      cache: new Map(),
    };
    this.extra.finalReport = {
      loaded: false,
      loading: false,
      items: [],
      metrics: [],
      hallMetrics: [],
      report: null,
      completionId: "",
      pendingId: "",
    };

    // کش مشترک options (یک GET برای سه پنل)
    this.unitsCache = null;
    this.viewsBound = false;
  },

  // ===== اتصال رویدادها (یک‌بار) =====
  bindViews() {
    if (this.viewsBound) return;
    if (typeof document === "undefined" || !document.addEventListener) return;
    this.viewsBound = true;

    // ✅ ۱۳.۲۳ — هر دکمهٔ ردیف (ثبت/ویرایش/حذف واحد، سالن، دوره، هفته)
    //  «فرم درون‌خطی» همان بخش را با نوع و هدف همان ردیف باز می‌کند.
    //  🔒 شناسه از `data-farm-unit`/`data-farm-hall` همان دکمه می‌آید
    //     (خروجی سرور) — نه از URL؛ و سرور مستقل همان را می‌سنجد.
    const bindFarmActions = (body) => {
      if (!body || typeof body.addEventListener !== "function") return;
      body.addEventListener("click", (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== "function") return null;

        const action = target.closest("[data-farm-action]");
        if (action) {
          event.preventDefault();
          const id =
            action.getAttribute("data-farm-hall") ||
            action.getAttribute("data-farm-unit") ||
            action.getAttribute("data-farm-placement") ||
            action.getAttribute("data-farm-weekly") ||
            "";
          // بخش میزبان = نزدیک‌ترین پنل همین دکمه (نه تبِ «فعال»)
          const panelNode = action.closest("[data-portal-panel]");
          const accNode = action.closest("[data-acc-id]");
          return this.openRequestForm(
            action.getAttribute("data-farm-action"),
            id,
            {
              panel: panelNode
                ? String(panelNode.getAttribute("data-portal-panel") || "").trim()
                : "",
              accId: accNode
                ? String(accNode.getAttribute("data-acc-id") || "").trim()
                : "",
              origin: action,
            },
          );
        }

        // «جزئیات سالن» در آکاردئون واحدها ⇒ همان پنل سالن‌ها + باز کردن
        const focus = target.closest("[data-hall-focus]");
        if (focus) {
          event.preventDefault();
          return this.openHallAccordion(focus.getAttribute("data-hall-focus"));
        }

        return null;
      });
    };

    bindFarmActions(this.el(VIEW_TABS.units.bodyId));
    bindFarmActions(this.el(VIEW_TABS.halls.bodyId));
    bindFarmActions(this.el(VIEW_TABS.placements.bodyId));

    // ✅ ۱۳.۲۱ — دادهٔ هر سالن فقط با «باز شدن» همان <details> گرفته
    //  می‌شود (همان درس ۱۳.۱۷: صفر درخواست برای سالن بسته).
    //  ⚠️ رویداد toggle بابل نمی‌شود ⇒ شنوندهٔ capture روی ظرف پنل.
    const hallsBody = this.el(VIEW_TABS.halls.bodyId);
    if (hallsBody) {
      hallsBody.addEventListener(
        "toggle",
        (event) => {
          const node = event.target;
          if (!node || typeof node.getAttribute !== "function") return null;
          if (!node.open) return null;

          const accId = String(node.getAttribute("data-acc-id") || "");
          if (!accId.startsWith("hall-")) return null;

          // بخش‌های تودرتو (`hall-<id>-<section>`) شناسهٔ سالن نیستند؛
          // ensureHallDetail خودش عضویت در فهرست سرور را می‌سنجد.
          const hallId = accId.slice("hall-".length);
          this.setHallOpen(hallId, true);
          return this.ensureHallDetail(hallId);
        },
        { capture: true },
      );

      // بسته شدن هم ثبت می‌شود تا رندر بعدی وضعیت بازها را حفظ کند
      hallsBody.addEventListener(
        "toggle",
        (event) => {
          const node = event.target;
          if (!node || typeof node.getAttribute !== "function") return null;
          if (node.open) return null;
          const accId = String(node.getAttribute("data-acc-id") || "");
          if (!accId.startsWith("hall-")) return null;
          this.setHallOpen(accId.slice("hall-".length), false);
          return null;
        },
        { capture: true },
      );
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

    // ✅ ۱۳.۱۹ — کارت «پایان دوره»: گزارش نهایی + صفحهٔ بعد
    //  🔒 شناسهٔ دوره فقط از `data-view-completion-report` همان کارت
    //     می‌آید (خروجی سرور) و در نهایت سرور مالکیت را می‌سنجد.
    const completionBody = this.el(VIEW_TABS.completion.bodyId);
    if (completionBody) {
      completionBody.addEventListener("click", (event) => {
        const reportButton = event.target.closest(
          "[data-view-completion-report]",
        );
        if (reportButton) {
          event.preventDefault();
          return this.openFinalReport(
            reportButton.getAttribute("data-view-completion-report"),
          );
        }
        const moreButton = event.target.closest("[data-view-completion-more]");
        if (moreButton) {
          event.preventDefault();
          return this.loadCompletionView({ append: true });
        }
        return null;
      });
    }

    // ✅ ۱۳.۱۹ — انتخاب دوره در «گزارش نهایی»
    const finalBody = this.el(VIEW_TABS.finalReport.bodyId);
    if (finalBody) {
      finalBody.addEventListener("change", (event) => {
        const select = event.target.closest("[data-view-report-select]");
        if (!select) return null;
        return this.selectCompletionForReport(select.value);
      });
    }
  },

  // ===== ورود پنل: همهٔ تب‌های خاص از همین نقطه می‌گذرند =====
  async loadExtraTab(key) {
    if (key === "units") return this.loadUnitsView();
    // ✅ ۱۳.۲۱ — «سالن‌ها» پنل آکاردئونی شد (جای hallDetail حذف‌شده)
    if (key === "halls") return this.loadHallsView();
    if (key === "placements") return this.loadPlacementsView();
    if (key === "completion") return this.loadCompletionView();
    if (key === "finalReport") return this.loadFinalReportView();
    if (key === "tickets") return this.loadTicketsView();
    if (key === "soon") return this.loadSoonView();
    // مدارک/پروفایل/داشبورد ⇒ همان منطق لایه‌های قبلی
    return portalFarmMixin.loadExtraTab.call(this, key);
  },

  // ===== لایهٔ محتوا (همان کلیدی که سرور ۴۰۳ می‌دهد) =====
  canViewContent(conf) {
    if (!conf) return true;
    // ✅ ۱۳.۱۹: پنل‌هایی که به بیش از یک کلید نیاز دارند (گزارش نهایی
    // = فهرست + تفصیل) — رفتار بقیهٔ پنل‌ها تغییر نمی‌کند.
    if (Array.isArray(conf.requiresAll) && conf.requiresAll.length) {
      return conf.requiresAll.every((key) => Boolean(this.canPermission(key)));
    }
    if (!conf.requires) return true;
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
      this.renderUnits(options.units, options.halls, options.dictionaries);
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus("units", "error", viewErrorMessage(error));
    } finally {
      state.loading = false;
    }
  },

  // ✅ ۱۳.۲۱ — دکمه‌های ثبت/ویرایش/حذف فقط با features.farm_request
  //  (همان گیت ۱۳.۲۰؛ سرور هم مستقل همان را می‌سنجد)
  unitsCanWrite() {
    return typeof this.canRequestFarm === "function"
      ? this.canRequestFarm()
      : false;
  },

  renderUnits(units, halls = [], dictionaries = {}) {
    const body = this.el(VIEW_TABS.units.bodyId);
    if (!body) return;
    body.innerHTML = renderUnitsView(units, {
      halls,
      dictionaries,
      canWrite: this.unitsCanWrite(),
    });
    decorateTables(body);
  },

  // ===== ۲) سالن‌ها (آکاردئون: سالن ← چهار بخش) — ✅ ۱۳.۲۱ =====
  //  🔒 یک GET برای فهرست (options) + یک GET تنبل برای هر سالن که
  //     کاربر باز می‌کند؛ سالن بسته هیچ درخواستی نمی‌فرستد.
  async loadHallsView() {
    const state = this.extra.halls;
    if (!state || state.loading) return;
    state.loading = true;
    this.setExtraStatus("halls", "loading");

    try {
      if (!this.canViewContent(VIEW_TABS.halls)) {
        state.loaded = true;
        this.setExtraStatus("halls", "ready");
        this.renderViewDenied("halls");
        return;
      }
      const options = await this.farmOptionsCached();
      state.halls = options.halls;
      state.dictionaries = options.dictionaries;
      state.loaded = true;
      this.setExtraStatus("halls", "ready");
      this.renderHalls();

      // اگر از دکمهٔ «جزئیات سالن» در آکاردئون واحدها آمده‌ایم
      const focus = String(state.focusId || "");
      if (focus) {
        state.focusId = "";
        await this.openHallAccordion(focus);
      }
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus("halls", "error", viewErrorMessage(error));
    } finally {
      state.loading = false;
    }
  },

  // رندر آکاردئون سالن‌ها (وضعیت بازها حفظ می‌شود)
  renderHalls() {
    const state = this.extra.halls;
    const body = this.el(VIEW_TABS.halls.bodyId);
    if (!state || !body) return;

    body.innerHTML = renderHallsAccordion({
      halls: state.halls,
      details: state.details,
      dictionaries: state.dictionaries,
      sections: this.hallSectionsAllowed(),
      canWrite: this.unitsCanWrite(),
      pending: state.pending,
      errors: state.errors,
    });

    // همان سالن‌هایی که کاربر باز کرده، باز می‌مانند
    const openIds = Array.isArray(state.openIds) ? state.openIds : [];
    if (openIds.length) {
      Array.from(body.querySelectorAll("[data-acc-id]")).forEach((node) => {
        const accId = String(node.getAttribute("data-acc-id") || "");
        if (openIds.includes(accId.slice("hall-".length)) && accId.startsWith("hall-")) {
          node.open = true;
        }
      });
    }

    decorateTables(body);
  },

  // گیت هر بخش آکاردئون = کلید منوی همان بخش (بدون کلید تازه)
  hallSectionsAllowed() {
    const gate = {
      physical: "customer.portal.menu.farm.physical",
      system: "customer.portal.menu.farm.systems",
      water_feed: "customer.portal.menu.farm.waterFeed",
      hygiene: "customer.portal.menu.farm.hygiene",
    };
    const can = (token) =>
      typeof this.canPermission === "function"
        ? this.canPermission(token) !== false
        : true;
    return Object.keys(gate).filter((section) => can(gate[section]));
  },

  // ثبت وضعیت باز/بستهٔ آکاردئون‌ها (بدون رندر — رندر بعدی حفظ می‌کند)
  setHallOpen(rawId, open) {
    const state = this.extra.halls;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return;
    const list = Array.isArray(state.openIds) ? state.openIds : [];
    const without = list.filter((row) => row !== id);
    state.openIds = open ? [...without, id] : without;
  },

  // گرهٔ <details> همان سالن (بدون ساختن selector از دادهٔ سرور)
  hallNodeOf(body, id) {
    if (!body || typeof body.querySelectorAll !== "function") return null;
    const wanted = `hall-${id}`;
    return (
      Array.from(body.querySelectorAll("[data-acc-id]")).find(
        (node) => String(node.getAttribute("data-acc-id") || "") === wanted,
      ) || null
    );
  },

  // پرش از آکاردئون واحدها به آکاردئون همان سالن
  openHallAccordion(rawId) {
    const state = this.extra.halls;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return null;

    if (
      this.activeRoute !== "#/farm/halls" &&
      typeof this.goToRoute === "function"
    ) {
      this.goToRoute("#/farm/halls");
    }

    const known = state.halls.some((hall) => String(hall.id) === id);
    if (!known) {
      // هنوز فهرست نیامده ⇒ بعد از بارگذاری باز می‌شود
      if (!state.loaded) state.focusId = id;
      return null;
    }

    this.setHallOpen(id, true);
    const body = this.el(VIEW_TABS.halls.bodyId);
    const node = body ? this.hallNodeOf(body, id) : null;
    if (node) node.open = true;
    return this.ensureHallDetail(id);
  },

  // جزئیات یک سالن — هر سالن یک‌بار (کش) و ضد درخواست هم‌زمان
  async ensureHallDetail(rawId) {
    const state = this.extra.halls;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return null;

    // 🔒 شناسه فقط از فهرست خودِ سرور معتبر است (ضد IDOR)
    const known = state.halls.some((hall) => String(hall.id) === id);
    if (!known) return null;
    if (state.details[id]) return state.details[id];
    if (state.pending[id]) return null;
    // هیچ بخشی باز نیست ⇒ درخواست بی‌فایده نمی‌فرستیم
    if (!this.hallSectionsAllowed().length) return null;

    state.pending[id] = true;
    this.renderHalls();

    try {
      const detail = payloadDataOf(await portalApi.getFarmHallDetails(id));
      state.details[id] = detail;
      delete state.errors[id];
      return detail;
    } catch (error) {
      state.errors[id] = viewErrorMessage(error);
      return null;
    } finally {
      delete state.pending[id];
      this.renderHalls();
    }
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
    // ✅ ۱۳.۲۱ — جدول جزئیات دوره در موبایل کارت می‌شود (بدون اسکرول افقی)
    decorateTables(body);
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

  // ===== ۵) «پایان دوره» — فهرست دوره‌های بسته‌شده (✅ ۱۳.۱۹) =====
  //  🔒 حالت دوم (append) فقط صفحهٔ بعدِ همان فهرست را می‌گیرد؛ هیچ
  //     شناسه‌ای از URL/ورودی آزاد نمی‌آید.
  async loadCompletionView({ append = false } = {}) {
    const state = this.extra.completion;
    if (!state || state.loading) return;

    if (!this.canViewContent(VIEW_TABS.completion)) {
      state.loaded = true;
      this.setExtraStatus("completion", "ready");
      this.renderViewDenied("completion");
      return;
    }

    state.loading = true;
    this.setExtraStatus("completion", "loading");
    const nextPage = append ? (Number(state.page) || 1) + 1 : 1;

    try {
      const data = payloadDataOf(
        await portalApi.getCompletions({
          page: nextPage,
          limit: COMPLETION_PAGE,
        }),
      );
      const items = Array.isArray(data.items) ? data.items : [];
      const meta = data.meta || {};
      state.items = append ? [...state.items, ...items] : items;
      state.metrics =
        Array.isArray(meta.metrics) && meta.metrics.length
          ? meta.metrics
          : state.metrics;
      state.pagination = data.pagination || null;
      state.page = Number(data.pagination && data.pagination.page) || nextPage;
      state.loaded = true;
      this.setExtraStatus("completion", "ready");
      this.renderCompletion();
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus("completion", "error", viewErrorMessage(error));
    } finally {
      state.loading = false;
    }
  },

  // گیت دکمهٔ «گزارش نهایی»
  // ✅ موج ۱۳.۲۰ — منبع اول: پاسخ سرور (`features.completion_report` که
  //    portalSchema از کلید COMPLETION_REPORT می‌سازد). fallback کلاینت
  //    فقط برای زمانی است که /me قدیمی یا fixture بدون features باشد؛
  //    با این ترتیب، دکمه هیچ‌وقت با کلید بستهٔ سرور دیده نمی‌شود
  //    (canPermission به‌طور پیش‌فرض fail-open است).
  completionCanReport() {
    const features = this.data && this.data.features;
    if (features && typeof features.completion_report === "boolean") {
      return features.completion_report;
    }
    return Boolean(this.canPermission("customer.portal.completion.report"));
  },

  renderCompletion() {
    const state = this.extra.completion;
    const body = this.el(VIEW_TABS.completion.bodyId);
    if (!state || !body) return;
    body.innerHTML = renderCompletionView({
      items: state.items,
      metrics: state.metrics,
      pagination: state.pagination,
      canReport: this.completionCanReport(),
    });
    // ✅ ۱۳.۲۳ — جدول‌های این پنل هم در موبایل کارت می‌شوند
    decorateTables(body);
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

  // ===== ۶) «گزارش نهایی دوره» (✅ ۱۳.۱۹) =====
  async loadFinalReportView() {
    const state = this.extra.finalReport;
    if (!state || state.loading) return;

    if (!this.canViewContent(VIEW_TABS.finalReport)) {
      state.loaded = true;
      this.setExtraStatus("finalReport", "ready");
      this.renderViewDenied("finalReport");
      return;
    }

    state.loading = true;
    this.setExtraStatus("finalReport", "loading");

    try {
      // انتخابگر دوره: یک GET کوچک از همان فهرست (بدون پارامتر آزاد)
      if (!state.items.length) {
        const data = payloadDataOf(
          await portalApi.getCompletions({ page: 1, limit: COMPLETION_PAGE }),
        );
        const meta = data.meta || {};
        state.items = Array.isArray(data.items) ? data.items : [];
        state.metrics = Array.isArray(meta.metrics) ? meta.metrics : [];
        state.hallMetrics = Array.isArray(meta.hall_metrics)
          ? meta.hall_metrics
          : [];
      }
      state.loaded = true;
      this.setExtraStatus("finalReport", "ready");

      const wanted = String(
        state.pendingId ||
          state.completionId ||
          (state.items[0] && state.items[0].id) ||
          "",
      );
      state.pendingId = "";
      if (!wanted) return this.renderFinalReport();
      return this.selectCompletionForReport(wanted, { silent: true });
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus("finalReport", "error", viewErrorMessage(error));
    } finally {
      state.loading = false;
    }
  },

  // انتخاب دوره — فقط شناسه‌ای که در فهرست خودم آمده پذیرفته می‌شود
  async selectCompletionForReport(rawId, { silent = false } = {}) {
    const state = this.extra.finalReport;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return null;

    const allowed = state.items.some((row) => String(row.id) === id);
    if (!allowed) return null;
    state.completionId = id;

    const current = state.report && state.report.completion;
    if (current && String(current.id) === id) {
      return this.renderFinalReport();
    }

    const body = this.el(VIEW_TABS.finalReport.bodyId);
    if (!silent && body) {
      body.innerHTML = `<div class="portal-views__loading">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت گزارش دوره…
      </div>`;
    }

    try {
      state.report = payloadDataOf(await portalApi.getCompletionReport(id));
      const meta = (state.report && state.report.meta) || {};
      if (Array.isArray(meta.metrics) && meta.metrics.length) {
        state.metrics = meta.metrics;
      }
      if (Array.isArray(meta.hall_metrics) && meta.hall_metrics.length) {
        state.hallMetrics = meta.hall_metrics;
      }
    } catch (error) {
      state.report = null;
      if (body) {
        body.innerHTML = renderNotice(
          "دریافت گزارش نهایی ناموفق بود",
          viewErrorMessage(error),
          "error",
        );
      }
      return null;
    }

    return this.renderFinalReport();
  },

  renderFinalReport() {
    const state = this.extra.finalReport;
    const body = this.el(VIEW_TABS.finalReport.bodyId);
    if (!state || !body) return;
    body.innerHTML = renderFinalReportView({
      items: state.items,
      metrics: state.metrics,
      hallMetrics: state.hallMetrics,
      report: state.report,
      selectedId: state.completionId,
    });
    // ✅ ۱۳.۲۳ — جدول‌های گزارش نهایی هم در موبایل کارت می‌شوند
    decorateTables(body);
  },

  // پرش از کارت «پایان دوره» به گزارش نهایی همان دوره
  openFinalReport(rawId) {
    const state = this.extra.finalReport;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return null;
    state.pendingId = id;

    if (typeof this.goToRoute === "function") this.goToRoute("#/reports/final");
    if (
      this.activeRoute !== "#/reports/final" &&
      typeof this.activateTab === "function"
    ) {
      this.activateTab("finalReport");
    }

    // پنل از قبل بار شده بود ⇒ همان انتخاب را مستقیم بارگذاری می‌کنیم
    if (state.loaded) {
      state.pendingId = "";
      return this.selectCompletionForReport(id);
    }
    return id;
  },

  // ===== پس از فعال‌شدن مسیر (پوسته صدا می‌زند) =====
  //  هدف: جابه‌جایی بین دو مسیرِ هم‌پنل (physical → systems) پنل را
  //  دوباره از سرور نگیرد؛ فقط همان بخش از کش رندر شود.
  applyRouteView(entry) {
    if (!entry || typeof entry !== "object") return "";
    const state = this.extra || {};

    // ✅ ۱۳.۲۱ — پنل «سالن‌ها» آکاردئونی است: مسیر فقط پنل را نشان
    //  می‌دهد؛ باز شدن سالنِ خاص از دکمهٔ همان ردیف می‌آید (نه URL).
    if (entry.panel === "halls") {
      if (state.halls && state.halls.loaded) this.renderHalls();
      return "halls";
    }

    if (entry.panel === "soon") return this.renderSoon(entry.route);

    // ✅ ۱۳.۱۹: بازگشت به این دو پنل، درخواست دوباره نمی‌فرستد
    if (entry.panel === "completion" && state.completion && state.completion.loaded) {
      this.renderCompletion();
      return "completion";
    }

    if (
      entry.panel === "finalReport" &&
      state.finalReport &&
      state.finalReport.loaded
    ) {
      this.renderFinalReport();
      return "finalReport";
    }

    if (entry.panel === "placements" && state.placements && state.placements.loaded) {
      this.renderPlacements();
      return "placements";
    }

    if (entry.panel === "units" && state.units && state.units.loaded && this.unitsCache) {
      this.renderUnits(this.unitsCache.units);
      return "units";
    }

    // ✅ ۱۳.۲۳ — مسیر ثبت تازه: همان فرم، ولی درون‌خطی در بخشِ خانهٔ نوع
    //  (نه شیت مودال؛ هیچ لایهٔ روی صفحه باز نمی‌شود).
    if (entry.farmType) {
      return this.openRequestForm(entry.farmType, "", {
        panel: farmPanelOfType(entry.farmType),
      });
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
