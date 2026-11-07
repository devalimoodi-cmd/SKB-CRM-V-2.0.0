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
  renderHallList,
  renderFlockList,
  renderWeekList,
  renderVisitList,
  renderPager,
} from "./portal.renderer.js";
import { notificationService } from "../../core/services/notification.service.js";

// پیام ۴۰۳ِ «بدون پروندهٔ متصل» از سرور همین عبارت را دارد
const LINK_MISSING = /متصل نشده است/;

// اندازهٔ صفحهٔ هر تب (سرور سقف ۵۰ می‌گذارد)
const SECTION_LIMIT = 20;

// پیکربندی چهار بخش دادهٔ کامل — کلید = مقدار data-portal-tab در HTML
const SECTION_CONF = {
  halls: {
    listId: "portalHallsList",
    pagerId: "portalHallsPager",
    statusId: "portalHallsStatus",
    fetch: (params) => portalApi.getHalls(params),
    render: renderHallList,
  },
  flocks: {
    listId: "portalFlocksList",
    pagerId: "portalFlocksPager",
    statusId: "portalFlocksStatus",
    fetch: (params) => portalApi.getFlocks(params),
    render: renderFlockList,
  },
  weeks: {
    listId: "portalWeeksList",
    pagerId: "portalWeeksPager",
    statusId: "portalWeeksStatus",
    fetch: (params) => portalApi.getWeeks(params),
    render: renderWeekList,
  },
  visits: {
    listId: "portalVisitsList",
    pagerId: "portalVisitsPager",
    statusId: "portalVisitsStatus",
    fetch: (params) => portalApi.getVisits(params),
    render: renderVisitList,
  },
};

const TAB_KEYS = Object.keys(SECTION_CONF);

const LINK_MISSING_MESSAGE =
  "برای مشاهدهٔ اطلاعات پرونده، حساب شما باید به پروندهٔ مشتری متصل شود. لطفاً با مدیر سیستم تماس بگیرید.";

class PortalService {
  constructor() {
    this.initialized = false;
    this.data = null;
    this.state = "idle";
    this._retryBound = false;
    this._tabsBound = false;
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
    await this.load();
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

  async load() {
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
      // تب پیش‌فرض یک‌بار و تنبل بارگذاری می‌شود
      this.activateTab(this.activeTab || TAB_KEYS[0]);
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
    if (!SECTION_CONF[key] || this.state === "unlinked") return;
    this.activeTab = key;

    this.all("[data-portal-tab]").forEach((button) => {
      const isActive = button.getAttribute("data-portal-tab") === key;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    this.all("[data-portal-panel]").forEach((panel) => {
      panel.hidden = panel.getAttribute("data-portal-panel") !== key;
    });

    if (!this.sections[key].loaded) this.loadSection(key);
  }

  // تب‌ها فقط وقتی «پروندهٔ متصل» داریم معنا دارند
  setTabsEnabled(enabled) {
    this.all("[data-portal-tab]").forEach((button) => {
      button.disabled = !enabled;
    });
    const tabs = this.el("portalTabs");
    if (tabs) tabs.hidden = !enabled;
    const panels = this.el("portalTabPanels");
    if (panels && !enabled) panels.hidden = true;
    if (!enabled) {
      // پیام‌های «در حال دریافت» تبی که هرگز داده نمی‌گیرد پاک شود
      TAB_KEYS.forEach((key) => this.setSectionStatus(key, "ready"));
    }
  }

  async loadSection(key, { append = false } = {}) {
    const conf = SECTION_CONF[key];
    const state = this.sections[key];
    if (!conf || !state || state.loading || this.state === "unlinked") return;

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

    if (list) list.innerHTML = conf.render(state.items);
    if (pager) {
      pager.innerHTML = renderPager(
        { page: state.page, pages: state.pages, total: state.total },
        key,
      );
    }
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

export const portalService = new PortalService();

if (typeof window !== "undefined") {
  window.portalService = portalService;
  window.PortalService = portalService;
}
