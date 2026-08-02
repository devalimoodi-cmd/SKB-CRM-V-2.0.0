// validations/weeklyValidation.js

// تابع اعتبارسنجی برای ایجاد/بروزرسانی اطلاعات هفتگی
const validateWeeklyData = (data) => {
  const errors = [];

  // 1. فیلدهای اجباری
  if (!data.customer_id) {
    errors.push("شناسه مشتری الزامی است");
  } else if (isNaN(parseInt(data.customer_id))) {
    errors.push("شناسه مشتری باید عدد باشد");
  }

  if (!data.hall_id) {
    errors.push("شناسه سالن الزامی است");
  } else if (isNaN(parseInt(data.hall_id))) {
    errors.push("شناسه سالن باید عدد باشد");
  }

  if (!data.chick_placement_id) {
    errors.push("شناسه گله (جوجه‌ریزی) الزامی است");
  } else if (isNaN(parseInt(data.chick_placement_id))) {
    errors.push("شناسه گله باید عدد باشد");
  }

  if (!data.week_start_date) {
    errors.push("تاریخ شروع هفته الزامی است");
  }

  if (!data.week_end_date) {
    errors.push("تاریخ پایان هفته الزامی است");
  }

  if (!data.week_number) {
    errors.push("شماره هفته الزامی است");
  } else if (isNaN(parseInt(data.week_number))) {
    errors.push("شماره هفته باید عدد باشد");
  } else if (parseInt(data.week_number) < 1) {
    errors.push("شماره هفته باید حداقل 1 باشد");
  }

  if (!data.flock_age_days) {
    errors.push("سن گله الزامی است");
  } else if (isNaN(parseInt(data.flock_age_days))) {
    errors.push("سن گله باید عدد باشد");
  }

  // 2. اعتبارسنجی ساعات خاموشی (0 تا 24 ساعت، با اعشار)
  if (data.blackout_hours !== undefined && data.blackout_hours !== null) {
    const hours = parseFloat(data.blackout_hours);
    if (isNaN(hours)) {
      errors.push("ساعات خاموشی باید عدد باشد");
    } else if (hours < 0 || hours > 24) {
      errors.push("ساعات خاموشی باید بین 0 تا 24 باشد");
    }
  }

  // 3. اعتبارسنجی تلفات (نباید منفی باشد)
  if (data.weekly_mortality !== undefined && data.weekly_mortality !== null) {
    const mortality = parseInt(data.weekly_mortality);
    if (isNaN(mortality)) {
      errors.push("تلفات هفتگی باید عدد باشد");
    } else if (mortality < 0) {
      errors.push("تلفات هفتگی نمی‌تواند منفی باشد");
    }
  }

  // 4. اعتبارسنجی مصرف خوراک (نباید منفی باشد)
  if (data.daily_feed_intake !== undefined && data.daily_feed_intake !== null) {
    const intake = parseFloat(data.daily_feed_intake);
    if (isNaN(intake)) {
      errors.push("مصرف خوراک روزانه باید عدد باشد");
    } else if (intake < 0) {
      errors.push("مصرف خوراک روزانه نمی‌تواند منفی باشد");
    }
  }

  if (
    data.weekly_feed_intake !== undefined &&
    data.weekly_feed_intake !== null
  ) {
    const intake = parseFloat(data.weekly_feed_intake);
    if (isNaN(intake)) {
      errors.push("مصرف خوراک هفتگی باید عدد باشد");
    } else if (intake < 0) {
      errors.push("مصرف خوراک هفتگی نمی‌تواند منفی باشد");
    }
  }

  // 5. اعتبارسنجی وزن (نباید منفی باشد)
  if (data.weekly_weight !== undefined && data.weekly_weight !== null) {
    const weight = parseFloat(data.weekly_weight);
    if (isNaN(weight)) {
      errors.push("وزن هفتگی باید عدد باشد");
    } else if (weight < 0) {
      errors.push("وزن هفتگی نمی‌تواند منفی باشد");
    }
  }

  // 6. اعتبارسنجی تاریخ‌ها
  if (data.week_start_date && data.week_end_date) {
    const startDate = new Date(data.week_start_date);
    const endDate = new Date(data.week_end_date);
    if (startDate > endDate) {
      errors.push("تاریخ شروع هفته نمی‌تواند بعد از تاریخ پایان باشد");
    }
  }

  // 7. اعتبارسنجی دوره (اگر ارسال شده باشد)
  if (
    data.period_id !== undefined &&
    data.period_id !== null &&
    data.period_id !== ""
  ) {
    if (isNaN(parseInt(data.period_id))) {
      errors.push("شناسه دوره باید عدد باشد");
    }
  }

  // 8. اعتبارسنجی کارشناس (اگر ارسال شده باشد)
  if (
    data.service_expert_id !== undefined &&
    data.service_expert_id !== null &&
    data.service_expert_id !== ""
  ) {
    if (isNaN(parseInt(data.service_expert_id))) {
      errors.push("شناسه کارشناس باید عدد باشد");
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

// تابع اعتبارسنجی برای آرایه‌های چندگانه (بیماری‌ها، واکسن‌ها و ...)
const validateMultipleItems = (items, itemName) => {
  const errors = [];
  if (!items || !Array.isArray(items)) {
    errors.push(`${itemName} باید به صورت آرایه ارسال شود`);
  } else {
    for (let i = 0; i < items.length; i++) {
      if (!items[i] || isNaN(parseInt(items[i]))) {
        errors.push(`${itemName}[${i}] نامعتبر است`);
      }
    }
  }
  return { isValid: errors.length === 0, errors };
};

module.exports = {
  validateWeeklyData,
  validateMultipleItems,
};
