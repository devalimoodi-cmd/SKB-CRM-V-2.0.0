import {
  convertToPersianDate,
} from "../../../../core/utils/date.utils.js";
import { flockGroupKey, sortFlocksByHall } from "./weekly.aggregation.js";
import {
  ALL_GROUP_KEYS,
  REPORT_GROUPS,
  metricsColumnsFor,
  normalizeGroups,
  isGroupSelected,
  selectedGroupsLabel,
} from "./weekly.report.groups.js";
import {
  WEEK_STATUS,
  auditWeeks,
  formatWeekList,
  mergeAudits,
  scopeAuditToWeeks,
  timelineBasisLabel,
} from "./weekly.audit.js";
import {
  buildWeekTimeline,
  effectiveWeeksFor,
  issuesOutsideSelection,
  summarizeWeekSelection,
  unionWeekSelection,
  weekSelectionLabel,
} from "./weekly.report.weeks.js";

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

// ================================================================
// هشدار «هفته‌های ثبت‌نشده / ناقص»
// ================================================================

const toFa = (value) =>
  Number(value).toLocaleString("fa-IR", { maximumFractionDigits: 0 });

const weekListText = (numbers = []) => formatWeekList(numbers, toFa);

const MISSING_CELL =
  '<span class="cell-missing" title="اطلاعات این هفته ثبت نشده است">❌ ثبت نشده</span>';

const isMissingWeek = (week) =>
  !!week && (week.__missing === true || week.existsInDb === false);

const auditOfFlock = (flock) =>
  flock?.audit || auditWeeks(flock?.weeks || [], flock?.hall_name || "");

/** توضیح یک هفتهٔ ناقص: فیلدهای ناقص در سطح گله/سالن، نام سالن‌ها در سطح «کل گله» */
const describePartialWeek = (audit, weekNumber) => {
  const weekLabel = `هفته ${toFa(weekNumber)}`;
  const byWeek = audit?.byWeek?.[weekNumber];
  if (byWeek) {
    const notes = [];
    const missingHalls = (byWeek.missing || []).filter(Boolean);
    const partialHalls = (byWeek.partial || []).filter(Boolean);
    if (missingHalls.length) notes.push(`${missingHalls.join("، ")}: بدون ثبت`);
    if (partialHalls.length) notes.push(`${partialHalls.join("، ")}: ناقص`);
    if (notes.length) return `${weekLabel} (${notes.join(" | ")})`;
  }
  const fields = (audit?.fields?.[weekNumber] || []).join(" و ");
  return fields ? `${weekLabel} (بدون ${fields})` : weekLabel;
};

/**
 * بنر هشدار هفته‌های ثبت‌نشده (قرمز) و ناقص (کهربایی)
 * @param {object} audit خروجی auditWeeks/mergeAudits
 * @param {string} scopeLabel برچسب دامنه (نام سالن) — اختیاری
 */
export function renderWeekGapsAlert(audit, scopeLabel = "") {
  if (!audit || !audit.hasIssues) return "";
  const scope = scopeLabel ? `${scopeLabel} — ` : "";
  const lines = [];

  if (audit.missing.length > 0) {
    lines.push(`
        <div class="gap-line danger">
          <span class="gap-ico">🚨</span>
          <span><strong>${toFa(audit.missing.length)} هفته بدون ثبت اطلاعات</strong> در ${scope}این گله: هفته ${weekListText(audit.missing)}</span>
        </div>`);
  }

  if (audit.partial.length > 0) {
    const detail = audit.partial
      .map((weekNumber) => describePartialWeek(audit, weekNumber))
      .join(" | ");
    lines.push(`
        <div class="gap-line warn">
          <span class="gap-ico">🟡</span>
          <span><strong>${toFa(audit.partial.length)} هفته ناقص</strong>: ${detail}</span>
        </div>`);
  }

  return `<div class="report-alert" role="alert">
      ${lines.join("")}
      <p class="gap-hint">لطفاً اطلاعات این هفته‌ها را از فرم «ثبت هفتگی» تکمیل کنید تا گزارش کامل شود.</p>
    </div>`;
}

/** نشان فشردهٔ هشدار برای نوار خلاصهٔ هر گله */
export const renderGapBadge = (audit) => {
  if (!audit || !audit.hasIssues) return "";
  const bits = [];
  if (audit.missing.length > 0) {
    bits.push(
      `<span class="gap-word-danger">🚨 ${toFa(audit.missing.length)} هفته بدون ثبت</span>`,
    );
  }
  if (audit.partial.length > 0) {
    bits.push(`<span class="gap-word-warn">🟡 ${toFa(audit.partial.length)} هفته ناقص</span>`);
  }
  return `<span class="gap-badge">${bits.join(" • ")}</span>`;
};

// ================================================================
// انتخاب هفته‌ها — چیپ‌ها و خطوط اطلاعی
// ================================================================

const flockWeeksKey = (flock) => `p${flock?.id ?? flock?.placement_id ?? "-"}`;

/** چیپ «مبنای پایان گله» (شفافیت محاسبهٔ هفته‌های مورد انتظار) */
const timelineChip = (timeline) =>
  timeline
    ? `<span class="basis-chip" title="مبنای شمارش هفته‌های مورد انتظار و هشدارهای ثبت">⚓ مبنای پایان: ${timelineBasisLabel(timeline, (date) => convertToPersianDate(date) || date)}</span>`
    : "";

/** چیپ محدودهٔ هفته‌های انتخاب‌شده */
const weekRangeChip = (weekNumbers, timelineNumbers) =>
  Array.isArray(weekNumbers)
    ? `<span class="week-range-chip" title="فقط هفته‌های انتخاب‌شدهٔ شما در این گزارش آمده است">🎯 ${weekSelectionLabel(weekNumbers, timelineNumbers, toFa)}</span>`
    : "";

/** خط اطلاعی: هفته‌های مشکل‌دار خارج از انتخاب کاربر */
const outsideIssuesNote = (numbers) =>
  numbers && numbers.length
    ? `<p class="gap-outside-note">ℹ️ ${toFa(numbers.length)} هفتهٔ مشکل‌دار دیگر این گله (${formatWeekList(numbers, toFa)}) خارج از انتخاب شماست.</p>`
    : "";

/** خط اطلاعی: گله‌هایی که چون هیچ هفته‌ای انتخاب نشده بود در گزارش نیامدند */
const excludedFlocksNote = (names) =>
  names && names.length
    ? `<p class="gap-outside-note">ℹ️ ${toFa(names.length)} گله/سالن به‌خاطر انتخاب‌نشدن هیچ هفته‌ای در این گزارش نیامده است: ${names.join("، ")}</p>`
    : "";

/** حل هفته‌های یک گله/سالن بر اساس انتخاب کاربر (null = همهٔ هفته‌ها) */
const resolveFlockWeekNumbers = (options, key, timeline) => {
  const selection = options?.weekSelection;
  if (!selection) return null;
  return effectiveWeeksFor(selection, key, timeline);
};

// کارت‌های شاخص یک هفته (برای گزارش اختصاصی سالن) - گروه‌بندی‌شده
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

const renderWeekMetricsCards = (metrics, selectedGroups = ALL_GROUP_KEYS) => {
  if (!metrics) {
    return '<div class="wc-empty">داده‌های این هفته ثبت نشده است</div>';
  }

  const card = (label, value, sub = "") => `
            <div class="wc-card">
                <div class="wc-label">${label}</div>
                <div class="wc-value">${value}</div>
                <div class="wc-sub">${sub}</div>
            </div>`;

  const cardGroups = [
    {
      key: "population",
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
      key: "weight",
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
      key: "growth",
      title: "🚀 رشد",
      cards: [
        card("ADG هفتگی", `${fmtNum(metrics.dailyGainGrams, 1)} گرم`, adgNote(metrics)),
        card("ADG تجمعی", `${fmtNum(metrics.cumulativeAdg, 1)} گرم`),
      ],
    },
    {
      key: "feed",
      title: "🛒 خوراک و FCR",
      cards: [
        card("دان مصرفی کل", `${fmtNum(metrics.cumulativeFeed, 1)} کیلوگرم`),
        card("سرانه مصرف روزانه", `${fmtNum(metrics.dailyFeedPerBird, 1)} گرم`),
        card("سرانه مصرف هفتگی", `${fmtNum(metrics.weeklyFeedPerBird, 3)} کیلوگرم`),
        card("FCR تا این هفته", fmtNum(metrics.fcr, 3), fcrNote(metrics)),
      ],
    },
  ];

  // فقط گروه‌های انتخاب‌شدهٔ کاربر رندر می‌شوند
  const selected = normalizeGroups(selectedGroups);
  const groups = cardGroups.filter((group) => selected.includes(group.key));
  if (groups.length === 0) {
    return '<div class="wc-empty">گروه شاخصی برای نمایش انتخاب نشده است</div>';
  }

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

// ===== ماتریس‌های موضوعی «تاریخچهٔ هفتگی» — هر ستون یک هفته و هر جدول یک گروه از شاخص‌های مرتبط =====
export function renderHistoryWeekMatrix(
  weeks,
  selectedGroups = ALL_GROUP_KEYS,
  options = {},
) {
  const selected = normalizeGroups(selectedGroups);
  const weekFilter = Array.isArray(options.weekNumbers)
    ? options.weekNumbers.map((n) => parseInt(n, 10))
    : null;
  const list = (weeks || [])
    .filter((w) => w && w.week_number !== null && w.week_number !== undefined)
    .filter(
      (w) =>
        !weekFilter || weekFilter.includes(parseInt(w.week_number, 10)),
    )
    .slice()
    .sort((a, b) => a.week_number - b.week_number);
  if (list.length === 0) {
    return '<p style="color:#94a3b8;padding:4px 2px;">ثبت هفتگی‌ای برای این سالن موجود نیست</p>';
  }
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

  // هر ستون یک هفته؛ هفته‌های بدون ثبت هم ستون می‌گیرند تا خط زمانی ناقص نماند
  const headerCells = list
    .map((w) =>
      isMissingWeek(w)
        ? `<th class="week-missing-col" title="اطلاعات این هفته ثبت نشده است">هفته ${w.week_number ?? "-"} ❌</th>`
        : `<th>هفته ${w.week_number ?? "-"}</th>`,
    )
    .join("");

  // هر ردیف = یک شاخص، سلول‌ها = هفته‌ها (همان رویکرد ماتریسی)
  const row = (label, fn, opts = {}) => {
    const tdClass = opts.text ? ' class="history-text"' : "";
    // هفتهٔ بدون ثبت، در همهٔ ردیف‌های همان ستون با «❌ ثبت نشده» علامت می‌خورد
    const cellOf = (w) => {
      if (isMissingWeek(w)) {
        return `<td class="cell-missing-td">${MISSING_CELL}</td>`;
      }
      return `<td${tdClass}>${fn(w)}</td>`;
    };
    return `<tr>
        <th class="history-indicator">${label}</th>
        ${list.map((w) => cellOf(w)).join("")}
      </tr>`;
  };

  // سلول عددی — در صورت خالی بودن «—»
  const num = (getter, d = 2) => (w) => {
    const v = getter(w);
    return v === null || v === undefined || v === "" ? "—" : fa(v, d);
  };

  const dateRange = (w) =>
    [
      w.week_start_date ? convertToPersianDate(w.week_start_date) : "-",
      w.week_end_date ? convertToPersianDate(w.week_end_date) : "-",
    ].join(" تا ");

  // هر گروه: عنوان موضوعی + جدول ماتریسی مجزا با ستون‌های هفته
  const groupHtml = (title, rowsHtml) => `
        <div class="history-matrix-group">
          <h4 class="metrics-title history-group-title">${title}</h4>
          <table class="week-table history-matrix">
            <thead><tr><th class="history-indicator-col">شاخص</th>${headerCells}</tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;

  // ردیف‌های هر گروه شاخص — کلیدها همان کلیدهای کاتالوگ انتخاب کاربر است
  const GROUP_ROWS = {
    population: () => [
      row("جمعیت ابتدای هفته", num((w) => m(w).birdsStartOfWeek, 0)),
      row("جمعیت انتهای هفته (زنده)", num((w) => m(w).birdsEndOfWeek, 0)),
      row("تلفات هفتگی (قطعه)", num((w) => w.weekly_mortality, 0)),
      row("٪ تلفات هفتگی", (w) => pct(m(w).weeklyMortalityPercent)),
      row("٪ تلفات کل (تجمعی)", (w) => pct(m(w).totalMortalityPercent)),
      row("٪ زنده‌مانی هفتگی", (w) => pct(m(w).weeklySurvivalPercent)),
      row("٪ زنده‌مانی تجمعی", (w) => pct(m(w).cumulativeSurvivalPercent)),
    ],
    weight: () => [
      row("میانگین وزن هفتگی (کیلوگرم)", num((w) => w.weekly_weight, 3)),
      row("وزن استاندارد نژاد (کیلوگرم)", num((w) => m(w).standardWeight, 3)),
      row("اختلاف وزن با هدف (کیلوگرم)", num((w) => m(w).weightDeviation, 3)),
      row("وضعیت وزن نسبت به هدف", weightStatus),
      row("وزن کل گلهٔ زنده (کیلوگرم)", num((w) => m(w).totalLiveWeight, 1)),
      row("افزایش وزن هفتگی (کیلوگرم)", num((w) => m(w).weightGain, 3)),
      row("افزایش وزن کل گله (کیلوگرم)", num((w) => m(w).totalWeightGain, 1)),
    ],
    growth: () => [
      row("ADG هفتگی (گرم/روز)", num((w) => m(w).dailyGainGrams, 1)),
      row("ADG تجمعی (گرم/روز)", num((w) => m(w).cumulativeAdg, 1)),
    ],
    feed: () => [
      row("خوراک روزانه (کیلوگرم)", num((w) => w.daily_feed_intake, 2)),
      row("خوراک هفتگی (کیلوگرم)", num((w) => w.weekly_feed_intake, 2)),
      row("دان مصرفی کل (کیلوگرم)", num((w) => m(w).cumulativeFeed, 1)),
      row("سرانهٔ مصرف روزانه (گرم)", num((w) => m(w).dailyFeedPerBird, 1)),
      row("سرانهٔ مصرف هفتگی (کیلوگرم)", num((w) => m(w).weeklyFeedPerBird, 3)),
      row("FCR (تجمیعی تا این هفته)", num((w) => m(w).fcr, 3)),
      row("FCR استاندارد نژاد", num((w) => m(w).standardFcr, 3)),
      row("انحراف FCR (٪)", num((w) => m(w).fcrDeviation, 2)),
    ],
    details: () => [
      row("بازهٔ تاریخ", dateRange),
      row("سن (روز)", num((w) => w.flock_age_days, 0)),
      row("خاموشی (ساعت)", num((w) => w.blackout_hours, 2)),
      row("بیماری‌ها", (w) => joinArr(w, "diseases"), { text: true }),
      row("واکسن‌ها", (w) => joinArr(w, "vaccines"), { text: true }),
      row("داروها", (w) => joinArr(w, "medicines"), { text: true }),
      row("نوع خوراک", (w) => joinArr(w, "feedTypes"), { text: true }),
      row("پیشنهادات", (w) => joinArr(w, "suggestions"), { text: true }),
      row("توضیحات", (w) => w.additional_notes || "—", { text: true }),
    ],
  };

  // فقط گروه‌های انتخاب‌شدهٔ کاربر رندر می‌شوند (عنوان و ترتیب از کاتالوگ)
  const groups = REPORT_GROUPS.filter((group) => selected.includes(group.key))
    .map((group) => {
      const rows = GROUP_ROWS[group.key];
      return rows ? groupHtml(group.title, rows().join("")) : "";
    })
    .filter(Boolean);

  if (groups.length === 0) {
    return '<p style="color:#94a3b8;padding:4px 2px;">گروه شاخصی برای نمایش انتخاب نشده است</p>';
  }

  return `<div class="history-groups">${groups.join("")}</div>`;
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
    /* ✅ جدول شاخص‌ها اکنون ۱۳ ستون دارد: فشرده ولی خوانا می‌ماند و
       در صفحه‌های باریک به‌جای به‌هم‌ریختن، اسکرول می‌خورد */
    .table-scroll { overflow-x: auto; }
    .metrics-table th, .metrics-table td { padding: 6px 6px; font-size: 11.5px; white-space: nowrap; }
    .metrics-table th { font-size: 10.5px; }
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
    /* ===== ماتریس‌های موضوعی تاریخچهٔ هفتگی ===== */
    .history-groups { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .history-matrix-group { background: #fff; border: 1px solid #eef2f6; border-radius: 10px; padding: 10px 12px 12px; page-break-inside: avoid; }
    .history-matrix-group .history-group-title { margin: 0 0 6px; font-size: 12px; }
    .history-matrix { width: 100%; border-collapse: collapse; font-size: 11px; }
    .history-matrix th, .history-matrix td { border: 1px solid #e2e8f0; padding: 4px 6px; }
    .history-matrix thead th { background: #f1f5f9; color: #1e293b; text-align: center; font-weight: 600; white-space: nowrap; }
    .history-matrix th.history-indicator-col { background: #e2e8f0; }
    .history-matrix th.history-indicator { text-align: right; white-space: nowrap; font-size: 11px; color: #1e293b; }
    .history-matrix td { text-align: center; }
    .history-matrix td.history-text { text-align: right; min-width: 70px; max-width: 160px; line-height: 1.6; white-space: normal; overflow-wrap: break-word; }
    .history-matrix tr { page-break-inside: avoid; }
    /* ===== هشدار هفته‌های ثبت‌نشده / ناقص ===== */
    .report-alert { margin: 8px 0 12px; padding: 10px 14px; border-radius: 10px; background: #fff7ed; border: 1px solid #fdba74; border-right: 5px solid #dc2626; color: #7c2d12; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-alert .gap-line { display: flex; gap: 8px; align-items: flex-start; padding: 3px 0; font-size: 12px; line-height: 1.75; }
    .report-alert .gap-line.danger strong { color: #b91c1c; }
    .report-alert .gap-line.warn strong { color: #b45309; }
    .report-alert .gap-ico { flex: 0 0 auto; }
    .report-alert .gap-hint { margin: 6px 0 0; font-size: 11px; color: #92400e; }
    .gap-badge { display: inline-block; background: #fff7ed; border: 1px solid #fdba74; border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 700; color: #b91c1c; }
    .gap-badge .gap-word-warn { color: #b45309; }
    .summary-stat.warn-stat { border-right-color: #dc2626; }
    .summary-stat.warn-stat .stat-number { color: #b91c1c; }
    .week-missing td { background: #fef2f2 !important; color: #b91c1c; font-weight: 700; }
    .week-partial td { background: #fffbeb !important; }
    .cell-missing { color: #b91c1c; font-weight: 700; }
    .cell-warn { color: #b45309; }
    .cell-missing-td { background: #fef2f2 !important; color: #b91c1c; font-weight: 700; }
    .history-matrix thead th.week-missing-col { background: #fee2e2; color: #991b1b; }
    .history-hall .report-alert { margin: 6px 0 10px; }
    .report-groups-note { font-size: 11px; color: #475569; background: #f1f5f9; border-radius: 8px; padding: 6px 12px; display: inline-block; margin-bottom: 10px; }
    /* ===== انتخاب هفته‌ها: چیپ‌ها و خطوط اطلاعی ===== */
    .basis-chip { display: inline-block; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 20px; padding: 2px 10px; font-size: 10.5px; font-weight: 600; }
    .week-range-chip { display: inline-block; background: #f5f3ff; border: 1px solid #ddd6fe; color: #6d28d9; border-radius: 20px; padding: 2px 10px; font-size: 10.5px; font-weight: 600; }
    .gap-outside-note { margin: 6px 0 10px; padding: 6px 12px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 11px; color: #475569; }
    .week-report-block.week-missing { background: #fef2f2; border-color: #fecaca; }
    .history-flock-section { page-break-inside: auto; }
    .history-hall { margin-top: 14px; page-break-inside: auto; }
    .history-hall-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #f0fdf9; border: 1px solid #a7f3d0; border-radius: 8px; padding: 6px 12px; }
    .history-hall-head .hh-title { font-size: 13px; font-weight: 800; color: #065f46; }
    .history-hall-head .hh-meta { font-size: 11px; color: #475569; background: #fff; border: 1px solid #a7f3d0; padding: 1px 10px; border-radius: 20px; white-space: nowrap; }
    .history-completion-strip { margin-top: 10px; }
    .history-completion-strip .label-chip { display: inline-block; background: #fff; border: 1px solid #a7f3d0; color: #065f46; padding: 1px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .history-done-badge { background: #d1fae5; color: #065f46; }
    @media print { body { background: white; padding: 10px; } .flock-section, .week-report-block { box-shadow: none; border: 1px solid #e2e8f0; } .report-header { background: #2c7a6e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .summary-stat { box-shadow: none; border: 1px solid #e2e8f0; } .metrics-table th, .metrics-table td { font-size: 9px; padding: 4px 4px; } .table-scroll { overflow: visible; } }
    @media (max-width: 768px) { .week-table { font-size: 10px; } .week-table th, .week-table td { padding: 4px 6px; } .flock-header { flex-direction: column; align-items: flex-start; gap: 8px; } .summary-stats { grid-template-columns: repeat(2, 1fr); } .wc-groups { grid-template-columns: 1fr; } }
`;

export const weeklyRenderer = {
  // ===== هشدار هفته‌های ثبت‌نشده/ناقص (برای گزارش تاریخچهٔ هفتگی در سرویس) =====
  renderWeekGapsAlert,
  renderGapBadge,

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

  renderFullReport(customer, flocks, periods, groups = [], options = {}) {
    const selected = normalizeGroups(options.selectedGroups);
    // ✅ ترتیب ثابت سالن‌ها از A به آخر (مستقل از ترتیب ورودی سرویس/دیتابیس)
    const orderedFlocks = sortFlocksByHall(flocks || []);
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

    // بخش‌های هر سالن بر اساس کلید گله جمع می‌شوند تا زیر جدول «کل گله» بچینند
    const hallSections = new Map();
    const pushHallSection = (flock, html) => {
      const key = flockGroupKey(flock);
      if (!hallSections.has(key)) hallSections.set(key, []);
      hallSections.get(key).push(html);
    };

    // گله‌هایی که کاربر هیچ هفته‌ای برایشان انتخاب نکرده (خط اطلاعی در ابتدای گزارش)
    const excludedFlockNames = [];

    orderedFlocks.forEach((flock) => {
      // ✅ هفته‌های انتخاب‌شدهٔ کاربر برای همین گله/سالن (null = همهٔ هفته‌ها)
      const timeline = buildWeekTimeline(flock.weeks || []);
      const timelineNumbers = timeline.map((week) => week.weekNumber);
      const weekNumbers = resolveFlockWeekNumbers(
        options,
        flockWeeksKey(flock),
        timeline,
      );

      // گلهٔ بدون هیچ هفتهٔ انتخابی → از گزارش حذف می‌شود
      if (Array.isArray(weekNumbers) && weekNumbers.length === 0) {
        excludedFlockNames.push(
          `گله ${flock.flock_number} (${flock.hall_name || "-"})`,
        );
        return;
      }

      // حسابرسی هفته‌های ثبت‌نشده/ناقص همین سالن (هشدار + ردیف‌های ❌)
      const auditFull = auditOfFlock(flock);
      const audit = Array.isArray(weekNumbers)
        ? scopeAuditToWeeks(auditFull, weekNumbers)
        : auditFull;
      const outsideIssues = Array.isArray(weekNumbers)
        ? issuesOutsideSelection(
            options.weekSelection,
            flockWeeksKey(flock),
            timeline,
          )
        : [];

      // فقط هفته‌های انتخاب‌شده در جدول «جزئیات ثبت هفتگی» می‌آید
      const visibleWeeks = Array.isArray(weekNumbers)
        ? (flock.weeks || []).filter((week) =>
            weekNumbers.includes(parseInt(week.week_number, 10)),
          )
        : flock.weeks;

      const weeksHTML = visibleWeeks
        .map(
          (week, i) => `
                <tr class="${week.existsInDb ? "has-data" : "week-missing"}">
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

      pushHallSection(flock, `
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
                            <span>📊 ${flock.weeks.length} هفته (${flock.savedWeeks.length} ثبت‌شده)</span>
                            ${renderGapBadge(audit)}
                            ${timelineChip(flock.timeline)}
                            ${weekRangeChip(weekNumbers, timelineNumbers)}
                            <span class="status-badge ${flock.is_active ? "status-active" : "status-inactive"}">
                                ${flock.is_active ? "فعال" : "غیرفعال"}
                            </span>
                        </div>
                    </div>

                    ${renderWeekGapsAlert(audit)}
                    ${outsideIssuesNote(outsideIssues)}

                    <div class="flock-summary-strip">
                        <span><strong>تلفات:</strong> ${flock.statistics.totalMortality} قطعه</span>
                        <span><strong>جمعیت مانده:</strong> ${fmtNum(flock.statistics.finalMetrics?.birdsEndOfWeek, 0)} قطعه</span>
                        <span><strong>زنده‌مانی:</strong> ${fmtPct(flock.statistics.finalMetrics?.cumulativeSurvivalPercent)}</span>
                        <span><strong>وزن کل گله:</strong> ${fmtNum(flock.statistics.finalMetrics?.totalLiveWeight, 1)} کیلوگرم</span>
                        <span><strong>کل خوراک:</strong> ${fmtNum(flock.statistics.totalFeed, 1)} کیلوگرم</span>
                        <span><strong>🐔 ضریب تبدیل:</strong> ${flock.statistics.fcr !== null ? fmtNum(flock.statistics.fcr, 3) : "-"}</span>
                        <span><strong>هفته‌های تکمیل شده:</strong> ${flock.statistics.weekCount}</span>
                    </div>

                    ${buildMetricsTableHtml(
                      flock.savedWeeks,
                      "📈 شاخص‌های عملکردی هفتگی",
                      selected,
                      audit,
                      weekNumbers,
                    )}

                    ${
                      visibleWeeks.length > 0 && isGroupSelected(selected, "details")
                        ? `
                        <h4 class="metrics-title">📋 جزئیات ثبت هفتگی</h4>
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
                        : visibleWeeks.length === 0
                          ? `
                        <div style="text-align: center; padding: 20px; color: #94a3b8;">
                            <p>هیچ داده‌ای برای این گله ثبت نشده است</p>
                        </div>
                    `
                          : ""
                    }
                </div>
            `);
    });

    // ===== سرصفحه + خلاصه + جدول تجمعی «کل گله» (فقط گله‌های چندسالنه) =====

    const renderGroupSection = (group, aggregate) => {
      const stats = aggregate.statistics || {};
      // هشدار در سطح «کل گله»: هفته‌ای که هیچ سالنی ثبت نکرده یا بعضی سالن‌ها ناقص‌اند
      const groupAuditFull = mergeAudits(
        (group.halls || []).map((hall) => auditOfFlock(hall)),
      );

      // ✅ انتخاب هفته‌ها در سطح «کل گله» = اجتماع انتخاب سالن‌ها
      const timelinesByKey = {};
      (group.halls || []).forEach((hall) => {
        timelinesByKey[flockWeeksKey(hall)] = buildWeekTimeline(hall.weeks || []);
      });
      const groupWeekNumbers = options?.weekSelection
        ? unionWeekSelection(
            options.weekSelection,
            (group.halls || []).map((hall) => flockWeeksKey(hall)),
            timelinesByKey,
          )
        : null;
      if (Array.isArray(groupWeekNumbers) && groupWeekNumbers.length === 0) {
        excludedFlockNames.push(`گله ${group.flockNumber ?? "-"} (کل گله)`);
        return "";
      }
      const groupAudit = Array.isArray(groupWeekNumbers)
        ? scopeAuditToWeeks(groupAuditFull, groupWeekNumbers)
        : groupAuditFull;

      // چیپ «مبنای پایان» فقط وقتی همهٔ سالن‌ها یک مبنا دارند (یا خلاصهٔ متفاوت)
      const hallTimelines = (group.halls || [])
        .map((hall) => hall.timeline)
        .filter(Boolean);
      const sameEndWeek =
        hallTimelines.length > 0 &&
        hallTimelines.every(
          (timeline) => timeline.endWeek === hallTimelines[0].endWeek,
        );
      const groupTimelineChip = sameEndWeek
        ? timelineChip(hallTimelines[0])
        : hallTimelines.length
          ? '<span class="basis-chip" title="مبنای شمارش هفته‌های مورد انتظار">⚓ مبنای پایان: بر اساس پایان دورهٔ هر سالن</span>'
          : "";

      const hallNames = (group.halls || [])
        .map((h) => h.hall_name || `سالن ${h.hall_id}`)
        .join("، ");
      const fcrText =
        stats.fcr !== null && stats.fcr !== undefined ? fmtNum(stats.fcr, 3) : "-";

      return `
                <div class="flock-section flock-group-section">
                    <div class="flock-header">
                        <div>
                            <div class="flock-title">🐔 گله ${group.flockNumber ?? "—"} — کل ${group.halls.length} سالن</div>
                            <div style="font-size: 13px; color: #64748b;">
                                ${hallNames || "-"} | ${group.breed_name || "-"} | ${toPersian(group.placement_date)}
                            </div>
                        </div>
                        <div class="flock-meta">
                            <span>🧮 ${fmtNum(group.total_chicks_count, 0)} قطعه</span>
                            <span>📊 ${stats.weekCount || 0} از ${groupAudit.total || stats.weekCount || 0} هفته ثبت‌شده</span>
                            ${renderGapBadge(groupAudit)}
                            ${groupTimelineChip}
                            ${weekRangeChip(
                              groupWeekNumbers,
                              Object.values(timelinesByKey).flat().map((week) => week.weekNumber),
                            )}
                            <span class="status-badge ${group.isActive ? "status-active" : "status-inactive"}">
                                ${group.isActive ? "فعال" : "غیرفعال"}
                            </span>
                        </div>
                    </div>

                    <div class="flock-summary-strip">
                        <span><strong>تلفات کل گله:</strong> ${fmtNum(stats.totalMortality, 0)} قطعه</span>
                        <span><strong>جمعیت مانده:</strong> ${fmtNum(stats.finalMetrics?.birdsEndOfWeek, 0)} قطعه</span>
                        <span><strong>زنده‌مانی:</strong> ${fmtPct(stats.finalMetrics?.cumulativeSurvivalPercent)}</span>
                        <span><strong>وزن کل گله:</strong> ${fmtNum(stats.finalMetrics?.totalLiveWeight, 1)} کیلوگرم</span>
                        <span><strong>کل خوراک:</strong> ${fmtNum(stats.totalFeed, 1)} کیلوگرم</span>
                        <span><strong>🐔 ضریب تبدیل:</strong> ${fcrText}</span>
                        <span><strong>هفته‌های تکمیل شده:</strong> ${stats.weekCount || 0}</span>
                    </div>

                    ${renderWeekGapsAlert(groupAudit, "کل گله")}

                    ${buildMetricsTableHtml(
                      aggregate.savedWeeks,
                      "📈 شاخص‌های عملکردی هفتگی — کل گله",
                      selected,
                      groupAudit,
                      groupWeekNumbers,
                    )}
                </div>
            `;
    };

    // ترتیب نهایی: برای هر گلهٔ چندسالنه اول جدول «کل گله»، بعد بخش‌های تفکیک سالن‌ها
    const renderUnits =
      groups && groups.length
        ? groups.map((group) => ({ group, halls: group.halls || [] }))
        : orderedFlocks.map((flock) => ({ group: null, halls: [flock] }));

    const renderedKeys = new Set();
    let flocksHTML = "";
    renderUnits.forEach((unit) => {
      const aggregate = unit.group?.aggregate;
      if (unit.group && aggregate && unit.halls.length > 1) {
        flocksHTML += renderGroupSection(unit.group, aggregate);
      }
      // کلیدهای همین واحد یک‌بار پردازش می‌شوند تا بخش‌ها تکراری نشوند
      const unitKeys = new Set(unit.halls.map((flock) => flockGroupKey(flock)));
      unitKeys.forEach((key) => {
        renderedKeys.add(key);
        (hallSections.get(key) || []).forEach((html) => {
          flocksHTML += html;
        });
      });
    });

    // اگر سالنی خارج از گروه‌ها مانده باشد، در پایان نمایش داده می‌شود
    orderedFlocks.forEach((flock) => {
      const key = flockGroupKey(flock);
      if (renderedKeys.has(key)) return;
      (hallSections.get(key) || []).forEach((html) => {
        flocksHTML += html;
      });
    });

    // ===== یادداشت شاخص‌های انتخابی + محدودهٔ هفته‌ها + خلاصهٔ هشدارها =====
    const weekSelectionSummary = options?.weekSelection
      ? summarizeWeekSelection(
          options.weekSelection,
          Object.fromEntries(
            orderedFlocks.map((flock) => [
              flockWeeksKey(flock),
              buildWeekTimeline(flock.weeks || []),
            ]),
          ),
        )
      : null;
    const weekSelectionNote = weekSelectionSummary
      ? ` · 🎯 هفته‌ها: <strong>${toFa(weekSelectionSummary.weeks)} هفته</strong> از ${toFa(weekSelectionSummary.totalFlocks)} گله/سالن${weekSelectionSummary.overridden ? ` — ${toFa(weekSelectionSummary.overridden)} گله با انتخاب سفارشی` : ""}`
      : "";
    const groupsNoteHtml = `<div class="report-groups-note">🧾 شاخص‌های این گزارش: <strong>${selectedGroupsLabel(selected)}</strong>${weekSelectionNote}</div>`;
    const excludedNoteHtml = excludedFlocksNote(excludedFlockNames);

    const flocksWithGaps = orderedFlocks
      .map((flock) => ({ flock, audit: auditOfFlock(flock) }))
      .filter((item) => item.audit.hasIssues);
    const gapsSummaryHtml = flocksWithGaps.length
      ? `<div class="report-alert" role="alert">
                    <div class="gap-line danger">
                      <span class="gap-ico">⚠️</span>
                      <span><strong>${toFa(flocksWithGaps.length)} گله/سالن</strong> هفتهٔ ثبت‌نشده یا ناقص دارند (${flocksWithGaps
                        .map(
                          (item) =>
                            `گله ${item.flock.flock_number} — ${item.flock.hall_name || ""}`,
                        )
                        .join("، ")}) — جزئیات در ابتدای بخش هر گله آمده است.</span>
                    </div>
                </div>`
      : "";

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
                        ${
                          flocksWithGaps.length > 0
                            ? `<div class="summary-stat warn-stat"><div class="stat-number">${toFa(flocksWithGaps.length)}</div><div class="stat-label">گله با هفتهٔ ثبت‌نشده/ناقص</div></div>`
                            : ""
                        }
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

                ${groupsNoteHtml}
                ${excludedNoteHtml}
                ${gapsSummaryHtml}

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

  renderFlockReport(customer, flock, periods, options = {}) {
    const selected = normalizeGroups(options.selectedGroups);
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
    // حسابرسی هفتههای ثبتنشده/ناقص این گله (برای هشدار و بلوکهای ❌)
    const allWeeks = flock.weeks || savedWeeks;

    // ✅ هفته‌های انتخاب‌شدهٔ کاربر برای این گله (null = همهٔ هفته‌ها)
    const timeline = buildWeekTimeline(allWeeks);
    const timelineNumbers = timeline.map((week) => week.weekNumber);
    const weekNumbers = resolveFlockWeekNumbers(
      options,
      flockWeeksKey(flock),
      timeline,
    );

    // حسابرسی ثبت هفتگی — محدود به هفته‌های انتخابی کاربر
    const auditFull = auditOfFlock(flock);
    const audit = Array.isArray(weekNumbers)
      ? scopeAuditToWeeks(auditFull, weekNumbers)
      : auditFull;
    const outsideIssues = Array.isArray(weekNumbers)
      ? issuesOutsideSelection(
          options.weekSelection,
          flockWeeksKey(flock),
          timeline,
        )
      : [];

    const visibleSavedWeeks = Array.isArray(weekNumbers)
      ? savedWeeks.filter((week) =>
          weekNumbers.includes(parseInt(week.week_number, 10)),
        )
      : savedWeeks;
    const visibleMissingWeeks = Array.isArray(weekNumbers)
      ? allWeeks.filter(
          (week) =>
            isMissingWeek(week) &&
            weekNumbers.includes(parseInt(week.week_number, 10)),
        )
      : allWeeks.filter((week) => isMissingWeek(week));

    const ageInDays = flock.placement_date
      ? Math.max(
          0,
          Math.floor((new Date() - new Date(flock.placement_date)) / 86400000) +
            1,
        )
      : 0;

    // آیا هفتهای وزن/خوراک ثبتشده ندارد؟
    const isPartialWeek = (week) =>
      audit.statuses?.[week.week_number] === WEEK_STATUS.PARTIAL;

    // جفتهای «برچسب/مقدار» جدول جزئیات هر هفته بر اساس گروههای انتخابی کاربر
    const detailPairs = (week) => {
      const pairs = [];
      if (isGroupSelected(selected, "population")) {
        pairs.push(["تلفات", `${week.weekly_mortality || 0} قطعه`]);
      }
      if (isGroupSelected(selected, "weight")) {
        pairs.push(["وزن", `${week.weekly_weight || "-"} kg`]);
      }
      if (isGroupSelected(selected, "feed")) {
        pairs.push(["خوراک روزانه", `${week.daily_feed_intake || "-"} kg`]);
        pairs.push(["خوراک هفتگی", `${week.weekly_feed_intake || "-"} kg`]);
      }
      if (isGroupSelected(selected, "details")) {
        pairs.push(["خاموشی", `${week.blackout_hours || 0} ساعت`]);
        pairs.push(["بیماری‌ها", week.diseases?.join("، ") || "-"]);
        pairs.push(["واکسن‌ها", week.vaccines?.join("، ") || "-"]);
        pairs.push(["داروها", week.medicines?.join("، ") || "-"]);
        pairs.push(["نوع خوراک", week.feedTypes?.join("، ") || "-"]);
        pairs.push(["پیشنهادات", week.suggestions?.join("، ") || "-"]);
        pairs.push(["توضیحات", week.additional_notes || "-"]);
      }
      return pairs;
    };

    const renderWeekDetailsTable = (week) => {
      const pairs = detailPairs(week);
      if (pairs.length === 0) return "";
      const rows = [];
      for (let i = 0; i < pairs.length; i += 2) {
        rows.push(
          `<tr>${pairs
            .slice(i, i + 2)
            .map(([label, value]) => `<th>${label}</th><td>${value}</td>`)
            .join("")}</tr>`,
        );
      }
      return `<table class="detail-list"><tbody>${rows.join("")}</tbody></table>`;
    };

    const weekBlocks = visibleSavedWeeks
      .map(
        (week) => `
        <div class="week-report-block${isPartialWeek(week) ? " week-partial" : ""}">
            <div class="week-report-head">
                <span class="wr-week">هفته ${week.week_number}${isPartialWeek(week) ? " ⚠️" : ""}</span>
                <span class="wr-meta">📅 ${toPersian(week.week_start_date)} تا ${toPersian(week.week_end_date)} | سن: ${week.flock_age_days} روز${isPartialWeek(week) ? " | ⚠️ وزن یا خوراک این هفته ثبت نشده است" : ""}</span>
            </div>
            ${renderWeekMetricsCards(week.metrics, selected)}
            ${renderWeekDetailsTable(week)}
        </div>
    `,
      )
      .join("");

    // هفته‌های بدون ثبت هم به‌صورت بلوک هشدار در گزارش درج می‌شوند
    const missingBlocks = visibleMissingWeeks
      .map(
        (week) => `
        <div class="week-report-block week-missing">
            <div class="week-report-head">
                <span class="wr-week">هفته ${week.week_number} ❌</span>
                <span class="wr-meta">📅 ${toPersian(week.week_start_date)} تا ${toPersian(week.week_end_date)} | اطلاعات این هفته ثبت نشده است</span>
            </div>
        </div>`,
      )
      .join("");

    const weekScopeNote = Array.isArray(weekNumbers)
      ? ` · 🎯 ${weekSelectionLabel(weekNumbers, timelineNumbers, toFa)}`
      : "";
    const groupsNoteHtml = `<div class="report-groups-note">🧾 شاخص‌های این گزارش: <strong>${selectedGroupsLabel(selected)}</strong>${weekScopeNote}</div>`;

    return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>گزارش اختصاصی سالن ${flock.flock_number}</title>
                <style>${REPORT_STYLES}</style>
            </head>
            <body>
                <div class="report-header">
                    <img class="report-logo" src="/assets/images/skb-logo.png" alt="لوگوی شرکت" onerror="this.style.display='none'">
                    <h1>🐔 گزارش اختصاصی سالن ${flock.flock_number}</h1>
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

                ${groupsNoteHtml}

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
                            ${timelineChip(flock.timeline)}
                            ${weekRangeChip(weekNumbers, timelineNumbers)}
                            <span class="status-badge ${flock.is_active ? "status-active" : "status-inactive"}">${flock.is_active ? "فعال" : "غیرفعال"}</span>
                        </div>
                    </div>

                    ${renderWeekGapsAlert(audit)}
                    ${outsideIssuesNote(outsideIssues)}

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
                  weekBlocks || missingBlocks
                    ? `${weekBlocks}${missingBlocks}`
                    : Array.isArray(weekNumbers) && weekNumbers.length === 0
                      ? '<div style="text-align:center; padding:40px; background:#fff; border-radius:10px; color:#94a3b8;">هیچ هفته‌ای برای این گزارش انتخاب نشده است</div>'
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

// ============================================================
//  توابع کمکی ماژول‌محلی renderFullReport (موج ۳.۲e — برش بدنه)
//  این کد پیش‌تر داخل بدنهٔ متد بود؛ بیرون کشیده شد بدون هیچ تغییر
//  رفتاری یا ترتیبی. خروجی HTML بایت‌به‌بایت همان قبلی است
//  (گارد: npm run test:weekly:body — ۱۲ کِیس · اسنپ‌شات طلایی).
//  ⚠️ تورفتگی خطوط عیناً حفظ شده است: فاصله‌های داخل رشته‌های
//     template بخشی از خروجی HTMLاند و کم‌کردنشان بایت‌ها را عوض می‌کند.
// ============================================================
    const buildMetricsTableHtml = (
      savedWeeks,
      title,
      selectedGroups = ALL_GROUP_KEYS,
      audit = null,
      selectedWeekNumbers = null,
    ) => {
      const selected = normalizeGroups(selectedGroups);
      const columns = metricsColumnsFor(selected);
      const rows = (savedWeeks || []).filter((week) => week.metrics);
      if (columns.length === 0) return "";

      const allWeekNumbers = (
        audit?.weeks?.length ? audit.weeks : rows.map((week) => week.week_number)
      )
        .slice()
        .sort((a, b) => a - b);
      // ✅ اگر کاربر هفتههای خاصی را انتخاب کرده باشد، فقط همان‌ها نمایش داده می‌شوند
      const weekNumbers = Array.isArray(selectedWeekNumbers)
        ? allWeekNumbers.filter((week) => selectedWeekNumbers.includes(week))
        : allWeekNumbers;
      if (weekNumbers.length === 0) return "";

      const cellOf = (column, metrics) =>
        column.type === "pct"
          ? fmtPct(column.get(metrics), column.digits)
          : fmtNum(column.get(metrics), column.digits);

      const byWeek = new Map(rows.map((week) => [week.week_number, week]));

      const bodyHtml = weekNumbers
        .map((weekNumber) => {
          const week = byWeek.get(weekNumber);
          if (!week) {
            return `
                                    <tr class="week-missing">
                                        <td>هفته ${weekNumber}</td>
                                        <td colspan="${columns.length}">${MISSING_CELL}</td>
                                    </tr>`;
          }
          const partial =
            audit?.statuses?.[weekNumber] === WEEK_STATUS.PARTIAL;
          const warn = partial
            ? ' <span class="cell-warn" title="وزن یا خوراک این هفته ثبت نشده است">⚠️</span>'
            : "";
          return `
                                    <tr class="${partial ? "week-partial" : ""}">
                                        <td>هفته ${weekNumber}${warn}</td>
                                        ${columns
                                          .map(
                                            (column) =>
                                              `<td>${cellOf(column, week.metrics)}</td>`,
                                          )
                                          .join("")}
                                    </tr>`;
        })
        .join("");

      return `
                        <h4 class="metrics-title">${title}</h4>
                        <div class="table-scroll">
                        <table class="week-table metrics-table">
                            <thead>
                                <tr>
                                    <th>هفته</th>
                                    ${columns
                                      .map(
                                        (column) =>
                                          `<th${column.title ? ` title="${column.title}"` : ""}>${column.label}</th>`,
                                      )
                                      .join("")}
                                </tr>
                            </thead>
                            <tbody>${bodyHtml}</tbody>
                        </table>
                        </div>`;
    };
