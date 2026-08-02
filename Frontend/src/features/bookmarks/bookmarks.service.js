import { bookmarksApi } from "./bookmarks.api.js";
import { bookmarksRenderer } from "./bookmarks.renderer.js";
import { bookmarksModalService } from "./bookmarks.modal.service.js";
import { bookmarksDropdownService } from "./bookmarks.dropdown.service.js";
import { bookmarksValidation } from "./bookmarks.validation.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { stateService } from "../../core/services/state.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
} from "../../core/utils/date.utils.js";

class BookmarksService {
  constructor() {
    this.bookmarks = [];
    this.customers = [];
    this.stats = null;
    this.currentPage = 1;
    this.pageSize = 20;
    this.totalPages = 0;
    this.totalItems = 0;
    this.filters = {
      type: "all",
      status: "all",
      priority: "all",
      search: "",
    };
    this.selectedBookmark = null;
    this.isEditing = false;
    this.editingBookmarkId = null;
    this.initialized = false;
    this.localBookmarks = [];
  }

  async init() {
    // بررسی دسترسی
    const hasAccess = await authService.checkExpertPageAccess();
    if (!hasAccess) return;

    await this.loadData();
    this.setupEvents();
    this.startAutoRefresh();
    this.initialized = true;
    console.log("✅ BookmarksService initialized");
  }

  // ===== بارگذاری داده‌ها =====

  async loadData() {
    try {
      await this.loadBookmarks();
      await this.loadStats();
      await this.loadCustomers();
    } catch (error) {
      console.error("❌ Error loading bookmarks data:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  async loadBookmarks() {
    try {
      const params = {
        page: this.currentPage,
        limit: this.pageSize,
        ...this.filters,
      };

      // حذف فیلترهای 'all'
      Object.keys(params).forEach((key) => {
        if (params[key] === "all" || params[key] === "") {
          delete params[key];
        }
      });

      const response = await bookmarksApi.getBookmarks(params);

      // ترکیب با بوکمارک‌های محلی
      const localBookmarks = JSON.parse(
        localStorage.getItem("localBookmarks") || "[]",
      );
      this.localBookmarks = localBookmarks;

      if (response.success) {
        const serverBookmarks = response.data.bookmarks || [];
        this.bookmarks = [...serverBookmarks, ...localBookmarks];
        this.totalItems =
          response.data.pagination?.total || this.bookmarks.length;
        this.totalPages = response.data.pagination?.totalPages || 1;

        stateService.setBookmarks(this.bookmarks);
        this.renderBookmarks();
      }
    } catch (error) {
      console.error("❌ Error loading bookmarks:", error);
      // استفاده از بوکمارک‌های محلی
      this.bookmarks = this.localBookmarks;
      this.renderBookmarks();
    }
  }

  async loadStats() {
    try {
      const response = await bookmarksApi.getBookmarkStats();
      if (response.success) {
        this.stats = response.data;
        this.renderStats();
      }
    } catch (error) {
      console.error("❌ Error loading stats:", error);
      this.stats = null;
    }
  }

  async loadCustomers() {
    try {
      const response = await bookmarksApi.getCustomers({ limit: 1000 });
      if (response.success) {
        this.customers = response.data.customers || [];
      }
    } catch (error) {
      console.error("❌ Error loading customers:", error);
      this.customers = [];
    }
  }

  // ===== رندر =====

  renderBookmarks() {
    const container = document.getElementById("bookmarksList");
    if (!container) return;

    if (this.bookmarks.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-bookmark" style="font-size: 48px; color: #cbd5e1; display: block; margin-bottom: 16px;"></i>
                    <h4 style="font-size: 18px; color: #64748b; margin-bottom: 8px;">هیچ بوکمارکی وجود ندارد</h4>
                    <p style="font-size: 14px; color: #94a3b8;">برای شروع، یک بوکمارک جدید ایجاد کنید</p>
                    <button class="btn-add-bookmark" onclick="window.showCreateBookmarkModal()" 
                            style="margin-top: 16px; padding: 10px 24px; background: #2c7a6e; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Vazir';">
                        <i class="fas fa-plus"></i> ایجاد بوکمارک جدید
                    </button>
                </div>
            `;
      return;
    }

    // مرتب‌سازی بر اساس اولویت
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedBookmarks = [...this.bookmarks].sort((a, b) => {
      const priorityA = priorityOrder[a.priority] || 2;
      const priorityB = priorityOrder[b.priority] || 2;
      if (priorityA !== priorityB) return priorityA - priorityB;

      // اگر اولویت برابر، بر اساس تاریخ سررسید
      if (a.due_date && b.due_date) {
        return new Date(a.due_date) - new Date(b.due_date);
      }
      return a.due_date ? -1 : 1;
    });

    const html = sortedBookmarks
      .map((bookmark) => bookmarksRenderer.renderBookmarkItem(bookmark))
      .join("");

    container.innerHTML = html;
  }

  renderStats() {
    if (!this.stats) return;

    const elements = {
      totalBookmarks: document.getElementById("statTotal"),
      activeBookmarks: document.getElementById("statActive"),
      completedBookmarks: document.getElementById("statCompleted"),
      expiredBookmarks: document.getElementById("statExpired"),
      reminders: document.getElementById("statReminders"),
    };

    if (elements.totalBookmarks)
      elements.totalBookmarks.textContent = this.stats.total || 0;
    if (elements.activeBookmarks)
      elements.activeBookmarks.textContent = this.stats.active || 0;
    if (elements.completedBookmarks)
      elements.completedBookmarks.textContent = this.stats.completed || 0;
    if (elements.expiredBookmarks)
      elements.expiredBookmarks.textContent = this.stats.expired || 0;
    if (elements.reminders)
      elements.reminders.textContent = this.stats.reminders || 0;
  }

  // ===== ایجاد بوکمارک =====

  async createBookmark(data) {
    const errors = bookmarksValidation.validate(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // تبدیل تاریخ
    if (data.due_date) {
      data.due_date = convertPersianToGregorian(data.due_date);
      if (data.due_time) {
        data.due_date = `${data.due_date}T${data.due_time}:00`;
      }
    }

    try {
      const response = await bookmarksApi.createBookmark(data);
      if (response.success) {
        notificationService.success("✅ بوکمارک با موفقیت ایجاد شد");
        await this.loadBookmarks();
        bookmarksModalService.closeModal();
        return response.data;
      } else {
        notificationService.error(response.message || "خطا در ایجاد بوکمارک");
      }
    } catch (error) {
      console.error("❌ Error creating bookmark:", error);
      notificationService.error("خطا در ارتباط با سرور");

      // ذخیره محلی در صورت عدم دسترسی به سرور
      const localBookmark = {
        id: Date.now(),
        ...data,
        isLocal: true,
        created_at: new Date().toISOString(),
      };
      const localBookmarks = JSON.parse(
        localStorage.getItem("localBookmarks") || "[]",
      );
      localBookmarks.unshift(localBookmark);
      localStorage.setItem("localBookmarks", JSON.stringify(localBookmarks));

      await this.loadBookmarks();
      bookmarksModalService.closeModal();
      notificationService.info("📌 بوکمارک به صورت محلی ذخیره شد");
    }
  }

  // ===== ویرایش بوکمارک =====

  async updateBookmark(id, data) {
    const errors = bookmarksValidation.validate(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // تبدیل تاریخ
    if (data.due_date) {
      data.due_date = convertPersianToGregorian(data.due_date);
      if (data.due_time) {
        data.due_date = `${data.due_date}T${data.due_time}:00`;
      }
    }

    try {
      const response = await bookmarksApi.updateBookmark(id, data);
      if (response.success) {
        notificationService.success("✅ بوکمارک با موفقیت بروزرسانی شد");
        await this.loadBookmarks();
        bookmarksModalService.closeModal();
        return response.data;
      } else {
        notificationService.error(
          response.message || "خطا در بروزرسانی بوکمارک",
        );
      }
    } catch (error) {
      console.error("❌ Error updating bookmark:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== تغییر وضعیت =====

  async changeStatus(id, status) {
    try {
      // بررسی بوکمارک محلی
      const isLocal = this.bookmarks.find((b) => b.id === id && b.isLocal);
      if (isLocal) {
        // بروزرسانی محلی
        const localBookmarks = JSON.parse(
          localStorage.getItem("localBookmarks") || "[]",
        );
        const index = localBookmarks.findIndex((b) => b.id === id);
        if (index !== -1) {
          localBookmarks[index].status = status;
          localStorage.setItem(
            "localBookmarks",
            JSON.stringify(localBookmarks),
          );
          await this.loadBookmarks();
          notificationService.success("✅ وضعیت بوکمارک تغییر کرد");
        }
        return;
      }

      const response = await bookmarksApi.changeBookmarkStatus(id, status);
      if (response.success) {
        notificationService.success("✅ وضعیت بوکمارک تغییر کرد");
        await this.loadBookmarks();
      } else {
        notificationService.error(response.message || "خطا در تغییر وضعیت");
      }
    } catch (error) {
      console.error("❌ Error changing bookmark status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== حذف بوکمارک =====

  async deleteBookmark(id) {
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف بوکمارک",
      text: "آیا از حذف این بوکمارک اطمینان دارید؟ این عمل غیرقابل بازگشت است.",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      // بررسی بوکمارک محلی
      const isLocal = this.bookmarks.find((b) => b.id === id && b.isLocal);
      if (isLocal) {
        const localBookmarks = JSON.parse(
          localStorage.getItem("localBookmarks") || "[]",
        );
        const filtered = localBookmarks.filter((b) => b.id !== id);
        localStorage.setItem("localBookmarks", JSON.stringify(filtered));
        await this.loadBookmarks();
        notificationService.success("✅ بوکمارک با موفقیت حذف شد");
        return;
      }

      const response = await bookmarksApi.deleteBookmark(id);
      if (response.success) {
        notificationService.success("✅ بوکمارک با موفقیت حذف شد");
        await this.loadBookmarks();
      } else {
        notificationService.error(response.message || "خطا در حذف بوکمارک");
      }
    } catch (error) {
      console.error("❌ Error deleting bookmark:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== فیلترها =====

  applyFilters(filters) {
    this.filters = { ...this.filters, ...filters };
    this.currentPage = 1;
    this.loadBookmarks();
  }

  resetFilters() {
    this.filters = {
      type: "all",
      status: "all",
      priority: "all",
      search: "",
    };
    this.currentPage = 1;

    // ریست فیلدهای جستجو
    const searchInput = document.getElementById("bookmarkSearch");
    if (searchInput) searchInput.value = "";

    const typeFilter = document.getElementById("filterType");
    if (typeFilter) typeFilter.value = "all";

    const statusFilter = document.getElementById("filterStatus");
    if (statusFilter) statusFilter.value = "all";

    const priorityFilter = document.getElementById("filterPriority");
    if (priorityFilter) priorityFilter.value = "all";

    this.loadBookmarks();
  }

  // ===== رویدادها =====

  setupEvents() {
    // دکمه ایجاد بوکمارک جدید
    const addBtn = document.getElementById("addBookmarkBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () => {
        bookmarksModalService.openCreateModal(this.customers);
      });
    }

    // فیلترها
    const searchInput = document.getElementById("bookmarkSearch");
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.applyFilters({ search: searchInput.value });
        }, 300);
      });
    }

    const typeFilter = document.getElementById("filterType");
    if (typeFilter) {
      typeFilter.addEventListener("change", () => {
        this.applyFilters({ type: typeFilter.value });
      });
    }

    const statusFilter = document.getElementById("filterStatus");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => {
        this.applyFilters({ status: statusFilter.value });
      });
    }

    const priorityFilter = document.getElementById("filterPriority");
    if (priorityFilter) {
      priorityFilter.addEventListener("change", () => {
        this.applyFilters({ priority: priorityFilter.value });
      });
    }

    // دکمه ریست فیلترها
    const resetBtn = document.getElementById("resetFiltersBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetFilters());
    }

    // دکمه رفرش
    const refreshBtn = document.getElementById("refreshBookmarks");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.loadBookmarks();
        notificationService.success("✅ بوکمارک‌ها بروزرسانی شدند");
      });
    }

    // صفحه‌بندی
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");

    if (prevPageBtn) {
      prevPageBtn.addEventListener("click", () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.loadBookmarks();
        }
      });
    }

    if (nextPageBtn) {
      nextPageBtn.addEventListener("click", () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.loadBookmarks();
        }
      });
    }

    // بستن مودال با کلیک روی backdrop
    const modal = document.getElementById("bookmarkModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          bookmarksModalService.closeModal();
        }
      });
    }

    // بستن مودال با کلید Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        bookmarksModalService.closeModal();
      }
    });
  }

  // ===== رفرش خودکار =====

  startAutoRefresh() {
    // بروزرسانی هر 60 ثانیه
    this.refreshInterval = setInterval(() => {
      if (!document.hidden) {
        this.loadBookmarks();
      }
    }, 60000);

    // بروزرسانی هنگام بازگشت به صفحه
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.loadBookmarks();
      }
    });
  }

  // ===== دیستروی =====

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // ===== توابع کمکی =====

  getBookmarks() {
    return this.bookmarks;
  }

  getBookmark(id) {
    return this.bookmarks.find((b) => b.id === id);
  }

  getStats() {
    return this.stats;
  }

  getCustomers() {
    return this.customers;
  }

  refresh() {
    this.loadData();
  }
}

export const bookmarksService = new BookmarksService();
