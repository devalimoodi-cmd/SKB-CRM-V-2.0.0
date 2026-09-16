// ============================================================
// features/whats-new/whats-new.service.js
// «تغییرات جدید / What's New» — سمت کاربر
// ------------------------------------------------------------
// رفتار:
//  • بعد از ورود، یک‌بار بررسی می‌کند: «آخرین نسخهٔ منتشرشده‌ای که
//    کاربر ندیده» وجود دارد؟ → مودال را نشان می‌دهد.
//  • «متوجه شدم» → در دیتابیس ثبت می‌شود و دیگر نمایش داده نمی‌شود.
//  • «دیگر نشان نده» (تیک) → برای همان نسخه، برای همیشه.
//  • بستن با ESC/کلیک بیرون → فقط در همین نشست پنهان می‌شود
//    (پیام با ورود بعدی دوباره نمایش داده می‌شود تا واقعاً به اطلاع برسد).
//  • بج هدر = تعداد نسخه‌های منتشرشده‌ای که کاربر ندیده است.
// ============================================================
import { whatsNewApi } from "./whats-new.api.js";
import { renderModal } from "./whats-new.renderer.js";
import { authService } from "../../core/services/auth.service.js";

const CHECK_DELAY_MS = 1500;
const SESSION_PREFIX = "skb_wn_closed_";

class WhatsNewService {
  constructor() {
    this.initialized = false;
    this.release = null;
    this.overlay = null;
    this.modal = null;
    this.unseenCount = 0;
    this.bound = false;
  }

  // ===== راه‌اندازی (از header.service صدا زده می‌شود) =====
  async init() {
    if (this.initialized) return;
    // ✅ گارد ضد اجرای دوبارهٔ ماژول (درسِ باگ دوبار اجرا)
    if (typeof window !== "undefined") {
      if (window.__skbWhatsNewInit) return;
      window.__skbWhatsNewInit = true;
    }
    this.initialized = true;

    this.overlay = document.getElementById("whatsNewOverlay");
    this.modal = document.getElementById("whatsNewModal");

    // صفحه‌ای که مودال را ندارد (مثل ورود) → بی‌صدا رها کن
    if (!this.overlay || !this.modal) return;

    this.bindEvents();
    await this.refreshBadge();

    window.setTimeout(() => this.autoCheck(), CHECK_DELAY_MS);
  }

  bindEvents() {
    if (this.bound) return;
    this.bound = true;

    this.overlay.addEventListener("click", (event) => {
      // کلیک بیرون از مودال → بستن (فقط این نشست)
      if (event.target === this.overlay) {
        this.hide({ rememberInSession: true });
        return;
      }

      const actionEl = event.target.closest("[data-wn-action]");
      if (!actionEl) return;

      const action = actionEl.dataset.wnAction;
      if (action === "close") {
        this.hide({ rememberInSession: true });
      } else if (action === "confirm") {
        this.confirm();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.isOpen()) {
        this.hide({ rememberInSession: true });
      }
    });
  }

  isOpen() {
    return Boolean(this.overlay?.classList.contains("show"));
  }

  // ===== بررسی خودکار: نسخهٔ دیده‌نشده هست؟ =====
  async autoCheck() {
    if (!authService.getToken()) return;

    try {
      const response = await whatsNewApi.getUnseen();
      const release = response?.data?.release || null;
      if (!release) return;
      if (!(release.items || []).length) return;

      // در همین نشست قبلاً بسته شده؟ → دوباره وسط کار مزاحم نشو
      if (this.wasClosedInSession(release.id)) return;

      this.show(release);
    } catch (error) {
      // سرور/شبکه در دسترس نیست → صفحهٔ کاربر نباید خطا بدهد
      console.warn("⚠️ بررسی تغییرات جدید انجام نشد:", error?.message || error);
    }
  }

  // ===== نمایش مودال =====
  show(release) {
    if (!release || !this.modal) return;

    this.release = release;
    this.modal.innerHTML = renderModal(release, { mode: "user" });
    this.overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  // ===== بستن مودال =====
  hide({ rememberInSession = false } = {}) {
    const id = this.release?.id;

    // اگر تیک «دیگر نشان نده» زده شده باشد، بستن هم یعنی «نشان نده»
    const check = this.modal?.querySelector("[data-wn-dont-show]");
    const dismissForever = Boolean(check?.checked);

    this.overlay?.classList.remove("show");
    document.body.style.overflow = "";

    if (id && (rememberInSession || dismissForever)) {
      this.rememberClosedInSession(id);
    }

    if (id && dismissForever) {
      this.commitSeen(id, true);
    }

    this.release = null;
  }

  // ===== «متوجه شدم» =====
  async confirm() {
    const id = this.release?.id;
    const check = this.modal?.querySelector("[data-wn-dont-show]");
    const dismissForever = Boolean(check?.checked);

    this.overlay?.classList.remove("show");
    document.body.style.overflow = "";
    this.release = null;

    if (id) this.commitSeen(id, dismissForever);
  }

  // ثبت در دیتابیس (بدون بلاک‌کردن رابط کاربری)
  commitSeen(id, dontShowAgain) {
    whatsNewApi
      .markSeen(id, dontShowAgain)
      .then(() => this.refreshBadge())
      .catch((error) => {
        console.warn("⚠️ ثبت بازدید تغییرات ناموفق بود:", error?.message || error);
      });
  }

  // ===== بج هدر =====
  async refreshBadge() {
    if (!authService.getToken()) {
      this.setBadge(0);
      return 0;
    }

    try {
      const response = await whatsNewApi.getHistory();
      this.unseenCount = Number(response?.data?.unseen_count || 0);
    } catch {
      this.unseenCount = 0;
    }

    this.setBadge(this.unseenCount);
    return this.unseenCount;
  }

  setBadge(count) {
    this.unseenCount = Number(count) || 0;
    const el = document.getElementById("whatsNewCount");
    if (!el) return;
    el.textContent = String(this.unseenCount);
    el.style.display = this.unseenCount > 0 ? "" : "none";
  }

  // ===== دکمهٔ هدر: نمایش تغییرات =====
  async open() {
    // ۱) نسخهٔ دیده‌نشده
    try {
      const response = await whatsNewApi.getUnseen();
      const release = response?.data?.release || null;
      if (release) {
        this.show(release);
        return;
      }
    } catch (error) {
      console.warn("⚠️ دریافت تغییرات ناموفق بود:", error?.message || error);
    }

    // ۲) در غیر این صورت: آخرین نسخهٔ منتشرشده از تاریخچه
    try {
      const history = await whatsNewApi.getHistory();
      const latest = (history?.data?.items || [])[0] || null;
      if (latest) {
        this.show(latest);
        return;
      }
    } catch (error) {
      console.warn("⚠️ دریافت تاریخچهٔ تغییرات ناموفق بود:", error?.message || error);
    }

    // ۳) هیچ نسخه‌ای برای این کاربر نیست
    this.renderEmpty();
  }

  renderEmpty() {
    if (!this.modal) return;
    this.release = null;
    this.modal.innerHTML = renderModal(
      { version: "—", title: "تغییرات جدید", description: "", items: [] },
      { mode: "user", emptyText: "هنوز تغییرات منتشرشده‌ای برای نمایش وجود ندارد" },
    );
    // در حالت خالی، دکمهٔ «متوجه شدم» لازم نیست
    this.modal
      .querySelectorAll('[data-wn-action="confirm"]')
      .forEach((btn) => (btn.disabled = true));
    this.overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  // ===== ابزار کمکی: نشست جاری =====
  wasClosedInSession(id) {
    try {
      return sessionStorage.getItem(`${SESSION_PREFIX}${id}`) === "1";
    } catch {
      return false;
    }
  }

  rememberClosedInSession(id) {
    try {
      sessionStorage.setItem(`${SESSION_PREFIX}${id}`, "1");
    } catch {
      /* حالت خصوصی مرورگر */
    }
  }
}

export const whatsNewService = new WhatsNewService();

// ===== دسترسی سراسری (مثل بقیهٔ سرویس‌ها) =====
if (typeof window !== "undefined") {
  window.whatsNewService = whatsNewService;
  window.WhatsNew = {
    show: (release) => whatsNewService.show(release),
    open: () => whatsNewService.open(),
    check: () => whatsNewService.autoCheck(),
  };
}
