// ================================================================
// halls.report.js - گزارش کامل واحدها و سالن‌ها با جزئیات
// این نسخه بر اساس واحدهای مرغداری گروه‌بندی می‌شود
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
    this.unitsData = [];
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

      // بارگذاری واحدها
      await this.loadUnits();

      // بارگذاری دیکشنری‌ها
      await this.loadDictionaries();

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
        units: this.unitsData,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("❌ Error generating report:", error);
      throw error;
    }
  }

  async loadUnits() {
    try {
      const res = await hallsApi.getUnits(this.customerId);
      if (res.success) {
        this.unitsData = res.data.units || res.data || [];
      }
    } catch (error) {
      console.error("❌ Error loading units:", error);
      this.unitsData = [];
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

  sysItemsText(system, cat, isFan = false) {
    const items =
      (system && (system.HallSystemItems || system.items)) || [];
    const catItems = items.filter((i) => i.category === cat);
    if (!catItems.length) return "";
    return catItems
      .map((i) => {
        const qty = `×${i.quantity ?? 1}`;
        if (isFan) return `${i.spec || "فن بدون سایز"} ${qty}`;
        const name =
          cat === "heating"
            ? this.getDictName(
                i.type_id,
                this.dictionaries.heatingSystems || [],
              )
            : this.getDictName(
                i.type_id,
                this.dictionaries.coolingSystems || [],
              );
        return `${name} ${qty}`;
      })
      .join("، ");
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

  // نام واحد از لیست واحدها
  getUnitName(unitId) {
    if (!unitId) return "-";
    const unit = this.unitsData.find((u) => u.id == unitId);
    return unit ? unit.unit_name || `واحد ${unit.id}` : "-";
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
          heatingItemsText: this.sysItemsText(system, "heating"),
          coolingItemsText: this.sysItemsText(system, "cooling"),
          fanItemsText: this.sysItemsText(system, "fan", true),
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
          // نام واحد مرتبط با سالن
          unitName: this.getUnitName(hall.unit_id),
          // نام واحد مرتبط با گله فعال (اگر سالن unit_id نداشت)
          activeFlockUnitName: chickInfo
            ? this.getUnitName(chickInfo.unit_id)
            : "-",
          expertName: this.getExpertName(hall.service_expert_id),
          chickInfo,
        };
      }),
    );

    return hallsWithDetails;
  }

  // ===== رندر مشخصات کامل یک واحد =====

  renderUnitDetails(unit) {
    const statusName = unit.status?.name
      ? unit.status.name === "active"
        ? "فعال"
        : unit.status.name === "inactive"
          ? "غیرفعال"
          : unit.status.name
      : unit.is_active !== false
        ? "فعال"
        : "غیرفعال";

    const statusColor = unit.status?.color || null;

    const expertsHTML =
      unit.experts && unit.experts.length > 0
        ? unit.experts
            .filter((e) => e.is_active !== false)
            .map(
              (e) =>
                `<tr><td>کارشناس</td><td><strong>${e.expert_name || "-"}</strong>${e.expert_role ? ` (${e.expert_role})` : ""}${e.expert_phone ? ` — ${e.expert_phone}` : ""}</td></tr>`,
            )
            .join("")
        : '<tr><td>کارشناس</td><td style="color:#94a3b8;">ثبت نشده</td></tr>';

    return `
      <div class="unit-details-section">
        <div class="unit-details-title">
          <i class="fas fa-building"></i> مشخصات کامل واحد
        </div>
        <div class="unit-details-grid">
          <table class="report-table compact unit-details-table">
            <tr><td>نام واحد</td><td><strong>${unit.unit_name || "-"}</strong></td></tr>
            <tr><td>وضعیت</td><td>
              ${
                statusColor
                  ? `<span style="display:inline-block; padding:2px 10px; border-radius:10px; font-size:11px; font-weight:500; background:${statusColor}22; color:${statusColor};">${statusName}</span>`
                  : `<span class="badge ${unit.is_active !== false ? "bg-success" : "bg-secondary"}">${statusName}</span>`
              }
            </td></tr>
            <tr><td>آدرس</td><td>${unit.address || "-"}</td></tr>
            <tr><td>مختصات جغرافیایی</td><td>${unit.latitude ? unit.latitude : "-"} / ${unit.longitude ? unit.longitude : "-"}</td></tr>
            <tr><td>تعداد سالن‌ها</td><td>${unit.hall_count || "-"}</td></tr>
            <tr><td>ظرفیت کل</td><td>${unit.capacity ? parseInt(unit.capacity).toLocaleString() + " قطعه" : "-"}</td></tr>
            <tr><td>نام مدیر</td><td>${unit.manager_name || "-"}</td></tr>
            <tr><td>شماره مدیر</td><td dir="ltr" style="text-align:left;">${unit.manager_phone || "-"}</td></tr>
            ${expertsHTML}
          </table>
        </div>
      </div>
    `;
  }

  // ===== رندر یک سالن =====

  renderHallHTML(hall, index) {
    return `
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
                  <tr><td>نام واحد</td><td><strong>${hall.unitName || hall.activeFlockUnitName || "-"}</strong></td></tr>
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
                  ${hall.fanItemsText ? `<tr><td>فن‌ها (جزئیات سایز)</td><td>${hall.fanItemsText}</td></tr>` : ""}
                  <tr><td>ظرفیت فن‌ها</td><td>${hall.system.fan_capacity || "-"}</td></tr>
                  <tr><td>هیتر</td><td>${hall.system.heater_count || "-"} عدد</td></tr>
                  <tr><td>گرمایش</td><td>${hall.heatingName}</td></tr>
                  ${hall.heatingItemsText ? `<tr><td>گرمایش (جزئیات)</td><td>${hall.heatingItemsText}</td></tr>` : ""}
                  <tr><td>سرمایش</td><td>${hall.coolingName}</td></tr>
                  ${hall.coolingItemsText ? `<tr><td>سرمایش (جزئیات)</td><td>${hall.coolingItemsText}</td></tr>` : ""}
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
  }

  generateHTML(reportData) {
    const { customer, halls, units, generatedAt } = reportData;
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

    // ===== گروه‌بندی سالن‌ها بر اساس واحد =====
    const hallsWithoutUnit = halls.filter((h) => !h.unit_id);
    let unitSectionsHTML = "";

    // برای هر واحد، سالن‌های مربوطه را پیدا کن
    units.forEach((unit, unitIndex) => {
      const unitHalls = halls.filter((h) => h.unit_id == unit.id);
      if (unitHalls.length === 0) return; // واحد بدون سالن در گروه‌بندی اصلی نمایش داده نمی‌شود

      const activeCount = unitHalls.filter((h) => h.is_active).length;
      const totalCapacity = unitHalls.reduce(
        (sum, h) => sum + (parseInt(h.nominal_capacity) || 0),
        0,
      );
      const flockCount = unitHalls.filter((h) => h.chickInfo).length;
      const totalChicks = unitHalls.reduce(
        (sum, h) => sum + (parseInt(h.chickInfo?.total_chicks_count) || 0),
        0,
      );

      const hallsHTML = unitHalls
        .map((hall, i) => this.renderHallHTML(hall, i))
        .join("");

      unitSectionsHTML += `
        <div class="report-unit">
          <div class="report-unit-header">
            <div class="report-unit-title">
              <i class="fas fa-warehouse"></i>
              <span>${unit.unit_name || `واحد ${unit.id}`}</span>
              <span class="badge ${unit.is_active !== false ? "bg-success" : "bg-secondary"}">
                ${unit.is_active !== false ? "فعال" : "غیرفعال"}
              </span>
            </div>
            <div class="report-unit-stats">
              <span>${unitHalls.length} سالن</span>
              <span>${activeCount} فعال</span>
              <span>ظرفیت: ${totalCapacity.toLocaleString()}</span>
              <span>${flockCount} گله</span>
              <span>${totalChicks.toLocaleString()} جوجه</span>
            </div>
          </div>
          <div class="report-unit-body">
            ${this.renderUnitDetails(unit)}
            ${hallsHTML}
          </div>
        </div>
      `;
    });

    // سالن‌هایی که unit_id ندارند
    if (hallsWithoutUnit.length > 0) {
      const hallsHTML = hallsWithoutUnit
        .map((hall, i) => this.renderHallHTML(hall, i))
        .join("");

      unitSectionsHTML += `
        <div class="report-unit">
          <div class="report-unit-header">
            <div class="report-unit-title">
              <i class="fas fa-question-circle"></i>
              <span>سالن‌های بدون واحد</span>
            </div>
            <div class="report-unit-stats">
              <span>${hallsWithoutUnit.length} سالن</span>
            </div>
          </div>
          <div class="report-unit-body">
            ${hallsHTML}
          </div>
        </div>
      `;
    }

    // اگر هیچ واحدی نبود، همه سالن‌ها را مستقیم نمایش بده
    if (unitSectionsHTML === "") {
      unitSectionsHTML = halls
        .map((hall, i) => this.renderHallHTML(hall, i))
        .join("");
    }

    const totalCapacity = halls.reduce(
      (sum, h) => sum + (parseInt(h.nominal_capacity) || 0),
      0,
    );
    const activeHalls = halls.filter((h) => h.is_active).length;
    const hallsWithChick = halls.filter((h) => h.chickInfo).length;
    const unitsWithHalls = units.filter((u) =>
      halls.some((h) => h.unit_id == u.id),
    ).length;
    const totalChicks = halls.reduce(
      (sum, h) => sum + (parseInt(h.chickInfo?.total_chicks_count) || 0),
      0,
    );

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
        <title>گزارش کامل واحدها و سالن‌ها</title>
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
          .report-logo {
            display: block;
            height: 60px;
            width: auto;
            margin: 0 auto 10px;
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

          /* ===== بخش واحد ===== */
          .report-unit {
            margin-bottom: 30px;
            border: 1.5px solid #dbe7e3;
            border-radius: 12px;
            overflow: hidden;
            page-break-inside: avoid;
          }
          .report-unit-header {
            background: linear-gradient(135deg, #2c7a6e, #035552);
            color: white;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
          }
          .report-unit-title {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 16px;
            font-weight: 700;
          }
          .report-unit-title i { font-size: 18px; }
          .report-unit-stats {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            font-size: 11px;
          }
          .report-unit-stats span {
            background: rgba(255,255,255,0.15);
            padding: 3px 10px;
            border-radius: 12px;
            font-weight: 500;
          }
          .report-unit-body {
            padding: 14px;
            background: #fff;
          }

          /* ===== مشخصات کامل واحد ===== */
          .unit-details-section {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 16px;
          }
          .unit-details-title {
            color: #2c7a6e;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 6px;
            padding-bottom: 4px;
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .unit-details-table td:first-child {
            width: 140px;
          }
          .unit-details-grid {
            overflow-x: auto;
          }

          .badge {
            display: inline-block;
            padding: 1px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 500;
          }
          .bg-success { background: #10b981; color: white; }
          .bg-secondary { background: #94a3b8; color: white; }

          /* ===== بخش سالن ===== */
          .report-hall {
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .report-hall-header h3 {
            background: #e8f5f0;
            color: #2c7a6e;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 14px;
            margin: 0 0 10px;
            display: flex;
            align-items: center;
            gap: 10px;
            border-right: 4px solid #2c7a6e;
          }
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
            .report-unit { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <img class="report-logo" src="/assets/images/skb-logo.png" alt="لوگوی شرکت" onerror="this.style.display='none'">
          <h1>📋 گزارش کامل واحدها و سالن‌ها</h1>
          <div class="date">تاریخ گزارش: ${persianDate}</div>
        </div>
        ${customerHTML}

        <div class="summary-stats">
          <div class="stat-box">
            <div class="stat-label">تعداد واحدها</div>
            <div class="stat-value">${unitsWithHalls || units.length}</div>
          </div>
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
          <div class="stat-box">
            <div class="stat-label">مجموع جوجه‌ها</div>
            <div class="stat-value">${totalChicks.toLocaleString()}</div>
          </div>
        </div>

        ${unitSectionsHTML}

        <div class="report-footer">
          <p>
            📌 دریافت گزارش توسط: <strong>${reporterName}</strong> (${roleText}) |
            تاریخ: <strong>${reportDate}</strong> |
            ساعت: <strong>${reportTime}</strong>
          </p>
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
