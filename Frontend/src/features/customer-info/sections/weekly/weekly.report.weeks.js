// ================================================================
//  انتخاب هفته‌های گزارش (خالص و تست‌پذیر)
// ----------------------------------------------------------------
//  ❓ چرا؟ کاربر باید بتواند پیش از تولید گزارش تعیین کند «کدام
//  هفته‌ها» در جدول‌ها بیاید. مدل انتخابی «ترکیبی» است:
//    • یک انتخاب مشترک برای همهٔ گله‌ها (shared)
//    • + امکان تنظیم جداگانهٔ هر گله (overrides)
//  پیش‌فرض (shared = null) یعنی «همهٔ هفته‌ها» تا رفتار قبلی حفظ شود.
// ================================================================

import {
  WEEK_STATUS,
  weekAuditStatus,
  weekMissingFields,
} from "./weekly.audit.js";

export const WEEK_PRESET = {
  ALL: "all",
  RECORDED: "recorded",
  ISSUES: "issues",
  RANGE: "range",
  MANUAL: "manual",
};

export const WEEK_SELECTION_STORAGE_KEY = "skb_weekly_report_weeks";

export const WEEK_PRESET_LABELS = {
  [WEEK_PRESET.ALL]: "همهٔ هفته‌ها",
  [WEEK_PRESET.RECORDED]: "فقط هفته‌های ثبت‌شده",
  [WEEK_PRESET.ISSUES]: "فقط مشکل‌دارها (بدون ثبت/ناقص)",
  [WEEK_PRESET.RANGE]: "بازهٔ دلخواه",
  [WEEK_PRESET.MANUAL]: "انتخاب دستی",
};

export const WEEK_STATUS_LABELS = {
  [WEEK_STATUS.COMPLETE]: "ثبت‌شده",
  [WEEK_STATUS.PARTIAL]: "ناقص",
  [WEEK_STATUS.MISSING]: "بدون ثبت",
};

const toWeekNumber = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
};

const uniqSorted = (numbers = []) =>
  [...new Set((numbers || []).map(toWeekNumber).filter((n) => n !== null))].sort(
    (a, b) => a - b,
  );

/**
 * خط زمانی هفته‌های یک گله/سالن (ثبت‌شده + نظری) با وضعیت هر هفته
 * @returns {Array<{weekNumber,startDate,endDate,status,hasData,missingFields}>}
 */
export function buildWeekTimeline(weeks = []) {
  return (weeks || [])
    .filter((week) => week && toWeekNumber(week.week_number) !== null)
    .map((week) => {
      const status = weekAuditStatus(week);
      return {
        weekNumber: toWeekNumber(week.week_number),
        startDate: week.week_start_date || null,
        endDate: week.week_end_date || null,
        status,
        hasData: status !== WEEK_STATUS.MISSING,
        missingFields:
          status === WEEK_STATUS.PARTIAL ? weekMissingFields(week) : [],
      };
    })
    .sort((a, b) => a.weekNumber - b.weekNumber);
}

/** هفته‌های حاصل از یک پریست روی خط زمانی مشخص */
export function resolvePresetWeeks(preset, timeline = [], { from, to } = {}) {
  const statusOf = new Map((timeline || []).map((t) => [t.weekNumber, t.status]));
  const numbers = (timeline || []).map((t) => t.weekNumber);

  switch (preset) {
    case WEEK_PRESET.RECORDED:
      return numbers.filter((n) => statusOf.get(n) !== WEEK_STATUS.MISSING);
    case WEEK_PRESET.ISSUES:
      return numbers.filter((n) => statusOf.get(n) !== WEEK_STATUS.COMPLETE);
    case WEEK_PRESET.RANGE: {
      const start = toWeekNumber(from);
      const end = toWeekNumber(to);
      return numbers.filter(
        (n) => (start === null || n >= start) && (end === null || n <= end),
      );
    }
    case WEEK_PRESET.MANUAL:
      return [];
    case WEEK_PRESET.ALL:
    default:
      return numbers;
  }
}

/**
 * نرمال‌سازی یک «قاعده/لیست» انتخاب هفته:
 *  null → همهٔ هفته‌ها · آرایه → هفته‌های مشخص · object → {preset, from, to}
 */
const normalizeWeekRule = (rule) => {
  if (rule === null || rule === undefined) return null;
  if (Array.isArray(rule)) return uniqSorted(rule);
  if (typeof rule === "object") {
    const preset = Object.values(WEEK_PRESET).includes(rule.preset)
      ? rule.preset
      : WEEK_PRESET.ALL;
    return {
      preset,
      from: toWeekNumber(rule.from),
      to: toWeekNumber(rule.to),
    };
  }
  return null;
};

/** حل یک قاعده/لیست روی خط زمانی مشخص → شمارهٔ هفته‌ها */
export function resolveWeekRule(rule, timeline = []) {
  const normalized = normalizeWeekRule(rule);
  if (normalized === null) return (timeline || []).map((t) => t.weekNumber);
  if (Array.isArray(normalized)) {
    const picked = new Set(normalized);
    return (timeline || [])
      .map((t) => t.weekNumber)
      .filter((n) => picked.has(n));
  }
  return resolvePresetWeeks(normalized.preset, timeline, normalized);
}

/**
 * نرمال‌سازی مدل انتخاب هفته‌ها
 *  shared = null یعنی «همهٔ هفته‌ها» (پیش‌فرض = رفتار قبلی گزارش‌ها)
 *  shared = {preset, from, to} یعنی قاعدهٔ مشترک که روی هر گله جداگانه
 *  حل می‌شود (مثلاً «فقط هفته‌های مشکل‌دار» برای هر گله متفاوت است).
 *  overrides[key] خالی ⇒ «هیچ هفته‌ای» → آن گله از گزارش حذف می‌شود
 */
export function normalizeWeekSelection(selection) {
  if (!selection || typeof selection !== "object") {
    return { mode: "shared", shared: null, overrides: {} };
  }

  const shared = normalizeWeekRule(selection.shared);

  const overrides = {};
  const rawOverrides = selection.overrides || {};
  Object.keys(rawOverrides).forEach((key) => {
    overrides[String(key)] = normalizeWeekRule(rawOverrides[key]);
  });

  const mode =
    Object.keys(overrides).length > 0 || selection.mode === "mixed"
      ? "mixed"
      : "shared";

  return { mode, shared, overrides };
}
export function hasWeekOverride(selection, key) {
  const normalized = normalizeWeekSelection(selection);
  return Object.prototype.hasOwnProperty.call(normalized.overrides, String(key));
}

/**
 * هفته‌های نهایی یک گله/سالن:
 *  override همان گله (اگر باشد) وگرنه انتخاب مشترک — همیشه به‌صورت
 *  اشتراک با هفته‌های واقعی همان گله (هفته‌ای که گله ندارد نادیده می‌رود)
 */
export function effectiveWeeksFor(selection, key, timeline = []) {
  const normalized = normalizeWeekSelection(selection);
  const picked = Object.prototype.hasOwnProperty.call(
    normalized.overrides,
    String(key),
  )
    ? normalized.overrides[String(key)]
    : normalized.shared;

  return resolveWeekRule(picked, timeline);
}

/**
 * ادغام خط زمانی چند سالن یک گله (برای پنل انتخاب هفته در گزارش تاریخچه):
 *  هفته‌ای که در هیچ سالنی ثبت نشده → missing · همه کامل → complete ·
 *  در غیر این صورت → partial (همان قاعدهٔ «کل گله»)
 */
export function mergeWeekTimelines(timelines = []) {
  const list = (timelines || []).filter((t) => Array.isArray(t) && t.length);
  const map = new Map();

  list.forEach((timeline) => {
    (timeline || []).forEach((week) => {
      const entry = map.get(week.weekNumber) || {
        weekNumber: week.weekNumber,
        startDate: null,
        endDate: null,
        statuses: [],
      };
      entry.statuses.push(week.status);
      if (!entry.startDate && week.startDate) entry.startDate = week.startDate;
      if (!entry.endDate && week.endDate) entry.endDate = week.endDate;
      map.set(week.weekNumber, entry);
    });
  });

  return [...map.values()]
    .map((entry) => {
      const statuses = entry.statuses;
      const recordedCount = statuses.filter(
        (s) => s !== WEEK_STATUS.MISSING,
      ).length;
      let status = WEEK_STATUS.COMPLETE;
      if (recordedCount === 0) status = WEEK_STATUS.MISSING;
      else if (statuses.some((s) => s !== WEEK_STATUS.COMPLETE)) {
        status = WEEK_STATUS.PARTIAL;
      }
      return {
        weekNumber: entry.weekNumber,
        startDate: entry.startDate,
        endDate: entry.endDate,
        status,
        hasData: status !== WEEK_STATUS.MISSING,
        missingFields: [],
      };
    })
    .sort((a, b) => a.weekNumber - b.weekNumber);
}

/** اجتماع انتخاب چند گله/سالن — برای جدول تجمعی «کل گله» */
export function unionWeekSelection(selection, keys = [], timelinesByKey = {}) {
  const set = new Set();
  (keys || []).forEach((key) => {
    effectiveWeeksFor(selection, key, timelinesByKey[key] || []).forEach((n) =>
      set.add(n),
    );
  });
  return [...set].sort((a, b) => a - b);
}

/** هفته‌های مشکل‌دار خارج از انتخاب کاربر (برای خط اطلاعی گزارش) */
export function issuesOutsideSelection(selection, key, timeline = []) {
  const selected = new Set(effectiveWeeksFor(selection, key, timeline));
  return (timeline || [])
    .filter((t) => !selected.has(t.weekNumber) && t.status !== WEEK_STATUS.COMPLETE)
    .map((t) => t.weekNumber);
}

/** خلاصهٔ انتخاب برای شمارنده‌های مودال و خط خلاصهٔ گزارش */
export function summarizeWeekSelection(selection, timelinesByKey = {}) {
  const normalized = normalizeWeekSelection(selection);
  const entries = Object.entries(timelinesByKey || {});

  let weeks = 0;
  let recorded = 0;
  let partial = 0;
  let missing = 0;
  let overridden = 0;
  let excluded = 0;
  let skippedShared = 0;

  entries.forEach(([key, timeline]) => {
    const effective = effectiveWeeksFor(normalized, key, timeline);
    if (hasWeekOverride(normalized, key)) overridden += 1;

    if (effective.length === 0) {
      excluded += 1;
      return;
    }

    const statusOf = new Map((timeline || []).map((t) => [t.weekNumber, t.status]));
    effective.forEach((n) => {
      const status = statusOf.get(n);
      if (status === WEEK_STATUS.MISSING) missing += 1;
      else if (status === WEEK_STATUS.PARTIAL) partial += 1;
      else recorded += 1;
    });

    if (normalized.shared && Array.isArray(normalized.shared)) {
      const own = new Set((timeline || []).map((t) => t.weekNumber));
      skippedShared += normalized.shared.filter((n) => !own.has(n)).length;
    }
    weeks += effective.length;
  });

  return {
    flocks: entries.length - excluded,
    totalFlocks: entries.length,
    weeks,
    recorded,
    partial,
    missing,
    overridden,
    excluded,
    skippedShared,
    hasIssues: missing > 0 || partial > 0,
  };
}

/** متن خوانای محدودهٔ انتخاب‌شده: «هفته‌های ۳ تا ۶ (۴ از ۹)» */
export function weekSelectionLabel(
  numbers = [],
  timelineNumbers = [],
  formatter = (n) => String(n),
) {
  const list = uniqSorted(numbers);
  const all = uniqSorted(timelineNumbers);
  if (list.length === 0) return "هیچ هفته‌ای";
  if (all.length > 0 && list.length === all.length) {
    return `همهٔ ${formatter(all.length)} هفته`;
  }

  const suffix =
    all.length > 0
      ? ` (${formatter(list.length)} از ${formatter(all.length)})`
      : ` (${formatter(list.length)} هفته)`;

  const isContiguous =
    list.length > 2 && list[list.length - 1] - list[0] === list.length - 1;
  if (isContiguous) {
    return `هفته‌های ${formatter(list[0])} تا ${formatter(list[list.length - 1])}${suffix}`;
  }
  return `هفته‌های ${list.map((n) => formatter(n)).join("، ")}${suffix}`;
}
