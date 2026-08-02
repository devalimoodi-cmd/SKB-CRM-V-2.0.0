import { apiService } from "../../../core/services/api.service.js";
import { convertToPersianDate } from "../../../core/utils/date.utils.js";

class HeaderBookmarksService {
  constructor() {
    this.initialized = false;
    this.bookmarks = [];
    this.reminders = [];
    this.messages = [];
  }

  async init() {
    if (this.initialized) return;
    await this.loadBookmarks();
    this.renderDropdown();
    this.initialized = true;
    console.log("✅ HeaderBookmarksService initialized");
  }

  async loadBookmarks() {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        this.bookmarks = [];
        this.renderDropdown();
        return;
      }

      const response = await fetch("/api/bookmarks?limit=10", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("خطا در دریافت بوکمارک‌ها");

      const result = await response.json();

      if (result.success) {
        this.bookmarks = result.data?.bookmarks || [];
        this.reminders = this.bookmarks.filter((b) => b.type === "reminder");
        this.messages = this.bookmarks.filter((b) => b.type === "message");
        this.updateBadges();
        this.renderDropdown();
      } else {
        this.bookmarks = [];
        this.renderDropdown();
      }
    } catch (error) {
      console.error("❌ Error loading bookmarks:", error);
      this.bookmarks = [];
      this.renderDropdown();
    }
  }

  updateBadges() {
    const total = this.bookmarks.length;
    const badge = document.querySelector(".dropdown-bookmark-btn .quantity");
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? "flex" : "none";
    }
  }

  renderDropdown() {
    const dropdown = document.getElementById("bookmarkDropdown");
    if (!dropdown) return;

    const container = dropdown.querySelector(".dropdown-body");
    if (!container) return;

    if (this.bookmarks.length === 0) {
      container.innerHTML = `
        <div style="padding: 30px 20px; text-align: center; color: #94a3b8;">
          <i class="fas fa-bookmark" style="font-size: 36px; display: block; margin-bottom: 12px; color: #cbd5e1;"></i>
          <p style="font-size: 14px;">هیچ بوکمارکی وجود ندارد</p>
          <button onclick="window.showCreateBookmarkModal()" style="margin-top: 12px; padding: 8px 20px; background: #2c7a6e; color: white; border: none; border-radius: 8px; cursor: pointer; font-family: 'Vazir'; font-size: 13px;">
            <i class="fas fa-plus"></i> جدید
          </button>
        </div>
      `;
      return;
    }

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...this.bookmarks].sort(
      (a, b) =>
        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2),
    );

    let html = `
      <div style="padding: 12px 16px; border-bottom: 1px solid #eef2f6; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 600; color: #1e293b; font-size: 14px;">
          <i class="fas fa-bookmark" style="color: #f59e0b;"></i> بوکمارک‌ها
        </span>
        <span style="font-size: 12px; color: #64748b;">📌 ${this.bookmarks.length} کل</span>
      </div>
    `;

    const displayItems = sorted.slice(0, 5);
    displayItems.forEach((bookmark) => {
      const priorityColor = this.getPriorityColor(bookmark.priority);
      const priorityText = this.getPriorityText(bookmark.priority);
      const customerName = bookmark.customer?.full_name || "بدون مشتری";
      const isDue =
        bookmark.due_date && new Date(bookmark.due_date) <= new Date();

      html += `
        <div onclick="window.viewBookmarkDetail(${bookmark.id})" 
             style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: all 0.2s ease; border-bottom: 1px solid #f8fafc;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: ${priorityColor}20; color: ${priorityColor}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="fas fa-${bookmark.type === "reminder" ? "bell" : "bookmark"}"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 13px; font-weight: 500; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${bookmark.title || "بدون عنوان"}
            </div>
            <div style="display: flex; gap: 6px; margin-top: 2px; flex-wrap: wrap; align-items: center; font-size: 11px; color: #64748b;">
              <span style="background: ${priorityColor}15; color: ${priorityColor}; padding: 0 8px; border-radius: 4px; font-size: 10px;">
                ${priorityText}
              </span>
              <span>👤 ${customerName}</span>
              ${
                bookmark.due_date
                  ? `
                <span style="color: ${isDue ? "#dc2626" : "#64748b"};">
                  ${isDue ? "⚠️" : "📅"} ${convertToPersianDate(bookmark.due_date)}
                </span>
              `
                  : ""
              }
            </div>
          </div>
          <div style="color: #94a3b8; font-size: 12px;">
            <i class="fas fa-chevron-left"></i>
          </div>
        </div>
      `;
    });

    if (this.bookmarks.length > 5) {
      html += `
        <div style="padding: 10px 16px; text-align: center; border-top: 1px solid #eef2f6;">
          <a href="/bookmarks" style="color: #2c7a6e; text-decoration: none; font-size: 13px; font-weight: 500;">
            مشاهده همه (${this.bookmarks.length})
          </a>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  viewBookmarkDetail(id) {
    console.log("📌 مشاهده بوکمارک:", id);

    const bookmark = this.bookmarks.find((b) => b.id === id);
    if (!bookmark) {
      alert("⚠️ بوکمارک یافت نشد");
      return;
    }

    const priorityText = this.getPriorityText(bookmark.priority);
    const priorityColor = this.getPriorityColor(bookmark.priority);
    const customerName = bookmark.customer?.full_name || "بدون مشتری";
    const dueDate = bookmark.due_date
      ? convertToPersianDate(bookmark.due_date)
      : "بدون تاریخ";
    const typeText = bookmark.type === "reminder" ? "🔔 یادآوری" : "📌 بوکمارک";

    const content = `
        <div style="font-family: 'Vazir', sans-serif; direction: rtl; padding: 0;">
            <div style="display: flex; align-items: center; gap: 16px; padding: 16px 20px; background: #f8fafc; border-radius: 12px; border-right: 4px solid ${priorityColor}; margin-bottom: 16px;">
                <div style="width: 48px; height: 48px; border-radius: 50%; background: ${priorityColor}20; color: ${priorityColor}; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;">
                    <i class="fas fa-${bookmark.type === "reminder" ? "bell" : "bookmark"}"></i>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 16px; font-weight: 600; color: #1e293b;">
                        ${bookmark.title}
                    </div>
                    <div style="font-size: 13px; color: #64748b;">
                        ${typeText}
                    </div>
                </div>
            </div>

            <div style="padding: 14px 16px; background: #f8fafc; border-radius: 12px; margin-bottom: 12px;">
                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">توضیحات:</div>
                <div style="font-size: 14px; color: #1e293b; line-height: 1.7; text-align: justify;">
                    ${bookmark.description || "بدون توضیح"}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
                <div style="padding: 10px 14px; background: #f8fafc; border-radius: 10px;">
                    <div style="font-size: 10px; color: #94a3b8;">اولویت</div>
                    <div style="font-weight: 600; color: ${priorityColor};">
                        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${priorityColor}; margin-left: 6px;"></span>
                        ${priorityText}
                    </div>
                </div>
                <div style="padding: 10px 14px; background: #f8fafc; border-radius: 10px;">
                    <div style="font-size: 10px; color: #94a3b8;">نوع</div>
                    <div style="font-weight: 600; color: #1e293b;">
                        ${typeText}
                    </div>
                </div>
                <div style="padding: 10px 14px; background: #f8fafc; border-radius: 10px;">
                    <div style="font-size: 10px; color: #94a3b8;">مشتری</div>
                    <div style="font-weight: 600; color: #1e293b;">
                        👤 ${customerName}
                    </div>
                </div>
                <div style="padding: 10px 14px; background: #f8fafc; border-radius: 10px;">
                    <div style="font-size: 10px; color: #94a3b8;">تاریخ سررسید</div>
                    <div style="font-weight: 600; color: ${bookmark.due_date && new Date(bookmark.due_date) < new Date() ? "#dc2626" : "#1e293b"};">
                        📅 ${dueDate}
                        ${bookmark.due_date && new Date(bookmark.due_date) < new Date() ? " ⚠️ سررسید شده" : ""}
                    </div>
                </div>
            </div>
        </div>
    `;

    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: `${bookmark.type === "reminder" ? "🔔" : "📌"} ${bookmark.title}`,
        html: content,
        icon: bookmark.type === "reminder" ? "info" : "success",
        confirmButtonText: "✅ بستن",
        showCancelButton: true,
        cancelButtonText: "🗑️ حذف",
        showCloseButton: true,
        confirmButtonColor: "#2c7a6e",
        cancelButtonColor: "#dc2626",
        width: "580px",
        reverseButtons: true,
        customClass: {
          popup: "swal2-rtl",
        },
      }).then(async (result) => {
        if (result.isDismissed && result.dismiss === "cancel") {
          // ✅ استفاده از تابع deleteBookmark
          const confirmDelete = await Swal.fire({
            title: "⚠️ تأیید حذف",
            text: `آیا از حذف "${bookmark.title}" اطمینان دارید؟`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "بله، حذف شود",
            cancelButtonText: "انصراف",
            confirmButtonColor: "#dc2626",
            cancelButtonColor: "#94a3b8",
          });

          if (confirmDelete.isConfirmed) {
            await this.deleteBookmark(bookmark.id);
          }
        }
      });
    } else {
      alert(
        `📌 ${bookmark.title}\n\n${bookmark.description || "بدون توضیح"}\n\n👤 ${customerName}\n📅 ${dueDate}`,
      );
    }
  }
  // ===== توابع کمکی =====

  closeBookmarkModal() {
    if (typeof modalService !== "undefined") {
      modalService.close("bookmarkDetailModal");
      // حذف مودال از DOM
      setTimeout(() => {
        const modal = document.querySelector(
          '.modal-overlay[data-modal-id="bookmarkDetailModal"]',
        );
        if (modal) {
          modal.remove();
        }
      }, 300);
    }
  }

  editBookmarkFromDetail(id) {
    this.closeBookmarkModal();
    if (window.showCreateBookmarkModal) {
      window.showCreateBookmarkModal(id);
    } else {
      console.log("✏️ ویرایش بوکمارک:", id);
      alert(`ویرایش بوکمارک ${id} - این قابلیت به زودی اضافه می‌شود`);
    }
  }

  async deleteBookmark(id) {
    console.log("🗑️ حذف بوکمارک:", id);

    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        alert("⚠️ لطفاً وارد شوید");
        return;
      }

      const response = await fetch(`/api/bookmarks/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        // حذف از لیست محلی
        this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
        this.renderDropdown();
        this.updateBadges();

        // نمایش پیام موفقیت
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: "✅ حذف شد",
            text: "بوکمارک با موفقیت حذف شد",
            timer: 2000,
            showConfirmButton: false,
          });
        } else {
          alert("✅ بوکمارک با موفقیت حذف شد");
        }

        // اگر صفحه بوکمارک باز هست، رفرش کن
        if (window.bookmarksService) {
          window.bookmarksService.loadBookmarks();
        }
      } else {
        alert("❌ خطا: " + (result.message || "حذف انجام نشد"));
      }
    } catch (error) {
      console.error("❌ Error deleting bookmark:", error);
      alert("❌ خطا در ارتباط با سرور");
    }
  }

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

  refresh() {
    this.loadBookmarks();
  }
}

// ===== Export =====
export const headerBookmarksService = new HeaderBookmarksService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.HeaderBookmarksService = headerBookmarksService;
  window.headerBookmarksService = headerBookmarksService;

  // توابع مشاهده و مدیریت بوکمارک
  window.viewBookmarkDetail = headerBookmarksService.viewBookmarkDetail.bind(
    headerBookmarksService,
  );

  window.closeBookmarkModal = headerBookmarksService.closeBookmarkModal.bind(
    headerBookmarksService,
  );

  window.editBookmarkFromDetail =
    headerBookmarksService.editBookmarkFromDetail.bind(headerBookmarksService);

  // ✅ اصلاح: استفاده از deleteBookmark به جای deleteBookmarkFromDetail
  window.deleteBookmark = headerBookmarksService.deleteBookmark.bind(
    headerBookmarksService,
  );

  // ✅ تابع بارگذاری مجدد بوکمارک‌ها
  window.refreshBookmarks = headerBookmarksService.loadBookmarks.bind(
    headerBookmarksService,
  );

  // ✅ تابع سراسری نمایش مودال ساخت بوکمارک جدید
  window.showCreateBookmarkModal = function (bookmarkId = null) {
    const modalService = window.bookmarksModalService;
    if (modalService && typeof modalService.openCreateModal === "function") {
      modalService.openCreateModal(bookmarkId);
      return;
    }
    // Fallback: import dynamic
    import("../../../features/bookmarks/bookmarks.modal.service.js")
      .then((module) => {
        const service = module.bookmarksModalService;
        if (service && typeof service.openCreateModal === "function") {
          service.openCreateModal(bookmarkId);
        }
      })
      .catch(() => {
        console.warn("⚠️ Bookmarks modal service not available");
      });
  };
}

console.log("✅ HeaderBookmarksService exposed to window");
