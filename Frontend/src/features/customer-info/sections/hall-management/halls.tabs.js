// ============================================================
// halls.tabs.js
// تب‌ها و رویدادهای صفحه (setupTabs/activateTab/loadTabData/resetTab/checkActivePeriod/setupEvents)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsTabMethods) در halls.service.js
// حجم: ۶ متد / ۲۰۶ خط
// ============================================================

export const hallsTabMethods = {
  setupTabs() {
    const container = document.querySelector(
      ".customer-AddHals .tabs-container",
    );
    if (!container) return;

    container.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".tab-btn");
      if (!tabBtn) return;
      if (!container.contains(tabBtn)) return;
      const tabId = tabBtn.dataset.tab;
      if (tabId) this.activateTab(tabId);
    });

    this.checkActivePeriod();
  },
  activateTab(tabId) {
    const container = document.querySelector(".customer-AddHals");
    if (!container) return;
    container
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    container
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    const btn = container.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.classList.add("active");
    const tabMap = {
      unit: "unitTab",
      basic: "basicTab",
      physical: "physicalTab",
      systems: "systemsTab",
      "water-food": "waterFoodTab",
    };
    const contentId = tabMap[tabId];
    if (contentId) {
      const content = document.getElementById(contentId);
      if (content) {
        content.classList.add("active");
        this.loadTabData(contentId);
      }
    }
    this.activeTab = tabId;
  },
  loadTabData(contentId) {
    // در حالت ویرایش، اطلاعات از editHall بارگذاری شده؛ نیازی به بارگذاری مجدد نیست
    if (this.editingHallId) return;

    if (contentId === "physicalTab") {
      const hall = document.getElementById("physicalHallNumber");
      if (hall && hall.value) this.loadPhysicalInfo(hall.value);
    } else if (contentId === "systemsTab") {
      const hall = document.getElementById("systemsHallNumber");
      if (hall && hall.value) {
        if (String(hall.value) !== String(this._loadedSystemsHallId || "")) {
          this._loadedSystemsHallId = hall.value;
          this.loadSystemInfo(hall.value);
        }
      } else {
        this._loadedSystemsHallId = null;
        this.renderSystemItemsEditor([], {});
      }
    } else if (contentId === "waterFoodTab") {
      const hall = document.getElementById("wfHallNumber");
      if (hall && hall.value) this.loadWaterFeedInfo(hall.value);
    } else if (contentId === "basicTab") {
      this.lockBasicHallNumberField();
      this.refreshUnitCapacityBadge();
    }
  },
  // ===== Reset =====

  resetTab(tabId) {
    const tabMap = {
      unitTab: [
        "unitName",
        "unitAddress",
        "unitLongitude",
        "unitLatitude",
        "unitHallCount",
        "unitCapacity",
        "unitManagerName",
        "unitManagerPhone",
      ],
      basicTab: [
        "hallNumber",
        "UnitNumber",
        "hallName",
        "capacity",
        "altitude",
        "hallType",
        "buildYear",
        "expert",
        "operator",
      ],
      physicalTab: [
        "length",
        "width",
        "height",
        "area",
        "floorMaterial",
        "Hall-Physical-Description",
      ],
      systemsTab: [
        "fanCount",
        "fanSize",
        "fanCapacity",
        "heaterCount",
        "heatingType",
        "coolingType",
        "ventilationType",
        "sanitarySystem",
        "lighthingSystem",
        "Hall-System-Description",
      ],
      waterFoodTab: [
        "waterType",
        "foodType",
        "waterLines",
        "foodLines",
        "Hall-water-feed-Description",
      ],
    };
    (tabMap[tabId] || []).forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === "SELECT") el.value = "";
        else if (el.type === "checkbox" || el.type === "radio")
          el.checked = false;
        else el.value = "";
      }
    });
    if (tabId === "basicTab") {
      const sel = document.getElementById("hallNumber");
      if (sel) {
        sel.disabled = false;
        sel.style.opacity = "";
        sel.style.background = "";
        sel.title = "";
      }
      this.applyDefaultExpertSelection();
      this.refreshUnitCapacityBadge();
    }
    if (tabId === "systemsTab") {
      this._loadedSystemsHallId = null;
      this.renderSystemItemsEditor([], {});
    }
    if (tabId === "waterFoodTab")
      document
        .querySelectorAll('input[name="autoFood"]')
        .forEach((r) => (r.checked = false));
    // ریست ردیف‌های کارشناس واحد
    if (tabId === "unitTab") this.resetUnitExpertRows();
    const saveBtn = document.querySelector(`#${tabId} .btn-primary`);
    if (saveBtn) {
      const texts = {
        unitTab: "ثبت واحد جدید",
        basicTab: "ذخیره اطلاعات پایه",
        physicalTab: "ذخیره اطلاعات فیزیکی",
        systemsTab: "ذخیره اطلاعات سیستم‌ها",
        waterFoodTab: "ذخیره اطلاعات آبخوری و دانخوری",
      };
      saveBtn.innerHTML = `<i class="fas fa-save"></i> ${texts[tabId] || "ذخیره"}`;
      saveBtn.style.background = "";
      saveBtn.disabled = false;
    }
  },
  async checkActivePeriod() {
    // تب "تعریف واحد" همیشه نمایش داده شود — مخفی نمی‌شود
    const container = document.querySelector(".customer-AddHals");
    if (!container) return;
    const unitTab = container.querySelector('[data-tab="unit"]');
    const unitTabContent = document.getElementById("unitTab");
    if (unitTab) unitTab.style.display = "";
    if (unitTabContent) unitTabContent.style.display = "";
    // پیش‌فرض تب basic فعال باشد (اگر قبلاً انتخاب نشده)
    const activeBtn = container.querySelector(".tab-btn.active");
    if (!activeBtn) this.activateTab("basic");
  },
  setupEvents() {
    const lengthInput = document.getElementById("length");
    const widthInput = document.getElementById("width");
    if (lengthInput && widthInput) {
      lengthInput.addEventListener("input", () => this.calculateArea());
      widthInput.addEventListener("input", () => this.calculateArea());
    }
    // ✅ شنوندهٔ «تغییر استان» اینجا لازم نیست: فیلد `#skb-province` متعلق به بخش
    // «اطلاعات پایه» است و basic-info.service.js (خط ۱۲۴-۱۳۱) خودش شهرستان‌ها را
    // بارگذاری می‌کند. پیش‌تر اینجا متد `loadCities` (که روی HallsService وجود
    // ندارد) صدا زده می‌شد ⇒ به‌ازای هر تغییر استان TypeError در کنسول.
    const unitNumSelect = document.getElementById("UnitNumber");
    if (unitNumSelect) {
      unitNumSelect.addEventListener("change", () => {
        this.autoGenerateHallName();
        this.refreshUnitCapacityBadge();
      });
    }
    const capacityInput = document.getElementById("capacity");
    if (capacityInput) {
      capacityInput.addEventListener("input", () => {
        this.refreshUnitCapacityBadge();
      });
      capacityInput.addEventListener("change", () => {
        this.refreshUnitCapacityBadge();
      });
    }
    this.setupSaveButtons();
  },

};
