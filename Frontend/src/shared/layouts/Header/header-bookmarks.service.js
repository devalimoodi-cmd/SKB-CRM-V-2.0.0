import { apiService } from "../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../core/constants/api.const.js";
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

      const result = await apiService.get(
        API_CONSTANTS.ENDPOINTS.BOOKMARKS.LIST,
        { limit: 10 },
      );

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
      : null;
    const isOverdue =
      bookmark.due_date && new Date(bookmark.due_date) < new Date();
    const typeText = bookmark.type === "reminder" ? "یادآوری" : "بوکمارک";
    const typeIcon = bookmark.type === "reminder" ? "fa-bell" : "fa-bookmark";

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

    const content = `
      <div style="text-align:center; font-family:'Vazir','Vazirmatn',sans-serif; direction:rtl;">
        <!-- آیکون مدور -->
        <div style="width:72px; height:72px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:30px; color:#fff; background:linear-gradient(135deg,${pr.gradient}); box-shadow:0 8px 32px ${pr.shadow}; position:relative;">
          <i class="fas ${typeIcon}"></i>
        </div>

        <!-- عنوان -->
        <div style="font-size:20px; font-weight:800; color:#1e293b; margin-bottom:4px;">${bookmark.title || "بدون عنوان"}</div>
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
                 <span style="font-size:11px; color:${isOverdue ? "#dc2626" : "#94a3b8"};"><i class="fas fa-clock"></i> ${dueDate} ${isOverdue ? "⚠️" : ""}</span>`
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
          <div style="background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
            <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
              <i class="fas fa-tag" style="color:#2c7a6e;"></i> نوع
            </div>
            <div style="font-size:15px; font-weight:600; color:#1e293b; padding-right:4px;">
              ${bookmark.type === "reminder" ? "🔔 یادآوری" : "📌 بوکمارک"}
            </div>
          </div>
          ${
            dueDate
              ? `<div style="background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
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
              : `<div style="background:#fafbfc; border-radius:14px; padding:12px 16px; border:1px solid transparent;">
                  <div style="font-size:11px; font-weight:600; color:#64748b; display:flex; align-items:center; gap:6px; margin-bottom:2px;">
                    <i class="fas fa-calendar-alt" style="color:#2c7a6e;"></i> تاریخ سررسید
                  </div>
                  <div style="font-size:15px; font-weight:600; color:#94a3b8; padding-right:4px;">بدون تاریخ</div>
                </div>`
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
    `;

    if (typeof Swal !== "undefined") {
      Swal.fire({
        title: "",
        html: content,
        confirmButtonText: "✏️ ویرایش",
        showCancelButton: true,
        cancelButtonText: "🗑️ حذف",
        showCloseButton: true,
        confirmButtonColor: "#2c7a6e",
        cancelButtonColor: "#dc2626",
        width: "520px",
        padding: "24px 28px",
        reverseButtons: true,
        customClass: {
          popup: "swal2-rtl",
        },
        didOpen: () => {
          document
            .querySelector(".swal2-popup")
            ?.style?.setProperty("border-radius", "24px");
        },
      }).then(async (result) => {
        if (result.isConfirmed) {
          // ویرایش بوکمارک
          if (window.showCreateBookmarkModal) {
            window.showCreateBookmarkModal(bookmark.id);
          } else {
            alert("ویرایش بوکمارک - این قابلیت به زودی اضافه می‌شود");
          }
        } else if (result.dismiss === "cancel") {
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
        `📌 ${bookmark.title}\n\n${bookmark.description || "بدون توضیح"}\n\n👤 ${customerName}\n📅 ${dueDate || "بدون تاریخ"}`,
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

      const result = await apiService.delete(
        `${API_CONSTANTS.ENDPOINTS.BOOKMARKS.LIST}/${id}`,
      );

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
