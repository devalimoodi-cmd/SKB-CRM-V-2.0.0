// ============================================================
//  گارد «تاریخچهٔ رکورد» (Entity History UI) — موج ۱۲.۴.۱
// ------------------------------------------------------------
//  ریشهٔ باگی که این گارد از بازگشتش جلوگیری می‌کند:
//    ردّ فعالیت در ۱۲.۳ فقط داخل پنل دیده می‌شد؛ برای پاسخ به
//    «چه کسی این رکورد را عوض کرد؟» باید منو باز می‌شد و فیلتر
//    دستی زده می‌شد ⇒ در عمل هیچ‌کس نمی‌زد.
//
//  چه چیزی سنجیده می‌شود؟
//    ۱) منطق خالص: historyContext (⭐ شناسهٔ خالی = null) ·
//       historyQuery · historyTitle · historyStats (⭐ success=false) ·
//       pack/readHistoryHandoff (⭐ allowlist + ضد prototype pollution)
//    ۲) رندرر: اسکلت دیالوگ با همهٔ idها · تب‌ها · escape دادهٔ سرور ·
//       حالت خالی · tone از whitelist
//    ۳) ⭐ نبودِ session_id در خروجی UI
//    ۴) دیالوگ: صف مدیر (نه setTimeout) · پل sessionStorage ·
//       دکمهٔ پروندهٔ مشتری · مجوز users.activity.view
//    ۵) سیم‌کشی پنل: دکمهٔ ردیف کاربران · showUserHistory · handoff در init
//    ۶) ثبت در package.json + هر دو gate runner + مستندات
//
//  اجرا:  npm run test:activity:history        (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
const renderer = await loadModule(
  "features/activity-log/activity-log.renderer.js",
);

// ===== نمونهٔ ردیف (هم‌شکل خروجی rules.buildItem در بک‌اند) =====
const ITEM = {
  id: 12,
  at: "2026-02-01T10:00:00.000Z",
  seconds_ago: 3725,
  action: "update",
  action_title: "ویرایش",
  method: "PUT",
  entity: "customers",
  entity_title: "مشتری",
  entity_id: "34",
  success: true,
  status_label: "موفق",
  actor: { id: 3, username: "ali", role: "admin" },
  ip: "127.0.0.1",
  fields: ["first_name", "mobile_number"],
  summary: "ویرایش مشتری 34",
};

const ITEM_FAILED = {
  ...ITEM,
  id: 13,
  action: "login",
  action_title: "ورود",
  entity: "auth",
  entity_id: null,
  success: false,
  status_label: "ناموفق",
  actor: { id: null, username: null, role: null },
  fields: null,
  seconds_ago: 5,
};

const CTX = {
  entity: "customers",
  entityId: 34,
  userId: "3",
  title: "  علی رضایی  ",
};

// ============================================================
// ۱) منطق خالص — زمینه و کوئری
// ============================================================
check(
  "view: HISTORY_LIMIT روی ۲۰ است (بار سبک برای دیالوگ)",
  view.HISTORY_LIMIT === 20,
);

check(
  "view: HISTORY_MODES هر سه تب را با برچسب فارسی دارد (۱۲.۵)",
  Object.keys(view.HISTORY_MODES).join(",") === "changes,actor,customer" &&
    view.HISTORY_MODES.changes.length > 5 &&
    view.HISTORY_MODES.customer.length > 5 &&
    view.HISTORY_MODES.actor.length > 5,
);

check(
  "view: کلید پل sessionStorage ثابت است",
  view.HISTORY_HANDOFF_KEY === "skb_activity_history",
);

check(
  "historyContext: مقادیر نرمال می‌شوند (رشته/عدد/trim)",
  (() => {
    const ctx = view.historyContext(CTX);
    return (
      ctx &&
      ctx.entity === "customers" &&
      ctx.entityId === "34" &&
      ctx.userId === 3 &&
      ctx.title === "علی رضایی"
    );
  })(),
);

check(
  "⭐ historyContext: بدون entity_id ⇒ null (فیلتر خالی کل تاریخچه را می‌آورد)",
  view.historyContext({ entity: "customers" }) === null &&
    view.historyContext({ entity: "customers", entityId: "  " }) === null,
);

check(
  "historyContext: بدون entity ⇒ null",
  view.historyContext({ entityId: "34" }) === null &&
    view.historyContext(null) === null &&
    view.historyContext("customers") === null,
);

check(
  "historyContext: userId نامعتبر ⇒ null (نه NaN در کوئری)",
  view.historyContext({ entity: "users", entityId: "7", userId: "abc" })
    .userId === null,
);

check(
  "historyContext: رشته‌های بلند هم‌سقف سرور بریده می‌شوند",
  (() => {
    const ctx = view.historyContext({
      entity: "e".repeat(200),
      entityId: "1".repeat(200),
      title: "t".repeat(300),
    });
    return (
      ctx.entity.length === 80 &&
      ctx.entityId.length === 64 &&
      ctx.title.length === 120
    );
  })(),
);

check(
  "historyQuery: حالت «تغییرات» فقط entity/entityId می‌فرستد",
  (() => {
    const q = view.historyQuery(view.historyContext(CTX), "changes");
    return (
      q.entity === "customers" &&
      q.entityId === "34" &&
      !("userId" in q) &&
      Object.keys(q).length === 2
    );
  })(),
);

check(
  "⭐ historyQuery: حالت «بازیگر» فقط userId می‌فرستد (شامل ورود/خروج)",
  (() => {
    const q = view.historyQuery(view.historyContext(CTX), "actor");
    return q.userId === 3 && !("entity" in q);
  })(),
);

check(
  "historyQuery: بدون userId حالت بازیگر به «تغییرات» برمی‌گردد",
  (() => {
    const q = view.historyQuery(
      view.historyContext({ entity: "customers", entityId: 34 }),
      "actor",
    );
    return q.entity === "customers" && q.entityId === "34";
  })(),
);

check(
  "historyQuery: زمینهٔ نامعتبر ⇒ null (نه استثنا)",
  view.historyQuery(null) === null && view.historyQuery({}) === null,
);

check(
  "historyTitle: عنوان تب اول «تاریخچهٔ تغییرات …» است",
  view.historyTitle(view.historyContext(CTX)).startsWith("تاریخچهٔ تغییرات") &&
    view.historyTitle(view.historyContext(CTX)).includes("علی رضایی"),
);

check(
  "historyTitle: عنوان تب دوم «فعالیت‌های …» است",
  view.historyTitle(view.historyContext(CTX), "actor").startsWith("فعالیت‌های"),
);

check(
  "historyTitle: بدون عنوان، برچسب «مشتری #34» ساخته می‌شود",
  view
    .historyTitle(view.historyContext({ entity: "customers", entityId: 34 }))
    .includes("مشتری #34"),
);


// ============================================================
// ۲) منطق خالص — آمار و پل بین صفحه‌ها
// ============================================================
check(
  "historyStats: فهرست خالی ⇒ «رویدادی ثبت نشده»",
  (() => {
    const stats = view.historyStats([]);
    return (
      stats.total === 0 &&
      stats.hasFailure === false &&
      stats.label === "رویدادی ثبت نشده"
    );
  })(),
);

check(
  "⭐ historyStats: ناموفق‌ها با success===false شمرده می‌شوند و زمان نسبی فارسی می‌آید",
  (() => {
    const stats = view.historyStats([ITEM, ITEM_FAILED]);
    return (
      stats.total === 2 &&
      stats.failed === 1 &&
      stats.hasFailure === true &&
      stats.label.includes("۲ رویداد") &&
      stats.label.includes("۱ ناموفق") &&
      stats.label.includes("۱ ساعت پیش")
    );
  })(),
);

check(
  "packHistoryHandoff: فقط چهار کلید مجاز در JSON می‌نشیند",
  (() => {
    const packed = view.packHistoryHandoff({
      ...CTX,
      extra: "hack",
      session_id: "s1",
    });
    const keys = Object.keys(JSON.parse(packed)).sort().join(",");
    return (
      keys === "entity,entityId,title,userId" && !packed.includes("session_id")
    );
  })(),
);

check(
  "packHistoryHandoff: زمینهٔ نامعتبر ⇒ رشتهٔ خالی (نه «null»)",
  view.packHistoryHandoff({ entity: "customers" }) === "" &&
    view.packHistoryHandoff(null) === "",
);

check(
  "readHistoryHandoff: رفت‌وبرگشت پل، زمینه را دقیق بازمی‌گرداند",
  (() => {
    const back = view.readHistoryHandoff(view.packHistoryHandoff(CTX));
    return (
      back &&
      back.entity === "customers" &&
      back.entityId === "34" &&
      back.userId === 3 &&
      back.title === "علی رضایی"
    );
  })(),
);

check(
  "readHistoryHandoff: ورودی خراب/تهی/آرایه ⇒ null (بدون استثنا)",
  view.readHistoryHandoff("") === null &&
    view.readHistoryHandoff("not json") === null &&
    view.readHistoryHandoff("[1,2,3]") === null &&
    view.readHistoryHandoff("null") === null,
);

check(
  "⭐ readHistoryHandoff: کلید اضافه و __proto__ نادیده گرفته می‌شود",
  (() => {
    const back = view.readHistoryHandoff(
      '{"entity":"users","entityId":"5","extra":"x","__proto__":{"polluted":true}}',
    );
    return (
      back.entity === "users" &&
      back.entityId === "5" &&
      back.userId === null &&
      back.title === "" &&
      !("extra" in back) &&
      {}.polluted === undefined
    );
  })(),
);

check(
  "readHistoryHandoff: ورودی بسیار بلند رد می‌شود (سقف ۶۰۰ کاراکتر)",
  view.readHistoryHandoff(
    `{"entity":"users","entityId":"5","title":"${"x".repeat(700)}"}`,
  ) === null,
);



// ============================================================
// ۳) رندرر دیالوگ تاریخچه
// ============================================================
const shell = renderer.renderHistoryShell();

check(
  "رندرر: اسکلت دیالوگ همهٔ idهای لازم را دارد",
  [
    "alpHistModal",
    "alpHistTitle",
    "alpHistClose",
    "alpHistTabs",
    "alpHistStats",
    "alpHistBody",
    "alpHistOpenFull",
    "alpHistExport",
  ].every((id) => shell.includes(`id="${id}"`)),
);

check(
  "رندرر: دیالوگ دسترس‌پذیر است (role=dialog + aria-modal)",
  shell.includes('role="dialog"') &&
    shell.includes('aria-modal="true"') &&
    shell.includes('aria-hidden="true"'),
);

check(
  "رندرر: تب‌ها با userId دو تب می‌سازند و اولی فعال است",
  (() => {
    const tabs = renderer.renderHistoryTabs({ userId: 3 }, "changes");
    return (
      tabs.split('class="alp-hist-tab').length - 1 === 2 &&
      tabs.includes('data-mode="actor"') &&
      tabs.includes('class="alp-hist-tab active"') &&
      tabs.includes("فعالیت‌های این کاربر")
    );
  })(),
);

check(
  "رندرر: بدون userId فقط تب «تغییرات این رکورد» ساخته می‌شود",
  (() => {
    const tabs = renderer.renderHistoryTabs({ entity: "customers" }, "changes");
    return (
      tabs.split('class="alp-hist-tab').length - 1 === 1 &&
      !tabs.includes('data-mode="actor"')
    );
  })(),
);

check(
  "رندرر: payload خالی ⇒ پیام خطای قابل‌فهم (نه صفحهٔ سفید)",
  renderer.renderHistoryList(null).includes("تاریخچه‌ای برای نمایش وجود ندارد"),
);

check(
  "رندرر: فهرست خالی ⇒ پیام «تغییری ثبت نشده»",
  renderer
    .renderHistoryList({ activities: [] })
    .includes("تغییری ثبت نشده است"),
);

check(
  "رندرر: ردیف شامل زمان مطلق/نسبی، بازیگر، وضعیت و فیلدها است",
  (() => {
    const html = renderer.renderHistoryList(
      { activities: [ITEM] },
      { can: () => true },
    );
    return (
      html.includes('data-activity-id="12"') &&
      html.includes("۱ ساعت پیش") &&
      html.includes("ali (مدیر)") &&
      html.includes("موفق") &&
      html.includes("۲ فیلد") &&
      html.includes('data-tone="update"')
    );
  })(),
);

check(
  "رندرر: عمل نامعتبر tone نمی‌سازد (whitelist ⇒ other)",
  (() => {
    const html = renderer.renderHistoryList({
      activities: [{ ...ITEM, action: "merge", action_title: "" }],
    });
    return html.includes('data-tone="other"') && !html.includes('data-tone="merge');
  })(),
);

check(
  "⭐ رندرر: دادهٔ تزریقی سرور escape می‌شود (بدون <script>/<img)",
  (() => {
    const html = renderer.renderHistoryList({
      activities: [
        {
          ...ITEM,
          actor: {
            id: 1,
            username: "<img src=x onerror=alert(1)>",
            role: "admin",
          },
          summary: "<script>alert(2)</script>",
          entity_id: "34<script>",
        },
      ],
    });
    return (
      !html.includes("<script>") &&
      !html.includes("<img src=x") &&
      html.includes("&lt;img") &&
      html.includes("&lt;script&gt;")
    );
  })(),
);

check(
  "⭐ رندرر: session_id هرگز در خروجی تاریخچه نمی‌آید",
  (() => {
    const html = renderer.renderHistoryList({
      activities: [{ ...ITEM, session_id: "SECRET-SESSION" }],
    });
    return !html.includes("SECRET-SESSION") && !html.includes("session_id");
  })(),
);

check(
  "رندرر: لینک رکورد فقط با مجوز مقصد ساخته می‌شود",
  (() => {
    const allowed = renderer.renderHistoryList(
      { activities: [ITEM] },
      { can: () => true },
    );
    const denied = renderer.renderHistoryList(
      { activities: [ITEM] },
      { can: () => false },
    );
    return (
      allowed.includes("customer-info.html?id=34") &&
      !denied.includes("customer-info.html")
    );
  })(),
);

// ============================================================
// ۴) دیالوگ «تاریخچه» و استایل خودبسنده
// ============================================================
const dialogSrc = read("Frontend/src/features/activity-log/activity-log.history.js");
const dialogCss = read("Frontend/src/features/activity-log/activity-log.history.css");
const managerSrc = read("Frontend/src/features/activity-log/activity-log.manager.js");

check(
  "دیالوگ: تک‌نمونهٔ سراسری + نقطهٔ ورود عمومی export می‌شود",
  dialogSrc.includes("export const activityHistoryDialog = new ActivityHistoryDialog()") &&
    dialogSrc.includes("window.activityHistoryDialog = activityHistoryDialog") &&
    dialogSrc.includes("window.showEntityHistory ="),
);

check(
  "دیالوگ: از activityService استفاده می‌کند و fetch خام ندارد",
  dialogSrc.includes('from "../../core/services/activity.service.js"') &&
    dialogSrc.includes("activityService.list(") &&
    !dialogSrc.includes("fetch("),
);

check(
  "دیالوگ: بدون setInterval/setTimeout (بدون تازه‌سازی خودکار)",
  !dialogSrc.includes("setInterval(") && !dialogSrc.includes("setTimeout("),
);

check(
  "دیالوگ: مارک‌آپ تنبل و سراسری در document.body ساخته می‌شود",
  dialogSrc.includes("document.body.appendChild(modal)") &&
    dialogSrc.includes("if (!this.mount()) return;"),
);

check(
  "دیالوگ: کوئری از historyQuery + سقف HISTORY_LIMIT ساخته می‌شود",
  dialogSrc.includes("historyQuery(this.context, this.mode)") &&
    dialogSrc.includes("HISTORY_LIMIT"),
);

check(
  "دیالوگ: مجوز users.activity.view با رفتار fail-open",
  dialogSrc.includes('const CONTENT_KEY = "users.activity.view"') &&
    dialogSrc.includes("permissionService.hasData()") &&
    dialogSrc.includes("permissionService.can(CONTENT_KEY)"),
);

check(
  "دیالوگ: بستن با کلیک بیرون و کلید Escape",
  dialogSrc.includes("if (event.target === modal) this.close()") &&
    /event\.key === "Escape"/.test(dialogSrc),
);

check(
  "دیالوگ: خروجی CSV با buildCsv (BOM اکسل فارسی)",
  dialogSrc.includes("buildCsv(this.items)") &&
    dialogSrc.includes("new Blob("),
);

check(
  "⭐ دیالوگ: «مشاهدهٔ کامل» داخل پنل از صف مدیر استفاده می‌کند (بدون تایمر)",
  dialogSrc.includes("manager.queueHistory(this.context)") &&
    dialogSrc.includes("manager.applyPendingHistory()") &&
    dialogSrc.includes("menuItem.click()"),
);

check(
  "⭐ دیالوگ: «مشاهدهٔ کامل» بیرون پنل با پل sessionStorage و try/catch",
  dialogSrc.includes("sessionStorage.setItem(HISTORY_HANDOFF_KEY, packed)") &&
    dialogSrc.includes("packHistoryHandoff(this.context)") &&
    /catch\s*\{[\s\S]{0,240}ذخیرهٔ درخواست تاریخچه/.test(dialogSrc),
);

check(
  "دیالوگ: دکمهٔ پروندهٔ مشتری با مجوز و شناسهٔ معتبر نمایان می‌شود",
  dialogSrc.includes('const CUSTOMER_TRIGGER = "#customerHistoryBtn"') &&
    dialogSrc.includes("window.CURRENT_CUSTOMER_ID") &&
    dialogSrc.includes("button.hidden = !(customerId && this.allowed())") &&
    dialogSrc.includes('document.addEventListener("permissions:applied", boot)'),
);

check(
  "⭐ دیالوگ: هیچ‌جا session_id خوانده/نمایش داده نمی‌شود",
  !dialogSrc.includes(".session_id") && !dialogSrc.includes("session_id:"),
);

check(
  "استایل: همهٔ کلاس‌های مارک‌آپ دیالوگ تعریف شده‌اند",
  [
    ".alp-hist-card",
    ".alp-hist-head",
    ".alp-hist-tabs",
    ".alp-hist-stats",
    ".alp-hist-body",
    ".alp-hist-row",
    ".alp-hist-action",
    ".alp-hist-status",
    ".alp-hist-target",
    ".alp-hist-foot",
    ".customer-history-btn",
  ].every((sel) => dialogCss.includes(sel)),
);

check(
  "استایل: خودبسنده است (به data-table/alp-table پنل وابسته نیست)",
  (() => {
    // ⚠️ کامنت‌ها حذف می‌شوند؛ توضیحِ «چرا data-table را استفاده نکردیم»
    //    نباید خودش باعث افتادن بررسی شود.
    const code = dialogCss.replace(/\/\*[\s\S]*?\*\//g, "");
    return !code.includes(".data-table") && !code.includes(".alp-table");
  })(),
);

check(
  "⭐ پروندهٔ مشتری استایل پنل را لود نمی‌کند ⇒ وابستگی CSS ممنوع (تأیید)",
  !read("Frontend/src/pages/customer-info.html").includes("admin-panel.css"),
);


// ============================================================
// ۵) سیم‌کشی: مدیر بخش، پنل ادمین و پروندهٔ مشتری
// ============================================================
check(
  "مدیر: صف درخواست تاریخچه اضافه شده است",
  managerSrc.includes("this.pendingHistory = null") &&
    managerSrc.includes("queueHistory(input)") &&
    managerSrc.includes("async applyPendingHistory()"),
);

check(
  "⭐ مدیر: init صف را پس از refresh و پیش از initialized اعمال می‌کند",
  (() => {
    const initAt = managerSrc.indexOf("async init(");
    const refreshAt = managerSrc.indexOf("await this.refresh();", initAt);
    const applyAt = managerSrc.indexOf("await this.applyPendingHistory();", initAt);
    const readyAt = managerSrc.indexOf("this.initialized = true;", initAt);
    return refreshAt > initAt && applyAt > refreshAt && readyAt > applyAt;
  })(),
);

check(
  "مدیر: امضای openEntityHistory(entity, entityId) حفظ شده (گارد ۱۲.۳)",
  managerSrc.includes("openEntityHistory(entity, entityId)") &&
    managerSrc.includes("this.queueHistory({ entity, entityId })"),
);

check(
  "مدیر: زمینه از historyContext عبور می‌کند (نه رشتهٔ خام)",
  managerSrc.includes("this.pendingHistory = historyContext(input)"),
);

check(
  "⭐ رندرر پنل: دکمهٔ تاریخچه در هر دو جدول کاربران/مدیران اصلی",
  (() => {
    const panelRenderer = read(
      "Frontend/src/features/admin-panel/admin-panel.renderer.js",
    );
    return (
      panelRenderer.split("${historyButton(user)}").length - 1 === 2 &&
      panelRenderer.includes("window.showUserHistory(") &&
      panelRenderer.includes('service.can("users.activity.view")') &&
      panelRenderer.includes("service.hasData()")
    );
  })(),
);

check(
  "سرویس پنل: showUserHistory با import داینامیک دیالوگ",
  read("Frontend/src/features/admin-panel/admin-panel.service.js").includes(
    "async showUserHistory(id)",
  ) &&
    read("Frontend/src/features/admin-panel/admin-panel.service.js").includes(
      'await import("../activity-log/activity-log.history.js")',
    ),
);

check(
  "سرویس پنل: window.showUserHistory برای onclick ردیف‌ها ساخته می‌شود",
  read("Frontend/src/features/admin-panel/admin-panel.service.js").includes(
    "window.showUserHistory = (id) => adminPanelService.showUserHistory(id)",
  ),
);

check(
  "⭐ سرویس پنل: handoff قبل از setupSidebar خوانده و بعد از آن اعمال می‌شود",
  (() => {
    const src = read("Frontend/src/features/admin-panel/admin-panel.service.js");
    const takeAt = src.indexOf("this.takePendingHistory();");
    const sidebarAt = src.indexOf("this.setupSidebar();");
    const applyAt = src.indexOf("await this.applyPendingHistory(pendingHistory);");
    return takeAt > 0 && sidebarAt > takeAt && applyAt > sidebarAt;
  })(),
);

check(
  "سرویس پنل: با handoff، منوی «فعالیت کاربران» انتخاب می‌شود",
  /const pendingHistory = this\.takePendingHistory\(\);[\s\S]{0,220}if \(pendingHistory\) this\.selectedMenu = "activity-log";/.test(
    read("Frontend/src/features/admin-panel/admin-panel.service.js"),
  ),
);

check(
  "سرویس پنل: کلید یک‌بارمصرف sessionStorage از view خوانده می‌شود",
  (() => {
    const src = read("Frontend/src/features/admin-panel/admin-panel.service.js");
    return (
      src.includes("HISTORY_HANDOFF_KEY") &&
      src.includes("readHistoryHandoff") &&
      src.includes("sessionStorage.removeItem(HISTORY_HANDOFF_KEY)")
    );
  })(),
);

check(
  "پنل: استایل دیالوگ تاریخچه در <head> لود می‌شود",
  read("Frontend/src/pages/admin-panel.html").includes(
    "/features/activity-log/activity-log.history.css",
  ),
);

check(
  "⭐ پروندهٔ مشتری: دکمهٔ تاریخچه، استایل و اسکریپت دیالوگ اضافه شده است",
  (() => {
    const src = read("Frontend/src/pages/customer-info.html");
    return (
      src.includes('id="customerHistoryBtn"') &&
      /id="customerHistoryBtn"[\s\S]{0,120}hidden/.test(src) &&
      src.includes("features/activity-log/activity-log.history.css") &&
      src.includes("features/activity-log/activity-log.history.js")
    );
  })(),
);

check(
  "پروندهٔ مشتری: دکمه «تاریخچه» در هدر اطلاعات مشتری قرار گرفته",
  (() => {
    const src = read("Frontend/src/pages/customer-info.html");
    const metaAt = src.indexOf('<div class="customer-meta-info"></div>');
    const btnAt = src.indexOf('id="customerHistoryBtn"');
    const statsAt = src.indexOf('class="customer-stats-weather-row"');
    return metaAt > 0 && btnAt > metaAt && statsAt > btnAt;
  })(),
);


// ============================================================
// ۶) ثبت در گیت + مستندات
// ============================================================
const fePkg = read("Frontend/package.json");
const gateMjs = read("tools/gate.mjs");
const gatePs1 = read("tools/gate.ps1");

check(
  "گیت: اسکریپت test:activity:history در package.json ثبت شده است",
  /"test:activity:history":\s*"node activity-history-guard-test\.mjs"/.test(fePkg),
);

check(
  "گیت: هر دو gate runner (mjs + ps1) این گارد را اجرا می‌کنند",
  gateMjs.includes("'test:activity:history'") &&
    gatePs1.includes("'test:activity:history'"),
);

check(
  "گیت: گارد بعد از test:activity:panel ثبت شده است",
  gateMjs.indexOf("'test:activity:history'") >
    gateMjs.indexOf("'test:activity:panel'"),
);

check(
  "مستندات: REVIEW-WAVE-12.4.md خلاصهٔ موج را دارد",
  (() => {
    const doc = read("docs/REVIEW-WAVE-12.4.md");
    return (
      doc.length > 800 &&
      doc.includes("historyQuery") &&
      doc.includes("test:activity:history") &&
      doc.includes("users.activity.view")
    );
  })(),
);

check(
  "مستندات: REVIEW-WAVE-12.md بخش ۱۲.۴.۱ را ارجاع می‌دهد",
  read("docs/REVIEW-WAVE-12.md").includes("12.4.1"),
);

check(
  "مستندات: README فرانت دیالوگ «تاریخچه» را معرفی می‌کند",
  read("Frontend/README.md").includes("تاریخچه"),
);
// ============================================================
// ⭐ موج ۱۲.۵ — «همهٔ تغییرات این مشتری»
// ------------------------------------------------------------
//  چه چیزی از بازگشتش جلوگیری می‌شود؟
//   ۱) تب سوم فراموش شود ⇒ روی پروندهٔ مشتری فقط «تغییرات خود رکورد»
//      دیده می‌شد، نه سالن/گله/هفته‌نامه/بازدید.
//   ۲) زمینهٔ فقط‌مشتری باعث شود تب «تغییرات» بدون فیلتر درخواست بفرستد
//      (نمایش کل تاریخچهٔ سیستم به کاربر).
//   ۳) customerId در پل sessionStorage/صف مدیر گم شود.
// ============================================================
check(
  "⭐ ۱۲.۵ view: historyContext شناسهٔ مشتری را کنار رکورد نگه می‌دارد",
  (() => {
    const ctx = view.historyContext({
      entity: "halls",
      entityId: 5,
      customerId: "12",
    });
    return Boolean(ctx) && ctx.entityId === "5" && ctx.customerId === 12;
  })(),
);

check(
  "⭐ ۱۲.۵ view: زمینهٔ «فقط مشتری» معتبر است (بدون شناسهٔ رکورد)",
  (() => {
    const ctx = view.historyContext({ customerId: 12 });
    return Boolean(ctx) && ctx.customerId === 12 && ctx.entityId === "";
  })(),
);

check(
  "⭐ ۱۲.۵ view: مشتری نامعتبر (اعشار/متن) زمینه نمی‌سازد",
  view.historyContext({ customerId: "12.5" }) === null &&
    view.historyContext({ customerId: "abc" }) === null &&
    view.historyContext({ customerId: "0" }) === null,
);

check(
  "⭐ ۱۲.۵ view: historyQuery حالت «مشتری» فقط customerId می‌فرستد",
  (() => {
    const q = view.historyQuery(
      view.historyContext({ entity: "halls", entityId: 5, customerId: 12 }),
      "customer",
    );
    return q.customerId === 12 && Object.keys(q).length === 1;
  })(),
);

check(
  "⭐ ۱۲.۵ view: زمینهٔ فقط‌مشتری ⇒ تب «تغییرات» فیلتری ندارد (null)",
  view.historyQuery(view.historyContext({ customerId: 12 }), "changes") ===
    null,
);

check(
  "⭐ ۱۲.۵ view: تب مشتری بدون customerId به «تغییرات» برمی‌گردد",
  (() => {
    const q = view.historyQuery(
      view.historyContext({ entity: "customers", entityId: 34 }),
      "customer",
    );
    return q.entity === "customers" && q.entityId === "34";
  })(),
);

check(
  "⭐ ۱۲.۵ view: عنوان تب مشتری «همهٔ تغییرات …» است",
  view
    .historyTitle(
      view.historyContext({ entity: "customers", entityId: 34, customerId: 34 }),
      "customer",
    )
    .startsWith("همهٔ تغییرات"),
);

check(
  "⭐ ۱۲.۵ رندرر: با customerId سه تب ساخته می‌شود و اولی فعال است",
  (() => {
    const tabs = renderer.renderHistoryTabs(
      { entity: "halls", entityId: "5", customerId: 12, userId: 3 },
      "changes",
    );
    return (
      tabs.split('class="alp-hist-tab').length - 1 === 3 &&
      tabs.includes('data-mode="customer"') &&
      tabs.includes('class="alp-hist-tab active"')
    );
  })(),
);

check(
  "⭐ ۱۲.۵ رندرر: بدون customerId تب مشتری ساخته نمی‌شود",
  !renderer
    .renderHistoryTabs({ entity: "customers", entityId: "34" }, "changes")
    .includes('data-mode="customer"'),
);

check(
  "⭐ ۱۲.۵ رندرر: ردیف تاریخچهٔ وابسته به مشتری نشان «مشتری» می‌گیرد",
  renderer
    .renderHistoryList({ activities: [{ ...ITEM, customer_id: 9 }] })
    .includes("alp-hist-customer"),
);

check(
  "⭐ ۱۲.۵ پل: customerId در بستهٔ sessionStorage حفظ می‌شود",
  (() => {
    const packed = view.packHistoryHandoff({
      entity: "halls",
      entityId: 5,
      customerId: 12,
      title: "سالن ۱",
    });
    const back = view.readHistoryHandoff(packed);
    return Boolean(back) && back.customerId === 12 && back.entityId === "5";
  })(),
);

check(
  "⭐ ۱۲.۵ دیالوگ: تب پیش‌فرض روی پروندهٔ مشتری «مشتری» است",
  dialogSrc.includes("defaultMode(") &&
    dialogSrc.includes("window.CURRENT_CUSTOMER_ID"),
);

check(
  "⭐ ۱۲.۵ دیالوگ: بدون فیلتر معتبر هیچ درخواستی نمی‌فرستد",
  dialogSrc.includes("const filter = historyQuery(this.context, this.mode)") &&
    dialogSrc.includes("if (!filter)"),
);

check(
  "⭐ ۱۲.۵ دیالوگ: دکمهٔ پروندهٔ مشتری customerId را هم پاس می‌دهد",
  /this\.open\(\{[\s\S]{0,120}customerId,/.test(dialogSrc),
);

check(
  "⭐ ۱۲.۵ دیالوگ: پنجرهٔ سراسری customerId را به‌عنوان آرگومان چهارم می‌پذیرد",
  dialogSrc.includes("customerId = null") &&
    dialogSrc.includes("activityHistoryDialog.open({ entity, entityId, title, customerId })"),
);

check(
  "⭐ ۱۲.۵ مستندات: REVIEW-WAVE-12.5.md خلاصهٔ موج را دارد",
  (() => {
    const doc = read("docs/REVIEW-WAVE-12.5.md");
    return (
      doc.length > 800 &&
      doc.includes("customer_id") &&
      doc.includes("activityCustomerResolver") &&
      doc.includes("test:activity:history")
    );
  })(),
);

check(
  "⭐ ۱۲.۵ مستندات: REVIEW-WAVE-12.md زیرفاز ۱۲.۵ را ارجاع می‌دهد",
  read("docs/REVIEW-WAVE-12.md").includes("12.5"),
);



// ============================================================
// پایان
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;
console.log("");
if (failed === 0) {
  console.log(`✅ ALL PASS — ${passed} بررسی نشست`);
} else {
  console.log(`❌ ${failed} بررسی ناموفق از ${results.length}`);
}
process.exitCode = failed === 0 ? 0 : 1;

