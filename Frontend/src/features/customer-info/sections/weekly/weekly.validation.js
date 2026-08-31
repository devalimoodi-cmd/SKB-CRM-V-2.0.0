export const weeklyValidation = {
  validateWeek(data) {
    const errors = [];

    // ===== کارشناس خدمات - اجباری =====
    if (!data.service_expert_id) {
      errors.push("انتخاب کارشناس خدمات الزامی است");
    }

    // ===== تلفات هفته (قطعه) - اجباری =====
    if (
      data.weekly_mortality === undefined ||
      data.weekly_mortality === null ||
      data.weekly_mortality === ""
    ) {
      errors.push("مقدار تلفات هفته الزامی است");
    } else {
      const val = parseInt(data.weekly_mortality);
      if (isNaN(val)) {
        errors.push("تعداد تلفات باید عدد صحیح باشد");
      } else if (val < 0) {
        errors.push("تعداد تلفات نمی‌تواند منفی باشد");
      } else if (data.remainingBirds !== undefined && val > data.remainingBirds) {
        errors.push("تعداد تلفات نمی‌تواند از جمعیت مانده گله بیشتر باشد");
      }
    }

    // ===== دان مصرفی (کل گله) - اختیاری =====
    const dailyRaw = data.daily_feed_intake;
    const weeklyRaw = data.weekly_feed_intake;
    const hasDaily = dailyRaw !== undefined && dailyRaw !== null && dailyRaw !== "";
    const hasWeekly =
      weeklyRaw !== undefined && weeklyRaw !== null && weeklyRaw !== "";

    if (hasDaily) {
      const val = parseFloat(dailyRaw);
      if (isNaN(val)) {
        errors.push("مقدار دان مصرفی روزانه باید عدد باشد");
      } else if (val < 0) {
        errors.push("مقدار دان مصرفی روزانه نمی‌تواند منفی باشد");
      }
    }

    if (hasWeekly) {
      const val = parseFloat(weeklyRaw);
      if (isNaN(val)) {
        errors.push("مقدار دان مصرفی هفتگی باید عدد باشد");
      } else if (val < 0) {
        errors.push("مقدار دان مصرفی هفتگی نمی‌تواند منفی باشد");
      }
    }

    // سازگاری: دان هفتگی = روزانه × ۷
    if (hasDaily && hasWeekly) {
      const daily = parseFloat(dailyRaw);
      const weekly = parseFloat(weeklyRaw);
      if (daily > 0 && weekly > 0) {
        if (Math.abs(daily * 7 - weekly) > 1) {
          errors.push(
            "مقادیر دان روزانه و هفتگی سازگار نیستند (هفتگی باید ۷ برابر روزانه باشد)",
          );
        }
      }
    }

    // ===== وزن هفتگی (کیلوگرم) - اجباری =====
    if (
      data.weekly_weight === undefined ||
      data.weekly_weight === null ||
      data.weekly_weight === ""
    ) {
      errors.push("مقدار وزن هفتگی الزامی است");
    } else {
      const val = parseFloat(data.weekly_weight);
      if (isNaN(val)) {
        errors.push("مقدار وزن هفتگی باید عدد باشد");
      } else if (val < 0.05) {
        errors.push("وزن نمی‌تواند کمتر از ۰.۰۵ کیلوگرم باشد");
      } else if (val > 10) {
        errors.push("وزن نمی‌تواند بیشتر از ۱۰ کیلوگرم باشد");
      }
    }

    // ===== خاموشی سالن (ساعت) - اختیاری =====
    if (
      data.blackout_hours !== undefined &&
      data.blackout_hours !== null &&
      data.blackout_hours !== ""
    ) {
      const val = parseFloat(data.blackout_hours);
      if (isNaN(val)) {
        errors.push("ساعت خاموشی باید عدد باشد");
      } else if (val < 0) {
        errors.push("ساعت خاموشی نمی‌تواند منفی باشد");
      } else if (val > 24) {
        errors.push("ساعت خاموشی نمی‌تواند بیشتر از ۲۴ ساعت باشد");
      }
    }

    // ===== بیماری‌ها (چند انتخابی) - اختیاری، حداکثر ۱۰ =====
    if (
      data.disease_ids &&
      Array.isArray(data.disease_ids) &&
      data.disease_ids.length > 10
    ) {
      errors.push("حداکثر ۱۰ بیماری می‌توانید انتخاب کنید");
    }

    // ===== واکسن‌ها (چند انتخابی) - اختیاری، حداکثر ۱۰ =====
    if (
      data.vaccine_ids &&
      Array.isArray(data.vaccine_ids) &&
      data.vaccine_ids.length > 10
    ) {
      errors.push("حداکثر ۱۰ واکسن می‌توانید انتخاب کنید");
    }

    // ===== داروها (چند انتخابی) - اختیاری، حداکثر ۱۰ =====
    if (
      data.medicine_ids &&
      Array.isArray(data.medicine_ids) &&
      data.medicine_ids.length > 10
    ) {
      errors.push("حداکثر ۱۰ دارو می‌توانید انتخاب کنید");
    }

    // ===== نوع خوراک (چند انتخابی) - اجباری، حداکثر ۵ =====
    if (
      !data.feed_type_ids ||
      !Array.isArray(data.feed_type_ids) ||
      data.feed_type_ids.length === 0
    ) {
      errors.push("انتخاب نوع خوراک الزامی است");
    } else if (data.feed_type_ids.length > 5) {
      errors.push("حداکثر ۵ نوع خوراک می‌توانید انتخاب کنید");
    }

    // ===== توضیحات - حداکثر ۵۰۰۰ کاراکتر =====
    if (data.additional_notes && data.additional_notes.length > 5000) {
      errors.push("توضیحات نمی‌تواند بیشتر از 5000 کاراکتر باشد");
    }

    return errors;
  },

  validateFlockForWeekly(data) {
    const errors = [];

    if (!data.chick_placement_id) {
      errors.push("شناسه گله معتبر نیست");
    }

    if (!data.week_number || data.week_number < 1) {
      errors.push("شماره هفته معتبر نیست");
    }

    if (!data.week_start_date) {
      errors.push("تاریخ شروع هفته الزامی است");
    }

    if (!data.week_end_date) {
      errors.push("تاریخ پایان هفته الزامی است");
    }

    return errors;
  },
};

