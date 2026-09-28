// ============================================================
// weekly.cards.js
// محاسبهٔ هفته‌ها، رندر کارت‌ها، محاسبهٔ خودکار دان و وضعیت وزن/ضریب تبدیل
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyCardMethods) در weekly.service.js
// حجم: ۱۰ متد / ۶۴۶ خط
// ============================================================
import { calculateWeekMetrics } from "./weekly.calculations.js";
import { authService } from "../../../../core/services/auth.service.js";
import { convertToPersianDate } from "../../../../core/utils/date.utils.js";

export const weeklyCardMethods = {
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
  },

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
  },

  renderWeeks(flock, weeks) {
    const flockId = flock.id;
    const maxDefault = this.MAX_DEFAULT_WEEKS || 10;
    const visibleCount = Math.min(maxDefault, weeks.length);
    const remainingCount = weeks.length - visibleCount;

    this.weeksShown = this.weeksShown || {};
    this.weeksShown[flockId] = visibleCount;

    // سازندهٔ HTML هر آیتم هفته — برای رندر اولیه و «نمایش بیشتر» مشترک است
    this._weekItemBuilders = this._weekItemBuilders || {};
    this._weekItemBuilders[flockId] = (week) =>
      buildWeekAccordionItemHtml(flockId, week);
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
  },

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
  },

  // ===== کارت‌های محاسباتی زنده =====

  updateAllWeekCards() {
    document.querySelectorAll(".week-edit-form").forEach((form) => {
      this.updateWeekCards(form);
    });
  },

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
  },

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
  },

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
  },

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
  },

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
  },

};

// ------------------------------------------------------------
//  کمکی برش A موج ۳.۲h: قالب آیتم هفته (کارت بازشوی هر هفته)
//  متن قالب و مقدمهٔ محلی‌اش عیناً (verbatim) منتقل شده است؛ تنها تغییر:
//  پارامترهای صریح (flockId, week) به‌جای اسارت closure.
//  ⚠️ تورفتگی سطرها حفظ شده (فاصله‌های داخل template بخشی از خروجی HTML‌اند).
// ------------------------------------------------------------
const buildWeekAccordionItemHtml = (flockId, week) => {
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
