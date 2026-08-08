// ================================================================
// dictionary.manager.js - کامپوننت مدیریت جداول دیکشنری
// یک UI دینامیک که بر اساس schema هر جدول، فرم و جدول می‌سازد.
// ================================================================

import { dictionaryApi } from "./dictionary.api.js";
import {
  getAllDictionarySchemas,
  getDictionarySchema,
} from "./dictionary.schemas.js";

class DictionaryManager {
  constructor() {
    this.initialized = false;
    this.currentKey = null;
    this.schema = null;
    this.data = [];
    this.container = null;
  }

  // ===== مقداردهی =====
  init(containerSelector = "#dictionary-management") {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;

    this.initialized = true;
    this.renderShell();

    // انتخاب اولین جدول به‌صورت پیش‌فرض
    const firstKey = Object.keys(getAllDictionarySchemas())[0];
    this.selectTable(firstKey);
  }

  // ===== ساختار اصلی کامپوننت =====
  renderShell() {
    const schemas = getAllDictionarySchemas();
    const keys = Object.keys(schemas);

    const tableMenu = keys
      .map(
        (key) => `
        <div class="dict-table-item" data-dict-key="${key}" onclick="window.dictManager.selectTable('${key}')">
          <i class="fas ${schemas[key].icon} dict-table-icon"></i>
          <span class="dict-table-name">${schemas[key].title}</span>
        </div>
      `,
      )
      .join("");

    this.container.innerHTML = `
      <div class="dict-manager">
        <!-- ===== ستون راست: لیست جداول ===== -->
        <div class="dict-sidebar">
          <div class="dict-sidebar-header">
            <i class="fas fa-book"></i>
            <span>جداول دیکشنری</span>
          </div>
          <div class="dict-table-list">
            ${tableMenu}
          </div>
        </div>

        <!-- ===== ستون چپ: محتوای جدول انتخاب‌شده ===== -->
        <div class="dict-content">
          <div class="dict-content-header" id="dictContentHeader">
            <div>
              <h3 id="dictTitle"><i class="fas fa-book"></i><span>انتخاب جدول</span></h3>
              <p id="dictSubtitle">از لیست سمت راست یک جدول را انتخاب کنید</p>
            </div>
            <button class="dict-add-btn" id="dictAddBtn" onclick="window.dictManager.openCreateModal()">
              <i class="fas fa-plus"></i> ایجاد جدید
            </button>
          </div>

          <div id="dictTableWrapper" class="dict-table-wrapper">
            <div class="dict-empty-state">
              <i class="fas fa-inbox"></i>
              <p>جدولی انتخاب نشده است</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ===== انتخاب جدول =====
  async selectTable(key) {
    this.currentKey = key;
    this.schema = getDictionarySchema(key);
    if (!this.schema) return;

    // فعال‌سازی آیتم منو
    this.container
      .querySelectorAll(".dict-table-item")
      .forEach((el) => el.classList.remove("active"));
    this.container
      .querySelector(`.dict-table-item[data-dict-key="${key}"]`)
      ?.classList.add("active");

    // آپدیت هدر
    const titleEl = this.container.querySelector("#dictTitle");
    if (titleEl) {
      titleEl.innerHTML = `<i class="fas ${this.schema.icon}"></i><span>${this.schema.title}</span>`;
    }
    const subtitleEl = this.container.querySelector("#dictSubtitle");
    if (subtitleEl) {
      subtitleEl.textContent = `مدیریت رکوردهای جدول «${this.schema.title}»`;
    }

    await this.loadData();
  }

  // ===== بارگذاری داده‌ها =====
  async loadData() {
    if (!this.schema) return;

    const wrapper = this.container.querySelector("#dictTableWrapper");
    if (!wrapper) return;

    wrapper.innerHTML = `
      <div class="dict-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>در حال بارگذاری...</span>
      </div>
    `;

    try {
      const res = await dictionaryApi.getData(this.currentKey, {
        active: "all",
      });
      this.data = Array.isArray(res.data) ? res.data : [];
      this.renderTable();
    } catch (error) {
      console.error("❌ خطا در بارگذاری جدول دیکشنری:", error);
      wrapper.innerHTML = `
        <div class="dict-error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>خطا در دریافت داده‌ها</p>
          <button onclick="window.dictManager.loadData()">تلاش مجدد</button>
        </div>
      `;
    }
  }

  // ===== رندر جدول بر اساس schema =====
  renderTable() {
    const wrapper = this.container.querySelector("#dictTableWrapper");
    if (!wrapper || !this.schema) return;

    const fields = this.schema.fields;
    const canToggle = this.schema.canToggle !== false;

    // سرستون‌ها — دقیقاً نام ستون‌های دیتابیس (کلید) هر جدول
    const theadCols = fields.map((f) => `<th>${f.key}</th>`).join("");
    // ستون وضعیت فقط برای جداولی که active دارند
    const statusCol = canToggle ? `<th>active</th>` : "";
    const actionCol = `<th>عملیات</th>`;

    // تعداد ستون‌ها برای colspan = 1(id) + fields + (وضعیت) + 1(عملیات)
    const extraCols = canToggle ? 3 : 2;

    let rows = "";
    if (this.data.length === 0) {
      rows = `
        <tr>
          <td colspan="${fields.length + extraCols}" style="text-align:center; color:#94a3b8; padding:40px;">
            <i class="fas fa-inbox" style="font-size:28px; display:block; margin-bottom:10px;"></i>
            هیچ رکوردی یافت نشد
          </td>
        </tr>
      `;
    } else {
      const allActive = (item) => item.active !== false;

      rows = this.data
        .map((item) => {
          const cells = fields
            .map((f) => {
              let value = item[f.key];
              if (value === null || value === undefined) value = "-";
              if (f.type === "boolean") {
                value = value ? "✅ بله" : "❌ خیر";
              } else if (f.type === "color" && value) {
                value = `<span class="dict-color-chip"><span style="background:${value}"></span>${value}</span>`;
              } else if (String(value).length > 60) {
                value = String(value).substring(0, 60) + "...";
              }
              return `<td>${value}</td>`;
            })
            .join("");

          const active = allActive(item);
          const statusBadge = canToggle
            ? `<td>${active ? '<span class="dict-status-badge active">فعال</span>' : '<span class="dict-status-badge inactive">غیرفعال</span>'}</td>`
            : "";

          const toggleBtn = canToggle
            ? `<button class="dict-action-btn toggle" title="فعال/غیرفعال" onclick="window.dictManager.toggleActive(${item.id})">
                <i class="fas ${active ? "fa-eye-slash" : "fa-eye"}"></i>
              </button>`
            : "";

          return `
            <tr>
              <td>${item.id}</td>
              ${cells}
              ${statusBadge}
              <td>
                <div class="dict-actions">
                  <button class="dict-action-btn edit" title="ویرایش" onclick="window.dictManager.openEditModal(${item.id})">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="dict-action-btn delete" title="حذف" onclick="window.dictManager.deleteItem(${item.id})">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                  ${toggleBtn}
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    wrapper.innerHTML = `
      <div class="dict-table-container">
        <table class="dict-table">
          <thead>
            <tr>
              <th>id</th>
              ${theadCols}
              ${statusCol}
              ${actionCol}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="dict-table-footer">
        <span>${this.data.length} رکورد</span>
      </div>
    `;
  }

  // ===== ساخت فرم HTML بر اساس schema =====
  buildFormHtml(data = {}) {
    const fields = this.schema.fields;
    return fields
      .map((f) => {
        const value =
          data[f.key] !== undefined && data[f.key] !== null ? data[f.key] : "";
        let input = "";

        switch (f.type) {
          case "textarea":
            input = `<textarea id="dict-field-${f.key}" rows="3" placeholder=" ">${value}</textarea>`;
            break;
          case "number":
            input = `<input type="number" id="dict-field-${f.key}" value="${value}" step="any">`;
            break;
          case "boolean":
            input = `
              <div class="dict-checkbox-wrapper">
                <label class="dict-switch">
                  <input type="checkbox" id="dict-field-${f.key}" ${value ? "checked" : ""}>
                  <span class="dict-switch-slider"></span>
                </label>
                <span class="dict-checkbox-label">${value ? "بله" : "خیر"}</span>
              </div>
            `;
            break;
          case "color":
            input = `<input type="color" id="dict-field-${f.key}" value="${value || "#000000"}">`;
            break;
          default:
            input = `<input type="text" id="dict-field-${f.key}" value="${value}" placeholder=" ">`;
        }

        return `
          <div class="dict-form-field ${f.required ? "required" : ""}">
            <label for="dict-field-${f.key}">${f.label}</label>
            ${input}
            ${f.required ? '<span class="dict-required-star">*</span>' : ""}
          </div>
        `;
      })
      .join("");
  }

  // ===== جمع‌آوری مقادیر فرم =====
  collectFormData() {
    const data = {};
    this.schema.fields.forEach((f) => {
      const el = document.getElementById(`dict-field-${f.key}`);
      if (!el) return;
      const rawValue = el.value;

      if (f.type === "number") {
        data[f.key] = rawValue !== "" ? Number(rawValue) : null;
      } else if (f.type === "boolean") {
        data[f.key] = el.checked;
      } else if (f.type === "color") {
        data[f.key] = rawValue || null;
      } else {
        data[f.key] = rawValue !== "" ? rawValue : null;
      }
    });
    return data;
  }

  // ===== اعتبارسنجی =====
  validateForm(data) {
    for (const f of this.schema.fields) {
      if (f.required) {
        const val = data[f.key];
        if (val === null || val === undefined || val === "") {
          return `فیلد «${f.label}» الزامی است`;
        }
      }
    }
    return null;
  }

  // ===== مودال ایجاد =====
  openCreateModal() {
    if (!this.schema) return;
    if (typeof Swal === "undefined") {
      alert("SweetAlert در دسترس نیست");
      return;
    }

    const formHtml = this.buildFormHtml();
    Swal.fire({
      title: `<i class="fas ${this.schema.icon}"></i> ایجاد رکورد جدید در «${this.schema.title}»`,
      html: formHtml,
      width: "620px",
      confirmButtonText: "ایجاد",
      cancelButtonText: "انصراف",
      showCancelButton: true,
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      customClass: { popup: "dict-swal-popup" },
      preConfirm: async () => {
        const data = this.collectFormData();
        const error = this.validateForm(data);
        if (error) {
          Swal.showValidationMessage(error);
          return false;
        }
        try {
          const res = await dictionaryApi.create(this.currentKey, data);
          if (res.success) return data;
          Swal.showValidationMessage(res.message || "خطا در ایجاد رکورد");
          return false;
        } catch (e) {
          Swal.showValidationMessage(e.message || "خطا در ارتباط با سرور");
          return false;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: "success",
          title: "✅ ایجاد شد",
          text: "رکورد جدید با موفقیت ایجاد شد",
          timer: 1500,
          showConfirmButton: false,
        });
        this.loadData();
      }
    });
  }

  // ===== مودال ویرایش =====
  async openEditModal(id) {
    if (!this.schema) return;
    if (typeof Swal === "undefined") {
      alert("SweetAlert در دسترس نیست");
      return;
    }

    const item = this.data.find((d) => d.id == id);
    if (!item) return;

    const formHtml = this.buildFormHtml(item);
    Swal.fire({
      title: `<i class="fas ${this.schema.icon}"></i> ویرایش رکورد #${id}`,
      html: formHtml,
      width: "620px",
      confirmButtonText: "ذخیره",
      cancelButtonText: "انصراف",
      showCancelButton: true,
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      customClass: { popup: "dict-swal-popup" },
      preConfirm: async () => {
        const data = this.collectFormData();
        const error = this.validateForm(data);
        if (error) {
          Swal.showValidationMessage(error);
          return false;
        }
        try {
          const res = await dictionaryApi.update(this.currentKey, id, data);
          if (res.success) return data;
          Swal.showValidationMessage(res.message || "خطا در ذخیره");
          return false;
        } catch (e) {
          Swal.showValidationMessage(e.message || "خطا در ارتباط با سرور");
          return false;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: "success",
          title: "✅ ذخیره شد",
          timer: 1500,
          showConfirmButton: false,
        });
        this.loadData();
      }
    });
  }

  // ===== حذف رکورد =====
  async deleteItem(id) {
    if (!this.schema) return;

    const item = this.data.find((d) => d.id == id);
    // استفاده از اولین فیلد schema برای نمایش نام رکورد (هماهنگ با هر جدول)
    const firstField = this.schema.fields[0];
    const displayValue = item?.[firstField.key];
    const name = displayValue || `#${id}`;

    const confirmResult = await Swal.fire({
      title: "⚠️ تأیید حذف",
      html: `آیا از حذف <strong>«${name}»</strong> اطمینان دارید؟`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) return;

    try {
      const res = await dictionaryApi.delete(this.currentKey, id);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: "✅ حذف شد",
          text: "رکورد با موفقیت حذف شد",
          timer: 1500,
          showConfirmButton: false,
        });
        this.loadData();
      } else {
        Swal.fire({
          icon: "error",
          title: "❌ خطا",
          text: res.message || "حذف انجام نشد",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "❌ خطا",
        text: error.message || "خطا در ارتباط با سرور",
      });
    }
  }

  // ===== فعال/غیرفعال کردن =====
  async toggleActive(id) {
    if (!this.schema) return;

    const item = this.data.find((d) => d.id == id);
    if (!item) return;

    const newActive = item.active === false;

    try {
      const res = await dictionaryApi.update(this.currentKey, id, {
        active: newActive,
      });
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: newActive ? "✅ فعال شد" : "⏸ غیرفعال شد",
          timer: 1000,
          showConfirmButton: false,
        });
        this.loadData();
      }
    } catch (error) {
      console.error("❌ خطا در تغییر وضعیت:", error);
    }
  }
}

// ===== Export instance =====
export const dictionaryManager = new DictionaryManager();

// ===== قرار دادن در window =====
if (typeof window !== "undefined") {
  window.DictionaryManager = DictionaryManager;
  window.dictManager = dictionaryManager;
}
