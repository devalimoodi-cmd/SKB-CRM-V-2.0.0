// validations/unitValidation.js

function validateUnitData(data) {
  const errors = [];

  // 1. بررسی شناسه مشتری
  if (!data.customer_personal_information_id) {
    errors.push("شناسه مشتری الزامی است");
  }

  // 2. بررسی نام واحد
  if (!data.unit_name || data.unit_name.trim() === "") {
    errors.push("نام واحد الزامی است");
  } else if (data.unit_name.length < 3) {
    errors.push("نام واحد باید حداقل 3 کاراکتر باشد");
  }

  // 3. بررسی تعداد سالن‌ها (اختیاری، در صورت وجود باید حداقل 1 باشد)
  if (data.hall_count !== undefined && data.hall_count !== null) {
    if (isNaN(data.hall_count) || data.hall_count < 1) {
      errors.push("تعداد سالن‌ها باید حداقل 1 باشد");
    }
  }

  // 4. بررسی طول جغرافیایی (اختیاری)
  if (data.longitude !== undefined && data.longitude !== null) {
    const lon = parseFloat(data.longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.push("طول جغرافیایی باید بین 180- تا 180 باشد");
    }
  }

  // 5. بررسی عرض جغرافیایی (اختیاری)
  if (data.latitude !== undefined && data.latitude !== null) {
    const lat = parseFloat(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push("عرض جغرافیایی باید بین 90- تا 90 باشد");
    }
  }

  // 6. بررسی شماره تماس مدیر (اختیاری)
  if (data.manager_phone && !/^[0-9]+$/.test(data.manager_phone)) {
    errors.push("شماره تماس مدیر باید عدد باشد");
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

module.exports = { validateUnitData };
