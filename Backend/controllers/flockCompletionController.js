const { sequelize } = require("../config/database");
const FlockCompletion = require("../models/FlockCompletion");
const FlockCompletionHall = require("../models/FlockCompletionHall");
const Flock = require("../models/Flock");
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
// @desc    ساخت ریز پایان دوره per سالن از داده‌های هفتگی
// ============================================================
const buildHallDetail = (placement, weeks) => {
  const initialChicks = placement.total_chicks_count || 0;
  const sys = calculateSystemData(weeks, initialChicks);
  const mortalityRate =
    initialChicks > 0
      ? parseFloat(((sys.total_mortality / initialChicks) * 100).toFixed(2))
      : 0;

  return {
    chick_placement_id: placement.id,
    hall_id: placement.hall_id,
    flock_id: placement.flock_id || null,
    customer_id: placement.customer_id,
    unit_id: placement.unit_id || null,
    initial_chicks_count: initialChicks,
    final_chicks_count: sys.final_chicks_count,
    initial_avg_weight: placement.avg_initial_weight || 0.04,
    slaughter_age_days: sys.slaughter_age_days,
    final_week_number: sys.final_week_number,
    total_feed_intake: sys.system_total_feed,
    final_avg_weight: sys.final_avg_weight,
    total_mortality: sys.total_mortality,
    mortality_rate: mortalityRate,
    system_fcr: sys.system_fcr,
    system_last_weight: sys.system_last_weight,
    system_total_feed: sys.system_total_feed,
  };
};

// ============================================================
// @desc    تجمیع ریز سالن‌ها به شاخص‌های سرگله
// ============================================================
const aggregateHallDetails = (details) => {
  const totalInitial = details.reduce(
    (s, d) => s + (parseInt(d.initial_chicks_count) || 0),
    0,
  );
  const totalFinal = details.reduce(
    (s, d) => s + (parseInt(d.final_chicks_count) || 0),
    0,
  );
  const totalMortality = details.reduce(
    (s, d) => s + (parseInt(d.total_mortality) || 0),
    0,
  );
  const totalFeed = details.reduce(
    (s, d) => s + (parseFloat(d.total_feed_intake) || 0),
    0,
  );
  const maxWeek = Math.max(...details.map((d) => d.final_week_number || 1));
  const maxAge = Math.max(...details.map((d) => d.slaughter_age_days || 0));

  // میانگین وزنی وزن نهایی بر اساس قطعات باقی‌مانده هر سالن
  const weightedWeight =
    totalFinal > 0
      ? details.reduce(
          (s, d) =>
            s +
            (parseFloat(d.final_avg_weight) || 0) *
              (parseInt(d.final_chicks_count) || 0),
          0,
        ) / totalFinal
      : null;
  const weightedInitialWeight =
    totalInitial > 0
      ? details.reduce(
          (s, d) =>
            s +
            (parseFloat(d.initial_avg_weight) || 0) *
              (parseInt(d.initial_chicks_count) || 0),
          0,
        ) / totalInitial
      : null;

  const mortalityRate =
    totalInitial > 0
      ? parseFloat(((totalMortality / totalInitial) * 100).toFixed(2))
      : 0;

  // ضریب تبدیل گله = کل خوراک ÷ (وزن نهایی وزنی × قطعات نهایی)
  const fcr =
    weightedWeight && totalFinal > 0 && totalFeed > 0
      ? parseFloat((totalFeed / (weightedWeight * totalFinal)).toFixed(2))
      : null;

  return {
    initial_chicks_count: totalInitial,
    final_chicks_count: totalFinal,
    initial_avg_weight: weightedInitialWeight
      ? parseFloat(weightedInitialWeight.toFixed(3))
      : null,
    final_avg_weight: weightedWeight
      ? parseFloat(weightedWeight.toFixed(2))
      : null,
    total_mortality: totalMortality,
    mortality_rate: mortalityRate,
    total_feed_intake: parseFloat(totalFeed.toFixed(2)),
    final_week_number: maxWeek || 1,
    slaughter_age_days: maxAge || null,
    system_total_feed: parseFloat(totalFeed.toFixed(2)),
    system_last_weight: weightedWeight
      ? parseFloat(weightedWeight.toFixed(2))
      : null,
    system_fcr: fcr,
  };
};

// ============================================================
// @desc    بستن یک گله با ثبت پایان دوره (سرگروه + ریز per سالن)
// ============================================================
const finalizeFlockCompletion = async (
  flock,
  { shared_data = {}, completedBy = null },
  transaction,
) => {
  const placements = await ChickPlacement.findAll({
    where: { flock_id: flock.id },
    order: [["placement_date", "ASC"]],
    transaction,
  });
  if (!placements.length) {
    const err = new Error(
      `گله شماره ${flock.flock_number} هیچ جوجه‌ریزی (سالن) ندارد`,
    );
    err.status = 400;
    throw err;
  }

  const completionDate =
    shared_data.completion_date || new Date().toISOString().slice(0, 10);

  // ریز per سالن
  const details = [];
  for (const pl of placements) {
    const weeks = await WeeklyManagement.findAll({
      where: { chick_placement_id: pl.id },
      transaction,
    });
    details.push(buildHallDetail(pl, weeks));
  }

  const agg = aggregateHallDetails(details);
  const repPlacement = placements[0];

  const header = {
    flock_id: flock.id,
    chick_placement_id: repPlacement.id,
    customer_id: flock.customer_id,
    unit_id: flock.unit_id,
    hall_id: repPlacement.hall_id,
    completed_by: completedBy,
    completion_date: completionDate,
    completion_type: shared_data.completion_type || "completed",
    confirmed_by_customer: shared_data.confirmed_by_customer || false,
    ...agg,
    farmer_fcr: shared_data.farmer_fcr || null,
    farmer_total_meat: shared_data.farmer_total_meat || null,
    farmer_total_feed: shared_data.farmer_total_feed || null,
    farmer_total_weight: shared_data.farmer_total_weight || null,
    slaughter_date: shared_data.slaughter_date || null,
    slaughterhouse_name: shared_data.slaughterhouse_name || null,
    transport_mortality: shared_data.transport_mortality || 0,
    total_sent: shared_data.total_sent || null,
    total_live_weight: shared_data.total_live_weight || null,
    avg_live_weight: shared_data.avg_live_weight || null,
    notes: shared_data.notes || null,
  };

  let completion = await FlockCompletion.findOne({
    where: { flock_id: flock.id },
    transaction,
  });
  if (completion) {
    await completion.update(header, { transaction });
    await FlockCompletionHall.destroy({
      where: { flock_completion_id: completion.id },
      transaction,
    });
  } else {
    completion = await FlockCompletion.create(header, { transaction });
  }

  await FlockCompletionHall.bulkCreate(
    details.map((d) => ({ ...d, flock_completion_id: completion.id })),
    { transaction },
  );

  // بستن گله و غیرفعال کردن جوجه‌ریزی‌های فعال آن
  await ChickPlacement.update(
    { is_active: false },
    { where: { flock_id: flock.id, is_active: true }, transaction },
  );
  await flock.update(
    { status: "completed", ended_at: completionDate },
    { transaction },
  );

  return completion;
};

// ============================================================
// @desc    ثبت پایان دوره برای یک یا چند گله (نسخه سازگار با واحد)
// @route   POST /api/flock-completions/complete-periods
// @access  Private (expert, admin, super_admin)
// ============================================================
const completePeriods = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { unit_ids = [], flock_ids = [] } = req.body;
    const shared_data = req.body.shared_data || {};
    const completedBy = req.user?.id || null;

    if (
      (!unit_ids || unit_ids.length === 0) &&
      (!flock_ids || flock_ids.length === 0)
    ) {
      return errorResponse(res, "حداقل یک واحد یا گله باید انتخاب شود", 400);
    }

    // ── استخراج شناسه گله‌ها ──
    const flockIdSet = new Set();

    if (flock_ids.length > 0) {
      // ممکن است شناسه گله (flocks) یا جوجه‌ریزی (chick_placements) قدیمی باشند
      const asFlocks = await Flock.findAll({
        where: { id: flock_ids },
        attributes: ["id"],
        transaction,
      });
      if (asFlocks.length === flock_ids.length) {
        asFlocks.forEach((f) => flockIdSet.add(f.id));
      } else {
        const placements = await ChickPlacement.findAll({
          where: { id: flock_ids },
          attributes: ["flock_id"],
          transaction,
        });
        placements.forEach((p) => {
          if (p.flock_id) flockIdSet.add(p.flock_id);
        });
      }
    }

    if (unit_ids.length > 0) {
      const unitPlacements = await ChickPlacement.findAll({
        where: { unit_id: unit_ids, is_active: true },
        attributes: ["flock_id"],
        transaction,
      });
      unitPlacements.forEach((p) => {
        if (p.flock_id) flockIdSet.add(p.flock_id);
      });
    }

    if (flockIdSet.size === 0) {
      await transaction.rollback();
      return errorResponse(res, "هیچ گله فعالی برای پایان دوره یافت نشد", 400);
    }

    const flocks = await Flock.findAll({
      where: { id: [...flockIdSet] },
      transaction,
    });
    if (flocks.length === 0) {
      await transaction.rollback();
      return errorResponse(res, "گله‌های انتخاب‌شده یافت نشدند", 404);
    }

    const results = [];
    for (const flock of flocks) {
      if (flock.status !== "active") continue;
      const completion = await finalizeFlockCompletion(
        flock,
        { shared_data, completedBy },
        transaction,
      );
      results.push({
        flock_id: flock.id,
        flock_number: flock.flock_number,
        completion_id: completion.id,
      });
    }

    await transaction.commit();
    successResponse(
      res,
      { completions: results.length, results },
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
// @desc    ثبت پایان دوره مستقیماً با شناسه گله (flocks)
// @route   POST /api/flock-completions/complete-flock
// @access  Private (expert, admin, super_admin)
// ============================================================
const completeFlockPeriods = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { flock_ids = [] } = req.body;
    const shared_data = req.body.shared_data || {};
    const completedBy = req.user?.id || null;

    if (!Array.isArray(flock_ids) || flock_ids.length === 0) {
      await transaction.rollback();
      return errorResponse(res, "حداقل یک گله باید انتخاب شود", 400);
    }

    const flocks = await Flock.findAll({
      where: { id: flock_ids },
      transaction,
    });
    if (flocks.length === 0) {
      await transaction.rollback();
      return errorResponse(res, "گله‌های انتخاب‌شده یافت نشدند", 404);
    }

    const results = [];
    for (const flock of flocks) {
      if (flock.status !== "active") {
        await transaction.rollback();
        return errorResponse(
          res,
          `گله شماره ${flock.flock_number} فعال نیست و قبلاً با وضعیت ${flock.status} بسته شده است`,
          400,
        );
      }
      const completion = await finalizeFlockCompletion(
        flock,
        { shared_data, completedBy },
        transaction,
      );
      results.push({
        flock_id: flock.id,
        flock_number: flock.flock_number,
        completion_id: completion.id,
      });
    }

    await transaction.commit();
    successResponse(
      res,
      { results },
      "پایان دوره گله‌ها با ثبت تفکیکی per سالن انجام شد",
      201,
    );
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در پایان دوره گله:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    دریافت پایان دوره یک گله (سرگروه + ریز سالن‌ها)
// @route   GET /api/flock-completions/flock/:flockId
// ============================================================
const getFlockCompletionByFlockId = async (req, res) => {
  try {
    const { flockId } = req.params;
    const completion = await FlockCompletion.findOne({
      where: { flock_id: flockId },
      include: [
        {
          model: FlockCompletionHall,
          as: "hallDetails",
          include: [
            {
              model: Hall,
              as: "hall",
              attributes: ["id", "hall_name"],
            },
            {
              model: ChickPlacement,
              as: "placement",
              attributes: ["id", "placement_date", "flock_number"],
            },
          ],
        },
      ],
    });

    if (!completion) {
      return errorResponse(
        res,
        "پایان دوره‌ای برای این گله ثبت نشده است",
        404,
      );
    }

    successResponse(res, completion, "پایان دوره گله دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت پایان دوره گله:", error);
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
    const flockRecordId = completion.flock_id;
    const unitId = completion.unit_id;

    // بازگردانی گله به حالت فعال (پایان دوره در سطح گله)
    if (flockRecordId) {
      const flock = await Flock.findByPk(flockRecordId, { transaction });
      if (flock) {
        await flock.update(
          { status: "active", ended_at: null },
          { transaction },
        );
      }
      await ChickPlacement.update(
        { is_active: true },
        { where: { flock_id: flockRecordId }, transaction },
      );
    } else if (flockId) {
      // سازگاری با رکوردهای قدیمی per سالن
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
  completeFlockPeriods,
  getFlockCompletionByFlockId,
  getFlockCompletions,
  getCompletionsByUnit,
  getFlockCompletionById,
  deleteFlockCompletion,
};
