class CardService {
  constructor() {
    this.cards = [];
    this.initialized = false;
  }

  init(containerSelector = ".card-container") {
    if (this.initialized) return;

    const containers = document.querySelectorAll(containerSelector);
    containers.forEach((container) => {
      this.setupContainer(container);
    });

    this.initialized = true;
    console.log("✅ CardService initialized");
  }

  setupContainer(container) {
    const cards = container.querySelectorAll(".card");

    cards.forEach((card, index) => {
      // ذخیره در لیست
      this.cards.push({
        element: card,
        index: index,
        container: container,
      });

      // کارت قابل کلیک
      if (card.classList.contains("card-clickable")) {
        card.addEventListener("click", (e) => {
          const event = new CustomEvent("card:click", {
            detail: {
              card: card,
              index: index,
              data: this.getCardData(card),
            },
          });
          card.dispatchEvent(event);
        });
      }
    });
  }

  getCardData(card) {
    const data = {
      id: card.dataset.id || null,
      title: card.querySelector(".card-title")?.textContent?.trim() || null,
      text: card.querySelector(".card-text")?.textContent?.trim() || null,
      icon: card.querySelector(".card-icon .icon")?.className || null,
      stats: {
        number: card.querySelector(".stat-number")?.textContent?.trim() || null,
        label: card.querySelector(".stat-label")?.textContent?.trim() || null,
      },
    };

    return data;
  }

  // ===== متدهای کمکی =====

  getCards(container) {
    return container.querySelectorAll(".card");
  }

  getCardById(id) {
    return document.querySelector(`.card[data-id="${id}"]`);
  }

  // ===== دیستروی =====

  destroy() {
    this.cards = [];
    this.initialized = false;
  }
}

// ===== Export =====
export const cardService = new CardService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.CardService = cardService;
  window.cardService = cardService;
}
