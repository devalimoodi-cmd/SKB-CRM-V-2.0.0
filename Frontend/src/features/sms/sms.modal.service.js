import { SMS_TEMPLATES } from "./sms.templates.js";

const applyTemplateVars = (template, vars = {}) => {
  let msg = template;
  msg = msg.replace(/#FULLNAME#/g, vars.fullName || "");
  msg = msg.replace(/#WEEKNUMBER#/g, vars.weekNumber || "جاری");
  msg = msg.replace(/#FLOCKNUMBER#/g, vars.flockNumber || "");
  msg = msg.replace(/#ROLE#/g, vars.role || "");
  msg = msg.replace(/#HALLNAME#/g, vars.hallName || "");
  msg = msg.replace(/#SCOPE_LABEL#/g, vars.scopeLabel || "");
  msg = msg.replace(/#CONTEXT_LINE#/g, vars.contextLine || "");
  return msg;
};

const roleLabel = (r) => (r && r.role) || "گیرنده";

/**
 * مودال مشترک ارسال پیامک
 * context: { flockNumber, weekNumber, hallName, scope: 'flock'|'hall', subtitle }
 * خروجی: { message, recipient, recipients, messages:[{recipient, message}] } یا null
 */
export function openSmsModal({
  title = "ارسال پیامک",
  recipients = [],
  flockNumber = null,
  weekNumber = null,
  hallName = null,
  scope = "flock",
  subtitle = "",
} = {}) {
  return new Promise((resolve) => {
    const available = recipients.filter((r) => r && r.mobile);
    if (available.length === 0) {
      resolve(null);
      return;
    }

    // نرمال‌سازی نام سالن: اگر نام از قبل با «سالن» شروع شده باشد پیشوند تکراری ساخته نمی‌شود
    const bareHallName = String(hallName || "")
      .trim()
      .replace(/^سالن\s*/i, "");
    const scopeLabel =
      scope === "hall"
        ? bareHallName
          ? `سالن ${bareHallName}`
          : "سالن"
        : "کل گله";
    const contextRawLine = `گله ${flockNumber || ""}${
      scope === "hall" ? ` | ${scopeLabel}` : ""
    } | مخاطب: #ROLE#`;

    const templateOptions = Object.entries(SMS_TEMPLATES)
      .map(
        ([key, tpl]) =>
          `<option value="${key}">${tpl.name} - ${tpl.description}</option>`,
      )
      .join("");

    const recipientRows = available
      .map(
        (r, i) => `
          <label class="sms-recipient-row" style="display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px solid #e2e8f0; border-radius:8px; margin-bottom:6px; cursor:pointer; background:#fff;">
            <input type="checkbox" class="sms-recipient-check" value="${i}" ${
              i === 0 ? "checked" : ""
            } style="width:16px; height:16px; accent-color:#2c7a6e; flex-shrink:0;">
            <span style="flex:1; font-size:13px; color:#1e293b;">
              <b>${roleLabel(r)}</b>
              ${r.name ? ` <span style="color:#475569;">(${r.name})</span>` : ""}
              ${r.note ? ` <span style="color:#94a3b8; font-size:11px;">(${r.note})</span>` : ""}
              <span style="direction:ltr; display:block; text-align:left; color:#64748b; font-size:11px;">${r.mobile}</span>
            </span>
          </label>`,
      )
      .join("");

    const buildDefaultRaw = () => {
      const tpl = SMS_TEMPLATES.weekly_reminder;
      return `${contextRawLine}\n\n${tpl.template}`;
    };

    const getSelectedRecipients = () =>
      Array.from(document.querySelectorAll(".sms-recipient-check"))
        .filter((c) => c.checked)
        .map((c) => available[parseInt(c.value, 10)] || null)
        .filter(Boolean);
    const firstSelected = () => getSelectedRecipients()[0] || available[0];

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
            <div style="margin-bottom: 10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:8px 12px; font-size:12px; color:#334155;">
              <b>محدوده:</b> ${scopeLabel}
              ${
                flockNumber ? ` &nbsp;|&nbsp; <b>گله:</b> ${flockNumber}` : ""
              }
              ${
                weekNumber ? ` &nbsp;|&nbsp; <b>هفته:</b> ${weekNumber}` : ""
              }
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display:block; margin-bottom:6px; font-weight:700; font-size:13px; color:#1e293b;">گیرنده‌ها (هرکدام را می‌خواهید انتخاب کنید)</label>
              ${recipientRows}
            </div>
            <div style="margin-bottom: 12px;">
              <label style="display:block; margin-bottom:6px; font-weight:700; font-size:13px; color:#1e293b;">انتخاب قالب پیامک</label>
              <select id="smsTemplateSelect" style="width:100%; padding:10px 12px; border:1.5px solid #e2e8f0; border-radius:8px; font-family:'Vazir'; font-size:13px; background:#fff; cursor:pointer;">
                <option value="custom">متن آزاد</option>
                ${templateOptions}
              </select>
            </div>
            <div style="margin-bottom: 6px;">
              <label style="display:block; margin-bottom:6px; font-weight:700; font-size:13px; color:#1e293b;">متن پیامک</label>
              <textarea id="smsMessage" rows="8" style="width:100%; padding:12px; border:1.5px solid #e2e8f0; border-radius:8px; font-family:'Vazir'; font-size:13px; resize:vertical; box-sizing:border-box; background:#fff; color:#0f172a;">${buildDefaultRaw().replace(/"/g, "&quot;")}</textarea>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span style="font-size:10px; color:#94a3b8;">برای شخصی‌سازی خودکار نام/نقش هر گیرنده، توکن‌های <b>#FULLNAME#</b> و <b>#ROLE#</b> را در متن نگه دارید.</span>
                <span id="smsCharCount" style="font-size:11px; color:#2c7a6e; font-weight:700;">0</span>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "ارسال پیامک",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#2c7a6e",
        cancelButtonColor: "#64748b",
        width: 680,
        didOpen: () => {
          const textarea = document.getElementById("smsMessage");
          const charCount = document.getElementById("smsCharCount");
          const templateSelect = document.getElementById("smsTemplateSelect");
          let lastAuto = null;

          const updateCount = (t) => {
            if (charCount) {
              charCount.textContent = t.length;
              charCount.style.color =
                t.length > 1000 ? "#dc2626" : "#2c7a6e";
            }
          };

          const markAuto = (text) => {
            lastAuto = text;
          };

          const refreshAutoText = (rawTemplate) => {
            if (!rawTemplate) return;
            const raw = `${contextRawLine}\n\n${rawTemplate}`;
            textarea.value = raw;
            markAuto(raw);
            updateCount(raw);
          };

          if (textarea && charCount) updateCount(textarea.value);
          if (textarea) {
            textarea.addEventListener("input", () => {
              lastAuto = null;
              updateCount(textarea.value);
            });
          }
          if (templateSelect) {
            templateSelect.addEventListener("change", (e) => {
              const key = e.target.value;
              if (key === "custom") {
                textarea.value = "";
                markAuto("");
                lastAuto = null;
              } else {
                const tpl = SMS_TEMPLATES[key];
                if (tpl) refreshAutoText(tpl.template);
              }
              updateCount(textarea.value);
            });
          }
        },
        preConfirm: () => {
          const textarea = document.getElementById("smsMessage");
          const selected = getSelectedRecipients();
          if (selected.length === 0) {
            Swal.showValidationMessage("حداقل یک گیرنده را انتخاب کنید");
            return false;
          }
          const raw = textarea?.value?.trim();
          if (!raw) {
            Swal.showValidationMessage("لطفاً متن پیامک را وارد کنید");
            return false;
          }
          const buildMessage = (rec) =>
            applyTemplateVars(raw, {
              fullName: rec?.name || "",
              weekNumber,
              flockNumber,
              role: roleLabel(rec),
              hallName: bareHallName,
              scopeLabel,
            }).trim();
          const messages = selected.map((rec) => ({
            recipient: rec,
            message: buildMessage(rec),
          }));
          const tooLong = messages.find((m) => m.message.length > 1000);
          if (tooLong) {
            Swal.showValidationMessage(
              "متن نهایی برای یکی از گیرنده‌ها بیشتر از 1000 کاراکتر است",
            );
            return false;
          }
          const first = messages[0];
          return {
            message: first?.message || "",
            recipient: first?.recipient || null,
            recipients: selected,
            messages,
          };
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
      const message = prompt(
        `متن پیامک برای ${recipient?.name || "گیرنده"}:`,
        buildDefaultRaw(),
      );
      resolve(
        message
          ? {
              message,
              recipient,
              recipients: [recipient],
              messages: [{ recipient, message }],
            }
          : null,
      );
    }
  });
}