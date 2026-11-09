// ============================================================
// features/portal/portal.farm.weeks.js
// حساب‌وکتاب «هفته» در پورتال — موج ۱۳.۱۵
// ------------------------------------------------------------
//  چرا فایل جدا و «خالص»؟
//   • فرم کارشناس شمارهٔ هفته/تاریخ شروع/پایان/سن گله را **مخفی**
//     و محاسبه‌شده دارد. پورتال همان محاسبه را لازم دارد، ولی اگر
//     داخل mixin بنشیند تست‌پذیر نیست.
//   • این فایل هیچ import ای ندارد (بدون DOM/شبکه) ⇒ گارد پورتال
//     می‌تواند آن را مستقیم import و اجرا کند.
//
//  🔒 این محاسبه فقط «پیشنهاد» است؛ اعتبارسنجی نهایی و ترتیب هفته‌ها
//     (week_duplicate / week_order) در سرور اجرا می‌شود.
// ============================================================

// تاریخ ISO (YYYY-MM-DD) از رشتهٔ ISO کامل یا Date
export const isoDateOf = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value === null || value === undefined ? "" : value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (iso) => {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const addDays = (iso, days) => {
  const base = toUtc(iso);
  const shift = Number(days);
  if (!base || !Number.isFinite(shift)) return "";
  return new Date(base.getTime() + shift * DAY_MS).toISOString().slice(0, 10);
};

const daysBetween = (fromIso, toIso) => {
  const from = toUtc(fromIso);
  const to = toUtc(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
};

// برنامهٔ هفتهٔ بعدی: شماره + بازهٔ ۷ روزه + سن گله
//  • ورودی: دوره (placement_date/chick_age_on_arrival) + هفته‌های ثبت‌شده
//  • خروجی: { week_number, week_start_date, week_end_date, flock_age_days }
export const weekPlanFor = ({ placement = {}, weeks = [], today = null } = {}) => {
  const rows = Array.isArray(weeks) ? weeks : [];

  const numbers = rows
    .map((row) => Number(row && row.week_number))
    .filter((value) => Number.isInteger(value) && value > 0);
  const weekNumber = numbers.length ? Math.max(...numbers) + 1 : 1;

  const lastEnd = rows.reduce((latest, row) => {
    const value = isoDateOf(row && row.week_end_date);
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, "");

  const placementDate = isoDateOf(placement.placement_date);
  const fallback = isoDateOf(today) || isoDateOf(new Date());
  const start = lastEnd ? addDays(lastEnd, 1) : placementDate || fallback;
  const end = addDays(start, 6);

  const ageFromPlacement = placementDate ? daysBetween(placementDate, start) : null;
  const ageAtArrival = Number(placement.chick_age_on_arrival) || 0;
  const flockAge = Math.max(
    0,
    (ageFromPlacement === null ? 0 : ageFromPlacement) + ageAtArrival,
  );

  return {
    week_number: weekNumber,
    week_start_date: start,
    week_end_date: end,
    flock_age_days: flockAge,
  };
};

// خطای بازهٔ تاریخ هفته (شروع/پایان) — پیام فارسی یا رشتهٔ خالی
export const weeklyDateError = ({ week_start_date, week_end_date } = {}) => {
  const start = isoDateOf(week_start_date);
  const end = isoDateOf(week_end_date);
  if (!start || !end) return "";
  if (end < start) return "پایان هفته نمی‌تواند پیش از شروع آن باشد";
  if (daysBetween(start, end) > 13) {
    return "بازهٔ هفته بیش از حد طولانی است؛ بازهٔ ۷ روزه را بررسی کنید";
  }
  return "";
};

// برچسب فارسی بازهٔ هفته برای فهرست کشویی (بدون وابستگی به رندرر)
export const weekOptionText = (row = {}) => {
  const number = Number(row.week_number);
  const label = Number.isInteger(number) && number > 0 ? `هفته ${number}` : "هفته";
  const start = isoDateOf(row.week_start_date);
  const end = isoDateOf(row.week_end_date);
  if (!start && !end) return label;
  return `${label} — ${start || "?"} تا ${end || "?"}`;
};
