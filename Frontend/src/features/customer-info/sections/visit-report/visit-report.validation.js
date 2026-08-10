export const visitReportValidation = {
  validate(data) {
    const errors = [];

    // تاریخ بازدید — الزامی
    if (!data.visit_date) {
      errors.push("تاریخ بازدید الزامی است");
    }

    // شرح گزارش — حداقل 5 کاراکتر
    if (!data.report_text || data.report_text.trim().length < 5) {
      errors.push("شرح گزارش باید حداقل 5 کاراکتر باشد");
    }

    // سالن‌ها — اجباری
    errors.push(...this.validateHalls(data.hall_ids));

    // کارشناسان — اجباری
    errors.push(...this.validateExperts(data.expert_ids));

    // واحد مرغداری — اختیاری (فقط اگر مقدار داشت باید عدد باشد)
    if (data.unit_id && isNaN(parseInt(data.unit_id))) {
      errors.push("شناسه واحد مرغداری نامعتبر است");
    }

    return errors;
  },

  validateHalls(hallIds) {
    const errors = [];

    if (!hallIds || hallIds.length === 0) {
      errors.push("لطفاً حداقل یک سالن را انتخاب کنید");
    }

    return errors;
  },

  validateExperts(expertIds) {
    const errors = [];

    if (!expertIds || expertIds.length === 0) {
      errors.push("لطفاً حداقل یک کارشناس را انتخاب کنید");
    }

    return errors;
  },

  validateAttachments(files) {
    const errors = [];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (files) {
      for (const file of files) {
        if (file.size > maxSize) {
          errors.push(`فایل "${file.name}" بزرگتر از 10MB است`);
        }
      }
    }

    return errors;
  },
};
