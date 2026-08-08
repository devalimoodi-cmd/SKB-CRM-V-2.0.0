const { sequelize } = require("../config/database");
const FlockCompletion = require("../models/FlockCompletion");
const ChickPlacement = require("../models/ChickPlacement");
const Unit = require("../models/Unit");
const WeeklyManagement = require("../models/WeeklyManagement");
const Hall = require("../models/Hall");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================================
// محاسبه اطلاعات سیستمی از داده‌های هفتگی گله
// ============================================================
const calculateSystemData = (weeks, initialChicks = 0) => {
  let totalFeed = 0;
  let totalMortality = 0;
  let lastWeight = 0;
  let lastFlockAge = 0;
  let finalWeekNumber = 0;
  let finalChicks = initialChicks;

  const sortedWeeks = [...weeks].sort(
    (a, b) => (a.week_number || 0) - (b.week_number || 0),
  );

  for (const w of sortedWeeks) {
    totalFeed += parseFloat(w.weekly_feed_intake) || 0;
    totalMortality += parseInt(w.weekly_mortality) || 0;

    const weight = parseFloat(w.weekly_weight) || 0;
    if (weight > 0) {
      lastWeight = weight;
      finalWeekNumber = w.week_number || finalWeekNumber;
      lastFlockAge = w.flock_age_days || lastFlockAge;
    }
  }

  finalChicks = Math.max(0, initialChicks - totalMortality);

  // ضریب تبدیل سیستمی = کل خوراک ÷ آخرین وزن (اگر وزن معتبر باشد)
  const systemFcr =
    lastWeight > 0 ? parseFloat((totalFeed / lastWeight).toFixed(2)) : null;

  return {
    system_total_feed: parseFloat(totalFeed.toFixed(2)),
    system_last_weight:
      lastWeight > 0 ? parseFloat(lastWeight.toFixed(2)) : null,
    final_avg_weight: lastWeight > 0 ? parseFloat(lastWeight.toFixed(2)) : null,
    final_week_number: finalWeekNumber || 1,
    slaughter_age_days: lastFlockAge || null,
    total_mortality: totalMortality,
    final_chicks_count: finalChicks,
    system_fcr: systemFcr,
  };
};

// ============================================================
// @desc    ثبت اطلاعات پایان دوره برای یک یا چند گله
// @route   POST /api/flock-completions/complete-periods
// @access  Private (expert, admin, super_admin)
// ============================================================
const completePeriods = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { unit_ids = [], flock_ids = [], shared_data = {} } = req.body;

    if (
      (!unit_ids || unit_ids.length === 0) &&
      (!flock_ids || flock_ids.length === 0)
    ) {
      return errorResponse(res, "حداقل یک واحد یا گله باید انتخاب شود", 400);
    }

    const completedBy = req.user?.id || null;
    const completionDate =
      shared_data.completion_date || new Date().toISOString().slice(0, 10);

    // ── استخراج گله‌های هدف ──
    let targetFlockIds = [...flock_ids];

    // گله‌های واحدهای انتخاب‌شده را هم اضافه کن
    if (unit_ids.length > 0) {
      const unitFlocks = await ChickPlacement.findAll({
        where: { unit_id: unit_ids, is_active: true },
        attributes: ["id", "unit_id"],
        transaction,
      });
      unitFlocks.forEach((f) => {
        if (!targetFlockIds.includes(f.id)) targetFlockIds.push(f.id);
      });
    }

    if (targetFlockIds.length === 0) {
      await transaction.rollback();
      return errorResponse(res, "هیچ گله فعالی برای پایان دوره یافت نشد", 400);
    }

    // ── دریافت اطلاعات کامل گله‌ها ──
    const flocks = await ChickPlacement.findAll({
      where: { id: targetFlockIds },
      include: [{ model: Hall }],
      transaction,
    });

    const createdCompletions = [];
    const unitIdsToComplete = new Set(unit_ids);

    for (const flock of flocks) {
      // اطلاعات واحد از گله
      if (flock.unit_id) unitIdsToComplete.add(flock.unit_id);

      // دریافت داده‌های هفتگی
      const weeks = await WeeklyManagement.findAll({
        where: { chick_placement_id: flock.id },
        transaction,
      });

      const initialChicks = flock.total_chicks_count || 0;
      const systemData = calculateSystemData(weeks, initialChicks);

      // ایجاد یا بروزرسانی رکورد تکمیل
      const [completion, created] = await FlockCompletion.upsert(
        {
          chick_placement_id: flock.id,
          customer_id: flock.customer_id,
          unit_id: flock.unit_id,
          hall_id: flock.hall_id,
          completed_by: completedBy,
          completion_date: completionDate,
          completion_type: shared_data.completion_type || "completed",
          confirmed_by_customer: shared_data.confirmed_by_customer || false,
          initial_chicks_count: initialChicks,
          final_chicks_count: systemData.final_chicks_count,
          initial_avg_weight: flock.avg_initial_weight || 0.04,
          slaughter_age_days: systemData.slaughter_age_days,
          final_week_number: systemData.final_week_number,
          total_feed_intake: systemData.system_total_feed,
          final_avg_weight: systemData.final_avg_weight,
          total_mortality: systemData.total_mortality,
          mortality_rate:
            initialChicks > 0
              ? parseFloat(
                  ((systemData.total_mortality / initialChicks) * 100).toFixed(
                    2,
                  ),
                )
              : 0,
          farmer_fcr: shared_data.farmer_fcr || null,
          farmer_total_meat: shared_data.farmer_total_meat || null,
          farmer_total_feed: shared_data.farmer_total_feed || null,
          farmer_total_weight: shared_data.farmer_total_weight || null,
          system_last_weight: systemData.system_last_weight,
          system_total_feed: systemData.system_total_feed,
          system_fcr: systemData.system_fcr,
          // کشتارگاه
          slaughter_date: shared_data.slaughter_date || null,
          slaughterhouse_name: shared_data.slaughterhouse_name || null,
          transport_mortality: shared_data.transport_mortality || 0,
          total_sent: shared_data.total_sent || null,
          total_live_weight: shared_data.total_live_weight || null,
          avg_live_weight: shared_data.avg_live_weight || null,
          notes: shared_data.notes || null,
        },
        { transaction },
      );

      // غیرفعال کردن گله
      await flock.update({ is_active: false }, { transaction });

      createdCompletions.push(completion);
    }

    // ── به‌روزرسانی وضعیت واحدها ──
    for (const unitId of unitIdsToComplete) {
      if (!unitId) continue;
      const unit = await Unit.findByPk(unitId, { transaction });
      if (unit) {
        // بررسی اینکه آیا همه گله‌های این واحد غیرفعال شده‌اند
        const remainingActive = await ChickPlacement.count({
          where: { unit_id: unit.id, is_active: true },
          transaction,
        });
        if (remainingActive === 0 || unit_ids.includes(unit.id)) {
          await unit.update({ is_active: false }, { transaction });
        }
      }
    }

    await transaction.commit();
    successResponse(
      res,
      { completions: createdCompletions.length },
      "اطلاعات پایان دوره با موفقیت ثبت شد",
      201,
    );
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در ثبت پایان دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    دریافت لیست تکمیل‌های دوره
// @route   GET /api/flock-completions
// ============================================================
const getFlockCompletions = async (req, res) => {
  try {
    const {
      customer_id,
      unit_id,
      hall_id,
      completion_date,
      page = 1,
      limit = 20,
    } = req.query;
    const where = {};

    if (customer_id) where.customer_id = customer_id;
    if (unit_id) where.unit_id = unit_id;
    if (hall_id) where.hall_id = hall_id;
    if (completion_date) where.completion_date = completion_date;

    const offset = (page - 1) * limit;

    const { count, rows } = await FlockCompletion.findAndCountAll({
      where,
      include: [
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number", "placement_date"],
        },
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["completion_date", "DESC"]],
    });

    successResponse(
      res,
      {
        completions: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست پایان دوره‌ها دریافت شد",
    );
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    دریافت اطلاعات پایان دوره یک واحد
// @route   GET /api/flock-completions/unit/:unitId
// ============================================================
const getCompletionsByUnit = async (req, res) => {
  try {
    const { unitId } = req.params;
    const completions = await FlockCompletion.findAll({
      where: { unit_id: unitId },
      include: [
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number", "placement_date"],
        },
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
      ],
      order: [["completion_date", "DESC"]],
    });

    successResponse(res, completions, "لیست پایان دوره‌های واحد دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    دریافت اطلاعات یک پایان دوره
// @route   GET /api/flock-completions/:id
// ============================================================
const getFlockCompletionById = async (req, res) => {
  try {
    const { id } = req.params;
    const completion = await FlockCompletion.findByPk(id, {
      include: [
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number", "placement_date"],
        },
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
      ],
    });

    if (!completion) {
      return errorResponse(res, "اطلاعات پایان دوره یافت نشد", 404);
    }

    successResponse(res, completion, "اطلاعات پایان دوره دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    حذف یک پایان دوره (بازگردانی گله به حالت فعال)
// @route   DELETE /api/flock-completions/:id
// ============================================================
const deleteFlockCompletion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const completion = await FlockCompletion.findByPk(id, { transaction });

    if (!completion) {
      await transaction.rollback();
      return errorResponse(res, "اطلاعات پایان دوره یافت نشد", 404);
    }

    const flockId = completion.chick_placement_id;
    const unitId = completion.unit_id;

    // بازگردانی گله به حالت فعال
    if (flockId) {
      await ChickPlacement.update(
        { is_active: true },
        { where: { id: flockId }, transaction },
      );
    }

    // بازگردانی واحد به حالت فعال
    if (unitId) {
      const unit = await Unit.findByPk(unitId, { transaction });
      if (unit && !unit.is_active) {
        await unit.update({ is_active: true }, { transaction });
      }
    }

    await completion.destroy({ transaction });
    await transaction.commit();

    successResponse(res, null, "پایان دوره حذف شد و گله بازگردانی شد");
  } catch (error) {
    await transaction.rollback();
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  completePeriods,
  getFlockCompletions,
  getCompletionsByUnit,
  getFlockCompletionById,
  deleteFlockCompletion,
};
