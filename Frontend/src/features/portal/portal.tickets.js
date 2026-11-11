// ============================================================
// features/portal/portal.tickets.js
// پنل «ارسال تیکت» پورتال مشتری — موج ۱۳.۲۱
// ------------------------------------------------------------
//  چرا این فایل؟
//   • مشتری به جای «درخواست‌های من» یک مسیر ارتباطی مستقیم با
//     پشتیبانی می‌خواست. زیرساخت گفتگو از قبل هست
//     (Suggestion/SuggestionMessage + /api/suggestions) و مودال
//     هدر هم از همان استفاده می‌کند؛ پس سامانهٔ دوم ساخته نشد.
//
//  🔒 قواعد امنیتی/رفتاری:
//   ۱) هیچ `customer_id`/`user_id` فرستاده نمی‌شود؛ سرور از توکن
//      می‌سازد (همان قاعدهٔ همهٔ مسیرهای پورتال).
//   ۲) هیچ `<form>` ساخته نمی‌شود؛ همهٔ دکمه‌ها type="button"
//      (هم‌الگو با مدارک/پروفایل — گارد تست می‌سنجد).
//   ۳) سقف‌های سرور در کلاینت هم رعایت می‌شوند: عنوان ≤۱۵۰،
//      متن ≤۲۰۰۰ و ≥۵ نویسه (خطای فارسی، نه ۴۰۰ خشک).
//   ۴) هر متن DB با `esc` فرار می‌شود.
//   ۵) گیتِ نمایش: `features.tickets` از سرور (سرور اول)؛ اگر
//      پاسخ قدیمی/کش‌شده بود، fallback به همان کلید در مرورگر.
//      ⚠️ امروز روت /api/suggestions فقط protect دارد (چون مودال
//      هدر برای کارشناس/ادمین هم هست)؛ گیت سرور در ۱۳.۲۲ می‌آید.
// ============================================================
import { messagesApi } from "../messages/messages.api.js";
import { notificationService } from "../../core/services/notification.service.js";
import { decorateTables } from "./portal.table.js";

// اندازهٔ صفحهٔ فهرست گفتگوها (سرور سقف ۵۰ می‌گذارد)
const TICKETS_PAGE = 10;

// ============================================================
// تنظیمات پنل — یک منبع
// ------------------------------------------------------------
//  portal.views.js همین آبجکت را در `VIEW_TABS.tickets` می‌گذارد
//  (بدون رشتهٔ دوم) و منطق این فایل روی همان body/status کار می‌کند.
//   • permission → «لایهٔ منو»: دیده‌شدن آیتم/پنل
//   • requires   → «لایهٔ محتوا»: همان کلیدی که سرور هم می‌شناسد
// ============================================================
export const TICKETS_TAB = {
  permission: "customer.portal.menu.tickets",
  requires: "customer.portal.tickets",
  title: "ارسال تیکت",
  bodyId: "portalTicketsBody",
  statusId: "portalTicketsStatus",
};

// همان مقادیر مجاز سرور (SUBJECTS در suggestionController)
export const TICKET_SUBJECTS = [
  { key: "suggestion", label: "پیشنهاد" },
  { key: "question", label: "پرسش" },
  { key: "complaint", label: "شکایت" },
  { key: "bug", label: "مشکل فنی" },
  { key: "other", label: "سایر" },
];

const TICKET_STATUS_LABELS = {
  new: "جدید",
  in_progress: "در حال بررسی",
  answered: "پاسخ داده شد",
  closed: "بسته",
};

const TITLE_MAX = 150;
const BODY_MAX = 2000;
const BODY_MIN = 5;

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

const dataOf = (payload) => (payload && payload.data ? payload.data : {});

// تاریخ کوتاه (بدون وابستگی به datepicker — همان قاعدهٔ پورتال)
const dateOf = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
};

const subjectLabel = (key) =>
  TICKET_SUBJECTS.find((row) => row.key === key)?.label || "گفتگو";

const statusLabel = (key) => TICKET_STATUS_LABELS[String(key || "")] || "—";

// ============================================================
// رندر — فهرست گفتگوها + فرم تازه (بدون <form>)
// ============================================================
const listItem = (row) => {
  const id = esc(row?.id);
  const unread = row?.user_unread
    ? '<span class="portal-tk__dot" title="پاسخ خوانده‌نشده"></span>'
    : "";
  return `<li class="portal-tk__item">
    <button type="button" class="portal-tk__open" data-ticket-open="${id}">
      <span class="portal-tk__row">
        <span class="portal-tk__title">${esc(row?.title || subjectLabel(row?.subject))}</span>
        ${unread}
      </span>
      <span class="portal-tk__meta">
        <span class="portal-tk__badge" data-ticket-status="${esc(row?.status || "new")}">${esc(
          statusLabel(row?.status),
        )}</span>
        <span>${esc(subjectLabel(row?.subject))}</span>
        <span>${esc(dateOf(row?.last_message_at || row?.created_at))}</span>
        <span>${esc(row?.messages_count ?? 0)} پیام</span>
      </span>
    </button>
  </li>`;
};

const composeBlock = (draft = {}, canCreate = true) => {
  if (!canCreate) {
    return `<div class="portal-views__empty">
      <i class="fas fa-lock" aria-hidden="true"></i>
      ارسال تیکت برای حساب شما فعال نیست. برای فعال‌سازی با مدیر سیستم تماس بگیرید.
    </div>`;
  }

  const options = TICKET_SUBJECTS.map(
    (row) =>
      `<option value="${esc(row.key)}"${
        String(draft.subject || "suggestion") === row.key ? " selected" : ""
      }>${esc(row.label)}</option>`,
  ).join("");

  return `<div class="portal-tk__compose">
    <div class="portal-views__field">
      <label for="portalTicketSubject">موضوع</label>
      <select id="portalTicketSubject" data-ticket-field="subject">${options}</select>
    </div>
    <div class="portal-views__field">
      <label for="portalTicketTitle">عنوان</label>
      <input id="portalTicketTitle" type="text" maxlength="${TITLE_MAX}"
        data-ticket-field="title" value="${esc(draft.title || "")}"
        placeholder="مثلاً: خطا در ثبت وزن هفتهٔ ۳" />
    </div>
    <div class="portal-views__field">
      <label for="portalTicketBody">متن پیام</label>
      <textarea id="portalTicketBody" rows="4" maxlength="${BODY_MAX}"
        data-ticket-field="body" placeholder="شرح دقیق مشکل یا پیشنهاد…">${esc(
          draft.body || "",
        )}</textarea>
    </div>
    <div class="portal-views__note">
      <button type="button" class="portal-btn portal-btn--primary" data-ticket-send>
        <i class="fas fa-paper-plane" aria-hidden="true"></i>
        ارسال تیکت
      </button>
      <span class="portal-tk__hint">پاسخ پشتیبانی در همین صفحه دیده می‌شود.</span>
    </div>
  </div>`;
};

export const renderTicketsView = ({
  items = [],
  draft = {},
  error = "",
  canCreate = true,
  unread = 0,
  busy = false,
} = {}) => {
  const rows = Array.isArray(items) ? items : [];
  const errorBox = error
    ? `<div class="portal-views__note portal-views__note--error">${esc(error)}</div>`
    : "";

  const list = rows.length
    ? `<ul class="portal-tk__list">${rows.map(listItem).join("")}</ul>`
    : `<div class="portal-views__empty">
        <i class="fas fa-inbox" aria-hidden="true"></i>
        هنوز تیکتی نفرستاده‌اید. اولین پیام را از فرم پایین بفرستید.
      </div>`;

  return `<div class="portal-tk">
    <div class="portal-tk__head">
      <span>گفتگوهای من</span>
      ${unread ? `<span class="portal-tk__unread">${esc(unread)} پاسخ خوانده‌نشده</span>` : ""}
      ${busy ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>' : ""}
    </div>
    ${errorBox}
    ${list}
    ${composeBlock(draft, canCreate)}
  </div>`;
};

// ============================================================
// mixin — متدها روی PortalService.prototype سوار می‌شوند
// ============================================================
export const portalTicketsMixin = {
  // وضعیت داخلی (یک‌بار در PortalService.init صدا زده می‌شود)
  initTickets() {
    if (!this.extra || typeof this.extra !== "object") this.extra = {};
    this.extra.tickets = {
      loaded: false,
      loading: false,
      items: [],
      page: 1,
      pages: 1,
      total: 0,
      unread: 0,
      threadId: "",
      thread: null,
      messages: [],
      draft: { subject: "suggestion", title: "", body: "" },
      error: "",
      busy: false,
    };
    this.ticketsBound = false;
  },

  // گیت فرم ارسال: سرور اول (features.tickets)، بعد کلید مرورگر
  canCreateTicket() {
    const features = (this.data && this.data.features) || {};
    if (typeof features.tickets === "boolean") return features.tickets;
    if (typeof this.canPermission === "function") {
      return this.canPermission("customer.portal.tickets") !== false;
    }
    return true;
  },

  // تنظیمات پنل از همان آبجکت صادرشده (یک منبع، بدون رشتهٔ دوم)
  ticketTabConf() {
    return TICKETS_TAB;
  },

  // ورود پنل (از loadExtraTab صدای زده می‌شود)
  async loadTicketsView() {
    const state = this.extra && this.extra.tickets;
    if (!state || state.loading) return;
    state.loading = true;
    this.setExtraStatus("tickets", "loading");

    try {
      const conf = this.ticketTabConf();
      if (conf && !this.canViewContent(conf)) {
        state.loaded = true;
        this.setExtraStatus("tickets", "ready");
        this.renderViewDenied("tickets");
        return;
      }
      this.bindTickets();
      await this.loadTickets();
      state.loaded = true;
      this.setExtraStatus("tickets", "ready");
    } catch (error) {
      state.loaded = true;
      this.setExtraStatus(
        "tickets",
        "error",
        String(error?.message || "دریافت گفتگوها ناموفق بود"),
      );
    } finally {
      state.loading = false;
    }
  },

  // دریافت فهرست گفتگوهای من (۱ درخواست، بدون کش)
  async loadTickets(page) {
    const state = this.extra.tickets;
    const wanted = Math.max(1, Number(page) || state.page || 1);
    state.busy = true;
    this.renderTickets();

    try {
      const data = dataOf(await messagesApi.getMine({ page: wanted, limit: TICKETS_PAGE }));
      state.items = Array.isArray(data.items) ? data.items : [];
      const pagination = data.pagination || {};
      state.page = Math.max(1, Number(pagination.page) || wanted);
      state.pages = Math.max(1, Number(pagination.totalPages) || 1);
      state.total = Math.max(0, Number(pagination.total) || state.items.length);
      state.unread = Math.max(0, Number(data.unread_count) || 0);
      state.error = "";
    } catch (error) {
      state.error = String(error?.message || "دریافت گفتگوها ناموفق بود");
    } finally {
      state.busy = false;
      this.renderTickets();
    }
  },

  renderTickets() {
    const state = this.extra.tickets;
    const conf = this.ticketTabConf();
    const body = conf ? this.el(conf.bodyId) : null;
    if (!state || !body) return;

    body.innerHTML = state.thread
      ? renderTicketThread({ suggestion: state.thread, messages: state.messages })
      : renderTicketsView({
          items: state.items,
          draft: state.draft,
          error: state.error,
          canCreate: this.canCreateTicket(),
          unread: state.unread,
          busy: state.busy,
        });

    // ✅ ۱۳.۲۱ — جدول‌ها در موبایل «کارت» می‌شوند (data-label)
    decorateTables(body);
  },

  // باز کردن یک گفتگو — شناسه فقط از فهرست خودِ سرور می‌آید
  async openTicket(rawId) {
    const state = this.extra.tickets;
    const id = String(rawId ?? "").trim();
    if (!state || !id) return null;

    const allowed = state.items.some((row) => String(row.id) === id);
    if (!allowed) return null;

    state.busy = true;
    this.renderTickets();
    try {
      const data = dataOf(await messagesApi.getThread(id));
      state.threadId = id;
      state.thread = data.suggestion || null;
      state.messages = Array.isArray(data.messages) ? data.messages : [];
      this.renderTickets();
      // رسید خواندن (بج پاکت هدر صفر می‌شود) — خطا نباید صفحه را بشکند
      messagesApi.markRead(id).catch(() => {});
      return state.thread;
    } catch (error) {
      state.error = String(error?.message || "دریافت گفتگو ناموفق بود");
      this.renderTickets();
      return null;
    } finally {
      state.busy = false;
    }
  },

  closeTicket() {
    const state = this.extra.tickets;
    if (!state) return;
    state.threadId = "";
    state.thread = null;
    state.messages = [];
    this.renderTickets();
  },

  // خواندن فیلدهای فرم (بدون تگ فرم؛ همه با data-ticket-field)
  readTicketFields() {
    const body = this.el(TICKETS_TAB.bodyId);
    const out = {};
    if (!body || typeof body.querySelectorAll !== "function") return out;
    body.querySelectorAll("[data-ticket-field]").forEach((node) => {
      const key = node.getAttribute("data-ticket-field") || "";
      if (key && !(key in out)) out[key] = String(node.value ?? "");
    });
    return out;
  },

  // ارسال تیکت تازه (اعتبارسنجی کلاینت هم‌قاعدهٔ سرور)
  async sendTicket() {
    const state = this.extra.tickets;
    if (!state || state.busy) return false;
    if (!this.canCreateTicket()) return false;

    const fields = this.readTicketFields();
    const subject = String(fields.subject || "suggestion").trim();
    const title = String(fields.title || "").trim();
    const body = String(fields.body || "").trim();

    state.draft = { subject, title, body };

    if (title.length < 3) {
      state.error = "عنوان را بنویسید (حداقل ۳ نویسه).";
      this.renderTickets();
      return false;
    }
    if (body.length < BODY_MIN) {
      state.error = "متن پیام کوتاه است (حداقل ۵ نویسه).";
      this.renderTickets();
      return false;
    }

    state.busy = true;
    state.error = "";
    this.renderTickets();
    try {
      await messagesApi.create({
        subject,
        title: title.slice(0, TITLE_MAX),
        body: body.slice(0, BODY_MAX),
        page_url: "#/tickets",
      });
      state.draft = { subject: "suggestion", title: "", body: "" };
      await this.loadTickets(1);
      notificationService.notifyOnce({
        key: "portal-ticket-created",
        message: "✅ تیکت شما ثبت شد؛ پاسخ در همین صفحه نمایش داده می‌شود.",
        type: "success",
        cooldownMs: 5000,
      });
      return true;
    } catch (error) {
      state.error = String(error?.message || "ارسال تیکت ناموفق بود");
      this.renderTickets();
      return false;
    } finally {
      state.busy = false;
      this.renderTickets();
    }
  },

  // پاسخ در گفتگوی باز — شناسه از همان ردیف باز‌شده
  async sendTicketReply(rawId) {
    const state = this.extra.tickets;
    const id = String(rawId ?? "").trim();
    if (!state || state.busy || !id) return false;
    if (String(state.threadId) !== id) return false;

    const fields = this.readTicketFields();
    const body = String(fields.reply || "").trim();
    if (body.length < BODY_MIN) {
      state.error = "متن پاسخ کوتاه است (حداقل ۵ نویسه).";
      this.renderTickets();
      return false;
    }

    state.busy = true;
    this.renderTickets();
    try {
      await messagesApi.reply(id, body.slice(0, BODY_MAX));
      await this.openTicket(id);
      return true;
    } catch (error) {
      state.error = String(error?.message || "ارسال پاسخ ناموفق بود");
      this.renderTickets();
      return false;
    } finally {
      state.busy = false;
    }
  },

  // رویدادها — delegation روی همان body (یک‌بار bind می‌شود)
  bindTickets() {
    if (this.ticketsBound) return;
    const body = this.el(TICKETS_TAB.bodyId);
    if (!body || typeof body.addEventListener !== "function") return;

    body.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;

      const open = target.closest("[data-ticket-open]");
      if (open) {
        event.preventDefault();
        this.openTicket(open.getAttribute("data-ticket-open"));
        return;
      }

      if (target.closest("[data-ticket-back]")) {
        event.preventDefault();
        this.closeTicket();
        return;
      }

      if (target.closest("[data-ticket-send]")) {
        event.preventDefault();
        this.sendTicket();
        return;
      }

      const reply = target.closest("[data-ticket-reply]");
      if (reply) {
        event.preventDefault();
        this.sendTicketReply(reply.getAttribute("data-ticket-reply"));
      }
    });

    this.ticketsBound = true;
  },
};

// سوارکردن mixin روی کلاس سرویس (هم‌الگوی بقیهٔ موج‌ها)
export const applyPortalTickets = (ServiceClass) => {
  Object.assign(ServiceClass.prototype, portalTicketsMixin);
  return ServiceClass;
};

// رندر گفتگو (فقط پیام‌های همان ردیف؛ شناسه از کلیک همان فهرست می‌آید)
export const renderTicketThread = ({ suggestion = {}, messages = [] } = {}) => {
  const rows = Array.isArray(messages) ? messages : [];
  const bubbles = rows
    .map((message) => {
      const mine = String(message?.sender_type || "") === "user";
      return `<li class="portal-tk__msg ${mine ? "is-mine" : "is-admin"}">
        <div class="portal-tk__msg-head">
          <span>${esc(message?.sender_name || (mine ? "شما" : "پشتیبانی"))}</span>
          <span>${esc(dateOf(message?.created_at))}</span>
        </div>
        <div class="portal-tk__msg-body">${esc(message?.body || "")}</div>
      </li>`;
    })
    .join("");

  return `<div class="portal-tk portal-tk--thread">
    <div class="portal-tk__head">
      <button type="button" class="portal-btn" data-ticket-back>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
        بازگشت به فهرست
      </button>
      <span>${esc(suggestion?.title || subjectLabel(suggestion?.subject))}</span>
      <span class="portal-tk__badge" data-ticket-status="${esc(
        suggestion?.status || "new",
      )}">${esc(statusLabel(suggestion?.status))}</span>
    </div>
    <ul class="portal-tk__messages">${bubbles || '<li class="portal-tk__msg">پیامی ثبت نشده است.</li>'}</ul>
    <div class="portal-views__field">
      <label for="portalTicketReply">پاسخ شما</label>
      <textarea id="portalTicketReply" rows="3" maxlength="${BODY_MAX}"
        data-ticket-field="reply" placeholder="پاسخ یا توضیح تکمیلی…"></textarea>
    </div>
    <div class="portal-views__note">
      <button type="button" class="portal-btn portal-btn--primary" data-ticket-reply="${esc(
        suggestion?.id,
      )}">
        <i class="fas fa-reply" aria-hidden="true"></i>
        ارسال پاسخ
      </button>
    </div>
  </div>`;
};

