// ============================================================
// features/settings/settings.renderer.js
// رندر و به‌روزرسانی کنترل‌های صفحهٔ «تنظیمات حساب»
// ============================================================
class SettingsRenderer {
  // انتخاب تم
  renderTheme(theme) {
    const seg = document.getElementById("settingsThemeSeg");
    if (!seg) return;
    seg.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeValue === theme);
    });
  }

  renderSelect(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined) el.value = value;
  }

  renderToggles(prefs) {
    const toast = document.getElementById("prefToastEnabled");
    if (toast) toast.checked = prefs.toastEnabled !== false;
    const notify = document.getElementById("prefNotifyMessages");
    if (notify) notify.checked = prefs.notifyMessages !== false;
  }

  // وضعیت ذخیره‌سازی (سرور یا مرورگر)
  setStorageStatus(text) {
    const el = document.getElementById("settingsSaveStatus");
    if (el) el.textContent = text;
  }

  setPasswordBusy(isBusy) {
    const btn = document.getElementById("settingsPasswordSaveBtn");
    if (!btn) return;
    btn.disabled = isBusy;
    btn.innerHTML = isBusy
      ? '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره…'
      : '<i class="fas fa-key"></i> تغییر رمز عبور';
  }

  setConfirmError(message) {
    const hint = document.getElementById("spConfirmHint");
    if (!hint) return;
    hint.textContent = message || "";
    hint.classList.toggle("account-hint--error", Boolean(message));
  }

  clearPasswordForm() {
    ["spCurrent", "spNew", "spConfirm"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    this.setConfirmError("");
  }
}

export const settingsRenderer = new SettingsRenderer();

if (typeof window !== "undefined") {
  window.settingsRenderer = settingsRenderer;
}
