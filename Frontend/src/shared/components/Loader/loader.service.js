// ============================================================
// shared/components/Loader/loader.service.js
// سرویس واحد «لودر سیستمی» — همهٔ لودرهای برنامه پیرو انتخاب ادمین
// هستند (پنل ادمین → تنظیمات سیستم → لودر سیستمی: classic | logo)
// ------------------------------------------------------------
// نحوهٔ استفاده:
//   ۱) استاتیک در HTML:
//        <span data-skb-loader data-skb-loader-text="در حال بارگذاری..."></span>
//      (خودکار پر میشود — نیازی به کد نیست)
//   ۲) داینامیک در JS:
//        container.innerHTML = await loaderService.inline({ text, size });
//   ۳) پیش‌نمایش حالت دیگر (پنل ادمین):
//        loaderService.inline({ style: "logo", size: "preview" })
//
// ⚠️ منبع مارک‌آپ: همان shared/components/Loader/loader.html
//    (تنها یک‌بار fetch و کش میشود؛ فقط واریانت انتخاب‌شده استفاده می‌شود)
// ============================================================

const MARKUP_URL = "/shared/components/Loader/loader.html";
const DEFAULT_TEXT = "در حال بارگذاری...";
const DEFAULT_SIZE = "md";

let markupPromise = null;

const loadMarkup = () => {
  if (!markupPromise) {
    markupPromise = fetch(MARKUP_URL)
      .then((response) => (response.ok ? response.text() : ""))
      .catch(() => "");
  }
  return markupPromise;
};

export const loaderService = {
  // حالت انتخاب‌شدهٔ سیستم (سرور آن را روی <html data-loader="..."> می‌گذارد)
  currentStyle() {
    const value = document.documentElement?.dataset?.loader;
    return value === "logo" ? "logo" : "classic";
  },

  // مارک‌آپ لودر انتخاب‌شده (برای درج در HTML)
  // options: { text, size: "sm" | "md" | "preview" | "full", style }
  async inline({ text = DEFAULT_TEXT, size = DEFAULT_SIZE, style } = {}) {
    const markup = await loadMarkup();
    if (!markup) return ""; // فایل مارک‌آپ در دسترس نیست → خالی برگردان

    const wanted = style === "logo" || style === "classic" ? style : this.currentStyle();

    try {
      const doc = new DOMParser().parseFromString(markup, "text/html");
      const node = doc.querySelector(`.skb-loader--${wanted}`);
      if (!node) return "";

      node.classList.add("skb-loader--force-show");
      if (size && size !== "full") node.classList.add(`skb-loader--${size}`);

      const textEl = node.querySelector(".skb-loader-text");
      if (textEl) textEl.textContent = text;

      return node.outerHTML;
    } catch {
      return "";
    }
  },

  // پر کردن همهٔ placeholderهای [data-skb-loader] داخل یک ریشه
  async hydrate(root = document) {
    const hosts = root.querySelectorAll?.("[data-skb-loader]") || [];
    for (const host of hosts) {
      if (host.dataset.skbLoaderReady === "1") continue;

      host.dataset.skbLoaderReady = "1";
      host.classList.add("skb-loader-host");

      const markup = await this.inline({
        text: host.dataset.skbLoaderText || DEFAULT_TEXT,
        size: host.dataset.skbLoaderSize || DEFAULT_SIZE,
        style: host.dataset.skbLoaderStyle || undefined,
      });

      host.innerHTML = markup;
    }
    return hosts.length;
  },
};

// ===== راه‌اندازی خودکار =====
if (typeof document !== "undefined") {
  const boot = () => {
    loaderService.hydrate();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // ✅ لودرهایی که بعداً (داینامیک) به صفحه اضافه می‌شوند هم خودکار پر می‌شوند
  if (typeof MutationObserver !== "undefined" && document.body) {
    const observer = new MutationObserver((mutations) => {
      const hasNewHost = mutations.some((mutation) =>
        Array.from(mutation.addedNodes || []).some(
          (node) =>
            node.nodeType === 1 &&
            (node.matches?.("[data-skb-loader]") ||
              node.querySelector?.("[data-skb-loader]")),
        ),
      );
      if (hasNewHost) loaderService.hydrate();
    });

    const startObserver = () =>
      observer.observe(document.body, { childList: true, subtree: true });

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserver);
    } else {
      startObserver();
    }
  }
}

// ===== در دسترس سراسری (برای دیباگ/فراخوانی از HTML) =====
if (typeof window !== "undefined") {
  window.loaderService = loaderService;
}
