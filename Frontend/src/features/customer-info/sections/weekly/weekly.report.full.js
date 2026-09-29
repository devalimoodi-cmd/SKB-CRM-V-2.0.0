// ============================================================
// weekly.report.full.js
// گزارش کامل و گزارش یک گله (ساخت داده + پنجرهٔ چاپ)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyFullReportMethods) در weekly.service.js
// حجم: ۴ متد / ۲۰۲ خط
// ============================================================
import { weeklyApi } from "./weekly.api.js";
import { weeklyRenderer } from "./weekly.renderer.js";
import { auditWeeks, resolveFlockTimelineEnd } from "./weekly.audit.js";
import { buildWeekTimeline } from "./weekly.report.weeks.js";
import { calculateWeekMetrics } from "./weekly.calculations.js";
import { groupFlocksByFlock, sortFlocksByHall } from "./weekly.aggregation.js";
import {
  notificationService,
} from "../../../../core/services/notification.service.js";
import { sanitizeHtmlDocument } from "../../../../core/utils/string.utils.js";

export const weeklyFullReportMethods = {
  // ===== گزارش کامل =====

  async generateFullReport() {
    try {
      // ✅ انتخاب گروه‌های شاخص پیش از ساخت گزارش (پیش‌فرض = همهٔ شاخص‌ها)
      const selectedGroups = await this.pickReportGroups({
        title: "📊 شاخص‌های گزارش کامل هفتگی",
      });
      if (!selectedGroups) return; // کاربر انصراف داد

      notificationService.info("📊 در حال آماده‌سازی گزارش...");

      // دریافت اطلاعات مشتری
      const customerResponse = await weeklyApi.getCustomer(this.customerId);
      const customer = customerResponse.success ? customerResponse.data : {};

      // دریافت گله‌ها با اطلاعات کامل + متریک هر هفته
      const flocksWithWeeksRaw = await Promise.all(
        this.flocks.map(async (flock) => this.buildFlockReportData(flock)),
      );
      // ✅ ترتیب ثابت سالن‌ها از A به آخر در گزارش کامل هفتگی
      const flocksWithWeeks = sortFlocksByHall(flocksWithWeeksRaw);

      // گروه‌بندی جوجه‌ریزی سالن‌ها بر اساس گله (یک گله = چند سالن)
      // تا جدول تجمعی «کل گله» زیر اطلاعات هدر همان جدول نمایش داده شود
      const flockGroups = groupFlocksByFlock(flocksWithWeeks);

      // ✅ انتخاب هفته‌های هر گله (ترکیبی: مشترک + تنظیم جداگانه)
      const weekSelection = await this.pickReportWeeksPerFlock({
        title: "🎯 هفته‌های گزارش کامل هفتگی",
        panels: flocksWithWeeks.map((flock) => ({
          key: `p${flock.id}`,
          label: `🐔 گله ${flock.flock_number} — ${flock.hall_name || "-"}`,
          subtitle: `${flock.savedWeeks.length.toLocaleString("fa-IR")} هفته ثبت‌شده`,
          timeline: buildWeekTimeline(flock.weeks || []),
        })),
      });

      // تولید HTML گزارش
      const reportHtml = weeklyRenderer.renderFullReport(
        customer,
        flocksWithWeeks,
        this.units,
        flockGroups,
        { selectedGroups, weekSelection },
      );

      this.openReportWindow(reportHtml);
      notificationService.success("✅ گزارش با موفقیت آماده شد");
    } catch (error) {
      console.error("❌ Error generating report:", error);
      notificationService.error("❌ خطا در تولید گزارش");
    }
  },

  // ===== ساخت داده گزارش یک گله (هفته‌ها + متریک هر هفته + آمار) =====

  async buildFlockReportData(flock) {
    const allCalculatedWeeks = await this.getWeeksForFlock(flock);
    const hall = this.halls.find((h) => h.id === flock.hall_id);

    // اطمینان از وجود استاندارد نژاد
    if (!Array.isArray(flock.standards)) {
      flock.standards = (await this.loadStandardsForFlock(flock)) || [];
    }

    // ✅ مبنای پایان گله: گلهٔ فعال → تا امروز، گلهٔ بسته → تا پایان دورهٔ واقعی
    // (ترجیح: تاریخ/سن کشتار → ended_at → تاریخ ثبت پایان دوره → آخرین هفتهٔ ثبتشده)
    // ❗ گلهٔ تکمیل‌شده هرگز تا «امروز» کش نمی‌آید.
    const savedRecords = allCalculatedWeeks.filter((w) => w.existsInDb);
    const timeline = resolveFlockTimelineEnd({
      flock,
      placement: flock,
      completion: flock.completion || null,
      savedWeeks: savedRecords,
    });
    const weeks = allCalculatedWeeks.filter(
      (week) => week.existsInDb || week.week_number <= timeline.endWeek,
    );

    // محاسبه متریک برای هر هفته ثبت‌شده
    weeks.forEach((week) => {
      if (week.existsInDb) {
        week.metrics = calculateWeekMetrics({
          flock,
          weeks,
          weekNumber: week.week_number,
          formValues: {},
        });
      } else {
        week.metrics = null;
      }
    });

    const savedWeeks = weeks.filter((w) => w.existsInDb);

    // محاسبه آمار
    const totalMortality = savedWeeks.reduce(
      (sum, w) => sum + (parseFloat(w.weekly_mortality) || 0),
      0,
    );
    const totalFeed = savedWeeks.reduce(
      (sum, w) => sum + (parseFloat(w.weekly_feed_intake) || 0),
      0,
    );

    // آخرین هفته با داده
    const lastSaved = savedWeeks[savedWeeks.length - 1];
    const finalMetrics = lastSaved?.metrics || null;

    // آخرین وزن ثبت‌شده گله (آخرین وزن غیرصفر)
    const lastWeight = savedWeeks.reduce((last, w) => {
      const weightVal = parseFloat(w.weekly_weight) || 0;
      return weightVal > 0 ? weightVal : last;
    }, 0);

    const hallName = hall?.hall_name || `سالن ${flock.hall_id}`;

    return {
      ...flock,
      hall_name: hallName,
      breed_name: flock.breed?.name || "—",
      weeks: weeks,
      savedWeeks: savedWeeks,
      // ✅ حسابرسی هفته‌های ثبت‌نشده/ناقص — مبنای هشدارهای گزارش
      audit: auditWeeks(weeks, hallName),
      // ✅ مبنای پایان دوره (برای چیپ شفافیت در گزارش)
      timeline,
      statistics: {
        totalMortality,
        totalFeed: totalFeed.toFixed(1),
        weekCount: savedWeeks.length,
        lastWeight,
        fcr: finalMetrics?.fcr ?? null,
        finalMetrics,
      },
    };
  },

  // ===== باز کردن پنجره گزارش =====

  openReportWindow(html) {
    const printWindow = window.open(
      "",
      "_blank",
      "width=1200,height=900,scrollbars=yes",
    );
    if (!printWindow) {
      notificationService.error("لطفاً باز شدن پنجره popup را مجاز کنید");
      return false;
    }
    // ✅ پاک‌سازی خروجی گزارش (جلوگیری از اجرای اسکریپت تزریق‌شده از دیتابیس)
    printWindow.document.write(sanitizeHtmlDocument(html));
    printWindow.document.close();
    printWindow.onload = function () {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
    return true;
  },

  // ===== گزارش اختصاصی یک سالن =====

  async generateFlockReport(flockId) {
    try {
      const flock = this.flocks.find((f) => String(f.id) === String(flockId));
      if (!flock) {
        notificationService.error("گله یافت نشد");
        return;
      }

      // ✅ انتخاب گروه‌های شاخص پیش از ساخت گزارش
      const selectedGroups = await this.pickReportGroups({
        title: `📄 شاخص‌های گزارش سالن ${flock.flock_number || ""}`,
      });
      if (!selectedGroups) return; // کاربر انصراف داد

      notificationService.info("📄 در حال آماده‌سازی گزارش سالن...");

      const customerResponse = await weeklyApi.getCustomer(this.customerId);
      const customer = customerResponse.success ? customerResponse.data : {};

      const flockData = await this.buildFlockReportData(flock);

      // ✅ انتخاب هفته‌های گزارش این گله
      const weekSelection = await this.pickReportWeeksPerFlock({
        title: `🎯 هفته‌های گزارش سالن ${flock.flock_number || ""}`,
        subtitle: "برای این گله می‌توانید بازه یا هفته‌های دلخواه را انتخاب کنید.",
        panels: [
          {
            key: `p${flockData.id}`,
            label: `🐔 گله ${flockData.flock_number} — ${flockData.hall_name || "-"}`,
            subtitle: `${flockData.savedWeeks.length.toLocaleString("fa-IR")} هفته ثبت‌شده`,
            timeline: buildWeekTimeline(flockData.weeks || []),
          },
        ],
      });

      const reportHtml = weeklyRenderer.renderFlockReport(
        customer,
        flockData,
        this.units,
        { selectedGroups, weekSelection },
      );

      this.openReportWindow(reportHtml);
      notificationService.success("✅ گزارش سالن با موفقیت آماده شد");
    } catch (error) {
      console.error("❌ Error generating flock report:", error);
      notificationService.error("❌ خطا در تولید گزارش سالن");
    }
  },

};
