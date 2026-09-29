import { dashboardApi } from "./dashboard.api.js";
import { dashboardRenderer } from "./dashboard.renderer.js";
import {
  buildCustomerDetailHTML,
  buildWeeksTableHTML,
} from "./customer-detail.renderer.js";
import { TaskCard } from "../../shared/components/TaskCard/TaskCard.js";

import { apiService } from "../../core/services/api.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { stateService } from "../../core/services/state.service.js";
import { convertToPersianDate } from "../../core/utils/date.utils.js";
import { escapeHtml, escapeJsAttr } from "../../core/utils/string.utils.js";
import { dashboardSmsMethods } from "./dashboard.sms.js";
import { dashboardBookmarkMethods } from "./dashboard.bookmarks.js";
import { registerDashboardWindowGlue } from "./dashboard.window-glue.js";

// ============================================================
// پلاگین داخلی «برچسب اعداد» کارت‌های نمودار گله (مودال جزئیات مشتری)
// ------------------------------------------------------------
// • عدد هر هفته را با ارقام فارسی بالای نقطه‌اش می‌نویسد.
// • اگر برچسب یک نقطه با برچسب قبلی هم‌پوشانی پیدا کند، همان یکی رد می‌شود
//   (نقطه و خط همچنان دیده می‌شوند) ⇒ «همهٔ هفته‌ها» بدون متنِ روی‌هم.
// • متن سفید با سایهٔ ملایم، چون نمودار روی نوار رنگی کارت است.
// ============================================================
const flockChartLabelPlugin = {
  id: "flockChartLabels",
  afterDatasetsDraw(chart) {
    const canvas = chart.canvas;
    if (!canvas || canvas.dataset.cdLabels !== "all") return;

    const area = chart.chartArea;
    const meta = chart.getDatasetMeta(0);
    if (!area || !meta || !meta.data) return;

    const digits = parseInt(canvas.dataset.cdDigits || "0", 10) || 0;
    const values = chart.data?.datasets?.[0]?.data || [];
    const ctx = chart.ctx;

    ctx.save();
    ctx.font = "700 9px Vazir, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(15, 23, 42, 0.5)";
    ctx.shadowBlur = 3;

    let lastRight = -Infinity;

    values.forEach((value, index) => {
      if (value === null || value === undefined) return;

      const element = meta.data[index];
      if (!element || typeof element.x !== "number") return;

      const text = Number(value).toLocaleString("fa-IR", {
        maximumFractionDigits: digits,
      });
      const width = ctx.measureText(text).width;
      const x = Math.min(
        Math.max(element.x, area.left + width / 2),
        area.right - width / 2,
      );
      const y = Math.max(element.y - 4, area.top + 9);

      // گارد هم‌پوشانی: برچسبی که روی برچسب قبلی می‌افتد نوشته نمی‌شود
      if (x - width / 2 <= lastRight + 2) return;
      lastRight = x + width / 2;

      ctx.fillText(text, x, y);
    });

    ctx.restore();
  },
};


class DashboardService {
  constructor() {
    this.flocks = [];
    this.flockCards = [];
    this.bookmarks = [];
    this.summary = null;
    this.selectedFlockId = null;
    this.selectedCustomerId = null;
    // ✅ بافت مودال «جزئیات مشتری» (برای لود تنبل جدول هفتگی)
    this.customerDetailContext = null;
    // ✅ نمونهٔ کارت‌های نمودار مودال جزئیات (برای destroy شدن)
    this.flockCharts = [];
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 0;
    this.isLoading = false;
    this.initialized = false;
    this.showChartValues = false;
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
    this.setupChartLayoutToggle();
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
        ? ` <span class="cs-sep">-</span> ${escapeHtml(info.hallName)}`
        : ""
    } <span class="cs-sep">|</span> ${escapeHtml(info.customerName || "")}`;
  }

  // ===== تولبار چیدمان نمودارها (تمام‌عرض / کنار هم) =====
  setupChartLayoutToggle() {
    const header = document.getElementById("chartSelectionHeader");
    if (!header || header.querySelector(".dashboard-layout-toolbar")) return;

    const makeBtn = (mode, icon, label) => `
      <button type="button" class="db-layout-btn" data-layout="${mode}" aria-pressed="false"
        title="${label}" onclick="window.setDashboardChartLayout('${mode}')">
        <i class="fas ${icon}"></i> ${label}
      </button>`;

    header.insertAdjacentHTML(
      "beforeend",
      `<div class="dashboard-layout-toolbar">${makeBtn(
        "full",
        "fa-align-justify",
        "تمام‌عرض",
      )}${makeBtn("grid", "fa-th-large", "کنار هم")}</div>`,
    );

    window.setDashboardChartLayout = (mode) => {
      const root = document.querySelector(".dashboard-container");
      if (root) {
        root.classList.toggle("db-chart-full", mode === "full");
      }
      header.querySelectorAll(".db-layout-btn").forEach((btn) => {
        const active = btn.dataset.layout === mode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
      });
      try {
        localStorage.setItem("skb_dashboard_chart_layout", mode);
      } catch (e) {
        // ignore
      }
      // نمودارها پس از تغییر عرض، اندازه خود را به‌روز کنند
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
    };

    let saved = "full";
    try {
      saved = localStorage.getItem("skb_dashboard_chart_layout") || "full";
    } catch (e) {
      // ignore
    }
    window.setDashboardChartLayout(saved);
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

    // ساخت تعداد کل هفته‌ها (سقف نمایش: ۱۰ هفته)
    const isOverStandard =
      (parseInt(flock.weekNumber) || 1) > 10 ||
      (parseInt(flock.flockAge) || 0) > 70;
    const rawTotalWeeks =
      flock.totalWeeks || Math.max(flock.weekNumber || 1, 8);
    const totalWeeks = Math.min(rawTotalWeeks, 10);
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
      overStandard: isOverStandard,
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
      onClick: `window.selectFlockForChart(${customer.id}, ${flock.id}, ${escapeJsAttr(customer.name)}, ${flock.flockNumber}, ${flock.weekNumber})`,
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

    // پلاگین داخلی «نمایش مقادیر» (بدون وابستگی به chartjs-plugin-datalabels)
    this._valueLabelPlugin = buildValueLabelPlugin();
    // نمودار وزن‌گیری
    const weightCtx = document
      .getElementById("weightingCanvas")
      ?.getContext("2d");
    if (weightCtx) {
      // پاکسازی canvas
      weightCtx.clearRect(0, 0, 200, 120);
    }
    if (weightCtx) {
      this.chartInstances.weighting = new Chart(
        weightCtx,
        {
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
                pointHitRadius: 14,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", axis: "x", intersect: false },
            hover: { mode: "index", axis: "x", intersect: false },
            plugins: {
              legend: { display: true, labels: { color: "#475569", font: { family: "Vazir", size: 11 } } },
              tooltip: {
                enabled: true,
                intersect: false,
                mode: "index",
                position: "nearest",
                rtl: true,
                titleAlign: "right",
                bodyAlign: "right",
                footerAlign: "right",
                backgroundColor: "rgba(15,23,42,0.92)",
                titleFont: { family: "Vazir", size: 12 },
                bodyFont: { family: "Vazir", size: 11 },
                padding: 10,
                cornerRadius: 8,
              },
              datalabels: { display: false },
            },
            scales: { y: { beginAtZero: true } },
          },
        },
        [this._valueLabelPlugin],
      );
    }

    // نمودار تلفات
    const lossCtx = document.getElementById("lossCanvas")?.getContext("2d");
    if (lossCtx) {
      this.chartInstances.loss = new Chart(
        lossCtx,
        {
          type: "bar",
          data: {
            labels: [],
            datasets: [
              {
                label: "تلفات",
                data: [],
                backgroundColor: "#ef4444",
                hoverBackgroundColor: "#b91c1c",
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", axis: "x", intersect: false },
            hover: { mode: "index", axis: "x", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: true,
                intersect: false,
                mode: "index",
                position: "nearest",
                rtl: true,
                titleAlign: "right",
                bodyAlign: "right",
                footerAlign: "right",
                backgroundColor: "rgba(15,23,42,0.92)",
                titleFont: { family: "Vazir", size: 12 },
                bodyFont: { family: "Vazir", size: 11 },
                padding: 10,
                cornerRadius: 8,
              },
              datalabels: { display: false },
            },
            scales: { y: { beginAtZero: true } },
          },
        },
        [this._valueLabelPlugin],
      );
    }

    // نمودار مصرف خوراک
    const feedCtx = document.getElementById("feedCanvas")?.getContext("2d");
    if (feedCtx) {
      this.chartInstances.feed = new Chart(
        feedCtx,
        {
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
                pointHitRadius: 14,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", axis: "x", intersect: false },
            hover: { mode: "index", axis: "x", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                enabled: true,
                intersect: false,
                mode: "index",
                position: "nearest",
                rtl: true,
                titleAlign: "right",
                bodyAlign: "right",
                footerAlign: "right",
                backgroundColor: "rgba(15,23,42,0.92)",
                titleFont: { family: "Vazir", size: 12 },
                bodyFont: { family: "Vazir", size: 11 },
                padding: 10,
                cornerRadius: 8,
              },
              datalabels: { display: false },
            },
            scales: { y: { beginAtZero: true } },
          },
        },
        [this._valueLabelPlugin],
      );
    }

    this.ensureChartCompareUi();
    this.setupChartOptions();
    this._attachExternalTooltips();

    // چک‌باکس سری‌های هر نمودار (در حالت خالی فقط سری اصلی)
    this.renderChartSeriesToggles();

    console.log("✅ Charts initialized (empty)");
  }

  // ===== نوار چک‌باکس نمایش سری‌های هر نمودار (مستقل برای هر نمودار) =====
  renderChartSeriesToggles() {
    const targets = [
      ["weighting", "weightingCanvas"],
      ["loss", "lossCanvas"],
      ["feed", "feedCanvas"],
    ];
    targets.forEach(([key, canvasId]) => {
      const chart = this.chartInstances[key];
      const canvas = document.getElementById(canvasId);
      if (!chart || !canvas) return;
      const card = canvas.closest(".chart-card");
      if (!card) return;

      let box = card.querySelector(".chart-series-toggles");
      if (!box) {
        box = document.createElement("div");
        box.className = "chart-series-toggles";
        const wrapper = card.querySelector(".chart-wrapper");
        const stats = card.querySelector(".chart-stats");
        if (wrapper && stats) {
          card.insertBefore(box, stats);
        } else {
          card.appendChild(box);
        }
      }

      const items = (chart.data.datasets || [])
        .map((ds, index) => {
          const label = ds.label || `سری ${index + 1}`;
          const color = ds.borderColor || ds.backgroundColor || "#2c7a6e";
          const checked = ds.hidden ? "" : "checked";
          return `
            <label class="chart-series-toggle">
              <input type="checkbox" data-chart="${key}" data-idx="${index}" ${checked}
                     onchange="window.toggleChartSeries('${key}', ${index}, this.checked)">
              <span class="series-dot" style="background:${color}"></span>
              <span class="series-name">${label}</span>
            </label>`;
        })
        .join("");
      box.innerHTML = items || "";
    });
  }

  // فعال/غیرفعال‌کردن یک سری فقط روی همان نمودار
  toggleChartSeries(chartKey, index, checked) {
    const chart = this.chartInstances[chartKey];
    if (!chart || !chart.data || !chart.data.datasets) return;
    const ds = chart.data.datasets[index];
    if (!ds) return;
    ds.hidden = !checked;
    chart.update();
  }

  // ===== گزینهٔ «نمایش مقادیر» روی سه نمودار =====
  setupChartOptions() {
    const header = document.getElementById("chartSelectionHeader");
    if (!header || header.querySelector(".dashboard-chart-options")) return;
    const row = document.createElement("div");
    row.className = "dashboard-chart-options";
    row.innerHTML = `
      <label class="db-option-toggle">
        <input type="checkbox" id="showChartValues" ${this.showChartValues ? "checked" : ""}
               onchange="window.toggleChartValues(this.checked)">
        <i class="fas fa-percent"></i>
        <span>نمایش مقادیر</span>
      </label>`;
    header.appendChild(row);
  }

  toggleChartValues(checked) {
    this.showChartValues = !!checked;
    [
      ["weighting", 2],
      ["loss", 0],
      ["feed", 0],
    ].forEach(([key, frac]) => {
      const chart = this.chartInstances[key];
      if (!chart) return;
      chart._dashShowValues = this.showChartValues;
      chart._dashFrac = frac;
      chart.update();
    });
  }

  // ===== تولتیپ خارجی (HTML) — دیگر در لبهٔ نمودار بریده نمی‌شود =====
  _attachExternalTooltips() {
    const targets = [
      ["weighting", "weightingCanvas"],
      ["loss", "lossCanvas"],
      ["feed", "feedCanvas"],
    ];
    targets.forEach(([key, canvasId]) => {
      const chart = this.chartInstances[key];
      if (!chart) return;
      chart.options.plugins.tooltip = {
        enabled: false,
        external: (context) => this._renderExternalTooltip(context, key),
      };
    });
  }

  _renderExternalTooltip(context, chartKey) {
    const tooltip = context && context.tooltip;
    if (!tooltip) return;
    const canvas = context.chart && context.chart.canvas;
    const wrapper = canvas ? canvas.closest(".chart-wrapper") : null;
    if (!wrapper) return;

    let el = wrapper.querySelector(".dash-ext-tooltip");
    if (!el) {
      el = document.createElement("div");
      el.className = "dash-ext-tooltip";
      wrapper.appendChild(el);
    }

    if (!tooltip.opacity || tooltip.opacity === 0) {
      el.style.display = "none";
      return;
    }

    el.innerHTML = "";
    const titleEl = document.createElement("div");
    titleEl.className = "dash-tt-title";
    titleEl.textContent = (tooltip.title || []).join(" — ");
    el.appendChild(titleEl);

    const bodyEl = document.createElement("div");
    bodyEl.className = "dash-tt-body";
    (tooltip.dataPoints || []).forEach((dp) => {
      const ds = dp.dataset || {};
      const color = ds.borderColor || ds.backgroundColor || "#2c7a6e";
      const label = ds.label || `سری ${(dp.datasetIndex || 0) + 1}`;
      let value = dp.formattedValue;
      if (value === undefined && dp.raw !== undefined && dp.raw !== null) {
        value = Number(dp.raw).toLocaleString("fa-IR", {
          maximumFractionDigits: 2,
        });
      }
      const row = document.createElement("div");
      row.className = "dash-tt-row";
      const dot = document.createElement("span");
      dot.className = "dash-tt-dot";
      dot.style.background = color;
      const lab = document.createElement("span");
      lab.className = "dash-tt-label";
      lab.textContent = label;
      const val = document.createElement("span");
      val.className = "dash-tt-value";
      val.textContent = value !== undefined && value !== null ? value : "—";
      row.append(dot, lab, val);
      bodyEl.appendChild(row);
    });
    el.appendChild(bodyEl);

    el.style.display = "block";
    el.style.left = "0px";
    el.style.top = "0px";

    const availW = wrapper.clientWidth || 0;

    // ✅ عرض تولتیپ برابر عرض محتوای داخل آن (بدون محدودیت عرض ثابت)
    el.style.maxWidth = "none";
    el.querySelectorAll(".dash-tt-title, .dash-tt-row").forEach((node) => {
      node.style.whiteSpace = "";
    });

    let ttW = el.offsetWidth || 160;
    // اگر محتوا از عرض قابل‌نمایش نمودار بیشتر بود، متن داخل همان عرض wrap می‌شود
    if (availW && ttW > availW - 8) {
      el.style.maxWidth = `${Math.max(140, availW - 8)}px`;
      el.querySelectorAll(".dash-tt-title, .dash-tt-row").forEach((node) => {
        node.style.whiteSpace = "normal";
      });
      ttW = el.offsetWidth || ttW;
    }

    let left = (tooltip.caretX || 0) - ttW / 2;
    if (left < 4) left = 4;
    if (left + ttW > availW - 4) {
      left = Math.max(4, availW - ttW - 4);
    }
    let top = (tooltip.caretY || 0) - (el.offsetHeight || 60) - 12;
    if (top < 4) top = (tooltip.caretY || 0) + 12;
    el.style.transform = `translate(${left}px, ${top}px)`;
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
      this.renderChartSeriesToggles();
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
    this.renderChartSeriesToggles();
  }

  resetCompareSeries() {
    ["weighting", "loss", "feed"].forEach((kind) => {
      const chart = this.chartInstances[kind];
      if (!chart || !chart.data.datasets) return;
      if (chart.data.datasets.length > 1) chart.data.datasets.length = 1;
    });
    this.chartStack = [];
    this.renderCompareChips();
    this.renderChartSeriesToggles();
  }

  async _loadCompareCustomers() {
    const res = await apiService.get("/customers", { limit: 1000, page: 1 });
    if (!res.success) return [];
    const rows =
      res.data?.customers ||
      res.data?.rows ||
      res.data?.list ||
      (Array.isArray(res.data) ? res.data : []) ||
      [];
    return rows
      .map((r) => ({
        id: r.id ?? r.customer_id,
        name: r.full_name || r.fullName || `مشتری ${r.id}`,
        farm: r.farm_name || r.farmName || "",
      }))
      .filter((c) => c.id != null)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fa"));
  }

  async _loadCustomerFlocksForCompare(customerId) {
    const normalize = (arr) =>
      (Array.isArray(arr) ? arr : []).map((f) => ({
        id: f.id,
        flockNumber: f.flock_number || f.flockNumber || f.id || "",
        status: f.status || "active",
        placements: (f.placements || []).map((p) => ({
          id: p.id,
          hallName:
            p.hall?.hall_name ||
            p.Hall?.hall_name ||
            p.hall_name ||
            `سالن ${p.hall_id}`,
          isActive: p.is_active,
        })),
      }));
    const [activeRes, pastRes] = await Promise.all([
      apiService.get("/flocks", {
        customer_id: customerId,
        status: "active",
        limit: 500,
      }),
      apiService.get("/flocks", {
        customer_id: customerId,
        status: "completed",
        limit: 500,
      }),
    ]);
    return {
      active: normalize(activeRes?.success ? activeRes.data?.flocks : []),
      past: normalize(pastRes?.success ? pastRes.data?.flocks : []),
    };
  }

  _flockGroupHTML(flock, customerLabel) {
    const groupLabel = `گله ${flock.flockNumber} (کل) — ${customerLabel}`;
    const hallRows = (flock.placements || [])
      .map((p) => {
        const hallLabel = `${p.hallName} — گله ${flock.flockNumber}`;
        return `
          <label class="dash-cmp-row">
            <input type="checkbox" class="dash-cmp-check" value="hall:${p.id}|${hallLabel}" />
            <i class="fas fa-door-open dash-cmp-icon"></i>
            <span class="dash-cmp-label">${p.hallName}</span>
            <span class="dash-cmp-badge ${p.isActive ? "dash-cmp-ok" : "dash-cmp-done"}">${p.isActive ? "فعال" : "پایان‌یافته"}</span>
          </label>`;
      })
      .join("");
    return `
      <div class="dash-cmp-flock">
        <div class="dash-cmp-flock-title"><i class="fas fa-layer-group"></i> گله ${flock.flockNumber}</div>
        <label class="dash-cmp-row dash-cmp-group">
          <input type="checkbox" class="dash-cmp-check" value="flock:${flock.id}|${groupLabel}" />
          <i class="fas fa-chart-line dash-cmp-icon"></i>
          <span class="dash-cmp-label">کل گله (${(flock.placements || []).length} سالن)</span>
        </label>
        ${hallRows}
      </div>`;
  }

  async openChartComparePicker() {
    if (typeof Swal === "undefined") return;
    try {
      const customers = await this._loadCompareCustomers();
      if (!customers.length) {
        notificationService.warning("مشتری‌ای برای مقایسه یافت نشد");
        return;
      }
      const customerOpts = customers
        .map(
          (c) =>
            `<option value="${c.id}">${c.name}${c.farm ? ` (${c.farm})` : ""}</option>`,
        )
        .join("");
      const step1 = await Swal.fire({
        title: "انتخاب مشتری برای مقایسه",
        html: `<div style="text-align:right;direction:rtl;font-family:Vazir,sans-serif;">
          <div class="dash-cmp-step"><i class="fas fa-user"></i> مشتری موردنظر را انتخاب کنید</div>
          <select id="dashCmpCustomer" class="dash-cmp-select">
            <option value="">انتخاب مشتری...</option>${customerOpts}
          </select>
        </div>`,
        showCancelButton: true,
        confirmButtonText: "ادامه",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#2c7a6e",
        preConfirm: () => {
          const v = document.getElementById("dashCmpCustomer")?.value;
          if (!v) {
            Swal.showValidationMessage("یک مشتری انتخاب کنید");
            return false;
          }
          return parseInt(v, 10);
        },
      });
      if (!step1.isConfirmed) return;
      const customerId = step1.value;
      const customer =
        customers.find((c) => c.id === customerId) || null;
      const customerLabel = customer
        ? `${customer.name}${customer.farm ? ` — ${customer.farm}` : ""}`
        : `مشتری ${customerId}`;

      notificationService.showLoading("در حال دریافت گله‌های مشتری...");
      let flocksData;
      try {
        flocksData = await this._loadCustomerFlocksForCompare(customerId);
      } finally {
        notificationService.hideLoading();
      }
      if (
        !flocksData ||
        (!flocksData.active.length && !flocksData.past.length)
      ) {
        notificationService.warning("برای این مشتری گله/سالنی یافت نشد");
        return;
      }

      const section = (list, icon, title, cls) =>
        !list.length
          ? ""
          : `<div class="dash-cmp-sec ${cls}">
              <div class="dash-cmp-sec-head"><i class="fas ${icon}"></i> ${title} (${list.length} گله)</div>
              ${list.map((f) => this._flockGroupHTML(f, customerLabel)).join("")}
            </div>`;
      const html = `<div style="text-align:right;direction:rtl;font-family:Vazir,sans-serif;">
        <div class="dash-cmp-cust"><i class="fas fa-warehouse"></i> ${customerLabel}</div>
        ${section(flocksData.active, "fa-circle-check", "گله‌های فعال", "dash-cmp-active")}
        ${section(flocksData.past, "fa-clock-rotate-left", "گله‌های گذشته", "dash-cmp-past")}
        <p class="dash-cmp-hint"><i class="fas fa-circle-info"></i> می‌توانید چند گله یا سالن را هم‌زمان انتخاب کنید (حداکثر ۸ سری).</p>
      </div>`;

      const step2 = await Swal.fire({
        title: "انتخاب گله/سالن برای مقایسه",
        html,
        width: 760,
        showCancelButton: true,
        confirmButtonText: "افزودن به نمودار",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#2c7a6e",
        preConfirm: () => {
          const picked = [...document.querySelectorAll(".dash-cmp-check:checked")].map(
            (i) => i.value,
          );
          if (!picked.length) {
            Swal.showValidationMessage("حداقل یک گله یا سالن انتخاب کنید");
            return false;
          }
          if (picked.length > 8) {
            Swal.showValidationMessage("حداکثر ۸ سری مقایسه مجاز است");
            return false;
          }
          return picked;
        },
      });
      if (step2.isConfirmed && step2.value) {
        await this._addPickedComparisons(step2.value);
      }
    } catch (error) {
      console.error("❌ Error in compare picker:", error);
      notificationService.error("خطا در باز کردن مودال مقایسه");
    }
  }

  async _addPickedComparisons(picked) {
    this.setChartsLoading(true);
    let added = 0;
    try {
      for (const raw of picked || []) {
        const parts = String(raw || "").split("|");
        const [scope, id] = (parts[0] || "").split(":");
        const label = parts.slice(1).join("|") || "";
        if (!id) continue;
        const before = this.chartStack.length;
        await this.addChartComparison(scope, id, label);
        if (this.chartStack.length > before) added++;
      }
    } catch (error) {
      console.error("❌ Error adding picked comparisons:", error);
    } finally {
      this.setChartsLoading(false);
    }
    if (added === 0) {
      notificationService.info(
        "سری جدیدی اضافه نشد (ممکن است تکراری یا بدون دادهٔ هفتگی باشد)",
      );
    }
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
        chart.data.datasets[0].hidden = false;
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

    // به‌روزرسانی چک‌باکس سری‌ها بعد از هر بار داده
    this.renderChartSeriesToggles();

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
          // ✅ آزادسازی کارت‌های نمودار مودال جزئیات مشتری
          this.destroyFlockCharts();
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

  /**
   * نمایش «خلاصهٔ عملکرد مشتری» در مودال
   * ------------------------------------------------------------
   * داده از endpoint اختصاصی می‌آید: { customer, summary, flocks, halls, economics, focus }
   *   ① نوار KPI  ② اطلاعات پایه  ③ گله‌ها (تب در جریان/تمام‌شده + ریز سالن‌ها)
   *   ④ کارنامهٔ سالن‌ها  + جدول هفته‌ها با کلیک (لود تنبل)
   */
  async showCustomerDetail(customerId, flockId = null) {
    const modal = document.getElementById("customerDetailModal");
    const body = document.getElementById("modalBody");
    const titleEl = document.getElementById("modalCustomerName");

    if (!customerId) {
      notificationService.error("شناسهٔ مشتری نامعتبر است");
      return;
    }

    try {
      // نمایش سریع مودال با حالت «در حال بارگذاری» (حس سرعت بهتر)
      if (titleEl) titleEl.textContent = "اطلاعات مشتری";
      if (body) {
        body.innerHTML =
          '<div class="cd-loading"><i class="fas fa-spinner fa-spin"></i> در حال دریافت اطلاعات مشتری…</div>';
      }
      modal?.classList.add("active");
      document.body.style.overflow = "hidden";

      // بافت مودال (برای لود تنبل جدول هفتگی)
      this.customerDetailContext = {
        customerId,
        flockId,
        chicksByPlacement: {},
        hallsByPlacement: {},
      };

      const response = await dashboardApi.getCustomerPerformance(
        customerId,
        flockId,
      );

      if (!response?.success || !response.data) {
        if (body) {
          body.innerHTML =
            '<div class="cd-empty">اطلاعات مشتری دریافت نشد — دوباره تلاش کنید</div>';
        }
        notificationService.error("خطا در دریافت اطلاعات مشتری");
        return;
      }

      const data = response.data || {};

      // نقشهٔ «شناسهٔ جوجه‌ریزی → تعداد جوجه / نام سالن» برای جدول هفته‌ها
      (data.flocks || []).forEach((flock) => {
        (flock.halls || []).forEach((hall) => {
          this.customerDetailContext.chicksByPlacement[hall.placementId] =
            hall.chicks;
          this.customerDetailContext.hallsByPlacement[hall.placementId] =
            hall.hallName;
        });
      });

      if (titleEl) {
        titleEl.textContent = data.customer?.fullName || "اطلاعات مشتری";
      }

      if (body) {
        body.innerHTML = buildCustomerDetailHTML(data);
        if (typeof body.scrollTo === "function") body.scrollTo({ top: 0 });
        // ✅ کارت‌های نمودار روند هفتگی گله (ابعاد ثابت، فقط تبِ نمایان)
        this.renderFlockCharts();
      }
    } catch (error) {
      console.error("❌ Error showing customer detail:", error);
      if (body) {
        body.innerHTML =
          '<div class="cd-empty">خطا در دریافت اطلاعات مشتری — دوباره تلاش کنید</div>';
      }
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  /**
   * جابه‌جایی تب «گله‌های در جریان / تمام‌شده» در مودال جزئیات مشتری
   */
  switchCustomerDetailTab(tabId) {
    const body = document.getElementById("modalBody");
    if (!body) return;

    body.querySelectorAll("[data-cd-tab]").forEach((tab) => {
      tab.classList.toggle("cd-tab-active", tab.dataset.cdTab === tabId);
    });

    body.querySelectorAll("[data-cd-panel]").forEach((panel) => {
      if (panel.dataset.cdPanel === tabId) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
    });

    // ✅ کارت‌های نمودار تبِ تازه (Chart.js در ظرف hidden اندازهٔ صفر می‌گیرد؛ پس فقط تبِ نمایان ساخته می‌شود)
    this.renderFlockCharts();
  }

  /**
   * ساخت کارت‌های نمودار روند هفتگی هر گله
   * ⚠️ Chart.js در ظرف hidden اندازهٔ صفر می‌گیرد ⇒ فقط تبِ نمایان ساخته می‌شود
   *    و نمودارهای تب‌های پنهان آزاد می‌شوند (و در بازگشت دوباره ساخته می‌شوند).
   */
  renderFlockCharts() {
    if (typeof Chart === "undefined") return;

    const body = document.getElementById("modalBody");
    if (!body) return;

    const panels = Array.from(body.querySelectorAll("[data-cd-panel]"));
    const visible = panels.find((panel) => !panel.hasAttribute("hidden")) || body;

    panels.forEach((panel) => {
      if (panel !== visible) this.destroyFlockCharts(panel);
    });

    this.createFlockCharts(visible);
  }

  /**
   * ساخت ریزنمودارها داخل یک ظرف (هر canvas یک خط کوچک بدون محور/لجند)
   */
  createFlockCharts(container) {
    if (!container) return;

    container.querySelectorAll("[data-cd-trend]").forEach((row) => {
      if (row.dataset.cdRendered === "true") return;

      let trend = null;
      try {
        trend = JSON.parse(row.getAttribute("data-cd-trend") || "{}");
      } catch {
        trend = null;
      }

      if (!trend || !Array.isArray(trend.weeks) || trend.weeks.length < 2) return;

      row.querySelectorAll("canvas[data-cd-chart]").forEach((canvas) => {
        const key = canvas.dataset.cdChart;
        const values = Array.isArray(trend[key]) ? trend[key] : [];
        if (!values.some((value) => value !== null && value !== undefined)) return;

        const color = canvas.dataset.cdColor || "#2c7a6e";
        const dates = Array.isArray(trend.dates) ? trend.dates : [];
        const unit = canvas.dataset.cdUnit || "";
        const digits = parseInt(canvas.dataset.cdDigits || "0", 10) || 0;

        try {
          const chart = new Chart(canvas, {
            type: "line",
            plugins: [flockChartLabelPlugin],
            data: {
              labels: trend.weeks.map((week) => `هفته ${week}`),
              datasets: [
                {
                  data: values,
                  borderColor: color,
                  backgroundColor: "transparent",
                  borderWidth: 2,
                  pointRadius: 2.5,
                  pointBackgroundColor: color,
                  pointBorderColor: color,
                  pointHoverRadius: 5,
                  tension: 0.4,
                  spanGaps: true,
                  fill: false,
                },
              ],
            },
            options: {
              // ✅ ابعاد نمودار از ظرفِ با ارتفاع ثابت (.cd-chart-box) می‌آید
              responsive: true,
              maintainAspectRatio: false,
              devicePixelRatio:
                (typeof window !== "undefined" && window.devicePixelRatio) || 1,
              animation: false,
              resizeDelay: 0,
              // فضای بالا برای برچسب اعداد روی نقاط
              layout: {
                padding: { top: 18, bottom: 6, left: 8, right: 8 },
              },
              plugins: {
                legend: { display: false },
                datalabels: { display: false },
                tooltip: {
                  displayColors: false,
                  backgroundColor: "rgba(15,23,42,0.92)",
                  titleFont: { family: "Vazir", size: 11 },
                  bodyFont: { family: "Vazir", size: 11 },
                  callbacks: {
                    title: (items) => {
                      const index = items?.[0]?.dataIndex ?? 0;
                      const week = trend.weeks?.[index] ?? index + 1;
                      const date = dates[index]
                        ? convertToPersianDate(dates[index])
                        : "";
                      return `هفتهٔ ${week}${date ? ` — ${date}` : ""}`;
                    },
                    label: (ctx) => {
                      const index = ctx.dataIndex ?? 0;
                      const current = Number(values[index]);
                      const valueText = Number.isFinite(current)
                        ? current.toLocaleString("fa-IR", {
                            maximumFractionDigits: digits,
                          })
                        : String(ctx.formattedValue ?? "");

                      const previous =
                        index > 0 ? Number(values[index - 1]) : null;
                      let deltaText = "";

                      if (Number.isFinite(current) && Number.isFinite(previous)) {
                        const delta = current - previous;
                        const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
                        deltaText = ` · تغییر: ${arrow} ${Math.abs(
                          delta,
                        ).toLocaleString("fa-IR", {
                          maximumFractionDigits: digits,
                        })}`;
                      }

                      return `${valueText}${unit ? ` ${unit}` : ""}${deltaText}`;
                    },
                  },
                },
              },
              scales: {
                x: { display: false },
                y: { display: false },
              },
            },
          });

          this.flockCharts.push(chart);
        } catch (error) {
          console.warn("⚠️ کارت نمودار ساخته نشد:", error?.message);
        }
      });

      row.dataset.cdRendered = "true";
    });
  }

  /**
   * آزادسازی کارت‌های نمودار گله
   * @param {Element|null} container اگر داده شود، فقط نمودارهای داخل آن پاک می‌شوند
   */
  destroyFlockCharts(container = null) {
    const kept = [];

    (this.flockCharts || []).forEach((chart) => {
      const canvas = chart?.canvas;
      const belongs = container
        ? !!canvas && typeof container.contains === "function" && container.contains(canvas)
        : true;

      if (!belongs) {
        kept.push(chart);
        return;
      }

      try {
        chart.destroy();
      } catch {
        /* ignore */
      }

      // پرچم «رندر شده» پاک می‌شود تا در بازگشت به تب، دوباره ساخته شود
      const row = canvas?.closest?.("[data-cd-trend]");
      if (row) delete row.dataset.cdRendered;
    });

    this.flockCharts = kept;
  }

  /**
   * نمایش/مخفی کردن جدول هفته‌های یک گله (لود تنبل از /weekly)
   */
  async toggleCustomerDetailWeeks(button) {
    if (!button) return;

    const wrap = button.nextElementSibling;
    if (!wrap) return;

    // اگر قبلاً لود شده، فقط باز/بسته می‌شود (بدون درخواست دوباره)
    if (wrap.dataset.cdLoaded === "true") {
      wrap.toggleAttribute("hidden");
      button.classList.toggle("cd-weeks-open", !wrap.hasAttribute("hidden"));
      return;
    }

    const placementIds = String(button.dataset.cdWeeks || "")
      .split(",")
      .map((value) => parseInt(value, 10))
      .filter(Boolean);

    if (!placementIds.length) {
      notificationService.error("دادهٔ هفتگی برای این گله ثبت نشده است");
      return;
    }

    const context = this.customerDetailContext || {};

    wrap.removeAttribute("hidden");
    wrap.innerHTML = buildWeeksTableHTML([], { loading: true });
    button.disabled = true;

    try {
      const responses = await Promise.all(
        placementIds.map((id) =>
          apiService
            .get("/weekly", { chick_placement_id: id, limit: 500 })
            .catch(() => null),
        ),
      );

      const weeks = responses
        .filter((res) => res?.success)
        .flatMap((res) => res.data?.records || []);

      wrap.innerHTML = buildWeeksTableHTML(weeks, {
        chicksByPlacement: context.chicksByPlacement || {},
        hallsByPlacement: context.hallsByPlacement || {},
      });
      wrap.dataset.cdLoaded = "true";
      button.classList.add("cd-weeks-open");
    } catch (error) {
      console.error("❌ Error loading weekly history:", error);
      wrap.innerHTML = buildWeeksTableHTML([], {
        error: "خطا در دریافت داده‌های هفتگی",
      });
    } finally {
      button.disabled = false;
    }
  }

  /**
   * رفتن به پروفایل مشتری
   */
  goToCustomerProfile(customerId) {
    window.location.href = `/customer-info?id=${customerId}`;
  }
}

// ===== ترکیب mixin های دامنه‌ای داشبورد (موج ۳.۲ — دامنه‌های مستقل) =====
Object.assign(DashboardService.prototype, dashboardSmsMethods);
Object.assign(DashboardService.prototype, dashboardBookmarkMethods);
export const dashboardService = new DashboardService();

// ===== چسب پنجره (window.*) — منتقل‌شده به dashboard.window-glue.js (موج ۳.۲) =====
registerDashboardWindowGlue({ dashboardService, DashboardService });
// کمکی ماژول‌محلی (موج ۳.۲o) — پلاگین Chart.js برای نمایش مقدارها روی نمودارهای داشبورد.
// ⚠️ متن زیر بایت‌به‌بایت از بدنهٔ `setupCharts` منتقل شده است؛ متن فارسی داخلی و
// dedent ممنوع است.
// ⚠️ پرانتز بعد از `=>` لازم است وگرنه `{` به‌عنوان بدنهٔ بلوکی تفسیر می‌شود (درس ۳.۲n).
const buildValueLabelPlugin = () => (
{
      id: "dashValueLabels",
      afterDatasetsDraw(chart) {
        if (!chart._dashShowValues) return;
        const chartArea = chart.chartArea;
        if (!chartArea) return;
        const ctx = chart.ctx;
        ctx.save();
        chart.data.datasets.forEach((dataset, di) => {
          if (dataset.hidden) return;
          const meta = chart.getDatasetMeta(di);
          if (!meta || !meta.data) return;
          const color = dataset.borderColor || dataset.backgroundColor || "#475569";
          ctx.font = "700 10px Vazir, sans-serif";
          ctx.fillStyle = color;
          ctx.textAlign = "center";
          const frac = typeof chart._dashFrac === "number" ? chart._dashFrac : 0;
          (dataset.data || []).forEach((value, idx) => {
            if (value === null || value === undefined || Number.isNaN(Number(value))) {
              return;
            }
            const el = meta.data[idx];
            if (!el || typeof el.x !== "number") return;
            const text = Number(value).toLocaleString("fa-IR", {
              maximumFractionDigits: frac,
            });
            const isBar = chart.config && chart.config.type === "bar";
            const cx = isBar ? el.x + (el.width || 0) / 2 : el.x;
            let y = isBar ? el.y - 5 : el.y - 11;
            if (y < chartArea.top + 4) y = chartArea.top + 4;
            ctx.fillText(text, cx, y);
          });
        });
        ctx.restore();
      },
    }
);

