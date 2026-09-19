// ============================================================
//  تست خالص اعتبارسنجی مشتری (بدون سرور و بدون دیتابیس)
//  اجرا:  npm run test:customer-validation
// ------------------------------------------------------------
//  پوشش: «نوع مشتری» (اجباری) و «کد ملی» (اختیاری/۱۰ رقمی/کنترلی)
// ============================================================
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  validateCustomerData,
  isValidIranNationalCode,
  toEnglishDigits,
} = require("./validations/customerValidation.js");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// ===== دادهٔ پایهٔ یک مشتری کامل (بدون نوع مشتری و کد ملی) =====
const baseCustomer = {
  full_name: "مشتری تست",
  farm_name: "فارم تست",
  mobile_number: "09151234567",
  province: "خراسان جنوبی",
  county: "بیرجند",
  farm_address: "آدرس تست شماره یک",
  postal_code: "1234567890",
  experience_years: "3-5",
  education_level: "کارشناسی",
  sales_department: "فروش",
  gender: "مرد",
};

const errorsOf = (data, options) => validateCustomerData(data, options).errors;
const hasError = (errors, needle) => errors.some((e) => e.includes(needle));

// ===== ۱) نوع مشتری: اجباری در ثبت‌نام =====
check(
  "ثبت‌نام بدون «نوع مشتری» → خطای اجباری بودن",
  hasError(errorsOf(baseCustomer, { requireCustomerType: true }), "نوع مشتری"),
);
check(
  "ثبت‌نام با نوع مشتری null → خطای اجباری بودن",
  hasError(
    errorsOf({ ...baseCustomer, customer_type_id: null }, { requireCustomerType: true }),
    "نوع مشتری",
  ),
);
check(
  "ثبت‌نام با نوع مشتری رشتهٔ خالی → خطای اجباری بودن",
  hasError(
    errorsOf({ ...baseCustomer, customer_type_id: "" }, { requireCustomerType: true }),
    "نوع مشتری",
  ),
);
check(
  "ثبت‌نام با نوع مشتری غیرعددی → خطای «از فهرست انتخاب شود»",
  hasError(
    errorsOf({ ...baseCustomer, customer_type_id: "گوشتی" }, { requireCustomerType: true }),
    "فهرست",
  ),
);
check(
  "ثبت‌نام با نوع مشتری معتبر (۴) → بدون خطای نوع مشتری",
  !hasError(
    errorsOf({ ...baseCustomer, customer_type_id: 4 }, { requireCustomerType: true }),
    "نوع مشتری",
  ),
);
check(
  "ویرایش (requireCustomerType=false) بدون نوع مشتری → بدون خطای اجباری بودن",
  !hasError(errorsOf(baseCustomer, { requireCustomerType: false }), "نوع مشتری"),
);

// ===== ۲) کد ملی: اختیاری =====
check(
  "کد ملی خالی → خطا ندارد (اختیاری)",
  !hasError(errorsOf({ ...baseCustomer, customer_type_id: 1, national_code: "" }, { requireCustomerType: true }), "کد ملی") &&
    !hasError(errorsOf({ ...baseCustomer, customer_type_id: 1 }, { requireCustomerType: true }), "کد ملی"),
);
check(
  "کد ملی معتبر (۱۲۳۴۵۶۷۸۹۱) → خطا ندارد",
  !hasError(
    errorsOf(
      { ...baseCustomer, customer_type_id: 1, national_code: "1234567891" },
      { requireCustomerType: true },
    ),
    "کد ملی",
  ),
);
check(
  "کد ملی با ارقام فارسی (۱۲۳۴۵۶۷۸۹۱) → پذیرفته می‌شود",
  !hasError(
    errorsOf(
      { ...baseCustomer, customer_type_id: 1, national_code: "۱۲۳۴۵۶۷۸۹۱" },
      { requireCustomerType: true },
    ),
    "کد ملی",
  ),
);
check(
  "کد ملی ۹ رقمی → خطای «۱۰ رقم»",
  hasError(
    errorsOf(
      { ...baseCustomer, customer_type_id: 1, national_code: "123456789" },
      { requireCustomerType: true },
    ),
    "۱۰ رقم",
  ),
);
check(
  "کد ملی با رقم کنترلی غلط (۱۲۳۴۵۶۷۸۹۰) → خطای «معتبر نیست»",
  hasError(
    errorsOf(
      { ...baseCustomer, customer_type_id: 1, national_code: "1234567890" },
      { requireCustomerType: true },
    ),
    "معتبر نیست",
  ),
);
check(
  "کد ملی با ارقام تکراری (۱۱۱۱۱۱۱۱۱۱) → خطای «معتبر نیست»",
  hasError(
    errorsOf(
      { ...baseCustomer, customer_type_id: 1, national_code: "1111111111" },
      { requireCustomerType: true },
    ),
    "معتبر نیست",
  ),
);

// ===== ۳) توابع کمکی =====
check("isValidIranNationalCode('1234567891') === true", isValidIranNationalCode("1234567891") === true);
check("isValidIranNationalCode('2234567890') === true", isValidIranNationalCode("2234567890") === true);
check("isValidIranNationalCode('1234567890') === false", isValidIranNationalCode("1234567890") === false);
check("isValidIranNationalCode('۱۲۳۴۵۶۷۸۹۱') === true (ارقام فارسی)", isValidIranNationalCode("۱۲۳۴۵۶۷۸۹۱") === true);
check("isValidIranNationalCode('') === false", isValidIranNationalCode("") === false);
check(
  "toEnglishDigits ارقام فارسی/عربی را تبدیل می‌کند",
  toEnglishDigits("۱۲۳۴۵٦۷۸۹۰") === "1234567890",
  toEnglishDigits("۱۲۳۴۵٦۷۸۹۰"),
);

// ===== ۴) رگرسیون: بقیهٔ اعتبارسنجی‌ها دست‌نخورده‌اند =====
check(
  "موبایل نامعتبر هنوز خطا می‌دهد",
  hasError(
    errorsOf({ ...baseCustomer, mobile_number: "0812345678", customer_type_id: 1 }, { requireCustomerType: true }),
    "موبایل",
  ),
);
check(
  "مشتری کامل و صحیح (با نوع + کد ملی) → بدون هیچ خطایی",
  errorsOf(
    {
      ...baseCustomer,
      customer_type_id: 1,
      national_code: "1234567891",
    },
    { requireCustomerType: true },
  ).length === 0,
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
