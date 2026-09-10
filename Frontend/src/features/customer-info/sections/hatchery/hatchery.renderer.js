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

  // ===== رندر پنل وضعیت گله (دوره پرورش واحد) =====

  renderFlockPanel(unitName, flock, placements = []) {
    if (!flock) {
      return `
        <div class="flock-panel flock-empty">
          <div class="flock-panel-title"><i class="fas fa-egg"></i> وضعیت گله (دوره پرورش) — واحد:
            <b>${unitName || "—"}</b></div>
          <div class="flock-empty-text">
            <i class="fas fa-info-circle"></i>
            این واحد هم‌اکنون <b>گله فعال</b> ندارد. با ثبت جوجه‌ریزی اولین سالن، <b>گله جدید به‌صورت خودکار</b>
            ساخته می‌شود و سالن‌های بعدی همین واحد به همان گله اضافه می‌شوند.
          </div>
        </div>
      `;
    }

    const members = placements && placements.length ? placements : [];
    const hallRows = members
      .map((p) => {
        const hallName = p.hall?.hall_name || p.Hall?.hall_name || `سالن #${p.hall_id}`;
        const chicks = p.total_chicks_count
          ? formatNumber(parseInt(p.total_chicks_count))
          : "—";
        return `
          <div class="flock-hall ${p.is_active ? "" : "flock-hall-ended"}">
            <span class="flock-hall-name"><i class="fas fa-warehouse"></i> ${hallName}</span>
            <span class="flock-hall-chicks">${chicks} قطعه</span>
            <span class="flock-badge ${p.is_active ? "flock-badge-active" : "flock-badge-ended"}">
              ${p.is_active ? "در جریان" : "پایان یافته"}
            </span>
            ${p.is_active ? `<button type="button" class="flock-hall-sms" title="یادآوری پیامکی سالن" onclick="window.sendFlockSmsHall(${p.id})"><i class="fas fa-sms"></i></button>` : ""}
          </div>
        `;
      })
      .join("");

    return `
      <div class="flock-panel">
        <div class="flock-panel-title"><i class="fas fa-egg"></i> گله فعال واحد:
          <b>${unitName || "—"}</b></div>
        <div class="flock-meta">
          <div class="flock-meta-item">شماره گله: <b>${flock.flock_number}</b></div>
          <div class="flock-meta-item">تاریخ جوجه‌ریزی:
            <b>${flock.placement_date ? convertToPersianDate(flock.placement_date) : "—"}</b></div>
          <div class="flock-meta-item">سالن‌های عضو: <b>${members.length}</b></div>
          <button type="button" class="flock-bookmark-btn" onclick="window.addFlockBookmarkOf(${flock.id})">
            <i class="fas fa-bookmark"></i> بوکمارک گله
          </button>
          <button type="button" class="flock-sms-btn" onclick="window.sendFlockSmsFlock(${flock.id})">
            <i class="fas fa-sms"></i> پیامک گله
          </button>
          <button type="button" class="flock-sms-btn" onclick="window.showFlockSmsHistory()" title="تاریخچه پیامک‌های ارسالی مشتری">
            <i class="fas fa-clock-rotate-left"></i> تاریخچه پیامک
          </button>
          <button type="button" class="flock-end-btn" onclick="window.endActiveFlockOf(${flock.id})">
            <i class="fas fa-ban"></i> پایان گله
          </button>
          <button type="button" class="flock-bookmark-btn"
            style="background:#fef2f2; color:#b91c1c;"
            onclick="window.deleteFlockGroup(${flock.id})" title="حذف کامل گله">
            <i class="fas fa-trash-alt"></i> حذف گله
          </button>
        </div>
        <div class="flock-halls">
          ${hallRows || '<div class="flock-halls-empty">هنوز سالنی به این گله اضافه نشده است</div>'}
        </div>
        <div class="flock-note">
          <i class="fas fa-info-circle"></i>
          ثبت جوجه‌ریزی سالن آزاد همین واحد، به همین گله افزوده می‌شود.
        </div>
      </div>
    `;
  },

  // ===== رندر لیست سالن‌های قابل افزودن به همین گله =====

  renderExtraHallsList(halls, excludedHallId, defaultCount = "", defaultDate = "") {
    if (!halls || halls.length === 0) return "";
    return halls
      .map(
        (hall) => `
          <label class="flock-extra-item">
            <input type="checkbox" class="extra-hall-chk" data-hall="${hall.id}">
            <span class="flock-extra-name">${hall.hall_name} (شماره ${hall.hall_number || hall.id})</span>
            <span class="flock-extra-count">تعداد جوجه: <input type="number" min="1"
                class="extra-hall-count" data-hall="${hall.id}" value="${defaultCount || ""}"
                placeholder="مثل: ${defaultCount || "۱۰۰۰۰"}"></span>
            <span class="flock-extra-count">تاریخ جوجه‌ریزی: <input type="text"
                class="extra-hall-date" data-hall="${hall.id}" value="${defaultDate || ""}"
                placeholder="مثل: ۱۴۰۵/۰۶/۱۵" style="width:110px;"></span>
          </label>
        `,
      )
      .join("");
  },

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

  // ===== رندر جدول گله‌ها به‌صورت «سطح گله/دوره» (چند سالن = یک رکورد) =====

  renderFlockGroupsTable(groups) {
    if (!groups || groups.length === 0) {
      return '<tr><td colspan="8" style="text-align:center;">هیچ گله‌ای ثبت نشده است</td></tr>';
    }

    return groups
      .map((g) => {
        const statusText = g.is_active ? "فعال" : "غیرفعال";
        const statusClass = g.is_active ? "active" : "inactive";
        const primaryId = g.primaryId || g.id || 0;
        const groupId = g.flockId || null;
        const deleteFn = groupId
          ? `window.deleteFlockGroup(${groupId}, ${primaryId})`
          : `window.deleteFlock(${primaryId})`;
        const hasGroup = Boolean(groupId);
        const viewFn = hasGroup
          ? `viewFlockGroup(${groupId})`
          : `viewFlockDetails(${primaryId})`;
        const editFn = hasGroup
          ? `editFlockGroup(${groupId})`
          : `editFlock(${primaryId})`;
        const toggleFn = hasGroup
          ? `toggleFlockGroupStatus(${groupId})`
          : `toggleFlockStatus(${primaryId})`;
        const hallsText = g.hallNames || g.hall_name || "—";

        return `
                <tr>
                    <td>${g.period_number || "—"}</td>
                    <td title="${hallsText}">${hallsText}${
                      g.hallCount > 1
                        ? ` <small style="color:#94a3b8;">(${g.hallCount} سالن)</small>`
                        : ""
                    }</td>
                    <td>${g.placement_date ? convertToPersianDate(g.placement_date) : "—"}</td>
                    <td><strong>${g.flock_number ?? "—"}</strong></td>
                    <td>${g.breed_names || g.breed_name || "—"}</td>
                    <td>${(Number(g.total_chicks_count) || 0).toLocaleString()}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.${viewFn}" title="جزئیات کامل گله">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn ${g.is_active ? "disable" : "enable"}"
                                    onclick="window.${toggleFn}"
                                    title="${g.is_active ? "غیرفعال کردن کل گله" : "فعال کردن کل گله"}">
                                <i class="fas ${g.is_active ? "fa-toggle-on" : "fa-toggle-off"}"></i>
                            </button>
                            ${
                              hasGroup
                                ? `<button class="action-btn report-completion" onclick="window.printFlockCompletionReport(${groupId})" title="دریافت گزارش پایان دوره گله (چاپ)"><i class="fas fa-file-export"></i></button>`
                                : ""
                            }
                            ${
                              hasGroup
                                ? `<button class="action-btn report-sms" onclick="window.printFlockSmsReport(${groupId})" title="دریافت گزارش پیامک‌های ارسالی گله"><i class="fas fa-comment-sms"></i></button>`
                                : ""
                            }
                            ${
                              hasGroup && g.is_active
                                ? `<button class="action-btn complete" onclick="window.completeFlockOf(${groupId})" title="ثبت پایان گله / اطلاعات کشتار و محاسبات اقتصادی"><i class="fas fa-flag-checkered"></i></button>`
                                : ""
                            }
                            ${
                              hasGroup && !g.is_active
                                ? `<button class="action-btn completion-edit" onclick="window.editFlockCompletion(${groupId})" title="ویرایش / اصلاح اطلاعات پایان دوره گله"><i class="fas fa-pen-to-square"></i></button>`
                                : ""
                            }
                            <button class="action-btn edit" onclick="window.${editFn}" title="ویرایش کامل گله">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="${deleteFn}" title="حذف گله (همه سالن‌های عضو)">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
      })
      .join("");
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
