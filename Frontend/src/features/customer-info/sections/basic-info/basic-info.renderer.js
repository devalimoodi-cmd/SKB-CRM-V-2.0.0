import { convertGregorianToPersian } from "../../../../core/utils/date.utils.js";

export const basicInfoRenderer = {
  renderForm(customer, dictionaries) {
    if (!customer) return;

    // پر کردن فیلدهای متنی
    this.fillTextFields(customer);

    // پر کردن سلکت‌ها
    this.populateSelects(dictionaries, customer);

    // تنظیم تاریخ تولد
    if (customer.date_of_birth) {
      const birthdateInput = document.getElementById("skb-birthdate");
      if (birthdateInput) {
        birthdateInput.value = convertGregorianToPersian(
          customer.date_of_birth,
        );
      }
    }
  },

  fillTextFields(customer) {
    const fields = {
      "skb-company-name": customer.collection_name,
      "skb-full-name": customer.full_name,
      "skb-farm-name": customer.farm_name,
      "skb-mobile": customer.mobile_number,
      messenger: customer.messaging_number,
      "skb-email": customer.email,
      "skb-postal-code": customer.postal_code,
      "skb-farm-address": customer.farm_address,
    };

    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value) {
        el.value = value;
      }
    });
  },

  populateSelects(dictionaries, customer) {
    // استان
    this.populateSelect(
      "skb-province",
      dictionaries.provinces,
      "state_name",
      customer?.province,
    );

    // سطح تحصیلات
    this.populateSelect(
      "skb-education",
      dictionaries.education,
      "title",
      customer?.education_level,
    );

    // دپارتمان
    this.populateSelect(
      "skb-department",
      dictionaries.departments,
      "title",
      customer?.sales_department,
    );

    // سابقه مرغداری (مقادیر ثابت)
    this.populateExperienceSelect(customer?.experience_years);

    // جنسیت
    this.populateGenderSelect(customer?.gender);

    // نحوه آشنایی
    this.populateHowKnowSelect(customer?.skb_how_know);
  },

  populateSelect(selectId, data, valueKey, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // اگر داده‌ها را نداشتیم، برمی‌گردیم
    if (!data || data.length === 0) return;

    // حفظ مقدار انتخاب شده فعلی
    const currentValue = select.value;

    select.innerHTML = '<option value="">انتخاب کنید...</option>';

    data.forEach((item) => {
      const option = document.createElement("option");
      option.value = item[valueKey] || item.id;
      option.textContent = item.name || item.title || item[valueKey] || "";
      select.appendChild(option);
    });

    // تنظیم مقدار
    if (selectedValue) {
      select.value = selectedValue;
    } else if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value === currentValue)
    ) {
      select.value = currentValue;
    }
  },

  populateExperienceSelect(selectedValue) {
    const select = document.getElementById("skb-poultry-experience");
    if (!select) return;

    const experiences = [
      { value: "", text: "انتخاب سابقه فعالیت" },
      { value: "less-than-1", text: "کمتر از ۱ سال" },
      { value: "1-3", text: "۱ تا ۳ سال" },
      { value: "3-5", text: "۳ تا ۵ سال" },
      { value: "5-10", text: "۵ تا ۱۰ سال" },
      { value: "more-than-10", text: "بیش از ۱۰ سال" },
    ];

    select.innerHTML = "";
    experiences.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.text;
      select.appendChild(option);
    });

    if (selectedValue) {
      select.value = selectedValue;
    }
  },

  populateGenderSelect(selectedValue) {
    const select = document.getElementById("skb-gender");
    if (!select) return;

    const genders = [
      { value: "", text: "انتخاب جنسیت" },
      { value: "مرد", text: "مرد" },
      { value: "زن", text: "زن" },
    ];

    select.innerHTML = "";
    genders.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.text;
      select.appendChild(option);
    });

    if (selectedValue) {
      select.value = selectedValue;
    }
  },

  populateHowKnowSelect(selectedValue) {
    const select = document.getElementById("skb-how-know");
    if (!select) return;

    const items = [
      { value: "", text: "انتخاب نحوه آشنایی" },
      { value: "شبکه‌های اجتماعی", text: "شبکه‌های اجتماعی" },
      { value: "دوستان و آشنایان", text: "دوستان و آشنایان" },
      { value: "تبلیغات", text: "تبلیغات" },
      { value: "نمایشگاه", text: "نمایشگاه" },
      { value: "وبسایت", text: "وبسایت" },
      { value: "سایر", text: "سایر" },
    ];

    select.innerHTML = "";
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.text;
      select.appendChild(option);
    });

    if (selectedValue) {
      select.value = selectedValue;
    }
  },

  renderCities(cities, selectedCity) {
    const select = document.getElementById("skb-city");
    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = '<option value="">انتخاب شهرستان</option>';

    if (cities && cities.length > 0) {
      cities.forEach((city) => {
        const option = document.createElement("option");
        option.value = city.city_name || city.name;
        option.textContent = city.city_name || city.name;
        select.appendChild(option);
      });
    } else {
      select.innerHTML = '<option value="">شهرستانی یافت نشد</option>';
    }

    if (
      selectedCity &&
      Array.from(select.options).some((opt) => opt.value === selectedCity)
    ) {
      select.value = selectedCity;
    } else if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value === currentValue)
    ) {
      select.value = currentValue;
    }
  },

  getFormData() {
    return {
      collection_name:
        document.getElementById("skb-company-name")?.value || null,
      full_name: document.getElementById("skb-full-name")?.value || "",
      farm_name: document.getElementById("skb-farm-name")?.value || null,
      mobile_number: document.getElementById("skb-mobile")?.value || "",
      messaging_number: document.getElementById("messenger")?.value || null,
      date_of_birth: document.getElementById("skb-birthdate")?.value || null,
      email: document.getElementById("skb-email")?.value || "",
      experience_years:
        document.getElementById("skb-poultry-experience")?.value || null,
      education_level: document.getElementById("skb-education")?.value || null,
      sales_department:
        document.getElementById("skb-department")?.value || null,
      gender: document.getElementById("skb-gender")?.value || null,
      province: document.getElementById("skb-province")?.value || null,
      county: document.getElementById("skb-city")?.value || null,
      postal_code: document.getElementById("skb-postal-code")?.value || null,
      farm_address: document.getElementById("skb-farm-address")?.value || null,
      skb_how_know: document.getElementById("skb-how-know")?.value || null,
    };
  },

  enableFields() {
    const container = document.getElementById("Basic-Information");
    if (!container) return;
    const inputs = container.querySelectorAll(
      ".profile-field, .skb-select, .skb-input-field",
    );
    inputs.forEach((input) => {
      input.disabled = false;
    });
  },

  disableFields() {
    const container = document.getElementById("Basic-Information");
    if (!container) return;
    const inputs = container.querySelectorAll(
      ".profile-field, .skb-select, .skb-input-field",
    );
    inputs.forEach((input) => {
      input.disabled = true;
    });
  },
};
