// ============================================================
// weekly.report.history.js
// گزارش تاریخچهٔ هفتگی: مودال انتخاب گله‌ها + چرخهٔ دریافت داده
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyHistoryReportMethods) در weekly.service.js
// حجم: ۲ متد / ۳۳۳ خط
// ============================================================
import { weeklyApi } from "./weekly.api.js";
import { auditWeeks, resolveFlockTimelineEnd } from "./weekly.audit.js";
import {
  buildWeekTimeline,
  mergeWeekTimelines,
} from "./weekly.report.weeks.js";
import { calculateWeekMetrics } from "./weekly.calculations.js";
import { sortFlocksByHall } from "./weekly.aggregation.js";
import {
  notificationService,
} from "../../../../core/services/notification.service.js";
import { apiService } from "../../../../core/services/api.service.js";
import { hatcheryApi } from "../hatchery/hatchery.api.js";
import { convertToPersianDate } from "../../../../core/utils/date.utils.js";

export const weeklyHistoryReportMethods = {
  // ===== گزارش تاریخچه هفتگی (گله‌های تکمیل‌شده) =====

  async generateWeeklyHistoryReport() {
    notificationService.showLoading("در حال آماده‌سازی گزارش تاریخچهٔ هفتگی...");
    try {
      const res = await apiService.get("/flocks", {
        customer_id: this.customerId,
        status: "completed",
        limit: 500,
      });
      const flocks =
        res?.success && Array.isArray(res.data?.flocks) ? res.data.flocks : [];

      // مودال انتخاب گله‌های قبلی (تکمیل‌شده)
      notificationService.hideLoading();
      if (flocks.length === 0) {
        notificationService.warning("گلهٔ تکمیل‌شده‌ای برای این مشتری یافت نشد");
        return;
      }

      const selectedFlocks = await this.pickHistoryFlocks(flocks);
      if (!selectedFlocks || selectedFlocks.length === 0) return;

      // ✅ انتخاب گروه‌های شاخص پیش از ساخت گزارش
      const selectedGroups = await this.pickReportGroups({
        title: "🕓 شاخص‌های گزارش تاریخچه هفتگی",
      });
      if (!selectedGroups) return; // کاربر انصراف داد

      notificationService.showLoading(
        "در حال آماده‌سازی گزارش تاریخچهٔ هفتگی...",
      );

      const customerResponse = await weeklyApi.getCustomer(this.customerId);
      const customer = customerResponse.success ? customerResponse.data : {};

      const blocks = [];
      for (const flock of selectedFlocks) {
        // ✅ ترتیب ثابت سالن‌ها از A به آخر در گزارش تاریخچه هفتگی
        const placements = sortFlocksByHall(flock.placements || []);
        let completion = null;
        try {
          const compRes = await hatcheryApi.getFlockCompletionByFlock(flock.id);
          if (compRes.success && compRes.data) completion = compRes.data;
        } catch (e) {
          console.warn(`⚠️ بدون پایان دوره گله ${flock.id}`);
        }

        const halls = [];
        for (const p of placements) {
          let weeks = [];
          try {
            const wr = await weeklyApi.getWeeklyRecords(p.id);
            if (wr.success && Array.isArray(wr.data?.records)) {
              weeks = wr.data.records;
            }
          } catch (e) {
            console.warn(`⚠️ بدون هفتگی سالن ${p.id}`);
          }

          // فقط هفتههای ثبتشده + مرتبسازی صعودی
          const savedWeeks = (weeks || [])
            .filter((w) => w && w.week_number)
            .sort((a, b) => (a.week_number || 0) - (b.week_number || 0));

          // محاسبه متریک کامل هر هفته (دقیقاً مثل فرم زندهٔ هفتگی و گزارش سالن)
          const flockLike = {
            ...p,
            total_chicks_count: p.total_chicks_count,
            avg_initial_weight: p.avg_initial_weight,
            breed_id: p.breed_id,
            placement_date: p.placement_date,
          };
          if (
            !Array.isArray(flockLike.standards) ||
            flockLike.standards.length === 0
          ) {
            const stds = await this.loadStandardsForFlock(flockLike);
            flockLike.standards = stds || [];
          }
          savedWeeks.forEach((w) => {
            // رکوردهای خام API این فلگ را ندارند؛ برای خوانده‌شدن توسط calculateWeekMetrics لازم است
            w.existsInDb = true;
            // اگر خوراک هفتگی ذخیره نشده ولی روزانه موجود باشد، از روی آن برآورد می‌شود
            if (
              (w.weekly_feed_intake === null ||
                w.weekly_feed_intake === undefined ||
                w.weekly_feed_intake === "") &&
              w.daily_feed_intake !== null &&
              w.daily_feed_intake !== undefined &&
              w.daily_feed_intake !== ""
            ) {
              w.weekly_feed_intake =
                (parseFloat(w.daily_feed_intake) || 0) * 7;
            }
            w.diseases = w.diseases || [];
            w.vaccines = w.vaccines || [];
            w.medicines = w.medicines || [];
            w.feedTypes = w.feedTypes || [];
            w.suggestions = w.suggestions || [];
            w.metrics = calculateWeekMetrics({
              flock: flockLike,
              weeks: savedWeeks,
              weekNumber: w.week_number,
              formValues: {},
            });
          });

          // ✅ مبنای پایان دورهٔ واقعی گله (تاریخ/سن کشتار → ended_at → آخرین هفتهٔ ثبت‌شده)
          // ❗ برای گله‌های تکمیل‌شده هرگز «امروز» مبنا نیست
          const timeline = resolveFlockTimelineEnd({
            flock,
            placement: p,
            completion,
            savedWeeks,
          });
          const theoreticalWeeks = this.calculateWeeks(flockLike).filter(
            (week) => week.week_number <= timeline.endWeek,
          );
          const mergedWeeks = this.mergeWeeks(theoreticalWeeks, savedWeeks);
          const knownWeeks = new Set(
            mergedWeeks.map((week) => week.week_number),
          );
          const extraWeeks = savedWeeks
            .filter((week) => !knownWeeks.has(week.week_number))
            .map((week) => ({ ...week, existsInDb: true }));
          const allWeeks = [...mergedWeeks, ...extraWeeks].sort(
            (a, b) => a.week_number - b.week_number,
          );
          const hallName =
            p.hall?.hall_name ||
            p.Hall?.hall_name ||
            `سالن ${p.hall_id || "-"}`;

          halls.push({
            placement: p,
            hallName,
            weeks: savedWeeks,
            allWeeks,
            audit: auditWeeks(allWeeks, hallName),
            timeline,
          });
        }
        blocks.push({ flock, completion, halls });
      }

      // ✅ انتخاب هفته‌های هر گله (هر گله = خط زمانی اجتماع سالن‌هایش)
      const weekSelection = await this.pickReportWeeksPerFlock({
        title: "🎯 هفته‌های گزارش تاریخچه هفتگی",
        panels: blocks.map((block) => ({
          key: `f${block.flock.id}`,
          label: `🐔 گله ${block.flock.flock_number || "-"} — واحد ${block.flock.unit?.unit_name || "-"}`,
          subtitle: `${(block.halls || []).length.toLocaleString("fa-IR")} سالن`,
          timeline: mergeWeekTimelines(
            (block.halls || []).map((hall) =>
              buildWeekTimeline(hall.allWeeks || hall.weeks || []),
            ),
          ),
        })),
      });

      const html = this.buildWeeklyHistoryHTML(customer, blocks, {
        selectedGroups,
        weekSelection,
      });
      this.openReportWindow(html);
      notificationService.success("✅ گزارش تاریخچه هفتگی آماده شد");
    } catch (error) {
      console.error("❌ Error generating weekly history report:", error);
      notificationService.error("❌ خطا در تولید گزارش تاریخچه هفتگی");
    } finally {
      notificationService.hideLoading();
    }
  },

  // ===== مودال انتخاب گله‌های قبلی برای گزارش تاریخچه هفتگی =====

  async pickHistoryFlocks(flocks) {
    // اگر SweetAlert2 در دسترس نبود، مثل قبل همهٔ گله‌ها انتخاب می‌شوند
    if (typeof Swal === "undefined") return flocks;

    const metaOf = (flock) => {
      const placements = flock.placements || [];
      const hallsCount = placements.length;
      const chicks = placements.reduce(
        (sum, p) => sum + (parseInt(p.total_chicks_count) || 0),
        0,
      );
      let date = "-";
      if (flock.placement_date) {
        try {
          date = convertToPersianDate(flock.placement_date);
        } catch {
          date = "-";
        }
      }
      return { hallsCount, chicks, date };
    };

    const rowsHtml = flocks
      .map((flock) => {
        const { hallsCount, chicks, date } = metaOf(flock);
        const unitName = flock.unit?.unit_name || "-";
        const flockNumber = flock.flock_number || "-";
        const searchKey = `${flockNumber} ${unitName} ${date}`.toLowerCase();
        return `
          <label class="wh-item" data-halls="${hallsCount}" data-chicks="${chicks}" data-search="${searchKey}">
            <input type="checkbox" class="wh-item-check" value="${flock.id}">
            <span class="wh-item-main">
              <span class="wh-item-title">🐔 گله ${flockNumber} <span class="wh-item-unit">— واحد ${unitName}</span></span>
              <span class="wh-item-meta">
                <span><i class="fas fa-warehouse"></i> ${hallsCount.toLocaleString("fa-IR")} سالن</span>
                <span><i class="fas fa-egg"></i> ${chicks.toLocaleString("fa-IR")} قطعه</span>
                <span><i class="fas fa-calendar-alt"></i> ${date}</span>
              </span>
            </span>
          </label>`;
      })
      .join("");

    const html = `
      <div class="wh-picker" dir="rtl">
        <div class="wh-stats">
          <div class="wh-stat">
            <span class="wh-stat-val" id="whStatFlocks">0</span>
            <span class="wh-stat-lbl">گلهٔ انتخابی</span>
          </div>
          <div class="wh-stat">
            <span class="wh-stat-val" id="whStatHalls">0</span>
            <span class="wh-stat-lbl">سالن</span>
          </div>
          <div class="wh-stat">
            <span class="wh-stat-val" id="whStatChicks">0</span>
            <span class="wh-stat-lbl">جوجه‌ریزی (قطعه)</span>
          </div>
        </div>

        <div class="wh-toolbar">
          <button type="button" class="wh-tool-btn" id="whSelectAll">
            <i class="fas fa-check-double"></i> انتخاب همه
          </button>
          <button type="button" class="wh-tool-btn ghost" id="whClearAll">
            <i class="fas fa-eraser"></i> پاک‌کردن
          </button>
          <input type="text" id="whSearch" class="wh-search" placeholder="جستجوی شماره گله یا واحد...">
        </div>

        <div class="wh-list" id="whPickerList">${rowsHtml}</div>

        <p class="wh-hint">
          <i class="fas fa-circle-info"></i>
          فقط گله‌های تکمیل‌شده نمایش داده می‌شوند و کارت‌های هدر گزارش بر اساس انتخاب شما محاسبه می‌شود.
        </p>
      </div>
    `;

    const updateStats = () => {
      const checked = Array.from(
        document.querySelectorAll("#whPickerList .wh-item-check:checked"),
      );
      let halls = 0;
      let chicks = 0;
      checked.forEach((cb) => {
        const item = cb.closest(".wh-item");
        halls += parseInt(item?.dataset.halls || "0", 10) || 0;
        chicks += parseInt(item?.dataset.chicks || "0", 10) || 0;
      });
      const fEl = document.getElementById("whStatFlocks");
      const hEl = document.getElementById("whStatHalls");
      const cEl = document.getElementById("whStatChicks");
      if (fEl) fEl.textContent = checked.length.toLocaleString("fa-IR");
      if (hEl) hEl.textContent = halls.toLocaleString("fa-IR");
      if (cEl) cEl.textContent = chicks.toLocaleString("fa-IR");
    };

    const result = await Swal.fire({
      title: "انتخاب گله‌های قبلی برای گزارش هفتگی",
      html,
      width: 720,
      showCancelButton: true,
      showCloseButton: true,
      confirmButtonText: '<i class="fas fa-file"></i> دریافت گزارش',
      cancelButtonText: "انصراف",
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#94a3b8",
      customClass: { popup: "wh-popup", htmlContainer: "wh-html" },
      didOpen: () => {
        const list = document.getElementById("whPickerList");
        const search = document.getElementById("whSearch");

        list?.addEventListener("change", (e) => {
          if (e.target.classList.contains("wh-item-check")) updateStats();
        });

        document.getElementById("whSelectAll")?.addEventListener("click", () => {
          list?.querySelectorAll(".wh-item").forEach((item) => {
            if (item.style.display !== "none") {
              const cb = item.querySelector(".wh-item-check");
              if (cb) cb.checked = true;
            }
          });
          updateStats();
        });

        document.getElementById("whClearAll")?.addEventListener("click", () => {
          list
            ?.querySelectorAll(".wh-item-check")
            .forEach((cb) => (cb.checked = false));
          updateStats();
        });

        search?.addEventListener("input", () => {
          const q = search.value.trim().toLowerCase();
          list?.querySelectorAll(".wh-item").forEach((item) => {
            const match = !q || (item.dataset.search || "").includes(q);
            item.style.display = match ? "" : "none";
          });
          updateStats();
        });

        updateStats();
      },
      preConfirm: () => {
        const picked = Array.from(
          document.querySelectorAll("#whPickerList .wh-item-check:checked"),
        ).map((cb) => parseInt(cb.value, 10));
        if (picked.length === 0) {
          Swal.showValidationMessage("حداقل یک گله را انتخاب کنید");
          return false;
        }
        return picked;
      },
    });

    if (!result.isConfirmed || !Array.isArray(result.value)) return null;
    const idSet = new Set(result.value);
    return flocks.filter((flock) => idSet.has(flock.id));
  },

};
