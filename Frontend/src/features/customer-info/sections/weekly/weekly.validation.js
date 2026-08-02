export const weeklyValidation = {
  validateWeek(data) {
    const errors = [];

    // ===== کارشناس خدمات - اجباری =====
    if (!data.service_expert_id) {
      errors.push("انتخاب کارشناس خدمات الزامی است");
    }

    // ===== خوراک روزانه (کیلوگرم) - اجباری =====
    if (
      data.daily_feed_intake === undefined ||
      data.daily_feed_intake === null ||
      data.daily_feed_intake === ""
    ) {
      errors.push("مقدار خوراک روزانه الزامی است");
    } else {
      const val = parseFloat(data.daily_feed_intake);
      if (isNaN(val)) {
        errors.push("مقدار خوراک روزانه باید عدد باشد");
      } else if (val < 0.01) {
        errors.push("مقدار خوراک روزانه نمی‌تواند کمتر از ۰.۰۱ کیلوگرم باشد");
      } else if (val > 1.0) {
        errors.push("مقدار خوراک روزانه نمی‌تواند بیشتر از ۱ کیلوگرم باشد");
      }
    }

    // ===== خوراک هفتگی (کیلوگرم) - اجباری =====
    if (
      data.weekly_feed_intake === undefined ||
      data.weekly_feed_intake === null ||
      data.weekly_feed_intake === ""
    ) {
      errors.push("مقدار خوراک هفتگی الزامی است");
    } else {
      const val = parseFloat(data.weekly_feed_intake);
      if (isNaN(val)) {
        errors.push("مقدار خوراک هفتگی باید عدد باشد");
      } else if (val < 0.1) {
        errors.push("مقدار خوراک هفتگی نمی‌تواند کمتر از ۰.۱ کیلوگرم باشد");
      } else if (val > 30) {
        errors.push("مقدار خوراک هفتگی نمی‌تواند بیشتر از ۳۰ کیلوگرم باشد");
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
      } else if (val > 5.0) {
        errors.push("وزن جوجه نمی‌تواند بیشتر از ۵ کیلوگرم باشد");
      }
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
      } else if (val > 500) {
        errors.push("تعداد تلفات نمی‌تواند بیشتر از ۵۰۰ قطعه باشد");
      }
    }

    // ===== خاموشی سالن (ساعت) - اجباری =====
    if (
      data.blackout_hours === undefined ||
      data.blackout_hours === null ||
      data.blackout_hours === ""
    ) {
      errors.push("مقدار ساعت خاموشی الزامی است");
    } else {
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
