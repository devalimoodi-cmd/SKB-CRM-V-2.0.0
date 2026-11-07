// ============================================================
// features/portal/portal.service.js
// سرویس «پورتال مشتری» — فقط خواندن (فاز ۱۳.۲)
// ------------------------------------------------------------
// حالت‌ها:  loading → ready | unlinked | error
//  • unlinked: حساب مشتری به پروندهٔ متصل نیست (۴۰۳ با کد
//    CUSTOMER_LINK_MISSING) ⇒ پیام روشن، بدون خطای خشک
//  • error:    شبکه/سرور ⇒ پیام یک‌باره + دکمهٔ «تلاش دوباره»
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
} from "./portal.renderer.js";
import { notificationService } from "../../core/services/notification.service.js";

// پیام ۴۰۳ِ «بدون پروندهٔ متصل» از سرور همین عبارت را دارد
const LINK_MISSING = /متصل نشده است/;

class PortalService {
  constructor() {
    this.initialized = false;
    this.data = null;
    this.state = "idle";
    this._retryBound = false;
  }

  el(id) {
    return typeof document === "undefined" ? null : document.getElementById(id);
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
    } catch (error) {
      const message = String(error?.message || "");

      // ۴۰۳ «بدون پروندهٔ متصل» ⇒ پیام هدایت‌کننده (نه توست خطا)
      if (LINK_MISSING.test(message)) {
        this.renderUnlinked(
          "برای مشاهدهٔ اطلاعات پرونده، حساب شما باید به پروندهٔ مشتری متصل شود. لطفاً با مدیر سیستم تماس بگیرید.",
        );
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

  // ===== حساب بدون پروندهٔ متصل =====
  renderUnlinked(message) {
    this.setState("unlinked");
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
