// ============================================================
// config/permissions.js
// «کاتالوگ مجوزها» — منبع واحد حقیقت (Single Source of Truth)
// ------------------------------------------------------------
// • هر «قابلیت قابل تنظیم» سیستم اینجا تعریف می‌شود:
//     key       کلید یکتا (مثل customers.delete)
//     title     عنوان فارسی برای نمایش در پنل ادمین
//     defaults  پیش‌فرضِ هر ۵ نقش (روز اول = رفتار فعلی سیستم)
//     lockedTo  اگر پر باشد، این مجوز فقط برای این نقش‌ها قابل فعال‌سازی است
// • جدول‌های role_permissions / user_permissions فقط «استثناها» را
//   نگه می‌دارند؛ نبودِ ردیف = همان پیش‌فرض همین فایل.
//   ⇒ افزودن قابلیت جدید در آینده نیازی به مایگریشن/seed ندارد.
// • مجوز مؤثر = override کاربر ← ردیف نقش ← پیش‌فرض کاتالوگ
// ============================================================
"use strict";

// ===== نقش‌ها (به ترتیب سطح) =====
const ROLES = ["super_admin", "admin", "sub_admin", "expert", "customer"];

const ROLE_TITLES = {
  super_admin: "مدیر اصلی",
  admin: "مدیر",
  sub_admin: "مدیر میانی",
  expert: "کارشناس",
  customer: "مشتری",
};

// ===== پیش‌فرض‌های آماده (کوتاه‌نویسی) =====
// ترتیب کلیدها همیشه: super_admin, admin, sub_admin, expert, customer
const D = {
  // همه (به‌جز مشتری)
  all: {
    super_admin: true,
    admin: true,
    sub_admin: true,
    expert: true,
    customer: false,
  },
  // مدیریتی: فقط ادمین‌ها
  admin: {
    super_admin: true,
    admin: true,
    sub_admin: true,
    expert: false,
    customer: false,
  },
  // فقط مدیر و مدیر اصلی
  manager: {
    super_admin: true,
    admin: true,
    sub_admin: false,
    expert: false,
    customer: false,
  },
  // فقط مدیر اصلی (معمولاً همراه lockedTo)
  owner: {
    super_admin: true,
    admin: false,
    sub_admin: false,
    expert: false,
    customer: false,
  },
  // خاموش برای همه
  off: {
    super_admin: false,
    admin: false,
    sub_admin: false,
    expert: false,
    customer: false,
  },
  // ✅ فقط مشتری (فاز ۱۳.۲) — کلیدهای «پورتال مشتری»
  //    چرا معکوسِ D.all لازم شد؟ چون تا امروز هر کلید یا برای کارکنان بود
  //    یا برای همه به‌جز مشتری؛ پورتال اولین بخشی است که فقط مشتری می‌بیند.
  customerOnly: {
    super_admin: false,
    admin: false,
    sub_admin: false,
    expert: false,
    customer: true,
  },
};

// ===== ابزار ساخت آیتم =====
const item = (key, title, defaults, extra = {}) => ({
  key,
  title,
  defaults,
  ...extra,
});

// ============================================================
// ۱) داشبورد
// ============================================================
const DASHBOARD = [
  item("dashboard.view", "مشاهدهٔ داشبورد", D.all),
  item("dashboard.flockCards", "کارت‌های گله‌های فعال", D.all),
  item("dashboard.summary", "خلاصهٔ آماری", D.all),
  item("dashboard.charts", "نمودارهای داشبورد", D.all),
  item("dashboard.analysis", "تحلیل‌های داینامیک", D.all),
  item("dashboard.customerDetails", "مشاهدهٔ جزئیات مشتری از داشبورد", D.all),
  item("dashboard.tasks.danger", "لیست هشدار / نزدیک به سررسید", D.all),
  item("dashboard.tasks.success", "لیست رویدادهای در پیش", D.all),
  item("dashboard.flock.hide", "حذف/مخفی‌کردن گله از داشبورد", D.all),
  item("dashboard.bulkSms", "ارسال پیامک گروهی از داشبورد", D.admin),
  item("dashboard.calendar", "تقویم", D.all),
  item("dashboard.messages", "پیام‌های دریافتی داشبورد", D.all),
];

// ============================================================
// ۲) مشتریان (لیست و ثبت‌نام)
// ============================================================
const CUSTOMERS = [
  item("customers.list.view", "مشاهدهٔ لیست مشتریان", D.all),
  item("customers.search", "جستجو و فیلترهای لیست مشتریان", D.all),
  item("customers.register", "ثبت مشتری جدید", D.all),
  item("customers.profile.view", "مشاهدهٔ پروفایل مشتری", D.all),
  item("customers.edit", "ویرایش اطلاعات مشتری", D.all),
  item("customers.toggle", "فعال/غیرفعال‌کردن مشتری", D.manager),
  item("customers.delete", "حذف مشتری", D.owner, {
    risk: "high",
    lockedTo: ["super_admin"],
  }),
  item(
    "customers.sensitiveFields",
    "مشاهدهٔ فیلدهای حساس (کد ملی، ایمیل، آدرس)",
    D.all,
  ),
  item("customers.sms.send", "ارسال پیامک به یک مشتری", D.all),
  item("customers.sms.bulk", "ارسال پیامک گروهی به مشتریان", D.admin),
  item("customers.sms.welcomeSetting", "تغییر تنظیم پیامک خوش‌آمدگویی", D.manager),
];

// ============================================================
// ۳) پروفایل مشتری — اطلاعات پایه و واحدها
// ============================================================
const CUSTOMER_BASIC = [
  item("customer.basic.view", "مشاهدهٔ اطلاعات پایهٔ مشتری", D.all),
  item("customer.basic.edit", "ویرایش اطلاعات پایهٔ مشتری", D.all),
  item("customer.units.manage", "مدیریت واحدهای مرغداری (ثبت/ویرایش/حذف)", D.all),
  item("customer.units.toggle", "فعال/غیرفعال‌کردن واحد", D.all),
  item("customer.units.experts", "تعیین/ویرایش کارشناس واحد", D.all),
];

// ============================================================
// ✅ ۳.۵) پورتال مشتری (فاز ۱۳.۲)
// ------------------------------------------------------------
//  تنها گروهی در کاتالوگ که پیش‌فرض‌هایش برای «مشتری» روشن و برای
//  کارکنان خاموش است (D.customerOnly).
//  • چرا کلید جدا و نه استفاده از کلیدهای موجود؟
//      کلیدهای موجود (customer.basic.view، halls.view، weekly.view …)
//      همه پیش‌فرضِ false برای مشتری دارند. اگر برای پورتال روشنشان
//      می‌کردیم، ۲۰ مسیر موجود هم برای مشتری باز می‌شد — دقیقاً چیزی که
//      فاز ۱۳.۲ عمداً انجام نمی‌دهد (گزینهٔ الف: «حداقل سطح تماس»).
//  • این کلید فقط «نمایش پورتال» را کنترل می‌کند؛ داده داخل پورتال
//    همیشه با اسکوپِ سرور (req.customerScopeId) فیلتر می‌شود.
// ============================================================
const PORTAL = [
  item("customer.portal.view", "مشاهدهٔ پورتال مشتری (خلاصهٔ پروندهٔ خودم)", D.customerOnly),
  // ✅ فاز ۱۳.۵: هر تب پورتال کلید مستقل خودش را دارد.
  //    چرا؟ تا مدیر بتواند «براساس نیاز» هر بخش را جدا ببندد/باز کند —
  //    بدون بستن کل پورتال. همه برای نقش مشتری پیش‌فرض روشن‌اند، پس
  //    با افزودن این کلیدها هیچ چیز برای مشتریِ موجود قطع نمی‌شود.
  //    ⚠️ برخلاف کلیدهای ماژول کارکنان (halls.view، weekly.view …) این
  //    کلیدها واقعاً اثر دارند: هم در مسیرهای /api/portal/* و هم در
  //    خلاصهٔ پرونده (portalController.getPortalSummary) اجرا می‌شوند.
  item("customer.portal.halls", "تب «سالن‌های من» در پورتال مشتری", D.customerOnly),
  item("customer.portal.flocks", "تب «گله‌ها و دوره‌های من» در پورتال مشتری", D.customerOnly),
  item("customer.portal.weeks", "تب «هفته‌های مدیریتی من» + نمودار روند وزن", D.customerOnly),
  item("customer.portal.visits", "تب «بازدیدهای من» (فهرست بازدیدها)", D.customerOnly),
  // ✅ فاز ۱۳.۴: کلید جدا برای «محتوای گزارش بازدید» (متن + پیوست‌ها)
  //    چرا جدا؟ متن گزارش و فایل‌های پیوست حساس‌ترین بخش پرونده‌اند؛
  //    مدیر باید بتواند بدون بستن کل پورتال، فقط این بخش را ببندد.
  item(
    "customer.portal.visit.report",
    "مشاهدهٔ متن گزارش بازدید و پیوست‌های آن (پورتال مشتری)",
    D.customerOnly,
  ),
  // ✅ فاز ۱۳.۸ — «پروفایل من» و «داشبورد تحلیلی» در پورتال
  // ------------------------------------------------------------
  //  چرا کلید «ویرایش» جدا از «مشاهده» است؟
  //   مشاهدهٔ پرونده (customer.portal.profile) فقط خواندن است؛ ویرایش،
  //   تنها مسیر *نوشتن* پورتال است. مدیر باید بتواند پروفایل را نشان
  //   دهد ولی ویرایش را ببندد (یا برعکس)، بدون بستن کل پورتال.
  //  ⚠️ customer_type_id هرگز با این کلید قابل تغییر نیست؛ تغییر شمارهٔ
  //   موبایل هم مسیر جدا با کد پیامکی دارد (services/portalProfileRules.js).
  item("customer.portal.profile", "تب «پروفایل من» در پورتال مشتری", D.customerOnly),
  item(
    "customer.portal.profile.edit",
    "ویرایش پروفایل خودم (پورتال مشتری)",
    D.customerOnly,
  ),
  // ✅ فاز ۱۳.۸ — داشبورد تحلیلی: تب + سه قابلیت مستقل
  item("customer.portal.dashboard", "تب «داشبورد تحلیلی» در پورتال مشتری", D.customerOnly),
  item(
    "customer.portal.dashboard.analysis",
    "تحلیل‌های داینامیک داشبورد پورتال",
    D.customerOnly,
  ),
  item(
    "customer.portal.dashboard.compare",
    "مقایسهٔ گله‌های خودم در داشبورد پورتال",
    D.customerOnly,
  ),
  item(
    "customer.portal.dashboard.export",
    "خروجی CSV از نمودارهای پورتال",
    D.customerOnly,
  ),
  // نمودارهای قابل انتخاب — هر کدام مستقل بسته می‌شود
  // (کلیدهای UI‌محور، هم‌ردهٔ halls.tab.*؛ رندر بدون کلید انجام نمی‌شود)
  item("customer.portal.chart.weight", "نمودار «وزن هفتگی» (پورتال مشتری)", D.customerOnly),
  item(
    "customer.portal.chart.gain",
    "نمودار «افزایش وزن هفتگی» (پورتال مشتری)",
    D.customerOnly,
  ),
  item("customer.portal.chart.mortality", "نمودار «تلفات» (پورتال مشتری)", D.customerOnly),
  item("customer.portal.chart.feed", "نمودار «مصرف دان» (پورتال مشتری)", D.customerOnly),
  item("customer.portal.chart.fcr", "نمودار «ضریب تبدیل غذایی» (پورتال مشتری)", D.customerOnly),
  item(
    "customer.portal.chart.standards",
    "نمایش «خط استاندارد نژاد» روی نمودارها (پورتال مشتری)",
    D.customerOnly,
  ),
  // ✅ موج ۱۳.۱۰ — «مدارک من»: تب + آپلود + حذف نرم
  // ------------------------------------------------------------
  //  چرا سه کلید و نه یکی؟
  //   «دیدن فهرست» با «فرستادن فایل» و «حذف» سه ریسک متفاوت‌اند:
  //   • اگر مدیر بخواهد فقط مدارکِ ارسالی را ببیند و آپلود بسته باشد
  //     (مثلاً پروندهٔ تکمیل‌شده)، با بستن .upload این کار ممکن است.
  //   • حذف (حتی نرم) کلید جدا دارد تا اشتباه/سوءاستفاده محدود شود.
  //  ⚠️ فایل‌ها در پوشهٔ خصوصی ذخیره می‌شوند و فقط با توکن سرو
  //   می‌شوند؛ این کلیدها «مجوز تماس»‌اند، نه محافظ داده.
  item("customer.portal.documents", "تب «مدارک من» در پورتال مشتری", D.customerOnly),
  item(
    "customer.portal.documents.upload",
    "آپلود مدرک از پورتال مشتری (تصویر/PDF تا ۵ مگابایت)",
    D.customerOnly,
  ),
  item(
    "customer.portal.documents.delete",
    "حذف نرم مدرک از فهرست خودم (فایل برای بازبینی کارشناس می‌ماند)",
    D.customerOnly,
  ),
  // ✅ موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب: درخواست + تأیید کارشناس)
  // ------------------------------------------------------------
  //  مشتری هیچ نوشتن مستقیمی در units/halls/chick_placements ندارد؛
  //  فقط «درخواست» می‌فرستد و کارشناس تأیید/رد می‌کند. سه کلید:
  //   • تب «درخواست‌های من» (دیدن وضعیت و دلیل رد)
  //   • ثبت درخواست تازه
  //   • لغو درخواستِ هنوز بررسی‌نشده
  //  ⚠️ کلید صف کارشناس در گروه «پنل مدیریت — درخواست‌های پورتال»
  //   است (portal.requests.view/review)، نه این‌جا؛ تا بستن ثبت
  //   برای مشتری، دسترسی کارشناس را قطع نکند.
  item("customer.portal.farm", "تب «درخواست‌های فارم» در پورتال مشتری", D.customerOnly),
  item(
    "customer.portal.farm.request",
    "ثبت درخواست ساخت واحد/سالن/جوجه‌ریزی از پورتال",
    D.customerOnly,
  ),
  item(
    "customer.portal.farm.cancel",
    "لغو درخواستِ در انتظار تأیید (پیش از بررسی کارشناس)",
    D.customerOnly,
  ),
  // ============================================================
  // ✅ موج ۱۳.۱۹ — «پایان دوره» و «گزارش نهایی دوره»
  // ------------------------------------------------------------
  //  چرا دو کلید و نه یکی؟
  //   • customer.portal.completion       → فهرست دوره‌های بسته‌شده +
  //     شاخص‌های نهایی هر دوره (سبک، برای همهٔ مشتریان)
  //   • customer.portal.completion.report → گزارش تفصیلی یک دوره:
  //     ریز هر سالن، روند هفتگی و جمع دارو/واکسن
  //  همان الگوی «تب بازدیدها» + «متن گزارش بازدید» (۱۳.۴): مدیر
  //  می‌تواند خلاصه را نشان دهد ولی گزارش تفصیلی را ببندد.
  //  ⚠️ اقتصاد گله (درآمد/هزینه/سود) در هیچ‌کدام از این دو مسیر
  //   بیرون نمی‌رود؛ حتی اگر کلید باز باشد (فهرست سفید سرور).
  // ============================================================
  item(
    "customer.portal.completion",
    "تب «پایان دوره» در پورتال مشتری (شاخص‌های نهایی دوره‌های خودم)",
    D.customerOnly,
  ),
  item(
    "customer.portal.completion.report",
    "گزارش تفصیلی پایان دوره (ریز سالن‌ها، روند هفتگی، دارو و واکسن)",
    D.customerOnly,
  ),
  // ============================================================
  // ✅ موج ۱۳.۱۷ — «منوهای پورتال» (ناوبری دو لایه)
  // ------------------------------------------------------------
  //  چرا ۲۸ کلید تازه وقتی پورتال همین حالا ۲۴ کلید دارد؟
  //   ۱) تا ۱۳.۱۶ پورتال یک نوار تَب افقی داشت: هر تَب یک کلید
  //      «محتوا» بود (customer.portal.halls …). از ۱۳.۱۷ ناوبری
  //      «منو + زیرمنو» شد؛ اگر منوها به کلید محتوا گیت می‌شدند،
  //      بستن یک بخش، *کل منو* را ناپدید می‌کرد (همان اشکالی که در
  //      گروه adminMenus توضیح داده شد).
  //   ۲) پس دو لایه داریم — دقیقاً مثل admin.menu.*:
  //        • لایهٔ «منو»   → فقط دیده‌شدنِ آیتم در ناوبری
  //        • لایهٔ «محتوا» → همان ۲۴ کلید قبلی، که *سرور* هم اجرا
  //          می‌کند (/api/portal/* با همین کلیدها ۴۰۳ می‌دهد)
  //   ۳) `data-permission` هر لینک در portal.html همین کلیدها هستند؛
  //      اگر مدیر «مزرعهٔ من» را ببندد، ۷ آیتم آن با هم پنهان می‌شود
  //      ولی دسترسی داده (customer.portal.farm) دست‌نخورده می‌ماند.
  //  ⚠️ این کلیدها فقط UI را کنترل می‌کنند (پیش‌فرض: مشتری روشن،
  //      بقیه خاموش). هیچ اندپوینتی با این کلیدها محافظت نمی‌شود؛
  //      اسکوپِ داده همیشه با req.customerScopeId است.
  // ============================================================
  // — لایهٔ منو: داشبورد —
  item("customer.portal.menu.dashboard", "منوی «داشبورد» (پورتال)", D.customerOnly),
  item(
    "customer.portal.menu.dashboard.charts",
    "زیرمنوی «نمودارها» در داشبورد پورتال",
    D.customerOnly,
  ),
  item(
    "customer.portal.menu.dashboard.compare",
    "زیرمنوی «مقایسهٔ گله‌ها» در داشبورد پورتال",
    D.customerOnly,
  ),
  // — لایهٔ منو: پروندهٔ من —
  item("customer.portal.menu.profile", "منوی «پروندهٔ من» (پورتال)", D.customerOnly),
  item("customer.portal.menu.profile.me", "زیرمنوی «پروفایل من» (پورتال)", D.customerOnly),
  item(
    "customer.portal.menu.profile.documents",
    "زیرمنوی «مدارک من» (پورتال)",
    D.customerOnly,
  ),
  // — لایهٔ منو: واحدهای من (کلید محتوایی: customer.portal.halls / customer.portal.farm) —
  //   ✅ ۱۳.۲۱: منو «واحدها» شد و چهار کلید جزئیات سالن، «گیت بخش‌های
  //   آکاردئون» هستند (نه مسیر مستقل) — هیچ کلیدی حذف نشد.
  item("customer.portal.menu.farm", "منوی «واحدهای من» (پورتال)", D.customerOnly),
  item("customer.portal.menu.farm.units", "زیرمنوی «واحدها» (پورتال)", D.customerOnly),
  item("customer.portal.menu.farm.halls", "زیرمنوی «سالن‌ها» (پورتال)", D.customerOnly),
  item(
    "customer.portal.menu.farm.physical",
    "بخش «اطلاعات فیزیکی» در آکاردئون سالن (پورتال)",
    D.customerOnly,
  ),
  item("customer.portal.menu.farm.systems", "بخش «سیستم‌های سالن» در آکاردئون سالن (پورتال)", D.customerOnly),
  item(
    "customer.portal.menu.farm.waterFeed",
    "بخش «آبخوری و دانخوری» در آکاردئون سالن (پورتال)",
    D.customerOnly,
  ),
  item("customer.portal.menu.farm.hygiene", "بخش «بهداشت سالن» در آکاردئون سالن (پورتال)", D.customerOnly),
  // — لایهٔ منو: جوجه‌ریزی —
  item("customer.portal.menu.hatchery", "منوی «جوجه‌ریزی» (پورتال)", D.customerOnly),
  item(
    "customer.portal.menu.hatchery.flocks",
    "زیرمنوی «گله‌های من» (پورتال)",
    D.customerOnly,
  ),
  item(
    "customer.portal.menu.hatchery.placements",
    "زیرمنوی «دوره‌های جوجه‌ریزی» (پورتال)",
    D.customerOnly,
  ),
  // ⚠️ دو زیرمنوی زیر در ۱۳.۱۷ پنل «به‌زودی» دارند (اندپوینت پورتال
  //    برای تاریخچهٔ ضدعفونی و پایان دوره هنوز نیست)؛ کلید از الان
  //    هست تا مدیر بتواند حتی همان صفحهٔ اطلاع‌رسانی را ببندد.
  item(
    "customer.portal.menu.hatchery.hygiene",
    "زیرمنوی «ضدعفونی دوره» (پورتال)",
    D.customerOnly,
  ),
  item(
    "customer.portal.menu.hatchery.completion",
    "زیرمنوی «پایان دوره» (پورتال)",
    D.customerOnly,
  ),
  // — لایهٔ منو: مدیریت هفتگی —
  item("customer.portal.menu.weekly", "منوی «مدیریت هفتگی» (پورتال)", D.customerOnly),
  // ⚠️ ۱۳.۲۱: زیرمنوی «ثبت هفته» حذف شد — ثبت از شیت همان پنل هفتگی
  //    انجام می‌شود (کلید محتوایی: customer.portal.farm.request).
  item("customer.portal.menu.weekly.list", "زیرمنوی «هفته‌های ثبت‌شده» (پورتال)", D.customerOnly),
  item("customer.portal.menu.weekly.trend", "زیرمنوی «نمودار روند» (پورتال)", D.customerOnly),
  // — لایهٔ منو: ارسال تیکت (جای «درخواست‌های من» در ۱۳.۲۱) —
  item("customer.portal.menu.tickets", "منوی «ارسال تیکت» (پورتال)", D.customerOnly),
  // — لایهٔ منو: گزارش‌ها —
  item("customer.portal.menu.reports", "منوی «گزارش‌ها» (پورتال)", D.customerOnly),
  item(
    "customer.portal.menu.reports.visits",
    "زیرمنوی «بازدیدهای کارشناس» (پورتال)",
    D.customerOnly,
  ),
  item("customer.portal.menu.reports.final", "زیرمنوی «گزارش نهایی دوره» (پورتال)", D.customerOnly),
  // — لایهٔ محتوا: «ارسال تیکت» —
  //   ✅ ۱۳.۲۱: کنترل «دیده‌شدن» پنل تیکت.
  //   ✅ ۱۳.۲۲: گیت سرور هم با همین کلید فعال شد — ولی فقط برای نقش
  //   مشتری (`requireRolePermission("customer", ...)` در suggestionRoutes)
  //   چون مودال پاکت پیام‌های هدر برای کارشناس/ادمین هم از همان روت
  //   استفاده می‌کند و این کلید «فقط-مشتری» است.
  item("customer.portal.tickets", "ارسال تیکت و گفتگو با پشتیبانی (پورتال)", D.customerOnly),
];

// ============================================================
// ۴) سالن‌ها
// ============================================================
const HALLS = [
  item("halls.view", "مشاهدهٔ لیست سالن‌ها", D.all),
  item("halls.create", "ثبت سالن جدید", D.all),
  item("halls.edit", "ویرایش سالن", D.all),
  item("halls.delete", "حذف سالن", D.admin),
  item("halls.toggle", "فعال/غیرفعال‌کردن سالن", D.admin),
  item("halls.tab.unit", "تب «تعریف واحد مرغداری»", D.all),
  item("halls.tab.basic", "تب «اطلاعات پایهٔ سالن»", D.all),
  item("halls.tab.physical", "تب «اطلاعات فیزیکی سالن»", D.all),
  item("halls.tab.systems", "تب «سیستم‌های سالن»", D.all),
  item("halls.tab.waterFood", "تب «آبخوری و دانخوری»", D.all),
  item("halls.report", "گزارش/چاپ اطلاعات سالن‌ها", D.all),
];

// ============================================================
// ۵) جوجه‌ریزی (هچری)
// ============================================================
const HATCHERY = [
  item("hatchery.view", "مشاهدهٔ بخش جوجه‌ریزی", D.all),
  item("hatchery.placement.create", "ثبت گله‌های سالن‌ها (جوجه‌ریزی)", D.all),
  item("hatchery.placement.list", "مشاهدهٔ لیست گله‌ها", D.all),
  item("hatchery.placement.edit", "ویرایش جوجه‌ریزی/گله", D.all),
  item("hatchery.placement.delete", "حذف جوجه‌ریزی/گروه گله", D.admin),
  item("hatchery.placement.toggle", "فعال/غیرفعال‌کردن دوره", D.all),
  item("hatchery.hygiene.schedule", "ثبت برنامهٔ ضدعفونی", D.all),
  item("hatchery.hygiene.list", "مشاهدهٔ لیست ضدعفونی", D.all),
  item("hatchery.calendar", "تقویم سالن‌های اضافه", D.all),
  item("hatchery.completion.create", "ثبت پایان دوره", D.all),
  item("hatchery.completion.edit", "ویرایش اطلاعات پایان دوره", D.all),
  item("hatchery.completion.delete", "حذف (بازگردانی) پایان دوره", D.all),
  item("hatchery.report", "گزارش/چاپ جوجه‌ریزی", D.all),
];

// ============================================================
// ۶) مدیریت هفتگی
// ============================================================
const WEEKLY = [
  item("weekly.view", "مشاهدهٔ جدول مدیریت هفتگی", D.all),
  item("weekly.create", "ثبت هفته", D.all),
  item("weekly.edit", "ویرایش هفته", D.all),
  item("weekly.delete", "حذف هفته", D.admin),
  item("weekly.metrics", "جدول شاخص‌های عملکردی هفتگی", D.all),
  item("weekly.aggregate", "جدول تجمیعی «کل گله»", D.all),
  item("weekly.medical", "ثبت دارو/واکسن/بیماری/خوراک هفتگی", D.all),
  item("weekly.report", "گزارش/چاپ مدیریت هفتگی", D.all),
];

// ============================================================
// ۷) گزارش بازدید
// ============================================================
const VISIT = [
  item("visit.view", "مشاهدهٔ گزارش‌های بازدید", D.all),
  item("visit.create", "ثبت گزارش بازدید", D.all),
  item("visit.edit", "ویرایش گزارش بازدید", D.all),
  item("visit.delete", "حذف گزارش بازدید", D.admin),
  item("visit.status", "تغییر وضعیت خوانده/نخوانده", D.all),
  item("visit.attachment.download", "دانلود پیوست‌های گزارش", D.all),
  item("visit.attachment.delete", "حذف پیوست گزارش", D.admin),
];

// ============================================================
// ۸) نمودارها و تحلیل
// ============================================================
const CHARTS = [
  item("charts.view", "مشاهدهٔ نمودارهای پروفایل مشتری", D.all),
  item("charts.compare", "مقایسه با سایر مشتریان", D.all),
  item("charts.picker", "انتخاب گله/سالن برای مقایسه", D.all),
  item("charts.report", "گزارش/چاپ نمودارها", D.all),
  item("charts.standards", "مشاهدهٔ استانداردهای وزنی نژاد", D.all),
];

// ============================================================
// ۹) پیامک
// ============================================================
const SMS = [
  item("sms.send", "ارسال پیامک عادی", D.admin),
  item("sms.bulk", "ارسال پیامک گروهی", D.admin),
  item("sms.sendToRecipient", "ارسال پیامک به گیرندهٔ دلخواه (کارشناس/مرغدار)", D.all),
  item("sms.templates", "ارسال قالب‌های آماده (ثبت هفته/یادآوری)", D.all),
  item("sms.history", "مشاهدهٔ تاریخچهٔ پیامک‌ها", D.all),
  item("sms.status.refresh", "بروزرسانی وضعیت پیامک‌ها", D.all),
  item("sms.lines", "مشاهدهٔ خطوط سرویس پیامک", D.admin),
  item("sms.received", "مشاهدهٔ صندوق پیام‌های دریافتی", D.admin),
  item("sms.credit", "مشاهدهٔ اعتبار پیامک", D.all),
  item("sms.verify", "ارسال کد تأیید به شمارهٔ دلخواه", D.admin),
  item("sms.test", "ارسال پیامک تستی", D.admin),
];

// ============================================================
// ۱۰) بوکمارک‌ها
// ============================================================
const BOOKMARKS = [
  item("bookmarks.view", "مشاهدهٔ بوکمارک‌های خودم", D.all),
  item("bookmarks.create", "ایجاد بوکمارک", D.all),
  item("bookmarks.edit", "ویرایش بوکمارک", D.all),
  item("bookmarks.delete", "حذف بوکمارک", D.all),
  item("bookmarks.status", "تغییر وضعیت بوکمارک (انجام‌شده/باز)", D.all),
  item("bookmarks.viewOthers", "مشاهدهٔ بوکمارک سایر کاربران", D.manager),
];

// ============================================================
// ۱۱) پنل ادمین — کاربران
// ============================================================
const ADMIN_USERS = [
  item("admin.panel.access", "ورود به پنل مدیریت", D.manager, {
    alwaysOnFor: ["super_admin"],
  }),
  item("users.superadmin.manage", "مدیریت مدیران اصلی", D.owner, {
    risk: "high",
    lockedTo: ["super_admin"],
  }),
  item("users.list.view", "مشاهدهٔ لیست کاربران", D.admin),
  item("users.create", "ساخت کاربر جدید", D.admin),
  item("users.edit", "ویرایش کاربر", D.admin),
  item("users.delete", "حذف کاربر", D.owner, {
    risk: "high",
    lockedTo: ["super_admin"],
  }),
  item("users.role.assign", "تغییر نقش کاربر", D.admin),
  // ✅ «پیوند با پروندهٔ مشتری» (فاز ۱۳.۰): تعیین اینکه حسابِ یک مشتری
  //    صاحب کدام پروندهٔ مشتری است (پورتال مشتری در فاز ۱۳.۲ روی همین سوار است)
  item("users.customer.link", "تعیین پروندهٔ مشتری برای حساب کاربر", D.admin),
  item("users.token.reset", "بازنشانی توکن کاربر", D.admin),
  item("users.token.view", "مشاهدهٔ توکن کاربر", D.owner, {
    risk: "high",
    lockedTo: ["super_admin"],
  }),
  item("users.unlock", "بازکردن قفل حساب کاربر", D.admin),
  item("users.onlineStatus.view", "مشاهدهٔ وضعیت آنلاین کاربران", D.admin),
  // ✅ «نشست‌ها» (فاز ۱۲.۱): بستن نشست کاربران (= خروج از یک/همهٔ دستگاه‌ها)
  item("users.sessions.revoke", "خروج کاربر از دستگاه (بستن نشست)", D.admin),
  // ✅ «ردّ فعالیت» (فاز ۱۲.۲): مشاهدهٔ تاریخچهٔ تغییرات کاربران
  //    (قفل‌شده نیست ⇒ سوپرادمین می‌تواند از ماتریس به کارشناس هم بدهد)
  item("users.activity.view", "مشاهدهٔ ردّ فعالیت کاربران", D.admin),
  // ✅ «صف ثبت‌نام عمومی» (فاز ۱۳.۶)
  //    • view: دیدن درخواست‌های ثبت‌نام عمومی در پنل
  //    • review: تأیید/رد آن‌ها — تأیید **همچنین** users.customer.link
  //      می‌خواهد، چون بدون پیوند پروندهٔ مشتری، پورتال مشتری کار نمی‌کند.
  item("users.registrations.view", "مشاهدهٔ درخواست‌های ثبت‌نام", D.admin),
  item("users.registrations.review", "تأیید یا رد درخواست ثبت‌نام", D.admin),
];

// ============================================================
// ۱۲) پنل ادمین — نقش‌ها و سطوح دسترسی
// ============================================================
const ADMIN_ROLES = [
  item("roles.matrix.view", "مشاهدهٔ ماتریس سطوح دسترسی", D.admin, {
    alwaysOnFor: ["super_admin"],
  }),
  item("roles.permissions.edit", "ویرایش سطح دسترسی نقش‌ها", D.owner, {
    risk: "high",
    lockedTo: ["super_admin"],
  }),
  item("users.permissions.edit", "ویرایش سطح دسترسی یک کاربر خاص", D.owner, {
    risk: "high",
    lockedTo: ["super_admin"],
  }),
  item("roles.audit.view", "مشاهدهٔ گزارش تغییرات دسترسی", D.admin),
];

// ============================================================
// ۱۳) پنل ادمین — دیکشنری‌ها (هر جدول: مشاهده + مدیریت)
// ============================================================
// (نام‌ها مطابق Frontend/src/features/admin-panel/dictionary.schemas.js)
const DICTIONARY_TABLES = [
  ["hall-types", "انواع سالن"],
  ["chick-sources", "مبدا جوجه"],
  ["chicken-breeds", "نژاد جوجه"],
  ["cooling-systems", "سیستم‌های سرمایشی"],
  ["diseases", "بیماری‌ها"],
  ["feed-types", "انواع خوراک"],
  ["feeder-types", "انواع دانخوری"],
  ["floor-types", "انواع کفپوش"],
  ["heating-systems", "سیستم‌های گرمایشی"],
  ["lighting-systems", "سیستم‌های روشنایی"],
  ["medicines", "داروها"],
  ["suggestion-types", "انواع پیشنهاد"],
  ["vaccines", "واکسن‌ها"],
  ["ventilation-types", "سیستم‌های تهویه"],
  ["water-inlet-types", "سیستم‌های ورودی بهداشتی (آب)"],
  ["waterer-types", "انواع آبخوری"],
  ["unit-statuses", "وضعیت واحد"],
  ["customer-types", "انواع مشتری"],
  ["breed-standards", "استانداردهای وزنی نژاد"],
];

const DICTIONARY = [];
DICTIONARY_TABLES.forEach(([table, title]) => {
  DICTIONARY.push(item(`dictionary.${table}.view`, `مشاهدهٔ «${title}»`, D.all));
  DICTIONARY.push(
    item(`dictionary.${table}.edit`, `مدیریت «${title}» (ایجاد/ویرایش/حذف)`, D.manager),
  );
});

// ============================================================
// ۱۴) پنل ادمین — تنظیمات، تغییرات جدید، نظرات
// ============================================================
const ADMIN_SETTINGS = [
  item("settings.view", "مشاهدهٔ تنظیمات سیستم", D.all),
  item("settings.edit", "ویرایش تنظیمات سیستم", D.admin),
  item("releases.view", "مشاهدهٔ «تغییرات جدید» (مدیریتی)", D.admin),
  item("releases.manage", "ساخت/ویرایش/انتشار/آرشیو/حذف نسخه", D.owner, {
    risk: "high",
    lockedTo: ["super_admin"],
  }),
  item("suggestions.admin.view", "مشاهدهٔ نظرات و پیشنهادات کاربران", D.admin),
  item("suggestions.reply", "پاسخ به کاربر", D.admin),
  item("suggestions.status", "تغییر وضعیت گفتگو", D.admin),
  item("suggestions.delete", "حذف پیام/گفتگو", D.admin),
];

// ============================================================
// ۱۵) واحدها و کارشناسان
// ============================================================
const UNITS = [
  item("units.view", "مشاهدهٔ واحدهای مرغداری", D.all),
  item("units.create", "ثبت واحد مرغداری", D.all),
  item("units.edit", "ویرایش واحد مرغداری", D.all),
  item("units.delete", "حذف واحد مرغداری", D.all),
  item("units.toggle", "فعال/غیرفعال‌کردن واحد", D.all),
  item("units.experts", "تعیین/ویرایش/حذف کارشناسان واحد", D.all),
];

// ============================================================
// ۱۶) پنل مدیریت — کلیدهای «منو»
// ------------------------------------------------------------
// چرا جدا؟ چون نمایش/مخفی‌بودن هر منوی سایدبار باید مستقل از
// کلیدهای «محتوایی» آن بخش باشد؛ قبلاً منوی دیکشنری‌ها با کلید یک
// جدول (dictionary.hall-types.view) گیت شده بود و خاموش‌کردن همان
// یک جدول، کل منو را ناپدید می‌کرد.
// ============================================================
const ADMIN_MENUS = [
  item("admin.menu.superAdmins", "منوی «مدیریت مدیران اصلی»", D.owner),
  item("admin.menu.users", "منوی «مدیریت کاربران»", D.admin),
  // ✅ فاز ۱۳.۶: منوی «درخواست‌های ثبت‌نام» (کلید محتوایی: users.registrations.view)
  item("admin.menu.registrations", "منوی «درخواست‌های ثبت‌نام»", D.admin),
  item("admin.menu.dictionary", "منوی «مدیریت دیکشنری‌ها»", D.all),
  item("admin.menu.roles", "منوی «مدیریت نقش‌ها»", D.admin),
  item("admin.menu.settings", "منوی «تنظیمات سیستم»", D.all),
  item("admin.menu.suggestions", "منوی «نظرات و پیشنهادات»", D.admin),
  item("admin.menu.releases", "منوی «تغییرات و اطلاع‌رسانی»", D.admin),
  // فاز ۱۲.۳: پنل «فعالیت کاربران» (ردّ فعالیت)
  //   ⚠️ کلیدِ محتوایی این بخش users.activity.view است (گروه «مدیریت کاربران»)؛
  //   این کلید فقط نمایش/مخفی‌بودن منو را کنترل می‌کند (طبق توضیح بالای همین گروه).
  item("admin.menu.activity", "منوی «فعالیت کاربران»", D.admin),
  // ✅ موج ۱۳.۱۱: منوی «درخواست‌های پورتال» (کلید محتوایی: portal.requests.view)
  item(
    "admin.menu.portalRequests",
    "منوی «درخواست‌های پورتال» (صف تأیید درخواست‌های مشتری)",
    D.admin,
  ),
];

// ============================================================
// ✅ ۱۷) پنل مدیریت — صف «درخواست‌های پورتال» (موج ۱۳.۱۱)
// ------------------------------------------------------------
//  چرا گروه جدا؟
//   «کارشناس تأیید می‌کند» یعنی ممکن است بخواهیم به نقش expert هم
//   این کلید را بدهیم — بدون دادن هیچ کلید مدیریتی دیگری. اگر این
//   دو کلید داخل گروه «مدیریت کاربران» می‌رفتند، چنین تفکیکی سخت
//   می‌شد. پیش‌فرض:
//     • view   → D.all  (کارشناس هم صف را می‌بیند)
//     • review → D.admin (تأیید/رد؛ از ماتریس نقش‌ها به کارشناس هم
//       قابل دادن است)
// ============================================================
const PORTAL_REQUESTS = [
  item(
    "portal.requests.view",
    "مشاهدهٔ صف درخواست‌های مشتریان (واحد/سالن/جوجه‌ریزی)",
    D.all,
  ),
  item(
    "portal.requests.review",
    "تأیید یا رد درخواست‌های مشتری و اعمال آن‌ها در داده‌ها",
    D.admin,
  ),
];

// ============================================================
// رجیستری گروه‌ها (ترتیب نمایش در پنل ادمین همین است)
// ============================================================
const PERMISSION_GROUPS = [
  { key: "dashboard", title: "داشبورد", icon: "fa-chart-bar", items: DASHBOARD },
  { key: "customers", title: "مشتریان (لیست و ثبت‌نام)", icon: "fa-users", items: CUSTOMERS },
  {
    key: "customer.basic",
    title: "پروفایل مشتری — اطلاعات پایه و واحدها",
    icon: "fa-user",
    items: CUSTOMER_BASIC,
  },
  // ✅ فاز ۱۳.۲ — پورتال مشتری (فقط نقش «مشتری»)
  { key: "portal", title: "پورتال مشتری", icon: "fa-door-open", items: PORTAL },
  { key: "halls", title: "سالن‌ها", icon: "fa-warehouse", items: HALLS },
  { key: "hatchery", title: "جوجه‌ریزی", icon: "fa-egg", items: HATCHERY },
  { key: "weekly", title: "مدیریت هفتگی", icon: "fa-chart-line", items: WEEKLY },
  { key: "visit", title: "گزارش بازدید", icon: "fa-clipboard-list", items: VISIT },
  { key: "charts", title: "نمودارها و تحلیل", icon: "fa-chart-pie", items: CHARTS },
  { key: "sms", title: "پیامک", icon: "fa-sms", items: SMS },
  { key: "bookmarks", title: "بوکمارک‌ها", icon: "fa-bookmark", items: BOOKMARKS },
  { key: "adminUsers", title: "پنل مدیریت — کاربران", icon: "fa-user-shield", items: ADMIN_USERS },
  { key: "adminRoles", title: "پنل مدیریت — نقش‌ها و سطوح دسترسی", icon: "fa-user-tag", items: ADMIN_ROLES },
  { key: "dictionary", title: "پنل مدیریت — دیکشنری‌ها", icon: "fa-book", items: DICTIONARY },
  {
    key: "adminSettings",
    title: "پنل مدیریت — تنظیمات، تغییرات و نظرات",
    icon: "fa-cog",
    items: ADMIN_SETTINGS,
  },
  { key: "units", title: "واحدها و کارشناسان", icon: "fa-building", items: UNITS },
  // ✅ موج ۱۳.۱۱ — صف تأیید درخواست‌های مشتری (پورتال ⇒ دادهٔ واقعی)
  {
    key: "portalRequests",
    title: "پنل مدیریت — درخواست‌های پورتال",
    icon: "fa-clipboard-check",
    items: PORTAL_REQUESTS,
  },
  {
    key: "adminMenus",
    title: "پنل مدیریت — منوها (نمایش/مخفی)",
    icon: "fa-bars",
    items: ADMIN_MENUS,
  },
];

// ===== نمای تخت (کلید → آیتم) =====
const PERMISSIONS = {};
const PERMISSION_KEYS = [];

PERMISSION_GROUPS.forEach((group) => {
  group.items.forEach((entry) => {
    if (PERMISSIONS[entry.key]) {
      throw new Error(`[permissions] کلید تکراری در کاتالوگ: ${entry.key}`);
    }
    ROLES.forEach((role) => {
      if (typeof entry.defaults?.[role] !== "boolean") {
        throw new Error(
          `[permissions] پیش‌فرض نقش «${role}» برای «${entry.key}» تعیین نشده است`,
        );
      }
    });
    PERMISSIONS[entry.key] = {
      ...entry,
      group: group.key,
      groupTitle: group.title,
      lockedTo: Array.isArray(entry.lockedTo) ? entry.lockedTo : [],
    };
    PERMISSION_KEYS.push(entry.key);
  });
});

// ===== کمکی‌ها =====

// آیا این کلید در کاتالوگ هست؟
const isValidPermission = (key) =>
  Object.prototype.hasOwnProperty.call(PERMISSIONS, key);

// پیش‌فرض یک نقش برای یک کلید
const defaultFor = (role, key) => Boolean(PERMISSIONS[key]?.defaults?.[role]);

// آیا این مجوز برای این نقش «قفل» است؟ (فقط نقش‌های lockedTo می‌توانند داشته باشند)
const isLockedFor = (role, key) => {
  const lockedTo = PERMISSIONS[key]?.lockedTo || [];
  return lockedTo.length > 0 && !lockedTo.includes(role);
};

// آیا این مجوز برای این نقش «همیشه روشن» است؟ (ضدقفل‌شدنِ خودِ سوپرادمین)
const isAlwaysOnFor = (role, key) => {
  const alwaysOnFor = PERMISSIONS[key]?.alwaysOnFor || [];
  return alwaysOnFor.includes(role);
};

// لیست کلیدهای قفل‌شده (برای UI و تست‌ها)
const LOCKED_PERMISSION_KEYS = PERMISSION_KEYS.filter(
  (key) => (PERMISSIONS[key].lockedTo || []).length > 0,
);

module.exports = {
  ROLES,
  ROLE_TITLES,
  PERMISSION_GROUPS,
  PERMISSIONS,
  PERMISSION_KEYS,
  LOCKED_PERMISSION_KEYS,
  isValidPermission,
  defaultFor,
  isLockedFor,
  isAlwaysOnFor,
  TOTAL_PERMISSIONS: PERMISSION_KEYS.length,
};
