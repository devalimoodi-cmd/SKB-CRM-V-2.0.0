import { weeklyApi } from "./weekly.api.js";
import { weeklyRenderer } from "./weekly.renderer.js";
import { weeklyValidation } from "./weekly.validation.js";
import { calculateWeekMetrics } from "./weekly.calculations.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import { authService } from "../../../../core/services/auth.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
  daysBetween,
} from "../../../../core/utils/date.utils.js";

class WeeklyService {
  constructor() {
    this.customerId = null;
    this.flocks = [];
    this.units = [];
    this.halls = [];
    this.dictionaries = {};
    this.weeklyRecords = {};
    this.selectedFlockId = null;
    this.initialized = false;
    this.cache = {};
    this.flockWeeks = {};
  }

  async init(customerId) {
    // ✅ اگر customerId ارسال نشد، از state بگیر
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    console.log("📌 WeeklyService customerId:", this.customerId);

    await this.loadData();

    // ✅ رویدادها فقط یک‌بار ثبت می‌شوند (جلوگیری از انباشت listener)
    if (!this.initialized) {
      this.setupFilters();
      this.setupEvents();
      this.initialized = true;
    }
    console.log("✅ WeeklyService initialized");
  }

  async loadData() {
    try {
      // بارگذاری دیکشنری‌ها
      await this.loadDictionaries();

      // بارگذاری واحدها
      await this.loadUnits();

      // بارگذاری سالن‌ها
      await this.loadHalls();

      // بارگذاری گله‌ها
      await this.loadFlocks();
    } catch (error) {
      console.error("❌ Error loading weekly data:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  async loadDictionaries() {
    try {
      const [diseases, vaccines, medicines, feedTypes, suggestions, experts] =
        await Promise.all([
          weeklyApi.getDiseases(),
          weeklyApi.getVaccines(),
          weeklyApi.getMedicines(),
          weeklyApi.getFeedTypes(),
          weeklyApi.getSuggestions(),
          weeklyApi.getExperts(),
        ]);

      this.dictionaries = {
        diseases: diseases.success ? diseases.data : [],
        vaccines: vaccines.success ? vaccines.data : [],
        medicines: medicines.success ? medicines.data : [],
        feedTypes: feedTypes.success ? feedTypes.data : [],
        suggestions: suggestions.success ? suggestions.data : [],
        experts: experts.success ? experts.data : [],
      };

      // رندر سلکت‌ها
      weeklyRenderer.renderSelects(this.dictionaries);
    } catch (error) {
      console.error("❌ Error loading dictionaries:", error);
    }
  }

  async loadUnits() {
    try {
      const response = await weeklyApi.getUnits(this.customerId);
      if (response.success) {
        this.units = response.data.units || [];
        weeklyRenderer.renderUnitsFilter(this.units);
      }
    } catch (error) {
      console.error("❌ Error loading units:", error);
    }
  }

  async loadHalls() {
    try {
      const response = await weeklyApi.getHalls(this.customerId);
      if (response.success) {
        this.halls = response.data || [];
        weeklyRenderer.renderHallsFilter(this.halls);
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  }

  async loadFlocks() {
    try {
      // دریافت گله‌های فعال با فیلترهای انتخاب شده
      const unitId = document.getElementById("filter-unit")?.value;
      const hallId = document.getElementById("filter-hall")?.value;
      const flockId = document.getElementById("filter-flock")?.value;

      const params = { limit: 200 };
      if (unitId) params.unit_id = unitId;
      if (hallId) params.hall_id = hallId;
      if (flockId) params.id = flockId;

      const response = await weeklyApi.getActiveFlocks(this.customerId, params);
      if (response.success) {
        this.flocks = response.data.placements || [];
        stateService.setFlocks(this.flocks);
        await this.renderFlocks();
        await this.loadFlocksFilter();
      }
    } catch (error) {
      console.error("❌ Error loading flocks:", error);
    }
  }

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
                                title="دریافت گزارش اختصاصی این گله"
                                onclick="event.stopPropagation(); window.generateFlockReport(${flock.id})">
                                <i class="fas fa-file-alt"></i> گزارش گله
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

    // مقداردهی سلکت‌ها بعد از رندر
    setTimeout(() => {
      weeklyRenderer.populateSelects(this.dictionaries);
      this.updateAllWeekCards();
    }, 300);
  }

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
  }

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
  }

  calculateWeeks(flock) {
    const placementDate = new Date(flock.placement_date);
    const today = new Date();
    placementDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const ageInDays =
      Math.floor((today - placementDate) / (1000 * 60 * 60 * 24)) + 1;
    if (ageInDays <= 0) return [];

    const weekCount = Math.ceil(ageInDays / 7);
    const weeks = [];

    for (let w = 1; w <= weekCount; w++) {
      const startDay = (w - 1) * 7 + 1;
      const endDay = Math.min(w * 7, ageInDays);
      const startDate = new Date(placementDate);
      startDate.setDate(placementDate.getDate() + startDay - 1);
      const endDate = new Date(placementDate);
      endDate.setDate(placementDate.getDate() + endDay - 1);

      weeks.push({
        week_number: w,
        week_start_date: startDate.toISOString().slice(0, 10),
        week_end_date: endDate.toISOString().slice(0, 10),
        flock_age_days: endDay, // سن در پایان هفته
        existsInDb: false,
        id: null,
        daily_feed_intake: null,
        weekly_feed_intake: null,
        weekly_weight: null,
        weekly_mortality: 0,
        blackout_hours: 0,
        additional_notes: "",
        disease_ids: [],
        vaccine_ids: [],
        medicine_ids: [],
        feed_type_ids: [],
        suggestion_ids: [],
        service_expert_id: null,
        diseases: [],
        vaccines: [],
        medicines: [],
        feedTypes: [],
        suggestions: [],
        expertName: "-",
      });
    }

    return weeks;
  }

  mergeWeeks(calculated, existing) {
    const map = new Map();
    existing.forEach((w) => map.set(w.week_number, w));

    return calculated.map((calc) => {
      const ex = map.get(calc.week_number);
      if (ex) {
        return {
          ...calc,
          ...ex,
          existsInDb: true,
          diseases: ex.diseases || [],
          vaccines: ex.vaccines || [],
          medicines: ex.medicines || [],
          feedTypes: ex.feedTypes || [],
          suggestions: ex.suggestions || [],
          expertName: ex.expertName || "-",
        };
      }
      return calc;
    });
  }

  renderWeeks(flock, weeks) {
    const flockId = flock.id;
    let html = "";

    weeks.forEach((week) => {
      const hasData = week.existsInDb;
      const statusHTML = hasData
        ? '<span class="week-status saved">✅ ثبت شده</span>'
        : '<span class="week-status pending">⏳ تکمیل نشده</span>';

      const buttonText = hasData ? "بروزرسانی" : "ذخیره";
      const buttonIcon = hasData ? "fa-edit" : "fa-save";

      // ✅ پیش‌فرض کارشناس خدمات: فقط اگر کاربر لاگین‌شده نقش کارشناس (expert) باشد
      const isExpert =
        typeof authService !== "undefined" &&
        typeof authService.getUserRole === "function" &&
        authService.getUserRole() === "expert";
      const currentExpertId = isExpert ? authService.getUserId() : null;
      const defaultExpertId = week.service_expert_id || currentExpertId || "";

      html += `
                <div class="week-accordion-item" data-week-id="${week.id || ""}" data-flock="${flockId}" data-week-num="${week.week_number}">
                    <div class="week-accordion-header" onclick="window.toggleWeekAccordion(this)">
                        <div class="week-info">
                            <span class="week-number">هفته ${week.week_number}</span>
                            <span class="week-date">
                                ${convertToPersianDate(week.week_start_date)} - ${convertToPersianDate(week.week_end_date)}
                            </span>
                            ${statusHTML}
                        </div>
                        <i class="fas fa-chevron-down week-accordion-icon"></i>
                    </div>
                    <div class="week-accordion-body">
                        <form class="week-edit-form" data-week-id="${week.id || ""}" data-flock-id="${flockId}" data-week-number="${week.week_number}">
                            <input type="hidden" name="week_start_date" value="${week.week_start_date}">
                            <input type="hidden" name="week_end_date" value="${week.week_end_date}">
                            <input type="hidden" name="flock_age_days" value="${week.flock_age_days}">
                            
                            <div class="form-section">
                                <h4>📅 اطلاعات تقویمی</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>تاریخ شروع</label>
                                        <input type="text" value="${convertToPersianDate(week.week_start_date)}" disabled>
                                    </div>
                                    <div class="form-group">
                                        <label>تاریخ پایان</label>
                                        <input type="text" value="${convertToPersianDate(week.week_end_date)}" disabled>
                                    </div>
                                    <div class="form-group">
                                        <label>سن گله</label>
                                        <input type="text" value="${week.flock_age_days} روز" disabled>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>👤 کارشناس خدمات</h4>
                                <div class="form-group">
                                    <select name="service_expert_id" class="expert-select" data-selected="${defaultExpertId}">
                                        <option value="">انتخاب کارشناس...</option>
                                    </select>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>📊 مصارف و عملکرد</h4>

                                <!-- بخش ۱: ورود اطلاعات -->
                                <div class="weekly-input-section">
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>تلفات هفته (قطعه) <span class="wc-required">*</span>
                                                <span class="field-help" tabindex="0"
                                                    data-help="تعداد تلفات ۷ روز گذشته را وارد کنید. این عدد از جمع تلفات روزانه به‌دست می‌آید و برای محاسبه درصد تلفات و جمعیت زنده گله استفاده می‌شود.">؟</span></label>
                                            <input type="number" name="weekly_mortality" class="weekly-live-input"
                                                   value="${week.weekly_mortality || ""}"
                                                   placeholder="مثال: 15">
                                        </div>
                                        <div class="form-group">
                                            <label>دان مصرفی روزانه (کیلوگرم - کل گله)
                                                <span class="field-help" tabindex="0"
                                                    data-help="مقدار خوراک مصرفی کل گله در یک روز را بر اساس توزین خوراک ریخته‌شده منهای باقی‌مانده ثبت کنید. این داده برای محاسبه سرانه مصرف روزانه به کار می‌رود.">؟</span></label>
                                            <input type="number" step="0.01" name="daily_feed_intake"
                                                   class="weekly-feed-daily weekly-live-input"
                                                   value="${week.daily_feed_intake || ""}"
                                                   placeholder="مثال: 450">
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>دان مصرفی هفتگی (کیلوگرم - کل گله)
                                                <span class="field-help" tabindex="0"
                                                    data-help="جمع مصرف روزانه ۷ روز متوالی را وارد کنید. این عدد باید با مصرف روزانه همخوانی داشته باشد و مبنای محاسبه FCR و هزینه خوراک است.">؟</span></label>
                                            <input type="number" step="0.01" name="weekly_feed_intake"
                                                   class="weekly-feed-weekly weekly-live-input"
                                                   value="${week.weekly_feed_intake || ""}"
                                                   placeholder="مثال: 3150">
                                        </div>
                                        <div class="form-group">
                                            <label>وزن هفتگی (کیلوگرم) <span class="wc-required">*</span>
                                                <span class="field-help" tabindex="0"
                                                    data-help="میانگین وزنی که از نمونه‌برداری تصادفی از نقاط مختلف سالن (حداقل ۱۰۰ قطعه) به‌دست می‌آید. این داده برای محاسبه نرخ رشد و مقایسه با استاندارد نژاد استفاده می‌شود.">؟</span></label>
                                            <input type="number" step="0.001" name="weekly_weight" class="weekly-live-input"
                                                   value="${week.weekly_weight || ""}"
                                                   placeholder="مثال: 0.170">
                                        </div>
                                    </div>
                                    <div class="form-row">
                                        <div class="form-group">
                                            <label>خاموشی سالن (ساعت) - اختیاری
                                                <span class="field-help" tabindex="0"
                                                    data-help="تعداد ساعات خاموشی نور در شبانه‌روز که با افزایش سن گله، ساعت خاموشی افزایش می‌یابد و باعث استراحت بهتر جوجه‌ها می‌شود.">؟</span></label>
                                            <input type="number" step="0.5" name="blackout_hours"
                                                   value="${week.blackout_hours || ""}"
                                                   placeholder="مثال: 2">
                                        </div>
                                    </div>
                                </div>

                                <!-- بخش ۲: کارت‌های محاسباتی زنده -->
                                <div class="week-cards-grid" data-week-cards>
                                    <div class="wc-group-title">🐔 جمعیت و زنده‌مانی</div>
                                    <div class="wc-card wc-primary">
                                        <div class="wc-label">🐔 جمعیت مانده (زنده)</div>
                                        <div class="wc-value" data-metric="birdsEndOfWeek">—</div>
                                        <div class="wc-sub" data-metric="birdsStartOfWeekSub">ابتدای هفته: —</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🛡️ زنده‌مانی هفتگی</div>
                                        <div class="wc-value" data-metric="weeklySurvivalPercent">—</div>
                                        <div class="wc-sub">درصد زنده‌مانی این هفته</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🛡️ زنده‌مانی تجمعی</div>
                                        <div class="wc-value" data-metric="cumulativeSurvivalPercent">—</div>
                                        <div class="wc-sub">از ابتدا تا این هفته</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">💀 تلفات هفتگی</div>
                                        <div class="wc-value" data-metric="weeklyMortalityPercent">—</div>
                                        <div class="wc-sub">درصد تلفات این هفته</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">📉 تلفات کل</div>
                                        <div class="wc-value" data-metric="totalMortalityPercent">—</div>
                                        <div class="wc-sub">درصد تلفات تا این هفته</div>
                                    </div>

                                    <div class="wc-group-title">⚖️ وزن</div>
                                    <div class="wc-card">
                                        <div class="wc-label">⚖️ میانگین وزن هفتگی</div>
                                        <div class="wc-value" data-metric="weight">—</div>
                                        <div class="wc-sub" data-metric="weightStatusText">—</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🏋️ وزن کل گله (زنده)</div>
                                        <div class="wc-value" data-metric="totalLiveWeight">—</div>
                                        <div class="wc-sub">کیلوگرم - میانگین وزن × جمعیت</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">📈 افزایش وزن هفتگی</div>
                                        <div class="wc-value" data-metric="weightGain">—</div>
                                        <div class="wc-sub" data-metric="gainStatusText">—</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">📊 افزایش وزن کل گله</div>
                                        <div class="wc-value" data-metric="totalWeightGain">—</div>
                                        <div class="wc-sub">کیلوگرم - از جوجه‌ریزی تا این هفته</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🎯 وزن استاندارد نژاد</div>
                                        <div class="wc-value" data-metric="standardWeight">—</div>
                                        <div class="wc-sub">کیلوگرم - هفته ${week.week_number}</div>
                                    </div>

                                    <div class="wc-group-title">🚀 رشد</div>
                                    <div class="wc-card">
                                        <div class="wc-label">⚡ ADG هفتگی (نرخ رشد)</div>
                                        <div class="wc-value" data-metric="dailyGainGrams">—</div>
                                        <div class="wc-sub" data-metric="dailyGainStatusText">گرم در روز</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🚀 ADG تجمعی</div>
                                        <div class="wc-value" data-metric="cumulativeAdg">—</div>
                                        <div class="wc-sub">گرم در روز از ابتدای دوره</div>
                                    </div>

                                    <div class="wc-group-title">🛒 خوراک</div>
                                    <div class="wc-card">
                                        <div class="wc-label">🛒 دان مصرفی کل</div>
                                        <div class="wc-value" data-metric="cumulativeFeed">—</div>
                                        <div class="wc-sub">کیلوگرم تا این هفته</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🍽️ سرانه مصرف روزانه</div>
                                        <div class="wc-value" data-metric="dailyFeedPerBird">—</div>
                                        <div class="wc-sub">گرم به ازای هر قطعه</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🍽️ سرانه مصرف هفتگی</div>
                                        <div class="wc-value" data-metric="weeklyFeedPerBird">—</div>
                                        <div class="wc-sub">کیلوگرم به ازای هر قطعه</div>
                                    </div>
                                    <div class="wc-card">
                                        <div class="wc-label">🍗 FCR تا این هفته</div>
                                        <div class="wc-value" data-metric="fcr">—</div>
                                        <div class="wc-sub" data-metric="fcrStatusText">—</div>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section">
                                <h4>💊 وضعیت بهداشتی و درمانی</h4>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>بیماری‌ها</label>
                                        <select name="disease_id" class="dict-select" multiple size="3" data-selected="${(week.disease_ids || []).join(",")}">
                                            <option value="">انتخاب بیماری...</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>واکسن‌ها</label>
                                        <select name="vaccine_id" class="dict-select" multiple size="3" data-selected="${(week.vaccine_ids || []).join(",")}">
                                            <option value="">انتخاب واکسن...</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>داروها</label>
                                        <select name="medicine_id" class="dict-select" multiple size="3" data-selected="${(week.medicine_ids || []).join(",")}">
                                            <option value="">انتخاب دارو...</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label>نوع خوراک</label>
                                        <select name="feed_type_id" class="dict-select" multiple size="3" data-selected="${(week.feed_type_ids || []).join(",")}">
                                            <option value="">انتخاب نوع خوراک...</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label>پیشنهادات</label>
                                        <select name="suggestion_id" class="dict-select" multiple size="3" data-selected="${(week.suggestion_ids || []).join(",")}">
                                            <option value="">انتخاب پیشنهاد...</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label>توضیحات</label>
                                    <textarea name="additional_notes" rows="3" placeholder="توضیحات تکمیلی...">${week.additional_notes || ""}</textarea>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="button" class="btn-save-week" onclick="window.saveWeekFromForm(this)">
                                    <i class="fas ${buttonIcon}"></i> ${buttonText}
                                </button>
                                <button type="button" class="btn-cancel-week" onclick="window.resetWeekForm(this)">
                                    <i class="fas fa-undo"></i> بازنشانی
                                </button>
                                ${
                                  hasData
                                    ? `
                                    <button type="button" class="btn-delete-week" onclick="window.deleteWeekFromForm(this)">
                                        <i class="fas fa-trash"></i> حذف
                                    </button>
                                `
                                    : ""
                                }
                            </div>
                        </form>
                    </div>
                </div>
            `;
    });

    return html;
  }

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
  }

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
  }

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
  }

  // ===== باز/بسته کردن هفته‌ها =====

  openAllWeeks() {
    const items = document.querySelectorAll(".week-accordion-item");
    items.forEach((item) => {
      if (!item.classList.contains("open")) {
        const header = item.querySelector(".week-accordion-header");
        if (header) this.toggleWeek(header);
      }
    });
  }

  closeAllWeeks() {
    const items = document.querySelectorAll(".week-accordion-item");
    items.forEach((item) => {
      if (item.classList.contains("open")) {
        const header = item.querySelector(".week-accordion-header");
        if (header) this.toggleWeek(header);
      }
    });
  }

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
  }

  // ===== محاسبه خودکار دان روزانه/هفتگی =====

  handleFeedAutoCalc(input) {
    const form = input.closest(".week-edit-form");
    if (!form) return;

    const dailyInput = form.querySelector('input[name="daily_feed_intake"]');
    const weeklyInput = form.querySelector('input[name="weekly_feed_intake"]');
    if (!dailyInput || !weeklyInput) return;

    if (input === dailyInput) {
      const val = parseFloat(dailyInput.value);
      if (!isNaN(val) && val >= 0) {
        // روزانه × ۷ = هفتگی
        const weekly = Math.round(val * 7 * 100) / 100;
        weeklyInput.value = weekly;
        weeklyInput.readOnly = true;
        weeklyInput.classList.add("feed-auto-calc");
        dailyInput.readOnly = false;
        dailyInput.classList.remove("feed-auto-calc");
      } else {
        weeklyInput.readOnly = false;
        weeklyInput.classList.remove("feed-auto-calc");
      }
    } else if (input === weeklyInput) {
      const val = parseFloat(weeklyInput.value);
      if (!isNaN(val) && val >= 0) {
        // هفتگی ÷ ۷ = روزانه
        const daily = Math.round((val / 7) * 100) / 100;
        dailyInput.value = daily;
        dailyInput.readOnly = true;
        dailyInput.classList.add("feed-auto-calc");
        weeklyInput.readOnly = false;
        weeklyInput.classList.remove("feed-auto-calc");
      } else {
        dailyInput.readOnly = false;
        dailyInput.classList.remove("feed-auto-calc");
      }
    }

    // به‌روزرسانی کارت‌ها بعد از تغییر دان
    this.updateWeekCards(form);
  }

  // ===== کارت‌های محاسباتی زنده =====

  updateAllWeekCards() {
    document.querySelectorAll(".week-edit-form").forEach((form) => {
      this.updateWeekCards(form);
    });
  }

  updateWeekCards(form) {
    if (!form) return;

    const flockId = form.getAttribute("data-flock-id");
    const weekNumber = parseInt(form.getAttribute("data-week-number"));
    if (!flockId || !weekNumber) return;

    const flock = this.flocks.find((f) => String(f.id) === String(flockId));
    if (!flock) return;

    const weeks = this.flockWeeks[flockId] || [];

    // مقادیر زنده فرم
    const formValues = {
      weekly_weight: form.querySelector('input[name="weekly_weight"]')?.value,
      weekly_feed_intake: form.querySelector(
        'input[name="weekly_feed_intake"]',
      )?.value,
      weekly_mortality: form.querySelector('input[name="weekly_mortality"]')
        ?.value,
      flock_age_days: form.querySelector('input[name="flock_age_days"]')?.value,
    };

    const metrics = calculateWeekMetrics({
      flock,
      weeks,
      weekNumber,
      formValues,
    });

    const cards = form.querySelector("[data-week-cards]");
    if (!cards) return;

    const setMetric = (key, text) => {
      const el = cards.querySelector(`[data-metric="${key}"]`);
      if (el) el.textContent = text;
    };

    const fa = (v, digits) =>
      v === null || v === undefined || isNaN(v)
        ? "—"
        : Number(v.toFixed(digits)).toLocaleString("fa-IR");

    setMetric(
      "birdsEndOfWeek",
      metrics.birdsEndOfWeek !== null ? fa(metrics.birdsEndOfWeek, 0) : "—",
    );
    setMetric(
      "birdsStartOfWeekSub",
      metrics.birdsStartOfWeek !== null
        ? `ابتدای هفته: ${fa(metrics.birdsStartOfWeek, 0)} قطعه`
        : "ابتدای هفته: —",
    );
    setMetric(
      "weeklyMortalityPercent",
      metrics.weeklyMortalityPercent !== null
        ? `٪${fa(metrics.weeklyMortalityPercent, 2)}`
        : "—",
    );
    setMetric(
      "totalMortalityPercent",
      metrics.totalMortalityPercent !== null
        ? `٪${fa(metrics.totalMortalityPercent, 2)}`
        : "—",
    );
    setMetric(
      "standardWeight",
      metrics.standardWeight !== null
        ? `${fa(metrics.standardWeight, 3)} کیلوگرم`
        : "—",
    );
    setMetric(
      "weight",
      metrics.weight !== null ? `${fa(metrics.weight, 3)} کیلوگرم` : "—",
    );
    setMetric(
      "weightGain",
      metrics.weightGain !== null
        ? `${fa(metrics.weightGain, 3)} کیلوگرم`
        : "—",
    );
    setMetric(
      "dailyGain",
      metrics.dailyGain !== null
        ? `${fa(metrics.dailyGain, 4)} کیلوگرم`
        : "—",
    );
    setMetric(
      "cumulativeFeed",
      metrics.cumulativeFeed !== null
        ? `${fa(metrics.cumulativeFeed, 1)} کیلوگرم`
        : "—",
    );
    setMetric("fcr", metrics.fcr !== null ? fa(metrics.fcr, 3) : "—");

    // متریک‌های جدید
    setMetric(
      "weeklySurvivalPercent",
      metrics.weeklySurvivalPercent !== null
        ? `٪${fa(metrics.weeklySurvivalPercent, 2)}`
        : "—",
    );
    setMetric(
      "cumulativeSurvivalPercent",
      metrics.cumulativeSurvivalPercent !== null
        ? `٪${fa(metrics.cumulativeSurvivalPercent, 2)}`
        : "—",
    );
    setMetric(
      "totalLiveWeight",
      metrics.totalLiveWeight !== null
        ? `${fa(metrics.totalLiveWeight, 1)} کیلوگرم`
        : "—",
    );
    setMetric(
      "totalWeightGain",
      metrics.totalWeightGain !== null
        ? `${fa(metrics.totalWeightGain, 1)} کیلوگرم`
        : "—",
    );
    setMetric(
      "dailyGainGrams",
      metrics.dailyGainGrams !== null
        ? `${fa(metrics.dailyGainGrams, 1)} گرم`
        : "—",
    );
    setMetric(
      "cumulativeAdg",
      metrics.cumulativeAdg !== null
        ? `${fa(metrics.cumulativeAdg, 1)} گرم`
        : "—",
    );
    setMetric(
      "dailyFeedPerBird",
      metrics.dailyFeedPerBird !== null
        ? `${fa(metrics.dailyFeedPerBird, 1)} گرم`
        : "—",
    );
    setMetric(
      "weeklyFeedPerBird",
      metrics.weeklyFeedPerBird !== null
        ? `${fa(metrics.weeklyFeedPerBird, 3)} کیلوگرم`
        : "—",
    );

    // متن وضعیت‌ها
    setMetric("weightStatusText", this.weightStatusText(metrics));
    setMetric("gainStatusText", this.gainStatusText(metrics));
    setMetric("fcrStatusText", this.fcrStatusText(metrics));
    setMetric("dailyGainStatusText", this.dailyGainStatusText(metrics));

    // تغییر رنگ کارت بر اساس وضعیت وزن
    const weightCard = cards
      .querySelector('[data-metric="weight"]')
      ?.closest(".wc-card");
    if (weightCard) {
      weightCard.classList.remove("wc-ok", "wc-warn", "wc-bad");
      if (metrics.weightStatus === "ok") weightCard.classList.add("wc-ok");
      else if (metrics.weightStatus === "below")
        weightCard.classList.add("wc-bad");
      else if (metrics.weightStatus === "above")
        weightCard.classList.add("wc-warn");
    }
  }

  weightStatusText(m) {
    if (m.weight === null || !m.standard) return "—";
    const fa = (v) =>
      v === null || v === undefined || isNaN(v)
        ? "—"
        : Number(v.toFixed(3)).toLocaleString("fa-IR");
    if (m.weightStatus === "ok") return "✅ در بازه استاندارد";
    if (m.weightStatus === "below")
      return `▼ ${fa(Math.abs(m.weightDeviation))} کیلوگرم کمتر از هدف`;
    if (m.weightStatus === "above")
      return `▲ ${fa(m.weightDeviation)} کیلوگرم بیشتر از هدف`;
    return "—";
  }

  gainStatusText(m) {
    if (m.standardGain === null) {
      return m.weightGain !== null ? "استاندارد نژاد ثبت نشده" : "—";
    }
    const fa = (v) =>
      v === null || v === undefined || isNaN(v)
        ? "—"
        : Number(v.toFixed(3)).toLocaleString("fa-IR");
    const base = `استاندارد: ${fa(m.standardGain)} کیلوگرم`;
    if (m.gainDeviation === null || m.gainDeviation === 0) return base;
    const sign = m.gainDeviation > 0 ? "▲" : "▼";
    return `${base} | ${sign} ٪${fa(Math.abs(m.gainDeviation))}`;
  }

  fcrStatusText(m) {
    if (m.standardFcr === null || m.standardFcr === undefined) {
      return m.fcr !== null ? "استاندارد FCR ثبت نشده" : "—";
    }
    const fa = (v) =>
      v === null || v === undefined || isNaN(v)
        ? "—"
        : Number(v.toFixed(3)).toLocaleString("fa-IR");
    const base = `استاندارد: ${fa(m.standardFcr)}`;
    if (m.fcr === null || m.fcrDeviation === null || m.fcrDeviation === 0) {
      return base;
    }
    const sign = m.fcrDeviation > 0 ? "▲" : "▼";
    return `${base} | ${sign} ٪${fa(Math.abs(m.fcrDeviation))}`;
  }

  dailyGainStatusText(m) {
    if (
      m.standardDailyGainGrams === null ||
      m.standardDailyGainGrams === undefined
    ) {
      return "گرم در روز";
    }
    const fa = (v) =>
      v === null || v === undefined || isNaN(v)
        ? "—"
        : Number(v.toFixed(1)).toLocaleString("fa-IR");
    const base = `استاندارد: ${fa(m.standardDailyGainGrams)} گرم`;
    if (m.dailyGainGrams === null) return base;
    const diff = m.dailyGainGrams - m.standardDailyGainGrams;
    if (Math.abs(diff) < 0.05) return base;
    const sign = diff > 0 ? "▲" : "▼";
    return `${base} | ${sign} ${fa(Math.abs(diff))}`;
  }

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
  }

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
  }

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
  }

  // ===== گزارش کامل =====

  async generateFullReport() {
    try {
      notificationService.info("📊 در حال آماده‌سازی گزارش...");

      // دریافت اطلاعات مشتری
      const customerResponse = await weeklyApi.getCustomer(this.customerId);
      const customer = customerResponse.success ? customerResponse.data : {};

      // دریافت گله‌ها با اطلاعات کامل + متریک هر هفته
      const flocksWithWeeks = await Promise.all(
        this.flocks.map(async (flock) => this.buildFlockReportData(flock)),
      );

      // تولید HTML گزارش
      const reportHtml = weeklyRenderer.renderFullReport(
        customer,
        flocksWithWeeks,
        this.units,
      );

      this.openReportWindow(reportHtml);
      notificationService.success("✅ گزارش با موفقیت آماده شد");
    } catch (error) {
      console.error("❌ Error generating report:", error);
      notificationService.error("❌ خطا در تولید گزارش");
    }
  }

  // ===== ساخت داده گزارش یک گله (هفته‌ها + متریک هر هفته + آمار) =====

  async buildFlockReportData(flock) {
    const weeks = await this.getWeeksForFlock(flock);
    const hall = this.halls.find((h) => h.id === flock.hall_id);

    // اطمینان از وجود استاندارد نژاد
    if (!Array.isArray(flock.standards)) {
      flock.standards = (await this.loadStandardsForFlock(flock)) || [];
    }

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

    return {
      ...flock,
      hall_name: hall?.hall_name || `سالن ${flock.hall_id}`,
      breed_name: flock.breed?.name || "—",
      weeks: weeks,
      savedWeeks: savedWeeks,
      statistics: {
        totalMortality,
        totalFeed: totalFeed.toFixed(1),
        weekCount: savedWeeks.length,
        lastWeight,
        fcr: finalMetrics?.fcr ?? null,
        finalMetrics,
      },
    };
  }

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
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = function () {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
    return true;
  }

  // ===== گزارش اختصاصی یک گله =====

  async generateFlockReport(flockId) {
    try {
      const flock = this.flocks.find((f) => String(f.id) === String(flockId));
      if (!flock) {
        notificationService.error("گله یافت نشد");
        return;
      }

      notificationService.info("📄 در حال آماده‌سازی گزارش گله...");

      const customerResponse = await weeklyApi.getCustomer(this.customerId);
      const customer = customerResponse.success ? customerResponse.data : {};

      const flockData = await this.buildFlockReportData(flock);

      const reportHtml = weeklyRenderer.renderFlockReport(
        customer,
        flockData,
        this.units,
      );

      this.openReportWindow(reportHtml);
      notificationService.success("✅ گزارش گله با موفقیت آماده شد");
    } catch (error) {
      console.error("❌ Error generating flock report:", error);
      notificationService.error("❌ خطا در تولید گزارش گله");
    }
  }

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
  }

  // ===== ابزارهای کمکی =====

  calculateAge(placementDate) {
    const today = new Date();
    const placement = new Date(placementDate);
    placement.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - placement) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  }

  refresh() {
    this.loadData();
  }

  resetCache() {
    this.cache = {};
    this.flockWeeks = {};
  }
}

export const weeklyService = new WeeklyService();

if (typeof window !== "undefined") {
  window.weeklyService = weeklyService;
  window.WeeklyService = WeeklyService;
  window.refreshWeeksDisplay = () => weeklyService.loadFlocks();
  window.resetWeeksCache = () => weeklyService.resetCache();
  window.openAllWeeks = () => weeklyService.openAllWeeks();
  window.closeAllWeeks = () => weeklyService.closeAllWeeks();
  window.generateFullWeeklyReport = () => weeklyService.generateFullReport();
  window.generateFlockReport = (flockId) => weeklyService.generateFlockReport(flockId);
  window.saveWeekFromForm = (btn) => weeklyService.saveWeek(btn);
  window.resetWeekForm = (btn) => weeklyService.resetWeekForm?.(btn);
  window.deleteWeekFromForm = (id) => weeklyService.deleteWeek(id);
  window.toggleWeekAccordion = (header) => weeklyService.toggleWeek(header);
  window.toggleFlockCard = (header) => weeklyService.toggleFlock?.(header);
}
