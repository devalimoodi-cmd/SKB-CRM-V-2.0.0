// ================================================================
// hatchery.report.js - گزارش مدیریت جوجه‌ریزی (ساختار جدید گله)
// دو حالت: «فعال» (گله‌های در جریان) و «تاریخچه» (گله‌های تمام‌شده)
// هر گله = سرگروه + سالن‌های عضو؛ هدر مشتری در چاپ همه صفحات تکرار می‌شود
// ================================================================

import { hatcheryApi } from "./hatchery.api.js";
import { apiService } from "../../../../core/services/api.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  convertToPersianDate,
  formatDate,
} from "../../../../core/utils/date.utils.js";

// نمایش تاریخ کشتار به‌صورت بازه‌ای (شروع/پایان)؛ رکوردهای قدیمی تک‌تاریخی هم پشتیبانی می‌شوند
const formatSlaughterRange = (completion) => {
  if (!completion) return "-";
  const start = completion.slaughter_date || null;
  const end = completion.slaughter_end_date || null;
  if (!start && !end) return "-";
  if (!end || end === start) {
    return convertToPersianDate(start || end);
  }
  return `${convertToPersianDate(start)} تا ${convertToPersianDate(end)}`;
};

// برچسب روش ثبت سن کشتار
const slaughterAgeMethodLabel = (completion) => {
  const m = completion?.slaughter_age_method;
  if (m === "range") return "روش بازهٔ تاریخی";
  if (m === "direct") return "روش ورود مستقیم سن";
  if (m === "weighted") return "روش ارسال چندمرحله‌ای";
  return completion?.slaughter_age_end_days ? "بازهٔ سن (قدیمی)" : "";
};

// نمایش سن کشتار — برای رکوردهای دارای «روش» فقط سن نهایی؛ رکوردهای قدیمی بازهٔ قبلی
const formatAgeRange = (completion) => {
  if (!completion) return "-";
  const start = completion.slaughter_age_days;
  const method = completion.slaughter_age_method;
  const hasStart = start !== null && start !== undefined;
  const faNum = hasStart
    ? Number(start).toLocaleString("fa-IR", { maximumFractionDigits: 0 })
    : "";
  if (method === "range") return hasStart ? `${faNum} روز` : "-";
  if (method === "direct") return hasStart ? `${faNum} روز` : "-";
  if (method === "weighted") {
    return hasStart ? `${faNum} روز (میانگین وزنی)` : "-";
  }
  const end = completion.slaughter_age_end_days;
  const hasEnd = end !== null && end !== undefined;
  if (!hasStart && !hasEnd) return "-";
  if (!hasEnd || Number(end) === Number(start)) {
    return `${hasStart ? start : end} روز`;
  }
  return `${start}-${end} روز`;
};

class HatcheryReport {
  constructor() {
    this.customerId = null;
    this.customerData = null;
    this.dictionaries = {};
  }

  async init(customerId) {
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");
    if (!this.customerId) {
      throw new Error("شناسه مشتری یافت نشد");
    }
  }

  async loadDictionaries() {
    try {
      const [sources, breeds] = await Promise.all([
        hatcheryApi.getChickSources(),
        hatcheryApi.getChickenBreeds(),
      ]);
      this.dictionaries = {
        sources: sources.success ? sources.data : [],
        breeds: breeds.success ? breeds.data : [],
      };
    } catch (error) {
      console.error("❌ Error loading dictionaries:", error);
    }
  }

  // بارگذاری گله‌ها (active یا completed) + پایان دوره per گله برای تاریخچه
  async loadFlocksByStatus(status) {
    const res = await apiService.get("/flocks", {
      customer_id: this.customerId,
      status,
      limit: 500,
    });
    const flocks =
      res?.success && Array.isArray(res.data?.flocks) ? res.data.flocks : [];

    const completionsMap = {};
    if (status === "completed") {
      for (const flock of flocks) {
        try {
          const c = await hatcheryApi.getFlockCompletionByFlock(flock.id);
          if (c.success && c.data) {
            completionsMap[flock.id] = c.data;
          }
        } catch (e) {
          console.warn(`⚠️ بدون پایان دوره برای گله ${flock.id}`);
        }
      }
    }
    return { flocks, completionsMap };
  }

  async generateFullReport(mode = "active") {
    try {
      const status = mode === "history" ? "completed" : "active";
      const customerRes = await apiService
        .get(`/customers/${this.customerId}`)
        .catch(() => null);
      this.customerData = customerRes?.data || null;

      const { flocks, completionsMap } = await this.loadFlocksByStatus(status);

      // نام نژاد/مبدا از دیکشنری برای نمایش (اختیاری)
      await this.loadDictionaries();

      return {
        mode,
        customer: this.customerData,
        flocks,
        completionsMap,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Error generating hatchery report:", error);
      throw error;
    }
  }

  getPlacementBreedName(p) {
    return p.breed?.name || p.breedName || "-";
  }

  getPlacementHallName(p) {
    return (
      p.hall?.hall_name ||
      p.Hall?.hall_name ||
      p.hall_name ||
      `سالن ${p.hall_id || "-"}`
    );
  }

  buildStats(flocks, mode) {
    const flockCount = flocks.length;
    const hallCount = flocks.reduce(
      (s, f) => s + ((f.placements || []).length || 0),
      0,
    );
    const totalChicks = flocks.reduce(
      (s, f) =>
        s +
        (f.placements || []).reduce(
          (ss, p) => ss + (parseInt(p.total_chicks_count) || 0),
          0,
        ),
      0,
    );
    return { flockCount, hallCount, totalChicks };
  }

  buildFlockHTML(f, mode, completion) {
    const placements = f.placements || [];
    const unitName = f.unit?.unit_name || "-";
    const statusText =
      mode === "history"
        ? `تکمیل‌شده — ${f.ended_at ? convertToPersianDate(f.ended_at) : "-"}`
        : "در جریان";
    // درصد تلفات از معکوس زنده‌مانی هر مبنا (سیستمی / اعلامی مرغدار) مشتق می‌شود
    const reportSysMortPct =
      completion?.system_survival_percent != null
        ? 100 - Number(completion.system_survival_percent)
        : null;
    const reportFarmerMortPct =
      completion?.farmer_survival_percent != null
        ? 100 - Number(completion.farmer_survival_percent)
        : null;

    // هدر گله
    let html = `
      <div class="report-flock">
        <div class="report-flock-header">
          <h3>🐣 گله ${f.flock_number || "-"} — واحد ${unitName}
            <span class="status-tag ${mode === "history" ? "completed" : "active"}">${statusText}</span>
          </h3>
        </div>
        <div class="report-two-col">
          <div class="report-col">
            <div class="report-section">
              <h4>اطلاعات گله (کل)</h4>
              <table class="report-table compact">
                <tr><td>تاریخ تعریف گله</td><td>${f.placement_date ? convertToPersianDate(f.placement_date) : "-"}</td></tr>
                <tr><td>تعداد سالن‌های عضو</td><td><strong>${placements.length}</strong></td></tr>
                <tr><td>واحد</td><td>${unitName}</td></tr>
              </table>
            </div>
          </div>
          ${
            mode === "history" && completion
              ? `
            <div class="report-col">
              <div class="report-section">
                <h4>🏁 جمع‌بندی پایان دوره گله</h4>
                <table class="report-table compact">
                  <tr><td>جوجه اولیه</td><td>${(parseInt(completion.initial_chicks_count) || 0).toLocaleString()}</td></tr>
                  <tr><td>جوجه نهایی</td><td>${(parseInt(completion.final_chicks_count) || 0).toLocaleString()}</td></tr>
                  <tr><td>تلفات کل</td><td>${parseInt(completion.total_mortality) || 0}</td></tr>
                  <tr><td>درصد تلفات (سیستمی)</td><td>${
                    reportSysMortPct != null
                      ? `${reportSysMortPct.toLocaleString("fa-IR", {
                          maximumFractionDigits: 2,
                        })}٪`
                      : "-"
                  }</td></tr>
                  <tr><td>درصد تلفات (اعلامی مرغدار)</td><td>${
                    reportFarmerMortPct != null
                      ? `${reportFarmerMortPct.toLocaleString("fa-IR", {
                          maximumFractionDigits: 2,
                        })}٪`
                      : "-"
                  }</td></tr>
                  <tr><td>FCR نهایی</td><td><strong>${completion.final_fcr ?? completion.system_fcr ?? completion.farmer_fcr ?? "-"}</strong></td></tr>
                  <tr><td>FCR (سیستمی)</td><td>${completion.system_fcr ?? "-"}</td></tr>
                  <tr><td>FCR (اعلامی مرغدار)</td><td>${completion.farmer_fcr ?? "-"}</td></tr>
                  <tr><td>EPI (سیستمی / اعلامی)</td><td>${completion.system_epi ?? "-"} / ${completion.farmer_epi ?? "-"}</td></tr>
                  <tr><td>ADG (سیستمی / اعلامی)</td><td>${completion.system_adg_grams ?? "-"} / ${completion.farmer_adg_grams ?? "-"}</td></tr>
                  <tr><td>EPI</td><td><strong>${completion.epi ?? "-"}</strong></td></tr>
                  <tr><td>ADG (گرم/روز)</td><td>${completion.adg_grams ?? "-"}</td></tr>
                  <tr><td>تعداد ارسالی به کشتارگاه</td><td>${completion.total_sent != null ? Number(completion.total_sent).toLocaleString("fa-IR") : "-"}</td></tr>
                  <tr><td>درآمد کل</td><td>${completion.income_total != null ? `${Number(completion.income_total).toLocaleString("fa-IR")} تومان` : "-"}</td></tr>
                  <tr><td>جمع هزینه‌ها</td><td>${completion.total_cost != null ? `${Number(completion.total_cost).toLocaleString("fa-IR")} تومان` : "-"}</td></tr>
                  <tr><td>سود خالص</td><td><strong style="color:${Number(completion.net_profit) >= 0 ? "#16a34a" : "#dc2626"};">${completion.net_profit != null ? `${Number(completion.net_profit).toLocaleString("fa-IR")} تومان` : "-"}</strong></td></tr>
                  <tr><td>درصد سود</td><td>${completion.profit_percent != null ? `${completion.profit_percent}٪` : "-"}</td></tr>
                  <tr><td>سن کشتار</td><td>${formatAgeRange(completion)}</td></tr>
                  ${
                    completion.slaughter_age_method ||
                    completion.slaughter_age_end_days
                      ? `<tr><td>روش سن کشتار</td><td>${slaughterAgeMethodLabel(completion) || "-"}</td></tr>`
                      : ""
                  }
                  <tr><td>تاریخ کشتار (اعلامی مرغدار)</td><td>${formatSlaughterRange(completion)}</td></tr>
                  <tr><td>هفته آخر</td><td>${completion.final_week_number ?? "-"}</td></tr>
                </table>
                ${
                  completion.slaughter_age_method === "weighted" &&
                  Array.isArray(completion.slaughter_shipments) &&
                  completion.slaughter_shipments.length
                    ? `<div style="margin-top:8px;font-size:11px;color:#334155;">
                        <strong>جزئیات ارسال‌ها به کشتارگاه:</strong>
                        <table class="report-table compact" style="margin-top:4px;">
                          <thead><tr><th>سن (روز)</th><th>تعداد (قطعه)</th><th>تاریخ</th></tr></thead>
                          <tbody>
                            ${completion.slaughter_shipments
                              .map(
                                (s) =>
                                  `<tr><td>${s.age_days ?? "-"}</td><td>${
                                    s.quantity != null
                                      ? Number(s.quantity).toLocaleString("fa-IR")
                                      : "-"
                                  }</td><td>${
                                    s.date ? convertToPersianDate(s.date) : "-"
                                  }</td></tr>`,
                              )
                              .join("")}
                          </tbody>
                        </table>
                      </div>`
                    : ""
                }
              </div>
            </div>`
              : ""
          }
        </div>
        <div class="report-section-full">
          <h4>🧩 سالن‌های گله (جزئیات تفکیکی)</h4>
          <div style="overflow-x:auto;">
            <table class="report-table" style="min-width:900px;">
              <thead>
                <tr>
                  <th>ردیف</th><th>سالن</th><th>نژاد</th><th>مبدا</th>
                  <th>تعداد جوجه</th><th>سن بدو ورود</th><th>وزن اولیه (گرم)</th>
                  <th>تاریخ جوجه‌ریزی</th><th>وضعیت سالن</th>
                </tr>
              </thead>
              <tbody>
    `;

    placements.forEach((p, i) => {
      const source =
        this.dictionaries.sources?.find((s) => s.id === p.chick_source_id)
          ?.name || "-";
      const completed = mode === "history";
      html += `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${this.getPlacementHallName(p)}</strong></td>
          <td>${this.getPlacementBreedName(p)}</td>
          <td>${source}</td>
          <td>${(parseInt(p.total_chicks_count) || 0).toLocaleString()}</td>
          <td>${p.chick_age_on_arrival ? p.chick_age_on_arrival + " روز" : "-"}</td>
          <td>${p.avg_initial_weight ?? "-"}</td>
          <td>${p.placement_date ? convertToPersianDate(p.placement_date) : "-"}</td>
          <td><span class="status-tag ${p.is_active ? "active" : "inactive"}">${p.is_active ? "در جریان" : "پایان‌یافته"}</span></td>
        </tr>
      `;
    });

    html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    return html;
  }

  generateHTML(reportData) {
    const { customer, flocks, completionsMap, generatedAt, mode } = reportData;
    const now = new Date(generatedAt);
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

    const title =
      mode === "history"
        ? "🕓 گزارش تاریخچه جوجه‌ریزی (گله‌های تکمیل‌شده)"
        : "🐣 گزارش کامل جوجه‌ریزی (گله‌های فعال)";
    const stats = this.buildStats(flocks, mode);

    const flocksHTML =
      flocks.length > 0
        ? flocks
            .map((f) => this.buildFlockHTML(f, mode, completionsMap[f.id]))
            .join('<hr class="report-divider">')
        : '<p style="text-align:center;color:#94a3b8;">گله‌ای برای نمایش وجود ندارد</p>';

    const customerHTML = customer
      ? `
      <table class="customer-info-table">
        <tr>
          <td><strong>نام مشتری:</strong> ${customer.full_name || "-"}</td>
          <td><strong>نام فارم:</strong> ${customer.farm_name || "-"}</td>
        </tr>
        <tr>
          <td><strong>موبایل:</strong> ${customer.mobile_number || "-"}</td>
          <td><strong>استان:</strong> ${customer.province || "-"} | <strong>شهرستان:</strong> ${customer.county || "-"}</td>
        </tr>
      </table>
      <p><strong>آدرس:</strong> ${customer.farm_address || "-"}</p>`
      : "";

    return `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @font-face { font-family: "Vazir"; src: url("/assets/fonts/Vazir-Regular-FD.ttf") format("truetype"); font-weight: 400; }
          @font-face { font-family: "Vazir"; src: url("/assets/fonts/Vazir-Medium-FD.ttf") format("truetype"); font-weight: 500; }
          @font-face { font-family: "Vazir"; src: url("/assets/fonts/Vazir-Bold-FD.ttf") format("truetype"); font-weight: 700; }
          @media print { body { margin: 0.5cm; } }
          body {
            font-family: 'Vazir', 'Tahoma', sans-serif;
            direction: rtl; background: #fff; color: #1e293b;
            font-size: 13px; line-height: 1.7; margin: 0;
          }
          .report-main { width: 100%; border-collapse: collapse; }
          .report-main thead { display: table-header-group; }
          .report-main tbody { display: table-row-group; }
          .report-main td { border: none; padding: 0; vertical-align: top; }
          .report-page-header {
            text-align: center; padding: 10px 0 12px;
            border-bottom: 3px solid #2c7a6e; margin-bottom: 18px;
          }
          .report-page-header h1 { color: #2c7a6e; font-size: 21px; margin: 0 0 5px; }
          .report-page-header .report-logo { display: block; height: 54px; width: auto; margin: 0 auto 8px; }
          .report-page-header .date { color: #94a3b8; font-size: 12px; }
          .report-customer-info {
            background: #f8fafc; padding: 10px 14px; border-radius: 8px;
            border: 1px solid #eef2f6; margin-bottom: 18px;
          }
          .customer-info-table { width: 100%; border-collapse: collapse; }
          .customer-info-table td { padding: 2px 8px; font-size: 12.5px; border: none; }
          .report-content { padding: 0 4px; }
          .summary-stats {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 10px; margin-bottom: 18px;
          }
          .stat-box {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border: 1px solid #eef2f6; padding: 10px; text-align: center; border-radius: 8px;
          }
          .stat-box .stat-label { font-size: 11px; color: #64748b; }
          .stat-box .stat-value { font-size: 17px; font-weight: 700; color: #2c7a6e; margin-top: 2px; }
          .report-flock { page-break-inside: avoid; margin-bottom: 10px; }
          .report-flock-header h3 {
            background: #2c7a6e; color: #fff; padding: 6px 14px; border-radius: 8px;
            font-size: 14px; margin: 0 0 8px; display: flex; justify-content: space-between; align-items: center;
          }
          .status-tag { display: inline-block; padding: 1px 10px; border-radius: 10px; font-size: 10.5px; font-weight: 500; }
          .status-tag.active { background: #dcfce7; color: #16a34a; }
          .status-tag.inactive { background: #fee2e2; color: #dc2626; }
          .status-tag.completed { background: #dbeafe; color: #2563eb; }
          .report-two-col { display: flex; gap: 14px; margin-bottom: 4px; }
          .report-col { flex: 1; min-width: 0; }
          .report-section { margin: 4px 0; background: #fafbfc; border-radius: 6px; padding: 8px 10px; border: 1px solid #eef2f6; }
          .report-section-full { margin: 8px 0; background: #fafbfc; border-radius: 6px; padding: 10px 12px; border: 1px solid #eef2f6; }
          .report-section h4, .report-section-full h4 { color: #2c7a6e; font-size: 12px; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #eef2f6; }
          .report-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .report-table th { background: #2c7a6e; color: #fff; padding: 5px 10px; font-weight: 500; text-align: center; }
          .report-table td { padding: 5px 8px; border: 1px solid #eef2f6; text-align: center; }
          .report-table.compact td { border: none; border-bottom: 1px solid #f1f5f9; padding: 2px 6px; text-align: right; }
          .report-table.compact tr:last-child td { border-bottom: none; }
          .report-table.compact td:first-child { width: 120px; color: #64748b; font-weight: 500; }
          .report-divider { border: none; border-top: 1px dashed #e2e8f0; margin: 14px 0; }
          .report-footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 30px; padding-top: 12px; border-top: 1px solid #eef2f6; }
          @media print {
            .report-flock { page-break-inside: avoid; }
            .report-two-col { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <table class="report-main">
          <thead>
            <tr><td>
              <div class="report-page-header">
                <img class="report-logo" src="/assets/images/skb-logo.png" alt="لوگوی شرکت" onerror="this.style.display='none'">
                <h1>${title}</h1>
                <div class="date">تاریخ گزارش: ${persianDate}</div>
              </div>
              <div class="report-customer-info">${customerHTML}</div>
              <div class="summary-stats">
                <div class="stat-box"><div class="stat-label">تعداد گله‌ها</div><div class="stat-value">${stats.flockCount}</div></div>
                <div class="stat-box"><div class="stat-label">${mode === "history" ? "گله‌های تکمیل‌شده" : "گله‌های فعال"}</div><div class="stat-value">${stats.flockCount}</div></div>
                <div class="stat-box"><div class="stat-label">تعداد سالن‌ها</div><div class="stat-value">${stats.hallCount}</div></div>
                <div class="stat-box"><div class="stat-label">مجموع جوجه‌ها</div><div class="stat-value">${stats.totalChicks.toLocaleString()}</div></div>
              </div>
            </td></tr>
          </thead>
          <tbody>
            <tr><td>
              <div class="report-content">
                ${flocksHTML}
                <div class="report-footer">
                  <p>
                    📌 دریافت گزارش توسط: <strong>${reporterName}</strong> (${roleText}) |
                    تاریخ: <strong>${reportDate}</strong> |
                    ساعت: <strong>${reportTime}</strong>
                  </p>
                  <p>این گزارش توسط سامانه مدیریت مشتریان (SKB-CRM) تولید شده است</p>
                </div>
              </div>
            </td></tr>
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); }
        <\\/script>
      </body>
      </html>
    `;
  }

  async generateFlockReport(flockId) {
    try {
      await this.init();
      await this.loadDictionaries();

      const flockRes = await apiService.get(`/flocks/${flockId}`);
      if (!flockRes?.success || !flockRes.data) {
        alert("گله یافت نشد");
        return;
      }
      const flock = flockRes.data;

      if (flock.status !== "completed") {
        alert("برای این گله هنوز اطلاعات پایان دوره ثبت نشده است");
        return;
      }

      let completionData = null;
      try {
        const compRes = await hatcheryApi.getFlockCompletionByFlock(flockId);
        if (compRes?.success && compRes.data) completionData = compRes.data;
      } catch (e) {
        completionData = null;
      }
      if (!completionData) {
        alert("برای این گله هنوز اطلاعات پایان دوره ثبت نشده است");
        return;
      }

      const customerRes = await apiService
        .get(`/customers/${this.customerId}`)
        .catch(() => null);

      const reportData = {
        mode: "history",
        customer: customerRes?.data || null,
        flocks: [flock],
        completionsMap: { [flockId]: completionData },
        generatedAt: new Date().toISOString(),
      };

      const html = this.generateHTML(reportData);
      const printWindow = window.open("", "_blank", "width=1100,height=800");
      if (!printWindow) {
        alert("لطفاً باز شدن پنجره popup را مجاز کنید");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error("Error generating flock report:", error);
      alert("خطا در تولید گزارش گله: " + error.message);
    }
  }

  async generateAndPrint(mode = "active") {
    try {
      await this.init();
      const reportData = await this.generateFullReport(mode);
      const html = this.generateHTML(reportData);
      const printWindow = window.open("", "_blank", "width=1100,height=800");
      if (!printWindow) {
        alert("لطفاً باز شدن پنجره popup را مجاز کنید");
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error("❌ Error generating chick report:", error);
      alert("خطا در تولید گزارش: " + error.message);
    }
  }

  async generateHistoryAndPrint() {
    await this.generateAndPrint("history");
  }
}

export const hatcheryReport = new HatcheryReport();
