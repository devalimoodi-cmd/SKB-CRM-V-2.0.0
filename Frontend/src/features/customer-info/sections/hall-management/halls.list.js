// ============================================================
// halls.list.js
// فهرست سالن‌ها (رندر، اطلاعات دوره، دراپ‌داون‌ها، باز/بسته کردن کارت و تغییر وضعیت)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsListMethods) در halls.service.js
// حجم: ۹ متد / ۲۰۷ خط
// ============================================================
import { hallsApi } from "./halls.api.js";
import { hallsRenderer } from "./halls.renderer.js";
import { notificationService } from "../../../../core/services/notification.service.js";

export const hallsListMethods = {
  async renderHallsList() {
    const hallsWithDetails = await Promise.all(
      this.halls.map(async (hall) => {
        const [periodInfo, physicalInfo, systemInfo, waterFeedInfo] =
          await Promise.all([
            this.getPeriodInfo(hall.period_id),
            hallsApi
              .getPhysicalInfo(hall.id)
              .catch(() => ({ success: false, data: null })),
            hallsApi
              .getSystemInfo(hall.id)
              .catch(() => ({ success: false, data: null })),
            hallsApi
              .getWaterFeedInfo(hall.id)
              .catch(() => ({ success: false, data: null })),
          ]);

        return {
          ...hall,
          periodInfo: periodInfo || null,
          physicalInfo: physicalInfo.success ? physicalInfo.data : null,
          systemInfo: systemInfo.success ? systemInfo.data : null,
          waterFeedInfo: waterFeedInfo.success ? waterFeedInfo.data : null,
        };
      }),
    );

    // بارگذاری جزئیات کامل واحدها (شامل کارشناسان) برای پنل جزئیات
    const unitsWithDetails = await Promise.all(
      this.periods.map(async (unit) => {
        try {
          const res = await hallsApi.getUnit(unit.id);
          if (res.success) return res.data;
        } catch (e) {
          console.error("❌ Error loading unit details:", e);
        }
        return unit;
      }),
    );

    hallsRenderer.renderUnitsAccordion(
      unitsWithDetails,
      hallsWithDetails,
      this.dictionaries,
    );
  },
  async getPeriodInfo(periodId) {
    if (!periodId) return null;
    return this.periods.find((p) => p.id === periodId) || null;
  },
  updateHallsDropdowns() {
    const hallSelect = document.getElementById("hallNumber");
    if (hallSelect) {
      const currentValue = hallSelect.value;
      hallsRenderer.populateHallSelect(hallSelect, this.halls);
      if (
        currentValue &&
        Array.from(hallSelect.options).some((opt) => opt.value == currentValue)
      ) {
        hallSelect.value = currentValue;
      }
    }
    this.updateFilteredHallDropdown("physicalHallNumber", "physical");
    this.updateFilteredHallDropdown("systemsHallNumber", "system");
    this.updateFilteredHallDropdown("wfHallNumber", "waterFeed");
    this.lockBasicHallNumberField();
  },
  async updateFilteredHallDropdown(dropdownId, infoType) {
    const select = document.getElementById(dropdownId);
    if (!select) return;
    const currentValue = select.value;

    const hallStatuses = await Promise.all(
      this.halls.map(async (hall) => {
        let hasInfo = false;
        try {
          if (infoType === "physical") {
            const res = await hallsApi
              .getPhysicalInfo(hall.id)
              .catch(() => ({ success: false }));
            hasInfo = res.success && res.data;
          } else if (infoType === "system") {
            const res = await hallsApi
              .getSystemInfo(hall.id)
              .catch(() => ({ success: false }));
            hasInfo = res.success && res.data;
          } else if (infoType === "waterFeed") {
            const res = await hallsApi
              .getWaterFeedInfo(hall.id)
              .catch(() => ({ success: false }));
            hasInfo = res.success && res.data;
          }
        } catch (e) {
          hasInfo = false;
        }
        return { hall, hasInfo };
      }),
    );

    const typeLabel =
      infoType === "physical"
        ? "فیزیکی"
        : infoType === "system"
          ? "سیستم‌ها"
          : "آبخوری و دانخوری";
    select.innerHTML = `<option value="">انتخاب سالن (${typeLabel})...</option>`;
    hallStatuses.forEach((hs) => {
      const hall = hs.hall;
      const option = document.createElement("option");
      option.value = hall.id;
      option.textContent = `${hall.hall_name} (شماره ${hall.hall_number || hall.id})${hs.hasInfo ? " — ثبت‌شده ✓" : ""}`;
      select.appendChild(option);
    });
    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },
  toggleUnitCard(header) {
    const card = header.closest(".unit-card");
    if (!card) return;
    const body = card.querySelector(".unit-card-body");
    const isExpanded = body.style.display === "block";
    if (isExpanded) {
      body.style.display = "none";
      header.classList.add("collapsed");
    } else {
      body.style.display = "block";
      header.classList.remove("collapsed");
    }
  },
  // باز نگه‌داشتن کارت یک واحد خاص (بعد از رفرش لیست)
  expandUnitCard(unitId, scroll = true) {
    const card = document.querySelector(
      `.unit-card[data-unit-id="${unitId}"]`,
    );
    if (!card) return;
    const body = card.querySelector(".unit-card-body");
    const header = card.querySelector(".unit-card-header");
    if (body) body.style.display = "block";
    if (header) header.classList.remove("collapsed");
    if (scroll && typeof card.scrollIntoView === "function") {
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  },
  toggleHallCard(header) {
    const card = header.closest(".hall-card");
    if (!card) return;
    const body = card.querySelector(".hall-card-body");
    const isExpanded = body.classList.contains("expanded");
    if (isExpanded) {
      body.classList.remove("expanded");
      body.style.display = "none";
      header.classList.add("collapsed");
    } else {
      body.classList.add("expanded");
      body.style.display = "block";
      header.classList.remove("collapsed");
    }
  },
  async toggleUnitStatus(unitId, newStatus) {
    const actionText = newStatus ? "فعال" : "غیرفعال";
    const confirmed = await notificationService.confirm({
      title: `${actionText} سازی واحد`,
      text: `آیا از ${actionText} سازی این واحد اطمینان دارید؟`,
      confirmText: `بله، ${actionText} شود`,
      cancelText: "انصراف",
    });
    if (!confirmed) return;
    try {
      const response = await hallsApi.updateUnit(unitId, {
        is_active: newStatus,
      });
      if (response.success) {
        notificationService.success("✅ وضعیت واحد با موفقیت تغییر کرد");
        await this.loadData();
      } else
        notificationService.error(response.message || "خطا در تغییر وضعیت");
    } catch (error) {
      console.error("❌ Error toggling unit status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  },
  async toggleHallStatus(hallId, newStatus) {
    const actionText = newStatus ? "فعال" : "غیرفعال";
    const confirmed = await notificationService.confirm({
      title: `${actionText} سازی سالن`,
      text: `آیا از ${actionText} سازی این سالن اطمینان دارید؟`,
      confirmText: `بله، ${actionText} شود`,
      cancelText: "انصراف",
    });
    if (!confirmed) return;
    try {
      const response = await hallsApi.toggleHallStatus(hallId, {
        is_active: newStatus,
      });
      if (response.success) {
        notificationService.success("✅ وضعیت سالن با موفقیت تغییر کرد");
        await this.loadData();
      } else
        notificationService.error(response.message || "خطا در تغییر وضعیت");
    } catch (error) {
      console.error("❌ Error toggling hall status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  },

};
