// BackEnd/validations/customerValidation.js

const validateCustomerData = (data) => {
  const errors = [];

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

  return {
    isValid: errors.length === 0,
    errors,
  };
};

module.exports = { validateCustomerData };
