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
    const { customer, periods, flocks, generatedAt } = reportData;
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
