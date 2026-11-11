// ============================================================
// middleware/permissions.js
// «کنترل دسترسی بر پایهٔ مجوز» (Permission-based access control)
// ------------------------------------------------------------
// • requirePermission("customers.delete")            → یک کلید
// • requirePermission("a", "b") / requireAnyPermission → هر یک از کلیدها
// • مجوزها در middleware/auth.js روی req.user.permissions ست می‌شوند
//   (کش ۳۰ ثانیه‌ای در services/permissionService.js)
//
// ⚠️ حالت امن (Dry-run):
//   اگر PERMISSIONS_ENFORCE=true نباشد، هیچ ۴۰۳ برگردانده نمی‌شود؛
//   فقط «چه کسی، چه کلیدی، کدام مسیر» در لاگ ثبت می‌شود تا قبل از
//   فعال‌سازی، اثر تغییرات را روی سرور واقعی ببینیم.
// ============================================================
"use strict";

const { getEffectivePermissions } = require("../services/permissionService");
const { PERMISSIONS } = require("../config/permissions");

const isEnforcing = () =>
  String(process.env.PERMISSIONS_ENFORCE || "false").toLowerCase() === "true";

// عنوان فارسی کلیدها (برای پیام قابل‌فهم به کاربر)
const titlesFor = (keys) =>
  keys.map((key) => PERMISSIONS[key]?.title).filter(Boolean);

// لاگ در حالت آزمایشی (فقط وقتی نتیجه ۴۰۳ می‌شد)
const logDryRun = (req, keys) => {
  if (isEnforcing()) return;
  console.warn(
    `🛡️ [permissions:dry-run] ${req.method} ${req.originalUrl} — نقش «${req.user?.role}» (${req.user?.id}) فاقد مجوز [${keys.join(
      ", ",
    )}] است`,
  );
};

// دریافت مجموعهٔ مجوزهای کاربر (از req.user یا محاسبهٔ دوباره)
const resolvePermissions = async (req) => {
  if (req.user?.permissions instanceof Set) return req.user.permissions;
  if (Array.isArray(req.user?.permissions)) return new Set(req.user.permissions);

  const { permissions } = await getEffectivePermissions(req.user);
  if (req.user) req.user.permissions = permissions;
  return permissions;
};

// ===== نیاز به یکی از کلیدهای داده‌شده =====
const requirePermission = (...keys) => {
  const wanted = keys.flat().filter(Boolean);

  const guard = async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "احراز هویت نشده است",
        });
      }

      // اگر کلیدی تعیین نشده باشد، فقط احراز هویت لازم است
      if (wanted.length === 0) return next();

      const permissions = await resolvePermissions(req);

      // سوپرادمین همیشه اجازه دارد (کنترل نهایی سیستم دست اوست)
      if (req.user.role === "super_admin") return next();

      if (wanted.some((key) => permissions.has(key))) return next();

      logDryRun(req, wanted);

      if (!isEnforcing()) return next();

      return res.status(403).json({
        success: false,
        // ✅ فرانت با این پرچم می‌فهمد «۴۰۳ = نبود مجوز» است (نه چیز دیگر)
        permissionDenied: true,
        message: "دسترسی شما به این عملیات بسته شده است",
        required: wanted,
        requiredTitles: titlesFor(wanted),
        role: req.user.role,
      });
    } catch (error) {
      console.error("❌ خطا در بررسی دسترسی:", error.message);
      // خطای داخلی نباید «دادن دسترسی» تلقی شود
      if (!isEnforcing()) return next();
      return res.status(500).json({
        success: false,
        message: "خطا در بررسی سطح دسترسی",
      });
    }
  };

  // ✅ ۱۳.۱۸: «نشانهٔ خوانا» برای گارد هم‌ترازی پورتال
  //    (config/portalSchema). فقط آزمون‌پذیری؛ رفتار میان‌افزار
  //    ذره‌ای عوض نمی‌شود (کلیدها همان‌ها هستند، فقط قابل خواندن‌اند).
  guard.__permissionKeys = Object.freeze([...wanted]);

  return guard;
};

// ===== نیاز به کلید، فقط برای یک نقش (بقیهٔ نقش‌ها بی‌بررسی رد می‌شوند) =====
// 🔒 چرا لازم شد (۱۳.۲۲): روت `/api/suggestions` هم «گفتگوی مشتری» است و هم
//    مودال پاکت پیام‌های هدر برای کارشناس/ادمین. کلید محتوا
//    `customer.portal.tickets` در کاتالوگ **فقط-مشتری** است (D.customerOnly)،
//    پس گیتِ عمومی `requirePermission(key)` مودال کارکنان را هم می‌بست.
//    این پوشش همان میان‌افزار را فقط برای نقش هدف اجرا می‌کند؛ بقیهٔ نقش‌ها
//    دقیقاً همان رفتار قبل از ۱۳.۲۲ را دارند (فقط `protect`).
const requireRolePermission = (role, ...keys) => {
  const inner = requirePermission(...keys);
  const onlyRoles = Object.freeze([String(role || "")].filter(Boolean));

  const guard = async (req, res, next) => {
    // کاربر احراز هویت‌نشده یا نقش دیگر ⇒ همان مسیر قبلی (بدون کلید)
    if (req.user && !onlyRoles.includes(String(req.user.role))) return next();
    return inner(req, res, next);
  };

  // ✅ همان نشانه‌های خوانا برای گاردهای هم‌ترازی (رفتار عوض نمی‌شود)
  guard.__permissionKeys = inner.__permissionKeys;
  guard.__onlyRoles = onlyRoles;

  return guard;
};

// خوانا‌تر: چند کلید، یکی کافی است
const requireAnyPermission = (...keys) => requirePermission(...keys);

// آیا کاربر جاری این مجوز را دارد؟ (برای استفادهٔ درون کنترلرها)
const userHasPermission = async (req, permissionKey) => {
  if (!req?.user) return false;
  if (req.user.role === "super_admin") return true;
  const permissions = await resolvePermissions(req);
  return permissions.has(permissionKey);
};

module.exports = {
  requirePermission,
  requireAnyPermission,
  requireRolePermission,
  userHasPermission,
  isEnforcing,
};
