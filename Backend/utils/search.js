// ============================================================
// utils/search.js
// ابزار جستجوی «امن + فارسی‌پسند» برای اندپوینت‌های لیست
// ------------------------------------------------------------
// چرا لازم است؟
//  • کاربر ایرانی «ی/ک» را با حروف عربی (ي/ك) تایپ می‌کند،
//    ارقام را فارسی می‌نویسد و «نیم‌فاصله» را گاهی فاصله می‌زند.
//  • ورودی کاربر نباید به wildcard تبدیل شود (`%` و `_`).
//  • ستون‌های «نام» باید بدون حساسیت به فاصله/نیم‌فاصله هم پیدا شوند.
// ============================================================
const { Op, fn, col, where: sqlWhere, cast } = require("sequelize");

const MAX_TERM_LENGTH = 100;
const ZWNJ = "\u200c"; // نیم‌فاصله

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const ARABIC_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

// ============================================
// ۱) یکسان‌سازی متن جستجو
// ============================================
const normalizeSearchText = (value) => {
  let text = String(value ?? "");

  // ارقام فارسی/عربی → لاتین
  PERSIAN_DIGITS.forEach((digit, index) => {
    text = text.split(digit).join(String(index));
  });
  ARABIC_DIGITS.forEach((digit, index) => {
    text = text.split(digit).join(String(index));
  });

  // حروف عربی → فارسی
  text = text.replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/ة/g, "ه");

  // نویسه‌های جهت‌دهی (RLM/LRM) حذف شوند
  text = text.replace(/[\u200e\u200f\u202a-\u202e]/g, "");

  // فاصله‌های تکراری → یکی
  text = text.replace(/\s+/g, " ").trim();

  return text.slice(0, MAX_TERM_LENGTH);
};

// نسخهٔ «بدون فاصله و بدون نیم‌فاصله» (برای مقایسهٔ نام‌ها)
const stripSpaces = (value) =>
  String(value ?? "")
    .split(" ")
    .join("")
    .split(ZWNJ)
    .join("");

// ============================================
// ۲) امن‌سازی الگوی LIKE
// ============================================
const escapeLike = (value) =>
  String(value ?? "").replace(/[\\%_]/g, (char) => `\\${char}`);

// ============================================
// ۳) ستون‌های قابل جستجو در فهرست مشتریان
//    (کلیدهای عددی همان مقادیر select جستجو در فرانت هستند
//     و باید با ترتیب ستون‌های جدول customer-list هم‌راستا بمانند)
// ============================================
const CUSTOMER_SEARCH_COLUMNS = {
  // ✅ ستون ۰ در جدول «شمارهٔ مشتری» است (قبلاً id داخلی بود)
  "0": { field: "customer_code", type: "id" },
  "1": { field: "collection_name", type: "name" },
  "2": { field: "full_name", type: "name" },
  "3": { field: "farm_name", type: "name" },
  "4": { field: "mobile_number", type: "phone" },
  "5": { field: "messaging_number", type: "phone" },
  "6": { field: "education_level", type: "text" },
  "7": { field: "gender", type: "text" },
  "8": { field: "province", type: "text" },
  "9": { field: "county", type: "text" },
  "10": { field: "created_at", type: "date" },
  "11": { field: "active", type: "boolean" },
};

// ستون‌هایی که در حالت «همه ستون‌ها» جستجو می‌شوند
const CUSTOMER_SEARCH_ALL_FIELDS = [
  "customer_code",
  "collection_name",
  "full_name",
  "farm_name",
  "mobile_number",
  "messaging_number",
  "education_level",
  "gender",
  "province",
  "county",
];

// ============================================
// ۴) تاریخ شمسی → میلادی (بدون هیچ وابستگی)
//    الگوریتم استاندارد JalaliJSCalendar
//    توجه: این تبدیل فقط برای «بازهٔ جستجوی تاریخ» استفاده می‌شود؛
//    بنابراین اختلاف حداکثر یک‌روزه در مرز سال‌های کبیسه مشکلی ایجاد نمی‌کند.
// ============================================
const jalaliToGregorian = (jy, jm, jd) => {
  const year = Number(jy) + 1595;
  let days =
    -355668 +
    365 * year +
    ~~(year / 33) * 8 +
    ~~(((year % 33) + 3) / 4) +
    Number(jd) +
    (Number(jm) < 7 ? (Number(jm) - 1) * 31 : (Number(jm) - 7) * 30 + 186);

  let gy = 400 * ~~(days / 146097);
  days %= 146097;

  if (days > 36524) {
    gy += 100 * ~~(--days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }

  gy += 4 * ~~(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += ~~((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [
    0,
    31,
    isLeap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  let gm = 0;
  for (gm = 0; gm < 13 && gd > monthDays[gm]; gm += 1) {
    gd -= monthDays[gm];
  }

  return { gy, gm, gd };
};

const pad2 = (value) => String(value).padStart(2, "0");

// «۱۴۰۵/۰۲/۱۱» یا «1405-2-11» → { start, end } میلادی همان روز
const parseJalaliDayRange = (value) => {
  const text = normalizeSearchText(value).replace(/-/g, "/");
  const parts = text.split("/").filter(Boolean);
  if (parts.length !== 3) return null;

  const [jy, jm, jd] = parts.map((part) => parseInt(part, 10));
  if ([jy, jm, jd].some((num) => !Number.isFinite(num))) return null;
  if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > 31) {
    return null;
  }

  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  const start = new Date(`${gy}-${pad2(gm)}-${pad2(gd)}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
};

// «2026-03-21» (میلادی) → همان ساختار بازه
// ⚠️ سال‌های ۱۳۰۰ تا ۱۵۰۰ سال **شمسی** هستند و نباید اینجا به‌عنوان
//    تاریخ میلادی تفسیر شوند (وگرنه جستجو بینتیجه می‌شود).
const parseIsoDayRange = (value) => {
  const text = normalizeSearchText(value).replace(/\//g, "-");
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  if (year < 1700 || year > 2999) return null;

  const start = new Date(
    `${match[1]}-${pad2(match[2])}-${pad2(match[3])}T00:00:00.000Z`,
  );
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
};

// ============================================
// ۵) ساخت شرط جستجو برای یک ستون
// ============================================
const nameCondition = (field, term) => {
  const conditions = [{ [Op.iLike]: `%${escapeLike(term)}%` }];

  // نسخهٔ بدون فاصله/نیم‌فاصله (مثل «می‌رود» ↔ «می رود»)
  const compact = stripSpaces(term);
  if (compact && compact !== term) {
    conditions.push(
      sqlWhere(
        fn(
          "replace",
          fn("replace", col(field), " ", ""),
          ZWNJ,
          "",
        ),
        { [Op.iLike]: `%${escapeLike(compact)}%` },
      ),
    );
  }

  return conditions;
};

const digitsOnly = (value) => normalizeSearchText(value).replace(/\D/g, "");

const phoneCondition = (field, term) => {
  const conditions = [{ [Op.iLike]: `%${escapeLike(term)}%` }];

  const digits = digitsOnly(term);
  if (digits && digits !== term) {
    conditions.push(
      sqlWhere(fn("replace", fn("replace", col(field), " ", ""), "-", ""), {
        [Op.iLike]: `%${escapeLike(digits)}%`,
      }),
    );
  }

  return conditions;
};

const idCondition = (field = "id") => (term) => {
  const digits = digitsOnly(term);
  if (!digits) return null;
  return sqlWhere(cast(col(field), "TEXT"), { [Op.iLike]: `%${digits}%` });
};

const booleanCondition = (term) => {
  const text = term.toLowerCase();
  const truthy = ["فعال", "بله", "true", "1", "yes", "active"];
  const falsy = ["غیرفعال", "خیر", "false", "0", "no", "inactive"];

  if (truthy.includes(text)) return { active: true };
  if (falsy.includes(text)) return { active: false };
  return null;
};

const dateCondition = (term) => {
  const range = parseIsoDayRange(term) || parseJalaliDayRange(term);
  if (!range) return null;
  return { created_at: { [Op.gte]: range.start, [Op.lt]: range.end } };
};

// ============================================
// ۶) شرط نهایی جستجوی مشتریان
//    خروجی: آبجکت where سِکولایز یا null (بدون فیلتر)
// ============================================
const buildCustomerSearchWhere = (searchValue, searchColumnValue) => {
  const term = normalizeSearchText(searchValue);
  if (!term) return null;

  const key = String(searchColumnValue ?? "all").trim();
  const column = CUSTOMER_SEARCH_COLUMNS[key];

  // ===== جستجو در یک ستون مشخص =====
  if (column) {
    if (column.type === "id") {
      const condition = idCondition(column.field)(term);
      return condition ? { [Op.and]: [condition] } : null;
    }
    if (column.type === "boolean") return booleanCondition(term);
    if (column.type === "date") return dateCondition(term);

    const conditions =
      column.type === "name"
        ? nameCondition(column.field, term)
        : column.type === "phone"
          ? phoneCondition(column.field, term)
          : [{ [Op.iLike]: `%${escapeLike(term)}%` }];

    return conditions.length === 1
      ? { [column.field]: conditions[0] }
      : { [Op.or]: conditions.map((cond) => ({ [column.field]: cond })) };
  }

  // ===== حالت «همه ستون‌ها» =====
  const or = [];

  CUSTOMER_SEARCH_ALL_FIELDS.forEach((field) => {
    const meta = Object.values(CUSTOMER_SEARCH_COLUMNS).find(
      (item) => item.field === field,
    );
    const type = meta?.type || "text";

    if (type === "name") {
      nameCondition(field, term).forEach((cond) => or.push({ [field]: cond }));
      return;
    }
    if (type === "phone") {
      phoneCondition(field, term).forEach((cond) => or.push({ [field]: cond }));
      return;
    }
    if (type === "id") {
      const condition = idCondition(field)(term);
      if (condition) or.push(condition);
      return;
    }
    or.push({ [field]: { [Op.iLike]: `%${escapeLike(term)}%` } });
  });

  return or.length ? { [Op.or]: or } : null;
};

module.exports = {
  MAX_TERM_LENGTH,
  normalizeSearchText,
  stripSpaces,
  escapeLike,
  jalaliToGregorian,
  parseJalaliDayRange,
  parseIsoDayRange,
  CUSTOMER_SEARCH_COLUMNS,
  buildCustomerSearchWhere,
};
