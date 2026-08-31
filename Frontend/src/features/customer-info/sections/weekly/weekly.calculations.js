// ================================================================
// sections/weekly/weekly.calculations.js
// توابع خالص محاسبات مدیریت هفتگی (کاردهای زنده)
// تمام مقادیر وزنی بر حسب کیلوگرم هستند.
// ================================================================

const round = (value, digits = 2) => {
  if (value === null || value === undefined || isNaN(value)) return null;
  return Number(value.toFixed(digits));
};

// پیدا کردن استاندارد یک هفته از آرایه استانداردها
export function findStandard(standards, weekNumber) {
  if (!standards || !Array.isArray(standards)) return null;
  return (
    standards.find(
      (s) => parseInt(s.week_number) === parseInt(weekNumber),
    ) || null
  );
}

// ---------- وزن اولیه ----------

// تبدیل وزن اولیه جوجه از گرم به کیلوگرم؛ اگر وجود نداشت ۰.۰۴ (۴۰ گرم)
export function getInitialWeightKg(avgInitialWeight) {
  const val = parseFloat(avgInitialWeight);
  if (!isNaN(val) && val > 0) {
    return val / 1000; // ذخیره در جوجه‌ریزی بر حسب گرم است
  }
  return 0.04;
}

// ---------- جمعیت و تلفات ----------

// جمعیت ابتدای هفته N = تعداد اولیه − Σ تلفات(۱..N−1)
export function birdsStartOfWeek(initialChicks, mortalityByWeek, weekNumber) {
  let dead = 0;
  for (let i = 1; i < weekNumber; i++) {
    dead += parseFloat(mortalityByWeek[i]) || 0;
  }
  return (parseFloat(initialChicks) || 0) - dead;
}

// جمعیت مانده هفته N (بعد از کسر تلفات همان هفته)
export function birdsEndOfWeek(initialChicks, mortalityByWeek, weekNumber) {
  const start = birdsStartOfWeek(initialChicks, mortalityByWeek, weekNumber);
  const mort = parseFloat(mortalityByWeek[weekNumber]) || 0;
  return Math.max(0, start - mort);
}

// مجموع تلفات تا هفته N
export function cumulativeMortality(mortalityByWeek, weekNumber) {
  let total = 0;
  for (let i = 1; i <= weekNumber; i++) {
    total += parseFloat(mortalityByWeek[i]) || 0;
  }
  return total;
}

// درصد تلفات هفتگی (نسبت به جمعیت ابتدای هفته)
export function weeklyMortalityPercent(
  initialChicks,
  mortalityByWeek,
  weekNumber,
) {
  const start = birdsStartOfWeek(initialChicks, mortalityByWeek, weekNumber);
  const mort = parseFloat(mortalityByWeek[weekNumber]) || 0;
  if (start <= 0) return null;
  return (mort / start) * 100;
}

// درصد تلفات کل تا هفته N (نسبت به تعداد اولیه)
export function totalMortalityPercent(
  initialChicks,
  mortalityByWeek,
  weekNumber,
) {
  const initial = parseFloat(initialChicks) || 0;
  if (initial <= 0) return null;
  const dead = cumulativeMortality(mortalityByWeek, weekNumber);
  return (dead / initial) * 100;
}

// ---------- وزن و رشد ----------

// افزایش وزن هفتگی (کیلوگرم)
// هفته ۱: وزن(۱) − وزن اولیه جوجه | هفته N: وزن(N) − وزن(N−1)
export function weeklyGain(weightsKg, weekNumber, initialWeightKg) {
  const current = parseFloat(weightsKg[weekNumber]);
  if (isNaN(current)) return null;
  let previous;
  if (parseInt(weekNumber) <= 1) {
    previous = parseFloat(initialWeightKg);
  } else {
    previous = parseFloat(weightsKg[parseInt(weekNumber) - 1]);
  }
  if (isNaN(previous)) return null;
  return current - previous;
}

// نرخ رشد روزانه = افزایش وزن هفتگی ÷ ۷
export function dailyGain(weightsKg, weekNumber, initialWeightKg) {
  const gain = weeklyGain(weightsKg, weekNumber, initialWeightKg);
  if (gain === null) return null;
  return gain / 7;
}

// ---------- خوراک و FCR ----------

// دان مصرفی کل تا هفته N (مجموع دان هفتگی)
export function cumulativeFeed(feedByWeek, weekNumber) {
  let total = 0;
  for (let i = 1; i <= weekNumber; i++) {
    total += parseFloat(feedByWeek[i]) || 0;
  }
  return total;
}

// FCR تا هفته N = دان کل مصرفی ÷ (آخرین وزن کشی × مرغ مانده)
export function fcrUpToWeek(
  weightsKg,
  feedByWeek,
  mortalityByWeek,
  initialChicks,
  weekNumber,
) {
  const weight = parseFloat(weightsKg[weekNumber]);
  const birds = birdsEndOfWeek(initialChicks, mortalityByWeek, weekNumber);
  const feed = cumulativeFeed(feedByWeek, weekNumber);
  if (isNaN(weight) || weight <= 0 || birds <= 0 || feed <= 0) return null;
  return feed / (weight * birds);
}

// ---------- استانداردها ----------

// افزایش وزن استاندارد هفته N از target_weight مشتق می‌شود
export function standardWeeklyGain(standards, weekNumber, initialWeightKg) {
  if (!standards || standards.length === 0) return null;
  const current = findStandard(standards, weekNumber);
  if (!current) return null;
  const currentTarget = parseFloat(current.target_weight);
  if (isNaN(currentTarget)) return null;

  let previous;
  if (parseInt(weekNumber) <= 1) {
    previous = parseFloat(initialWeightKg);
  } else {
    const prevStd = findStandard(standards, parseInt(weekNumber) - 1);
    previous = prevStd ? parseFloat(prevStd.target_weight) : null;
  }
  if (previous === null || isNaN(previous)) return null;
  return currentTarget - previous;
}

// درصد اختلاف مقدار واقعی نسبت به استاندارد
export function deviationPercent(actual, standard) {
  if (
    actual === null ||
    actual === undefined ||
    standard === null ||
    standard === undefined ||
    isNaN(actual) ||
    isNaN(standard) ||
    standard === 0
  ) {
    return null;
  }
  return ((actual - standard) / standard) * 100;
}

// وضعیت وزنی نسبت به بازه استاندارد
export function weightStatus(actual, standard) {
  if (actual === null || !standard) return { label: "—", status: "neutral" };
  const target = parseFloat(standard.target_weight);
  const min = parseFloat(standard.min_weight);
  const max = parseFloat(standard.max_weight);
  const diff = actual - target;

  let status = "neutral";
  if (!isNaN(min) && !isNaN(max) && actual >= min && actual <= max) {
    status = "ok";
  } else if (!isNaN(min) && actual < min) {
    status = "below";
  } else if (!isNaN(max) && actual > max) {
    status = "above";
  } else if (diff < 0) {
    status = "below";
  } else if (diff > 0) {
    status = "above";
  }
  return { diff, status };
}

// ================================================================
// تابع اصلی: محاسبه تمام متریک‌های یک هفته (برای کارت‌ها)
// ================================================================
export function calculateWeekMetrics({ flock, weeks, weekNumber, formValues }) {
  const initialChicks = flock?.total_chicks_count || 0;
  const initialWeightKg = getInitialWeightKg(flock?.avg_initial_weight);
  const standards = flock?.standards || [];

  // ساخت map هفته‌ها از رکوردهای ذخیره‌شده
  const weightMap = {};
  const feedMap = {};
  const mortalityMap = {};

  (weeks || []).forEach((w) => {
    if (w && w.existsInDb) {
      const wn = parseInt(w.week_number);
      weightMap[wn] = parseFloat(w.weekly_weight);
      feedMap[wn] = parseFloat(w.weekly_feed_intake);
      mortalityMap[wn] = parseInt(w.weekly_mortality) || 0;
    }
  });

  // اعمال مقادیر زنده فرم (هفته جاری که هنوز ذخیره نشده)
  if (
    formValues &&
    formValues.weekly_weight !== undefined &&
    formValues.weekly_weight !== ""
  ) {
    weightMap[weekNumber] = parseFloat(formValues.weekly_weight);
  }
  if (
    formValues &&
    formValues.weekly_feed_intake !== undefined &&
    formValues.weekly_feed_intake !== ""
  ) {
    feedMap[weekNumber] = parseFloat(formValues.weekly_feed_intake);
  }
  if (
    formValues &&
    formValues.weekly_mortality !== undefined &&
    formValues.weekly_mortality !== ""
  ) {
    mortalityMap[weekNumber] = parseInt(formValues.weekly_mortality) || 0;
  }

  const weight = parseFloat(weightMap[weekNumber]);
  const std = findStandard(standards, weekNumber);

  const gain = weeklyGain(weightMap, weekNumber, initialWeightKg);
  const stdGain = standardWeeklyGain(standards, weekNumber, initialWeightKg);
  const dGain = gain !== null ? gain / 7 : null;
  const stdDGain = stdGain !== null ? stdGain / 7 : null;

  const feedTotal = cumulativeFeed(feedMap, weekNumber);
  const fcr = fcrUpToWeek(
    weightMap,
    feedMap,
    mortalityMap,
    initialChicks,
    weekNumber,
  );

  const wStatus = weightStatus(isNaN(weight) ? null : weight, std);

  // ===== جمعیت =====
  const birdsStart = birdsStartOfWeek(initialChicks, mortalityMap, weekNumber);
  const birdsEnd = birdsEndOfWeek(initialChicks, mortalityMap, weekNumber);

  // ===== وزن کل گله و افزایش وزن کل گله =====
  // وزن کل گله (زنده) = میانگین وزن × تعداد قطعات زنده
  const totalLiveWeight = !isNaN(weight) ? weight * birdsEnd : null;
  // افزایش وزن کل گله = (وزن فعلی − وزن اولیه) × تعداد قطعات زنده
  const totalWeightGain =
    !isNaN(weight) ? (weight - initialWeightKg) * birdsEnd : null;

  // ===== درصد زنده‌مانی =====
  const weeklySurvivalPercent =
    birdsStart > 0 ? (birdsEnd / birdsStart) * 100 : null;
  const cumulativeSurvivalPercent =
    initialChicks > 0 ? (birdsEnd / initialChicks) * 100 : null;

  // ===== ADG (گرم/روز) =====
  const dailyGainGrams = dGain !== null ? dGain * 1000 : null;
  const stdDGainGrams = stdDGain !== null ? stdDGain * 1000 : null;

  // سن گله در پایان این هفته (برای ADG تجمعی)
  let ageDays = formValues?.flock_age_days
    ? parseInt(formValues.flock_age_days)
    : null;
  if (!ageDays || isNaN(ageDays)) {
    const wRec = (weeks || []).find(
      (x) => parseInt(x.week_number) === parseInt(weekNumber),
    );
    ageDays = wRec ? parseInt(wRec.flock_age_days) : parseInt(weekNumber) * 7;
  }
  const cumulativeAdg =
    !isNaN(weight) && ageDays && ageDays > 0
      ? ((weight - initialWeightKg) * 1000) / ageDays
      : null;

  // ===== سرانه مصرف خوراک (بر مبنای جمعیت ابتدای هفته) =====
  const weeklyFeed = parseFloat(feedMap[weekNumber]) || 0;
  const dailyFeed = weeklyFeed > 0 ? weeklyFeed / 7 : 0;
  const dailyFeedPerBird =
    birdsStart > 0 && dailyFeed > 0 ? (dailyFeed * 1000) / birdsStart : null;
  const weeklyFeedPerBird =
    birdsStart > 0 && weeklyFeed > 0 ? weeklyFeed / birdsStart : null;

  return {
    weekNumber: parseInt(weekNumber),
    initialChicks,
    initialWeightKg,
    birdsStartOfWeek: round(birdsStart),
    birdsEndOfWeek: round(birdsEnd),
    mortalityThisWeek: mortalityMap[weekNumber] || 0,
    weeklyMortalityPercent: round(
      weeklyMortalityPercent(initialChicks, mortalityMap, weekNumber),
    ),
    totalMortalityPercent: round(
      totalMortalityPercent(initialChicks, mortalityMap, weekNumber),
    ),
    weeklySurvivalPercent: round(weeklySurvivalPercent),
    cumulativeSurvivalPercent: round(cumulativeSurvivalPercent),
    weight: isNaN(weight) ? null : round(weight, 3),
    totalLiveWeight: round(totalLiveWeight, 1),
    weightGain: round(gain, 3),
    totalWeightGain: round(totalWeightGain, 1),
    dailyGain: round(dGain, 4),
    dailyGainGrams: round(dailyGainGrams, 1),
    cumulativeAdg: round(cumulativeAdg, 1),
    cumulativeFeed: round(feedTotal),
    dailyFeedPerBird: round(dailyFeedPerBird, 1),
    weeklyFeedPerBird: round(weeklyFeedPerBird, 3),
    fcr: round(fcr, 3),
    standard: std,
    standardWeight: std ? parseFloat(std.target_weight) : null,
    standardGain: round(stdGain, 3),
    standardDailyGain: round(stdDGain, 4),
    standardDailyGainGrams: round(stdDGainGrams, 1),
    standardFcr: std ? parseFloat(std.standard_fcr) : null,
    standardFeedIntake: std ? parseFloat(std.standard_feed_intake) : null,
    weightDeviation: round(wStatus.diff, 3),
    weightStatus: wStatus.status,
    gainDeviation: round(deviationPercent(gain, stdGain)),
    fcrDeviation: round(
      deviationPercent(fcr, std ? parseFloat(std.standard_fcr) : null),
    ),
  };
}

