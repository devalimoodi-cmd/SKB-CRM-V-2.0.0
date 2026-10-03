// ============================================================
// features/profile/profile.renderer.js
// رندر بخش‌های صفحهٔ «پروفایل من»
// ============================================================
import { escapeHtml, toPersianNumber } from "../../core/utils/string.utils.js";

const ROLE_TEXT = {
  super_admin: "مدیر اصلی",
  admin: "مدیر",
  sub_admin: "مدیر میانی",
  expert: "کارشناس",
  customer: "مشتری",
};

const STATUS_TEXT = {
  active: "فعال",
  inactive: "غیرفعال",
  pending: "در انتظار تأیید",
  blocked: "مسدود",
};

// تبدیل تاریخ ISO به تاریخ/ساعت شمسی
const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return date.toLocaleString("fa-IR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toLocaleString();
  }
};

class ProfileRenderer {
  getFullName(user) {
    if (!user) return "کاربر";
    if (user.fullName) return user.fullName;
    const name = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    return name || user.username || "کاربر";
  }

  // ===== سرصفحه =====
  renderHero(user) {
    if (!user) return;
    const fullName = this.getFullName(user);

    const nameEl = document.getElementById("profileName");
    if (nameEl) nameEl.textContent = fullName;

    const usernameEl = document.getElementById("profileUsername");
    if (usernameEl) usernameEl.textContent = user.username || "—";

    const lastLoginEl = document.getElementById("profileLastLogin");
    if (lastLoginEl) lastLoginEl.textContent = formatDateTime(user.last_login);

    const avatar = document.getElementById("profileAvatar");
    if (avatar) {
      const url =
        user.profile_image && String(user.profile_image).trim()
          ? user.profile_image
          : "/assets/images/default-avatar.png";
      avatar.src = url;
      avatar.alt = fullName;
      avatar.onerror = () => {
        avatar.src = "/assets/images/default-avatar.png";
      };
    }

    const badges = document.getElementById("profileBadges");
    if (badges) {
      const roleTitle = ROLE_TEXT[user.role] || "کاربر";
      const statusTitle = STATUS_TEXT[user.status] || user.status || "—";
      badges.innerHTML = `
        <span class="account-badge"><i class="fas fa-user-tag"></i>${escapeHtml(roleTitle)}</span>
        <span class="account-badge"><i class="fas fa-circle-check"></i>${escapeHtml(statusTitle)}</span>
      `;
    }
  }

  // ===== پر کردن فرم =====
  fillForm(user) {
    if (!user) return;
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? "";
    };
    set("pfFirstName", user.first_name);
    set("pfLastName", user.last_name);
    set("pfMobile", user.mobile_number);
    set("pfEmail", user.email);
    set("pfPhone", user.phone_number);
    set("pfUsername", user.username);
    set("pfAddress", user.address);
    set("pfBio", user.bio);
  }

  // ===== خواندن فرم =====
  readForm() {
    const get = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : "";
    };
    return {
      first_name: get("pfFirstName"),
      last_name: get("pfLastName"),
      mobile_number: get("pfMobile"),
      email: get("pfEmail"),
      phone_number: get("pfPhone"),
      username: get("pfUsername"),
      address: get("pfAddress"),
      bio: get("pfBio"),
    };
  }

  setMobileError(message) {
    const hint = document.getElementById("pfMobileHint");
    if (!hint) return;
    hint.textContent = message || "";
    hint.classList.toggle("account-hint--error", Boolean(message));
  }

  setBusy(isBusy) {
    const saveBtn = document.getElementById("profileSaveBtn");
    const resetBtn = document.getElementById("profileResetBtn");
    if (saveBtn) {
      saveBtn.disabled = isBusy;
      saveBtn.innerHTML = isBusy
        ? '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره…'
        : '<i class="fas fa-save"></i> ذخیره تغییرات';
    }
    if (resetBtn) resetBtn.disabled = isBusy;
  }

  // ===== اطلاعات حساب =====
  renderAccountInfo(user) {
    const box = document.getElementById("profileAccountInfo");
    if (!box || !user) return;

    const rows = [
      ["نام کاربری", user.username || "—"],
      ["ایمیل", user.email || "—"],
      ["موبایل", user.mobile_number || "—"],
      ["نقش", ROLE_TEXT[user.role] || user.role || "—"],
      ["وضعیت", STATUS_TEXT[user.status] || user.status || "—"],
      ["تاریخ عضویت", formatDateTime(user.created_at)],
      ["آخرین ورود", formatDateTime(user.last_login)],
    ];

    box.innerHTML = rows
      .map(
        ([key, value]) => `
      <div class="account-kv">
        <span class="account-kv__key">${escapeHtml(key)}</span>
        <span class="account-kv__val account-kv__val--ltr">${escapeHtml(value)}</span>
      </div>`,
      )
      .join("");
  }

  // ===== دسترسی‌ها =====
  renderPermissions(data) {
    const box = document.getElementById("profilePermissions");
    if (!box) return;

    if (!data) {
      box.innerHTML =
        '<div class="account-empty">اطلاعات دسترسی در دسترس نیست</div>';
      return;
    }

    const granted = Array.isArray(data.permissions)
      ? data.permissions.length
      : 0;
    const total = Number(data.total) || granted;
    const deniedTitles = data.deniedTitles || {};
    const deniedList = Object.values(deniedTitles);

    const summary = `
      <div class="account-kv" style="width:100%;">
        <span class="account-kv__key">نقش شما</span>
        <span class="account-kv__val account-kv__val--rtl">${escapeHtml(
          data.roleTitle || ROLE_TEXT[data.role] || "—",
        )}</span>
      </div>
      <div class="account-kv" style="width:100%;">
        <span class="account-kv__key">قابلیت‌های فعال</span>
        <span class="account-kv__val account-kv__val--rtl">${toPersianNumber(
          granted,
        )} از ${toPersianNumber(total)}</span>
      </div>`;

    const chips = deniedList.length
      ? deniedList
          .slice(0, 12)
          .map(
            (title) =>
              `<span class="account-chip account-chip--muted"><i class="fas fa-lock"></i>${escapeHtml(
                title,
              )}</span>`,
          )
          .join("") +
        (deniedList.length > 12
          ? `<span class="account-chip account-chip--muted">+${toPersianNumber(
              deniedList.length - 12,
            )}</span>`
          : "")
      : '<span class="account-chip"><i class="fas fa-check"></i>همهٔ قابلیت‌ها فعال است</span>';

    box.innerHTML = `${summary}<div class="account-chips" style="margin-top:14px;">${chips}</div>`;
  }
}

export const profileRenderer = new ProfileRenderer();

if (typeof window !== "undefined") {
  window.profileRenderer = profileRenderer;
}

