// ============================================================
//  تست «پیام عدم دسترسی» (۴۰۳ = مجوز بسته)
//  اجرا:  npm run test:denied      (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ کاربر باید بفهمد «چه چیزی» برایش بسته است و UI هم باید
//  همان لحظه هم‌راستا شود (منو/دکمهٔ مربوطه مخفی، بدون تلاش تکراری).
//  این تست (بدون مرورگر/سرور واقعی) تضمین می‌کند:
//   ۱) ۴۰۳ ⇒ دقیقاً یک توست با نام فارسی مجوز («دسترسی «حذف سالن»…»)
//   ۲) ۴۰۳ تکراری در بازهٔ cooldown ⇒ توست دوم ندارد (ضدسیل پیام)
//   ۳) پس از ۴۰۳ مجوزها تازه و نام فارسی از سرور خوانده می‌شود
//   ۴) ۴۰۳ روی خودِ /permissions/me ⇒ هیچ پیام/تازه‌سازی (ضدحلقه)
//   ۵) api.service درخت‌های FormData (POST/PUT) را هم پوشش می‌دهد
//   ۶) کارت inline «این بخش برای نقش شما بسته است» ساخته و پاک می‌شود
//   ۷) مودال «عدم دسترسی به صفحه» تک‌دکمه‌ای است (بدون انصراف/تایمر)
// ============================================================
import { notificationService } from "./src/core/services/notification.service.js";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const tick = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));

// ===== شبیه‌ساز حداقلی DOM (فقط همان چیزی که سرویس استفاده می‌کند) =====
class FakeNode {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.innerHTML = "";
    this.className = "";
    this.parent = null;
  }

  setAttribute(key, value) {
    this.attrs[key] = String(value);
  }

  getAttribute(key) {
    return Object.prototype.hasOwnProperty.call(this.attrs, key)
      ? this.attrs[key]
      : null;
  }

  removeAttribute(key) {
    delete this.attrs[key];
  }

  get firstChild() {
    return this.children[0];
  }

  insertBefore(node, ref) {
    const index = ref ? this.children.indexOf(ref) : -1;
    if (index >= 0) this.children.splice(index, 0, node);
    else this.children.push(node);
    node.parent = this;
    return node;
  }

  appendChild(node) {
    return this.insertBefore(node, null);
  }

  querySelector(selector) {
    if (selector === "[data-perm-denied-box]") {
      return (
        this.children.find((child) => child.getAttribute("data-perm-denied-box")) ||
        null
      );
    }
    return null;
  }

  remove() {
    if (this.parent) {
      const index = this.parent.children.indexOf(this);
      if (index >= 0) this.parent.children.splice(index, 1);
      this.parent = null;
    }
  }
}

const nodesById = new Map();
const events = [];

globalThis.document = {
  visibilityState: "visible",
  getElementById: (id) => nodesById.get(id) || null,
  createElement: (tag) => new FakeNode(tag),
  querySelectorAll: () => [],
  addEventListener: (type, handler) => events.push({ type, handler }),
  dispatchEvent: (event) => events.filter((e) => e.type === event.type).forEach((e) => e.handler(event)),
};

if (typeof globalThis.CustomEvent === "undefined") {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type) {
      this.type = type;
    }
  };
}

// ===== localStorage (توکن/کاربر لازم است تا سرویس مجوزها داده بخواند) =====
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
store.set("adminToken", "test-token");
store.set("user", JSON.stringify({ id: 7, role: "expert" }));

// ===== window + Swal =====
const toasts = [];
const modals = [];
let modalVisible = false;

globalThis.Swal = {
  fire(options) {
    if (options.toast) {
      toasts.push(options);
      modalVisible = true;
      setTimeout(() => (modalVisible = false), 10);
    } else {
      modals.push(options);
      modalVisible = true;
    }
    return Promise.resolve({ isConfirmed: true });
  },
  isVisible: () => modalVisible,
  close: () => {
    modalVisible = false;
  },
};

globalThis.window = {
  location: { search: "", href: "http://localhost/admin-panel.html" },
  addEventListener: () => {},
};

// ===== fetch شبیه‌سازی‌شده (شمارش درخواست‌ها) =====
const fetches = [];
const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

globalThis.fetch = async (url, options = {}) => {
  const target = String(url);
  fetches.push({ url: target, method: options.method || "GET" });

  if (target.includes("/permissions/me")) {
    return jsonResponse(200, {
      success: true,
      data: {
        role: "expert",
        roleTitle: "کارشناس",
        enforced: true,
        version: 5,
        permissions: ["halls.view", "dashboard.view"],
        deniedTitles: {
          "weekly.view": "مشاهدهٔ جدول مدیریت هفتگی",
          "halls.delete": "حذف سالن",
        },
      },
    });
  }

  // هر مسیر دیگری ⇒ «مجوز بسته»
  return jsonResponse(403, {
    success: false,
    permissionDenied: true,
    message: "دسترسی شما به این عملیات بسته شده است",
    required: ["weekly.view"],
    requiredTitles: ["مشاهدهٔ جدول مدیریت هفتگی"],
    role: "expert",
  });
};

// ============================================================
// ⚠️ ماژول‌ها بعد از آماده‌شدن مین‌های مرورگر (window/document) لود می‌شوند؛
//    چون api.const.js در لحظهٔ import به window.CONFIG نگاه می‌کند.
// ============================================================
const { permissionService } = await import(
  "./src/core/services/permission.service.js"
);
const { apiService } = await import("./src/core/services/api.service.js");

const resetToasts = () => {
  toasts.length = 0;
  notificationService._recentKeys.clear();
  notificationService._recentTimes.length = 0;
  notificationService._pendingToast = null;
};

// ============================================================
// ۱) ۴۰۳ ⇒ یک توست با نام فارسی مجوز + تازه‌سازی مجوزها
// ============================================================
resetToasts();
fetches.length = 0;

const denied = permissionService.handleForbidden({
  required: ["halls.delete"],
  requiredTitles: ["حذف سالن"],
});

await tick();

check(
  "۴۰۳ ⇒ دقیقاً یک توست با عنوان فارسی مجوز نمایش داده می‌شود",
  toasts.length === 1 && String(toasts[0].title).includes("حذف سالن"),
  `toasts=${toasts.length} text=${toasts[0]?.title || "-"}`,
);

check(
  "پیام ۴۰۳ نشان می‌دهد «برای نقش شما بسته است» (قابل‌فهم برای کاربر)",
  String(toasts[0]?.title || "").includes("بسته است"),
);

check(
  "پس از ۴۰۳، مجوزها تازه می‌شوند (تا منو/دکمهٔ مربوطه همان لحظه مخفی شود)",
  fetches.some((f) => f.url.includes("/permissions/me")),
  `fetches=${fetches.length}`,
);

check(
  "نام فارسی مجوزها در سرویس ذخیره شده است (برای پیام‌های بعدی/کارت بخش)",
  permissionService.titleOf("weekly.view") === "مشاهدهٔ جدول مدیریت هفتگی",
  `title=${permissionService.titleOf("weekly.view")}`,
);

check(
  "نتیجهٔ handleForbidden کلید و عنوان را برمی‌گرداند",
  denied.key === "halls.delete" && denied.title === "حذف سالن",
);

// ============================================================
// ۲) ۴۰۳ تکراری ⇒ پیام دوم نمی‌آید (ضدسیل پیام)
// ============================================================
// ⚠️ فقط صف نمایش پاک می‌شود؛ وضعیت «ضدتکرار» عمداً دست‌نخورده می‌ماند
//    تا رفتار واقعی (دو ۴۰۳ پشت‌سرهم) سنجیده شود.
toasts.length = 0;
permissionService.handleForbidden({
  required: ["halls.delete"],
  requiredTitles: ["حذف سالن"],
});
await tick();

check(
  "۴۰۳ تکراری در بازهٔ ۳۰ ثانیه توست دوم نمی‌سازد",
  toasts.length === 0,
  `toasts=${toasts.length}`,
);

// ============================================================
// ۳) api.service: ۴۰۳ روی عملیات عادی ⇒ پیام + تازه‌سازی
// ============================================================
resetToasts();
fetches.length = 0;

await apiService.post("/halls", { name: "تست" }).catch(() => {});
await tick();

check(
  "api.service: خطای ۴۰۳ در POST به پیام کاربر تبدیل می‌شود",
  toasts.length === 1 && String(toasts[0].title).includes("هفتگی"),
  `toasts=${toasts.length}`,
);

check(
  "api.service: پس از ۴۰۳ مجوزها دوباره خوانده می‌شوند",
  fetches.some((f) => f.url.includes("/permissions/me")),
);

// ============================================================
// ۴) ۴۰۳ روی خودِ /permissions/me ⇒ بدون پیام و بدون حلقه
// ============================================================
resetToasts();
fetches.length = 0;

await apiService.get("/permissions/me").catch(() => {});
await tick();

check(
  "api.service: ۴۰۳ روی /permissions/me هیچ پیامی نمی‌سازد (ضدحلقه)",
  toasts.length === 0,
  `toasts=${toasts.length}`,
);

check(
  "api.service: ۴۰۳ روی /permissions/me تازه‌سازی تکراری راه نمی‌اندازد",
  fetches.filter((f) => f.url.includes("/permissions/me")).length === 1,
  `me fetches=${fetches.filter((f) => f.url.includes("/permissions/me")).length}`,
);

// ============================================================
// ۵) مسیرهای FormData هم پوشش دارند (POST/PUT فایل/فرم)
// ============================================================
resetToasts();
fetches.length = 0;

await apiService.postFormData("/visit-reports", new FormData()).catch(() => {});
await tick();

check(
  "api.service: ۴۰۳ در postFormData (آپلود/فرم) هم پیام می‌دهد",
  toasts.length === 1,
  `toasts=${toasts.length}`,
);

resetToasts();
await apiService.putFormData("/customers/1", new FormData()).catch(() => {});
await tick();

check(
  "api.service: ۴۰۳ در putFormData هم پیام می‌دهد",
  toasts.length === 1,
  `toasts=${toasts.length}`,
);

check(
  "پیام ۴۰۳ فقط «توست» است (مودالی باز نمی‌شود)",
  modals.length === 0,
  `modals=${modals.length}`,
);

// ============================================================
// ۶) کارت inline بخش‌ها: ساخت + بازگردانی
// ============================================================
const wrapper = new FakeNode("div");
const cardA = new FakeNode("div");
const cardB = new FakeNode("div");
wrapper.appendChild(cardA);
wrapper.appendChild(cardB);
nodesById.set("weekly-card", wrapper);

const box = permissionService.renderDeniedNotice(
  "weekly-card",
  "weekly.view",
  "برای فعال‌کردن با مدیر اصلی تماس بگیرید.",
);

check(
  "کارت «این بخش برای نقش شما غیرفعال شده است» در بخش ساخته می‌شود",
  !!box &&
    box.className === "perm-denied-box" &&
    box.getAttribute("data-perm-denied-box") === "weekly.view" &&
    String(box.innerHTML).includes("این بخش برای نقش شما غیرفعال شده است"),
  `htmlLen=${String(box?.innerHTML || "").length}`,
);

check(
  "کارت بخش، نام فارسی مجوز و کلید آن را نشان می‌دهد",
  String(box?.innerHTML || "").includes("مشاهدهٔ جدول مدیریت هفتگی") &&
    String(box?.innerHTML || "").includes("weekly.view"),
);

check(
  "محتوای قبلی بخش تا زمانی که دسترسی بسته است پنهان می‌شود",
  cardA.style.display === "none" && cardB.style.display === "none",
  `a=${cardA.style.display} b=${cardB.style.display}`,
);

// اگر در همین حال، دسترسی داده شود ⇒ کارت برمی‌گردد
permissionService.clearDeniedNotice("weekly-card");

check(
  "با برگشت دسترسی، کارت حذف و محتوای بخش برمی‌گردد",
  wrapper.children.length === 2 &&
    cardA.style.display === "" &&
    cardB.style.display === "" &&
    !wrapper.querySelector("[data-perm-denied-box]"),
);

// ============================================================
// ۷) مودال «عدم دسترسی به صفحه» تک‌دکمه‌ای است
// ============================================================
const confirmed = await notificationService.modalMessage({
  title: "⛔ دسترسی به این صفحه بسته است",
  text: "این بخش برای نقش شما («کارشناس») غیرفعال شده است.",
  confirmText: "بازگشت به داشبورد",
});

check(
  "مودال عدم دسترسی تک‌دکمه‌ای و بدون انصراف است",
  confirmed === true &&
    modals.length === 1 &&
    modals[0].showCancelButton !== true &&
    modals[0].confirmButtonText === "بازگشت به داشبورد",
  `modals=${modals.length}`,
);

check(
  "مودال عدم دسترسی خودبه‌خود بسته نمی‌شود (کاربر باید ببیند)",
  modals[0]?.timer === undefined,
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
