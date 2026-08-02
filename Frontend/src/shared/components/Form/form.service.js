class FormService {
  constructor() {
    this.forms = [];
    this.initialized = false;
  }

  init(containerSelector = ".form") {
    if (this.initialized) return;

    const forms = document.querySelectorAll(containerSelector);
    forms.forEach((form) => {
      this.setupForm(form);
    });

    this.initialized = true;
    console.log("✅ FormService initialized");
  }

  setupForm(form) {
    // ذخیره در لیست
    this.forms.push({
      element: form,
      fields: this.getFields(form),
    });

    // رویداد submit
    form.addEventListener("submit", (e) => {
      const isValid = this.validate(form);
      if (!isValid) {
        e.preventDefault();
        return;
      }

      const event = new CustomEvent("form:submit", {
        detail: {
          form: form,
          data: this.getData(form),
          isValid: isValid,
        },
      });
      form.dispatchEvent(event);
    });

    // اعتبارسنجی زنده
    const inputs = form.querySelectorAll("input, select, textarea");
    inputs.forEach((input) => {
      input.addEventListener("blur", () => {
        this.validateField(input);
      });
      input.addEventListener("input", () => {
        this.clearFieldError(input);
      });
    });
  }

  // ===== اعتبارسنجی =====

  validate(form) {
    const fields = this.getFields(form);
    let isValid = true;

    fields.forEach((field) => {
      if (!this.validateField(field)) {
        isValid = false;
      }
    });

    return isValid;
  }

  validateField(field) {
    const group = field.closest(".form-group");
    const errorText = group?.querySelector(".error-text");
    const rules = this.getFieldRules(field);

    if (!rules || !group) return true;

    let isValid = true;
    let errorMessage = "";

    // Required
    if (rules.required && !field.value.trim()) {
      isValid = false;
      errorMessage = rules.requiredMessage || "این فیلد الزامی است";
    }

    // Min Length
    if (rules.minLength && field.value.length < rules.minLength) {
      isValid = false;
      errorMessage = `حداقل ${rules.minLength} کاراکتر وارد کنید`;
    }

    // Max Length
    if (rules.maxLength && field.value.length > rules.maxLength) {
      isValid = false;
      errorMessage = `حداکثر ${rules.maxLength} کاراکتر وارد کنید`;
    }

    // Pattern
    if (rules.pattern && !rules.pattern.test(field.value)) {
      isValid = false;
      errorMessage = rules.patternMessage || "فرمت وارد شده معتبر نیست";
    }

    // Custom
    if (rules.custom && !rules.custom(field.value)) {
      isValid = false;
      errorMessage = rules.customMessage || "مقدار وارد شده معتبر نیست";
    }

    if (!isValid) {
      group.classList.add("has-error");
      if (errorText) {
        errorText.textContent = errorMessage;
        errorText.style.display = "block";
      }
    } else {
      group.classList.remove("has-error");
      if (errorText) {
        errorText.style.display = "none";
      }
    }

    return isValid;
  }

  clearFieldError(field) {
    const group = field.closest(".form-group");
    if (group) {
      group.classList.remove("has-error");
      const errorText = group.querySelector(".error-text");
      if (errorText) {
        errorText.style.display = "none";
      }
    }
  }

  // ===== دریافت داده‌ها =====

  getData(form) {
    const formData = new FormData(form);
    const data = {};

    for (const [key, value] of formData.entries()) {
      // اگر کلید تکراری بود، به آرایه تبدیل کن
      if (data[key] !== undefined) {
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(value);
      } else {
        data[key] = value;
      }
    }

    return data;
  }

  getFields(form) {
    return form.querySelectorAll(
      'input:not([type="submit"]):not([type="button"]), select, textarea',
    );
  }

  getFieldRules(field) {
    const rulesAttr = field.dataset.rules;
    if (!rulesAttr) return null;

    try {
      return JSON.parse(rulesAttr);
    } catch {
      return null;
    }
  }

  // ===== متدهای کمکی =====

  setValues(form, data) {
    const fields = this.getFields(form);
    fields.forEach((field) => {
      const name = field.name;
      if (data[name] !== undefined) {
        if (field.type === "checkbox" || field.type === "radio") {
          field.checked = data[name] === field.value;
        } else {
          field.value = data[name];
        }
      }
    });
  }

  reset(form) {
    const fields = this.getFields(form);
    fields.forEach((field) => {
      if (field.type === "checkbox" || field.type === "radio") {
        field.checked = false;
      } else {
        field.value = "";
      }
      this.clearFieldError(field);
    });
  }

  enable(form) {
    const fields = this.getFields(form);
    fields.forEach((field) => {
      field.disabled = false;
    });
  }

  disable(form) {
    const fields = this.getFields(form);
    fields.forEach((field) => {
      field.disabled = true;
    });
  }

  // ===== دیستروی =====

  destroy() {
    this.forms = [];
    this.initialized = false;
  }
}

// ===== Export =====
export const formService = new FormService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.FormService = formService;
  window.formService = formService;
}
