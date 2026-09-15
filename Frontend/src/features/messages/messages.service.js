// ============================================================
// features/messages/messages.service.js
// «نظرات و پیشنهادات» — سرویس سمت کاربر (هدر + صفحهٔ تماس با ما)
// ------------------------------------------------------------
//  • ارسال پیام/نظر جدید (فقط کاربر لاگین‌شده)
//  • فهرست گفتگوهای کاربر، مشاهده و پاسخ
//  • بج «پاکت پیام‌ها» در هدر + به‌روزرسانی خودکار (polling)
//  • علامت خوانده‌شدن (رسید خواندن دوطرفه)
// ============================================================
import { messagesApi } from "./messages.api.js";
import { authService } from "../../core/services/auth.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { escapeHtml } from "../../core/utils/string.utils.js";
import { loaderService } from "../../shared/components/Loader/loader.service.js";

export const SUBJECT_LABELS = {
  suggestion: "پیشنهاد",
  complaint: "انتقاد",
  bug: "اشکال فنی",
  question: "سؤال",
  other: "سایر",
};

export const STATUS_LABELS = {
  new: "جدید",
  in_progress: "در حال بررسی",
  answered: "پاسخ داده شده",
  closed: "بسته شده",
};

const POLL_INTERVAL_MS = 60 * 1000;

const formatDateTime = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
};

export const statusBadge = (status) =>
  `<span class="badge-status ${escapeHtml(status)}">${escapeHtml(
    STATUS_LABELS[status] || status,
  )}</span>`;

export const subjectLabel = (subject) =>
  SUBJECT_LABELS[subject] || subject || "";

class MessagesService {
  constructor() {
    this.initialized = false;
    this.pollTimer = null;
    this.unreadCount = 0;
    this.currentThreadId = null;
    this.mode = "thread";
  }

  // ===== بج پاکت هدر + بج کارت «نظرات» در پنل ادمین =====
  setBadge(count) {
    this.unreadCount = Number(count) || 0;
    ["emailCount", "suggestionsBadge", "suggestionsMenuBadge"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(this.unreadCount);
      el.style.display = this.unreadCount > 0 ? "" : "none";
    });
  }

  async loadUnreadCount() {
    if (!authService.getToken()) {
      this.setBadge(0);
      return 0;
    }
    try {
      const response = await messagesApi.getUnreadCount();
      if (response?.success) {
        this.setBadge(response.data?.count || 0);
      }
    } catch {
      /* سرور/شبکه در دسترس نیست → هدر نباید خطا بدهد */
    }
    return this.unreadCount;
  }

  startPolling() {
    if (this.pollTimer || !authService.getToken()) return;
    // ✅ گارد سراسری: اگر سرویس/ماژول دو نمونه شود، اینتروال تکراری ساخته نشود
    if (typeof window !== "undefined" && window.__skbMessagesPolling) return;
    if (typeof window !== "undefined") window.__skbMessagesPolling = true;
    this.loadUnreadCount();
    this.pollTimer = setInterval(() => this.loadUnreadCount(), POLL_INTERVAL_MS);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (typeof window !== "undefined") window.__skbMessagesPolling = false;
  }

  // ===== رندر فهرست گفتگوها =====
  renderThreadList(items, { emptyText = "هنوز پیامی ثبت نشده است", onDelete = false } = {}) {
    if (!items || items.length === 0) {
      return `<div class="msg-list-empty">${escapeHtml(emptyText)}</div>`;
    }

    return items
      .map((item) => {
        const unread = item.user_unread || item.admin_unread ? "unread" : "";
        const who = item.user
          ? `<span>${escapeHtml(item.user.full_name)}</span>`
          : "";
        return `
          <div class="msg-list-item ${unread}" data-suggestion-id="${item.id}">
            <div class="row-top">
              <span class="title">${escapeHtml(item.title || "بدون موضوع")}</span>
              ${statusBadge(item.status)}
            </div>
            <div class="snippet">
              ${escapeHtml(subjectLabel(item.subject))} • ${escapeHtml(
                formatDateTime(item.last_message_at || item.created_at),
              )}
              ${who}
            </div>
            ${
              onDelete
                ? `<button type="button" class="msg-del-btn row-del"
                           data-delete-suggestion-id="${item.id}"
                           title="حذف این گفتگو" aria-label="حذف این گفتگو">
                     <i class="fas fa-trash-can"></i>
                   </button>`
                : ""
            }
          </div>`;
      })
      .join("");
  }

  // ===== رندر حباب‌های گفتگو (viewer = user | admin) =====
  renderBubbles(messages, { viewer = "user", canDelete = false } = {}) {
    if (!messages || messages.length === 0) {
      return `<div class="msg-list-empty">پیامی وجود ندارد</div>`;
    }

    return messages
      .map((msg, index) => {
        const mine = msg.sender_type === viewer;
        const name =
          msg.sender_name || (msg.sender_type === "admin" ? "ادمین" : "کاربر");
        const readMark = msg.read_at
          ? `<span class="msg-read"><i class="fas fa-check-double"></i> ${escapeHtml(
              formatDateTime(msg.read_at),
            )}</span>`
          : "";
        // ✅ حذف پیام (فقط ادمین). پیام اول گفتگو از اینجا حذف نمی‌شود؛
        //    برای حذف پیام اول باید کل گفتگو حذف شود.
        const delBtn =
          canDelete && index > 0
            ? `<button type="button" class="msg-del-btn" data-message-id="${msg.id}"
                       title="حذف این پیام" aria-label="حذف این پیام">
                 <i class="fas fa-trash-can"></i>
               </button>`
            : "";
        return `
          <div class="msg-row ${mine ? "mine" : "other"}" data-message-id="${msg.id}">
            <div class="msg-bubble">${escapeHtml(msg.body)}</div>
            <div class="msg-meta">
              <span>${escapeHtml(mine ? "من" : name)}</span>
              <span>${escapeHtml(formatDateTime(msg.created_at))}</span>
              ${readMark}
              ${delBtn}
            </div>
          </div>`;
      })
      .join("");
  }

  // ===== کنترل مودال گفتگو (حالت thread / compose) =====
  openModal(mode = "thread") {
    const overlay = document.getElementById("messageThreadModal");
    if (!overlay) return;
    this.mode = mode;

    const composeWrap = document.getElementById("messageComposeWrap");
    const threadWrap = document.getElementById("messageThreadWrap");
    const footer = overlay.querySelector(".msg-modal-footer");
    const titleEl = document.getElementById("messageThreadTitle");

    if (mode === "compose") {
      if (titleEl) titleEl.textContent = "ارسال نظر / پیشنهاد جدید";
      if (composeWrap) composeWrap.style.display = "";
      if (threadWrap) threadWrap.style.display = "none";
      if (footer) footer.style.display = "none";
    } else {
      if (titleEl) titleEl.textContent = "گفتگوی من با ادمین";
      if (composeWrap) composeWrap.style.display = "none";
      if (threadWrap) threadWrap.style.display = "";
      if (footer) footer.style.display = "";
    }

    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  closeModal() {
    const overlay = document.getElementById("messageThreadModal");
    if (overlay) overlay.classList.remove("show");
    document.body.style.overflow = "";
    this.currentThreadId = null;
  }

  closeDropdown() {
    const dropdown = document.getElementById("emailDropdown");
    if (dropdown) dropdown.classList.remove("show");
    const btn = document.querySelector(".dropdown-email-btn");
    if (btn) btn.classList.remove("active");
  }

  // ===== مشاهدهٔ یک گفتگو + علامت خوانده‌شدن =====
  async openThread(id) {
    if (!id) return;

    // ✅ نمایش لودر سیستمی (پیرو انتخاب ادمین) تا رسیدن گفتگو
    const threadBody = document.getElementById("messageThreadBody");
    if (threadBody) {
      threadBody.innerHTML = await loaderService.inline({
        text: "در حال بارگذاری…",
        size: "sm",
      });
    }

    try {
      const response = await messagesApi.getThread(id);
      if (!response?.success) {
        notificationService.error(response?.message || "گفتگو دریافت نشد");
        return;
      }

      const { suggestion, messages } = response.data;
      this.currentThreadId = id;
      this.openModal("thread");

      const titleEl = document.getElementById("messageThreadTitle");
      if (titleEl) titleEl.textContent = suggestion?.title || "گفتگو";

      const metaEl = document.getElementById("messageThreadMeta");
      if (metaEl) {
        metaEl.innerHTML = `
          ${statusBadge(suggestion?.status)}
          <span>${escapeHtml(subjectLabel(suggestion?.subject))}</span>
          <span>آخرین پیام: ${escapeHtml(formatDateTime(suggestion?.last_message_at))}</span>`;
      }

      const bodyEl = document.getElementById("messageThreadBody");
      if (bodyEl) {
        bodyEl.innerHTML = this.renderBubbles(messages, { viewer: "user" });
        bodyEl.scrollTop = bodyEl.scrollHeight;
      }

      const input = document.getElementById("messageReplyInput");
      if (input) input.value = "";

      // ✅ رسید خواندن: بج خودم صفر می‌شود و ادمین می‌بیند که خوانده‌ام
      await messagesApi.markRead(id);
      await this.loadUnreadCount();
      await this.refreshContactList();
    } catch (error) {
      notificationService.error("خطا در دریافت گفتگو");
      console.error("❌ openThread:", error);
    }
  }

  // ===== خواندن فیلدهای فرم (هدر یا صفحهٔ تماس) =====
  readComposeFields(prefix) {
    const pick = (suffix) => document.getElementById(`${prefix}${suffix}`);
    return {
      subject: pick("Subject")?.value || "suggestion",
      title: (pick("Title")?.value || "").trim(),
      body: (pick("Body")?.value || "").trim(),
      errorEl: pick("Error"),
      successEl: pick("Success"),
      button: pick("Send"),
    };
  }

  // ===== ارسال پیام/نظر جدید =====
  async submitNew(prefix = "message", { closeOnSuccess = true } = {}) {
    const fields = this.readComposeFields(prefix);
    const showError = (msg) => {
      if (fields.errorEl) {
        fields.errorEl.textContent = msg;
        fields.errorEl.style.display = "";
      }
    };

    if (fields.errorEl) fields.errorEl.style.display = "none";
    if (fields.successEl) fields.successEl.style.display = "none";
    if (fields.title.length < 3) {
      return showError("موضوع پیام را وارد کنید (حداقل ۳ حرف)");
    }
    if (fields.body.length < 5) {
      return showError("متن پیام را وارد کنید (حداقل ۵ حرف)");
    }

    // ✅ گارد ضد ارسال همزمان (دابل‌کلیک یا شنوندهٔ تکراری) — پرچم روی خود دکمه
    if (fields.button) {
      if (fields.button.dataset.sending === "1") return;
      fields.button.dataset.sending = "1";
      fields.button.disabled = true;
    }
    try {
      const response = await messagesApi.create({
        subject: fields.subject,
        title: fields.title,
        body: fields.body,
        page_url: window.location.pathname,
      });

      if (!response?.success) {
        showError(response?.message || "ارسال پیام ناموفق بود");
        return;
      }

      if (fields.successEl) {
        fields.successEl.textContent =
          "پیام شما ثبت شد. پاسخ ادمین در «پیام‌ها» (پاکت هدر) نمایش داده می‌شود.";
        fields.successEl.style.display = "";
      }
      notificationService.success(response.message || "پیام شما ثبت شد");

      const pick = (suffix) => document.getElementById(`${prefix}${suffix}`);
      if (pick("Title")) pick("Title").value = "";
      if (pick("Body")) pick("Body").value = "";

      if (closeOnSuccess) this.closeModal();
      await this.refreshContactList();
      await this.loadUnreadCount();
    } catch (error) {
      showError("خطا در ارسال پیام");
      console.error("❌ submitNew:", error);
    } finally {
      if (fields.button) {
        fields.button.disabled = false;
        delete fields.button.dataset.sending;
      }
    }
  }

  // ===== پاسخ کاربر در گفتگو =====
  async sendReply() {
    const input = document.getElementById("messageReplyInput");
    const body = (input?.value || "").trim();
    if (body.length < 5) {
      notificationService.error("متن پاسخ را وارد کنید (حداقل ۵ حرف)");
      return;
    }

    const btn = document.getElementById("messageReplySend");
    if (btn) btn.disabled = true;
    try {
      const response = await messagesApi.reply(this.currentThreadId, body);
      if (!response?.success) {
        notificationService.error(response?.message || "ارسال پاسخ ناموفق بود");
        return;
      }
      if (input) input.value = "";
      notificationService.success("پیام شما ارسال شد");
      await this.openThread(this.currentThreadId);
    } catch (error) {
      notificationService.error("خطا در ارسال پاسخ");
      console.error("❌ sendReply:", error);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ===== دراپ‌داون «پیام‌ها» در هدر =====
  async refreshDropdown() {
    const dropdown = document.getElementById("emailDropdown");
    if (!dropdown) return;
    const container = dropdown.querySelector(".dropdown-body");
    if (!container) return;

    if (!authService.getToken()) {
      container.innerHTML = `<div class="msg-list-empty">
        برای ارسال نظر/پیشنهاد و دیدن پاسخ‌ها ابتدا وارد شوید
      </div>`;
      return;
    }

    container.innerHTML = `<div class="msg-list-empty">در حال بارگذاری…</div>`;
    try {
      const response = await messagesApi.getMine({ limit: 20 });
      if (!response?.success) {
        container.innerHTML = `<div class="msg-list-empty">${escapeHtml(
          response?.message || "خطا در دریافت پیام‌ها",
        )}</div>`;
        return;
      }

      const items = response.data?.items || [];
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 4px;">
          <strong style="font-size:13px; color:#0f172a;">
            <i class="fas fa-comments"></i> نظرات و پیشنهادات
          </strong>
          <button type="button" class="btn-ghost-info" id="messageNewBtn"
                  style="padding:4px 10px; font-size:12px;">
            <i class="fas fa-plus"></i> پیام جدید
          </button>
        </div>
        ${this.renderThreadList(items, { emptyText: "هنوز پیامی نفرستاده‌اید" })}`;

      this.setBadge(response.data?.unread_count || 0);
    } catch (error) {
      container.innerHTML = `<div class="msg-list-empty">خطا در دریافت پیام‌ها</div>`;
      console.error("❌ refreshDropdown:", error);
    }
  }

  // ===== فهرست «پیام‌های من» در صفحهٔ تماس با ما =====
  async refreshContactList() {
    const list = document.getElementById("contactMyThreads");
    if (!list) return;

    try {
      const response = await messagesApi.getMine({ limit: 20 });
      if (!response?.success) return;

      list.innerHTML = this.renderThreadList(response.data?.items || [], {
        emptyText: "هنوز پیامی ارسال نکرده‌اید",
      });

      list.querySelectorAll(".msg-list-item").forEach((el) => {
        el.addEventListener("click", () =>
          this.openThread(el.dataset.suggestionId),
        );
      });
    } catch {
      /* بی‌صدا */
    }
  }

  // ===== راه‌اندازی صفحهٔ تماس با ما =====
  async initContactPage() {
    const list = document.getElementById("contactMyThreads");
    const sendBtn = document.getElementById("contactMsgSend");
    if (!list && !sendBtn) return; // این صفحه، صفحهٔ تماس نیست

    const loggedIn = !!authService.getToken();
    const formCard = document.getElementById("contactMsgCard");
    const guestCard = document.getElementById("contactGuestCard");
    if (formCard) formCard.style.display = loggedIn ? "" : "none";
    if (guestCard) guestCard.style.display = loggedIn ? "none" : "";

    if (!loggedIn) return;

    // ✅ گارد ضد بایند دوباره: اگر ماژول دو بار اجرا شود (مثلاً URL نسخه‌دار در
    //    HTML و import بدون نسخه در JS)، دکمه دو شنوندهٔ click نگیرد
    if (sendBtn && sendBtn.dataset.bound !== "1") {
      sendBtn.dataset.bound = "1";
      sendBtn.addEventListener("click", () =>
        this.submitNew("contactMsg", { closeOnSuccess: false }),
      );
    }
    await this.refreshContactList();
  }

  // ===== بایند کردن مودال =====
  bindModal() {
    const overlay = document.getElementById("messageThreadModal");
    if (!overlay || overlay.dataset.bound === "1") return;
    overlay.dataset.bound = "1";

    document
      .getElementById("messageThreadClose")
      ?.addEventListener("click", () => this.closeModal());
    document
      .getElementById("messageReplyCancel")
      ?.addEventListener("click", () => this.closeModal());
    document
      .getElementById("messageReplySend")
      ?.addEventListener("click", () => this.sendReply());
    // ⚠️ id واقعی دکمهٔ ارسال در header.html «messageSend» است (قبلاً
    //    messageComposeSend بایند می‌شد که وجود نداشت → دکمهٔ هدر کار نمی‌کرد)
    document
      .getElementById("messageSend")
      ?.addEventListener("click", () => this.submitNew("message"));

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) this.closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeModal();
    });
  }

  // ===== راه‌اندازی هدر (بج + دراپ‌داون + مودال + polling) =====
  async initHeader() {
    const dropdown = document.getElementById("emailDropdown");
    if (!dropdown) return;

    // ✅ گارد ضد بایند دوباره (همان دلیل گاردهای دیگر)
    if (dropdown.dataset.bound === "1") return;
    dropdown.dataset.bound = "1";

    dropdown.addEventListener("click", (event) => {
      const newBtn = event.target.closest("#messageNewBtn");
      if (newBtn) {
        this.openModal("compose");
        this.closeDropdown();
        return;
      }
      const item = event.target.closest(".msg-list-item");
      if (item) {
        this.openThread(item.dataset.suggestionId);
        this.closeDropdown();
      }
    });

    this.bindModal();
    if (authService.getToken()) this.startPolling();
  }

  // ===== راه‌اندازی کلی (خودکار روی DOMContentLoaded) =====
  async init() {
    if (this.initialized) return;
    this.initialized = true;

    // هدر به‌صورت async لود می‌شود → کمی منتظر می‌مانیم
    for (let i = 0; i < 20; i++) {
      if (document.getElementById("emailDropdown")) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    await this.initHeader();
    await this.initContactPage();

    document.addEventListener("auth:login", () => this.startPolling());
    document.addEventListener("auth:logout", () => {
      this.stopPolling();
      this.setBadge(0);
    });
  }
}

export const messagesService = new MessagesService();

// ===== در دسترس سراسری (برای دیباگ/فراخوانی از HTML) =====
if (typeof window !== "undefined") {
  window.messagesService = messagesService;
}

// ===== راه‌اندازی خودکار =====
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => messagesService.init());
  } else {
    messagesService.init();
  }
}
