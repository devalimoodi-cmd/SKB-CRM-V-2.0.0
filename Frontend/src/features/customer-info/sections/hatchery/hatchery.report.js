// ================================================================
// hatchery.report.js - گزارش کامل جوجه‌ریزی
// ================================================================

import { hatcheryApi } from "./hatchery.api.js";
import { apiService } from "../../../../core/services/api.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  convertToPersianDate,
  formatDate,
} from "../../../../core/utils/date.utils.js";

class HatcheryReport {
  constructor() {
    this.customerId = null;
    this.customerData = null;
    this.periods = [];
    this.flocks = [];
    this.halls = [];
    this.dictionaries = {};
    this.completions = [];
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

  async generateFullReport() {
    try {
      // بارگذاری اطلاعات مشتری
      const customerRes = await apiService
        .get(`/customers/${this.customerId}`)
        .catch(() => null);

      // بارگذاری دیکشنری‌ها
      await this.loadDictionaries();

      // بارگذاری دوره‌ها
      await this.loadPeriods();

      // بارگذاری گله‌ها
      await this.loadFlocks();

      // بارگذاری سالن‌ها
      await this.loadHalls();

      this.customerData = customerRes?.data || null;

      // بارگذاری اطلاعات پایان دوره‌ها
      await this.loadCompletions();

      // تلفیق اطلاعات
      const flocksWithDetails = this.flocks.map((flock) => {
        const hall = this.halls.find((h) => h.id === flock.hall_id);
        const period = this.periods.find((p) => p.id === flock.period_id);
        const breed = this.dictionaries.breeds?.find(
          (b) => b.id === flock.breed_id,
        );
        const source = this.dictionaries.sources?.find(
          (s) => s.id === flock.chick_source_id,
        );
        return {
          ...flock,
          hall_name: hall?.hall_name || "-",
          hall_number: hall?.hall_number || "-",
          period_name: period?.period_name || "-",
          period_number: period?.period_number || "-",
          breed_name: breed?.name || "-",
          source_name: source?.name || "-",
        };
      });

      return {
        customer: this.customerData,
        periods: this.periods.filter(
          (p) => p.status !== "cancelled" && p.status !== "deleted",
        ),
        flocks: flocksWithDetails,
        completions: this.completions,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Error generating hatchery report:", error);
      throw error;
    }
  }

  async loadPeriods() {
    try {
      const res = await hatcheryApi.getPeriods(this.customerId);
      if (res.success) {
        this.periods = res.data.periods || [];
      }
    } catch (error) {
      console.error("❌ Error loading periods:", error);
    }
  }

  async loadFlocks() {
    try {
      const res = await hatcheryApi.getFlocks(this.customerId);
      if (res.success) {
        this.flocks = res.data.placements || [];
      }
    } catch (error) {
      console.error("❌ Error loading flocks:", error);
    }
  }

  async loadHalls() {
    try {
      const res = await hatcheryApi.getHalls(this.customerId);
      if (res.success) {
        this.halls = res.data || [];
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  }

  async loadCompletions() {
    try {
      const completions = [];
      const completedPeriods = this.periods.filter(
        (p) => p.status === "completed",
      );
      for (const period of completedPeriods) {
        try {
          const res = await hatcheryApi.getPeriodCompletions(period.id);
          if (res.success && Array.isArray(res.data)) {
            completions.push(...res.data);
          }
        } catch (e) {
          console.warn(
            `⚠️ Error loading completions for period ${period.id}:`,
            e,
          );
        }
      }
      this.completions = completions;
    } catch (error) {
      console.error("❌ Error loading completions:", error);
      this.completions = [];
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

  generateHTML(reportData) {
    const { customer, periods, flocks, completions, generatedAt } = reportData;
    // بخش اطلاعات پایان دوره‌ها — دو جدول: سیستمی + مرغدار
    let completionsHTML = "";
    if (completions && completions.length > 0) {
      // جدول اطلاعات سیستمی — محاسبه پویا برای همه رکوردها
      const systemRows = completions
        .map((c) => {
          const flock = c.flock || {};
          const hallName = flock.hall_name || `سالن ${c.hall_id || "-"}`;
          const initialChicks = parseInt(c.initial_chicks_count) || 0;
          const totalMortality = parseInt(c.total_mortality) || 0;
          const transportMortality = parseInt(c.transport_mortality) || 0;
          const systemMortality = Math.max(
            0,
            totalMortality - transportMortality,
          );
          const finalChicks = Math.max(0, initialChicks - totalMortality);
          const mortalityRate =
            initialChicks > 0
              ? ((totalMortality / initialChicks) * 100).toFixed(2)
              : "-";
          return `
            <tr>
              <td>گله ${flock.flock_number || "-"}</td>
              <td>${hallName}</td>
              <td>${convertToPersianDate(c.completion_date)}</td>
              <td>${initialChicks.toLocaleString() || "-"}</td>
              <td><strong>${finalChicks.toLocaleString()}</strong></td>
              <td>${systemMortality}</td>
              <td>${transportMortality}</td>
              <td><strong style="color:#dc2626;">${totalMortality}</strong></td>
              <td>${mortalityRate}٪</td>
              <td>${c.final_week_number ?? "-"}</td>
              <td>${c.slaughter_age_days ? c.slaughter_age_days + " روز" : "-"}</td>
              <td>${c.system_total_feed ?? c.total_feed_intake ?? "-"}</td>
              <td>${c.system_last_weight ?? c.final_avg_weight ?? "-"}</td>
              <td><strong>${c.system_fcr ?? "-"}</strong></td>
              <td>${c.total_sent ?? "-"}</td>
              <td>${c.total_live_weight ?? "-"}</td>
              <td>${c.avg_live_weight ?? "-"}</td>
              <td>${c.slaughter_date ? convertToPersianDate(c.slaughter_date) : "-"}</td>
              <td>${c.slaughterhouse_name || "-"}</td>
            </tr>
          `;
        })
        .join("");

      // جدول اطلاعات اعلامی مرغدار
      const farmerRows = completions
        .map((c) => {
          const flock = c.flock || {};
          const hallName = flock.hall_name || `سالن ${c.hall_id || "-"}`;
          return `
            <tr>
              <td>گله ${flock.flock_number || "-"}</td>
              <td>${hallName}</td>
              <td>${convertToPersianDate(c.completion_date)}</td>
              <td><strong>${c.farmer_fcr ?? "-"}</strong></td>
              <td>${c.slaughter_age_days ? c.slaughter_age_days + " روز" : "-"}</td>
              <td>${c.farmer_total_feed ?? "-"}</td>
              <td>${c.farmer_total_meat ?? "-"}</td>
              <td>${c.farmer_total_weight ?? "-"}</td>
              <td>${c.confirmed_by_customer ? "✅ تأیید شده" : "❌ تأیید نشده"}</td>
              <td>${c.completion_type === "completed" ? "تکمیل" : c.completion_type === "culled" ? "حذف" : "اضطراری"}</td>
              <td>${c.notes || "-"}</td>
            </tr>
          `;
        })
        .join("");

      completionsHTML = `
        <div class="report-section-full" style="margin-top:20px;">
          <h4>🏁 اطلاعات پایان دوره‌ها</h4>

          <div class="report-section" style="margin-bottom:10px;">
            <h4>💻 اطلاعات سیستمی (محاسبه‌شده از داده‌های سیستم)</h4>
            <div style="overflow-x:auto;">
              <table class="report-table" style="min-width:1400px;">
                <thead>
                  <tr>
                    <th>گله</th>
                    <th>سالن</th>
                    <th>تاریخ تکمیل</th>
                    <th>جوجه اولیه</th>
                    <th>جوجه نهایی</th>
                    <th>تلفات سیستم</th>
                    <th>تلفات حمل</th>
                    <th>تلفات کل</th>
                    <th>٪ تلفات</th>
                    <th>هفته آخر</th>
                    <th>سن کشتار</th>
                    <th>کل خوراک</th>
                    <th>آخرین وزن</th>
                    <th>FCR سیستمی</th>
                    <th>تعداد ارسالی</th>
                    <th>وزن کل کشتار</th>
                    <th>میانگین وزن</th>
                    <th>تاریخ کشتار</th>
                    <th>کشتارگاه</th>
                  </tr>
                </thead>
                <tbody>${systemRows}</tbody>
              </table>
            </div>
          </div>

          <div class="report-section" style="margin-top:10px;">
            <h4>👨‍🌾 اطلاعات اعلامی مرغدار</h4>
            <div style="overflow-x:auto;">
              <table class="report-table" style="min-width:950px;">
                <thead>
                  <tr>
                    <th>گله</th>
                    <th>سالن</th>
                    <th>تاریخ تکمیل</th>
                    <th>FCR مرغدار</th>
                    <th>سن کشتار</th>
                    <th>کل خوراک</th>
                    <th>کل گوشت</th>
                    <th>وزن کل</th>
                    <th>تأیید مرغدار</th>
                    <th>نوع پایان</th>
                    <th>توضیحات</th>
                  </tr>
                </thead>
                <tbody>${farmerRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }
    const now = new Date(generatedAt);
    const persianDate = formatDate(now);

    // دوره‌ها
    let periodsHTML = "";
    if (periods && periods.length > 0) {
      periodsHTML = `
        <div class="report-section-full">
          <h4>دوره‌های پرورش</h4>
          <table class="report-table">
            <thead>
              <tr>
                <th>شماره</th>
                <th>نام دوره</th>
                <th>تاریخ شروع</th>
                <th>تاریخ پایان</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              ${periods
                .map(
                  (p, i) => `
                <tr>
                  <td>${p.period_number || i + 1}</td>
                  <td>${p.period_name}</td>
                  <td>${convertToPersianDate(p.start_date)}</td>
                  <td>${p.end_date ? convertToPersianDate(p.end_date) : "در حال انجام"}</td>
                  <td><span class="status-tag ${this.getStatusClass(p.status)}">${this.getStatusText(p.status)}</span></td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>`;
    }

    // گله‌ها
    let flocksHTML = "";
    if (flocks && flocks.length > 0) {
      flocksHTML = flocks
        .map(
          (flock, i) => `
        <div class="report-flock">
          <div class="report-flock-header">
            <h3>${i + 1}. گله شماره ${flock.flock_number || i + 1}</h3>
          </div>
          <div class="report-two-col">
            <div class="report-col">
              <div class="report-section">
                <h4>اطلاعات پایه</h4>
                <table class="report-table compact">
                  <tr><td>سالن</td><td>${flock.hall_name} (شماره ${flock.hall_number || flock.hall_id})</td></tr>
                  <tr><td>دوره</td><td>${flock.period_name} (شماره ${flock.period_number || "-"})</td></tr>
                  <tr><td>تاریخ جوجه‌ریزی</td><td>${convertToPersianDate(flock.placement_date)}</td></tr>
                  <tr><td>نژاد جوجه</td><td>${flock.breed_name}</td></tr>
                  <tr><td>مبدا جوجه</td><td>${flock.source_name}</td></tr>
                </table>
              </div>
            </div>
            <div class="report-col">
              <div class="report-section">
                <h4>آمار</h4>
                <table class="report-table compact">
                  <tr><td>تعداد جوجه</td><td><strong>${(flock.total_chicks_count || 0).toLocaleString()}</strong> قطعه</td></tr>
                  <tr><td>سن در بدو ورود</td><td>${flock.chick_age_on_arrival || "-"} روز</td></tr>
                  <tr><td>وزن اولیه</td><td>${flock.avg_initial_weight || "-"} گرم</td></tr>
                  <tr><td>وضعیت</td><td><span class="status-tag ${flock.is_active ? "active" : "inactive"}">${flock.is_active ? "فعال" : "غیرفعال"}</span></td></tr>
                </table>
              </div>
            </div>
          </div>
        </div>`,
        )
        .join("");
    } else {
      flocksHTML =
        '<p style="text-align:center;color:#94a3b8;">هیچ گله‌ای ثبت نشده است</p>';
    }

    // آمار
    const totalPeriods = periods?.length || 0;
    const totalFlocks = flocks?.length || 0;
    const activeFlocks = flocks?.filter((f) => f.is_active).length || 0;
    const totalChicks =
      flocks?.reduce((s, f) => s + (parseInt(f.total_chicks_count) || 0), 0) ||
      0;

    const customerHTML = customer
      ? `
      <div class="report-customer-info">
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
        <p><strong>آدرس:</strong> ${customer.farm_address || "-"}</p>
      </div>`
      : "";

    return `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>گزارش کامل جوجه‌ریزی</title>
        <style>
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
          @media print { body { margin: 0.7cm; } }
          body {
            font-family: 'Vazir', 'Tahoma', sans-serif;
            direction: rtl;
            background: #fff;
            color: #1e293b;
            padding: 15px 20px;
            line-height: 1.6;
            font-size: 13px;
          }
          .report-header {
            text-align: center;
            padding-bottom: 15px;
            border-bottom: 3px solid #2c7a6e;
            margin-bottom: 25px;
          }
          .report-header h1 { color: #2c7a6e; font-size: 22px; margin: 0 0 5px; }
          .report-header .date { color: #94a3b8; font-size: 12px; }
          .report-customer-info {
            background: #f8fafc; padding: 12px 16px; border-radius: 8px;
            margin-bottom: 25px; border: 1px solid #eef2f6;
          }
          .customer-info-table { width: 100%; border-collapse: collapse; }
          .customer-info-table td { padding: 3px 8px; font-size: 13px; border: none; }

          .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 12px;
            margin-bottom: 25px;
          }
          .stat-box {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border: 1px solid #eef2f6; padding: 12px; text-align: center; border-radius: 8px;
          }
          .stat-box .stat-label { font-size: 11px; color: #64748b; }
          .stat-box .stat-value { font-size: 18px; font-weight: 700; color: #2c7a6e; margin-top: 4px; }

          .report-flock {
            margin-bottom: 20px; page-break-inside: avoid;
          }
          .report-flock-header h3 {
            background: #2c7a6e; color: white; padding: 7px 14px; border-radius: 8px;
            font-size: 14px; margin: 0 0 8px;
          }
          .report-two-col { display: flex; gap: 16px; margin-bottom: 6px; }
          .report-col { flex: 1; min-width: 0; }
          .report-section {
            margin: 6px 0; background: #fafbfc; border-radius: 6px;
            padding: 8px 10px; border: 1px solid #eef2f6;
          }
          .report-section-full {
            margin: 10px 0; background: #fafbfc; border-radius: 6px;
            padding: 10px 12px; border: 1px solid #eef2f6;
          }
          .report-section h4, .report-section-full h4 {
            color: #2c7a6e; font-size: 12px; margin: 0 0 6px;
            padding-bottom: 4px; border-bottom: 1px solid #eef2f6;
          }
          .report-table {
            width: 100%; border-collapse: collapse; font-size: 12px;
          }
          .report-table th {
            background: #2c7a6e; color: white; padding: 6px 10px;
            font-weight: 500; text-align: center;
          }
          .report-table td { padding: 5px 8px; border: 1px solid #eef2f6; }
          .report-table.compact td { border: none; border-bottom: 1px solid #f1f5f9; padding: 3px 6px; }
          .report-table.compact tr:last-child td { border-bottom: none; }
          .report-table.compact td:first-child { width: 110px; color: #64748b; font-weight: 500; }

          .status-tag {
            display: inline-block; padding: 2px 10px; border-radius: 10px;
            font-size: 11px; font-weight: 500;
          }
          .status-tag.active, .status-tag.pending { background: #dcfce7; color: #16a34a; }
          .status-tag.inactive { background: #fee2e2; color: #dc2626; }
          .status-tag.completed { background: #dbeafe; color: #2563eb; }

          .report-divider { border: none; border-top: 1px dashed #e2e8f0; margin: 16px 0; }
          .report-footer {
            text-align: center; color: #94a3b8; font-size: 11px;
            margin-top: 35px; padding-top: 15px; border-top: 1px solid #eef2f6;
          }

          @media print {
            .report-flock { page-break-inside: avoid; }
            .report-two-col { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>🐣 گزارش کامل جوجه‌ریزی</h1>
          <div class="date">تاریخ گزارش: ${persianDate}</div>
        </div>
        ${customerHTML}

        <div class="summary-stats">
          <div class="stat-box">
            <div class="stat-label">تعداد دوره‌ها</div>
            <div class="stat-value">${totalPeriods}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">تعداد گله‌ها</div>
            <div class="stat-value">${totalFlocks}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">گله‌های فعال</div>
            <div class="stat-value">${activeFlocks}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">مجموع جوجه‌ها</div>
            <div class="stat-value">${totalChicks.toLocaleString()}</div>
          </div>
        </div>

        ${periodsHTML}
        <hr class="report-divider">
        <h2 style="color:#2c7a6e; font-size:17px; margin-bottom:12px;">لیست گله‌ها</h2>
        ${flocksHTML}

        ${completionsHTML}

        <div class="report-footer">
          <p>این گزارش توسط سامانه مدیریت مشتریان (SKB-CRM) تولید شده است</p>
        </div>
        <script>
          window.onload = function() { window.print(); }
        <\/script>
      </body>
      </html>
    `;
  }

  getStatusText(status) {
    const map = {
      pending: "در انتظار جوجه",
      active: "فعال",
      completed: "تکمیل شده",
      cancelled: "لغو شده",
    };
    return map[status] || status;
  }

  getStatusClass(status) {
    const map = {
      pending: "pending",
      active: "active",
      completed: "completed",
    };
    return map[status] || "";
  }

  async generateAndPrint() {
    try {
      await this.init();
      const reportData = await this.generateFullReport();
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
}

export const hatcheryReport = new HatcheryReport();
