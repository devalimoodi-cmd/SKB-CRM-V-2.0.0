// BackEnd/validations/customerValidation.js

// ============================================
// نرمال‌سازی ورودی‌های متنی
// ============================================

// تبدیل ارقام فارسی/عربی به انگلیسی و حذف فاصله‌ها
// (کاربر ممکن است کد ملی/کد پستی را با ارقام فارسی وارد کند)
const toEnglishDigits = (value) => {
  if (value === null || value === undefined) return value;
  return String(value)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
};

// اعتبارسنجی کد ملی ایران (۱۰ رقم + رقم کنترلی)
// ورودی با ارقام فارسی/عربی هم پذیرفته می‌شود.
const isValidIranNationalCode = (value) => {
  const code = toEnglishDigits(String(value ?? "")).trim();
  if (!/^[0-9]{10}$/.test(code)) return false;
  if (/^(\d)\1{9}$/.test(code)) return false; // ارقام تکراری مثل ۱۱۱۱۱۱۱۱۱۱

  const check = Number(code[9]);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(code[i]) * (10 - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? check === remainder : check === 11 - remainder;
};

// ============================================
// اعتبارسنجی اطلاعات مشتری
// @param {Object} data
// @param {{ requireCustomerType?: boolean }} [options]
// ============================================

const validateCustomerData = (data, options = {}) => {
  const errors = [];
  const requireCustomerType = options.requireCustomerType === true;

  // ============================================
  // فیلدهای اجباری
  // ============================================

  // 1. نام و نام خانوادگی
  if (!data.full_name || data.full_name.trim().length < 3) {
    errors.push("فیلد 'نام و نام خانوادگی' باید حداقل 3 کاراکتر باشد");
  }

  // 2. نام فارم
  if (!data.farm_name || data.farm_name.trim().length < 2) {
    errors.push("فیلد 'نام فارم' الزامی است");
  }

  // 3. شماره موبایل
  const mobileRegex = /^09[0-9]{9}$/;
  if (!data.mobile_number) {
    errors.push("فیلد 'شماره موبایل' الزامی است");
  } else if (!mobileRegex.test(data.mobile_number)) {
    errors.push("فیلد 'شماره موبایل' باید با 09 شروع شود و 11 رقم باشد");
  }

  // 4. استان
  if (!data.province || data.province.trim() === "") {
    errors.push("فیلد 'استان' الزامی است");
  }

  // 5. شهرستان
  if (!data.county || data.county.trim() === "") {
    errors.push("فیلد 'شهرستان' الزامی است");
  }

  // 6. آدرس فارم
  if (!data.farm_address || data.farm_address.trim().length < 5) {
    errors.push("فیلد 'آدرس فارم' باید حداقل 5 کاراکتر باشد");
  }

  // 7. کد پستی
  if (!data.postal_code) {
    errors.push("فیلد 'کد پستی' الزامی است");
  } else if (!/^[0-9]{10}$/.test(data.postal_code)) {
    errors.push("فیلد 'کد پستی' باید 10 رقم باشد");
  }

  // 8. سابقه فعالیت
  if (!data.experience_years || data.experience_years === "") {
    errors.push("فیلد 'سابقه فعالیت' الزامی است");
  }

  // 9. سطح تحصیلات
  if (!data.education_level || data.education_level === "") {
    errors.push("فیلد 'سطح تحصیلات' الزامی است");
  }

  // 10. دپارتمان فروش
  if (!data.sales_department || data.sales_department === "") {
    errors.push("فیلد 'دپارتمان فروش' الزامی است");
  }

  // 11. جنسیت
  if (!data.gender || data.gender === "") {
    errors.push("فیلد 'جنسیت' الزامی است");
  }

  // ============================================
  // فیلدهای اختیاری
  // ============================================

  // 12. ایمیل - کاملاً اختیاری
  if (data.email && data.email.trim() !== "") {
    const emailRegex = /^[^\s@]+@([^\s@.,]+\.)+[^\s@.,]{2,}$/;
    if (!emailRegex.test(data.email)) {
      errors.push("فیلد 'ایمیل' معتبر نیست");
    }
  }

  // 13. شماره پیام‌رسان
  if (data.messaging_number && data.messaging_number.trim() !== "") {
    if (!/^[0-9]+$/.test(data.messaging_number)) {
      errors.push("فیلد 'شماره پیام‌رسان' باید عدد باشد");
    }
  }

  // 14. تاریخ تولد - اختیاری
  if (data.date_of_birth && data.date_of_birth.trim() !== "") {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date_of_birth)) {
      errors.push("فیلد 'تاریخ تولد' باید به فرمت YYYY-MM-DD باشد");
    }
  }

  // 15. نوع مشتری (اجباری — در مسیر ویرایش با options کنترل می‌شود)
  const rawCustomerType = data.customer_type_id;
  const hasCustomerType =
    rawCustomerType !== undefined &&
    rawCustomerType !== null &&
    String(rawCustomerType).trim() !== "";

  if (requireCustomerType && !hasCustomerType) {
    errors.push("فیلد 'نوع مشتری' الزامی است");
  }
  if (hasCustomerType && !/^[0-9]+$/.test(String(rawCustomerType).trim())) {
    errors.push("فیلد 'نوع مشتری' باید از فهرست انتخاب شود");
  }

  // 16. کد ملی - اختیاری (در صورت ورود باید ۱۰ رقم و معتبر باشد)
  if (data.national_code && String(data.national_code).trim() !== "") {
    const nationalCode = toEnglishDigits(data.national_code).trim();
    if (!/^[0-9]{10}$/.test(nationalCode)) {
      errors.push("فیلد 'کد ملی' باید ۱۰ رقم باشد");
    } else if (!isValidIranNationalCode(nationalCode)) {
      errors.push("فیلد 'کد ملی' معتبر نیست (ارقام وارد شده صحیح نیستند)");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateCustomerData,
  // برای استفاده در کنترلر (نرمال‌سازی ورودی‌ها)
  toEnglishDigits,
  isValidIranNationalCode,
};
