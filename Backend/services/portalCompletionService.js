// ============================================================
// services/portalCompletionService.js
// «پایان دوره» + «گزارش نهایی دوره» — خواندن اسکوپ‌شده (موج ۱۳.۱۹)
// ------------------------------------------------------------
//  چرا سرویس جدا و نه داخل portalRequestService؟
//   • portalRequestService دربارهٔ «درخواست‌های مشتری» است (نوشتن +
//     صف کارشناس). پایان دوره یک «خواندن گزارش» است؛ گذاشتنش آن‌جا
//     دو مسئولیت را قاتی می‌کرد و فایل ۱۷۰۰ خطی را بزرگ‌تر هم می‌کرد.
//   • شکل خروجی در services/portalCompletionView.js (خالص) است؛
//     این فایل فقط کوئری می‌زند و همان را به view می‌دهد.
//
//  🔒 قواعد سخت:
//   ۱) هر کوئری با customer_id: customerId بسته می‌شود (پارامتر از
//      کنترلر و آن هم فقط از req.customerScopeId می‌آید).
//   ۲) فقط خواندن: findOne/findAll — هیچ create/update/destroy.
//   ۳) اقتصاد گله از DB هم خوانده نمی‌شود (فهرست سفید view).
//   ۴) شناسه‌های واکسن/دارو فقط از ردیف‌های هفتگیِ **همین مشتری**
//      استخراج می‌شوند؛ دیکشنری هم فقط با همان شناسه‌ها خوانده
//      می‌شود (هیچ فهرست کامل دیکشنری به مشتری نمی‌رود).
// ============================================================
"use strict";

const FlockCompletion = require("../models/FlockCompletion");
const FlockCompletionHall = require("../models/FlockCompletionHall");
const WeeklyManagement = require("../models/WeeklyManagement");
const WeeklyMedicine = require("../models/WeeklyMedicine");
const WeeklyVaccine = require("../models/WeeklyVaccine");
const Medicine = require("../models/Medicine");
const Vaccine = require("../models/Vaccine");
const Hall = require("../models/Hall");
const view = require("./portalCompletionView");

// خطای سرویس با status — همان شکل portalRequestService
const serviceError = (code, status = 500, message = null) => {
  const error = new Error(message || code);
  error.code = code;
  error.status = status;
  return error;
};

const plainOf = (row) =>
  row && typeof row.get === "function" ? row.get({ plain: true }) : row || {};

// شناسه‌های یکتا و مثبت از یک فهرست ردیف
const idsOf = (rows, key) => [
  ...new Set(
    (Array.isArray(rows) ? rows : [])
      .map((row) => Number(plainOf(row)[key]))
      .filter((id) => Number.isInteger(id) && id > 0),
  ),
];

// ============================================================
// ۱) فهرست «پایان دوره‌های من» (صفحه‌بندی‌شده)
// ============================================================
const listCompletionsFor = async ({ customerId, limit = 20, offset = 0 }) => {
  if (!customerId) throw serviceError("unlinked", 403);

  const { rows, count } = await FlockCompletion.findAndCountAll({
    where: { customer_id: customerId },
    attributes: view.DB_ATTRIBUTES,
    order: [
      ["completion_date", "DESC"],
      ["id", "DESC"],
    ],
    limit,
    offset,
  });

  return {
    items: rows.map((row) => view.completionListRow(row)),
    total: Number(count) || 0,
  };
};

// نگاشت شناسه → نام (فقط برای ردیف‌های مجاز)
const nameMapOf = async (Model, ids) => {
  if (!ids.length) return new Map();
  const rows = await Model.findAll({
    where: { id: ids },
    attributes: ["id", "name"],
  });
  const map = new Map();
  rows.forEach((row) => {
    const plain = plainOf(row);
    map.set(Number(plain.id), String(plain.name || "").trim());
  });
  return map;
};

// ============================================================
// ۲) گزارش نهایی یک دورهٔ خودم — ردیف غیرخودی ⇒ ۴۰۴
// ============================================================
const completionReportFor = async ({ customerId, completionId }) => {
  if (!customerId) throw serviceError("unlinked", 403);

  const completion = await FlockCompletion.findOne({
    where: { id: completionId, customer_id: customerId },
    attributes: view.DB_ATTRIBUTES,
  });
  if (!completion) {
    throw serviceError(
      "completion_not_found",
      404,
      "پایان دوره‌ای با این شناسه برای پروندهٔ شما ثبت نشده است",
    );
  }

  const hallRows = await FlockCompletionHall.findAll({
    where: {
      flock_completion_id: completion.id,
      customer_id: customerId,
    },
    attributes: view.HALL_DB_ATTRIBUTES,
    order: [["hall_id", "ASC"]],
  });

  const hallIds = idsOf(hallRows, "hall_id");
  const placementIds = idsOf(hallRows, "chick_placement_id");

  const [halls, weekRows] = await Promise.all([
    // نام سالن‌ها — با همان اسکوپ (نام سالن مشتری دیگر لو نمی‌رود)
    hallIds.length
      ? Hall.findAll({
          where: { id: hallIds, customer_id: customerId },
          attributes: ["id", "hall_name", "hall_number"],
        })
      : [],
    // هفته‌های همان جوجه‌ریزی‌ها — برای روند و جمع دارو/واکسن
    placementIds.length
      ? WeeklyManagement.findAll({
          where: {
            customer_id: customerId,
            chick_placement_id: placementIds,
          },
          attributes: view.WEEK_ATTRIBUTES,
          order: [
            ["chick_placement_id", "ASC"],
            ["week_number", "ASC"],
          ],
        })
      : [],
  ]);

  const hallNameById = halls.reduce((map, row) => {
    const plain = plainOf(row);
    const id = Number(plain.id);
    if (!Number.isInteger(id)) return map;
    const name = String(plain.hall_name || "").trim();
    const number = String(plain.hall_number || "").trim();
    map[String(id)] = name && number ? `${name} (${number})` : name || number;
    return map;
  }, {});

  const weeklyIds = idsOf(weekRows, "id");

  const [medicineLinks, vaccineLinks] = weeklyIds.length
    ? await Promise.all([
        WeeklyMedicine.findAll({
          where: {
            weekly_management_id: weeklyIds,
            customer_id: customerId,
          },
          attributes: ["id", "weekly_management_id", "medicine_id"],
        }),
        WeeklyVaccine.findAll({
          where: {
            weekly_management_id: weeklyIds,
            customer_id: customerId,
          },
          attributes: ["id", "weekly_management_id", "vaccine_id"],
        }),
      ])
    : [[], []];

  const medicineIds = idsOf(medicineLinks, "medicine_id");
  const vaccineIds = idsOf(vaccineLinks, "vaccine_id");

  const [medicineNames, vaccineNames] = await Promise.all([
    nameMapOf(Medicine, medicineIds),
    nameMapOf(Vaccine, vaccineIds),
  ]);

  // یک ردیف «نام» برای هر تجویز (جمع در view انجام می‌شود)
  const medicineRows = medicineLinks.map((link) => ({
    name: medicineNames.get(Number(plainOf(link).medicine_id)) || "",
  }));
  const vaccineRows = vaccineLinks.map((link) => ({
    name: vaccineNames.get(Number(plainOf(link).vaccine_id)) || "",
  }));

  return view.completionReportView({
    completion,
    hallRows,
    weekRows,
    hallNameById,
    medicineRows,
    vaccineRows,
  });
};

module.exports = {
  listCompletionsFor,
  completionReportFor,
};
