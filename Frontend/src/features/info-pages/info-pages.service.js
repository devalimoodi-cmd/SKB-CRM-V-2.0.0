// ============================================================
// features/info-pages/info-pages.service.js
// راه‌انداز مشترک صفحه‌های «درباره ما»، «تماس با ما» و «راهنما»
//  • هدر و فوتر را می‌سازد
//  • محتوای هر صفحه را از منبع واحد (app-info.const.js) پر می‌کند
// ============================================================
import {
  COMPANY,
  SOFTWARE,
  DEVELOPER,
} from "../../core/constants/app-info.const.js";
import { escapeHtml } from "../../core/utils/string.utils.js";
import { headerService } from "../../shared/layouts/Header/header.service.js";
import { footerService } from "../../shared/layouts/Footer/footer.service.js";

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
};

const fillList = (id, items) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = (items || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
};

// ===== صفحهٔ «درباره ما» =====
const fillAbout = () => {
  if (!document.getElementById("companyName")) return; // این صفحه، درباره ما نیست

  setText("aboutSlogan", `${COMPANY.slogan} — ${SOFTWARE.name} نسخهٔ ${SOFTWARE.versionLabel}`);
  setText("companyName", COMPANY.name);
  setText("companyAbout", COMPANY.about);
  setText("companyGroup", COMPANY.group);
  fillList("companyCapabilities", COMPANY.capabilities);
  fillList("companyCertificates", COMPANY.certificates);
  fillList("companyAwards", COMPANY.awards);

  setText("softwareName", `${SOFTWARE.name} — ${SOFTWARE.fullName}`);
  setText("softwareSummary", SOFTWARE.summary);
  setText("softwareVersion", SOFTWARE.versionLabel);
  setText("softwareStartYear", SOFTWARE.startYear);
  setText("softwareLicense", SOFTWARE.license);
  fillList("softwareFeatures", SOFTWARE.features);

  setText("devName", DEVELOPER.name);
  setText("devRole", DEVELOPER.role);
  setText("devNote", DEVELOPER.note);

  const email = document.getElementById("devEmail");
  if (email) {
    email.textContent = DEVELOPER.email;
    email.href = `mailto:${DEVELOPER.email}`;
  }
  const github = document.getElementById("devGithub");
  if (github) {
    github.textContent = DEVELOPER.githubLabel;
    github.href = DEVELOPER.github;
  }
};

// ===== صفحهٔ «تماس با ما» =====
const fillContact = () => {
  const phoneWrap = document.getElementById("contactPhones");
  if (!phoneWrap) return; // این صفحه، تماس با ما نیست

  phoneWrap.innerHTML = COMPANY.phones
    .map(
      (phone, index) => `
      <div class="contact-item">
        <i class="fas fa-phone"></i>
        <div>
          <strong>تلفن ${index + 1}</strong>
          <a href="tel:${escapeHtml(COMPANY.phonesRaw[index] || "")}" dir="ltr">${escapeHtml(phone)}</a>
        </div>
      </div>`,
    )
    .join("");

  setText("contactAddress", COMPANY.address);
  setText("contactCompanyName", COMPANY.name);

  const website = document.getElementById("contactWebsite");
  if (website) {
    website.textContent = COMPANY.websiteLabel;
    website.href = COMPANY.website;
  }

  const supportEmail = document.getElementById("contactSupportEmail");
  if (supportEmail) {
    supportEmail.textContent = DEVELOPER.email;
    supportEmail.href = `mailto:${DEVELOPER.email}`;
  }

  const github = document.getElementById("contactGithub");
  if (github) {
    github.textContent = DEVELOPER.githubLabel;
    github.href = DEVELOPER.github;
  }

  // دکمهٔ کپی آدرس
  const copyBtn = document.getElementById("contactCopyAddress");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = `${COMPANY.name} — ${COMPANY.address}`;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.innerHTML = '<i class="fas fa-check"></i> کپی شد';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fas fa-copy"></i> کپی آدرس';
        }, 2000);
      } catch {
        copyBtn.innerHTML = '<i class="fas fa-times"></i> کپی نشد';
      }
    });
  }
};

// ===== راه‌اندازی =====
const boot = async () => {
  try {
    await headerService.init();
  } catch (error) {
    console.error("❌ header init:", error);
  }
  try {
    footerService.init();
  } catch (error) {
    console.error("❌ footer init:", error);
  }

  fillAbout();
  fillContact();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
