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

export function convertPersianToGregorian(dateString) {
  if (!dateString) return null;
  const englishDate = toEnglishDigits(dateString);
  const cleanedDate = englishDate.replace(/[^0-9/]/g, "");
  const parts = cleanedDate.split("/");
  if (parts.length !== 3) return null;

  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const day = parseInt(parts[2]);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  try {
    // استفاده از persianDate اگر موجود باشد
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

    // Fallback: محاسبه تقریبی
    const date = new Date(year - 621, month - 1, day);
    if (!isNaN(date.getTime())) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
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
