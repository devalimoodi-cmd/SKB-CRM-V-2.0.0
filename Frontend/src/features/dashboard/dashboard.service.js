import { dashboardApi } from "./dashboard.api.js";
import { dashboardRenderer } from "./dashboard.renderer.js";
import { TaskCard } from "../../shared/components/TaskCard/TaskCard.js";

import { apiService } from "../../core/services/api.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { stateService } from "../../core/services/state.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
  formatDate,
} from "../../core/utils/date.utils.js";

class DashboardService {
  constructor() {
    this.flocks = [];
    this.flockCards = [];
    this.bookmarks = [];
    this.summary = null;
    this.selectedFlockId = null;
    this.selectedCustomerId = null;
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 0;
    this.isLoading = false;
    this.initialized = false;
    this.chartInstances = {};
    this.chartStack = []; // سری‌های اضافه برای مقایسه: [{scope,id,label}]
    this.chartPalette = [
      "#f59e0b",
      "#8b5cf6",
      "#0ea5e9",
      "#ec4899",
      "#84cc16",
      "#f97316",
      "#06b6d4",
      "#e11d48",
    ];
    this.smsTemplates = {
      weekly_reminder: {
        id: 491456,
        name: "یادآوری هفتگی",
        description: "یادآوری ثبت اطلاعات هفتگی",
        template: `#FULLNAME# گرامی!
با توجه به اینکه گله شما در هفته #WEEKNUMBER# قرار دارد، لطفاً اطلاعات ذیل را آماده کنید تا همکاران ما طی ۴۸ ساعت آینده با شما تماس گرفته و اطلاعات مربوطه را اخذ نمایند:
- مصرف خوراک هفتگی
- میانگین وزن هفتگی
- تعداد تلفات گله
- مقدار ساعت خاموشی سالن
- برنامه واکسیناسیون گله

با تشکر
واحد خدمات مشتریان
کارخانه تولید خوراک طیور ستاره کیان بیرجند
SKB-CRM.IR`,
        variables: ["FULLNAME", "WEEKNUMBER", "FLOCKNUMBER"],
      },
      thanks_cooperation: {
        id: 378874,
        name: "تشکر از همکاری",
        description: "تشکر از ارائه اطلاعات هفتگی",
        template: `#FULLNAME# عزیز!
از همکاری شما در ارائه اطلاعات هفته #WEEKNUMBER# سپاسگزاریم.اطلاعات دریافتی از شما با موفقیت در سامانه ثبت شد.همکاران ما در هفته آینده مجدداً با شما تماس خواهند گرفت.

با تشکر
واحد خدمات مشتریان
کارخانه تولید خوراک طیور ستاره کیان بیرجند
SKB-CRM.IR`,
        variables: ["FULLNAME", "WEEKNUMBER"],
      },
      welcome: {
        id: 926311,
        name: "خوش آمد گویی",
        description: "ثبت نام اولیه مشتری",
        template: `#FULLNAME# عزیز!
مفتخریم از همکاری با شما؛ثبت‌نام اولیه شما در سامانه مدیریت ارتباط با مشتریان ستاره کیان بیرجند با موفقیت انجام شد.در ادامه، همکاران واحد خدمات مشتریان به‌صورت هفتگی با شما ارتباط گرفته و وضعیت گله شما را مورد پایش قرار خواهند داد.

با تشکر
واحد خدمات مشتریان
کارخانه تولید خوراک طیور ستاره کیان بیرجند
SKB-CRM.IR`,
        variables: ["FULLNAME"],
      },
    };
  }

  async init() {
    // جلوگیری از اجرای دوباره (رفرشهای ناخواسته ابتدای کار)
    if (this.initialized) return;

    // بررسی دسترسی
    const hasAccess = await authService.checkExpertPageAccess();
    if (!hasAccess) return;

    await this.loadData();
    this.setupCharts();

    // اگر هیچ گله/سالنی انتخاب نشده، پیام راهنما نمایش داده شود
    if (!this.selectedFlockId && !this.selectedFlockGroupId) {
      this.showNoFlockSelectedMessage();
    }

    this.setupEvents();
    this.setupAccordion();
    this.startAutoRefresh();
    this.initialized = true;
    console.log("✅ DashboardService initialized");
  }

  // ===== بارگذاری داده‌ها =====

  async loadData() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // بارگذاری گله‌ها
      await this.loadFlocks();

      // بارگذاری بوکمارک‌ها
      await this.loadBookmarks();

      // بارگذاری خلاصه آماری
      await this.loadSummary();

      // بارگذاری داده‌های نمودارها (فقط اگر گله/سالنی انتخاب شده باشد)
      if (this.selectedFlockGroupId) {
        await this.loadChartsData(null, this.selectedFlockGroupId);
      } else if (this.selectedFlockId) {
        await this.loadChartsData(this.selectedFlockId);
      }

      // رندر تسک‌ها
      this.renderTasks();

      // رندر بوکمارک‌ها
      this.renderBookmarks();

      console.log("✅ Dashboard data loaded successfully");
    } catch (error) {
      console.error("❌ Error loading dashboard data:", error);
      notificationService.error("خطا در بارگذاری اطلاعات");
    } finally {
      this.isLoading = false;
    }
  }

  async loadFlocks() {
    try {
      const params = {
        status: "all",
        search: "",
        page: this.currentPage,
        limit: this.pageSize,
      };

      const response = await dashboardApi.getFlocks(params);
      if (response.success) {
        this.flocks = response.data.flocks || [];
        this.totalPages = response.data.pagination?.totalPages || 0;
        stateService.setFlocks(this.flocks);
      }
      // بروزرسانی کارت‌های گله (دوره پرورش)
      await this.loadFlockCards();
    } catch (error) {
      console.error("❌ Error loading flocks:", error);
      this.flocks = [];
    }
  }

  // ===== کارت‌های گله (دوره پرورش) =====

  async loadFlockCards() {
    try {
      const response = await dashboardApi.getFlockCards({ status: "all" });
      if (!response.success) return;
      this.flockCards = response.data.flocks || [];
      this._cardsSignature = this.buildCardsSignature(this.flockCards);
      this.renderTasks();
    } catch (error) {
      console.error("❌ Error loading flock cards:", error);
      this.flockCards = [];
    }
  }

  // ===== رفرش بی‌صدا (فقط وقتی واقعاً تغییری رخ داده رندر می‌شود) =====

  buildCardsSignature(cards) {
    return (cards || [])
      .map(
        (c) =>
          `${c.customer?.id || 0}-${c.flock?.id || 0}-${c.flock?.status || "normal"}-S${c.flock?.smsToday ? `${c.flock.smsToday.count}:${(c.flock.smsToday.roles || []).join(",")}` : ""}|${(c.flock?.halls || [])
            .filter((h) => h.isActive)
            .map(
              (h) =>
                `${h.id}:${h.status || ""}:${(h.overdueWeeks || []).join(",")}:${(h.completeWeeks || []).length}:S${h.smsToday ? `${h.smsToday.count}:${(h.smsToday.roles || []).join(",")}` : ""}`,
            )
            .join(",")}`,
      )
      .join(";");
  }

  async refreshFlockCardsSilently() {
    try {
      const response = await dashboardApi.getFlockCards({ status: "all" });
      if (!response.success) return false;
      const cards = response.data.flocks || [];
      const signature = this.buildCardsSignature(cards);
      const changed = signature !== this._cardsSignature;
      this.flockCards = cards;
      this._cardsSignature = signature;
      if (changed) {
        // ترکیب کارت‌ها تغییر کرده → یک‌بار رندر
        this.renderTasks();
      } else {
        // فقط چیپ‌های وضعیت پیامک را به‌روز کن (بدون رندر / بدون پرش)
        this.updateSmsChipsFromCards(cards);
      }
      return changed;
    } catch (error) {
      console.warn("⚠️ خطا در رفرش بی‌صدای کارت‌ها:", error);
      return false;
    }
  }

  // به‌روزرسانی چیپ وضعیت پیامک هر سالن بدون بازنویسی کل کارت
  updateSmsChipsFromCards(cards) {
    (cards || []).forEach((card) => {
      (card.flock?.halls || []).forEach((hall) => {
        const row = document.querySelector(
          `.task-hall-row[data-flock-id="${hall.id}"]`,
        );
        if (!row) return;
        this.updateHallSmsChip(row, hall.smsLog || null);
      });
    });
  }

  updateHallSmsChip(row, smsLog) {
    if (!row) return;
    const log = smsLog || {};
    const snd = log.sender || {};
    const sender =
      [snd.first_name, snd.last_name].filter(Boolean).join(" ") ||
      snd.username ||
      "";
    let chip = row.querySelector(".sms-status");
    if (!log.status) {
      if (chip) chip.remove();
      return;
    }
    const status = log.status || "sent";
    const smsInfo = this.getSmsStatusInfo(status);
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "sms-status";
      row.querySelector(".th-main")?.appendChild(chip);
    }
    chip.dataset.smsStatus = status;
    if (log.message_id) {
      chip.dataset.messageId = String(log.message_id);
      chip.dataset.senderName = sender;
    }
    const fmtDateTime = (d) => {
      if (!d) return "";
      try {
        return new Intl.DateTimeFormat("fa-IR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(d));
      } catch {
        return "";
      }
    };
    const deliveredAtText = log.delivered_at
      ? fmtDateTime(log.delivered_at)
      : "";
    const senderLine = sender
      ? `<div style="font-size:9px; opacity:0.85;">فرستنده: ${sender}</div>`
      : "";
    const deliveryLine = deliveredAtText
      ? `<div style="font-size:9px; opacity:0.85;">تحویل: ${deliveredAtText}</div>`
      : "";
    chip.style.background = smsInfo.bg;
    chip.style.color = smsInfo.color;
    chip.style.padding = "3px 9px";
    chip.style.borderRadius = "10px";
    chip.style.fontSize = "10px";
    chip.style.fontWeight = "500";
    chip.style.display = "inline-flex";
    chip.style.flexDirection = "column";
    chip.style.alignItems = "flex-start";
    chip.style.gap = "1px";
    chip.style.lineHeight = "1.6";
    chip.innerHTML = `${smsInfo.text}${senderLine}${deliveryLine}`;
  }

  async loadBookmarks() {
    try {
      const response = await dashboardApi.getBookmarks({ limit: 50 });
      if (response.success) {
        this.bookmarks = response.data.bookmarks || [];
        stateService.setBookmarks(this.bookmarks);
      }
    } catch (error) {
      console.error("❌ Error loading bookmarks:", error);
      this.bookmarks = [];
    }
  }

  async loadSummary() {
    try {
      const response = await dashboardApi.getSummary();
      if (response.success) {
        this.summary = response.data;
      }
    } catch (error) {
      console.error("❌ Error loading summary:", error);
      this.summary = null;
    }
  }

  async loadChartsData(flockId = null, flockGroupId = null) {
    // فقط آخرین درخواست اعمال میشود (جلوگیری از پرش/نتیجه قدیمی)
    const seq = (this._chartRequestSeq = (this._chartRequestSeq || 0) + 1);
    this.setChartsLoading(true);
    try {
      const response = await dashboardApi.getChartsData(
        null,
        flockId,
        flockGroupId,
      );
      if (seq !== this._chartRequestSeq) return;
      if (response.success && response.data) {
        this.resetCompareSeries();
        this.updateCharts(response.data);
      }
    } catch (error) {
      if (seq === this._chartRequestSeq) {
        console.error("❌ Error loading charts data:", error);
      }
    } finally {
      if (seq === this._chartRequestSeq) {
        this.setChartsLoading(false);
      }
    }
  }

  // نمایش/مخفی‌کردن لودینگ نمودارها (حداکثر ۸ ثانیه خودکار مخفی می‌شود)
  setChartsLoading(loading) {
    const el = document.getElementById("chartLoadingOverlay");
    if (!el) return;
    if (!loading) {
      clearTimeout(this._chartLoadingTimer);
      el.style.display = "none";
      return;
    }
    clearTimeout(this._chartLoadingTimer);
    el.style.display = "flex";
    this._chartLoadingTimer = setTimeout(() => {
      el.style.display = "none";
    }, 8000);
  }

  // هدر بالای نمودارها: چیزی که انتخاب شده را نشان می‌دهد
  updateChartSelectionHeader(info = null) {
    const labelEl = document.getElementById("chartSelectionLabel");
    const header = document.getElementById("chartSelectionHeader");
    if (!labelEl) return;
    if (!info || !info.scope) {
      header?.classList.remove("has-selection");
      labelEl.textContent =
        "هنوز گله یا سالنی انتخاب نشده — از لیست تسک‌ها انتخاب کنید";
      return;
    }
    header?.classList.add("has-selection");
    const pill =
      info.scope === "flock"
        ? '<span class="cs-pill cs-flock"><i class="fas fa-warehouse"></i> کل گله</span>'
        : '<span class="cs-pill cs-hall"><i class="fas fa-map-marker-alt"></i> سالن</span>';
    labelEl.innerHTML = `${pill} <b>گله ${info.flockNumber || ""}</b>${
      info.hallName
        ? ` <span class="cs-sep">-</span> ${info.hallName}`
        : ""
    } <span class="cs-sep">|</span> ${info.customerName || ""}`;
  }

  // ===== رندر تسک‌ها (کارت گله-سطح در سررسید گذشته/نزدیک) =====

  renderTasks() {
    const dangerList = document.getElementById("dangerTaskList");
    const successList = document.getElementById("successTaskList");
    const dangerCount = document.getElementById("dangerCount");
    const successCount = document.getElementById("successCount");

    if (!dangerList || !successList) return;

    const cards = this.flockCards || [];
    const dangerCards = cards.filter((c) => c.flock?.status === "danger");
    const successCards = cards.filter((c) => c.flock?.status === "success");

    dangerList.innerHTML =
      dangerCards.length === 0
        ? this.getEmptyStateHTML("همه گله‌ها در وضعیت عادی هستند", "#10b981")
        : dangerCards
            .map((c) => dashboardRenderer.renderFlockCard(c))
            .join("");

    successList.innerHTML =
      successCards.length === 0
        ? this.getEmptyStateHTML("هیچ گله‌ای نزدیک به سررسید نیست", "#10b981")
        : successCards
            .map((c) => dashboardRenderer.renderFlockCard(c))
            .join("");

    if (dangerCount) dangerCount.textContent = dangerCards.length;
    if (successCount) successCount.textContent = successCards.length;

    this.updateAccordionVisibility();
  }

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
  }

  renderTaskCard(item, type) {
    const { customer, flock } = item;
    const statusInfo = this.getStatusInfo(flock);

    // وضعیت پیامک — از لاگ ارسالی امروز گله (در صورت وجود در بک‌اند)
    const smsInfoHTML = this.buildSmsStatusHTML(item.smsLog || null);

    // ساخت تاریخ شمسی هفته جاری
    const weekStartDate = flock.weekStartDate
      ? convertToPersianDate(flock.weekStartDate)
      : "-";
    const weekEndDate = flock.weekEndDate
      ? convertToPersianDate(flock.weekEndDate)
      : "-";

    // ساخت تعداد کل هفته‌ها
    const totalWeeks = flock.totalWeeks || Math.max(flock.weekNumber || 1, 8);
    const completedWeeks = flock.completedWeeks || [];
    const bookmarkCount = flock.bookmarkCount || 0;

    // ساختن statusText مناسب
    const statusTextMap = {
      danger: "سررسید شده",
      success: "نزدیک به سررسید",
      normal: "عادی",
    };
    const statusText = statusTextMap[type] || statusInfo.text;

    // کلاس وضعیت برای رنگ حاشیه کارت
    const statusClassName =
      type === "danger"
        ? "task-card-danger"
        : type === "success"
          ? "task-card-success"
          : "";

    // فراخوانی کامپوننت TaskCard
    return TaskCard({
      customerId: customer.id,
      customerName: customer.name,
      farmName: customer.farmName,
      location: customer.city,
      className: statusClassName,
      flockId: flock.id,
      flockNumber: flock.flockNumber,
      unitName: flock.unitName,
      hallName: flock.hallName,
      breedName: flock.breedName,
      totalWeeks: totalWeeks,
      completedWeeks: completedWeeks,
      currentWeek: flock.weekNumber || 1,
      currentWeekAge: flock.flockAge || 0,
      currentWeekDate: `${weekStartDate} - ${weekEndDate}`,
      bookmarkCount: bookmarkCount,
      status: type,
      statusText: statusText,
      daysRemaining:
        flock.daysRemaining !== undefined && flock.daysRemaining >= 0
          ? flock.daysRemaining
          : "",
      smsStatusHTML: smsInfoHTML,
      onClick: `window.selectFlockForChart(${customer.id}, ${flock.id}, '${customer.name}', ${flock.flockNumber}, ${flock.weekNumber})`,
      actions: {
        profile: {
          label: "پروفایل",
          icon: "fa-user",
          onClick: `window.goToCustomerProfile(${customer.id})`,
        },
        detail: {
          label: "جزئیات",
          icon: "fa-info-circle",
          onClick: `window.showCustomerDetail(${customer.id}, ${flock.id})`,
        },
        sms: {
          label: "ارسال پیامک",
          icon: "fa-sms",
          primary: true,
          onClick: `window.sendSmsToCustomer(${customer.id}, '${customer.name}', ${flock.id}, ${flock.weekNumber}, ${flock.flockNumber}, this.closest('.task-card'))`,
        },
        history: {
          label: "تاریخچه",
          icon: "fa-history",
          onClick: `window.showSmsHistory(${customer.id}, ${flock.id})`,
        },
        refresh: {
          icon: "fa-sync-alt",
          onClick: `window.refreshSmsStatus(${customer.id}, ${flock.id})`,
        },
      },
    });
  }

  getEmptyStateHTML(message, color) {
    return `
            <div class="empty-list">
                <i class="fas fa-check-circle" style="color: ${color}; font-size: 32px; display: block; margin-bottom: 10px;"></i>
                <span>${message}</span>
            </div>
        `;
  }

  getStatusInfo(flock) {
    const today = new Date();
    const endDate = new Date(flock.weekEndDate);
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        type: "danger",
        text: "🔴 سررسید شده",
        icon: "🔴",
        color: "#dc2626",
        bg: "#fee2e2",
      };
    } else if (diffDays <= 2) {
      return {
        type: "success",
        text: "🟢 نزدیک به سررسید",
        icon: "🟢",
        color: "#16a34a",
        bg: "#dcfce7",
      };
    } else {
      return {
        type: "normal",
        text: "🔵 عادی",
        icon: "🔵",
        color: "#3b82f6",
        bg: "#dbeafe",
      };
    }
  }

  getSmsStatusInfo(status) {
    const map = {
      pending: { text: "در انتظار", color: "#d97706", bg: "#fef3c7" },
      sent: { text: "ارسال شده", color: "#2563eb", bg: "#dbeafe" },
      delivered: { text: "تحویل داده شده", color: "#047857", bg: "#d1fae5" },
      failed: { text: "ناموفق", color: "#dc2626", bg: "#fee2e2" },
    };
    return map[status] || map.pending;
  }

  // ===== رندر بوکمارک‌ها =====

  renderBookmarks() {
    const container = document.getElementById("bookmarkList");
    if (!container) return;

    if (!this.bookmarks || this.bookmarks.length === 0) {
      container.innerHTML = `
                <div class="empty-list">
                    <i class="fas fa-bookmark" style="font-size: 32px; display: block; margin-bottom: 10px; color: #cbd5e1;"></i>
                    <span>هیچ بوکمارکی وجود ندارد</span>
                    <p style="font-size: 12px; margin-top: 8px; color: #cbd5e1;">
                        برای ایجاد بوکمارک جدید، روی دکمه <strong>+</strong> کلیک کنید
                    </p>
                </div>
            `;
      return;
    }

    // مرتب‌سازی بر اساس اولویت
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...this.bookmarks].sort((a, b) => {
      return (
        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      );
    });

    container.innerHTML = sorted
      .map((item) => this.renderBookmarkItem(item))
      .join("");
  }

  renderBookmarkItem(bookmark) {
    const priorityText = this.getPriorityText(bookmark.priority);
    const priorityColor = this.getPriorityColor(bookmark.priority);
    const typeText = bookmark.type === "reminder" ? "🔔 یادآوری" : "📌 بوکمارک";
    const icon = bookmark.type === "reminder" ? "fa-bell" : "fa-bookmark";
    const iconColor = bookmark.type === "reminder" ? "#f59e0b" : "#3b82f6";

    let dueDateHTML = "";
    if (bookmark.due_date) {
      const persianDate = convertToPersianDate(bookmark.due_date);
      const isOverdue = new Date(bookmark.due_date) < new Date();
      dueDateHTML = `
                <span style="color: ${isOverdue ? "#dc2626" : "#64748b"}; font-size: 11px;">
                    <i class="fas fa-calendar-alt"></i> ${persianDate}
                    ${isOverdue ? " ⚠️" : ""}
                </span>
            `;
    }

    let statusHTML = "";
    if (bookmark.status === "read") {
      statusHTML =
        '<span style="color: #16a34a; font-size: 11px;"><i class="fas fa-check-circle"></i> خوانده شده</span>';
    } else if (bookmark.status === "completed") {
      statusHTML =
        '<span style="color: #2563eb; font-size: 11px;"><i class="fas fa-check-double"></i> انجام شده</span>';
    }

    return `
            <div class="bookmark-item" data-id="${bookmark.id}">
                <div class="bookmark-info" onclick="window.showBookmarkDetail(${bookmark.id})" style="cursor: pointer;">
                    <div class="title" style="color: ${priorityColor};">
                        ${bookmark.type === "reminder" ? "🔔" : "📌"} ${bookmark.title}
                    </div>
                    <div class="sub">
                        <span>${bookmark.customer?.full_name || "شخصی"}</span>
                        <span class="priority-badge ${bookmark.priority}">${priorityText}</span>
                        <span class="type-badge">${typeText}</span>
                        ${dueDateHTML}
                        ${statusHTML}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    <i class="fas ${icon} bookmark-icon" style="color: ${iconColor};"></i>
                    <button onclick="event.stopPropagation(); window.showCreateBookmarkModal(${bookmark.id})" 
                            style="background: none; border: none; color: #3b82f6; cursor: pointer; padding: 4px 6px; font-size: 14px; transition: all 0.2s ease; border-radius: 4px;"
                            onmouseover="this.style.background='#dbeafe'; this.style.transform='scale(1.1)'" 
                            onmouseout="this.style.background='transparent'; this.style.transform='scale(1)'"
                            title="ویرایش بوکمارک">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="event.stopPropagation(); window.deleteBookmarkAction(${bookmark.id})" 
                            style="background: none; border: none; color: #dc2626; cursor: pointer; padding: 4px 6px; font-size: 14px; transition: all 0.2s ease; border-radius: 4px;"
                            onmouseover="this.style.background='#fee2e2'; this.style.transform='scale(1.1)'" 
                            onmouseout="this.style.background='transparent'; this.style.transform='scale(1)'"
                            title="حذف بوکمارک">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
  }

  // ===== نمودارها =====

  // ساخت نمودارها با داده خالی (بدون داده فیک)
  setupCharts() {
    // اگر چارت‌هایی قبلاً ساخته شده‌اند، اول همه را destroy کن
    Object.values(this.chartInstances).forEach((chart) => {
      if (chart) {
        try {
          chart.destroy();
        } catch (e) {}
      }
    });
    this.chartInstances = {};

    // پاکسازی آمارها
    this.resetChartStats();

    // نمودار وزن‌گیری
    const weightCtx = document
      .getElementById("weightingCanvas")
      ?.getContext("2d");
    if (weightCtx) {
      // پاکسازی canvas
      weightCtx.clearRect(0, 0, 200, 120);
    }
    if (weightCtx) {
      this.chartInstances.weighting = new Chart(weightCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "وزن (کیلوگرم)",
              data: [],
              borderColor: "#4a90e2",
              backgroundColor: "rgba(74, 144, 226, 0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { color: "#475569", font: { family: "Vazir", size: 11 } } },
          },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    // نمودار تلفات
    const lossCtx = document.getElementById("lossCanvas")?.getContext("2d");
    if (lossCtx) {
      this.chartInstances.loss = new Chart(lossCtx, {
        type: "bar",
        data: {
          labels: [],
          datasets: [
            {
              label: "تلفات",
              data: [],
              backgroundColor: "#ef4444",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    // نمودار مصرف خوراک
    const feedCtx = document.getElementById("feedCanvas")?.getContext("2d");
    if (feedCtx) {
      this.chartInstances.feed = new Chart(feedCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "خوراک (کیلوگرم)",
              data: [],
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              fill: true,
              tension: 0.4,
              pointRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } },
        },
      });
    }

    this.ensureChartCompareUi();

    console.log("✅ Charts initialized (empty)");
  }

  // پاکسازی آمار نمودارها
  resetChartStats() {
    const ids = [
      "avgWeight",
      "maxWeight",
      "totalLoss",
      "avgLoss",
      "totalFeed",
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const unitEl = el.querySelector(".unit");
        if (unitEl) {
          el.innerHTML = `<span class="unit">${unitEl.textContent}</span>`;
        } else {
          el.textContent = "-";
        }
      }
    });
  }

  // نمایش پیام «گله‌ای انتخاب نشده» روی نمودارها
  showNoFlockSelectedMessage() {
    const chartTitles = document.querySelectorAll(".chart-title");
    chartTitles.forEach((title) => {
      // فقط یکبار اضافه کن
      const existing = title.querySelector(".no-flock-badge");
      if (!existing) {
        title.insertAdjacentHTML(
          "beforeend",
          `<span class="no-flock-badge" style="margin-inline-start:8px; font-size:10px; font-weight:600; color:#f59e0b; background:#fef3c7; padding:2px 10px; border-radius:12px;">⚠️ گله‌ای انتخاب نشده</span>`,
        );
      }
    });

    // نشان دادن پیام روی chart-wrapper ها
    document.querySelectorAll(".chart-wrapper").forEach((wrapper) => {
      const existing = wrapper.querySelector(".chart-empty-overlay");
      if (!existing) {
        const overlay = document.createElement("div");
        overlay.className = "chart-empty-overlay";
        overlay.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:150px; color:#94a3b8; text-align:center; padding:20px;">
            <i class="fas fa-chart-line" style="font-size:28px; margin-bottom:10px; opacity:0.4;"></i>
            <span style="font-size:13px; font-weight:600;">برای مشاهده نمودارها، ابتدا یک گله را انتخاب کنید</span>
            <span style="font-size:11px; margin-top:6px; opacity:0.8;">از لیست تسک‌ها یک گله را انتخاب کنید</span>
          </div>
        `;
        wrapper.appendChild(overlay);
      }
    });
  }

  // مخفی کردن پیام «گله‌ای انتخاب نشده»
  hideNoFlockSelectedMessage() {
    document.querySelectorAll(".no-flock-badge").forEach((el) => el.remove());
    document
      .querySelectorAll(".chart-empty-overlay")
      .forEach((el) => el.remove());
  }

  // ===== مقایسه گله/سالن دیگر روی نمودارها =====

  ensureChartCompareUi() {
    const header = document.getElementById("chartSelectionHeader");
    if (!header) return;
    if (header.querySelector("#addCompareBtn")) return;
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:6px; width:100%;";
    wrap.innerHTML = `
      <button type="button" id="addCompareBtn"
        style="padding:4px 12px; border:1px dashed #2c7a6e; background:#ecfdf5; color:#047857; border-radius:999px; font-size:11px; font-weight:600; cursor:pointer;"
        onclick="window.openChartComparePicker()"><i class="fas fa-plus"></i> مقایسه با گله/سالن دیگر</button>
      <span id="compareChips" style="display:inline-flex; flex-wrap:wrap; gap:4px;"></span>`;
    header.appendChild(wrap);
  }

  renderCompareChips() {
    const chipsEl = document.getElementById("compareChips");
    if (!chipsEl) return;
    chipsEl.innerHTML = this.chartStack
      .map((s) => {
        const i = this.chartStack.indexOf(s);
        const color =
          this.chartPalette[i % this.chartPalette.length] || "#64748b";
        return `<span style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:999px; font-size:10px; color:${color}; background:${color}18; border:1px solid ${color}55;">
          <i class="fas fa-circle" style="font-size:6px;"></i> ${s.label}
          <a href="javascript:void(0)" onclick="window.removeChartCompare('${s.scope}',${s.id})" style="color:inherit; text-decoration:none;">&times;</a></span>`;
      })
      .join("");
  }

  _mkSeriesDataset(kind, label, data, color) {
    if (kind === "loss") {
      return { label, data, backgroundColor: color, borderRadius: 4 };
    }
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: `${color}22`,
      fill: false,
      tension: 0.4,
      pointRadius: 3,
      borderWidth: 2,
    };
  }

  async addChartComparison(scope, id, label) {
    const weight = this.chartInstances.weighting;
    if (!weight || !(weight.data.labels || []).length) {
      notificationService.warning(
        "ابتدا یک گله را به‌عنوان سری اصلی انتخاب کنید",
      );
      return;
    }
    if (
      this.chartStack.some(
        (s) => s.scope === scope && String(s.id) === String(id),
      )
    ) {
      notificationService.info("این سری از قبل اضافه شده است");
      return;
    }
    this.setChartsLoading(true);
    try {
      const flockId = scope === "hall" ? id : null;
      const flockGroupId = scope === "flock" ? id : null;
      const response = await dashboardApi.getChartsData(
        null,
        flockId,
        flockGroupId,
      );
      const flock = response?.success && response.data?.flocks?.[0];
      const d = flock?.data;
      if (!d || !Array.isArray(d.weighting)) {
        notificationService.warning("داده‌ای برای این گله/سالن یافت نشد");
        return;
      }
      const color =
        this.chartPalette[this.chartStack.length % this.chartPalette.length];
      const labelFinal =
        label ||
        (scope === "flock"
          ? `گله ${flock.flock_number || id}`
          : flock.hallName || `سالن ${id}`);
      const mapKind = {
        weighting: d.weighting || [],
        loss: d.loss || [],
        feed: d.feed || [],
      };
      ["weighting", "loss", "feed"].forEach((kind) => {
        const chart = this.chartInstances[kind];
        if (!chart) return;
        chart.data.datasets.push(
          this._mkSeriesDataset(kind, labelFinal, mapKind[kind] || [], color),
        );
      });
      this.chartStack.push({ scope, id, label: labelFinal });
      ["weighting", "loss", "feed"].forEach((k) =>
        this.chartInstances[k]?.update(),
      );
      this.renderCompareChips();
      notificationService.success(`سری «${labelFinal}» به نمودارها اضافه شد`);
    } catch (error) {
      console.error("❌ Error adding compare series:", error);
      notificationService.error("خطا در افزودن سری مقایسه");
    } finally {
      this.setChartsLoading(false);
    }
  }

  removeChartCompare(scope, id) {
    const idx = this.chartStack.findIndex(
      (s) => s.scope === scope && String(s.id) === String(id),
    );
    if (idx < 0) return;
    ["weighting", "loss", "feed"].forEach((kind) => {
      const chart = this.chartInstances[kind];
      if (!chart || !chart.data.datasets) return;
      if (chart.data.datasets.length > 1) {
        chart.data.datasets.splice(1 + idx, 1);
        chart.update();
      }
    });
    this.chartStack.splice(idx, 1);
    this.renderCompareChips();
  }

  resetCompareSeries() {
    ["weighting", "loss", "feed"].forEach((kind) => {
      const chart = this.chartInstances[kind];
      if (!chart || !chart.data.datasets) return;
      if (chart.data.datasets.length > 1) chart.data.datasets.length = 1;
    });
    this.chartStack = [];
    this.renderCompareChips();
  }

  openChartComparePicker() {
    if (!this.flockCards || !this.flockCards.length) {
      notificationService.warning("گله‌ای برای مقایسه در دسترس نیست");
      return;
    }
    let optionsHtml = "";
    this.flockCards.forEach((card) => {
      const fl = card.flock || {};
      const gNum = fl.flockNumber || fl.id || "";
      optionsHtml += `<optgroup label="گله ${gNum}">
        <option value="flock:${fl.id}|گله ${gNum} (کل)">کل گله ${gNum}</option>`;
      (fl.halls || [])
        .filter((h) => h.isActive)
        .forEach((h) => {
          const hn = h.hallName || `سالن ${h.hallId}`;
          optionsHtml += `<option value="hall:${h.id}|${hn} (گله ${gNum})">${hn} — گله ${gNum}</option>`;
        });
      optionsHtml += "</optgroup>";
    });
    if (typeof Swal === "undefined") return;
    Swal.fire({
      title: "مقایسه با گله/سالن دیگر",
      html: `
        <div style="text-align:right; direction:rtl; font-family:Vazir,sans-serif;">
          <select id="compareTarget" style="width:100%; padding:8px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px;">
            <option value="">انتخاب کنید...</option>${optionsHtml}
          </select>
          <p style="font-size:11px; color:#94a3b8; margin-top:8px;">سری اضافه‌شده با رنگ جداگانه روی هر سه نمودار (وزن/تلفات/خوراک) نمایش داده می‌شود.</p>
        </div>`,
      showCancelButton: true,
      confirmButtonText: "➕ افزودن به نمودار",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#2c7a6e",
      preConfirm: () => {
        const raw = document.getElementById("compareTarget")?.value || "";
        if (!raw) {
          Swal.showValidationMessage("یک گله یا سالن انتخاب کنید");
          return false;
        }
        const parts = raw.split("|");
        const [scope, id] = (parts[0] || "").split(":");
        return { scope, id, label: parts[1] || "" };
      },
    }).then((result) => {
      if (result.isConfirmed && result.value) {
        this.addChartComparison(
          result.value.scope,
          result.value.id,
          result.value.label,
        );
      }
    });
  }

  updateCharts(data) {
    // وقتی داده واقعی وجود دارد، پیام «گله‌ای انتخاب نشده» را مخفی کن
    if (data && data.flocks && data.flocks.length > 0) {
      this.hideNoFlockSelectedMessage();
    }

    if (!data || !data.flocks || data.flocks.length === 0) return;

    const flock = data.flocks[0];
    const chartData = flock.data || {};
    const summary = flock.summary || {};
    const labels = chartData.weekLabels || [
      "هفته ۱",
      "هفته ۲",
      "هفته ۳",
      "هفته ۴",
      "هفته ۵",
      "هفته ۶",
    ];

    // ✅ مرتب‌سازی داده‌ها بر اساس شماره هفته (لایه امنیتی دوم)
    const weekNumbers = chartData.weekNumbers || [];

    // تابع کمکی: مرتب‌سازی آرایه داده همراه با لیبل‌ها بر اساس شماره هفته
    const sortDataByWeek = (dataArr, fallbackArr) => {
      const source = dataArr || fallbackArr || [];
      if (!weekNumbers.length || !source.length) return source;

      return weekNumbers
        .map((wn, i) => ({ wn: wn || 0, val: source[i] }))
        .sort((a, b) => a.wn - b.wn)
        .map((item) => item.val);
    };

    // مرتب‌سازی لیبل‌ها بر اساس شماره هفته
    const sortedLabels = weekNumbers.length
      ? weekNumbers
          .map((wn, i) => ({ wn: wn || 0, label: labels[i] }))
          .sort((a, b) => a.wn - b.wn)
          .map((item) => item.label)
      : labels;

    // مرتب‌سازی داده‌های هر نمودار
    const sortedWeighting = sortDataByWeek(
      chartData.weighting,
      this.chartInstances.weighting?.data?.datasets?.[0]?.data,
    );
    const sortedLoss = sortDataByWeek(
      chartData.loss,
      this.chartInstances.loss?.data?.datasets?.[0]?.data,
    );
    const sortedFeed = sortDataByWeek(
      chartData.feed,
      this.chartInstances.feed?.data?.datasets?.[0]?.data,
    );

    // نام سری اصلی در legend (کل گله یا سالن)
    const mainLabel = flock.hallName
      ? flock.hallName
      : `گله ${flock.flock_number || ""}`;
    [
      ["weighting", this.chartInstances.weighting],
      ["loss", this.chartInstances.loss],
      ["feed", this.chartInstances.feed],
    ].forEach(([, chart]) => {
      if (chart && chart.data.datasets && chart.data.datasets[0]) {
        chart.data.datasets[0].label = mainLabel;
      }
    });

    // بروزرسانی نمودار وزن
    if (this.chartInstances.weighting && sortedWeighting) {
      this.chartInstances.weighting.data.labels = sortedLabels;
      this.chartInstances.weighting.data.datasets[0].data = sortedWeighting;
      this.chartInstances.weighting.update();
    }

    // بروزرسانی نمودار تلفات
    if (this.chartInstances.loss && sortedLoss) {
      this.chartInstances.loss.data.labels = sortedLabels;
      this.chartInstances.loss.data.datasets[0].data = sortedLoss;
      this.chartInstances.loss.update();
    }

    // بروزرسانی نمودار خوراک
    if (this.chartInstances.feed && sortedFeed) {
      this.chartInstances.feed.data.labels = sortedLabels;
      this.chartInstances.feed.data.datasets[0].data = sortedFeed;
      this.chartInstances.feed.update();
    }

    // ===== نمایش هم‌زمان سالن‌های عضو یک گله (پاسخ scope:flock) =====
    const hallSeries = Array.isArray(data.halls) ? data.halls : [];
    if (hallSeries.length > 0) {
      const ensureBaseOnly = () => {
        ["weighting", "loss", "feed"].forEach((kind) => {
          const chart = this.chartInstances[kind];
          if (chart && chart.data.datasets && chart.data.datasets.length > 1) {
            chart.data.datasets.length = 1;
          }
        });
      };
      ensureBaseOnly();
      hallSeries.forEach((h, i) => {
        const color =
          this.chartPalette[(i + 1) % this.chartPalette.length] || "#94a3b8";
        const hallLabel = h.name || `سالن ${h.hallId || ""}`;
        ["weighting", "loss", "feed"].forEach((kind) => {
          const chart = this.chartInstances[kind];
          if (!chart || !chart.data.datasets) return;
          chart.data.datasets.push(
            this._mkSeriesDataset(kind, hallLabel, h[kind] || [], color),
          );
        });
      });
      ["weighting", "loss", "feed"].forEach((k) =>
        this.chartInstances[k]?.update(),
      );
    }

    // بروزرسانی آمار
    if (summary) {
      const avgWeight = document.getElementById("avgWeight");
      const maxWeight = document.getElementById("maxWeight");
      const totalLoss = document.getElementById("totalLoss");
      const avgLoss = document.getElementById("avgLoss");
      const totalFeed = document.getElementById("totalFeed");

      if (avgWeight) avgWeight.textContent = summary.avgWeight + " کیلوگرم";
      if (maxWeight) maxWeight.textContent = summary.maxWeight + " کیلوگرم";
      if (totalLoss) totalLoss.textContent = summary.totalLoss || "0";
      if (avgLoss) avgLoss.textContent = summary.avgLoss + " قطعه";
      if (totalFeed)
        totalFeed.textContent =
          (summary.totalFeed || 0).toLocaleString() + " کیلوگرم";
    }

    console.log("✅ Charts updated with data:", data);
  }

  // ===== انتخاب «کل گله» برای نمودار (تجمیع سالن‌های فعال گله) =====

  async selectFlockGroupForChart(
    customerId,
    flockGroupId,
    customerName,
    flockNumber,
    weekNumber,
  ) {
    if (!flockGroupId) return;
    this.selectedFlockId = null;
    this.selectedFlockGroupId = flockGroupId;
    this.selectedCustomerId = customerId;

    // حذف کلاس selected از همه کارت‌ها و ردیف‌های سالن
    document
      .querySelectorAll(".task-card.selected, .task-hall-row.selected")
      .forEach((el) => el.classList.remove("selected"));

    // هایلایت کارت گله
    const grpCard = document.querySelector(
      `.task-card[data-flock-group-id="${flockGroupId}"]`,
    );
    if (grpCard) grpCard.classList.add("selected");

    notificationService.success(
      `✅ گله ${flockNumber || ""} (کل گله)${weekNumber ? ` - هفته ${weekNumber}` : ""} - ${customerName} انتخاب شد`,
    );
    this.updateChartSelectionHeader({
      scope: "flock",
      flockNumber,
      hallName: null,
      customerName,
    });

    // بارگذاری داده‌های تجمیعی گله
    await this.loadChartsData(null, flockGroupId);
  }

  async selectFlockForChart(
    customerId,
    flockId,
    customerName,
    flockNumber,
    weekNumber,
    hallName = null,
    flockGroupId = null,
  ) {
    // ذخیره سالن/گله انتخاب‌شده (flockId = شناسه جوجه‌ریزی همان سالن)
    this.selectedFlockId = flockId;
    this.selectedFlockGroupId =
      flockGroupId || this.selectedFlockGroupId || null;
    this.selectedCustomerId = customerId;

    // حذف کلاس selected از همه کارت‌ها و ردیف‌های سالن
    document
      .querySelectorAll(".task-card.selected, .task-hall-row.selected")
      .forEach((el) => el.classList.remove("selected"));

    // هایلایت کارت گله
    if (flockGroupId) {
      const grpCard = document.querySelector(
        `.task-card[data-flock-group-id="${flockGroupId}"]`,
      );
      if (grpCard) grpCard.classList.add("selected");
    }

    // هایلایت ردیف سالن انتخاب‌شده
    const hallRow = document.querySelector(
      `.task-hall-row[data-customer-id="${customerId}"][data-flock-id="${flockId}"]`,
    );
    if (hallRow) hallRow.classList.add("selected");

    notificationService.success(
      `✅ ${flockNumber ? `گله ${flockNumber}` : ""}${hallName ? ` - ${hallName}` : ""} (هفته ${weekNumber}) - ${customerName} انتخاب شد`,
    );
    this.updateChartSelectionHeader({
      scope: "hall",
      flockNumber,
      hallName,
      customerName,
    });

    // بارگذاری داده‌های نمودار برای سالن انتخاب شده
    await this.loadChartsData(flockId);

    // ✅ بروزرسانی وضعیت پیامک‌ها همان لحظه که سالن/گله انتخاب می‌شود
    await this.refreshAllTaskSmsStatus();
    // توجه: بدون رندر مجدد لیست تا حالت selected حفظ شود
  }

  // ===== آکاردئون =====

  setupAccordion() {
    // ✅ هدرها در HTML خودشان onclick="window.toggleAccordion(...)" دارند
    // فقط برای هدرهایی که onclick ندارند، listener اضافه می‌کنیم
    // تا از توگل دوباره (باز و بلافاصله بسته) جلوگیری شود
    document.querySelectorAll(".accordion-header").forEach((header) => {
      // اگر هدر onclick inline دارد، listener اضافه نکن (دوبار توگل می‌شود)
      if (header.hasAttribute("onclick")) return;

      header.addEventListener("click", function () {
        const sectionId = this.dataset.section;
        const section = document.getElementById(sectionId);
        const icon = this.querySelector(".accordion-icon");

        if (!section) return;

        const isHidden =
          section.style.display === "none" || section.style.display === "";

        if (isHidden) {
          section.style.display = "block";
          if (icon) icon.style.transform = "rotate(180deg)";
        } else {
          section.style.display = "none";
          if (icon) icon.style.transform = "rotate(0deg)";
        }
      });
    });
  }

  updateAccordionVisibility() {
    const dangerItems = document.querySelectorAll(
      "#dangerTaskList .task-card",
    ).length;
    const successItems = document.querySelectorAll(
      "#successTaskList .task-card",
    ).length;

    const dangerSection = document.getElementById("dangerSection");
    const successSection = document.getElementById("successSection");

    if (dangerItems === 0 && dangerSection) {
      dangerSection.style.display = "none";
    } else if (dangerSection) {
      dangerSection.style.display = "block";
    }

    if (successItems === 0 && successSection) {
      successSection.style.display = "none";
    } else if (successSection) {
      successSection.style.display = "block";
    }
  }

  // ===== رویدادها =====

  setupEvents() {
    // بستن مودال جزئیات مشتری
    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
      closeModalBtn.addEventListener("click", () => {
        const modal = document.getElementById("customerDetailModal");
        if (modal) {
          modal.classList.remove("active");
          document.body.style.overflow = "";
        }
      });
    }

    // دکمه حذف همه موارد danger
    const removeAllBtn = document.getElementById("removeAllDanger");
    if (removeAllBtn) {
      removeAllBtn.addEventListener("click", () => this.removeAllDangerCards());
    }

    // دکمه رفرش بوکمارک
    const refreshBookmarksBtn = document.getElementById("refreshBookmarks");
    if (refreshBookmarksBtn) {
      refreshBookmarksBtn.addEventListener("click", () => {
        this.loadBookmarks();
        this.renderBookmarks();
        notificationService.success("✅ بوکمارک‌ها بروزرسانی شدند");
      });
    }

    // دکمه ایجاد بوکمارک جدید
    const addBookmarkBtn = document.querySelector(".btn-add-bookmark");
    if (addBookmarkBtn) {
      addBookmarkBtn.addEventListener("click", () => {
        window.showCreateBookmarkModal();
      });
    }

    // بستن مودال با کلیک روی backdrop
    document.querySelectorAll(".modal-overlay").forEach((modal) => {
      modal.addEventListener("click", function (e) {
        if (e.target === this) {
          this.classList.remove("active");
          document.body.style.overflow = "";
        }
      });
    });

    // بستن مودال با کلید Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach((modal) => {
          modal.classList.remove("active");
          document.body.style.overflow = "";
        });
      }
    });

    // دکمه خروج
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => authService.logout("/login"));
    }
  }

  // ===== حذف کارت‌ها =====

  removeAllDangerCards() {
    const cards = document.querySelectorAll("#dangerTaskList .task-card");
    if (cards.length === 0) {
      notificationService.info("لیست سررسید خالی است");
      return;
    }

    notificationService
      .confirm({
        title: "🗑️ حذف همه موارد",
        text: `آیا از حذف ${cards.length} مورد از لیست سررسید اطمینان دارید؟`,
        confirmText: "بله، حذف شود",
        cancelText: "انصراف",
      })
      .then((result) => {
        if (result) {
          cards.forEach((card, index) => {
            setTimeout(() => {
              card.style.transition = "all 0.3s ease";
              card.style.transform = "translateX(-100%)";
              card.style.opacity = "0";
              setTimeout(() => card.remove(), 300);
            }, index * 100);
          });

          setTimeout(
            () => {
              const remaining = document.querySelectorAll(
                "#dangerTaskList .task-card",
              ).length;
              const dangerCount = document.getElementById("dangerCount");
              if (dangerCount) dangerCount.textContent = remaining;
              this.updateAccordionVisibility();
              notificationService.success("✅ همه موارد حذف شدند");
            },
            cards.length * 100 + 500,
          );
        }
      });
  }

  removeTaskCard(element, customerId, flockId) {
    const card = element.closest(".task-card");
    if (!card) return;

    card.style.transition = "all 0.3s ease";
    card.style.transform = "translateX(-100%)";
    card.style.opacity = "0";

    setTimeout(() => {
      card.remove();
      const dangerItems = document.querySelectorAll(
        "#dangerTaskList .task-card",
      ).length;
      const successItems = document.querySelectorAll(
        "#successTaskList .task-card",
      ).length;

      const dangerCount = document.getElementById("dangerCount");
      const successCount = document.getElementById("successCount");

      if (dangerCount) dangerCount.textContent = dangerItems;
      if (successCount) successCount.textContent = successItems;

      this.updateAccordionVisibility();
    }, 300);
  }

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
  }

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
        const message = prompt(
          `متن پیامک برای ${customerName}:`,
          defaultMessage,
        );
        resolve(message);
      }
    });
  }

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
  }

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
  }

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
  }

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
  }

  // ===== رفرش خودکار =====

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    // بروزرسانی هر 15 ثانیه: بدون رندر کامل — فقط اگر داده کارت‌ها واقعاً تغییر کرده باشد
    this.refreshInterval = setInterval(() => {
      if (!document.hidden) {
        this.refreshFlockCardsSilently();
        this.loadBookmarks();
        // ✅ فقط وضعیت پیامک‌های در انتظار بررسی شوند
        this.refreshAllTaskSmsStatus();
      }
    }, 15000);

    // بروزرسانی هنگام بازگشت به صفحه (بدون رندر کامل)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.refreshFlockCardsSilently();
        this.loadBookmarks();
      }
    });

    // بروزرسانی هنگام فوکوس (بدون رندر کامل)
    window.addEventListener("focus", () => {
      this.refreshFlockCardsSilently();
      this.loadBookmarks();
    });
  }

  // ===== رفرش =====

  refresh() {
    this.loadData();
  }

  // ===== دیستروی =====

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    Object.values(this.chartInstances).forEach((chart) => {
      if (chart) chart.destroy();
    });
    this.chartInstances = {};
  }

  // ===== توابع کمکی =====

  getPriorityColor(priority) {
    const colors = {
      critical: "#dc2626",
      high: "#ef4444",
      medium: "#f59e0b",
      low: "#6c757d",
    };
    return colors[priority] || "#6c757d";
  }

  getPriorityText(priority) {
    const texts = {
      critical: "بحرانی",
      high: "بالا",
      medium: "متوسط",
      low: "پایین",
    };
    return texts[priority] || "متوسط";
  }

  // ===== ابزارهای لودینگ مودال وضعیت پیامک =====
  showSmsLoader(text = "در حال بارگذاری...") {
    if (typeof Swal === "undefined") return false;
    try {
      if (Swal.isVisible && Swal.isVisible()) return false;
      Swal.fire({
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

  closeSmsLoader() {
    if (typeof Swal === "undefined") return;
    try {
      if (Swal.isVisible && Swal.isVisible()) Swal.close();
    } catch (e) {
      // ignore
    }
  }

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
  }

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
  }


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
                };">${this.getSmsStatusInfo(r.status || "pending").text}</span>
              </td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; font-size:11px; color:#475569;">${getSenderName(r.sender)}</td>
            </tr>
          `,
          )
          .join("");

        const deliveredCount = records.filter(
          (r) => r.status === "delivered" || r.delivery_state === 1,
        ).length;
        const failedCount = records.filter(
          (r) => r.status === "failed" || r.delivery_state === 6,
        ).length;
        const pendingCount = records.filter(
          (r) => r.status === "pending" || !r.status || !r.delivery_state,
        ).length;

        Swal.fire({
          icon: "info",
          title: "📱 بروزرسانی وضعیت پیامک‌ها",
          html: `
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
          `,
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
  }

  // ===== متدهای بوکمارک =====

  /**
   * نمایش مودال ایجاد/ویرایش بوکمارک
   */
  async showCreateBookmarkModal(bookmarkId = null) {
    try {
      // دریافت لیست مشتریان برای انتخاب
      let customers = [];
      try {
        const customersRes = await apiService.get(
          "/customers?limit=100&page=1",
        );
        if (customersRes.success) {
          customers = customersRes.data.customers || customersRes.data || [];
        }
      } catch (e) {
        console.log("Could not load customers:", e);
      }

      const bookmark = bookmarkId
        ? this.bookmarks.find((b) => b.id === bookmarkId) || {}
        : {};

      const customerOptions = customers
        .map(
          (c) =>
            `<option value="${c.id}" ${bookmark.customer_id == c.id ? "selected" : ""}>${c.full_name || c.company_name || "-"}</option>`,
        )
        .join("");

      const currentPriority = bookmark.priority || "medium";

      if (typeof Swal !== "undefined") {
        Swal.fire({
          // عنوان در هدر گرافیکی قرار دارد؛ تایتل SweetAlert خالی می‌ماند تا تکراری نباشد
          title: "",
          html: `
            <div style="text-align: right; font-family: 'Vazir', 'Vazirmatn', sans-serif; direction: rtl;">
              <!-- ===== هدر گرافیکی ===== -->
              <div style="display:flex; align-items:center; gap:12px; background:linear-gradient(135deg,#2c7a6e 0%,#035552 100%); border-radius:14px; padding:12px 16px; margin-bottom:16px; color:#fff; position:relative; overflow:hidden;">
                <div style="position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(135deg,#2c7a6e,#4a9e8f,#f59e0b); background-size:200% 200%; animation: bmShimmer 3s ease-in-out infinite;"></div>
                <div style="width:42px; height:42px; border-radius:12px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;">
                  <i class="fas fa-bookmark"></i>
                </div>
                <div>
                  <div style="font-size:15px; font-weight:800; line-height:1.3;">${bookmarkId ? "✏️ ویرایش بوکمارک" : "📌 بوکمارک جدید"}</div>
                  <div style="font-size:11px; opacity:0.85; margin-top:1px;">${bookmarkId ? "بروزرسانی اطلاعات بوکمارک" : "ایجاد یک بوکمارک یا یادآوری جدید"}</div>
                </div>
              </div>

              <style>
                @keyframes bmShimmer { 0%,100%{background-position:0% 50%;} 50%{background-position:100% 50%;} }
                .bm-field { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-family:'Vazir','Vazirmatn',sans-serif; font-size:12.5px; transition:all 0.3s ease; background:white; color:#1e293b; margin-top:4px; box-sizing:border-box; }
                .bm-field:focus { outline:none; border-color:#2c7a6e; box-shadow:0 0 0 4px rgba(44,122,110,0.08); }
                .bm-label { display:block; font-size:12px; font-weight:600; color:#1e293b; }
                .bm-label .bm-req { color:#dc2626; }
                .bm-label .bm-hint { font-weight:400; font-size:10px; color:#94a3b8; }
                .bm-fg { margin-bottom:10px; animation:bmFieldIn 0.4s ease forwards; opacity:0; transform:translateY(8px); }
                .bm-fg:nth-child(1){animation-delay:0.04s;} .bm-fg:nth-child(2){animation-delay:0.08s;}
                .bm-fg:nth-child(3){animation-delay:0.12s;} .bm-fg:nth-child(4){animation-delay:0.16s;}
                .bm-fg:nth-child(5){animation-delay:0.20s;} .bm-fg:nth-child(6){animation-delay:0.24s;}
                @keyframes bmFieldIn { to { opacity:1; transform:translateY(0); } }
                .bm-col-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
                select.bm-field { background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:left 12px center; padding-left:36px; appearance:none; -webkit-appearance:none; }
                .bm-priority-group { display:flex; gap:6px; margin-top:4px; }
                .bm-priority-option { flex:1; min-width:0; padding:6px 3px; border:2px solid #e2e8f0; border-radius:8px; text-align:center; cursor:pointer; transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1); font-size:10.5px; font-weight:600; background:white; color:#64748b; display:flex; flex-direction:column; align-items:center; gap:1px; }
                .bm-priority-option i { font-size:12px; }
                .bm-priority-option .pl { font-size:8.5px; font-weight:400; color:#94a3b8; }
                .bm-priority-option:hover { transform:translateY(-2px); box-shadow:0 2px 12px rgba(0,0,0,0.06); }
                .bm-priority-option[data-value="critical"]{border-color:#fca5a5; color:#dc2626;}
                .bm-priority-option[data-value="high"]{border-color:#fcd34d; color:#b45309;}
                .bm-priority-option[data-value="medium"]{border-color:#93c5fd; color:#3b82f6;}
                .bm-priority-option[data-value="low"]{border-color:#cbd5e1; color:#64748b;}
                .bm-priority-option.active{box-shadow:0 2px 8px rgba(0,0,0,0.08);}
                .bm-priority-option[data-value="critical"].active{background:#fee2e2; border-color:#dc2626;}
                .bm-priority-option[data-value="high"].active{background:#fef3c7; border-color:#f59e0b;}
                .bm-priority-option[data-value="medium"].active{background:#dbeafe; border-color:#3b82f6;}
                .bm-priority-option[data-value="low"].active{background:#e2e8f0; border-color:#64748b;}
                textarea.bm-field { resize:vertical; min-height:55px; }
              </style>

              <!-- عنوان (تمام عرض) -->
              <div class="bm-fg">
                <label class="bm-label">عنوان <span class="bm-req">*</span> <span class="bm-hint">(مشخص و کوتاه)</span></label>
                <input id="bookmarkTitle" class="bm-field" value="${bookmark.title || ""}" placeholder="مثال: پیگیری هفتگی گله">
              </div>

              <!-- نوع + مشتری (۲ ستونه) -->
              <div class="bm-col-2">
                <div class="bm-fg">
                  <label class="bm-label">نوع</label>
                  <select id="bookmarkType" class="bm-field">
                    <option value="bookmark" ${bookmark.type === "bookmark" ? "selected" : ""}>📌 بوکمارک</option>
                    <option value="reminder" ${bookmark.type === "reminder" ? "selected" : ""}>🔔 یادآوری</option>
                  </select>
                </div>

                <div class="bm-fg">
                  <label class="bm-label">مشتری</label>
                  <select id="bookmarkCustomer" class="bm-field">
                    <option value="">بدون مشتری (شخصی)</option>
                    ${customerOptions}
                  </select>
                </div>
              </div>

              <!-- اولویت (تمام عرض) -->
              <div class="bm-fg">
                <label class="bm-label">اولویت</label>
                <div class="bm-priority-group" id="bookmarkPriorityGroup">
                  <div class="bm-priority-option ${currentPriority === "critical" ? "active" : ""}" data-value="critical">
                    <i class="fas fa-circle" style="color:#dc2626;"></i>
                    بحرانی <span class="pl">فوری</span>
                  </div>
                  <div class="bm-priority-option ${currentPriority === "high" ? "active" : ""}" data-value="high">
                    <i class="fas fa-circle" style="color:#f59e0b;"></i>
                    بالا <span class="pl">مهم</span>
                  </div>
                  <div class="bm-priority-option ${currentPriority === "medium" ? "active" : ""}" data-value="medium">
                    <i class="fas fa-circle" style="color:#3b82f6;"></i>
                    متوسط <span class="pl">معمولی</span>
                  </div>
                  <div class="bm-priority-option ${currentPriority === "low" ? "active" : ""}" data-value="low">
                    <i class="fas fa-circle" style="color:#94a3b8;"></i>
                    پایین <span class="pl">کم</span>
                  </div>
                </div>
                <input type="hidden" id="bookmarkPriority" value="${currentPriority}">
              </div>

              <!-- تاریخ + توضیحات (۲ ستونه) -->
              <div class="bm-col-2">
                <div class="bm-fg">
                  <label class="bm-label">تاریخ سررسید <span class="bm-hint">(اختیاری - شمسی)</span></label>
                  <input type="text" id="bookmarkDueDate" class="bm-field" placeholder="۱۴۰۴/۰۱/۰۱" value="${bookmark.due_date ? convertToPersianDate(bookmark.due_date) : ""}">
                </div>

                <div class="bm-fg">
                  <label class="bm-label">توضیحات</label>
                  <textarea id="bookmarkDescription" class="bm-field" rows="2" placeholder="توضیحات تکمیلی...">${bookmark.description || ""}</textarea>
                </div>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: bookmarkId
            ? "💾 ذخیره تغییرات"
            : "✅ ایجاد بوکمارک",
          cancelButtonText: "❌ انصراف",
          confirmButtonColor: "#2c7a6e",
          cancelButtonColor: "#64748b",
          reverseButtons: true,
          width: 620,
          padding: "20px 24px",
          background: "#ffffff",
          customClass: {
            container: "bm-swal-container",
            popup: "bm-swal-popup",
          },
          didOpen: () => {
            // انتخاب اولویت
            const priorityGroup = document.getElementById(
              "bookmarkPriorityGroup",
            );
            const priorityInput = document.getElementById("bookmarkPriority");
            if (priorityGroup) {
              priorityGroup
                .querySelectorAll(".bm-priority-option")
                .forEach((option) => {
                  option.addEventListener("click", function () {
                    priorityGroup
                      .querySelectorAll(".bm-priority-option")
                      .forEach((o) => o.classList.remove("active"));
                    this.classList.add("active");
                    priorityInput.value = this.dataset.value;
                  });
                });
            }

            // تقویم شمسی (Jalali) برای تاریخ سررسید
            const dueDateInput = document.getElementById("bookmarkDueDate");
            if (
              dueDateInput &&
              !dueDateInput.hasAttribute("data-datepicker-initialized")
            ) {
              try {
                if (typeof $.fn.persianDatepicker !== "undefined") {
                  $(dueDateInput).persianDatepicker({
                    format: "YYYY/MM/DD",
                    autoClose: true,
                    initialValue: false,
                    observer: true,
                    calendar: {
                      persian: {
                        locale: "fa",
                      },
                    },
                    onSelect: function () {
                      const selected = $(this).val();
                      if (selected) {
                        dueDateInput.dataset.selectedDate = selected;
                        dueDateInput.value = selected;
                      }
                    },
                  });
                }
              } catch (e) {
                console.warn("⚠️ Error initializing datepicker:", e);
              }
              dueDateInput.setAttribute("data-datepicker-initialized", "true");
            }
          },
          preConfirm: () => {
            const title = document
              .getElementById("bookmarkTitle")
              ?.value?.trim();
            const customerId =
              document.getElementById("bookmarkCustomer")?.value;
            if (!title) {
              Swal.showValidationMessage("لطفاً عنوان بوکمارک را وارد کنید");
              return false;
            }
            if (!customerId) {
              Swal.showValidationMessage("لطفاً یک مشتری را انتخاب کنید");
              return false;
            }
            // تبدیل تاریخ شمسی انتخاب‌شده به میلادی برای ذخیره در دیتابیس
            const dueDateValue =
              document.getElementById("bookmarkDueDate")?.value?.trim() || "";
            const dueDateGregorian = dueDateValue
              ? convertPersianToGregorian(dueDateValue)
              : null;
            return {
              title: title,
              type:
                document.getElementById("bookmarkType")?.value || "bookmark",
              customer_id: customerId,
              priority:
                document.getElementById("bookmarkPriority")?.value || "medium",
              due_date: dueDateGregorian,
              description:
                document.getElementById("bookmarkDescription")?.value || "",
            };
          },
        }).then(async (result) => {
          if (result.isConfirmed && result.value) {
            const data = result.value;
            try {
              let response;
              if (bookmarkId) {
                // fallback به API عمومی
                response = await apiService.put(
                  `/bookmarks/${bookmarkId}`,
                  data,
                );
              } else {
                response = await apiService.post("/bookmarks", data);
              }
              if (response.success) {
                Swal.fire({
                  icon: "success",
                  title: bookmarkId
                    ? "✅ بوکمارک بروزرسانی شد"
                    : "✅ بوکمارک ایجاد شد",
                  confirmButtonText: "باشه",
                  confirmButtonColor: "#2c7a6e",
                });
                await this.loadBookmarks();
                this.renderBookmarks();
              } else {
                notificationService.error(
                  response.message || "خطا در ذخیره بوکمارک",
                );
              }
            } catch (e) {
              console.error("❌ Error saving bookmark:", e);
              notificationService.error("خطا در ارتباط با سرور");
            }
          }
        });
      } else {
        notificationService.error("SweetAlert2 در دسترس نیست");
      }
    } catch (error) {
      console.error("❌ Error showing bookmark modal:", error);
      notificationService.error("خطا در نمایش فرم");
    }
  }

  /**
   * حذف بوکمارک
   */
  async deleteBookmark(id) {
    try {
      const confirmed = await notificationService.confirm({
        title: "🗑️ حذف بوکمارک",
        text: "آیا از حذف این بوکمارک اطمینان دارید؟",
        confirmText: "بله، حذف شود",
        cancelText: "انصراف",
      });
      if (!confirmed) return;

      const response = await apiService.delete(`/bookmarks/${id}`);

      if (response.success) {
        notificationService.success("✅ بوکمارک حذف شد");
        await this.loadBookmarks();
        this.renderBookmarks();
      } else {
        notificationService.error(response.message || "خطا در حذف بوکمارک");
      }
    } catch (error) {
      console.error("❌ Error deleting bookmark:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  /**
   * نمایش جزئیات بوکمارک (طراحی مدرن)
   */
  async showBookmarkDetail(id) {
    try {
      const bookmark = this.bookmarks.find((b) => b.id === id);
      if (!bookmark) {
        notificationService.error("بوکمارک یافت نشد");
        return;
      }

      if (typeof Swal !== "undefined") {
        const isReminder = bookmark.type === "reminder";
        const typeText = isReminder ? "یادآوری" : "بوکمارک";
        const typeIcon = isReminder ? "fa-bell" : "fa-bookmark";

        // استایل اولویت بر اساس رنگ‌ها
        const priorityStyles = {
          critical: {
            gradient: "#dc2626,#ef4444",
            shadow: "rgba(220,38,38,0.3)",
            bg: "#fee2e2",
            color: "#dc2626",
          },
          high: {
            gradient: "#f59e0b,#fbbf24",
            shadow: "rgba(245,158,11,0.3)",
            bg: "#fef3c7",
            color: "#b45309",
          },
          medium: {
            gradient: "#3b82f6,#60a5fa",
            shadow: "rgba(59,130,246,0.3)",
            bg: "#dbeafe",
            color: "#3b82f6",
          },
          low: {
            gradient: "#94a3b8,#cbd5e1",
            shadow: "rgba(148,163,184,0.3)",
            bg: "#e2e8f0",
            color: "#64748b",
          },
        };
        const pr = priorityStyles[bookmark.priority] || priorityStyles.medium;
        const priorityText = this.getPriorityText(bookmark.priority);

        const dueDate = bookmark.due_date
          ? convertToPersianDate(bookmark.due_date)
          : null;
        const isOverdue =
          bookmark.due_date && new Date(bookmark.due_date) < new Date();
        const customerName = bookmark.customer?.full_name || "شخصی";

        Swal.fire({
          title: "",
          html: `
            <div style="text-align:center; font-family:'Vazir','Vazirmatn',sans-serif; direction:rtl;">
              <!-- آیکون مدور -->
              <div style="width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:30px; color:#fff; background:linear-gradient(135deg,${pr.gradient}); box-shadow:0 8px 32px ${pr.shadow}; position:relative;">
                <i class="fas ${typeIcon}"></i>
              </div>

              <!-- عنوان -->
              <div style="font-size:20px; font-weight:800; color:#1e293b; margin-bottom:4px;">${bookmark.title}</div>
              <div style="display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap; margin-bottom:20px;">
                <span style="font-size:11px; padding:2px 12px; border-radius:20px; background:rgba(44,122,110,0.08); color:#2c7a6e; font-weight:600; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fas fa-tag"></i> ${typeText}
                </span>
                <span style="color:#e2e8f0;">|</span>
                <span style="font-size:11px; padding:2px 10px; border-radius:20px; background:#f8fafc; color:#64748b; display:inline-flex; align-items:center; gap:4px;">
                  <i class="fas fa-hashtag"></i> #${bookmark.id}
                </span>
                ${
                  dueDate
                    ? `<span style="color:#e2e8f0;">|</span>
                       <span style="font-size:11px; color:#94a3b8;"><i class="fas fa-clock"></i> ${dueDate}</span>`
                    : ""
                }
              </div>

              <!-- اطلاعات -->
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; text-align:right;">
                <div style="background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
                  <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <i class="fas fa-user" style="color:#2c7a6e;"></i> مشتری
                  </div>
                  <div style="font-size:15px; font-weight:600; color:#2c7a6e; padding-right:4px;">${customerName}</div>
                </div>
                <div style="background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
                  <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <i class="fas fa-flag" style="color:#2c7a6e;"></i> اولویت
                  </div>
                  <div style="font-size:15px; font-weight:600; padding-right:4px;">
                    <span style="font-size:12px; padding:2px 14px; border-radius:20px; font-weight:700; background:${pr.bg}; color:${pr.color}; display:inline-flex; align-items:center; gap:6px;">
                      <i class="fas fa-circle" style="font-size:8px;"></i> ${priorityText}
                    </span>
                  </div>
                </div>
                ${
                  dueDate
                    ? `<div style="grid-column:1/-1; background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
                        <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                          <i class="fas fa-calendar-alt" style="color:#2c7a6e;"></i> تاریخ سررسید
                        </div>
                        <div style="font-size:15px; font-weight:600; padding-right:4px; color:${isOverdue ? "#dc2626" : "#1e293b"}; display:flex; align-items:center; gap:6px;">
                          <i class="fas ${isOverdue ? "fa-exclamation-circle" : "fa-calendar-check"}"></i> ${dueDate}
                          ${
                            isOverdue
                              ? '<span style="font-size:11px; font-weight:400; color:#dc2626; background:#fee2e2; padding:0 8px; border-radius:12px;">تأخیر</span>'
                              : ""
                          }
                        </div>
                      </div>`
                    : ""
                }
              </div>

              <!-- توضیحات -->
              <div style="background:linear-gradient(135deg,#fafbfc,#f8fafc); border-radius:14px; padding:14px 18px; border:1px solid #f1f5f9; text-align:right;">
                <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                  <i class="fas fa-align-left" style="color:#2c7a6e;"></i> توضیحات
                </div>
                <div style="font-size:14px; color:#1e293b; line-height:1.7; padding-right:4px; word-wrap:break-word; text-align:right;">${
                  bookmark.description || "—"
                }</div>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: "✏️ ویرایش",
          cancelButtonText: "🗑️ حذف",
          confirmButtonColor: "#2c7a6e",
          cancelButtonColor: "#dc2626",
          reverseButtons: true,
          width: 520,
          padding: "24px 28px",
          didOpen: () => {
            document
              .querySelector(".swal2-popup")
              ?.style?.setProperty("border-radius", "24px");
          },
        }).then((result) => {
          if (result.isConfirmed) {
            this.showCreateBookmarkModal(id);
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            this.deleteBookmark(id);
          }
        });
      }
    } catch (error) {
      console.error("❌ Error showing bookmark:", error);
    }
  }

  /**
   * نمایش جزئیات کامل مشتری در مودال
   * پاسخ بک‌اند: { customer, flocks: [], periods: [], halls: [], weeklyHistory: [] }
   */
  async showCustomerDetail(customerId, flockId = null) {
    try {
      const response = await dashboardApi.getCustomerFullDetails(
        customerId,
        flockId,
      );
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات مشتری");
        return;
      }
      const data = response.data || {};
      const customer = data.customer || {};
      const flocks = data.flocks || [];
      const periods = data.periods || [];
      const halls = data.halls || [];
      let weeklyHistory = data.weeklyHistory || data.weeks || [];

      // ✅ اگر history خالی بود، مستقیم از API هفتگی بگیر
      if ((!weeklyHistory || weeklyHistory.length === 0) && flockId) {
        try {
          const weeklyRes = await apiService.get("/weekly", {
            chick_placement_id: flockId,
          });
          if (weeklyRes.success) {
            weeklyHistory = weeklyRes.data?.records || weeklyRes.data || [];
          }
        } catch (e) {
          try {
            const weeklyRes2 = await apiService.get(
              `/weekly?flock_id=${flockId}`,
            );
            if (weeklyRes2.success) {
              weeklyHistory = weeklyRes2.data?.records || weeklyRes2.data || [];
            }
          } catch (e2) {
            console.warn("⚠️ Could not load weekly history fallback:", e2);
          }
        }
      }

      document.getElementById("modalCustomerName").textContent =
        customer.full_name || customer.name || "اطلاعات مشتری";

      const body = document.getElementById("modalBody");
      if (body) {
        // ============ ۱. اطلاعات مشتری ============
        const customerHTML = `
          <div class="detail-section">
            <h4 style="color:#2c7a6e; font-size:13px; margin-bottom:8px; border-bottom:2px solid #e8f5f0; padding-bottom:5px;">👤 اطلاعات مشتری</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; font-size:12px;">
              <div><span style="color:#94a3b8;">نام:</span> <strong>${customer.full_name || customer.name || "-"}</strong></div>
              <div><span style="color:#94a3b8;">فارم:</span> <strong>${customer.farmName || customer.farm_name || "-"}</strong></div>
              <div><span style="color:#94a3b8;">تلفن:</span> <strong>${customer.phone || customer.mobile_number || "-"}</strong></div>
              <div><span style="color:#94a3b8;">شهر:</span> <strong>${customer.city || customer.county || "-"}</strong></div>
              <div><span style="color:#94a3b8;">استان:</span> <strong>${customer.province || "-"}</strong></div>
              <div><span style="color:#94a3b8;">آدرس:</span> <strong>${customer.address || customer.farm_address || "-"}</strong></div>
            </div>
          </div>
        `;

        // ============ ۱.۵ رصد شاخص‌های گله ============
        const selectedFlock =
          flocks.find((f) => String(f.id) === String(flockId)) ||
          flocks[0] ||
          {};
        const totalChicks = parseFloat(selectedFlock.totalChicks || 0);
        const totalMortality = weeklyHistory.reduce(
          (sum, w) =>
            sum + (parseFloat(w.mortality ?? w.weekly_mortality) || 0),
          0,
        );
        const currentChicks = totalChicks - totalMortality;
        const sumWeeklyFeed = weeklyHistory.reduce(
          (sum, w) =>
            sum + (parseFloat(w.feedIntake ?? w.weekly_feed_intake) || 0),
          0,
        );
        // آخرین وزن ثبت‌شده گله
        const lastWeightValue = weeklyHistory.reduce((last, w) => {
          const weightVal = parseFloat(w.weight ?? w.weekly_weight) || 0;
          return weightVal > 0 ? weightVal : last;
        }, 0);
        // FCR کل گله = مجموع خوراک مصرفی ÷ آخرین وزن
        const chickenFcr =
          lastWeightValue > 0
            ? (sumWeeklyFeed / lastWeightValue).toFixed(2)
            : "-";

        const indicatorsHTML = `
          <div class="detail-section" style="margin-top:12px; border-right:4px solid #f59e0b; background:linear-gradient(135deg,#fffbeb 0%, #fef3c7 100%);">
            <h4 style="color:#d97706; font-size:13px; margin-bottom:8px; border-bottom:2px solid #fde68a; padding-bottom:5px;">📈 رصد شاخص‌های گله ${selectedFlock.flockNumber ? `#${selectedFlock.flockNumber}` : ""}</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px 16px; font-size:12px;">
              <div style="background:#fff; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; text-align:center;">
                <div style="color:#94a3b8; font-size:10px; margin-bottom:4px;">🐔 ضریب تبدیل گله (FCR)</div>
                <div style="font-size:20px; font-weight:700; color:#d97706;">${chickenFcr}</div>
              </div>
              <div style="background:#fff; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; text-align:center;">
                <div style="color:#94a3b8; font-size:10px; margin-bottom:4px;">🐣 مقدار جوجه فعلی گله</div>
                <div style="font-size:20px; font-weight:700; color:#16a34a;">${currentChicks.toLocaleString()} <span style="font-size:10px; color:#94a3b8;">قطعه</span></div>
              </div>
              <div style="background:#fff; border:1px solid #fde68a; border-radius:8px; padding:10px 14px; text-align:center;">
                <div style="color:#94a3b8; font-size:10px; margin-bottom:4px;">📊 تلفات کل</div>
                <div style="font-size:20px; font-weight:700; color:#dc2626;">${totalMortality.toLocaleString()} <span style="font-size:10px; color:#94a3b8;">قطعه</span></div>
              </div>
            </div>
          </div>
        `;

        // ============ ۲. گله‌های مشتری ============
        let flocksHTML = "";
        if (flocks.length > 0) {
          const flockRows = flocks
            .map(
              (f) => `
              <tr style="${f.id == flockId ? "background:#f0fdf4; font-weight:600;" : ""}">
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${f.id}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;"><strong>${f.flockNumber || "-"}</strong></td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${f.hallName || "-"}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${f.placementDate ? convertToPersianDate(f.placementDate) : "-"}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${f.weekNumber || "-"}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${f.flockAge || "-"} روز</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${(f.totalChicks || 0).toLocaleString()} قطعه</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${f.breed || "-"}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                  <span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; background:${f.isActive ? "#dcfce7" : "#fee2e2"}; color:${f.isActive ? "#16a34a" : "#dc2626"};">${f.isActive ? "فعال" : "غیرفعال"}</span>
                </td>
              </tr>
            `,
            )
            .join("");

          flocksHTML = `
            <div class="detail-section" style="margin-top:12px;">
              <h4 style="color:#2c7a6e; font-size:13px; margin-bottom:8px; border-bottom:2px solid #e8f5f0; padding-bottom:5px;">🐣 گله‌های مشتری (${flocks.length})</h4>
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                  <thead>
                    <tr style="background:#f8fafc;">
                      <th style="padding:6px 8px;">ID</th>
                      <th style="padding:6px 8px;">گله</th>
                      <th style="padding:6px 8px;">سالن</th>
                      <th style="padding:6px 8px;">جوجه‌ریزی</th>
                      <th style="padding:6px 8px;">هفته</th>
                      <th style="padding:6px 8px;">سن</th>
                      <th style="padding:6px 8px;">تعداد</th>
                      <th style="padding:6px 8px;">نژاد</th>
                      <th style="padding:6px 8px;">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody>${flockRows}</tbody>
                </table>
              </div>
            </div>
          `;
        }

        // ============ ۳. دوره‌های مشتری ============
        let periodsHTML = "";
        if (periods.length > 0) {
          // جداسازی دوره‌های فعال و قبلی
          const activeStatuses = [
            "active",
            "در حال انجام",
            "pending",
            "در انتظار جوجه",
            "شروع نشده",
          ];
          const activePeriods = periods.filter(
            (p) =>
              activeStatuses.includes(p.status) ||
              activeStatuses.includes(p.statusText),
          );
          const oldPeriods = periods.filter((p) => !activePeriods.includes(p));

          const periodRow = (p) => `
              <tr>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${p.periodNumber || p.id || "-"}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;"><strong>${p.name || p.period_name || "-"}</strong></td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${p.startDate ? convertToPersianDate(p.startDate) : "-"}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${p.endDate ? convertToPersianDate(p.endDate) : "در حال انجام"}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">
                  <span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:10px; background:${p.statusBg || "#f1f5f9"}; color:${p.statusColor || "#475569"};">${p.statusText || p.status || "-"}</span>
                </td>
              </tr>
            `;

          const activeRows = activePeriods.map(periodRow).join("");
          const oldRows = oldPeriods.map(periodRow).join("");

          periodsHTML = `
            ${
              activeRows
                ? `<div class="detail-section" style="margin-top:12px; border-right:3px solid #16a34a;">
                    <h4 style="color:#16a34a; font-size:13px; margin-bottom:8px; border-bottom:2px solid #dcfce7; padding-bottom:5px;">📅 دوره‌های فعال (${activePeriods.length})</h4>
                    <div style="overflow-x:auto;">
                      <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                          <tr style="background:#f8fafc;">
                            <th style="padding:6px 8px;">شماره</th>
                            <th style="padding:6px 8px;">نام دوره</th>
                            <th style="padding:6px 8px;">شروع</th>
                            <th style="padding:6px 8px;">پایان</th>
                            <th style="padding:6px 8px;">وضعیت</th>
                          </tr>
                        </thead>
                        <tbody>${activeRows}</tbody>
                      </table>
                    </div>
                  </div>`
                : ""
            }
            ${
              oldRows
                ? `<details class="detail-section" style="margin-top:12px;">
                    <summary style="cursor:pointer; color:#64748b; font-size:12px; font-weight:600; padding:8px 12px; background:#f8fafc; border-radius:6px; list-style:none; display:flex; align-items:center; gap:8px;">
                      <i class="fas fa-chevron-down" style="font-size:10px;"></i> 📋 دوره‌های قبلی (${oldPeriods.length})
                    </summary>
                    <div style="overflow-x:auto; margin-top:8px;">
                      <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <thead>
                          <tr style="background:#f8fafc;">
                            <th style="padding:6px 8px;">شماره</th>
                            <th style="padding:6px 8px;">نام دوره</th>
                            <th style="padding:6px 8px;">شروع</th>
                            <th style="padding:6px 8px;">پایان</th>
                            <th style="padding:6px 8px;">وضعیت</th>
                          </tr>
                        </thead>
                        <tbody>${oldRows}</tbody>
                      </table>
                    </div>
                  </details>`
                : ""
            }
          `;
        }

        // ============ ۴. سالن‌های مشتری ============
        let hallsHTML = "";
        if (halls.length > 0) {
          const hallRows = halls
            .map(
              (h) => `
              <tr>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${h.id}</td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;"><strong>${h.name || h.hall_name || "-"}</strong></td>
                <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${(h.capacity || h.nominal_capacity || 0).toLocaleString()} قطعه</td>
              </tr>
            `,
            )
            .join("");

          hallsHTML = `
            <div class="detail-section" style="margin-top:12px;">
              <h4 style="color:#2c7a6e; font-size:13px; margin-bottom:8px; border-bottom:2px solid #e8f5f0; padding-bottom:5px;">🏭 سالن‌های مشتری (${halls.length})</h4>
              <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                  <thead>
                    <tr style="background:#f8fafc;">
                      <th style="padding:6px 8px;">ID</th>
                      <th style="padding:6px 8px;">نام سالن</th>
                      <th style="padding:6px 8px;">ظرفیت</th>
                    </tr>
                  </thead>
                  <tbody>${hallRows}</tbody>
                </table>
              </div>
            </div>
          `;
        }

        // ============ ۵. تاریخچه هفتگی گله - اکوردیون (بعد از گله‌ها قرار می‌گیرد) ============
        let weeksHTML = "";
        if (weeklyHistory && weeklyHistory.length > 0) {
          const rows = weeklyHistory
            .map((w, i) => {
              // دریافت فیلدهای هفته با fallback بین دو shape بک‌اند
              const weekNum = w.weekNumber ?? w.week_number ?? i + 1;
              const startDate = w.startDate ?? w.week_start_date;
              const endDate = w.endDate ?? w.week_end_date;
              const dailyFeed = w.dailyFeedIntake ?? w.daily_feed_intake ?? "-";
              const feed = w.feedIntake ?? w.weekly_feed_intake ?? "-";
              const weight = w.weight ?? w.weekly_weight ?? "-";
              const mortality = w.mortality ?? w.weekly_mortality ?? "-";
              const blackout = w.blackoutHours ?? w.blackout_hours ?? "-";
              const notes = w.additionalNotes ?? w.additional_notes ?? "-";
              const expertName =
                w.expertName ??
                (w.service_expert
                  ? `${w.service_expert.first_name || ""} ${w.service_expert.last_name || ""}`.trim()
                  : "-") ??
                "-";

              // فرمت پیشنهادات (پشتیبانی از آرایه رشته‌ای، آرایه اشیا با name/title، یا رشته)
              const formatSuggestionList = (val) => {
                if (!val) return "-";
                if (Array.isArray(val)) {
                  const names = val.map((item) => {
                    if (typeof item === "object" && item !== null) {
                      return (
                        item.name ||
                        item.title ||
                        item.suggestion_name ||
                        item.suggestionName ||
                        ""
                      );
                    }
                    return item;
                  });
                  return names.filter(Boolean).join("، ") || "-";
                }
                return val || "-";
              };

              // محاسبه ضریب تبدیل تجمعی هفته (FCR = مجموع خوراک تا این هفته ÷ وزن این هفته)
              const cumulativeFeed = weeklyHistory
                .slice(0, i + 1)
                .reduce(
                  (sum, wk) =>
                    sum +
                    (parseFloat(wk.feedIntake ?? wk.weekly_feed_intake) || 0),
                  0,
                );
              const weightVal = parseFloat(weight) || 0;
              const fcr =
                weightVal > 0 ? (cumulativeFeed / weightVal).toFixed(2) : "-";

              return `
                  <tr>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${i + 1}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;"><strong>هفته ${weekNum}</strong></td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${startDate ? convertToPersianDate(startDate) : "-"}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${endDate ? convertToPersianDate(endDate) : "-"}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${dailyFeed}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${feed}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${weight}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${mortality}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${blackout}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center; font-weight:600; color:#d97706;">${fcr}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center;">${expertName}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:right; max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${notes}">${notes}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${w.diseases || ""}">${w.diseases || "-"}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${w.vaccines || ""}">${w.vaccines || "-"}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${w.medicines || ""}">${w.medicines || "-"}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${w.feedTypes || ""}">${w.feedTypes || "-"}</td>
                    <td style="padding:6px 8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${formatSuggestionList(w.suggestions)}">${formatSuggestionList(w.suggestions)}</td>
                  </tr>
                `;
            })
            .join("");

          // ✅ اکوردیون کولیپس با ستون‌های کامل
          weeksHTML = `
            <details class="detail-section" style="margin-top:12px; border:1px solid #e8f5f0; border-radius:10px; padding:0; overflow:hidden;">
              <summary style="cursor:pointer; color:#2c7a6e; font-size:13px; font-weight:700; padding:10px 14px; background:#f8fafc; list-style:none; display:flex; align-items:center; gap:10px; user-select:none;">
                <i class="fas fa-chevron-down" style="font-size:11px; transition: transform 0.2s;"></i>
                📊 هفته‌های قبلی گله (${weeklyHistory.length} هفته)
                <span style="margin-right:auto; font-size:11px; color:#94a3b8;">برای مشاهده کلیک کنید</span>
              </summary>
              <div style="overflow-x:auto; padding:10px 14px;">
                <table style="width:100%; border-collapse:collapse; font-size:11px;">
                  <thead>
                    <tr style="background:#f8fafc;">
                      <th style="padding:6px 8px;">#</th>
                      <th style="padding:6px 8px;">هفته</th>
                      <th style="padding:6px 8px;">شروع</th>
                      <th style="padding:6px 8px;">پایان</th>
                      <th style="padding:6px 8px;">خوراک روزانه</th>
                      <th style="padding:6px 8px;">خوراک هفتگی</th>
                      <th style="padding:6px 8px;">وزن</th>
                      <th style="padding:6px 8px;">تلفات</th>
                      <th style="padding:6px 8px;">خاموشی</th>
                      <th style="padding:6px 8px; color:#d97706;">ضریب تبدیل</th>
                      <th style="padding:6px 8px;">کارشناس خدمات</th>
                      <th style="padding:6px 8px; text-align:right;">توضیحات</th>
                      <th style="padding:6px 8px;">بیماری‌ها</th>
                      <th style="padding:6px 8px;">واکسن‌ها</th>
                      <th style="padding:6px 8px;">داروها</th>
                      <th style="padding:6px 8px;">نوع خوراک</th>
                      <th style="padding:6px 8px;">پیشنهادات</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>
              </div>
            </details>
          `;
        }

        body.innerHTML = `
          <div style="direction:rtl; text-align:right; font-family:'Vazir'; padding:5px;">
            ${customerHTML}
            ${indicatorsHTML}
            ${flocksHTML}
            ${weeksHTML}
            ${periodsHTML}
            ${hallsHTML}
          </div>
        `;
      }
      document.getElementById("customerDetailModal")?.classList.add("active");
      document.body.style.overflow = "hidden";
    } catch (error) {
      console.error("❌ Error showing customer detail:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  /**
   * رفتن به پروفایل مشتری
   */
  goToCustomerProfile(customerId) {
    window.location.href = `/customer-info?id=${customerId}`;
  }
}

export const dashboardService = new DashboardService();

// ===== قرار دادن در window =====
if (typeof window !== "undefined") {
  window.dashboardService = dashboardService;
  window.DashboardService = DashboardService;
  window.showCreateBookmarkModal = (bookmarkId = null) =>
    dashboardService.showCreateBookmarkModal(bookmarkId);
  window.deleteBookmarkAction = (id) => dashboardService.deleteBookmark(id);
  window.showBookmarkDetail = (id) => dashboardService.showBookmarkDetail(id);
  window.showCustomerDetail = (customerId, flockId) =>
    dashboardService.showCustomerDetail(customerId, flockId);
  window.goToCustomerProfile = (customerId) =>
    dashboardService.goToCustomerProfile(customerId);
  window.sendFlockCardSms = (flockId, hallId = null) =>
    dashboardService.sendFlockCardSms(flockId, hallId);
  window.selectFlockGroupForChart = (
    customerId,
    flockGroupId,
    customerName,
    flockNumber,
    weekNumber,
  ) =>
    dashboardService.selectFlockGroupForChart(
      customerId,
      flockGroupId,
      customerName,
      flockNumber,
      weekNumber,
    );
  window.selectFlockForChart = (
    customerId,
    flockId,
    customerName,
    flockNumber,
    weekNumber,
    hallName = null,
    flockGroupId = null,
  ) =>
    dashboardService.selectFlockForChart(
      customerId,
      flockId,
      customerName,
      flockNumber,
      weekNumber,
      hallName,
      flockGroupId,
    );
  window.sendSmsToCustomer = (
    customerId,
    customerName,
    flockId,
    weekNumber,
    flockNumber,
    cardElement,
  ) =>
    dashboardService.sendSmsToCustomer(
      customerId,
      customerName,
      flockId,
      weekNumber,
      flockNumber,
      cardElement,
    );
  window.removeTaskCard = (element, customerId, flockId) =>
    dashboardService.removeTaskCard(element, customerId, flockId);
  window.showSmsHistory = (customerId, flockId = null, flockPeriodId = null) =>
    dashboardService.showSmsHistory(customerId, flockId, flockPeriodId);
  window.refreshSmsStatus = (
    customerId,
    flockId = null,
    flockPeriodId = null,
    openModal = true,
  ) =>
    dashboardService.refreshSmsStatus(
      customerId,
      flockId,
      flockPeriodId,
      openModal,
    );
  window.refreshSmsHistoryFromModal = () =>
    dashboardService.refreshSmsHistoryFromModal();
  window.openChartComparePicker = () => dashboardService.openChartComparePicker();
  window.removeChartCompare = (scope, id) =>
    dashboardService.removeChartCompare(scope, id);
  window.toggleTaskCardHalls = (flockGroupId) => {
    const card = document.querySelector(
      `.task-card[data-flock-group-id="${flockGroupId}"]`,
    );
    if (!card) return;
    const body = card.querySelector(".flock-halls");
    const toggle = card.querySelector(".task-halls-toggle");
    if (!body) return;
    const open = body.classList.toggle("open");
    if (toggle) toggle.classList.toggle("open", open);
    const icon = toggle?.querySelector(".accordion-icon");
    if (icon) icon.style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
  };
  window.toggleAccordion = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const isHidden =
      section.style.display === "none" || section.style.display === "";
    section.style.display = isHidden ? "block" : "none";
    const icon = document.querySelector(
      `[data-section="${sectionId}"] .accordion-icon`,
    );
    if (icon)
      icon.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
  };
}
