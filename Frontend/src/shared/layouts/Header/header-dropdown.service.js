import { dropdownService } from "../../components/Dropdown/dropdown.service.js";

class HeaderDropdownService {
  constructor() {
    this.initialized = false;
    this.dropdowns = [];
  }

  init() {
    if (this.initialized) return;

    // مقداردهی دراپ‌داون‌های هدر
    const dropdowns = document.querySelectorAll(".header .dropdown");
    dropdowns.forEach((dropdown) => {
      const toggle = dropdown.querySelector(".dropdown-toggle");
      const menu = dropdown.querySelector(".dropdown-menu");

      if (toggle && menu) {
        // رویداد کلیک
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();

          // بستن بقیه
          this.closeAll();

          dropdown.classList.toggle("open");
          toggle.classList.toggle("active");
        });

        // ذخیره
        this.dropdowns.push({
          element: dropdown,
          toggle: toggle,
          menu: menu,
          isOpen: false,
        });
      }
    });

    // بستن با کلیک بیرون
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".header .dropdown")) {
        this.closeAll();
      }
    });

    this.initialized = true;
    console.log("✅ HeaderDropdownService initialized");
  }

  open(dropdown) {
    dropdown.element.classList.add("open");
    dropdown.toggle.classList.add("active");
    dropdown.isOpen = true;
  }

  close(dropdown) {
    dropdown.element.classList.remove("open");
    dropdown.toggle.classList.remove("active");
    dropdown.isOpen = false;
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

  getDropdown(element) {
    return this.dropdowns.find((d) => d.element === element);
  }

  isOpen(element) {
    const dropdown = this.getDropdown(element);
    return dropdown ? dropdown.isOpen : false;
  }
}

// ===== Export =====
export const headerDropdownService = new HeaderDropdownService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.HeaderDropdownService = headerDropdownService;
  window.headerDropdownService = headerDropdownService;
}
