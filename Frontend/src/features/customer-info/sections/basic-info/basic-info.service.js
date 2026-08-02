import { basicInfoApi } from "./basic-info.api.js";
import { basicInfoRenderer } from "./basic-info.renderer.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  convertPersianToGregorian,
  convertGregorianToPersian,
} from "../../../../core/utils/date.utils.js";
import {
  isValidPhone,
  isValidPostalCode,
  isValidEmail,
} from "../../../../core/utils/string.utils.js";

class BasicInfoService {
  constructor() {
    this.customerId = null;
    this.customerData = null;
    this.isEditing = false;
    this.dictionaries = {};
    this.initialized = false;
  }

  async init(customerId) {
    // ✅ اگر قبلاً initialized شده و customerId یکی است، دوباره لود نکن
    if (this.initialized && this.customerId === customerId) {
      console.log("ℹ️ BasicInfoService already initialized, skipping");
      return;
    }

    // ✅ اگر customerId ارسال نشد، از state بگیر
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    console.log("📌 BasicInfoService customerId:", this.customerId);

    await this.loadData();
    this.setupEvents();
    this.initialized = true;
    console.log("✅ BasicInfoService initialized");
  }

  async loadData() {
    try {
      // بارگذاری اطلاعات مشتری
      const customerRes = await basicInfoApi.getCustomer(this.customerId);
      if (customerRes.success) {
        this.customerData = customerRes.data;
      }

      // بارگذاری دیکشنری‌ها
      const [provinces, education, departments] = await Promise.all([
        basicInfoApi.getProvinces(),
        basicInfoApi.getEducationLevels(),
        basicInfoApi.getDepartments(),
      ]);

      this.dictionaries = {
        provinces: provinces.success ? provinces.data : [],
        education: education.success ? education.data : [],
        departments: departments.success ? departments.data : [],
      };

      // رندر فرم
      basicInfoRenderer.renderForm(this.customerData, this.dictionaries);

      // اگر استان انتخاب شده، شهرستان‌ها را بارگذاری کن
      if (this.customerData?.province) {
        await this.loadCities(
          this.customerData.province,
          this.customerData.county,
        );
      }

      this.disableFields();
    } catch (error) {
      console.error("❌ Error loading basic info:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  async loadCities(province, selectedCity = null) {
    try {
      const response = await basicInfoApi.getCitiesByProvince(province);
      if (response.success) {
        basicInfoRenderer.renderCities(response.data, selectedCity);
      }
    } catch (error) {
      console.error("❌ Error loading cities:", error);
    }
  }

  setupEvents() {
    // رویداد تغییر استان
    const provinceSelect = document.getElementById("skb-province");
    if (provinceSelect) {
      provinceSelect.addEventListener("change", async (e) => {
        const selected = e.target.value;
        if (selected) {
          await this.loadCities(selected);
        }
      });
    }

    // دکمه ویرایش
    const editBtn = document.getElementById("skb-edit-btn");
    if (editBtn) {
      editBtn.addEventListener("click", () => this.enableEditing());
    }

    // دکمه بروزرسانی
    const submitBtn = document.getElementById("skb-submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => this.updateCustomer());
    }

    // دکمه انصراف
    const cancelBtn = document.getElementById("skb-cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.cancelEditing());
    }
  }

  enableEditing() {
    this.isEditing = true;
    basicInfoRenderer.enableFields();

    const editBtn = document.getElementById("skb-edit-btn");
    const submitBtn = document.getElementById("skb-submit-btn");
    const cancelBtn = document.getElementById("skb-cancel-btn");

    if (editBtn) editBtn.style.display = "none";
    if (submitBtn) submitBtn.style.display = "inline-flex";
    if (cancelBtn) cancelBtn.style.display = "inline-flex";

    notificationService.success("حالت ویرایش فعال شد");
  }

  cancelEditing() {
    this.isEditing = false;
    this.loadData();
  }

  disableFields() {
    basicInfoRenderer.disableFields();

    const editBtn = document.getElementById("skb-edit-btn");
    const submitBtn = document.getElementById("skb-submit-btn");
    const cancelBtn = document.getElementById("skb-cancel-btn");

    if (editBtn) editBtn.style.display = "inline-flex";
    if (submitBtn) submitBtn.style.display = "none";
    if (cancelBtn) cancelBtn.style.display = "none";
  }

  async updateCustomer() {
    const formData = basicInfoRenderer.getFormData();

    // ✅ Trim تمام مقادیر رشته‌ای
    Object.keys(formData).forEach((key) => {
      if (typeof formData[key] === "string") {
        formData[key] = formData[key].trim();
      }
    });

    // اعتبارسنجی
    const errors = this.validate(formData);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // تبدیل تاریخ
    if (formData.date_of_birth) {
      formData.date_of_birth = convertPersianToGregorian(
        formData.date_of_birth,
      );
    }

    const submitBtn = document.getElementById("skb-submit-btn");
    const originalText = submitBtn?.innerHTML;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> در حال بروزرسانی...';
    }

    try {
      const response = await basicInfoApi.updateCustomer(
        this.customerId,
        formData,
      );

      if (response.success) {
        notificationService.success("✅ اطلاعات مشتری با موفقیت بروزرسانی شد");
        await this.loadData();
        this.disableFields();
      } else {
        notificationService.error(response.message || "خطا در بروزرسانی");
      }
    } catch (error) {
      console.error("❌ Update error:", error);
      notificationService.error("خطا در ارتباط با سرور");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  }

  validate(data) {
    const errors = [];

    if (!data.full_name || data.full_name.trim().length < 3) {
      errors.push("نام و نام خانوادگی باید حداقل 3 کاراکتر باشد");
    }

    if (!data.farm_name || data.farm_name.trim().length < 2) {
      errors.push("نام فارم الزامی است");
    }

    if (!data.mobile_number || !isValidPhone(data.mobile_number)) {
      errors.push("شماره موبایل باید با 09 شروع شود و 11 رقم باشد");
    }

    if (!data.province) {
      errors.push("استان الزامی است");
    }

    if (!data.county) {
      errors.push("شهرستان الزامی است");
    }

    if (data.email && !isValidEmail(data.email)) {
      errors.push("فرمت پست الکترونیک معتبر نیست");
    }

    if (!data.farm_address || data.farm_address.trim().length < 5) {
      errors.push("آدرس فارم باید حداقل 5 کاراکتر باشد");
    }

    if (!data.postal_code || !isValidPostalCode(data.postal_code)) {
      errors.push("کد پستی باید 10 رقم باشد");
    }

    if (!data.experience_years) {
      errors.push("سابقه فعالیت الزامی است");
    }

    if (!data.education_level) {
      errors.push("سطح تحصیلات الزامی است");
    }

    if (!data.sales_department) {
      errors.push("دپارتمان الزامی است");
    }

    if (!data.gender) {
      errors.push("جنسیت الزامی است");
    }

    return errors;
  }

  refresh() {
    this.loadData();
  }
}

export const basicInfoService = new BasicInfoService();

// ============================================
// ✅ قرار دادن در window
// ============================================
if (typeof window !== "undefined") {
  window.basicInfoService = basicInfoService;
  window.BasicInfoService = BasicInfoService;

  // ✅ تابع کمکی برای بارگذاری اطلاعات
  window.loadCustomerDetails = async function () {
    const customerId =
      window.CURRENT_CUSTOMER_ID ||
      new URLSearchParams(window.location.search).get("id");
    if (customerId) {
      await basicInfoService.init(customerId);
    }
  };
}

console.log("✅ BasicInfoService loaded and exposed to window");
