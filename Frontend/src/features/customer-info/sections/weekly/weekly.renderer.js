import {
  convertToPersianDate,
  formatNumber,
} from "../../../../core/utils/date.utils.js";

export const weeklyRenderer = {
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

  renderPeriodsFilter(periods) {
    const select = document.getElementById("filter-period");
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">همه دوره‌ها</option>';

    // فقط دوره‌های فعال و در انتظار
    const activePeriods = periods.filter(
      (p) => p.status === "active" || p.status === "pending",
    );

    if (activePeriods.length === 0) {
      select.innerHTML = '<option value="">هیچ دوره فعالی وجود ندارد</option>';
      return;
    }

    activePeriods.forEach((period) => {
      const option = document.createElement("option");
      option.value = period.id;
      option.textContent = `${period.period_name} (دوره ${period.period_number})`;
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

  renderFullReport(customer, flocks, periods) {
    const now = new Date().toLocaleDateString("fa-IR");
    const nowTime = new Date().toLocaleTimeString("fa-IR");

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userName = user.fullName || user.username || "کاربر ناشناس";

    const totalFlocks = flocks.length;
    const totalWeeks = flocks.reduce((sum, f) => sum + f.weeks.length, 0);
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

    let flocksHTML = "";
    flocks.forEach((flock, index) => {
      const weeksHTML = flock.weeks
        .map(
          (week, i) => `
                <tr class="${week.existsInDb ? "has-data" : ""}">
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

      flocksHTML += `
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
                            <span>📊 ${flock.weeks.length} هفته</span>
                            <span class="status-badge ${flock.is_active ? "status-active" : "status-inactive"}">
                                ${flock.is_active ? "فعال" : "غیرفعال"}
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; font-size: 13px;">
                        <span><strong>تلفات:</strong> ${flock.statistics.totalMortality} قطعه</span>
                        <span><strong>میانگین وزن:</strong> ${flock.statistics.avgWeight} کیلوگرم</span>
                        <span><strong>کل خوراک:</strong> ${flock.statistics.totalFeed} کیلوگرم</span>
                        <span><strong>🐔 ضریب تبدیل:</strong> ${flock.statistics.fcr || "-"}</span>
                        <span><strong>هفته‌های تکمیل شده:</strong> ${flock.statistics.hasDataWeeks} از ${flock.statistics.weekCount}</span>
                    </div>

                    ${
                      flock.weeks.length > 0
                        ? `
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
                        : `
                        <div style="text-align: center; padding: 20px; color: #94a3b8;">
                            <p>هیچ داده‌ای برای این گله ثبت نشده است</p>
                        </div>
                    `
                    }
                </div>
            `;
    });

    return `
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>گزارش کامل مدیریت هفتگی</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Vazir', 'Tahoma', sans-serif; padding: 20px; line-height: 1.7; color: #1e293b; background: #f8fafc; }
                    .report-header { text-align: center; margin-bottom: 30px; padding: 25px; background: linear-gradient(135deg, #2c7a6e 0%, #065f46 100%); color: white; border-radius: 12px; }
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
                    .week-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
                    .week-table th { background: #f1f5f9; color: #1e293b; padding: 8px 10px; text-align: center; font-weight: 600; border: 1px solid #e2e8f0; }
                    .week-table td { padding: 6px 10px; text-align: center; border: 1px solid #e2e8f0; }
                    .week-table .has-data { background: #d1fae5 !important; color: #065f46; }
                    .week-table .highlight { font-weight: 600; color: #2c7a6e; }
                    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; }
                    .status-active { background: #d1fae5; color: #065f46; }
                    .status-pending { background: #fed7aa; color: #9a3412; }
                    .status-inactive { background: #fee2e2; color: #991b1b; }
                    .report-footer { text-align: center; font-size: 12px; color: #94a3b8; border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 30px; }
                    .report-footer .report-by { background: #f1f5f9; padding: 8px 20px; border-radius: 8px; display: inline-block; font-size: 13px; color: #1e293b; margin-top: 8px; }
                    @media print { body { background: white; padding: 10px; } .flock-section { box-shadow: none; border: 1px solid #e2e8f0; } .report-header { background: #2c7a6e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } .summary-stat { box-shadow: none; border: 1px solid #e2e8f0; } }
                    @media (max-width: 768px) { .week-table { font-size: 10px; } .week-table th, .week-table td { padding: 4px 6px; } .flock-header { flex-direction: column; align-items: flex-start; gap: 8px; } .summary-stats { grid-template-columns: repeat(2, 1fr); } }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <h1>📊 گزارش کامل مدیریت هفتگی</h1>
                    <div class="sub">سامانه اطلاعات، خدمات و ارتباطات با مشتریان (سِکاد)</div>
                    <div class="report-info">📅 تاریخ تهیه: ${now} - ساعت: ${nowTime}</div>
                </div>

                ${
                  totalFlocks > 0
                    ? `
                    <div class="summary-stats">
                        <div class="summary-stat"><div class="stat-number">${totalFlocks}</div><div class="stat-label">تعداد گله‌ها</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalWeeks}</div><div class="stat-label">تعداد هفته‌ها</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalChicks.toLocaleString()}</div><div class="stat-label">تعداد کل جوجه‌ها</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalMortality.toLocaleString()}</div><div class="stat-label">تلفات کل</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalFlocks > 0 ? Math.round(totalMortality / totalFlocks) : 0}</div><div class="stat-label">میانگین تلفات هر گله</div></div>
                        <div class="summary-stat"><div class="stat-number">${totalChicks > 0 ? ((totalMortality / totalChicks) * 100).toFixed(1) : 0}%</div><div class="stat-label">درصد تلفات کل</div></div>
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
                        📌 گزارش‌گیری توسط: <strong>${userName}</strong> | تاریخ: <strong>${now}</strong> | ساعت: <strong>${nowTime}</strong>
                    </div>
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
