// ============================================================
// services/flockMetrics.js
// «شاخص‌های گله» — منبع یکتای محاسبهٔ شاخص‌های هفتگی/گله
// ------------------------------------------------------------
// چرا این فایل؟
//   قبلاً فرمول «ضریب تبدیل» در دو جا متفاوت بود:
//     • مودال جزئیات مشتری (داشبورد):  خوراک ÷ آخرین وزن
//     • اطلاعات پایان گله:            خوراک ÷ (وزن × جوجهٔ نهایی)
//   نسخهٔ دوم همان چیزی است که موتور محاسباتی فرانت‌اند هم می‌گوید
//   (weekly.calculations.js → fcrUpToWeek: «دان کل ÷ (آخرین وزن کشی × مرغ مانده)»)
//   بنابراین فقط همان نسخه اینجا پیاده شده تا همهٔ بخش‌ها یک عدد بدهند.
//
// ⚠️ واحدها (طبق دیتابیس و فرم‌های ثبت):
//   • weekly_weight            → کیلوگرم (میانگین وزن هفتگی هر قطعه)
//   • weekly_feed_intake       → کیلوگرم (خوراک هفتگی کل سالن)
//   • chick_placements.avg_initial_weight → گرم (اینجا استفاده نمی‌شود)
// ============================================================
"use strict";

const toNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

const toInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : 0;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(toNumber(value) * factor) / factor;
};

// ============================================================
// جمع‌بندی هفته‌های یک جوجه‌ریزی (یک سالن)
// ============================================================
const summarizeWeeks = (weeks = [], initialChicks = 0) => {
  const sorted = [...weeks].sort(
    (a, b) => toInt(a.week_number) - toInt(b.week_number),
  );

  let totalFeed = 0;
  let totalMortality = 0;
  let lastWeight = 0;
  let lastWeekNumber = 0;
  let lastAgeDays = 0;

  for (const week of sorted) {
    totalFeed += toNumber(week.weekly_feed_intake);
    totalMortality += toInt(week.weekly_mortality);

    // ✅ «آخرین وزن» = آخرین هفته‌ای که وزن ثبت شده (نه بیشترین وزن)
    const weight = toNumber(week.weekly_weight);
    if (weight > 0) {
      lastWeight = weight;
      lastWeekNumber = toInt(week.week_number) || lastWeekNumber;
      lastAgeDays = toInt(week.flock_age_days) || lastAgeDays;
    }
  }

  const chicks = toInt(initialChicks);
  const finalChicks = Math.max(0, chicks - totalMortality);
  const mortalityRate = chicks > 0 ? round((totalMortality / chicks) * 100, 2) : 0;

  // ✅ FCR سیستمی = کل خوراک ÷ (آخرین وزن × جوجهٔ نهایی)
  const fcr =
    totalFeed > 0 && lastWeight > 0 && finalChicks > 0
      ? round(totalFeed / (lastWeight * finalChicks), 2)
      : null;

  return {
    initialChicks: chicks,
    finalChicks,
    totalFeed: round(totalFeed, 2),
    totalMortality,
    mortalityRate,
    survivalRate: round(100 - mortalityRate, 2),
    lastWeight: round(lastWeight, 3),
    lastWeekNumber: lastWeekNumber || null,
    lastAgeDays: lastAgeDays || null,
    weeksCount: sorted.length,
    fcr,
  };
};

// ============================================================
// میانگین وزنی (برای گله‌های چندسالنه)
// ============================================================
const weightedAverage = (items = [], valueKey, weightKey = "finalChicks") => {
  let sum = 0;
  let base = 0;

  for (const item of items) {
    const value = toNumber(item?.[valueKey]);
    const weight = toInt(item?.[weightKey]);
    if (value > 0 && weight > 0) {
      sum += value * weight;
      base += weight;
    }
  }

  return base > 0 ? round(sum / base, 3) : null;
};

// ============================================================
// تجمیع ریز سالن‌های یک گله → شاخص‌های گله
// (هم‌راستا با aggregateHallDetails در flockCompletionController)
// ============================================================
const aggregateFlock = (items = []) => {
  const halls = items.filter(Boolean);

  const initialChicks = halls.reduce((s, i) => s + toInt(i.initialChicks), 0);
  const finalChicks = halls.reduce((s, i) => s + toInt(i.finalChicks), 0);
  const totalMortality = halls.reduce((s, i) => s + toInt(i.totalMortality), 0);
  const totalFeed = halls.reduce((s, i) => s + toNumber(i.totalFeed), 0);
  const weeksCount = halls.reduce((s, i) => s + toInt(i.weeksCount), 0);

  const mortalityRate =
    initialChicks > 0 ? round((totalMortality / initialChicks) * 100, 2) : 0;

  // وزن: میانگین وزنی بر اساس جوجهٔ نهایی هر سالن
  const lastWeight = weightedAverage(halls, "lastWeight");

  const fcr =
    totalFeed > 0 && lastWeight && finalChicks > 0
      ? round(totalFeed / (lastWeight * finalChicks), 2)
      : null;

  const ageDays = halls.reduce((max, i) => Math.max(max, toInt(i.lastAgeDays)), 0);
  const lastWeekNumber = halls.reduce(
    (max, i) => Math.max(max, toInt(i.lastWeekNumber)),
    0,
  );

  return {
    initialChicks,
    finalChicks,
    totalMortality,
    mortalityRate,
    survivalRate: round(100 - mortalityRate, 2),
    totalFeed: round(totalFeed, 2),
    lastWeight,
    lastWeekNumber: lastWeekNumber || null,
    ageDays: ageDays || null,
    weeksCount,
    fcr,
  };
};

// ============================================================
// تخصیص «سود و زیان» گله به تفکیک سالن
// ------------------------------------------------------------
// چرا؟ اقتصاد در سطح گله ثبت می‌شود (flock_completions) و در سطح سالن
// فقط داده‌های فیزیکی هست (flock_completion_halls). پس:
//   • درآمد         ⇒ بر اساس «وزن زندهٔ هر سالن» (وزن کشتارگاهی ثبت‌شده)
//   • هزینهٔ خوراک  ⇒ بر اساس سهم خوراک همان سالن (خوراک per سالن است)
//   • هزینهٔ جوجه   ⇒ بر اساس سهم جوجهٔ اولیهٔ همان سالن
//   • سایر (دارو/سوخت/کارگر/سایر) ⇒ بر اساس وزن (تخصیصی)
// ✅ تضمین: باقی‌ماندهٔ گردکردن به ردیف آخر اضافه می‌شود تا
//    «جمع ستون‌ها = عدد ثبت‌شدهٔ گله» دقیقاً برابر باشد.
// ============================================================
const shareList = (values) => {
  const sum = values.reduce((s, v) => s + toNumber(v), 0);
  return sum > 0 ? values.map((v) => toNumber(v) / sum) : null;
};

const allocateEconomics = (completion = {}, hallDetails = []) => {
  const halls = (Array.isArray(hallDetails) ? hallDetails : []).filter(Boolean);
  if (!halls.length) return null;

  const pricePerKg = toNumber(completion.price_per_kg);
  const flockIncome = toNumber(completion.income_total);
  const flockChickCost = toNumber(completion.chick_cost);
  const flockFeedCost = toNumber(completion.feed_cost);
  const flockOtherCost =
    toNumber(completion.medication_cost) +
    toNumber(completion.fuel_cost) +
    toNumber(completion.labor_cost) +
    toNumber(completion.other_cost);
  const flockTotalCost =
    toNumber(completion.total_cost) ||
    flockChickCost + flockFeedCost + flockOtherCost;

  const hasAny =
    flockIncome > 0 ||
    pricePerKg > 0 ||
    flockChickCost > 0 ||
    flockFeedCost > 0 ||
    flockOtherCost > 0 ||
    flockTotalCost > 0;
  if (!hasAny) return null;

  // ===== مبنای هر سالن =====
  const rows = halls.map((hall) => {
    const chicks = toInt(hall.initial_chicks_count);
    const finalChicks = toInt(hall.final_chicks_count);
    const declaredFeed = toNumber(hall.declared_feed_intake);
    const systemFeed = toNumber(hall.total_feed_intake);
    const declaredWeight = toNumber(hall.live_weight_kg);
    const estimatedWeight = toNumber(hall.final_avg_weight) * finalChicks;

    return {
      hallId: hall.hall_id,
      chicks,
      finalChicks,
      feed: declaredFeed > 0 ? declaredFeed : systemFeed,
      weight: declaredWeight > 0 ? declaredWeight : estimatedWeight,
      weightEstimated: !(declaredWeight > 0),
      feedEstimated: declaredFeed <= 0 && systemFeed <= 0,
    };
  });

  // زنجیرهٔ fallback: وزن ⇒ جوجهٔ نهایی ⇒ جوجهٔ اولیه ⇒ مساوی
  const weightShare =
    shareList(rows.map((r) => r.weight)) ||
    shareList(rows.map((r) => r.finalChicks)) ||
    shareList(rows.map((r) => r.chicks));
  const chickShare =
    shareList(rows.map((r) => r.chicks)) || shareList(rows.map((r) => r.finalChicks));
  const feedShare =
    shareList(rows.map((r) => r.feed)) || shareList(rows.map((r) => r.finalChicks));

  const equal = 1 / rows.length;
  const at = (shares, index) => (shares ? shares[index] : equal);

  const incomeBase =
    flockIncome > 0
      ? flockIncome
      : pricePerKg > 0
        ? pricePerKg * rows.reduce((s, r) => s + r.weight, 0)
        : 0;

  // ===== تخصیص (پیش از اصلاح گردکردن) =====
  const result = rows.map((row, index) => ({
    hallId: row.hallId,
    liveWeight: round(row.weight, 2),
    declaredWeight: !row.weightEstimated,
    chicks: row.chicks,
    finalChicks: row.finalChicks,
    feed: round(row.feed, 2),
    income: round(incomeBase * at(weightShare, index), 2),
    chickCost: round(flockChickCost * at(chickShare, index), 2),
    feedCost: round(flockFeedCost * at(feedShare, index), 2),
    otherCost: round(flockOtherCost * at(weightShare, index), 2),
    estimated: row.weightEstimated || row.feedEstimated,
  }));

  const syncTo = (key, target) => {
    if (!result.length) return;
    const sum = result.reduce((s, r) => s + toNumber(r[key]), 0);
    const diff = round(round(target, 2) - round(sum, 2), 2);
    if (Math.abs(diff) >= 0.01) {
      const last = result[result.length - 1];
      last[key] = round(last[key] + diff, 2);
    }
  };

  syncTo("income", incomeBase);
  syncTo("chickCost", flockChickCost);
  syncTo("feedCost", flockFeedCost);
  syncTo("otherCost", flockOtherCost);

  // ===== سود هر سالن =====
  for (const row of result) {
    row.totalCost = round(row.chickCost + row.feedCost + row.otherCost, 2);
    row.profit = round(row.income - row.totalCost, 2);
    row.profitPercent =
      row.income > 0 ? round((row.profit / row.income) * 100, 2) : null;
  }

  // اگر «جمع کل هزینهٔ» ثبت‌شده با جمع ریزها اختلاف داشت، همان معیار است
  const costSum = result.reduce((s, r) => s + r.totalCost, 0);
  const costDiff = round(round(flockTotalCost, 2) - round(costSum, 2), 2);
  if (Math.abs(costDiff) >= 0.01 && result.length) {
    const last = result[result.length - 1];
    last.totalCost = round(last.totalCost + costDiff, 2);
    last.profit = round(last.income - last.totalCost, 2);
    last.profitPercent =
      last.income > 0 ? round((last.profit / last.income) * 100, 2) : null;
  }

  const sum = (key) =>
    round(result.reduce((s, r) => s + toNumber(r[key]), 0), 2);
  const totalIncome = sum("income");
  const totalCost = sum("totalCost");
  const profit = round(totalIncome - totalCost, 2);

  return {
    halls: result,
    flock: {
      income: totalIncome,
      chickCost: sum("chickCost"),
      feedCost: sum("feedCost"),
      otherCost: sum("otherCost"),
      totalCost,
      profit,
      profitPercent:
        totalIncome > 0 ? round((profit / totalIncome) * 100, 2) : null,
    },
    basis: {
      income: weightShare ? "live_weight" : "equal",
      chickCost: chickShare ? "initial_chicks" : "equal",
      feedCost: feedShare ? "hall_feed" : "equal",
      otherCost: weightShare ? "live_weight" : "equal",
      hasEstimatedRows: result.some((r) => r.estimated),
    },
  };
};

// ============================================================
// سری هفتگی تجمیعی یک گله (برای Sparkline داخل کارت گله)
// قواعد تجمیع عیناً مثل weekly.aggregation.js:
//   • وزن = میانگین وزنی بر اساس مرغ زندهٔ همان هفته
//   • خوراک/تلفات = مجموع سالن‌ها
//   • FCR تجمعی = مجموع خوراک تا این هفته ÷ (وزن × مرغ زندهٔ همان هفته)
// ============================================================
const buildFlockTrend = (weeks = [], initialChicksByPlacement = {}) => {
  const rows = (Array.isArray(weeks) ? weeks : []).filter(Boolean);
  if (!rows.length) return null;

  const weekNumbers = [
    ...new Set(rows.map((w) => toInt(w.week_number))),
  ].sort((a, b) => a - b);
  const placementIds = [
    ...new Set(rows.map((w) => String(w.chick_placement_id))),
  ];
  if (!weekNumbers.length) return null;

  // خانهٔ «هر گله در هر هفته»
  const cells = new Map();
  for (const week of rows) {
    cells.set(`${week.chick_placement_id}|${toInt(week.week_number)}`, {
      feed: toNumber(week.weekly_feed_intake),
      weight: toNumber(week.weekly_weight),
      mortality: toInt(week.weekly_mortality),
      endDate: week.week_end_date || null,
    });
  }

  const cumFeed = new Map();
  const cumMortality = new Map();
  const points = [];

  for (const weekNumber of weekNumbers) {
    let weightSum = 0;
    let weightBase = 0;
    let feedCumulative = 0;
    let mortalityWeek = 0;
    let liveTotal = 0;
    let weekDate = null;

    for (const placementId of placementIds) {
      const cell = cells.get(`${placementId}|${weekNumber}`) || {
        feed: 0,
        weight: 0,
        mortality: 0,
        endDate: null,
      };

      // تاریخ هفته = آخرین تاریخ پایان هفته بین سالن‌ها
      if (cell.endDate && (!weekDate || String(cell.endDate) > String(weekDate))) {
        weekDate = cell.endDate;
      }

      cumFeed.set(placementId, (cumFeed.get(placementId) || 0) + cell.feed);
      cumMortality.set(
        placementId,
        (cumMortality.get(placementId) || 0) + cell.mortality,
      );

      const initialChicks = toInt(initialChicksByPlacement[placementId]);
      const live = Math.max(
        0,
        initialChicks - (cumMortality.get(placementId) || 0),
      );

      liveTotal += live;
      if (cell.weight > 0 && live > 0) {
        weightSum += cell.weight * live;
        weightBase += live;
      }
      feedCumulative += cumFeed.get(placementId) || 0;
      mortalityWeek += cell.mortality;
    }

    const weight = weightBase > 0 ? weightSum / weightBase : 0;

    points.push({
      weekNumber,
      date: weekDate || null,
      weight: weight > 0 ? round(weight, 3) : null,
      mortality: mortalityWeek,
      feed: round(feedCumulative, 1),
      fcr:
        weight > 0 && liveTotal > 0 && feedCumulative > 0
          ? round(feedCumulative / (weight * liveTotal), 2)
          : null,
    });
  }

  return {
    weeks: points.map((p) => p.weekNumber),
    dates: points.map((p) => p.date),
    weight: points.map((p) => p.weight),
    mortality: points.map((p) => p.mortality),
    feed: points.map((p) => p.feed),
    fcr: points.map((p) => p.fcr),
  };
};

module.exports = {
  toNumber,
  toInt,
  round,
  summarizeWeeks,
  weightedAverage,
  aggregateFlock,
  allocateEconomics,
  buildFlockTrend,
};
