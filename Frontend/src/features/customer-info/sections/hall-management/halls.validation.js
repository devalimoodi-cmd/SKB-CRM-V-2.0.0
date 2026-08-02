export const hallsValidation = {
  validatePeriod(data) {
    const errors = [];

    if (!data.period_name || data.period_name.trim().length < 2) {
      errors.push("نام دوره باید حداقل 2 کاراکتر باشد");
    }

    if (!data.start_date) {
      errors.push("تاریخ شروع الزامی است");
    } else {
      // اعتبارسنجی: بین 1 هفته قبل تا 1 هفته بعد از امروز
      try {
        const parts = data.start_date.split("/");
        if (parts.length === 3) {
          const pYear = parseInt(parts[0]);
          const pMonth = parseInt(parts[1]);
          const pDay = parseInt(parts[2]);
          if (!isNaN(pYear) && !isNaN(pMonth) && !isNaN(pDay)) {
            const pd = new persianDate([pYear, pMonth, pDay]);
            const gregDate = pd.toDate();
            const now = new Date();
            const oneWeekAgo = new Date(
              now.getTime() - 7 * 24 * 60 * 60 * 1000,
            );
            const oneWeekLater = new Date(
              now.getTime() + 7 * 24 * 60 * 60 * 1000,
            );

            if (gregDate < oneWeekAgo || gregDate > oneWeekLater) {
              errors.push(
                "تاریخ شروع باید بین 1 هفته قبل تا 1 هفته بعد از امروز باشد",
              );
            }
          }
        }
      } catch (e) {
        // اگر validation از type پشتیبانی نکرد، نادیده بگیر
      }
    }

    return errors;
  },

  validateHall(data) {
    const errors = [];

    if (!data.period_id) {
      errors.push("لطفاً یک دوره انتخاب کنید");
    }

    if (!data.hall_name || data.hall_name.trim().length < 2) {
      errors.push("نام سالن باید حداقل 2 کاراکتر باشد");
    }

    // ظرفیت اسمی: اجباری، بین 1000 تا 100,000
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

    // ارتفاع از سطح دریا: اجباری، بین 1 تا 110,000
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

    // نوع سالن: اجباری
    if (!data.hall_type_id) {
      errors.push("نوع سالن الزامی است");
    }

    // سال ساخت: بین 1300 تا 1499
    if (data.construction_year) {
      const year = parseInt(data.construction_year);
      if (isNaN(year)) {
        errors.push("سال ساخت باید عدد باشد");
      } else if (year < 1300 || year > 1499) {
        errors.push("سال ساخت باید بین 1300 تا 1499 باشد");
      }
    }

    // کارشناس خدمات: اجباری
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

    // طول: اجباری، 0.1 تا 999
    if (!data.length && data.length !== 0) {
      errors.push("طول سالن الزامی است");
    } else {
      const val = parseFloat(data.length);
      if (isNaN(val) || val <= 0 || val > 999) {
        errors.push("طول سالن باید بین 0.1 تا 999 متر باشد");
      }
    }

    // عرض: اجباری، 0 تا 999
    if (!data.width && data.width !== 0) {
      errors.push("عرض سالن الزامی است");
    } else {
      const val = parseFloat(data.width);
      if (isNaN(val) || val < 0 || val > 999) {
        errors.push("عرض سالن باید بین 0 تا 999 متر باشد");
      }
    }

    // ارتفاع: اجباری، 0 تا 10
    if (!data.height && data.height !== 0) {
      errors.push("ارتفاع سالن الزامی است");
    } else {
      const val = parseFloat(data.height);
      if (isNaN(val) || val < 0 || val > 10) {
        errors.push("ارتفاع سالن باید بین 0 تا 10 متر باشد");
      }
    }

    // جنس کف: اجباری
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

    // تعداد فن‌ها: اجباری، 1 تا 100
    if (!data.fan_count && data.fan_count !== 0) {
      errors.push("تعداد فن‌ها الزامی است");
    } else {
      const val = parseInt(data.fan_count);
      if (isNaN(val) || val < 1 || val > 100) {
        errors.push("تعداد فن‌ها باید بین 1 تا 100 باشد");
      }
    }

    // اندازه فن‌ها: اجباری، 0 تا 999
    if (!data.fan_size) {
      errors.push("اندازه فن‌ها الزامی است");
    } else {
      const val = parseFloat(data.fan_size);
      if (isNaN(val) || val < 0 || val > 999) {
        errors.push("اندازه فن‌ها باید بین 0 تا 999 اینچ باشد");
      }
    }

    // ظرفیت فن‌ها: اجباری، 100 تا 100,000,000
    if (!data.fan_capacity) {
      errors.push("ظرفیت فن‌ها الزامی است");
    } else {
      const val = parseFloat(data.fan_capacity);
      if (isNaN(val) || val < 100 || val > 100000000) {
        errors.push("ظرفیت فن‌ها باید بین 100 تا 100,000,000 باشد");
      }
    }

    // تعداد هیتر: اجباری، 0 تا 100
    if (!data.heater_count && data.heater_count !== 0) {
      errors.push("تعداد هیتر الزامی است");
    } else {
      const val = parseInt(data.heater_count);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push("تعداد هیتر باید بین 0 تا 100 باشد");
      }
    }

    // انواع سیستم‌ها: اجباری
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

    // نوع آبخوری: اجباری
    if (!data.waterer_type_id) {
      errors.push("انتخاب نوع آبخوری الزامی است");
    }

    // نوع دانخوری: اجباری
    if (!data.feeder_type_id) {
      errors.push("انتخاب نوع دانخوری الزامی است");
    }

    // تعداد خطوط آبخوری: اجباری، 0 تا 100
    if (!data.water_lines_count && data.water_lines_count !== 0) {
      errors.push("تعداد خطوط آبخوری الزامی است");
    } else {
      const val = parseInt(data.water_lines_count);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push("تعداد خطوط آبخوری باید بین 0 تا 100 باشد");
      }
    }

    // تعداد خطوط دانخوری: اجباری، 0 تا 100
    if (!data.feed_lines_count && data.feed_lines_count !== 0) {
      errors.push("تعداد خطوط دانخوری الزامی است");
    } else {
      const val = parseInt(data.feed_lines_count);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push("تعداد خطوط دانخوری باید بین 0 تا 100 باشد");
      }
    }

    // سیستم دان دهی اتوماتیک: اجباری
    if (data.auto_feed_system === undefined || data.auto_feed_system === null) {
      errors.push("انتخاب سیستم دان دهی اتوماتیک الزامی است");
    }

    return errors;
  },
};
