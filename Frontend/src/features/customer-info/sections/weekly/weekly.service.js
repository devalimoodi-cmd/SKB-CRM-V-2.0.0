import { weeklyApi } from "./weekly.api.js";
import {
  weeklyRenderer,
  REPORT_STYLES,
  renderHistoryWeekMatrix,
} from "./weekly.renderer.js";
import {
  REPORT_GROUPS,
  REPORT_GROUP_STORAGE_KEY,
  ALL_GROUP_KEYS,
  normalizeGroups,
} from "./weekly.report.groups.js";
import {
  auditWeeks,
  mergeAudits,
  resolveFlockTimelineEnd,
  scopeAuditToWeeks,
  timelineBasisLabel,
} from "./weekly.audit.js";
import {
  WEEK_PRESET,
  WEEK_PRESET_LABELS,
  WEEK_SELECTION_STORAGE_KEY,
  WEEK_STATUS_LABELS,
  buildWeekTimeline,
  effectiveWeeksFor,
  issuesOutsideSelection,
  mergeWeekTimelines,
  normalizeWeekSelection,
  resolvePresetWeeks,
  summarizeWeekSelection,
  weekSelectionLabel,
} from "./weekly.report.weeks.js";
import { weeklyValidation } from "./weekly.validation.js";
import { calculateWeekMetrics } from "./weekly.calculations.js";
import { groupFlocksByFlock, sortFlocksByHall } from "./weekly.aggregation.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { sanitizeHtmlDocument } from "../../../../core/utils/string.utils.js";

import { stateService } from "../../../../core/services/state.service.js";
import { authService } from "../../../../core/services/auth.service.js";
import { apiService } from "../../../../core/services/api.service.js";
import { hatcheryApi } from "../hatchery/hatchery.api.js";
import {
  convertToPersianDate,
  formatDate,
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
    this.weeksShown = {};
    this._weekItemBuilders = {};
    this.MAX_DEFAULT_WEEKS = 10;
    this.WEEKS_PER_REVEAL = 10;
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
  }

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
  }

  toggleFlockGroup(header) {
    const wrapper = header.closest(".flock-group");
    const body = wrapper?.querySelector(".flock-group-body");
    const icon = header.querySelector(".flock-accordion-icon");
    if (!body) return;
    const open = body.style.display === "block";
    body.style.display = open ? "none" : "block";
    if (icon) icon.classList.toggle("rotated", !open);
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
    const maxDefault = this.MAX_DEFAULT_WEEKS || 10;
    const visibleCount = Math.min(maxDefault, weeks.length);
    const remainingCount = weeks.length - visibleCount;

    this.weeksShown = this.weeksShown || {};
    this.weeksShown[flockId] = visibleCount;

    // سازندهٔ HTML هر آیتم هفته — برای رندر اولیه و «نمایش بیشتر» مشترک است
    this._weekItemBuilders = this._weekItemBuilders || {};
    this._weekItemBuilders[flockId] = (week) => {
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

      return `
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
    };

    let html = weeks
      .slice(0, visibleCount)
      .map((week) => this._weekItemBuilders[flockId](week))
      .join("");

    if (remainingCount > 0) {
      html += `
                <div class="weeks-more-bar" data-flock-id="${flockId}">
                    <button type="button" class="btn-show-more-weeks" onclick="window.weeklyService.showMoreWeeks(this, ${flockId})">
                        <i class="fas fa-chevron-down"></i> نمایش هفتههای بیشتر (${remainingCount} هفتهٔ باقیمانده)
                    </button>
                </div>
            `;
    }

    return html;
  }

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
  }

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
    // ✅ پاک‌سازی خروجی گزارش (جلوگیری از اجرای اسکریپت تزریق‌شده از دیتابیس)
    printWindow.document.write(sanitizeHtmlDocument(html));
    printWindow.document.close();
    printWindow.onload = function () {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
    return true;
  }

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
  }

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
  }

  // ===== انتخاب گروه‌های شاخص گزارش (مودال) =====

  /** گروه‌های ذخیره‌شدهٔ کاربر (پیش‌فرض = همهٔ شاخص‌ها) */
  loadSavedReportGroups() {
    try {
      const raw = localStorage.getItem(REPORT_GROUP_STORAGE_KEY);
      if (!raw) return [...ALL_GROUP_KEYS];
      return normalizeGroups(JSON.parse(raw));
    } catch {
      return [...ALL_GROUP_KEYS];
    }
  }

  saveReportGroups(selected) {
    try {
      localStorage.setItem(
        REPORT_GROUP_STORAGE_KEY,
        JSON.stringify(normalizeGroups(selected)),
      );
    } catch {
      // اگر localStorage در دسترس نبود، انتخاب فقط برای همین گزارش اعمال می‌شود
    }
  }

  /**
   * مودال انتخاب گروه‌های شاخص پیش از تولید گزارش
   * @param {{title?:string, subtitle?:string}} options
   * @returns {Promise<string[]|null>} آرایهٔ کلید گروه‌ها یا null در صورت انصراف
   */
  async pickReportGroups({ title = "انتخاب شاخص‌های گزارش", subtitle = "" } = {}) {
    // اگر SweetAlert2 در دسترس نبود → مثل قبل همهٔ شاخص‌ها (سازگاری عقب‌رو)
    if (typeof Swal === "undefined") return [...ALL_GROUP_KEYS];

    const saved = this.loadSavedReportGroups();

    const rowsHtml = REPORT_GROUPS.map(
      (group) => `
          <label class="wh-item" data-key="${group.key}">
            <input type="checkbox" class="wh-item-check rg-group-check" value="${group.key}" ${saved.includes(group.key) ? "checked" : ""}>
            <span class="wh-item-main">
              <span class="wh-item-title">${group.title}</span>
              <span class="wh-item-meta">
                <span><i class="fas fa-circle-info"></i> ${group.hint}</span>
              </span>
            </span>
          </label>`,
    ).join("");

    const html = `
      <div class="wh-picker" dir="rtl">
        <div class="wh-stats">
          <div class="wh-stat">
            <span class="wh-stat-val" id="rgStatSelected">0</span>
            <span class="wh-stat-lbl">گروه انتخاب‌شده</span>
          </div>
          <div class="wh-stat">
            <span class="wh-stat-val" id="rgStatTotal">${REPORT_GROUPS.length}</span>
            <span class="wh-stat-lbl">گروه شاخص موجود</span>
          </div>
        </div>

        <div class="wh-toolbar">
          <button type="button" class="wh-tool-btn" id="rgSelectAll">
            <i class="fas fa-check-double"></i> انتخاب همه
          </button>
          <button type="button" class="wh-tool-btn ghost" id="rgClearAll">
            <i class="fas fa-eraser"></i> پاک‌کردن
          </button>
          <button type="button" class="wh-tool-btn ghost" id="rgResetDefault">
            <i class="fas fa-rotate-left"></i> پیش‌فرض (همه)
          </button>
        </div>

        <div class="wh-list" id="rgGroupList">${rowsHtml}</div>

        <p class="wh-hint">
          <i class="fas fa-circle-info"></i>
          ${subtitle || "فقط گروه‌های تیک‌خورده در جدول‌های گزارش نمایش داده می‌شوند و هفته‌های ثبت‌نشده یا ناقص با هشدار مشخص می‌شوند. انتخاب شما برای گزارش‌های بعدی به‌خاطر سپرده می‌شود."}
        </p>
      </div>
    `;
    const checkboxes = () =>
      Array.from(document.querySelectorAll("#rgGroupList .rg-group-check"));

    const updateStats = () => {
      const count = checkboxes().filter((cb) => cb.checked).length;
      const el = document.getElementById("rgStatSelected");
      if (el) el.textContent = count.toLocaleString("fa-IR");
    };

    const setChecked = (keys) => {
      checkboxes().forEach((cb) => {
        cb.checked = keys.includes(cb.value);
      });
      updateStats();
    };

    const result = await Swal.fire({
      title,
      html,
      width: 640,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-export"></i> تولید گزارش',
      cancelButtonText: "انصراف",
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#94a3b8",
      didOpen: () => {
        updateStats();
        document
          .getElementById("rgSelectAll")
          ?.addEventListener("click", () => setChecked([...ALL_GROUP_KEYS]));
        document
          .getElementById("rgClearAll")
          ?.addEventListener("click", () => setChecked([]));
        document
          .getElementById("rgResetDefault")
          ?.addEventListener("click", () => setChecked([...ALL_GROUP_KEYS]));
        checkboxes().forEach((cb) =>
          cb.addEventListener("change", updateStats),
        );
      },
      preConfirm: () => {
        const selected = checkboxes()
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);
        if (selected.length === 0) {
          Swal.showValidationMessage("حداقل یک گروه شاخص را انتخاب کنید");
          return false;
        }
        return selected;
      },
    });

    if (!result.isConfirmed) return null;

    // ✅ انتخاب کاربر ذخیره می‌شود تا در گزارش‌های بعدی هم اعمال شود
    const selected = normalizeGroups(result.value);
    this.saveReportGroups(selected);
    return selected;
  }

  // ===== انتخاب هفته‌های گزارش (مودال ترکیبی) =====

  /** قاعدهٔ ذخیره‌شدهٔ انتخاب مشترک (پریست/بازه) */
  loadSavedWeekRule() {
    try {
      const raw = localStorage.getItem(WEEK_SELECTION_STORAGE_KEY);
      if (!raw) return { preset: WEEK_PRESET.ALL, from: null, to: null };
      const parsed = JSON.parse(raw);
      const normalized = normalizeWeekSelection({ shared: parsed }).shared;
      return normalized && !Array.isArray(normalized)
        ? normalized
        : { preset: WEEK_PRESET.ALL, from: null, to: null };
    } catch {
      return { preset: WEEK_PRESET.ALL, from: null, to: null };
    }
  }

  saveWeekRule(rule) {
    try {
      localStorage.setItem(WEEK_SELECTION_STORAGE_KEY, JSON.stringify(rule));
    } catch {
      // در نبود localStorage، انتخاب فقط برای همین گزارش اعمال می‌شود
    }
  }

  /**
   * مودال «انتخاب هفته‌ها» — ترکیبی:
   *  ۱) یک انتخاب مشترک برای همهٔ گله‌ها (پریست/بازه)
   *  ۲) امکان تنظیم جداگانهٔ هر گله (اختیاری، جمع‌شده)
   * @param {{title?:string, subtitle?:string, panels:Array<{key,label,subtitle,timeline}>}} options
   * @returns {Promise<object|null>} مدل انتخاب هفته‌ها یا null (همهٔ هفته‌ها)
   */
  async pickReportWeeksPerFlock({
    title = "🎯 انتخاب هفته‌های گزارش",
    subtitle = "",
    panels = [],
  } = {}) {
    // بدون SweetAlert2 یا بدون گله → بدون مودال (رفتار قبلی: همهٔ هفته‌ها)
    if (typeof Swal === "undefined" || panels.length === 0) return null;

    const timelines = {};
    panels.forEach((panel) => {
      timelines[panel.key] = panel.timeline || [];
    });

    const state = { shared: { ...this.loadSavedWeekRule() }, overrides: {} };

    const weekStatusChip = (week) => {
      const cls = week.status;
      const label = WEEK_STATUS_LABELS[cls] || "";
      const icon = cls === "complete" ? "✅" : cls === "partial" ? "🟡" : "❌";
      return `<span class="wk-week-status ${cls}">${icon} ${label}</span>`;
    };

    const panelHtml = (panel) => {
      const weeks = (panel.timeline || [])
        .map(
          (week) => `
            <label class="wk-week-item ${week.status}">
              <input type="checkbox" class="wk-week-check" data-key="${panel.key}" value="${week.weekNumber}">
              <span class="wk-week-name">هفته ${week.weekNumber}</span>
              <span class="wk-week-date">${
                week.startDate ? convertToPersianDate(week.startDate) : "-"
              }</span>
              ${weekStatusChip(week)}
            </label>`,
        )
        .join("");

      return `
        <div class="wk-flock" data-key="${panel.key}">
          <div class="wk-flock-head">
            <span class="wk-flock-title">${panel.label}</span>
            <span class="wk-flock-meta">${panel.subtitle || ""}</span>
            <span class="wk-flock-status" id="wkStatus-${panel.key}"></span>
            <button type="button" class="wh-tool-btn wk-edit-btn" data-edit="${panel.key}">
              <i class="fas fa-pen"></i> تنظیم این گله
            </button>
          </div>
          <div class="wk-flock-weeks" id="wkWeeks-${panel.key}" hidden>
            <div class="wk-presets">
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.ALL}" data-key="${panel.key}">همه</button>
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.RECORDED}" data-key="${panel.key}">ثبت‌شده</button>
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.ISSUES}" data-key="${panel.key}">مشکل‌دار</button>
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.MANUAL}" data-key="${panel.key}">انتخاب دستی</button>
              <button type="button" class="wh-tool-btn ghost wk-reset-btn" data-reset="${panel.key}">
                <i class="fas fa-rotate-left"></i> بازگشت به انتخاب مشترک
              </button>
            </div>
            <div class="wk-week-list">${weeks || '<p class="wh-hint">هفته‌ای برای این گله وجود ندارد</p>'}</div>
          </div>
        </div>`;
    };
    const html = `
      <div class="wh-picker wk-picker" dir="rtl">
        <div class="wh-stats">
          <div class="wh-stat"><span class="wh-stat-val" id="wkStatWeeks">0</span><span class="wh-stat-lbl">هفتهٔ انتخابی</span></div>
          <div class="wh-stat"><span class="wh-stat-val" id="wkStatFlocks">0</span><span class="wh-stat-lbl">گله/سالن در گزارش</span></div>
          <div class="wh-stat"><span class="wh-stat-val" id="wkStatIssues">0</span><span class="wh-stat-lbl">مورد مشکل‌دار در انتخاب</span></div>
        </div>

        <div class="wk-section">
          <div class="wk-section-title">۱) انتخاب مشترک برای همهٔ گله‌ها</div>
          <div class="wk-presets" id="wkSharedPresets">
            ${Object.entries(WEEK_PRESET_LABELS)
              .filter(([key]) => key !== WEEK_PRESET.MANUAL)
              .map(
                ([key, label]) =>
                  `<button type="button" class="wk-chip" data-shared-preset="${key}">${label}</button>`,
              )
              .join("")}
          </div>
          <div class="wk-range" id="wkSharedRange" hidden>
            <label>از هفته <input type="number" min="1" class="wk-input" id="wkFrom"></label>
            <label>تا هفته <input type="number" min="1" class="wk-input" id="wkTo"></label>
          </div>
        </div>

        <div class="wk-section">
          <button type="button" class="wh-tool-btn ghost wk-toggle" id="wkTogglePerFlock">
            <i class="fas fa-sliders-h"></i> ⚙️ تنظیم جداگانهٔ هر گله (اختیاری — ${panels.length.toLocaleString("fa-IR")} گله)
          </button>
          <div class="wk-per-flock" id="wkPerFlock" hidden>
            <div class="wh-toolbar">
              <button type="button" class="wh-tool-btn ghost" id="wkResetAllOverrides">
                <i class="fas fa-rotate-left"></i> همه مطابق انتخاب مشترک
              </button>
            </div>
            ${panels.map((panel) => panelHtml(panel)).join("")}
          </div>
        </div>

        <p class="wh-hint">
          <i class="fas fa-circle-info"></i>
          ${subtitle || "فقط هفته‌های انتخاب‌شدهٔ هر گله در جدول‌های گزارش می‌آید و هشدارهای ثبت هفتگی هم روی همین هفته‌ها محاسبه می‌شود. مجموع‌ها/FCR همچنان روی همهٔ هفته‌های ثبت‌شده محاسبه می‌شوند."}
        </p>
      </div>
    `;
    const setStat = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (parseInt(value, 10) || 0).toLocaleString("fa-IR");
    };

    const weekChecksOf = (key) =>
      Array.from(document.querySelectorAll(`.wk-week-check[data-key="${key}"]`));

    const effectiveOf = (key) => effectiveWeeksFor(state, key, timelines[key]);

    const syncWeekCheckboxes = (key) => {
      const effective = new Set(effectiveOf(key));
      weekChecksOf(key).forEach((cb) => {
        cb.checked = effective.has(parseInt(cb.value, 10));
      });
    };

    const updatePanelStatus = (key) => {
      const el = document.getElementById(`wkStatus-${key}`);
      if (!el) return;
      const effective = effectiveOf(key);
      const overridden = Object.prototype.hasOwnProperty.call(
        state.overrides,
        key,
      );
      if (effective.length === 0) {
        el.textContent = "⛔ بدون هفته → در گزارش نمی‌آید";
        el.className = "wk-flock-status is-excluded";
        return;
      }
      const label = `${effective.length.toLocaleString("fa-IR")} هفته`;
      el.textContent = overridden
        ? `🎯 سفارشی — ${label}`
        : `✅ مطابق انتخاب مشترک — ${label}`;
      el.className = `wk-flock-status ${overridden ? "is-custom" : "is-shared"}`;
    };

    const refresh = () => {
      panels.forEach((panel) => {
        if (!Object.prototype.hasOwnProperty.call(state.overrides, panel.key)) {
          syncWeekCheckboxes(panel.key);
        }
        updatePanelStatus(panel.key);
      });

      const summary = summarizeWeekSelection(state, timelines);
      setStat("wkStatWeeks", summary.weeks);
      setStat("wkStatFlocks", summary.flocks);
      setStat("wkStatIssues", summary.missing + summary.partial);

      document.querySelectorAll("[data-shared-preset]").forEach((btn) => {
        btn.classList.toggle(
          "is-active",
          btn.dataset.sharedPreset === state.shared.preset,
        );
      });
      const rangeBox = document.getElementById("wkSharedRange");
      if (rangeBox) rangeBox.hidden = state.shared.preset !== WEEK_PRESET.RANGE;
      const fromInput = document.getElementById("wkFrom");
      const toInput = document.getElementById("wkTo");
      if (fromInput && state.shared.from) fromInput.value = state.shared.from;
      if (toInput && state.shared.to) toInput.value = state.shared.to;
    };

    const result = await Swal.fire({
      title,
      html,
      width: 760,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-export"></i> تولید گزارش',
      cancelButtonText: "انصراف",
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#94a3b8",
      didOpen: () => {
        refresh();

        // ── پریست مشترک
        document.querySelectorAll("[data-shared-preset]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const preset = btn.dataset.sharedPreset;
            state.shared = {
              preset,
              from: preset === WEEK_PRESET.RANGE ? state.shared.from : null,
              to: preset === WEEK_PRESET.RANGE ? state.shared.to : null,
            };
            refresh();
          });
        });

        // ── بازهٔ مشترک
        ["wkFrom", "wkTo"].forEach((id) => {
          document.getElementById(id)?.addEventListener("input", (event) => {
            state.shared.preset = WEEK_PRESET.RANGE;
            state.shared[id === "wkFrom" ? "from" : "to"] =
              parseInt(event.target.value, 10) || null;
            refresh();
          });
        });

        // ── باز/بست ناحیهٔ تنظیم جداگانه
        document
          .getElementById("wkTogglePerFlock")
          ?.addEventListener("click", () => {
            const box = document.getElementById("wkPerFlock");
            if (box) box.hidden = !box.hidden;
          });
        // ── پریست هر گله
        document.querySelectorAll("[data-preset][data-key]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = btn.dataset.key;
            const preset = btn.dataset.preset;
            state.overrides[key] =
              preset === WEEK_PRESET.MANUAL
                ? [...effectiveOf(key)]
                : resolvePresetWeeks(preset, timelines[key]);
            syncWeekCheckboxes(key);
            updatePanelStatus(key);
            refresh();
          });
        });

        // ── تغییر دستی تیک هفته‌ها
        document
          .getElementById("wkPerFlock")
          ?.addEventListener("change", (event) => {
            const cb = event.target.closest?.(".wk-week-check");
            if (!cb) return;
            const key = cb.dataset.key;
            if (!Object.prototype.hasOwnProperty.call(state.overrides, key)) {
              // اولین ویرایش: از وضعیت فعلیِ برگرفته از انتخاب مشترک شروع می‌کنیم
              state.overrides[key] = [...effectiveOf(key)];
            }
            const value = parseInt(cb.value, 10);
            const list = new Set(state.overrides[key]);
            if (cb.checked) list.add(value);
            else list.delete(value);
            state.overrides[key] = [...list].sort((a, b) => a - b);
            updatePanelStatus(key);
            refresh();
          });

        // ── بازگشت یک گله به انتخاب مشترک
        document.querySelectorAll("[data-reset]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = btn.dataset.reset;
            delete state.overrides[key];
            syncWeekCheckboxes(key);
            updatePanelStatus(key);
            refresh();
          });
        });

        // ── همه مطابق انتخاب مشترک
        document
          .getElementById("wkResetAllOverrides")
          ?.addEventListener("click", () => {
            state.overrides = {};
            refresh();
          });

        // ── بازکردن فهرست هفته‌های یک گله
        document.querySelectorAll("[data-edit]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const box = document.getElementById(`wkWeeks-${btn.dataset.edit}`);
            if (box) box.hidden = !box.hidden;
          });
        });
      },
      preConfirm: () => {
        const summary = summarizeWeekSelection(state, timelines);
        if (summary.weeks === 0) {
          Swal.showValidationMessage("حداقل یک هفته در گزارش انتخاب کنید");
          return false;
        }
        return { shared: state.shared, overrides: state.overrides };
      },
    });

    if (!result.isConfirmed) return null;

    // ✅ قاعدهٔ مشترک برای گزارش‌های بعدی به‌خاطر سپرده می‌شود
    this.saveWeekRule(state.shared);

    // پیش‌فرض «همهٔ هفته‌ها» بدون تنظیم سفارشی → همان رفتار قبلی گزارش‌ها
    const hasOverrides = Object.keys(state.overrides).length > 0;
    if (!hasOverrides && state.shared.preset === WEEK_PRESET.ALL) return null;

    return normalizeWeekSelection({
      mode: hasOverrides ? "mixed" : "shared",
      shared: state.shared,
      overrides: state.overrides,
    });
  }

  buildWeeklyHistoryHTML(customer, blocks, options = {}) {
    const selectedGroups = normalizeGroups(options.selectedGroups);
    const weekSelection = options.weekSelection || null;
    const title = "🕓 گزارش تاریخچه هفتگی (گله‌های تکمیل‌شده)";
    const now = new Date();
    const persianDate = formatDate(now);

    // تاریخ و ساعت دریافت گزارش (شمسی/فارسی)
    const reportDate = new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const reportTime = new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);

    // ===== دریافت‌کننده گزارش (کاربر لاگین‌شده) =====
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const reporterName =
      currentUser.fullName ||
      [currentUser.first_name, currentUser.last_name]
        .filter(Boolean)
        .join(" ") ||
      currentUser.username ||
      "کاربر ناشناس";
    const roleText =
      {
        super_admin: "مدیر اصلی",
        admin: "مدیر",
        sub_admin: "مدیر میانی",
        expert: "کارشناس",
        customer: "مشتری",
      }[currentUser.role] || "کاربر";

    // ===== ابزارهای کمکی نمایش =====
    const fmtCount = (v) => (parseInt(v) || 0).toLocaleString("fa-IR");
    const toPersianShort = (date) => {
      if (!date) return "-";
      try {
        return new Intl.DateTimeFormat("fa-IR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(date));
      } catch {
        return "-";
      }
    };

    // آمار کل گزارش برای کارت‌های ابتدای صفحه
    const totalHalls = blocks.reduce((s, b) => s + (b.halls?.length || 0), 0);
    const totalWeeks = blocks.reduce(
      (s, b) =>
        s + (b.halls || []).reduce((s2, h) => s2 + (h.weeks?.length || 0), 0),
      0,
    );
    // ✅ شمارش کل هفته‌های بدون ثبت (برای کارت هشدار ابتدای گزارش)
    const totalMissingWeeks = blocks.reduce(
      (s, b) =>
        s +
        (b.halls || []).reduce(
          (s2, h) => s2 + (h.audit?.missing?.length || 0),
          0,
        ),
      0,
    );

    // گله‌هایی که کاربر هیچ هفته‌ای برایشان انتخاب نکرده (خط اطلاعی در ابتدای گزارش)
    const excludedBlockNames = [];

    // ✅ خلاصهٔ انتخاب هفته‌ها (خط خلاصهٔ ابتدای گزارش)
    const weekSelectionSummary = weekSelection
      ? summarizeWeekSelection(
          weekSelection,
          Object.fromEntries(
            blocks.map((block) => [
              `f${block.flock.id}`,
              mergeWeekTimelines(
                (block.halls || []).map((h) =>
                  buildWeekTimeline(h.allWeeks || h.weeks || []),
                ),
              ),
            ]),
          ),
        )
      : null;
    const weekSelectionNote = weekSelectionSummary
      ? ` · 🎯 هفته‌ها: <strong>${fmtCount(weekSelectionSummary.weeks)} هفته</strong> از ${fmtCount(weekSelectionSummary.totalFlocks)} گله${weekSelectionSummary.overridden ? ` — ${fmtCount(weekSelectionSummary.overridden)} گله با انتخاب سفارشی` : ""}`
      : "";

    const bodyBlocks = blocks
      .map((b) => {
        const f = b.flock;
        const flockNum = f.flock_number || "-";
        const unitName = f.unit?.unit_name || "-";
        const comp = b.completion;
        const flockWeeksCount = (b.halls || []).reduce(
          (s, h) => s + (h.weeks?.length || 0),
          0,
        );
        // ✅ ترتیب ثابت سالن‌ها از A به آخر (مستقل از ترتیب ورودی دیتابیس)
        const orderedHalls = sortFlocksByHall(b.halls || []);
        // هشدار سطح گله: اجتماع هفته‌های بدون ثبت/ناقص همهٔ سالن‌های همین گله
        const hallAudits = orderedHalls.map(
          (h) =>
            h.audit || auditWeeks(h.allWeeks || h.weeks || [], h.hallName || ""),
        );

        // ✅ انتخاب هفته‌های این گله (کلید f<flockId>) — هر سالن با خط زمانی خودش
        const flockKey = `f${b.flock.id}`;
        const flockTimeline = mergeWeekTimelines(
          orderedHalls.map((h) => buildWeekTimeline(h.allWeeks || h.weeks || [])),
        );
        const flockWeekNumbers = weekSelection
          ? effectiveWeeksFor(weekSelection, flockKey, flockTimeline)
          : null;
        const flockOutsideIssues = weekSelection
          ? issuesOutsideSelection(weekSelection, flockKey, flockTimeline)
          : [];
        const flockAuditFull = mergeAudits(hallAudits);
        const flockAudit = Array.isArray(flockWeekNumbers)
          ? scopeAuditToWeeks(flockAuditFull, flockWeekNumbers)
          : flockAuditFull;
        const flockBasisChip = b.halls?.[0]?.timeline
          ? `<span class="hh-meta basis-chip" title="مبنای شمارش هفته‌های مورد انتظار">⚓ مبنای پایان: ${timelineBasisLabel(b.halls[0].timeline, toPersianShort)}</span>`
          : "";
        const flockWeekChip = Array.isArray(flockWeekNumbers)
          ? `<span class="hh-meta week-range-chip">🎯 ${weekSelectionLabel(flockWeekNumbers, flockTimeline.map((w) => w.weekNumber), fmtCount)}</span>`
          : "";
        const excludedHalls = [];

        // گله‌ای که هیچ هفته‌ای برایش انتخاب نشده → از گزارش حذف می‌شود
        if (Array.isArray(flockWeekNumbers) && flockWeekNumbers.length === 0) {
          excludedBlockNames.push(
            `گله ${b.flock.flock_number || "-"} — واحد ${b.flock.unit?.unit_name || "-"}`,
          );
          return "";
        }

        // 🏁 اطلاعات پایان دوره گله — نوار خلاصهٔ گروهی
        const completionStrip = comp
          ? `<div class="flock-summary-strip history-completion-strip">
              <span class="label-chip">🏁 پایان دوره</span>
              <span><strong>جوجه اولیه:</strong> ${fmtCount(comp.initial_chicks_count)} قطعه</span>
              <span><strong>جوجه نهایی:</strong> ${fmtCount(comp.final_chicks_count)} قطعه</span>
              <span><strong>تلفات کل:</strong> ${fmtCount(comp.total_mortality)} قطعه</span>
              <span><strong>FCR:</strong> ${comp.system_fcr ?? "-"}</span>
              <span><strong>سن کشتار:</strong> ${comp.slaughter_age_days ?? "-"} روز</span>
            </div>`
          : "";

        const halls = orderedHalls
          .map((h) => {
            const list = h.weeks || [];
            // ✅ خط زمانی کامل (هفته‌های نظری + ثبت‌شده) تا هفته‌های بدون ثبت هم در ماتریس بیاید
            const fullTimeline = h.allWeeks?.length ? h.allWeeks : list;
            const hallTimeline = buildWeekTimeline(fullTimeline);
            const rawAudit =
              h.audit || auditWeeks(fullTimeline, h.hallName || "");

            // ✅ محدود به هفته‌های انتخاب‌شدهٔ همین گله (اگر کاربر انتخاب سفارشی داشته باشد)
            const hallWeekNumbers = weekSelection
              ? effectiveWeeksFor(weekSelection, flockKey, hallTimeline)
              : null;
            if (Array.isArray(hallWeekNumbers) && hallWeekNumbers.length === 0) {
              excludedHalls.push(h.hallName || "-");
              return "";
            }
            const audit = Array.isArray(hallWeekNumbers)
              ? scopeAuditToWeeks(rawAudit, hallWeekNumbers)
              : rawAudit;
            const outsideIssues = weekSelection
              ? issuesOutsideSelection(weekSelection, flockKey, hallTimeline)
              : [];
            const timeline = Array.isArray(hallWeekNumbers)
              ? fullTimeline.filter((week) =>
                  hallWeekNumbers.includes(parseInt(week.week_number, 10)),
                )
              : fullTimeline;
            const basisChip = h.timeline
              ? `<span class="hh-meta basis-chip" title="مبنای شمارش هفته‌های مورد انتظار و هشدارهای ثبت">⚓ مبنای پایان: ${timelineBasisLabel(h.timeline, toPersianShort)}</span>`
              : "";
            const weekRangeChip = Array.isArray(hallWeekNumbers)
              ? `<span class="hh-meta week-range-chip">🎯 ${weekSelectionLabel(hallWeekNumbers, hallTimeline.map((w) => w.weekNumber), fmtCount)}</span>`
              : "";
            const placement = h.placement || {};
            const weeksChip =
              list.length > 0
                ? `<span class="hh-meta">📅 ${fmtCount(list.length)} هفتهٔ ثبت‌شده${audit.missing.length ? ` از ${fmtCount(audit.total)}` : ""}</span>`
                : "";
            const gapChip = audit.hasIssues
              ? weeklyRenderer.renderGapBadge(audit)
              : "";
            const chicksChip = placement.total_chicks_count
              ? `<span class="hh-meta">🐣 ${fmtCount(placement.total_chicks_count)} قطعه</span>`
              : "";
            const dateChip = placement.placement_date
              ? `<span class="hh-meta">📆 ${toPersianShort(placement.placement_date)}</span>`
              : "";
            return `
              <div class="history-hall">
                <div class="history-hall-head">
                  <span class="hh-title">🧩 ${h.hallName}</span>
                  ${weeksChip}${gapChip}${chicksChip}${dateChip}${basisChip}${weekRangeChip}
                </div>
                ${weeklyRenderer.renderWeekGapsAlert(audit, h.hallName)}
                ${
                  outsideIssues.length
                    ? `<p class="gap-outside-note">ℹ️ ${fmtCount(outsideIssues.length)} هفتهٔ مشکل‌دار دیگر این سالن (${outsideIssues.join("، ")}) خارج از انتخاب شماست.</p>`
                    : ""
                }
                ${
                  list.length || audit.missing.length
                    ? renderHistoryWeekMatrix(timeline, selectedGroups)
                    : '<p style="color:#94a3b8;padding:4px 2px;">ثبت هفتگی‌ای برای این سالن موجود نیست</p>'
                }
              </div>
            `;
          })
          .join("");

        return `
          <div class="flock-section history-flock-section">
            <div class="flock-header">
              <div>
                <div class="flock-title">🐔 گله ${flockNum} — واحد ${unitName}</div>
              </div>
              <div class="flock-meta">
                <span>🏭 ${fmtCount(b.halls.length)} سالن</span>
                <span>📅 ${fmtCount(flockWeeksCount)} هفته ثبت‌شده${flockAudit.missing.length ? ` از ${fmtCount(flockAudit.total)}` : ""}</span>
                ${weeklyRenderer.renderGapBadge(flockAudit)}
                ${flockBasisChip}
                ${flockWeekChip}
                <span class="status-badge history-done-badge">🏁 تکمیل‌شده</span>
              </div>
            </div>
            ${completionStrip}
            ${weeklyRenderer.renderWeekGapsAlert(flockAudit)}
            ${
              flockOutsideIssues.length
                ? `<p class="gap-outside-note">ℹ️ ${fmtCount(flockOutsideIssues.length)} هفتهٔ مشکل‌دار دیگر این گله (${flockOutsideIssues.join("، ")}) خارج از انتخاب شماست.</p>`
                : ""
            }
            ${
              excludedHalls.length
                ? `<p class="gap-outside-note">ℹ️ ${fmtCount(excludedHalls.length)} سالن (${excludedHalls.join("، ")}) به‌خاطر انتخاب‌نشدن هیچ هفته‌ای در این گزارش نیامده است.</p>`
                : ""
            }
            ${halls}
          </div>
        `;
      })
      .join("");

    const summaryStats = `
      <div class="summary-stats">
        <div class="summary-stat"><div class="stat-number">${fmtCount(blocks.length)}</div><div class="stat-label">گلهٔ تکمیل‌شده</div></div>
        <div class="summary-stat"><div class="stat-number">${fmtCount(totalHalls)}</div><div class="stat-label">سالن</div></div>
        <div class="summary-stat"><div class="stat-number">${fmtCount(totalWeeks)}</div><div class="stat-label">هفتهٔ ثبت‌شده</div></div>
        ${
          totalMissingWeeks > 0
            ? `<div class="summary-stat warn-stat"><div class="stat-number">${fmtCount(totalMissingWeeks)}</div><div class="stat-label">هفتهٔ بدون ثبت</div></div>`
            : ""
        }
      </div>`;

    return `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          ${REPORT_STYLES}
          body { background: #f8fafc; color: #1e293b; font-size: 12px; margin: 0; padding: 16px; }
          .report-main { width: 100%; border-collapse: collapse; }
          .report-main thead { display: table-header-group; }
          .report-main td { border: none; padding: 0; }
          .report-page-header { text-align: center; background: linear-gradient(135deg, #2c7a6e 0%, #065f46 100%); color: #fff; border-radius: 12px; padding: 22px 18px; margin-bottom: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .report-page-header h1 { color: #fff; font-size: 22px; margin: 0 0 6px; font-weight: 700; }
          .report-page-header .date { color: rgba(255,255,255,0.92); font-size: 12px; margin-top: 6px; }
          .report-page-header .report-logo { display: block; height: 46px; width: auto; margin: 0 auto 10px; background: #fff; padding: 5px 10px; border-radius: 10px; }
          .report-main .customer-info { margin: 0 0 16px; }
        </style>
      </head>
      <body>
        <table class="report-main">
          <thead>
            <tr><td>
              <div class="report-page-header">
                <img class="report-logo" src="/assets/images/skb-logo.png" alt="لوگوی شرکت" onerror="this.style.display='none'">
                <h1>${title}</h1>
                <div class="date">📅 تاریخ تهیه: ${persianDate} | ساعت: ${reportTime}</div>
              </div>

              ${summaryStats}

              <div class="customer-info">
                <h3>👤 اطلاعات مشتری</h3>
                <div class="customer-grid">
                  <div class="customer-item"><span class="label">نام مشتری</span><span class="value">${customer.full_name || "-"}</span></div>
                  <div class="customer-item"><span class="label">نام واحد / مزرعه</span><span class="value">${customer.farm_name || "-"}</span></div>
                  <div class="customer-item"><span class="label">موبایل</span><span class="value" style="direction:ltr;">${customer.mobile_number || "-"}</span></div>
                  <div class="customer-item"><span class="label">استان</span><span class="value">${customer.province || "-"}</span></div>
                </div>
              </div>

              <div class="report-groups-note">🧾 شاخص‌های این گزارش: <strong>${REPORT_GROUPS.filter((g) => selectedGroups.includes(g.key)).map((g) => g.title).join("، ") || "—"}</strong>${weekSelectionNote}</div>
              ${
                excludedBlockNames.length
                  ? `<p class="gap-outside-note">ℹ️ ${fmtCount(excludedBlockNames.length)} گله (${excludedBlockNames.join("، ")}) به‌خاطر انتخاب‌نشدن هیچ هفته‌ای در این گزارش نیامده است.</p>`
                  : ""
              }
            </td></tr>
          </thead>
          <tbody>
            <tr><td>
              ${
                blocks.length
                  ? bodyBlocks
                  : '<div class="flock-section"><p style="text-align:center;color:#94a3b8;padding:10px;">گلهٔ تکمیل‌شده با ثبت هفتگی برای این مشتری یافت نشد.</p></div>'
              }
              <div class="report-footer">
                <div class="report-by">📌 دریافت گزارش توسط: <strong>${reporterName}</strong> (${roleText}) — تاریخ: <strong>${reportDate}</strong> | ساعت: <strong>${reportTime}</strong></div>
                <p>گزارش سامانه مدیریت مشتریان (SKB-CRM)</p>
              </div>
            </td></tr>
          </tbody>
        </table>
        <script>window.onload = function(){ window.print(); }</script>
      </body>
      </html>
    `;
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
    this.weeksShown = {};
    this._weekItemBuilders = {};
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
  window.generateWeeklyHistoryReport = () =>
    weeklyService.generateWeeklyHistoryReport();
  window.generateFlockReport = (flockId) => weeklyService.generateFlockReport(flockId);
  window.saveWeekFromForm = (btn) => weeklyService.saveWeek(btn);
  window.resetWeekForm = (btn) => weeklyService.resetWeekForm?.(btn);
  window.deleteWeekFromForm = (id) => weeklyService.deleteWeek(id);
  window.toggleWeekAccordion = (header) => weeklyService.toggleWeek(header);
  window.toggleFlockCard = (header) => weeklyService.toggleFlock?.(header);
  window.showMoreWeeks = (btn, flockId) =>
    weeklyService.showMoreWeeks(btn, flockId);
}
