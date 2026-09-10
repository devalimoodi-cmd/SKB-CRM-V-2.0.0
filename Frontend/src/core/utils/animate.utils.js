// ================================================================
// animate.utils.js
// ابزارهای انیمیشن رابط کاربری (شمارنده عددی و ...)
// ================================================================

// نرم‌سازی حرکت (خروج نرم)
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

// آخرین مقدار هدفی که برای هر عنصر انیمیت شده (جلوگیری از اجرای تکراری)
const lastTargets = new WeakMap();

// آیا عنصر همین حالا داخل دید کاربر است؟
function isInViewport(el) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  return rect.bottom > 0 && rect.top < vh && rect.right > 0 && rect.left < vw;
}

/**
 * انیمیشن شمارندهٔ عددی روی یک عنصر؛ از مقدار «کم» تا مقدار هدف می‌شمارد.
 *
 * @param {HTMLElement} el عنصر مقصد (اگر null باشد بدون خطا کاری نمی‌کند)
 * @param {number|string} targetValue مقدار نهایی
 * @param {Object} [options]
 * @param {number} [options.duration=1400] مدت انیمیشن به میلی‌ثانیه
 * @param {number} [options.from=0] مقدار شروع
 * @param {boolean} [options.animateWhenVisible=true] اگر عنصر در دید نیست، هنگام دیده‌شدن انیمیت شود
 * @param {(v:number)=>string} [options.formatter] قالب‌بندی متن (پیش‌فرض: عدد صحیح)
 * @returns {void}
 */
export function animateCounter(el, targetValue, options = {}) {
  if (!el || typeof el.textContent === "undefined") return;
  if (typeof document === "undefined") return;

  const target = Number(targetValue) || 0;

  // اگر برای همین عنصر قبلاً همین مقدار تنظیم شده، دوباره انیمیت نکن
  if (lastTargets.get(el) === target) return;
  lastTargets.set(el, target);

  const duration = options.duration ?? 1400;
  const from = options.from ?? 0;
  const animateWhenVisible = options.animateWhenVisible !== false;
  const format =
    typeof options.formatter === "function"
      ? options.formatter
      : (v) => String(Math.round(v));

  // لغو انیمیشن/ناظر قبلی روی همین عنصر
  if (el._counterRAF && typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(el._counterRAF);
    el._counterRAF = null;
  }
  if (el._counterObserver) {
    el._counterObserver.disconnect();
    el._counterObserver = null;
  }

  // پشتیبانی نشدن requestAnimationFrame: مستقیم مقدار نهایی گذاشته شود
  if (typeof requestAnimationFrame !== "function") {
    el.textContent = format(target);
    return;
  }

  const run = () => {
    const start = performance.now();
    el.textContent = format(from);

    const tick = (now) => {
      const progress = Math.min(Math.max((now - start) / duration, 0), 1);
      const eased = easeOutCubic(progress);
      el.textContent = format(from + (target - from) * eased);
      if (progress < 1) {
        el._counterRAF = requestAnimationFrame(tick);
      } else {
        el.textContent = format(target);
        el._counterRAF = null;
      }
    };

    el._counterRAF = requestAnimationFrame(tick);
  };

  // اگر انیمیشن-هنگام-دید خواسته نشده یا عنصر در دید است، همین حالا اجرا کن
  if (
    !animateWhenVisible ||
    typeof IntersectionObserver === "undefined" ||
    isInViewport(el)
  ) {
    run();
    return;
  }

  // عنصر در دید نیست: با رسیدن به دید، انیمیشن اجرا شود
  el.textContent = format(from);
  el._counterObserver = new IntersectionObserver(
    (entries, observer) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        el._counterObserver = null;
        run();
      }
    },
    { threshold: 0.2 },
  );
  el._counterObserver.observe(el);
}
