// ================================================================
// sections/weekly/weekly.aggregation.js
// تجمیع شاخص‌های عملکردی «کل گله» بر پایه جوجه‌ریزی سالن‌ها
//
// طبق تعریف بازار: یک گله = مجموع جوجه‌ریزی‌های هم‌نوبت در سالن‌های
// یک واحد؛ پس هر گله می‌تواند چند سالن داشته باشد.
//
// قواعد تجمیع:
//   • تلفات، خوراک و جمعیت  => مجموع سالن‌ها
//   • وزن                   => میانگین وزنی بر اساس جمعیت زنده همان هفته
//   • بقیه شاخص‌ها          => بازمحاسبه از داده تجمعی (نه میانگین‌گیری)
// ================================================================

import { calculateWeekMetrics } from "./weekly.calculations.js";

// ---------- کلید گروه‌بندی جوجه‌ریزی‌های یک گله ----------

export function flockGroupKey(flock) {
  if (!flock) return "unknown";

  const flockId =
    flock.flock_id ??
    flock.flockId ??
    flock.groupId ??
    flock.flock?.groupId ??
    flock.flock?.flock_id;

  if (flockId !== undefined && flockId !== null && flockId !== "") {
    return `f${flockId}`;
  }

  const flockNumber = flock.flock_number ?? flock.flockNumber;
  if (flockNumber !== undefined && flockNumber !== null && flockNumber !== "") {
    return `n${flockNumber}`;
  }

  return `p${flock.id}`;
}

// بزرگ‌ترین شماره هفته ثبت‌شده یک سالن
function maxSavedWeekNumber(hall) {
  return (hall?.savedWeeks || []).reduce(
    (max, w) => Math.max(max, parseInt(w.week_number) || 0),
    0,
  );
}

// ---------- تجمیع یک گله ----------

/**
 * ساخت داده تجمعی «کل گله» از جوجه‌ریزی سالن‌های آن.
 *
 * @param {{ halls?: Array, standards?: Array }} params
 * @returns {{ flock: Object, weeks: Array, savedWeeks: Array, statistics: Object } | null}
 *   اگر هیچ سالنی داده ثبت‌شده نداشته باشد یا مجموع جوجه صفر باشد، null برمی‌گردد.
 */
export function buildFlockGroupAggregate({ halls = [], standards = [] } = {}) {
  const activeHalls = (halls || []).filter(
    (h) => (h?.savedWeeks || []).length > 0,
  );
  if (activeHalls.length === 0) return null;

  const totalChicks = activeHalls.reduce(
    (sum, h) => sum + (parseInt(h.total_chicks_count) || 0),
    0,
  );
  if (totalChicks <= 0) return null;

  // میانگین وزنی وزن اولیه جوجه (گرم) بر اساس تعداد جوجه هر سالن
  let initialWeightSum = 0;
  let initialWeightBase = 0;
  activeHalls.forEach((h) => {
    const weight = parseFloat(h.avg_initial_weight);
    const chicks = parseInt(h.total_chicks_count) || 0;
    if (!isNaN(weight) && weight > 0 && chicks > 0) {
      initialWeightSum += weight * chicks;
      initialWeightBase += chicks;
    }
  });

  const flockAgg = {
    flock_number: activeHalls[0]?.flock_number ?? "—",
    total_chicks_count: totalChicks,
    avg_initial_weight:
      initialWeightBase > 0
        ? initialWeightSum / initialWeightBase
        : activeHalls[0]?.avg_initial_weight ?? null,
    standards: standards?.length ? standards : activeHalls[0]?.standards || [],
  };

  // ساخت هفته‌های ۱..N با تجمیع سالن‌ها
  const weekCount = activeHalls.reduce(
    (max, h) => Math.max(max, maxSavedWeekNumber(h)),
    0,
  );

  const weeks = [];
  for (let weekNumber = 1; weekNumber <= weekCount; weekNumber++) {
    let mortality = 0;
    let feed = 0;
    let weightedWeightSum = 0;
    let weightBase = 0;
    let ageDays = weekNumber * 7;
    let existsInDb = false;
    let datesSource = null;

    activeHalls.forEach((hall) => {
      const record = (hall.savedWeeks || []).find(
        (w) => parseInt(w.week_number) === weekNumber,
      );
      if (!record) return;

      existsInDb = true;
      datesSource = datesSource || record;

      mortality += parseFloat(record.weekly_mortality) || 0;
      feed += parseFloat(record.weekly_feed_intake) || 0;

      // وزن: میانگین وزنی بر اساس جمعیت زنده همان سالن در همان هفته
      const weight = parseFloat(record.weekly_weight);
      const birds = parseFloat(record.metrics?.birdsEndOfWeek);
      if (!isNaN(weight) && weight > 0 && birds > 0) {
        weightedWeightSum += weight * birds;
        weightBase += birds;
      }

      const age = parseInt(record.flock_age_days);
      if (age > 0) ageDays = age;
    });

    weeks.push({
      week_number: weekNumber,
      existsInDb,
      weekly_mortality: mortality,
      weekly_feed_intake: feed,
      weekly_weight: weightBase > 0 ? weightedWeightSum / weightBase : null,
      flock_age_days: ageDays,
      week_start_date: datesSource?.week_start_date ?? null,
      week_end_date: datesSource?.week_end_date ?? null,
    });
  }

  // محاسبه متریک‌های هر هفته با همان موتور محاسبات پروژه
  weeks.forEach((week) => {
    week.metrics = week.existsInDb
      ? calculateWeekMetrics({
          flock: flockAgg,
          weeks,
          weekNumber: week.week_number,
          formValues: {},
        })
      : null;
  });

  const savedWeeks = weeks.filter((w) => w.existsInDb);
  const lastSaved = savedWeeks[savedWeeks.length - 1];
  const finalMetrics = lastSaved?.metrics || null;

  const totalMortality = savedWeeks.reduce(
    (sum, w) => sum + (parseFloat(w.weekly_mortality) || 0),
    0,
  );
  const totalFeed = savedWeeks.reduce(
    (sum, w) => sum + (parseFloat(w.weekly_feed_intake) || 0),
    0,
  );
  const lastWeight = savedWeeks.reduce((last, w) => {
    const value = parseFloat(w.weekly_weight) || 0;
    return value > 0 ? value : last;
  }, 0);

  return {
    flock: flockAgg,
    weeks,
    savedWeeks,
    statistics: {
      totalMortality,
      totalFeed: totalFeed.toFixed(1),
      weekCount: savedWeeks.length,
      lastWeight,
      fcr: finalMetrics?.fcr ?? null,
      finalMetrics,
      hallCount: activeHalls.length,
    },
  };
}

// ---------- گروه‌بندی جوجه‌ریزی‌ها بر اساس گله ----------

export function groupFlocksByFlock(flocks = []) {
  const map = new Map();

  (flocks || []).forEach((flock) => {
    const key = flockGroupKey(flock);
    if (!map.has(key)) {
      map.set(key, {
        key,
        flockNumber: flock.flock_number ?? "—",
        breedNames: [],
        placementDates: [],
        standards: [],
        halls: [],
        isActive: false,
      });
    }

    const group = map.get(key);
    group.halls.push(flock);

    const breed = flock.breed_name || flock.breed?.name;
    if (breed && breed !== "—" && !group.breedNames.includes(breed)) {
      group.breedNames.push(breed);
    }
    if (flock.placement_date) group.placementDates.push(flock.placement_date);
    if (flock.is_active) group.isActive = true;
    if (!group.standards.length && flock.standards?.length) {
      group.standards = flock.standards;
    }
  });

  return [...map.values()].map((group) => ({
    ...group,
    breed_name: group.breedNames.join("، ") || "—",
    placement_date: group.placementDates[0] || null,
    total_chicks_count: group.halls.reduce(
      (sum, h) => sum + (parseInt(h.total_chicks_count) || 0),
      0,
    ),
    aggregate: buildFlockGroupAggregate({
      halls: group.halls,
      standards: group.standards,
    }),
  }));
}
