// ============================================================
//  گارد «پنل فعالیت کاربران» (Activity Log UI) — فاز ۱۲.۳
// ------------------------------------------------------------
//  ریشهٔ باگی که این گارد از بازگشتش جلوگیری می‌کند:
//    ردّ فعالیت در ۱۲.۲ روی API بود ولی هیچ‌جا دیده نمی‌شد
//    («چه کسی این رکورد را عوض کرد؟» فقط با curl پاسخ داشت).
//
//  چه چیزی سنجیده می‌شود؟
//    ۱) منطق خالص: buildQuery (⭐ success=false گم نشود) · validateFilters ·
//       activeFilterCount · timeAgo فارسی · actorLabel · fieldsChips ·
//       buildActionOptions · buildCsv (⭐ BOM + escape) · deepLinkFor
//    ۲) رندرر: اسکلت با همهٔ idها · escape شدن HTML تزریقی · حالت خالی ·
//       صفحه‌بندی · کارت خلاصه · مودال جزئیات
//    ۳) ⭐ نبودِ session_id در هیچ خروجی UI (همان قاعدهٔ ۱۲.۲)
//    ۴) سیم‌کشی پنل: منوی data-permission · سکشن · کلید منو در
//       menuPermissions · case activity-log · لود داینامیک مدیر
//    ۵) بدون polling (setInterval) در مدیر + بدون fetch خام
//    ۶) کاتالوگ/گیت/مستندات: کلید admin.menu.activity · عدد ۱۶۶ ·
//       ثبت test:activity:panel در دو gate runner · REVIEW-WAVE-12.3
//
//  اجرا:  npm run test:activity:panel        (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (relPath) => {
  try {
    return fs
      .readFileSync(path.join(ROOT, relPath), "utf8")
      .replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};

const loadModule = (relFromSrc) =>
  import(pathToFileURL(path.join(here, "src", relFromSrc)).href);

const view = await loadModule("features/activity-log/activity-log.view.js");
const renderer = await loadModule("features/activity-log/activity-log.renderer.js");

// ===== نمونهٔ ردیف (هم‌شکل خروجی rules.buildItem در بک‌اند) =====
const ITEM = {
  id: 12,
  at: "2026-02-01T10:00:00.000Z",
  seconds_ago: 3725,
  action: "update",
  action_title: "ویرایش",
  method: "PUT",
  path: "/api/customers/34",
  route: "/api/customers/:id",
  entity: "customers",
  entity_title: "مشتری",
  entity_id: "34",
  status_code: 200,
  success: true,
  status_label: "موفق",
  actor: { id: 3, username: "ali", role: "admin" },
  ip: "127.0.0.1",
  user_agent: "Mozilla/5.0",
  fields: ["first_name", "mobile_number"],
  summary: "ویرایش مشتری 34",
  duration_ms: 42,
};

const ITEM_FAILED = {
  ...ITEM,
  id: 13,
  action: "login",
  action_title: "ورود",
  entity: "auth",
  entity_title: "احراز هویت",
  entity_id: null,
  success: false,
  status_label: "ناموفق",
  status_code: 401,
  actor: { id: null, username: null, role: null },
  fields: null,
  seconds_ago: 5,
};

// ============================================================
// ۱) منطق خالص — ساخت کوئری از فیلترها
// ============================================================
check(
  "buildQuery: فیلتر خالی فقط page و limit می‌فرستد",
  (() => {
    const q = view.buildQuery({});
    return Object.keys(q).length === 2 && q.page === 1 && q.limit === 25;
  })(),
);

check(
  "⭐ buildQuery: success=false به‌صورت boolean می‌رود (با if ساده گم می‌شد)",
  (() => {
    const q = view.buildQuery({ success: "false" });
    return q.success === false && typeof q.success === "boolean";
  })(),
);

check(
  "buildQuery: success=true فرستاده می‌شود و مقدار خالی فرستاده نمی‌شود",
  view.buildQuery({ success: "true" }).success === true &&
    !("success" in view.buildQuery({ success: "" })),
);

check(
  "buildQuery: userId عددی تبدیل و مقدار نامعتبر/صفر حذف می‌شود",
  view.buildQuery({ userId: " 7 " }).userId === 7 &&
    !("userId" in view.buildQuery({ userId: "abc" })) &&
    !("userId" in view.buildQuery({ userId: "0" })),
);

check(
  "buildQuery: entity/entityId/from/to (رشته) عبور می‌کنند",
  (() => {
    const q = view.buildQuery({
      entity: "customers",
      entityId: "34",
      from: "2026-01-01",
      to: "2026-02-01",
    });
    return (
      q.entity === "customers" &&
      q.entityId === "34" &&
      q.from === "2026-01-01" &&
      q.to === "2026-02-01"
    );
  })(),
);

check(
  "buildQuery: صفحه/تعداد نامعتبر به پیش‌فرض برمی‌گردد",
  (() => {
    const q = view.buildQuery({}, { page: -3, limit: 0 });
    return q.page === 1 && q.limit === 25;
  })(),
);

check(
  "validateFilters: شناسهٔ کاربر غیرعددی و بازهٔ معکوس را می‌گیرد",
  view.validateFilters({ userId: "abc" }).length === 1 &&
    view.validateFilters({ from: "2026-03-01", to: "2026-01-01" }).length === 1,
);

check(
  "validateFilters: فیلتر درست هیچ خطایی ندارد",
  view.validateFilters({ userId: "5", from: "2026-01-01", to: "2026-02-01" })
    .length === 0,
);

// ===== ⭐ موج ۱۲.۴.۲: فیلتر تاریخ شمسی (پنل) =====
check(
  "⭐ persianDateFilterToIso: «۱۴۰۴/۰۸/۱۲» ⇒ 2025-11-03 (تبدیل دقیق، نه تقریبی)",
  view.persianDateFilterToIso("۱۴۰۴/۰۸/۱۲") === "2025-11-03" &&
    view.persianDateFilterToIso("1404/08/12") === "2025-11-03" &&
    view.persianDateFilterToIso(" 1404/8/12 ") === "2025-11-03",
  `got=${view.persianDateFilterToIso("۱۴۰۴/۰۸/۱۲")}`,
);

check(
  "⭐ persianDateFilterToIso: ISO میلادی دست‌نخورده می‌ماند (خط تیره = میلادی)",
  view.persianDateFilterToIso("2025-11-03") === "2025-11-03",
);

check(
  "⭐ persianDateFilterToIso: خالی ⇒ خالی · نامعتبر ⇒ خام (برای خطای روشن)",
  view.persianDateFilterToIso("") === "" &&
    view.persianDateFilterToIso(null) === "" &&
    view.persianDateFilterToIso("abc") === "abc" &&
    // ۱۴۰۴ کبیسه نیست ⇒ اسفند ۳۰ روز ندارد
    view.persianDateFilterToIso("1404/12/30") === "1404/12/30",
);

check(
  "⭐ validateFilters: تاریخ شمسی/نامعتبر رد می‌شود (بازهٔ غلط بی‌سرصدا به API نمی‌رود)",
  view.validateFilters({ from: "1404/08/12" }).length === 1 &&
    view.validateFilters({ to: "1404/08/12" }).length === 1 &&
    view.validateFilters({ from: "۱۴۰۴/۰۸/۱۲" }).length === 1 &&
    view.validateFilters({ from: "2025-11-03", to: "2025-11-01" }).length === 1,
);

check(
  "activeFilterCount: تعداد فیلترهای پرشده را می‌شمارد",
  view.activeFilterCount({}) === 0 &&
    view.activeFilterCount({ action: "login", success: "false" }) === 2,
);

// ============================================================
// ۲) نمایش‌های متنی (فارسی)
// ============================================================
check(
  "⭐ timeAgo: دقیقه/ساعت/روز/ماه با رقم فارسی",
  view.timeAgo(30) === "چند لحظه پیش" &&
    view.timeAgo(60) === "۱ دقیقه پیش" &&
    view.timeAgo(3725) === "۱ ساعت پیش" &&
    view.timeAgo(86400 * 3) === "۳ روز پیش" &&
    view.timeAgo(86400 * 65) === "۲ ماه پیش",
);

check(
  "timeAgo: مقدار نامعتبر/منفی «—» می‌شود (نه NaN پیش)",
  view.timeAgo(null) === "—" &&
    view.timeAgo(-5) === "—" &&
    view.timeAgo("x") === "—",
);

check(
  "actorLabel: کاربر بدون نقش و کاربر ناشناس درست نمایش داده می‌شوند",
  view.actorLabel({ username: "sara" }) === "sara" &&
    view.actorLabel({ username: "ali", role: "admin" }) === "ali (مدیر)" &&
    view.actorLabel({}) === "ناشناس" &&
    view.actorLabel(null) === "ناشناس",
);

check(
  "fieldsChips: آرایه/آبجکت/تهی ⇒ فهرست نام فیلدها",
  JSON.stringify(view.fieldsChips(["a", "b"])) === '["a","b"]' &&
    JSON.stringify(view.fieldsChips({ a: "***", b: "***" })) === '["a","b"]' &&
    view.fieldsChips(null).length === 0,
);

check(
  "buildActionOptions: عنوان فارسی + شمارش سرور + انتخاب فعلی",
  (() => {
    const options = view.buildActionOptions({ login: 4 }, "login");
    const login = options.find((o) => o.value === "login");
    const create = options.find((o) => o.value === "create");
    return (
      options.length === 6 &&
      login.label === "ورود" &&
      login.count === 4 &&
      login.selected === true &&
      create.selected === false &&
      create.count === 0
    );
  })(),
);

check(
  "buildActionOptions: اقدام ناشناسِ سرور هم به فهرست اضافه می‌شود",
  view
    .buildActionOptions({ purge: 2 })
    .some((o) => o.value === "purge" && o.label === "purge" && o.count === 2),
);

// ============================================================
// ۳) خروجی CSV (اکسل فارسی)
// ============================================================
const csv = view.buildCsv([ITEM, ITEM_FAILED]);

check(
  "⭐ buildCsv: با BOM شروع می‌شود (وگرنه اکسل فارسی را خراب می‌خواند)",
  csv.charCodeAt(0) === 0xfeff,
  `first=U+${csv.charCodeAt(0).toString(16).toUpperCase()}`,
);

check(
  "buildCsv: سرسطر + یک ردیف برای هر رویداد با CRLF",
  csv.split("\r\n").length === 3 && csv.includes("شناسه,زمان,کاربر"),
);

check(
  "buildCsv: نام و نقش کاربر و رویداد بدون بازیگر («ناشناس») هست",
  csv.includes("ali") && csv.includes("مدیر") && csv.includes("ناشناس"),
);

check(
  "⭐ buildCsv: ویرگول/گیومه در متن escape می‌شود (ستون‌ها جابه‌جا نمی‌شوند)",
  view
    .buildCsv([{ ...ITEM, summary: 'گفت "سلام", تمام' }])
    .includes('"گفت ""سلام"", تمام"'),
);

check(
  "buildCsv: هیچ undefined/null در خروجی نیست",
  !csv.includes("undefined") && !csv.includes("null"),
);

// ============================================================
// ۴) لینک رکورد هدف (بدون لینک مرده)
// ============================================================
check(
  "deepLinkFor: مشتری ⇒ لینک پرونده با شناسه",
  view.deepLinkFor(ITEM)?.href === "/pages/customer-info.html?id=34",
);

check(
  "deepLinkFor: مجوز مقصد لازم است (can=false ⇒ بدون لینک)",
  view.deepLinkFor(ITEM, () => false) === null,
);

check(
  "⭐ deepLinkFor: موجودیت بدون صفحهٔ مقصد ⇒ تهی (لینک مرده ساخته نمی‌شود)",
  view.deepLinkFor(ITEM_FAILED) === null,
);

check(
  "deepLinkFor: شناسهٔ تهی ⇒ تهی",
  view.deepLinkFor({ ...ITEM, entity_id: "" }) === null,
);

// ============================================================
// ۵) رندرر — اسکلت
// ============================================================
const shell = renderer.renderShell();
const SHELL_IDS = [
  "alpSummary",
  "alpAction",
  "alpSuccess",
  "alpUserId",
  "alpEntity",
  "alpEntityId",
  "alpFrom",
  "alpTo",
  "alpLimit",
  "alpApply",
  "alpReset",
  "alpRefresh",
  "alpExport",
  "alpFilterCount",
  "alpStatus",
  "alpTableWrap",
  "alpPager",
  "alpDetailModal",
  "alpDetailBody",
  "alpDetailClose",
];

check(
  "رندرر: اسکلت همهٔ idهای لازم را دارد",
  SHELL_IDS.every((id) => shell.includes(`id="${id}"`)),
  `missing=${SHELL_IDS.filter((id) => !shell.includes(`id="${id}"`)).join(",")}`,
);

// ===== ⭐ موج ۱۲.۴.۲: ورودی تاریخ باید متنیِ شمسی باشد، نه تاریخ گریگوری مرورگر =====
const dateInputs = shell.match(/<input[\s\S]*?id="alp(?:From|To)"[\s\S]*?>/g) || [];
check(
  "⭐ رندرر: فیلتر تاریخ ورودیِ متنی شمسی است (type=text + placeholder شمسی + autocomplete=off)",
  dateInputs.length === 2 &&
    dateInputs.every(
      (tag) =>
        /type="text"/.test(tag) &&
        /placeholder="[۰-۹]{4}\/[۰-۹]{2}\/[۰-۹]{2}"/.test(tag) &&
        /autocomplete="off"/.test(tag),
    ) &&
    !/type="date"/.test(shell),
  `inputs=${dateInputs.length}`,
);

check(
  "⭐ رندرر: برچسب فیلتر تاریخ «(شمسی)» است تا کاربر بداند چه می‌نویسد",
  (shell.match(/از تاریخ \(شمسی\)/g) || []).length === 1 &&
    (shell.match(/تا تاریخ \(شمسی\)/g) || []).length === 1,
);

check(
  "رندرر: گزینهٔ «تعداد در صفحه» فقط ۲۵/۵۰/۱۰۰ است (سقف سرور ۱۰۰)",
  (() => {
    const block =
      (shell.match(/<select id="alpLimit">([\s\S]*?)<\/select>/) || [])[1] || "";
    return (
      ["25", "50", "100"].every((v) => block.includes(`value="${v}"`)) &&
      (block.match(/<option/g) || []).length === 3
    );
  })(),
);

check(
  "رندرر: فیلتر وضعیت هر سه حالت (همه/موفق/ناموفق) را دارد",
  shell.includes('id="alpSuccess"') &&
    shell.includes('value="true"') &&
    shell.includes('value="false"') &&
    shell.includes('value=""'),
);

// ============================================================
// ۶) رندرر — جدول
// ============================================================
const table = renderer.renderTable([ITEM, ITEM_FAILED], { can: () => true });

check(
  "رندرر جدول: هر ردیف data-activity-id دارد (مودال روی همین باز می‌شود)",
  table.includes('data-activity-id="12"') &&
    table.includes('data-activity-id="13"'),
);

check(
  "رندرر جدول: موفق/ناموفق با کلاس badge درست رنگ می‌گیرد",
  table.includes("alp-badge-success") && table.includes("alp-badge-danger"),
);

check(
  "رندرر جدول: لینک پرونده فقط برای موجودیت مشتری ساخته می‌شود",
  table.includes('href="/pages/customer-info.html?id=34"') &&
    table.includes('<span class="alp-muted">—</span>'),
);

check(
  "رندرر جدول: زمان نسبی و مطلق هر دو نمایش داده می‌شوند",
  table.includes("alp-time-abs") && table.includes("alp-time-rel"),
);

check(
  "⭐ رندرر جدول: HTML تزریقی در summary/entity_title خنثی می‌شود",
  (() => {
    const evil = renderer.renderTable([
      {
        ...ITEM,
        summary: '<img src=x onerror="alert(1)">',
        entity_title: "<script>alert(1)</script>",
      },
    ]);
    return (
      !evil.includes("<img src=x") &&
      !evil.includes("<script>") &&
      evil.includes("&lt;img")
    );
  })(),
);

check(
  "رندرر جدول: فهرست خالی ⇒ پیام قابل‌فهم (نه جدول خالی)",
  renderer.renderTable([]).includes("رویدادی با این فیلترها پیدا نشد"),
);

// ============================================================
// ۷) رندرر — صفحه‌بندی / خلاصه / مودال
// ============================================================
const pagerFirst = renderer.renderPager({ total: 60, total_pages: 3 }, 1);
const pagerLast = renderer.renderPager({ total: 60, total_pages: 3 }, 3);
const buttonOf = (html, page) =>
  (html.match(new RegExp(`<button[^>]*data-page="${page}"[^>]*>`)) || [])[0] || "";

check(
  "رندرر صفحه‌بندی: در صفحهٔ اول «قبلی» غیرفعال است",
  buttonOf(pagerFirst, 0).includes("disabled") &&
    !buttonOf(pagerFirst, 2).includes("disabled"),
);

check(
  "رندرر صفحه‌بندی: در صفحهٔ آخر «بعدی» غیرفعال است",
  buttonOf(pagerLast, 4).includes("disabled") &&
    !buttonOf(pagerLast, 2).includes("disabled"),
);

check(
  "رندرر صفحه‌بندی: شمارهٔ صفحه/تعداد کل با رقم فارسی نمایش داده می‌شود",
  pagerFirst.includes("صفحهٔ ۱ از ۳") && pagerFirst.includes("۶۰ ردیف"),
);

const summaryHtml = renderer.renderSummary({
  total: 10,
  success: 7,
  failed: 3,
  unique_actors: 4,
  retention_days: 180,
  generated_at: ITEM.at,
});

check(
  "رندرر خلاصه: چهار کارت (کل/موفق/ناموفق/کاربران یکتا) با رقم فارسی",
  ["۱۰", "۷", "۳", "۴"].every((value) => summaryHtml.includes(value)) &&
    summaryHtml.includes("alp-stat-total") &&
    summaryHtml.includes("alp-stat-failed"),
);

check(
  "رندرر خلاصه: پنجرهٔ نگهداشت و زمان محاسبه نمایش داده می‌شود",
  summaryHtml.includes("نگهداشت ۱۸۰ روز") &&
    summaryHtml.includes("آخرین محاسبه"),
);

check(
  "رندرر خلاصه: خلاصهٔ خالی/نامعتبر پیام جایگزین می‌دهد (بدون NaN)",
  renderer.renderSummary(null).includes("خلاصهٔ آماری در دسترس نیست") &&
    !renderer.renderSummary({ total: "x" }).includes("NaN"),
);

const detailHtml = renderer.renderDetail(ITEM, { can: () => true });

check(
  "رندرر مودال: فیلدهای تغییرکرده، مرورگر و مسیر ثبت‌شده را نشان می‌دهد",
  detailHtml.includes("first_name") &&
    detailHtml.includes("Mozilla/5.0") &&
    detailHtml.includes("/api/customers/:id") &&
    detailHtml.includes("alp-detail-row"),
);

check(
  "⭐ مودال: session_id هرگز در UI نمی‌آید (قاعدهٔ حریم خصوصی ۱۲.۲)",
  !detailHtml.toLowerCase().includes("session_id"),
);

check(
  "رندرر مودال: رویداد ناموجود پیام خطا می‌دهد (نه صفحهٔ سفید)",
  renderer.renderDetail(null).includes("alp-notice-error"),
);

// ============================================================
// ۸) ⭐ نبودِ session_id در همهٔ فایل‌های UI
// ============================================================
const UI_FILES = [
  "Frontend/src/features/activity-log/activity-log.view.js",
  "Frontend/src/features/activity-log/activity-log.renderer.js",
  "Frontend/src/features/activity-log/activity-log.manager.js",
];
check(
  "⭐ حریم خصوصی: هیچ فایل UI به session_id اشاره نمی‌کند",
  UI_FILES.every((file) => read(file).length > 0) &&
    UI_FILES.every((file) => !read(file).toLowerCase().includes("session_id")),
  `files=${UI_FILES.length}`,
);

// ============================================================
// ۹) سیم‌کشی پنل ادمین (HTML + سرویس)
// ============================================================
const adminHtml = read("Frontend/src/pages/admin-panel.html");
const panelService = read(
  "Frontend/src/features/admin-panel/admin-panel.service.js",
);
const managerSrc = read("Frontend/src/features/activity-log/activity-log.manager.js");

check(
  "پنل: آیتم سایدبار با data-menu و کلید منو اضافه شده است",
  adminHtml.includes('data-menu="activity-log"') &&
    adminHtml.includes('data-permission="admin.menu.activity"'),
);

check(
  "پنل: سکشن #activity-log با کانتینر واقعی وجود دارد (نه جای‌خالی)",
  adminHtml.includes('id="activity-log" class="content-section"') &&
    adminHtml.includes('id="activityLogContainer"'),
);

check(
  "پنل: CSS بخش در <head> لود می‌شود",
  adminHtml.includes('/features/activity-log/activity-log.css'),
);

check(
  "پنل: آیتم «فعالیت کاربران» بعد از «تغییرات و اطلاع‌رسانی» قرار گرفته",
  adminHtml.indexOf('data-menu="activity-log"') >
    adminHtml.indexOf('data-menu="release-notes"') &&
    adminHtml.indexOf('data-menu="activity-log"') >
    0,
);

check(
  "سرویس پنل: کلید منو در menuPermissions ثبت شده است",
  panelService.includes('"activity-log": "admin.menu.activity"'),
);

check(
  "سرویس پنل: case activity-log مدیر را راه‌اندازی می‌کند",
  panelService.includes('case "activity-log"') &&
    panelService.includes("initActivityLogManager(") &&
    panelService.includes('import("../activity-log/activity-log.manager.js")'),
);

check(
  "سرویس پنل: در این بخش polling نظرات متوقف می‌شود (ضد درخواست اضافه)",
  /case "activity-log":[\s\S]{0,220}stopSuggestionsPolling\(\)/.test(panelService),
);

check(
  "مدیر: از activityService استفاده می‌کند و fetch خام ندارد",
  managerSrc.includes('from "../../core/services/activity.service.js"') &&
    managerSrc.includes("activityService.list(") &&
    managerSrc.includes("activityService.summary(") &&
    managerSrc.includes("activityService.getById(") &&
    !managerSrc.includes("fetch("),
);

check(
  "مدیر: بدون setInterval/setTimeout (بدون تازه‌سازی خودکار سنگین)",
  !managerSrc.includes("setInterval(") && !managerSrc.includes("setTimeout("),
);

check(
  "مدیر: لینک رکورد با مجوز مقصد گیت می‌شود (can تزریق می‌شود)",
  managerSrc.includes("can: (key) => this.can(key)") &&
    managerSrc.includes("permissionService"),
);

check(
  "مدیر: نقطهٔ ورود موج ۱۲.۴ (openEntityHistory) وجود دارد",
  managerSrc.includes("openEntityHistory(entity, entityId)"),
);

// ============================================================
// ۱۰) کاتالوگ مجوز + هم‌خوانی عددها (ضد شکنندگیِ سه‌فایلی)
// ============================================================
const catalog = require(path.join(ROOT, "Backend", "config", "permissions.js"));
const permissionsTest = read("Backend/permissions-test.mjs");
const declaredTotal = Number(
  (permissionsTest.match(/TOTAL_PERMISSIONS === (\d+)/) || [])[1],
);

check(
  "کاتالوگ: کلید admin.menu.activity وجود دارد و قفل‌نشده است",
  Boolean(catalog.PERMISSIONS["admin.menu.activity"]) &&
    catalog.PERMISSIONS["admin.menu.activity"].lockedTo.length === 0,
);

check(
  "کاتالوگ: منوی فعالیت فقط برای مدیران روشن است (کارشناس/مشتری خاموش)",
  catalog.defaultFor("super_admin", "admin.menu.activity") === true &&
    catalog.defaultFor("admin", "admin.menu.activity") === true &&
    catalog.defaultFor("sub_admin", "admin.menu.activity") === true &&
    catalog.defaultFor("expert", "admin.menu.activity") === false &&
    catalog.defaultFor("customer", "admin.menu.activity") === false,
);

check(
  "کاتالوگ: کلید محتوایی users.activity.view هم‌چنان روشنِ مدیران است",
  catalog.defaultFor("admin", "users.activity.view") === true &&
    catalog.defaultFor("customer", "users.activity.view") === false,
);

check(
  "کاتالوگ: تعداد کلیدها با فهرست کلیدها یکی است (کلید جدید گم نشده)",
  catalog.TOTAL_PERMISSIONS === catalog.PERMISSION_KEYS.length &&
    catalog.PERMISSION_KEYS.includes("admin.menu.activity"),
  `keys=${catalog.TOTAL_PERMISSIONS}`,
);

check(
  "کاتالوگ: عدد اعلام‌شده در permissions-test با کاتالوگ هم‌خوان است",
  declaredTotal === catalog.TOTAL_PERMISSIONS,
  `declared=${declaredTotal} actual=${catalog.TOTAL_PERMISSIONS}`,
);

check(
  "گاردها: session-guard-test عدد ثابت ۱۶۵ ندارد (به مقایسهٔ پویا منتقل شد)",
  !read("Frontend/session-guard-test.mjs").includes("TOTAL_PERMISSIONS === 165") &&
    read("Frontend/session-guard-test.mjs").includes("declaredTotal"),
);

check(
  "گاردها: activity-guard-test عدد ثابت ۱۶۵/۱۶۴ ندارد",
  !/TOTAL_PERMISSIONS === 16[45]/.test(read("Frontend/activity-guard-test.mjs")) &&
    read("Frontend/activity-guard-test.mjs").includes("declaredTotalInTest"),
);

check(
  "گاردها: frontend-server-test سایدبار را با ۸ منو می‌سنجد",
  read("Frontend/frontend-server-test.mjs").includes('"admin.menu.activity"') &&
    read("Frontend/frontend-server-test.mjs").includes("۸ کلید admin.menu.*"),
);

// ============================================================
// ۱۱) ثبت در گیت + مستندات
// ============================================================
const fePkg = read("Frontend/package.json");
const gateMjs = read("tools/gate.mjs");
const gatePs1 = read("tools/gate.ps1");

check(
  "گیت: اسکریپت test:activity:panel در package.json ثبت شده است",
  /"test:activity:panel":\s*"node activity-panel-guard-test\.mjs"/.test(fePkg),
);

check(
  "گیت: هر دو gate runner (mjs + ps1) این گارد را اجرا می‌کنند",
  gateMjs.includes("'test:activity:panel'") &&
    gatePs1.includes("'test:activity:panel'"),
);

check(
  "گیت: گارد بعد از test:activity (نه در ابتدا) ثبت شده است",
  gateMjs.indexOf("'test:activity:panel'") > gateMjs.indexOf("'test:activity'"),
);

check(
  "مستندات: REVIEW-WAVE-12.3.md با خلاصهٔ موج نوشته شده است",
  (() => {
    const doc = read("docs/REVIEW-WAVE-12.3.md");
    return (
      doc.length > 800 &&
      doc.includes("admin.menu.activity") &&
      doc.includes("test:activity:panel")
    );
  })(),
);

check(
  "مستندات: REVIEW-WAVE-12.md بخش «پنل فعالیت» را به ۱۲.۳ ارجاع می‌دهد",
  read("docs/REVIEW-WAVE-12.md").includes("12.3"),
);

check(
  "مستندات: README فرانت بخش «فعالیت کاربران» را معرفی می‌کند",
  read("Frontend/README.md").includes("فعالیت کاربران"),
);

// ============================================================
// ⭐ ۱۲.۴.۲ — تقویم شمسی فیلتر تاریخ (سیم‌کشی + کتابخانه)
// ============================================================
const adminPanelPage = read("Frontend/src/pages/admin-panel.html");
const dateUtils = await loadModule("core/utils/date.utils.js");

check(
  "⭐ ۱۲.۴.۲ سیم‌کشی: تقویم فیلترها در init راه‌اندازی می‌شود (قبل از اولین load)",
  managerSrc.includes("this.setupDatepickers();") &&
    managerSrc.indexOf("this.setupDatepickers();") <
      managerSrc.indexOf("await this.refresh();"),
);

check(
  "⭐ ۱۲.۴.۲ fail-soft: نبودِ jQuery/datepicker باعث خطا نمی‌شود",
  managerSrc.includes("window.$?.fn?.persianDatepicker") &&
    managerSrc.includes('input.placeholder = "۱۴۰۴/۰۱/۰۱"') &&
    managerSrc.includes("data-datepicker-initialized") &&
    managerSrc.includes("تقویم فیلتر تاریخ راه‌اندازی نشد"),
);

check(
  "⭐ ۱۲.۴.۲ یک منبع حقیقت: readFilters تاریخ را با persianDateFilterToIso تبدیل می‌کند",
  managerSrc.includes("persianDateFilterToIso(value(\"#alpFrom\"))") &&
    managerSrc.includes("persianDateFilterToIso(value(\"#alpTo\"))") &&
    !managerSrc.includes('String(value("#alpFrom"))'),
);

check(
  "⭐ ۱۲.۴.۲ نمایش: مقدار ISO ذخیره‌شده به تاریخ شمسی برگردانده می‌شود (پاک‌کردن/deep-link)",
  managerSrc.includes("convertGregorianToPersian(iso)") &&
    managerSrc.includes('setDate("#alpFrom", this.filters.from)') &&
    managerSrc.includes('setDate("#alpTo", this.filters.to)'),
);

check(
  "⭐ ۱۲.۴.۲ صفحه: persian-date قبل از persian-datepicker و هر دو بعد از jQuery",
  (() => {
    const jquery = adminPanelPage.indexOf("jquery.min.js");
    const core = adminPanelPage.indexOf("persian-date/dist/persian-date.min.js");
    const picker = adminPanelPage.indexOf("persian-datepicker/dist/js/persian-datepicker.min.js");
    return jquery > -1 && core > jquery && picker > core;
  })(),
  `jquery=${adminPanelPage.indexOf("jquery.min.js")}`,
);

check(
  "⭐ ۱۲.۴.۲ صفحه: CSS تقویم هم لود می‌شود (وگرنه تقویم بی‌استایل است)",
  adminPanelPage.includes("persian-datepicker/dist/css/persian-datepicker.min.css"),
);

check(
  "⭐ ۱۲.۴.۲ تبدیل تاریخ: fallback تقریبی (new Date(year - 621)) حذف شده است",
  !/new Date\(\s*year\s*-\s*621/.test(read("Frontend/src/core/utils/date.utils.js")) &&
    dateUtils.convertPersianToGregorian("۱۴۰۴/۰۸/۱۲") === "2025-11-03" &&
    dateUtils.convertPersianToGregorian("۱۴۰۳/۱۲/۳۰") === "2025-03-20" &&
    dateUtils.convertPersianToGregorian("1404/12/30") === null &&
    dateUtils.convertPersianToGregorian("1404/13/01") === null &&
    dateUtils.convertPersianToGregorian("abc") === null,
  `1404/08/12=${dateUtils.convertPersianToGregorian("۱۴۰۴/۰۸/۱۲")}`,
);

check(
  "⭐ ۱۲.۴.۲ تبدیل تاریخ: سال کبیسهٔ جلالی درست تشخیص داده می‌شود",
  dateUtils.isLeapJalaliYear(1403) === true &&
    dateUtils.isLeapJalaliYear(1404) === false &&
    dateUtils.jalaliMonthLength(1404, 12) === 29 &&
    dateUtils.jalaliMonthLength(1403, 12) === 30 &&
    dateUtils.jalaliMonthLength(1404, 7) === 30 &&
    dateUtils.jalaliMonthLength(1404, 1) === 31,
);
// ============================================================
// ⭐ موج ۱۲.۵ — «همهٔ تغییرات این مشتری»
// ------------------------------------------------------------
//  چه چیزی از بازگشتش جلوگیری می‌شود؟
//   ۱) فیلتر مشتری در پنل فراموش شود (کاربر «مشتری #N» را ببیند ولی
//      نتواند همهٔ تغییراتش را ببیند).
//   ۲) مقدار نامعتبر به کوئری برود (ستون INTEGER سمت سرور ⇒ ۵۰۰).
//   ۳) لینک رکورد برای سالن/گله/هفته‌نامه بدون customer_id ساخته شود
//      (لینک مرده به پرونده).
// ============================================================
check(
  "⭐ ۱۲.۵ view: فیلتر customerId در EMPTY_FILTERS هست",
  view.EMPTY_FILTERS.customerId === "",
);

check(
  "⭐ ۱۲.۵ view: buildQuery شناسهٔ مشتری را عددی می‌فرستد",
  (() => {
    const q = view.buildQuery({ customerId: " 12 " });
    return q.customerId === 12;
  })(),
);

check(
  "⭐ ۱۲.۵ view: مقدار نامعتبر مشتری به کوئری نمی‌رود (۰/متن/کاما)",
  ["0", "abc", "1,2", "-3", "1.5"].every(
    (value) => view.buildQuery({ customerId: value }).customerId === undefined,
  ),
);

check(
  "⭐ ۱۲.۵ view: validateFilters برای مشتریِ نامعتبر پیام می‌دهد",
  view.validateFilters({ customerId: "abc" }).length === 1 &&
    view.validateFilters({ customerId: "12" }).length === 0,
);

check(
  "⭐ ۱۲.۵ view: شمارندهٔ فیلترهای فعال customerId را می‌شمارد",
  view.activeFilterCount({ customerId: "12" }) === 1,
);

check(
  "⭐ ۱۲.۵ view: deepLinkFor برای سالن با customer_id به پروندهٔ مشتری می‌رود",
  (() => {
    const link = view.deepLinkFor({ entity: "halls", entity_id: "7", customer_id: 9 });
    return Boolean(link) && link.href === "/pages/customer-info.html?id=9";
  })(),
);

check(
  "⭐ ۱۲.۵ view: deepLinkFor بدون customer_id برای سالن لینک نمی‌سازد",
  view.deepLinkFor({ entity: "halls", entity_id: "7" }) === null,
);

check(
  "⭐ ۱۲.۵ view: deepLinkFor خود مشتری همان entity_id را هدف می‌گیرد",
  (() => {
    const link = view.deepLinkFor({
      entity: "customers",
      entity_id: "34",
      customer_id: 34,
    });
    return Boolean(link) && link.href === "/pages/customer-info.html?id=34";
  })(),
);

check(
  "⭐ ۱۲.۵ view: deepLinkFor با مجوز مقصد گیت می‌شود",
  view.deepLinkFor({ entity: "halls", customer_id: 9 }, () => false) === null,
);

check(
  "⭐ ۱۲.۵ رندرر: ورودی فیلتر مشتری در اسکلت پنل هست",
  renderer.renderShell({ can: () => true }).includes('id="alpCustomerId"'),
);

check(
  "⭐ ۱۲.۵ رندرر: ردیف دارای customer_id نشان «مشتری #N» می‌گیرد",
  (() => {
    const html = renderer.renderTable([{ ...ITEM, customer_id: 9 }], {
      can: () => true,
    });
    return html.includes("alp-customer-id") && html.includes("مشتری #۹");
  })(),
);

check(
  "⭐ ۱۲.۵ رندرر: ردیف بدون customer_id نشان مشتری ندارد",
  !renderer.renderTable([{ ...ITEM, customer_id: null }], {
    can: () => true,
  }).includes("alp-customer-id"),
);

check(
  "⭐ ۱۲.۵ رندرر: مودال جزئیات شناسهٔ مشتری را نشان می‌دهد",
  renderer
    .renderDetail({ ...ITEM, customer_id: 9 }, { can: () => true })
    .includes("شناسهٔ مشتری"),
);

check(
  "⭐ ۱۲.۵ مدیر: فیلتر مشتری خوانده و روی ورودی نشانده می‌شود",
  read("Frontend/src/features/activity-log/activity-log.manager.js").includes(
    '#alpCustomerId',
  ),
);

check(
  "⭐ ۱۲.۵ مدیر: زمینهٔ تاریخچه customerId را به فیلترها منتقل می‌کند",
  read("Frontend/src/features/activity-log/activity-log.manager.js").includes(
    "customerId: ctx.customerId ? String(ctx.customerId) : \"\"",
  ),
);




const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log("");
if (failed === 0) {
  console.log(`✅ ALL PASS — ${passed} بررسی نشست`);
} else {
  console.log(`❌ ${failed} بررسی ناموفق از ${results.length}`);
}
process.exitCode = failed === 0 ? 0 : 1;



