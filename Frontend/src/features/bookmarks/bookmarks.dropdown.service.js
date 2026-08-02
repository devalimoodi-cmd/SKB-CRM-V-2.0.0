import { bookmarksApi } from "./bookmarks.api.js";
import { bookmarksRenderer } from "./bookmarks.renderer.js";
import { convertToPersianDate } from "../../core/utils/date.utils.js";

export const bookmarksDropdownService = {
  initialized: false,

  init() {
    if (this.initialized) return;

    // دکمه بوکمارک در هدر
    const bookmarkBtn = document.querySelector(".dropdown-bookmark-btn");
    const dropdown = document.querySelector(".wra_bookmarks_content");

    if (bookmarkBtn && dropdown) {
      bookmarkBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();

        // بستن بقیه دراپ‌داون‌ها
        document
          .querySelectorAll(".show")
          .forEach((el) => el.classList.remove("show"));

        dropdown.classList.toggle("show");
        bookmarkBtn.classList.toggle("active");

        if (dropdown.classList.contains("show")) {
          await this.loadBookmarks();
        }
      });
    }

    // بستن با کلیک بیرون
    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".button-wrapper") &&
        !e.target.closest(".wra_bookmarks_content")
      ) {
        dropdown?.classList.remove("show");
        bookmarkBtn?.classList.remove("active");
      }
    });

    this.initialized = true;
    console.log("✅ BookmarksDropdownService initialized");
  },

  async loadBookmarks(limit = 5) {
    try {
      const response = await bookmarksApi.getBookmarks({
        limit: limit,
        status: "active",
      });

      const container = document.querySelector(
        ".wra_bookmarks_content .dropdown-body",
      );
      if (!container) return;

      if (response.success) {
        const bookmarks = response.data.bookmarks || [];
        container.innerHTML = this.renderDropdownItems(bookmarks);
        this.updateBadge(bookmarks.length);
      } else {
        container.innerHTML = this.renderEmptyState();
      }
    } catch (error) {
      console.error("❌ Error loading dropdown bookmarks:", error);
      const container = document.querySelector(
        ".wra_bookmarks_content .dropdown-body",
      );
      if (container) {
        container.innerHTML = this.renderEmptyState();
      }
    }
  },

  renderDropdownItems(bookmarks) {
    if (!bookmarks || bookmarks.length === 0) {
      return this.renderEmptyState();
    }

    // مرتب‌سازی بر اساس اولویت
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sorted = [...bookmarks].sort((a, b) => {
      return (
        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      );
    });

    return sorted
      .map((bookmark) => {
        const priorityColor = bookmarksRenderer.getPriorityColor(
          bookmark.priority,
        );
        const priorityText = bookmarksRenderer.getPriorityText(
          bookmark.priority,
        );
        const customerName = bookmark.customer?.full_name || "بدون مشتری";
        const isDue =
          bookmark.due_date && new Date(bookmark.due_date) <= new Date();

        return `
                <div class="dropdown-item" onclick="window.showBookmarkDetail(${bookmark.id})" style="cursor: pointer;">
                    <div class="bookmark-item-header" style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 12px 14px;
                        background: ${isDue ? "#fef2f2" : "#f8fafc"};
                        border-radius: 12px;
                        border: 1px solid ${isDue ? "#fecaca" : "#eef2f6"};
                        transition: all 0.2s ease;
                        cursor: pointer;
                    ">
                        <div style="
                            width: 36px;
                            height: 36px;
                            border-radius: 50%;
                            background: ${priorityColor}20;
                            color: ${priorityColor};
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            flex-shrink: 0;
                        ">
                            <i class="fas fa-${bookmark.type === "reminder" ? "bell" : "bookmark"}"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="
                                font-size: 13px;
                                font-weight: 600;
                                color: #1e293b;
                                white-space: nowrap;
                                overflow: hidden;
                                text-overflow: ellipsis;
                            ">
                                ${bookmark.title || "بدون عنوان"}
                            </div>
                            <div style="
                                display: flex;
                                gap: 6px;
                                margin-top: 3px;
                                flex-wrap: wrap;
                                align-items: center;
                            ">
                                <span style="
                                    background: ${priorityColor}15;
                                    color: ${priorityColor};
                                    padding: 0 8px;
                                    border-radius: 4px;
                                    font-size: 10px;
                                    font-weight: 500;
                                ">
                                    ${priorityText}
                                </span>
                                <span style="font-size: 11px; color: #64748b;">
                                    👤 ${customerName}
                                </span>
                                ${
                                  bookmark.due_date
                                    ? `
                                    <span style="
                                        font-size: 10px;
                                        color: ${isDue ? "#dc2626" : "#64748b"};
                                        background: ${isDue ? "#fee2e2" : "#f1f5f9"};
                                        padding: 0 6px;
                                        border-radius: 4px;
                                    ">
                                        ${isDue ? "⚠️" : "📅"} ${convertToPersianDate(bookmark.due_date)}
                                    </span>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                        <div style="color: #94a3b8; font-size: 12px; flex-shrink: 0;">
                            <i class="fas fa-chevron-left"></i>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  },

  renderEmptyState() {
    return `
            <div class="dropdown-empty">
                <i class="fas fa-bookmark" style="font-size: 32px; display: block; margin-bottom: 10px; color: #cbd5e1;"></i>
                <span>هیچ بوکمارکی وجود ندارد</span>
            </div>
        `;
  },

  updateBadge(count) {
    const badge = document.querySelector(".dropdown-bookmark-btn .quantity");
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    }
  },
};
