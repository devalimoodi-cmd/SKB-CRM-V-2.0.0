const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = "uploads/visit_reports";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

// تابع اصلاح نام فارسی (رفع مشکل encoding)
const fixUnicodeName = (name) => {
  if (!name) return name;
  try {
    // اگر به صورت latin1 ذخیره شده بود، به utf8 تبدیل کن
    const fixed = Buffer.from(name, "latin1").toString("utf8");
    // اگر تبدیل موفق و قابل نمایش بود از آن استفاده کن
    if (!fixed.includes("\uFFFD")) return fixed;
  } catch (e) {}
  return name;
};

// فیلتر فایل‌ها: همه انواع مجاز
const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "image/gif",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/x-msvideo",
    "video/quicktime",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/csv",
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
    "text/plain",
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("فرمت فایل مجاز نیست"), false);
};

module.exports = {
  // محدودیت‌ها:
  // - ویدیو: حداکثر 500 مگابایت
  // - سایر فایل‌ها: حداکثر 15 مگابایت
  upload: multer({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB برای ویدیوها
  }),
  uploadOther: multer({
    storage,
    fileFilter,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB برای سایر
  }),
  fixUnicodeName,
};
