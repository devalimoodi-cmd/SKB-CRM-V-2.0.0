export const smsValidation = {
  validateMessage(message) {
    const errors = [];

    if (!message || message.trim().length === 0) {
      errors.push("متن پیامک نمی‌تواند خالی باشد");
    }

    if (message && message.length > 1000) {
      errors.push("متن پیامک نباید بیشتر از 1000 کاراکتر باشد");
    }

    // بررسی کاراکترهای غیرمجاز
    if (
      message &&
      /[^\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u200C\u200D\s0-9a-zA-Z.,!?()\-]/.test(
        message,
      )
    ) {
      errors.push("متن پیامک شامل کاراکترهای غیرمجاز است");
    }

    return errors;
  },

  validateRecipient(recipient) {
    const errors = [];

    if (!recipient) {
      errors.push("گیرنده پیامک مشخص نشده است");
    }

    if (recipient && !/^09[0-9]{9}$/.test(recipient)) {
      errors.push("شماره موبایل گیرنده معتبر نیست");
    }

    return errors;
  },

  validateRecipients(recipients) {
    const errors = [];

    if (!recipients || recipients.length === 0) {
      errors.push("هیچ گیرنده‌ای انتخاب نشده است");
    }

    if (recipients && recipients.length > 100) {
      errors.push("تعداد گیرندگان نباید بیشتر از 100 نفر باشد");
    }

    recipients.forEach((recipient, index) => {
      if (!/^09[0-9]{9}$/.test(recipient)) {
        errors.push(`شماره موبایل ${index + 1} معتبر نیست`);
      }
    });

    return errors;
  },

  validateTemplate(template) {
    const errors = [];

    if (!template || template.trim().length === 0) {
      errors.push("قالب پیامک نمی‌تواند خالی باشد");
    }

    return errors;
  },

  calculateMessageCost(message) {
    // هر پیامک حداکثر 160 کاراکتر دارد
    const length = message ? message.length : 0;
    return Math.ceil(length / 160);
  },

  validateCredit(credit, required) {
    if (credit < required) {
      return `اعتبار پیامک کافی نیست. نیاز به ${required} اعتبار دارید.`;
    }
    return null;
  },
};
