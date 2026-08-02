export const hatcheryTabsService = {
  initialized: false,

  init() {
    if (this.initialized) return;

    const container = document.getElementById("Hatchery-Management");
    if (!container) {
      console.warn("⚠️ Hatchery-Management element not found");
      return;
    }

    // Event Delegation for tabs
    container.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".tab-btn");
      if (!tabBtn) return;
      if (!container.contains(tabBtn)) return;

      const tabId = tabBtn.dataset.tab;
      if (tabId) {
        this.activateTab(tabId);
        this.loadTabData(tabId);
      }
    });

    // Activate default tab
    const firstTab = container.querySelector(".tab-btn");
    if (firstTab) {
      this.activateTab(firstTab.dataset.tab);
    }

    this.initialized = true;
    console.log("✅ HatcheryTabsService initialized");
  },

  activateTab(tabId) {
    const container = document.getElementById("Hatchery-Management");
    if (!container) return;

    // Deactivate all - scoped to container
    container
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    container
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));

    // Activate selected tab
    const btn = container.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.classList.add("active");

    const tabMap = {
      "chick-period-info": "chickPeriodInfoTab",
      "chick-periods-list": "chickPeriodsListTab",
      "chick-register": "chickRegisterTab",
      "chick-list": "chickListTab",
      "chick-hygiene-info": "chickHygieneInfoTab",
      "chick-hygiene-list": "chickHygieneListTab",
    };

    const contentId = tabMap[tabId];
    if (contentId) {
      const content = document.getElementById(contentId);
      if (content) {
        content.classList.add("active");
      }
    }
  },

  loadTabData(tabId) {
    setTimeout(() => {
      switch (tabId) {
        case "chick-periods-list":
          if (typeof window.loadAllPeriodsList === "function") {
            window.loadAllPeriodsList();
          }
          break;
        case "chick-list":
          if (typeof window.loadChickPeriodsList === "function") {
            window.loadChickPeriodsList();
          }
          break;
        case "chick-hygiene-list":
          if (typeof window.loadAllHygieneHistory === "function") {
            window.loadAllHygieneHistory();
          }
          break;
      }
    }, 100);
  },

  getActiveTab() {
    const activeBtn = document.querySelector(".tab-btn.active");
    return activeBtn?.dataset?.tab || null;
  },
};
