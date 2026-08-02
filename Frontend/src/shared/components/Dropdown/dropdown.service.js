class DropdownService {
  constructor() {
    this.dropdowns = [];
    this.initialized = false;
  }

  init(containerSelector = ".dropdown") {
    if (this.initialized) return;

    const containers = document.querySelectorAll(containerSelector);
    containers.forEach((container) => {
      this.setupDropdown(container);
    });

    // بستن با کلیک بیرون
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown")) {
        this.closeAll();
      }
    });

    // بستن با کلید Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeAll();
      }
    });

    this.initialized = true;
    console.log("✅ DropdownService initialized");
  }

  setupDropdown(container) {
    const toggle = container.querySelector(".dropdown-toggle");
    const menu = container.querySelector(".dropdown-menu");

    if (!toggle || !menu) return;

    // ذخیره در لیست
    const dropdown = {
      container: container,
      toggle: toggle,
      menu: menu,
      isOpen: false,
    };
    this.dropdowns.push(dropdown);

    // رویداد کلیک
    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();

      if (dropdown.isOpen) {
        this.close(dropdown);
      } else {
        this.open(dropdown);
      }
    });

    // رویدادهای آیتم‌ها
    const items = menu.querySelectorAll(".dropdown-item");
    items.forEach((item) => {
      item.addEventListener("click", (e) => {
        const event = new CustomEvent("dropdown:select", {
          detail: {
            dropdown: dropdown,
            item: item,
            value: item.dataset.value || item.textContent.trim(),
          },
        });
        container.dispatchEvent(event);
        this.close(dropdown);
      });
    });
  }

  open(dropdown) {
    // بستن بقیه
    this.closeAll();

    dropdown.isOpen = true;
    dropdown.menu.classList.add("open");
    dropdown.toggle.classList.add("active");

    // رویداد
    const event = new CustomEvent("dropdown:open", {
      detail: { dropdown: dropdown },
    });
    dropdown.container.dispatchEvent(event);
  }

  close(dropdown) {
    if (!dropdown.isOpen) return;

    dropdown.isOpen = false;
    dropdown.menu.classList.remove("open");
    dropdown.toggle.classList.remove("active");

    // رویداد
    const event = new CustomEvent("dropdown:close", {
      detail: { dropdown: dropdown },
    });
    dropdown.container.dispatchEvent(event);
  }

  closeAll() {
    this.dropdowns.forEach((d) => {
      if (d.isOpen) {
        this.close(d);
      }
    });
  }

  toggle(dropdown) {
    if (dropdown.isOpen) {
      this.close(dropdown);
    } else {
      this.open(dropdown);
    }
  }

  // ===== متدهای کمکی =====

  getDropdown(container) {
    return this.dropdowns.find((d) => d.container === container);
  }

  isOpen(container) {
    const dropdown = this.getDropdown(container);
    return dropdown ? dropdown.isOpen : false;
  }

  // ===== دیستروی =====

  destroy() {
    this.dropdowns = [];
    this.initialized = false;
  }
}

// ===== Export =====
export const dropdownService = new DropdownService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.DropdownService = dropdownService;
  window.dropdownService = dropdownService;
}
