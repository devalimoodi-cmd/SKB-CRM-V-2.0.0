const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const ChickPlacement = require("../models/ChickPlacement");
const Unit = require("../models/Unit");
const WeeklyManagement = require("../models/WeeklyManagement");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { Op } = require("sequelize");

// ============================================
// توابع کمکی
// ============================================

const getFullName = (user) => {
  if (!user) return null;
  if (user.full_name) return user.full_name;
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.username || null;
};

const formatPersianDateTime = (date) => {
  if (!date) return null;
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch (e) {
    return null;
  }
};

// ============================================
// دریافت اطلاعات هدر مشتری
// ============================================
const getCustomerHeaderInfo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return errorResponse(res, "شناسه مشتری الزامی است", 400);
    }

    console.log(`📊 دریافت اطلاعات هدر مشتری ${id}...`);

    const customer = await CustomerPersonalInfo.findByPk(id, {
      attributes: [
        "id",
        "customer_code",
        "full_name",
        "farm_name",
        "collection_name",
        "mobile_number",
        "email",
        "province",
        "county",
        "active",
        "status",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
      ],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name", "username"],
        },
        {
          model: User,
          as: "updater",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
    });

    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    console.log(`👤 مشتری ${id} پیدا شد`);
    console.log(
      `📝 created_by: ${customer.created_by}, updated_by: ${customer.updated_by}`,
    );
    console.log(`📅 created_at: ${customer.created_at}`);
    console.log(`📅 updated_at: ${customer.updated_at}`);

    // ✅ ساخت اطلاعات ثبت‌کننده
    const creatorInfo = customer.creator
      ? {
          id: customer.creator.id,
          full_name: getFullName(customer.creator),
          username: customer.creator.username,
        }
      : null;

    // ✅ ساخت اطلاعات بروزرسانی‌کننده
    let updaterInfo = null;

    if (customer.updater) {
      updaterInfo = {
        id: customer.updater.id,
        full_name: getFullName(customer.updater),
        username: customer.updater.username,
      };
      console.log(`✅ updater از include: ${updaterInfo.full_name}`);
    } else if (customer.updated_by) {
      console.log(`🔍 جستجوی کاربر با ID: ${customer.updated_by}...`);
      const updaterUser = await User.findByPk(customer.updated_by, {
        attributes: ["id", "first_name", "last_name", "username"],
      });
      if (updaterUser) {
        updaterInfo = {
          id: updaterUser.id,
          full_name: getFullName(updaterUser),
          username: updaterUser.username,
        };
        console.log(
          `✅ اطلاعات بروزرسانی‌کننده از دیتابیس گرفته شد: ${updaterInfo.full_name}`,
        );
      } else {
        console.warn(`⚠️ کاربر با ID ${customer.updated_by} یافت نشد`);
      }
    }

    // ✅ فرمت تاریخ‌ها
    const registeredAtFormatted = formatPersianDateTime(customer.created_at);

    // ✅ بررسی آیا بروزرسانی واقعی انجام شده یا نه
    const timeDiff =
      customer.updated_at && customer.created_at
        ? new Date(customer.updated_at).getTime() -
          new Date(customer.created_at).getTime()
        : 0;

    const isTimeChanged = timeDiff > 2000;
    const isUserChanged =
      customer.updated_by &&
      customer.created_by &&
      customer.updated_by !== customer.created_by;
    const hasUpdatedBy =
      customer.updated_by !== null && customer.updated_by !== undefined;

    const isReallyUpdated =
      isTimeChanged || isUserChanged || (hasUpdatedBy && !customer.created_by);

    console.log(`📊 بررسی بروزرسانی:`);
    console.log(
      `  - timeDiff: ${timeDiff}ms (isTimeChanged: ${isTimeChanged})`,
    );
    console.log(`  - isUserChanged: ${isUserChanged}`);
    console.log(`  - hasUpdatedBy: ${hasUpdatedBy}`);
    console.log(
      `  - نتیجه: ${isReallyUpdated ? "بروزرسانی شده" : "بروزرسانی نشده"}`,
    );

    let updatedAtFormatted = null;
    let updaterDisplayName = null;

    if (isReallyUpdated && customer.updated_at) {
      updatedAtFormatted = formatPersianDateTime(customer.updated_at);
      updaterDisplayName =
        updaterInfo?.full_name || updaterInfo?.username || "نامشخص";
    }

    // ✅ اگر بروزرسانی شده ولی updaterInfo null است، از creatorInfo استفاده کن
    if (isReallyUpdated && !updaterInfo && creatorInfo) {
      updaterInfo = creatorInfo;
      updaterDisplayName =
        creatorInfo.full_name || creatorInfo.username || "نامشخص";
      console.log(
        `⚠️ از creator به عنوان fallback برای updater استفاده شد: ${updaterDisplayName}`,
      );
    }

    // ✅ آمار
    const totalHalls = await Hall.count({
      where: { customer_id: id, is_active: true },
    });

    const activeFlocks = await ChickPlacement.count({
      where: { customer_id: id, is_active: true },
    });

    const activeUnits = await Unit.count({
      where: {
        customer_personal_information_id: id,
        is_active: true,
      },
    });

    const chickPlacements = await ChickPlacement.findAll({
      where: { customer_id: id, is_active: true },
      attributes: ["id", "total_chicks_count"],
    });

    let totalChicks = 0;
    chickPlacements.forEach((item) => {
      totalChicks += parseInt(item.total_chicks_count) || 0;
    });

    // ✅ محاسبه جوجه‌های مانده (تعداد اولیه منهای تلفات تجمعی هفتگی)
    let totalRemainingChicks = totalChicks;
    const flockIds = chickPlacements.map((f) => f.id);
    if (flockIds.length > 0) {
      const mortalityRows = await WeeklyManagement.findAll({
        where: { chick_placement_id: { [Op.in]: flockIds } },
        attributes: ["chick_placement_id", "weekly_mortality"],
        raw: true,
      });

      const mortalityMap = {};
      mortalityRows.forEach((r) => {
        mortalityMap[r.chick_placement_id] =
          (mortalityMap[r.chick_placement_id] || 0) +
          (parseInt(r.weekly_mortality) || 0);
      });

      totalRemainingChicks = chickPlacements.reduce((sum, f) => {
        const initial = parseInt(f.total_chicks_count) || 0;
        const dead = mortalityMap[f.id] || 0;
        return sum + Math.max(0, initial - dead);
      }, 0);
    }

    // ✅ پاسخ نهایی
    const responseData = {
      customer: {
        id: customer.id,
        customer_code: customer.customer_code,
        full_name: customer.full_name,
        farm_name: customer.farm_name,
        collection_name: customer.collection_name,
        mobile_number: customer.mobile_number,
        email: customer.email,
        province: customer.province,
        county: customer.county,
        active: customer.active,
        status: customer.status,
        created_at: customer.created_at,
        registered_at_formatted: registeredAtFormatted || "نامشخص",
        updated_at: customer.updated_at,
        updated_at_formatted: updatedAtFormatted || null,
        is_updated: isReallyUpdated,
        created_by: customer.created_by,
        creator: creatorInfo,
        updated_by: customer.updated_by,
        updater: isReallyUpdated ? updaterInfo : null,
        updater_display_name: updaterDisplayName || null,
      },
      stats: {
        totalHalls: totalHalls || 0,
        activeFlocks: activeFlocks || 0,
        activeUnits: activeUnits || 0,
        totalChicks: totalChicks || 0,
        remainingChicks: totalRemainingChicks || 0,
      },
    };

    console.log(`✅ اطلاعات هدر مشتری ${id} با موفقیت دریافت شد`);
    console.log(`👤 ثبت‌کننده: ${creatorInfo?.full_name || "نامشخص"}`);
    console.log(`📅 تاریخ ثبت: ${registeredAtFormatted}`);
    console.log(
      `📅 وضعیت بروزرسانی: ${isReallyUpdated ? "بروزرسانی شده" : "بروزرسانی نشده"}`,
    );
    if (isReallyUpdated) {
      console.log(`✏️ بروزرسانی‌کننده: ${updaterDisplayName}`);
      console.log(`📅 تاریخ بروزرسانی: ${updatedAtFormatted}`);
    }

    successResponse(res, responseData, "اطلاعات هدر مشتری با موفقیت دریافت شد");
  } catch (error) {
    console.error("❌ خطا در دریافت اطلاعات هدر مشتری:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ✅ EXPORT - مهم: باید درست باشد
// ============================================
module.exports = {
  getCustomerHeaderInfo,
};
