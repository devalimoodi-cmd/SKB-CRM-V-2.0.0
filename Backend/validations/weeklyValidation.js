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

  // 3. اعتبارسنجی تلفات (اجباری و غیرمنفی)
  if (
    data.weekly_mortality === undefined ||
    data.weekly_mortality === null ||
    data.weekly_mortality === ""
  ) {
    errors.push("تلفات هفته الزامی است");
  } else {
    const mortality = parseInt(data.weekly_mortality);
    if (isNaN(mortality)) {
      errors.push("تلفات هفتگی باید عدد باشد");
    } else if (mortality < 0) {
      errors.push("تلفات هفتگی نمی‌تواند منفی باشد");
    }
  }

  // 4. اعتبارسنجی مصرف خوراک (کل گله - بدون سقف بالا)
  const dailyFeed = parseFloat(data.daily_feed_intake);
  const weeklyFeed = parseFloat(data.weekly_feed_intake);

  const hasDailyFeed =
    data.daily_feed_intake !== undefined &&
    data.daily_feed_intake !== null &&
    data.daily_feed_intake !== "" &&
    !isNaN(dailyFeed);

  const hasWeeklyFeed =
    data.weekly_feed_intake !== undefined &&
    data.weekly_feed_intake !== null &&
    data.weekly_feed_intake !== "" &&
    !isNaN(weeklyFeed);

  if (hasDailyFeed && dailyFeed < 0) {
    errors.push("مصرف خوراک روزانه نمی‌تواند منفی باشد");
  }
  if (hasWeeklyFeed && weeklyFeed < 0) {
    errors.push("مصرف خوراک هفتگی نمی‌تواند منفی باشد");
  }

  // بررسی سازگاری: دان هفتگی باید حدوداً ۷ برابر دان روزانه باشد
  if (hasDailyFeed && hasWeeklyFeed && dailyFeed > 0 && weeklyFeed > 0) {
    const expected = dailyFeed * 7;
    if (Math.abs(expected - weeklyFeed) > 1) {
      errors.push(
        "مقادیر دان روزانه و هفتگی با یکدیگر سازگار نیستند (هفتگی باید ۷ برابر روزانه باشد)",
      );
    }
  }

  // 5. اعتبارسنجی وزن (اجباری، کیلوگرم)
  if (
    data.weekly_weight === undefined ||
    data.weekly_weight === null ||
    data.weekly_weight === ""
  ) {
    errors.push("وزن هفتگی الزامی است");
  } else {
    const weight = parseFloat(data.weekly_weight);
    if (isNaN(weight)) {
      errors.push("وزن هفتگی باید عدد باشد");
    } else if (weight < 0.05) {
      errors.push("وزن هفتگی باید حداقل ۰.۰۵ کیلوگرم باشد");
    } else if (weight > 10) {
      errors.push("وزن هفتگی نمی‌تواند بیشتر از ۱۰ کیلوگرم باشد");
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

  // 7. اعتبارسنجی واحد (اگر ارسال شده باشد)
  if (
    data.unit_id !== undefined &&
    data.unit_id !== null &&
    data.unit_id !== ""
  ) {
    if (isNaN(parseInt(data.unit_id))) {
      errors.push("شناسه واحد باید عدد باشد");
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
