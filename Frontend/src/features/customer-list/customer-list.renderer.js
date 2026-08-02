import {
  convertToPersianDate,
  formatDate,
} from "../../core/utils/date.utils.js";

export const customerListRenderer = {
  // ===== رندر جدول =====

  renderTable(customers, isSuperAdmin = false) {
    if (!customers || customers.length === 0) {
      return `
                <tr>
                    <td colspan="13" style="text-align: center; padding: 40px; color: #94a3b8;">
                        <i class="fas fa-users" style="font-size: 32px; display: block; margin-bottom: 10px;"></i>
                        <span>هیچ مشتری‌ای ثبت نشده است</span>
                        <p style="font-size: 12px; margin-top: 8px;">برای شروع، یک مشتری جدید ثبت کنید</p>
                    </td>
                </tr>
            `;
    }

    let html = "";
    customers.forEach((customer, index) => {
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

      // وضعیت آنلاین
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

    return html;
  },

  // ===== صفحه‌بندی =====

  renderPagination(currentPage, totalPages, totalItems, pageSize) {
    if (totalPages <= 1) {
      return {
        pageNumbers: "",
        paginationInfo: this.getPaginationInfo(
          currentPage,
          totalItems,
          pageSize,
        ),
      };
    }

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (totalPages <= 7) {
      startPage = 1;
      endPage = totalPages;
    } else {
      if (currentPage <= 3) {
        startPage = 1;
        endPage = 5;
      } else if (currentPage >= totalPages - 2) {
        startPage = totalPages - 4;
        endPage = totalPages;
      }
    }

    let html = "";

    if (startPage > 1) {
      html += `<button class="page-num" onclick="window.goToPage(1)">1</button>`;
      if (startPage > 2) {
        html += `<span class="page-dots">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `
                <button class="page-num ${i === currentPage ? "active" : ""}" 
                        onclick="window.goToPage(${i})">
                    ${i}
                </button>
            `;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        html += `<span class="page-dots">...</span>`;
      }
      html += `<button class="page-num" onclick="window.goToPage(${totalPages})">${totalPages}</button>`;
    }

    return {
      pageNumbers: html,
      paginationInfo: this.getPaginationInfo(currentPage, totalItems, pageSize),
    };
  },

  getPaginationInfo(currentPage, totalItems, pageSize) {
    const start = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const end = Math.min(currentPage * pageSize, totalItems);
    return {
      start,
      end,
      total: totalItems,
    };
  },

  // ===== فرم =====

  renderFormSelects(selects, selectedValues = {}) {
    let html = "";

    // استان
    html += this.renderSelect(
      "province",
      selects.provinces || [],
      "انتخاب استان",
      selectedValues.province,
    );

    // شهرستان (با JS پر می‌شود)
    html += this.renderSelect(
      "city",
      [],
      "انتخاب شهرستان",
      selectedValues.city,
    );

    // سطح تحصیلات
    html += this.renderSelect(
      "education",
      selects.educationLevels || [],
      "انتخاب سطح تحصیلات",
      selectedValues.education_level,
    );

    // دپارتمان
    html += this.renderSelect(
      "department",
      selects.departments || [],
      "انتخاب دپارتمان",
      selectedValues.sales_department,
    );

    // سابقه مرغداری
    html += this.renderSelect(
      "poultry-experience",
      [
        { value: "", text: "انتخاب سابقه فعالیت" },
        { value: "less-than-1", text: "کمتر از ۱ سال" },
        { value: "1-3", text: "۱ تا ۳ سال" },
        { value: "3-5", text: "۳ تا ۵ سال" },
        { value: "5-10", text: "۵ تا ۱۰ سال" },
        { value: "more-than-10", text: "بیش از ۱۰ سال" },
      ],
      "انتخاب سابقه فعالیت",
      selectedValues.experience_years,
    );

    // جنسیت
    html += this.renderSelect(
      "gender",
      [
        { value: "", text: "انتخاب جنسیت" },
        { value: "مرد", text: "مرد" },
        { value: "زن", text: "زن" },
      ],
      "انتخاب جنسیت",
      selectedValues.gender,
    );

    // نحوه آشنایی
    html += this.renderSelect(
      "how-know",
      [
        { value: "", text: "انتخاب نحوه آشنایی" },
        { value: "شبکه‌های اجتماعی", text: "شبکه‌های اجتماعی" },
        { value: "دوستان و آشنایان", text: "دوستان و آشنایان" },
        { value: "تبلیغات", text: "تبلیغات" },
        { value: "نمایشگاه", text: "نمایشگاه" },
        { value: "وبسایت", text: "وبسایت" },
        { value: "سایر", text: "سایر" },
      ],
      "انتخاب نحوه آشنایی",
      selectedValues.skb_how_know,
    );

    return html;
  },

  renderSelect(id, options, placeholder, selectedValue = "") {
    let html = `
            <div class="filed-wraper">
                <div class="filed-flot-input select-input">
                    <i class="fas fa-chevron-down select-arrow"></i>
                    <select id="${id}" class="float-input float-select">
        `;

    options.forEach((option) => {
      const selected = option.value === selectedValue ? "selected" : "";
      html += `<option value="${option.value}" ${selected}>${option.text || option.title || option.state_name || option}</option>`;
    });

    html += `
                    </select>
                    <label class="float-label">${placeholder}</label>
                </div>
            </div>
        `;

    return html;
  },

  // ===== جستجو =====

  renderSearchBar(searchTerm = "", searchColumn = "all") {
    return `
            <div class="search-bar-container">
                <div class="search-box-wrapper">
                    <div class="search-box">
                        <i class="fas fa-search search-box-icon"></i>
                        <input type="text" id="tableSearchInput" class="search-box-input" 
                               placeholder="جستجو در جدول..." value="${searchTerm}">
                        <button class="search-box-clear" id="clearSearchBtn" style="display: ${searchTerm ? "flex" : "none"}">
                            <i class="fas fa-times-circle"></i>
                        </button>
                    </div>
                    <div class="search-stats" id="searchStats">
                        <span id="searchResultCount">0</span> نتیجه یافت شد
                    </div>
                    <div class="search-filter-group">
                        <select id="searchColumnSelect" class="search-column-select">
                            <option value="all" ${searchColumn === "all" ? "selected" : ""}>همه ستون‌ها</option>
                            <option value="0" ${searchColumn === "0" ? "selected" : ""}>ID</option>
                            <option value="1" ${searchColumn === "1" ? "selected" : ""}>نام مجموعه</option>
                            <option value="2" ${searchColumn === "2" ? "selected" : ""}>نام مشتری</option>
                            <option value="3" ${searchColumn === "3" ? "selected" : ""}>نام فارم</option>
                            <option value="4" ${searchColumn === "4" ? "selected" : ""}>شماره تماس</option>
                            <option value="5" ${searchColumn === "5" ? "selected" : ""}>شماره پیامرسان</option>
                            <option value="6" ${searchColumn === "6" ? "selected" : ""}>تحصیلات</option>
                            <option value="7" ${searchColumn === "7" ? "selected" : ""}>جنسیت</option>
                            <option value="8" ${searchColumn === "8" ? "selected" : ""}>استان</option>
                            <option value="9" ${searchColumn === "9" ? "selected" : ""}>شهر</option>
                            <option value="10" ${searchColumn === "10" ? "selected" : ""}>تاریخ ثبت</option>
                            <option value="11" ${searchColumn === "11" ? "selected" : ""}>وضعیت</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
  },

  // ===== وضعیت =====

  getStatusBadge(status) {
    const map = {
      active: { class: "active", text: "فعال" },
      inactive: { class: "inactive", text: "غیرفعال" },
      pending: { class: "pending", text: "در انتظار" },
    };
    const info = map[status] || map.inactive;
    return `<span class="status-badge ${info.class}">${info.text}</span>`;
  },
};
