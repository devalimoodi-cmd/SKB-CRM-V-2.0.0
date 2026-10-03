// ============================================================
// core/services/theme.service.js
// «تم روشن/تیره» — تک‌منبع حقیقت در کلاینت
// ------------------------------------------------------------
// • ذخیره‌سازی محلی: localStorage["skb_theme"]  (light | dark | system)
// • اعمال روی <html data-theme="...">  → CSS در global.css از آن پیروی می‌کند
// • حالت «system» از prefers-color-scheme پیروی می‌کند و زنده به‌روز می‌شود
// • همگام‌سازی بین تب‌ها با رویداد storage
//
// ⚠️ بک‌استرپِ بدون فلاش در server.js (قبل از CSS) همین کلید را می‌خواند؛
//    این ماژول فقط برای تغییر تم در زمان اجرا (صفحهٔ تنظیمات) است.
// ============================================================

const STORAGE_KEY = "skb_theme";
const VALID = ["light", "dark", "system"];
const DEFAULT_THEME = "system";

export const themeService = {
  _listeners: [],
  _mediaBound: false,
  _storageBound: false,
  _mq: null,

  // ===== خواندن مقدار انتخاب‌شده (−۱۰ به‌جای «روشن/تیره» از حالت system جدا) =====
  getTheme() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return VALID.includes(value) ? value : DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  },

  // تبدیل انتخاب کاربر به تم مؤثر (light | dark)
  resolve(theme) {
    const chosen = VALID.includes(theme) ? theme : DEFAULT_THEME;
    if (chosen === "dark") return "dark";
    if (chosen === "light") return "light";
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  },

  // تم مؤثر فعلی (اعم از system)
  currentResolved() {
    return this.resolve(this.getTheme());
  },

  // ===== اعمال روی <html> =====
  apply(theme) {
    const resolved = this.resolve(theme);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", resolved);
    }
    this._bindSystemListener();
    return resolved;
  },

  // ===== تغییر تم + ذخیرهٔ محلی =====
  setTheme(theme, { persist = true } = {}) {
    const value = VALID.includes(theme) ? theme : DEFAULT_THEME;
    if (persist) {
      try {
        localStorage.setItem(STORAGE_KEY, value);
      } catch {
        /* حالت خصوصی مرورگر */
      }
    }
    const resolved = this.apply(value);
    this._emit();
    return resolved;
  },

  // ===== راه‌اندازی اولیه (صفحه‌هایی که ماژول را لود می‌کنند) =====
  init() {
    const resolved = this.apply(this.getTheme());
    this._bindStorageListener();
    return resolved;
  },

  // ===== اشتراک تغییرات =====
  onChange(callback) {
    if (typeof callback !== "function") return () => {};
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter((cb) => cb !== callback);
    };
  },

  _emit() {
    const theme = this.getTheme();
    const resolved = this.currentResolved();
    this._listeners.forEach((cb) => {
      try {
        cb(theme, resolved);
      } catch {
        /* بی‌صدا */
      }
    });
  },

  _bindSystemListener() {
    if (this._mediaBound || typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    this._mediaBound = true;
    this._mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (this.getTheme() === "system") {
        this.apply("system");
        this._emit();
      }
    };
    if (this._mq.addEventListener) this._mq.addEventListener("change", handler);
    else if (this._mq.addListener) this._mq.addListener(handler);
  },

  _bindStorageListener() {
    if (typeof window === "undefined" || this._storageBound) return;
    this._storageBound = true;
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY) return;
      this.apply(this.getTheme());
      this._emit();
    });
  },
};

if (typeof window !== "undefined") {
  window.themeService = themeService;
}
