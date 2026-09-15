// utils/response.js
const successResponse = (
  res,
  data,
  message = "با موفقیت انجام شد",
  statusCode = 200,
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

// ✅ پیام امن برای خطاهای سمت سرور (۵xx)
// تا جزئیات دیتابیس/سرور برای کاربر نهایی لو نرود.
const SERVER_ERROR_MESSAGE =
  "خطای داخلی سرور رخ داد. لطفاً چند لحظه بعد دوباره تلاش کنید.";

const errorResponse = (
  res,
  message = "خطا رخ داده است",
  statusCode = 500,
  errors = null,
) => {
  // خطای سمت سرور همیشه در لاگ سرور ثبت می‌شود (برای دیباگ)
  if (statusCode >= 500) {
    console.error(`❌ [${statusCode}] ${message}`);
  }

  // در production متن خطای داخلی به کاربر نمایش داده نمی‌شود
  const isProduction = process.env.NODE_ENV === "production";
  const safeMessage =
    statusCode >= 500 && isProduction ? SERVER_ERROR_MESSAGE : message;

  return res.status(statusCode).json({
    success: false,
    message: safeMessage,
    errors,
    timestamp: new Date().toISOString(),
  });
};

module.exports = { successResponse, errorResponse, SERVER_ERROR_MESSAGE };
