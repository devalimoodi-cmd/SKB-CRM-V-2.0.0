// validations/chickPlacementValidation.js

function validateChickPlacement(data) {
  const errors = [];

  // بررسی customer_id
  if (!data.customer_id) {
    errors.push("شناسه مشتری الزامی است");
  } else if (isNaN(parseInt(data.customer_id))) {
    errors.push("شناسه مشتری باید عدد باشد");
  }

  // بررسی hall_id
  if (!data.hall_id) {
    errors.push("شناسه سالن الزامی است");
  } else if (isNaN(parseInt(data.hall_id))) {
    errors.push("شناسه سالن باید عدد باشد");
  }

  // بررسی placement_date
  if (!data.placement_date) {
    errors.push("تاریخ جوجه‌ریزی الزامی است");
  } else {
    const placementDate = new Date(data.placement_date);
    if (isNaN(placementDate.getTime())) {
      errors.push("فرمت تاریخ جوجه‌ریزی نامعتبر است");
    }
  }

  // بررسی flock_number (اختیاری — شماره گله اکنون در سطح گله/دوره است)
  // اگر ارسال شد باید عدد معتبر باشد؛ مقدار خالی/صفر = خودکار و خطا ندارد
  if (
    data.flock_number !== undefined &&
    data.flock_number !== null &&
    String(data.flock_number).trim() !== ""
  ) {
    if (isNaN(parseInt(data.flock_number))) {
      errors.push("شماره گله باید عدد باشد");
    }
  }

  // بررسی unit_id (اختیاری، ولی اگر وجود دارد باید عدد باشد)
  if (data.unit_id && isNaN(parseInt(data.unit_id))) {
    errors.push("شناسه واحد باید عدد باشد");
  }

  // بررسی chick_age_on_arrival
  if (data.chick_age_on_arrival && isNaN(parseInt(data.chick_age_on_arrival))) {
    errors.push("سن جوجه باید عدد باشد");
  }

  // بررسی avg_initial_weight
  if (data.avg_initial_weight && isNaN(parseFloat(data.avg_initial_weight))) {
    errors.push("میانگین وزن اولیه باید عدد باشد");
  }

  // بررسی total_chicks_count
  if (data.total_chicks_count && isNaN(parseInt(data.total_chicks_count))) {
    errors.push("تعداد جوجه‌ها باید عدد باشد");
  }

  // بررسی unit_id (اختیاری - چون دیگر الزامی نیست)
  if (data.unit_id && isNaN(parseInt(data.unit_id))) {
    errors.push("شناسه واحد باید عدد باشد");
  }

  // بررسی chick_source_id (الزامی)
  if (!data.chick_source_id) {
    errors.push("مبدا جوجه الزامی است");
  } else if (isNaN(parseInt(data.chick_source_id))) {
    errors.push("مبدا جوجه باید عدد باشد");
  }

  // بررسی breed_id (الزامی)
  if (!data.breed_id) {
    errors.push("نژاد جوجه الزامی است");
  } else if (isNaN(parseInt(data.breed_id))) {
    errors.push("نژاد جوجه باید عدد باشد");
  }

  // بررسی avg_initial_weight (الزامی)
  if (!data.avg_initial_weight) {
    errors.push("میانگین وزن اولیه الزامی است");
  } else if (isNaN(parseFloat(data.avg_initial_weight))) {
    errors.push("میانگین وزن اولیه باید عدد باشد");
  } else if (parseFloat(data.avg_initial_weight) <= 0) {
    errors.push("میانگین وزن اولیه باید بزرگتر از صفر باشد");
  }

  // بررسی total_chicks_count (الزامی)
  if (!data.total_chicks_count) {
    errors.push("تعداد کل جوجه‌ها الزامی است");
  } else if (isNaN(parseInt(data.total_chicks_count))) {
    errors.push("تعداد کل جوجه‌ها باید عدد باشد");
  } else if (parseInt(data.total_chicks_count) <= 0) {
    errors.push("تعداد کل جوجه‌ها باید بزرگتر از صفر باشد");
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

module.exports = { validateChickPlacement };
