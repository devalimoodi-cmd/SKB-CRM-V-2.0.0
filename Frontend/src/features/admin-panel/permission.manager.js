// ============================================================
// features/admin-panel/permission.manager.js
// «مدیریت نقش‌ها و سطوح دسترسی» — UI پنل مدیریت
// ------------------------------------------------------------
// دو زیرتب:
//   ۱) ماتریس نقش‌ها  : ۵ نقش × ۱۵۶ مجوز (آکاردئون گروه‌ها + جستجو
//                       + «فقط اختلاف‌ها» + ذخیرهٔ گروهی + بازگردانی)
//   ۲) دسترسی کاربران : انتخاب کاربر و سوییچ سه‌حالته
//                       (ارثی از نقش / فعال / غیرفعال)
//   ۳) گزارش تغییرات  : آخرین تغییرات ثبت‌شده (audit)
//
// ⚠️ هر تغییر فقط با کلیک «ذخیره» اعمال می‌شود (مثل بقیهٔ پنل).
// ============================================================
import { permissionApi } from "./permission.api.js";
import { adminPanelApi } from "./admin-panel.api.js";
import { authService } from "../../core/services/auth.service.js";
import { permissionService } from "../../core/services/permission.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { loaderService } from "../../shared/components/Loader/loader.service.js";

const TAB_ROLES = "roles";
const TAB_USERS = "users";
const TAB_AUDIT = "audit";

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ROLE_ICONS = {
  super_admin: "fa-crown",
  admin: "fa-user-shield",
  sub_admin: "fa-user-tie",
  expert: "fa-user-cog",
  customer: "fa-user",
};

export class PermissionManager {
  constructor() {
    this.container = null;
    this.catalog = null; // { groups, roles, roleTitles, matrix, enforced, total }
    this.activeTab = TAB_ROLES;
    this.activeRole = "expert";
    this.roleQuery = "";
    this.onlyDiff = false;
    this.pendingRoleChanges = new Map(); // key → allowed (اختلاف با ماتریس ذخیره‌شده)

    this.selectedUser = null; // { id, role, fullName, username }
    this.userState = null; // پاسخ API برای کاربر انتخاب‌شده
    this.userQuery = "";
    this.users = [];
    this.pendingUserChanges = new Map(); // key → true|false|null
    this.saving = false;
    this.eventsBound = false;
  }

  // ============================================================
  // راه‌اندازی
  // ============================================================
  async init(containerSelector = "#role-management") {
    this.containerSelector = containerSelector;
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;

    this.container.innerHTML =
      (await loaderService.inline({ text: "در حال بارگذاری سطوح دسترسی...", size: "md" })) ||
      '<div style="padding:24px;text-align:center;">در حال بارگذاری...</div>';

    await this.loadCatalog();
    this.render();
  }

  async loadCatalog() {
    try {
      const response = await permissionApi.getCatalog();
      if (response?.success) {
        this.catalog = response.data;
        if (!this.catalog.roles.includes(this.activeRole)) {
          this.activeRole = this.catalog.roles[0];
        }
      } else {
        this.catalog = null;
      }
    } catch (error) {
      console.error("❌ خطا در دریافت کاتالوگ دسترسی:", error);
      this.catalog = null;
    }
  }

  // آیا کاربر جاری اجازهٔ تغییر دارد؟
  get canEdit() {
    return authService.hasRole(["super_admin"]);
  }

  get totalPending() {
    return this.pendingRoleChanges.size + this.pendingUserChanges.size;
  }

  // ============================================================
  // رندر کلی
  // ============================================================
  render() {
    if (!this.container) return;

    if (!this.catalog) {
      this.container.innerHTML = `
        <div class="perm-empty">
          <i class="fas fa-exclamation-triangle"></i>
          <p>دریافت کاتالوگ سطوح دسترسی ناموفق بود.</p>
          <button class="perm-btn primary" id="permRetry">تلاش مجدد</button>
        </div>`;
      this.container
        .querySelector("#permRetry")
        ?.addEventListener("click", () =>
          this.init(this.containerSelector || "#role-management"),
        );
      return;
    }

    this.container.innerHTML = `
      ${this.renderHeader()}
      ${this.renderTabs()}
      <div class="perm-body">
        ${this.activeTab === TAB_ROLES ? this.renderRolesTab() : ""}
        ${this.activeTab === TAB_USERS ? this.renderUsersTab() : ""}
        ${this.activeTab === TAB_AUDIT ? this.renderAuditTab() : ""}
      </div>
      ${this.renderFooter()}
    `;

    this.bindEvents();

    if (this.activeTab === TAB_AUDIT) this.loadAudit();
    if (this.activeTab === TAB_USERS && this.users.length === 0) this.loadUsers();
  }

  renderHeader() {
    const enforced = this.catalog.enforced;
    return `
      <div class="perm-header">
        <div>
          <h3><i class="fas fa-user-tag"></i> مدیریت نقش‌ها و سطوح دسترسی</h3>
          <p class="perm-sub">
            ${this.catalog.total} قابلیت در ${this.catalog.groups.length} گروه — از مشتری تا مدیر اصلی.
            تغییرات فقط با دکمهٔ «ذخیره» اعمال می‌شود.
          </p>
        </div>
        <div class="perm-badges">
          <span class="perm-badge ${enforced ? "on" : "off"}"
                title="حالت اجرای کنترل دسترسی روی سرور">
            <i class="fas fa-shield-halved"></i>
            ${enforced ? "کنترل فعال" : "حالت آزمایشی (dry-run)"}
          </span>
          <span class="perm-badge" id="permPendingBadge">
            ${this.totalPending} تغییر ذخیره‌نشده
          </span>
        </div>
      </div>`;
  }

  renderTabs() {
    const tab = (key, icon, label) => `
      <button class="perm-tab ${this.activeTab === key ? "active" : ""}" data-perm-tab="${key}">
        <i class="fas ${icon}"></i> ${label}
      </button>`;
    return `
      <div class="perm-tabs">
        ${tab(TAB_ROLES, "fa-table-cells-large", "ماتریس نقش‌ها")}
        ${tab(TAB_USERS, "fa-user-gear", "دسترسی کاربران")}
        ${tab(TAB_AUDIT, "fa-clock-rotate-left", "گزارش تغییرات")}
      </div>`;
  }

  renderFooter() {
    if (!this.canEdit) {
      return `<div class="perm-footer-inner perm-readonly">
        <i class="fas fa-lock"></i> فقط «مدیر اصلی» می‌تواند سطوح دسترسی را تغییر دهد.
      </div>`;
    }
    return `
      <div class="perm-footer-inner">
        <span class="perm-pending">${this.totalPending} تغییر ذخیره‌نشده</span>
        <div class="perm-footer-actions">
          <button class="perm-btn ghost" id="permDiscard">انصراف از تغییرات</button>
          <button class="perm-btn primary" id="permSaveAll" ${this.totalPending ? "" : "disabled"}>
            <i class="fas fa-floppy-disk"></i> ذخیره تغییرات
          </button>
        </div>
      </div>`;
  }

  // ============================================================
  // زیرتب ۱: ماتریس نقش‌ها
  // ============================================================
  renderRolesTab() {
    const chips = this.catalog.roles
      .map(
        (role) => `
      <button class="perm-role-chip ${this.activeRole === role ? "active" : ""}"
              data-perm-role="${role}">
        <i class="fas ${ROLE_ICONS[role] || "fa-user"}"></i>
        ${escapeHtml(this.catalog.roleTitles[role] || role)}
      </button>`,
      )
      .join("");

    const groups = this.catalog.groups
      .map((group) => this.renderGroup(group, "role"))
      .filter(Boolean)
      .join("");

    return `
      <div class="perm-toolbar">
        <div class="perm-role-chips">${chips}</div>
        <div class="perm-tools">
          <input type="search" id="permRoleSearch" class="perm-search"
                 placeholder="جستجوی نام یا کلید دسترسی…" value="${escapeHtml(this.roleQuery)}">
          <label class="perm-check">
            <input type="checkbox" id="permOnlyDiff" ${this.onlyDiff ? "checked" : ""}>
            فقط تغییرات
          </label>
          <button class="perm-btn ghost" id="permRoleReset"
                  ${this.canEdit ? "" : "disabled"}
                  title="همهٔ تغییرات این نقش به پیش‌فرض سیستم برمی‌گردد">
            <i class="fas fa-rotate-left"></i> بازگردانی این نقش
          </button>
        </div>
      </div>
      <div class="perm-groups">
        ${groups || `<div class="perm-empty-small">موردی با این جستجو پیدا نشد.</div>`}
      </div>`;
  }

  // ============================================================
  // رندر یک گروه (آکاردئون) — mode: "role" | "user"
  // ============================================================
  renderGroup(group, mode) {
    const items = group.items
      .filter((item) => this._matchQuery(item))
      .filter((item) =>
        mode === "role" ? !this.onlyDiff || this._isChanged(item.key) : true,
      );

    if (items.length === 0) return "";

    const changed = items.filter((item) => this._isChanged(item.key)).length;

    return `
      <details class="perm-group" ${this.roleQuery || this.onlyDiff ? "open" : ""}>
        <summary>
          <i class="fas ${group.icon || "fa-folder"}"></i>
          <span>${escapeHtml(group.title)}</span>
          <span class="perm-group-count">${items.length} مورد</span>
          ${changed ? `<span class="perm-group-changed">${changed} تغییر</span>` : ""}
        </summary>
        <div class="perm-items">
          ${items.map((item) => this.renderItem(item, mode)).join("")}
        </div>
      </details>`;
  }

  renderItem(item, mode) {
    const role = mode === "user" ? this.userState?.user?.role : this.activeRole;
    const locked = (item.lockedTo || []).length > 0 && !item.lockedTo.includes(role);
    const alwaysOn = (item.alwaysOnFor || []).includes(role);
    const changed = this._isChanged(item.key);

    const lockNote = locked
      ? `<span class="perm-lock" title="فقط مدیر اصلی می‌تواند این مجوز را داشته باشد">
           <i class="fas fa-lock"></i></span>`
      : alwaysOn
        ? `<span class="perm-lock" title="برای این نقش همیشه فعال است">
             <i class="fas fa-circle-check"></i></span>`
        : "";

    const control =
      mode === "role"
        ? `<label class="perm-switch">
             <input type="checkbox" data-perm-key="${item.key}" data-perm-mode="role"
                    ${this._roleValue(item.key) ? "checked" : ""}
                    ${locked || alwaysOn || !this.canEdit ? "disabled" : ""}>
             <span class="perm-slider"></span>
           </label>`
        : this.renderUserSelect(item);

    return `
      <div class="perm-item ${changed ? "changed" : ""}">
        <div class="perm-item-info">
          <span class="perm-item-title">${escapeHtml(item.title)} ${lockNote}</span>
          <code class="perm-item-key">${escapeHtml(item.key)}</code>
        </div>
        <div class="perm-item-control">${control}</div>
      </div>`;
  }

  // سوییچ سه‌حالتهٔ کاربر: ارثی از نقش / فعال / غیرفعال
  renderUserSelect(item) {
    const role = this.userState?.user?.role;
    const locked = (item.lockedTo || []).length > 0 && !item.lockedTo.includes(role);
    const alwaysOn = (item.alwaysOnFor || []).includes(role);

    if (locked || alwaysOn) {
      const roleValue = !!this.userState?.roleValues?.[item.key];
      return `<span class="perm-fixed ${roleValue ? "on" : "off"}">
        ${roleValue ? "فعال" : "غیرفعال"} (از نقش)
      </span>`;
    }

    const choice = this._userChoice(item.key);
    const value = choice === null ? "" : String(choice);

    return `
      <select class="perm-select" data-perm-key="${item.key}" data-perm-mode="user"
              ${this.canEdit ? "" : "disabled"}>
        <option value="" ${value === "" ? "selected" : ""}>ارثی از نقش</option>
        <option value="true" ${value === "true" ? "selected" : ""}>فعال</option>
        <option value="false" ${value === "false" ? "selected" : ""}>غیرفعال</option>
      </select>`;
  }

  // ============================================================
  // کمکی‌های وضعیت
  // ============================================================
  _matchQuery(item) {
    const q = this.roleQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) || item.key.toLowerCase().includes(q)
    );
  }

  _isChanged(key) {
    return (
      this.pendingRoleChanges.has(key) || this.pendingUserChanges.has(key)
    );
  }

  _roleValue(key) {
    if (this.pendingRoleChanges.has(key)) {
      return this.pendingRoleChanges.get(key);
    }
    return !!this.catalog?.matrix?.[this.activeRole]?.[key];
  }

  _userChoice(key) {
    if (this.pendingUserChanges.has(key)) return this.pendingUserChanges.get(key);
    const override = this.userState?.overrides?.[key];
    return typeof override === "boolean" ? override : null;
  }

  // ============================================================
  // زیرتب ۲: دسترسی کاربران
  // ============================================================
  renderUsersTab() {
    const picker = `
      <div class="perm-toolbar">
        <div class="perm-user-tools">
          <input type="search" id="permUserSearch" class="perm-search"
                 placeholder="جستجوی نام یا نام کاربری…" value="${escapeHtml(this.userQuery)}">
          <button class="perm-btn ghost" id="permUserSearchBtn">
            <i class="fas fa-search"></i> جستجو
          </button>
        </div>
        <div class="perm-note-small">
          سطح دسترسی هر کاربر = «نقش» + استثناهای همین صفحه.
        </div>
      </div>`;

    if (!this.userState) {
      return `${picker}
        ${this.renderUsersList()}
        <div class="perm-empty-small">
          برای مشاهده و تغییر، یک کاربر را انتخاب کنید.
        </div>`;
    }

    const state = this.userState;
    const roleTitle =
      state.roleTitles?.[state.user.role] ||
      this.catalog.roleTitles[state.user.role] ||
      state.user.role;
    const overridesCount = Object.keys(state.overrides || {}).length;
    const groups = this.catalog.groups
      .map((group) => this.renderGroup(group, "user"))
      .filter(Boolean)
      .join("");

    return `${picker}
      <div class="perm-users-list">${this.renderUsersList()}</div>
      <div class="perm-user-detail">
        <div class="perm-user-head">
          <div class="perm-user-id">
            <i class="fas fa-user-circle"></i>
            <strong>${escapeHtml(state.user.fullName || state.user.username || "کاربر")}</strong>
            <span class="perm-badge">${escapeHtml(roleTitle)}</span>
            <span class="perm-badge">${state.grantedCount} از ${state.total} مجوز</span>
            <span class="perm-badge ${overridesCount ? "on" : ""}">
              ${overridesCount} مورد سفارشی
            </span>
          </div>
          <button class="perm-btn ghost" id="permUserReset"
                  ${this.canEdit && overridesCount ? "" : "disabled"}>
            <i class="fas fa-rotate-left"></i> بازگردانی به سطح نقش
          </button>
        </div>
        <div class="perm-groups">${groups}</div>
      </div>`;
  }

  renderUsersList() {
    if (!this.users.length) {
      return `<div class="perm-empty-small">فهرست کاربران خالی است.</div>`;
    }
    const rows = this.users
      .map((user) => {
        const active = this.selectedUser?.id === user.id;
        const roleTitle = this.catalog.roleTitles[user.role] || user.role;
        return `
        <button class="perm-user-row ${active ? "active" : ""}" data-perm-user="${user.id}">
          <span class="perm-user-name">
            ${escapeHtml([user.first_name, user.last_name].filter(Boolean).join(" ") || user.username)}
          </span>
          <span class="perm-user-role">${escapeHtml(roleTitle)}</span>
          <span class="perm-user-status ${user.status === "active" ? "on" : "off"}">
            ${user.status === "active" ? "فعال" : "غیرفعال"}
          </span>
        </button>`;
      })
      .join("");
    return `<div class="perm-users-scroll">${rows}</div>`;
  }

  async loadUsers() {
    try {
      const response = await adminPanelApi.getUsers({ limit: 200 });
      const list = response?.data?.users || response?.data?.items || response?.data || [];
      this.users = Array.isArray(list) ? list : [];
    } catch (error) {
      console.warn("⚠️ دریافت فهرست کاربران ناموفق بود:", error?.message || error);
      this.users = [];
    }

    const target = this.container?.querySelector(".perm-users-list");
    if (target) target.innerHTML = this.renderUsersList();
  }

  // ============================================================
  // زیرتب ۳: گزارش تغییرات
  // ============================================================
  renderAuditTab() {
    return `<div class="perm-audit" id="permAudit">
      <div class="perm-empty-small">در حال بارگذاری گزارش…</div>
    </div>`;
  }

  async loadAudit() {
    const box = this.container?.querySelector("#permAudit");
    if (!box) return;

    try {
      const response = await permissionApi.getAudit({ limit: 50 });
      const items = response?.data?.items || [];

      if (!items.length) {
        box.innerHTML = `<div class="perm-empty-small">هنوز تغییر سطح دسترسی‌ای ثبت نشده است.</div>`;
        return;
      }

      const rows = items
        .map((item) => {
          const target =
            item.targetType === "role"
              ? this.catalog.roleTitles[item.targetId] || item.targetId
              : `کاربر #${item.targetId}`;
          const from = item.oldValue === null ? "—" : item.oldValue === "true" ? "فعال" : "غیرفعال";
          const to = item.newValue === null ? "پیش‌فرض" : item.newValue === "true" ? "فعال" : "غیرفعال";
          return `<tr>
            <td>${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString("fa-IR") : "—")}</td>
            <td>${escapeHtml(target)}</td>
            <td>${escapeHtml(item.permissionTitle || item.permissionKey || "بازنشانی گروهی")}</td>
            <td>${escapeHtml(from)}</td>
            <td>${escapeHtml(to)}</td>
          </tr>`;
        })
        .join("");

      box.innerHTML = `
        <table class="perm-table">
          <thead>
            <tr><th>زمان</th><th>هدف</th><th>دسترسی</th><th>مقدار قبلی</th><th>مقدار جدید</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } catch (error) {
      console.warn("⚠️ دریافت گزارش تغییرات ناموفق بود:", error?.message || error);
      box.innerHTML = `<div class="perm-empty-small">دریافت گزارش تغییرات ناموفق بود.</div>`;
    }
  }

  // ============================================================
  // ذخیره / انصراف
  // ============================================================
  async saveAll() {
    if (this.saving || !this.canEdit) return;
    if (!this.totalPending) return;

    this.saving = true;
    const saveBtn = this.container?.querySelector("#permSaveAll");
    if (saveBtn) saveBtn.disabled = true;

    try {
      // ===== ۱) تغییرات نقش =====
      if (this.pendingRoleChanges.size) {
        const updates = Array.from(this.pendingRoleChanges, ([key, allowed]) => ({
          key,
          allowed,
        }));
        const response = await permissionApi.updateRole(this.activeRole, updates);
        if (!response?.success) {
          throw new Error(response?.message || "ذخیرهٔ سطح دسترسی نقش ناموفق بود");
        }
        if (response.data?.matrix) this.catalog.matrix = response.data.matrix;
        this.pendingRoleChanges.clear();
      }

      // ===== ۲) تغییرات کاربر =====
      if (this.pendingUserChanges.size && this.selectedUser?.id) {
        const updates = Array.from(this.pendingUserChanges, ([key, allowed]) => ({
          key,
          allowed,
        }));
        const response = await permissionApi.updateUser(this.selectedUser.id, updates);
        if (!response?.success) {
          throw new Error(response?.message || "ذخیرهٔ دسترسی کاربر ناموفق بود");
        }
        this.pendingUserChanges.clear();
        if (response.data?.state) {
          this.userState = { ...this.userState, ...response.data.state };
        }
      }

      // اگر تغییر روی دسترسی خودِ کاربر جاری اثر داشته، از سرور تازه کن
      await permissionService.refresh();

      notificationService.success("سطوح دسترسی ذخیره شد");
      this.render();
    } catch (error) {
      console.error("❌ خطا در ذخیرهٔ سطوح دسترسی:", error);
      notificationService.error(error.message || "ذخیرهٔ سطوح دسترسی ناموفق بود");
      if (saveBtn) saveBtn.disabled = false;
    } finally {
      this.saving = false;
    }
  }

  discardAll() {
    this.pendingRoleChanges.clear();
    this.pendingUserChanges.clear();
    notificationService.info("تغییرات ذخیره‌نشده پاک شد");
    this.render();
  }

  async resetRole() {
    const confirmed = await notificationService.confirm({
      title: "بازگردانی سطح دسترسی نقش",
      text: `همهٔ تغییرات نقش «${this.catalog.roleTitles[this.activeRole]}» به پیش‌فرض سیستم برگردد؟`,
      confirmText: "بله، بازگردان",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const response = await permissionApi.resetRole(this.activeRole);
      if (!response?.success) throw new Error(response?.message);
      if (response.data?.matrix) this.catalog.matrix = response.data.matrix;
      this.pendingRoleChanges.clear();
      notificationService.success("سطح دسترسی نقش بازگردانی شد");
      this.render();
    } catch (error) {
      notificationService.error(error.message || "بازگردانی ناموفق بود");
    }
  }

  async resetUser() {
    if (!this.selectedUser?.id) return;

    const confirmed = await notificationService.confirm({
      title: "بازگردانی دسترسی کاربر",
      text: "همهٔ موارد سفارشی این کاربر حذف و به سطح نقش برگردد؟",
      confirmText: "بله، بازگردان",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const response = await permissionApi.resetUser(this.selectedUser.id);
      if (!response?.success) throw new Error(response?.message);
      this.pendingUserChanges.clear();
      this.pendingRoleChanges.clear();
      await this.selectUser(this.selectedUser.id);
      notificationService.success("دسترسی‌های کاربر بازگردانی شد");
    } catch (error) {
      notificationService.error(error.message || "بازگردانی ناموفق بود");
    }
  }

  // ============================================================
  // انتخاب کاربر (بارگذاری استثناهای اختصاصی او)
  // ============================================================
  async selectUser(userId) {
    this.pendingUserChanges.clear();
    this.userState = null;
    this.selectedUser = { id: userId };
    this.render();

    try {
      const response = await permissionApi.getUser(userId);
      if (!response?.success) {
        notificationService.error(response?.message || "دریافت دسترسی کاربر ناموفق بود");
        return;
      }
      this.userState = response.data;
      this.selectedUser = response.data.user;
      this.render();
    } catch (error) {
      console.error("❌ خطا در دریافت دسترسی کاربر:", error);
      notificationService.error("دریافت دسترسی کاربر ناموفق بود");
    }
  }

  // ============================================================
  // رویدادها
  // ============================================================
  bindEvents() {
    const root = this.container;
    if (!root) return;

    // زیرتب‌ها
    root.querySelectorAll("[data-perm-tab]").forEach((btn) =>
      btn.addEventListener("click", () => {
        this.activeTab = btn.dataset.permTab;
        this.render();
      }),
    );

    // انتخاب نقش (با هشدار در صورت وجود تغییر ذخیره‌نشده)
    root.querySelectorAll("[data-perm-role]").forEach((btn) =>
      btn.addEventListener("click", () => this.switchRole(btn.dataset.permRole)),
    );

    // جستجو + «فقط تغییرات»
    const roleSearch = root.querySelector("#permRoleSearch");
    if (roleSearch) {
      roleSearch.addEventListener("input", () => {
        this.roleQuery = roleSearch.value;
        this._rerenderFocus("#permRoleSearch");
      });
    }
    const onlyDiff = root.querySelector("#permOnlyDiff");
    if (onlyDiff) {
      onlyDiff.addEventListener("change", () => {
        this.onlyDiff = onlyDiff.checked;
        this.render();
      });
    }

    // سوییچ‌های نقش
    root.querySelectorAll('input[data-perm-mode="role"]').forEach((input) =>
      input.addEventListener("change", () => {
        const key = input.dataset.permKey;
        const stored = !!this.catalog.matrix?.[this.activeRole]?.[key];
        if (input.checked === stored) this.pendingRoleChanges.delete(key);
        else this.pendingRoleChanges.set(key, input.checked);

        input
          .closest(".perm-item")
          ?.classList.toggle("changed", this._isChanged(key));
        this._refreshPendingUi();
      }),
    );

    // سوییچ‌های سه‌حالتهٔ کاربر
    root.querySelectorAll('select[data-perm-mode="user"]').forEach((select) =>
      select.addEventListener("change", () => {
        const key = select.dataset.permKey;
        const value = select.value === "" ? null : select.value === "true";
        const stored = this.userState?.overrides?.[key];
        const storedValue = typeof stored === "boolean" ? stored : null;
        if (value === storedValue) this.pendingUserChanges.delete(key);
        else this.pendingUserChanges.set(key, value);

        select
          .closest(".perm-item")
          ?.classList.toggle("changed", this._isChanged(key));
        this._refreshPendingUi();
      }),
    );

    // انتخاب کاربر
    this.bindUserRows();

    // جستجوی کاربر (فیلتر محلی روی فهرست بارگذاری‌شده)
    const userSearch = root.querySelector("#permUserSearch");
    const applyUserSearch = () => {
      this.userQuery = userSearch?.value || "";
      this._filterUsers();
    };
    if (userSearch) {
      userSearch.addEventListener("input", applyUserSearch);
      userSearch.addEventListener("keydown", (event) => {
        if (event.key === "Enter") applyUserSearch();
      });
    }
    root
      .querySelector("#permUserSearchBtn")
      ?.addEventListener("click", applyUserSearch);

    // فوتر و دکمه‌ها
    root
      .querySelector("#permSaveAll")
      ?.addEventListener("click", () => this.saveAll());
    root
      .querySelector("#permDiscard")
      ?.addEventListener("click", () => this.discardAll());
    root
      .querySelector("#permRoleReset")
      ?.addEventListener("click", () => this.resetRole());
    root
      .querySelector("#permUserReset")
      ?.addEventListener("click", () => this.resetUser());
  }

  // ============================================================
  // کمکی‌های رفتار UI
  // ============================================================
  bindUserRows() {
    this.container?.querySelectorAll("[data-perm-user]").forEach((row) =>
      row.addEventListener("click", () =>
        this.selectUser(Number(row.dataset.permUser)),
      ),
    );
  }

  async switchRole(role) {
    if (role === this.activeRole) return;

    if (this.pendingRoleChanges.size) {
      const confirmed = await notificationService.confirm({
        title: "تغییرات ذخیره‌نشده",
        text: "تغییرات این نقش ذخیره نشده است. با تغییر نقش پاک شود؟",
        confirmText: "بله، تغییر بده",
      });
      if (!confirmed) return;
    }

    this.pendingRoleChanges.clear();
    this.activeRole = role;
    this.roleQuery = "";
    this.render();
  }

  _rerenderFocus(selector) {
    const element = this.container?.querySelector(selector);
    const caret = element?.selectionStart;
    this.render();
    const next = this.container?.querySelector(selector);
    if (next) {
      next.focus();
      if (typeof caret === "number" && next.setSelectionRange) {
        next.setSelectionRange(caret, caret);
      }
    }
  }

  _filterUsers() {
    const query = this.userQuery.trim().toLowerCase();
    const boxes = this.container?.querySelectorAll(".perm-users-list");
    if (!boxes?.length) return;

    const filtered = this.users.filter((user) => {
      if (!query) return true;
      return [
        user.first_name,
        user.last_name,
        user.username,
        this.catalog.roleTitles[user.role] || user.role,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    const previous = this.users;
    this.users = filtered;
    const inner = this.renderUsersList();
    this.users = previous;

    boxes.forEach((box) => {
      box.innerHTML = inner;
    });
    this.bindUserRows();
  }

  _refreshPendingUi() {
    const text = `${this.totalPending} تغییر ذخیره‌نشده`;
    const badge = this.container?.querySelector("#permPendingBadge");
    if (badge) badge.textContent = text;
    const pending = this.container?.querySelector(".perm-pending");
    if (pending) pending.textContent = text;
    const saveBtn = this.container?.querySelector("#permSaveAll");
    if (saveBtn) saveBtn.disabled = !this.totalPending;
  }
}

export const permissionManager = new PermissionManager();

if (typeof window !== "undefined") {
  window.permissionManager = permissionManager;
  window.PermissionManager = PermissionManager;
}

