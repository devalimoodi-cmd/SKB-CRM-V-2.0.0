// ================================================================
//  حسابرسی «هفته‌های ثبت‌نشده / ناقص» مدیریت هفتگی
// ----------------------------------------------------------------
//  ❓ چرا؟ در داده‌های هفتگی، هفته‌های نظری‌ای که هیچ رکوردی ندارند
//  (existsInDb === false که در weekly.service → calculateWeeks ساخته
//  می‌شوند) پیش از این در گزارش‌ها نمایش داده نمی‌شدند؛ پس کاربر
//  متوجه نمی‌شد کدام هفته‌ها اطلاعات ندارد. این ماژول خالص وضعیت هر
//  هفته را تعیین می‌کند تا رندرر هشدار و ردیف «ثبت نشده» اضافه کند.
//  هیچ محاسبه/آماری تغییر نمی‌کند (مجموع‌ها روی هفته‌های ثبت‌شده است).
// ================================================================

export const WEEK_STATUS = {
  COMPLETE: "complete",
  PARTIAL: "partial",
  MISSING: "missing",
};

const toNum = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/** هفته‌ای که رکورد دیتابیس دارد (رکوردهای خام API این فلگ را ندارند → ثبت‌شده فرض می‌شوند) */
export function isRecordedWeek(week) {
  return !!week && week.existsInDb !== false;
}

/** وزن هفتگی ثبت شده؟ */
export function hasWeightValue(week) {
  const w = toNum(week?.weekly_weight);
  return w !== null && w > 0;
}

/** خوراک ثبت شده؟ (هفتگی یا روزانه) */
export function hasFeedValue(week) {
  const weekly = toNum(week?.weekly_feed_intake);
  if (weekly !== null && weekly > 0) return true;
  const daily = toNum(week?.daily_feed_intake);
  return daily !== null && daily > 0;
}

/** فیلدهای ناقص یک هفته (برای متن هشدار) */
export function weekMissingFields(week) {
  const fields = [];
  if (!hasWeightValue(week)) fields.push("وزن");
  if (!hasFeedValue(week)) fields.push("خوراک");
  return fields;
}

/** وضعیت یک هفته: complete | partial | missing */
export function weekAuditStatus(week) {
  if (!week || week.week_number === null || week.week_number === undefined) {
    return WEEK_STATUS.MISSING;
  }
  if (!isRecordedWeek(week)) return WEEK_STATUS.MISSING;
  return hasWeightValue(week) && hasFeedValue(week)
    ? WEEK_STATUS.COMPLETE
    : WEEK_STATUS.PARTIAL;
}

/** متن خوانای لیست شماره‌ها: ۳، ۵ و ۷ (قالب‌بندی اعداد با formatter) */
export function formatWeekList(numbers = [], formatter = (n) => String(n)) {
  const list = (numbers || []).map((n) => formatter(n));
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join("، ")} و ${list[list.length - 1]}`;
}

/**
 * حسابرسی یک گله/سالن بر اساس لیست هفته‌ها (نظری + ثبت‌شده)
 * @param {Array} weeks لیست هفته‌ها با فلگ existsInDb
 * @param {string} label برچسب (نام سالن) برای هشدارهای چندسالنه
 */
export function auditWeeks(weeks = [], label = "") {
  const list = (weeks || [])
    .filter((w) => w && w.week_number !== null && w.week_number !== undefined)
    .slice()
    .sort((a, b) => a.week_number - b.week_number);

  const statuses = {};
  const fields = {};
  const missing = [];
  const partial = [];
  let recorded = 0;
  let complete = 0;

  list.forEach((week) => {
    const status = weekAuditStatus(week);
    statuses[week.week_number] = status;
    if (status === WEEK_STATUS.MISSING) {
      missing.push(week.week_number);
    } else {
      recorded += 1;
      if (status === WEEK_STATUS.COMPLETE) {
        complete += 1;
      } else {
        partial.push(week.week_number);
        fields[week.week_number] = weekMissingFields(week);
      }
    }
  });

  return {
    label,
    total: list.length,
    recorded,
    complete,
    missing,
    partial,
    weeks: list.map((w) => w.week_number),
    statuses,
    fields,
    hasIssues: missing.length > 0 || partial.length > 0,
  };
}

/**
 * ادغام حسابرسی چند سالن برای «کل گله»:
 *  - missing: هفته‌ای که هیچ‌یک از سالن‌های پوشش‌دهندهٔ آن رکوردی ندارد
 *  - partial: هفته‌ای که حداقل یک سالن ثبت‌نشده/ناقص دارد ولی کاملاً بدون داده نیست
 */
export function mergeAudits(audits = []) {
  const list = (audits || []).filter(Boolean);
  if (list.length === 0) return auditWeeks([], "");

  const weekSet = new Set();
  list.forEach((audit) => (audit.weeks || []).forEach((n) => weekSet.add(n)));
  const weeks = [...weekSet].sort((a, b) => a - b);

  const statuses = {};
  const byWeek = {};
  const missing = [];
  const partial = [];

  weeks.forEach((weekNumber) => {
    const covering = list.filter((audit) =>
      (audit.weeks || []).includes(weekNumber),
    );
    const states = covering.map(
      (audit) => audit.statuses?.[weekNumber] || WEEK_STATUS.MISSING,
    );
    const recordedCount = states.filter(
      (state) => state !== WEEK_STATUS.MISSING,
    ).length;

    let status = WEEK_STATUS.COMPLETE;
    if (recordedCount === 0) {
      status = WEEK_STATUS.MISSING;
    } else if (states.some((state) => state !== WEEK_STATUS.COMPLETE)) {
      status = WEEK_STATUS.PARTIAL;
    }

    statuses[weekNumber] = status;
    byWeek[weekNumber] = { complete: [], partial: [], missing: [] };
    covering.forEach((audit) => {
      const state = audit.statuses?.[weekNumber] || WEEK_STATUS.MISSING;
      byWeek[weekNumber][state].push(audit.label || "");
    });

    if (status === WEEK_STATUS.MISSING) missing.push(weekNumber);
    else if (status === WEEK_STATUS.PARTIAL) partial.push(weekNumber);
  });

  return {
    label: "",
    total: weeks.length,
    recorded: weeks.length - missing.length,
    complete: weeks.length - missing.length - partial.length,
    missing,
    partial,
    weeks,
    statuses,
    byWeek,
    fields: {},
    halls: list.map((audit) => audit.label).filter(Boolean),
    hasIssues: missing.length > 0 || partial.length > 0,
  };
}

// ================================================================
//  مبنای «پایان گله» — انتظار ثبت تا کدام هفته؟
// ----------------------------------------------------------------
//  ❗ قاعدهٔ طلایی: گلهٔ تکمیل‌شده هرگز تا «امروز» کش نمی‌آید.
//  ترتیب اولویت منابع پایان دوره:
//    ۱) تاریخ پایان کشتار (slaughter_end_date)              → high
//    ۲) تاریخ شروع کشتار (slaughter_date)                   → high
//    ۳) سن کشتار (slaughter_age_end_days/slaughter_age_days)→ high
//    ۴) flock.ended_at (تاریخ پایان گله)                    → medium
//    ۵) completion_date (تاریخ ثبت پایان دوره در سیستم)      → low
//    ۶) آخرین هفتهٔ ثبت‌شده                                   → محافظه‌کارانه
//  در حالت low سقف هفته‌ها به آخرین هفتهٔ ثبت‌شده محدود می‌شود؛ چون آن
//  تاریخ، «تاریخ ورود اطلاعات به سیستم» است نه پایان دوره (پیش‌فرض
//  فرم پایان دوره = امروز).
// ================================================================

export const TIMELINE_SOURCE = {
  SLAUGHTER_END_DATE: "slaughter-end-date",
  SLAUGHTER_DATE: "slaughter-date",
  SLAUGHTER_AGE: "slaughter-age",
  ENDED_AT: "ended-at",
  COMPLETION_DATE: "completion-date",
  LAST_WEEK: "last-week",
  TODAY: "today",
};

export const TIMELINE_CONFIDENCE = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

const SOURCE_CONFIDENCE = {
  [TIMELINE_SOURCE.SLAUGHTER_END_DATE]: TIMELINE_CONFIDENCE.HIGH,
  [TIMELINE_SOURCE.SLAUGHTER_DATE]: TIMELINE_CONFIDENCE.HIGH,
  [TIMELINE_SOURCE.SLAUGHTER_AGE]: TIMELINE_CONFIDENCE.HIGH,
  [TIMELINE_SOURCE.ENDED_AT]: TIMELINE_CONFIDENCE.MEDIUM,
  [TIMELINE_SOURCE.COMPLETION_DATE]: TIMELINE_CONFIDENCE.LOW,
  [TIMELINE_SOURCE.LAST_WEEK]: TIMELINE_CONFIDENCE.HIGH,
  [TIMELINE_SOURCE.TODAY]: TIMELINE_CONFIDENCE.HIGH,
};

const SOURCE_LABELS = {
  [TIMELINE_SOURCE.SLAUGHTER_END_DATE]: "تاریخ پایان کشتار",
  [TIMELINE_SOURCE.SLAUGHTER_DATE]: "تاریخ کشتار",
  [TIMELINE_SOURCE.SLAUGHTER_AGE]: "سن کشتار",
  [TIMELINE_SOURCE.ENDED_AT]: "تاریخ پایان گله",
  [TIMELINE_SOURCE.COMPLETION_DATE]: "تاریخ ثبت پایان دوره در سیستم",
  [TIMELINE_SOURCE.LAST_WEEK]: "آخرین هفتهٔ ثبت‌شده",
  [TIMELINE_SOURCE.TODAY]: "گلهٔ در جریان (تا امروز)",
};

const COMPLETED_STATUSES = [
  "completed",
  "cancelled",
  "canceled",
  "inactive",
  "finished",
  "closed",
];

const firstValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
};

const lastSavedWeekOf = (savedWeeks = []) =>
  (savedWeeks || []).reduce(
    (max, week) => Math.max(max, parseInt(week?.week_number, 10) || 0),
    0,
  );

/** شمارهٔ هفتهٔ یک تاریخ نسبت به تاریخ جوجه‌ریزی (۱-based) */
export function weekNumberOfDate(placementDate, date) {
  if (!placementDate || !date) return null;
  const start = new Date(placementDate);
  const target = date instanceof Date ? date : new Date(date);
  if (isNaN(start.getTime()) || isNaN(target.getTime())) return null;
  const days = Math.floor((target - start) / 86400000) + 1;
  if (days <= 0) return null;
  return Math.ceil(days / 7);
}

/**
 * تعیین مبنای پایان گله و شمارهٔ آخرین هفتهٔ مورد انتظار
 * @returns {{placementDate,endDate,endWeek,source,confidence,isActive,lastSavedWeek}}
 */
export function resolveFlockTimelineEnd({
  flock = null,
  placement = null,
  completion = null,
  savedWeeks = [],
  today = new Date(),
  isActive,
} = {}) {
  const lastSavedWeek = lastSavedWeekOf(savedWeeks);
  const placementDate = firstValue(
    flock?.placement_date,
    placement?.placement_date,
    completion?.placement?.placement_date,
  );

  const status = String(
    firstValue(flock?.status, placement?.flock_status, placement?.status) || "",
  ).toLowerCase();
  const endedAt = firstValue(
    flock?.ended_at,
    placement?.ended_at,
    placement?.flock_ended_at,
  );
  const inactiveFlag =
    flock?.is_active === false || placement?.is_active === false;
  const hasCompletion = !!completion;

  const autoActive =
    !inactiveFlag &&
    !hasCompletion &&
    !endedAt &&
    !COMPLETED_STATUSES.includes(status);
  const active = typeof isActive === "boolean" ? isActive : autoActive;
  const todayWeek = weekNumberOfDate(placementDate, today);

  // ── گلهٔ در جریان: پایان مورد انتظار = امروز
  if (active) {
    return {
      placementDate,
      endDate: null,
      endWeek: todayWeek ?? lastSavedWeek,
      source: TIMELINE_SOURCE.TODAY,
      confidence: TIMELINE_CONFIDENCE.HIGH,
      isActive: true,
      lastSavedWeek,
    };
  }

  // ── گلهٔ بسته/تکمیل‌شده: نزدیک‌ترین منبع معتبر پایان دوره
  let source = null;
  let endDate = null;
  let endWeek = null;

  const slaughterEndDate = firstValue(completion?.slaughter_end_date);
  const slaughterDate = firstValue(completion?.slaughter_date);
  const slaughterAge = firstValue(
    completion?.slaughter_age_end_days,
    completion?.slaughter_age_days,
  );

  if (slaughterEndDate) {
    source = TIMELINE_SOURCE.SLAUGHTER_END_DATE;
    endDate = slaughterEndDate;
    endWeek = weekNumberOfDate(placementDate, slaughterEndDate);
  }
  if (endWeek == null && slaughterDate) {
    source = TIMELINE_SOURCE.SLAUGHTER_DATE;
    endDate = slaughterDate;
    endWeek = weekNumberOfDate(placementDate, slaughterDate);
  }
  if (endWeek == null && slaughterAge) {
    const age = parseInt(slaughterAge, 10);
    if (Number.isFinite(age) && age > 0) {
      source = TIMELINE_SOURCE.SLAUGHTER_AGE;
      endWeek = Math.ceil(age / 7);
    }
  }
  if (endWeek == null && endedAt) {
    source = TIMELINE_SOURCE.ENDED_AT;
    endDate = endedAt;
    endWeek = weekNumberOfDate(placementDate, endedAt);
  }
  if (endWeek == null && firstValue(completion?.completion_date)) {
    source = TIMELINE_SOURCE.COMPLETION_DATE;
    endDate = completion.completion_date;
    endWeek = weekNumberOfDate(placementDate, completion.completion_date);
  }
  if (endWeek == null) {
    source = TIMELINE_SOURCE.LAST_WEEK;
    endWeek = lastSavedWeek;
  }

  const confidence = SOURCE_CONFIDENCE[source] || TIMELINE_CONFIDENCE.MEDIUM;

  // ۱) هرگز از امروز جلوتر نرویم
  if (todayWeek != null && endWeek != null && endWeek > todayWeek) {
    endWeek = todayWeek;
  }
  // ۲) «تاریخ ثبت پایان دوره در سیستم» مبنای پایان دوره نیست → سقف = آخرین هفتهٔ ثبت‌شده
  if (confidence === TIMELINE_CONFIDENCE.LOW) {
    endWeek = Math.min(endWeek ?? lastSavedWeek, lastSavedWeek);
  }
  // ۳) هرگز کمتر از آخرین هفتهٔ ثبت‌شده (رکوردهای واقعی حذف نمی‌شوند)
  endWeek = Math.max(endWeek ?? 0, lastSavedWeek, 0);

  return {
    placementDate,
    endDate,
    endWeek,
    source,
    confidence,
    isActive: false,
    lastSavedWeek,
  };
}

/**
 * محدودکردن حسابرسی به هفته‌های انتخاب‌شده (هشدار گزارش فقط روی همین هفته‌ها)
 * weekNumbers = null → بدون تغییر (همهٔ هفته‌ها)
 */
export function scopeAuditToWeeks(audit, weekNumbers) {
  if (!audit || !Array.isArray(weekNumbers)) return audit;

  const keep = (n) => weekNumbers.includes(parseInt(n, 10));
  const statuses = {};
  Object.keys(audit.statuses || {}).forEach((key) => {
    if (keep(key)) statuses[key] = audit.statuses[key];
  });
  const fields = {};
  Object.keys(audit.fields || {}).forEach((key) => {
    if (keep(key)) fields[key] = audit.fields[key];
  });
  const byWeek = {};
  Object.keys(audit.byWeek || {}).forEach((key) => {
    if (keep(key)) byWeek[key] = audit.byWeek[key];
  });

  const weeks = (audit.weeks || []).filter(keep);
  const missing = (audit.missing || []).filter(keep);
  const partial = (audit.partial || []).filter(keep);

  return {
    ...audit,
    scoped: true,
    weeks,
    total: weeks.length,
    recorded: weeks.filter((n) => statuses[n] !== WEEK_STATUS.MISSING).length,
    complete: weeks.filter((n) => statuses[n] === WEEK_STATUS.COMPLETE).length,
    missing,
    partial,
    statuses,
    fields,
    byWeek,
    hasIssues: missing.length > 0 || partial.length > 0,
  };
}

/** توضیح خوانای مبنای پایان گله (برای نمایش در گزارش) */
export function timelineBasisLabel(timeline, formatter = (date) => date) {
  if (!timeline) return "";
  const label = SOURCE_LABELS[timeline.source] || "نامشخص";
  const datePart = timeline.endDate ? ` ${formatter(timeline.endDate)}` : "";
  const clampNote =
    timeline.confidence === TIMELINE_CONFIDENCE.LOW
      ? " — چون تاریخ واقعی پایان دوره (کشتار) ثبت نشده، فقط تا آخرین هفتهٔ ثبت‌شده بررسی شد"
      : "";
  const weekNote =
    timeline.endWeek != null ? ` (تا هفتهٔ ${timeline.endWeek})` : "";
  return `${label}${datePart}${weekNote}${clampNote}`;
}

/**
 * سقف «هفتهٔ مورد انتظار» — برای سازگاری عقب‌رو نگه داشته شده و
 * داخلاً از resolveFlockTimelineEnd استفاده می‌کند.
 *  - گلهٔ فعال → تا امروز
 *  - گلهٔ بسته با تاریخ پایان دوره → تا پایان دوره (ترجیح: تاریخ کشتار)
 *  - گلهٔ بسته بدون تاریخ پایان → تا آخرین هفتهٔ ثبت‌شده
 */
export function expectedWeekLimit({
  placementDate,
  completionDate = null,
  isActive = true,
  savedWeeks = [],
  today = new Date(),
  flock = null,
  placement = null,
  completion = null,
} = {}) {
  const resolved = resolveFlockTimelineEnd({
    flock,
    placement:
      placement || (placementDate ? { placement_date: placementDate } : null),
    completion:
      completion || (completionDate ? { completion_date: completionDate } : null),
    savedWeeks,
    today,
    isActive,
  });
  return resolved.endWeek;
}

