export const hatcheryValidation = {
  validateUnit(data) {
    const errors = [];

    if (!data.unit_name || data.unit_name.trim().length < 2) {
      errors.push("نام واحد باید حداقل 2 کاراکتر باشد");
    }

    return errors;
  },

  validateFlock(data) {
    const errors = [];

    if (!data.hall_id) {
      errors.push("انتخاب سالن الزامی است");
    }

    // unit_id اختیاری است (گله می‌تواند بدون واحد هم ثبت شود)

    if (!data.placement_date) {
      errors.push("تاریخ جوجه‌ریزی الزامی است");
    }

    if (!data.chick_source_id) {
      errors.push("انتخاب مبدا جوجه الزامی است");
    }

    if (!data.breed_id) {
      errors.push("انتخاب نژاد جوجه الزامی است");
    }

    if (
      data.chick_age_on_arrival === undefined ||
      data.chick_age_on_arrival === null ||
      data.chick_age_on_arrival === ""
    ) {
      errors.push("سن جوجه در بدو ورود الزامی است");
    } else {
      const age = parseInt(data.chick_age_on_arrival);
      if (isNaN(age) || age < 0 || age > 100) {
        errors.push("سن جوجه در بدو ورود باید بین 0 تا 100 روز باشد");
      }
    }

    if (data.avg_initial_weight && data.avg_initial_weight !== "") {
      const weight = parseFloat(data.avg_initial_weight);
      if (isNaN(weight) || weight < 0 || weight > 500) {
        errors.push("وزن اولیه جوجه باید بین 0 تا 500 گرم باشد");
      }
    }

    if (data.total_load && data.total_load !== "") {
      const load = parseFloat(data.total_load);
      if (isNaN(load) || load < 0 || load > 500000) {
        errors.push("مجموع کل بار جوجه باید بین 0 تا 500,000 کیلوگرم باشد");
      }
    }

    if (!data.total_chicks_count && data.total_chicks_count !== 0) {
      errors.push("تعداد جوجه‌ریزی الزامی است");
    } else {
      const count = parseInt(data.total_chicks_count);
      if (isNaN(count) || count < 1000 || count > 100000) {
        errors.push("تعداد جوجه‌ریزی باید بین 1,000 تا 100,000 قطعه باشد");
      }
    }

    return errors;
  },

  validateHygiene(data) {
    const errors = [];

    if (!data.hall_id) {
      errors.push("انتخاب سالن الزامی است");
    }

    if (!data.last_wash_date) {
      errors.push("تاریخ آخرین شستشو الزامی است");
    }

    if (!data.last_disinfect_date) {
      errors.push("تاریخ آخرین ضدعفونی الزامی است");
    }

    return errors;
  },

  validateFlockStatus(data) {
    const errors = [];

    if (!data.id) {
      errors.push("شناسه گله معتبر نیست");
    }

    return errors;
  },
};
