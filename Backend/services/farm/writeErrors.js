// ============================================================
// services/farm/writeErrors.js
// خطای ساختاریافتهٔ «نوشتن فارم» — موج ۱۳.۱۲
// ------------------------------------------------------------
//  چرا این فایل؟
//   تا ۱۳.۱۱ منطق نوشتن داخل کنترلرهای کارشناس بود و هر کنترلر
//   خطا را با errorResponse(...) برمی‌گرداند. از ۱۳.۱۲ همان منطق
//   در services/farm/* نشسته و **دو** مصرف‌کننده دارد:
//     ۱) کنترلرهای کارشناس (همان پیام‌ها و همان کدهای قبلی)
//     ۲) اعمال درخواست مشتری پس از تأیید کارشناس
//        (services/portalRequestService)
//   اگر هر مصرف‌کننده خطای خودش را می‌ساخت، دو نسخهٔ پیام و دو نسخهٔ
//   کد وضعیت داشتیم. بنابراین خطا یک شکل دارد و کنترلر فقط آن را به
//   HTTP نگاشت می‌کند.
//
// 🔒 قواعد:
//   ۱) پیام‌های فارسیِ همین فایل **همان** پیام‌های پیش از ۱۳.۱۲ هستند
//      (تست farm-write-test همین را قفل می‌کند).
//   ۲) `status` همیشه عدد HTTP معتبر است؛ خطای ناشناخته ⇒ ۵۰۰.
//   ۳) `errors` فقط آرایهٔ اعتبارسنجی است (برای نمایش فهرست به کاربر).
// ============================================================
"use strict";

class FarmWriteError extends Error {
  constructor(message, status = 400, errors = null, code = "farm_write_error") {
    super(message || "خطا در ثبت اطلاعات");
    this.name = "FarmWriteError";
    this.status = status;
    this.errors = Array.isArray(errors) ? errors : null;
    this.code = code;
  }
}

// پرتاب سریع (به‌جای new در همه‌جای کد)
const fail = (message, status = 400, errors = null, code = "farm_write_error") => {
  throw new FarmWriteError(message, status, errors, code);
};

const isFarmWriteError = (error) => error instanceof FarmWriteError;

// نتیجهٔ validations/* ⇒ خطای یکدست (اولین پیام + فهرست کامل)
const failValidation = (validation, fallbackMessage) => {
  const errors =
    validation && Array.isArray(validation.errors) ? validation.errors : [];
  fail(
    errors[0] || fallbackMessage || "اطلاعات ارسال‌شده معتبر نیست",
    400,
    errors,
    "validation_failed",
  );
};

// خطای «رکورد تکراری» دیتابیس ⇒ پیام فارسی روشن (بدون جزئیات SQL)
// ⚠️ عمداً پرتاب نمی‌کند مگر همان خطای یونیک باشد؛ بقیه را رد می‌دهد.
const throwIfUnique = (error, message, status = 409) => {
  if (error && error.name === "SequelizeUniqueConstraintError") {
    fail(message, status, null, "duplicate_record");
  }
};

// نگاشت خطا به HTTP — تنها نقطه‌ای که کنترلرها استفاده می‌کنند
// (خطای ناشناخته ⇒ پیام عمومی ۵۰۰ تا جزئیات سرور لو نرود)
const httpErrorOf = (error, fallbackMessage) => {
  if (isFarmWriteError(error)) {
    return {
      message: error.message,
      status: error.status,
      errors: error.errors,
    };
  }
  return {
    message: fallbackMessage || (error && error.message) || "خطای داخلی سرور",
    status: 500,
    errors: null,
  };
};

module.exports = {
  FarmWriteError,
  fail,
  isFarmWriteError,
  failValidation,
  throwIfUnique,
  httpErrorOf,
};
