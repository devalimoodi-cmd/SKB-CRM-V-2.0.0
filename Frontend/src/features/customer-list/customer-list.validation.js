// ✅ پیاده‌سازی مرجع اعتبارسنجی کد ملی در core/utils/string.utils.js است
import { isValidNationalCode as isValidNationalCodeUtil } from "../../core/utils/string.utils.js";

export const customerListValidation = {
  validate(data) {
    const errors = [];

    // نام کامل
    if (!data.full_name || data.full_name.trim().length < 3) {
      errors.push("نام و نام خانوادگی باید حداقل 3 کاراکتر باشد");
    }
    // نام فارم
    if (!data.farm_name || data.farm_name.trim().length < 2) {
      errors.push("نام فارم الزامی است");
    }

    // شماره موبایل
    if (!data.mobile_number || !this.isValidPhone(data.mobile_number)) {
      errors.push("شماره موبایل باید با 09 شروع شود و 11 رقم باشد");
    }

    // استان
    if (!data.province) {
      errors.push("استان الزامی است");
    }

    // شهرستان
    if (!data.county) {
      errors.push("شهرستان الزامی است");
    }

    // کد پستی
    if (!data.postal_code || !this.isValidPostalCode(data.postal_code)) {
      errors.push("کد پستی باید 10 رقم باشد");
    }

    // آدرس
    if (!data.farm_address || data.farm_address.trim().length < 5) {
      errors.push("آدرس مرغداری باید حداقل 5 کاراکتر باشد");
    }

    // سابقه مرغداری
    if (!data.experience_years) {
      errors.push("سابقه مرغداری الزامی است");
    }

    // سطح تحصیلات
    if (!data.education_level) {
      errors.push("سطح تحصیلات الزامی است");
    }

    // دپارتمان
    if (!data.sales_department) {
      errors.push("دپارتمان الزامی است");
    }

    // جنسیت
    if (!data.gender) {
      errors.push("جنسیت الزامی است");
    }

    // ✅ نوع مشتری (اجباری — از جدول دیکشنری «انواع مشتری»)
    if (
      data.customer_type_id === undefined ||
      data.customer_type_id === null ||
      String(data.customer_type_id).trim() === ""
    ) {
      errors.push("نوع مشتری الزامی است");
    }

    // ✅ کد ملی (اختیاری — در صورت ورود باید ۱۰ رقم و معتبر باشد)
    if (data.national_code && String(data.national_code).trim() !== "") {
      if (!this.isValidNationalCode(data.national_code)) {
        errors.push("کد ملی باید ۱۰ رقم و معتبر باشد");
      }
    }

    return errors;
  },

  isValidPhone(phone) {
    return /^09[0-9]{9}$/.test(phone);
  },

  isValidPostalCode(code) {
    return /^[0-9]{10}$/.test(code);
  },

  // تبدیل ارقام فارسی/عربی به انگلیسی
  toEnglishDigits(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  },

  // اعتبارسنجی کد ملی ایران (۱۰ رقم + رقم کنترلی)
  // (پیاده‌سازی مرجع در core/utils/string.utils.js است)
  isValidNationalCode(code) {
    return isValidNationalCodeUtil(code);
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  validateSearch(searchTerm) {
    if (searchTerm && searchTerm.length < 2) {
      return "برای جستجو حداقل 2 کاراکتر وارد کنید";
    }
    return null;
  },
};
