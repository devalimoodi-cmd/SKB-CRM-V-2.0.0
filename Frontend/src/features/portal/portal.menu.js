// ============================================================
// features/portal/portal.menu.js
// «مدل» ناوبری پورتال مشتری — موج ۱۳.۱۷
// ------------------------------------------------------------
//  چرا فایل جدا و «خالص» (بدون DOM/بدون import)؟
//   • گارد تست (`portal-menu-guard-test.mjs`) همین مدل را در Node
//     اجرا می‌کند: parse/resolve/normalize باید بدون مرورگر هم
//     قابل سنجش باشد (مثل portal.farm.rules.js در ۱۳.۱۱).
//   • درخت منو یک «قرارداد» است: شناسهٔ پنل، کلید منو، کلید محتوا.
//     اگر این‌ها در JS و HTML جداگانه تایپ شوند، دیر یا زود از هم
//     جدا می‌شوند؛ گارد تست همین هم‌خوانی را می‌سنجد.
//
//  🔒 قواعد امنیتی/رفتاری:
//   ۱) مسیر فقط از فهرست سفید همین فایل خوانده می‌شود؛ هیچ بخشی از
//      URL به‌عنوان شناسهٔ ردیف/مشتری تفسیر نمی‌شود (ضد IDOR).
//      حداکثر دو بخش: #/<menu>/<item> — عمیق‌تر ⇒ نامعتبر.
//   ۲) هر آیتم دو کلید دارد:
//        key        → «لایهٔ منو» (customer.portal.menu.*) = دیده‌شدن
//        contentKey → «لایهٔ محتوا» = همان کلیدی که *سرور* اجرا می‌کند
//      اگر contentKey بسته باشد، پنل داده نمی‌گیرد حتی اگر منو باز
//      باشد (و برعکس، بستن منو دسترسی داده را باز نمی‌کند).
//   ۳) `panel` باید دقیقاً یکی از data-portal-panel های portal.html
//      باشد؛ گارد تست هر ۱۴ پنل را می‌شمارد (هیچ پنل یتیمی نمی‌ماند).
//   ✅ ۱۳.۱۹: دو پنل «پایان دوره» و «گزارش نهایی دوره» واقعی شدند
//      (از «به‌زودی» بیرون آمدند) و فقط «ضدعفونی دوره» soon ماند.
// ============================================================

// کلید محتوایی مشترک زیرمنوهای «مزرعه/جوجه‌ریزی/درخواست/هفتگی»
// (همان زنجیرهٔ سرور: farmChain = customer.portal.farm)
const FARM = "customer.portal.farm";
const HALLS = "customer.portal.halls";
const FLOCKS = "customer.portal.flocks";
const WEEKS = "customer.portal.weeks";
const VISITS = "customer.portal.visits";
const PROFILE = "customer.portal.profile";
const DOCUMENTS = "customer.portal.documents";
const DASHBOARD = "customer.portal.dashboard";
const MENU = "customer.portal.menu";
// ✅ ۱۳.۱۹ — «پایان دوره» (فهرست) و «گزارش تفصیلی» (دو کلید محتوا)
const COMPLETION = "customer.portal.completion";
const COMPLETION_REPORT = "customer.portal.completion.report";
// ✅ ۱۳.۲۱ — «ارسال تیکت» (محتوای پنل تیکت)؛ ۱۳.۲۲: سرور هم همین را می‌خواند
const TICKETS = "customer.portal.tickets";

// ============================================================
// درخت منو: ۷ منو + ۱۴ زیرمنو = ۲۱ آیتم
// ------------------------------------------------------------
//  ✅ موج ۱۳.۲۱ — بازآرایی:
//   • منوی «درخواست‌های من» حذف شد؛ فرم‌ها از شیت همان بخش باز
//     می‌شوند (ثبت/ویرایش/حذف واحد، سالن، دوره، هفته).
//   • «مزرعهٔ من» ⇐ «واحدهای من» با دو زیرمنوی واحدها/سالن‌ها؛
//     چهار مسیر بخش سالن حذف و به آکاردئون همان پنل منتقل شد
//     (کلیدهایشان به‌عنوان گیت بخش باقی است).
//   • «ثبت هفته» از منو حذف شد (دکمهٔ داخل پنل هفتگی).
//   • منوی تازهٔ «ارسال تیکت».
// ============================================================
//  alias: true ⇒ مسیرِ ریشه خودش پنل مستقل ندارد و به «اولین
//  زیرمنوی مجاز» همان منو می‌رود (تا کلیک روی منو هرگز صفحهٔ خالی
//  نشان ندهد). داشبورد تنها منویی است که ریشه‌اش پنل واقعی دارد.
// ============================================================
export const PORTAL_MENUS = [
  {
    id: "dashboard",
    label: "داشبورد",
    icon: "fa-chart-pie",
    key: `${MENU}.dashboard`,
    route: "#/dashboard",
    panel: "dashboard",
    contentKey: DASHBOARD,
    alias: false,
    items: [
      {
        id: "charts",
        label: "نمودارها",
        route: "#/dashboard/charts",
        panel: "dashboard",
        key: `${MENU}.dashboard.charts`,
        contentKey: DASHBOARD,
        anchor: "portalDashboardCharts",
      },
      {
        id: "compare",
        label: "مقایسهٔ گله‌ها",
        route: "#/dashboard/compare",
        panel: "dashboard",
        key: `${MENU}.dashboard.compare`,
        contentKey: DASHBOARD,
        anchor: "portalDashboardCompare",
      },
    ],
  },
  {
    id: "profile",
    label: "پروندهٔ من",
    icon: "fa-id-card",
    key: `${MENU}.profile`,
    route: "#/profile",
    panel: "profile",
    contentKey: PROFILE,
    alias: true,
    items: [
      {
        id: "me",
        label: "پروفایل من",
        route: "#/profile/me",
        panel: "profile",
        key: `${MENU}.profile.me`,
        contentKey: PROFILE,
      },
      {
        id: "documents",
        label: "مدارک من",
        route: "#/profile/documents",
        panel: "documents",
        key: `${MENU}.profile.documents`,
        contentKey: DOCUMENTS,
      },
    ],
  },
  {
    id: "farm",
    label: "واحدهای من",
    icon: "fa-warehouse",
    key: `${MENU}.farm`,
    route: "#/farm",
    panel: "units",
    contentKey: FARM,
    alias: true,
    items: [
      {
        id: "units",
        label: "واحدها",
        route: "#/farm/units",
        panel: "units",
        key: `${MENU}.farm.units`,
        contentKey: FARM,
      },
      {
        id: "halls",
        label: "سالن‌ها",
        route: "#/farm/halls",
        panel: "halls",
        key: `${MENU}.farm.halls`,
        contentKey: HALLS,
      },
    ],
  },
  {
    id: "hatchery",
    label: "جوجه‌ریزی",
    icon: "fa-egg",
    key: `${MENU}.hatchery`,
    route: "#/hatchery",
    panel: "flocks",
    contentKey: FLOCKS,
    alias: true,
    items: [
      {
        id: "flocks",
        label: "گله‌های من",
        route: "#/hatchery/flocks",
        panel: "flocks",
        key: `${MENU}.hatchery.flocks`,
        contentKey: FLOCKS,
      },
      {
        id: "placements",
        label: "دوره‌های جوجه‌ریزی",
        route: "#/hatchery/placements",
        panel: "placements",
        key: `${MENU}.hatchery.placements`,
        contentKey: FARM,
      },
      // ⚠️ «ضدعفونی دوره» در ۱۳.۱۷/۱۳.۱۹ همچنان پنل «به‌زودی» دارد:
      //    hall_hygiene فقط «وضعیت فعلی» هر سالن است، تاریخچهٔ دوره‌ای
      //    ندارد؛ تا جدول تاریخچه ساخته نشود دادهٔ جعلی نشان نمی‌دهیم.
      //    (وضعیت فعلی در «مزرعهٔ من → بهداشت» دیده می‌شود.)
      {
        id: "hygiene",
        label: "ضدعفونی دوره",
        route: "#/hatchery/hygiene",
        panel: "soon",
        key: `${MENU}.hatchery.hygiene`,
        contentKey: "",
      },
      // ✅ ۱۳.۱۹: پنل واقعی — GET /api/portal/completions
      {
        id: "completion",
        label: "پایان دوره",
        route: "#/hatchery/completion",
        panel: "completion",
        key: `${MENU}.hatchery.completion`,
        contentKey: COMPLETION,
      },
    ],
  },
  {
    id: "weekly",
    label: "مدیریت هفتگی",
    icon: "fa-chart-line",
    key: `${MENU}.weekly`,
    route: "#/weekly",
    panel: "weeks",
    contentKey: WEEKS,
    alias: true,
    items: [
      // ⚠️ ۱۳.۲۱: «ثبت هفته» از منو حذف شد — دکمهٔ «ثبت هفته» در همان
      //    پنل هفته‌های ثبت‌شده شیت درخواست را با نوع weekly_create باز
      //    می‌کند (همان کلید محتوایی FARM).
      {
        id: "list",
        label: "هفته‌های ثبت‌شده",
        route: "#/weekly/list",
        panel: "weeks",
        key: `${MENU}.weekly.list`,
        contentKey: WEEKS,
      },
      {
        id: "trend",
        label: "نمودار روند",
        route: "#/weekly/trend",
        panel: "weeks",
        key: `${MENU}.weekly.trend`,
        contentKey: WEEKS,
        anchor: "portalChart",
      },
    ],
  },
  {
    // ✅ ۱۳.۲۱ — جای «درخواست‌های من»: پنل تیکت (گفتگو با پشتیبانی).
    id: "tickets",
    label: "ارسال تیکت",
    icon: "fa-headset",
    key: `${MENU}.tickets`,
    route: "#/tickets",
    panel: "tickets",
    contentKey: TICKETS,
    alias: false,
    items: [],
  },
  {
    id: "reports",
    label: "گزارش‌ها",
    icon: "fa-file-lines",
    key: `${MENU}.reports`,
    route: "#/reports",
    panel: "visits",
    contentKey: VISITS,
    alias: true,
    items: [
      {
        id: "visits",
        label: "بازدیدهای کارشناس",
        route: "#/reports/visits",
        panel: "visits",
        key: `${MENU}.reports.visits`,
        contentKey: VISITS,
      },
      // ✅ ۱۳.۱۹: پنل واقعی — فهرست + گزارش تفصیلی (دو کلید محتوا)
      {
        id: "final",
        label: "گزارش نهایی دوره",
        route: "#/reports/final",
        panel: "finalReport",
        key: `${MENU}.reports.final`,
        contentKey: COMPLETION_REPORT,
      },
    ],
  },
];

// مسیر پیش‌فرض (اگر URL خالی/ناشناخته بود)
export const DEFAULT_PORTAL_ROUTE = "#/dashboard";

// ============================================================
// نقشهٔ لینک‌های قدیمی — موج ۱۳.۲۱
// ------------------------------------------------------------
//  سه منو/چهار مسیر حذف شدند. بوکمارک یا لینک قدیمی نباید به صفحهٔ
//  خالی بخورد؛ این نقشه فقط «هدایت» است (هیچ شناسهٔ ردیفی از URL
//  خوانده نمی‌شود) و گارد تست هر هشت کلید را می‌سنجد.
// ============================================================
export const PORTAL_LEGACY_HASH = Object.freeze({
  "#/requests": "#/farm/units",
  "#/requests/new": "#/farm/units",
  "#/requests/list": "#/farm/units",
  "#/weekly/new": "#/weekly/list",
  "#/farm/physical": "#/farm/halls",
  "#/farm/systems": "#/farm/halls",
  "#/farm/water-feed": "#/farm/halls",
  "#/farm/hygiene": "#/farm/halls",
});

// مسیر جانشین برای لینک قدیمی (یا "" اگر قدیمی نبود)
export const legacyRoute = (hash) => PORTAL_LEGACY_HASH[normalizeHash(hash)] || "";

// ============================================================
// نمای تخت: مسیر → مقصد
// ------------------------------------------------------------
//  هر ردیف: { route, menuId, itemId, label, panel, key, contentKey,
//             anchor?, section?, farmType?, focus?, alias }
// ============================================================
const buildRoutes = () => {
  const routes = {};

  PORTAL_MENUS.forEach((menu) => {
    routes[menu.route] = {
      route: menu.route,
      menuId: menu.id,
      itemId: "",
      label: menu.label,
      menuLabel: menu.label,
      icon: menu.icon,
      panel: menu.panel,
      key: menu.key,
      contentKey: menu.contentKey || "",
      anchor: menu.anchor || "",
      section: menu.section || "",
      farmType: menu.farmType || "",
      focus: menu.focus || "",
      alias: Boolean(menu.alias),
    };

    (menu.items || []).forEach((item) => {
      routes[item.route] = {
        route: item.route,
        menuId: menu.id,
        itemId: item.id,
        label: item.label,
        menuLabel: menu.label,
        icon: menu.icon,
        panel: item.panel,
        key: item.key,
        contentKey: item.contentKey || "",
        anchor: item.anchor || "",
        section: item.section || "",
        farmType: item.farmType || "",
        focus: item.focus || "",
        alias: false,
      };
    });
  });

  return routes;
};

export const PORTAL_ROUTES = buildRoutes();

// فهرست مرتب همهٔ مسیرها (برای گارد/تست و پیمایش)
export const PORTAL_ROUTE_LIST = Object.keys(PORTAL_ROUTES);

// ============================================================
// کمکی‌های مسیر (همه pure — قابل اجرا در Node)
// ============================================================

// نرمال‌سازی: trim + یکسان‌سازی اسلش + حروف کوچک + حذف اسلش انتهایی
export const normalizeHash = (hash) =>
  String(hash ?? "")
    .trim()
    .replace(/^#?\/?/, "#/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, "")
    .toLowerCase();

// فقط بخش‌های مجاز؛ عمیق‌تر از دو بخش یا مسیر ناشناخته ⇒ null (ضد IDOR)
export const parseHash = (hash) => {
  const raw = normalizeHash(hash || DEFAULT_PORTAL_ROUTE).replace(/^#\//, "");
  const parts = raw ? raw.split("/") : [];
  if (parts.length === 0 || parts.length > 2) return null;
  const route = `#/${parts.join("/")}`;
  return PORTAL_ROUTES[route] ? route : null;
};

// نزدیک‌ترین مسیر مجاز از یک منو (اول زیرمنوها، بعد ریشه)
export const firstAllowedOfMenu = (menuId, allowed) => {
  const menu = PORTAL_MENUS.find((row) => row.id === menuId);
  if (!menu) return "";

  const isAllowed = (route) => {
    const entry = PORTAL_ROUTES[route];
    return Boolean(entry) && (!allowed || allowed(entry, route));
  };

  const child = (menu.items || [])
    .map((item) => item.route)
    .find((route) => isAllowed(route));
  if (child) return child;
  return isAllowed(menu.route) ? menu.route : "";
};

// اولین مسیر مجازِ کل پورتال (شبکهٔ ایمنی «منوی خالی هرگز»)
export const firstAllowedRoute = (allowed) => {
  for (const menu of PORTAL_MENUS) {
    const route = firstAllowedOfMenu(menu.id, allowed);
    if (route) return route;
  }
  return "";
};

// مسیر نهایی برای فعال‌سازی:
//   • مسیر ناشناخته/خالی  ⇒ پیش‌فرض یا اولین مجاز
//   • ریشهٔ alias          ⇒ اولین زیرمنوی مجاز همان منو
//   • مسیرِ غیرمجاز        ⇒ اولین مجازِ همان منو، بعد کل پورتال
//   • اگر هیچ مسیری مجاز نباشد ⇒ "" (پوسته پیام «بسته است» می‌دهد)
export const resolveRoute = (hash, allowed) => {
  // ✅ ۱۳.۲۱: لینک قدیمی (منو/مسیر حذف‌شده) به مسیر جانشین هدایت می‌شود
  const wanted = parseHash(hash) || legacyRoute(hash) || "";

  if (!wanted) {
    const fallback = parseHash(DEFAULT_PORTAL_ROUTE);
    const fallbackEntry = fallback ? PORTAL_ROUTES[fallback] : null;
    const fallbackOk =
      fallbackEntry && (!allowed || allowed(fallbackEntry, fallback));
    if (fallback && fallbackOk) return fallback;
    return firstAllowedRoute(allowed);
  }

  const entry = PORTAL_ROUTES[wanted];
  const isAllowed = !allowed || allowed(entry, wanted);
  if (!isAllowed) {
    return firstAllowedOfMenu(entry.menuId, allowed) || firstAllowedRoute(allowed);
  }

  if (entry.alias) {
    const child = firstAllowedOfMenu(entry.menuId, allowed);
    if (child && child !== wanted) return child;
  }

  return wanted;
};

// عنوان صفحه برای document.title
export const routeTitle = (route) => {
  const entry = PORTAL_ROUTES[route];
  if (!entry) return "پورتال مشتری";
  return entry.itemId ? `${entry.menuLabel} · ${entry.label}` : entry.label;
};

// آیتم‌های یک منو (برای syncNav/آکاردئون)
export const menuById = (menuId) =>
  PORTAL_MENUS.find((menu) => menu.id === menuId) || null;

// پنل‌های یکتا در درخت (گارد تست: باید با پنل‌های HTML برابر باشد)
export const PORTAL_MENU_PANELS = Array.from(
  new Set(PORTAL_ROUTE_LIST.map((route) => PORTAL_ROUTES[route].panel)),
).sort();
