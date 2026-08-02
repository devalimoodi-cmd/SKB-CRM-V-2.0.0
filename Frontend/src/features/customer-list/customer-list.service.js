import { customerListApi } from "./customer-list.api.js";
import { customerListRenderer } from "./customer-list.renderer.js";
import { customerListValidation } from "./customer-list.validation.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { stateService } from "../../core/services/state.service.js";
import {
  convertPersianToGregorian,
  convertGregorianToPersian,
} from "../../core/utils/date.utils.js";

class CustomerListService {
  constructor() {
    this.customers = [];
    this.currentPage = 1;
    this.pageSize = 10;
    this.totalPages = 0;
    this.totalItems = 0;
    this.searchTerm = "";
    this.searchColumn = "all";
    this.selectedCustomer = null;
    this.isEditing = false;
    this.editingCustomerId = null;
    this.initialized = false;
    this.dictionaries = {
      provinces: [],
      educationLevels: [],
      departments: [],
    };
  }

  async init() {
    // بررسی دسترسی
    const hasAccess = await authService.checkExpertPageAccess();
    if (!hasAccess) return;

    await this.loadData();
    this.setupSearch();
    // this.setupPagination(); // ✅ این خط رو کامنت کن (یا حذف کن)
    this.setupEvents();
    this.setupDatepicker();
    this.initialized = true;
    console.log("✅ CustomerListService initialized");
  }
  // ===== بارگذاری داده‌ها =====

  async loadData() {
    try {
      // بارگذاری دیکشنری‌ها
      await this.loadDictionaries();

      // بارگذاری مشتریان
      await this.loadCustomers();

      // تنظیم سلکت‌ها
      this.populateSelects();
    } catch (error) {
      console.error("❌ Error loading customer list data:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  async loadDictionaries() {
    try {
      const [provincesRes, educationRes, departmentsRes] = await Promise.all([
        customerListApi.getProvinces(),
        customerListApi.getEducationLevels(),
        customerListApi.getDepartments(),
      ]);

      this.dictionaries.provinces = provincesRes.success
        ? provincesRes.data
        : [];
      this.dictionaries.educationLevels = educationRes.success
        ? educationRes.data
        : [];
      this.dictionaries.departments = departmentsRes.success
        ? departmentsRes.data
        : [];

      // ذخیره در state
      stateService.setDictionary("provinces", this.dictionaries.provinces);
      stateService.setDictionary(
        "education",
        this.dictionaries.educationLevels,
      );
      stateService.setDictionary("departments", this.dictionaries.departments);
    } catch (error) {
      console.error("❌ Error loading dictionaries:", error);
    }
  }

  async loadCustomers() {
    try {
      const params = {
        page: this.currentPage,
        limit: this.pageSize,
        search: this.searchTerm,
        searchColumn: this.searchColumn,
      };

      const response = await customerListApi.getCustomers(params);
      if (response.success) {
        this.customers = response.data.customers || [];
        this.totalItems = response.data.pagination?.total || 0;
        this.totalPages = response.data.pagination?.totalPages || 0;
        stateService.set("customers", this.customers);

        this.renderTable();
        this.updatePaginationInfo();
        this.renderPagination();
      }
    } catch (error) {
      console.error("❌ Error loading customers:", error);
      this.customers = [];
      this.renderTable();
    }
  }

  // ===== رندر جدول =====

  renderTable() {
    const tbody = document.querySelector(".data-table tbody");
    if (!tbody) return;

    if (this.customers.length === 0) {
      tbody.innerHTML = `
                <tr>
                    <td colspan="13" style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fas fa-users" style="font-size: 32px; display: block; margin-bottom: 10px;"></i>
                        <span>هیچ مشتری‌ای ثبت نشده است</span>
                        <p style="font-size: 12px; margin-top: 8px;">برای شروع، یک مشتری جدید ثبت کنید</p>
                    </td>
                </tr>
            `;
      return;
    }

    const isSuperAdmin = authService.isAdmin();

    let html = "";
    this.customers.forEach((customer, index) => {
      const statusClass = customer.active ? "active" : "inactive";
      const statusText = customer.active ? "فعال" : "غیرفعال";
      const actionIcon = customer.active ? "fa-toggle-on" : "fa-toggle-off";
      const actionClass = customer.active ? "disable" : "enable";

      // تاریخ ثبت به شمسی
      let createdDate = "-";
      if (customer.created_at) {
        try {
          const date = new Date(customer.created_at);
          if (!isNaN(date.getTime())) {
            createdDate = new Intl.DateTimeFormat("fa-IR", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            }).format(date);
          }
        } catch (e) {
          createdDate = "-";
        }
      }

      // فقط سوپرادمین می‌تواند حذف کند
      const deleteButton = isSuperAdmin
        ? `
                <button class="action-btn delete" onclick="window.deleteCustomer(${customer.id})" title="حذف">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `
        : "";

      // نمایش وضعیت آنلاین
      const onlineStatus =
        customer.online_status === true ? "online" : "offline";

      html += `
                <tr data-customer-id="${customer.id}">
                    <td>${customer.id || index + 1}</td>
                    <td>${customer.collection_name || "-"}</td>
                    <td>
                        <div class="customer-info">
                            <div class="customer-avatar ${onlineStatus}">
                                ${
                                  customer.profile_image
                                    ? `<img src="${window.API_URL}${customer.profile_image}" alt="${customer.full_name}">`
                                    : `<i class="fa fa-user"></i>`
                                }
                            </div>
                            <span>${customer.full_name || "-"}</span>
                        </div>
                    </td>
                    <td>${customer.farm_name || "-"}</td>
                    <td>${customer.mobile_number || "-"}</td>
                    <td>${customer.messaging_number || "-"}</td>
                    <td>${customer.education_level || "-"}</td>
                    <td>${customer.gender || "-"}</td>
                    <td>${customer.province || "-"}</td>
                    <td>${customer.county || "-"}</td>
                    <td>${createdDate}</td>
                    <td>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view" onclick="window.viewCustomer(${customer.id})" title="مشاهده">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn edit" onclick="window.editCustomer(${customer.id})" title="ویرایش">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn ${actionClass}" onclick="window.toggleCustomerStatus(${customer.id}, ${customer.active})" title="${customer.active ? "غیرفعال" : "فعال"} سازی">
                                <i class="fas ${actionIcon}"></i>
                            </button>
                            ${deleteButton}
                        </div>
                    </td>
                </tr>
            `;
    });

    tbody.innerHTML = html;
  }

  // ===== صفحه‌بندی =====

  renderPagination() {
    const pageNumbers = document.getElementById("pageNumbers");
    if (!pageNumbers) return;

    if (this.totalPages <= 1) {
      pageNumbers.innerHTML = "";
      return;
    }

    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, this.currentPage + 2);

    if (this.totalPages <= 7) {
      startPage = 1;
      endPage = this.totalPages;
    } else {
      if (this.currentPage <= 3) {
        startPage = 1;
        endPage = 5;
      } else if (this.currentPage >= this.totalPages - 2) {
        startPage = this.totalPages - 4;
        endPage = this.totalPages;
      }
    }

    let html = "";

    // دکمه اول
    if (startPage > 1) {
      html += `<button class="page-num" onclick="window.goToPage(1)">1</button>`;
      if (startPage > 2) {
        html += `<span class="page-dots">...</span>`;
      }
    }

    // صفحات اصلی
    for (let i = startPage; i <= endPage; i++) {
      html += `
                <button class="page-num ${i === this.currentPage ? "active" : ""}" 
                        onclick="window.goToPage(${i})">
                    ${i}
                </button>
            `;
    }

    // دکمه آخر
    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        html += `<span class="page-dots">...</span>`;
      }
      html += `<button class="page-num" onclick="window.goToPage(${this.totalPages})">${this.totalPages}</button>`;
    }

    pageNumbers.innerHTML = html;

    // به‌روزرسانی وضعیت دکمه‌ها
    const firstPageBtn = document.getElementById("firstPage");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const lastPageBtn = document.getElementById("lastPage");

    if (firstPageBtn) firstPageBtn.disabled = this.currentPage === 1;
    if (prevPageBtn) prevPageBtn.disabled = this.currentPage === 1;
    if (nextPageBtn)
      nextPageBtn.disabled = this.currentPage === this.totalPages;
    if (lastPageBtn)
      lastPageBtn.disabled = this.currentPage === this.totalPages;
  }

  updatePaginationInfo() {
    const startRow = document.getElementById("startRow");
    const endRow = document.getElementById("endRow");
    const totalRows = document.getElementById("totalRows");

    if (startRow) {
      startRow.textContent =
        this.totalItems > 0 ? (this.currentPage - 1) * this.pageSize + 1 : 0;
    }
    if (endRow) {
      endRow.textContent = Math.min(
        this.currentPage * this.pageSize,
        this.totalItems,
      );
    }
    if (totalRows) {
      totalRows.textContent = this.totalItems;
    }
  }

  goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadCustomers();
  }

  changePageSize(size) {
    this.pageSize = parseInt(size);
    this.currentPage = 1;
    this.loadCustomers();
  }

  // ===== جستجو =====

  setupSearch() {
    const searchInput = document.getElementById("tableSearchInput");
    const searchColumn = document.getElementById("searchColumnSelect");
    const clearBtn = document.getElementById("clearSearchBtn");

    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchTerm = searchInput.value;
          this.currentPage = 1;
          this.loadCustomers();
          this.updateSearchStats();
        }, 300);
      });
    }

    if (searchColumn) {
      searchColumn.addEventListener("change", () => {
        this.searchColumn = searchColumn.value;
        this.currentPage = 1;
        this.loadCustomers();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          this.searchTerm = "";
          this.currentPage = 1;
          this.loadCustomers();
          this.updateSearchStats();
          clearBtn.style.display = "none";
        }
      });
    }

    // نمایش/مخفی کردن دکمه clear
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        if (clearBtn) {
          clearBtn.style.display = searchInput.value ? "flex" : "none";
        }
      });
    }
  }

  updateSearchStats() {
    const resultCount = document.getElementById("searchResultCount");
    const searchStats = document.getElementById("searchStats");

    if (resultCount) {
      resultCount.textContent = this.totalItems;
    }

    if (searchStats) {
      if (this.searchTerm) {
        searchStats.style.background = "#e8f0fe";
      } else {
        searchStats.style.background = "#f0f2f5";
      }
    }
  }

  // ===== فرم ثبت/ویرایش مشتری =====

  populateSelects(customer = null) {
    // استان
    const provinceSelect = document.getElementById("province");
    if (provinceSelect) {
      const currentValue = provinceSelect.value;
      provinceSelect.innerHTML = '<option value="">انتخاب استان</option>';
      this.dictionaries.provinces.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.state_name;
        option.textContent = item.state_name;
        provinceSelect.appendChild(option);
      });
      if (customer?.province) {
        provinceSelect.value = customer.province;
      } else if (currentValue) {
        provinceSelect.value = currentValue;
      }
    }

    // سطح تحصیلات
    const educationSelect = document.getElementById("education");
    if (educationSelect) {
      const currentValue = educationSelect.value;
      educationSelect.innerHTML =
        '<option value="">انتخاب سطح تحصیلات</option>';
      this.dictionaries.educationLevels.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.title;
        option.textContent = item.title;
        educationSelect.appendChild(option);
      });
      if (customer?.education_level) {
        educationSelect.value = customer.education_level;
      } else if (currentValue) {
        educationSelect.value = currentValue;
      }
    }

    // دپارتمان
    const deptSelect = document.getElementById("department");
    if (deptSelect) {
      const currentValue = deptSelect.value;
      deptSelect.innerHTML = '<option value="">انتخاب دپارتمان</option>';
      this.dictionaries.departments.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.title;
        option.textContent = item.title;
        deptSelect.appendChild(option);
      });
      if (customer?.sales_department) {
        deptSelect.value = customer.sales_department;
      } else if (currentValue) {
        deptSelect.value = currentValue;
      }
    }
  }

  async loadCitiesByProvince(province, selectedCity = null) {
    const citySelect = document.getElementById("city");
    if (!citySelect) return;

    const currentValue = citySelect.value;
    citySelect.innerHTML = '<option value="">در حال بارگذاری...</option>';

    try {
      const response = await customerListApi.getCitiesByProvince(province);
      if (response.success) {
        citySelect.innerHTML = '<option value="">انتخاب شهرستان</option>';
        response.data.forEach((city) => {
          const option = document.createElement("option");
          option.value = city.city_name;
          option.textContent = city.city_name;
          citySelect.appendChild(option);
        });

        if (
          selectedCity &&
          Array.from(citySelect.options).some(
            (opt) => opt.value === selectedCity,
          )
        ) {
          citySelect.value = selectedCity;
        } else if (
          currentValue &&
          Array.from(citySelect.options).some(
            (opt) => opt.value === currentValue,
          )
        ) {
          citySelect.value = currentValue;
        }
      }
    } catch (error) {
      console.error("❌ Error loading cities:", error);
      citySelect.innerHTML = '<option value="">خطا در دریافت اطلاعات</option>';
    }
  }

  setupDatepicker() {
    const birthdateInput = document.getElementById("birthdate");
    if (!birthdateInput) return;

    if (birthdateInput.hasAttribute("data-datepicker-initialized")) return;

    try {
      if (typeof $.fn.persianDatepicker !== "undefined") {
        $(birthdateInput).persianDatepicker({
          format: "YYYY/MM/DD",
          autoClose: true,
          initialValue: false,
          observer: true,
          calendar: {
            persian: {
              locale: "fa",
            },
          },
          onSelect: function (unix, formatDate) {
            if (formatDate) {
              birthdateInput.setAttribute("data-selected-date", formatDate);
            }
          },
        });
        birthdateInput.setAttribute("data-datepicker-initialized", "true");
        console.log("✅ Datepicker for birthdate initialized");
      } else {
        birthdateInput.placeholder = "۱۴۰۴/۰۱/۰۱";
        birthdateInput.setAttribute("data-datepicker-initialized", "true");
      }
    } catch (error) {
      console.warn("⚠️ Error initializing datepicker:", error);
      birthdateInput.placeholder = "۱۴۰۴/۰۱/۰۱";
      birthdateInput.setAttribute("data-datepicker-initialized", "true");
    }
  }

  // ===== ثبت/ویرایش مشتری =====

  async registerCustomer(data) {
    const errors = customerListValidation.validate(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // تبدیل تاریخ تولد
    let birthdate = data.date_of_birth;
    if (birthdate && birthdate.includes("/")) {
      birthdate = convertPersianToGregorian(birthdate);
    }

    const payload = {
      ...data,
      date_of_birth: birthdate || "2000-01-01",
      email: data.email || null,
    };

    const btn = document.querySelector(".submit-btn");
    const originalText = btn?.innerHTML;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';
    }

    try {
      let response;
      if (this.isEditing && this.editingCustomerId) {
        response = await customerListApi.updateCustomer(
          this.editingCustomerId,
          payload,
        );
      } else {
        response = await customerListApi.registerCustomer(payload);
      }

      if (response.success) {
        notificationService.success(
          this.isEditing
            ? "✅ مشتری با موفقیت بروزرسانی شد"
            : "✅ مشتری با موفقیت ثبت شد",
        );

        // ✅ ترتیب درست: اول رفرش جدول، بعد ریست فرم و بستن مودال
        await this.loadCustomers();
        this.resetForm();
        this.closeModal();
      } else {
        notificationService.error(response.message || "خطا در ثبت مشتری");
      }
    } catch (error) {
      console.error("❌ Error saving customer:", error);
      // نشون دادن پیغام واقعی خطا از سرور
      notificationService.error(error.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  async editCustomer(id) {
    try {
      const response = await customerListApi.getCustomer(id);
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات مشتری");
        return;
      }

      const customer = response.data;
      this.isEditing = true;
      this.editingCustomerId = customer.id;

      // بارگذاری دیکشنری‌ها
      await this.loadDictionaries();
      this.populateSelects(customer);

      // بارگذاری شهرستان‌ها
      if (customer.province) {
        await this.loadCitiesByProvince(customer.province, customer.county);
      }

      // پر کردن فیلدها
      document.getElementById("company-name").value =
        customer.collection_name || "";
      document.getElementById("full-name").value = customer.full_name || "";
      document.getElementById("farm-name").value = customer.farm_name || "";
      document.getElementById("mobile").value = customer.mobile_number || "";
      document.getElementById("messenger").value =
        customer.messaging_number || "";
      document.getElementById("email").value = customer.email || "";
      document.getElementById("postal-code").value = customer.postal_code || "";
      document.getElementById("farm-address").value =
        customer.farm_address || "";

      if (customer.date_of_birth) {
        document.getElementById("birthdate").value = convertGregorianToPersian(
          customer.date_of_birth,
        );
      }

      // ✅ پر کردن فیلدهای select با مقادیر ثابت
      const experienceSelect = document.getElementById("poultry-experience");
      if (experienceSelect && customer.experience_years) {
        experienceSelect.value = customer.experience_years;
      }

      const genderSelect = document.getElementById("gender");
      if (genderSelect && customer.gender) {
        genderSelect.value = customer.gender;
      }

      const howKnowSelect = document.getElementById("how-know");
      if (howKnowSelect && customer.skb_how_know) {
        howKnowSelect.value = customer.skb_how_know;
      }

      // تغییر دکمه‌ها
      const submitBtn = document.querySelector(".submit-btn");
      const cancelBtn = document.querySelector(".cancel-btn");

      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-save"></i> بروزرسانی مشتری';
        submitBtn.style.background = "#f59e0b";
      }
      if (cancelBtn) {
        cancelBtn.style.display = "inline-flex";
        cancelBtn.onclick = () => {
          this.resetForm();
          this.closeModal();
          notificationService.info("حالت ویرایش لغو شد");
        };
      }

      // باز کردن مودال
      this.openModal();

      notificationService.success("✅ اطلاعات مشتری بارگذاری شد، ویرایش کنید");
    } catch (error) {
      console.error("❌ Error editing customer:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  async deleteCustomer(id) {
    // بررسی دسترسی سوپرادمین
    if (!authService.isAdmin()) {
      notificationService.error("⛔ فقط مدیر اصلی می‌تواند مشتری را حذف کند");
      return;
    }

    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف مشتری",
      text: `آیا از حذف این مشتری اطمینان دارید؟\n\n⚠️ تمام اطلاعات مرتبط شامل:\n• اطلاعات شخصی\n• دوره‌های پرورش\n• سالن‌ها\n• گله‌ها\n• اطلاعات هفتگی\n• گزارشات بازدید\n• بوکمارک‌ها\n\nهمگی حذف خواهند شد!`,
      confirmText: "بله، همه چیز حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await customerListApi.deleteCustomer(id);
      if (response.success) {
        notificationService.success(
          "✅ مشتری و تمام اطلاعات مرتبط با موفقیت حذف شد",
        );
        await this.loadCustomers();
      } else {
        notificationService.error(response.message || "خطا در حذف مشتری");
      }
    } catch (error) {
      console.error("❌ Error deleting customer:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  async toggleCustomerStatus(id, currentStatus) {
    const action = currentStatus ? "disable" : "enable";
    const actionText = currentStatus ? "غیرفعال" : "فعال";

    const confirmed = await notificationService.confirm({
      title: `${actionText} سازی مشتری`,
      text: `آیا از ${actionText} سازی این مشتری اطمینان دارید؟`,
      confirmText: `بله، ${actionText} شود`,
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await customerListApi.toggleCustomerStatus(id, action);
      if (response.success) {
        notificationService.success(`✅ وضعیت مشتری با موفقیت تغییر کرد`);
        await this.loadCustomers();
      } else {
        notificationService.error(response.message || "خطا در تغییر وضعیت");
      }
    } catch (error) {
      console.error("❌ Error toggling customer status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  viewCustomer(id) {
    window.location.href = `/customer-info?id=${id}`;
  }

  // ===== مودال =====

  openModal() {
    const modal = document.getElementById("customerModal");
    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  closeModal(skipReset = false) {
    const modal = document.getElementById("customerModal");
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
    if (!skipReset) {
      this.resetForm();
    }
  }

  resetForm() {
    this.isEditing = false;
    this.editingCustomerId = null;

    // پاک کردن فیلدها
    [
      "company-name",
      "full-name",
      "farm-name",
      "mobile",
      "messenger",
      "birthdate",
      "email",
      "postal-code",
      "farm-address",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    [
      "province",
      "city",
      "education",
      "department",
      "gender",
      "how-know",
      "poultry-experience",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    // برگرداندن دکمه‌ها به حالت اولیه
    const submitBtn = document.querySelector(".submit-btn");
    const cancelBtn = document.querySelector(".cancel-btn");

    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-check-circle"></i> ثبت نام مشتری';
      submitBtn.style.background = "";
      submitBtn.disabled = false;
    }
    if (cancelBtn) {
      cancelBtn.style.display = "none";
      cancelBtn.onclick = null;
    }
  }

  // ===== رویدادها =====

  setupEvents() {
    // دکمه ثبت مشتری
    const submitBtn = document.querySelector(".submit-btn");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const data = this.getFormData();
        this.registerCustomer(data);
      });
    }

    // دکمه انصراف
    const cancelBtn = document.querySelector(".cancel-btn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.resetForm();
        this.closeModal();
      });
    }

    // تغییر استان
    const provinceSelect = document.getElementById("province");
    if (provinceSelect) {
      provinceSelect.addEventListener("change", async (e) => {
        const selected = e.target.value;
        if (selected) {
          await this.loadCitiesByProvince(selected);
        }
      });
    }

    // تغییر تعداد نمایش در هر صفحه
    const pageSizeSelect = document.getElementById("pageSizeSelect");
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener("change", (e) => {
        this.changePageSize(e.target.value);
      });
    }

    // دکمه‌های صفحه‌بندی
    const firstPageBtn = document.getElementById("firstPage");
    const prevPageBtn = document.getElementById("prevPage");
    const nextPageBtn = document.getElementById("nextPage");
    const lastPageBtn = document.getElementById("lastPage");

    if (firstPageBtn)
      firstPageBtn.addEventListener("click", () => this.goToPage(1));
    if (prevPageBtn)
      prevPageBtn.addEventListener("click", () =>
        this.goToPage(this.currentPage - 1),
      );
    if (nextPageBtn)
      nextPageBtn.addEventListener("click", () =>
        this.goToPage(this.currentPage + 1),
      );
    if (lastPageBtn)
      lastPageBtn.addEventListener("click", () =>
        this.goToPage(this.totalPages),
      );

    // بستن مودال با کلیک روی backdrop
    const modal = document.getElementById("customerModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeModal();
        }
      });
    }

    // بستن مودال با کلید Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeModal();
      }
    });
  }

  getFormData() {
    return {
      collection_name: document.getElementById("company-name")?.value || null,
      full_name: document.getElementById("full-name")?.value || "",
      farm_name: document.getElementById("farm-name")?.value || "",
      mobile_number: document.getElementById("mobile")?.value || "",
      messaging_number: document.getElementById("messenger")?.value || null,
      date_of_birth: document.getElementById("birthdate")?.value || null,
      email: document.getElementById("email")?.value || null,
      experience_years:
        document.getElementById("poultry-experience")?.value || null,
      education_level: document.getElementById("education")?.value || null,
      sales_department: document.getElementById("department")?.value || null,
      gender: document.getElementById("gender")?.value || null,
      province: document.getElementById("province")?.value || null,
      county: document.getElementById("city")?.value || null,
      postal_code: document.getElementById("postal-code")?.value || null,
      farm_address: document.getElementById("farm-address")?.value || null,
      skb_how_know: document.getElementById("how-know")?.value || null,
    };
  }

  // ===== رفرش =====

  refresh() {
    this.loadCustomers();
  }
}
// ===== در انتهای customer-list.service.js =====

export const customerListService = new CustomerListService();

// ===== ✅ اضافه کردن به window =====
if (typeof window !== "undefined") {
  window.customerListService = customerListService;
  window.CustomerListService = CustomerListService;

  // ✅ توابع مورد نیاز برای onclick در HTML
  window.viewCustomer =
    customerListService.viewCustomer.bind(customerListService);
  window.editCustomer =
    customerListService.editCustomer.bind(customerListService);
  window.deleteCustomer =
    customerListService.deleteCustomer.bind(customerListService);
  window.toggleCustomerStatus =
    customerListService.toggleCustomerStatus.bind(customerListService);
  window.goToPage = customerListService.goToPage.bind(customerListService);
}

console.log("✅ CustomerListService loaded and exposed to window");
