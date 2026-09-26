// ============================================================
// hatchery.completion.age.utils.js
// هستهٔ مشترک «سن/تاریخ/عدد» پایان دوره — مشترک بین دو دامنهٔ زیر
// ------------------------------------------------------------
// موج ۳.۱ — شکستن mixin خوشهٔ پایان دوره (پیش‌تر: hatchery.completion.service.js،
// ۳۹ متد / ۲۳۰۵ خط) به سه دامنهٔ مستقل؛ متن متدها کلمه‌به‌کلمه و
// بدون هیچ تغییر متنی (حتی ویرگول‌ها) منتقل شده است.
// بدون این فایل، خوشهٔ پریود به‌صورت ضمنی به خوشهٔ گله وابسته می‌شد.
// ترکیب: Object.assign(HatcheryService.prototype, hatcheryCompletionAgeMethods) در hatchery.service.js
// حجم: 5 متد / 57 خط
// ============================================================
import {
  convertPersianToGregorian,
} from "../../../../core/utils/date.utils.js";

export const hatcheryCompletionAgeMethods = {
  _toNum(value) {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    )
      return null;
    let s = String(value).trim();
    const faDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arDigits = "٠١٢٣٤٥٦٧٨٩";
    for (let i = 0; i < 10; i++) {
      s = s
        .split(faDigits[i])
        .join(String(i))
        .split(arDigits[i])
        .join(String(i));
    }
    s = s.replace(/[٬,،\s]/g, "");
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  },

  _pcDateIso(rawFa) {
    const s = String(rawFa || "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const g = convertPersianToGregorian(s);
    if (!g) return null;
    return String(g).replace(/\//g, "-").slice(0, 10);
  },

  _pcFlockIso() {
    return (
      this._pcDateIso(document.getElementById("pc_flock_iso")?.value) || null
    );
  },

  _pcAgeOfIso(isoSlaughter, flockIsoArg) {
    const f = flockIsoArg || this._pcFlockIso();
    if (!f || !isoSlaughter) return null;
    const d1 = new Date(`${isoSlaughter}T00:00:00`);
    const d0 = new Date(`${f}T00:00:00`);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d0.getTime())) return null;
    const diff = Math.floor((d1 - d0) / 86400000) + 1;
    return diff > 0 ? diff : null;
  },

  _pcIsoFromAge(age, flockIsoArg) {
    const f = flockIsoArg || this._pcFlockIso();
    const n = Math.round(Number(age) || 0);
    if (!f || n < 1) return null;
    const d = new Date(`${f}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + n - 1);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },
};
