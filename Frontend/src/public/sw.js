// ============================================================
// sw.js — Service Worker پورتال مشتری (موج ۱۳.۸ · تکمیل در ۱۳.۹)
// ------------------------------------------------------------
//  چرا؟ برای «نصب‌پذیری» (Add to Home Screen) مرورگر به یک
//  service worker با شنوندهٔ fetch نیاز دارد.
//
//  🔒 قاعدهٔ داده (همان قاعدهٔ ۱۳.۸، بدون استثنا):
//   • هیچ پاسخ API و هیچ صفحهٔ پورتال کش نمی‌شود؛ پورتال دادهٔ
//     پروندهٔ مشتری است و کش‌شدن HTML/JSON یعنی دیدن دادهٔ قدیمی
//     (یا دادهٔ کاربر قبلی روی دستگاه مشترک) ⇒ ممنوع.
//   • فقط و فقط «یک» فایل precache می‌شود: /offline.html — پوستهٔ
//     خودبسندهٔ «اتصال قطع است» — و آن هم تنها زمانی تحویل داده
//     می‌شود که ناوبری از شبکه شکست بخورد.
//
//  ⛔ چرا دارایی‌های ثابت (styles/assets/vendor/features) کش نمی‌شوند؟
//   • CSS و اسکریپت‌های کلاسیک در Frontend/server.js به‌صورت
//     خودکار با ?v=<ASSET_VERSION> نسخه‌دار می‌شوند ⇒ لایهٔ HTTP
//     خودش تازگی را تضمین می‌کند و کش SW سودی اضافه ندارد.
//   • ماژول‌های ES نسخه‌دار نمی‌شوند (URL ماژول را نباید تغییر داد)؛
//     کش‌کردنشان یعنی «کد کهنه» بعد از استقرار.
//   • پس: هر درخواست هم‌مبدأِ غیرناوبری کامل به شبکه واگذار می‌شود.
//
//  ⚠️ محدودیت‌های شناخته‌شده (مستند، نه باگ):
//   • فقط GET ناوبری می‌تواند پوستهٔ آفلاین بگیرد؛ بقیهٔ درخواست‌ها
//     در حالت آفلاین مثل قبل شکست می‌خورند (پیام خطای خود پورتال).
// ============================================================
"use strict";

const SW_VERSION = "13.9.0";
// 🔒 نام کش از نسخه ساخته می‌شود ⇒ هر نسخهٔ تازه کش تازه دارد و
//    نسخهٔ قبلی در activate پاک می‌شود.
const SHELL_CACHE = `skb-shell-${SW_VERSION}`;
// 🔒 فقط یک قلم؛ افزودن هر فایل HTML/JSON دیگر یعنی نقض قاعدهٔ داده.
const SHELL_ASSETS = ["/offline.html"];
const OFFLINE_URL = "/offline.html";

// ============================================================
// نصب: precache پوستهٔ آفلاین + فعال‌سازی فوری نسخهٔ تازه
// ============================================================
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (self.caches) {
        const cache = await self.caches.open(SHELL_CACHE);
        // addAll اتمیک است: اگر همین یک فایل نیاید، نصب شکست می‌خورد
        // و نسخهٔ سالم قبلی دست‌نخورده می‌ماند.
        await cache.addAll(SHELL_ASSETS);
      }
      await self.skipWaiting();
    })(),
  );
});

// ============================================================
// فعال‌سازی: حذف کش نسخه‌های قبل + کنترل صفحه‌های باز
// ============================================================
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      if (self.caches) {
        const keys = await self.caches.keys();
        await Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE)
            .map((key) => self.caches.delete(key)),
        );
      }
      await self.clients.claim();
    })(),
  );
});

// ============================================================
// fetch: فهرست سفید صریح — پیش‌فرض «عبور کامل به شبکه»
// ------------------------------------------------------------
// ترتیب بررسی‌ها مهم است؛ هر شرطی که برقرار شد، تصمیم همان است.
// ============================================================
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // ۱) هیچ نوشتنی از service worker نمی‌گذرد (POST/PUT/PATCH/DELETE)
  if (request.method !== "GET") return;

  let url = null;
  try {
    url = new URL(request.url);
  } catch (error) {
    return void error;
  }

  // ۲) درخواست هم‌مبدأ نیست (مثلاً API روی پورت دیگر) ⇒ عبور کامل
  if (url.origin !== self.location.origin) return;

  // ۳) API هرگز کش نمی‌شود و هرگز از SW پاسخ نمی‌گیرد
  if (url.pathname.startsWith("/api/")) return;

  // ۴) JS/CSS/تصویر/فونت و ... ⇒ عبور کامل، بدون کش
  //    (به جز ناوبری که تنها استثنای این فایل است)
  if (request.mode !== "navigate") return;

  // ۵) ناوبری: شبکه اول؛ فقط اگر شبکه شکست خورد پوستهٔ آفلاین
  event.respondWith(
    (async () => {
      try {
        return await fetch(request);
      } catch (error) {
        const cached = self.caches
          ? await self.caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })
          : null;
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
