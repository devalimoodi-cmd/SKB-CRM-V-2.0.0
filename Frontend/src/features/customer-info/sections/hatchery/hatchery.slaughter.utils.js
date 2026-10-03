// ============================================================
// hatchery.slaughter.utils.js
// توابع خالص (pure) نمایش «اطلاعات کشتار» بخش جوجه‌کشی
// ------------------------------------------------------------
// چرا این فایل؟
//   همین توابع قبلاً در دو فایل تکرار شده بودند:
//     • hatchery.service.js  (نمای گله/سالن)
//     • hatchery.report.js   (گزارش گله)
//   از این پس منبع یکتای این منطق همین فایل است تا خروجی هر دو
//   بخش یکسان بماند و مستقل از مرورگر تست‌پذیر باشد.
// ============================================================
import { convertToPersianDate } from "../../../../core/utils/date.utils.js";

// نمایش تاریخ کشتار به‌صورت بازه‌ای (شروع/پایان)؛ رکوردهای قدیمی تک‌تاریخی هم پشتیبانی می‌شوند
export const formatSlaughterRange = (completion) => {
  if (!completion) return "-";
  const start = completion.slaughter_date || null;
  const end = completion.slaughter_end_date || null;
  if (!start && !end) return "-";
  if (!end || end === start) {
    return convertToPersianDate(start || end);
  }
  return `${convertToPersianDate(start)} تا ${convertToPersianDate(end)}`;
};

// برچسب روش ثبت سن کشتار
export const slaughterAgeMethodLabel = (completion) => {
  const m = completion?.slaughter_age_method;
  if (m === "range") return "روش بازهٔ تاریخی";
  if (m === "direct") return "روش ورود مستقیم سن";
  if (m === "weighted") return "روش ارسال چندمرحله‌ای";
  return completion?.slaughter_age_end_days ? "بازهٔ سن (قدیمی)" : "";
};

// جدول جزئیات ارسال‌های چندمرحله‌ای (روش weighted)
export const slaughterShipmentsHtml = (completion, opts = {}) => {
  const rows = Array.isArray(completion?.slaughter_shipments)
    ? completion.slaughter_shipments
    : [];
  if (!rows.length) return "";
  const listRows = rows
    .map(
      (r) => `<tr>
        <td style="padding:4px 8px;border:1px solid var(--border-color, #e2e8f0);">${r.age_days ?? "-"}</td>
        <td style="padding:4px 8px;border:1px solid var(--border-color, #e2e8f0);">${r.quantity != null ? Number(r.quantity).toLocaleString("fa-IR") : "-"}</td>
        <td style="padding:4px 8px;border:1px solid var(--border-color, #e2e8f0);">${r.date ? convertToPersianDate(r.date) : "-"}</td>
      </tr>`,
    )
    .join("");
  return `<div style="margin-top:8px;">
    <div style="font-size:11.5px;font-weight:700;color:var(--text-slate-strong, #334155);margin-bottom:4px;">جزئیات ارسال‌ها به کشتارگاه:</div>
    <table style="border-collapse:collapse;width:100%;font-size:11.5px;">
      <thead><tr>
        <th style="padding:4px 8px;border:1px solid var(--border-strong, #cbd5e1);background:var(--gray-100, #f1f5f9);">سن (روز)</th>
        <th style="padding:4px 8px;border:1px solid var(--border-strong, #cbd5e1);background:var(--gray-100, #f1f5f9);">تعداد (قطعه)</th>
        <th style="padding:4px 8px;border:1px solid var(--border-strong, #cbd5e1);background:var(--gray-100, #f1f5f9);">تاریخ</th>
      </tr></thead>
      <tbody>${listRows}</tbody>
    </table>
  </div>`;
};

// نمایش سن کشتار — برای رکوردهای دارای «روش» فقط سن نهایی؛ رکوردهای قدیمی بازهٔ قبلی
export const formatAgeRange = (completion) => {
  if (!completion) return "-";
  const start = completion.slaughter_age_days;
  const method = completion.slaughter_age_method;
  const hasStart = start !== null && start !== undefined;
  const faNum = hasStart
    ? Number(start).toLocaleString("fa-IR", { maximumFractionDigits: 0 })
    : "";
  if (method === "range") return hasStart ? `${faNum} روز` : "-";
  if (method === "direct") return hasStart ? `${faNum} روز` : "-";
  if (method === "weighted") {
    return hasStart ? `${faNum} روز (میانگین وزنی)` : "-";
  }
  // رکورد قدیمی بدون method
  const end = completion.slaughter_age_end_days;
  const hasEnd = end !== null && end !== undefined;
  if (!hasStart && !hasEnd) return "-";
  if (!hasEnd || Number(end) === Number(start)) {
    return `${hasStart ? start : end} روز`;
  }
  return `${start}-${end} روز`;
};
