import {
  convertToPersianDate,
  formatNumber,
} from "../../../../core/utils/date.utils.js";

// ================================================================
// توابع کمکی گزارش
// ================================================================

const fmtNum = (value, digits = 2) => {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return Number(value).toLocaleString("fa-IR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
};

const fmtPct = (value, digits = 2) =>
  value === null || value === undefined || isNaN(value)
    ? "—"
    : `${fmtNum(value, digits)}٪`;

// کارت‌های شاخص یک هفته (برای گزارش اختصاصی گله) - گروه‌بندی‌شده
// ابزارهای نمایش انحراف از استاندارد در کارتها (همانند فرم زندهٔ هفتگی)
const fmtDev = (value, digits = 2) => {
  if (value === null || value === undefined || isNaN(value)) return "";
  return Number(value).toLocaleString("fa-IR", {
    maximumFractionDigits: digits,
  });
};
const weightNote = (m) => {
  if (!m || m.weight === null || !m.standard) return "";
  if (m.weightStatus === "ok") return "✅ در بازه استاندارد";
  if (m.weightStatus === "below")
    return `▼ ${fmtDev(Math.abs(m.weightDeviation), 3)} کیلوگرم کمتر از هدف`;
  if (m.weightStatus === "above")
    return `▲ ${fmtDev(m.weightDeviation, 3)} کیلوگرم بیشتر از هدف`;
  return "";
};
const gainNote = (m) => {
  if (!m) return "";
  if (m.standardGain === null || m.standardGain === undefined) {
    return m.weightGain !== null ? "استاندارد نژاد ثبت نشده" : "";
  }
  const base = `استاندارد: ${fmtNum(m.standardGain, 3)} کیلوگرم`;
  if (!m.gainDeviation) return base;
  const sign = m.gainDeviation > 0 ? "▲" : "▼";
  return `${base} | ${sign} ٪${fmtDev(Math.abs(m.gainDeviation), 2)}`;
};
const fcrNote = (m) => {
  if (!m) return "";
  if (m.standardFcr === null || m.standardFcr === undefined) {
    return m.fcr !== null ? "استاندارد FCR ثبت نشده" : "";
  }
  const base = `استاندارد: ${fmtNum(m.standardFcr, 3)}`;
  if (!m.fcrDeviation) return base;
  const sign = m.fcrDeviation > 0 ? "▲" : "▼";
  return `${base} | ${sign} ٪${fmtDev(Math.abs(m.fcrDeviation), 2)}`;
};
const adgNote = (m) => {
  if (!m) return "";
  if (m.standardDailyGainGrams === null || m.standardDailyGainGrams === undefined) {
    return "";
  }
  const base = `استاندارد: ${fmtNum(m.standardDailyGainGrams, 1)} گرم`;
  if (m.dailyGainGrams === null) return base;
  const diff = m.dailyGainGrams - m.standardDailyGainGrams;
  if (Math.abs(diff) < 0.05) return base;
  return `${base} | ${diff > 0 ? "▲" : "▼"} ${fmtNum(Math.abs(diff), 1)} گرم`;
};

const renderWeekMetricsCards = (metrics) => {
  if (!metrics) {
    return '<div class="wc-empty">داده‌های این هفته ثبت نشده است</div>';
  }

  const card = (label, value, sub = "") => `
            <div class="wc-card">
                <div class="wc-label">${label}</div>
                <div class="wc-value">${value}</div>
                <div class="wc-sub">${sub}</div>
            </div>`;

  const groups = [
    {
      title: "🐔 جمعیت و زنده‌مانی",
      cards: [
        card("جمعیت مانده (زنده)", fmtNum(metrics.birdsEndOfWeek, 0), `ابتدای هفته: ${fmtNum(metrics.birdsStartOfWeek, 0)}`),
        card("زنده‌مانی هفتگی", fmtPct(metrics.weeklySurvivalPercent)),
        card("زنده‌مانی تجمعی", fmtPct(metrics.cumulativeSurvivalPercent)),
        card("تلفات هفتگی", fmtPct(metrics.weeklyMortalityPercent)),
        card("تلفات کل", fmtPct(metrics.totalMortalityPercent)),
      ],
    },
    {
      title: "⚖️ وزن",
      cards: [
        card("میانگین وزن هفتگی", `${fmtNum(metrics.weight, 3)} کیلوگرم`, weightNote(metrics)),
        card("وزن استاندارد نژاد", `${fmtNum(metrics.standardWeight, 3)} کیلوگرم`),
        card("وزن کل گله (زنده)", `${fmtNum(metrics.totalLiveWeight, 1)} کیلوگرم`),
        card("افزایش وزن هفتگی", `${fmtNum(metrics.weightGain, 3)} کیلوگرم`, gainNote(metrics)),
        card("افزایش وزن کل گله", `${fmtNum(metrics.totalWeightGain, 1)} کیلوگرم`),
      ],
    },
    {
      title: "🚀 رشد",
      cards: [
        card("ADG هفتگی", `${fmtNum(metrics.dailyGainGrams, 1)} گرم`, adgNote(metrics)),
        card("ADG تجمعی", `${fmtNum(metrics.cumulativeAdg, 1)} گرم`),
      ],
    },
    {
      title: "🛒 خوراک و FCR",
      cards: [
        card("دان مصرفی کل", `${fmtNum(metrics.cumulativeFeed, 1)} کیلوگرم`),
        card("سرانه مصرف روزانه", `${fmtNum(metrics.dailyFeedPerBird, 1)} گرم`),
        card("سرانه مصرف هفتگی", `${fmtNum(metrics.weeklyFeedPerBird, 3)} کیلوگرم`),
        card("FCR تا این هفته", fmtNum(metrics.fcr, 3), fcrNote(metrics)),
      ],
    },
  ];

  return `<div class="wc-groups">${groups
    .map(
      (g) => `
        <div class="wc-group">
            <div class="wc-group-head">${g.title}</div>
            <div class="wc-grid">${g.cards.join("")}</div>
        </div>`,
    )
    .join("")}</div>`;
};

// ===== ماتریس جدولی «همهٔ شاخص‌های یک سالن» — هر ستون یک هفته =====
export function renderHistoryWeekMatrix(weeks) {
  const list = (weeks || []).slice();
  if (list.length === 0) {
    return '<p style="color:#94a3b8;padding:4px 2px;">ثبت هفتگی‌ای برای این سالن موجود نیست</p>';
  }
  const cell = (v) => `<td>${v === null || v === undefined ? "—" : v}</td>`;
  const rowHtml = (label, fn) =>
    `<tr><th>${label}</th>${list.map((w) => cell(fn(w))).join("")}</tr>`;
  const m = (w) => w.metrics || {};
  const pct = (v) => fmtPct(v);
  const fa = (v, d = 2) => fmtNum(v, d);
  const joinArr = (w, key) => (w[key] || []).join("، ") || "—";
  const weightStatus = (w) => {
    const mm = m(w);
    if (!mm || mm.weight == null || !mm.standard) return "—";
    if (mm.weightStatus === "ok") return "✅ بازه استاندارد";
    if (mm.weightStatus === "below")
      return `▼ ${fmtNum(Math.abs(mm.weightDeviation), 3)} کیلوگرم کمتر از هدف`;
    if (mm.weightStatus === "above")
      return `▲ ${fmtNum(mm.weightDeviation, 3)} کیلوگرم بیشتر از هدف`;
    return "—";
  };

  const headerCells = list
    .map((w) => `<th>هفته ${w.week_number ?? "-"}</th>`)
    .join("");

  const rows = [
    rowHtml("بازهٔ تاریخ", (w) =>
      [
        w.week_start_date ? convertToPersianDate(w.week_start_date) : "-",
        w.week_end_date ? convertToPersianDate(w.week_end_date) : "-",
      ].join(" تا "),
    ),
    rowHtml("سن (روز)", (w) => w.flock_age_days ?? "—"),
    rowHtml("خوراک روزانه (کیلوگرم)", (w) => w.daily_feed_intake ?? "—"),
    rowHtml("خوراک هفتگی (کیلوگرم)", (w) => w.weekly_feed_intake ?? "—"),
    rowHtml("میانگین وزن (کیلوگرم)", (w) =>
      w.weekly_weight != null ? fa(w.weekly_weight, 3) : "—",
    ),
    rowHtml("تلفات (قطعه)", (w) => fa(w.weekly_mortality || 0, 0)),
    rowHtml("٪ تلفات هفتگی", (w) => pct(m(w).weeklyMortalityPercent)),
    rowHtml("٪ تلفات تجمعی/کل", (w) => pct(m(w).totalMortalityPercent)),
    rowHtml("٪ زنده‌مانی هفتگی", (w) => pct(m(w).weeklySurvivalPercent)),
    rowHtml("٪ زنده‌مانی تجمعی", (w) => pct(m(w).cumulativeSurvivalPercent)),
    rowHtml("وزن استاندارد نژاد (کیلوگرم)", (w) =>
      m(w).standardWeight != null ? fa(m(w).standardWeight, 3) : "—",
    ),
    rowHtml("اختلاف وزن با هدف (کیلوگرم)", (w) =>
      m(w).weightDeviation != null ? fa(m(w).weightDeviation, 3) : "—",
    ),
    rowHtml("وضعیت وزن", weightStatus),
    rowHtml("افزایش وزن هفتگی (کیلوگرم)", (w) =>
      m(w).weightGain != null ? fa(m(w).weightGain, 3) : "—",
    ),
    rowHtml("ADG هفتگی (گرم/روز)", (w) =>
      m(w).dailyGainGrams != null ? fa(m(w).dailyGainGrams, 1) : "—",
    ),
    rowHtml("ADG تجمعی (گرم/روز)", (w) =>
      m(w).cumulativeAdg != null ? fa(m(w).cumulativeAdg, 1) : "—",
    ),
    rowHtml("دان مصرفی کل (کیلوگرم)", (w) =>
      m(w).cumulativeFeed != null ? fa(m(w).cumulativeFeed, 1) : "—",
    ),
    rowHtml("سرانهٔ مصرف روزانه (گرم)", (w) =>
      m(w).dailyFeedPerBird != null ? fa(m(w).dailyFeedPerBird, 1) : "—",
    ),
    rowHtml("سرانهٔ مصرف هفتگی (کیلوگرم)", (w) =>
      m(w).weeklyFeedPerBird != null ? fa(m(w).weeklyFeedPerBird, 3) : "—",
    ),
    rowHtml("FCR (تا این هفته)", (w) =>
      m(w).fcr != null ? fa(m(w).fcr, 3) : "—",
    ),
    rowHtml("FCR استاندارد", (w) =>
      m(w).standardFcr != null ? fa(m(w).standardFcr, 3) : "—",
    ),
    rowHtml("انحراف FCR (٪)", (w) =>
      m(w).fcrDeviation != null ? fa(m(w).fcrDeviation, 2) : "—",
    ),
    rowHtml("خاموشی (ساعت)", (w) => fa(w.blackout_hours || 0, 2)),
    rowHtml("بیماری‌ها", (w) => joinArr(w, "diseases")),
    rowHtml("واکسن‌ها", (w) => joinArr(w, "vaccines")),
    rowHtml("داروها", (w) => joinArr(w, "medicines")),
    rowHtml("نوع خوراک", (w) => joinArr(w, "feedTypes")),
    rowHtml("پیشنهادات", (w) => joinArr(w, "suggestions")),
    rowHtml("توضیحات", (w) => w.additional_notes || "—"),
  ];

  return `<table class="report-table history-week-matrix">
      <thead><tr><th>شاخص</th>${headerCells}</tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table>`;
}

export const REPORT_STYLES = `
    @font-face {
        font-family: "Vazir";
        src: url("/assets/fonts/Vazir-Regular-FD.ttf") format("truetype");
        font-weight: 400;
    }
    @font-face {
        font-family: "Vazir";
        src: url("/assets/fonts/Vazir-Medium-FD.ttf") format("truetype");
        font-weight: 500;
    }
    @font-face {
        font-family: "Vazir";
        src: url("/assets/fonts/Vazir-Bold-FD.ttf") format("truetype");
        font-weight: 700;
    }
    @font-face {
        font-family: "Vazir";
        src: url("/assets/fonts/Vazir-Black-FD.ttf") format("truetype");
        font-weight: 900;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Vazir', 'Tahoma', sans-serif; padding: 20px; line-height: 1.7; color: #1e293b; background: #f8fafc; }
    .report-header { text-align: center; margin-bottom: 30px; padding: 25px; background: linear-gradient(135deg, #2c7a6e 0%, #065f46 100%); color: white; border-radius: 12px; }
    .report-header .report-logo { height: 46px; width: auto; background: #fff; padding: 6px 10px; border-radius: 10px; margin-bottom: 10px; }
    .report-header h1 { font-size: 26px; font-weight: 700; }
    .report-header .sub { font-size: 14px; opacity: 0.9; margin-top: 5px; }
    .report-header .report-info { font-size: 13px; margin-top: 10px; background: rgba(255,255,255,0.15); padding: 8px 20px; border-radius: 8px; display: inline-block; }
    .summary-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .summary-stat { background: white; padding: 15px 20px; border-radius: 10px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-right: 4px solid #2c7a6e; }
    .summary-stat .stat-number { font-size: 24px; font-weight: 700; color: #2c7a6e; }
    .summary-stat .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
    .customer-info { background: white; border-radius: 10px; padding: 20px; margin-bottom: 25px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .customer-info h3 { color: #2c7a6e; margin-bottom: 15px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    .customer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px 20px; }
    .customer-item { display: flex; flex-direction: column; gap: 2px; }
    .customer-item .label { font-size: 10px; color: #94a3b8; font-weight: 500; }
    .customer-item .value { font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.4; }
    .flock-section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); page-break-inside: avoid; }
    .flock-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; margin-bottom: 15px; }
    .flock-header .flock-title { font-size: 18px; font-weight: 600; color: #2c7a6e; }
    .flock-header .flock-meta { display: flex; gap: 15px; flex-wrap: wrap; font-size: 13px; color: #475569; }
    .flock-header .flock-meta span { background: #f1f5f9; padding: 4px 12px; border-radius: 20px; }
    .flock-summary-strip { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 14px; padding: 10px; background: #f8fafc; border-radius: 8px; font-size: 13px; }
    .flock-summary-strip strong { color: #2c7a6e; }
    .metrics-title { font-size: 14px; font-weight: 700; color: #2c7a6e; margin: 16px 0 6px; }
    .week-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
    .week-table th { background: #f1f5f9; color: #1e293b; padding: 8px 10px; text-align: center; font-weight: 600; border: 1px solid #e2e8f0; }
    .week-table td { padding: 6px 10px; text-align: center; border: 1px solid #e2e8f0; }
    .week-table .has-data { background: #d1fae5 !important; color: #065f46; }
    .week-table .highlight { font-weight: 600; color: #2c7a6e; }
    .metrics-table td { font-weight: 600; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
    .status-active { background: #d1fae5; color: #065f46; }
    .status-pending { background: #fed7aa; color: #9a3412; }
    .status-inactive { background: #fee2e2; color: #991b1b; }
    .week-report-block { background: white; border-radius: 10px; padding: 18px; margin-bottom: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); page-break-inside: avoid; border: 1px solid #eef2f6; }
    .week-report-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; background: #f0fdf9; border: 1px solid #a7f3d0; border-radius: 8px; padding: 8px 14px; margin-bottom: 12px; }
    .week-report-head .wr-week { font-size: 16px; font-weight: 800; color: #065f46; }
    .week-report-head .wr-meta { font-size: 12px; color: #475569; }
    .wc-groups { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .wc-group { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; }
    .wc-group-head { font-size: 12px; font-weight: 800; color: #065f46; background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; text-align: center; }
    .wc-group .wc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
    .wc-group .wc-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 3px; }
    .wc-group .wc-card .wc-label { font-size: 10px; font-weight: 700; color: #64748b; min-height: 26px; line-height: 1.4; display: flex; align-items: center; justify-content: center; text-align: center; }
    .wc-group .wc-card .wc-value { font-size: 15px; font-weight: 800; color: #1e293b; direction: ltr; text-align: center; min-height: 20px; display: flex; align-items: center; justify-content: center; }
    .wc-group .wc-card .wc-sub { font-size: 9.5px; color: #94a3b8; text-align: center; min-height: 13px; display: flex; align-items: center; justify-content: center; }
    .wc-empty { text-align: center; padding: 20px; color: #94a3b8; font-size: 13px; }
    .detail-list { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
    .detail-list th { background: #f1f5f9; color: #1e293b; padding: 6px 8px; text-align: center; font-weight: 600; border: 1px solid #e2e8f0; }
    .detail-list td { padding: 6px 8px; text-align: center; border: 1px solid #e2e8f0; }
    .report-footer { text-align: center; font-size: 12px; color: #94a3b8; border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 30px; }
    .report-footer .report-by { background: #f1f5f9; padding: 8px 20px; border-radius: 8px; display: inline-block; font-size: 13px; color: #1e293b; margin-top: 8px; }
    @media print { body { background: white; padding: 10px; } .flock-section, .week-report-block { box-shadow: none; border: 1px solid #e2e8f0; } .report-header { background: #2c7a6e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .summary-stat { box-shadow: none; border: 1px solid #e2e8f0; } }
    @media (max-width: 768px) { .week-table { font-size: 10px; } .week-table th, .week-table td { padding: 4px 6px; } .flock-header { flex-direction: column; align-items: flex-start; gap: 8px; } .summary-stats { grid-template-columns: repeat(2, 1fr); } .wc-groups { grid-template-columns: 1fr; } }
`;

export const weeklyRenderer = {
  // ===== رندر سلکت‌ها =====

  renderSelects(dictionaries) {
    // کارشناسان
    this.populateSelect(
      "service_expert_id",
      dictionaries.experts,
      "انتخاب کارشناس...",
    );

    // بیماری‌ها
    this.populateSelect(
      "disease_id",
      dictionaries.diseases,
      "انتخاب بیماری...",
      true,
    );

    // واکسن‌ها
    this.populateSelect(
      "vaccine_id",
      dictionaries.vaccines,
      "انتخاب واکسن...",
      true,
    );

    // داروها
    this.populateSelect(
      "medicine_id",
      dictionaries.medicines,
      "انتخاب دارو...",
      true,
    );

    // انواع خوراک
    this.populateSelect(
      "feed_type_id",
      dictionaries.feedTypes,
      "انتخاب نوع خوراک...",
      true,
    );

    // پیشنهادات
    this.populateSelect(
      "suggestion_id",
      dictionaries.suggestions,
      "انتخاب پیشنهاد...",
      true,
    );
  },

  // ===== تابع populateSelects (برای سازگاری با weekly.service.js) =====
  populateSelects(dictionaries) {
    this.renderSelects(dictionaries);
  },

  populateSelect(selectName, data, defaultText, isMultiple = false) {
    document
      .querySelectorAll(`select[name="${selectName}"]`)
      .forEach((select) => {
        // اگر داده قبلی در select وجود داشته باشد، آن را حفظ کن
        const currentValue = select.value;
        const selectedValues = [];

        if (isMultiple) {
          Array.from(select.selectedOptions).forEach((opt) => {
            if (opt.value) selectedValues.push(opt.value);
          });
        }

        select.innerHTML = `<option value="">${defaultText}</option>`;

        if (data && data.length > 0) {
          data.forEach((item) => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = item.name || item.title;
            select.appendChild(option);
          });
        }

        // اگر select قبلاً بازسازی شده بود و داده‌های قبلی داشت، ست کن
        const storedValue = select.dataset.storedValue; // برای سازگاری با دو نام
        const selectedData = select.dataset.selected || ""; // data-selected از رندر هفته
        const prevSelected = selectedData
          ? selectedData.split(",").filter(Boolean)
          : storedValue
            ? storedValue.split(",").filter(Boolean)
            : selectedValues;

        if (isMultiple) {
          Array.from(select.options).forEach((opt) => {
            if (
              prevSelected.includes(opt.value) ||
              selectedValues.includes(opt.value)
            ) {
              opt.selected = true;
            }
          });
        } else {
          // select تکی: اول مقدار فعلی، بعد data-selected، بعد currentValue
          if (
            prevSelected.length > 0 &&
            Array.from(select.options).some((opt) =>
              prevSelected.includes(opt.value),
            )
          ) {
            select.value = prevSelected[0];
          } else if (
            currentValue &&
            Array.from(select.options).some((opt) => opt.value == currentValue)
          ) {
            select.value = currentValue;
          }
        }

        if (isMultiple) {
          select.multiple = true;
          select.size = 4;
        }
      });
  },

  // ===== فیلترها =====

  renderUnitsFilter(units) {
    const select = document.getElementById("filter-unit");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">همه واحدها</option>';

    // فقط واحدهای فعال
    const activeUnits = units.filter((u) => u.is_active);

    if (activeUnits.length === 0) {
      select.innerHTML = '<option value="">هیچ واحد فعالی وجود ندارد</option>';
      return;
    }

    activeUnits.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit.id;
      option.textContent = unit.unit_name;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  renderHallsFilter(halls) {
    const select = document.getElementById("filter-hall");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">همه سالن‌ها</option>';

    halls.forEach((hall) => {
      const option = document.createElement("option");
      option.value = hall.id;
      option.textContent = hall.hall_name;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  // ===== گزارش کامل =====

  renderFullReport(customer, flocks, periods) {
    const now = new Date().toLocaleDateString("fa-IR");
    const nowTime = new Date().toLocaleTimeString("fa-IR");

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userName =
      user.fullName ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username ||
      "کاربر ناشناس";
    const roleText =
      {
        super_admin: "مدیر اصلی",
        admin: "مدیر",
        sub_admin: "مدیر میانی",
        expert: "کارشناس",
        customer: "مشتری",
      }[user.role] || "کاربر";

    const totalFlocks = flocks.length;
    const totalChicks = flocks.reduce(
      (sum, f) => sum + (f.total_chicks_count || 0),
      0,
    );
    const totalMortality = flocks.reduce(
      (sum, f) => sum + f.statistics.totalMortality,
      0,
    );

    const toPersian = (date) => {
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

    let flocksHTML = "";
    flocks.forEach((flock, index) => {
      const weeksHTML = flock.weeks
        .map(
          (week, i) => `
                <tr class="${week.existsInDb ? "has-data" : ""}">
                    <td>${i + 1}</td>
                    <td>هفته ${week.week_number}</td>
                    <td>${toPersian(week.week_start_date)}</td>
                    <td>${toPersian(week.week_end_date)}</td>
                    <td>${week.flock_age_days}</td>
                    <td>${week.daily_feed_intake || "-"}</td>
                    <td class="${week.weekly_feed_intake ? "highlight" : ""}">${week.weekly_feed_intake || "-"}</td>
                    <td class="${week.weekly_weight ? "highlight" : ""}">${week.weekly_weight || "-"}</td>
                    <td class="${week.weekly_mortality > 0 ? "highlight" : ""}">${week.weekly_mortality || 0}</td>
                    <td>${week.blackout_hours || 0}</td>
                    <td>${week.diseases?.join("، ") || "-"}</td>
                    <td>${week.vaccines?.join("، ") || "-"}</td>
                    <td>${week.medicines?.join("، ") || "-"}</td>
                    <td>${week.feedTypes?.join("، ") || "-"}</td>
                    <td>${week.suggestions?.join("، ") || "-"}</td>
                    <td>${week.additional_notes || "-"}</td>
                    <td>
                        ${
                          week.existsInDb
                            ? '<span class="status-badge status-active">✅ ثبت شده</span>'
                            : '<span class="status-badge status-pending">⏳ تکمیل نشده</span>'
                        }
                    </td>
                </tr>
            `,
        )
        .join("");

      flocksHTML += `
                <div class="flock-section">
                    <div class="flock-header">
                        <div>
                            <div class="flock-title">🐔 گله ${flock.flock_number}</div>
                            <div style="font-size: 13px; color: #64748b;">
                                ${flock.hall_name} | ${flock.breed_name || "-"} | ${toPersian(flock.placement_date)}
                            </div>
                        </div>
                        <div class="flock-meta">
                            <span>🧮 ${flock.total_chicks_count?.toLocaleString() || 0} قطعه</span>
                            <span>📊 ${flock.weeks.length} هفته</span>
                            <span class="status-badge ${flock.is_active ? "status-active" : "status-inactive"}">
                                ${flock.is_active ? "فعال" : "غیرفعال"}
                            </span>
                        </div>
                    </div>

                    <div class="flock-summary-strip">
                        <span><strong>تلفات:</strong> ${flock.statistics.totalMortality} قطعه</span>
                        <span><strong>جمعیت مانده:</strong> ${fmtNum(flock.statistics.finalMetrics?.birdsEndOfWeek, 0)} قطعه</span>
                        <span><strong>زنده‌مانی:</strong> ${fmtPct(flock.statistics.finalMetrics?.cumulativeSurvivalPercent)}</span>
                        <span><strong>وزن کل گله:</strong> ${fmtNum(flock.statistics.finalMetrics?.totalLiveWeight, 1)} کیلوگرم</span>
                        <span><strong>کل خوراک:</strong> ${fmtNum(flock.statistics.totalFeed, 1)} کیلوگرم</span>
                        <span><strong>🐔 ضریب تبدیل:</strong> ${flock.statistics.fcr !== null ? fmtNum(flock.statistics.fcr, 3) : "-"}</span>
                        <span><strong>هفته‌های تکمیل شده:</strong> ${flock.statistics.weekCount}</span>
                    </div>

                    ${
                      flock.savedWeeks.length > 0
                        ? `
                        <h4 class="metrics-title">📈 شاخص‌های عملکردی هفتگی</h4>
                        <table class="week-table metrics-table">
                            <thead>
                                <tr>
                                    <th>هفته</th>
                                    <th>جمعیت مانده</th>
                                    <th>زنده‌مانی ٪</th>
                                    <th>تلفات ٪</th>
                                    <th>وزن (kg)</th>
                                    <th>وزن کل (kg)</th>
                                    <th>افزایش وزن (kg)</th>
                                    <th>ADG (g)</th>
                                    <th>دان کل (kg)</th>
                                    <th>سرانه روزانه (g)</th>
                                    <th>FCR</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${flock.savedWeeks
                                  .map((week) => {
                                    const m = week.metrics;
                                    if (!m) return "";
                                    return `<tr>
                                        <td>هفته ${week.week_number}</td>
                                        <td>${fmtNum(m.birdsEndOfWeek, 0)}</td>
                                        <td>${fmtPct(m.weeklySurvivalPercent)}</td>
                                        <td>${fmtPct(m.weeklyMortalityPercent)}</td>
                                        <td>${fmtNum(m.weight, 3)}</td>
                                        <td>${fmtNum(m.totalLiveWeight, 1)}</td>
                                        <td>${fmtNum(m.weightGain, 3)}</td>
                                        <td>${fmtNum(m.dailyGainGrams, 1)}</td>
                                        <td>${fmtNum(m.cumulativeFeed, 1)}</td>
                                        <td>${fmtNum(m.dailyFeedPerBird, 1)}</td>
                                        <td>${fmtNum(m.fcr, 3)}</td>
                                    </tr>`;
                                  })
                                  .join("")}
                            </tbody>
                        </table>
                        <h4 class="metrics-title">📋 جزئیات ثبت هفتگی</h4>
                    `
                        : ""
                    }

                    ${
                      flock.weeks.length > 0
                        ? `
                        <table class="week-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>هفته</th>
                                    <th>تاریخ شروع</th>
                                    <th>تاریخ پایان</th>
                                    <th>سن</th>
                                    <th>خوراک روزانه</th>
                                    <th>خوراک هفتگی</th>
                                    <th>وزن</th>
                                    <th>تلفات</th>
                                    <th>خاموشی</th>
                                    <th>بیماری‌ها</th>
                                    <th>واکسن‌ها</th>
                                    <th>داروها</th>
                                    <th>نوع خوراک</th>
                                    <th>پیشنهادات</th>
                                    <th>توضیحات</th>
                                    <th>وضعیت</th>
                                </tr>
                            </thead>
                            <tbody>${weeksHTML}</tbody>
                        </table>
                    `
                        : `
                        <div style="text-align: center; padding: 20px; color: #94a3b8;">
                            <p>هیچ داده‌ای برای این گله ثبت نشده است</p>
                        </div>
                    `
                    }
                </div>
            `;
    });

    return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>گزارش کامل مدیریت هفتگی</title>
                <style>${REPORT_STYLES}</style>
            </head>
            <body>
                <div class="report-header">
                    <img class="report-logo" src="/assets/images/skb-logo.png" alt="لوگوی شرکت" onerror="this.style.display='none'">
                    <h1>📊 گزارش کامل مدیریت هفتگی</h1>
                    <div class="sub">سامانه اطلاعات، خدمات و ارتباطات با مشتریان (سِکاد)</div>
                    <div class="report-info">📅 تاریخ تهیه: ${now} - ساعت: ${nowTime}</div>
                </div>

                ${
                  totalFlocks > 0
                    ? `
                    <div class="summary-stats">
                        <div class="summary-stat"><div class="stat-number">${totalFlocks}</div><div class="stat-label">تعداد گله‌ها</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalChicks.toLocaleString()}</div><div class="stat-label">تعداد کل جوجه‌ها</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalMortality.toLocaleString()}</div><div class="stat-label">تلفات کل</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalFlocks > 0 ? Math.round(totalMortality / totalFlocks) : 0}</div><div class="stat-label">میانگین تلفات هر گله</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalChicks > 0 ? ((totalMortality / totalChicks) * 100).toFixed(1) : 0}%</div><div class="stat-label">درصد تلفات کل</div></div>
                    </div>
                `
                    : ""
                }

                <div class="customer-info">
                    <h3>👤 اطلاعات مشتری</h3>
                    <div class="customer-grid">
                        <div class="customer-item"><span class="label">نام و نام خانوادگی</span><span class="value">${customer.full_name || "-"}</span></div>
                        <div class="customer-item"><span class="label">نام مجموعه</span><span class="value">${customer.collection_name || "-"}</span></div>
                        <div class="customer-item"><span class="label">نام فارم</span><span class="value">${customer.farm_name || "-"}</span></div>
                        <div class="customer-item"><span class="label">تلفن</span><span class="value">${customer.mobile_number || "-"}</span></div>
                    </div>
                </div>

                ${
                  totalFlocks > 0
                    ? flocksHTML
                    : `
                    <div style="text-align: center; padding: 60px 20px; background: white; border-radius: 10px; color: #94a3b8;">
                        <span style="font-size: 60px; display: block; margin-bottom: 15px;">📭</span>
                        <h3 style="font-size: 20px; color: #475569; margin-bottom: 10px;">هیچ گله فعالی وجود ندارد</h3>
                        <p>برای مشاهده گزارش، ابتدا یک گله جدید در بخش مدیریت جوجه‌ریزی ثبت کنید.</p>
                    </div>
                `
                }

                <div class="report-footer">
                    <div class="report-by">
                        📌 دریافت گزارش توسط: <strong>${userName}</strong> (${roleText}) | تاریخ: <strong>${now}</strong> | ساعت: <strong>${nowTime}</strong>
                    </div>
                    <p style="margin-top: 10px;">این گزارش توسط سامانه مدیریت اطلاعات، خدمات و ارتباطات با مشتریان (سِکاد) تولید شده است.</p>
                </div>
            </body>
            </html>
        `;
  },

  // ===== گزارش اختصاصی یک گله =====

  renderFlockReport(customer, flock, periods) {
    const now = new Date().toLocaleDateString("fa-IR");
    const nowTime = new Date().toLocaleTimeString("fa-IR");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userName =
      user.fullName ||
      [user.first_name, user.last_name].filter(Boolean).join(" ") ||
      user.username ||
      "کاربر ناشناس";
    const roleText =
      {
        super_admin: "مدیر اصلی",
        admin: "مدیر",
        sub_admin: "مدیر میانی",
        expert: "کارشناس",
        customer: "مشتری",
      }[user.role] || "کاربر";

    const toPersian = (date) => {
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

    const stats = flock.statistics || {};
    const m = stats.finalMetrics || {};
    const savedWeeks = flock.savedWeeks || [];
    const ageInDays = flock.placement_date
      ? Math.max(
          0,
          Math.floor((new Date() - new Date(flock.placement_date)) / 86400000) +
            1,
        )
      : 0;

    const weekBlocks = savedWeeks
      .map(
        (week) => `
        <div class="week-report-block">
            <div class="week-report-head">
                <span class="wr-week">هفته ${week.week_number}</span>
                <span class="wr-meta">📅 ${toPersian(week.week_start_date)} تا ${toPersian(week.week_end_date)} | سن: ${week.flock_age_days} روز</span>
            </div>
            ${renderWeekMetricsCards(week.metrics)}
            <table class="detail-list">
                <tbody>
                    <tr>
                        <th>خوراک روزانه</th><td>${week.daily_feed_intake || "-"} kg</td>
                        <th>خوراک هفتگی</th><td>${week.weekly_feed_intake || "-"} kg</td>
                        <th>وزن</th><td>${week.weekly_weight || "-"} kg</td>
                        <th>تلفات</th><td>${week.weekly_mortality || 0} قطعه</td>
                    </tr>
                    <tr>
                        <th>خاموشی</th><td>${week.blackout_hours || 0} ساعت</td>
                        <th>بیماری‌ها</th><td colspan="5">${week.diseases?.join("، ") || "-"}</td>
                    </tr>
                    <tr>
                        <th>واکسن‌ها</th><td colspan="2">${week.vaccines?.join("، ") || "-"}</td>
                        <th>داروها</th><td colspan="2">${week.medicines?.join("، ") || "-"}</td>
                        <th>نوع خوراک</th><td colspan="2">${week.feedTypes?.join("، ") || "-"}</td>
                    </tr>
                    <tr>
                        <th>پیشنهادات</th><td colspan="2">${week.suggestions?.join("، ") || "-"}</td>
                        <th>توضیحات</th><td colspan="5">${week.additional_notes || "-"}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `,
      )
      .join("");

    return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>گزارش اختصاصی گله ${flock.flock_number}</title>
                <style>${REPORT_STYLES}</style>
            </head>
            <body>
                <div class="report-header">
                    <img class="report-logo" src="/assets/images/skb-logo.png" alt="لوگوی شرکت" onerror="this.style.display='none'">
                    <h1>🐔 گزارش اختصاصی گله ${flock.flock_number}</h1>
                    <div class="sub">سامانه اطلاعات، خدمات و ارتباطات با مشتریان (سِکاد)</div>
                    <div class="report-info">📅 تاریخ تهیه: ${now} - ساعت: ${nowTime}</div>
                </div>

                <div class="summary-stats">
                    <div class="summary-stat"><div class="stat-number">${fmtNum(flock.total_chicks_count, 0)}</div><div class="stat-label">جوجه‌ریزی اولیه</div></div>
                    <div class="summary-stat"><div class="stat-number">${fmtNum(m.birdsEndOfWeek, 0)}</div><div class="stat-label">جمعیت مانده</div></div>
                    <div class="summary-stat"><div class="stat-number">${fmtPct(m.cumulativeSurvivalPercent)}</div><div class="stat-label">زنده‌مانی</div></div>
                    <div class="summary-stat"><div class="stat-number">${fmtNum(m.totalLiveWeight, 1)}</div><div class="stat-label">وزن کل گله (kg)</div></div>
                    <div class="summary-stat"><div class="stat-number">${fmtNum(m.fcr, 3)}</div><div class="stat-label">FCR</div></div>
                    <div class="summary-stat"><div class="stat-number">${fmtNum(m.cumulativeFeed, 1)}</div><div class="stat-label">دان کل (kg)</div></div>
                </div>

                <div class="customer-info">
                    <h3>👤 اطلاعات مشتری</h3>
                    <div class="customer-grid">
                        <div class="customer-item"><span class="label">نام و نام خانوادگی</span><span class="value">${customer.full_name || "-"}</span></div>
                        <div class="customer-item"><span class="label">نام مجموعه</span><span class="value">${customer.collection_name || "-"}</span></div>
                        <div class="customer-item"><span class="label">نام فارم</span><span class="value">${customer.farm_name || "-"}</span></div>
                        <div class="customer-item"><span class="label">تلفن</span><span class="value">${customer.mobile_number || "-"}</span></div>
                    </div>
                </div>

                <div class="flock-section">
                    <div class="flock-header">
                        <div>
                            <div class="flock-title">🐔 گله ${flock.flock_number}</div>
                            <div style="font-size: 13px; color: #64748b;">
                                ${flock.hall_name} | ${flock.breed_name || "-"} | جوجه‌ریزی: ${toPersian(flock.placement_date)} | سن: ${ageInDays} روز
                            </div>
                        </div>
                        <div class="flock-meta">
                            <span>🧮 ${fmtNum(flock.total_chicks_count, 0)} قطعه</span>
                            <span>📊 ${savedWeeks.length} هفته ثبت‌شده</span>
                            <span class="status-badge ${flock.is_active ? "status-active" : "status-inactive"}">${flock.is_active ? "فعال" : "غیرفعال"}</span>
                        </div>
                    </div>

                    <div class="flock-summary-strip">
                        <span><strong>تلفات کل:</strong> ${stats.totalMortality} قطعه</span>
                        <span><strong>جمعیت مانده:</strong> ${fmtNum(m.birdsEndOfWeek, 0)} قطعه</span>
                        <span><strong>زنده‌مانی:</strong> ${fmtPct(m.cumulativeSurvivalPercent)}</span>
                        <span><strong>تلفات کل ٪:</strong> ${fmtPct(m.totalMortalityPercent)}</span>
                        <span><strong>وزن کل گله:</strong> ${fmtNum(m.totalLiveWeight, 1)} kg</span>
                        <span><strong>دان کل:</strong> ${fmtNum(m.cumulativeFeed, 1)} kg</span>
                        <span><strong>FCR:</strong> ${fmtNum(m.fcr, 3)}</span>
                    </div>
                </div>

                ${
                  weekBlocks
                    ? weekBlocks
                    : '<div style="text-align:center; padding:40px; background:#fff; border-radius:10px; color:#94a3b8;">هیچ هفته‌ای برای این گله ثبت نشده است</div>'
                }

                <div class="report-footer">
                    <div class="report-by">📌 دریافت گزارش توسط: <strong>${userName}</strong> (${roleText}) | تاریخ: <strong>${now}</strong> | ساعت: <strong>${nowTime}</strong></div>
                    <p style="margin-top: 10px;">این گزارش توسط سامانه مدیریت اطلاعات، خدمات و ارتباطات با مشتریان (سِکاد) تولید شده است.</p>
                </div>
            </body>
            </html>
        `;
  },
};

// ============================================
// ✅ قرار دادن در window
// ============================================
if (typeof window !== "undefined") {
  window.weeklyRenderer = weeklyRenderer;
  window.WeeklyRenderer = weeklyRenderer;
}

console.log("✅ WeeklyRenderer loaded");
