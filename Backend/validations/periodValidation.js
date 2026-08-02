// validations/periodValidation.js

function validatePeriodData(data) {
  const errors = [];

  // 1. بررسی شناسه مشتری
  if (!data.customer_personal_information_id) {
    errors.push("شناسه مشتری الزامی است");
  }

  // 2. بررسی نام دوره
  if (!data.period_name || data.period_name.trim() === "") {
    errors.push("نام دوره الزامی است");
  } else if (data.period_name.length < 3) {
    errors.push("نام دوره باید حداقل 3 کاراکتر باشد");
  }

  // 3. بررسی تاریخ شروع (اجباری و بازه 7 روزه)
  if (!data.start_date) {
    errors.push("تاریخ شروع الزامی است");
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(data.start_date);
    const minDate = new Date(today);
    minDate.setDate(today.getDate() - 7);
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 7);

    if (startDate < minDate || startDate > maxDate) {
      errors.push(
        "تاریخ شروع باید بین یک هفته قبل و یک هفته بعد از امروز باشد",
      );
    }
  }

  // 4. بررسی تاریخ پایان (اختیاری، در صورت وجود باید بعد از شروع باشد)
  if (data.end_date) {
    if (!data.start_date) {
      errors.push("برای تعیین تاریخ پایان، ابتدا تاریخ شروع را مشخص کنید");
    } else if (new Date(data.end_date) <= new Date(data.start_date)) {
      errors.push("تاریخ پایان باید بعد از تاریخ شروع باشد");
    }
  }

  // 5. بررسی وضعیت (اختیاری)
  if (data.status) {
    const validStatuses = ["pending", "active", "completed", "cancelled"];
    if (!validStatuses.includes(data.status)) {
      errors.push("وضعیت نامعتبر است");
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}

module.exports = { validatePeriodData };
