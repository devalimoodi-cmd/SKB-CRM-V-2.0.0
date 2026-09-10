// ================================================================
// sms.history.modal.js
// مودال «تاریخچه پیامک‌ها» — مشترک بین صفحهٔ کارشناس و صفحهٔ مشتری
// دقیقاً همان ظاهر/رفتار مودال صفحهٔ کارشناس (شامل دکمهٔ بروزرسانی وضعیت)
// ================================================================

import { apiService } from "../../core/services/api.service.js";
import { notificationService } from "../../core/services/notification.service.js";

let currentCtx = {
  customerId: null,
  flockId: null,
  flockPeriodId: null,
  onAfterRefresh: null,
};

const getSwal = () => (typeof Swal !== "undefined" ? Swal : null);

const formatDateTime = (dateStr) => {
  if (!dateStr) return "-";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(dateStr));
  } catch {
    return "-";
  }
};

const getDeliveryText = (deliveryState) => {
  const map = {
    0: "⏳ در صف ارسال",
    1: "✅ رسیده به گوشی",
    2: "❌ نرسیده به گوشی",
    3: "📡 پردازش در مخابرات",
    4: "❌ نرسیده به مخابرات",
    5: "📡 رسیده به مخابرات",
    6: "❌ خطا",
    7: "⛔ لیست سیاه",
    8: "❓ نامشخص",
  };
  return deliveryState === null ||
    deliveryState === undefined ||
    deliveryState === ""
    ? "-"
    : map[Number(deliveryState)] || "نامشخص";
};

const getSenderName = (sender) => {
  if (!sender) return "کاربر سیستم";
  return (
    `${sender.first_name || ""} ${sender.last_name || ""}`.trim() ||
    sender.username ||
    "کاربر سیستم"
  );
};

const getSmsStatusInfo = (status) => {
  const map = {
    pending: { text: "در انتظار", color: "#d97706", bg: "#fef3c7" },
    sent: { text: "ارسال شده", color: "#2563eb", bg: "#dbeafe" },
    delivered: { text: "تحویل داده شده", color: "#047857", bg: "#d1fae5" },
    failed: { text: "ناموفق", color: "#dc2626", bg: "#fee2e2" },
  };
  return map[status] || map.pending;
};

function showLoader(text = "در حال بارگذاری...") {
  const SwalRef = getSwal();
  if (!SwalRef) return false;
  try {
    SwalRef.fire({
      title: "⏳ لطفاً صبر کنید...",
      html: `
          <div style="display:flex; align-items:center; justify-content:center; gap:10px; direction:rtl; font-family:'Vazir', sans-serif; padding:8px 0;">
            <i class="fas fa-circle-notch fa-spin" style="font-size:22px; color:#2c7a6e;"></i>
            <span style="font-size:13px; color:#334155;">${text}</span>
          </div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    });
    return true;
  } catch (e) {
    console.warn("⚠️ خطا در نمایش لودینگ:", e);
    return false;
  }
}

function closeLoader() {
  const SwalRef = getSwal();
  if (!SwalRef) return;
  try {
    if (SwalRef.isVisible && SwalRef.isVisible()) SwalRef.close();
  } catch {
    // ignore
  }
}

async function fetchHistory({ customerId, flockId, flockPeriodId }) {
  const params = {};
  if (flockId) params.flock_id = flockId;
  if (flockPeriodId) params.flock_period_id = flockPeriodId;
  try {
    const res = await apiService.get(`/sms/log/${customerId}`, params);
    if (res && res.success) return res.data || [];
    return [];
  } catch {
    return [];
  }
}

async function refreshStatuses({ customerId, flockId, flockPeriodId }) {
  let url = `/sms/update-status/flock/${customerId}/${flockId ?? "null"}`;
  if (flockPeriodId) url += `?flock_period_id=${flockPeriodId}`;
  return await apiService.get(url);
}

function renderModal(records, notice = null) {
  const SwalRef = getSwal();
  if (!SwalRef) return;

  // بنر نتیجهٔ بروزرسانی (به‌جای Toast تا با مودال تداخل نکند)
  const noticePalette = {
    success: {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      color: "#047857",
      icon: "fa-circle-check",
    },
    info: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      color: "#1d4ed8",
      icon: "fa-circle-info",
    },
    error: {
      bg: "#fef2f2",
      border: "#fecaca",
      color: "#b91c1c",
      icon: "fa-triangle-exclamation",
    },
  };
  let noticeHTML = "";
  if (notice && notice.text) {
    const p = noticePalette[notice.type] || noticePalette.info;
    noticeHTML = `
              <div style="display:flex; align-items:center; gap:8px; direction:rtl; text-align:right; background:${p.bg}; border:1px solid ${p.border}; color:${p.color}; border-radius:10px; padding:8px 12px; margin-bottom:10px; font-family:'Vazir'; font-size:12.5px; font-weight:700;">
                <i class="fas ${p.icon}"></i>
                <span>${notice.text}</span>
              </div>`;
  }

  let rows = "";
  if (!records || records.length === 0) {
    rows =
      '<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">هیچ پیامکی ارسال نشده است</td></tr>';
  } else {
    rows = records
      .map(
        (r, i) => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${i + 1}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.message || "-"}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:140px;">
                <div><span style="display:inline-block; padding:1px 8px; border-radius:999px; font-size:9.5px; font-weight:700; background:${
                  r.scope === "hall" ? "#eff6ff" : "#ecfdf5"
                }; color:${
                  r.scope === "hall" ? "#1d4ed8" : "#047857"
                };">${r.scope === "hall" ? "سالن" : "کل گله"}</span></div>
                <div style="font-size:10.5px; font-weight:700; color:#334155; margin-top:2px;">${r.targetLabel || r.target_title || "—"}</div>
                <div style="font-size:10px; color:#64748b;">${r.roleLabel || "—"}</div>
                ${
                  r.flock_number
                    ? `<div style="font-size:9.5px; color:#94a3b8; margin-top:1px;">گله ${r.flock_number}${r.week_number ? ` | هفته ${r.week_number}` : ""}</div>`
                    : ""
                }
              </td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${formatDateTime(r.sent_at || r.created_at)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${formatDateTime(r.delivered_at)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${getDeliveryText(r.delivery_state)}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                <span style="display:inline-block; padding:2px 10px; border-radius:12px; font-size:10px; font-weight:500; background:${
                  r.status === "delivered"
                    ? "#dcfce7"
                    : r.status === "failed"
                      ? "#fee2e2"
                      : r.status === "sent"
                        ? "#dbeafe"
                        : "#fef3c7"
                }; color:${
                  r.status === "delivered"
                    ? "#16a34a"
                    : r.status === "failed"
                      ? "#dc2626"
                      : r.status === "sent"
                        ? "#2563eb"
                        : "#d97706"
                };">${getSmsStatusInfo(r.status || "pending").text}</span>
              </td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${getSenderName(r.sender)}</td>
            </tr>
          `,
      )
      .join("");
  }

  SwalRef.fire({
    icon: "info",
    title: "📱 تاریخچه پیامک‌ها",
    html: `
            <div style="direction:rtl; text-align:right; font-family:'Vazir'; overflow-x:auto;">
              ${noticeHTML}
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">ردیف</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">متن پیام</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">هدف / گیرنده</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">تاریخ و زمان ارسال</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">تاریخ و زمان تحویل</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت تحویل</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">فرستنده</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div style="display:flex; justify-content:center; margin-top:12px;">
              <button type="button" onclick="window.refreshSmsHistoryModal()"
                      style="display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border:none; border-radius:8px; background:#2c7a6e; color:#ffffff; font-family:'Vazir'; font-size:12px; font-weight:600; cursor:pointer; box-shadow:0 2px 8px rgba(44,122,110,0.25);">
                <i class="fas fa-sync-alt"></i> بروزرسانی وضعیت پیامک‌های قبلی
              </button>
            </div>
          `,
    confirmButtonText: "بستن",
    confirmButtonColor: "#2c7a6e",
    width: 1080,
  });
}

/**
 * باز کردن مودال تاریخچه پیامک‌ها
 * @param {Object} ctx
 * @param {number|string} ctx.customerId شناسه مشتری (الزامی)
 * @param {number|string} [ctx.flockId] فیلتر گله/سالن (اختیاری)
 * @param {number|string} [ctx.flockPeriodId] فیلتر کل گله (اختیاری)
 * @param {Function} [ctx.onAfterRefresh] callback بعد از بروزرسانی وضعیت‌ها
 */
export async function openSmsHistoryModal(ctx = {}) {
  currentCtx = {
    customerId: ctx.customerId,
    flockId: ctx.flockId ?? null,
    flockPeriodId: ctx.flockPeriodId ?? null,
    onAfterRefresh: ctx.onAfterRefresh || null,
  };

  // لودینگ + بروزرسانی خودکار وضعیت پیامک‌های همان دامنه قبل از نمایش جدول
  const loaderShown = showLoader(
    "در حال دریافت و بروزرسانی وضعیت پیامک‌ها...",
  );
  try {
    await refreshStatuses(currentCtx);
  } catch (e) {
    console.warn("⚠️ خطا در بروزرسانی خودکار وضعیت پیامک‌ها:", e);
  } finally {
    if (loaderShown) closeLoader();
  }

  const records = await fetchHistory(currentCtx);
  renderModal(records);
}

export async function refreshSmsHistoryModal() {
  const ctx = currentCtx || {};
  if (!ctx.customerId) {
    closeLoader();
    const SwalRef = getSwal();
    if (SwalRef && SwalRef.isVisible && SwalRef.isVisible()) {
      try {
        SwalRef.close();
      } catch {
        // ignore
      }
    }
    notificationService.warning("دامنه تاریخچه مشخص نیست");
    return;
  }

  // بستن مودال فعلی و نمایش لودر (تا کاربر بازخورد ببیند)
  closeLoader();

  let notice = null;
  const loaderShown = showLoader(
    "⏳ در حال بروزرسانی وضعیت پیامک‌های قبلی...",
  );
  try {
    const res = await refreshStatuses(ctx);
    const total = Number(res?.data?.total ?? 0) || 0;
    const updated = Number(res?.data?.updated ?? 0) || 0;

    if (total > 0 && updated > 0) {
      notice = {
        type: "success",
        text: `✅ ${updated.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")} پیامک بروزرسانی شد`,
      };
    } else if (total > 0) {
      notice = {
        type: "success",
        text: `✅ ${total.toLocaleString("fa-IR")} پیامک بررسی شد — وضعیت همه به‌روز است`,
      };
    } else {
      notice = {
        type: "info",
        text: "ℹ️ پیامکی برای بروزرسانی وضعیت نبود (وضعیت‌ها قبلاً نهایی هستند)",
      };
    }

    if (typeof ctx.onAfterRefresh === "function") {
      try {
        await ctx.onAfterRefresh();
      } catch (e) {
        console.warn("⚠️ خطا در onAfterRefresh:", e);
      }
    }
  } catch (e) {
    console.error("❌ خطا در بروزرسانی وضعیت پیامک‌های قبلی:", e);
    notice = { type: "error", text: "⚠️ خطا در بروزرسانی وضعیت پیامک‌ها" };
  } finally {
    if (loaderShown) closeLoader();
  }

  if (notice && notice.type !== "error") {
    try {
      const time = new Intl.DateTimeFormat("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
      notice.text += ` — ساعت ${time}`;
    } catch {
      // ignore
    }
  }

  const records = await fetchHistory(ctx);
  renderModal(records, notice);
}

if (typeof window !== "undefined") {
  window.openSmsHistoryModal = openSmsHistoryModal;
  window.refreshSmsHistoryModal = refreshSmsHistoryModal;
  if (typeof window.refreshSmsHistoryFromModal !== "function") {
    window.refreshSmsHistoryFromModal = () => refreshSmsHistoryModal();
  }
  if (typeof window.showSmsHistory !== "function") {
    window.showSmsHistory = (customerId, flockId = null, flockPeriodId = null) =>
      openSmsHistoryModal({ customerId, flockId, flockPeriodId });
  }
}
