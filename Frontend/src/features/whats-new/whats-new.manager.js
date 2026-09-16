// ============================================================
// features/whats-new/whats-new.manager.js
// «تغییرات جدید / What's New» — بخش مدیریت در پنل ادمین
// ------------------------------------------------------------
//  • ساخت/ویرایش/انتشار/آرشیو/حذف نسخه‌ها
//  • افزودن/ویرایش/حذف/جابه‌جایی آیتم‌ها با پیش‌نمایش زندهٔ مودال
//  • دسترسی: فقط سوپر ادمین می‌تواند تغییر بدهد؛ بقیهٔ ادمین‌ها
//    فهرست و پیش‌نمایش را می‌بینند (حالت فقط‌خواندنی)
//  (مثل dictionary.manager با import() داینامیک لود می‌شود)
// ============================================================
import { whatsNewApi } from "./whats-new.api.js";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  audienceLabel,
  renderModal,
  renderSummaryRow,
  versionLabel,
} from "./whats-new.renderer.js";
import { escapeHtml, toPersianNumber } from "../../core/utils/string.utils.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { loaderService } from "../../shared/components/Loader/loader.service.js";

const AUDIENCES = ["all", "customers", "experts", "admins"];

class WhatsNewManager {
  constructor() {
    this.root = null;
    this.releases = [];
    this.counts = {};
    this.editingId = null; // null = حالت «نسخهٔ جدید»
    this.draft = this.emptyDraft();
    this.itemDraft = this.emptyItem();
    this.editingItemIndex = null;
    this.isSuperAdmin = false;
    this.bound = false;
    this.initialized = false;
  }

  emptyDraft() {
    return {
      version: "",
      title: "تغییرات جدید",
      description: "",
      audience: "all",
      status: "draft",
      items: [],
    };
  }

  emptyItem() {
    return { category: "new", title: "", description: "", tag: "" };
  }

  // ===== راه‌اندازی =====
  async init(selector = "#releaseNotesContainer") {
    this.root = document.querySelector(selector);
    if (!this.root) return;

    const user = authService.getUser?.() || {};
    this.isSuperAdmin = user?.role === "super_admin";

    this.renderShell();
    if (!this.bound) {
      this.bindEvents();
      this.bound = true;
    }

    await this.loadList();
    this.renderAll();
    this.initialized = true;
    console.log("✅ WhatsNewManager initialized");
  }

  // ===== اسکلت UI =====
  renderShell() {
    this.root.innerHTML = `
      <div style="background:linear-gradient(135deg,#2c7a6e 0%,#035552 100%);border-radius:12px;padding:16px 20px;color:#fff;margin-bottom:16px;">
        <h3 style="margin:0;font-size:16px;">
          <i class="fas fa-bullhorn"></i> تغییرات و اطلاع‌رسانی نسخه‌ها
        </h3>
        <p style="margin:6px 0 0;font-size:12.5px;opacity:.92;">
          هر نسخه‌ای که اینجا منتشر کنید، یک بار برای کاربران مجاز (بر اساس مخاطب) به‌صورت مودال نمایش داده می‌شود
        </p>
      </div>

      <div id="wnReadOnlyNotice"
        style="display:${this.isSuperAdmin ? "none" : "block"};background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:10px 14px;font-size:12.5px;margin-bottom:14px;">
        <i class="fas fa-lock"></i>
        شما در حالت <strong>فقط خواندن</strong> هستید — ساخت/ویرایش/انتشار تغییرات فقط برای <strong>سوپر ادمین</strong> مجاز است.
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;align-items:start;">

        <!-- ستون فرم -->
        <div id="wnFormColumn" style="display:${this.isSuperAdmin ? "block" : "none"};">
          <div style="background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:16px;margin-bottom:16px;">
            <h4 style="margin:0 0 12px;font-size:14px;color:#0f172a;">
              <i class="fas fa-tag" style="color:#2c7a6e;"></i> تنظیمات نسخه
              <span id="wnModeBadge" style="font-size:11px;font-weight:700;background:#f1f5f9;color:#64748b;padding:2px 10px;border-radius:999px;margin-inline-start:6px;">نسخهٔ جدید</span>
            </h4>

            <div style="display:flex;flex-direction:column;gap:10px;">
              <label style="font-size:12px;color:#475569;">شماره نسخه <span style="color:#dc2626;">*</span>
                <input type="text" id="wnVersion" placeholder="مثال: 2.1.0" dir="ltr"
                  style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;">
              </label>

              <label style="font-size:12px;color:#475569;">عنوان مودال
                <input type="text" id="wnTitle" maxlength="150" placeholder="تغییرات جدید"
                  style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;">
              </label>

              <label style="font-size:12px;color:#475569;">توضیح کوتاه
                <textarea id="wnDescription" maxlength="2000" rows="2" placeholder="ما همیشه در حال بهبود سیستم هستیم..."
                  style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;"></textarea>
              </label>

              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <label style="font-size:12px;color:#475569;flex:1;min-width:130px;">مخاطب
                  <select id="wnAudience"
                    style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;">
                    ${AUDIENCES.map((key) => `<option value="${key}">${audienceLabel(key)}</option>`).join("")}
                  </select>
                </label>
                <label style="font-size:12px;color:#475569;flex:1;min-width:130px;">زمان انتشار (اختیاری)
                  <input type="datetime-local" id="wnPublishAt"
                    style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;">
                </label>
              </div>
            </div>
          </div>

          <div style="background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:16px;margin-bottom:16px;">
            <h4 style="margin:0 0 12px;font-size:14px;color:#0f172a;">
              <i class="fas fa-plus-circle" style="color:#2c7a6e;"></i>
              <span id="wnItemFormTitle">افزودن آیتم</span>
            </h4>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;" id="wnCatPicker">
              ${CATEGORY_ORDER.map(
                (key) => `
                <button type="button" class="wn-cat-btn" data-cat="${key}"
                  style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1.5px solid #d8e0e8;background:#fff;border-radius:10px;font-family:inherit;font-size:12px;font-weight:600;color:#64748b;cursor:pointer;">
                  <i class="fas ${CATEGORY_META[key].icon}"></i> ${escapeHtml(CATEGORY_META[key].short)}
                </button>`,
              ).join("")}
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;">
              <label style="font-size:12px;color:#475569;">عنوان آیتم <span style="color:#dc2626;">*</span>
                <input type="text" id="wnItemTitle" maxlength="200" placeholder="مثال: سیستم نظرات و پیشنهادات"
                  style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;">
              </label>

              <label style="font-size:12px;color:#475569;">توضیحات
                <textarea id="wnItemDescription" maxlength="2000" rows="2" placeholder="توضیح کوتاه دربارهٔ این تغییر..."
                  style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;"></textarea>
              </label>

              <label style="font-size:12px;color:#475569;">برچسب
                <input type="text" id="wnItemTag" maxlength="50" placeholder="مثال: جدید، بهبود"
                  style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #d8e0e8;border-radius:8px;font-family:inherit;font-size:13px;box-sizing:border-box;">
              </label>

              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="btn-primary-info" data-wn-act="save-item" style="margin-top:0;">
                  <i class="fas fa-plus"></i> <span id="wnItemSubmitText">افزودن به لیست</span>
                </button>
                <button type="button" class="btn-ghost-info" data-wn-act="clear-item">
                  <i class="fas fa-undo"></i> پاک کردن فرم آیتم
                </button>
              </div>
            </div>
          </div>

          <div style="background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:16px;margin-bottom:16px;">
            <h4 style="margin:0 0 12px;font-size:14px;color:#0f172a;">
              <i class="fas fa-list" style="color:#2c7a6e;"></i> آیتم‌های این نسخه
              <span id="wnItemsCount" style="font-size:11px;font-weight:700;background:#f1f5f9;color:#64748b;padding:2px 10px;border-radius:999px;margin-inline-start:6px;">۰ مورد</span>
            </h4>
            <div id="wnItemsList" style="display:flex;flex-direction:column;gap:8px;"></div>
          </div>

          <div style="background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:16px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn-primary-info" data-wn-act="save" style="margin-top:0;">
                <i class="fas fa-save"></i> <span id="wnSaveText">ذخیرهٔ پیش‌نویس</span>
              </button>
              <button type="button" class="btn-primary-info" data-wn-act="publish" style="margin-top:0;">
                <i class="fas fa-paper-plane"></i> انتشار
              </button>
              <button type="button" class="btn-ghost-info" data-wn-act="archive">
                <i class="fas fa-box-archive"></i> آرشیو
              </button>
              <button type="button" class="btn-ghost-info" data-wn-act="new">
                <i class="fas fa-plus"></i> نسخهٔ جدید
              </button>
              <button type="button" class="btn-ghost-info danger" data-wn-act="delete">
                <i class="fas fa-trash-can"></i> حذف
              </button>
            </div>
          </div>
        </div>

        <!-- ستون پیش‌نمایش -->
        <div>
          <div style="background:#fff;border:2px dashed rgba(44,122,110,.25);border-radius:12px;padding:16px;">
            <h4 style="margin:0 0 12px;font-size:14px;color:#0f172a;">
              <i class="fas fa-eye" style="color:#2c7a6e;"></i> پیش‌نمایش زندهٔ مودال کاربر
            </h4>
            <div class="wn-modal" id="wnPreviewBox" style="max-height:none;box-shadow:0 8px 30px rgba(0,0,0,.08);"></div>
          </div>
        </div>
      </div>

      <!-- فهرست نسخه‌ها -->
      <div style="background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:16px;margin-top:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <h4 style="margin:0;font-size:14px;color:#0f172a;">
            <i class="fas fa-clock-rotate-left" style="color:#2c7a6e;"></i> نسخه‌های ثبت‌شده
            <span id="wnCounts" style="font-size:11px;font-weight:700;color:#64748b;margin-inline-start:8px;"></span>
          </h4>
          <button type="button" class="btn-ghost-info" data-wn-act="refresh">
            <i class="fas fa-rotate"></i> بروزرسانی
          </button>
        </div>
        <div id="wnTableWrap" style="overflow-x:auto;"></div>
      </div>
    `;

    this.markCategoryButton(this.itemDraft.category);
  }

  // ===== رویدادها (delegation) =====
  bindEvents() {
    this.root.addEventListener("click", (event) => {
      // انتخابگر دستهٔ آیتم جدید
      const catBtn = event.target.closest("[data-cat]");
      if (catBtn && this.root.contains(catBtn)) {
        this.itemDraft.category = catBtn.dataset.cat;
        this.markCategoryButton(this.itemDraft.category);
        return;
      }

      const actEl = event.target.closest("[data-wn-act]");
      if (!actEl || !this.root.contains(actEl)) return;
      this.handleAction(actEl.dataset.wnAct, actEl);
    });

    this.root.addEventListener("input", (event) => {
      const id = event.target.id;
      if (id === "wnVersion") this.draft.version = event.target.value.trim();
      else if (id === "wnTitle") this.draft.title = event.target.value;
      else if (id === "wnDescription") this.draft.description = event.target.value;
      else if (id === "wnItemTitle") this.itemDraft.title = event.target.value;
      else if (id === "wnItemDescription")
        this.itemDraft.description = event.target.value;
      else if (id === "wnItemTag") this.itemDraft.tag = event.target.value;

      if (["wnVersion", "wnTitle", "wnDescription"].includes(id)) {
        this.renderPreview();
      }
    });

    this.root.addEventListener("change", (event) => {
      if (event.target.id === "wnAudience") {
        this.draft.audience = event.target.value;
      }
    });
  }

  async handleAction(act, el) {
    switch (act) {
      case "save-item":
        this.saveItem();
        break;
      case "clear-item":
        this.clearItemForm();
        break;
      case "edit-item":
        this.editItem(Number(el.dataset.index));
        break;
      case "del-item":
        this.deleteItem(Number(el.dataset.index));
        break;
      case "item-up":
        this.moveItem(Number(el.dataset.index), -1);
        break;
      case "item-down":
        this.moveItem(Number(el.dataset.index), 1);
        break;
      case "save":
        await this.saveRelease({ publish: false });
        break;
      case "publish":
        await this.saveRelease({ publish: true });
        break;
      case "archive":
        await this.archiveRelease();
        break;
      case "delete":
        await this.deleteRelease();
        break;
      case "edit":
        await this.loadRelease(Number(el.dataset.id));
        break;
      case "new":
        this.resetForm();
        break;
      case "refresh":
        await this.refresh();
        break;
      default:
        break;
    }
  }

  // ============================================
  // آیت‌م‌ها (افزودن/ویرایش/حذف/ترتیب)
  // ============================================
  saveItem() {
    const title = (this.itemDraft.title || "").trim();
    if (!title) {
      notificationService.error("عنوان آیتم را وارد کنید");
      document.getElementById("wnItemTitle")?.focus();
      return;
    }

    const item = {
      category: this.itemDraft.category,
      title,
      description: (this.itemDraft.description || "").trim(),
      tag: (this.itemDraft.tag || "").trim() || CATEGORY_META[this.itemDraft.category].short,
    };

    if (this.editingItemIndex === null) {
      this.draft.items.push(item);
    } else {
      this.draft.items[this.editingItemIndex] = item;
      this.editingItemIndex = null;
      const submitText = document.getElementById("wnItemSubmitText");
      const formTitle = document.getElementById("wnItemFormTitle");
      if (submitText) submitText.textContent = "افزودن به لیست";
      if (formTitle) formTitle.textContent = "افزودن آیتم";
    }

    this.clearItemForm();
    this.renderItems();
    this.renderPreview();
  }

  editItem(index) {
    const item = this.draft.items[index];
    if (!item) return;

    this.itemDraft = { ...item };
    this.editingItemIndex = index;

    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? "";
    };
    set("wnItemTitle", item.title);
    set("wnItemDescription", item.description);
    set("wnItemTag", item.tag);
    this.markCategoryButton(item.category);

    const submitText = document.getElementById("wnItemSubmitText");
    const formTitle = document.getElementById("wnItemFormTitle");
    if (submitText) submitText.textContent = "ذخیرهٔ ویرایش";
    if (formTitle) formTitle.textContent = "ویرایش آیتم";
    document.getElementById("wnItemTitle")?.focus();
  }

  deleteItem(index) {
    if (!Number.isInteger(index) || index < 0) return;
    this.draft.items.splice(index, 1);
    this.editingItemIndex = null;
    this.clearItemForm();
    this.renderItems();
    this.renderPreview();
  }

  moveItem(index, direction) {
    const target = index + direction;
    const items = this.draft.items;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    this.renderItems();
    this.renderPreview();
  }

  clearItemForm() {
    this.itemDraft = this.emptyItem();
    this.editingItemIndex = null;
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };
    set("wnItemTitle", "");
    set("wnItemDescription", "");
    set("wnItemTag", "");
    this.markCategoryButton(this.itemDraft.category);

    const submitText = document.getElementById("wnItemSubmitText");
    const formTitle = document.getElementById("wnItemFormTitle");
    if (submitText) submitText.textContent = "افزودن به لیست";
    if (formTitle) formTitle.textContent = "افزودن آیتم";
  }

  markCategoryButton(category) {
    this.root.querySelectorAll("[data-cat]").forEach((btn) => {
      const active = btn.dataset.cat === category;
      btn.style.borderColor = active ? "#2c7a6e" : "#d8e0e8";
      btn.style.background = active ? "rgba(44,122,110,.08)" : "#fff";
      btn.style.color = active ? "#2c7a6e" : "#64748b";
    });
  }

  // ============================================
  // رندر فرم / لیست آیتم‌ها / پیش‌نمایش
  // ============================================
  renderAll() {
    this.syncFormFields();
    this.renderItems();
    this.renderPreview();
    this.renderCounts();
  }

  syncFormFields() {
    const set = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value ?? "";
    };
    set("wnVersion", this.draft.version);
    set("wnTitle", this.draft.title);
    set("wnDescription", this.draft.description);
    set("wnAudience", this.draft.audience);

    const modeBadge = document.getElementById("wnModeBadge");
    if (modeBadge) {
      modeBadge.textContent = this.editingId
        ? `در حال ویرایش نسخهٔ ${versionLabel(this.draft.version)}`
        : "نسخهٔ جدید";
    }

    const saveText = document.getElementById("wnSaveText");
    if (saveText) {
      saveText.textContent = this.editingId ? "ذخیرهٔ تغییرات" : "ذخیرهٔ پیش‌نویس";
    }
  }

  renderItems() {
    const list = document.getElementById("wnItemsList");
    const countEl = document.getElementById("wnItemsCount");
    if (countEl) {
      countEl.textContent = `${toPersianNumber(this.draft.items.length)} مورد`;
    }
    if (!list) return;

    if (!this.draft.items.length) {
      list.innerHTML = `
        <div class="wn-empty">
          <i class="fas fa-inbox"></i>
          <p>هنوز آیتمی اضافه نشده است</p>
        </div>`;
      return;
    }

    const btnStyle =
      "width:26px;height:26px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;color:#64748b;cursor:pointer;font-size:11px;";

    list.innerHTML = this.draft.items
      .map((item, index) => {
        const meta = CATEGORY_META[item.category] || CATEGORY_META.new;
        return `
          <div style="display:flex;align-items:flex-start;gap:10px;background:#fafbfc;border:1px solid #eef2f6;border-radius:10px;padding:10px 12px;">
            <span class="wn-section-icon ${item.category}" style="flex-shrink:0;">
              <i class="fas ${meta.icon}"></i>
            </span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:#0f172a;">${escapeHtml(item.title)}</div>
              ${item.description ? `<div style="font-size:11.5px;color:#64748b;line-height:1.7;">${escapeHtml(item.description)}</div>` : ""}
              ${item.tag ? `<span class="wn-item-tag ${item.category}">${escapeHtml(item.tag)}</span>` : ""}
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button type="button" style="${btnStyle}" data-wn-act="item-up" data-index="${index}" title="بالا">
                <i class="fas fa-arrow-up"></i>
              </button>
              <button type="button" style="${btnStyle}" data-wn-act="item-down" data-index="${index}" title="پایین">
                <i class="fas fa-arrow-down"></i>
              </button>
              <button type="button" style="${btnStyle}" data-wn-act="edit-item" data-index="${index}" title="ویرایش">
                <i class="fas fa-pen"></i>
              </button>
              <button type="button" style="${btnStyle}color:#dc2626;" data-wn-act="del-item" data-index="${index}" title="حذف">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>`;
      })
      .join("");
  }

  renderPreview() {
    const box = document.getElementById("wnPreviewBox");
    if (!box) return;
    box.innerHTML = renderModal(
      { ...this.draft, version: this.draft.version || "0.0.0" },
      { mode: "preview", emptyText: "هنوز آیتمی اضافه نشده است" },
    );
  }

  // ============================================
  // ارتباط با سرور
  // ============================================
  async loadList() {
    const wrap = document.getElementById("wnTableWrap");
    if (wrap) {
      wrap.innerHTML = await loaderService.inline({
        text: "در حال بارگذاری…",
        size: "sm",
      });
    }

    try {
      const response = await whatsNewApi.getList({ limit: 50 });
      if (!response?.success) {
        if (wrap) {
          wrap.innerHTML = `<div class="wn-empty"><p>${escapeHtml(
            response?.message || "خطا در دریافت فهرست نسخه‌ها",
          )}</p></div>`;
        }
        return;
      }

      this.releases = response.data?.items || [];
      this.counts = response.data?.counts || {};
      this.renderTable();
      this.renderCounts();
    } catch (error) {
      console.error("❌ loadList(whats-new):", error);
      if (wrap) {
        wrap.innerHTML =
          '<div class="wn-empty"><p>خطا در ارتباط با سرور</p></div>';
      }
    }
  }

  async refresh() {
    await this.loadList();
  }

  renderCounts() {
    const el = document.getElementById("wnCounts");
    const counts = this.counts || {};

    if (el) {
      el.textContent = `کل: ${toPersianNumber(counts.total || 0)} | پیش‌نویس: ${toPersianNumber(
        counts.draft || 0,
      )} | منتشرشده: ${toPersianNumber(counts.published || 0)} | آرشیو: ${toPersianNumber(
        counts.archived || 0,
      )}`;
    }

    // ✅ بج منوی سایدبار = تعداد نسخه‌های پیش‌نویس (منتشرنشده)
    const badge = document.getElementById("releaseNotesMenuBadge");
    if (badge) {
      const drafts = Number(counts.draft || 0);
      badge.textContent = String(drafts);
      badge.style.display = drafts > 0 ? "" : "none";
    }
  }

  renderTable() {
    const wrap = document.getElementById("wnTableWrap");
    if (!wrap) return;

    if (!this.releases.length) {
      wrap.innerHTML = `
        <div class="wn-empty">
          <i class="fas fa-inbox"></i>
          <p>هنوز نسخه‌ای ثبت نشده است — اولین نسخه را از فرم بالا بسازید</p>
        </div>`;
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>نسخه</th>
            <th>خلاصه</th>
            <th>مخاطب</th>
            <th>آیتم‌ها</th>
            <th>دیده‌شده</th>
            <th>انتشار</th>
            <th>عملیات</th>
          </tr>
        </thead>
        <tbody>
          ${this.releases
            .map(
              (release) => `
            <tr>
              <td dir="ltr" style="font-weight:700;color:#2c7a6e;">${escapeHtml(release.version)}</td>
              <td style="text-align:start;">${renderSummaryRow(release)}</td>
              <td>${escapeHtml(audienceLabel(release.audience))}</td>
              <td>${toPersianNumber(release.items_count || 0)}</td>
              <td>${toPersianNumber(release.views_count || 0)}</td>
              <td>${release.published_at ? escapeHtml(new Date(release.published_at).toLocaleString("fa-IR")) : "—"}</td>
              <td>
                ${
                  this.isSuperAdmin
                    ? `<button type="button" class="btn-ghost-info" data-wn-act="edit" data-id="${release.id}" title="بارگذاری برای ویرایش"><i class="fas fa-pen"></i> ویرایش</button>`
                    : `<span style="color:#94a3b8;font-size:12px;">—</span>`
                }
              </td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
  }

  // ===== بارگذاری یک نسخه در فرم (ویرایش) =====
  async loadRelease(id) {
    if (!Number.isInteger(id) || id <= 0) return;

    try {
      const response = await whatsNewApi.getOne(id);
      const release = response?.data?.release;
      if (!response?.success || !release) {
        notificationService.error(response?.message || "نسخه دریافت نشد");
        return;
      }

      this.editingId = release.id;
      this.draft = {
        version: release.version || "",
        title: release.title || "تغییرات جدید",
        description: release.description || "",
        audience: release.audience || "all",
        status: release.status || "draft",
        items: (release.items || []).map((item) => ({
          category: item.category,
          title: item.title,
          description: item.description || "",
          tag: item.tag || "",
        })),
      };

      this.clearItemForm();
      this.renderAll();
      document
        .getElementById("wnVersion")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      notificationService.success(
        `نسخهٔ ${versionLabel(release.version)} برای ویرایش بارگذاری شد`,
      );
    } catch (error) {
      console.error("❌ loadRelease(whats-new):", error);
      notificationService.error("خطا در دریافت نسخه");
    }
  }

  // ===== فرم جدید =====
  resetForm() {
    this.editingId = null;
    this.draft = this.emptyDraft();
    this.clearItemForm();
    const publishAt = document.getElementById("wnPublishAt");
    if (publishAt) publishAt.value = "";
    this.renderAll();
  }

  // ===== اعتبارسنجی و ارسال =====
  validateDraft() {
    if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(this.draft.version || "")) {
      notificationService.error("شماره نسخه را به شکل 2.1.0 وارد کنید");
      document.getElementById("wnVersion")?.focus();
      return false;
    }
    if (!this.draft.items.length) {
      notificationService.error("حداقل یک آیتم برای این نسخه اضافه کنید");
      return false;
    }
    return true;
  }

  buildPayload() {
    return {
      version: this.draft.version,
      title: this.draft.title || "تغییرات جدید",
      description: this.draft.description || "",
      audience: this.draft.audience || "all",
      items: this.draft.items.map((item, index) => ({
        category: item.category,
        title: item.title,
        description: item.description || "",
        tag: item.tag || "",
        sort_order: index,
      })),
    };
  }

  async saveRelease({ publish = false } = {}) {
    if (!this.isSuperAdmin) {
      notificationService.error("فقط سوپر ادمین می‌تواند تغییرات را ذخیره کند");
      return null;
    }
    if (!this.validateDraft()) return null;

    const payload = this.buildPayload();

    try {
      let release = null;

      if (this.editingId) {
        const response = await whatsNewApi.update(this.editingId, payload);
        if (!response?.success) {
          notificationService.error(response?.message || "خطا در ذخیرهٔ نسخه");
          return null;
        }
        release = response.data?.release;
      } else {
        const response = await whatsNewApi.create(payload);
        if (!response?.success) {
          notificationService.error(response?.message || "خطا در ساخت نسخه");
          return null;
        }
        release = response.data?.release;
        this.editingId = release?.id || null;
      }

      if (publish) {
        await this.doPublish();
      } else {
        notificationService.success("✅ نسخه ذخیره شد (پیش‌نویس)");
      }

      await this.loadList();
      this.syncFormFields();
      return release;
    } catch (error) {
      console.error("❌ saveRelease(whats-new):", error);
      notificationService.error(error?.message || "خطا در ارتباط با سرور");
      return null;
    }
  }

  async doPublish() {
    if (!this.editingId) return;

    const publishAtEl = document.getElementById("wnPublishAt");
    const payload = {};

    if (publishAtEl?.value) {
      const parsed = new Date(publishAtEl.value);
      if (Number.isNaN(parsed.getTime())) {
        notificationService.error("زمان انتشار نامعتبر است");
        return;
      }
      payload.published_at = parsed.toISOString();
    }

    const confirmed = await notificationService.confirm({
      title: "🚀 انتشار تغییرات",
      text: payload.published_at
        ? "انتشار این نسخه برای زمان انتخاب‌شده زمان‌بندی شود؟"
        : "این نسخه همین حالا برای کاربران مجاز منتشر شود؟",
      confirmText: "بله، منتشر کن",
      cancelText: "انصراف",
    });
    if (!confirmed) return;

    try {
      const response = await whatsNewApi.publish(this.editingId, payload);
      if (!response?.success) {
        notificationService.error(response?.message || "انتشار ناموفق بود");
        return;
      }

      const scheduled = response.data?.scheduled === true;
      notificationService.success(
        scheduled ? "✅ انتشار برای زمان انتخابی زمان‌بندی شد" : "✅ نسخه منتشر شد",
      );
      await this.loadList();
    } catch (error) {
      console.error("❌ doPublish(whats-new):", error);
      notificationService.error("خطا در انتشار نسخه");
    }
  }

  async archiveRelease() {
    if (!this.isSuperAdmin) {
      notificationService.error("فقط سوپر ادمین مجاز است");
      return;
    }
    if (!this.editingId) {
      notificationService.error("ابتدا یک نسخه را از فهرست پایین انتخاب کنید");
      return;
    }

    const confirmed = await notificationService.confirm({
      title: "📦 آرشیو نسخه",
      text: "این نسخه آرشیو شود؟ (دیگر برای کاربران نمایش داده نمی‌شود)",
      confirmText: "بله، آرشیو کن",
      cancelText: "انصراف",
    });
    if (!confirmed) return;

    try {
      const response = await whatsNewApi.archive(this.editingId);
      if (!response?.success) {
        notificationService.error(response?.message || "آرشیو ناموفق بود");
        return;
      }
      notificationService.success("✅ نسخه آرشیو شد");
      await this.loadList();
    } catch (error) {
      console.error("❌ archiveRelease(whats-new):", error);
      notificationService.error("خطا در آرشیو نسخه");
    }
  }

  async deleteRelease() {
    if (!this.isSuperAdmin) {
      notificationService.error("فقط سوپر ادمین مجاز است");
      return;
    }
    if (!this.editingId) {
      notificationService.error("ابتدا یک نسخه را از فهرست پایین انتخاب کنید");
      return;
    }

    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف نسخه",
      text: "این نسخه با همهٔ آیتم‌ها و رسیدهای دیدن حذف شود؟ این عمل قابل بازگشت نیست.",
      confirmText: "بله، حذف کن",
      cancelText: "انصراف",
    });
    if (!confirmed) return;

    try {
      const response = await whatsNewApi.remove(this.editingId);
      if (!response?.success) {
        notificationService.error(response?.message || "حذف ناموفق بود");
        return;
      }
      notificationService.success("✅ نسخه حذف شد");
      this.resetForm();
      await this.loadList();
    } catch (error) {
      console.error("❌ deleteRelease(whats-new):", error);
      notificationService.error("خطا در حذف نسخه");
    }
  }
}

export const whatsNewManager = new WhatsNewManager();

// ===== دسترسی سراسری (مثل dictManager) =====
if (typeof window !== "undefined") {
  window.whatsNewManager = whatsNewManager;
}
