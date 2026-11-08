// ============================================================
// sw.js — Service Worker «عبوری» پورتال مشتری (موج ۱۳.۸)
// ------------------------------------------------------------
//  چرا؟ برای «نصب‌پذیری» (Add to Home Screen) مرورگر به یک
//  service worker با شنوندهٔ fetch نیاز دارد. این فایل عمداً **هیچ
//  چیزی کش نمی‌کند**:
//   • پورتال دادهٔ پروندهٔ مشتری است؛ کش‌شدن HTML/JSON یعنی دیدن
//     دادهٔ قدیمی (یا دادهٔ کاربر قبلی روی دستگاه مشترک) ⇒ ممنوع.
//   • هیچ پاسخ API کش نمی‌شود و هیچ درخواستی از کش پاسخ نمی‌گیرد؛
//     هر درخواست مثل قبل به شبکه می‌رود.
//   • تنها کار آن: فعال‌شدن فوری و کنترل صفحه‌های باز.
//  🔒 اگر روزی کش آفلاین لازم شد، فقط برای دارایی‌های ثابت
//     (/styles، /assets، /vendor) و با نسخه‌بندی صریح — هرگز برای
//     درخواست‌های API و هرگز برای صفحات.
// ============================================================
"use strict";

const SW_VERSION = "skb-portal-13.8.0";

self.addEventListener("install", (event) => {
  // بدون precache: هیچ فایلی در نصب ذخیره نمی‌شود
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // پاک‌سازی کش‌های نسخه‌های قبل (اگر روزی اضافه شوند)
      if (self.caches) {
        const keys = await self.caches.keys();
        await Promise.all(
          keys.filter((key) => key !== SW_VERSION).map((key) => self.caches.delete(key)),
        );
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // عبور کامل: هیچ event.respondWith ⇒ پاسخ همیشه از شبکه می‌آید.
  // وجود همین شنونده برای «نصب‌پذیری» کافی است.
  void event.request;
});
