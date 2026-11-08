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
// ✅ موج ۱۳.۷.۲ — همان قاعدهٔ سرور/models (CustomerPersonalInfo)
const NATIONAL_CODE_LENGTH = 10;

const el = (id) => document.getElementById(id);

const state = {
  enabled: false,
  captchaEnabled: false,
  captchaId: null,
  submitting: false,
  // دیکشنری‌های پرونده (موج ۱۳.۷.۲)
  customerTypesLoaded: false,
  provincesLoaded: false,
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
const FIELD_SELECTOR = ".reg-input, .reg-select, .reg-textarea";

const showFieldError = (field, message) => {
  const errorNode = document.querySelector(`.reg-error[data-field="${field}"]`);
  if (!errorNode) return;
  errorNode.textContent = String(message || "");
  errorNode.hidden = false;
};

const clearFieldErrors = () => {
  document.querySelectorAll(".reg-error").forEach((node) => {
    node.textContent = "";
    node.hidden = true;
  });
  document.querySelectorAll(".invalid").forEach((node) => {
    if (node.matches?.(FIELD_SELECTOR)) node.classList.remove("invalid");
  });
};

const applyFieldErrors = (errors) => {
  if (!errors || typeof errors !== "object") return false;
  let shown = false;
  Object.entries(errors).forEach(([field, message]) => {
    const errorNode = document.querySelector(`.reg-error[data-field="${field}"]`);
    const input = document.querySelector(
      `.reg-input[data-field="${field}"], .reg-select[data-field="${field}"], .reg-textarea[data-field="${field}"]`,
    );
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

// ===== ✅ موج ۱۳.۷.۲ — دیکشنری‌های پروندهٔ مشتری =====
// انواع مشتری: کشوی اجباری (فقط انواع فعال، از اندپوینت عمومی حداقلی)
const loadCustomerTypes = async () => {
  const select = el("regCustomerType");
  if (!select) return;

  const result = await registrationApi.getCustomerTypes();
  const list = result.ok && Array.isArray(result.data) ? result.data : [];

  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = list.length ? "— انتخاب نوع مشتری —" : "— نوع مشتری یافت نشد —";
  select.add(placeholder);

  list.forEach((type) => {
    const id = Number(type?.id);
    const name = String(type?.name || "").trim();
    if (!Number.isInteger(id) || id <= 0 || !name) return;
    const option = document.createElement("option");
    option.value = String(id);
    option.textContent = name;
    select.add(option);
  });

  state.customerTypesLoaded = select.options.length > 1;
  if (!state.customerTypesLoaded) {
    showFieldError(
      "customer_type_id",
      "دریافت فهرست «انواع مشتری» ناموفق بود؛ صفحه را دوباره بارگذاری کنید",
    );
  }
};

// استان‌ها (دیکشنری عمومی cities — نام استان، نه کد)
const loadProvinces = async () => {
  const select = el("regProvince");
  if (!select) return;

  const result = await registrationApi.getProvinces();
  const list = result.ok && Array.isArray(result.data) ? result.data : [];

  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "— انتخاب استان (اختیاری) —";
  select.add(placeholder);

  list.forEach((province) => {
    const name = String(province?.state_name || "").trim();
    if (!name) return;
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.add(option);
  });

  state.provincesLoaded = select.options.length > 1;
  if (!state.provincesLoaded) {
    // استان/شهرستان اختیاری است ⇒ فقط اطلاع‌رسانی، نه قفل فرم
    showFieldError("province", "دریافت فهرست استان‌ها ناموفق بود؛ می‌توانید خالی بگذارید");
  }
};

// شهرستان‌ها: صفر و غیرفعال (وابسته به استان)
const resetCountyOptions = (message = "— ابتدا استان را انتخاب کنید —") => {
  const select = el("regCounty");
  if (!select) return;

  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = message;
  select.add(option);
  select.value = "";
  select.disabled = true;
};

// شهرستان‌های استان انتخاب‌شده
const loadCounties = async (province = "", selected = "") => {
  const select = el("regCounty");
  if (!select) return;

  const provinceName = String(province || "").trim();
  if (!provinceName) {
    resetCountyOptions();
    return;
  }

  select.disabled = true;
  select.innerHTML = '<option value="">در حال بارگذاری…</option>';

  const result = await registrationApi.getCitiesByProvince(provinceName);
  const list = result.ok && Array.isArray(result.data) ? result.data : [];

  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = list.length
    ? "— انتخاب شهرستان (اختیاری) —"
    : "— شهرستانی یافت نشد —";
  select.add(placeholder);

  list.forEach((city) => {
    const cityName = String(city?.city_name || "").trim();
    if (!cityName) return;
    const option = document.createElement("option");
    option.value = cityName;
    option.textContent = cityName;
    select.add(option);
  });

  if (!list.length) {
    resetCountyOptions("— شهرستانی یافت نشد —");
    return;
  }

  select.disabled = false;
  if (selected && Array.from(select.options).some((option) => option.value === selected)) {
    select.value = selected;
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
  // ✅ موج ۱۳.۷.۲ — اطلاعات پروندهٔ مشتری (همان نام‌های ستون سرور)
  customer_type_id: el("regCustomerType")?.value || "",
  national_code: (el("regNationalCode")?.value || "").replace(/\D/g, ""),
  farm_name: el("regFarmName")?.value.trim() || "",
  province: el("regProvince")?.value || "",
  county: el("regCounty")?.disabled ? "" : el("regCounty")?.value || "",
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
  // ✅ موج ۱۳.۷.۲ — نوع مشتری اجباری؛ کد ملی ۱۰ رقم؛ شهرستان بدون استان ممنوع
  if (!values.customer_type_id) {
    errors.customer_type_id = "نوع مشتری را از فهرست انتخاب کنید";
  }
  if (values.national_code && values.national_code.length !== NATIONAL_CODE_LENGTH) {
    errors.national_code = `کد ملی باید ${NATIONAL_CODE_LENGTH} رقم باشد`;
  }
  if (values.county && !values.province) {
    errors.county = "برای انتخاب شهرستان، ابتدا استان را انتخاب کنید";
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

    // ۳) ✅ موج ۱۳.۷.۲ — دیکشنری‌های پروندهٔ مشتری (نوع مشتری + استان/شهرستان)
    //    موازی و مستقل: خطای هر کدام فقط پیام همان فیلد را نشان می‌دهد
    await Promise.all([loadCustomerTypes(), loadProvinces()]);
    resetCountyOptions();

    // ۴) رویدادها
    form.addEventListener("submit", submit);
    el("regCaptchaRefresh")?.addEventListener("click", (event) => {
      event.preventDefault();
      loadCaptcha();
    });

    // استان ⇒ شهرستان (وابسته) — تغییر استان، شهرستان را صفر می‌کند
    el("regProvince")?.addEventListener("change", (event) => {
      loadCounties(event.target.value);
    });

    // فقط رقم برای موبایل (کیبورد فارسی هم پذیرفته می‌شود)
    el("regMobile")?.addEventListener("input", (event) => {
      event.target.value = String(event.target.value)
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[^0-9]/g, "");
    });

    // فقط رقم برای کد ملی (حداکثر ۱۰ رقم)
    el("regNationalCode")?.addEventListener("input", (event) => {
      event.target.value = String(event.target.value)
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
        .replace(/[^0-9]/g, "")
        .slice(0, NATIONAL_CODE_LENGTH);
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
