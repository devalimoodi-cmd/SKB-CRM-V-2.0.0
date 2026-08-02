export const adminPanelValidation = {
  validateSetupAdmin(data) {
    const errors = [];

    if (!data.first_name || data.first_name.trim().length < 2) {
      errors.push("نام باید حداقل 2 کاراکتر باشد");
    }

    if (!data.last_name || data.last_name.trim().length < 2) {
      errors.push("نام خانوادگی باید حداقل 2 کاراکتر باشد");
    }

    if (!data.username || data.username.trim().length < 3) {
      errors.push("نام کاربری باید حداقل 3 کاراکتر باشد");
    }

    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push("ایمیل معتبر نیست");
    }

    if (!data.password || data.password.length < 6) {
      errors.push("رمز عبور باید حداقل 6 کاراکتر باشد");
    }

    if (!data.mobile_number || !this.isValidPhone(data.mobile_number)) {
      errors.push("شماره همراه باید با 09 شروع شود و 11 رقم باشد");
    }

    return errors;
  },

  validateUser(data) {
    const errors = [];

    if (!data.first_name || data.first_name.trim().length < 2) {
      errors.push("نام باید حداقل 2 کاراکتر باشد");
    }

    if (!data.last_name || data.last_name.trim().length < 2) {
      errors.push("نام خانوادگی باید حداقل 2 کاراکتر باشد");
    }

    if (!data.username || data.username.trim().length < 3) {
      errors.push("نام کاربری باید حداقل 3 کاراکتر باشد");
    }

    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push("ایمیل معتبر نیست");
    }

    if (!data.password || data.password.length < 6) {
      errors.push("رمز عبور باید حداقل 6 کاراکتر باشد");
    }

    if (!data.mobile_number || !this.isValidPhone(data.mobile_number)) {
      errors.push("شماره همراه باید با 09 شروع شود و 11 رقم باشد");
    }

    if (!data.role) {
      errors.push("نقش کاربر الزامی است");
    }

    return errors;
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  isValidPhone(phone) {
    return /^09[0-9]{9}$/.test(phone);
  },
};
