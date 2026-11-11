// ============================================================
// features/portal/portal.service.js
// سرویس «پورتال مشتری» — فقط خواندن (فاز ۱۳.۲ و ۱۳.۳)
// ------------------------------------------------------------
// حالت‌ها:  loading → ready | unlinked | error
//  • unlinked: حساب مشتری به پروندهٔ متصل نیست (۴۰۳ با کد
//    CUSTOMER_LINK_MISSING) ⇒ پیام روشن، بدون خطای خشک
//    و هیچ تبی هم درخواستی نمی‌فرستد (ضد ۴ خطای تکراری ۴۰۳)
//  • error:    شبکه/سرور ⇒ پیام یک‌باره + دکمهٔ «تلاش دوباره»
//  • ۱۳.۳: چهار تب دادهٔ کامل (سالن/گله/هفته/بازدید) با بارگذاری
//    تنبل و «نمایش بیشتر». خطای هر تب مستقل است و بقیه را خراب نمی‌کند.
//  ❌ هیچ متدی برای نوشتن داده وجود ندارد؛ این صفحه فقط نمایش است.
// ============================================================
import { portalApi } from "./portal.api.js";
import {
  renderHero,
  renderCounters,
  renderFlocks,
  renderWeeks,
  renderVisits,
  renderNotice,
  renderVisitList,
  renderPager,
  renderWeekDetail,
  renderVisitDetail,
  renderWeeklyChart,
} from "./portal.renderer.js";
import { notificationService } from "../../core/services/notification.service.js";
// ✅ موج ۱۳.۸ — تب‌های «پروفایل من» و «داشبورد تحلیلی» (mixin جدا)
import { EXTRA_TABS, applyPortalExtra } from "./portal.extra.js";
// ✅ موج ۱۳.۱۰ — تب «مدارک من» (آپلود/دانلود/حذف نرم — mixin جدا)
import { DOCUMENT_TABS, applyPortalDocuments } from "./portal.documents.js";
// ✅ موج ۱۳.۱۱ — تب «درخواست‌های فارم» (درخواست مشتری + تأیید کارشناس)
import { FARM_TABS, applyPortalFarm } from "./portal.farm.js";
// ✅ موج ۱۳.۱۷ — نماهای خواندنی تازه (واحدها/سالن‌ها/دوره‌ها/به‌زودی)
// ✅ ۱۳.۲۱ — رندر آکاردئونی گله‌ها/هفته‌ها هم از همین فایل می‌آید
import {
  VIEW_TABS,
  applyPortalViews,
  renderFlocksTree,
  renderWeeksTree,
} from "./portal.views.js";
// ✅ ۱۳.۲۱ — پنل «ارسال تیکت» (متد/handler مستقل، هم‌الگوی بقیهٔ mixinها)
import { applyPortalTickets } from "./portal.tickets.js";
// ✅ موج ۱۳.۱۷ — پوستهٔ ناوبری (منو/زیرمنو + hash routing + drawer موبایل)
import { applyPortalShell } from "./portal.shell.js";
// مسیر جاری برای هم‌راستاسازی URL پس از بارگذاری
import { parseHash } from "./portal.menu.js";

// 🔗 ۱۳.۱۰: تب «مدارک من» در همان رجیستری «تب‌های خاص» ثبت می‌شود تا
//    چرخهٔ پنهان‌سازی/فعال‌سازی، `canSee` و `ALL_TAB_KEYS` بدون تغییر
//    دوم کار کنند (tabConf/canSee از EXTRA_TABS می‌خوانند).
//    ✅ ۱۳.۱۱: تب «درخواست‌های فارم» هم به همین رجیستری اضافه می‌شود.
//    ✅ ۱۳.۱۷: چهار نمای تازهٔ ناوبری (واحدها/جزئیات سالن/دوره‌ها/به‌زودی).
//    ⚠️ این خط باید **قبل** از ساخت ALL_TAB_KEYS اجرا شود.
Object.assign(EXTRA_TABS, DOCUMENT_TABS, FARM_TABS, VIEW_TABS);

// پیام ۴۰۳ِ «بدون پروندهٔ متصل» از سرور همین عبارت را دارد
const LINK_MISSING = /متصل نشده است/;

// پوشش ایمن پاسخ سرور: { success, data } ⇒ data یا {}
const payloadDataOf = (payload) => (payload && payload.data ? payload.data : {});

// اندازهٔ صفحهٔ هر تب (سرور سقف ۵۰ می‌گذارد)
const SECTION_LIMIT = 20;

// پیکربندی بخش‌های فهرستِ صفحه‌بندی‌شده — کلید = مقدار data-portal-tab
// ✅ ۱۳.۵: هر بخش کلید مجوز خودش را دارد؛ بستنِ هر تب از پنل مدیریت
//    (customer.portal.{flocks,weeks,visits}) دکمه و پنل همان تب را
//    پنهان می‌کند و هیچ درخواستی هم نمی‌فرستد.
// ⚠️ ۱۳.۲۱: «سالن‌ها» از این فهرست بیرون رفت — پنلش حالا آکاردئون
//    سالن ← چهار بخش است و با GET /farm/halls/:id تنبل پر می‌شود
//    (VIEW_TABS.halls در portal.views.js). فهرست صفحه‌بندی‌شدهٔ قبلی
//    با منوی حذف‌شدهٔ ۱۳.۲۱ دیگر مسیری نداشت.
// ✅ ۱۳.۲۱: «گله‌ها» و «هفته‌ها» هم آکاردئونی شدند — همان دادهٔ سرور،
//    یک سطح گروه‌بندی بالاتر (گله ← ردیف‌ها) بدون اندپوینت تازه.
const SECTION_CONF = {
  flocks: {
    permission: "customer.portal.flocks",
    title: "گله‌ها",
    listId: "portalFlocksList",
    pagerId: "portalFlocksPager",
    statusId: "portalFlocksStatus",
    fetch: (params) => portalApi.getFlocks(params),
    render: renderFlocksTree,
  },
  weeks: {
    permission: "customer.portal.weeks",
    title: "هفته‌های مدیریتی",
    listId: "portalWeeksList",
    pagerId: "portalWeeksPager",
    statusId: "portalWeeksStatus",
    fetch: (params) => portalApi.getWeeks(params),
    render: renderWeeksTree,
  },
  visits: {
    permission: "customer.portal.visits",
    title: "بازدیدها",
    listId: "portalVisitsList",
    pagerId: "portalVisitsPager",
    statusId: "portalVisitsStatus",
    fetch: (params) => portalApi.getVisits(params),
    render: renderVisitList,
  },
};

const TAB_KEYS = Object.keys(SECTION_CONF);

// ✅ ۱۳.۸: تب‌های تازه (پروفایل/داشبورد) هم «تب پورتال»‌اند و باید در
//    همان چرخهٔ پنهان‌سازی/فعال‌سازی بیایند؛ ولی دادهٔ آن‌ها فهرست
//    صفحه‌بندی‌شده نیست، پس پیکربندی‌شان جدا (portal.extra.js) است.
const ALL_TAB_KEYS = [...TAB_KEYS, ...Object.keys(EXTRA_TABS)];

// پیکربندی هر تب: یا فهرست (SECTION_CONF) یا تب خاص (EXTRA_TABS)
const tabConf = (key) => SECTION_CONF[key] || EXTRA_TABS[key] || null;

const LINK_MISSING_MESSAGE =
  "برای مشاهدهٔ اطلاعات پرونده، حساب شما باید به پروندهٔ مشتری متصل شود. لطفاً با مدیر سیستم تماس بگیرید.";

class PortalService {
  constructor() {
    this.initialized = false;
    this.data = null;
    this.state = "idle";
    this._retryBound = false;
    this._tabsBound = false;
    this._detailBound = false;
    this._permBound = false; // ۱۳.۵: شنوندهٔ permissions:applied
    this._loading = false; // ضد درخواست هم‌زمان
    this.detailOpen = false;
    this.activeTab = TAB_KEYS[0];
    this.sections = {};
    TAB_KEYS.forEach((key) => {
      this.sections[key] = {
        loaded: false,
        loading: false,
        page: 1,
        pages: 0,
        total: 0,
        items: [],
      };
    });
    // ✅ ۱۳.۸: وضعیت تب‌های پروفایل/داشبورد
    this.initExtra();
    // ✅ ۱۳.۱۰: وضعیت تب «مدارک من» (بعد از initExtra تا on this.extra بنشیند)
    this.initDocumentsTab();
    // ✅ ۱۳.۱۱: وضعیت تب «درخواست‌های فارم» (همان الگو)
    this.initFarmTab();
    // ✅ ۱۳.۱۷: وضعیت چهار نمای تازه + وضعیت پوستهٔ ناوبری
    this.initViews();
    // ✅ ۱۳.۲۱: وضعیت پنل «ارسال تیکت» (فهرست/گفتگو/پیش‌نویس)
    this.initTickets();
    this.initShell();
  }

  el(id) {
    return typeof document === "undefined" ? null : document.getElementById(id);
  }

  // همهٔ عناصر با یک data-attribute (الگوی امن برای مرورگر و تست)
  all(selector) {
    if (typeof document === "undefined" || !document.querySelectorAll) {
      return [];
    }
    return Array.from(document.querySelectorAll(selector));
  }

  setState(state) {
    this.state = state;
    const root = this.el("portalRoot");
    if (root) root.setAttribute("data-portal-state", state);
  }

  // ===== نقطهٔ ورود (app.service آن را صدا می‌زند) =====
  async init() {
    if (this.initialized) return;
    this.initialized = true;
    this.bindRetry();
    this.bindTabs();
    this.bindDetail();
    this.bindPermissions();
    this.bindExtra();
    // ✅ ۱۳.۱۰: رویدادهای تب «مدارک من» (آپلود/دانلود/حذف)
    this.bindDocuments();
    // ✅ ۱۳.۱۱: رویدادهای شیت «ثبت درخواست» (ثبت/لغو/فیلتر)
    this.bindFarm();
    // ✅ ۱۳.۲۱: باز/بستن شیت درخواست (backdrop/Esc + دکمه‌های ردیف‌ها)
    this.bindRequestSheet();
    // ✅ ۱۳.۱۷: رویدادهای چهار نمای تازه + پوستهٔ ناوبری (hash/drawer)
    this.bindViews();
    // ✅ ۱۳.۲۱: رویدادهای پنل «ارسال تیکت» (فهرست/گفتگو/ارسال)
    this.bindTickets();
    this.bindShell();
    await this.load();
  }

  // ✅ ۱۳.۵: اگر مدیر در همان نشست سطح دسترسی را عوض کرد، کش کلاینت
  //    (permission.service) رویداد permissions:applied می‌دهد و تب‌ها
  //    بدون بارگذاری دوبارهٔ صفحه هم‌راستا می‌شوند.
  bindPermissions() {
    if (this._permBound) return;
    if (typeof document === "undefined" || !document.addEventListener) return;
    this._permBound = true;
    document.addEventListener("permissions:applied", () => {
      if (!this.initialized) return;
      if (this.state === "unlinked" || this.state === "loading") return;
      // «sections» ذخیره‌شده از سرور ممکن است قدیمی شده باشد (مدیر همین
      // حالا کلیدی را باز/بسته کرده) ⇒ خلاصه دوباره خوانده می‌شود تا
      // هم تب‌ها و هم کارت‌های شمارنده هم‌راستا شوند.
      this.load();
    });
  }

  // ===== مجوز «متن گزارش و پیوست» (۱۳.۴) =====
  // ⚠️ گیت UI فقط برای تجربهٔ کاربر است؛ سرور مستقل از آن ۴۰۳ می‌دهد
  //    (customer.portal.visit.report). در نبود دادهٔ مجوز fail-open.
  canViewReport() {
    const service = typeof window !== "undefined" ? window.permissionService : null;
    if (!service || typeof service.can !== "function") return true;
    if (typeof service.hasData === "function" && !service.hasData()) return true;
    return Boolean(service.can("customer.portal.visit.report"));
  }

  // گزینه‌های رندرِ هر بخش (فقط «بازدیدها» گزینه دارد)
  sectionOptions(key) {
    if (key !== "visits") return {};
    return { canViewReport: this.canViewReport() };
  }

  // ===== مجوز «دیدن هر تب» (۱۳.۵) =====
  // منبع اول: پاسخ سرور (/api/portal/me ⇒ data.sections) که همان چیزی
  //   است که سرور واقعاً اجرا می‌کند.
  // منبع دوم (fallback): مجوزهای کلاینت (customer.portal.<tab>).
  // در نبود هر دو ⇒ باز (fail-open) تا خطای شبکه صفحه را خالی نکند.
  canSee(key) {
    const conf = tabConf(key);
    if (!conf) return false;

    const sections = this.data && this.data.sections;
    if (sections && typeof sections[key] === "boolean") return sections[key];

    const service =
      typeof window !== "undefined" ? window.permissionService : null;
    if (!service || typeof service.can !== "function") return true;
    if (typeof service.hasData === "function" && !service.hasData()) return true;
    // ✅ ۱۳.۱۷: پنل‌های چندمسیره (مثل «به‌زودی») با هر یک از کلیدهایشان باز می‌شوند
    if (Array.isArray(conf.permissionAny) && conf.permissionAny.length) {
      return conf.permissionAny.some((token) => Boolean(service.can(token)));
    }
    return Boolean(service.can(conf.permission));
  }

  visibleTabKeys() {
    return ALL_TAB_KEYS.filter((key) => this.canSee(key));
  }

  // تبِ بسته: دکمه و پنل پنهان می‌شود (نه فقط غیرفعال) + اگر همه بسته
  // باشند یک پیام روشن جای کل بلوک تب‌ها می‌آید.
  applyTabVisibility() {
    const visible = this.visibleTabKeys();

    this.all("[data-portal-tab]").forEach((button) => {
      const key = button.getAttribute("data-portal-tab");
      const show = visible.includes(key);
      button.hidden = !show;
      if (!show) button.classList.remove("is-active");
    });

    this.all("[data-portal-panel]").forEach((panel) => {
      if (!visible.includes(panel.getAttribute("data-portal-panel"))) {
        panel.hidden = true;
      }
    });

    const block = this.el("portalFullData");
    if (block) block.hidden = visible.length === 0;

    const notice = this.el("portalTabsNotice");
    if (notice) {
      const closed = ALL_TAB_KEYS.filter((key) => !visible.includes(key));
      if (visible.length === 0) {
        notice.innerHTML = renderNotice(
          "بخش‌های پروندهٔ شما بسته است",
          "همهٔ بخش‌های پرونده (سالن‌ها، گله‌ها، هفته‌ها، بازدیدها، پروفایل و داشبورد) توسط مدیر سیستم بسته شده است. برای فعال‌سازی با مدیر تماس بگیرید.",
          "info",
        );
      } else if (closed.length > 0) {
        notice.innerHTML = renderNotice(
          "برخی بخش‌ها بسته شده است",
          `این بخش‌ها توسط مدیر سیستم بسته شده‌اند: ${closed
            .map((key) => (tabConf(key) || {}).title || key)
            .join("، ")}`,
          "info",
        );
      } else {
        notice.innerHTML = "";
      }
    }

    return visible;
  }

  bindRetry() {
    if (this._retryBound) return;
    const status = this.el("portalStatus");
    if (!status) return;
    this._retryBound = true;
    status.addEventListener("click", (event) => {
      const button = event.target.closest("[data-portal-retry]");
      if (!button) return;
      event.preventDefault();
      this.load();
    });
  }

  // تب‌ها + «نمایش بیشتر» — هر دو فقط GET دیگری می‌فرستند
  bindTabs() {
    if (this._tabsBound) return;
    const tabs = this.el("portalTabs");
    const panels = this.el("portalTabPanels");
    if (!tabs && !panels) return;
    this._tabsBound = true;

    if (tabs) {
      tabs.addEventListener("click", (event) => {
        const button = event.target.closest("[data-portal-tab]");
        if (!button || button.disabled) return;
        // ✅ ۱۳.۱۷: لینک‌های ناوبری (data-portal-route) را پوستهٔ shell
        //    مدیریت می‌کند (hash routing) — این‌جا فقط تب‌های کلاسیک.
        if (button.hasAttribute && button.hasAttribute("data-portal-route")) {
          return;
        }
        event.preventDefault();
        this.activateTab(button.getAttribute("data-portal-tab"));
      });
    }

    if (panels) {
      panels.addEventListener("click", (event) => {
        const button = event.target.closest("[data-portal-more]");
        if (!button || button.disabled) return;
        event.preventDefault();
        this.loadSection(button.getAttribute("data-portal-more"), {
          append: true,
        });
      });
    }
  }

  // ===== ۱۳.۴: پنل جزئیات (هفتهٔ مدیریتی / بازدید) =====
  //  • دکمه‌های «جزئیات» و «دریافت پیوست» با delegation مدیریت می‌شوند
  //  • Esc / کلیک پس‌زمینه / دکمهٔ × ⇒ بستن
  //  ❌ هیچ عملیات نوشتنی در این پنل وجود ندارد
  bindDetail() {
    if (this._detailBound) return;
    const panel = this.el("portalDetail");
    if (!panel) return;
    this._detailBound = true;

    panel.addEventListener("click", (event) => {
      if (event.target.closest("[data-portal-close]")) {
        event.preventDefault();
        this.closeDetail();
        return;
      }

      const attachBtn = event.target.closest("[data-portal-attachment]");
      if (attachBtn) {
        event.preventDefault();
        this.downloadAttachment(
          attachBtn.getAttribute("data-portal-visit"),
          attachBtn.getAttribute("data-portal-attachment"),
          attachBtn.getAttribute("data-portal-name") || "",
        );
      }
    });

    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.detailOpen) this.closeDetail();
      });
    }

    // دکمه‌های «جزئیات» داخل فهرست تب‌ها
    const panels = this.el("portalTabPanels");
    if (panels) {
      panels.addEventListener("click", (event) => {
        const button = event.target.closest("[data-portal-open]");
        if (!button) return;
        event.preventDefault();
        this.openDetail(
          button.getAttribute("data-portal-open"),
          button.getAttribute("data-portal-id"),
        );
      });
    }
  }

  async openDetail(kind, id) {
    const panel = this.el("portalDetail");
    const body = this.el("portalDetailBody");
    const title = this.el("portalDetailTitle");
    if (!panel || !body) return;

    const type = String(kind || "").toLowerCase();
    if (type !== "week" && type !== "visit") return;

    this.detailOpen = true;
    panel.hidden = false;
    panel.classList.add("is-open");
    if (title) {
      title.textContent = type === "week" ? "جزئیات هفتهٔ مدیریتی" : "جزئیات بازدید";
    }
    body.innerHTML = `<p class="portal-detail__loading">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت…
    </p>`;

    try {
      if (type === "week") {
        const payload = await portalApi.getWeekDetail(id);
        body.innerHTML = renderWeekDetail((payload && payload.data && payload.data.week) || {});
      } else {
        const data = (payloadDataOf(await portalApi.getVisitDetail(id)));
        body.innerHTML = renderVisitDetail(data.visit || {}, data.attachments || [], {
          canViewReport: this.canViewReport(),
        });
      }
    } catch (error) {
      body.innerHTML = renderNotice(
        "دریافت جزئیات ناموفق بود",
        this.detailErrorMessage(error),
        "error",
      );
    }
  }

  detailErrorMessage(error) {
    const message = String(error?.message || "").trim();
    if (!message || /^HTTP error/i.test(message)) {
      return "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.";
    }
    return message;
  }

  closeDetail() {
    const panel = this.el("portalDetail");
    const body = this.el("portalDetailBody");
    this.detailOpen = false;
    if (panel) {
      panel.hidden = true;
      panel.classList.remove("is-open");
    }
    if (body) body.innerHTML = "";
  }

  // دانلود پیوست با هدر احراز هویت (هیچ لینک عمومی ساخته نمی‌شود)
  async downloadAttachment(visitId, attachmentId, fileName = "") {
    try {
      await portalApi.downloadAttachment(visitId, attachmentId, fileName || "attachment");
    } catch (error) {
      notificationService.notifyOnce({
        key: "portal-download-error",
        message: `⚠️ ${String(error?.message || "دریافت فایل ناموفق بود")}`,
        type: "error",
        cooldownMs: 15000,
      });
    }
  }

  async load() {
    // ضد درخواست هم‌زمان (رویداد permissions:applied ممکن است وسط
    // بارگذاری اول برسد)
    if (this._loading) return;
    this._loading = true;
    this.setState("loading");

    try {
      const payload = await portalApi.getSummary();
      const data = payload && payload.data ? payload.data : null;

      if (!data || !data.customer) {
        this.renderUnlinked(
          "اطلاعاتی برای نمایش وجود ندارد. اگر پروندهٔ شما تازه ثبت شده است، چند لحظه بعد دوباره تلاش کنید.",
        );
        return;
      }

      this.data = data;
      this.render(data);
      this.setState("ready");
      this.setTabsEnabled(true);
      // ✅ ۱۳.۵: تب‌هایی که مجوزشان بسته است پنهان می‌شوند و درخواستی
      //    نمی‌فرستند؛ تب فعال هم اگر بسته بود به اولین تبِ مجاز می‌رود.
      const visible = this.applyTabVisibility();
      // ✅ ۱۳.۱۷: ناوبری دو لایه — ابتدا منو/زیرمنو هم‌راستا می‌شود،
      //    بعد مسیر فعلی URL (یا اولین مسیر مجاز) فعال می‌شود.
      //    اگر هیچ آیتمی مجاز نبود، همان رفتار ۱۳.۵ (تب اول مجاز).
      const hasMenu = this.applyMenuVisibility();
      if (hasMenu) {
        const hash =
          typeof window !== "undefined" && window.location
            ? window.location.hash
            : "";
        const resolved = this.activateRoute(parseHash(hash) || "");
        if (!resolved) {
          const first = visible.includes(this.activeTab)
            ? this.activeTab
            : visible[0];
          if (first) this.activateTab(first);
        }
        return;
      }
      // تب پیش‌فرض یک‌بار و تنبل بارگذاری می‌شود
      const first = visible.includes(this.activeTab)
        ? this.activeTab
        : visible[0];
      if (first) this.activateTab(first);
    } catch (error) {
      const message = String(error?.message || "");

      // ۴۰۳ «بدون پروندهٔ متصل» ⇒ پیام هدایت‌کننده (نه توست خطا)
      if (LINK_MISSING.test(message)) {
        this.renderUnlinked(LINK_MISSING_MESSAGE);
        return;
      }

      this.setState("error");
      this.renderNoticeBox(
        "دریافت اطلاعات ناموفق بود",
        "ارتباط با سرور برقرار نشد یا داده‌ای برای نمایش آماده نیست.",
        "error",
      );
      notificationService.notifyOnce({
        key: "portal-load-error",
        message: "⚠️ دریافت اطلاعات پورتال ناموفق بود",
        type: "error",
        cooldownMs: 30000,
      });
    } finally {
      this._loading = false;
    }
  }

  // ===== آماده: پر کردن بخش‌ها =====
  render(data) {
    const hero = this.el("portalHero");
    const counters = this.el("portalCounters");
    const flocks = this.el("portalFlocks");
    const weeks = this.el("portalWeeks");
    const visits = this.el("portalVisits");

    if (hero) hero.innerHTML = renderHero(data.customer || {});
    if (counters) counters.innerHTML = renderCounters(data.counters || {});
    if (flocks) flocks.innerHTML = renderFlocks(data.latest?.flocks || []);
    if (weeks) weeks.innerHTML = renderWeeks(data.latest?.weeks || []);
    if (visits) visits.innerHTML = renderVisits(data.latest?.visits || []);

    this.clearStatus();
  }

  // ===== تب‌ها =====
  activateTab(key) {
    if (!tabConf(key) || this.state === "unlinked") return;
    // ۱۳.۵: تبِ بسته حتی اگر با کلیک/کد صدا زده شود بارگذاری نمی‌شود
    if (!this.canSee(key)) return;
    this.activeTab = key;

    this.all("[data-portal-tab]").forEach((button) => {
      const isActive = button.getAttribute("data-portal-tab") === key;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    this.all("[data-portal-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-portal-panel") !== key;
    });

    // ✅ ۱۳.۸: دو تب تازه فهرست صفحه‌بندی‌شده نیستند ⇒ بارگذاری جدا
    if (EXTRA_TABS[key]) {
      if (!this.extra[key].loaded) this.loadExtraTab(key);
      return;
    }

    if (!this.sections[key].loaded) this.loadSection(key);
  }

  // تب‌ها فقط وقتی «پروندهٔ متصل» داریم معنا دارند
  setTabsEnabled(enabled) {
    this.all("[data-portal-tab]").forEach((button) => {
      button.disabled = !enabled;
    });
    const tabs = this.el("portalTabs");
    if (tabs) tabs.hidden = !enabled;
    // ✅ ۱۳.۱۷: کل پوستهٔ ناوبری (سایدبار/drawer) هم پنهان می‌شود
    const nav = this.el("portalNav");
    if (nav) nav.hidden = !enabled;
    const panels = this.el("portalTabPanels");
    if (panels && !enabled) panels.hidden = true;
    if (!enabled) {
      // پیام‌های «در حال دریافت» تبی که هرگز داده نمی‌گیرد پاک شود
      TAB_KEYS.forEach((key) => this.setSectionStatus(key, "ready"));
      Object.keys(EXTRA_TABS).forEach((key) => this.setExtraStatus(key, "ready"));
    }
  }

  async loadSection(key, { append = false } = {}) {
    const conf = SECTION_CONF[key];
    const state = this.sections[key];
    if (!conf || !state || state.loading || this.state === "unlinked") return;
    // ۱۳.۵: تبِ بسته هیچ درخواستی به سرور نمی‌فرستد (ضد سیل ۴۰۳)
    if (!this.canSee(key)) return;

    const page = append ? state.page + 1 : 1;
    state.loading = true;
    this.setSectionStatus(key, "loading");

    try {
      const payload = await conf.fetch({ page, limit: SECTION_LIMIT });
      const data = (payload && payload.data) || {};
      const items = Array.isArray(data.items) ? data.items : [];
      const pagination = data.pagination || {};

      state.items = append ? [...state.items, ...items] : items;
      state.page = Number(pagination.page) || page;
      state.pages = Number(pagination.pages) || 1;
      state.total = Number(pagination.total) || state.items.length;
      state.loaded = true;
      state.loading = false;

      this.renderSection(key);
      this.setSectionStatus(key, "ready");
    } catch (error) {
      state.loading = false;
      state.loaded = true;
      const message = String(error?.message || "");

      if (LINK_MISSING.test(message)) {
        this.renderUnlinked(LINK_MISSING_MESSAGE);
        return;
      }

      this.setSectionStatus(key, "error");
    }
  }

  renderSection(key) {
    const conf = SECTION_CONF[key];
    const state = this.sections[key];
    if (!conf || !state) return;

    const list = this.el(conf.listId);
    const pager = this.el(conf.pagerId);

    if (list) list.innerHTML = conf.render(state.items, this.sectionOptions(key));
    if (pager) {
      pager.innerHTML = renderPager(
        { page: state.page, pages: state.pages, total: state.total },
        key,
      );
    }

    // ۱۳.۴: نمودار روند وزن فقط در تب «هفته‌های مدیریتی»
    if (key === "weeks") this.renderChart(state.items);
  }

  // نمودار SVG از همان دادهٔ صفحه (بدون درخواست اضافه)
  renderChart(items) {
    const box = this.el("portalChart");
    if (!box) return;
    box.innerHTML = renderWeeklyChart(items);
  }

  setSectionStatus(key, status) {
    const conf = SECTION_CONF[key];
    const box = conf ? this.el(conf.statusId) : null;
    if (!box) return;

    if (status === "loading") {
      box.innerHTML = `<span class="portal-tab__loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> در حال دریافت…</span>`;
      return;
    }

    if (status === "error") {
      box.innerHTML = renderNotice(
        "دریافت این بخش ناموفق بود",
        "ارتباط با سرور برقرار نشد. سایر بخش‌های پورتال در دسترس هستند.",
        "error",
      );
      return;
    }

    box.innerHTML = "";
  }

  // ===== حساب بدون پروندهٔ متصل =====
  renderUnlinked(message) {
    this.setState("unlinked");
    this.setTabsEnabled(false);
    this.renderNoticeBox(
      "حساب شما به پروندهٔ مشتری متصل نشده است",
      message,
      "info",
    );
  }

  renderNoticeBox(title, message, type) {
    const status = this.el("portalStatus");
    const content = this.el("portalContent");

    if (status) {
      status.innerHTML =
        renderNotice(title, message, type) +
        (type === "error"
          ? `<button type="button" class="portal-retry" data-portal-retry>
               <i class="fas fa-rotate-right"></i> تلاش دوباره
             </button>`
          : "");
    }
    if (content) content.style.display = "none";
  }

  clearStatus() {
    const status = this.el("portalStatus");
    const content = this.el("portalContent");
    if (status) status.innerHTML = "";
    if (content) content.style.display = "";
  }
}

// ✅ ۱۳.۸: متدهای تب‌های «پروفایل من» و «داشبورد تحلیلی» پیش از ساخت نمونه
//    روی prototype سوار می‌شوند (Object.assign در portal.extra.js).
applyPortalExtra(PortalService);

// ✅ ۱۳.۱۰: متدهای تب «مدارک من» بعد از portal.extra سوار می‌شوند تا
//    loadExtraTab این فایل بتواند نسخهٔ portal.extra.js را واگذار کند.
applyPortalDocuments(PortalService);

// ✅ ۱۳.۱۱: متدهای تب «درخواست‌های فارم» آخر از همه سوار می‌شوند تا
//    loadExtraTab آن بتواند نسخهٔ لایه‌های قبلی (مدارک/پروفایل/داشبورد)
//    را واگذاری کند.
applyPortalFarm(PortalService);

// ✅ ۱۳.۱۷: نماهای خواندنی تازه، *بعد* از فارم سوار می‌شوند تا
//    loadExtraTab این فایل بتواند نسخهٔ فارم را واگذار کند.
applyPortalViews(PortalService);

// ✅ ۱۳.۲۱: پنل «ارسال تیکت» بعد از views سوار می‌شود تا
//    loadExtraTab آن بتواند loadTicketsView را واگذار کند.
applyPortalTickets(PortalService);

// ✅ ۱۳.۱۷: پوستهٔ ناوبری آخرین mixin — فقط activateRoute،
//    applyMenuVisibility و مدیریت drawer/hash را اضافه می‌کند.
applyPortalShell(PortalService);

export const portalService = new PortalService();

if (typeof window !== "undefined") {
  window.portalService = portalService;
  window.PortalService = portalService;
}
