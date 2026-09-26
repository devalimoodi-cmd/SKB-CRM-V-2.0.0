// ============================================================
// services/flockCompletionCalc.js
// محاسبات خالص «پایان دوره گله» (بدون دیتابیس / بدون Express)
// ------------------------------------------------------------
// چرا این فایل؟
//   این توابع قبلاً داخل controllers/flockCompletionController.js
//   تعریف شده بودند و فقط از طریق HTTP قابل آزمودن بودند. اکنون
//   منبع یکتای این محاسبات همین فایل است تا مستقل تست شود.
//
// ⚠️ منطق محاسبات دست‌نخورده و همانند قبل است:
//   • ضریب تبدیل سیستمی = کل خوراک ÷ آخرین وزن
//   • ضریب تبدیل گله   = کل خوراک ÷ (وزن نهایی وزنی × قطعات نهایی)
//   • مبنای سن کشتار   = اختلاف تاریخ با جوجه‌ریزی + ۱ روز
// ============================================================
"use strict";

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
// ابزارهای محاسبه «سن کشتار نهایی» بر اساس روش انتخابی کاربر
// مبنای سن: اختلاف تاریخ با جوجه‌ریزی + ۱ روز (سازگار با منطق قدیم سرور)
// ============================================================
const toIsoDate = (v) => {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
};

const addDaysToIso = (iso, days) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

const ageDaysBetween = (placementIso, dateIso) => {
  const p = toIsoDate(placementIso);
  const d = toIsoDate(dateIso);
  if (!p || !d) return null;
  const dp = new Date(`${p}T00:00:00`);
  const dd = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dp.getTime()) || Number.isNaN(dd.getTime())) return null;
  const diff = Math.floor((dd - dp) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : null;
};

const SLAUGHTER_METHODS = new Set(["range", "direct", "weighted"]);

const computeSlaughterFields = (payload = {}, placementDate = null, fallback = {}) => {
  const method = SLAUGHTER_METHODS.has(payload.slaughter_age_method)
    ? payload.slaughter_age_method
    : null;
  const placementIso = toIsoDate(placementDate);
  const fallbackAge =
    fallback.age != null && fallback.age !== ""
      ? parseInt(fallback.age) || null
      : null;
  const hasExplicitAge =
    payload.slaughter_age_days != null && payload.slaughter_age_days !== "";
  const hasExplicitEndAge =
    payload.slaughter_age_end_days != null &&
    payload.slaughter_age_end_days !== "";

  const out = {
    slaughter_date: toIsoDate(payload.slaughter_date),
    slaughter_end_date: toIsoDate(payload.slaughter_end_date),
    slaughter_age_days: hasExplicitAge
      ? parseInt(payload.slaughter_age_days) || null
      : fallbackAge,
    slaughter_age_end_days: hasExplicitEndAge
      ? parseInt(payload.slaughter_age_end_days) || null
      : null,
    slaughter_age_method: method,
    slaughter_shipments: null,
  };

  if (method === "range") {
    out.slaughter_age_method = "range";
    const startAge = ageDaysBetween(placementIso, out.slaughter_date);
    const endAge =
      out.slaughter_end_date && out.slaughter_end_date !== out.slaughter_date
        ? ageDaysBetween(placementIso, out.slaughter_end_date)
        : startAge;
    if (startAge != null && endAge != null) {
      out.slaughter_age_days = Math.round((startAge + endAge) / 2);
    } else {
      out.slaughter_age_days = startAge != null ? startAge : fallbackAge;
    }
    out.slaughter_age_end_days = endAge != null ? endAge : null;
    out.slaughter_shipments = null;
    return out;
  }

  if (method === "direct") {
    out.slaughter_age_method = "direct";
    const entered =
      payload.slaughter_age_days != null && payload.slaughter_age_days !== ""
        ? parseInt(payload.slaughter_age_days) || 0
        : 0;
    out.slaughter_age_days = entered > 0 ? entered : fallbackAge;
    out.slaughter_age_end_days = null;
    out.slaughter_date =
      entered > 0 && placementIso
        ? addDaysToIso(placementIso, entered - 1)
        : out.slaughter_date;
    out.slaughter_end_date = null;
    out.slaughter_shipments = null;
    return out;
  }

  if (method === "weighted") {
    out.slaughter_age_method = "weighted";
    const rows = (Array.isArray(payload.slaughter_shipments)
      ? payload.slaughter_shipments
      : []
    )
      .map((r) => ({
        age_days: parseInt(r.age_days) || 0,
        quantity: parseInt(r.quantity) || 0,
        date: toIsoDate(r.date),
      }))
      .filter((r) => r.age_days > 0 && r.quantity > 0);

    if (rows.length > 0) {
      const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
      const weighted =
        rows.reduce((s, r) => s + r.age_days * r.quantity, 0) / totalQty;
      const withDates = rows.map((r) => ({
        age_days: r.age_days,
        quantity: r.quantity,
        date: r.date || (placementIso ? addDaysToIso(placementIso, r.age_days - 1) : null),
      }));
      const dates = withDates.map((r) => r.date).filter(Boolean).sort();
      out.slaughter_age_days = Math.round(weighted);
      out.slaughter_age_end_days = null;
      out.slaughter_date = dates.length ? dates[0] : null;
      out.slaughter_end_date = dates.length > 1 ? dates[dates.length - 1] : null;
      out.slaughter_shipments = withDates;
    } else {
      out.slaughter_age_days = fallbackAge;
      out.slaughter_date = null;
      out.slaughter_end_date = null;
      out.slaughter_shipments = null;
    }
    return out;
  }

  // بدون روش (داده/رکورد قدیمی): همان مقادیر خام ارسالی + سازگاری محاسبه از تاریخ
  if (!method) {
    if (out.slaughter_date && placementIso) {
      const derivedStart = ageDaysBetween(placementIso, out.slaughter_date);
      if (!hasExplicitAge && derivedStart != null) {
        out.slaughter_age_days = derivedStart;
      }
      const derivedEnd =
        out.slaughter_end_date &&
        out.slaughter_end_date !== out.slaughter_date
          ? ageDaysBetween(placementIso, out.slaughter_end_date)
          : null;
      if (!hasExplicitEndAge && derivedEnd != null) {
        out.slaughter_age_end_days = derivedEnd;
      }
    }
  }
  return out;
};

module.exports = {
  calculateSystemData,
  buildHallDetail,
  aggregateHallDetails,
  toIsoDate,
  addDaysToIso,
  ageDaysBetween,
  SLAUGHTER_METHODS,
  computeSlaughterFields,
};
