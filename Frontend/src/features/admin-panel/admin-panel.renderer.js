import { formatDate } from "../../core/utils/date.utils.js";
import { getDefaultAvatar } from "../../core/utils/string.utils.js";

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
                        <div class="customer-avatar ${onlineClass}" style="width:35px;height:35px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            ${
                              user.profile_image
                                ? `<img src="${window.API_URL}${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                                : `<i class="fas fa-crown" style="color:white;font-size:16px;"></i>`
                            }
                        </div>
                    </td>
                    <td>${user.first_name} ${user.last_name}</td>
                    <td>${user.username}</td>
                    <td>${user.email || "-"}</td>
                    <td>${user.mobile_number || "-"}</td>
                    <td><span class="role-badge super-admin">مدیر اصلی</span></td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${user.createdAt ? formatDate(user.createdAt) : "-"}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewUser(${user.id})" title="مشاهده">
                                <i class="fas fa-eye"></i>
                            </button>
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
                        <div class="customer-avatar ${onlineClass}" style="width:35px;height:35px;margin:0 auto;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#f0f0f0;">
                            ${
                              user.profile_image
                                ? `<img src="${window.API_URL}${user.profile_image}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
                                : `<i class="fas fa-user" style="color:#888;font-size:16px;"></i>`
                            }
                        </div>
                    </td>
                    <td>${user.first_name} ${user.last_name}</td>
                    <td>${user.username}</td>
                    <td>${user.email || "-"}</td>
                    <td>${user.mobile_number || "-"}</td>
                    <td><span class="role-badge ${roleClass}">${roleText}</span></td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${user.createdAt ? formatDate(user.createdAt) : "-"}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewUser(${user.id})" title="مشاهده">
                                <i class="fas fa-eye"></i>
                            </button>
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

  renderChatMessages(messages) {
    const container = document.getElementById("chatMessages");
    if (!container) return;

    if (!messages || messages.length === 0) {
      container.innerHTML = `
                <div style="text-align: center; color: #888; padding: 20px;">
                    <i class="fas fa-comments" style="font-size: 30px; display: block; margin-bottom: 10px;"></i>
                    <span>هیچ پیامی وجود ندارد. اولین پیام را شما بفرستید!</span>
                </div>
            `;
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const currentUserId = currentUser?.id;

    let html = "";
    messages.forEach((msg) => {
      const isMine = msg.sender_id === currentUserId;
      const senderName =
        msg.sender_name ||
        (msg.sender
          ? `${msg.sender.first_name} ${msg.sender.last_name}`
          : "کاربر");
      const time = new Date(msg.created_at).toLocaleTimeString("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      html += `
                <div class="chat-bubble ${isMine ? "me" : "other"}">
                    <div><strong class="chat-sender">${isMine ? "من" : senderName}</strong></div>
                    <div>${this.escapeHtml(msg.content)}</div>
                    <div class="chat-meta"><span>${time}</span></div>
                </div>
            `;
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  },

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
    return {
      first_name: document.getElementById("firstName")?.value || "",
      last_name: document.getElementById("lastName")?.value || "",
      username: document.getElementById("username")?.value || "",
      email: document.getElementById("email")?.value || "",
      password: document.getElementById("password")?.value || "",
      mobile_number: document.getElementById("mobile")?.value || "",
      role: document.getElementById("role")?.value || "expert",
      status: document.getElementById("status")?.value || "active",
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

    // ریست عکس
    const preview = document.getElementById("profilePreviewImg");
    if (preview) {
      preview.style.display = "none";
      preview.src = "";
    }
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

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
};
