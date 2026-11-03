"use strict";

// ============================================================
// services/activityCustomerResolver.js
// «مشتریِ مرتبط» — استنتاج دسته‌ای در زمان flush (موج ۱۲.۵)
// ------------------------------------------------------------
// ⭐ مسئله:
//   برخی روت‌ها customer_id را در بدنه دارند (ساخت سالن/گله/هفته‌نامه/
//   بوکمارک) ⇒ میدل‌ور همان را برمی‌دارد. اما زیرمنابع سالن
//   (hall-physical-info / hall-systems / hall-water-feed / hall-hygiene)
//   فقط hall_id را می‌فرستند و رکوردِ تازه‌ساخته‌شده هم در URL شناسهٔ
//   مشتری ندارد ⇒ ردیف با customer_id تهی می‌ماند و در تب «همهٔ تغییرات
//   این مشتری» دیده نمی‌شود.
// ------------------------------------------------------------
// ⛔ قاعدهٔ طلایی (همان قاعدهٔ ۱۲.۲): هیچ کوئری‌ای در مسیر پاسخ.
//   این استنتاج *داخل flush* اجرا می‌شود (خارج از مسیر درخواست،
//   یک کوئری به‌ازای هر جدولِ حاضر در دسته — نه به‌ازای هر ردیف).
// ⚠️ هر خطا فقط «پرش» است: نوشتن لاگ هرگز نباید شکست بخورد.
// ⚠️ نام جدول/ستون‌ها از همین فایل (ثابت) می‌آید، نه از ورودی کاربر.
// ============================================================

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const rules = require("./activityRules");

// سقف شناسه در هر کوئری (محافظ اندازهٔ IN)
const MAX_IDS_PER_QUERY = 100;

// بازهٔ سکوت پس از خطای یک جدول (میلی‌ثانیه)
const FAILURE_BACKOFF_MS = 10 * 60 * 1000;

// جدول‌هایی که «مستقیماً» customer_id دارند ⇄ جدول‌هایی که باید از
// سالن (hall_id → halls.customer_id) به مشتری رسید.
//   direct: true  ⇒ t.customer_id
//   direct: false ⇒ t.hall_id → halls.customer_id
const CUSTOMER_SOURCES = {
  halls: { table: "halls", direct: true },
  flocks: { table: "flocks", direct: true },
  weekly: { table: "weekly_management", direct: true },
  "visit-reports": { table: "visit_reports", direct: true },
  "chick-placements": { table: "chick_placements", direct: true },
  "flock-completions": { table: "flock_completions", direct: true },
  bookmarks: { table: "bookmarks", direct: true },
  "hall-hygiene": { table: "hall_hygiene", direct: true },
  "hall-physical-info": { table: "hall_physical_info", direct: false },
  "hall-systems": { table: "hall_systems", direct: false },
  "hall-water-feed": { table: "hall_water_feed", direct: false },
};

// جدول‌های خاموش‌شده تا زمان مشخص (تا خطای جدول/ستون تکرار نشود)
const disabledUntil = new Map();

const isEnabled = () =>
  rules.readBool(process.env.ACTIVITY_RESOLVE_CUSTOMER, true) === true;

const isPaused = (now = Date.now()) =>
  Array.from(disabledUntil.values()).some((until) => until > now);

const isSourceAvailable = (entity, now = Date.now()) => {
  const until = disabledUntil.get(entity);
  return !(until && until > now);
};

const disableSource = (entity) => {
  disabledUntil.set(entity, Date.now() + FAILURE_BACKOFF_MS);
};

// شناسه‌های موجودیتِ عددیِ فاقد customer_id، گروه‌بندی‌شده بر اساس entity
const collectIds = (rows = []) => {
  const buckets = new Map();

  rows.forEach((row) => {
    if (!row || row.customer_id) return;
    const source = CUSTOMER_SOURCES[row.entity];
    if (!source) return;

    const rawId = String(row.entity_id ?? "").trim();
    if (!/^\d+$/.test(rawId)) return;

    if (!buckets.has(row.entity)) buckets.set(row.entity, new Set());
    buckets.get(row.entity).add(rawId);
  });

  return buckets;
};

// کوئری استنتاج (نام‌ها ثابت و درون همین فایل‌اند ⇒ تزریق ممکن نیست)
const buildSql = (source) => {
  const table = `"${source.table}"`;
  if (source.direct) {
    return (
      `SELECT t.id::text AS ref_id, t.customer_id AS customer_id ` +
      `FROM ${table} t WHERE t.id::text IN (:ids)`
    );
  }
  return (
    `SELECT t.id::text AS ref_id, h.customer_id AS customer_id ` +
    `FROM ${table} t INNER JOIN "halls" h ON h.id = t.hall_id ` +
    `WHERE t.id::text IN (:ids)`
  );
};

// نشستن نتیجهٔ کوئری روی ردیف‌های همان موجودیت
const applyResults = (rows, entity, results) => {
  if (!Array.isArray(results) || results.length === 0) return 0;

  const lookup = new Map();
  results.forEach((result) => {
    const customerId = rules.normalizeCustomerId(result?.customer_id);
    if (!customerId) return;
    lookup.set(String(result.ref_id), customerId);
  });
  if (lookup.size === 0) return 0;

  let filled = 0;
  rows.forEach((row) => {
    if (!row || row.customer_id || row.entity !== entity) return;
    const found = lookup.get(String(row.entity_id ?? "").trim());
    if (!found) return;
    row.customer_id = found; // ⚠️ جهشِ عمدی: همان آبجکتِ بافر
    filled += 1;
  });

  return filled;
};

const resolveEntity = async (rows, entity, ids) => {
  const source = CUSTOMER_SOURCES[entity];
  const values = Array.from(ids).slice(0, MAX_IDS_PER_QUERY);
  if (!source || values.length === 0) return 0;

  try {
    const results = await sequelize.query(buildSql(source), {
      replacements: { ids: values },
      type: QueryTypes.SELECT,
    });
    return applyResults(rows, entity, results);
  } catch (error) {
    // جدول/ستون نیست یا دیتابیس در دسترس نیست ⇒ این منبع را موقتاً خاموش کن
    disableSource(entity);
    console.warn(
      `⚠️ [activity] استنتاج مشتری برای «${entity}» ناموفق بود` +
        ` (${FAILURE_BACKOFF_MS / 60000} دقیقه خاموش):`,
      error?.message || error,
    );
    return 0;
  }
};
/**
 * تکمیل customer_id ردیف‌های آمادهٔ نوشتن (در flush صدا زده می‌شود).
 * @param {Array<object>} rows ردیف‌های بافر (جهش درجا)
 * @returns {Promise<number>} تعداد ردیف‌های تکمیل‌شده
 */
const resolveCustomerIds = async (rows = []) => {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) return 0;
  if (!isEnabled()) return 0;

  const now = Date.now();
  const buckets = collectIds(list);
  if (buckets.size === 0) return 0;

  let filled = 0;
  const jobs = [];

  buckets.forEach((ids, entity) => {
    if (!isSourceAvailable(entity, now)) return;
    jobs.push(
      resolveEntity(list, entity, ids).then((count) => {
        filled += count;
      }),
    );
  });

  if (jobs.length === 0) return 0;
  await Promise.all(jobs);
  return filled;
};

// وضعیت (برای /api/activity و تست‌ها)
const status = (now = Date.now()) => ({
  enabled: isEnabled(),
  paused: isPaused(now),
  sources: Object.keys(CUSTOMER_SOURCES).length,
  disabled: Array.from(disabledUntil.entries())
    .filter(([, until]) => until > now)
    .map(([entity]) => entity),
});

// فقط برای تست
const resetForTests = () => {
  disabledUntil.clear();
};

module.exports = {
  CUSTOMER_SOURCES,
  buildSql,
  collectIds,
  resolveCustomerIds,
  status,
  isEnabled,
  isPaused,
  resetForTests,
};

