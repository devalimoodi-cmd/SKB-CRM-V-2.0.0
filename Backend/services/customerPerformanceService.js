// ============================================================
// services/customerPerformanceService.js
// «خلاصهٔ عملکرد مشتری» برای مودال جزئیات در داشبورد کارشناس
// ------------------------------------------------------------
// ساختار خروجی:
//   { customer, summary, flocks[], halls[], economics|null, focus }
// • گله  = رکورد جدول flocks (گله/گله پرورش)
// • اگر جوجه‌ریزی‌ای flock_id نداشت (دادهٔ قدیمی) ⇒ خودش یک «گلهٔ
//   تک‌سالنه» در نظر گرفته می‌شود تا هیچ سابقه‌ای از دست نرود.
// • شاخص‌ها همه از flockMetrics.js می‌آیند (منبع یکتای فرمول‌ها).
// • economics و شاخص‌های «پایان گله» فقط با includeCompletion=true
//   (کنترلر آن را به مجوز hatchery.view گره زده است).
// ============================================================
"use strict";

const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const CustomerType = require("../models/CustomerType");
const ChickPlacement = require("../models/ChickPlacement");
const ChickenBreed = require("../models/ChickenBreed");
const Flock = require("../models/Flock");
const Hall = require("../models/Hall");
const Unit = require("../models/Unit");
const WeeklyManagement = require("../models/WeeklyManagement");
const FlockCompletion = require("../models/FlockCompletion");
const FlockCompletionHall = require("../models/FlockCompletionHall");
const {
  summarizeWeeks,
  aggregateFlock,
  weightedAverage,
  allocateEconomics,
  buildFlockTrend,
  toNumber,
  toInt,
  round,
} = require("./flockMetrics");

// ستون‌های لازم از جدول هفتگی (سبک نگه‌داشتن کوئری)
const WEEK_ATTRIBUTES = [
  "chick_placement_id",
  "week_number",
  "week_start_date",
  "week_end_date",
  "flock_age_days",
  "weekly_feed_intake",
  "weekly_weight",
  "weekly_mortality",
];

const ACTIVE_STATUSES = ["active", "pending"];

// سن گله بر اساس تاریخ جوجه‌ریزی (هم‌فرمول dashboardController)
const flockAgeDays = (placementDate) => {
  if (!placementDate) return null;
  const start = new Date(placementDate);
  const today = new Date();
  if (Number.isNaN(start.getTime()) || start > today) return null;
  return Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
};

const isActiveStatus = (status) =>
  ACTIVE_STATUSES.includes(String(status || "").toLowerCase());

// ============================================================
// خلاصهٔ «پایان گله» یک گله (سرگروه) برای نمایش در کارت گله
// ============================================================
const mapCompletion = (completion) => {
  if (!completion) return null;
  const c = completion.get ? completion.get({ plain: true }) : completion;

  return {
    completionId: c.id,
    completionDate: c.completion_date || null,
    completionType: c.completion_type || "completed",
    confirmedByCustomer: !!c.confirmed_by_customer,
    // 🐣 جمعیت و تلفات
    finalChicks: toInt(c.final_chicks_count) || null,
    mortalityRate: c.mortality_rate !== null ? toNumber(c.mortality_rate) : null,
    transportMortality: toInt(c.transport_mortality) || null,
    // 📈 شاخص‌های عملکرد (سیستمی/اعلامی)
    fcr: c.final_fcr !== null ? toNumber(c.final_fcr) : null,
    systemFcr: c.system_fcr !== null ? toNumber(c.system_fcr) : null,
    epi: c.epi !== null ? toNumber(c.epi) : null,
    systemEpi: c.system_epi !== null ? toNumber(c.system_epi) : null,
    adgGrams: c.adg_grams !== null ? toNumber(c.adg_grams) : null,
    systemAdgGrams:
      c.system_adg_grams !== null ? toNumber(c.system_adg_grams) : null,
    survivalPercent:
      c.survival_percent !== null ? toNumber(c.survival_percent) : null,
    slaughterAgeDays: toInt(c.slaughter_age_days) || null,
    avgLiveWeight: c.avg_live_weight !== null ? toNumber(c.avg_live_weight) : null,
    // 💰 اقتصادی (فقط وقتی includeCompletion=true فراخوانی شده باشد)
    incomeTotal: c.income_total !== null ? toNumber(c.income_total) : null,
    totalCost: c.total_cost !== null ? toNumber(c.total_cost) : null,
    netProfit: c.net_profit !== null ? toNumber(c.net_profit) : null,
    profitPercent:
      c.profit_percent !== null ? toNumber(c.profit_percent) : null,
  };
};

// ریز پایان گلهٔ یک سالن (برای نمایش داخل کارت گله/سالن)
const mapHallCompletion = (detail) => {
  if (!detail) return null;
  const d = detail.get ? detail.get({ plain: true }) : detail;
  return {
    fcr: d.system_fcr !== null ? toNumber(d.system_fcr) : null,
    finalChicks: toInt(d.final_chicks_count) || null,
    mortalityRate: d.mortality_rate !== null ? toNumber(d.mortality_rate) : null,
    finalAvgWeight:
      d.final_avg_weight !== null ? toNumber(d.final_avg_weight) : null,
    slaughterAgeDays: toInt(d.slaughter_age_days) || null,
  };
};

// ============================================================
// main
// ============================================================
const getCustomerPerformance = async (
  customerId,
  { flockId = null, includeCompletion = false } = {},
) => {
  const customer = await CustomerPersonalInfo.findByPk(customerId, {
    include: [
      {
        model: CustomerType,
        as: "customer_type",
        attributes: ["id", "name"],
        required: false,
      },
    ],
  });

  if (!customer) return null;

  // ===== کوئری‌های موازی (بدون N+1) =====
  const [placements, flockRows, weeks, hallsList, completions] =
    await Promise.all([
    ChickPlacement.findAll({
      where: { customer_id: customerId },
      include: [
        {
          model: Hall,
          attributes: ["id", "hall_name", "nominal_capacity"],
          required: false,
        },
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name"],
          required: false,
        },
        {
          model: ChickenBreed,
          as: "breed",
          attributes: ["id", "name"],
          required: false,
        },
      ],
      order: [
        ["placement_date", "DESC"],
        ["id", "DESC"],
      ],
    }),
    Flock.findAll({
      where: { customer_id: customerId },
      order: [
        ["placement_date", "DESC"],
        ["id", "DESC"],
      ],
    }),
    WeeklyManagement.findAll({
      where: { customer_id: customerId },
      attributes: WEEK_ATTRIBUTES,
      order: [
        ["chick_placement_id", "ASC"],
        ["week_number", "ASC"],
      ],
    }),
    Hall.findAll({
      where: { customer_id: customerId },
      attributes: ["id", "hall_name", "nominal_capacity"],
      order: [["id", "ASC"]],
    }),
    includeCompletion
      ? FlockCompletion.findAll({
          where: { customer_id: customerId },
          include: [
            {
              model: FlockCompletionHall,
              as: "hallDetails",
              required: false,
            },
          ],
        })
      : Promise.resolve([]),
  ]);

  // ===== اندیس‌گذاری داده‌ها =====
  const weeksByPlacement = new Map();
  for (const row of weeks) {
    const week = row.get({ plain: true });
    const key = String(week.chick_placement_id);
    if (!weeksByPlacement.has(key)) weeksByPlacement.set(key, []);
    weeksByPlacement.get(key).push(week);
  }

  const completionByFlockId = new Map();
  const hallCompletionByKey = new Map();
  for (const row of completions) {
    const completion = row.get({ plain: true });
    if (completion.flock_id) {
      completionByFlockId.set(String(completion.flock_id), completion);
    }
    for (const detail of completion.hallDetails || []) {
      // کلید: «گله + سالن» برای تطبیق دقیق ریز پایان گله
      hallCompletionByKey.set(
        `${completion.flock_id || 0}:${detail.hall_id}`,
        detail,
      );
    }
  }

  const flockById = new Map(
    flockRows.map((f) => [String(f.id), f.get({ plain: true })]),
  );

  // ===== خلاصهٔ هر جوجه‌ریزی (سالن) =====
  const placementSummaries = placements.map((row) => {
    const placement = row.get({ plain: true });
    const hallWeeks = weeksByPlacement.get(String(placement.id)) || [];
    const metrics = summarizeWeeks(hallWeeks, placement.total_chicks_count);

    // آخرین هفتهٔ ثبت‌شده (برای نمایش بازهٔ ثبت)
    const lastWeek = hallWeeks.length
      ? hallWeeks[hallWeeks.length - 1]
      : null;

    return {
      placementId: placement.id,
      hallId: placement.hall_id,
      hallName: placement.Hall?.hall_name || `سالن ${placement.hall_id}`,
      hallCapacity: toInt(placement.Hall?.nominal_capacity) || null,
      unitId: placement.unit_id || null,
      unitName: placement.unit?.unit_name || null,
      breedName: placement.breed?.name || null,
      flockId: placement.flock_id || null,
      flockNumber: toInt(placement.flock_number) || null,
      placementDate: placement.placement_date || null,
      isActive: !!placement.is_active,
      hasWeeklyData: hallWeeks.length > 0,
      lastWeekStartDate: lastWeek?.week_start_date || null,
      lastWeekEndDate: lastWeek?.week_end_date || null,
      ...metrics,
    };
  });

  // ===== گروه‌بندی به «گله» =====
  const flockMap = new Map();
  for (const item of placementSummaries) {
    const key = item.flockId ? `f:${item.flockId}` : `p:${item.placementId}`;
    if (!flockMap.has(key)) {
      flockMap.set(key, {
        key,
        flockId: item.flockId,
        singleHall: !item.flockId,
        placements: [],
      });
    }
    flockMap.get(key).placements.push(item);
  }

  const flocks = [...flockMap.values()].map((group) => {
    const flock = group.flockId ? flockById.get(String(group.flockId)) : null;
    const halls = group.placements;

    // تاریخ شروع/پایان گله
    const dates = halls
      .map((h) => h.placementDate)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)));
    const startDate = flock?.placement_date || dates[dates.length - 1] || null;
    const lastHallEnd = halls
      .map((h) => h.lastWeekEndDate)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)))[0];

    const active = flock
      ? isActiveStatus(flock.status)
      : halls.some((h) => h.isActive);

    const status = flock
      ? String(flock.status || "").toLowerCase()
      : active
        ? "active"
        : "completed";

    const kpi = aggregateFlock(halls);
    kpi.ageDays =
      kpi.ageDays ||
      (active ? flockAgeDays(startDate) : null);

    const completion = flock
      ? mapCompletion(completionByFlockId.get(String(flock.id)))
      : null;

    // ===== Sparkline: سری هفتگی تجمیعی همین گله =====
    const flockWeeks = halls.flatMap(
      (h) => weeksByPlacement.get(String(h.placementId)) || [],
    );
    const trend = buildFlockTrend(
      flockWeeks,
      Object.fromEntries(halls.map((h) => [String(h.placementId), h.initialChicks])),
    );

    // ===== سود و زیان این گله به تفکیک سالن =====
    const rawCompletion = flock
      ? completionByFlockId.get(String(flock.id))
      : null;
    const allocation = rawCompletion
      ? allocateEconomics(rawCompletion, rawCompletion.hallDetails || [])
      : null;
    const hallEconomics = new Map(
      (allocation?.halls || []).map((row) => [String(row.hallId), row]),
    );

    return {
      key: group.key,
      flockId: group.flockId,
      singleHall: group.singleHall,
      flockNumber: flock?.flock_number ?? halls[0]?.flockNumber ?? null,
      unitId: flock?.unit_id ?? halls[0]?.unitId ?? null,
      unitName: halls[0]?.unitName || null,
      startDate,
      endDate: flock?.ended_at || (!active ? lastHallEnd : null),
      lastWeekEndDate: lastHallEnd || null,
      status,
      isActive: active,
      trend,
      halls: halls.map((h) => {
        const hallEcon = hallEconomics.get(String(h.hallId)) || null;
        return {
          hallId: h.hallId,
          hallName: h.hallName,
          placementId: h.placementId,
          chicks: h.initialChicks,
          finalChicks: h.finalChicks,
          mortality: h.totalMortality,
          mortalityRate: h.mortalityRate,
          survivalRate: h.survivalRate,
          feed: h.totalFeed,
          lastWeight: h.lastWeight,
          lastAgeDays: h.lastAgeDays,
          weeksCount: h.weeksCount,
          fcr: h.fcr,
          hasWeeklyData: h.hasWeeklyData,
          completion: flock
            ? mapHallCompletion(hallCompletionByKey.get(`${flock.id}:${h.hallId}`))
            : null,
          economics: hallEcon
            ? {
                income: hallEcon.income,
                chickCost: hallEcon.chickCost,
                feedCost: hallEcon.feedCost,
                otherCost: hallEcon.otherCost,
                totalCost: hallEcon.totalCost,
                profit: hallEcon.profit,
                profitPercent: hallEcon.profitPercent,
                liveWeight: hallEcon.liveWeight,
                declaredWeight: hallEcon.declaredWeight,
                estimated: hallEcon.estimated,
              }
            : null,
        };
      }),
      kpi,
      completion,
      economics: allocation
        ? {
            ...allocation.flock,
            basis: allocation.basis,
            hallCount: allocation.halls.length,
          }
        : null,
    };
  });

  // جدیدترین گله اول
  flocks.sort((a, b) =>
    String(b.startDate || "").localeCompare(String(a.startDate || "")),
  );

  // ===== خلاصهٔ کل مشتری =====
  const totalChicks = flocks.reduce((s, p) => s + toInt(p.kpi.initialChicks), 0);
  const totalMortality = flocks.reduce(
    (s, p) => s + toInt(p.kpi.totalMortality),
    0,
  );
  const totalFeed = flocks.reduce((s, p) => s + toNumber(p.kpi.totalFeed), 0);
  const mortalityRate =
    totalChicks > 0 ? round((totalMortality / totalChicks) * 100, 2) : 0;

  const flocksWithFcr = flocks.filter((p) => p.kpi.fcr !== null);
  const avgFcr = weightedAverage(
    flocksWithFcr.map((p) => ({
      fcr: p.kpi.fcr,
      finalChicks: p.kpi.finalChicks,
    })),
    "fcr",
  );

  const dates = placementSummaries
    .map((p) => p.placementDate)
    .filter(Boolean)
    .sort((a, b) => String(b).localeCompare(String(a)));

  const unitIds = new Set(
    placementSummaries.map((p) => p.unitId).filter(Boolean),
  );

  const summary = {
    flocksTotal: flocks.length,
    flocksActive: flocks.filter((p) => p.isActive).length,
    flocksCompleted: flocks.filter((p) => !p.isActive).length,
    totalChicks,
    totalMortality,
    mortalityRate,
    survivalRate: round(100 - mortalityRate, 2),
    totalFeed: round(totalFeed, 2),
    lastWeight: flocks[0]?.kpi.lastWeight || null,
    avgFcr,
    totalWeeks: flocks.reduce((s, p) => s + toInt(p.kpi.weeksCount), 0),
    lastPlacementDate: dates[0] || null,
    hallsCount: hallsList.length,
    unitsCount: unitIds.size,
  };

  // ===== خلاصهٔ سالن‌ها (کارنامهٔ هر سالن) =====
  // اقتصادی هر سالن = جمع گله‌های تمام‌شدهٔ همان سالن (از تخصیص گله‌ها)
  const hallEconomicsTotal = new Map();
  for (const flock of flocks) {
    for (const hall of flock.halls || []) {
      if (!hall.economics) continue;
      const key = String(hall.hallId);
      const current = hallEconomicsTotal.get(key) || {
        income: 0,
        totalCost: 0,
        profit: 0,
        flocksCount: 0,
      };
      current.income += toNumber(hall.economics.income);
      current.totalCost += toNumber(hall.economics.totalCost);
      current.profit += toNumber(hall.economics.profit);
      current.flocksCount += 1;
      hallEconomicsTotal.set(key, current);
    }
  }

  const halls = hallsList.map((row) => {
    const hall = row.get({ plain: true });
    const hallPlacements = placementSummaries.filter(
      (p) => String(p.hallId) === String(hall.id),
    );
    const totals = aggregateFlock(hallPlacements);

    const hallDates = hallPlacements
      .map((p) => p.placementDate)
      .filter(Boolean)
      .sort((a, b) => String(b).localeCompare(String(a)));

    const econ = hallEconomicsTotal.get(String(hall.id)) || null;

    return {
      hallId: hall.id,
      hallName: hall.hall_name || `سالن ${hall.id}`,
      capacity: toInt(hall.nominal_capacity) || null,
      flocksCount: hallPlacements.length,
      completedFlocks: hallPlacements.filter((p) => !p.isActive).length,
      lastPlacementDate: hallDates[0] || null,
      lastWeight: totals.lastWeight,
      avgMortalityRate: totals.mortalityRate,
      avgFcr: weightedAverage(
        hallPlacements
          .filter((p) => p.fcr !== null)
          .map((p) => ({ fcr: p.fcr, finalChicks: p.finalChicks })),
        "fcr",
      ),
      economics: econ
        ? {
            income: round(econ.income, 0),
            totalCost: round(econ.totalCost, 0),
            profit: round(econ.profit, 0),
            profitPercent:
              econ.income > 0
                ? round((econ.profit / econ.income) * 100, 2)
                : null,
            flocksCount: econ.flocksCount,
          }
        : null,
      flocks: hallPlacements
        .slice()
        .sort((a, b) =>
          String(b.placementDate || "").localeCompare(String(a.placementDate || "")),
        )
        .map((p) => {
          const owner = flocks.find((flock) =>
            flock.halls.some((h) => h.placementId === p.placementId),
          );
          return {
            flockKey: owner?.key || null,
            flockNumber: p.flockNumber,
            unitName: p.unitName,
            placementDate: p.placementDate,
            endDate: owner?.endDate || null,
            lastWeekEndDate: p.lastWeekEndDate,
            status: p.isActive ? "active" : "completed",
            isActive: p.isActive,
            ageDays: p.lastAgeDays || flockAgeDays(p.placementDate),
            weeksCount: p.weeksCount,
          };
        }),
    };
  });

  // ===== اقتصادی (نیازمند مجوز hatchery.view) =====
  let economics = null;
  if (includeCompletion && completions.length) {
    const completionList = completions.map((c) => c.get({ plain: true }));
    const withProfit = completionList.filter((c) => c.net_profit !== null);

    // مبنای «سهم هر سالن از سود کل» (جمع سود تخصیص‌یافتهٔ سالن‌ها)
    const totalProfitBase = [...hallEconomicsTotal.values()].reduce(
      (s, value) => s + toNumber(value.profit),
      0,
    );

    economics = {
      completedFlocks: completionList.length,
      totalIncome: round(
        completionList.reduce((s, c) => s + toNumber(c.income_total), 0),
        0,
      ),
      totalCost: round(
        completionList.reduce((s, c) => s + toNumber(c.total_cost), 0),
        0,
      ),
      totalProfit: round(
        completionList.reduce((s, c) => s + toNumber(c.net_profit), 0),
        0,
      ),
      avgProfitPercent: withProfit.length
        ? round(
            withProfit.reduce((s, c) => s + toNumber(c.profit_percent), 0) /
              withProfit.length,
            2,
          )
        : null,
      // روند FCR سه گلهٔ آخر (قدیم → جدید) برای نمایش سریع بهبود/افت
      fcrTrend: flocks
        .filter((p) => p.kpi.fcr !== null)
        .slice(0, 3)
        .reverse()
        .map((p) => ({ flockNumber: p.flockNumber, fcr: p.kpi.fcr })),
      // سهم هر سالن از سود/زیان کل پرونده (جمع همهٔ گله‌های تمام‌شده)
      byHall: [...hallEconomicsTotal.entries()]
        .map(([hallId, value]) => {
          const hallRow = hallsList.find(
            (h) => String(h.get({ plain: true }).id) === String(hallId),
          );
          const hallPlain = hallRow ? hallRow.get({ plain: true }) : {};
          return {
            hallId: toInt(hallId),
            hallName: hallPlain.hall_name || `سالن ${hallId}`,
            income: round(value.income, 0),
            totalCost: round(value.totalCost, 0),
            profit: round(value.profit, 0),
            profitPercent:
              value.income > 0
                ? round((value.profit / value.income) * 100, 2)
                : null,
            flocksCount: value.flocksCount,
            // سهم از سود فقط وقتی کل پرونده سودده است (با زیان کل، درصد بیمعنا می‌شود)
            shareOfTotalProfit:
              totalProfitBase > 0
                ? round((value.profit / totalProfitBase) * 100, 1)
                : null,
          };
        })
        .sort((a, b) => b.profit - a.profit),
    };
  }

  // ===== فوکوس روی گله/سالن کلیک‌شده =====
  let focus = null;
  if (flockId) {
    const wanted = String(flockId);
    const byPlacement = placementSummaries.find(
      (p) => String(p.placementId) === wanted,
    );
    const owner = byPlacement
      ? flocks.find((flock) =>
          flock.halls.some((h) => h.placementId === byPlacement.placementId),
        )
      : flocks.find((flock) => String(flock.flockId) === wanted);

    if (owner) {
      focus = {
        flockKey: owner.key,
        flockId: owner.flockId,
        placementId: byPlacement?.placementId || null,
        hallId: byPlacement?.hallId || null,
      };
    }
  }

  const customerPlain = customer.get({ plain: true });

  return {
    customer: {
      id: customerPlain.id,
      fullName: customerPlain.full_name || null,
      farmName: customerPlain.farm_name || null,
      phone: customerPlain.mobile_number || null,
      province: customerPlain.province || null,
      county: customerPlain.county || null,
      address: customerPlain.farm_address || null,
      collectionName: customerPlain.collection_name || null,
      customerCode: customerPlain.customer_code || null,
      nationalCode: customerPlain.national_code || null,
      customerType: customerPlain.customer_type?.name || null,
    },
    summary,
    flocks,
    halls,
    economics,
    focus,
  };
};

module.exports = { getCustomerPerformance };
