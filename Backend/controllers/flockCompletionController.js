const { sequelize } = require("../config/database");
const FlockCompletion = require("../models/FlockCompletion");
const ChickPlacement = require("../models/ChickPlacement");
const Period = require("../models/Period");
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
// @desc    ثبت اطلاعات پایان دوره برای یک یا چند دوره/گله
// @route   POST /api/flock-completions/complete-periods
// @access  Private (expert, admin, super_admin)
// ============================================================
const completePeriods = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { period_ids = [], flock_ids = [], shared_data = {} } = req.body;

    if (
      (!period_ids || period_ids.length === 0) &&
      (!flock_ids || flock_ids.length === 0)
    ) {
      return errorResponse(res, "حداقل یک دوره یا گله باید انتخاب شود", 400);
    }

    const completedBy = req.user?.id || null;
    const completionDate =
      shared_data.completion_date || new Date().toISOString().slice(0, 10);

    // ── استخراج گله‌های هدف ──
    let targetFlockIds = [...flock_ids];

    // گله‌های دوره‌های انتخاب‌شده را هم اضافه کن
    if (period_ids.length > 0) {
      const periodFlocks = await ChickPlacement.findAll({
        where: { period_id: period_ids, is_active: true },
        attributes: ["id", "period_id"],
        transaction,
      });
      const ids = periodFlocks.map((f) => f.id);
      // جلوگیری از تکراری
      periodFlocks.forEach((f) => {
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
      include: [
        {
          model: Period,
          attributes: ["id", "period_number", "period_name", "status"],
        },
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
      ],
      transaction,
    });

    const createdCompletions = [];
    const periodIdsToComplete = new Set(period_ids);

    for (const flock of flocks) {
      const weeklyRecords = await WeeklyManagement.findAll({
        where: { chick_placement_id: flock.id, is_active: true },
        transaction,
      });

      const period = flock.Period || {};
      const initialChicks = flock.total_chicks_count || 0;
      const systemData = calculateSystemData(
        weeklyRecords || [],
        initialChicks,
      );

      // اطلاعات دوره از گله
      if (flock.period_id) periodIdsToComplete.add(flock.period_id);

      // ── سن کشتار = تاریخ کشتار - تاریخ جوجه‌ریزی ──
      const transportMortalityForFlock =
        parseInt(shared_data.transport_mortality) || 0;
      let slaughterAgeDays = systemData.slaughter_age_days;
      const slDateObj = shared_data.slaughter_date
        ? new Date(shared_data.slaughter_date)
        : null;
      const plDateObj = flock.placement_date
        ? new Date(flock.placement_date)
        : null;
      if (plDateObj && slDateObj && !isNaN(plDateObj) && !isNaN(slDateObj)) {
        const diffDays = Math.round(
          (slDateObj - plDateObj) / (1000 * 60 * 60 * 24),
        );
        if (diffDays > 0) slaughterAgeDays = diffDays;
      }

      // ── جوجه نهایی = جوجه اولیه - تلفات سیستمی - تلفات حمل ──
      const finalChicksAfterAllMortality = Math.max(
        0,
        initialChicks -
          (systemData.total_mortality || 0) -
          transportMortalityForFlock,
      );

      // ── ساخت رکورد تکمیل ──
      const completionData = {
        chick_placement_id: flock.id,
        customer_id: flock.customer_id,
        period_id: flock.period_id,
        hall_id: flock.hall_id,
        completed_by: completedBy,
        completion_date: completionDate,
        completion_type: shared_data.completion_type || "completed",
        confirmed_by_customer: !!shared_data.confirmed_by_customer,

        // اطلاعات جوجه‌ریزی و جمعیت
        initial_chicks_count: initialChicks,
        final_chicks_count:
          shared_data.final_chicks_count !== undefined
            ? shared_data.final_chicks_count
            : finalChicksAfterAllMortality,
        initial_avg_weight:
          flock.avg_initial_weight !== undefined &&
          flock.avg_initial_weight !== null
            ? parseFloat(flock.avg_initial_weight) / 1000 // تبدیل گرم به کیلوگرم
            : shared_data.initial_avg_weight || 0.04,

        // اطلاعات سن و دوره
        slaughter_age_days: slaughterAgeDays,
        period_number: period.period_number || null,
        period_name: period.period_name || null,

        // اطلاعات کشتارگاه (از ورودی مشترک)
        slaughter_date: shared_data.slaughter_date || null,
        slaughterhouse_name: shared_data.slaughterhouse_name || null,
        transport_mortality: parseInt(shared_data.transport_mortality) || 0,
        total_sent:
          shared_data.total_sent !== undefined ? shared_data.total_sent : null,
        total_live_weight:
          shared_data.total_live_weight !== undefined
            ? shared_data.total_live_weight
            : null,
        avg_live_weight:
          shared_data.avg_live_weight !== undefined
            ? shared_data.avg_live_weight
            : null,

        // شاخص‌های فنی
        final_week_number: systemData.final_week_number,
        total_feed_intake: systemData.system_total_feed,
        final_avg_weight: systemData.final_avg_weight,
        total_mortality:
          (systemData.total_mortality || 0) +
          (parseInt(shared_data.transport_mortality) || 0),
        mortality_rate:
          initialChicks > 0
            ? parseFloat(
                (
                  (((systemData.total_mortality || 0) +
                    (parseInt(shared_data.transport_mortality) || 0)) /
                    initialChicks) *
                  100
                ).toFixed(2),
              )
            : null,

        // اطلاعات اعلامی مرغدار
        farmer_fcr: shared_data.farmer_fcr || null,
        farmer_total_meat: shared_data.farmer_total_meat || null,
        farmer_total_feed: shared_data.farmer_total_feed || null,
        farmer_total_weight: shared_data.farmer_total_weight || null,

        // اطلاعات محاسبه‌شده سیستمی
        system_last_weight: systemData.system_last_weight,
        system_total_feed: systemData.system_total_feed,
        system_fcr: systemData.system_fcr,

        // توضیحات
        notes: shared_data.notes || null,
      };

      // ── Upsert (به دلیل UNIQUE روی chick_placement_id) ──
      const [completion, created] = await FlockCompletion.findOrCreate({
        where: { chick_placement_id: flock.id },
        defaults: completionData,
        transaction,
      });

      if (!created) {
        await completion.update(completionData, { transaction });
      }

      // ── غیرفعال کردن گله ──
      await flock.update({ is_active: false }, { transaction });

      createdCompletions.push({
        completion: completion.toJSON(),
        flock: {
          id: flock.id,
          flock_number: flock.flock_number,
          hall_name: flock.Hall?.hall_name || null,
        },
        created: created || false,
      });
    }

    // ── تکمیل دوره‌ها ──
    const completedPeriods = [];
    for (const periodId of periodIdsToComplete) {
      if (!periodId) continue;
      const period = await Period.findByPk(periodId, { transaction });
      if (period && period.status !== "completed") {
        // فقط اگر همه گله‌های فعال دوره غیرفعال شده باشند
        const remainingActive = await ChickPlacement.count({
          where: { period_id: period.id, is_active: true },
          transaction,
        });
        if (remainingActive === 0 || period_ids.includes(period.id)) {
          await period.update(
            {
              status: "completed",
              end_date: completionDate,
            },
            { transaction },
          );
          completedPeriods.push({
            id: period.id,
            period_number: period.period_number,
          });
        }
      }
    }

    await transaction.commit();

    successResponse(
      res,
      {
        completedFlocks: createdCompletions.length,
        completedPeriods,
        completions: createdCompletions,
      },
      `${createdCompletions.length} گله و ${completedPeriods.length} دوره با موفقیت تکمیل شد`,
      201,
    );
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در ثبت پایان دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    دریافت اطلاعات پایان دوره‌های یک دوره
// @route   GET /api/flock-completions/period/:periodId
// ============================================================
const getPeriodCompletions = async (req, res) => {
  try {
    const { periodId } = req.params;

    const completions = await FlockCompletion.findAll({
      where: { period_id: periodId },
      include: [
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number", "hall_id"],
          include: [{ model: Hall, attributes: ["id", "hall_name"] }],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    successResponse(res, completions, "اطلاعات پایان دوره دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت اطلاعات پایان دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    دریافت اطلاعات پایان دوره یک گله
// @route   GET /api/flock-completions/flock/:flockId
// ============================================================
const getFlockCompletion = async (req, res) => {
  try {
    const { flockId } = req.params;

    const completion = await FlockCompletion.findOne({
      where: { chick_placement_id: flockId },
      include: [
        {
          model: ChickPlacement,
          as: "flock",
          attributes: ["id", "flock_number", "hall_id"],
          include: [{ model: Hall, attributes: ["id", "hall_name"] }],
        },
      ],
    });

    if (!completion) {
      return errorResponse(
        res,
        "اطلاعات پایان دوره برای این گله یافت نشد",
        404,
      );
    }

    successResponse(res, completion, "اطلاعات پایان دوره گله دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت اطلاعات پایان دوره گله:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================================
// @desc    برگرداندن (لغو) یک تکمیل دوره
// @route   DELETE /api/flock-completions/:id
// ============================================================
const updateCompletion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const completion = await FlockCompletion.findByPk(id, { transaction });
    if (!completion) {
      await transaction.rollback();
      return errorResponse(res, "اطلاعات پایان دوره یافت نشد", 404);
    }

    const body = { ...req.body };

    // ── محاسبه مجدد فیلدهای سیستمی از داده‌های هفتگی (پیش‌فرض true) ──
    const recompute = body.recompute !== false;
    if (recompute) {
      const weeklyRecords = await WeeklyManagement.findAll({
        where: {
          chick_placement_id: completion.chick_placement_id,
          is_active: true,
        },
        transaction,
      });

      const initialChicks =
        body.initial_chicks_count ?? completion.initial_chicks_count ?? 0;
      const systemData = calculateSystemData(
        weeklyRecords || [],
        initialChicks,
      );
      const transportMortality =
        parseInt(body.transport_mortality) ||
        completion.transport_mortality ||
        0;

      // ── سن کشتار = تاریخ کشتار - تاریخ جوجهریزی ──
      let slaughterAgeDays = systemData.slaughter_age_days;
      const slDateObj = body.slaughter_date
        ? new Date(body.slaughter_date)
        : null;
      const flockInfo = await ChickPlacement.findByPk(
        completion.chick_placement_id,
        { attributes: ["placement_date"], transaction },
      );
      const plDateObj = flockInfo?.placement_date
        ? new Date(flockInfo.placement_date)
        : null;
      if (plDateObj && slDateObj && !isNaN(plDateObj) && !isNaN(slDateObj)) {
        const diffDays = Math.round(
          (slDateObj - plDateObj) / (1000 * 60 * 60 * 24),
        );
        if (diffDays > 0) slaughterAgeDays = diffDays;
      }

      // ── جوجه نهایی = اولیه - تلفات سیستمی - تلفات حمل ──
      const finalChicksAfterAllMortality = Math.max(
        0,
        initialChicks - (systemData.total_mortality || 0) - transportMortality,
      );

      // فیلدهای سیستمی (محاسبهشده) بروزرسانی میشوند
      body.final_week_number = systemData.final_week_number;
      body.system_total_feed = systemData.system_total_feed;
      body.system_last_weight = systemData.system_last_weight;
      body.final_avg_weight = systemData.final_avg_weight;
      body.slaughter_age_days = slaughterAgeDays;
      body.system_fcr = systemData.system_fcr;
      body.total_mortality =
        (systemData.total_mortality || 0) + transportMortality;
      body.final_chicks_count = finalChicksAfterAllMortality;
      body.mortality_rate =
        initialChicks > 0
          ? parseFloat(
              (((systemData.total_mortality || 0) + transportMortality) /
                initialChicks) *
                100,
            ).toFixed(2)
          : null;
    }

    // ── فیلدهای دستی قابل ویرایش ──
    const allowedFields = [
      "completion_date",
      "completion_type",
      "confirmed_by_customer",
      "initial_chicks_count",
      "final_chicks_count",
      "initial_avg_weight",
      "slaughter_age_days",
      "period_number",
      "period_name",
      "slaughter_date",
      "slaughterhouse_name",
      "transport_mortality",
      "total_sent",
      "total_live_weight",
      "avg_live_weight",
      "final_week_number",
      "total_feed_intake",
      "final_avg_weight",
      "total_mortality",
      "mortality_rate",
      "farmer_fcr",
      "farmer_total_meat",
      "farmer_total_feed",
      "farmer_total_weight",
      "system_last_weight",
      "system_total_feed",
      "system_fcr",
      "notes",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    await completion.update(updateData, { transaction });
    await transaction.commit();

    successResponse(
      res,
      completion,
      "اطلاعات پایان دوره با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در بروزرسانی اطلاعات پایان دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

const revertCompletion = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const completion = await FlockCompletion.findByPk(id, { transaction });
    if (!completion) {
      await transaction.rollback();
      return errorResponse(res, "اطلاعات پایان دوره یافت نشد", 404);
    }

    const flockId = completion.chick_placement_id;
    const periodId = completion.period_id;

    // فعال کردن مجدد گله
    await ChickPlacement.update(
      { is_active: true },
      { where: { id: flockId } },
      { transaction },
    );

    // اگر دوره هنوز فقط همین گله را داشت، به حالت active برگردان
    if (periodId) {
      const period = await Period.findByPk(periodId, { transaction });
      if (period && period.status === "completed") {
        // بررسی اینکه گله‌های فعال دیگری در دوره نباشند (همه لغو شده باشند)
        const activeFlocks = await ChickPlacement.count({
          where: { period_id: periodId, is_active: true },
          transaction,
        });
        if (activeFlocks <= 1) {
          await period.update(
            { status: "active", end_date: null },
            { transaction },
          );
        }
      }
    }

    // حذف رکورد تکمیل
    await completion.destroy({ transaction });

    await transaction.commit();

    successResponse(
      res,
      { id, flockId, periodId },
      "تکمیل دوره با موفقیت برگردانده شد",
    );
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در برگرداندن تکمیل دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  completePeriods,
  getPeriodCompletions,
  getFlockCompletion,
  updateCompletion,
  revertCompletion,
};
