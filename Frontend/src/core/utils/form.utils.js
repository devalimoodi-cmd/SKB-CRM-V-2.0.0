export function getFormData(formId) {
  const form = document.getElementById(formId);
  if (!form) return {};

  const formData = new FormData(form);
  const data = {};
  for (const [key, value] of formData.entries()) {
    data[key] = value;
  }
  return data;
}

export function setFormData(formId, data) {
  const form = document.getElementById(formId);
  if (!form) return;

  const elements = form.elements;
  for (const key in data) {
    const element = elements[key];
    if (element) {
      if (element.type === "checkbox" || element.type === "radio") {
        element.checked = data[key];
      } else {
        element.value = data[key];
      }
    }
  }
}

export function resetForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.reset();
}

export function validateForm(formId, rules) {
  const form = document.getElementById(formId);
  if (!form) return { valid: false, errors: ["فرم یافت نشد"] };

  const errors = [];
  const elements = form.elements;

  for (const field in rules) {
    const element = elements[field];
    if (!element) continue;

    const value = element.value;
    const rule = rules[field];

    if (rule.required && !value) {
      errors.push(`فیلد ${rule.label || field} الزامی است`);
    }

    if (rule.minLength && value.length < rule.minLength) {
      errors.push(
        `فیلد ${rule.label || field} باید حداقل ${rule.minLength} کاراکتر باشد`,
      );
    }

    if (rule.maxLength && value.length > rule.maxLength) {
      errors.push(
        `فیلد ${rule.label || field} نباید بیشتر از ${rule.maxLength} کاراکتر باشد`,
      );
    }

    if (rule.pattern && !rule.pattern.test(value)) {
      errors.push(`فیلد ${rule.label || field} معتبر نیست`);
    }

    if (rule.custom && !rule.custom(value)) {
      errors.push(`فیلد ${rule.label || field} معتبر نیست`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getFieldValue(formId, fieldName) {
  const form = document.getElementById(formId);
  if (!form) return null;
  const element = form.elements[fieldName];
  if (!element) return null;
  return element.value;
}

export function setFieldValue(formId, fieldName, value) {
  const form = document.getElementById(formId);
  if (!form) return;
  const element = form.elements[fieldName];
  if (!element) return;
  element.value = value;
}

export function enableFormFields(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const elements = form.elements;
  for (let i = 0; i < elements.length; i++) {
    elements[i].disabled = false;
  }
}

export function disableFormFields(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  const elements = form.elements;
  for (let i = 0; i < elements.length; i++) {
    elements[i].disabled = true;
  }
}
