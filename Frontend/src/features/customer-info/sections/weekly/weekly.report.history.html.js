// ============================================================
// weekly.report.history.html.js
// ساخت HTML گزارش تاریخچه (ماتریس هفته‌ها) + ابزار سن
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyHistoryHtmlMethods) در weekly.service.js
// حجم: ۲ متد / ۳۴۴ خط
// ============================================================
import {
  weeklyRenderer,
  REPORT_STYLES,
  renderHistoryWeekMatrix,
} from "./weekly.renderer.js";
import { REPORT_GROUPS, normalizeGroups } from "./weekly.report.groups.js";
import {
  auditWeeks,
  mergeAudits,
  scopeAuditToWeeks,
  timelineBasisLabel,
} from "./weekly.audit.js";
import {
  buildWeekTimeline,
  effectiveWeeksFor,
  issuesOutsideSelection,
  mergeWeekTimelines,
  summarizeWeekSelection,
  weekSelectionLabel,
} from "./weekly.report.weeks.js";
import { sortFlocksByHall } from "./weekly.aggregation.js";
import { formatDate } from "../../../../core/utils/date.utils.js";

export const weeklyHistoryHtmlMethods = {
  buildWeeklyHistoryHTML(customer, blocks, options = {}) {
    const {
      selectedGroups,
      weekSelection,
      title,
      persianDate,
      reportDate,
      reportTime,
      reporterName,
      roleText,
      totalHalls,
      totalWeeks,
      totalMissingWeeks,
      weekSelectionNote,
    } = resolveHistoryReportContext(blocks, options);

    // گله‌هایی که کاربر هیچ هفته‌ای برایشان انتخاب نکرده (خط اطلاعی در ابتدای گزارش)
    const excludedBlockNames = [];

    const bodyBlocks = blocks
      .map((b) => {
        const ctx = resolveHistoryFlockContext(b, weekSelection);
        if (ctx.excluded) {
          excludedBlockNames.push(ctx.excludedName);
          return "";
        }

        // 🏁 اطلاعات پایان دوره گله — نوار خلاصهٔ گروهی
        const completionStrip = ctx.comp
          ? `<div class="flock-summary-strip history-completion-strip">
              <span class="label-chip">🏁 پایان دوره</span>
              <span><strong>جوجه اولیه:</strong> ${fmtCountFa(ctx.comp.initial_chicks_count)} قطعه</span>
              <span><strong>جوجه نهایی:</strong> ${fmtCountFa(ctx.comp.final_chicks_count)} قطعه</span>
              <span><strong>تلفات کل:</strong> ${fmtCountFa(ctx.comp.total_mortality)} قطعه</span>
              <span><strong>FCR:</strong> ${ctx.comp.system_fcr ?? "-"}</span>
              <span><strong>سن کشتار:</strong> ${ctx.comp.slaughter_age_days ?? "-"} روز</span>
            </div>`
          : "";

        const excludedHalls = [];
        const halls = ctx.orderedHalls
          .map((h) => {
            const hall = buildHistoryHallHtml(
              h,
              ctx.flockKey,
              weekSelection,
              selectedGroups,
            );
            if (hall.excludedName) excludedHalls.push(hall.excludedName);
            return hall.html;
          })
          .join("");

        return buildHistoryFlockSectionHtml({
          ...ctx,
          hallCount: (b.halls || []).length,
          completionStrip,
          excludedHalls,
          halls,
        });
      })
      .join("");
    const summaryStats = `
      <div class="summary-stats">
        <div class="summary-stat"><div class="stat-number">${fmtCountFa(blocks.length)}</div><div class="stat-label">گلهٔ تکمیل‌شده</div></div>
        <div class="summary-stat"><div class="stat-number">${fmtCountFa(totalHalls)}</div><div class="stat-label">سالن</div></div>
        <div class="summary-stat"><div class="stat-number">${fmtCountFa(totalWeeks)}</div><div class="stat-label">هفتهٔ ثبت‌شده</div></div>
        ${
          totalMissingWeeks > 0
            ? `<div class="summary-stat warn-stat"><div class="stat-number">${fmtCountFa(totalMissingWeeks)}</div><div class="stat-label">هفتهٔ بدون ثبت</div></div>`
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
          ${REPORT_STYLES}${HISTORY_REPORT_STYLE_BLOCK}        </style>
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
                  ? `<p class="gap-outside-note">ℹ️ ${fmtCountFa(excludedBlockNames.length)} گله (${excludedBlockNames.join("، ")}) به‌خاطر انتخاب‌نشدن هیچ هفته‌ای در این گزارش نیامده است.</p>`
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
  },

  // ===== ابزارهای کمکی =====

  calculateAge(placementDate) {
    const today = new Date();
    const placement = new Date(placementDate);
    placement.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today - placement) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  },

};

// ------------------------------------------------------------
//  کمکی‌های برش A موج ۳.۲g: زمینهٔ گزارش تاریخچه + ابزارهای نمایش + بلوک CSS
//  متن‌ها عیناً (verbatim) منتقل شده‌اند؛ تنها تغییر: نام ابزارهای نمایش
//  (fmtCount → fmtCountFa و toPersianShort → toPersianShortDate) تا ماژول‌محلی شوند.
//  ⚠️ در بلوک CSS فقط «محتوای درونی» جایگزین شده و تگ‌ها سر جای خود مانده‌اند.
// ------------------------------------------------------------
const resolveHistoryReportContext = (blocks, options) => {
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
      ? ` · 🎯 هفته‌ها: <strong>${fmtCountFa(weekSelectionSummary.weeks)} هفته</strong> از ${fmtCountFa(weekSelectionSummary.totalFlocks)} گله${weekSelectionSummary.overridden ? ` — ${fmtCountFa(weekSelectionSummary.overridden)} گله با انتخاب سفارشی` : ""}`
      : "";
  return {
    selectedGroups,
    weekSelection,
    title,
    persianDate,
    reportDate,
    reportTime,
    reporterName,
    roleText,
    totalHalls,
    totalWeeks,
    totalMissingWeeks,
    weekSelectionSummary,
    weekSelectionNote,
  };
};

const fmtCountFa = (value) => (parseInt(value) || 0).toLocaleString("fa-IR");
const toPersianShortDate = (date) => {
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

const HISTORY_REPORT_STYLE_BLOCK = `
          body { background: #f8fafc; color: #1e293b; font-size: 12px; margin: 0; padding: 16px; }
          .report-main { width: 100%; border-collapse: collapse; }
          .report-main thead { display: table-header-group; }
          .report-main td { border: none; padding: 0; }
          .report-page-header { text-align: center; background: linear-gradient(135deg, #2c7a6e 0%, #065f46 100%); color: #fff; border-radius: 12px; padding: 22px 18px; margin-bottom: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .report-page-header h1 { color: #fff; font-size: 22px; margin: 0 0 6px; font-weight: 700; }
          .report-page-header .date { color: rgba(255,255,255,0.92); font-size: 12px; margin-top: 6px; }
          .report-page-header .report-logo { display: block; height: 46px; width: auto; margin: 0 auto 10px; background: #fff; padding: 5px 10px; border-radius: 10px; }
          .report-main .customer-info { margin: 0 0 16px; }
`;

// ------------------------------------------------------------
//  کمکی‌های برش B موج ۳.۲g: حلقهٔ گله/سالن گزارش تاریخچه
//  متن نواحی عیناً (verbatim) منتقل شده است؛ تنها تغییرها:
//   ۱) b. → block. و h. → hall. (پارامتر کمکی‌ها).
//   ۲) شرط‌های حذف گله/سالن بهجای push/return، مقدار برمی‌گردانند
//      («{ excluded: true, excludedName }» و «{ html, excludedName }»).
//   ۳) تک‌تک حلقهٔ سالن‌ها از map/join بیرونی به کمکی منتقل شده است.
// ------------------------------------------------------------
const resolveHistoryFlockContext = (block, weekSelection) => {
        const f = block.flock;
        const flockNum = f.flock_number || "-";
        const unitName = f.unit?.unit_name || "-";
        const comp = block.completion;
        const flockWeeksCount = (block.halls || []).reduce(
          (s, h) => s + (h.weeks?.length || 0),
          0,
        );
        // ✅ ترتیب ثابت سالن‌ها از A به آخر (مستقل از ترتیب ورودی دیتابیس)
        const orderedHalls = sortFlocksByHall(block.halls || []);
        // هشدار سطح گله: اجتماع هفته‌های بدون ثبت/ناقص همهٔ سالن‌های همین گله
        const hallAudits = orderedHalls.map(
          (h) =>
            h.audit || auditWeeks(h.allWeeks || h.weeks || [], h.hallName || ""),
        );

        // ✅ انتخاب هفته‌های این گله (کلید f<flockId>) — هر سالن با خط زمانی خودش
        const flockKey = `f${block.flock.id}`;
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
        const flockBasisChip = block.halls?.[0]?.timeline
          ? `<span class="hh-meta basis-chip" title="مبنای شمارش هفته‌های مورد انتظار">⚓ مبنای پایان: ${timelineBasisLabel(block.halls[0].timeline, toPersianShortDate)}</span>`
          : "";
        const flockWeekChip = Array.isArray(flockWeekNumbers)
          ? `<span class="hh-meta week-range-chip">🎯 ${weekSelectionLabel(flockWeekNumbers, flockTimeline.map((w) => w.weekNumber), fmtCountFa)}</span>`
          : "";

        if (Array.isArray(flockWeekNumbers) && flockWeekNumbers.length === 0) {
          return { excluded: true, excludedName: `گله ${block.flock.flock_number || "-"} — واحد ${block.flock.unit?.unit_name || "-"}` };
        }
  return {
    flockNum,
    unitName,
    comp,
    flockWeeksCount,
    orderedHalls,
    flockKey,
    flockTimeline,
    flockWeekNumbers,
    flockOutsideIssues,
    flockAudit,
    flockBasisChip,
    flockWeekChip,
  };
};

const buildHistoryHallHtml = (hall, flockKey, weekSelection, selectedGroups) => {
            const list = hall.weeks || [];
            // ✅ خط زمانی کامل (هفته‌های نظری + ثبت‌شده) تا هفته‌های بدون ثبت هم در ماتریس بیاید
            const fullTimeline = hall.allWeeks?.length ? hall.allWeeks : list;
            const hallTimeline = buildWeekTimeline(fullTimeline);
            const rawAudit =
              hall.audit || auditWeeks(fullTimeline, hall.hallName || "");

            // ✅ محدود به هفته‌های انتخاب‌شدهٔ همین گله (اگر کاربر انتخاب سفارشی داشته باشد)
            const hallWeekNumbers = weekSelection
              ? effectiveWeeksFor(weekSelection, flockKey, hallTimeline)
              : null;
            if (Array.isArray(hallWeekNumbers) && hallWeekNumbers.length === 0) {
              return {
                html: "",
                excludedName: hall.hallName || "-",
              };
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
            const basisChip = hall.timeline
              ? `<span class="hh-meta basis-chip" title="مبنای شمارش هفته‌های مورد انتظار و هشدارهای ثبت">⚓ مبنای پایان: ${timelineBasisLabel(hall.timeline, toPersianShortDate)}</span>`
              : "";
            const weekRangeChip = Array.isArray(hallWeekNumbers)
              ? `<span class="hh-meta week-range-chip">🎯 ${weekSelectionLabel(hallWeekNumbers, hallTimeline.map((w) => w.weekNumber), fmtCountFa)}</span>`
              : "";
            const placement = hall.placement || {};
            const weeksChip =
              list.length > 0
                ? `<span class="hh-meta">📅 ${fmtCountFa(list.length)} هفتهٔ ثبت‌شده${audit.missing.length ? ` از ${fmtCountFa(audit.total)}` : ""}</span>`
                : "";
            const gapChip = audit.hasIssues
              ? weeklyRenderer.renderGapBadge(audit)
              : "";
            const chicksChip = placement.total_chicks_count
              ? `<span class="hh-meta">🐣 ${fmtCountFa(placement.total_chicks_count)} قطعه</span>`
              : "";
            const dateChip = placement.placement_date
              ? `<span class="hh-meta">📆 ${toPersianShortDate(placement.placement_date)}</span>`
              : "";
            return { html: `
              <div class="history-hall">
                <div class="history-hall-head">
                  <span class="hh-title">🧩 ${hall.hallName}</span>
                  ${weeksChip}${gapChip}${chicksChip}${dateChip}${basisChip}${weekRangeChip}
                </div>
                ${weeklyRenderer.renderWeekGapsAlert(audit, hall.hallName)}
                ${
                  outsideIssues.length
                    ? `<p class="gap-outside-note">ℹ️ ${fmtCountFa(outsideIssues.length)} هفتهٔ مشکل‌دار دیگر این سالن (${outsideIssues.join("، ")}) خارج از انتخاب شماست.</p>`
                    : ""
                }
                ${
                  list.length || audit.missing.length
                    ? renderHistoryWeekMatrix(timeline, selectedGroups)
                    : '<p style="color:#94a3b8;padding:4px 2px;">ثبت هفتگی‌ای برای این سالن موجود نیست</p>'
                }
              </div>
            `,
              excludedName: null,
            };
};

const buildHistoryFlockSectionHtml = ({
  flockNum,
  unitName,
  hallCount,
  flockWeeksCount,
  flockAudit,
  flockBasisChip,
  flockWeekChip,
  completionStrip,
  flockOutsideIssues,
  excludedHalls,
  halls,
}) => {
        return `
          <div class="flock-section history-flock-section">
            <div class="flock-header">
              <div>
                <div class="flock-title">🐔 گله ${flockNum} — واحد ${unitName}</div>
              </div>
              <div class="flock-meta">
                <span>🏭 ${fmtCountFa(hallCount)} سالن</span>
                <span>📅 ${fmtCountFa(flockWeeksCount)} هفته ثبت‌شده${flockAudit.missing.length ? ` از ${fmtCountFa(flockAudit.total)}` : ""}</span>
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
                ? `<p class="gap-outside-note">ℹ️ ${fmtCountFa(flockOutsideIssues.length)} هفتهٔ مشکل‌دار دیگر این گله (${flockOutsideIssues.join("، ")}) خارج از انتخاب شماست.</p>`
                : ""
            }
            ${
              excludedHalls.length
                ? `<p class="gap-outside-note">ℹ️ ${fmtCountFa(excludedHalls.length)} سالن (${excludedHalls.join("، ")}) به‌خاطر انتخاب‌نشدن هیچ هفته‌ای در این گزارش نیامده است.</p>`
                : ""
            }
            ${halls}
          </div>
        `;
};
