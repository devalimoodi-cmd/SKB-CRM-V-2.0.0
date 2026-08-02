// ✅ این رو جایگزین کنید
import { convertToPersianDate } from "../../../../core/utils/date.utils.js";
import { toNumber } from "../../../../core/utils/number.utils.js";

export const hallsRenderer = {
  // ===== رندر سلکت‌ها =====

  renderSelects(dictionaries) {
    // انواع سالن
    this.populateSelect(
      "hallType",
      dictionaries.hallTypes,
      "انتخاب نوع سالن...",
    );

    // انواع کفپوش
    this.populateSelect(
      "floorMaterial",
      dictionaries.floorTypes,
      "انتخاب جنس کف...",
    );

    // سیستم گرمایش
    this.populateSelect(
      "heatingType",
      dictionaries.heatingSystems,
      "انتخاب سیستم گرمایش...",
    );

    // سیستم سرمایش
    this.populateSelect(
      "coolingType",
      dictionaries.coolingSystems,
      "انتخاب سیستم سرمایش...",
    );

    // سیستم تهویه
    this.populateSelect(
      "ventilationType",
      dictionaries.ventilationTypes,
      "انتخاب سیستم تهویه...",
    );

    // سیستم ورودی بهداشتی
    this.populateSelect(
      "sanitarySystem",
      dictionaries.waterInletTypes,
      "انتخاب سیستم بهداشتی...",
    );

    // سیستم روشنایی
    this.populateSelect(
      "lighthingSystem",
      dictionaries.lightingSystems,
      "انتخاب سیستم روشنایی...",
    );

    // نوع آبخوری
    this.populateSelect(
      "waterType",
      dictionaries.watererTypes,
      "انتخاب نوع آبخوری...",
    );

    // نوع دانخوری
    this.populateSelect(
      "foodType",
      dictionaries.feederTypes,
      "انتخاب نوع دانخوری...",
    );

    // کارشناسان
    this.populateSelect("expert", dictionaries.experts, "انتخاب کارشناس...");
  },

  populateSelect(selectId, data, defaultText, isMultiple = false) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // اگر multiple است، تنظیمات خاص
    if (isMultiple) {
      select.multiple = true;
      select.size = 3;
    }

    const currentValue = select.value;
    select.innerHTML = `<option value="">${defaultText}</option>`;

    if (data && data.length > 0) {
      data.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name || item.title || item;
        select.appendChild(option);
      });
    }

    // بازگرداندن مقدار قبلی
    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  renderPeriods(periods) {
    const select = document.getElementById("PeriodNumber");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب دوره...</option>';

    if (periods && periods.length > 0) {
      periods.forEach((period) => {
        const option = document.createElement("option");
        option.value = period.id;
        const statusLabel =
          period.status === "pending" ? "【در انتظار جوجه】" : "";
        option.textContent = `دوره ${period.period_number || period.id} - ${period.period_name} ${statusLabel}`;
        select.appendChild(option);
      });
    } else {
      select.innerHTML = '<option value="">هیچ دوره فعالی یافت نشد</option>';
    }

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  populateHallSelect(select, halls) {
    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب سالن...</option>';

    if (halls && halls.length > 0) {
      halls.forEach((hall) => {
        const option = document.createElement("option");
        option.value = hall.id;
        option.textContent = `${hall.hall_name} (شماره ${hall.hall_number || hall.id})`;
        select.appendChild(option);
      });
    }

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  // ===== رندر لیست سالن‌ها =====

  renderHallsList(halls, dictionaries) {
    const container = document.getElementById("hallsListContainer");
    if (!container) return;

    if (!halls || halls.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-warehouse"></i>
                    <p>هیچ سالنی ثبت نشده است</p>
                </div>
            `;
      return;
    }

    let html = "";
    halls.forEach((hall, index) => {
      const statusClass = hall.is_active ? "active" : "inactive";
      const statusText = hall.is_active ? "فعال" : "غیرفعال";

      html += `
                <div class="hall-card" data-hall-id="${hall.id}">
                    <div class="hall-card-header" onclick="window.toggleHallCard(this)">
                        <h4>
                            <i class="fas fa-warehouse"></i>
                            ${hall.hall_name || "سالن بدون نام"}
                            <span class="hall-status-badge ${statusClass} ${hall.is_active ? "active" : "inactive"}" 
                                  onclick="event.stopPropagation(); window.toggleHallStatus(${hall.id}, ${!hall.is_active})"
                                  title="${hall.is_active ? "کلیک برای غیرفعال کردن" : "کلیک برای فعال کردن"}">
                                <i class="fas ${hall.is_active ? "fa-toggle-on" : "fa-toggle-off"}"></i> ${statusText}
                            </span>
                        </h4>
                        <i class="fas fa-chevron-down toggle-icon"></i>
                    </div>
                    <div class="hall-card-body">
                        ${this.renderHallInfo(hall, dictionaries)}
                        ${this.renderHallActions(hall.id)}
                    </div>
                </div>
            `;
    });

    container.innerHTML = html;
  },

  renderHallInfo(hall, dictionaries) {
    const getDictName = (id, dict) => {
      if (!id) return "-";
      const item = dict.find((d) => d.id == id);
      return item ? item.name : "-";
    };

    const periodName = hall.periodInfo?.period_name || "-";
    const floorType = getDictName(
      hall.physicalInfo?.floor_type_id,
      dictionaries.floorTypes,
    );
    const hallType = getDictName(hall.hall_type_id, dictionaries.hallTypes);

    // نام کارشناس از دیکشنری
    const getExpertName = (id) => {
      if (!id) return "-";
      const expert = dictionaries.experts?.find((e) => e.id == id);
      if (!expert) return "-";
      return (
        expert.name ||
        `${expert.first_name || ""} ${expert.last_name || ""}`.trim() ||
        expert.username ||
        "-"
      );
    };
    const expertName = getExpertName(hall.service_expert_id);

    // نام‌های واقعی سیستم‌ها از دیکشنری
    const heatingName = hall.systemInfo?.heating_system_id
      ? getDictName(
          hall.systemInfo.heating_system_id,
          dictionaries.heatingSystems || [],
        )
      : hall.systemInfo?.heating_system_name || "-";
    const coolingName = hall.systemInfo?.cooling_system_id
      ? getDictName(
          hall.systemInfo.cooling_system_id,
          dictionaries.coolingSystems || [],
        )
      : hall.systemInfo?.cooling_system_name || "-";
    const ventilationName = hall.systemInfo?.ventilation_system_id
      ? getDictName(
          hall.systemInfo.ventilation_system_id,
          dictionaries.ventilationTypes || [],
        )
      : hall.systemInfo?.ventilation_system_name || "-";
    const waterInletName = hall.systemInfo?.water_inlet_system_id
      ? getDictName(
          hall.systemInfo.water_inlet_system_id,
          dictionaries.waterInletTypes || [],
        )
      : hall.systemInfo?.water_inlet_system_name || "-";
    const lightingName = hall.systemInfo?.lighting_system_id
      ? getDictName(
          hall.systemInfo.lighting_system_id,
          dictionaries.lightingSystems || [],
        )
      : hall.systemInfo?.lighting_system_name || "-";

    // نام‌های واقعی آبخوری و دانخوری
    const watererName = hall.waterFeedInfo?.waterer_type_id
      ? getDictName(
          hall.waterFeedInfo.waterer_type_id,
          dictionaries.watererTypes || [],
        )
      : hall.waterFeedInfo?.waterer_type_name || "-";
    const feederName = hall.waterFeedInfo?.feeder_type_id
      ? getDictName(
          hall.waterFeedInfo.feeder_type_id,
          dictionaries.feederTypes || [],
        )
      : hall.waterFeedInfo?.feeder_type_name || "-";

    return `
            <div class="hall-detail-grid">
              <!-- اطلاعات پایه -->
              <div class="info-section">
                  <div class="info-section-title">
                      <i class="fas fa-info-circle"></i> اطلاعات پایه
                  </div>
                  <div class="hall-info-grid">
                      <div class="hall-info-item">
                          <span class="label">شماره سالن</span>
                          <span class="value">${hall.hall_number || "-"}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">ظرفیت اسمی</span>
                          <span class="value">${hall.nominal_capacity?.toLocaleString() || "-"} قطعه</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">ارتفاع از سطح دریا</span>
                          <span class="value">${hall.altitude_above_sea || "-"} متر</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">نوع سالن</span>
                          <span class="value">${hallType}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">سال ساخت</span>
                          <span class="value">${hall.construction_year || "-"}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">اپراتور</span>
                          <span class="value">${hall.operator_name || "-"}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">کارشناس خدمات</span>
                          <span class="value"><strong>${expertName}</strong></span>
                      </div>
                  </div>
              </div>


              <!-- اطلاعات فیزیکی -->
              ${
                hall.physicalInfo
                  ? `
              <div class="info-section">
                  <div class="info-section-title">
                      <i class="fas fa-ruler-combined"></i> ابعاد و کفپوش
                  </div>
                  <div class="hall-info-grid">
                      <div class="hall-info-item">
                          <span class="label">طول</span>
                          <span class="value">${hall.physicalInfo.length || "0"} متر</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">عرض</span>
                          <span class="value">${hall.physicalInfo.width || "0"} متر</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">ارتفاع</span>
                          <span class="value">${hall.physicalInfo.height || "0"} متر</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">مساحت</span>
                          <span class="value">${hall.physicalInfo.area || "0"} متر مربع</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">نوع کفپوش</span>
                          <span class="value">${floorType}</span>
                      </div>
                      ${
                        hall.physicalInfo.notes
                          ? `<div class="hall-info-item full-width">
                              <span class="label">توضیحات</span>
                              <span class="value">${hall.physicalInfo.notes}</span>
                            </div>`
                          : ""
                      }
                  </div>
              </div>`
                  : ""
              }

              <!-- اطلاعات سیستم‌ها -->
              ${
                hall.systemInfo
                  ? `
              <div class="info-section">
                  <div class="info-section-title">
                      <i class="fas fa-microchip"></i> سیستم‌ها
                  </div>
                  <div class="hall-info-grid">
                      <div class="hall-info-item">
                          <span class="label">فن‌ها</span>
                          <span class="value">${hall.systemInfo.fan_count || "-"} عدد (${hall.systemInfo.fan_size || "-"} اینچ)</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">ظرفیت فن‌ها</span>
                          <span class="value">${hall.systemInfo.fan_capacity || "-"}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">هیتر</span>
                          <span class="value">${hall.systemInfo.heater_count || "-"} عدد</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">گرمایش</span>
                          <span class="value">${heatingName}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">سرمایش</span>
                          <span class="value">${coolingName}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">تهویه</span>
                          <span class="value">${ventilationName}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">ورودی بهداشتی</span>
                          <span class="value">${waterInletName}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">روشنایی</span>
                          <span class="value">${lightingName}</span>
                      </div>
                      ${
                        hall.systemInfo.notes
                          ? `<div class="hall-info-item full-width">
                              <span class="label">توضیحات</span>
                              <span class="value">${hall.systemInfo.notes}</span>
                            </div>`
                          : ""
                      }
                  </div>
              </div>`
                  : ""
              }

              <!-- اطلاعات آبخوری و دانخوری -->
              ${
                hall.waterFeedInfo
                  ? `
              <div class="info-section">
                  <div class="info-section-title">
                      <i class="fas fa-tint"></i> آبخوری و دانخوری
                  </div>
                  <div class="hall-info-grid">
                      <div class="hall-info-item">
                          <span class="label">نوع آبخوری</span>
                          <span class="value">${watererName}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">نوع دانخوری</span>
                          <span class="value">${feederName}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">خطوط آبخوری</span>
                          <span class="value">${hall.waterFeedInfo.water_lines_count || "-"}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">خطوط دانخوری</span>
                          <span class="value">${hall.waterFeedInfo.feed_lines_count || "-"}</span>
                      </div>
                      <div class="hall-info-item">
                          <span class="label">دان دهی اتوماتیک</span>
                          <span class="value">${hall.waterFeedInfo.auto_feed_system ? "دارد" : "ندارد"}</span>
                      </div>
                      ${
                        hall.waterFeedInfo.notes
                          ? `<div class="hall-info-item full-width">
                              <span class="label">توضیحات</span>
                              <span class="value">${hall.waterFeedInfo.notes}</span>
                            </div>`
                          : ""
                      }
                  </div>
              </div>`
                  : ""
              }
            </div>
        `;
  },

  renderHallActions(hallId) {
    return `
            <div class="hall-actions">
                <button class="btn-edit-hall" onclick="window.editHall(${hallId})">
                    <i class="fas fa-edit"></i> ویرایش سالن
                </button>
                <button class="btn-delete-hall" onclick="window.deleteHallRecord(${hallId})">
                    <i class="fas fa-trash-alt"></i> حذف سالن
                </button>
            </div>
        `;
  },

  getPeriodStatusText(status) {
    const map = {
      pending: "در انتظار جوجه",
      active: "فعال",
      completed: "تکمیل شده",
      cancelled: "لغو شده",
    };
    return map[status] || status;
  },
};
