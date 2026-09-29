// ============================================================
// dashboard.sms.js
// پیامک داشبورد — زنجیرهٔ گیرنده، مودال وضعیت، چیپ‌ها و تاریخچه
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲a) — این دامنه از dashboard.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت ۲۷ برگشت‌پذیری بایت‌به‌بایت را اثبات می‌کند).
// ترکیب: Object.assign(DashboardService.prototype, dashboardSmsMethods) در dashboard.service.js
// موج ۳.۲m — برش بدنهٔ `refreshSmsStatus` (۲۳۹ → ۸۸ خط): کلوژرهای تاریخ/تحویل/فرستنده +
// ردیف‌های مودال و شمارنده‌ها + قالب `html` به دو کمکی ماژول‌محلی رفتند
// (`buildSmsStatusRowsHtml` · `buildSmsStatusModalHtml`)؛ `Swal.fire` و `return`های
// زودهنگام در متد ماندند. گارد: `npm run test:dashboard:sms-status:body` (۱۱۰ بررسی).
// حجم: 10 متد + 2 کمکی ماژول‌محلی / 990 خط
// ============================================================
import { dashboardApi } from "./dashboard.api.js";
import { apiService } from "../../core/services/api.service.js";
import { notificationService } from "../../core/services/notification.service.js";

export const dashboardSmsMethods = {
  // ===== پیامک گله/سالن از کارت گله (زنجیره گیرنده) =====

  async sendFlockCardSms(flockId, hallId = null) {
    const card = (this.flockCards || []).find(
      (c) => parseInt(c.flock?.id) === parseInt(flockId),
    );
    if (!card) {
      notificationService.warning("گله در کارت‌ها یافت نشد");
      return;
    }
    const flock = card.flock;
    try {
      let unit = null;
      if (flock.unitId) {
        const res = await apiService
          .get(`/units/${flock.unitId}`)
          .catch(() => null);
        if (res?.success) unit = res.data || null;
      }
      const recipients = [];
      const experts =
        unit && Array.isArray(unit.experts) ? unit.experts : [];
      const primaryExpert =
        experts.find((e) => e.expert_phone) || experts[0] || null;
      if (primaryExpert?.expert_phone) {
        recipients.push({
          role: "کارشناس فارم",
          name: primaryExpert.expert_name || "کارشناس",
          mobile: primaryExpert.expert_phone,
        });
      }
      if (unit?.manager_phone) {
        recipients.push({
          role: "مدیر فارم",
          name: unit.manager_name || "مدیر",
          mobile: unit.manager_phone,
        });
      }
      if (card.customer?.phone) {
        recipients.push({
          role: "مرغدار",
          name: card.customer.name || "مرغدار",
          mobile: card.customer.phone,
        });
      }
      if (recipients.length === 0) {
        notificationService.error(
          "هیچ شماره موبایلی برای گیرنده ثبت نشده است",
        );
        return;
      }

      const { openSmsModal } = await import(
        "../sms/sms.modal.service.js"
      );
      const cleanHallName = (name) =>
        String(name || "").trim().replace(/^سالن\s*/i, "");
      let hallName = null;
      let weekNumber = flock?.weekNumber || null;
      if (hallId) {
        const hallRow = (flock.halls || []).find(
          (x) => parseInt(x.id) === parseInt(hallId),
        );
        hallName = hallRow?.hallName ? cleanHallName(hallRow.hallName) : null;
        if (hallRow?.weekNumber != null) weekNumber = hallRow.weekNumber;
      }

      const result = await openSmsModal({
        title: hallId
          ? `پیامک سالن — گله ${flock.flockNumber}`
          : `پیامک گله ${flock.flockNumber}`,
        recipients,
        flockNumber: flock.flockNumber,
        weekNumber,
        hallName,
        scope: hallId ? "hall" : "flock",
        subtitle: hallId
          ? `پیام برای گله ${flock.flockNumber}${hallName ? ` — سالن ${hallName}` : ""} ساخته می‌شود`
          : `پیام برای گله ${flock.flockNumber} (کل گله) ساخته می‌شود`,
      });
      if (!result) return;

      const items =
        Array.isArray(result.messages) && result.messages.length
          ? result.messages
          : [{ recipient: result.recipient, message: result.message }];
      let okCount = 0;
      let failCount = 0;
      for (const item of items) {
        try {
          const resp = await apiService.post("/sms/send-recipient", {
            mobile: item.recipient?.mobile,
            message: item.message,
            customerId: card.customer?.id || null,
            flockPeriodId: flock.id,
            hallId: hallId || null,
            scope: hallId ? "hall" : "flock",
            flockNumber: flock.flockNumber,
            hallName: hallName || null,
            weekNumber: weekNumber || null,
            recipientRole: item.recipient?.role || null,
            recipientName: item.recipient?.name || null,
          });
          if (resp && resp.success) okCount++;
          else failCount++;
        } catch (e) {
          failCount++;
        }
      }
      if (okCount > 0) {
        notificationService.success(
          failCount === 0
            ? `پیامک به ${okCount} گیرنده ارسال شد`
            : `پیامک به ${okCount} گیرنده ارسال شد (${failCount} ناموفق)`,
        );
      } else {
        notificationService.error(
          failCount > 0 ? "ارسال پیامک ناموفق بود" : "گیرنده‌ای برای ارسال انتخاب نشد",
        );
      }
      // به‌روزرسانی فوری نشان «امروز» بعد از ارسال
      await this.refreshFlockCardsSilently();
    } catch (error) {
      console.error("❌ Error sending flock card sms:", error);
      notificationService.error(error.message || "خطا در ارسال پیامک");
    }
  },

  // ===== SMS =====

  async sendSmsToCustomer(
    customerId,
    customerName,
    flockId,
    weekNumber,
    flockNumber,
    cardElement,
  ) {
    // نمایش مودال انتخاب قالب (با پاس دادن شماره گله و هفته)
    const message = await this.showSmsModal(
      customerName,
      flockNumber,
      weekNumber,
    );
    if (!message) return;

    // دریافت اطلاعات مشتری
    try {
      const customer = await dashboardApi.getCustomer(customerId);
      if (!customer.success || !customer.data.mobile_number) {
        notificationService.error("مشتری شماره موبایل ندارد");
        return;
      }

      const finalMessage = message
        .replace(/#FULLNAME#/g, customer.data.full_name || customerName)
        .replace(/#WEEKNUMBER#/g, weekNumber || "جاری")
        .replace(/#FLOCKNUMBER#/g, flockNumber || "");

      // به‌روزرسانی وضعیت در کارت
      const card =
        cardElement ||
        document.querySelector(
          `.task-card[data-customer-id="${customerId}"][data-flock-id="${flockId}"]`,
        );
      if (card) {
        const smsStatus = card.querySelector(".sms-status");
        if (smsStatus) {
          smsStatus.textContent = "⏳ در حال ارسال...";
          smsStatus.style.background = "#fef3c7";
          smsStatus.style.color = "#f59e0b";
        }
      }

      // ارسال پیامک با فلوك و هفته
      const response = await dashboardApi.sendSms(customerId, finalMessage, {
        flockId,
        weekNumber,
      });
      if (response.success) {
        notificationService.success(
          `✅ پیامک به ${customerName} با موفقیت ارسال شد`,
        );

        // ✅ آپدیت تسک با اطلاعات آخرین پیامک (لاگ دریافتی از سرور)
        const smsLog = response.data?.log || null;
        this.updateTaskSmsStatus(
          card,
          smsLog,
          response.data?.messageId || null,
        );
      } else {
        notificationService.error(response.message || "خطا در ارسال پیامک");
      }
    } catch (error) {
      console.error("❌ Error sending SMS:", error);
      notificationService.error(
        error?.message && !error.message.includes("Failed to fetch")
          ? error.message
          : "خطا در ارتباط با سرور",
      );
    }
  },

  showSmsModal(customerName, flockNumber = null, weekNumber = null) {
    const service = this;
    return new Promise((resolve) => {
      const templateOptions = Object.entries(this.smsTemplates)
        .map(
          ([key, tpl]) =>
            `<option value="${key}">${tpl.name} - ${tpl.description}</option>`,
        )
        .join("");

      // تابع کمکی جایگزینی متغیرها با مقادیر واقعی
      const applyTemplateVars = (template) => {
        let msg = template.replace(/#FULLNAME#/g, customerName || "");
        msg = msg.replace(/#WEEKNUMBER#/g, weekNumber || "جاری");
        msg = msg.replace(/#FLOCKNUMBER#/g, flockNumber || "");
        return msg;
      };

      const defaultTemplate = this.smsTemplates["weekly_reminder"];
      const defaultMessage = applyTemplateVars(defaultTemplate.template);

      if (typeof Swal !== "undefined") {
        // استایل‌دهی زیباتر و منظم‌تر مودال
        Swal.fire({
          title: `📱 ارسال پیامک`,
          html: `
            <div style="text-align: right; font-family: 'Vazir', sans-serif; padding: 5px;">
              <!-- اطلاعات گیرنده -->
              <div style="display:flex; align-items:center; gap:10px; background: linear-gradient(135deg, #2c7a6e 0%, #065f46 100%); color:#fff; padding:12px 16px; border-radius:10px; margin-bottom:14px;">
                <span style="font-size:22px;">👤</span>
                <div>
                  <div style="font-size:14px; font-weight:700;">${customerName || "مشتری"}</div>
                  <div style="font-size:11px; opacity:0.85;">
                    ${flockNumber ? `گله ${flockNumber}` : ""}${flockNumber && weekNumber ? " | " : ""}${weekNumber ? `هفته ${weekNumber}` : ""}
                  </div>
                </div>
              </div>

              <!-- انتخاب قالب -->
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 700; font-size: 13px; color:#1e293b;">
                  📋 انتخاب قالب پیامک
                </label>
                <select id="smsTemplateSelect" style="width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px; background:#fff; cursor:pointer; outline:none; transition: border-color 0.2s;">
                  <option value="custom">✏️ متن آزاد</option>
                  ${templateOptions}
                </select>
              </div>

              <!-- متن پیامک -->
              <div style="margin-bottom: 8px;">
                <label style="display: block; margin-bottom: 6px; font-weight: 700; font-size: 13px; color:#1e293b;">
                  💬 متن پیامک
                </label>
                <textarea id="smsMessage" rows="7" 
                  style="width: 100%; padding: 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px; resize: vertical; direction: rtl; line-height:1.8; outline:none; background:#f8fafc;"
                >${defaultMessage}</textarea>
              </div>

              <!-- شمارنده کاراکتر -->
              <div style="display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; padding: 0 2px;">
                <span>تعداد کاراکتر: <strong id="smsCharCount" style="color:#2c7a6e;">${defaultMessage.length}</strong></span>
                <span>حداکثر 1000 کاراکتر</span>
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

            if (textarea && charCount) {
              charCount.textContent = textarea.value.length;
              textarea.addEventListener("input", () => {
                charCount.textContent = textarea.value.length;
                if (textarea.value.length > 1000) {
                  charCount.style.color = "#dc2626";
                } else {
                  charCount.style.color = "#2c7a6e";
                }
              });
            }

            if (templateSelect) {
              // ✅ رفع باگ: استفاده از arrow function تا this به سرویس اشاره کند
              templateSelect.addEventListener("change", (e) => {
                const selected = e.target.value;
                if (selected === "custom") {
                  textarea.value = "متن پیامک خود را اینجا وارد کنید...";
                } else {
                  const template = service.smsTemplates[selected];
                  if (template) {
                    textarea.value = applyTemplateVars(template.template);
                  }
                }
                if (charCount) charCount.textContent = textarea.value.length;
              });
            }
          },
          preConfirm: () => {
            const textarea = document.getElementById("smsMessage");
            const message = textarea?.value?.trim();
            if (!message) {
              Swal.showValidationMessage("لطفاً متن پیامک را وارد کنید");
              return false;
            }
            if (message.length > 1000) {
              Swal.showValidationMessage(
                "متن پیامک نباید بیشتر از 1000 کاراکتر باشد",
              );
              return false;
            }
            return message;
          },
        }).then((result) => {
          if (result.isConfirmed && result.value) {
            resolve(result.value);
          } else {
            resolve(null);
          }
        });
      } else {
        // ✅ بدون دیالوگ بومی: اگر SweetAlert2 در صفحه لود نشده باشد، پیام خطا نشان بده
        notificationService.showError(
          "امکان گرفتن متن پیامک نیست (SweetAlert2 لود نشده است)",
        );
        resolve(null);
      }
    });
  },

  // ===== ساخت چیپ وضعیت پیامک (برای رندر اولیه و آپدیت) =====

  buildSmsStatusContent(smsLog) {
    if (!smsLog) return "";

    const status = smsLog.status || "sent";
    const smsInfo = this.getSmsStatusInfo(status);

    const sender =
      smsLog.sender?.first_name && smsLog.sender?.last_name
        ? `${smsLog.sender.first_name} ${smsLog.sender.last_name}`
        : smsLog.sender?.username || "کاربر سیستم";

    // فرمت تاریخ و ساعت ارسال
    let sentTimeText = "-";
    try {
      sentTimeText = new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(smsLog.sent_at || new Date()));
    } catch (e) {}

    // فرمت تاریخ تحویل
    let deliveredText = "-";
    if (smsLog.delivered_at) {
      try {
        deliveredText = new Intl.DateTimeFormat("fa-IR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(smsLog.delivered_at));
      } catch (e) {}
    }

    const msgIdText = smsLog.message_id ? ` | ID: ${smsLog.message_id}` : "";

    return `
      <span>${smsInfo.text}</span>
      ${sentTimeText !== "-" ? `<span style="font-size:9px; opacity:0.8;">📅 ${sentTimeText}${msgIdText}</span>` : ""}
      ${deliveredText !== "-" ? `<span style="font-size:9px; opacity:0.8;">📬 تحویل: ${deliveredText}</span>` : ""}
      <span style="font-size:9px; opacity:0.8;">👤 ${sender}</span>
    `;
  },

  buildSmsStatusHTML(smsLog) {
    if (!smsLog) return "";

    const status = smsLog.status || "sent";
    const smsInfo = this.getSmsStatusInfo(status);
    const sender =
      smsLog.sender?.first_name && smsLog.sender?.last_name
        ? `${smsLog.sender.first_name} ${smsLog.sender.last_name}`
        : smsLog.sender?.username || "کاربر سیستم";

    return `
      <span class="sms-status" data-message-id="${smsLog.message_id || ""}" data-sender-name="${sender}"
            style="display:inline-flex; flex-direction:column; gap:2px; background:${smsInfo.bg}; color:${smsInfo.color}; padding:2px 10px; border-radius:12px; font-size:10px; font-weight:500; line-height:1.5;">
        ${this.buildSmsStatusContent(smsLog)}
      </span>
    `;
  },

  // ===== آپدیت وضعیت پیامک در تسک =====

  updateTaskSmsStatus(card, smsLog, messageId) {
    if (!card) return;

    // پیدا کردن یا ساخت عنصر وضعیت پیامک
    let smsStatusEl = card.querySelector(".sms-status");
    if (!smsStatusEl) {
      smsStatusEl = document.createElement("span");
      smsStatusEl.className = "sms-status";
      card.querySelector(".customer-info")?.appendChild(smsStatusEl);
    }

    // استخراج اطلاعات از لاگ
    const log = smsLog || {};
    const status = log.status || "sent";
    const smsInfo = this.getSmsStatusInfo(status);

    // ساخت نام فرستنده
    const sender =
      log.sender?.first_name && log.sender?.last_name
        ? `${log.sender.first_name} ${log.sender.last_name}`
        : log.sender?.username || "کاربر سیستم";

    // آپدیت HTML وضعیت پیامک روی تسک
    smsStatusEl.style.background = smsInfo.bg;
    smsStatusEl.style.color = smsInfo.color;
    smsStatusEl.style.padding = "2px 10px";
    smsStatusEl.style.borderRadius = "12px";
    smsStatusEl.style.fontSize = "10px";
    smsStatusEl.style.fontWeight = "500";
    smsStatusEl.style.display = "inline-flex";
    smsStatusEl.style.flexDirection = "column";
    smsStatusEl.style.gap = "2px";

    // ذخیره messageId و نام فرستنده برای رفرش خودکار
    if (messageId) {
      smsStatusEl.dataset.messageId = String(messageId);
    }
    smsStatusEl.dataset.senderName = sender;

    smsStatusEl.innerHTML = this.buildSmsStatusContent(log);
  },

  // ===== بروزرسانی خودکار وضعیت پیامک‌ها روی تسک‌ها =====

  async refreshAllTaskSmsStatus() {
    // برای هر کارت تسک، وضعیت پیامک را بررسی کن
    const cards = document.querySelectorAll(
      ".task-card .sms-status[data-message-id]",
    );
    if (cards.length === 0) return;

    // ساخت لیستی از پیامک‌هایی که هنوز delivery_state ندارند یا در انتظار هستند
    const pendingChecks = [];
    cards.forEach((statusEl) => {
      const msgId = statusEl.dataset.messageId;
      const isPending =
        !statusEl.dataset.deliveryState ||
        statusEl.dataset.deliveryState === "0";
      if (msgId && isPending) {
        pendingChecks.push({ statusEl, msgId });
      }
    });

    if (pendingChecks.length === 0) return;

    // بررسی وضعیت هر پیامک
    await Promise.all(
      pendingChecks.map(async ({ statusEl, msgId }) => {
        try {
          const statusRes = await dashboardApi.checkSmsStatus(msgId);
          if (statusRes.success && statusRes.data?.deliveryState) {
            const state = statusRes.data.deliveryState;
            const isDelivered = state === 1;
            const isFailed = state === 6;
            const statusText = isDelivered
              ? "delivered"
              : isFailed
                ? "failed"
                : "sent";
            const smsInfo = this.getSmsStatusInfo(statusText);

            // آپدیت استایل و متن
            statusEl.style.background = smsInfo.bg;
            statusEl.style.color = smsInfo.color;

            // ذخیره deliveryState برای جلوگیری از بررسی مجدد
            statusEl.dataset.deliveryState = String(state);

            // فرمت زمان تحویل
            let deliveredText = "";
            if (isDelivered) {
              try {
                const now = new Date();
                deliveredText = new Intl.DateTimeFormat("fa-IR", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(now);
              } catch (e) {}
            }

            // ساخت نام فرستنده — اولویت با نام ذخیره‌شده روی چیپ (از لاگ سرور)
            let senderName = statusEl.dataset.senderName || "";
            if (!senderName) {
              const currentUser = JSON.parse(
                localStorage.getItem("user") || "{}",
              );
              senderName =
                currentUser.fullName ||
                currentUser.full_name ||
                `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() ||
                currentUser.username ||
                "کاربر سیستم";
            }

            statusEl.innerHTML = `
              <span>${smsInfo.text}</span>
              ${isDelivered && deliveredText ? `<span style="font-size:9px; opacity:0.8;">تحویل: ${deliveredText}</span>` : ""}
              <span style="font-size:9px; opacity:0.8;">فرستنده: ${senderName}</span>
            `;
          }
        } catch (err) {
          console.warn("⚠️ خطا در بررسی وضعیت پیامک:", err);
        }
      }),
    );
  },

  // ===== توابع SMS History =====

  async showSmsHistory(customerId, flockId = null, flockPeriodId = null) {
    // ذخیره بافت مودال تاریخچه تا دکمه «بروزرسانی» همان دامنه را رفرش کند
    this.smsHistoryCtx = { customerId, flockId, flockPeriodId };

    // ⏳ لودینگ + بروزرسانی خودکار وضعیت پیامک‌های همان دامنه قبل از نمایش جدول
    const loaderShown = this.showSmsLoader(
      "در حال دریافت و بروزرسانی وضعیت پیامک‌ها...",
    );
    try {
      await this.refreshSmsStatus(customerId, flockId, flockPeriodId, false);
    } catch (e) {
      console.warn("⚠️ خطا در بروزرسانی خودکار وضعیت پیامک‌ها:", e);
    } finally {
      if (loaderShown) this.closeSmsLoader();
    }

    let records = [];
    try {
      const response = await dashboardApi
        .getSmsHistory(customerId, flockId, flockPeriodId)
        .catch(() => ({ success: false, data: [] }));
      records = response.success
        ? response.data?.messages || response.data || []
        : [];
    } catch (e) {
      records = [];
    }

    // بروزرسانی وضعیت پیامک‌ها در بالا (سمت سرور، همان دامنه) انجام شد؛
    // در این مرحله فقط تاریخچه‌ی ذخیره‌شده/به‌روزشده نمایش داده می‌شود.

    if (typeof Swal !== "undefined") {
      // تابع کمکی تبدیل زمان تاریخچه لاگ
      const formatDateTime = (dateStr) => {
        if (!dateStr) return "-";
        try {
          const date = new Date(dateStr);
          return new Intl.DateTimeFormat("fa-IR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }).format(date);
        } catch {
          return "-";
        }
      };

      // تابع کمکی وضعیت تحویل از بک‌اند
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

      // تابع کمکی نام فرستنده
      const getSenderName = (sender) => {
        if (!sender) return "کاربر سیستم";
        return (
          `${sender.first_name || ""} ${sender.last_name || ""}`.trim() ||
          sender.username ||
          "کاربر سیستم"
        );
      };

      let rows = "";
      if (records.length === 0) {
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
                };">${this.getSmsStatusInfo(r.status || "pending").text}</span>
              </td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${getSenderName(r.sender)}</td>
            </tr>
          `,
          )
          .join("");
      }

      Swal.fire({
        icon: "info",
        title: "📱 تاریخچه پیامک‌ها",
        html: `
            <div style="direction:rtl; text-align:right; font-family:'Vazir'; overflow-x:auto;">
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
              <button type="button" onclick="window.refreshSmsHistoryFromModal()"
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
  },

  // ===== رفرش از داخل مودال تاریخچه (بروزرسانی همه پیامک‌های قبلی همان دامنه) =====
  async refreshSmsHistoryFromModal() {
    const ctx = this.smsHistoryCtx || {};
    if (!ctx.customerId) {
      notificationService.warning("دامنه تاریخچه مشخص نیست");
      return;
    }
    try {
      if (typeof Swal !== "undefined") Swal.close();
      notificationService.info(
        "⏳ در حال بروزرسانی وضعیت پیامک‌های قبلی...",
      );
    } catch (err) {
      console.error("❌ خطا در بروزرسانی وضعیت پیامک‌های قبلی:", err);
    }
    // showSmsHistory خودش لودینگ + بروزرسانی سمت سرور + باز کردن مجدد را انجام می‌دهد
    await this.showSmsHistory(
      ctx.customerId,
      ctx.flockId ?? null,
      ctx.flockPeriodId ?? null,
    );
  },


  async refreshSmsStatus(customerId, flockId, flockPeriodId = null, openModal = true) {
    let loaderShown = false;
    try {
      // نمایش پیام در حال بررسی
      if (openModal) {
        notificationService.info("⏳ در حال بررسی و بروزرسانی وضعیت پیامک‌ها...");
        loaderShown = this.showSmsLoader(
          "در حال بررسی و بروزرسانی وضعیت پیامک‌ها...",
        );
      }

      // ۱. فراخوانی سرویس سرور برای چک وضعیت واقعی پیامک‌های ارسال‌نشده
      //    این سرویس برای هر پیامک بدون وضعیت تحویل، از سرویس‌دهنده پیامک استعلام می‌گیرد
      //    و وضعیت واقعی (تحویل/ناموفق/در انتظار) را در دیتابیس ذخیره می‌کند
      const updateRes = await dashboardApi
        .updateSmsStatusForFlock(customerId, flockId, flockPeriodId)
        .catch(() => null);

      // حالت بی‌صدا (فراخوانی از لودینگ مودال تاریخچه): فقط بروزرسانی سمت سرور
      if (!openModal) {
        await this.loadFlocks();
        await this.refreshAllTaskSmsStatus();
        return;
      }

      // ۲. دریافت تاریخچه به‌روزشده از دیتابیس (بعد از ذخیره وضعیت‌ها) — با همان دامنه/مقیاس
      let records = [];
      try {
        const response = await dashboardApi
          .getSmsHistory(customerId, flockId, flockPeriodId)
          .catch(() => ({ success: false, data: [] }));
        records = response.success
          ? response.data?.messages || response.data || []
          : [];
      } catch (e) {
        records = [];
      }

      const stats = updateRes?.data || {};
      const totalChecked = stats.total ?? records.length;
      const updatedCount = stats.updated ?? 0;

      // اگر پیامکی برای بررسی وجود ندارد، بدون خطا/مودال خالی تمام کن
      const hasAny =
        (Number(totalChecked) > 0 ||
          Number(updatedCount) > 0 ||
          records.length > 0);
      if (!hasAny) {
        await this.loadFlocks();
        await this.refreshAllTaskSmsStatus();
        if (loaderShown) this.closeSmsLoader();
        if (openModal) {
          notificationService.info("هیچ پیامکی برای بروزرسانی وضعیت وجود ندارد");
        }
        return;
      }

      // ۳. رفرش کارت‌ها و وضعیت‌ها
      await this.loadFlocks();
      await this.refreshAllTaskSmsStatus();

      if (loaderShown) this.closeSmsLoader();

      // ۴. نمایش مودال با وضعیت‌های جدید
      if (openModal && typeof Swal !== "undefined") {
        const rows = buildSmsStatusRowsHtml(records, { service: this });
        Swal.fire({
          icon: "info",
          title: "📱 بروزرسانی وضعیت پیامک‌ها",
          html: buildSmsStatusModalHtml({ records, rows, totalChecked, updatedCount }),
          confirmButtonText: "باشه",
          confirmButtonColor: "#2c7a6e",
          width: 1120,
        });
      }

      if (openModal) {
        notificationService.success(
          updateRes?.success
            ? `✅ وضعیت ${totalChecked} پیامک بررسی و در دیتابیس ذخیره شد`
            : "✅ وضعیت پیامک‌ها بروزرسانی شد",
        );
      }
    } catch (error) {
      if (loaderShown) this.closeSmsLoader();
      console.error("❌ Error refreshing SMS status:", error);
      notificationService.error("خطا در بروزرسانی");
    }
  },

};
// کمکی ماژول‌محلی (موج ۳.۲m) — ردیف‌های جدول مودال وضعیت پیامک.
// ⚠️ کد زیر بایت‌به‌بایت از بدنهٔ `refreshSmsStatus` منتقل شده است (سه closure درونش
// ادغام شده‌اند)؛ قالب چندخطی ردیف‌ها داخلش است و هرگونه dedent بایت‌ها را عوض می‌کند.
// `service` پاس داده می‌شود چون متد `getSmsStatusInfo` سرویس را صدا می‌زند.
const buildSmsStatusRowsHtml = (records, { service }) => {
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

        let rows = records
          .map(
            (r, i) => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${i + 1}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.message || ""}">${r.message || "-"}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:150px;">
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
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:120px;">
                <span style="display:inline-block; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:600; background:${
                  r.delivery_state === 1
                    ? "#ecfdf5"
                    : r.delivery_state === 6 || r.status === "failed"
                      ? "#fef2f2"
                      : "#fffbeb"
                }; color:${
                  r.delivery_state === 1
                    ? "#047857"
                    : r.delivery_state === 6 || r.status === "failed"
                      ? "#b91c1c"
                      : "#b45309"
                };">${getDeliveryText(r.delivery_state)}</span>
              </td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; min-width:100px;">${formatDateTime(r.delivered_at)}</td>
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
                };">${service.getSmsStatusInfo(r.status || "pending").text}</span>
              </td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; font-size:11px; color:#475569;">${getSenderName(r.sender)}</td>
            </tr>
          `,
          )
          .join("");

  return rows;
};

// کمکی ماژول‌محلی (موج ۳.۲m) — قالب html مودال وضعیت پیامک + شمارنده‌های خلاصه.
// ⚠️ متن زیر بایت‌به‌بایت از بدنهٔ `refreshSmsStatus` منتقل شده است؛ فاصله‌های داخل
// backtick بخشی از خروجی مودال‌اند و dedent ممنوع است.
const buildSmsStatusModalHtml = ({ records, rows, totalChecked, updatedCount }) => {
        const deliveredCount = records.filter(
          (r) => r.status === "delivered" || r.delivery_state === 1,
        ).length;
        const failedCount = records.filter(
          (r) => r.status === "failed" || r.delivery_state === 6,
        ).length;
        const pendingCount = records.filter(
          (r) => r.status === "pending" || !r.status || !r.delivery_state,
        ).length;

  return `
            <div style="direction:rtl; text-align:right; font-family:'Vazir';">
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:8px; text-align:center;">
                  <div style="font-size:18px; font-weight:700; color:#16a34a;">${deliveredCount}</div>
                  <div style="font-size:10px; color:#94a3b8;">✅ تحویل شده</div>
                </div>
                <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:8px; text-align:center;">
                  <div style="font-size:18px; font-weight:700; color:#dc2626;">${failedCount}</div>
                  <div style="font-size:10px; color:#94a3b8;">❌ ناموفق</div>
                </div>
                <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:8px; text-align:center;">
                  <div style="font-size:18px; font-weight:700; color:#d97706;">${pendingCount}</div>
                  <div style="font-size:10px; color:#94a3b8;">⏳ در انتظار</div>
                </div>
              </div>
              <div style="overflow-x:auto; max-height:300px; overflow-y:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                  <thead>
                    <tr style="background:#f8fafc; position:sticky; top:0;">
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">ردیف</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">متن پیام</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">گیرنده</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">تاریخ و زمان ارسال</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت تحویل</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">تاریخ و زمان تحویل</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">فرستنده</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
              <p style="font-size:11px; color:#94a3b8; margin-top:10px; text-align:center;">
                ${totalChecked} پیامک بررسی شد ${updatedCount > 0 ? ` | ${updatedCount} پیامک به‌روزرسانی شد` : ""}
              </p>
            </div>
          `;
};

