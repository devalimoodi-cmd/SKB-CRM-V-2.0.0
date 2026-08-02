const multer = require("multer");
const path = require("path");
const fs = require("fs");

// تابع ایجاد پوشه به صورت بازگشتی
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ============================================
// تنظیمات ذخیره فایل
// ============================================
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      // دریافت اطلاعات از body (قبل از multer باید تنظیم شود)
      const customerId = req.body.customer_id || "unknown";
      const visitDate =
        req.body.visit_date || new Date().toISOString().split("T")[0];

      // ایجاد مسیر: uploads/visit_reports/customer_{id}/YYYY/MM/DD/
      const baseDir = "uploads/visit_reports";
      const customerDir = path.join(baseDir, `customer_${customerId}`);
      const dateDir = path.join(customerDir, visitDate);

      // ایجاد پوشهها
      ensureDirectoryExists(dateDir);

      // ذخیره مسیر در req برای استفاده بعدی
      req.uploadPath = dateDir;

      cb(null, dateDir);
    } catch (error) {
      console.error("❌ خطا در ایجاد مسیر:", error);
      cb(error, "uploads/visit_reports");
    }
  },
  filename: function (req, file, cb) {
    try {
      const customerId = req.body.customer_id || "unknown";
      const visitDate =
        req.body.visit_date || new Date().toISOString().split("T")[0];
      const timestamp = Date.now();
      const random = Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);

      // نام فایل: customer_{id}_{date}_{timestamp}_{random}{ext}
      const fileName = `customer_${customerId}_${visitDate}_${timestamp}_${random}${ext}`;

      req.fileName = fileName;
      req.originalName = file.originalname;

      cb(null, fileName);
    } catch (error) {
      console.error("❌ خطا در ساخت نام فایل:", error);
      cb(error, file.originalname);
    }
  },
});

// ============================================
// فیلتر فایل
// ============================================
const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/x-msvideo",
    "video/quicktime",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "text/plain",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`فرمت فایل ${file.mimetype} مجاز نیست`), false);
  }
};

// تابع اصلاح نام فارسی (رفع مشکل encoding)
const fixUnicodeName = (name) => {
  if (!name) return name;
  try {
    const fixed = Buffer.from(name, "latin1").toString("utf8");
    if (!fixed.includes("\uFFFD")) return fixed;
  } catch (e) {}
  return name;
};

// ============================================
// ایجاد multer با محدودیتهای جداگانه:
// - ویدیو: حداکثر 500 مگابایت
// - سایر فایلها: حداکثر 15 مگابایت
// ============================================
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

module.exports = upload;
module.exports.fixUnicodeName = fixUnicodeName;
