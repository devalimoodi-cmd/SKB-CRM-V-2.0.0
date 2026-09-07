export const hallsValidation = {
  validateUnit(data) {
    const errors = [];

    // نام واحد (الزامی)
    if (!data.unit_name || data.unit_name.trim().length < 2) {
      errors.push("نام واحد باید حداقل 2 کاراکتر باشد");
    }

    // آدرس واحد (الزامی)
    if (!data.address || data.address.trim().length < 5) {
      errors.push("آدرس واحد الزامی است (حداقل ۵ کاراکتر)");
    }

    // طول جغرافیایی (اختیاری)
    if (
      data.longitude &&
      (isNaN(parseFloat(data.longitude)) ||
        parseFloat(data.longitude) < -180 ||
        parseFloat(data.longitude) > 180)
    ) {
      errors.push("طول جغرافیایی باید عددی بین 180- تا 180 باشد");
    }

    // عرض جغرافیایی (اختیاری)
    if (
      data.latitude &&
      (isNaN(parseFloat(data.latitude)) ||
        parseFloat(data.latitude) < -90 ||
        parseFloat(data.latitude) > 90)
    ) {
      errors.push("عرض جغرافیایی باید عددی بین 90- تا 90 باشد");
    }

    // تعداد سالن‌ها (الزامی، بین 1 تا 99)
    if (
      data.hall_count === undefined ||
      data.hall_count === null ||
      data.hall_count === ""
    ) {
      errors.push("تعداد سالن‌ها الزامی است");
    } else {
      const count = parseInt(data.hall_count);
      if (isNaN(count)) {
        errors.push("تعداد سالن‌ها باید عدد باشد");
      } else if (count < 1 || count > 99) {
        errors.push("تعداد سالن‌ها باید عددی بین ۱ تا ۹۹ باشد");
      }
    }

    // ظرفیت واحد (الزامی، بین 0 تا 1000000)
    if (
      data.capacity === undefined ||
      data.capacity === null ||
      data.capacity === ""
    ) {
      errors.push("ظرفیت واحد الزامی است");
    } else {
      const cap = parseInt(data.capacity);
      if (isNaN(cap)) {
        errors.push("ظرفیت واحد باید عدد باشد");
      } else if (cap < 0 || cap > 1000000) {
        errors.push("ظرفیت واحد باید عددی بین ۰ تا ۱,۰۰۰,۰۰۰ قطعه باشد");
      }
    }

    // نام مدیر (الزامی)
    if (!data.manager_name || data.manager_name.trim().length < 2) {
      errors.push("نام مدیر واحد الزامی است");
    }

    // شماره تماس مدیر (الزامی، 11 رقم)
    if (!data.manager_phone) {
      errors.push("شماره تماس مدیر واحد الزامی است");
    } else if (!/^[0-9]{11}$/.test(data.manager_phone.replace(/\D/g, ""))) {
      errors.push("شماره تماس مدیر باید ۱۱ رقم باشد");
    }

    // کارشناسان واحد (اختیاری — اما اگر ردیفی پر شد، کامل باشد)
    if (Array.isArray(data.experts) && data.experts.length > 0) {
      data.experts.forEach((expert, index) => {
        const rowNum = index + 1;
        const name = (expert.expert_name || "").toString().trim();
        const phone = (expert.expert_phone || "").toString().trim();
        const role = (expert.expert_role || "").toString().trim();

        // ردیف کاملاً خالی → نادیده گرفته می‌شود (اختیاری)
        if (!name && !phone && !role) return;

        // اگر حداقل یک فیلد پر شده، همه باید کامل باشند
        if (!name) {
          errors.push(`نام کارشناس ردیف ${rowNum} الزامی است`);
        } else if (name.length > 50) {
          errors.push(`نام کارشناس ردیف ${rowNum} حداکثر ۵۰ کاراکتر باشد`);
        }

        if (!phone) {
          errors.push(`شماره تماس کارشناس ردیف ${rowNum} الزامی است`);
        } else if (!/^[0-9]{11}$/.test(phone.replace(/\D/g, ""))) {
          errors.push(`شماره تماس کارشناس ردیف ${rowNum} باید ۱۱ رقم باشد`);
        }

        if (!role) {
          errors.push(`نقش کارشناس ردیف ${rowNum} الزامی است`);
        } else if (role.length > 50) {
          errors.push(`نقش کارشناس ردیف ${rowNum} حداکثر ۵۰ کاراکتر باشد`);
        }
      });
    }

    return errors;
  },

  validateHall(data) {
    const errors = [];

    if (!data.unit_id) {
      errors.push("لطفاً یک واحد انتخاب کنید");
    }

    if (!data.hall_name || data.hall_name.trim().length < 2) {
      errors.push("نام سالن باید حداقل 2 کاراکتر باشد");
    }

    if (!data.nominal_capacity) {
      errors.push("ظرفیت اسمی سالن الزامی است");
    } else {
      const capacity = parseInt(data.nominal_capacity);
      if (isNaN(capacity)) {
        errors.push("ظرفیت اسمی سالن باید عدد باشد");
      } else if (capacity < 1000 || capacity > 100000) {
        errors.push("ظرفیت سالن باید بین 1,000 تا 100,000 قطعه باشد");
      }
    }

    if (!data.altitude_above_sea) {
      errors.push("ارتفاع از سطح دریا الزامی است");
    } else {
      const alt = parseInt(data.altitude_above_sea);
      if (isNaN(alt)) {
        errors.push("ارتفاع از سطح دریا باید عدد باشد");
      } else if (alt < 1 || alt > 110000) {
        errors.push("ارتفاع از سطح دریا باید بین 1 تا 110,000 متر باشد");
      }
    }

    if (!data.hall_type_id) {
      errors.push("نوع سالن الزامی است");
    }

    if (data.construction_year) {
      const year = parseInt(data.construction_year);
      if (isNaN(year)) {
        errors.push("سال ساخت باید عدد باشد");
      } else if (year < 1300 || year > 1499) {
        errors.push("سال ساخت باید بین 1300 تا 1499 باشد");
      }
    }

    if (!data.service_expert_id) {
      errors.push("انتخاب کارشناس خدمات الزامی است");
    }

    return errors;
  },

  validatePhysicalInfo(data) {
    const errors = [];

    if (!data.hall_id) {
      errors.push("لطفاً یک سالن انتخاب کنید");
    }

    if (!data.length && data.length !== 0) {
      errors.push("طول سالن الزامی است");
    } else {
      const val = parseFloat(data.length);
      if (isNaN(val) || val <= 0 || val > 999) {
        errors.push("طول سالن باید بین 0.1 تا 999 متر باشد");
      }
    }

    if (!data.width && data.width !== 0) {
      errors.push("عرض سالن الزامی است");
    } else {
      const val = parseFloat(data.width);
      if (isNaN(val) || val < 0 || val > 999) {
        errors.push("عرض سالن باید بین 0 تا 999 متر باشد");
      }
    }

    if (!data.height && data.height !== 0) {
      errors.push("ارتفاع سالن الزامی است");
    } else {
      const val = parseFloat(data.height);
      if (isNaN(val) || val < 0 || val > 10) {
        errors.push("ارتفاع سالن باید بین 0 تا 10 متر باشد");
      }
    }

    if (!data.floor_type_id) {
      errors.push("انتخاب جنس کف سالن الزامی است");
    }

    return errors;
  },

  validateSystemInfo(data) {
    const errors = [];

    if (!data.hall_id) {
      errors.push("لطفاً یک سالن انتخاب کنید");
    }

    // حالت جدید: ذخیره از ویرایشگر افزودنی (نوع + تعداد)
    if (Array.isArray(data.items)) {
      const items = data.items;
      if (items.length === 0) {
        errors.push("حداقل یک ردیف سیستم (نوع و تعداد) تعریف کنید");
      }
      const catLabels = {
        heating: "گرمایش",
        cooling: "سرمایش",
        ventilation: "تهویه",
        sanitary: "ورودی بهداشتی",
        lighting: "روشنایی",
        fan: "فن",
      };
      items.forEach((it, idx) => {
        const n = idx + 1;
        const cat = String(it.category || "");
        if (!catLabels[cat]) {
          errors.push(`ردیف ${n}: دسته سیستم نامعتبر است`);
          return;
        }
        const qty = parseInt(it.quantity);
        if (isNaN(qty) || qty < 1 || qty > 100000) {
          errors.push(`ردیف ${n} (${catLabels[cat]}): تعداد باید بین ۱ تا ۱۰۰,۰۰۰ باشد`);
        }
        if (cat !== "fan" && !it.type_id) {
          errors.push(`ردیف ${n} (${catLabels[cat]}): نوع سیستم را انتخاب کنید`);
        }
        if (cat === "fan" && it.spec && String(it.spec).trim().length > 100) {
          errors.push(`ردیف ${n} (فن): مشخصه/سایز نباید بیشتر از ۱۰۰ کاراکتر باشد`);
        }
      });
      // ظرفیت فن‌ها (اگر پر شده باشد باید در بازه منطقی باشد)
      if (
        data.fan_capacity !== null &&
        data.fan_capacity !== undefined &&
        data.fan_capacity !== ""
      ) {
        const fc = parseFloat(data.fan_capacity);
        if (isNaN(fc) || fc < 100 || fc > 100000000) {
          errors.push("ظرفیت فن‌ها باید بین 100 تا 100,000,000 باشد");
        }
      }
      return errors;
    }

    // حالت قدیمی (سازگاری): فیلدهای تکی فرم قدیمی
    if (!data.fan_count && data.fan_count !== 0) {
      errors.push("تعداد فن‌ها الزامی است");
    } else {
      const val = parseInt(data.fan_count);
      if (isNaN(val) || val < 1 || val > 100) {
        errors.push("تعداد فن‌ها باید بین 1 تا 100 باشد");
      }
    }

    if (!data.fan_size) {
      errors.push("اندازه فن‌ها الزامی است");
    } else {
      const val = parseFloat(data.fan_size);
      if (isNaN(val) || val < 0 || val > 999) {
        errors.push("اندازه فن‌ها باید بین 0 تا 999 اینچ باشد");
      }
    }

    if (!data.fan_capacity) {
      errors.push("ظرفیت فن‌ها الزامی است");
    } else {
      const val = parseFloat(data.fan_capacity);
      if (isNaN(val) || val < 100 || val > 100000000) {
        errors.push("ظرفیت فن‌ها باید بین 100 تا 100,000,000 باشد");
      }
    }

    if (!data.heater_count && data.heater_count !== 0) {
      errors.push("تعداد هیتر الزامی است");
    } else {
      const val = parseInt(data.heater_count);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push("تعداد هیتر باید بین 0 تا 100 باشد");
      }
    }

    if (!data.heating_system_id) {
      errors.push("نوع سیستم گرمایش الزامی است");
    }
    if (!data.cooling_system_id) {
      errors.push("نوع سیستم سرمایش الزامی است");
    }
    if (!data.ventilation_system_id) {
      errors.push("نوع سیستم تهویه الزامی است");
    }
    if (!data.water_inlet_system_id) {
      errors.push("نوع سیستم ورودی بهداشتی الزامی است");
    }
    if (!data.lighting_system_id) {
      errors.push("نوع سیستم روشنایی الزامی است");
    }

    return errors;
  },

  validateWaterFeedInfo(data) {
    const errors = [];

    if (!data.hall_id) {
      errors.push("لطفاً یک سالن انتخاب کنید");
    }

    if (!data.waterer_type_id) {
      errors.push("انتخاب نوع آبخوری الزامی است");
    }

    if (!data.feeder_type_id) {
      errors.push("انتخاب نوع دانخوری الزامی است");
    }

    if (!data.water_lines_count && data.water_lines_count !== 0) {
      errors.push("تعداد خطوط آبخوری الزامی است");
    } else {
      const val = parseInt(data.water_lines_count);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push("تعداد خطوط آبخوری باید بین 0 تا 100 باشد");
      }
    }

    if (!data.feed_lines_count && data.feed_lines_count !== 0) {
      errors.push("تعداد خطوط دانخوری الزامی است");
    } else {
      const val = parseInt(data.feed_lines_count);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push("تعداد خطوط دانخوری باید بین 0 تا 100 باشد");
      }
    }

    if (data.auto_feed_system === undefined || data.auto_feed_system === null) {
      errors.push("انتخاب سیستم دان دهی اتوماتیک الزامی است");
    }

    return errors;
  },
};
