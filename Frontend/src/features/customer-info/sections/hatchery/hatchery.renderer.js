import {
  convertToPersianDate,
  formatNumber,
} from "../../../../core/utils/date.utils.js";

export const hatcheryRenderer = {
  // ===== رندر سلکت‌ها =====

  renderSelects(dictionaries) {
    // مبدا جوجه
    this.populateSelect(
      "skb-chick-source",
      dictionaries.sources,
      "انتخاب مبدا جوجه...",
    );

    // نژاد جوجه
    this.populateSelect(
      "skb-chick-breed",
      dictionaries.breeds,
      "انتخاب نژاد جوجه...",
    );
  },

  populateSelect(selectId, data, defaultText) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = `<option value="">${defaultText}</option>`;

    if (data && data.length > 0) {
      data.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name || item.title;
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

  renderPeriods(periods) {
    // دوره‌های فعال و در انتظار برای تب ثبت جوجه‌ریزی
    const activePeriods = periods.filter(
      (p) => p.status === "active" || p.status === "pending",
    );
    const select = document.getElementById("skb-period-select");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب دوره...</option>';

    if (activePeriods.length === 0) {
      select.innerHTML = '<option value="">هیچ دوره فعالی یافت نشد</option>';
      return;
    }

    activePeriods.forEach((period) => {
      const option = document.createElement("option");
      option.value = period.id;
      const statusLabel =
        period.status === "pending" ? "【در انتظار جوجه】" : "";
      option.textContent = `دوره ${period.period_number || period.id} - ${period.period_name} ${statusLabel}`;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  renderHallSelects(halls, flocks = null) {
    const select = document.getElementById("skb-hall-select");
    if (!select) return;

    const currentValue = select.value;

    // اگر flocks داده شده، سالن‌هایی که گله فعال ندارند رو فیلتر کن
    let availableHalls = halls;
    if (flocks && flocks.length > 0) {
      const hallIdsWithActiveFlocks = new Set(
        flocks.filter((f) => f.is_active === true).map((f) => f.hall_id),
      );
      availableHalls = halls.filter((h) => !hallIdsWithActiveFlocks.has(h.id));
    } else {
      // اگر flocks نداریم، همه سالن‌های فعال رو نمایش بده
      availableHalls = halls.filter((h) => h.is_active === true);
    }

    select.innerHTML = '<option value="">انتخاب سالن...</option>';

    if (availableHalls.length === 0) {
      select.innerHTML =
        '<option value="">همه سالن‌ها دارای گله فعال هستند</option>';
      if (currentValue) select.value = currentValue;
      return;
    }

    availableHalls.forEach((hall) => {
      const option = document.createElement("option");
      option.value = hall.id;
      option.textContent = `${hall.hall_name} (شماره ${hall.hall_number || hall.id})`;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  renderHygieneHallSelects(halls) {
    const select = document.getElementById("chickHealthHallNumber");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">انتخاب سالن...</option>';

    // فقط سالن‌های فعال
    const activeHalls = halls.filter((h) => h.is_active === true);

    if (activeHalls.length === 0) {
      select.innerHTML = '<option value="">هیچ سالن فعالی یافت نشد</option>';
      return;
    }

    activeHalls.forEach((hall) => {
      const option = document.createElement("option");
      option.value = hall.id;
      option.textContent = `${hall.hall_name} (شماره ${hall.hall_number || hall.id})`;
      select.appendChild(option);
    });

    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  },

  // ===== رندر جدول دوره‌ها =====

  renderPeriodsTable(periods) {
    if (!periods || periods.length === 0) {
      return '<tr><td colspan="8" style="text-align: center;">هیچ دوره‌ای ثبت نشده است</td></tr>';
    }

    let html = "";
    periods.forEach((period, index) => {
      const statusText = this.getPeriodStatusText(period.status);
      const statusClass = this.getPeriodStatusClass(period.status);
      const density =
        period.density !== "-" ? `${period.density} قطعه/مترمربع` : "-";

      html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${period.period_number || period.id}</td>
                    <td>${period.period_name}</td>
                    <td>${convertToPersianDate(period.start_date)}</td>
                    <td>${period.end_date ? convertToPersianDate(period.end_date) : "در حال انجام"}</td>
                    <td class="text-center">${density}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewPeriod(${period.id})" title="مشاهده">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn edit" onclick="window.editPeriod(${period.id})" title="ویرایش">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${
                              period.status !== "completed"
                                ? `<button class="action-btn complete" onclick="window.completePeriod(${period.id})" title="اتمام دوره">
                                <i class="fas fa-flag-checkered"></i>
                            </button>`
                                : `<button class="action-btn view" onclick="window.viewPeriodCompletion(${period.id})" title="مشاهده اطلاعات پایان دوره">
                                <i class="fas fa-file-alt"></i>
                            </button>
                            <button class="action-btn edit" onclick="window.editPeriodCompletion(${period.id})" title="ویرایش اطلاعات پایان دوره">
                                <i class="fas fa-pen"></i>
                            </button>`
                            }
                            <button class="action-btn delete" onclick="window.deletePeriod(${period.id})" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    return html;
  },

  // ===== رندر جدول گله‌ها =====

  renderFlocksTable(flocks) {
    if (!flocks || flocks.length === 0) {
      return '<tr><td colspan="8" style="text-align: center;">هیچ گله‌ای ثبت نشده است</td></tr>';
    }

    let html = "";
    flocks.forEach((flock) => {
      const statusText = flock.is_active ? "فعال" : "غیرفعال";
      const statusClass = flock.is_active ? "active" : "inactive";

      html += `
                <tr>
                    <td>${flock.period_number || "-"}</td>
                    <td>${flock.hall_name}</td>
                    <td>${convertToPersianDate(flock.placement_date)}</td>
                    <td><strong>${flock.flock_number}</strong></td>
                    <td>${flock.breed_name}</td>
                    <td>${flock.total_chicks_count?.toLocaleString() || "-"}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewFlockDetails(${flock.id})" title="جزئیات">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn ${flock.is_active ? "disable" : "enable"}" 
                                    onclick="window.toggleFlockStatus(${flock.id})" 
                                    title="${flock.is_active ? "غیرفعال کردن" : "فعال کردن"}">
                                <i class="fas ${flock.is_active ? "fa-toggle-on" : "fa-toggle-off"}"></i>
                            </button>
                            <button class="action-btn edit" onclick="window.editFlock(${flock.id})" title="ویرایش">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="window.deleteFlock(${flock.id})" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    return html;
  },

  // ===== رندر تاریخچه بهداشت =====

  renderHygieneHistory(records) {
    if (!records || records.length === 0) {
      return '<tr><td colspan="7" style="text-align: center;">هیچ رکورد بهداشتی ثبت نشده است</td></tr>';
    }

    let html = "";
    records.forEach((record, index) => {
      html += `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${record.hall_name}</strong></td>
                    <td>${record.last_wash_date ? convertToPersianDate(record.last_wash_date) : "-"}</td>
                    <td>${record.last_disinfect_date ? convertToPersianDate(record.last_disinfect_date) : "-"}</td>
                    <td>${record.disinfectant_type || "-"}</td>
                    <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${record.description || "-"}
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewHygieneRecord(${record.id}, ${record.hall_id})" title="مشاهده">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn edit" onclick="window.editHygieneRecord(${record.id}, ${record.hall_id})" title="ویرایش">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="window.deleteHygieneRecord(${record.id})" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    return html;
  },

  // ===== توابع کمکی =====

  getPeriodStatusText(status) {
    const map = {
      pending: "در انتظار جوجه",
      active: "فعال",
      completed: "تکمیل شده",
      cancelled: "لغو شده",
    };
    return map[status] || status;
  },

  getPeriodStatusClass(status) {
    const map = {
      pending: "success",
      active: "success",
      completed: "info",
      cancelled: "danger",
    };
    return map[status] || "secondary";
  },
};
