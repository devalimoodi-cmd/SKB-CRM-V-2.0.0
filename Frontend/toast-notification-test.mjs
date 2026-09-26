// ============================================================
//  تست «توست کم‌مزاحمت» (notificationService.notifyOnce)
//  اجرا:  npm run test:toast      (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ طبق سیاست پروژه، پیام‌های خطای کاربر نباید مزاحم باشند.
//  این تست (بدون نیاز به مرورگر/سرور) تضمین می‌کند:
//   ۱) پیام‌ها فقط «توست» می‌سازند (هیچ مودال/دکمه‌ای)
//   ۲) پیام تکراری در بازهٔ cooldown دوباره نمایش داده نمی‌شود
//   ۳) سقف نرخ رعایت می‌شود (پیش‌فرض: ۳ پیام در دقیقه)
//   ۴) اگر پیام/مودالی باز باشد، پیام جدید صف می‌شود (یک پیام در لحظه)
//   ۵) با ?debug=1 یا localStorage.skb_user_toasts="off" هیچ توستی نمی‌آید
// ============================================================
import { notificationService } from "./src/core/services/notification.service.js";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// ===== شبیه‌ساز حداقلی مرورگر: Swal / window / localStorage =====
const fired = [];
const allFired = [];
let visible = false;

globalThis.Swal = {
  fire(options) {
    fired.push(options);
    allFired.push(options);
    visible = true;
    // توست‌های واقعی با timer خودبسته می‌شوند
    if (options.timer) setTimeout(() => (visible = false), 10);
    return Promise.resolve({ isConfirmed: false });
  },
  isVisible: () => visible,
  close: () => {
    visible = false;
  },
};

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { location: { search: "" } };

// ===== ریست وضعیت داخلی سرویس (تا تست‌ها به هم وابسته نباشند) =====
const reset = () => {
  notificationService._recentKeys.clear();
  notificationService._recentTimes.length = 0;
  notificationService._pendingToast = null;
  if (notificationService._flushTimer) {
    clearTimeout(notificationService._flushTimer);
    notificationService._flushTimer = null;
  }
  fired.length = 0;
  visible = false;
};

const svc = notificationService;

// ===== ۱) پیام خطا → توست (نه مودال) =====
reset();
const firedFirst = svc.notifyOnce({
  key: "t1",
  message: "تغییر وضعیت ذخیره نشد",
  type: "error",
});
check(
  "پیام خطا به‌صورت توست نمایش داده می‌شود (بدون دکمه)",
  firedFirst === true &&
    fired.length === 1 &&
    fired[0].toast === true &&
    fired[0].showConfirmButton === false &&
    fired[0].icon === "error" &&
    fired[0].title === "تغییر وضعیت ذخیره نشد",
  `fired=${fired.length} icon=${fired[0]?.icon} toast=${fired[0]?.toast}`,
);

// ===== ۲) ضدتکرار (cooldown) =====
reset();
svc.notifyOnce({ key: "dup", message: "پیام تکراری" });
const dupSecond = svc.notifyOnce({ key: "dup", message: "پیام تکراری" });
check(
  "پیام تکراری در بازهٔ ۳۰ ثانیه دوباره نمایش داده نمی‌شود",
  fired.length === 1 && dupSecond === false,
  `fired=${fired.length}`,
);

// ===== ۳) سقف نرخ: حداکثر ۳ پیام در دقیقه =====
reset();
["a", "b", "c", "d"].forEach((k) => {
  visible = false; // شبیه‌سازی بسته‌شدن توست قبلی
  svc.notifyOnce({ key: `rate-${k}`, message: `پیام ${k}`, cooldownMs: 0 });
});
check(
  "سقف نرخ: پیام چهارم در همان دقیقه نمایش داده نمی‌شود",
  fired.length === 3,
  `fired=${fired.length}`,
);

// ===== ۴) یک پیام در لحظه: صف‌شدن وقتی مودال/توست دیگری باز است =====
reset();
visible = true; // مثلاً کاربر وسط تکمیل یک فرم مودالی است
const queued = svc.notifyOnce({ key: "q1", message: "پیام صف‌شده" });
check(
  "اگر پیام/مودالی باز باشد، پیام جدید فوراً نمایش داده نمی‌شود",
  queued === false && fired.length === 0,
  `fired=${fired.length}`,
);

// ===== ۵) تخلیهٔ صف بعد از بسته‌شدن پیام قبلی =====
visible = false;
await new Promise((resolve) => setTimeout(resolve, 700));
check(
  "پیام صف‌شده پس از بسته‌شدن پیام قبلی نمایش داده می‌شود",
  fired.length === 1 && fired[0].title === "پیام صف‌شده",
  `fired=${fired.length}`,
);

// ===== ۶) خاموشی سراسری با ?debug=1 =====
reset();
globalThis.window = { location: { search: "?debug=1" } };
const debugOff = svc.notifyOnce({ key: "dbg", message: "پیام دیباگ" });
check(
  "با ?debug=1 هیچ توستی نمایش داده نمی‌شود (فقط کنسول)",
  debugOff === false && fired.length === 0,
  `fired=${fired.length}`,
);
globalThis.window = { location: { search: "" } };

// ===== ۷) خاموشی سراسری با skb_user_toasts=off =====
reset();
store.set("skb_user_toasts", "off");
const localOff = svc.notifyOnce({ key: "off", message: "پیام خاموش" });
store.delete("skb_user_toasts");
check(
  'با skb_user_toasts="off" هیچ توستی نمایش داده نمی‌شود',
  localOff === false && fired.length === 0,
  `fired=${fired.length}`,
);

// ===== ۸) پیام خالی → هیچ کاری =====
reset();
const empty = svc.notifyOnce({ key: "empty", message: "   " });
check("پیام خالی نمایش داده نمی‌شود", empty === false && fired.length === 0);

// ===== ۹) هیچ‌کدام از این پیام‌ها مودال نساخته‌اند =====
check(
  "هیچ‌یک از پیام‌های کاربری مودال نساخته است (همه toast)",
  allFired.length > 0 && allFired.every((o) => o.toast === true),
  `count=${allFired.length}`,
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
