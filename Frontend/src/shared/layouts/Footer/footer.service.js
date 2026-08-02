class FooterService {
  constructor() {
    this.initialized = false;
    this.elements = {};
    this.version = "2.0.0";
  }

  init() {
    if (this.initialized) return;

    this.elements = {
      container: document.getElementById("main-footer"),
      year: document.querySelector(".footer .footer-year"),
      version: document.querySelector(".footer .footer-version"),
    };

    this.renderFooter();
    this.setupYear();

    this.initialized = true;
    console.log("✅ FooterService initialized");
  }

  renderFooter() {
    const container = this.elements.container;
    if (!container) return;

    // اگر فوتر قبلاً رندر شده، برمی‌گردیم
    if (container.innerHTML) return;

    container.innerHTML = `
            <div class="footer-content">
                <div class="footer-description">
                    <i class="fas fa-copyright"></i>
                    <span>
                        کلیه حقوق متعلق به واحد تحقیق و توسعه کارخانه ستاره کیان بیرجند است. 
                        این سامانه، نرم‌افزار مدیریت ارتباط با مشتریان کارخانه تولید خوراک طیور 
                        ستاره کیان بیرجند می‌باشد.
                    </span>
                </div>

                <div class="footer-links">
                    <a href="/about" class="footer-link">
                        <i class="fas fa-info-circle"></i>
                        <span>درباره ما</span>
                    </a>
                    <a href="/help" class="footer-link">
                        <i class="fas fa-question-circle"></i>
                        <span>راهنما</span>
                    </a>
                    <a href="/contact" class="footer-link">
                        <i class="fas fa-envelope"></i>
                        <span>تماس با ما</span>
                    </a>
                </div>

                <div class="footer-social">
                    <a href="#" class="footer-social-icon" target="_blank" aria-label="لینکدین">
                        <i class="fab fa-linkedin-in"></i>
                    </a>
                    <a href="#" class="footer-social-icon" target="_blank" aria-label="تلگرام">
                        <i class="fab fa-telegram-plane"></i>
                    </a>
                    <a href="#" class="footer-social-icon" target="_blank" aria-label="اینستاگرام">
                        <i class="fab fa-instagram"></i>
                    </a>
                    <a href="#" class="footer-social-icon" target="_blank" aria-label="واتساپ">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                </div>

                <div class="footer-version">
                    <i class="fas fa-code"></i>
                    <span>نسخه <span class="footer-version-text">${this.version}</span></span>
                </div>
            </div>
        `;

    // رویدادهای هاور برای آیتم‌های فوتر
    this.setupHoverEffects();
  }

  setupYear() {
    const yearEl = this.elements.year;
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }
  }

  setupHoverEffects() {
    const links = document.querySelectorAll(".footer-link");
    links.forEach((link) => {
      link.addEventListener("mouseenter", () => {
        link.style.transform = "translateY(-1px)";
      });
      link.addEventListener("mouseleave", () => {
        link.style.transform = "translateY(0)";
      });
    });

    const socialIcons = document.querySelectorAll(".footer-social-icon");
    socialIcons.forEach((icon) => {
      icon.addEventListener("mouseenter", () => {
        icon.style.transform = "translateY(-2px) scale(1.05)";
      });
      icon.addEventListener("mouseleave", () => {
        icon.style.transform = "translateY(0) scale(1)";
      });
    });
  }

  // ===== بروزرسانی نسخه =====

  setVersion(version) {
    this.version = version;
    const versionEl = document.querySelector(".footer-version-text");
    if (versionEl) {
      versionEl.textContent = version;
    }
  }

  // ===== رفرش =====

  refresh() {
    this.renderFooter();
    this.setupYear();
  }
}

// ===== Export =====
export const footerService = new FooterService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.FooterService = footerService;
  window.footerService = footerService;
}
