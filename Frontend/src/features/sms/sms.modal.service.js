// ================================================================
// sms.modal.service.js - مودال مشترک ارسال پیامک
// (همان قالب‌ها و ظاهر داشبورد + انتخاب گیرنده)
// ================================================================

import { SMS_TEMPLATES } from "./sms.templates.js";

const applyTemplateVars = (template, vars = {}) => {
  let msg = template;
  msg = msg.replace(/#FULLNAME#/g, vars.fullName || "");
  msg = msg.replace(/#WEEKNUMBER#/g, vars.weekNumber || "جاری");
  msg = msg.replace(/#FLOCKNUMBER#/g, vars.flockNumber || "");
  return msg;
};

// recipients: [{ role, name, mobile, note }]
// خروجی: { message, recipient } یا null
export function openSmsModal({
  title = "📱 ارسال پیامک",
  recipients = [],
  flockNumber = null,
  weekNumber = null,
  subtitle = "",
} = {}) {
  return new Promise((resolve) => {
    const available = recipients.filter((r) => r && r.mobile);
    if (available.length === 0) {
      resolve(null);
      return;
    }

    const recipientOptions = available
      .map(
        (r, i) =>
          `<option value="${i}">${r.role || "گیرنده"} — ${r.name || ""}${r.note ? ` (${r.note})` : ""}</option>`,
      )
      .join("");

    const templateOptions = Object.entries(SMS_TEMPLATES)
      .map(
        ([key, tpl]) =>
          `<option value="${key}">${tpl.name} - ${tpl.description}</option>`,
      )
      .join("");

    const firstRecipient = available[0];
    const defaultTemplate = SMS_TEMPLATES.weekly_reminder;
    const defaultMessage = applyTemplateVars(defaultTemplate.template, {
      fullName: firstRecipient?.name || "",
      weekNumber,
      flockNumber,
    });

    if (typeof Swal !== "undefined") {
      Swal.fire({
        title,
        html: `
          <div style="text-align: right; font-family: 'Vazir', sans-serif; padding: 5px;">
            ${
              subtitle
                ? `<div style="background:#f0fdfa; border:1px solid #99f6e4; color:#0f766e; padding:8px 12px; border-radius:8px; font-size:12px; margin-bottom:12px;">${subtitle}</div>`
                : ""
            }
            ${
              available.length > 1
                ? `<div style="margin-bottom: 12px;">
                    <label style="display:block; margin-bottom:6px; font-weight:700; font-size:13px; color:#1e293b;">👥 ارسال به</label>
                    <select id="smsRecipientSelect" style="width:100%; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-family:'Vazir'; font-size:13px; background:#fff; cursor:pointer;">${recipientOptions}</select>
                  </div>`
                : ""
            }
            <div style="margin-bottom: 12px;">
              <label style="display:block; margin-bottom:6px; font-weight:700; font-size:13px; color:#1e293b;">📋 انتخاب قالب پیامک</label>
              <select id="smsTemplateSelect" style="width:100%; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-family:'Vazir'; font-size:13px; background:#fff; cursor:pointer;">
                <option value="custom">✏️ متن آزاد</option>
                ${templateOptions}
              </select>
            </div>
            <div style="margin-bottom: 8px;">
              <label style="display:block; margin-bottom:6px; font-weight:700; font-size:13px; color:#1e293b;">💬 متن پیامک</label>
              <textarea id="smsMessage" rows="7" style="width:100%; padding:12px; border:1.5px solid #e2e8f0; border-radius:8px; font-family:'Vazir'; font-size:13px; resize:vertical; direction:rtl; line-height:1.8; outline:none; background:#f8fafc;">${defaultMessage}</textarea>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:12px; color:#94a3b8; padding:0 2px;">
              <span>تعداد کاراکتر: <strong id="smsCharCount" style="color:#2c7a6e;">${defaultMessage.length}</strong></span>
              <span>حداکثر 500 کاراکتر</span>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "✅ ارسال پیامک",
        cancelButtonText: "❌ انصراف",
        confirmButtonColor: "#2c7a6e",
        cancelButtonColor: "#64748b",
        width: 650,
        didOpen: () => {
          const textarea = document.getElementById("smsMessage");
          const charCount = document.getElementById("smsCharCount");
          const templateSelect = document.getElementById("smsTemplateSelect");
          const recipientSelect = document.getElementById("smsRecipientSelect");

          const getVars = () => {
            const idx = recipientSelect
              ? parseInt(recipientSelect.value, 10) || 0
              : 0;
            const rec = available[idx] || available[0];
            return { fullName: rec?.name || "", weekNumber, flockNumber };
          };

          if (textarea && charCount) {
            charCount.textContent = textarea.value.length;
            textarea.addEventListener("input", () => {
              charCount.textContent = textarea.value.length;
              charCount.style.color =
                textarea.value.length > 500 ? "#dc2626" : "#2c7a6e";
            });
          }
          if (templateSelect) {
            templateSelect.addEventListener("change", (e) => {
              const selected = e.target.value;
              if (selected === "custom") {
                textarea.value = "متن پیامک خود را اینجا وارد کنید...";
              } else {
                const tpl = SMS_TEMPLATES[selected];
                if (tpl) textarea.value = applyTemplateVars(tpl.template, getVars());
              }
              if (charCount) charCount.textContent = textarea.value.length;
            });
          }
          if (recipientSelect) {
            recipientSelect.addEventListener("change", () => {
              // با تغییر گیرنده، نام قالب‌های دارای نام را به‌روز کن
              const cur = templateSelect?.value;
              if (cur && cur !== "custom" && SMS_TEMPLATES[cur]) {
                textarea.value = applyTemplateVars(
                  SMS_TEMPLATES[cur].template,
                  getVars(),
                );
                if (charCount) charCount.textContent = textarea.value.length;
              }
            });
          }
        },
        preConfirm: () => {
          const textarea = document.getElementById("smsMessage");
          const recipientSelect = document.getElementById("smsRecipientSelect");
          const idx = recipientSelect
            ? parseInt(recipientSelect.value, 10) || 0
            : 0;
          const recipient = available[idx] || available[0];
          const message = textarea?.value?.trim();
          if (!message) {
            Swal.showValidationMessage("لطفاً متن پیامک را وارد کنید");
            return false;
          }
          if (message.length > 500) {
            Swal.showValidationMessage("متن پیامک نباید بیشتر از 500 کاراکتر باشد");
            return false;
          }
          return { message, recipient };
        },
      }).then((result) => {
        if (result.isConfirmed && result.value) {
          resolve(result.value);
        } else {
          resolve(null);
        }
      });
    } else {
      const recipient = available[0];
      const message = prompt(`متن پیامک برای ${recipient?.name || "گیرنده"}:`, defaultMessage);
      resolve(message ? { message, recipient } : null);
    }
  });
}
