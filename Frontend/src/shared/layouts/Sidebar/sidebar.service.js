class SidebarService {
  constructor() {
    this.initialized = false;
    this.elements = {};
    this.items = [];
    this.activeItem = null;
    this.menuMap = {};
  }

  init(containerSelector = ".sidebar") {
    if (this.initialized) return;

    this.elements.container = document.querySelector(containerSelector);
    if (!this.elements.container) {
      console.warn("⚠️ Sidebar container not found");
      return;
    }

    this.items = this.elements.container.querySelectorAll(".sidebar-item");
    this.setupItems();
    this.activateDefault();

    this.initialized = true;
    console.log("✅ SidebarService initialized");
  }

  setupItems() {
    this.items.forEach((item) => {
      const title =
        item.querySelector(".sidebar-title")?.textContent?.trim() || "";
      const id = item.dataset.menu || title;

      this.menuMap[id] = item;

      item.addEventListener("click", () => {
        this.activate(id);
      });

      item.addEventListener("mouseenter", () => {
        if (!item.classList.contains("active")) {
          item.style.transform = "translateX(-4px)";
        }
      });
      item.addEventListener("mouseleave", () => {
        item.style.transform = "translateX(0)";
      });
    });
  }

  activate(id) {
    this.items.forEach((item) => {
      item.classList.remove("active");
      item.style.transform = "translateX(0)";
    });

    const item = this.menuMap[id];
    if (item) {
      item.classList.add("active");
      item.style.transform = "translateX(-4px)";
      this.activeItem = id;

      const event = new CustomEvent("sidebar:activate", {
        detail: {
          id: id,
          item: item,
          title:
            item.querySelector(".sidebar-title")?.textContent?.trim() || "",
        },
      });
      this.elements.container.dispatchEvent(event);
    }
  }

  activateDefault() {
    const hasActive = this.items.some((item) =>
      item.classList.contains("active"),
    );
    if (!hasActive && this.items.length > 0) {
      const firstItem = this.items[0];
      const id =
        firstItem.dataset.menu ||
        firstItem.querySelector(".sidebar-title")?.textContent?.trim() ||
        "default";
      this.activate(id);
    }
  }

  getActiveItem() {
    return this.activeItem ? this.menuMap[this.activeItem] : null;
  }

  getActiveId() {
    return this.activeItem;
  }

  getItem(id) {
    return this.menuMap[id] || null;
  }

  getAllItems() {
    return this.items;
  }

  destroy() {
    this.items = [];
    this.menuMap = {};
    this.activeItem = null;
    this.initialized = false;
  }
}

// ✅ Export instance
export const sidebarService = new SidebarService();

// ✅ Export class (در صورت نیاز)
export { SidebarService };

// ✅ قرار دادن در window
if (typeof window !== "undefined") {
  window.SidebarService = SidebarService;
  window.sidebarService = sidebarService;
}
