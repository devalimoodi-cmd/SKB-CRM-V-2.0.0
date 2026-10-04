import { authService } from "../../../core/services/auth.service.js";
import { headerBookmarksService } from "./header-bookmarks.service.js";
import { headerDropdownService } from "./header-dropdown.service.js";
import { messagesService } from "../../../features/messages/messages.service.js";
// ✅ «تغییرات جدید / What's New» (مودال اطلاع‌رسانی نسخه‌ها)
import { whatsNewService } from "../../../features/whats-new/whats-new.service.js";
import { themeService } from "../../../core/services/theme.service.js";
import {
  applyAvatar,
  resolveAvatarUrl,
} from "../../../core/utils/avatar.utils.js";

class HeaderService {
  constructor() {
    this.initialized = false;
    this.elements = {};
    this.user = null;
  }

  async init() {
    if (this.initialized) return;

    // ✅ گارد سراسری: اگر ماژول/سرویس دو نمونه شود، هدر دو بار ساخته/بایند نشود
    if (typeof window !== "undefined") {
      if (window.__skbHeaderInit) return;
      window.__skbHeaderInit = true;
    }

    // ===== 1. لود کردن HTML هدر =====
    try {
      const response = await fetch("/shared/layouts/Header/header.html");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const html = await response.text();

      const container = document.getElementById("main-header");
      if (container) {
        container.innerHTML = html;
        console.log("✅ Header HTML loaded");
      } else {
        console.error("❌ main-header element not found");
        return;
      }
    } catch (error) {
      console.error("❌ Error loading header HTML:", error);
      this.renderDefaultHeader();
    }

    // ===== 2. دریافت المان‌ها (بعد از لود HTML) =====
    this.elements = {
      container: document.getElementById("main-header"),
      nav: document.getElementById("headerNav"),
      userAvatar: document.querySelector(".account-wra_image .image"),
      userName: document.querySelector(".account-content_Name"),
      profileDropdown: document.getElementById("profileDropdown"),
      accountBtn: document.querySelector(".accuont-wrapper"),
      bookmarkBtn: document.querySelector(".dropdown-bookmark-btn"),
      bookmarkDropdown: document.getElementById("bookmarkDropdown"),
      reminderBtn: document.querySelector(".dropdown-reminder-btn"),
      reminderDropdown: document.getElementById("reminderDropdown"),
      emailBtn: document.querySelector(".dropdown-email-btn"),
      emailDropdown: document.getElementById("emailDropdown"),
    };

    // ===== 3. بارگذاری اطلاعات کاربر =====
    this.user = authService.getUser();
    this.renderUserInfo();

    // ===== 4. راه‌اندازی ناوبری =====
    this.initNavigation();

    // ===== 5. راه‌اندازی دراپ‌داون پروفایل =====
    this.initProfileDropdown();

    // ===== 6. راه‌اندازی دراپ‌داون بوکمارک (با سرویس اختصاصی) =====
    await this.initBookmarkDropdowns();

    // ===== 7. راه‌اندازی دکمه‌های نوتیفیکیشن =====
    this.initNotificationButtons();

    // ===== 8. دکمهٔ «تغییرات جدید / What's New» =====
    this.initWhatsNewButton();

    // ===== 9. دکمهٔ سریع «تم روشن/تیره» =====
    this.initThemeToggle();

    this.initialized = true;
    console.log("✅ HeaderService initialized");
  }

  // ===== هدر پیش‌فرض =====
  renderDefaultHeader() {
    const container = document.getElementById("main-header");
    if (!container) return;

    container.innerHTML = `
      <header class="header-desktop" style="background: var(--primary, #2c7a6e); color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 15px;">
          <img src="/assets/images/skb-logo.png" alt="SKB" style="height: 40px;" onerror="this.style.display='none'">
          <span style="font-weight: bold; font-size: 18px;">SKB-CRM</span>
        </div>
        <div style="display: flex; align-items: center; gap: 15px;">
          <span id="headerUserName">کاربر</span>
          <button onclick="window.logout()" style="background: var(--danger, #dc2626); color: white; border: none; padding: 5px 15px; border-radius: 5px; cursor: pointer;">خروج</button>
        </div>
      </header>
    `;
    console.log("✅ Default header rendered");
  }

  // ===== رندر اطلاعات کاربر =====
  renderUserInfo() {
    if (!this.user) {
      this.renderGuest();
      return;
    }

    const fullName =
      this.user.fullName ||
      `${this.user.first_name || ""} ${this.user.last_name || ""}`.trim() ||
      this.user.username ||
      "کاربر";

    // ✅ آواتار حلقه‌ناپذیر: عکس کاربر یا پیش‌فرضِ data: URL
    const avatarImg = this.elements.userAvatar;
    if (avatarImg) {
      applyAvatar(avatarImg, this.user, fullName);
      avatarImg.alt = fullName;
    }

    const nameEl = this.elements.userName;
    if (nameEl) {
      nameEl.textContent = fullName;
    }

    this.renderProfileDropdown();
  }

  renderGuest() {
    const nameEl = this.elements.userName;
    if (nameEl) {
      nameEl.textContent = "میهمان";
    }

    const avatarImg = this.elements.userAvatar;
    if (avatarImg) {
      applyAvatar(avatarImg, null, "میهمان");
      avatarImg.alt = "میهمان";
    }
  }

  renderProfileDropdown() {
    const dropdown = this.elements.profileDropdown;
    if (!dropdown) return;

    if (!this.user) {
      dropdown.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-light, #94a3b8);">
          <i class="fas fa-user-circle" style="font-size: 40px; display: block; margin-bottom: 10px;"></i>
          <p>لطفاً وارد شوید</p>
          <a href="/login" class="btn btn-primary" style="margin-top: 10px; display: inline-block; padding: 8px 20px; background: var(--primary, #2c7a6e); color: white; border-radius: 8px; text-decoration: none;">ورود</a>
        </div>
      `;
      return;
    }

    const fullName =
      this.user.fullName ||
      `${this.user.first_name || ""} ${this.user.last_name || ""}`.trim() ||
      this.user.username;

    dropdown.innerHTML = `
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-light, #eef2f6); display: flex; gap: 14px; align-items: center;">
        <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid var(--primary, #2c7a6e); flex-shrink: 0;">
          <img id="profileDropdownAvatar" alt="${fullName}" style="width: 100%; height: 100%; object-fit: cover; display: block;">
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; color: var(--text-dark, #1e293b); font-size: 15px;">${fullName}</div>
          <div style="font-size: 12px; color: var(--text-gray, #64748b);">${this.getRoleText(this.user.role)}</div>
          <div style="font-size: 11px; color: var(--text-light, #94a3b8); margin-top: 2px;">
            <i class="fas fa-user"></i> ${this.user.username || ""}
          </div>
        </div>
      </div>
      <div style="padding: 8px 0;">
        <a href="/profile" style="display: flex; align-items: center; gap: 12px; padding: 10px 20px; color: var(--text-dark, #1e293b); text-decoration: none; transition: all 0.2s ease;">
          <i class="fas fa-user" style="width: 20px; color: var(--text-light, #94a3b8);"></i>
          <span>پروفایل</span>
        </a>
        <a href="/settings" style="display: flex; align-items: center; gap: 12px; padding: 10px 20px; color: var(--text-dark, #1e293b); text-decoration: none; transition: all 0.2s ease;">
          <i class="fas fa-cog" style="width: 20px; color: var(--text-light, #94a3b8);"></i>
          <span>تنظیمات</span>
        </a>
      </div>
      <div style="border-top: 1px solid var(--border-light, #eef2f6); padding: 8px 0;">
        <button onclick="window.logout()" style="display: flex; align-items: center; gap: 12px; padding: 10px 20px; color: var(--danger, #dc2626); background: none; border: none; width: 100%; cursor: pointer; font-family: 'Vazir'; font-size: 14px; transition: all 0.2s ease;">
          <i class="fas fa-sign-out-alt" style="width: 20px;"></i>
          <span>خروج</span>
        </button>
      </div>
    `;

    // ✅ آواتار دراپ‌داون (بدون onerrorِ شکنندهٔ inline)
    applyAvatar(
      document.getElementById("profileDropdownAvatar"),
      this.user,
      fullName,
    );
  }

  // ===== ناوبری =====
  initNavigation() {
    const nav = this.elements.nav;
    if (!nav) return;

    // ===== مخفی کردن لینک «مدیریت» برای نقش‌های غیر از super_admin و admin =====
    if (!authService.hasRole(["super_admin", "admin"])) {
      const adminItem = nav.querySelector('.header-nav-item[data-page="admin"]');
      if (adminItem) {
        adminItem.style.display = "none";
      }
    }

    const currentPath = window.location.pathname;
    const items = nav.querySelectorAll(".header-nav-item");

    items.forEach((item) => {
      const href = item.getAttribute("href");
      if (href && currentPath.includes(href)) {
        item.classList.add("active");
      }

      item.addEventListener("click", (e) => {
        items.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
      });
    });
  }

  // ===== دراپ‌داون پروفایل =====
  initProfileDropdown() {
    const accountBtn = this.elements.accountBtn;
    const dropdown = this.elements.profileDropdown;

    if (!accountBtn || !dropdown) return;

    accountBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("show");
      accountBtn.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".accuont-wrapper") &&
        !e.target.closest("#profileDropdown")
      ) {
        dropdown.classList.remove("show");
        accountBtn.classList.remove("active");
      }
    });
  }

  // ===== ✅ راه‌اندازی دراپ‌داون بوکمارک، یادآوری و ایمیل =====
  async initBookmarkDropdowns() {
    // 1. مقداردهی سرویس بوکمارک هدر
    try {
      await headerBookmarksService.init();
      console.log("✅ HeaderBookmarksService initialized");
    } catch (error) {
      console.error("❌ Error initializing HeaderBookmarksService:", error);
    }

    // 2. مقداردهی سرویس دراپ‌داون هدر
    try {
      headerDropdownService.init();
      console.log("✅ HeaderDropdownService initialized");
    } catch (error) {
      console.error("❌ Error initializing HeaderDropdownService:", error);
    }

    // 3. رویدادهای دستی برای دراپ‌داون‌ها (به عنوان fallback)
    this.initManualDropdowns();
  }

  // ===== رویدادهای دستی دراپ‌داون (در صورت عدم کارکرد سرویس‌ها) =====
  initManualDropdowns() {
    // دکمه بوکمارک
    const bookmarkBtn = this.elements.bookmarkBtn;
    const bookmarkDropdown = this.elements.bookmarkDropdown;
    if (bookmarkBtn && bookmarkDropdown) {
      bookmarkBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();

        // بستن بقیه
        document
          .querySelectorAll(".show")
          .forEach((el) => el.classList.remove("show"));
        document
          .querySelectorAll(".active")
          .forEach((el) => el.classList.remove("active"));

        bookmarkDropdown.classList.toggle("show");
        bookmarkBtn.classList.toggle("active");

        if (bookmarkDropdown.classList.contains("show")) {
          // بارگذاری بوکمارک‌ها
          await headerBookmarksService.loadBookmarks();
        }
      });

      document.addEventListener("click", (e) => {
        if (
          !e.target.closest(".dropdown-bookmark-btn") &&
          !e.target.closest("#bookmarkDropdown")
        ) {
          bookmarkDropdown.classList.remove("show");
          bookmarkBtn.classList.remove("active");
        }
      });
    }

    // دکمه یادآوری
    const reminderBtn = this.elements.reminderBtn;
    const reminderDropdown = this.elements.reminderDropdown;
    if (reminderBtn && reminderDropdown) {
      reminderBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();

        document
          .querySelectorAll(".show")
          .forEach((el) => el.classList.remove("show"));
        document
          .querySelectorAll(".active")
          .forEach((el) => el.classList.remove("active"));

        reminderDropdown.classList.toggle("show");
        reminderBtn.classList.toggle("active");

        if (reminderDropdown.classList.contains("show")) {
          // بارگذاری یادآوری‌ها
          await headerBookmarksService.loadBookmarks();
        }
      });

      document.addEventListener("click", (e) => {
        if (
          !e.target.closest(".dropdown-reminder-btn") &&
          !e.target.closest("#reminderDropdown")
        ) {
          reminderDropdown.classList.remove("show");
          reminderBtn.classList.remove("active");
        }
      });
    }

    // دکمه ایمیل
    const emailBtn = this.elements.emailBtn;
    const emailDropdown = this.elements.emailDropdown;
    if (emailBtn && emailDropdown) {
      emailBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();

        document
          .querySelectorAll(".show")
          .forEach((el) => el.classList.remove("show"));
        document
          .querySelectorAll(".active")
          .forEach((el) => el.classList.remove("active"));

        emailDropdown.classList.toggle("show");
        emailBtn.classList.toggle("active");

        if (emailDropdown.classList.contains("show")) {
          // ✅ بارگذاری «نظرات و پیشنهادات» (قبلاً اشتباهاً بوکمارک‌ها لود می‌شد)
          await messagesService.refreshDropdown();
        }
      });

      document.addEventListener("click", (e) => {
        if (
          !e.target.closest(".dropdown-email-btn") &&
          !e.target.closest("#emailDropdown")
        ) {
          emailDropdown.classList.remove("show");
          emailBtn.classList.remove("active");
        }
      });
    }
  }

  // ===== دکمه‌های نوتیفیکیشن =====
  initNotificationButtons() {
    // بستن با کلیک بیرون
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".button-wrapper")) {
        document
          .querySelectorAll(
            ".dropdown-menu-reminder, .dropdown-menu-email, .wra_alert_content, .wra_bookmarks_content",
          )
          .forEach((el) => el.classList.remove("show"));
        document
          .querySelectorAll(
            ".dropdown-reminder-btn, .dropdown-email-btn, .dropdown-bookmark-btn",
          )
          .forEach((el) => el.classList.remove("active"));
      }
    });
  }

  // ===== دکمهٔ «تغییرات جدید / What's New» =====
  initWhatsNewButton() {
    const btn = document.getElementById("whatsNewBtn");

    if (btn && btn.dataset.wnBound !== "1") {
      btn.dataset.wnBound = "1";
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        // بستن دراپ‌داون‌های باز هدر
        document
          .querySelectorAll(".show")
          .forEach((el) => el.classList.remove("show"));
        document
          .querySelectorAll(".active")
          .forEach((el) => el.classList.remove("active"));

        whatsNewService.open();
      });
    }

    // ✅ بررسی خودکار «نسخهٔ جدید» + بج شمارنده (داخل سرویس، بی‌صدا)
    whatsNewService.init();
  }

  // ===== دکمهٔ سریع «تم روشن/تیره» =====
  initThemeToggle() {
    const btn = document.getElementById("headerThemeToggle");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";

    this.renderThemeIcon();

    btn.addEventListener("click", () => {
      const next = themeService.currentResolved() === "dark" ? "light" : "dark";
      themeService.setTheme(next);
      this.renderThemeIcon();

      // همگام‌سازی بی‌صدا با سرور (در صورت لاگین بودن) — بدون توقف UI
      import("../../../features/user-account/user-account.api.js")
        .then(({ userAccountApi }) => userAccountApi.updatePreferences({ theme: next }))
        .catch(() => {
          /* بی‌صدا */
        });
    });

    themeService.onChange(() => this.renderThemeIcon());
  }

  renderThemeIcon() {
    const icon = document.getElementById("headerThemeIcon");
    if (!icon) return;
    const isDark = themeService.currentResolved() === "dark";
    icon.className = isDark ? "fas fa-sun" : "fas fa-moon";
    const btn = document.getElementById("headerThemeToggle");
    if (btn) {
      btn.title = isDark ? "تغییر به تم روشن" : "تغییر به تم تیره";
    }
  }

  // ===== توابع کمکی =====

  // ✅ آواتار پیش‌فرض (data: URL — بدون درخواست شبکه و بدون ۴۰۴)
  getDefaultAvatar() {
    return resolveAvatarUrl(null, this.user?.username || "user");
  }

  getRoleText(role) {
    const map = {
      super_admin: "مدیر اصلی",
      admin: "مدیر",
      sub_admin: "مدیر میانی",
      expert: "کارشناس",
      customer: "مشتری",
    };
    return map[role] || "کاربر";
  }

  refresh() {
    this.user = authService.getUser();
    this.renderUserInfo();
  }
}

// ===== Export =====
export const headerService = new HeaderService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.HeaderService = headerService;
  window.headerService = headerService;

  // ✅ تابع سراسری خروج از سیستم
  window.logout = () => {
    authService.logout("/login");
  };
}
