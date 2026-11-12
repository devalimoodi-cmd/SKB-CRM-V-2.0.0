// ============================================================
// core/services/pwa.service.js — راه‌اندازی یکپارچهٔ PWA (موج ۱۳.۲۴)
// ------------------------------------------------------------
//  چرا این ماژول؟
//   پیش از این، تگ‌های PWA فقط در portal.html بودند و ثبت service
//   worker هم فقط در همان صفحه (به‌صورت درون‌خطی) انجام می‌شد.
//   نتیجه: کاربری که روی /login بود نه manifest داشت، نه آیکون
//   اپل‌تاک، نه service worker ⇒ مرورگر هرگز رویداد
//   `beforeinstallprompt` را نمی‌فرستاد و «افزودن به صفحهٔ اصلی»
//   هیچ‌وقت پیشنهاد نمی‌شد.
//
//  🔒 سه قاعده:
//   ۱) هیچ دادهٔ مشتری کش نمی‌شود (منطق کش در sw.js است و همان
//      قاعدهٔ ۱۳.۸/۱۳.۹ را نگه می‌دارد: فقط /offline.html).
//   ۲) افزودن تگ‌ها **idempotent** است: اگر صفحه خودش تگ را دارد
//      (مثل portal.html) تکراری ساخته نمی‌شود.
//   ۳) همهٔ خطاها بی‌صدا/با console.info رد می‌شوند؛ نبود PWA
//      نباید هیچ صفحه‌ای را بشکند.
//
//  استفاده:
//    <script type="module" src="/core/services/pwa.service.js"></script>
//    (خودش روی DOMContentLoaded راه می‌افتد)
// ============================================================

const PWA_MANIFEST_HREF = "/manifest.webmanifest";
const PWA_SW_URL = "/sw.js";
const PWA_SW_SCOPE = "/";
const PWA_THEME_COLOR = "#2c7a6e";
const PWA_APPLE_ICON = "/assets/images/pwa/apple-touch-icon-180.png";
const PWA_APPLE_TITLE = "پورتال SKB";

// تگ‌هایی که برای «نصب‌پذیری» لازم‌اند (اگر صفحه نداشته باشد اضافه می‌شوند)
const HEAD_TAGS = [
  { tag: "link", attrs: { rel: "manifest", href: PWA_MANIFEST_HREF } },
  { tag: "meta", attrs: { name: "theme-color", content: PWA_THEME_COLOR } },
  {
    tag: "meta",
    attrs: { name: "apple-mobile-web-app-capable", content: "yes" },
  },
  {
    tag: "meta",
    attrs: { name: "apple-mobile-web-app-title", content: PWA_APPLE_TITLE },
  },
  { tag: "link", attrs: { rel: "apple-touch-icon", href: PWA_APPLE_ICON } },
];

let started = false;
let installBound = false;
let swRegistering = null;
let installPrompt = null;

// ============================================================
// ۱) تگ‌های <head> (فقط اگر نبودند)
// ============================================================
const hasTag = (doc, spec) => {
  const attrs = spec.attrs || {};
  if (spec.tag === "link") {
    if (!attrs.rel) return false;
    return Boolean(doc.querySelector(`link[rel="${attrs.rel}"]`));
  }
  if (spec.tag === "meta") {
    if (!attrs.name) return false;
    return Boolean(doc.querySelector(`meta[name="${attrs.name}"]`));
  }
  return false;
};

const ensureHeadLinks = (doc = typeof document === "undefined" ? null : document) => {
  if (!doc || !doc.head) return 0;

  let added = 0;
  HEAD_TAGS.forEach((spec) => {
    if (hasTag(doc, spec)) return;
    const element = doc.createElement(spec.tag);
    Object.keys(spec.attrs).forEach((key) => {
      element.setAttribute(key, spec.attrs[key]);
    });
    doc.head.appendChild(element);
    added += 1;
  });
  return added;
};


// ============================================================
// ۲) ثبت service worker (یک‌بار)
// ------------------------------------------------------------
// 🔒 scope را صریح «/» می‌دهیم؛ خود فایل هم در ریشه سرو می‌شود و
//    هدر Service-Worker-Allowed: / را دارد (Frontend/server.js).
// ============================================================
const registerServiceWorker = () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  if (swRegistering) return swRegistering;

  swRegistering = navigator.serviceWorker
    .register(PWA_SW_URL, { scope: PWA_SW_SCOPE })
    .catch((error) => {
      // سایت روی HTTP غیرلوکال یا مرورگر بدون پشتیبانی ⇒ بی‌خطر رد شو
      console.info(
        "ℹ️ service worker ثبت نشد (صفحه بدون PWA کار می‌کند)",
        error && error.message,
      );
      return null;
    });

  return swRegistering;
};

// ============================================================
// ۳) رویداد نصب (فقط نگه‌داشتن؛ UI با خود صفحه‌هاست)
// ------------------------------------------------------------
// 🔒 preventDefault می‌کنیم تا نوار پیش‌فرض مرورگر ظاهر نشود؛
//    هر صفحه می‌تواند با رویداد `skb:install-available` دکمه‌اش را
//    باز کند و با window.__skbInstallPrompt.prompt() بپرسد.
//    (پورتال نوار خودش را در portal.extra.js دارد — ۱۳.۹)
// ============================================================
const bindInstallPrompt = () => {
  if (installBound) return;
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return;
  }
  installBound = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    window.__skbInstallPrompt = event;
    try {
      window.dispatchEvent(new CustomEvent("skb:install-available"));
    } catch {
      /* CustomEvent در دسترس نیست — بی‌صدا */
    }
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    window.__skbInstallPrompt = null;
    try {
      window.dispatchEvent(new CustomEvent("skb:installed"));
    } catch {
      /* بی‌صدا */
    }
  });
};

// ============================================================
// ۴) راه‌اندازی
// ------------------------------------------------------------
// options.register = false ⇒ فقط تگ‌های head (صفحه‌هایی که خودشان
// service worker را ثبت می‌کنند، مثل portal.html).
// ============================================================
const initPwa = (options = {}) => {
  if (typeof document === "undefined") return false;
  if (started) return true;
  started = true;

  ensureHeadLinks(document);
  bindInstallPrompt();

  if (options.register === false) return true;

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    if (document.readyState === "complete") registerServiceWorker();
    else window.addEventListener("load", registerServiceWorker, { once: true });
  } else {
    registerServiceWorker();
  }

  return true;
};

// ============================================================
// ۵) اجرای خودکار
// ============================================================
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initPwa(), { once: true });
  } else {
    initPwa();
  }
}

export const pwaService = {
  init: initPwa,
  ensureHeadLinks,
  registerServiceWorker,
  isInstallAvailable: () => Boolean(installPrompt),
  getInstallPrompt: () => installPrompt,
};

export { initPwa, ensureHeadLinks, registerServiceWorker };
