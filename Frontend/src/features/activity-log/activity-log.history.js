// ============================================================
// features/activity-log/activity-log.history.js
// «تاریخچهٔ یک رکورد» — دیالوگ مشترک (موج ۱۲.۴.۱)
// ------------------------------------------------------------
//  ⭐ چرا دیالوگ و نه صفحهٔ جدید؟
//     پرسش «چه کسی این رکورد را عوض کرد؟» وسطِ کارِ کاربر پیش
//     می‌آید؛ ترک صفحه یعنی از دست رفتن فرم/فیلترها. دیالوگ هم روی
//     پنل ادمین کار می‌کند و هم روی پروندهٔ مشتری (یک UI، دو ورودی).
// ------------------------------------------------------------
//  • تب ۱ «تغییرات این رکورد»: entity + entity_id
//  • تب ۲ «فعالیت‌های این کاربر»: user_id (شامل ورود/خروج)
//    ⚠️ تب ۲ فقط وقتی می‌آید که زمینه userId داشته باشد.
//  • «مشاهدهٔ کامل»: داخل پنل ⇒ صف مدیر + کلیک منو (بدون تایمر)؛
//    خارج پنل ⇒ پل sessionStorage و رفتن به پنل فعالیت.
// ------------------------------------------------------------
//  ⚠️ دسترسی: کلید محتوایی users.activity.view (سرور هم enforce
//     می‌کند). بدون دادهٔ مجوز، fail-open رفتار می‌کنیم و پیام خطای
//     قابل‌فهم سرور را نشان می‌دهیم (هم‌الگوی loadMenuData پنل).
//  ⚠️ بدون polling؛ هر باز شدن = یک درخواست.
//  ⚠️ هیچ‌گاه session_id در UI نمایش داده نمی‌شود (قاعدهٔ ۱۲.۲).
// ============================================================
import { activityService } from "../../core/services/activity.service.js";
import { permissionService } from "../../core/services/permission.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import {
  HISTORY_HANDOFF_KEY,
  HISTORY_LIMIT,
  HISTORY_MODES,
  buildCsv,
  historyContext,
  historyQuery,
  historyStats,
  historyTitle,
  packHistoryHandoff,
} from "./activity-log.view.js";
import {
  renderHistoryList,
  renderHistoryShell,
  renderHistoryTabs,
  renderNotice,
} from "./activity-log.renderer.js";

const CONTENT_KEY = "users.activity.view";
const CUSTOMER_TRIGGER = "#customerHistoryBtn";
const PANEL_MENU = '.sidebar-menu-item[data-menu="activity-log"]';

class ActivityHistoryDialog {
  constructor() {
    this.context = null;
    this.mode = "changes";
    this.items = [];
    this.loading = false;
    this.mounted = false;
  }

  // ===== مجوز =====
  //   ⚠️ fail-open: اگر دادهٔ مجوز در دسترس نباشد دیالوگ باز می‌شود و
  //      سرور تصمیم نهایی را می‌گیرد (هم‌الگوی loadMenuData پنل).
  allowed() {
    if (typeof permissionService?.hasData !== "function") return true;
    if (!permissionService.hasData()) return true;
    return permissionService.can(CONTENT_KEY);
  }

  // ===== ساخت تنبل مارک‌آپ (یک‌بار برای کل صفحه) =====
  mount() {
    if (this.mounted && document.getElementById("alpHistModal")) return true;

    const holder = document.createElement("div");
    holder.innerHTML = renderHistoryShell();
    const modal = holder.querySelector("#alpHistModal");
    if (!modal) return false;

    document.body.appendChild(modal);
    this.mounted = true;
    this.bind(modal);
    return true;
  }

  bind(modal) {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) this.close();
    });

    modal
      .querySelector("#alpHistClose")
      ?.addEventListener("click", () => this.close());
    modal
      .querySelector("#alpHistExport")
      ?.addEventListener("click", () => this.exportCsv());
    modal
      .querySelector("#alpHistOpenFull")
      ?.addEventListener("click", () => this.openFull());

    modal.querySelector("#alpHistTabs")?.addEventListener("click", (event) => {
      const tab = event.target.closest(".alp-hist-tab");
      if (!tab || tab.dataset.mode === this.mode) return;
      this.switchMode(tab.dataset.mode);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.close();
    });
  }

  // ===== باز کردن برای یک رکورد/کاربر/مشتری =====
  async open(input = {}) {
    const ctx = historyContext(input);
    if (!ctx) {
      notificationService.warning("شناسهٔ رکورد برای نمایش تاریخچه مشخص نیست");
      return;
    }

    if (!this.allowed()) {
      notificationService.warning(
        "دسترسی «مشاهدهٔ ردّ فعالیت» برای نقش شما فعال نیست",
      );
      return;
    }

    if (!this.mount()) return;

    this.context = ctx;
    this.mode = this.defaultMode(ctx);
    this.items = [];

    const modal = document.getElementById("alpHistModal");
    if (!modal) return;

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    this.renderChrome();
    await this.load();
  }

  // ===== تب پیش‌فرض (موج ۱۲.۵) =====
  //   ⭐ روی «پروندهٔ مشتری» پرسش اصلی «همهٔ تغییرات این مشتری» است، نه
  //      «تغییرات رکورد مشتری». تشخیص: صفحه شناسهٔ مشتری را در
  //      window.CURRENT_CUSTOMER_ID گذاشته است (customer-info.service).
  defaultMode(ctx) {
    if (!ctx) return "changes";
    const onCustomerProfile =
      typeof window !== "undefined" && Boolean(window.CURRENT_CUSTOMER_ID);
    if (ctx.customerId && onCustomerProfile) return "customer";
    return "changes";
  }

  close() {
    const modal = document.getElementById("alpHistModal");
    if (!modal || !modal.classList.contains("open")) return;

    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // ===== عنوان + تب‌ها =====
  renderChrome() {
    const title = document.getElementById("alpHistTitle");
    if (title) title.textContent = historyTitle(this.context, this.mode);

    const tabs = document.getElementById("alpHistTabs");
    if (tabs) tabs.innerHTML = renderHistoryTabs(this.context, this.mode);
  }

  async switchMode(mode) {
    if (!HISTORY_MODES[mode]) return;

    this.mode = mode;
    this.renderChrome();
    await this.load();
  }

  // ===== دریافت فهرست =====
  async load() {
    if (!this.context || this.loading) return;
    this.loading = true;

    const body = document.getElementById("alpHistBody");
    const stats = document.getElementById("alpHistStats");
    if (body) body.innerHTML = renderNotice("در حال دریافت تاریخچه…");
    if (stats) stats.textContent = "";

    try {
      // ⛔ گارد ۱۲.۵: اگر این تب فیلتری ندارد (مثلاً زمینه فقط customerId است
      //    و کاربر تب «تغییرات این رکورد» را می‌زند) هرگز بدون فیلتر
      //    درخواست نمی‌فرستیم — وگرنه کل تاریخچهٔ سیستم نمایش داده می‌شود.
      const filter = historyQuery(this.context, this.mode);
      if (!filter) {
        this.items = [];
        if (body) {
          body.innerHTML = renderNotice(
            "برای این تب شناسهٔ کافی ثبت نشده است؛ تب دیگری را انتخاب کنید.",
          );
        }
        return;
      }

      const query = {
        ...filter,
        page: 1,
        limit: HISTORY_LIMIT,
      };
      const data = await activityService.list(query);

      this.items = Array.isArray(data?.activities) ? data.activities : [];
      if (body) {
        body.innerHTML = renderHistoryList(data, {
          can: (key) => permissionService.can(key),
        });
      }
      if (stats && this.items.length) {
        stats.textContent = historyStats(this.items).label;
      }
    } catch (error) {
      console.error("❌ خطا در دریافت تاریخچهٔ رکورد:", error);
      this.items = [];
      if (body) {
        body.innerHTML = renderNotice(
          "دریافت تاریخچه ناموفق بود. اگر دسترسی «مشاهدهٔ ردّ فعالیت» را ندارید با مدیر تماس بگیرید.",
          "error",
        );
      }
    } finally {
      this.loading = false;
    }
  }

  // ===== خروجی CSV همان چیزی که دیده می‌شود (با BOM برای اکسل فارسی) =====
  exportCsv() {
    if (!this.items.length) {
      notificationService.warning(
        "برای خروجی CSV باید حداقل یک رویداد نمایش داده شود",
      );
      return;
    }

    try {
      const blob = new Blob([buildCsv(this.items)], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `record-history-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      notificationService.success(
        `خروجی ${this.items.length} رویداد دانلود شد`,
      );
    } catch (error) {
      console.error("❌ خطا در خروجی تاریخچه:", error);
      notificationService.error("ساخت خروجی CSV ناموفق بود");
    }
  }

  // ===== «مشاهدهٔ کامل» =====
  //   ۱) داخل پنل ادمین ⇒ صف مدیر + کلیک منو (بدون setTimeout/race)
  //   ۲) هر صفحهٔ دیگر     ⇒ پل sessionStorage + رفتن به پنل فعالیت
  async openFull() {
    if (!this.context) return;

    const menuItem = document.querySelector(PANEL_MENU);
    if (menuItem) {
      this.close();
      const manager = await this.ensureManager();
      if (!manager) {
        notificationService.error("ماژول فعالیت کاربران یافت نشد");
        return;
      }

      manager.queueHistory(this.context);
      if (manager.initialized) {
        await manager.applyPendingHistory();
      } else {
        menuItem.click();
      }
      return;
    }

    const packed = packHistoryHandoff(this.context);
    if (!packed) {
      notificationService.error("انتقال به پنل فعالیت ممکن نشد");
      return;
    }

    try {
      window.sessionStorage.setItem(HISTORY_HANDOFF_KEY, packed);
    } catch {
      notificationService.error("ذخیرهٔ درخواست تاریخچه در مرورگر ممکن نشد");
      return;
    }

    window.location.href = "/pages/admin-panel.html";
  }

  // لود داینامیک مدیر (هم‌الگوی whats-new در پنل)
  async ensureManager() {
    if (!window.activityLogManager) {
      try {
        await import("./activity-log.manager.js");
      } catch (error) {
        console.error("❌ خطا در لود مدیر فعالیت:", error);
        return null;
      }
    }
    return window.activityLogManager || null;
  }

  // ===== نقطهٔ ورود «پروندهٔ مشتری» =====
  //   دکمه در HTML با hidden رندر می‌شود و فقط با شناسهٔ معتبر + مجوز
  //   نمایان می‌شود (تا هیچ دکمهٔ مرده‌ای روی صفحه نماند).
  mountCustomerTrigger() {
    const button = document.querySelector(CUSTOMER_TRIGGER);
    if (!button || button.dataset.bound === "1") return;

    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      const customerId = String(window.CURRENT_CUSTOMER_ID || "").trim();
      if (!customerId) {
        notificationService.warning("شناسهٔ مشتری مشخص نیست");
        return;
      }

      const rawName = String(
        document.getElementById("customerFullName")?.textContent || "",
      ).trim();
      const title = /[.…]{3,}/.test(rawName) ? "" : rawName;

      // ⭐ موج ۱۲.۵: customerId هم پاس می‌شود تا تب «همهٔ تغییرات این مشتری»
      //    (سالن/گله/هفته‌نامه/بازدید) در همین دیالوگ در دسترس باشد.
      this.open({
        entity: "customers",
        entityId: customerId,
        customerId,
        title,
      });
    });
  }

  refreshCustomerTrigger() {
    const button = document.querySelector(CUSTOMER_TRIGGER);
    if (!button) return;

    const customerId = String(window.CURRENT_CUSTOMER_ID || "").trim();
    button.hidden = !(customerId && this.allowed());
  }
}

export const activityHistoryDialog = new ActivityHistoryDialog();

// ===== Global =====
if (typeof window !== "undefined") {
  window.activityHistoryDialog = activityHistoryDialog;
  window.ActivityHistoryDialog = ActivityHistoryDialog;

  // نقطهٔ ورود عمومی برای هر موجودیتی (پنل/صفحات دیگر)
  //   ⭐ موج ۱۲.۵: پارامتر پنجم customerId است تا برای سالن/گله/هفته‌نامه هم
  //      تب «همهٔ تغییرات این مشتری» رندر شود.
  window.showEntityHistory = (entity, entityId, title = "", customerId = null) =>
    activityHistoryDialog.open({ entity, entityId, title, customerId });

  // ✅ آماده‌سازی دکمهٔ پروندهٔ مشتری — هم پس از DOM و هم پس از
  //    اعمال سطوح دسترسی (هم‌الگوی `permissions:applied` در پنل)
  const boot = () => {
    activityHistoryDialog.mountCustomerTrigger();
    activityHistoryDialog.refreshCustomerTrigger();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  document.addEventListener("permissions:applied", boot);
}

