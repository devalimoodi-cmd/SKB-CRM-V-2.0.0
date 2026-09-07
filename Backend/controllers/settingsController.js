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
};

const toStoredValue = (def, raw) => {
  if (def.type === "boolean") {
    return raw === true || raw === "true" || raw === 1 || raw === "1"
      ? "true"
      : "false";
  }
  return String(raw ?? "");
};

const toApiValue = (def, stored) => {
  if (def.type === "boolean") return stored === "true";
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

module.exports = {
  getSettings,
  updateSetting,
  KEY_DEFS,
};
