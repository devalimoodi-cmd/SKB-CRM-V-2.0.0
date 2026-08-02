import { visitReportApi } from "./visit-report.api.js";
import { visitReportRenderer } from "./visit-report.renderer.js";
import { visitReportValidation } from "./visit-report.validation.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
  formatDate,
} from "../../../../core/utils/date.utils.js";

class VisitReportService {
  constructor() {
    this.customerId = null;
    this.reports = [];
    this.halls = [];
    this.periods = [];
    this.experts = [];
    this.forwardUnits = [];
    this.currentReportId = null;
    this.isEditing = false;
    this.attachments = [];
    this.keepAttachmentIds = [];
    this.initialized = false;
  }

  async init(customerId) {
    // ✅ اگر customerId ارسال نشد، از state بگیر
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    console.log("📌 VisitReportService customerId:", this.customerId);

    await this.loadData();
    this.setupDatepicker();
    this.setupEvents();
    this.initialized = true;
    console.log("✅ VisitReportService initialized");
  }

  async loadData() {
    try {
      // بارگذاری گزارش‌ها
      await this.loadReports();

      // بارگذاری سالن‌ها
      await this.loadHalls();

      // بارگذاری دوره‌ها
      await this.loadPeriods();

      // بارگذاری کارشناسان
      await this.loadExperts();

      // بارگذاری واحدهای ارجاع
      await this.loadForwardUnits();
    } catch (error) {
      console.error("❌ Error loading visit report data:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  async loadReports() {
    // ✅ اگر customerId وجود نداشت، از state یا URL بگیر
    if (!this.customerId) {
      this.customerId =
        stateService.getCustomerId() ||
        new URLSearchParams(window.location.search).get("id");
    }

    // ✅ اگر باز هم وجود نداشت، برمی‌گردیم
    if (!this.customerId) {
      console.warn("⚠️ No customerId, skipping loadReports");
      this.reports = [];
      visitReportRenderer.renderReportsTable([]);
      return;
    }

    try {
      const response = await visitReportApi.getReports(this.customerId);
      if (response.success) {
        this.reports = response.data || [];
        visitReportRenderer.renderReportsTable(this.reports);
      }
    } catch (error) {
      console.error("❌ Error loading reports:", error);
      this.reports = [];
      visitReportRenderer.renderReportsTable([]);
    }
  }
  async loadHalls() {
    try {
      const response = await visitReportApi.getHalls(this.customerId);
      if (response.success) {
        this.halls = response.data || [];
        visitReportRenderer.renderHallsSelect(this.halls);
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  }

  async loadPeriods() {
    try {
      const response = await visitReportApi.getPeriods(this.customerId);
      if (response.success) {
        const allPeriods = response.data.periods || [];

        // ✅ فقط دوره‌های فعال نمایش داده شوند
        // فیلد status می‌تواند مقادیر مختلفی داشته باشد:
        // active | در حال انجام | pending | در انتظار جوجه | شروع نشده
        const activeStatuses = [
          "active",
          "در حال انجام",
          "pending",
          "در انتظار جوجه",
          "شروع نشده",
        ];

        const isActive = (period) => {
          const status = period.status || "";
          const statusText = period.statusText || period.status_text || "";
          return (
            activeStatuses.includes(status) ||
            activeStatuses.includes(statusText) ||
            period.is_active === true ||
            period.isActive === true
          );
        };

        // فیلتر: اگر داده status دارد فقط فعال‌ها را بیاور، وگرنه همه را
        const hasStatusField = allPeriods.some(
          (p) =>
            p.status !== undefined ||
            p.statusText !== undefined ||
            p.status_text !== undefined ||
            p.is_active !== undefined ||
            p.isActive !== undefined,
        );

        this.periods = hasStatusField
          ? allPeriods.filter(isActive)
          : allPeriods;

        visitReportRenderer.renderPeriodsSelect(this.periods);
      }
    } catch (error) {
      console.error("❌ Error loading periods:", error);
    }
  }

  async loadExperts() {
    try {
      const response = await visitReportApi.getExperts();
      if (response.success) {
        this.experts = response.data || [];
        visitReportRenderer.renderExpertsSelect(this.experts);
      }
    } catch (error) {
      console.error("❌ Error loading experts:", error);
    }
  }

  async loadForwardUnits() {
    try {
      this.forwardUnits = await visitReportApi.getForwardUnits();
      visitReportRenderer.renderForwardUnitsSelect(this.forwardUnits);
    } catch (error) {
      console.error("❌ Error loading forward units:", error);
    }
  }

  // ===== Datepicker =====

  setupDatepicker() {
    const dateInput = document.getElementById("visit-date");
    if (!dateInput) return;

    if (dateInput.hasAttribute("data-datepicker-initialized")) return;

    try {
      if (typeof $.fn.persianDatepicker !== "undefined") {
        $(dateInput).persianDatepicker({
          format: "YYYY/MM/DD",
          autoClose: true,
          initialValue: false,
          observer: true,
          calendar: {
            persian: {
              locale: "fa",
            },
          },
          onSelect: function () {
            const selected = $(this).val();
            dateInput.setAttribute("data-selected-date", selected);
          },
        });
        dateInput.setAttribute("data-datepicker-initialized", "true");
        console.log("✅ Datepicker for visit date initialized");
      } else {
        dateInput.placeholder = "۱۴۰۴/۰۱/۰۱";
        dateInput.setAttribute("data-datepicker-initialized", "true");
      }
    } catch (error) {
      console.warn("⚠️ Error initializing datepicker:", error);
      dateInput.placeholder = "۱۴۰۴/۰۱/۰۱";
      dateInput.setAttribute("data-datepicker-initialized", "true");
    }
  }

  // ===== رویدادها =====

  setupEvents() {
    // ذخیره گزارش
    const saveBtn = document.querySelector(".skb-visit-save");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => this.saveReport());
    }

    // ریست فرم
    const resetBtn = document.querySelector(".skb-visit-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.resetForm());
    }

    // بستن مودال با کلیک روی backdrop
    const viewVisitModal = document.getElementById("viewVisitModal");
    if (viewVisitModal) {
      viewVisitModal.addEventListener("click", (e) => {
        if (e.target === viewVisitModal) {
          this.closeViewVisitModal();
        }
      });
    }

    // بستن مودال با کلید Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const modal = document.getElementById("viewVisitModal");
        if (modal && modal.classList.contains("active")) {
          this.closeViewVisitModal();
        }
      }
    });

    // به‌روزرسانی تگ‌های انتخاب شده
    const hallSelect = document.getElementById("visit-halls");
    if (hallSelect) {
      hallSelect.addEventListener("change", () => this.updateSelectedHalls());
    }

    const expertSelect = document.getElementById("visit-experts");
    if (expertSelect) {
      expertSelect.addEventListener("change", () =>
        this.updateSelectedExperts(),
      );
    }

    // جستجو در جدول
    const searchInput = document.getElementById("visit-search");
    if (searchInput) {
      searchInput.addEventListener("input", () => this.filterReports());
    }
  }

  // ===== مدیریت انتخاب‌ها =====

  updateSelectedHalls() {
    const select = document.getElementById("visit-halls");
    const selected = Array.from(select.selectedOptions).map((opt) => opt.text);
    const container = document.getElementById("selectedVisitHalls");

    container.innerHTML = selected
      .map(
        (hall) => `
            <span class="skb-hall-tag">
                ${hall}
                <i class="fas fa-times" onclick="window.removeSelectedHall('${hall.replace(/'/g, "\\'")}')"></i>
            </span>
        `,
      )
      .join("");
  }

  updateSelectedExperts() {
    const select = document.getElementById("visit-experts");
    const selected = Array.from(select.selectedOptions).map((opt) => opt.text);
    const container = document.getElementById("selectedExperts");

    container.innerHTML = selected
      .map(
        (expert) => `
            <span class="skb-hall-tag">
                ${expert}
                <i class="fas fa-times" onclick="window.removeSelectedExpert('${expert.replace(/'/g, "\\'")}')"></i>
            </span>
        `,
      )
      .join("");
  }

  removeSelectedHall(hallName) {
    const select = document.getElementById("visit-halls");
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].text === hallName) {
        select.options[i].selected = false;
        break;
      }
    }
    this.updateSelectedHalls();
  }

  removeSelectedExpert(expertName) {
    const select = document.getElementById("visit-experts");
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].text === expertName) {
        select.options[i].selected = false;
        break;
      }
    }
    this.updateSelectedExperts();
  }

  // ===== مدیریت فایل‌ها =====

  // محدودیت‌های حجم و تعداد فایل (مطابق بک‌اند)
  MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 مگابایت برای ویدیو
  MAX_OTHER_SIZE = 15 * 1024 * 1024; // 15 مگابایت برای سایر فایل‌ها
  MAX_TOTAL_FILES = 20; // حداکثر تعداد کل فایل‌ها

  handleFiles(files) {
    const filesList = Array.from(files);

    // بررسی تعداد کل فایل‌ها
    const totalCount =
      this.attachments.filter((a) => a.isNew).length + filesList.length;
    if (totalCount > this.MAX_TOTAL_FILES) {
      const remaining =
        this.MAX_TOTAL_FILES - this.attachments.filter((a) => a.isNew).length;
      this.showAlert(
        "warning",
        "تعداد فایل‌ها بیش از حد مجاز است",
        `حداکثر می‌توانید ${this.MAX_TOTAL_FILES} فایل اضافه کنید. ${remaining > 0 ? `شما ${remaining} ظرفیت باقی دارید.` : "ظرفیت شما تکمیل شده است."}`,
      );
      return;
    }

    for (let file of filesList) {
      // تعیین محدودیت بر اساس نوع فایل
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? this.MAX_VIDEO_SIZE : this.MAX_OTHER_SIZE;
      const maxSizeMB = isVideo ? 500 : 15;

      // بررسی حجم فایل قبل از اضافه کردن
      if (file.size > maxSize) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        this.showAlert(
          "error",
          "حجم فایل بیش از حد مجاز است",
          `فایل «${file.name}» با حجم ${sizeMB} مگابایت نمی‌تواند آپلود شود. ${
            isVideo
              ? "حداکثر حجم مجاز برای ویدیو ۵۰۰ مگابایت است."
              : "حداکثر حجم مجاز برای سایر فایل‌ها ۱۵ مگابایت است."
          }`,
        );
        continue;
      }

      const fileData = {
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        data: URL.createObjectURL(file),
        file: file,
        isNew: true,
        isExisting: false,
      };
      this.attachments.push(fileData);
      this.addAttachmentToUI(fileData);
    }
  }

  // ===== نمایش پیام با SweetAlert =====

  showAlert(icon, title, message) {
    const text = message || "";
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: icon || "info",
        title: title || "",
        text: text,
        confirmButtonText: "باشه",
        confirmButtonColor: "#2c7a6e",
        timer: icon === "success" ? 2500 : undefined,
        timerProgressBar: true,
      });
    } else {
      if (icon === "error") {
        notificationService.error(text);
      } else if (icon === "warning") {
        notificationService.warning(text);
      } else {
        notificationService.success(text);
      }
    }
  }

  // ===== بارگذاری فایل با فیلتر نوع =====

  addFileWithFilter(accept, callback) {
    // ساخت input موقت
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = true;
    input.style.display = "none";

    input.addEventListener(
      "change",
      (e) => {
        if (e.target.files && e.target.files.length > 0) {
          // اگر callback داده شده بود اعمال کن، وگرنه همه فایلها را اضافه کن
          if (callback) {
            const filtered = Array.from(e.target.files).filter(callback);
            if (filtered.length > 0) {
              this.handleFiles(filtered);
            } else if (e.target.files.length > 0) {
              this.showAlert(
                "warning",
                "فرمت نامعتبر",
                "فرمت فایل انتخابی مجاز نیست. لطفاً فایل با فرمت مجاز انتخاب کنید.",
              );
            }
          } else {
            this.handleFiles(e.target.files);
          }
        }
        // پاکسازی
        input.remove();
      },
      { once: true },
    );

    document.body.appendChild(input);
    input.click();
  }

  addImageAttachment() {
    this.addFileWithFilter("image/*", (file) => file.type.startsWith("image/"));
  }

  addVideoAttachment() {
    this.addFileWithFilter("video/*", (file) => file.type.startsWith("video/"));
  }

  addExcelAttachment() {
    this.addFileWithFilter(
      ".xlsx,.xls,.csv",
      (file) =>
        file.name.match(/\.(xlsx|xls|csv)$/i) ||
        file.type.includes("spreadsheet") ||
        file.type.includes("excel") ||
        file.type.includes("csv"),
    );
  }

  addAttachmentToUI(attachment) {
    const container = document.getElementById("attachments-list");
    const fileIcon = attachment.type?.startsWith("image/")
      ? "fa-image"
      : attachment.type?.startsWith("video/")
        ? "fa-video"
        : attachment.name?.match(/\.(xlsx|xls|csv)$/i)
          ? "fa-file-excel"
          : "fa-file";

    const div = document.createElement("div");
    div.className = "skb-attachment-item";
    div.id = `attach-${attachment.id}`;

    if (attachment.isExisting) {
      div.innerHTML = `
                <i class="fas ${fileIcon}"></i>
                <span style="flex:1; margin-right: 10px;">${attachment.name}</span>
                <a href="${attachment.data}" target="_blank" style="color: #2c7a6e; margin:0 5px;" title="مشاهده">
                    <i class="fas fa-eye"></i>
                </a>
                <button onclick="window.downloadAttachment(${attachment.id}, '${attachment.name}')" 
                        style="background: none; border: none; color: #3b82f6; cursor: pointer; margin:0 5px;" 
                        title="دانلود">
                    <i class="fas fa-download"></i>
                </button>
                <i class="fas fa-times remove-attach" onclick="window.removeAttachment(${attachment.id})" 
                   style="cursor:pointer; color:#ef4444;" title="حذف"></i>
            `;
    } else {
      div.innerHTML = `
                <i class="fas ${fileIcon}"></i>
                <span style="flex:1; margin-right: 10px;">${attachment.name}</span>
                <i class="fas fa-times remove-attach" onclick="window.removeAttachment(${attachment.id})" 
                   style="cursor:pointer; color:#ef4444;" title="حذف"></i>
            `;
    }
    container.appendChild(div);
  }

  removeAttachment(id) {
    const attachment = this.attachments.find((a) => a.id === id);
    if (!attachment) return;

    if (attachment.isExisting && this.keepAttachmentIds) {
      this.keepAttachmentIds = this.keepAttachmentIds.filter(
        (aid) => aid !== id,
      );
    }

    this.attachments = this.attachments.filter((a) => a.id !== id);
    const element = document.getElementById(`attach-${id}`);
    if (element) element.remove();
  }

  // ===== ذخیره گزارش =====

  async saveReport() {
    // جلوگیری از ارسال همزمان
    if (this.isSaving) {
      this.showAlert(
        "warning",
        "در حال پردازش",
        "در حال ذخیره گزارش هستید، لطفاً صبر کنید...",
      );
      return;
    }

    // ✅ اطمینان از وجود customerId قبل از ذخیره
    if (!this.customerId) {
      this.customerId =
        stateService.getCustomerId() ||
        window.CURRENT_CUSTOMER_ID ||
        new URLSearchParams(window.location.search).get("id");
    }

    if (!this.customerId || isNaN(parseInt(this.customerId))) {
      notificationService.error("شناسه مشتری معتبر نیست");
      return;
    }

    // دریافت مقادیر
    const visitDate = document.getElementById("visit-date").value;
    const periodId = document.getElementById("visit-period").value;
    const forwardTo = document.getElementById("visit-forward").value;
    const reportText = document.getElementById("visit-description").value;

    // اعتبارسنجی
    const errors = visitReportValidation.validate({
      visit_date: visitDate,
      period_id: periodId,
      report_text: reportText,
    });

    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // دریافت سالن‌های انتخاب شده
    const hallSelect = document.getElementById("visit-halls");
    const selectedHalls = Array.from(hallSelect.selectedOptions).map(
      (opt) => opt.value,
    );

    if (selectedHalls.length === 0) {
      this.showAlert(
        "warning",
        "سالن انتخاب کنید",
        "لطفاً حداقل یک سالن را انتخاب کنید",
      );
      return;
    }

    // دریافت کارشناسان انتخاب شده
    const expertSelect = document.getElementById("visit-experts");
    const selectedExperts = Array.from(expertSelect.selectedOptions).map(
      (opt) => opt.value,
    );

    if (selectedExperts.length === 0) {
      this.showAlert(
        "warning",
        "کارشناس انتخاب کنید",
        "لطفاً حداقل یک کارشناس را انتخاب کنید",
      );
      return;
    }

    // تبدیل تاریخ
    const gregorianDate = convertPersianToGregorian(visitDate);
    if (!gregorianDate) {
      notificationService.error("تاریخ وارد شده معتبر نیست");
      return;
    }

    // آماده‌سازی داده‌ها
    const formData = new FormData();
    formData.append("customer_id", this.customerId);
    formData.append("period_id", periodId);
    formData.append("visit_date", gregorianDate);
    formData.append("forward_to", forwardTo || "");
    formData.append("report_text", reportText);

    // اضافه کردن سالن‌ها — هم آرایه و هم JSON برای سازگاری کامل با بک‌اند
    selectedHalls.forEach((hallId) => {
      formData.append("hall_ids[]", hallId);
    });
    formData.append("hall_ids", JSON.stringify(selectedHalls));

    // اضافه کردن کارشناسان
    selectedExperts.forEach((expertId) => {
      formData.append("expert_ids[]", expertId);
    });
    formData.append("expert_ids", JSON.stringify(selectedExperts));

    // در حالت ویرایش، keep_attachment_ids رو ارسال کن
    if (this.isEditing && this.currentReportId) {
      formData.append(
        "keep_attachment_ids",
        JSON.stringify(this.keepAttachmentIds),
      );
    }

    // اضافه کردن فایل‌های جدید
    const newFiles = this.attachments.filter((a) => a.isNew && a.file);
    newFiles.forEach((file) => {
      formData.append("files", file.file);
    });

    // علامتگذاری شروع ارسال (بعد از همه اعتبارسنجیها)
    this.isSaving = true;

    // نمایش مودال پیشرفت
    this.showUploadProgressModal();

    const saveBtn = document.querySelector(".skb-visit-save");
    const originalText = saveBtn?.innerHTML;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';
      saveBtn.style.opacity = "0.6";
      saveBtn.style.cursor = "not-allowed";
    }

    try {
      let response;
      const onProgress = (percent) => {
        this.updateUploadProgress(percent);
      };

      if (this.isEditing && this.currentReportId) {
        response = await visitReportApi.updateReport(
          this.currentReportId,
          formData,
          onProgress,
        );
      } else {
        response = await visitReportApi.createReport(formData, onProgress);
      }

      if (response.success) {
        notificationService.success(
          this.isEditing
            ? "✅ گزارش بازدید با موفقیت بروزرسانی شد"
            : "✅ گزارش بازدید با موفقیت ثبت شد",
        );

        this.resetForm();
        await this.loadReports();

        document
          .getElementById("visitsTable")
          ?.scrollIntoView({ behavior: "smooth" });
      } else {
        notificationService.error(response.message || "خطا در ذخیره گزارش");
      }
    } catch (error) {
      console.error("❌ Error saving report:", error);
      notificationService.error("خطا در ارتباط با سرور");
    } finally {
      // پاکسازی وضعیت ذخیره
      this.isSaving = false;
      this.hideUploadProgressModal();

      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
        saveBtn.style.cursor = "pointer";

        // اگر هنوز در حالت ویرایش است دکمه «بروزرسانی گزارش» بماند،
        // در غیر این صورت (بعد از ذخیره موفق/ریست) «ذخیره گزارش» برگردد
        if (this.isEditing) {
          saveBtn.innerHTML = '<i class="fas fa-edit"></i> بروزرسانی گزارش';
          saveBtn.className = "skb-visit-save btn-warning";
          saveBtn.style.background = "#f59e0b";
        } else {
          saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره گزارش';
          saveBtn.className = "skb-visit-save btn-primary";
          saveBtn.style.background = "";
        }
      }
    }
  }

  // ===== مودال پیشرفت آپلود =====

  showUploadProgressModal() {
    let modal = document.getElementById("visitUploadProgressModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "visitUploadProgressModal";
      modal.className = "skb-upload-overlay";
      modal.innerHTML = `
        <div class="skb-upload-modal">
          <div class="skb-upload-icon">
            <i class="fas fa-cloud-upload-alt"></i>
          </div>
          <div class="skb-upload-title">در حال آپلود گزارش...</div>
          <div class="skb-upload-subtitle">لطفاً صبر کنید، فایل‌ها در حال ارسال هستند</div>
          <div class="skb-upload-progress-wrapper">
            <div class="skb-upload-progress-bar" id="visitUploadProgressBar"></div>
          </div>
          <div class="skb-upload-percent" id="visitUploadPercent">۰٪</div>
          <div class="skb-upload-note">تا پایان آپلود منتظر بمانید</div>
        </div>
      `;
      document.body.appendChild(modal);
    }
    modal.classList.add("active");
    this.updateUploadProgress(0);
  }

  updateUploadProgress(percent) {
    const bar = document.getElementById("visitUploadProgressBar");
    const text = document.getElementById("visitUploadPercent");
    if (bar) {
      bar.style.width = `${percent}%`;
    }
    if (text) {
      // تبدیل عدد به فارسی
      const faNum = new Intl.NumberFormat("fa-IR").format(percent);
      text.textContent = `${faNum}٪`;
    }
  }

  hideUploadProgressModal() {
    const modal = document.getElementById("visitUploadProgressModal");
    if (modal) {
      modal.classList.remove("active");
    }
  }

  // ===== ویرایش گزارش =====

  async editReport(id) {
    try {
      const response = await visitReportApi.getReport(id);
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات گزارش");
        return;
      }

      const visit = response.data;
      this.isEditing = true;
      this.currentReportId = id;

      // پر کردن فرم
      const persianDate = convertToPersianDate(visit.visit_date);
      document.getElementById("visit-date").value =
        persianDate || visit.visit_date || "";

      const periodSelect = document.getElementById("visit-period");
      if (periodSelect && visit.period_id) {
        periodSelect.value = visit.period_id;
      }

      // انتخاب سالن‌ها
      const hallSelect = document.getElementById("visit-halls");
      const visitHallIds = visit.Halls?.map((h) => h.id) || [];
      for (let i = 0; i < hallSelect.options.length; i++) {
        hallSelect.options[i].selected = visitHallIds.includes(
          parseInt(hallSelect.options[i].value),
        );
      }
      this.updateSelectedHalls();

      // انتخاب کارشناسان
      const expertSelect = document.getElementById("visit-experts");
      const visitExpertIds = visit.experts?.map((e) => e.id) || [];
      for (let i = 0; i < expertSelect.options.length; i++) {
        expertSelect.options[i].selected = visitExpertIds.includes(
          parseInt(expertSelect.options[i].value),
        );
      }
      this.updateSelectedExperts();

      document.getElementById("visit-forward").value = visit.forward_to || "";
      document.getElementById("visit-description").value =
        visit.report_text || "";

      // نمایش فایل‌های پیوست
      this.attachments = [];
      this.keepAttachmentIds = [];
      const attachmentsContainer = document.getElementById("attachments-list");
      attachmentsContainer.innerHTML = "";

      const attachments =
        visit.attachments || visit.VisitReportAttachments || [];
      if (attachments.length > 0) {
        attachments.forEach((att) => {
          this.keepAttachmentIds.push(att.id);
          const fileData = {
            id: att.id,
            name: att.file_name,
            type: att.mime_type,
            size: att.file_size,
            data: `${window.API_URL}/visit-reports/download/${att.id}`,
            file: null,
            isExisting: true,
            isNew: false,
          };
          this.attachments.push(fileData);
          this.addAttachmentToUI(fileData);
        });
      }

      // تغییر دکمه
      const saveBtn = document.querySelector(".skb-visit-save");
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-edit"></i> بروزرسانی گزارش';
        saveBtn.className = "skb-visit-save btn-warning";
        saveBtn.style.background = "#f59e0b";
      }

      notificationService.info(
        "برای ویرایش، اطلاعات را تغییر داده و ذخیره کنید",
      );
      document
        .querySelector(".skb-visit-form")
        .scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.error("❌ Error editing report:", error);
      notificationService.error("خطا در دریافت اطلاعات گزارش");
    }
  }

  // ===== حذف گزارش =====

  async deleteReport(id) {
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف گزارش",
      text: "آیا از حذف این گزارش اطمینان دارید؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await visitReportApi.deleteReport(id);
      if (response.success) {
        notificationService.success("✅ گزارش با موفقیت حذف شد");
        await this.loadReports();
      } else {
        notificationService.error(response.message || "خطا در حذف گزارش");
      }
    } catch (error) {
      console.error("❌ Error deleting report:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== مشاهده گزارش =====

  async viewReport(id) {
    const visit = this.reports.find((r) => r.id === id);
    if (!visit) {
      notificationService.error("گزارش یافت نشد");
      return;
    }

    // تغییر وضعیت به خوانده شده
    if (visit.status === "unread") {
      await visitReportApi.updateReportStatus(id, "read");
      visit.status = "read";
      this.loadReports();
    }

    // ذخیره id برای پرینت از مودال
    this.currentReportId = id;
    visitReportRenderer.renderReportModal(visit);
  }

  // ===== بستن مودال =====

  closeViewVisitModal() {
    const modal = document.getElementById("viewVisitModal");
    if (!modal) return;
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  // ===== دانلود پیوست =====

  async downloadAttachment(attachmentId, filename) {
    try {
      const response = await visitReportApi.downloadAttachment(attachmentId);
      if (!response.ok) {
        if (response.status === 401) {
          notificationService.error("دسترسی غیرمجاز، لطفاً مجدداً وارد شوید");
          return;
        }
        throw new Error("خطا در دانلود");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("❌ Error downloading attachment:", error);
      notificationService.error("خطا در دانلود فایل");
    }
  }

  // ===== فیلتر گزارش‌ها =====

  filterReports() {
    const searchTerm =
      document.getElementById("visit-search")?.value?.toLowerCase() || "";
    const filtered = this.reports.filter((visit) => {
      const date = convertToPersianDate(visit.visit_date) || "";
      const halls = visit.Halls?.map((h) => h.hall_name).join(" ") || "";
      const experts =
        visit.experts?.map((e) => `${e.first_name} ${e.last_name}`).join(" ") ||
        "";
      const period = visit.Period?.period_name || "";

      return (
        date.includes(searchTerm) ||
        halls.includes(searchTerm) ||
        experts.includes(searchTerm) ||
        period.includes(searchTerm)
      );
    });

    visitReportRenderer.renderReportsTable(filtered);
  }

  // ===== ریست فرم =====

  resetForm() {
    document.getElementById("visit-date").value = "";
    document.getElementById("visit-period").value = "";
    document.getElementById("visit-forward").value = "";

    const hallSelect = document.getElementById("visit-halls");
    for (let i = 0; i < hallSelect.options.length; i++) {
      hallSelect.options[i].selected = false;
    }
    this.updateSelectedHalls();

    const expertSelect = document.getElementById("visit-experts");
    for (let i = 0; i < expertSelect.options.length; i++) {
      expertSelect.options[i].selected = false;
    }
    this.updateSelectedExperts();

    document.getElementById("visit-description").value = "";
    this.attachments = [];
    this.keepAttachmentIds = [];
    document.getElementById("attachments-list").innerHTML = "";

    this.isEditing = false;
    this.currentReportId = null;

    const saveBtn = document.querySelector(".skb-visit-save");
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره گزارش';
      saveBtn.className = "skb-visit-save btn-primary";
      saveBtn.style.background = "";
      saveBtn.disabled = false;
      saveBtn.style.opacity = "1";
      saveBtn.style.cursor = "pointer";
    }
  }

  // ===== دانلود همه پیوستها =====

  async downloadAllAttachments(id) {
    const visit = this.reports.find((r) => r.id === id);
    if (!visit) return;

    const attachments = visit.attachments || visit.VisitReportAttachments || [];
    if (attachments.length === 0) {
      notificationService.info("هیچ پیوستی برای دانلود وجود ندارد");
      return;
    }

    notificationService.showLoading(
      `در حال دانلود ${attachments.length} فایل...`,
    );

    try {
      for (const att of attachments) {
        await this.downloadAttachment(att.id, att.file_name);
      }
      notificationService.success("✅ همه پیوستها دانلود شدند");
    } catch (error) {
      console.error("❌ Error downloading all attachments:", error);
      notificationService.error("خطا در دانلود فایلها");
    } finally {
      notificationService.hideLoading();
    }
  }

  // ===== پرینت گزارش =====

  printReport(id = null) {
    // اگر id ارسال نشد از currentReportId استفاده کن (پرینت از داخل مودال)
    const reportId = id || this.currentReportId;
    const visit = this.reports.find((r) => r.id === reportId);
    if (!visit) {
      notificationService.error("گزارش یافت نشد");
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=1100,height=800,scrollbars=yes",
    );
    if (!printWindow) {
      notificationService.error("لطفاً باز شدن پنجره popup را مجاز کنید");
      return;
    }

    const html = visitReportRenderer.renderPrintReport(visit);
    printWindow.document.write(html);
    printWindow.document.close();

    printWindow.onload = function () {
      setTimeout(() => {
        printWindow.print();
      }, 500);
    };
  }

  // ===== رفرش =====

  refresh() {
    this.loadData();
  }
}

export const visitReportService = new VisitReportService();

if (typeof window !== "undefined") {
  window.visitReportService = visitReportService;
  window.VisitReportService = VisitReportService;
  window.loadVisitReports = () => visitReportService.loadReports();
  window.loadHallsForVisit = () => visitReportService.loadHalls();
  window.loadExpertsForVisit = () => visitReportService.loadExperts();
  window.loadPeriodsForVisit = () => visitReportService.loadPeriods();
  window.saveVisitReport = () => visitReportService.saveReport();
  window.resetVisitForm = () => visitReportService.resetForm();
  window.viewVisitReport = (id) => visitReportService.viewReport(id);
  window.editVisitReport = (id) => visitReportService.editReport(id);
  window.deleteVisitReport = (id) => visitReportService.deleteReport(id);
  window.printVisitReport = (id) => visitReportService.printReport(id);
  window.downloadAttachment = (id, name) =>
    visitReportService.downloadAttachment(id, name);
  window.downloadAllAttachments = (id) =>
    visitReportService.downloadAllAttachments?.(id);
  window.filterVisits = () => visitReportService.filterReports();
  window.removeSelectedHall = (name) =>
    visitReportService.removeSelectedHall(name);
  window.removeSelectedExpert = (name) =>
    visitReportService.removeSelectedExpert(name);
  window.handleFiles = (files) => visitReportService.handleFiles(files);
  window.removeAttachment = (id) => visitReportService.removeAttachment(id);
  window.addImageAttachment = () => visitReportService.addImageAttachment();
  window.addVideoAttachment = () => visitReportService.addVideoAttachment();
  window.addExcelAttachment = () => visitReportService.addExcelAttachment();
  window.closeViewVisitModal = () => visitReportService.closeViewVisitModal();
}
