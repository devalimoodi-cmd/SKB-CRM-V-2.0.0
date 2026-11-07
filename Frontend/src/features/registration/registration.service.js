// ============================================================
// features/registration/registration.service.js
// رفتار صفحهٔ «ثبت‌نام مشتری» — فاز ۱۳.۶
// ------------------------------------------------------------
// وظایف:
//   • پرسیدن پرچم «ثبت‌نام باز است؟» از سرور و بستن فرم در صورت بسته‌بودن
//   • گرفتن و تازه‌کردن کپچا (اگر سرور فعال کرده باشد)
//   • اعتبارسنجی سبک سمت کلاینت (سرور مرجع نهایی است)
//   • ارسال و نمایش پیام موفقیت/خطای فیلدبه‌فیلد
// 🔒 هیچ‌گاه role/status/customer_id ارسال نمی‌شود؛ هیچ توکنی ذخیره نمی‌شود.
// ============================================================
import { registrationApi } from "./registration.api.js";

const MIN_PASSWORD_LENGTH = 8;

const el = (id) => document.getElementById(id);

const state = {
  enabled: false,
  captchaEnabled: false,
  captchaId: null,
  submitting: false,
};

// ===== پیام بالای فرم =====
const showMessage = (text, type = "error") => {
  const box = el("regMessage");
  if (!box) return;
  box.className = `reg-message ${type}`;
  box.textContent = text;
  box.hidden = false;
};

const hideMessage = () => {
  const box = el("regMessage");
  if (!box) return;
  box.hidden = true;
  box.className = "reg-message";
};

// ===== پاک‌کردن خطاهای فیلدها =====
const clearFieldErrors = () => {
  document.querySelectorAll(".reg-error").forEach((node) => {
    node.textContent = "";
    node.hidden = true;
  });
  document.querySelectorAll(".reg-input.invalid").forEach((node) => {
    node.classList.remove("invalid");
  });
};

const applyFieldErrors = (errors) => {
  if (!errors || typeof errors !== "object") return false;
  let shown = false;
  Object.entries(errors).forEach(([field, message]) => {
    const errorNode = document.querySelector(`.reg-error[data-field="${field}"]`);
    const input = document.querySelector(`.reg-input[data-field="${field}"]`);
    if (errorNode) {
      errorNode.textContent = String(message || "");
      errorNode.hidden = false;
      shown = true;
    }
    if (input) input.classList.add("invalid");
  });
  return shown;
};

// ===== حالت «ثبت‌نام بسته است» =====
const applyClosedState = () => {
  state.enabled = false;
  const form = el("registerForm");
  const panel = el("regFormPanel");
  const notice = el("regClosed");
  const success = el("regSuccess");
  if (form) form.hidden = true;
  if (panel) panel.hidden = true;
  if (success) success.hidden = true;
  if (notice) notice.hidden = false;
  hideMessage();
};

// ===== کپچا =====
const loadCaptcha = async () => {
  const group = el("regCaptchaGroup");
  const image = el("regCaptchaImage");
  const input = el("regCaptchaAnswer");
  if (!group || !image) return;

  const result = await registrationApi.getCaptcha();
  const data = result.ok ? result.data : null;

  if (data && data.enabled) {
    state.captchaEnabled = true;
    state.captchaId = data.id;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.svg || "")}`;
    group.hidden = false;
    if (input) {
      input.value = "";
      input.setAttribute("required", "required");
    }
    return;
  }

  // سرور کپچا را غیرفعال کرده است
  state.captchaEnabled = false;
  state.captchaId = null;
  group.hidden = true;
  if (input) {
    input.value = "";
    input.removeAttribute("required");
  }
};

// ===== خواندن فرم =====
const readForm = () => ({
  first_name: el("regFirstName")?.value.trim() || "",
  last_name: el("regLastName")?.value.trim() || "",
  username: el("regUsername")?.value.trim() || "",
  email: el("regEmail")?.value.trim() || "",
  mobile_number: (el("regMobile")?.value || "").replace(/\D/g, ""),
  password: el("regPassword")?.value || "",
  confirm_password: el("regConfirmPassword")?.value || "",
  requested_customer_code: el("regCustomerCode")?.value.trim() || "",
  note: el("regNote")?.value.trim() || "",
  captcha_id: state.captchaEnabled ? state.captchaId : undefined,
  captcha_answer: state.captchaEnabled ? el("regCaptchaAnswer")?.value.trim() : undefined,
});

// ===== اعتبارسنجی سبک سمت کلاینت (سرور مرجع نهایی است) =====
const validate = (values) => {
  const errors = {};

  if (values.first_name.length < 2) errors.first_name = "نام را کامل وارد کنید";
  if (values.last_name.length < 2) errors.last_name = "نام خانوادگی را کامل وارد کنید";
  if (!/^[a-zA-Z0-9._-]{3,100}$/.test(values.username)) {
    errors.username = "نام کاربری: حروف انگلیسی/رقم، حداقل ۳ کاراکتر";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) {
    errors.email = "ایمیل معتبر نیست";
  }
  if (!/^09[0-9]{9}$/.test(values.mobile_number)) {
    errors.mobile_number = "شماره همراه باید با ۰۹ شروع شود و ۱۱ رقم باشد";
  }
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `رمز عبور حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`;
  }
  if (values.password !== values.confirm_password) {
    errors.confirm_password = "تکرار رمز با رمز عبور یکسان نیست";
  }
  if (state.captchaEnabled && !values.captcha_answer) {
    errors.captcha_answer = "کد امنیتی را وارد کنید";
  }

  return errors;
};


// ===== ارسال فرم =====
const submit = async (event) => {
  event.preventDefault();
  if (state.submitting || !state.enabled) return;

  hideMessage();
  clearFieldErrors();

  const values = readForm();
  const errors = validate(values);

  if (Object.keys(errors).length) {
    applyFieldErrors(errors);
    showMessage("لطفاً خطاهای فرم را برطرف کنید", "error");
    return;
  }

  const button = el("regSubmitBtn");
  state.submitting = true;
  if (button) {
    button.disabled = true;
    button.classList.add("loading");
  }

  try {
    const result = await registrationApi.create(values);

    if (result.ok) {
      const form = el("registerForm");
      const panel = el("regFormPanel");
      const success = el("regSuccess");
      const successText = el("regSuccessText");
      if (form) form.hidden = true;
      if (panel) panel.hidden = true;
      if (success) success.hidden = false;
      if (successText) {
        successText.textContent =
          result.data?.message ||
          "درخواست ثبت‌نام شما ثبت شد. پس از تأیید مدیر می‌توانید وارد شوید.";
      }
      showMessage("درخواست شما با موفقیت ثبت شد", "success");
      return;
    }

    // ثبت‌نام بسته شده است (۴۰۳ سرور)
    if (result.status === 403) {
      applyClosedState();
      showMessage(result.message || "ثبت‌نام عمومی بسته است", "error");
      return;
    }

    const showedFields = applyFieldErrors(result.errors);
    showMessage(
      result.message || "ثبت درخواست ناموفق بود. لطفاً اطلاعات را بررسی کنید",
      "error",
    );

    // کپچا یک‌بارمصرف است ⇒ در هر خطا تصویر تازه می‌گیریم
    if (state.captchaEnabled) await loadCaptcha();
    if (!showedFields && result.errors) applyFieldErrors(result.errors);
  } finally {
    state.submitting = false;
    if (button) {
      button.disabled = false;
      button.classList.remove("loading");
    }
  }
};

// ===== راه‌اندازی صفحه =====
export const registrationService = {
  async init() {
    const form = el("registerForm");
    if (!form) return;

    // ۱) پرچم سراسری
    const config = await registrationApi.getConfig();
    const data = config.ok ? config.data : null;

    if (!data || data.enabled !== true) {
      applyClosedState();
      return;
    }

    state.enabled = true;
    const host = el("regFormPanel");
    if (host) host.hidden = false;

    // ۲) کپچا (اگر سرور فعال کرده باشد)
    if (data.captcha_enabled !== false) await loadCaptcha();

    // ۳) رویدادها
    form.addEventListener("submit", submit);
    el("regCaptchaRefresh")?.addEventListener("click", (event) => {
      event.preventDefault();
      loadCaptcha();
    });

    // فقط رقم برای موبایل (کیبورد فارسی هم پذیرفته می‌شود)
    el("regMobile")?.addEventListener("input", (event) => {
      event.target.value = String(event.target.value)
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[^0-9]/g, "");
    });
  },
};

// اجرای خودکار پس از بارگذاری DOM (صفحه فقط این ماژول را import می‌کند)
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => registrationService.init());
  } else {
    registrationService.init();
  }
}
