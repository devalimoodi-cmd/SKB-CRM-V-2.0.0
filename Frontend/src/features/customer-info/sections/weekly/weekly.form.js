// ============================================================
// weekly.form.js
// فرم هفته: ذخیره، پاک‌سازی و حذف
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyFormMethods) در weekly.service.js
// حجم: ۳ متد / ۲۳۰ خط
// ============================================================
import { weeklyApi } from "./weekly.api.js";
import { weeklyValidation } from "./weekly.validation.js";
import {
  notificationService,
} from "../../../../core/services/notification.service.js";

export const weeklyFormMethods = {
  // ===== ذخیره هفته =====

  async saveWeek(btn) {
    const form = btn.closest(".week-edit-form");
    if (!form) {
      notificationService.error("فرم پیدا نشد");
      return;
    }

    const weekId = form.getAttribute("data-week-id") || null;
    const flockId = form.getAttribute("data-flock-id");
    const weekNumber = parseInt(form.getAttribute("data-week-number"));

    if (!flockId) {
      notificationService.error("شناسه گله پیدا نشد");
      return;
    }

    // دریافت اطلاعات گله برای unit_id و hall_id
    const flock = this.flocks.find((f) => f.id == flockId);
    if (!flock) {
      notificationService.error("اطلاعات گله یافت نشد");
      return;
    }

    // محاسبه جمعیت ابتدای هفته برای اعتبارسنجی تلفات
    const weeksForFlock = this.flockWeeks[flockId] || [];
    let prevMortality = 0;
    weeksForFlock.forEach((w) => {
      if (w.existsInDb && parseInt(w.week_number) < weekNumber) {
        prevMortality += parseInt(w.weekly_mortality) || 0;
      }
    });
    const remainingBirds =
      (parseInt(flock.total_chicks_count) || 0) - prevMortality;

    // دریافت مقادیر چندگانه از سلکت‌ها
    const getMultipleValues = (selectName) => {
      const select = form.querySelector(`select[name="${selectName}"]`);
      if (!select) return [];
      return Array.from(select.selectedOptions)
        .map((opt) => opt.value)
        .filter((v) => v !== "");
    };

    const data = {
      customer_id: parseInt(this.customerId),
      unit_id: parseInt(flock.unit_id),
      hall_id: parseInt(flock.hall_id),
      chick_placement_id: parseInt(flockId),
      week_start_date: form.querySelector('input[name="week_start_date"]')
        .value,
      week_end_date: form.querySelector('input[name="week_end_date"]').value,
      week_number: weekNumber,
      flock_age_days: parseInt(
        form.querySelector('input[name="flock_age_days"]').value,
      ),
      service_expert_id:
        form.querySelector('select[name="service_expert_id"]')?.value || null,
      daily_feed_intake:
        form.querySelector('input[name="daily_feed_intake"]')?.value || null,
      weekly_feed_intake:
        form.querySelector('input[name="weekly_feed_intake"]')?.value || null,
      weekly_weight:
        form.querySelector('input[name="weekly_weight"]')?.value || null,
      weekly_mortality:
        form.querySelector('input[name="weekly_mortality"]')?.value ?? 0,
      blackout_hours:
        form.querySelector('input[name="blackout_hours"]')?.value || 0,
      additional_notes:
        form.querySelector('textarea[name="additional_notes"]')?.value || null,
      // تعداد جوجه مانده برای اعتبارسنجی سمت کلاینت
      remainingBirds,
      // تبدیل به آرایه اعداد صحیح برای ذخیره در دیتابیس
      disease_ids: getMultipleValues("disease_id").map(Number),
      vaccine_ids: getMultipleValues("vaccine_id").map(Number),
      medicine_ids: getMultipleValues("medicine_id").map(Number),
      feed_type_ids: getMultipleValues("feed_type_id").map(Number),
      suggestion_ids: getMultipleValues("suggestion_id").map(Number),
    };

    // اعتبارسنجی
    const errors = weeklyValidation.validateWeek(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';

    try {
      let response;
      if (weekId) {
        response = await weeklyApi.updateWeeklyRecord(weekId, data);
      } else {
        response = await weeklyApi.createWeeklyRecord(data);
      }

      if (response.success) {
        const msg = weekId
          ? `اطلاعات هفته ${weekNumber} با موفقیت بروزرسانی شد`
          : `اطلاعات هفته ${weekNumber} با موفقیت ثبت شد`;

        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: `✅ ${msg}`,
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success(msg);
        }

        await this.loadFlocks();
      } else {
        if (response.errors && Array.isArray(response.errors)) {
          notificationService.showValidationErrors(response.errors);
        } else {
          notificationService.error(
            response.message || "❌ خطا در ذخیره اطلاعات",
          );
        }
      }
    } catch (error) {
      console.error("❌ Error saving week:", error);
      notificationService.error("❌ خطا در ارتباط با سرور");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  // ===== بازنشانی/ریست هفته =====

  async resetWeekForm(btn) {
    const form = btn.closest(".week-edit-form");
    if (!form) return;

    const weekId = form.getAttribute("data-week-id");
    const weekNumber = form.getAttribute("data-week-number");

    if (weekId) {
      // اگر هفته قبلاً ثبت شده، از کاربر تأیید بگیر
      const confirmed = await notificationService.confirm({
        title: "🔄 بازنشانی هفته",
        text: `آیا از بازنشانی هفته ${weekNumber} اطمینان دارید؟\nتمام اطلاعات وارد شده پاک خواهد شد.`,
        confirmText: "بله، بازنشانی شود",
        cancelText: "انصراف",
      });
      if (!confirmed) return;

      try {
        const response = await weeklyApi.deleteWeeklyRecord(weekId);
        if (response.success) {
          if (typeof Swal !== "undefined") {
            Swal.fire({
              icon: "success",
              title: `✅ هفته ${weekNumber} بازنشانی شد`,
              confirmButtonText: "باشه",
              confirmButtonColor: "#2c7a6e",
            });
          }
          await this.loadFlocks();
          return;
        } else {
          notificationService.error(response.message || "خطا در بازنشانی");
          return;
        }
      } catch (error) {
        console.error("❌ Error resetting week:", error);
        notificationService.error("خطا در ارتباط با سرور");
        return;
      }
    }

    // اگر هفته جدید است، فقط فرم را پاک کن
    form
      .querySelectorAll('input[type="number"], input[type="text"]')
      .forEach((input) => {
        if (
          !input.disabled &&
          input.name !== "week_start_date" &&
          input.name !== "week_end_date"
        ) {
          input.value = "";
        }
      });
    form.querySelectorAll("textarea").forEach((t) => (t.value = ""));
    form.querySelectorAll("select").forEach((s) => {
      s.selectedIndex = 0;
    });

    // پاک کردن حالت محاسبه خودکار دان
    form.querySelectorAll('input[type="number"]').forEach((input) => {
      input.readOnly = false;
      input.classList.remove("feed-auto-calc");
    });

    // به‌روزرسانی کارت‌ها
    this.updateWeekCards(form);

    notificationService.info("فرم بازنشانی شد");
  },

  // ===== حذف هفته =====

  async deleteWeek(btn) {
    const form = btn.closest(".week-edit-form");
    if (!form) return;

    const weekId = form.getAttribute("data-week-id");
    if (!weekId) return;

    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف هفته",
      text: "آیا از حذف این هفته اطمینان دارید؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await weeklyApi.deleteWeeklyRecord(weekId);
      if (response.success) {
        notificationService.success("✅ هفته با موفقیت حذف شد");
        await this.loadFlocks();
      } else {
        notificationService.error(response.message || "❌ خطا در حذف هفته");
      }
    } catch (error) {
      console.error("❌ Error deleting week:", error);
      notificationService.error("❌ خطا در ارتباط با سرور");
    }
  },

};
