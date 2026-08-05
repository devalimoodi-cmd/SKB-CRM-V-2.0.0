// ================================================================
// halls.report.js - گزارش کامل سالن‌ها با جزئیات
// ================================================================

import { hallsApi } from "./halls.api.js";
import { apiService } from "../../../../core/services/api.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  convertToPersianDate,
  formatDate,
} from "../../../../core/utils/date.utils.js";

class HallsReport {
  constructor() {
    this.customerId = null;
    this.customerData = null;
    this.hallsData = [];
    this.periodsData = [];
    this.chickPlacementsData = [];
    this.expertsData = [];
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

      // بارگذاری سالن‌ها
      const hallsRes = await hallsApi.getHalls(this.customerId);
      if (!hallsRes.success) throw new Error("خطا در دریافت سالن‌ها");

      // بارگذاری دیکشنری‌ها
      await this.loadDictionaries();

      // بارگذاری دوره‌ها
      await this.loadPeriods();

      // بارگذاری جوجه‌ریزی‌ها
      await this.loadChickPlacements();

      // بارگذاری کارشناسان
      await this.loadExperts();

      const halls = hallsRes.data || [];
      const hallsWithDetails = await this.loadHallsDetails(halls);

      this.customerData = customerRes?.data || null;
      this.hallsData = hallsWithDetails;

      return {
        customer: this.customerData,
        halls: hallsWithDetails,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Error generating report:", error);
      throw error;
    }
  }

  async loadPeriods() {
    try {
      const res = await hallsApi.getPeriods(this.customerId);
      if (res.success) {
        this.periodsData = res.data.periods || [];
      }
    } catch (error) {
      console.error("❌ Error loading periods:", error);
    }
  }

  async loadChickPlacements() {
    try {
      const res = await apiService.get("/chick-placements", {
        customer_id: this.customerId,
      });
      if (res.success) {
        this.chickPlacementsData = res.data.placements || [];
      }
    } catch (error) {
      console.error("❌ Error loading chick placements:", error);
    }
  }

  async loadExperts() {
    try {
      const res = await hallsApi.getExperts();
      if (res.success) {
        this.expertsData = res.data || [];
      }
    } catch (error) {
      console.error("❌ Error loading experts:", error);
    }
  }

  async loadDictionaries() {
    try {
      const [
        hallTypes,
        floorTypes,
        heatingSystems,
        coolingSystems,
        ventilationTypes,
        waterInletTypes,
        lightingSystems,
        watererTypes,
        feederTypes,
        chickenBreeds,
        chickSources,
      ] = await Promise.all([
        hallsApi.getHallTypes(),
        hallsApi.getFloorTypes(),
        hallsApi.getHeatingSystems(),
        hallsApi.getCoolingSystems(),
        hallsApi.getVentilationTypes(),
        hallsApi.getWaterInletTypes(),
        hallsApi.getLightingSystems(),
        hallsApi.getWatererTypes(),
        hallsApi.getFeederTypes(),
        hallsApi.getChickenBreeds
          ? hallsApi.getChickenBreeds()
          : Promise.resolve({ success: false, data: [] }),
        hallsApi.getChickSources
          ? hallsApi.getChickSources()
          : Promise.resolve({ success: false, data: [] }),
      ]);

      this.dictionaries = {
        hallTypes: hallTypes.success ? hallTypes.data : [],
        floorTypes: floorTypes.success ? floorTypes.data : [],
        heatingSystems: heatingSystems.success ? heatingSystems.data : [],
        coolingSystems: coolingSystems.success ? coolingSystems.data : [],
        ventilationTypes: ventilationTypes.success ? ventilationTypes.data : [],
        waterInletTypes: waterInletTypes.success ? waterInletTypes.data : [],
        lightingSystems: lightingSystems.success ? lightingSystems.data : [],
        watererTypes: watererTypes.success ? watererTypes.data : [],
        feederTypes: feederTypes.success ? feederTypes.data : [],
        chickenBreeds: chickenBreeds.success ? chickenBreeds.data : [],
        chickSources: chickSources.success ? chickSources.data : [],
      };
    } catch (error) {
      console.error("❌ Error loading dictionaries:", error);
    }
  }

  getDictName(id, dict) {
    if (!id) return "-";
    const item = dict.find((d) => d.id == id);
    return item ? item.name || "-" : "-";
  }

  getExpertName(id) {
    if (!id) return "-";
    const expert = this.expertsData.find((e) => e.id == id);
    if (!expert) return "-";
    return (
      expert.name ||
      `${expert.first_name || ""} ${expert.last_name || ""}`.trim() ||
      expert.username ||
      "-"
    );
  }

  getPeriodName(id) {
    if (!id) return "-";
    const period = this.periodsData.find((p) => p.id == id);
    return period
      ? `دوره ${period.period_number} - ${period.period_name}`
      : "-";
  }

  getBreedName(id) {
    if (!id) return "-";
    const breed = this.dictionaries.chickenBreeds?.find((b) => b.id == id);
    return breed ? breed.name || breed.code || "-" : "-";
  }

  getSourceName(id) {
    if (!id) return "-";
    const source = this.dictionaries.chickSources?.find((s) => s.id == id);
    return source ? source.name || "-" : "-";
  }

  async loadHallsDetails(halls) {
    const getChickInfo = (hallId) => {
      // پیدا کردن گله فعال برای این سالن (اولویت با گله فعال)
      const activeFlock = this.chickPlacementsData.find(
        (p) => p.hall_id == hallId && p.is_active === true,
      );
      if (activeFlock) return activeFlock;

      // اگر گله فعال نبود، آخرین گله را برگردان
      const placements = this.chickPlacementsData
        .filter((p) => p.hall_id == hallId)
        .sort(
          (a, b) => new Date(b.placement_date) - new Date(a.placement_date),
        );
      return placements.length > 0 ? placements[0] : null;
    };

    const hallsWithDetails = await Promise.all(
      halls.map(async (hall) => {
        const [physicalInfo, systemInfo, waterFeedInfo] = await Promise.all([
          hallsApi.getPhysicalInfo(hall.id).catch(() => ({ success: false })),
          hallsApi.getSystemInfo(hall.id).catch(() => ({ success: false })),
          hallsApi.getWaterFeedInfo(hall.id).catch(() => ({ success: false })),
        ]);

        const physical = physicalInfo.success ? physicalInfo.data : null;
        const system = systemInfo.success ? systemInfo.data : null;
        const waterFeed = waterFeedInfo.success ? waterFeedInfo.data : null;

        // محاسبه مساحت و تراکم
        const area = physical?.area
          ? parseFloat(physical.area)
          : physical?.length && physical?.width
            ? parseFloat(physical.length) * parseFloat(physical.width)
            : null;

        const chickInfo = getChickInfo(hall.id);
        const density =
          chickInfo?.total_chicks_count && area
            ? (parseInt(chickInfo.total_chicks_count) / area).toFixed(2)
            : null;

        return {
          ...hall,
          physical,
          system,
          waterFeed,
          area: area ? area.toFixed(2) : null,
          density,
          hallTypeName: this.getDictName(
            hall.hall_type_id,
            this.dictionaries.hallTypes,
          ),
          floorTypeName: physical
            ? this.getDictName(
                physical.floor_type_id,
                this.dictionaries.floorTypes,
              )
            : "-",
          heatingName: system
            ? this.getDictName(
                system.heating_system_id,
                this.dictionaries.heatingSystems,
              )
            : "-",
          coolingName: system
            ? this.getDictName(
                system.cooling_system_id,
                this.dictionaries.coolingSystems,
              )
            : "-",
          ventilationName: system
            ? this.getDictName(
                system.ventilation_system_id,
                this.dictionaries.ventilationTypes,
              )
            : "-",
          waterInletName: system
            ? this.getDictName(
                system.water_inlet_system_id,
                this.dictionaries.waterInletTypes,
              )
            : "-",
          lightingName: system
            ? this.getDictName(
                system.lighting_system_id,
                this.dictionaries.lightingSystems,
              )
            : "-",
          watererName: waterFeed
            ? this.getDictName(
                waterFeed.waterer_type_id,
                this.dictionaries.watererTypes,
              )
            : "-",
          feederName: waterFeed
            ? this.getDictName(
                waterFeed.feeder_type_id,
                this.dictionaries.feederTypes,
              )
            : "-",
          // دوره مرتبط با گله فعال (نه دوره قدیمی سالن)
          activeFlockPeriodName: chickInfo
            ? this.getPeriodName(chickInfo.period_id)
            : "-",
          expertName: this.getExpertName(hall.service_expert_id),
          chickInfo,
        };
      }),
    );

    return hallsWithDetails;
  }

  generateHTML(reportData) {
    const { customer, halls, generatedAt } = reportData;
    const now = new Date(generatedAt);
    const persianDate = formatDate(now);

    let hallsHTML = "";

    halls.forEach((hall, index) => {
      hallsHTML += `
        <div class="report-hall">
          <div class="report-hall-header">
            <h3>${index + 1}. ${hall.hall_name || "سالن بدون نام"} 
                <span class="badge ${hall.is_active ? "bg-success" : "bg-secondary"}">
                  ${hall.is_active ? "فعال" : "غیرفعال"}
                </span>
            </h3>
          </div>

          <div class="report-two-col">
            <div class="report-col">
              <div class="report-section">
                <h4>اطلاعات پایه</h4>
                <table class="report-table compact">
                  <tr><td>شماره سالن</td><td>${hall.hall_number || "-"}</td></tr>
                  <tr><td>ظرفیت اسمی</td><td>${hall.nominal_capacity?.toLocaleString() || "-"} قطعه</td></tr>
                  <tr><td>ارتفاع از سطح دریا</td><td>${hall.altitude_above_sea || "-"} متر</td></tr>
                  <tr><td>نوع سالن</td><td>${hall.hallTypeName}</td></tr>
                  <tr><td>سال ساخت</td><td>${hall.construction_year || "-"}</td></tr>
                  <tr><td>اپراتور</td><td>${hall.operator_name || "-"}</td></tr>
                  <tr><td>مساحت</td><td>${hall.area ? hall.area + " متر مربع" : "-"}</td></tr>
                </table>
              </div>
            </div>
            <div class="report-col">
              <div class="report-section">
                <h4>دوره و گله</h4>
                <table class="report-table compact">
                  <tr><td>دوره (فعال)</td><td>${hall.activeFlockPeriodName || "-"}</td></tr>
                  <tr><td>کارشناس خدمات</td><td><strong>${hall.expertName}</strong></td></tr>
                  ${
                    hall.chickInfo
                      ? `
                  <tr><td>نژاد جوجه</td><td>${this.getBreedName(hall.chickInfo.breed_id)}</td></tr>
                  <tr><td>مبدا جوجه</td><td>${this.getSourceName(hall.chickInfo.chick_source_id)}</td></tr>
                  <tr><td>تعداد جوجه</td><td>${parseInt(hall.chickInfo.total_chicks_count || 0).toLocaleString()} قطعه</td></tr>
                  <tr><td>تاریخ جوجه‌ریزی</td><td>${hall.chickInfo.placement_date ? convertToPersianDate(hall.chickInfo.placement_date) : "-"}</td></tr>
                  <tr><td>وزن اولیه</td><td>${hall.chickInfo.avg_initial_weight || "-"} گرم</td></tr>
                  ${
                    hall.density
                      ? `<tr><td>تراکم فعلی</td><td><strong>${hall.density}</strong> قطعه/مترمربع</td></tr>`
                      : ""
                  }
                  `
                      : '<tr><td colspan="2" style="text-align:center; color:#94a3b8;">بدون جوجه‌ریزی</td></tr>'
                  }
                </table>
              </div>
            </div>
          </div>

          <div class="report-two-col">
            <div class="report-col">
              ${
                hall.physical
                  ? `
              <div class="report-section">
                <h4>ابعاد و کفپوش</h4>
                <table class="report-table compact">
                  <tr><td>طول</td><td>${hall.physical.length || "-"} متر</td></tr>
                  <tr><td>عرض</td><td>${hall.physical.width || "-"} متر</td></tr>
                  <tr><td>ارتفاع</td><td>${hall.physical.height || "-"} متر</td></tr>
                  <tr><td>نوع کفپوش</td><td>${hall.floorTypeName}</td></tr>
                  ${hall.physical.notes ? `<tr><td>توضیحات</td><td>${hall.physical.notes}</td></tr>` : ""}
                </table>
              </div>`
                  : ""
              }
            </div>
            <div class="report-col">
              ${
                hall.system
                  ? `
              <div class="report-section">
                <h4>سیستم‌ها</h4>
                <table class="report-table compact">
                  <tr><td>فن‌ها</td><td>${hall.system.fan_count || "-"} عدد (${hall.system.fan_size || "-"} اینچ)</td></tr>
                  <tr><td>ظرفیت فن‌ها</td><td>${hall.system.fan_capacity || "-"}</td></tr>
                  <tr><td>هیتر</td><td>${hall.system.heater_count || "-"} عدد</td></tr>
                  <tr><td>گرمایش</td><td>${hall.heatingName}</td></tr>
                  <tr><td>سرمایش</td><td>${hall.coolingName}</td></tr>
                  <tr><td>تهویه</td><td>${hall.ventilationName}</td></tr>
                  <tr><td>روشنایی</td><td>${hall.lightingName}</td></tr>
                </table>
              </div>`
                  : ""
              }
              ${
                hall.waterFeed
                  ? `
              <div class="report-section">
                <h4>آبخوری و دانخوری</h4>
                <table class="report-table compact">
                  <tr><td>نوع آبخوری</td><td>${hall.watererName}</td></tr>
                  <tr><td>نوع دانخوری</td><td>${hall.feederName}</td></tr>
                  <tr><td>خطوط آبخوری</td><td>${hall.waterFeed.water_lines_count || "-"}</td></tr>
                  <tr><td>خطوط دانخوری</td><td>${hall.waterFeed.feed_lines_count || "-"}</td></tr>
                  <tr><td>دان دهی اتوماتیک</td><td>${hall.waterFeed.auto_feed_system ? "دارد" : "ندارد"}</td></tr>
                </table>
              </div>`
                  : ""
              }
            </div>
          </div>
        </div>
        <hr class="report-divider">
      `;
    });

    const totalCapacity = halls.reduce(
      (sum, h) => sum + (parseInt(h.nominal_capacity) || 0),
      0,
    );
    const activeHalls = halls.filter((h) => h.is_active).length;
    const hallsWithChick = halls.filter((h) => h.chickInfo).length;

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
        <title>گزارش کامل سالن‌ها</title>
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
          .report-header h1 {
            color: #2c7a6e;
            font-size: 22px;
            margin: 0 0 5px;
          }
          .report-header .date {
            color: #94a3b8;
            font-size: 12px;
          }
          .report-customer-info {
            background: #f8fafc;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 25px;
            border: 1px solid #eef2f6;
          }
          .customer-info-table { width: 100%; border-collapse: collapse; }
          .customer-info-table td { padding: 3px 8px; font-size: 13px; border: none; }
          .report-customer-info p { margin: 3px 8px; font-size: 13px; }
          .report-hall {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .report-hall-header h3 {
            background: #2c7a6e;
            color: white;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 15px;
            margin: 0 0 10px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .badge {
            display: inline-block;
            padding: 1px 8px;
            border-radius: 10px;
            font-size: 10px;
          }
          .bg-success { background: #10b981; color: white; }
          .bg-secondary { background: #94a3b8; color: white; }

          .report-two-col {
            display: flex;
            gap: 16px;
            margin-bottom: 6px;
          }
          .report-col {
            flex: 1;
            min-width: 0;
          }

          .report-section {
            margin: 8px 0;
            background: #fafbfc;
            border-radius: 6px;
            padding: 8px 10px;
            border: 1px solid #eef2f6;
          }
          .report-section h4 {
            color: #2c7a6e;
            font-size: 12px;
            margin: 0 0 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #eef2f6;
          }
          .report-table.compact {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          .report-table.compact td {
            padding: 3px 6px;
            border: none;
            border-bottom: 1px solid #f1f5f9;
          }
          .report-table.compact tr:last-child td {
            border-bottom: none;
          }
          .report-table.compact td:first-child {
            width: 130px;
            color: #64748b;
            font-weight: 500;
          }
          .report-divider {
            border: none;
            border-top: 1px dashed #e2e8f0;
            margin: 16px 0;
          }
          .report-footer {
            text-align: center;
            color: #94a3b8;
            font-size: 11px;
            margin-top: 35px;
            padding-top: 15px;
            border-top: 1px solid #eef2f6;
          }

          /* summary cards */
          .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 12px;
            margin-bottom: 25px;
          }
          .stat-box {
            background: linear-gradient(135deg, #f8fafc, #f1f5f9);
            border: 1px solid #eef2f6;
            padding: 12px;
            text-align: center;
            border-radius: 8px;
          }
          .stat-box .stat-label {
            font-size: 11px;
            color: #64748b;
          }
          .stat-box .stat-value {
            font-size: 18px;
            font-weight: 700;
            color: #2c7a6e;
            margin-top: 4px;
          }

          @media print {
            .report-two-col { page-break-inside: avoid; }
            .report-hall { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>📋 گزارش کامل سالن‌ها</h1>
          <div class="date">تاریخ گزارش: ${persianDate}</div>
        </div>
        ${customerHTML}

        <div class="summary-stats">
          <div class="stat-box">
            <div class="stat-label">تعداد سالن‌ها</div>
            <div class="stat-value">${halls.length}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">سالن‌های فعال</div>
            <div class="stat-value">${activeHalls}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">ظرفیت کل</div>
            <div class="stat-value">${totalCapacity.toLocaleString()}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">سالن دارای گله</div>
            <div class="stat-value">${hallsWithChick}</div>
          </div>
        </div>

        ${hallsHTML}

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
      console.error("❌ Error generating report:", error);
      alert("خطا در تولید گزارش: " + error.message);
    }
  }
}

export const hallsReport = new HallsReport();
