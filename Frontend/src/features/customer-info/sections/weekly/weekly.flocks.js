// ============================================================
// weekly.flocks.js
// فهرست گله‌ها، گروه‌بندی کارت‌ها، فیلترها/رویدادها و باز/بسته کردن هفته‌ها
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyFlockMethods) در weekly.service.js
// حجم: ۱۳ متد / ۳۵۰ خط
// ============================================================
import { weeklyApi } from "./weekly.api.js";
import { weeklyRenderer } from "./weekly.renderer.js";
import { convertToPersianDate } from "../../../../core/utils/date.utils.js";

export const weeklyFlockMethods = {
  async renderFlocks() {
    const container = document.getElementById("weeksAccordion");
    if (!container) return;

    if (!this.flocks || this.flocks.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-week"></i>
                    <p>هیچ گله فعالی یافت نشد</p>
                </div>
            `;
      return;
    }

    // مرتب‌سازی بر اساس تاریخ جوجه‌ریزی (جدیدترین اول)
    const sortedFlocks = [...this.flocks].sort((a, b) => {
      return new Date(b.placement_date) - new Date(a.placement_date);
    });

    let html = "";
    for (const flock of sortedFlocks) {
      const weeks = await this.getWeeksForFlock(flock);
      if (!weeks || weeks.length === 0) continue;

      // کش هفته‌های هر گله برای کارت‌های زنده
      this.flockWeeks[flock.id] = weeks;

      // دریافت استانداردهای نژاد گله
      const standards = await this.loadStandardsForFlock(flock);
      flock.standards = standards || [];

      const hall = this.halls.find((h) => h.id === flock.hall_id);
      const hallName = hall?.hall_name || `سالن ${flock.hall_id}`;
      const ageInDays = this.calculateAge(flock.placement_date);

      html += `
                <div class="flock-card" data-flock-id="${flock.id}">
                    <div class="flock-card-header" onclick="window.toggleFlockCard(this)">
                        <div class="flock-info">
                            <i class="fas fa-egg"></i>
                            <span class="flock-title">گله ${flock.flock_number} - ${hallName}</span>
                            <span class="flock-date">جوجه‌ریزی: ${convertToPersianDate(flock.placement_date)}</span>
                            <span class="flock-age">سن: ${ageInDays} روز</span>
                            <span class="flock-breed">${flock.breed?.name || ""}</span>
                        </div>
                        <div class="flock-header-actions">
                            <button type="button" class="btn-flock-report"
                                title="دریافت گزارش اختصاصی این سالن"
                                onclick="event.stopPropagation(); window.generateFlockReport(${flock.id})">
                                <i class="fas fa-file-alt"></i> گزارش سالن
                            </button>
                            <i class="fas fa-chevron-down flock-accordion-icon"></i>
                        </div>
                    </div>
                    <div class="flock-card-body" style="display:none">
                        <div class="weeks-list-container">
                            ${this.renderWeeks(flock, weeks)}
                        </div>
                    </div>
                </div>
            `;
    }

    container.innerHTML = html;
    this.groupFlockCards(container);

    // مقداردهی سلکت‌ها بعد از رندر
    setTimeout(() => {
      weeklyRenderer.populateSelects(this.dictionaries);
      this.updateAllWeekCards();
    }, 300);
  },

  // ===== گروه‌بندی کارت‌های سالن زیر آکاردئون گله =====

  groupFlockCards(container) {
    if (!container) return;
    const cards = [...container.querySelectorAll(".flock-card")];
    if (cards.length === 0) return;

    const infoById = {};
    (this.flocks || []).forEach((f) => {
      infoById[f.id] = f;
    });

    const groups = new Map();
    cards.forEach((card) => {
      const flock = infoById[card.dataset.flockId];
      const fid =
        flock?.flock_id != null
          ? String(flock.flock_id)
          : String(flock?.id || "0");
      if (!groups.has(fid)) {
        groups.set(fid, {
          flockNumber: flock?.flock_number || "-",
          unitName: flock?.unit?.unit_name || flock?.unit_name || null,
          items: [],
        });
      }
      groups.get(fid).items.push(card);
    });

    const fragment = document.createDocumentFragment();
    groups.forEach((group) => {
      const wrapper = document.createElement("div");
      wrapper.className = "flock-group";

      const header = document.createElement("div");
      header.className = "flock-group-header";
      const unitText = group.unitName ? ` — واحد ${group.unitName}` : "";
      header.innerHTML = `
        <div class="flock-group-info">
          <i class="fas fa-egg"></i>
          <span class="flock-group-title">گله ${group.flockNumber}${unitText}</span>
          <span class="flock-group-meta">${group.items.length} سالن</span>
        </div>
        <i class="fas fa-chevron-down flock-accordion-icon"></i>
      `;
      header.onclick = () => this.toggleFlockGroup(header);

      const body = document.createElement("div");
      body.className = "flock-group-body";
      body.style.display = "none";
      group.items.forEach((c) => body.appendChild(c));

      wrapper.appendChild(header);
      wrapper.appendChild(body);
      fragment.appendChild(wrapper);
    });

    container.innerHTML = "";
    container.appendChild(fragment);
  },

  toggleFlockGroup(header) {
    const wrapper = header.closest(".flock-group");
    const body = wrapper?.querySelector(".flock-group-body");
    const icon = header.querySelector(".flock-accordion-icon");
    if (!body) return;
    const open = body.style.display === "block";
    body.style.display = open ? "none" : "block";
    if (icon) icon.classList.toggle("rotated", !open);
  },

  // دریافت و کش استانداردهای نژاد یک گله
  async loadStandardsForFlock(flock) {
    if (!flock || !flock.breed_id) return null;
    const cacheKey = `standards_${flock.breed_id}`;
    if (this.cache[cacheKey]) return this.cache[cacheKey];
    try {
      const response = await weeklyApi.getBreedStandards(flock.breed_id);
      if (response.success) {
        const standards = response.data || [];
        this.cache[cacheKey] = standards;
        return standards;
      }
    } catch (error) {
      console.warn("⚠️ Error loading breed standards:", error);
    }
    return null;
  },

  async getWeeksForFlock(flock) {
    const flockId = flock.id;

    // محاسبه هفته‌های نظری
    const calculatedWeeks = this.calculateWeeks(flock);

    // دریافت هفته‌های موجود از دیتابیس
    let existingWeeks = [];
    try {
      const response = await weeklyApi.getWeeklyRecords(flockId);
      if (response.success) {
        existingWeeks = response.data.records || [];
      }
    } catch (error) {
      console.warn(`⚠️ Error loading weeks for flock ${flockId}:`, error);
    }

    // ادغام هفته‌ها
    return this.mergeWeeks(calculatedWeeks, existingWeeks);
  },

  // ===== نمایش تدریجی هفتههای بیشتر (سقف پیشفرض ۱۰ هفته) =====
  showMoreWeeks(btn, flockId) {
    if (!btn) return;
    const weeks = (this.flockWeeks || {})[flockId];
    const builder = (this._weekItemBuilders || {})[flockId];
    if (!Array.isArray(weeks) || typeof builder !== "function") return;

    this.weeksShown = this.weeksShown || {};
    const shown = this.weeksShown[flockId] || 0;
    const step = this.WEEKS_PER_REVEAL || 10;
    const nextCount = Math.min(shown + step, weeks.length);
    if (nextCount <= shown) {
      btn.closest(".weeks-more-bar")?.remove();
      return;
    }

    const batchHtml = weeks
      .slice(shown, nextCount)
      .map((week) => builder(week))
      .join("");

    const bar = btn.closest(".weeks-more-bar");
    if (bar) bar.insertAdjacentHTML("beforebegin", batchHtml);

    this.weeksShown[flockId] = nextCount;

    // مقداردهی selectها و کارتهای متریک هفتههای تازه اضافهشده (مانند رندر اولیه)
    weeklyRenderer.populateSelects(this.dictionaries);
    this.updateAllWeekCards();

    const remaining = weeks.length - nextCount;
    if (remaining <= 0) {
      bar?.remove();
    } else if (btn) {
      btn.innerHTML = `<i class="fas fa-chevron-down"></i> نمایش هفتههای بیشتر (${remaining} هفتهٔ باقیمانده)`;
    }
  },

  async loadFlocksFilter() {
    const select = document.getElementById("filter-flock");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">همه گله‌ها</option>';

    this.flocks.forEach((flock) => {
      const option = document.createElement("option");
      option.value = flock.id;
      const hall = this.halls.find((h) => h.id === flock.hall_id);
      option.textContent = `گله ${flock.flock_number} - ${hall?.hall_name || "سالن"}`;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  // ===== فیلترها =====

  setupFilters() {
    const unitFilter = document.getElementById("filter-unit");
    const hallFilter = document.getElementById("filter-hall");
    const flockFilter = document.getElementById("filter-flock");

    if (unitFilter) {
      unitFilter.addEventListener("change", () => this.loadFlocks());
    }

    if (hallFilter) {
      hallFilter.addEventListener("change", () => this.loadFlocks());
    }

    if (flockFilter) {
      flockFilter.addEventListener("change", () => this.loadFlocks());
    }
  },

  // ===== رویدادها =====

  setupEvents() {
    // دکمه باز کردن همه
    const expandBtn = document.querySelector(".btn-expand-all");
    if (expandBtn) {
      expandBtn.addEventListener("click", () => this.openAllWeeks());
    }

    // دکمه بستن همه
    const collapseBtn = document.querySelector(".btn-collapse-all");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => this.closeAllWeeks());
    }

    // دکمه گزارش
    const reportBtn = document.querySelector(".btn-Report-All-week");
    if (reportBtn) {
      reportBtn.addEventListener("click", () => this.generateFullReport());
    }

    // ✅ رویداد زنده‌سازی کارت‌ها و محاسبه خودکار دان
    // (رویدادها به صورت inline روی دکمه‌ها هستند؛ این‌جا فقط ورودی‌ها هندل می‌شوند)
    const accordion = document.getElementById("weeksAccordion");
    if (accordion) {
      accordion.addEventListener("input", (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;

        // محاسبه خودکار دان روزانه/هفتگی
        if (
          target.classList.contains("weekly-feed-daily") ||
          target.classList.contains("weekly-feed-weekly")
        ) {
          this.handleFeedAutoCalc(target);
          return;
        }

        // به‌روزرسانی لحظه‌ای کارت‌ها
        if (target.classList.contains("weekly-live-input")) {
          const form = target.closest(".week-edit-form");
          if (form) this.updateWeekCards(form);
        }
      });
    }
  },

  // ===== باز/بسته کردن هفته‌ها =====

  openAllWeeks() {
    const items = document.querySelectorAll(".week-accordion-item");
    items.forEach((item) => {
      if (!item.classList.contains("open")) {
        const header = item.querySelector(".week-accordion-header");
        if (header) this.toggleWeek(header);
      }
    });
  },

  closeAllWeeks() {
    const items = document.querySelectorAll(".week-accordion-item");
    items.forEach((item) => {
      if (item.classList.contains("open")) {
        const header = item.querySelector(".week-accordion-header");
        if (header) this.toggleWeek(header);
      }
    });
  },

  toggleWeek(header) {
    const item = header.closest(".week-accordion-item");
    if (!item) return;

    const wasOpen = item.classList.contains("open");
    const body = item.querySelector(".week-accordion-body");
    const icon = header.querySelector(".week-accordion-icon");

    if (wasOpen) {
      item.classList.remove("open");
      if (body) body.style.display = "none";
      if (icon) icon.style.transform = "rotate(0deg)";
    } else {
      item.classList.add("open");
      if (body) {
        body.style.display = "block";
        body.style.animation = "fadeIn 0.3s ease";
      }
      if (icon) icon.style.transform = "rotate(180deg)";
    }
  },

  // ===== toggle Flock Card Accordion =====

  toggleFlock(header) {
    const card = header.closest(".flock-card");
    if (!card) return;

    const body = card.querySelector(".flock-card-body");
    const icon = header.querySelector(".flock-accordion-icon");
    const isOpen = body.style.display === "block";

    if (isOpen) {
      body.style.display = "none";
      if (icon) icon.classList.remove("rotated");
    } else {
      body.style.display = "block";
      body.style.animation = "fadeIn 0.3s ease";
      if (icon) icon.classList.add("rotated");
    }
  },

};
