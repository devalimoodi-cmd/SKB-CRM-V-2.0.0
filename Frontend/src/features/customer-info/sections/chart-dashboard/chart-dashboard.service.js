// ================================================================
// chart-dashboard.service.js
// سرویس نمودارهای تحلیلی داینامیک (تب داشبورد اطلاعات مشتری)
// همه شاخص‌ها با فرمول‌های یکسان بخش هفتگی (weekly.calculations.js) محاسبه می‌شوند
// ================================================================

import { chartDashboardApi } from "./chart-dashboard.api.js";
import { chartDashboardRenderer } from "./chart-dashboard.renderer.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  findStandard,
  getInitialWeightKg,
  birdsStartOfWeek,
  birdsEndOfWeek,
  weeklyMortalityPercent,
  totalMortalityPercent,
  weeklyGain,
  dailyGain,
  fcrUpToWeek,
  standardWeeklyGain,
} from "../weekly/weekly.calculations.js";

// ===== پالت رنگ گله‌ها =====
const PALETTE = [
  "#2c7a6e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#e11d48",
  "#64748b",
];

// ===== تعریف شاخص‌های نمودار داینامیک اصلی =====
const MAIN_INDICATORS = {
  weight: {
    title: "وزنگیری (روند وزن هفتگی)",
    key: "weight",
    stdKey: "stdWeight",
    yLabel: "وزن (کیلوگرم)",
    decimals: 2,
    unit: "kg",
  },
  gain: {
    title: "افزایش وزن هفتگی",
    key: "weightGain",
    stdKey: "stdGain",
    yLabel: "افزایش وزن (کیلوگرم)",
    decimals: 3,
    unit: "kg",
  },
  dailyGain: {
    title: "نرخ رشد روزانه",
    key: "dailyGainGrams",
    stdKey: "stdDailyGainGrams",
    yLabel: "گرم در روز",
    decimals: 1,
    unit: "گرم",
  },
};

class ChartDashboardService {
  // ===== ابزارهای هویت واحد نمایش (گله کل / سالن) =====
  flockUid(f) {
    if (!f) return "";
    if (f._uid) return String(f._uid);
    return f.flock && f.flock.id != null ? `h${f.flock.id}` : "";
  }

  _displayOf(u) {
    const fi = (u && u.flock) || {};
    const num = fi.flockNumber ?? "";
    if (u && u._isGroup) {
      const cnt = (u._memberUids && u._memberUids.length) || 1;
      return `گله ${num} (کل، ${cnt} سالن)`;
    }
    const hall =
      fi.hallName && fi.hallName !== "نامشخص"
        ? fi.hallName
        : fi.hallId
          ? `سالن ${fi.hallId}`
          : "";
    return `گله ${num}${hall ? ` • ${hall}` : ""}`;
  }

  rerenderCharts() {
    this.destroyCharts();
    this.flocks = this.activeUnits;
    const selectedPast = this._hasSelectedPast();
    chartDashboardRenderer.renderContainer(
      this.activeUnits,
      this.selectedFlockIds,
      this.weekCount,
      {
        includePast: !!this.includePast,
        hasPastFlocks: !!this.hasPastFlocks,
        hasActiveFlock: !!this.hasActiveFlock,
        selectedPast,
        mainIndicator: this.mainIndicator,
        viewMode: this.viewMode,
        layoutMode: this.layoutMode,
        hallFlocks: this.hallFlocks,
        groupMeta: this.groupMeta,
        compareCount: this.compareUnits.length,
      },
    );

    // بازگردانی وضعیت تنظیمات بعد از بازسازی DOM
    const setChk = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };
    const setSel = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = String(val);
    };
    setChk("showStandards", this.showStandards);
    setChk("showDataLabels", this.showDataLabels);
    setChk("showTooltip", this.showTooltip);
    setSel("mainLineWidth", this.lineWidth);
    setSel("mainPointSize", this.pointSize);

    this.renderAllCharts();
  }

  // ===== ساخت گروههای «کل گله» از سالنهای عضو =====
  _initGroupViews() {
    this.hallFlocks = this.flocks;
    this.hallFlocks.forEach((u) => {
      u._uid = `h${u.flock.id}`;
      u._isHall = true;
      u._chipLabel = this._displayOf(u);
    });

    const byKey = new Map();
    this.hallFlocks.forEach((u) => {
      const gk = u.flock.groupId ? `g${u.flock.groupId}` : `h${u.flock.id}`;
      u._groupKey = gk;
      if (!byKey.has(gk)) {
        byKey.set(gk, {
          _groupKey: gk,
          flockNumber: u.flock.flockNumber,
          customerName: u.flock.customerName,
          farmName: u.flock.farmName,
          breedId: u.flock.breedId,
          breedName: u.flock.breedName,
          members: [],
        });
      }
      byKey.get(gk).members.push(u);
    });
    this.groupMeta = [...byKey.values()];

    this.groupFlocks = this.groupMeta.map((meta) => this._buildGroupUnit(meta));
    this.groupFlocks.forEach((g) => {
      g._chipLabel = `گله ${g.flock.flockNumber} (کل، ${g._memberUids.length} سالن)`;
    });

    // برگرداندن چیدمان ذخیرهشده
    try {
      const saved = localStorage.getItem("skb-analysis-layout");
      if (saved && ["stacked", "duo", "side"].includes(saved)) {
        this.layoutMode = saved;
      }
    } catch (e) {}

    // حالت پیشفرض: نمایش کل گلهها
    this.viewMode = "flock";
    this.activeUnits = this.groupFlocks;
    this.selectedFlockIds = this.activeUnits.map((u) => u._uid);
  }

  _buildGroupUnit(meta) {
    const members = meta.members || [];
    const first = members[0];
    const wTotal = members.reduce(
      (s, m) => s + (parseFloat(m.flock.totalChicks) || 0),
      0,
    );
    const wSum = members.reduce(
      (s, m) =>
        s +
        (parseFloat(m.flock.totalChicks) || 0) *
          (parseFloat(m.flock.avgInitialWeightGrams) || 0),
      0,
    );
    const avgInit =
      wTotal > 0
        ? wSum / wTotal
        : first
          ? parseFloat(first.flock.avgInitialWeightGrams) || null
          : null;

    const weeks = this._mergeMemberWeeks(members);
    const flockInfo = {
      id: members.length > 1 ? -1 : first.flock.id,
      flockNumber: meta.flockNumber,
      customerName: meta.customerName || "",
      farmName: meta.farmName || "",
      hallName: `کل گله (${members.length} سالن)`,
      hallId: null,
      breedId: meta.breedId,
      breedName: meta.breedName || "",
      placementDate: first ? first.flock.placementDate : null,
      totalChicks: wTotal,
      avgInitialWeightGrams: avgInit,
    };
    const unit = {
      flock: flockInfo,
      weeks,
      standards: first ? first.standards || [] : [],
      color: first ? first.color : PALETTE[0],
      _uid: `agg:${meta._groupKey}`,
      _isGroup: true,
      _groupKey: meta._groupKey,
      _memberUids: members.map((m) => m._uid),
    };
    unit.series = this.computeSeries({
      flock: flockInfo,
      weeks,
      standards: unit.standards,
    });
    return unit;
  }

  _mergeMemberWeeks(members) {
    const byWeek = new Map();
    members.forEach((m) => {
      (m.weeks || []).forEach((w) => {
        const wn = parseInt(w.week_number) || 0;
        if (!wn) return;
        if (!byWeek.has(wn)) {
          byWeek.set(wn, {
            dates: [],
            age: null,
            weights: [],
            mort: 0,
            feeds: [],
            blackouts: [],
          });
        }
        const rec = byWeek.get(wn);
        if (w.week_start_date) rec.dates.push(w.week_start_date);
        if (w.week_end_date) rec.dates.push(w.week_end_date);
        if (rec.age == null && w.flock_age_days != null) {
          rec.age = w.flock_age_days;
        }
        const wt = parseFloat(w.weekly_weight);
        if (!isNaN(wt)) rec.weights.push(wt);
        rec.mort += parseInt(w.weekly_mortality) || 0;
        const fd = parseFloat(w.weekly_feed_intake);
        if (!isNaN(fd)) rec.feeds.push(fd);
        const bk = parseFloat(w.blackout_hours);
        if (!isNaN(bk)) rec.blackouts.push(bk);
      });
    });
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    return [...byWeek.keys()]
      .sort((a, b) => a - b)
      .map((wn) => {
        const r = byWeek.get(wn);
        return {
          week_number: wn,
          week_start_date: r.dates[0] || null,
          week_end_date: r.dates[r.dates.length - 1] || null,
          flock_age_days: r.age ?? null,
          weekly_weight: r.weights.length
            ? sum(r.weights) / r.weights.length
            : null,
          weekly_mortality: r.mort,
          weekly_feed_intake: r.feeds.length
            ? parseFloat(sum(r.feeds).toFixed(2))
            : null,
          daily_feed_intake: null,
          blackout_hours: r.blackouts.length
            ? sum(r.blackouts) / r.blackouts.length
            : 0,
        };
      });
  }

  // ===== سوییچ «نمای کل گله» / «نمای سالنها» =====
  setViewMode(mode) {
    if (!["flock", "hall"].includes(mode) || mode === this.viewMode) return;

    const prevSelected = new Set(
      this.selectedFlockIds.map((u) => String(u)),
    );
    let keep = null;

    if (mode === "hall") {
      const memberSet = new Set();
      const pushAggMembers = (aggUid) => {
        const meta = this.groupMeta.find(
          (m) => `agg:${m._groupKey}` === aggUid,
        );
        if (meta) meta.members.forEach((u) => memberSet.add(u._uid));
      };
      prevSelected.forEach((uid) => {
        if (uid.startsWith("agg:")) pushAggMembers(uid);
        else {
          const u = this.hallFlocks.find((x) => x._uid === uid);
          if (u) memberSet.add(u._uid);
        }
      });
      keep = memberSet;
      this.activeUnits = this.hallFlocks;
    } else {
      const aggSet = new Set();
      prevSelected.forEach((uid) => {
        if (uid.startsWith("agg:")) {
          aggSet.add(uid);
        } else {
          const u = this.hallFlocks.find((x) => x._uid === uid);
          if (u) aggSet.add(`agg:${u._groupKey}`);
        }
      });
      keep = aggSet;
      this.activeUnits = this.groupFlocks;
    }

    this.viewMode = mode;
    this.selectedFlockIds = this.activeUnits
      .filter((u) => keep.has(u._uid))
      .map((u) => u._uid);
    this.rerenderCharts();
  }

  // انتخاب همزمان همه سالنهای یک گله در نمای سالنها
  selectGroupMembers(groupKey, checked) {
    if (this.viewMode !== "hall") return;
    const meta = this.groupMeta.find((m) => m._groupKey === groupKey);
    if (!meta) return;
    const set = new Set(this.selectedFlockIds.map((u) => String(u)));
    meta.members.forEach((u) => {
      if (checked) set.add(u._uid);
      else set.delete(u._uid);
    });
    this.selectedFlockIds = this.hallFlocks
      .filter((u) => set.has(u._uid))
      .map((u) => u._uid);

    meta.members.forEach((u) => {
      const cb = document.querySelector(
        `.analysis-flock-check input[value="${u._uid}"]`,
      );
      if (cb) cb.checked = checked;
    });
    this.renderAllCharts();
    this.refreshPastBanner();
  }

  // ===== تغییر چیدمان کارتها =====
  setChartLayout(mode) {
    if (!["stacked", "duo", "side"].includes(mode)) return;
    this.layoutMode = mode;
    try {
      localStorage.setItem("skb-analysis-layout", mode);
    } catch (e) {}
    const wrap = document.getElementById("analysisCards");
    if (wrap) wrap.dataset.layout = mode;
    document
      .querySelectorAll("#chartLayoutGroup .analysis-seg-btn")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.layout === mode),
      );

    // بازسازی نمودارها در چیدمان جدید تا عرض کانواسها بهدرستی اعمال شود
    this.renderAllCharts();
  }

  // ===== مقایسه گله/سالن سایر مشتریان (روی همه نمودارهای صفحه) =====
  buildCompareDatasets(indKey) {
    const datasets = [];
    this.compareUnits.forEach((cu) => {
      const sKey = `cmp:${cu._uid}:actual`;
      const s = this.seriesSettings[sKey];
      if (s && s.visible === false) return;
      const color = (s && s.color) || cu.color;
      datasets.push({
        label: cu.label || cu._chipLabel || "مقایسه",
        data: this.getFlockDataByWeek(cu, indKey),
        borderColor: color,
        borderDash: this.getLineDash(s && s.lineType, [2, 2]),
        backgroundColor: `${color}22`,
        fill: false,
        tension: 0.3,
        borderWidth: this.lineWidth,
        pointRadius: this.pointSize,
      });
    });
    return datasets;
  }

  withCompare(datasets, key) {
    datasets.push(...this.buildCompareDatasets(key));
    return datasets;
  }

  async _loadCustomerList() {
    const res = await chartDashboardApi.getCustomers({ pageSize: 1000 });
    if (!res.success) throw new Error(res.message || "خطا در دریافت مشتریان");
    const rows =
      res.data?.customers ||
      res.data?.rows ||
      res.data?.list ||
      (Array.isArray(res.data) ? res.data : []) ||
      [];
    return rows
      .map((r) => ({
        id: r.id ?? r.customer_id,
        name: r.full_name || r.fullName || `مشتری ${r.id}`,
        farm: r.farm_name || r.farmName || "",
      }))
      .filter((c) => c.id != null);
  }

  _externalHallUnit(raw, paletteIndex) {
    const f = { ...raw, color: PALETTE[paletteIndex % PALETTE.length] };
    f.series = this.computeSeries(f);
    f._uid = `h${f.flock.id}`;
    f._isHall = true;
    f._chipLabel = this._displayOf(f);
    return f;
  }

  _externalGroups(halls, customerId) {
    const byKey = new Map();
    halls.forEach((u) => {
      const gk = u.flock.groupId ? `g${u.flock.groupId}` : `h${u.flock.id}`;
      u._groupKey = gk;
      if (!byKey.has(gk)) {
        byKey.set(gk, {
          _groupKey: gk,
          flockNumber: u.flock.flockNumber,
          customerName: u.flock.customerName || `مشتری ${customerId}`,
          farmName: u.flock.farmName || "",
          breedId: u.flock.breedId,
          breedName: u.flock.breedName || "",
          members: [],
        });
      }
      byKey.get(gk).members.push(u);
    });
    const groups = [...byKey.values()].map((meta) => this._buildGroupUnit(meta));
    groups.forEach((g) => {
      g._chipLabel = `گله ${g.flock.flockNumber} (کل، ${g._memberUids.length} سالن)`;
    });
    return groups;
  }

  async _ensureExternalCustomer(customerId) {
    if (this.externalCache[customerId]) return this.externalCache[customerId];
    const res = await chartDashboardApi.getAnalysis(customerId);
    if (!res.success) throw new Error(res.message || "خطا در دریافت داده مشتری");
    const rawHalls = res.data?.flocks || [];
    const customerName =
      rawHalls[0]?.flock?.customerName ||
      rawHalls[0]?.flock?.farmName ||
      `مشتری ${customerId}`;
    const halls = rawHalls.map((f, i) => this._externalHallUnit(f, i));
    const groups = this._externalGroups(halls, customerId);
    const cached = {
      customerId,
      customerName,
      halls,
      groups,
    };
    this.externalCache[customerId] = cached;
    return cached;
  }

  _makeCompareUnit(unit, customerId, label) {
    const used = new Set(
      [...this.activeUnits, ...this.compareUnits]
        .map((u) => u.color)
        .filter(Boolean),
    );
    let color = PALETTE[this._cmpColorIndex % PALETTE.length];
    for (let off = 0; off < PALETTE.length; off++) {
      const c = PALETTE[(this._cmpColorIndex + off) % PALETTE.length];
      if (!used.has(c) || off === PALETTE.length - 1) {
        color = c;
        this._cmpColorIndex = (this._cmpColorIndex + off + 1) % PALETTE.length;
        break;
      }
    }
    return {
      ...unit,
      color,
      _uid: `${customerId}:${unit._uid}`,
      label: label || unit._chipLabel || "سری مقایسه",
    };
  }

  async openChartComparePicker() {
    if (typeof Swal === "undefined") return;
    try {
      const list = await this._loadCustomerList();
      if (!list.length) {
        notificationService.warning("مشتری دیگری برای مقایسه در دسترس نیست");
        return;
      }
      const opts = list
        .map(
          (c) =>
            `<option value="${c.id}">${c.name}${c.farm ? ` (${c.farm})` : ""}</option>`,
        )
        .join("");
      const result = await Swal.fire({
        title: "مقایسه با گله/سالن سایر مشتریان",
        html: `<div style="text-align:right;direction:rtl;font-family:Vazir,sans-serif;">
                 <label style="display:block;font-size:12px;color:#334155;margin-bottom:6px;">مشتری:</label>
                 <select id="cmpCustomer" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;">
                   <option value="">انتخاب مشتری...</option>${opts}
                 </select>
                 <p style="font-size:11px;color:#94a3b8;margin-top:8px;">سریهای انتخابی روی همه نمودارهای این صفحه نمایش داده میشوند.</p>
               </div>`,
        showCancelButton: true,
        confirmButtonText: "ادامه",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#2c7a6e",
        preConfirm: () => {
          const v = document.getElementById("cmpCustomer")?.value;
          if (!v) {
            Swal.showValidationMessage("یک مشتری انتخاب کنید");
            return false;
          }
          return parseInt(v);
        },
      });
      if (result.isConfirmed && result.value) {
        await this._showExternalUnits(result.value);
      }
    } catch (error) {
      console.error("❌ Error loading customer list:", error);
      notificationService.error("خطا در دریافت لیست مشتریان");
    }
  }

  async _showExternalUnits(customerId) {
    let data;
    try {
      data = await this._ensureExternalCustomer(customerId);
    } catch (error) {
      console.error("❌ Error loading external flock:", error);
      notificationService.error("خطا در دریافت گله‌های مشتری");
      return;
    }
    if (!data || !data.halls.length) {
      notificationService.warning("این مشتری گله فعالی برای مقایسه ندارد");
      return;
    }
    const draft = { customerId, map: new Map(), order: [] };
    const addOpt = (unit, label) => {
      const uid = unit._uid;
      if (!draft.map.has(uid)) {
        draft.map.set(uid, { uid, unit, label });
        draft.order.push(uid);
      }
    };
    data.groups.forEach((g) => {
      const gnum = g.flock.flockNumber;
      const cname = data.customerName || `مشتری ${customerId}`;
      if (g._memberUids.length > 1) {
        addOpt(
          g,
          `گله ${gnum} — کل (${g._memberUids.length} سالن) از ${cname}`,
        );
        g._memberUids.forEach((mid) => {
          const hall = data.halls.find((h) => h._uid === mid);
          if (hall) {
            addOpt(
              hall,
              `گله ${gnum} • ${hall.flock.hallName || "سالن"} از ${cname}`,
            );
          }
        });
      } else {
        const hall = data.halls.find((h) => h._uid === g._memberUids[0]);
        if (hall) {
          addOpt(
            hall,
            `گله ${gnum} • ${hall.flock.hallName || "سالن"} از ${cname}`,
          );
        }
      }
    });

    const rows = draft.order
      .map((uid) => {
        const it = draft.map.get(uid);
        return `<label class="cmp-option-row">
            <input type="checkbox" class="cmp-candidate" value="${uid}">
            <span class="cmp-option-label">${it.label}</span>
          </label>`;
      })
      .join("");
    this._cmpDraft = draft;

    const res = await Swal.fire({
      title: "انتخاب گله/سالن برای مقایسه",
      html: `<div style="text-align:right;direction:rtl;font-family:Vazir,sans-serif;">
               <p style="font-size:11px;color:#64748b;margin-bottom:8px;">میتوانید چند گله یا سالن را همزمان انتخاب کنید (حداکثر ۸ سری).</p>
               <div class="cmp-option-list">${rows}</div>
             </div>`,
      showCancelButton: true,
      confirmButtonText: "➕ افزودن به همه نمودارها",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#2c7a6e",
      preConfirm: () => {
        const picked = [
          ...document.querySelectorAll(".cmp-candidate:checked"),
        ].map((i) => i.value);
        if (!picked.length) {
          Swal.showValidationMessage("حداقل یک گله یا سالن انتخاب کنید");
          return false;
        }
        return picked;
      },
    });
    if (res.isConfirmed && res.value) {
      this._commitCompareUnits(res.value);
    }
  }

  _commitCompareUnits(uids) {
    const draft = this._cmpDraft;
    this._cmpDraft = null;
    if (!draft) return;
    let added = 0;
    let existed = 0;
    uids.forEach((uid) => {
      const item = draft.map.get(uid);
      if (!item) return;
      const finalUid = `${draft.customerId}:${item.unit._uid}`;
      if (this.compareUnits.some((c) => c._uid === finalUid)) {
        existed++;
        return;
      }
      if (this.compareUnits.length >= 8) {
        notificationService.info("حداکثر ۸ سری مقایسه مجاز است");
        return;
      }
      this.compareUnits.push(
        this._makeCompareUnit(item.unit, draft.customerId, item.label),
      );
      added++;
    });
    if (added > 0) {
      this.rerenderCharts();
      notificationService.success(
        `${added} سری مقایسه به همه نمودارها اضافه شد`,
      );
    } else if (existed > 0) {
      notificationService.info("سری انتخاب‌شده از قبل اضافه شده است");
    }
  }

  removeCompareSeries(uidStr) {
    const uid = String(uidStr || "");
    if (!uid) return;
    this.compareUnits = this.compareUnits.filter(
      (c) => String(c._uid) !== uid,
    );
    Object.keys(this.seriesSettings).forEach((k) => {
      if (k.startsWith(`cmp:${uid}:`)) delete this.seriesSettings[k];
    });
    this.rerenderCharts();
    notificationService.success("سری مقایسه حذف شد");
  }

  constructor() {
    this.customerId = null;
    this.flocks = []; // هر گله: { flock, weeks, standards, series, color }
    this.selectedFlockIds = [];
    this.viewMode = "flock"; // "flock" => کل گله | "hall" => سالنها
    this.layoutMode = "stacked"; // stacked | duo | side
    this.hallFlocks = [];
    this.groupFlocks = [];
    this.groupMeta = [];
    this.activeUnits = [];
    this.compareUnits = [];
    this.externalCache = {};
    this._cmpColorIndex = 0;
    this.weekCount = 8;
    this.mainIndicator = "weight";
    this.mortalityMode = "weekly";
    this.survivalMode = "cumulative";
    this.showStandards = true;
    this.showDataLabels = false;
    this.showTooltip = true;
    this.seriesSettings = {}; // تنظیمات سری‌های نمودار اصلی: { key: {visible,color,lineType} }
    this.lineWidth = 2;
    this.pointSize = 4;
    this.chartInstances = {};
    this.initialized = false;
    this.includePast = false;
    this.hasActiveFlock = false;
    this.hasPastFlocks = false;
  }

  // ===== مقداردهی =====
  async init(customerId) {
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    await this.loadData();
    this.initialized = true;
    console.log("✅ ChartDashboardService (تحلیلی) initialized");
  }

  async loadData() {
    try {
      const res = await chartDashboardApi.getAnalysis(this.customerId);
      if (!res.success) throw new Error(res.message || "خطا در دریافت داده");

      let raw = res.data.flocks || [];

      // اگر هیچ گله‌ای فعال نبود اما گلهٔ گذشته وجود داشت، خودکار حالت گذشته فعال می‌شود
      this.includePast = false;
      if (raw.length === 0) {
        const resAll = await chartDashboardApi.getAnalysis(
          this.customerId,
          "all",
        );
        if (resAll.success) {
          const allRaw = resAll.data.flocks || [];
          // پاسخ API خاصیت isActive را داخل flock برمی‌گرداند (سازگاری با هر دو شکل)
          const isPastRow = (x) =>
            (x && x.flock && x.flock.isActive === false) ||
            (x && x.isActive === false);
          const pastExists = allRaw.some(isPastRow);
          if (pastExists) {
            raw = allRaw;
            this.includePast = true;
          }
        }
      }

      this.flocks = this._buildFlocksFromRaw(raw);
      this._refreshViewMeta();

      this.destroyCharts();
      this.rerenderCharts();
    } catch (error) {
      console.error("❌ Error loading analysis data:", error);
      notificationService.error("خطا در دریافت داده‌های تحلیلی");
    }
  }

  _buildFlocksFromRaw(rawFlocks) {
    return (rawFlocks || []).map((f, i) => ({
      ...f,
      color: PALETTE[i % PALETTE.length],
      series: this.computeSeries(f),
      _isPast:
        (f && f.flock && f.flock.isActive === false) ||
        (f && f.isActive === false),
    }));
  }

  // ===== بازسازی نماها بعد از هر بار لود/تغییر scope =====
  _refreshViewMeta() {
    let maxWeek = 0;
    this.flocks.forEach((f) =>
      (f.weeks || []).forEach((w) => {
        if (w.week_number > maxWeek) maxWeek = w.week_number;
      }),
    );
    this.weekCount = Math.max(2, Math.min(maxWeek || 2, 16));
    this.seriesSettings = {};
    this._initGroupViews();
    this._markPastChips();

    // پیش‌فرض: همهٔ گله‌های فعال؛ اگر فعالی نبود همهٔ گذشته‌ها
    this.activeUnits = this.groupFlocks;
    this.viewMode = "flock";
    const activeUids = this.groupFlocks
      .filter((g) => !g._isPast)
      .map((g) => g._uid);
    this.selectedFlockIds = activeUids.length
      ? activeUids
      : this.groupFlocks.map((g) => g._uid);
  }

  // ===== برچسب «گذشته» + پرچم/آمار حالت گذشته =====
  _markPastChips() {
    this.hasActiveFlock = this.hallFlocks.some((u) => !u._isPast);
    this.hasPastFlocks = this.hallFlocks.some((u) => u._isPast);

    this.hallFlocks.forEach((u) => {
      if (u._isPast && u._chipLabel && !u._chipLabel.includes("گذشته")) {
        u._chipLabel += " ⏸ گذشته";
      }
    });
    this.groupFlocks.forEach((g) => {
      g._isPast =
        Array.isArray(g._memberUids) &&
        g._memberUids.length > 0 &&
        g._memberUids.every((uid) => {
          const m = this.hallFlocks.find((h) => h._uid === uid);
          return !!m && !!m._isPast;
        });
      if (g._isPast && g._chipLabel && !g._chipLabel.includes("گذشته")) {
        g._chipLabel += " ⏸ گذشته";
      }
    });
  }

  // ===== آیا سری انتخاب‌شده روی نمودار متعلق به گلهٔ گذشته است؟ =====
  _hasSelectedPast() {
    const sel = new Set((this.selectedFlockIds || []).map(String));
    const units =
      this.viewMode === "hall" ? this.hallFlocks : this.groupFlocks;
    return units.some((u) => sel.has(String(u._uid)) && u._isPast);
  }

  // ===== نمایش/پنهان‌کردن بنر زرد «دادهٔ گذشته» بدون بازسازی کامل صفحه =====
  refreshPastBanner() {
    const show = this._hasSelectedPast();
    document.querySelectorAll(".analysis-past-banner").forEach((el) => {
      el.style.display = show ? "" : "none";
    });
  }

  // ===== تاگل «نمایش گله‌های گذشته» =====
  async togglePastMode(checked) {
    this.includePast = !!checked;
    try {
      if (this.includePast) {
        const resAll = await chartDashboardApi.getAnalysis(
          this.customerId,
          "all",
        );
        if (!resAll.success)
          throw new Error(resAll.message || "خطا در دریافت گله‌های گذشته");

        const prevSelected = new Set(
          (this.selectedFlockIds || []).map(String),
        );
        this.flocks = this._buildFlocksFromRaw(resAll.data.flocks || []);
        this._refreshViewMeta();

        // حفظ انتخاب‌های قبلی (معمولاً فعال‌ها)؛ گله‌های جدید گذشته خودبه‌خود انتخاب نمی‌شوند
        const keep = this.groupFlocks
          .filter((g) => prevSelected.has(String(g._uid)))
          .map((g) => g._uid);
        this.selectedFlockIds =
          keep.length > 0
            ? keep
            : this.groupFlocks
                .filter((g) => !g._isPast)
                .map((g) => g._uid);
        this.activeUnits = this.groupFlocks;
      } else {
        // برگشت به حالت عادی (اگر فعالی نبود، loadData خودش حالت گذشته را دوباره فعال می‌کند)
        await this.loadData();
        return;
      }
      this.destroyCharts();
      this.rerenderCharts();
    } catch (error) {
      this.includePast = false;
      console.error("❌ Error toggling past mode:", error);
      notificationService.error("خطا در بارگذاری گله‌های گذشته");
      this.destroyCharts();
      this.rerenderCharts();
    }
  }

  // ===== محاسبه سری شاخص‌ها برای یک گله (بر اساس فرمول‌های هفتگی) =====
  computeSeries(flock) {
    const weeks = [...(flock.weeks || [])].sort(
      (a, b) => (a.week_number || 0) - (b.week_number || 0),
    );
    const standards = flock.standards || [];
    const initialChicks = parseFloat(flock.flock.totalChicks) || 0;
    const initialWeightKg = getInitialWeightKg(flock.flock.avgInitialWeightGrams);

    const weightMap = {};
    const feedMap = {};
    const mortalityMap = {};
    weeks.forEach((w) => {
      const v = parseFloat(w.weekly_weight);
      weightMap[w.week_number] = isNaN(v) ? null : v;
      const f = parseFloat(w.weekly_feed_intake);
      feedMap[w.week_number] = isNaN(f) ? null : f;
      mortalityMap[w.week_number] = parseInt(w.weekly_mortality) || 0;
    });

    return weeks.map((w) => {
      const wn = w.week_number;
      const weight = weightMap[wn];
      const std = findStandard(standards, wn);
      const gain = weeklyGain(weightMap, wn, initialWeightKg);
      const dGain = dailyGain(weightMap, wn, initialWeightKg);
      const birdsStart = birdsStartOfWeek(initialChicks, mortalityMap, wn);
      const birdsEnd = birdsEndOfWeek(initialChicks, mortalityMap, wn);
      const stdGain = standardWeeklyGain(standards, wn, initialWeightKg);

      return {
        week: wn,
        weekStart: w.week_start_date,
        weekEnd: w.week_end_date,
        ageDays: w.flock_age_days,
        weight,
        weightGain: gain,
        dailyGainGrams: dGain !== null ? dGain * 1000 : null,
        totalLiveWeight:
          weight !== null && birdsEnd > 0 ? weight * birdsEnd : null,
        totalWeightGain:
          weight !== null && birdsEnd > 0
            ? (weight - initialWeightKg) * birdsEnd
            : null,
        fcr: fcrUpToWeek(
          weightMap,
          feedMap,
          mortalityMap,
          initialChicks,
          wn,
        ),
        mortalityCount: parseInt(w.weekly_mortality) || 0,
        mortalityPctWeekly: weeklyMortalityPercent(
          initialChicks,
          mortalityMap,
          wn,
        ),
        mortalityPctTotal: totalMortalityPercent(
          initialChicks,
          mortalityMap,
          wn,
        ),
        survivalPctWeekly:
          birdsStart > 0 ? (birdsEnd / birdsStart) * 100 : null,
        survivalPctCumulative:
          initialChicks > 0 ? (birdsEnd / initialChicks) * 100 : null,
        blackoutHours: parseFloat(w.blackout_hours) || 0,
        stdWeight:
          std && std.target_weight != null
            ? parseFloat(std.target_weight)
            : null,
        stdMin: std && std.min_weight != null ? parseFloat(std.min_weight) : null,
        stdMax: std && std.max_weight != null ? parseFloat(std.max_weight) : null,
        stdGain,
        stdDailyGainGrams: stdGain !== null ? (stdGain / 7) * 1000 : null,
        stdFcr:
          std && std.standard_fcr != null
            ? parseFloat(std.standard_fcr)
            : null,
      };
    });
  }

  // ===== ابزارهای کمکی =====
  getWeekLabels() {
    const arr = [];
    for (let w = 1; w <= this.weekCount; w++) arr.push(`هفته ${w}`);
    return arr;
  }

  getFlockDataByWeek(flock, key) {
    const map = {};
    (flock.series || []).forEach((s) => {
      map[s.week] = s[key];
    });
    const arr = [];
    for (let w = 1; w <= this.weekCount; w++) {
      arr.push(map[w] !== undefined ? map[w] : null);
    }
    return arr;
  }

  getSelectedFlocks() {
    return this.activeUnits.filter((f) =>
      this.selectedFlockIds.includes(this.flockUid(f)),
    );
  }

  flockLabel(f) {
    return this._displayOf(f);
  }

  // ===== تنظیمات سری‌های نمودار اصلی =====
  getLineDash(type, fallback = []) {
    if (type === "dashed") return [6, 4];
    if (type === "dotted") return [2, 3];
    if (type === "solid") return [];
    return fallback;
  }

  ensureSeriesItem(key, label, defaultColor, defaultLineType) {
    if (!this.seriesSettings[key]) {
      this.seriesSettings[key] = {
        visible: true,
        color: defaultColor,
        lineType: defaultLineType,
      };
    }
    const s = this.seriesSettings[key];
    return {
      key,
      label,
      visible: s.visible !== false,
      color: s.color || defaultColor,
      lineType: s.lineType || defaultLineType,
    };
  }

  collectMainSeries() {
    const items = [];
    this.getSelectedFlocks().forEach((f) => {
      const uid = this.flockUid(f);
      const label = this.flockLabel(f);
      items.push(
        this.ensureSeriesItem(`flock:${uid}:actual`, label, f.color, "solid"),
      );
      if (this.showStandards) {
        items.push(
          this.ensureSeriesItem(
            `flock:${uid}:max`,
            `${label} (حداکثر)`,
            f.color,
            "dashed",
          ),
        );
        items.push(
          this.ensureSeriesItem(
            `flock:${uid}:min`,
            `${label} (حداقل)`,
            f.color,
            "dashed",
          ),
        );
      }
    });
    // سریهای مقایسه سایر مشتریان
    this.compareUnits.forEach((cu) => {
      items.push(
        this.ensureSeriesItem(
          `cmp:${cu._uid}:actual`,
          cu.label || cu._chipLabel || "سری مقایسه",
          cu.color,
          "dotted",
        ),
      );
    });
    return items;
  }

  renderMainSeriesControls() {
    chartDashboardRenderer.renderSeriesControls(this.collectMainSeries());
  }

  toggleSeries(key, checked) {
    if (!this.seriesSettings[key]) return;
    this.seriesSettings[key].visible = checked;
    this.renderAllCharts();
  }

  setSeriesColor(key, color) {
    if (!this.seriesSettings[key]) return;
    this.seriesSettings[key].color = color;
    this.renderAllCharts();
  }

  setSeriesLineType(key, type) {
    if (!this.seriesSettings[key]) return;
    this.seriesSettings[key].lineType = type;
    this.renderAllCharts();
  }

  // ===== ساخت دیتاست گله‌ها برای یک شاخص =====
  buildFlockDatasets(flocks, key, opts = {}) {
    const datasets = [];
    flocks.forEach((f) => {
      const color = f.color;
      const label = this.flockLabel(f);
      const useSettings = opts.useSeriesSettings === true;

      // سری اصلی (مقدار واقعی)
      const uid = this.flockUid(f);
      const actualKey = `flock:${uid}:actual`;
      const sActual = useSettings ? this.seriesSettings[actualKey] : null;
      if (useSettings && sActual && sActual.visible === false) return;

      const actualColor = (useSettings && sActual?.color) || color;
      const actualDash = useSettings
        ? this.getLineDash(sActual?.lineType, [])
        : [];

      datasets.push({
        label,
        data: this.getFlockDataByWeek(f, key),
        borderColor: actualColor,
        borderDash: actualDash,
        backgroundColor: actualColor + "22",
        fill: opts.fill === true,
        tension: 0.3,
        borderWidth: this.lineWidth,
        pointRadius: this.pointSize,
      });

      if (opts.stdKey && this.showStandards) {
        // خط میانگین استاندارد (اختیاری — در نمودار اصلی حذف شده است)
        if (opts.showMeanLine !== false) {
          const stdKey = `flock:${uid}:std`;
          const sStd = useSettings ? this.seriesSettings[stdKey] : null;
          if (!(useSettings && sStd && sStd.visible === false)) {
            const stdColor = (useSettings && sStd?.color) || color;
            datasets.push({
              label: `${label} (میانگین استاندارد)`,
              data: this.getFlockDataByWeek(f, opts.stdKey),
              borderColor: stdColor,
              borderDash: useSettings
                ? this.getLineDash(sStd?.lineType, [6, 4])
                : [6, 4],
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
            });
          }
        }

        if (opts.bandKey) {
          // هاله‌ی بازه استاندارد (حداکثر ← حداقل)
          const maxKey = `flock:${uid}:max`;
          const minKey = `flock:${uid}:min`;
          const sMax = useSettings ? this.seriesSettings[maxKey] : null;
          const sMin = useSettings ? this.seriesSettings[minKey] : null;
          const maxVisible = !(useSettings && sMax && sMax.visible === false);
          const minVisible = !(useSettings && sMin && sMin.visible === false);

          if (maxVisible) {
            const maxColor = (useSettings && sMax?.color) || color;
            datasets.push({
              label: `${label} (حداکثر)`,
              data: this.getFlockDataByWeek(f, opts.bandKey.max),
              borderColor: maxColor,
              borderDash: useSettings
                ? this.getLineDash(sMax?.lineType, [3, 3])
                : [3, 3],
              borderWidth: 1,
              pointRadius: 0,
              fill: minVisible ? "+1" : false,
              backgroundColor: maxColor + "18",
            });
          }
          if (minVisible) {
            datasets.push({
              label: `${label} (حداقل)`,
              data: this.getFlockDataByWeek(f, opts.bandKey.min),
              borderColor: (useSettings && sMin?.color) || color,
              borderDash: useSettings
                ? this.getLineDash(sMin?.lineType, [3, 3])
                : [3, 3],
              borderWidth: 1,
              pointRadius: 0,
              fill: false,
              backgroundColor: "transparent",
            });
          }
        }
      }
    });
    return datasets;
  }

  // ===== ساخت کانفیگ پایه =====
  baseOptions(yLabel, extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: this.showTooltip,
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(15,23,42,0.92)",
          titleFont: { family: "Vazir", size: 12 },
          bodyFont: { family: "Vazir", size: 11 },
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              const unit = extra.tooltipUnit || "";
              if (val === null || val === undefined) {
                return `${ctx.dataset.label}: —`;
              }
              return `${ctx.dataset.label}: ${Number(val).toLocaleString("fa-IR", {
                maximumFractionDigits: 2,
              })}${unit}`;
            },
          },
          ...(extra.tooltip || {}),
        },
        datalabels: {
          display: false,
          ...(extra.datalabels || {}),
        },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true, speed: 0.05 },
            pinch: { enabled: true },
            mode: "x",
          },
        },
        // ✅ پس‌زمینه‌ی سفید بوم (هم در صفحه هم در خروجی دانلود)
        background: { color: "#ffffff" },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: yLabel,
            font: { family: "Vazir", size: 11 },
          },
          grid: { color: "#f1f5f9" },
        },
        x: { grid: { display: false } },
      },
    };
  }

  // ===== رندر یک نمودار =====
  renderChart(id, datasets, labels, yLabel, chartType = "line", extra = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (this.chartInstances[id]) {
      try {
        this.chartInstances[id].destroy();
      } catch (e) {}
    }
    const ctx = canvas.getContext("2d");
    this.chartInstances[id] = new Chart(ctx, {
      type: chartType,
      data: { labels, datasets },
      options: this.baseOptions(yLabel, extra),
      plugins:
        typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : [],
    });

    // لِجند چک‌باکسی کنار نمودار
    this.renderChartLegend(id, datasets);
  }

  // ===== لِجند چک‌باکسی کنار نمودار =====
  renderChartLegend(id, datasets) {
    const container = document.getElementById(`${id}Legend`);
    if (!container || !datasets) return;

    container.innerHTML = datasets
      .map((ds, i) => {
        const color = ds.borderColor || ds.backgroundColor || "#64748b";
        return `
            <label class="chart-legend-row">
                <input type="checkbox" class="legend-check" checked
                       onchange="chartDashboardService.toggleDataset('${id}', ${i}, this.checked)">
                <span class="legend-color" style="background:${color}"></span>
                <span class="legend-label">${ds.label}</span>
            </label>`;
      })
      .join("");
  }

  toggleDataset(chartId, index, checked) {
    const chart = this.chartInstances[chartId];
    if (!chart) return;
    try {
      chart.setDatasetVisibility(index, checked);
      chart.update();
    } catch (e) {}
  }

  // ===== رندر همه نمودارها =====
  renderAllCharts() {
    const selected = this.getSelectedFlocks();
    const labels = this.getWeekLabels();
    const main = MAIN_INDICATORS[this.mainIndicator];

    const titleEl = document.getElementById("mainChartTitle");
    if (titleEl) titleEl.textContent = main.title;

    const chartType =
      document.getElementById("mainChartType")?.value || "line";

    // نمودار داینامیک اصلی (با استاندارد + بازه)
    const mainDatasets = this.buildFlockDatasets(selected, main.key, {
      stdKey: main.stdKey,
      bandKey: { min: "stdMin", max: "stdMax" },
      useSeriesSettings: true,
      showMeanLine: false, // خط میانگین استاندارد از نمودار اصلی حذف شده است
    });
    // سریهای مقایسه سایر مشتریان روی همه نمودارهای صفحه
    mainDatasets.push(...this.buildCompareDatasets(main.key));
    this.renderChart(
      "mainChart",
      mainDatasets,
      labels,
      main.yLabel,
      chartType,
      {
        tooltipUnit: ` ${main.unit}`,
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: (items) =>
              items && items.length
                ? `هفته ${Number(items[0].dataIndex + 1).toLocaleString("fa-IR")}`
                : "",
            label: (ctx) => {
              const val = ctx.raw;
              if (val === null || val === undefined)
                return `${ctx.dataset.label}: —`;
              return `${ctx.dataset.label}: ${Number(val).toLocaleString("fa-IR", {
                maximumFractionDigits: main.decimals,
              })} ${main.unit}`;
            },
            afterBody: (items) => {
              if (!items || !items.length) return [];
              if (!this.showStandards) return [];
              const weekNo = items[0].dataIndex + 1;
              const lines = [];
              this.getSelectedFlocks().forEach((f) => {
                const s = (f.series || []).find((x) => x.week === weekNo);
                if (!s) return;
                const stdVal = s[main.stdKey];
                if (stdVal === null || stdVal === undefined) return;
                const actual = s[main.key];
                let dev = "";
                if (actual !== null && actual !== undefined && stdVal !== 0) {
                  const diff = ((actual - stdVal) / stdVal) * 100;
                  dev = ` (${diff >= 0 ? "+" : ""}${Number(diff).toLocaleString("fa-IR", {
                    maximumFractionDigits: 1,
                  })}٪)`;
                }
                lines.push(
                  `استاندارد ${this.flockLabel(f)}: ${Number(stdVal).toLocaleString("fa-IR", {
                    maximumFractionDigits: main.decimals,
                  })} ${main.unit}${dev}`,
                );
              });
              return lines;
            },
          },
        },
        datalabels: this.showDataLabels
          ? {
              display: true,
              color: "#1e293b",
              font: { family: "Vazir", size: 9, weight: "bold" },
              anchor: "end",
              align: "top",
              formatter: (value) =>
                value === null || value === undefined
                  ? ""
                  : Number(value).toLocaleString("fa-IR", {
                      maximumFractionDigits: main.decimals,
                    }),
            }
          : {},
      },
    );

    // نمودارهای جداگانه
    this.renderChart(
      "totalWeightGainChart",
      this.withCompare(
        this.buildFlockDatasets(selected, "totalWeightGain"),
        "totalWeightGain",
      ),
      labels,
      "کیلوگرم",
      "line",
      { tooltipUnit: " کیلوگرم" },
    );
    this.renderChart(
      "totalLiveWeightChart",
      this.withCompare(
        this.buildFlockDatasets(selected, "totalLiveWeight"),
        "totalLiveWeight",
      ),
      labels,
      "کیلوگرم",
      "line",
      { tooltipUnit: " کیلوگرم" },
    );
    this.renderChart(
      "fcrChart",
      this.withCompare(
        this.buildFlockDatasets(selected, "fcr", { stdKey: "stdFcr" }),
        "fcr",
      ),
      labels,
      "FCR",
      "line",
      {
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: (items) =>
              items && items.length
                ? `هفته ${Number(items[0].dataIndex + 1).toLocaleString("fa-IR")}`
                : "",
            afterBody: (items) => {
              if (!items || !items.length) return [];
              if (!this.showStandards) return [];
              const weekNo = items[0].dataIndex + 1;
              const lines = [];
              this.getSelectedFlocks().forEach((f) => {
                const s = (f.series || []).find((x) => x.week === weekNo);
                if (!s || s.stdFcr === null || s.stdFcr === undefined) return;
                lines.push(
                  `FCR استاندارد ${this.flockLabel(f)}: ${Number(s.stdFcr).toLocaleString("fa-IR", {
                    maximumFractionDigits: 3,
                  })}`,
                );
              });
              return lines;
            },
          },
        },
      },
    );
    this.renderChart(
      "mortalityCountChart",
      this.withCompare(
        this.buildFlockDatasets(selected, "mortalityCount", { fill: true }),
        "mortalityCount",
      ),
      labels,
      "قطعه",
      "line",
      { tooltipUnit: " قطعه" },
    );

    const mortKey =
      this.mortalityMode === "total"
        ? "mortalityPctTotal"
        : "mortalityPctWeekly";
    this.renderChart(
      "mortalityPctChart",
      this.withCompare(this.buildFlockDatasets(selected, mortKey), mortKey),
      labels,
      "درصد",
      "line",
      { tooltipUnit: "٪" },
    );

    const survKey =
      this.survivalMode === "cumulative"
        ? "survivalPctCumulative"
        : "survivalPctWeekly";
    this.renderChart(
      "survivalPctChart",
      this.withCompare(
        this.buildFlockDatasets(selected, survKey),
        survKey,
      ),
      labels,
      "درصد",
      "line",
      { tooltipUnit: "٪" },
    );

    this.renderChart(
      "blackoutChart",
      this.withCompare(
        this.buildFlockDatasets(selected, "blackoutHours", { fill: true }),
        "blackoutHours",
      ),
      labels,
      "ساعت",
      "line",
      { tooltipUnit: " ساعت" },
    );

    // پنل نمایش و تنظیم سری‌های نمودار اصلی
    this.renderMainSeriesControls();
  }

  // ===== کنترل‌ها =====
  toggleFlock(id, checked) {
    const flockId = String(id);
    if (checked) {
      if (!this.selectedFlockIds.includes(flockId)) {
        this.selectedFlockIds.push(flockId);
      }
    } else {
      this.selectedFlockIds = this.selectedFlockIds.filter(
        (x) => String(x) !== flockId,
      );
    }
    this.renderAllCharts();
    this.refreshPastBanner();
  }

  selectAllFlocks(select) {
    this.selectedFlockIds = select
      ? this.activeUnits.map((f) => this.flockUid(f))
      : [];
    this.activeUnits.forEach((f) => {
      const cb = document.querySelector(
        `.analysis-flock-check input[value="${this.flockUid(f)}"]`,
      );
      if (cb) cb.checked = select;
    });
    this.renderAllCharts();
    this.refreshPastBanner();
  }

  setWeekRange(value) {
    const v = parseInt(value);
    if (!isNaN(v) && v >= 2) {
      this.weekCount = Math.min(v, 16);
      const input = document.getElementById("analysisWeekRange");
      if (input) input.value = this.weekCount;
      this.renderAllCharts();
    }
  }

  changeWeekRange(delta) {
    this.setWeekRange(String(this.weekCount + delta));
  }

  setMainIndicator(ind) {
    if (!MAIN_INDICATORS[ind]) return;
    this.mainIndicator = ind;
    document
      .querySelectorAll("#mainIndicatorTabs .analysis-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.ind === this.mainIndicator),
      );
    this.renderAllCharts();
  }

  setMortalityMode(mode) {
    this.mortalityMode = mode;
    document
      .querySelectorAll("#mortalityPctChartTabs .analysis-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === this.mortalityMode),
      );
    this.renderAllCharts();
  }

  setSurvivalMode(mode) {
    this.survivalMode = mode;
    document
      .querySelectorAll("#survivalPctChartTabs .analysis-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === this.survivalMode),
      );
    this.renderAllCharts();
  }

  updateMainSettings() {
    this.showStandards =
      document.getElementById("showStandards")?.checked ?? true;
    this.showDataLabels =
      document.getElementById("showDataLabels")?.checked ?? false;
    this.showTooltip =
      document.getElementById("showTooltip")?.checked ?? true;
    this.lineWidth =
      parseInt(document.getElementById("mainLineWidth")?.value) || 2;
    this.pointSize =
      parseInt(document.getElementById("mainPointSize")?.value) || 4;
    this.renderAllCharts();
  }

  // ===== اطلاعات هدر تصویر دانلودی =====
  getChartTitle(id) {
    const map = {
      mainChart: MAIN_INDICATORS[this.mainIndicator].title,
      totalWeightGainChart: "افزایش وزن کل گله (هفتگی)",
      totalLiveWeightChart: "وزن زنده کل گله (هفتگی)",
      fcrChart: "ضریب تبدیل هفتگی (FCR)",
      mortalityCountChart: "تلفات (قطعه) هفته به هفته",
      mortalityPctChart:
        this.mortalityMode === "total"
          ? "درصد تلفات (کل)"
          : "درصد تلفات (هفتگی)",
      survivalPctChart:
        this.survivalMode === "cumulative"
          ? "درصد زنده مانی (تجمعی)"
          : "درصد زنده مانی (هفتگی)",
      blackoutChart: "میزان خاموشی (ساعت)",
    };
    return map[id] || "نمودار";
  }

  getDownloadInfo(id) {
    let dateText = "—";
    try {
      dateText = new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date());
    } catch (e) {}

    let user = "—";
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      user =
        u.fullName ||
        u.full_name ||
        `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
        u.username ||
        "—";
    } catch (e) {}

    let customer = "—";
    if (this.flocks && this.flocks.length) {
      customer = this.flocks[0].flock.customerName || "—";
    }

    return { title: this.getChartTitle(id), date: dateText, user, customer };
  }

  downloadChart(id, format) {
    const canvas = document.getElementById(id);
    if (!canvas) {
      notificationService.error("نموداری برای دانلود وجود ندارد");
      return;
    }
    try {
      const chart = this.chartInstances[id];

      // پس‌زمینه‌ی سفید روی بوم اصلی (ضمانت)
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // بوم ترکیبی: هدر اطلاعات + نمودار
      const info = this.getDownloadInfo(id);
      const headerHeight = 118;
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height + headerHeight;
      const octx = out.getContext("2d");

      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, out.width, out.height);

      // عنوان نمودار
      octx.direction = "rtl";
      octx.textAlign = "right";
      octx.fillStyle = "#0f172a";
      octx.font = "700 17px Vazir";
      octx.fillText(info.title, out.width - 16, 30);

      // خط جداکننده
      octx.strokeStyle = "#e2e8f0";
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(16, 42);
      octx.lineTo(out.width - 16, 42);
      octx.stroke();

      // اطلاعات دانلود
      octx.fillStyle = "#475569";
      octx.font = "500 12px Vazir";
      octx.fillText(`تاریخ و ساعت دریافت: ${info.date}`, out.width - 16, 64);
      octx.fillText(`کاربر دریافت‌کننده: ${info.user}`, out.width - 16, 86);
      octx.fillText(`مشتری: ${info.customer}`, out.width - 16, 108);

      // رسم نمودار در پایین هدر
      octx.drawImage(canvas, 0, headerHeight);

      const now = new Date();
      const dateStr = now.toLocaleDateString("fa-IR").replace(/\//g, "-");
      const link = document.createElement("a");
      link.download = `نمودار_${id}_${dateStr}.${format}`;
      link.href = out.toDataURL(
        format === "jpg" ? "image/jpeg" : "image/png",
        format === "jpg" ? 0.95 : undefined,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // بازگردانی بوم به حالت تمیز
      if (chart && typeof chart.update === "function") {
        chart.update();
      }

      notificationService.success("✅ تصویر با موفقیت دانلود شد");
    } catch (error) {
      console.error("❌ Error downloading chart:", error);
      notificationService.error("خطا در دانلود تصویر");
    }
  }

  resetZoom(id) {
    const chart = this.chartInstances[id];
    if (chart && typeof chart.resetZoom === "function") {
      chart.resetZoom();
    }
  }

  destroyCharts() {
    Object.keys(this.chartInstances).forEach((key) => {
      try {
        this.chartInstances[key].destroy();
      } catch (e) {}
    });
    this.chartInstances = {};
  }

  refresh() {
    this.destroyCharts();
    this.loadData();
  }

  destroy() {
    this.destroyCharts();
  }
}

export const chartDashboardService = new ChartDashboardService();
if (typeof window !== "undefined") {
  window.chartDashboardService = chartDashboardService;
  window.ChartDashboardService = ChartDashboardService;
  window.loadAccordionState = () => {};
  window.openAllAccordion = () => {};
  window.closeAllAccordion = () => {};
}
