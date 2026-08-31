// ================================================================
// TaskCard.js
// کامپوننت کارت نمایش اطلاعات گله و استپر هفته‌ها
// ================================================================

/**
 * داده‌های ورودی مورد نیاز:
 * @param {Object} props
 * @param {number} props.customerId - شناسه مشتری
 * @param {string} props.customerName - نام مشتری
 * @param {string} props.farmName - نام مزرعه/سالن
 * @param {string} props.location - شهر/استان
 * @param {number} props.flockId - شناسه گله
 * @param {number} props.flockNumber - شماره گله
 * @param {number} props.totalWeeks - تعداد کل هفته‌های گله
 * @param {number[]} props.completedWeeks - آرایه هفته‌های ثبت‌شده
 * @param {number} props.currentWeek - هفته جاری
 * @param {number} props.currentWeekAge - سن گله در هفته جاری (روز)
 * @param {string} props.currentWeekDate - بازه تاریخ هفته جاری
 * @param {number} props.bookmarkCount - تعداد بوکمارک‌ها
 * @param {string} props.status - وضعیت (success | info | warning | danger)
 * @param {string} props.statusText - متن وضعیت
 * @param {string|number} props.daysRemaining - روزهای باقی‌مانده تا سررسید
 * @param {Function} props.onClick - رویداد کلیک روی کارت
 * @param {Object} props.actions - دکمه‌های عملیاتی
 * @param {string} props.smsStatusHTML - HTML وضعیت پیامک (اختیاری)
 */

// تابع اصلی ساخت کارت
function TaskCard(props = {}) {
  // ===== داده‌های ورودی با مقدار پیش‌فرض =====
  const {
    customerId = 0,
    customerName = "نام مشتری",
    farmName = "مزرعه",
    location = "شهر",

    flockId = 0,
    flockNumber = 1,
    unitName = "",
    hallName = "",
    breedName = "",
    totalWeeks = 8,
    completedWeeks = [],
    currentWeek = 1,
    currentWeekAge = 7,
    currentWeekDate = "----/--/-- - ----/--/--",

    bookmarkCount = 0,

    status = "info",
    statusText = "در حال انجام",
    daysRemaining = "",

    onClick = null,
    actions = {},
    smsStatusHTML = "",
    className = "",
  } = props;

  // ===== تابع رندر استپر =====
  function renderStepper() {
    let html = "";

    for (let i = 1; i <= totalWeeks; i++) {
      const isCompleted = completedWeeks.includes(i);
      const isActive = i === currentWeek;
      const isPending = !isCompleted && !isActive;

      // کلاس‌های دایره
      let circleClass = "step-circle";
      if (isCompleted) circleClass += " completed";
      else if (isActive) circleClass += " active";
      else if (isPending) circleClass += " pending";

      // کلاس آیتم (برای خط اتصال)
      let itemClass = "step-item";
      if (i < totalWeeks) {
        const nextIsCompleted = completedWeeks.includes(i + 1);
        const nextIsActive = i + 1 === currentWeek;
        if (nextIsCompleted) itemClass += " completed-connector";
        else if (nextIsActive) itemClass += " active-connector";
      }

      // Tooltip
      let tooltipText = "";
      if (isCompleted) tooltipText = `✅ هفته ${i}: ثبت شده`;
      else if (isActive) tooltipText = `⏳ هفته ${i}: در حال انجام`;
      else tooltipText = `❌ هفته ${i}: ثبت نشده`;

      html += `
        <div class="${itemClass}">
          <div class="${circleClass}" title="${tooltipText}">
            ${i}
          </div>
        </div>
      `;
    }

    return html;
  }

  // ===== تابع رندر اطلاعات هفته جاری =====
  function renderCurrentWeekInfo() {
    return `
      <div class="current-week-info">
        <div class="label">
          <i class="fas fa-calendar-week"></i>
          هفته جاری
        </div>
        <div class="details">
          <span class="detail-item">
            <i class="fas fa-hashtag"></i>
            <span class="value">${currentWeek}</span>
          </span>
          <span class="detail-item">
            <i class="fas fa-calendar-alt"></i>
            <span class="value">${currentWeekAge}</span> روز
          </span>
          <span class="detail-item">
            <i class="fas fa-clock"></i>
            <span class="value">${currentWeekDate}</span>
          </span>
        </div>
      </div>
    `;
  }

  // ===== کلاس وضعیت =====
  const statusClassMap = {
    success: "success",
    info: "info",
    warning: "warning",
    danger: "danger",
  };
  const statusClass = statusClassMap[status] || "info";

  // آیکون وضعیت
  const statusIcon =
    status === "success"
      ? "check-circle"
      : status === "warning"
        ? "exclamation-triangle"
        : status === "danger"
          ? "times-circle"
          : "hourglass-half";

  // ===== دکمه‌های عملیاتی =====
  const defaultActions = {
    profile: { label: "پروفایل", icon: "fa-user", onClick: null },
    detail: { label: "جزئیات", icon: "fa-info-circle", onClick: null },
    sms: { label: "ارسال پیامک", icon: "fa-sms", onClick: null, primary: true },
    history: { label: "تاریخچه", icon: "fa-history", onClick: null },
    refresh: { icon: "fa-sync-alt", onClick: null },
  };

  const mergedActions = { ...defaultActions, ...actions };

  // ===== ساخت onclick به صورت string =====
  const buildOnClick = (fn) => {
    if (!fn) return "";
    return `event.stopPropagation(); ${fn}`;
  };

  // ===== ساخت نام صاحب اولیه =====
  const getInitial = (name) => {
    return name ? name.charAt(0) : "؟";
  };

  // ===== رندر نهایی (چیدمان افقی: ۴ ستون در یک ردیف) =====
  return `
    <div class="task-card ${className}" 
         data-customer-id="${customerId}" 
         data-flock-id="${flockId}"
         data-flock-number="${flockNumber}"
         data-week-number="${currentWeek}" 
         ${onClick ? `onclick="event.stopPropagation(); ${onClick}"` : ""}>

      <!-- ===== بوکمارک (مطلق گوشه) ===== -->
      ${
        bookmarkCount > 0
          ? `
        <div class="bookmark-badge">
          <i class="fas fa-bookmark"></i>
          <span class="count">${bookmarkCount}</span>
        </div>
      `
          : ""
      }

      <!-- ===== ردیف افقی با ۴ ستون ===== -->
      <div class="task-card-row">

        <!-- ستون ۱: اطلاعات مشتری + وضعیت‌ها -->
        <div class="task-col task-col-header">
          <div class="customer-info">
            <div class="customer-name-wrapper">
              <div class="customer-avatar">${getInitial(customerName)}</div>
              <div>
                <span class="customer-name">${customerName}</span>
                <span class="badge-id"><i class="fas fa-hashtag"></i> ${customerId}</span>
              </div>
            </div>
            <div class="customer-detail">
              <span><i class="fas fa-store"></i> ${farmName}</span>
              <span class="sep">|</span>
              <span><i class="fas fa-map-pin"></i> ${location}</span>
              <span class="sep">|</span>
              ${
                unitName
                  ? `<span><i class="fas fa-building"></i> ${unitName}</span>
              <span class="sep">|</span>`
                  : ""
              }
              ${
                hallName
                  ? `<span><i class="fas fa-warehouse"></i> ${hallName}</span>
              <span class="sep">|</span>`
                  : ""
              }
              <span><i class="fas fa-egg"></i> گله #${flockNumber}${breedName ? ` - ${breedName}` : ""}</span>
              <span class="sep">|</span>
              <span style="color:var(--gray-500, #94a3b8);font-size:11px;"><i class="fas fa-id-card"></i> ID: ${flockId}</span>
            </div>
            <div class="task-status">
              <span class="badge ${statusClass}">
                <i class="fas fa-${statusIcon}"></i> ${statusText}
              </span>
              ${
                daysRemaining
                  ? `
                <span class="badge info">
                  <i class="fas fa-clock"></i> ${daysRemaining} روز تا سررسید
                </span>
              `
                  : ""
              }
            </div>
            ${
              smsStatusHTML
                ? `
              <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; align-items: center;">
                ${smsStatusHTML}
              </div>
            `
                : ""
            }
          </div>
        </div>

        <!-- ستون ۲: استپر هفته‌ها (پروگرس بار) -->
        <div class="task-col task-col-stepper">
          <div class="stepper-label">📊 هفته‌ها</div>
          <div class="steps-container">
            ${renderStepper()}
          </div>
        </div>

        <!-- ستون ۳: اطلاعات تقویمی و سن -->
        <div class="task-col task-col-info">
          ${renderCurrentWeekInfo()}
        </div>

        <!-- ستون ۴: دکمه‌های عملیاتی -->
        <div class="task-col task-col-actions">
          ${
            mergedActions.profile
              ? `
            <button class="${mergedActions.profile.primary ? "btn-primary" : ""}" onclick="${buildOnClick(mergedActions.profile.onClick)}">
              <i class="fas ${mergedActions.profile.icon}"></i> ${mergedActions.profile.label || ""}
            </button>
          `
              : ""
          }
          ${
            mergedActions.detail
              ? `
            <button class="${mergedActions.detail.primary ? "btn-primary" : ""}" onclick="${buildOnClick(mergedActions.detail.onClick)}">
              <i class="fas ${mergedActions.detail.icon}"></i> ${mergedActions.detail.label || ""}
            </button>
          `
              : ""
          }
          ${
            mergedActions.sms
              ? `
            <button class="btn-success ${mergedActions.sms.primary ? "" : ""}" onclick="${buildOnClick(mergedActions.sms.onClick)}">
              <i class="fas ${mergedActions.sms.icon}"></i> ${mergedActions.sms.label || ""}
            </button>
          `
              : ""
          }
          ${
            mergedActions.history
              ? `
            <button onclick="${buildOnClick(mergedActions.history.onClick)}">
              <i class="fas ${mergedActions.history.icon}"></i> ${mergedActions.history.label || ""}
            </button>
          `
              : ""
          }
          ${
            mergedActions.refresh
              ? `
            <button onclick="${buildOnClick(mergedActions.refresh.onClick)}">
              <i class="fas ${mergedActions.refresh.icon}"></i>
            </button>
          `
              : ""
          }
        </div>

      </div>
    </div>
  `;
}

// ===== قرار دادن در window =====
if (typeof window !== "undefined") {
  window.TaskCard = TaskCard;
}

export default TaskCard;
export { TaskCard };
