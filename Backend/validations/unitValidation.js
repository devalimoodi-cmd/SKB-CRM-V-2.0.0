// validations/unitValidation.js

function validateUnitData(data) {
  const errors = [];

  // 1. بررسی شناسه مشتری
  if (!data.customer_personal_information_id) {
    errors.push("شناسه مشتری الزامی است");
  }

  // 2. بررسی نام واحد (الزامی)
  if (!data.unit_name || data.unit_name.trim() === "") {
    errors.push("نام واحد الزامی است");
  } else if (data.unit_name.trim().length < 2) {
    errors.push("نام واحد باید حداقل 2 کاراکتر باشد");
  }

  // 3. بررسی آدرس واحد (الزامی)
  if (!data.address || data.address.trim().length < 5) {
    errors.push("آدرس واحد الزامی است (حداقل 5 کاراکتر)");
  }

  // 4. بررسی تعداد سالن‌ها (الزامی، بین 1 تا 99)
  if (
    data.hall_count === undefined ||
    data.hall_count === null ||
    data.hall_count === ""
  ) {
    errors.push("تعداد سالن‌ها الزامی است");
  } else {
    const count = parseInt(data.hall_count);
    if (isNaN(count)) {
      errors.push("تعداد سالن‌ها باید عدد باشد");
    } else if (count < 1 || count > 99) {
      errors.push("تعداد سالن‌ها باید عددی بین 1 تا 99 باشد");
    }
  }

  // 5. بررسی ظرفیت واحد (الزامی، بین 0 تا 1000000)
  if (
    data.capacity === undefined ||
    data.capacity === null ||
    data.capacity === ""
  ) {
    errors.push("ظرفیت واحد الزامی است");
  } else {
    const cap = parseInt(data.capacity);
    if (isNaN(cap)) {
      errors.push("ظرفیت واحد باید عدد باشد");
    } else if (cap < 0 || cap > 1000000) {
      errors.push("ظرفیت واحد باید عددی بین 0 تا 1,000,000 قطعه باشد");
    }
  }

  // 6. بررسی طول جغرافیایی (اختیاری)
  if (
    data.longitude !== undefined &&
    data.longitude !== null &&
    data.longitude !== ""
  ) {
    const lon = parseFloat(data.longitude);
    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.push("طول جغرافیایی باید عددی بین 180- تا 180 باشد");
    }
  }

  // 7. بررسی عرض جغرافیایی (اختیاری)
  if (
    data.latitude !== undefined &&
    data.latitude !== null &&
    data.latitude !== ""
  ) {
    const lat = parseFloat(data.latitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push("عرض جغرافیایی باید عددی بین 90- تا 90 باشد");
    }
  }

  // 8. بررسی نام مدیر (الزامی)
  if (!data.manager_name || data.manager_name.trim().length < 2) {
    errors.push("نام مدیر واحد الزامی است");
  }

  // 9. بررسی شماره تماس مدیر (الزامی، 11 رقم)
  if (!data.manager_phone) {
    errors.push("شماره تماس مدیر واحد الزامی است");
  } else if (
    !/^[0-9]{11}$/.test(String(data.manager_phone).replace(/\D/g, ""))
  ) {
    errors.push("شماره تماس مدیر باید 11 رقم باشد");
  }

  // 10. بررسی کارشناسان واحد (اختیاری — اما اگر ردیفی پر شد، کامل باشد)
  if (Array.isArray(data.experts) && data.experts.length > 0) {
    data.experts.forEach((expert, index) => {
      const rowNum = index + 1;
      const name = (expert.expert_name || "").toString().trim();
      const phone = (expert.expert_phone || "").toString().trim();
      const role = (expert.expert_role || "").toString().trim();

      // ردیف کاملاً خالی → نادیده گرفته می‌شود (اختیاری)
      if (!name && !phone && !role) return;

      // اگر حداقل یک فیلد پر شده، همه باید کامل باشند
      if (!name) {
        errors.push(`نام کارشناس ردیف ${rowNum} الزامی است`);
      } else if (name.length > 50) {
        errors.push(`نام کارشناس ردیف ${rowNum} حداکثر 50 کاراکتر باشد`);
      }

      if (!phone) {
        errors.push(`شماره تماس کارشناس ردیف ${rowNum} الزامی است`);
      } else if (!/^[0-9]{11}$/.test(phone.replace(/\D/g, ""))) {
        errors.push(`شماره تماس کارشناس ردیف ${rowNum} باید 11 رقم باشد`);
      }

      if (!role) {
        errors.push(`نقش کارشناس ردیف ${rowNum} الزامی است`);
      } else if (role.length > 50) {
        errors.push(`نقش کارشناس ردیف ${rowNum} حداکثر 50 کاراکتر باشد`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

module.exports = { validateUnitData };
