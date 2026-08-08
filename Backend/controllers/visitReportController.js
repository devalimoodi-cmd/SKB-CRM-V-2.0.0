const VisitReportHall = require("../models/VisitReportHall");
const VisitReportExpert = require("../models/VisitReportExpert");
const VisitReport = require("../models/VisitReport");
const VisitReportAttachment = require("../models/VisitReportAttachment");
const Hall = require("../models/Hall");
const Unit = require("../models/Unit");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { fixUnicodeName } = require("../middleware/upload");
const { sequelize } = require("../config/database");
const fs = require("fs");
const path = require("path");

// ========== ایجاد گزارش جدید ==========
const createVisitReport = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      customer_id,
      unit_id,
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
        unit_id: unit_id ? parseInt(unit_id) : null,
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
const updateVisitReport = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    let {
      unit_id,
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
    hallIdArray = hallIdArray.filter((id) => id && !isNaN(id));

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
    expertIdArray = expertIdArray.filter((id) => id && !isNaN(id));

    // پردازش keep_attachment_ids
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

    // پیدا کردن گزارش
    const report = await VisitReport.findByPk(id);
    if (!report) {
      await transaction.rollback();
      return errorResponse(res, "گزارش یافت نشد", 404);
    }

    // به‌روزرسانی اطلاعات اصلی
    await report.update(
      {
        unit_id: unit_id || null,
        visit_date: visit_date || report.visit_date,
        forward_to: forward_to || null,
        report_text: report_text || report.report_text,
      },
      { transaction },
    );

    // به‌روزرسانی سالن‌ها (حذف قدیمی و ایجاد جدید)
    if (hallIdArray.length > 0) {
      await VisitReportHall.destroy({
        where: { visit_report_id: id },
        transaction,
      });
      const hallRecords = hallIdArray.map((hid) => ({
        visit_report_id: id,
        hall_id: hid,
      }));
      await VisitReportHall.bulkCreate(hallRecords, { transaction });
    }

    // به‌روزرسانی کارشناسان
    if (expertIdArray.length > 0) {
      await VisitReportExpert.destroy({
        where: { visit_report_id: id },
        transaction,
      });
      const expertRecords = expertIdArray.map((eid) => ({
        visit_report_id: id,
        expert_id: eid,
      }));
      await VisitReportExpert.bulkCreate(expertRecords, { transaction });
    }

    // مدیریت پیوست‌ها
    // حذف پیوست‌هایی که در keep_attachment_ids نیستند
    const existingAttachments = await VisitReportAttachment.findAll({
      where: { visit_report_id: id },
      transaction,
    });

    for (const att of existingAttachments) {
      if (!keepIds.includes(att.id)) {
        if (fs.existsSync(att.file_path)) {
          fs.unlinkSync(att.file_path);
        }
        await att.destroy({ transaction });
      }
    }

    // ذخیره فایل‌های جدید
    const files = req.files || [];
    if (files.length > 0) {
      const attachments = files.map((file) => ({
        visit_report_id: id,
        file_name: fixUnicodeName(file.originalname),
        file_path: file.path,
        file_size: file.size,
        mime_type: file.mimetype,
        stored_name: file.filename,
      }));
      await VisitReportAttachment.bulkCreate(attachments, { transaction });
    }

    await transaction.commit();
    successResponse(res, { reportId: id }, "گزارش بازدید ویرایش شد");
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

// ========== دریافت لیست گزارش‌ها ==========
const getVisitReports = async (req, res) => {
  try {
    const {
      customer_id,
      unit_id,
      visit_date,
      status,
      sort = "visit_date",
      order = "DESC",
      page = 1,
      limit = 20,
    } = req.query;
    const where = {};

    if (customer_id) where.customer_id = parseInt(customer_id);
    if (unit_id) where.unit_id = parseInt(unit_id);
    if (visit_date) where.visit_date = visit_date;
    if (status) where.status = status;

    const validSortFields = [
      "id",
      "visit_date",
      "created_at",
      "customer_id",
      "unit_id",
      "forward_to",
      "status",
    ];
    const sortField = validSortFields.includes(sort) ? sort : "visit_date";
    const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const offset = (page - 1) * limit;

    const { count, rows } = await VisitReport.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortField, sortOrder]],
      include: [
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
        {
          model: User,
          as: "experts",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: User,
          as: "CreatedBy",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: VisitReportAttachment,
          as: "attachments",
          attributes: ["id", "file_name", "file_path"],
          required: false,
        },
      ],
    });

    successResponse(
      res,
      {
        reports: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست گزارش‌های بازدید دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت گزارش‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== دریافت یک گزارش ==========
const getVisitReportById = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await VisitReport.findByPk(id, {
      include: [
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
        {
          model: User,
          as: "experts",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: User,
          as: "CreatedBy",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: VisitReportAttachment,
          as: "attachments",
          attributes: [
            "id",
            "file_name",
            "file_path",
            "mime_type",
            "file_size",
            "stored_name",
          ],
          required: false,
        },
      ],
    });

    if (!report) {
      return errorResponse(res, "گزارش یافت نشد", 404);
    }

    successResponse(res, report, "گزارش بازدید دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت گزارش:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== دریافت همه گزارش‌های یک مشتری ==========
const getReportsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return errorResponse(res, "شناسه مشتری الزامی است", 400);
    }

    const reports = await VisitReport.findAll({
      where: { customer_id: customerId },
      include: [
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
        {
          model: User,
          as: "CreatedBy",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: VisitReportAttachment,
          as: "attachments",
          attributes: ["id", "file_name", "file_path"],
          required: false,
        },
      ],
      order: [["visit_date", "DESC"]],
    });

    successResponse(res, reports, "لیست گزارش‌های مشتری دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== تغییر وضعیت گزارش ==========
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return errorResponse(res, "وضعیت جدید ارسال نشده است", 400);
    }

    const validStatuses = ["unread", "read", "archived"];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, "وضعیت نامعتبر است", 400);
    }

    const report = await VisitReport.findByPk(id);
    if (!report) {
      return errorResponse(res, "گزارش یافت نشد", 404);
    }

    await report.update({ status });
    successResponse(res, report, "وضعیت گزارش بروزرسانی شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== دانلود فایل پیوست ==========
const downloadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const attachment = await VisitReportAttachment.findByPk(id);

    if (!attachment) {
      return errorResponse(res, "فایل پیوست یافت نشد", 404);
    }

    if (!fs.existsSync(attachment.file_path)) {
      return errorResponse(res, "فایل پیوست در سرور یافت نشد", 404);
    }

    res.download(attachment.file_path, attachment.file_name);
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
      return errorResponse(res, "فایل پیوست یافت نشد", 404);
    }

    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }

    await attachment.destroy();
    successResponse(res, null, "فایل پیوست حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ========== حذف گزارش ==========
const deleteVisitReport = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const report = await VisitReport.findByPk(id);
    if (!report) {
      await transaction.rollback();
      return errorResponse(res, "گزارش یافت نشد", 404);
    }

    // حذف فایل‌های پیوست
    const attachments = await VisitReportAttachment.findAll({
      where: { visit_report_id: id },
      transaction,
    });
    for (const att of attachments) {
      if (fs.existsSync(att.file_path)) {
        fs.unlinkSync(att.file_path);
      }
      await att.destroy({ transaction });
    }

    // حذف رکوردهای مرتبط
    await VisitReportHall.destroy({
      where: { visit_report_id: id },
      transaction,
    });
    await VisitReportExpert.destroy({
      where: { visit_report_id: id },
      transaction,
    });
    await report.destroy({ transaction });

    await transaction.commit();
    successResponse(res, null, "گزارش بازدید با موفقیت حذف شد");
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در حذف گزارش:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createVisitReport,
  updateVisitReport,
  getVisitReports,
  getVisitReportById,
  getReportsByCustomer,
  updateReportStatus,
  downloadAttachment,
  deleteAttachment,
  deleteVisitReport,
};
