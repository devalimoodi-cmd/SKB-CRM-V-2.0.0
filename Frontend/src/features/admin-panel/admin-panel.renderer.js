import { formatDate } from "../../core/utils/date.utils.js";
import { escapeHtml} from "../../core/utils/string.utils.js";

// ===== موج ۱۲.۴.۱ — دکمهٔ «تاریخچهٔ تغییرات» هر کاربر =====
//   ⚠️ گیت با کلید محتوایی users.activity.view است (نه کلید منو)؛
//      سرور هم همان کلید را روی /api/activity اعمال می‌کند.
//   ⚠️ fail-open: اگر دادهٔ مجوز هنوز نرسیده باشد دکمه نمایش داده
//      می‌شود و در بدترین حالت سرور پاسخ ۴۰۳ می‌دهد (هم‌الگوی پنل).
const canViewUserHistory = () => {
  const service = typeof window === "undefined" ? null : window.permissionService;
  if (!service || typeof service.can !== "function") return false;
  if (typeof service.hasData === "function" && service.hasData()) {
    return service.can("users.activity.view");
  }
  return true;
};

const historyButton = (user) =>
  canViewUserHistory()
    ? `<button class="action-btn history" onclick="window.showUserHistory(${Number(user?.id) || 0})" title="تاریخچهٔ تغییرات این کاربر">
                                <i class="fas fa-clock-rotate-left"></i>
                            </button>`
    : "";

export const adminPanelRenderer = {
  // ===== رندر جدول مدیران اصلی =====

  renderSuperAdminsTable(users) {
    const tbody = document.getElementById("superAdminTableBody");
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10" style="text-align: center;">هیچ مدیر اصلی یافت نشد</td></tr>';
      return;
    }

    let html = "";
    users.forEach((user, index) => {
      const statusClass = user.active !== false ? "active" : "inactive";
      const statusText = user.active !== false ? "فعال" : "غیرفعال";
      const onlineClass = user.online_status === true ? "online" : "offline";

      html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="customer-avatar ${onlineClass}" style="width:35px;height:35px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, var(--indigo, #667eea) 0%, #764ba2 100%);">
                            ${
                              user.profile_image
                                ? `<img src="${window.API_URL}${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                                : `<i class="fas fa-crown" style="color:white;font-size:16px;"></i>`
                            }
                        </div>
                    </td>
                    <td>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.email) || "-"}</td>
                    <td>${escapeHtml(user.mobile_number) || "-"}</td>
                    <td><span class="role-badge super-admin">مدیر اصلی</span></td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${user.createdAt ? formatDate(user.createdAt) : "-"}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewUser(${user.id})" title="مشاهده">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${historyButton(user)}
                            <button class="action-btn edit" onclick="window.editSuperAdmin(${user.id})" title="ویرایش">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="window.deleteSuperAdmin(${user.id})" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                            <button class="action-btn ${user.active !== false ? "disable" : "enable"}" 
                                    onclick="window.toggleSuperAdminStatus(${user.id}, ${user.active !== false})" 
                                    title="${user.active !== false ? "غیرفعال" : "فعال"} سازی">
                                <i class="fas ${user.active !== false ? "fa-toggle-on" : "fa-toggle-off"}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    });

    tbody.innerHTML = html;
  },

  // ===== رندر جدول کاربران عادی =====

  renderUsersTable(users) {
    const tbody = document.getElementById("usersTableBody");
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10" style="text-align: center;">هیچ کاربری یافت نشد</td></tr>';
      return;
    }

    let html = "";
    users.forEach((user, index) => {
      const roleClass = this.getRoleClass(user.role);
      const roleText = this.getRoleText(user.role);
      const statusClass = user.status || "active";
      const statusText = this.getStatusText(statusClass);
      const onlineClass = user.online_status === true ? "online" : "offline";

      const isSubAdmin = user.role === "sub_admin" || user.role === "expert";

      html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>
                        <div class="customer-avatar ${onlineClass}" style="width:35px;height:35px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--c-f0f0f0, #f0f0f0);">
                            ${
                              user.profile_image
                                ? `<img src="${window.API_URL}${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                                : `<i class="fas fa-user" style="color:var(--c-888, #888);font-size:16px;"></i>`
                            }
                        </div>
                    </td>
                    <td>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td>${escapeHtml(user.email) || "-"}</td>
                    <td>${escapeHtml(user.mobile_number) || "-"}</td>
                    <td>
                        <span class="role-badge ${roleClass}">${roleText}</span>
                        ${this.renderCustomerLinkBadge(user)}
                    </td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${user.createdAt ? formatDate(user.createdAt) : "-"}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewUser(${user.id})" title="مشاهده">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${historyButton(user)}
                            <button class="action-btn edit" onclick="window.editUser(${user.id})" title="ویرایش">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete" onclick="window.deleteUser(${user.id})" title="حذف">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                            ${
                              isSubAdmin
                                ? `
                                <button class="action-btn reset-token" onclick="window.resetUserToken(${user.id})" title="بازنشانی توکن">
                                    <i class="fas fa-key"></i>
                                </button>
                                <button class="action-btn view-token" onclick="window.viewUserToken(${user.id})" title="مشاهده توکن">
                                    <i class="fas fa-ticket-alt"></i>
                                </button>
                            `
                                : ""
                            }
                        </div>
                    </td>
                </tr>
            `;
    });

    tbody.innerHTML = html;
  },

  // ===== رندر پیام‌های چت =====
  // (حذف شد: «چت عمومی» با «نظرات و پیشنهادات» جایگزین شده و رندر آن
  //  از طریق messagesService.renderBubbles انجام می‌شود)

  // ===== مودال توکن =====

  showTokenModal(token, user) {
    const modal = document.getElementById("tokenDisplayModal");
    if (!modal) return;

    document.getElementById("tokenUserName").innerText = user
      ? `${user.first_name} ${user.last_name}`
      : "کاربر";
    document.getElementById("tokenUserRole").innerText = user
      ? this.getRoleText(user.role)
      : "-";
    document.getElementById("tokenValue").innerText = token;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  },

  // ===== فرم کاربر =====

  getUserFormData() {
    const role = document.getElementById("role")?.value || "expert";
    // ✅ فاز ۱۳.۰: پروندهٔ مشتری فقط برای نقش «مشتری» ارسال می‌شود
    const customerValue = document.getElementById("customerLink")?.value || "";

    return {
      first_name: document.getElementById("firstName")?.value || "",
      last_name: document.getElementById("lastName")?.value || "",
      username: document.getElementById("username")?.value || "",
      email: document.getElementById("email")?.value || "",
      password: document.getElementById("password")?.value || "",
      mobile_number: document.getElementById("mobile")?.value || "",
      role,
      status: document.getElementById("status")?.value || "active",
      customer_id: role === "customer" ? customerValue || null : null,
    };
  },

  fillUserForm(user) {
    document.getElementById("firstName").value = user.first_name || "";
    document.getElementById("lastName").value = user.last_name || "";
    document.getElementById("username").value = user.username || "";
    document.getElementById("email").value = user.email || "";
    document.getElementById("password").value = "";
    document.getElementById("mobile").value = user.mobile_number || "";
    document.getElementById("role").value = user.role || "expert";
    document.getElementById("status").value = user.status || "active";

    // ✅ فاز ۱۳.۰: پروندهٔ مشتریِ متصل (اگر گزینه در لیست نبود، اضافه می‌شود
    //    تا مقدار فعلی هرگز در فرم «گم» نشود)
    const customerSelect = document.getElementById("customerLink");
    if (customerSelect) {
      const current = user.customer_id ? String(user.customer_id) : "";

      if (
        current &&
        ![...customerSelect.options].some((option) => option.value === current)
      ) {
        const option = document.createElement("option");
        option.value = current;
        option.textContent = this.customerOptionLabel(user.customer, current);
        customerSelect.add(option);
      }

      customerSelect.value = current;
      this.setCustomerLinkVisibility(user.role === "customer");
    }

    const customerSearch = document.getElementById("customerSearch");
    if (customerSearch) customerSearch.value = "";

    // عکس پروفایل
    const preview = document.getElementById("profilePreviewImg");
    if (preview && user.profile_image) {
      preview.src = `${window.API_URL}${user.profile_image}`;
      preview.style.display = "block";
      document.querySelector("#profilePreview i")?.style.display("none");
    }
  },

  resetUserForm(role = null) {
    [
      "firstName",
      "lastName",
      "username",
      "email",
      "password",
      "mobile",
      "customerSearch",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const roleSelect = document.getElementById("role");
    if (roleSelect) {
      roleSelect.value = role || "expert";
      roleSelect.disabled = !!role;
    }

    const statusSelect = document.getElementById("status");
    if (statusSelect) {
      statusSelect.value = "active";
    }

    // ✅ فاز ۱۳.۰: پاک‌کردن انتخاب پروندهٔ مشتری (فقط گزینهٔ پیش‌فرض می‌ماند)
    const customerSelect = document.getElementById("customerLink");
    if (customerSelect) {
      customerSelect.value = "";
    }
    this.setCustomerLinkVisibility((role || "expert") === "customer");

    // ریست عکس
    const preview = document.getElementById("profilePreviewImg");
    if (preview) {
      preview.style.display = "none";
      preview.src = "";
    }
  },

  // ===== ✅ «پروندهٔ مشتری» (فاز ۱۳.۰) =====

  // نشان «پروندهٔ مشتری» در ردیف جدول کاربران (فقط برای نقش مشتری)
  renderCustomerLinkBadge(user) {
    if (user?.role !== "customer") return "";

    const linked = Number(user.customer_id) > 0;
    const label = !linked
      ? "بدون پروندهٔ مشتری"
      : user.customer?.full_name
        ? this.customerOptionLabel(user.customer, user.customer_id)
        : `مشتری #${user.customer_id}`;

    const badgeClass = linked ? "customer" : "expert";
    return `<span class="role-badge ${badgeClass}" title="پروندهٔ مشتری" style="margin-top:4px;display:inline-block;">${escapeHtml(label)}</span>`;
  },

  // برچسب فارسی یک گزینهٔ مشتری: «نام (کد ۱۰۰۱)»
  customerOptionLabel(customer, fallbackId = "") {
    const name = customer?.full_name || `مشتری #${fallbackId || "?"}`;
    const code =
      customer?.customer_code !== undefined && customer?.customer_code !== null
        ? ` (کد ${customer.customer_code})`
        : "";
    return `${name}${code}`;
  },

  // پرکردن فهرست انتخاب مشتری (مقدار انتخاب‌شدهٔ فعلی حفظ می‌شود)
  renderCustomerOptions(customers = []) {
    const select = document.getElementById("customerLink");
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '<option value="">— انتخاب پروندهٔ مشتری —</option>';

    (customers || []).forEach((customer) => {
      if (!customer?.id) return;
      const option = document.createElement("option");
      option.value = String(customer.id);
      option.textContent = this.customerOptionLabel(customer);
      select.add(option);
    });

    // اگر مقدار قبلی در فهرست جدید نبود، دور ریخته نشود (حالت ویرایش)
    if (previous && ![...select.options].some((o) => o.value === previous)) {
      const option = document.createElement("option");
      option.value = previous;
      option.textContent = `مشتری #${previous}`;
      select.add(option);
    }
    select.value = previous;
  },

  // نمایش/پنهان‌کردن بلوک «پروندهٔ مشتری» بر اساس نقش
  setCustomerLinkVisibility(isCustomer) {
    const group = document.getElementById("customerLinkGroup");
    if (group) group.style.display = isCustomer ? "" : "none";
  },

  // ===== توابع کمکی =====

  getRoleClass(role) {
    const map = {
      super_admin: "super-admin",
      admin: "admin",
      sub_admin: "sub-admin",
      expert: "expert",
      customer: "customer",
    };
    return map[role] || "customer";
  },

  getRoleText(role) {
    const map = {
      super_admin: "مدیر اصلی",
      admin: "مدیر",
      sub_admin: "مدیر میانی",
      expert: "کارشناس",
      customer: "مشتری",
    };
    return map[role] || "کاربر";
  },

  getStatusText(status) {
    const map = {
      active: "فعال",
      inactive: "غیرفعال",
      pending: "در انتظار",
    };
    return map[status] || status;
  },

  // ✅ موج ۱۳.۶ — «درخواست‌های ثبت‌نام»: رندر صف
  // ------------------------------------------------------------
  // ⚠️ همهٔ متن‌ها با escapeHtml می‌آیند (دادهٔ کاربر مهمان و غیرقابل‌اعتماد).
  // ⚠️ دکمه‌ها فقط با مجوز تأیید نمایش داده می‌شوند (fail-open هم‌الگوی پنل).
  canReviewRegistrations() {
    const service = typeof window === "undefined" ? null : window.permissionService;
    if (!service || typeof service.can !== "function") return false;
    if (typeof service.hasData === "function" && service.hasData()) {
      return service.can("users.registrations.review");
    }
    return true;
  },

  registrationStatusBadge(status) {
    const map = {
      pending: { label: "در انتظار تأیید", className: "pending" },
      approved: { label: "تأییدشده", className: "active" },
      rejected: { label: "ردشده", className: "inactive" },
    };
    const item = map[status] || { label: status || "-", className: "inactive" };
    return `<span class="regq-badge ${item.className}">${escapeHtml(item.label)}</span>`;
  },

  renderRegistrationRequests(items = []) {
    const container = document.getElementById("registrationQueueContainer");
    if (!container) return;

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `
        <div class="regq-empty">
          <i class="fas fa-inbox" style="font-size:26px;"></i>
          <p style="margin:8px 0 0;font-size:13px;">درخواستی برای نمایش نیست.</p>
        </div>`;
      return;
    }

    const canReview = this.canReviewRegistrations();

    const rows = items
      .map((item) => {
        const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim();
        const created = item.created_at ? formatDate(item.created_at) : "-";
        const customerCode = item.requested_customer_code || "-";
        const note = item.note ? escapeHtml(item.note) : "—";
        const rejectReason = item.reject_reason
          ? `<div class="regq-reason"><i class="fas fa-circle-info"></i> ${escapeHtml(
              item.reject_reason,
            )}</div>`
          : "";

        // ✅ موج ۱۳.۷ — پروندهٔ متصل پس از تأیید (و اینکه تازه ساخته شده یا نه)
        const linkedCustomer = item.created_customer_id
          ? `<div class="regq-meta"><span><i class="fas fa-folder-open"></i> پروندهٔ متصل: #${Number(
              item.created_customer_id,
            )}${item.customer_created ? " (تازه ساخته شد)" : ""}</span></div>`
          : "";

        // ✅ موج ۱۳.۷.۳ — بج «تأیید خودکار» (بدون بازبینی مدیر)
        const autoBadge = item.auto_approved === true
          ? '<span class="regq-badge auto" title="این درخواست بدون بازبینی مدیر تأیید شد"><i class="fas fa-bolt"></i> تأیید خودکار</span>'
          : "";

        // ✅ موج ۱۳.۷.۳ — چرا تأیید خودکار انجام نشد؟ (ردیف در صف مانده است)
        const autoError = item.auto_approve_error
          ? `<div class="regq-auto-error"><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(
              item.auto_approve_error,
            )}</div>`
          : "";

        const actions = canReview && item.status === "pending"
          ? `<div class="regq-row-actions">
               <button type="button" class="regq-icon-btn approve" title="تأیید و ساخت حساب"
                 onclick="window.adminPanelService?.openRegistrationReview(${Number(item.id)}, 'approve')">
                 <i class="fas fa-circle-check"></i>
               </button>
               <button type="button" class="regq-icon-btn reject" title="رد درخواست"
                 onclick="window.adminPanelService?.openRegistrationReview(${Number(item.id)}, 'reject')">
                 <i class="fas fa-ban"></i>
               </button>
             </div>`
          : `<span class="regq-muted">—</span>`;

        return `
          <div class="regq-row" data-registration-id="${Number(item.id)}">
            <div class="regq-main">
              <div class="regq-name">
                ${escapeHtml(fullName || item.username || "بدون نام")}
                ${this.registrationStatusBadge(item.status)}
                ${autoBadge}
              </div>
              <div class="regq-meta">
                <span><i class="fas fa-user"></i> ${escapeHtml(item.username || "-")}</span>
                <span><i class="fas fa-mobile-screen"></i> ${escapeHtml(
                  item.mobile_masked || item.mobile_number || "-",
                )}</span>
                <span><i class="fas fa-envelope"></i> ${escapeHtml(item.email || "-")}</span>
              </div>
              <div class="regq-meta">
                <span><i class="fas fa-id-card"></i> پروندهٔ ادعاشده: ${escapeHtml(customerCode)}</span>
                <span><i class="fas fa-calendar"></i> ${escapeHtml(created)}</span>
              </div>
              ${linkedCustomer}
              <div class="regq-note"><i class="fas fa-comment-dots"></i> ${note}</div>
              ${autoError}
              ${rejectReason}
            </div>
            ${actions}
          </div>`;
      })
      .join("");

    container.innerHTML = `<div class="regq-list">${rows}</div>`;
  },

  // پرکردن گزینه‌های «پروندهٔ مشتری» در مودال تأیید
  renderRegistrationCustomerOptions(customers = []) {
    const select = document.getElementById("regCustomerSelect");
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '<option value="">— انتخاب پروندهٔ مشتری (الزامی) —</option>';

    (customers || []).forEach((customer) => {
      if (!customer?.id) return;
      const option = document.createElement("option");
      option.value = String(customer.id);
      option.textContent = this.customerOptionLabel(customer);
      select.add(option);
    });

    if (previous) select.value = previous;
  },

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};
