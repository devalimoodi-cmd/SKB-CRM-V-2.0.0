export const visitReportValidation = {
  validate(data) {
    const errors = [];

    if (!data.visit_date) {
      errors.push("تاریخ بازدید الزامی است");
    }

    if (!data.period_id) {
      errors.push("لطفاً یک دوره جوجه‌ریزی انتخاب کنید");
    }

    if (!data.report_text || data.report_text.trim().length < 5) {
      errors.push("شرح گزارش باید حداقل 5 کاراکتر باشد");
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
