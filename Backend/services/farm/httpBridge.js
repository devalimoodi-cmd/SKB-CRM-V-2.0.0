// ============================================================
// services/farm/httpBridge.js
// پل «خطای سرویس ⇒ پاسخ HTTP» — موج ۱۳.۱۲
// ------------------------------------------------------------
//  کنترلرها منطق نوشتن ندارند؛ فقط نتیجه/خطای سرویس را به پاسخ
//  Express تبدیل می‌کنند. این پل تضمین می‌کند همهٔ کنترلرها یک شکل
//  پاسخ خطا بدهند (پیام فارسی، کد وضعیت، فهرست خطاهای اعتبارسنجی).
// ============================================================
"use strict";

const { errorResponse } = require("../../utils/response");
const { httpErrorOf } = require("./writeErrors");

const sendFarmError = (res, error, fallbackMessage) => {
  const mapped = httpErrorOf(error, fallbackMessage);
  return errorResponse(res, mapped.message, mapped.status, mapped.errors);
};

module.exports = { sendFarmError };
