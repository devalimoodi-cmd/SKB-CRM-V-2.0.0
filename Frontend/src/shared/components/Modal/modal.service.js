class ModalService {
  constructor() {
    this.modals = [];
    this.activeModal = null;
    this.initialized = false;
    this.zIndex = 99999;
  }

  init() {
    if (this.initialized) return;

    // بستن با کلیک روی backdrop
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal-overlay")) {
        const modal = this.getModalByOverlay(e.target);
        if (modal) {
          this.close(modal.id);
        }
      }
    });

    // بستن با کلید Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.activeModal) {
        this.close(this.activeModal);
      }
    });

    this.initialized = true;
    console.log("✅ ModalService initialized");
  }

  // ===== ایجاد مودال =====

  create(options = {}) {
    const {
      id = "modal-" + Date.now(),
      title = "مودال",
      content = "",
      footer = "",
      size = "md",
      className = "",
      closeOnBackdrop = true,
      closeOnEscape = true,
    } = options;

    // ایجاد overlay
    const overlay = document.createElement("div");
    overlay.className = `modal-overlay ${className}`;
    overlay.dataset.modalId = id;

    // ایجاد مودال
    const modal = document.createElement("div");
    modal.className = `modal modal-${size}`;

    // هدر
    const headerHTML = title
      ? `
            <div class="modal-header">
                <div class="modal-title">
                    <i class="fas fa-${options.icon || "info-circle"}"></i>
                    ${title}
                </div>
                <button class="modal-close" data-close-modal>
                    &times;
                </button>
            </div>
        `
      : "";

    // بدنه
    const bodyHTML = `
            <div class="modal-body">
                ${content}
            </div>
        `;

    // فوتر
    const footerHTML = footer
      ? `
            <div class="modal-footer">
                ${footer}
            </div>
        `
      : "";

    modal.innerHTML = headerHTML + bodyHTML + footerHTML;
    overlay.appendChild(modal);

    // رویداد بستن
    const closeBtn = modal.querySelector("[data-close-modal]");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.close(id);
      });
    }

    // رویدادهای close
    if (closeOnBackdrop) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          this.close(id);
        }
      });
    }

    if (!closeOnEscape) {
      // اگر نمی‌خواهیم با Escape بسته شود، listener را غیرفعال می‌کنیم
      overlay.dataset.noEscape = "true";
    }

    document.body.appendChild(overlay);

    // ذخیره در لیست
    const modalData = {
      id: id,
      element: overlay,
      options: options,
      isOpen: false,
    };
    this.modals.push(modalData);

    return modalData;
  }

  // ===== باز کردن =====

  open(id) {
    const modal = this.getModal(id);
    if (!modal) return;

    // بستن مودال قبلی
    if (this.activeModal && this.activeModal !== id) {
      this.close(this.activeModal);
    }

    modal.element.classList.add("active");
    modal.isOpen = true;
    this.activeModal = id;
    document.body.style.overflow = "hidden";

    // رویداد
    const event = new CustomEvent("modal:open", {
      detail: { modalId: id },
    });
    document.dispatchEvent(event);
  }

  // ===== بستن =====

  close(id) {
    const modal = this.getModal(id);
    if (!modal || !modal.isOpen) return;

    modal.element.classList.remove("active");
    modal.isOpen = false;

    if (this.activeModal === id) {
      this.activeModal = null;
    }

    // اگر هیچ مودال دیگری باز نیست، اسکرول را فعال کن
    const anyOpen = this.modals.some((m) => m.isOpen);
    if (!anyOpen) {
      document.body.style.overflow = "";
    }

    // رویداد
    const event = new CustomEvent("modal:close", {
      detail: { modalId: id },
    });
    document.dispatchEvent(event);
  }

  // ===== حذف =====

  destroy(id) {
    const modal = this.getModal(id);
    if (!modal) return;

    if (modal.isOpen) {
      this.close(id);
    }

    modal.element.remove();
    this.modals = this.modals.filter((m) => m.id !== id);
  }

  // ===== آپدیت محتوا =====

  updateContent(id, content) {
    const modal = this.getModal(id);
    if (!modal) return;

    const body = modal.element.querySelector(".modal-body");
    if (body) {
      body.innerHTML = content;
    }
  }

  updateFooter(id, footer) {
    const modal = this.getModal(id);
    if (!modal) return;

    let footerEl = modal.element.querySelector(".modal-footer");
    if (!footerEl) {
      // اگر فوتر وجود ندارد، ایجاد کن
      const modalEl = modal.element.querySelector(".modal");
      footerEl = document.createElement("div");
      footerEl.className = "modal-footer";
      modalEl.appendChild(footerEl);
    }
    footerEl.innerHTML = footer;
  }

  // ===== متدهای کمکی =====

  getModal(id) {
    return this.modals.find((m) => m.id === id);
  }

  getModalByOverlay(element) {
    const id = element.dataset.modalId;
    return this.getModal(id);
  }

  isOpen(id) {
    const modal = this.getModal(id);
    return modal ? modal.isOpen : false;
  }

  // ===== دیستروی =====

  destroyAll() {
    this.modals.forEach((m) => {
      m.element.remove();
    });
    this.modals = [];
    this.activeModal = null;
    document.body.style.overflow = "";
  }
}

// ===== Export =====
export const modalService = new ModalService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.ModalService = modalService;
  window.modalService = modalService;
}
