import { dashboardApi } from "./dashboard.api.js";
import { dashboardRenderer } from "./dashboard.renderer.js";
import { TaskCard } from "../../shared/components/TaskCard/TaskCard.js";

import { apiService } from "../../core/services/api.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { stateService } from "../../core/services/state.service.js";
import {
  convertToPersianDate,
  formatDate,
} from "../../core/utils/date.utils.js";

class DashboardService {
  constructor() {
    this.flocks = [];
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
    // بررسی دسترسی
    const hasAccess = await authService.checkExpertPageAccess();
    if (!hasAccess) return;

    await this.loadData();
    this.setupCharts();
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

      // بارگذاری داده‌های نمودارها
      await this.loadChartsData();

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
    } catch (error) {
      console.error("❌ Error loading flocks:", error);
      this.flocks = [];
    }
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

  async loadChartsData(flockId = null) {
    try {
      const response = await dashboardApi.getChartsData(null, flockId);
      if (response.success && response.data) {
        this.updateCharts(response.data);
      }
    } catch (error) {
      console.error("❌ Error loading charts data:", error);
    }
  }

  // ===== رندر تسک‌ها =====

  renderTasks() {
    const dangerList = document.getElementById("dangerTaskList");
    const successList = document.getElementById("successTaskList");
    const dangerCount = document.getElementById("dangerCount");
    const successCount = document.getElementById("successCount");

    if (!dangerList || !successList) return;

    const dangerFlocks = this.flocks.filter(
      (f) => f.flock?.status === "danger",
    );
    const successFlocks = this.flocks.filter(
      (f) => f.flock?.status === "success",
    );

    dangerList.innerHTML =
      dangerFlocks.length === 0
        ? this.getEmptyStateHTML("همه گله‌ها در وضعیت عادی هستند", "#10b981")
        : dangerFlocks
            .map((item) => this.renderTaskCard(item, "danger"))
            .join("");

    successList.innerHTML =
      successFlocks.length === 0
        ? this.getEmptyStateHTML("هیچ گله‌ای نزدیک به سررسید نیست", "#10b981")
        : successFlocks
            .map((item) => this.renderTaskCard(item, "success"))
            .join("");

    if (dangerCount) dangerCount.textContent = dangerFlocks.length;
    if (successCount) successCount.textContent = successFlocks.length;

    this.updateAccordionVisibility();
  }

  renderTaskCard(item, type) {
    const { customer, flock } = item;
    const statusInfo = this.getStatusInfo(flock);

    // وضعیت پیامک — اگر ندارد، خالی بگذار
    const smsStatus = item.smsStatus || null;
    const smsInfo = smsStatus ? this.getSmsStatusInfo(smsStatus) : null;
    const smsInfoHTML = smsInfo
      ? `<span class="sms-status" style="background: ${smsInfo.bg}; color: ${smsInfo.color}; padding: 4px 12px; border-radius: 12px; font-size: 10px; font-weight: 500;">
            ${smsInfo.text}
        </span>`
      : "";

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
      pending: { text: "⏳ در انتظار", color: "#f59e0b", bg: "#fef3c7" },
      sent: { text: "📱 ارسال شده", color: "#3b82f6", bg: "#dbeafe" },
      delivered: { text: "✅ تحویل داده شده", color: "#16a34a", bg: "#dcfce7" },
      failed: { text: "❌ ناموفق", color: "#dc2626", bg: "#fee2e2" },
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
          labels: ["هفته ۱", "هفته ۲", "هفته ۳", "هفته ۴", "هفته ۵", "هفته ۶"],
          datasets: [
            {
              label: "وزن (کیلوگرم)",
              data: [0.5, 0.8, 1.2, 1.7, 2.2, 2.8],
              borderColor: "#4a90e2",
              backgroundColor: "rgba(74, 144, 226, 0.1)",
              fill: true,
              tension: 0.4,
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

    // نمودار تلفات
    const lossCtx = document.getElementById("lossCanvas")?.getContext("2d");
    if (lossCtx) {
      this.chartInstances.loss = new Chart(lossCtx, {
        type: "bar",
        data: {
          labels: ["هفته ۱", "هفته ۲", "هفته ۳", "هفته ۴", "هفته ۵", "هفته ۶"],
          datasets: [
            {
              label: "تلفات",
              data: [2, 5, 8, 6, 4, 3],
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
          labels: ["هفته ۱", "هفته ۲", "هفته ۳", "هفته ۴", "هفته ۵", "هفته ۶"],
          datasets: [
            {
              label: "خوراک (کیلوگرم)",
              data: [10, 18, 30, 45, 55, 60],
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              fill: true,
              tension: 0.4,
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

    console.log("✅ Charts initialized");
  }

  updateCharts(data) {
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

    // بروزرسانی آمار
    if (summary) {
      const avgWeight = document.getElementById("avgWeight");
      const maxWeight = document.getElementById("maxWeight");
      const totalLoss = document.getElementById("totalLoss");
      const avgLoss = document.getElementById("avgLoss");
      const totalFeed = document.getElementById("totalFeed");
      const avgFeed = document.getElementById("avgFeed");

      if (avgWeight) avgWeight.textContent = summary.avgWeight + " کیلوگرم";
      if (maxWeight) maxWeight.textContent = summary.maxWeight + " کیلوگرم";
      if (totalLoss) totalLoss.textContent = summary.totalLoss || "0";
      if (avgLoss) avgLoss.textContent = summary.avgLoss + "%";
      if (totalFeed)
        totalFeed.textContent =
          (summary.totalFeed || 0).toLocaleString() + " کیلوگرم";
      if (avgFeed) avgFeed.textContent = summary.avgFeed + " کیلوگرم";
    }

    console.log("✅ Charts updated with data:", data);
  }

  async selectFlockForChart(
    customerId,
    flockId,
    customerName,
    flockNumber,
    weekNumber,
  ) {
    // حذف کلاس selected از همه کارت‌ها
    document.querySelectorAll(".task-card").forEach((card) => {
      card.classList.remove("selected");
    });

    // افزودن کلاس selected به کارت انتخاب شده
    const selectedCard = document.querySelector(
      `.task-card[data-customer-id="${customerId}"][data-flock-id="${flockId}"]`,
    );
    if (selectedCard) {
      selectedCard.classList.add("selected");
    }

    notificationService.success(
      `✅ گله ${flockNumber} (هفته ${weekNumber}) - ${customerName} انتخاب شد`,
    );

    // بارگذاری داده‌های نمودار برای گله انتخاب شده
    await this.loadChartsData(flockId);

    // ✅ بروزرسانی وضعیت پیامک‌ها همان لحظه که تسک انتخاب می‌شود
    // ابتدا از سرور بخواه وضعیت پیامک‌های تحویل‌نشده همین گله را چک و در دیتابیس ذخیره کند
    try {
      await dashboardApi.updateSmsStatusForFlock(customerId, flockId);
    } catch (e) {
      console.warn("⚠️ خطا در بروزرسانی وضعیت پیامک‌ها هنگام انتخاب تسک:", e);
    }
    await this.refreshAllTaskSmsStatus();
    await this.loadFlocks();
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

    // دکمه ارسال پیامک گروهی
    const sendSmsBtn = document.getElementById("sendBulkSms");
    if (sendSmsBtn) {
      sendSmsBtn.addEventListener("click", () => this.sendBulkSms());
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
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  async sendBulkSms() {
    const cards = document.querySelectorAll("#successTaskList .task-card");
    if (cards.length === 0) {
      notificationService.info("هیچ مشتری برای ارسال پیامک وجود ندارد");
      return;
    }

    // گروه‌بندی بر اساس مشتری
    const customerGroups = {};
    cards.forEach((card) => {
      const customerId = parseInt(card.dataset.customerId);
      const customerName =
        card.querySelector(".customer-name")?.textContent || "";

      if (!customerGroups[customerId]) {
        customerGroups[customerId] = {
          name: customerName,
          flocks: [],
        };
      }
      customerGroups[customerId].flocks.push({
        flockId: parseInt(card.dataset.flockId),
        flockNumber: card.dataset.flockNumber,
        weekNumber: card.dataset.weekNumber,
        card: card,
      });
    });

    const customerNames = Object.values(customerGroups)
      .map((g) => g.name)
      .join("، ");
    const totalFlocks = cards.length;
    const totalCustomers = Object.keys(customerGroups).length;

    const confirmed = await notificationService.confirm({
      title: "📱 ارسال پیامک گروهی",
      text: `آیا از ارسال پیامک به ${totalFlocks} گله (${totalCustomers} مشتری) اطمینان دارید؟\n\nمشتریان: ${customerNames}`,
      confirmText: "بله، ارسال شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    // نمایش مودال انتخاب قالب
    const message = await this.showSmsModal("گروهی");
    if (!message) return;

    notificationService.showLoading(
      `در حال ارسال پیامک به ${totalCustomers} مشتری...`,
    );

    let successCount = 0;
    let failCount = 0;

    for (const [customerId, group] of Object.entries(customerGroups)) {
      try {
        const customer = await dashboardApi.getCustomer(parseInt(customerId));
        if (!customer.success || !customer.data.mobile_number) {
          failCount++;
          continue;
        }

        const finalMessage = message
          .replace(/#FULLNAME#/g, customer.data.full_name || group.name)
          .replace(/#WEEKNUMBER#/g, "جاری")
          .replace(/#FLOCKNUMBER#/g, "");

        const response = await dashboardApi.sendSms(
          parseInt(customerId),
          finalMessage,
        );
        if (response.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error("❌ Error sending SMS:", error);
        failCount++;
      }
    }

    notificationService.hideLoading();
    notificationService.success(
      `✅ پیامک به ${successCount} مشتری ارسال شد${failCount > 0 ? ` (${failCount} ناموفق)` : ""}`,
      failCount > 0 ? "warning" : "success",
    );
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

            if (textarea && charCount) {
              charCount.textContent = textarea.value.length;
              textarea.addEventListener("input", () => {
                charCount.textContent = textarea.value.length;
                if (textarea.value.length > 500) {
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
            if (message.length > 500) {
              Swal.showValidationMessage(
                "متن پیامک نباید بیشتر از 500 کاراکتر باشد",
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

    // فرمت تاریخ و ساعت ارسال
    const sentAt = log.sent_at || new Date().toISOString();
    let sentTimeText = "-";
    try {
      sentTimeText = new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(sentAt));
    } catch (e) {}

    // فرمت تاریخ تحویل
    let deliveredText = "-";
    if (log.delivered_at) {
      try {
        deliveredText = new Intl.DateTimeFormat("fa-IR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(log.delivered_at));
      } catch (e) {}
    }

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

    // ذخیره messageId برای رفرش خودکار
    if (messageId) {
      smsStatusEl.dataset.messageId = String(messageId);
    }

    // نشان دادن messageId اگر موجود باشد
    const msgIdText = messageId ? ` | ID: ${messageId}` : "";

    smsStatusEl.innerHTML = `
      <span>${smsInfo.text}</span>
      <span style="font-size:9px; opacity:0.8;">📅 ${sentTimeText}${msgIdText}</span>
      ${deliveredText !== "-" ? `<span style="font-size:9px; opacity:0.8;">📬 تحویل: ${deliveredText}</span>` : ""}
      <span style="font-size:9px; opacity:0.8;">👤 ${sender}</span>
    `;
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

            // ساخت نام فرستنده از لاگ (اگر موجود باشد — فعلاً از localStorage)
            const currentUser = JSON.parse(
              localStorage.getItem("user") || "{}",
            );
            const senderName =
              currentUser.fullName ||
              currentUser.full_name ||
              `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim() ||
              currentUser.username ||
              "کاربر سیستم";

            statusEl.innerHTML = `
              <span>${smsInfo.text}</span>
              ${isDelivered && deliveredText ? `<span style="font-size:9px; opacity:0.8;">📬 تحویل: ${deliveredText}</span>` : ""}
              <span style="font-size:9px; opacity:0.8;">👤 ${senderName}</span>
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
    // بروزرسانی هر 15 ثانیه (سریع‌تر برای نمایش وضعیت پیامک)
    this.refreshInterval = setInterval(() => {
      if (!document.hidden) {
        // ⚠️ رندر Tasks هر 15 ثانیه باعث پرش و از بین رفتن کلاس selected می‌شود!
        // فقط داده‌ها و وضعیت پیامک‌ها را به‌روز می‌کنیم
        this.loadFlocks();
        this.loadBookmarks();
        // ✅ فقط وضعیت پیامک‌ها روی تسک‌ها آپدیت شود
        this.refreshAllTaskSmsStatus();
      }
    }, 15000);

    // بروزرسانی هنگام بازگشت به صفحه
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.loadData();
      }
    });

    // بروزرسانی هنگام فوکوس
    window.addEventListener("focus", () => {
      this.loadData();
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

  // ===== توابع SMS History =====

  async showSmsHistory(customerId, flockId = null) {
    let records = [];
    try {
      const response = await dashboardApi
        .getSmsHistory(customerId, flockId)
        .catch(() => ({ success: false, data: [] }));
      records = response.success
        ? response.data?.messages || response.data || []
        : [];
    } catch (e) {
      records = [];
    }

    // ✅ بررسی وضعیت واقعی پیامک‌ها از سرویس (برای پیامک‌هایی که وضعیت تحویل ندارند)
    // این کار باعث می‌شود زمان و وضعیت تحویل برای هر پیامک به‌روز شود
    const pendingStatusChecks = records.filter(
      (r) => r.message_id && !r.delivery_state,
    );
    if (pendingStatusChecks.length > 0) {
      await Promise.all(
        pendingStatusChecks.map(async (r) => {
          try {
            const statusRes = await dashboardApi.checkSmsStatus(r.message_id);
            if (statusRes.success && statusRes.data?.deliveryState) {
              r.delivery_state = statusRes.data.deliveryState;
              // آپدیت وضعیت بر اساس deliveryState
              if (statusRes.data.deliveryState === 1) {
                r.status = "delivered";
                r.delivered_at = r.delivered_at || new Date().toISOString();
              } else if (statusRes.data.deliveryState === 6) {
                r.status = "failed";
              } else if (statusRes.data.deliveryState === 3) {
                r.status = "sent";
              } else {
                r.status = "pending";
              }
            }
          } catch (err) {
            console.warn("⚠️ خطا در بررسی وضعیت پیامک:", err);
          }
        }),
      );
    }

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
          1: "✅ رسیده به گوشی",
          2: "❌ نرسیده به گوشی",
          3: "📡 رسیده به مخابرات",
          4: "❌ نرسیده به مخابرات",
          5: "📡 رسیده به اپراتور",
          6: "❌ ناموفق",
          7: "⛔ لیست سیاه",
          8: "❓ نامشخص",
        };
        return map[deliveryState] || "-";
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
          '<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">هیچ پیامکی ارسال نشده است</td></tr>';
      } else {
        rows = records
          .map(
            (r, i) => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${i + 1}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.message || "-"}</td>
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
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">تاریخ و زمان ارسال</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">تاریخ و زمان تحویل</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت تحویل</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت</th>
                    <th style="padding:8px; border-bottom:2px solid #eef2f6;">👤 فرستنده</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          `,
        confirmButtonText: "بستن",
        confirmButtonColor: "#2c7a6e",
        width: 900,
      });
    }
  }

  async refreshSmsStatus(customerId, flockId) {
    try {
      // نمایش پیام در حال بررسی
      notificationService.info("⏳ در حال بررسی و بروزرسانی وضعیت پیامک‌ها...");

      // ۱. فراخوانی سرویس سرور برای چک وضعیت واقعی پیامک‌های ارسال‌نشده
      //    این سرویس برای هر پیامک بدون وضعیت تحویل، از سرویس‌دهنده پیامک استعلام می‌گیرد
      //    و وضعیت واقعی (تحویل/ناموفق/در انتظار) را در دیتابیس ذخیره می‌کند
      const updateRes = await dashboardApi
        .updateSmsStatusForFlock(customerId, flockId)
        .catch(() => null);

      // ۲. دریافت تاریخچه به‌روزشده از دیتابیس (بعد از ذخیره وضعیت‌ها)
      let records = [];
      try {
        const response = await dashboardApi
          .getSmsHistory(customerId, flockId)
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

      // ۳. رفرش کارت‌ها و وضعیت‌ها
      await this.loadFlocks();
      await this.refreshAllTaskSmsStatus();

      // ۴. نمایش مودال با وضعیت‌های جدید
      if (typeof Swal !== "undefined") {
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
            1: "✅ رسیده به گوشی",
            2: "❌ نرسیده به گوشی",
            3: "📡 رسیده به مخابرات",
            4: "❌ نرسیده به مخابرات",
            5: "📡 رسیده به اپراتور",
            6: "❌ ناموفق",
            7: "⛔ لیست سیاه",
            8: "❓ نامشخص",
          };
          return map[deliveryState] || "-";
        };

        let rows = records
          .map(
            (r, i) => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${i + 1}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${r.message || ""}">${r.message || "-"}</td>
              <td style="padding:8px; border-bottom:1px solid #f1f5f9; text-align:center;">${formatDateTime(r.sent_at || r.created_at)}</td>
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
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">تاریخ ارسال</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت تحویل</th>
                      <th style="padding:8px; border-bottom:2px solid #eef2f6;">وضعیت</th>
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
          width: 750,
        });
      }

      notificationService.success(
        updateRes?.success
          ? `✅ وضعیت ${totalChecked} پیامک بررسی و در دیتابیس ذخیره شد`
          : "✅ وضعیت پیامک‌ها بروزرسانی شد",
      );
    } catch (error) {
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

      if (typeof Swal !== "undefined") {
        Swal.fire({
          title: bookmarkId ? "✏️ ویرایش بوکمارک" : "📌 بوکمارک جدید",
          html: `
            <div style="text-align: right; font-family: 'Vazir';">
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">عنوان *</label>
                <input id="bookmarkTitle" value="${bookmark.title || ""}" placeholder="مثال: پیگیری هفتگی گله" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px;">
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">نوع</label>
                <select id="bookmarkType" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px;">
                  <option value="bookmark" ${bookmark.type === "bookmark" ? "selected" : ""}>📌 بوکمارک</option>
                  <option value="reminder" ${bookmark.type === "reminder" ? "selected" : ""}>🔔 یادآوری</option>
                </select>
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">مشتری</label>
                <select id="bookmarkCustomer" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px;">
                  <option value="">بدون مشتری (شخصی)</option>
                  ${customerOptions}
                </select>
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">اولویت</label>
                <select id="bookmarkPriority" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px;">
                  <option value="low" ${bookmark.priority === "low" ? "selected" : ""}>پایین</option>
                  <option value="medium" ${bookmark.priority === "medium" || !bookmark.priority ? "selected" : ""}>متوسط</option>
                  <option value="high" ${bookmark.priority === "high" ? "selected" : ""}>بالا</option>
                  <option value="critical" ${bookmark.priority === "critical" ? "selected" : ""}>بحرانی</option>
                </select>
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">تاریخ سررسید</label>
                <input type="text" id="bookmarkDueDate" placeholder="YYYY-MM-DD (مثلاً 2026-08-15)" value="${bookmark.due_date ? bookmark.due_date.slice(0, 10) : ""}" style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px; direction: ltr; text-align: left;">
              </div>
              <div style="margin-bottom: 12px;">
                <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">توضیحات</label>
                <textarea id="bookmarkDescription" rows="3" placeholder="توضیحات..." style="width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: 'Vazir'; font-size: 13px; resize: vertical;">${bookmark.description || ""}</textarea>
              </div>
            </div>
          `,
          showCancelButton: true,
          confirmButtonText: bookmarkId
            ? "✅ ذخیره تغییرات"
            : "✅ ایجاد بوکمارک",
          cancelButtonText: "❌ انصراف",
          confirmButtonColor: "#2c7a6e",
          width: 600,
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
            return {
              title: title,
              type:
                document.getElementById("bookmarkType")?.value || "bookmark",
              customer_id: customerId,
              priority:
                document.getElementById("bookmarkPriority")?.value || "medium",
              due_date:
                document.getElementById("bookmarkDueDate")?.value || null,
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
   * نمایش جزئیات بوکمارک
   */
  async showBookmarkDetail(id) {
    try {
      const bookmark = this.bookmarks.find((b) => b.id === id);
      if (!bookmark) {
        notificationService.error("بوکمارک یافت نشد");
        return;
      }
      if (typeof Swal !== "undefined") {
        Swal.fire({
          icon: "info",
          title: bookmark.title,
          html: `
            <div style="text-align: right; font-family: 'Vazir';">
              <p><strong>نوع:</strong> ${bookmark.type === "reminder" ? "🔔 یادآوری" : "📌 بوکمارک"}</p>
              <p><strong>مشتری:</strong> ${bookmark.customer?.full_name || "شخصی"}</p>
              <p><strong>اولویت:</strong> <span class="priority-badge ${bookmark.priority}">${this.getPriorityText(bookmark.priority)}</span></p>
              ${bookmark.due_date ? `<p><strong>تاریخ سررسید:</strong> ${convertToPersianDate(bookmark.due_date)}</p>` : ""}
              ${bookmark.description ? `<p><strong>توضیحات:</strong> ${bookmark.description}</p>` : ""}
            </div>
          `,
          confirmButtonText: "بستن",
          confirmButtonColor: "#2c7a6e",
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
  window.selectFlockForChart = (
    customerId,
    flockId,
    customerName,
    flockNumber,
    weekNumber,
  ) =>
    dashboardService.selectFlockForChart(
      customerId,
      flockId,
      customerName,
      flockNumber,
      weekNumber,
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
  window.showSmsHistory = (customerId, flockId) =>
    dashboardService.showSmsHistory(customerId, flockId);
  window.refreshSmsStatus = (customerId, flockId) =>
    dashboardService.refreshSmsStatus(customerId, flockId);
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
