const Bookmark = require("../models/Bookmark");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const ChickPlacement = require("../models/ChickPlacement");
const Unit = require("../models/Unit");
const User = require("../models/User");
const Flock = require("../models/Flock");
const Hall = require("../models/Hall");
const { successResponse, errorResponse } = require("../utils/response");
const { Op } = require("sequelize");

// include اشتراکی برای نمایش گله/دوره (flocks) + سالن اختیاری
const bookmarkPeriodInclude = () => [
  {
    model: Flock,
    as: "flockPeriod",
    attributes: ["id", "flock_number", "placement_date", "status", "ended_at"],
  },
  {
    model: ChickPlacement,
    as: "hallPlacement",
    attributes: ["id", "flock_number", "placement_date", "is_active"],
    include: [{ model: Hall, attributes: ["id", "hall_name"] }],
  },
];

// ============================================================
// دریافت لیست بوکمارک‌ها (با فیلتر)
// ============================================================
const getBookmarks = async (req, res) => {
  try {
    const {
      type,
      status,
      priority,
      customer_id,
      flock_id,
      unit_id,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {};

    // فیلترهای اصلی
    if (type) where.type = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (customer_id) where.customer_id = customer_id;
    if (flock_id) where.flock_id = flock_id;
    if (unit_id) where.unit_id = unit_id;

    // جستجو در عنوان و توضیحات
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    // فقط بوکمارک‌های کاربر جاری
    where.created_by = req.user.id;

    const offset = (page - 1) * limit;

    const { count, rows } = await Bookmark.findAndCountAll({
      where,
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number", "placement_date", "is_active"],
        },
        ...bookmarkPeriodInclude(),
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name", "address", "is_active"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name", "username"],
        },
        {
          model: User,
          as: "assignee",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [
        ["priority", "DESC"],
        ["created_at", "DESC"],
      ],
    });

    successResponse(
      res,
      {
        bookmarks: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست بوکمارک‌ها دریافت شد",
    );
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// دریافت یک بوکمارک با ID
// ============================================================
const getBookmarkById = async (req, res) => {
  try {
    const { id } = req.params;

    const bookmark = await Bookmark.findOne({
      where: { id, created_by: req.user.id },
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number", "placement_date"],
        },
        ...bookmarkPeriodInclude(),
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name", "address"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
    });

    if (!bookmark) {
      return errorResponse(res, "بوکمارک یافت نشد", 404);
    }

    successResponse(res, bookmark, "اطلاعات بوکمارک دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// ایجاد بوکمارک جدید
// ============================================================
const createBookmark = async (req, res) => {
  try {
    const {
      title,
      description,
      type,
      customer_id,
      flock_id,
      flock_period_id,
      hall_id,
      unit_id,
      week_number,
      flock_age_days,
      due_date,
      priority,
      assigned_to,
    } = req.body;

    // اعتبارسنجی
    if (!title) {
      return errorResponse(res, "عنوان بوکمارک الزامی است", 400);
    }

    if (!customer_id) {
      return errorResponse(res, "انتخاب مشتری الزامی است", 400);
    }

    // بررسی وجود مشتری
    const customer = await CustomerPersonalInfo.findByPk(customer_id);
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    // اگر گله/دوره (flocks) مشخص شده، بررسی و اعتبارسنجی
    let flockPeriodId = flock_period_id || null;
    if (flockPeriodId) {
      const fp = await Flock.findByPk(flockPeriodId);
      if (!fp) {
        return errorResponse(res, "گله/دوره یافت نشد", 404);
      }
      if (parseInt(fp.customer_id) !== parseInt(customer_id)) {
        return errorResponse(res, "گله متعلق به این مشتری نیست", 400);
      }
      flockPeriodId = fp.id;
    }

    // اگر سالن (اختیاری) مشخص شده، بررسی تعلق به گله
    let hallPlacementId = hall_id || null;
    if (hallPlacementId) {
      const hp = await ChickPlacement.findByPk(hallPlacementId);
      if (!hp) {
        return errorResponse(res, "سالن/جوجه‌ریزی یافت نشد", 404);
      }
      if (parseInt(hp.customer_id) !== parseInt(customer_id)) {
        return errorResponse(res, "سالن متعلق به این مشتری نیست", 400);
      }
      if (!flockPeriodId) {
        flockPeriodId = hp.flock_id || null;
      } else if (hp.flock_id && parseInt(hp.flock_id) !== parseInt(flockPeriodId)) {
        return errorResponse(res, "سالن انتخاب‌شده عضو این گله نیست", 400);
      }
      hallPlacementId = hp.id;
    }

    // اگر گله قدیمی (per سالن) مشخص شده، بررسی وجود گله
    if (flock_id) {
      const flock = await ChickPlacement.findByPk(flock_id);
      if (!flock) {
        return errorResponse(res, "گله یافت نشد", 404);
      }
    }

    // اگر واحد مشخص شده، بررسی وجود واحد
    if (unit_id) {
      const unit = await Unit.findByPk(unit_id);
      if (!unit) {
        return errorResponse(res, "واحد یافت نشد", 404);
      }
    }

    // اگر نوع یادآوری است، تاریخ سررسید الزامی است
    if (type === "reminder" && !due_date) {
      return errorResponse(res, "تاریخ سررسید برای یادآوری الزامی است", 400);
    }

    const bookmark = await Bookmark.create({
      title,
      description: description || null,
      type: type || "bookmark",
      customer_id,
      flock_id: flock_id || null,
      flock_period_id: flockPeriodId,
      hall_id: hallPlacementId,
      unit_id: unit_id || null,
      week_number: week_number || null,
      flock_age_days: flock_age_days || null,
      due_date: due_date || null,
      priority: priority || "medium",
      status: "active",
      created_by: req.user.id,
      assigned_to: assigned_to || req.user.id,
    });

    // دریافت اطلاعات کامل بوکمارک
    const createdBookmark = await Bookmark.findByPk(bookmark.id, {
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name"],
        },
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number"],
        },
        ...bookmarkPeriodInclude(),
      ],
    });

    successResponse(res, createdBookmark, "بوکمارک با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// بروزرسانی بوکمارک
// ============================================================
const updateBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      type,
      customer_id,
      flock_id,
      flock_period_id,
      hall_id,
      unit_id,
      week_number,
      flock_age_days,
      due_date,
      priority,
      status,
      assigned_to,
    } = req.body;

    const bookmark = await Bookmark.findOne({
      where: { id, created_by: req.user.id },
    });

    if (!bookmark) {
      return errorResponse(res, "بوکمارک یافت نشد", 404);
    }

    // اگر نوع به یادآوری تغییر کرد، تاریخ سررسید الزامی است
    if (type === "reminder" && !due_date) {
      return errorResponse(res, "تاریخ سررسید برای یادآوری الزامی است", 400);
    }

    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (type) updateData.type = type;
    if (customer_id) updateData.customer_id = customer_id;
    if (flock_id !== undefined) updateData.flock_id = flock_id;
    if (flock_period_id !== undefined) updateData.flock_period_id = flock_period_id;
    if (hall_id !== undefined) updateData.hall_id = hall_id;
    if (unit_id !== undefined) updateData.unit_id = unit_id;
    if (week_number !== undefined) updateData.week_number = week_number;
    if (flock_age_days !== undefined)
      updateData.flock_age_days = flock_age_days;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;
    if (assigned_to) updateData.assigned_to = assigned_to;

    // اگر وضعیت به read تغییر کرد، تاریخ خوانده شدن ثبت شود
    if (status === "read" && bookmark.status !== "read") {
      updateData.read_at = new Date();
    }

    // اگر وضعیت به completed تغییر کرد، تاریخ انجام ثبت شود
    if (status === "completed" && bookmark.status !== "completed") {
      updateData.completed_at = new Date();
    }

    await bookmark.update(updateData);

    const updatedBookmark = await Bookmark.findByPk(id, {
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
        },
        ...bookmarkPeriodInclude(),
      ],
    });

    successResponse(res, updatedBookmark, "بوکمارک با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// تغییر وضعیت بوکمارک
// ============================================================
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return errorResponse(res, "وضعیت جدید را وارد کنید", 400);
    }

    const validStatuses = [
      "active",
      "read",
      "completed",
      "archived",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, "وضعیت نامعتبر است", 400);
    }

    const bookmark = await Bookmark.findOne({
      where: { id, created_by: req.user.id },
    });

    if (!bookmark) {
      return errorResponse(res, "بوکمارک یافت نشد", 404);
    }

    const updateData = { status };

    if (status === "read") {
      updateData.read_at = new Date();
    }

    if (status === "completed") {
      updateData.completed_at = new Date();
    }

    await bookmark.update(updateData);

    successResponse(res, bookmark, "وضعیت بوکمارک با موفقیت تغییر کرد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// حذف بوکمارک
// ============================================================
const deleteBookmark = async (req, res) => {
  try {
    const { id } = req.params;

    const bookmark = await Bookmark.findOne({
      where: { id, created_by: req.user.id },
    });

    if (!bookmark) {
      return errorResponse(res, "بوکمارک یافت نشد", 404);
    }

    await bookmark.destroy();

    successResponse(res, null, "بوکمارک با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// دریافت آمار بوکمارک‌ها
// ============================================================
const getBookmarkStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const total = await Bookmark.count({
      where: { created_by: userId },
    });

    const active = await Bookmark.count({
      where: { created_by: userId, status: "active" },
    });

    const read = await Bookmark.count({
      where: { created_by: userId, status: "read" },
    });

    const completed = await Bookmark.count({
      where: { created_by: userId, status: "completed" },
    });

    const bookmarks = await Bookmark.count({
      where: { created_by: userId, type: "bookmark" },
    });

    const reminders = await Bookmark.count({
      where: { created_by: userId, type: "reminder" },
    });

    const critical = await Bookmark.count({
      where: { created_by: userId, priority: "critical", status: "active" },
    });

    successResponse(
      res,
      {
        total,
        active,
        read,
        completed,
        bookmarks,
        reminders,
        critical,
      },
      "آمار بوکمارک‌ها دریافت شد",
    );
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  getBookmarks,
  getBookmarkById,
  createBookmark,
  updateBookmark,
  changeStatus,
  deleteBookmark,
  getBookmarkStats,
};
