const VisitReportHall = require("../models/VisitReportHall");
const VisitReportExpert = require("../models/VisitReportExpert");
const VisitReport = require("../models/VisitReport");
const VisitReportAttachment = require("../models/VisitReportAttachment");
const Hall = require("../models/Hall");
const Period = require("../models/Period");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { fixUnicodeName } = require("../middleware/upload");
const { sequelize } = require("../config/database");
const fs = require("fs");
const path = require("path");

// ========== ایجاد گزارش جدید ==========
// ========== ایجاد گزارش جدید ==========
// ========== ایجاد گزارش جدید ==========
// ========== ایجاد گزارش جدید ==========
const createVisitReport = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      customer_id,
      period_id,
      visit_date,
      forward_to,
      report_text,
      hall_ids,
      expert_ids,
    } = req.body;

    // اعتبارسنجی
    if (!customer_id || !visit_date || !report_text) {
      return errorResponse(
        res,
        "customer_id, visit_date و report_text الزامی هستند",
        400,
      );
    }

    // پردازش hall_ids
    let hallIdArray = [];
    if (hall_ids) {
      if (Array.isArray(hall_ids)) {
        hallIdArray = hall_ids;
      } else if (typeof hall_ids === "string") {
        try {
          hallIdArray = JSON.parse(hall_ids);
        } catch (e) {
          hallIdArray = hall_ids.split(",").map(Number);
        }
      }
    }

    // پردازش expert_ids
    let expertIdArray = [];
    if (expert_ids) {
      if (Array.isArray(expert_ids)) {
        expertIdArray = expert_ids;
      } else if (typeof expert_ids === "string") {
        try {
          expertIdArray = JSON.parse(expert_ids);
        } catch (e) {
          expertIdArray = expert_ids.split(",").map(Number);
        }
      }
    }

    // حذف مقادیر نامعتبر
    hallIdArray = hallIdArray.filter((id) => id && !isNaN(id));
    expertIdArray = expertIdArray.filter((id) => id && !isNaN(id));

    // ایجاد گزارش
    const report = await VisitReport.create(
      {
        customer_id: parseInt(customer_id),
        period_id: period_id ? parseInt(period_id) : null,
        visit_date,
        forward_to: forward_to || null,
        report_text,
        status: "unread",
        created_by: req.user.id,
      },
      { transaction },
    );

    // ذخیره سالن‌ها
    if (hallIdArray.length > 0) {
      const hallRecords = hallIdArray.map((hid) => ({
        visit_report_id: report.id,
        hall_id: hid,
      }));
      await VisitReportHall.bulkCreate(hallRecords, { transaction });
    }

    // ذخیره کارشناسان
    if (expertIdArray.length > 0) {
      const expertRecords = expertIdArray.map((eid) => ({
        visit_report_id: report.id,
        expert_id: eid,
      }));
      await VisitReportExpert.bulkCreate(expertRecords, { transaction });
    }

    // ✅ ذخیره فایل‌های پیوست با مسیرهای جدید
    const files = req.files || [];
    if (files.length > 0) {
      const attachments = files.map((file) => ({
        visit_report_id: report.id,
        file_name: fixUnicodeName(file.originalname), // نام اصلی
        file_path: file.path, // مسیر کامل
        file_size: file.size,
        mime_type: file.mimetype,
        stored_name: file.filename, // نام ذخیره شده
      }));
      await VisitReportAttachment.bulkCreate(attachments, { transaction });
    }

    await transaction.commit();
    successResponse(res, { reportId: report.id }, "گزارش بازدید ثبت شد", 201);
  } catch (error) {
    await transaction.rollback();
    if (req.files && req.files.length > 0) {
      req.files.forEach((f) => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    console.error("خطا در ایجاد گزارش:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== ویرایش گزارش ==========
// ========== ویرایش گزارش ==========
// ========== ویرایش گزارش ==========
const updateVisitReport = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    let {
      period_id,
      visit_date,
      forward_to,
      report_text,
      hall_ids,
      expert_ids,
      keep_attachment_ids,
    } = req.body;

    // پردازش hall_ids
    let hallIdArray = [];
    if (hall_ids) {
      if (Array.isArray(hall_ids)) {
        hallIdArray = hall_ids;
      } else if (typeof hall_ids === "string") {
        try {
          hallIdArray = JSON.parse(hall_ids);
        } catch (e) {
          hallIdArray = hall_ids.split(",").map(Number);
        }
      }
    }

    // پردازش expert_ids
    let expertIdArray = [];
    if (expert_ids) {
      if (Array.isArray(expert_ids)) {
        expertIdArray = expert_ids;
      } else if (typeof expert_ids === "string") {
        try {
          expertIdArray = JSON.parse(expert_ids);
        } catch (e) {
          expertIdArray = expert_ids.split(",").map(Number);
        }
      }
    }

    // حذف مقادیر نامعتبر
    hallIdArray = hallIdArray.filter((id) => id && !isNaN(id));
    expertIdArray = expertIdArray.filter((id) => id && !isNaN(id));

    // پیدا کردن گزارش
    const report = await VisitReport.findByPk(id, {
      include: [
        {
          model: VisitReportAttachment,
          as: "attachments", // ✅ این خط رو اضافه کن
        },
      ],
      transaction,
    });

    if (!report) {
      await transaction.rollback();
      return errorResponse(res, "گزارش یافت نشد", 404);
    }

    // به‌روزرسانی فیلدها
    await report.update(
      {
        period_id: period_id || null,
        visit_date: visit_date,
        forward_to: forward_to || null,
        report_text: report_text,
      },
      { transaction },
    );

    // به‌روزرسانی سالن‌ها
    await VisitReportHall.destroy({
      where: { visit_report_id: id },
      transaction,
    });
    if (hallIdArray && hallIdArray.length > 0) {
      const hallRecords = hallIdArray.map((hid) => ({
        visit_report_id: id,
        hall_id: hid,
      }));
      await VisitReportHall.bulkCreate(hallRecords, { transaction });
    }

    // به‌روزرسانی کارشناسان
    await VisitReportExpert.destroy({
      where: { visit_report_id: id },
      transaction,
    });
    if (expertIdArray && expertIdArray.length > 0) {
      const expertRecords = expertIdArray.map((eid) => ({
        visit_report_id: id,
        expert_id: eid,
      }));
      await VisitReportExpert.bulkCreate(expertRecords, { transaction });
    }

    // ✅ مدیریت فایل‌های پیوست
    // 1. پردازش keep_attachment_ids
    let keepIds = [];
    if (keep_attachment_ids) {
      if (Array.isArray(keep_attachment_ids)) {
        keepIds = keep_attachment_ids;
      } else if (typeof keep_attachment_ids === "string") {
        try {
          keepIds = JSON.parse(keep_attachment_ids);
        } catch (e) {
          keepIds = keep_attachment_ids.split(",").map(Number);
        }
      }
    }
    keepIds = keepIds.filter((id) => id && !isNaN(id));

    // 2. حذف فایل‌هایی که در keepIds نیستند
    const attachmentsToDelete = report.attachments.filter(
      (att) => !keepIds.includes(att.id),
    );

    for (const att of attachmentsToDelete) {
      if (fs.existsSync(att.file_path)) {
        fs.unlinkSync(att.file_path);
      }
      await att.destroy({ transaction });
    }

    // 3. اضافه کردن فایل‌های جدید
    const files = req.files || [];
    if (files.length > 0) {
      const attachments = files.map((file) => ({
        visit_report_id: id,
        file_name: fixUnicodeName(file.originalname),
        file_path: file.path,
        file_size: file.size,
        mime_type: file.mimetype,
      }));
      await VisitReportAttachment.bulkCreate(attachments, { transaction });
    }

    await transaction.commit();
    successResponse(res, { reportId: id }, "گزارش بازدید با موفقیت ویرایش شد");
  } catch (error) {
    await transaction.rollback();
    if (req.files && req.files.length > 0) {
      req.files.forEach((f) => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    console.error("خطا در ویرایش گزارش:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== دریافت گزارش با ID ==========
// ========== دریافت گزارش با ID ==========
// ========== دریافت گزارش با ID ==========
const getVisitReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await VisitReport.findByPk(id, {
      include: [
        {
          model: Period,
          as: "Period",
          attributes: [
            "id",
            "period_name",
            "period_number",
            "start_date",
            "end_date",
            "status",
          ],
        },
        {
          model: Hall,
          through: { attributes: [] },
          attributes: ["id", "hall_name"],
        },
        {
          model: User,
          as: "experts",
          through: { attributes: [] },
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: VisitReportAttachment,
          as: "attachments",
          attributes: [
            "id",
            "file_name",
            "file_path",
            "file_size",
            "mime_type",
          ],
        },
        {
          // ✅ اضافه کردن ارتباط با کاربر ثبت‌کننده
          model: User,
          as: "CreatedBy",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
    });

    if (!report) {
      return errorResponse(res, "گزارش یافت نشد", 404);
    }

    successResponse(res, report);
  } catch (error) {
    console.error("خطا در دریافت گزارش:", error);
    errorResponse(res, error.message, 500);
  }
};
// ========== تغییر وضعیت گزارش ==========
const updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["read", "unread"].includes(status)) {
      return errorResponse(res, "وضعیت باید read یا unread باشد", 400);
    }
    const report = await VisitReport.findByPk(req.params.id);
    if (!report) return errorResponse(res, "گزارش یافت نشد", 404);
    await report.update({ status });
    successResponse(res, report, "وضعیت گزارش به‌روز شد");
  } catch (error) {
    errorResponse(res, error.message);
  }
};

// ========== دانلود فایل پیوست ==========
const downloadAttachment = async (req, res) => {
  try {
    const { id } = req.params;

    const attachment = await VisitReportAttachment.findByPk(id);
    if (!attachment) {
      return errorResponse(res, "فایل یافت نشد", 404);
    }

    const filePath = path.join(__dirname, "..", attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return errorResponse(res, "فایل روی سرور یافت نشد", 404);
    }

    res.download(filePath, attachment.file_name);
  } catch (error) {
    console.error("خطا در دانلود فایل:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== حذف فایل پیوست ==========
const deleteAttachment = async (req, res) => {
  try {
    const { id } = req.params;

    const attachment = await VisitReportAttachment.findByPk(id);
    if (!attachment) {
      return errorResponse(res, "فایل یافت نشد", 404);
    }

    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    await attachment.destroy();
    successResponse(res, null, "فایل با موفقیت حذف شد");
  } catch (error) {
    console.error(error);
    errorResponse(res, error.message, 500);
  }
};

// ========== حذف گزارش ==========
const deleteVisitReport = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    // ✅ استفاده از alias 'attachments' در include
    const report = await VisitReport.findByPk(id, {
      include: [
        {
          model: VisitReportAttachment,
          as: "attachments", // ✅ این خط رو اضافه کن
        },
      ],
      transaction,
    });

    if (!report) {
      await transaction.rollback();
      return errorResponse(res, "گزارش یافت نشد", 404);
    }

    // حذف فایل‌های پیوست از دیسک
    if (report.attachments && report.attachments.length > 0) {
      for (const att of report.attachments) {
        if (fs.existsSync(att.file_path)) {
          fs.unlinkSync(att.file_path);
        }
      }
    }

    // حذف گزارش
    await report.destroy({ transaction });

    await transaction.commit();
    successResponse(res, null, "گزارش و پیوست‌ها حذف شدند");
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در حذف گزارش:", error);
    errorResponse(res, error.message, 500);
  }
};
// ========== دریافت همه گزارش‌های یک مشتری ==========
// ============================================
// دریافت همه گزارش‌های یک مشتری
// ============================================
// ========== دریافت همه گزارش‌های یک مشتری ==========
// ========== دریافت همه گزارش‌های یک مشتری ==========
const getReportsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    console.log("📥 دریافت گزارش‌های مشتری:", customerId);

    if (!customerId) {
      return errorResponse(res, "شناسه مشتری الزامی است", 400);
    }

    const reports = await VisitReport.findAll({
      where: { customer_id: customerId },
      attributes: [
        "id",
        "customer_id",
        "period_id",
        "visit_date",
        "forward_to",
        "report_text",
        "status",
        "created_by",
        "created_at",
        "updated_at", // ✅ اضافه کردن created_at و updated_at
      ],
      include: [
        {
          model: Period,
          as: "Period",
          attributes: [
            "id",
            "period_name",
            "period_number",
            "start_date",
            "end_date",
            "status",
          ],
          required: false,
        },
        {
          model: Hall,
          through: { attributes: [] },
          attributes: ["id", "hall_name"],
          required: false,
        },
        {
          model: User,
          as: "experts",
          through: { attributes: [] },
          attributes: ["id", "first_name", "last_name"],
          required: false,
        },
        {
          model: VisitReportAttachment,
          as: "attachments",
          attributes: [
            "id",
            "file_name",
            "file_path",
            "file_size",
            "mime_type",
          ],
          required: false,
        },
        {
          model: User,
          as: "CreatedBy",
          attributes: ["id", "first_name", "last_name", "username"],
          required: false,
        },
      ],
      order: [["visit_date", "DESC"]],
    });

    console.log(`✅ ${reports.length} گزارش یافت شد`);

    successResponse(res, reports, "گزارش‌های بازدید دریافت شد");
  } catch (error) {
    console.error("❌ خطا در دریافت گزارش‌ها:", error);
    errorResponse(res, error.message || "خطا در دریافت گزارش‌ها", 500);
  }
};
module.exports = {
  createVisitReport,
  updateVisitReport,
  getVisitReportById,
  getReportsByCustomer,
  updateReportStatus,
  deleteVisitReport,
  downloadAttachment,
  deleteAttachment,
  getReportsByCustomer,
};

