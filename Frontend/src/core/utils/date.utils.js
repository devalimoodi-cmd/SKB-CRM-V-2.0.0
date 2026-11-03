export function toEnglishDigits(str) {
  if (!str) return str;
  const persianNumbers = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  const arabicNumbers = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const englishNumbers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

  let result = str;
  persianNumbers.forEach((p, i) => {
    result = result.replace(new RegExp(p, "g"), englishNumbers[i]);
  });
  arabicNumbers.forEach((a, i) => {
    result = result.replace(new RegExp(a, "g"), englishNumbers[i]);
  });
  return result;
}

// ============================================================
// تبدیل تاریخ شمسی (جلالی) ↔ میلادی
// ------------------------------------------------------------
// ⚠️ فاز ۱۲.۴.۲: fallback تقریبیِ قبلی (`year - 621`) حذف شد.
//    آن فرمول تا ۱ روز خطا داشت و چون در admin-panel.html کتابخانهٔ
//    persian-date لود نمی‌شد، بازهٔ تاریخ فیلترها بی‌سرصدا غلط می‌شد.
//    اکنون الگوریتم دقیق جلالی (بدون وابستگی) اینجا هست تا در مرورگر و
//    Node یکسان و تست‌پذیر باشد.
// ============================================================
const JALALI_BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192,
  2262, 2324, 2394, 2456, 3178,
];

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

// محاسبهٔ سال کبیسه/روز شروع سال جلالی در تقویم میلادی
const jalaliCalendar = (jYear) => {
  const breaks = JALALI_BREAKS;
  const gYear = jYear + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;

  if (jYear < jp || jYear >= breaks[breaks.length - 1]) {
    return null; // خارج از بازهٔ پشتیبانی‌شده
  }

  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jYear < jm) break;
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jYear - jp;
  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gYear, 4) - div((div(gYear, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gYear, march };
};

// شمارهٔ روز جولیَن از تاریخ میلادی (مبنا: ۲۴ نوامبر ۴۷۱۴ قبل از میلاد)
const gregorianToDayNumber = (gYear, gMonth, gDay) => {
  let day =
    div((gYear + div(gMonth - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gMonth + 9, 12) + 2, 5) +
    gDay -
    34840408;
  day -= div(div(gYear + 100100 + div(gMonth - 8, 6), 100) * 3, 4) - 752;
  return day;
};

const dayNumberToGregorian = (dayNumber) => {
  let j = 4 * dayNumber + 139361631;
  j += div(div(4 * dayNumber + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gDay = div(mod(i, 153), 5) + 1;
  const gMonth = mod(div(i, 153), 12) + 1;
  const gYear = div(j, 1461) - 100100 + div(8 - gMonth, 6);
  return { gYear, gMonth, gDay };
};

const jalaliToDayNumber = (jYear, jMonth, jDay) => {
  const calendar = jalaliCalendar(jYear);
  if (!calendar) return null;
  return (
    gregorianToDayNumber(calendar.gYear, 3, calendar.march) +
    (jMonth - 1) * 31 -
    div(jMonth, 7) * (jMonth - 7) +
    jDay -
    1
  );
};

// آیا سال شمسی کبیسه است؟ (اسفند ۳۰ روز)
export function isLeapJalaliYear(jYear) {
  const calendar = jalaliCalendar(Number(jYear));
  return Boolean(calendar) && calendar.leap === 0;
}

// تعداد روزهای ماه شمسی (۱..۱۲)
export function jalaliMonthLength(jYear, jMonth) {
  const month = Number(jMonth);
  if (!Number.isInteger(month) || month < 1 || month > 12) return 0;
  if (month <= 6) return 31;
  if (month <= 11) return 30;
  return isLeapJalaliYear(jYear) ? 30 : 29;
}

// ۱۴۰۴/۰۸/۱۲ ⇒ "2025-11-03" (بدون وابستگی و بدون خطای منطقهٔ زمانی)
export function jalaliToGregorian(jYear, jMonth, jDay) {
  const year = Number(jYear);
  const month = Number(jMonth);
  const day = Number(jDay);
  if (![year, month, day].every((value) => Number.isInteger(value))) {
    return null;
  }
  if (day < 1 || day > jalaliMonthLength(year, month)) return null;

  const dayNumber = jalaliToDayNumber(year, month, day);
  if (dayNumber === null) return null;

  const { gYear, gMonth, gDay } = dayNumberToGregorian(dayNumber);
  return { year: gYear, month: gMonth, day: gDay };
}

export function convertPersianToGregorian(dateString) {
  if (!dateString) return null;

  // ورودی استاندارد تاریخ شمسی با «/» است («۱۴۰۴/۰۸/۱۲» / «1404/8/12»).
  // ⚠️ خط تیره/نقطه عمداً جداکننده نیست: ورودی ISO میلادی («2025-11-03») نباید
  //    به‌اشتباه شمسی تفسیر شود — قرارداد قبلی هم همین بود (خط‌تیره‌دار ⇒ null).
  const englishDate = toEnglishDigits(String(dateString)).replace(/[^0-9/]/g, "");
  const parts = englishDate.split("/");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  // ⭐ اعتبارسنجی پیش از تبدیل: تاریخ ناموجود (مثل ۱۴۰۴/۱۲/۳۰) باید null بدهد
  //    نه اینکه بی‌سرصدا به روز بعد بغلتد.
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > jalaliMonthLength(year, month)) return null;

  const exact = jalaliToGregorian(year, month, day);
  if (exact) {
    return `${exact.year}-${String(exact.month).padStart(2, "0")}-${String(exact.day).padStart(2, "0")}`;
  }

  try {
    // اگر الگوریتم بالا بیرون از بازه بود و کتابخانه در صفحه موجود است
    if (typeof persianDate !== "undefined") {
      const pd = new persianDate([year, month, day]);
      const result = pd.toDate();
      if (result && !isNaN(result.getTime())) {
        const y = result.getFullYear();
        const m = String(result.getMonth() + 1).padStart(2, "0");
        const d = String(result.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
  } catch (e) {
    console.error("خطا در تبدیل تاریخ:", e);
  }

  return null;
}


export function convertGregorianToPersian(gregorianDate) {
  if (!gregorianDate) return "";

  try {
    let date =
      typeof gregorianDate === "string"
        ? new Date(gregorianDate)
        : gregorianDate;
    if (isNaN(date.getTime())) return "";

    // استفاده از persianDate اگر موجود باشد
    if (typeof persianDate !== "undefined") {
      const pd = new persianDate(date);
      return pd.format("YYYY/MM/DD");
    }

    // Fallback: استفاده از Intl
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch (e) {
    console.error("خطا در تبدیل تاریخ:", e);
    return "";
  }
}

export function convertToPersianDate(dateStr) {
  return convertGregorianToPersian(dateStr);
}

export function formatDate(date, format = "YYYY/MM/DD") {
  if (!date) return "-";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "-";
  }
}

export function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  );
}

export function calculateAge(birthDate) {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// formatNumber - فرمت‌بندی اعداد به فارسی
// ============================================
export function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return "-";
  }
  return Number(value).toLocaleString("fa-IR");
}
