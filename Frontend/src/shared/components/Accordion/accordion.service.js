class AccordionService {
  constructor() {
    this.items = [];
    this.initialized = false;
    this.storageKey = "accordion_state";
  }

  init(containerSelector = ".accordion-container") {
    if (this.initialized) return;

    const containers = document.querySelectorAll(containerSelector);
    containers.forEach((container) => {
      this.setupContainer(container);
    });

    this.initialized = true;
    console.log("✅ AccordionService initialized");
  }

  setupContainer(container) {
    const items = container.querySelectorAll(".accordion-item");
    const headers = container.querySelectorAll(".accordion-header");
    const controls = container.querySelectorAll(".accordion-control-btn");

    // تنظیم هر آیتم
    items.forEach((item, index) => {
      // ذخیره در لیست
      this.items.push({
        element: item,
        index: index,
        container: container,
      });

      // تنظیم داده‌ها
      if (!item.dataset.index) {
        item.dataset.index = index;
      }
    });

    // رویداد کلیک روی هدرها
    headers.forEach((header) => {
      const item = header.closest(".accordion-item");
      if (item) {
        header.addEventListener("click", (e) => {
          e.preventDefault();
          this.toggleItem(item);
        });
      }
    });

    // دکمه‌های کنترل
    controls.forEach((btn) => {
      if (btn.dataset.action === "expand-all") {
        btn.addEventListener("click", () => {
          this.expandAll(container);
        });
      } else if (btn.dataset.action === "collapse-all") {
        btn.addEventListener("click", () => {
          this.collapseAll(container);
        });
      }
    });

    // بارگذاری وضعیت ذخیره شده
    this.loadState(container);
  }

  toggleItem(item) {
    const isOpen = item.classList.contains("open");

    if (isOpen) {
      this.closeItem(item);
    } else {
      this.openItem(item);
    }

    this.saveState(item.closest(".accordion-container"));
  }

  openItem(item) {
    item.classList.add("open");
    const body = item.querySelector(".accordion-body");
    if (body) {
      body.style.display = "block";
    }
    this.triggerEvent(item, "open");
  }

  closeItem(item) {
    item.classList.remove("open");
    const body = item.querySelector(".accordion-body");
    if (body) {
      body.style.display = "none";
    }
    this.triggerEvent(item, "close");
  }

  expandAll(container) {
    const items = container.querySelectorAll(".accordion-item");
    items.forEach((item) => {
      if (!item.classList.contains("open")) {
        this.openItem(item);
      }
    });
    this.saveState(container);
  }

  collapseAll(container) {
    const items = container.querySelectorAll(".accordion-item");
    items.forEach((item) => {
      if (item.classList.contains("open")) {
        this.closeItem(item);
      }
    });
    this.saveState(container);
  }

  // ===== ذخیره و بازیابی وضعیت =====

  saveState(container) {
    const items = container.querySelectorAll(".accordion-item");
    const state = Array.from(items).map((item) =>
      item.classList.contains("open"),
    );
    const containerId = container.id || "default";

    try {
      const allStates = JSON.parse(
        localStorage.getItem(this.storageKey) || "{}",
      );
      allStates[containerId] = state;
      localStorage.setItem(this.storageKey, JSON.stringify(allStates));
    } catch (error) {
      console.warn("⚠️ Error saving accordion state:", error);
    }
  }

  loadState(container) {
    const containerId = container.id || "default";

    try {
      const allStates = JSON.parse(
        localStorage.getItem(this.storageKey) || "{}",
      );
      const state = allStates[containerId];

      if (state && Array.isArray(state)) {
        const items = container.querySelectorAll(".accordion-item");
        items.forEach((item, index) => {
          if (state[index]) {
            this.openItem(item);
          } else {
            this.closeItem(item);
          }
        });
      }
    } catch (error) {
      console.warn("⚠️ Error loading accordion state:", error);
    }
  }

  // ===== رویدادها =====

  triggerEvent(item, type) {
    const event = new CustomEvent(`accordion:${type}`, {
      detail: {
        item: item,
        index: parseInt(item.dataset.index),
      },
    });
    item.dispatchEvent(event);
  }

  // ===== متدهای کمکی =====

  getItems(container) {
    return container.querySelectorAll(".accordion-item");
  }

  getOpenItems(container) {
    return container.querySelectorAll(".accordion-item.open");
  }

  getClosedItems(container) {
    return container.querySelectorAll(".accordion-item:not(.open)");
  }

  isOpen(item) {
    return item.classList.contains("open");
  }

  // ===== دیستروی =====

  destroy() {
    this.items = [];
    this.initialized = false;
  }
}

// ===== Export =====
export const accordionService = new AccordionService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.AccordionService = accordionService;
  window.accordionService = accordionService;

  // تابع سراسری toggleAccordion برای استفاده در onclick در HTML
  window.toggleAccordion = function (sectionId) {
    // تشخیص عنصر body
    const findBody = () => {
      const section = document.getElementById(sectionId);
      if (section) return section;
      const header = document.querySelector(`[data-section="${sectionId}"]`);
      if (header) {
        const accordionSection = header.closest(
          ".accordion-section, .accordion-item",
        );
        return accordionSection?.querySelector(".accordion-body");
      }
      return null;
    };

    const body = findBody();
    if (!body) return;

    // بررسی وضعیت فعلی با computed style
    const computed = window.getComputedStyle(body);
    const isOpen = computed.display !== "none";

    // پیدا کردن آیکون
    const sectionEl = body.closest(".accordion-section, .accordion-item");
    const icon = sectionEl?.querySelector(".accordion-icon");

    if (isOpen) {
      body.style.display = "none";
      if (icon) icon.style.transform = "rotate(0deg)";
    } else {
      body.style.display = "block";
      if (icon) icon.style.transform = "rotate(180deg)";
    }
  };
}
