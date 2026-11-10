// ============================================================
// features/portal/portal.shell.js
// پوستهٔ ناوبری پورتال مشتری — موج ۱۳.۱۷
// ------------------------------------------------------------
//  چه می‌کند؟
//   • ناوبری «منو + زیرمنو» را با حقوق هر آیتم هم‌راستا می‌کند
//     (لایهٔ منو + لایهٔ محتوا + پاسخ sections سرور).
//   • hash routing: #/<menu>/<item> → پنل مربوطه (بدون reload).
//   • drawer موبایل: همبرگری / backdrop / Esc / بستن پس از هر مسیر.
//   • Back/Forward مرورگر کار می‌کند (hashchange).
//
//  🔒 قواعد:
//   ۱) مسیر فقط از فهرست سفید portal.menu.js؛ هیچ شناسه‌ای از URL
//      خوانده نمی‌شود (ضد IDOR). عمق > ۲ بخش ⇒ fallback.
//   ۲) «کش قدیمی مجوزها» (کاربری که صفحه‌اش قبل از دیپلوی باز بوده)
//      باعث «منوی خالی» نمی‌شود: اگر هیچ کلید customer.portal.menu.*
//      شناخته نشود، با کلید محتوا قضاوت می‌کنیم (menuFallbackMode).
//   ۳) هیچ نوشتن/درخواستی در این فایل نیست؛ فقط ناوبری.
// ============================================================
import {
  DEFAULT_PORTAL_ROUTE,
  PORTAL_MENUS,
  PORTAL_ROUTES,
  PORTAL_ROUTE_LIST,
  normalizeHash,
  parseHash,
  resolveRoute,
  routeTitle,
} from "./portal.menu.js";

// همهٔ ردیف‌های مسیر (یک‌بار)
const ROUTE_ENTRIES = PORTAL_ROUTE_LIST.map((route) => PORTAL_ROUTES[route]);

// ============================================================
// mixin — روی PortalService.prototype سوار می‌شود
// ============================================================
export const portalShellMixin = {
  // ===== وضعیت ناوبری =====
  initShell() {
    this.navOpen = false;
    this.activeRoute = "";
    this.routeEntry = null;
    this._shellBound = false;
  },

  allRoutes() {
    return ROUTE_ENTRIES;
  },

  // ===== آیا کاربر مجوز کلاینت را دارد؟ (fail-open مثل canSee) =====
  canPermissionToken(key) {
    if (!key) return true;
    return Boolean(this.canPermission(key));
  },

  // «کش قدیمی»: هیچ کلید منویی در مجوزهای فعلی نیست
  //  ⇒ کاربر صفحه را قبل از دیپلوی ۱۳.۱۷ باز کرده و کلیدها را نمی‌داند.
  menuFallbackMode() {
    const service = typeof window !== "undefined" ? window.permissionService : null;
    if (!service || typeof service.can !== "function") return true;
    if (typeof service.hasData === "function" && !service.hasData()) return true;
    return !ROUTE_ENTRIES.some((entry) => entry.key && service.can(entry.key));
  },

  // ===== تصمیم دیده‌شدن یک آیتم (دو لایه + پاسخ سرور) =====
  menuAllowed(entry) {
    if (!entry) return false;

    // ۱) لایهٔ محتوا: همان کلیدی که سرور ۴۰۳ می‌دهد
    if (entry.contentKey && !this.canPermissionToken(entry.contentKey)) {
      return false;
    }

    // ۲) پنل مقصد باید برای این کاربر باز باشد (sections سرور / canSee)
    if (!this.canSee(entry.panel)) return false;

    // ۳) لایهٔ منو
    if (!entry.key) return true;

    const service = typeof window !== "undefined" ? window.permissionService : null;
    if (!service || typeof service.can !== "function") return true;
    if (typeof service.hasData === "function" && !service.hasData()) return true;
    if (service.can(entry.key)) return true;

    // کلید منو ناشناخته ⇒ کش قدیمی ⇒ با کلید محتوا قضاوت شد (بالا)
    return this.menuFallbackMode();
  },

  // ===== اعمال مجوز روی DOM ناوبری =====
  applyMenuVisibility() {
    const nav = this.el("portalNav");
    const list = this.el("portalTabs");
    const fallback = this.menuFallbackMode();

    // کش قدیمی: اثر data-permission (که کلید تازه را نمی‌شناسد) پاک شود
    if (fallback) {
      this.all("[data-portal-route]").forEach((node) => {
        if (node.style) node.style.display = "";
      });
    }

    let visibleLinks = 0;
    this.all("[data-portal-route]").forEach((node) => {
      const route = node.getAttribute("data-portal-route");
      const entry = PORTAL_ROUTES[route];
      const show = Boolean(entry) && this.menuAllowed(entry);
      node.hidden = !show;
      if (show) visibleLinks += 1;
      else {
        node.classList.remove("is-active");
        node.removeAttribute("aria-current");
      }
    });

    // منویی که همهٔ آیتم‌هایش بسته است، خودش هم پنهان می‌شود
    PORTAL_MENUS.forEach((menu) => {
      const item = list
        ? Array.from(list.querySelectorAll("[data-portal-menu]")).find(
            (node) => node.getAttribute("data-portal-menu") === menu.id,
          )
        : null;
      if (!item) return;
      const anyVisible = Array.from(
        item.querySelectorAll("[data-portal-route]"),
      ).some((node) => !node.hidden);
      item.hidden = !anyVisible;
    });

    if (nav) nav.hidden = visibleLinks === 0;

    const notice = this.el("portalTabsNotice");
    if (notice && visibleLinks === 0) {
      notice.innerHTML = `<div class="portal-notice portal-notice--info" role="status">
        <i class="fas fa-lock" aria-hidden="true"></i>
        <div>
          <div class="portal-notice__title">هیچ بخشی برای شما باز نیست</div>
          <div class="portal-notice__text">
            همهٔ بخش‌های پورتال توسط مدیر سیستم بسته شده است. برای فعال‌سازی با مدیر تماس بگیرید.
          </div>
        </div>
      </div>`;
    }

    return visibleLinks > 0;
  },

  // ===== هم‌راستاسازی ظاهر منو با مسیر فعال =====
  syncNav(route) {
    const entry = PORTAL_ROUTES[route] || null;
    this.activeRoute = route;
    this.routeEntry = entry;

    this.all("[data-portal-route]").forEach((node) => {
      const isActive = node.getAttribute("data-portal-route") === route;
      node.classList.toggle("is-active", isActive);
      if (isActive) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
    });

    // آکاردئون: منوی فعال باز می‌ماند
    const list = this.el("portalTabs");
    if (list) {
      Array.from(list.querySelectorAll("[data-portal-menu]")).forEach((node) => {
        const id = node.getAttribute("data-portal-menu");
        node.classList.toggle("is-open", Boolean(entry && entry.menuId === id));
      });
    }

    const current = this.el("portalNavCurrent");
    if (current) current.textContent = entry ? entry.label : "";

    if (typeof document !== "undefined") {
      document.title = `${routeTitle(route)} | پورتال SKB`;
    }
  },

  // ===== پیمایش به یک مسیر (hash) =====
  goToRoute(route) {
    const target = parseHash(route) || DEFAULT_PORTAL_ROUTE;
    if (typeof window === "undefined") return this.activateRoute(target);

    const currentHash = normalizeHash(window.location.hash);
    if (currentHash === target) {
      // همان مسیر: بدون ورودی تاریخچه، فقط دوباره فعال کن
      return this.activateRoute(target);
    }

    window.location.hash = target;
    return target;
  },

  // ===== فعال‌سازی مسیر (قلب پوسته) =====
  activateRoute(rawRoute) {
    if (this.state === "unlinked") return "";

    const resolved = resolveRoute(rawRoute, (entry) => this.menuAllowed(entry));
    if (!resolved) return "";

    const entry = PORTAL_ROUTES[resolved];
    if (!entry) return "";

    // هم‌راستاسازی URL: مسیر ناشناخته/ریشهٔ alias با replaceState اصلاح می‌شود
    if (typeof window !== "undefined" && window.history && window.history.replaceState) {
      if (normalizeHash(window.location.hash) !== resolved) {
        window.history.replaceState(null, "", resolved);
      }
    }

    this.routeEntry = entry;
    this.activeRoute = resolved;

    // پنل مقصد (بارگذاری تنبل همان‌جا انجام می‌شود)
    this.activateTab(entry.panel);

    // بازنمایی مسیر داخل پنل‌های چندبخشی (جزئیات سالن / به‌زودی / دوره‌ها)
    if (typeof this.applyRouteView === "function") this.applyRouteView(entry);

    this.syncNav(resolved);
    this.closeNav();
    this.scrollToRoute(entry);
    return resolved;
  },

  // اسکرول به لنگر/فوکوس همان مسیر (اگر نبود، بالای محتوا)
  scrollToRoute(entry) {
    if (typeof document === "undefined") return;
    const id = (entry && (entry.anchor || entry.focus)) || "";
    const scroll = () => {
      const target = id ? this.el(id) : null;
      const node = target || this.el("portalMain");
      if (!node || typeof node.scrollIntoView !== "function") return;
      try {
        node.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (error) {
        return void error;
      }
    };
    if (typeof window !== "undefined" && window.setTimeout) {
      window.setTimeout(scroll, 40);
      return;
    }
    scroll();
  },

  // ===== drawer موبایل =====
  setNavOpen(open) {
    this.navOpen = Boolean(open);
    const panel = this.el("portalNavPanel");
    const backdrop = this.el("portalNavBackdrop");
    const toggle = this.el("portalNavToggle");

    if (panel) panel.classList.toggle("is-open", this.navOpen);
    if (backdrop) backdrop.hidden = !this.navOpen;
    if (toggle) toggle.setAttribute("aria-expanded", this.navOpen ? "true" : "false");

    if (typeof document !== "undefined" && document.body) {
      document.body.classList.toggle("portal-nav-open", this.navOpen);
    }
    return this.navOpen;
  },

  openNav() {
    return this.setNavOpen(true);
  },

  closeNav() {
    return this.setNavOpen(false);
  },

  toggleNav() {
    return this.setNavOpen(!this.navOpen);
  },

  // ===== اتصال رویدادها (یک‌بار) =====
  bindShell() {
    if (this._shellBound) return;
    if (typeof document === "undefined" || !document.addEventListener) return;
    this._shellBound = true;

    const toggle = this.el("portalNavToggle");
    if (toggle) toggle.addEventListener("click", () => this.toggleNav());

    const backdrop = this.el("portalNavBackdrop");
    if (backdrop) backdrop.addEventListener("click", () => this.closeNav());

    const list = this.el("portalTabs");
    if (list) {
      // هر لینک: data-portal-route (native hash هم کار می‌کند؛ ولی
      // preventDefault می‌کنیم تا کلیک روی مسیر فعلی «بستن drawer» را
      // هم انجام دهد و ورودی تاریخچهٔ تکراری نسازد)
      list.addEventListener("click", (event) => {
        const link = event.target.closest("[data-portal-route]");
        if (!link) return null;
        event.preventDefault();
        return this.goToRoute(link.getAttribute("data-portal-route"));
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" && event.key !== "Esc") return null;
      if (!this.navOpen) return null;
      event.preventDefault();
      return this.closeNav();
    });

    if (typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("hashchange", () => {
        if (!this.initialized) return;
        if (this.state === "unlinked" || this.state === "loading") return;
        this.activateRoute(window.location.hash || "");
      });
    }
  },
};

// متدهای این فایل روی PortalService.prototype سوار می‌شوند
// ⚠️ ترتیب: آخرین mixin (بعد از views/farm/documents/extra) — چون
//    load/activateTab را فقط «تکمیل» می‌کند و loadExtraTab را دست نمی‌زند.
export const applyPortalShell = (ServiceClass) => {
  Object.assign(ServiceClass.prototype, portalShellMixin);
};
