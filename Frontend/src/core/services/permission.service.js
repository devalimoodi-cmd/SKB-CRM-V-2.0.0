// ============================================================
// core/services/permission.service.js
// «سطوح دسترسی» در فرانت‌اند
// ------------------------------------------------------------
// • منبع داده: GET /api/permissions/me  (مجوزهای کاربر جاری)
// • کش در حافظه + localStorage تا هر صفحه دوباره درخواست نزند
// • can("halls.delete")      → آیا کاربر جاری این مجوز را دارد؟
// • applyGuards()            → مخفی‌کردن المنان‌های data-permission
// • refresh()                → بعد از تغییر سطح دسترسی، دوباره بخوان
//
// ⚠️ مخفی‌کردن در UI فقط «تجربهٔ کاربری» است؛ کنترل واقعی همیشه
//     سمت سرور (middleware/permissions.js) انجام می‌شود.
// ============================================================
import { apiService } from "./api.service.js";
import { API_CONSTANTS } from "../constants/api.const.js";
import { authService } from "./auth.service.js";
import { notificationService } from "./notification.service.js";

const STORAGE_KEY = "skb_permissions";
// ✅ کش کلاینت کوتاه است تا تغییرات پنل مدیریت سریع دیده شود؛
//    «تازه‌بودن» با نسخهٔ سرور (/permissions/version) بررسی می‌شود.
const TTL_MS = 60 * 1000; // ۶۰ ثانیه
// حداقل فاصلهٔ دو بررسی نسخه (که سیل درخواست ایجاد نشود)
const VERSION_CHECK_MIN_MS = 30 * 1000;
// ضدتکرار پیام «دسترسی بسته است» (۳۰ ثانیه)
const DENIED_COOLDOWN_MS = 30 * 1000;

class PermissionService {
  constructor() {
    this.permissions = null; // Set<string>
    this.role = null;
    this.enforced = false;
    this.loadedAt = 0;
    this.loading = null;
    this.version = null; // نسخهٔ مجوزها (از سرور)
    this.lastVersionCheck = 0;
    this.autoRefreshInstalled = false;
    // ✅ key → عنوان فارسی، برای کلیدهایی که کاربر «ندارد»
    //    (سرور در /permissions/me می‌فرستد) — پایهٔ پیام‌های «دسترسی بسته است»
    this.deniedTitles = {};
    this.roleTitle = null; // عنوان فارسی نقش (مثلاً «کارشناس») برای پیام‌ها
    this._deniedRefreshing = false; // ضدحلقهٔ تازه‌سازی پس از ۴۰۳
  }

  // آیا دادهٔ مجوزها در دسترس است؟
  hasData() {
    return this.permissions instanceof Set;
  }

  // ===== خواندن از localStorage (برای صفحات بعدی) =====
  _fromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.permissions)) return null;
      if (Date.now() - (parsed.at || 0) > TTL_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  _persist() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          at: this.loadedAt,
          role: this.role,
          version: this.version,
          permissions: Array.from(this.permissions || []),
          deniedTitles: this.deniedTitles || {},
          roleTitle: this.roleTitle,
        }),
      );
    } catch {
      /* حافظه در دسترس نیست */
    }
  }

  _applyPayload(payload) {
    this.permissions = new Set(payload.permissions || []);
    this.role = payload.role || null;
    this.enforced = !!payload.enforced;
    this.version = payload.version ?? null;
    this.deniedTitles = payload.deniedTitles || {};
    this.roleTitle = payload.roleTitle || null;
    this.loadedAt = Date.now();
    this.lastVersionCheck = this.loadedAt;
    this._persist();
  }

  // ===== بارگذاری (با کش) =====
  async load({ force = false } = {}) {
    if (!authService.isLoggedIn()) {
      this.permissions = new Set();
      this.deniedTitles = {};
      return this.permissions;
    }

    if (!force) {
      if (this.permissions && Date.now() - this.loadedAt < TTL_MS) {
        return this.permissions;
      }
      const cached = this._fromStorage();
      if (cached) {
        this.permissions = new Set(cached.permissions);
        this.role = cached.role || null;
        this.version = cached.version ?? null;
        this.deniedTitles = cached.deniedTitles || {};
        this.roleTitle = cached.roleTitle || null;
        this.loadedAt = cached.at;
        return this.permissions;
      }
    }

    if (this.loading) return this.loading;

    this.loading = (async () => {
      try {
        const response = await apiService.get(API_CONSTANTS.ENDPOINTS.PERMISSIONS.ME);
        if (response?.success) {
          this._applyPayload(response.data);
        } else {
          this.permissions = new Set();
        }
      } catch (error) {
        console.warn("⚠️ دریافت سطوح دسترسی ناموفق بود:", error?.message || error);
        this.permissions = new Set();
      } finally {
        this.loading = null;
      }
      return this.permissions;
    })();

    return this.loading;
  }

  async refresh() {
    await this.load({ force: true });
    this.applyGuards(document);
    return this.permissions;
  }

  // ============================================================
  // ✅ تازه‌سازی هوشمند (سبک)
  // ------------------------------------------------------------
  // • اگر کش جوان‌تر از maxAgeMs باشد: هیچ درخواستی نمی‌زنیم.
  // • اگر داده نداریم: واکشی کامل.
  // • وگرنه: فقط «نسخهٔ» سرور را می‌پرسیم (JSON کوچک)؛
  //   اگر عوض شده بود، واکشی کامل + اعمال مجدد گیت‌ها.
  // ============================================================
  async ensureFresh({ maxAgeMs = TTL_MS } = {}) {
    if (!authService.isLoggedIn()) return this.permissions;

    const age = Date.now() - this.loadedAt;

    if (!this.hasData()) return this.load({ force: true });
    if (age < maxAgeMs) return this.permissions;

    // نگذاریم پشت سر هم درخواست نسخه بزنیم
    if (Date.now() - this.lastVersionCheck < VERSION_CHECK_MIN_MS) {
      return this.permissions;
    }
    this.lastVersionCheck = Date.now();

    try {
      const response = await apiService.get(
        API_CONSTANTS.ENDPOINTS.PERMISSIONS.VERSION,
      );
      const remote = response?.data?.version;

      const changed =
        response?.success &&
        remote != null &&
        this.version != null &&
        String(remote) !== String(this.version);

      if (changed) return this.load({ force: true });

      // نسخه یکسان ⇒ فقط عمر کش را تمدید کن (بدون واکشی سنگین)
      this.loadedAt = Date.now();
      this._persist();
      return this.permissions;
    } catch {
      // خطای شبکه ⇒ همان کش قبلی معتبر است
      return this.permissions;
    }
  }

  // ============================================================
  // ✅ تازه‌سازی خودکار در مرورگر
  //    • برگشت به تب (visibilitychange) و فوکوس پنجره
  //      → اگر کش قدیمی باشد، ensureFresh + اعمال مجدد گیت‌ها
  // ============================================================
  installAutoRefresh() {
    if (this.autoRefreshInstalled || typeof document === "undefined") return;
    this.autoRefreshInstalled = true;

    const check = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        await this.ensureFresh();
        this.applyGuards(document);
        // ✅ به صفحاتی که می‌خواهند بعد از تغییر گیت‌ها هم‌راستا شوند اطلاع بده
        document.dispatchEvent(new CustomEvent("permissions:applied"));
      } catch {
        /* بی‌صدا */
      }
    };

    document.addEventListener("visibilitychange", check);
    if (typeof window !== "undefined") window.addEventListener("focus", check);
  }

  // ============================================================
  // ✅ پیام «دسترسی بسته است» (۴۰۳ سرور)
  // ------------------------------------------------------------
  // سیاست کم‌مزاحمتی:
  //  • فقط یک توست کوتاه (notifyOnce) با ضدتکرار ۳۰ ثانیه
  //  • سپس مجوزها تازه می‌شوند تا منو/دکمهٔ مربوطه همان لحظه مخفی شود
  //    (پایان تلاش‌های تکراری + حل مشکل کش قدیمی)
  //  • اگر خطا از خود /permissions/me باشد، این متد صدا زده نمی‌شود (ضدحلقه)
  // ============================================================
  handleForbidden(payload = {}) {
    const required = Array.isArray(payload?.required) ? payload.required : [];
    const titles = Array.isArray(payload?.requiredTitles)
      ? payload.requiredTitles
      : [];
    const key = required[0] || "unknown";
    const title = titles[0] || this.titleOf(key);

    notificationService.notifyOnce({
      key: `perm-denied:${key}`,
      message: title
        ? `⛔ دسترسی «${title}» برای نقش شما بسته است`
        : "⛔ برای این عملیات دسترسی ندارید",
      type: "error",
      cooldownMs: DENIED_COOLDOWN_MS,
    });

    this.syncAfterDenied();
    return { key, title, required };
  }

  // تازه‌سازی مجوزها و اعمال مجدد گیت‌ها پس از ۴۰۳
  syncAfterDenied() {
    if (this._deniedRefreshing) return;
    this._deniedRefreshing = true;

    void this.load({ force: true })
      .then(() => {
        if (typeof document === "undefined") return;
        this.applyGuards(document);
        document.dispatchEvent(new CustomEvent("permissions:applied"));
      })
      .catch(() => {
        /* بی‌صدا */
      })
      .finally(() => {
        this._deniedRefreshing = false;
      });
  }

  // ============================================================
  // ✅ کارت inline «این بخش برای نقش شما بسته است»
  // ------------------------------------------------------------
  // در بخش/تبی که کاربر به آن دسترسی ندارد، جای محتوا نشان داده می‌شود
  // و اگر بعداً دسترسی داده شد، با clearDeniedNotice برمی‌گردد.
  // ============================================================
  titleOf(key) {
    if (!key) return "";
    return this.deniedTitles?.[key] || "";
  }

  _escape(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  _resolveEl(target) {
    if (!target) return null;
    if (typeof target === "string") {
      return typeof document !== "undefined"
        ? document.getElementById(target)
        : null;
    }
    return target;
  }

  deniedNoticeHtml(key, extraText = "") {
    const title = this.titleOf(key);
    return `
        <i class="fas fa-lock"></i>
        <p>این بخش برای نقش شما غیرفعال شده است${title ? ` («${this._escape(title)}»)` : ""}.</p>
        ${extraText ? `<p class="perm-denied-hint">${this._escape(extraText)}</p>` : ""}
        <p class="perm-denied-code">کلید دسترسی: ${this._escape(key || "-")}</p>`;
  }

  renderDeniedNotice(container, key, extraText = "") {
    const el = this._resolveEl(container);
    if (!el) return null;

    let box = el.querySelector("[data-perm-denied-box]");
    if (!box) {
      box = document.createElement("div");
      box.className = "perm-denied-box";
      box.setAttribute("data-perm-denied-box", key || "1");
      el.insertBefore(box, el.firstChild);

      // محتوای بخش پنهان می‌شود (قابل بازگردانی)
      Array.from(el.children).forEach((child) => {
        if (child === box) return;
        if (child.style && child.style.display !== "none") {
          child.setAttribute(
            "data-perm-denied-display",
            child.style.display || "",
          );
          child.style.display = "none";
        }
      });
    }

    box.innerHTML = this.deniedNoticeHtml(key, extraText);
    return box;
  }

  clearDeniedNotice(container) {
    const el = this._resolveEl(container);
    if (!el) return;

    el.querySelector("[data-perm-denied-box]")?.remove();
    Array.from(el.children).forEach((child) => {
      const saved = child.getAttribute?.("data-perm-denied-display");
      if (saved === null || saved === undefined) return;
      child.style.display = saved;
      child.removeAttribute("data-perm-denied-display");
    });
  }

  // ===== بررسی مجوز =====
  // نکته: مدیر اصلی همیشه «بله» است (هم‌سو با بک‌اند)
  can(key) {
    if (!key) return true;
    if (this.role === "super_admin") return true;
    if (!this.permissions) return false;
    return this.permissions.has(key);
  }

  canAny(keys = []) {
    if (!keys.length) return true;
    return keys.some((key) => this.can(key));
  }

  canAll(keys = []) {
    return keys.every((key) => this.can(key));
  }

  // ===== پاک‌کردن کش (هنگام خروج یا تغییر دسترسی) =====
  clear() {
    this.permissions = null;
    this.role = null;
    this.deniedTitles = {};
    this.roleTitle = null;
    this.loadedAt = 0;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* بی‌صدا */
    }
  }

  // ============================================================
  // گیت‌های UI
  // ------------------------------------------------------------
  // ۱) هر المنتی که data-permission="key" دارد:
  //     data-permission-mode = "hide" (پیش‌فرض) | "disable"
  // ۲) هر المنتی که data-permission-any="k1,k2" دارد: با داشتن یکی
  // ۳) اگر مجوز نباشد و data-permission-fallback="#selector" باشد،
  //    آن المنت نمایش داده می‌شود (مثلاً پیام «دسترسی ندارید»)
  // ============================================================
  applyGuards(root = document) {
    // ✅ ضدِ «ناپدیدشدن همه‌چیز»: اگر دادهٔ مجوزها در دسترس نیست
    //    (خطای شبکه/کاربر تازه) هیچ المنتی مخفی نمی‌شود تا پنل خالی نشود.
    if (!this.hasData()) return;

    root
      .querySelectorAll("[data-permission], [data-permission-any]")
      .forEach((el) => {
        const single = el.getAttribute("data-permission");
        const any = el.getAttribute("data-permission-any");
        const allowed = single
          ? this.can(single)
          : this.canAny(
              String(any || "")
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            );

        const mode = el.getAttribute("data-permission-mode") || "hide";
        const fallbackSelector = el.getAttribute("data-permission-fallback");
        const fallback = fallbackSelector
          ? root.querySelector(fallbackSelector)
          : null;

        if (allowed) {
          if (mode === "hide") el.style.display = "";
          else {
            el.classList.remove("is-disabled");
            el.removeAttribute("disabled");
          }
          return;
        }

        if (mode === "hide") el.style.display = "none";
        else {
          el.classList.add("is-disabled");
          el.setAttribute("disabled", "disabled");
        }
        if (fallback) fallback.style.display = "";
      });
  }
}

export const permissionService = new PermissionService();

if (typeof window !== "undefined") {
  window.permissionService = permissionService;
}
