const AppSetting = require("../models/AppSetting");
const { successResponse, errorResponse } = require("../utils/response");

// ================================================================
// تنظیمات سراسری - تعریف کلیدهای مجاز و پیش‌فرض‌ها
// ================================================================
const KEY_DEFS = {
  auto_welcome_sms: {
    type: "boolean",
    default: true,
    title: "ارسال خودکار پیامک خوش‌آمدگویی پس از ثبت مشتری",
  },
  // ✅ لودر سیستمی: کلاسیک (دایرهٔ چرخان) یا لوگوی ستاره کیان
  loader_style: {
    type: "enum",
    options: ["classic", "logo"],
    default: "classic",
    title: "لودر سیستمی (کلاسیک / لوگوی ستاره کیان)",
  },
};

// کلیدهایی که برای کاربران مهمان (بدون ورود) هم قابل خواندن‌اند
// ⚠️ فقط تنظیمات نمایشی اینجا بیایند — هیچ دادهٔ حساسی نباید اضافه شود
const PUBLIC_KEYS = ["loader_style"];

const toStoredValue = (def, raw) => {
  if (def.type === "boolean") {
    return raw === true || raw === "true" || raw === 1 || raw === "1"
      ? "true"
      : "false";
  }
  if (def.type === "enum") {
    const value = String(raw ?? "").trim();
    return def.options.includes(value) ? value : String(def.default);
  }
  return String(raw ?? "");
};

const toApiValue = (def, stored) => {
  if (def.type === "boolean") return stored === "true";
  if (def.type === "enum") {
    const value = String(stored ?? "").trim();
    return def.options.includes(value) ? value : String(def.default);
  }
  return stored;
};

const buildSettingsObject = async () => {
  const rows = await AppSetting.findAll();
  const storedMap = {};
  (rows || []).forEach((r) => {
    storedMap[r.key] = r.value;
  });

  const output = {};
  for (const key of Object.keys(KEY_DEFS)) {
    const def = KEY_DEFS[key];
    const stored = storedMap[key] ?? String(def.default);
    output[key] = toApiValue(def, stored);
  }
  return output;
};

// ================================================================
// دریافت همه تنظیمات (هر کاربر لاگین‌شده)
// ================================================================
const getSettings = async (req, res) => {
  try {
    const data = await buildSettingsObject();
    successResponse(res, data, "تنظیمات دریافت شد");
  } catch (error) {
    console.error("❌ خطا در دریافت تنظیمات:", error);
    errorResponse(res, error.message, 500);
  }
};

// ================================================================
// بروزرسانی یک تنظیم (فقط مدیر میانی/اصلی/سوپر ادمین)
// ================================================================
const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const def = KEY_DEFS[key];
    if (!def) {
      return errorResponse(res, "کلید تنظیم نامعتبر است", 400);
    }

    const value = toStoredValue(def, req.body?.value);
    const userId = req.user?.id || null;

    let row = await AppSetting.findOne({ where: { key } });
    if (row) {
      await row.update({ value, updated_by: userId });
    } else {
      row = await AppSetting.create({ key, value, updated_by: userId });
    }

    successResponse(
      res,
      { key, value: toApiValue(def, value) },
      "تنظیم با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    console.error("❌ خطا در بروزرسانی تنظیم:", error);
    errorResponse(res, error.message, 500);
  }
};

// ================================================================
// دریافت تنظیمات نمایشی برای همه (بدون احراز هویت)
// ----------------------------------------------------------------
// دلیل وجود: سرور فرانت‌اند باید «لودر سیستمی» را قبل از اجرای هر JS
// و برای کاربران واردنشده هم بداند (تزریق در HTML).
// اگر دیتابیس در دسترس نباشد، به‌جای خطا مقدار پیش‌فرض برگردانده می‌شود
// تا صفحه‌ها بدون لودر نمانند.
// ================================================================
const getPublicSettings = async (req, res) => {
  try {
    const all = await buildSettingsObject();
    const output = {};
    PUBLIC_KEYS.forEach((key) => {
      output[key] = all[key];
    });
    successResponse(res, output, "تنظیمات نمایشی دریافت شد");
  } catch (error) {
    console.warn("⚠️ تنظیمات نمایشی خوانده نشد، پیش‌فرض ارسال شد:", error.message);
    const fallback = {};
    PUBLIC_KEYS.forEach((key) => {
      fallback[key] = KEY_DEFS[key]?.default;
    });
    successResponse(res, fallback, "تنظیمات نمایشی (پیش‌فرض) دریافت شد");
  }
};

module.exports = {
  getSettings,
  getPublicSettings,
  updateSetting,
  KEY_DEFS,
  PUBLIC_KEYS,
};
