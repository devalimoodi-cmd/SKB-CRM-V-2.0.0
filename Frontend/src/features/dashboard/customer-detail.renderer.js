// ============================================================
// features/dashboard/customer-detail.renderer.js
// ساخت HTML مودال «جزئیات مشتری» (خلاصهٔ عملکرد)
// ------------------------------------------------------------
// چرا فایل جدا؟ توابع اینجا «خالص» هستند (فقط ورودی → رشتهٔ HTML)
// بنابراین بدون مرورگر/دیتابیس قابل تست‌اند (customer-detail-modal-test.mjs).
//
// ساختار مودال:
//   ① نوار KPI (گله‌ها / در پرورش / تکمیل‌شده / میانگین FCR / بقا / آخرین جوجه‌ریزی)
//   ② اطلاعات پایهٔ مشتری
//   ③ تب «گلهٔ جاری | گله‌های گذشته» + کارت هر گله (ریز سالن‌ها + پایان گله)
//   ④ جدول سابقهٔ سالن‌ها
// ============================================================

import { escapeHtml } from "../../core/utils/string.utils.js";
import { convertToPersianDate } from "../../core/utils/date.utils.js";

// ===== ابزارهای نمایش =====
const num = (value, digits = null) => {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "-";
  const fixed = digits === null ? n : Number(n.toFixed(digits));
  return fixed.toLocaleString("fa-IR");
};

const txt = (value) => {
  const s = value === null || value === undefined ? "" : String(value).trim();
  return s === "" ? "-" : escapeHtml(s);
};

const faDate = (value) => {
  if (!value) return "-";
  try {
    return escapeHtml(convertToPersianDate(value));
  } catch {
    return "-";
  }
};

const STATUS_LABELS = {
  active: { text: "🟢 در حال پرورش", cls: "is-active" },
  pending: { text: "⏳ در انتظار جوجه", cls: "is-active" },
  completed: { text: "✅ تکمیل‌شده", cls: "is-past" },
  cancelled: { text: "🚫 لغو‌شده", cls: "is-past" },
};

const statusOf = (status) =>
  STATUS_LABELS[String(status || "").toLowerCase()] || {
    text: "نامشخص",
    cls: "is-past",
  };

const isActiveFlock = (flock) =>
  ["active", "pending"].includes(String(flock?.status || "").toLowerCase());

// ============================================================
// ① نوار KPI
// ============================================================
const buildKpisHTML = (summary = {}) => {
  const fcr = summary.avgFcr;
  const cards = [
    {
      id: "flocks",
      label: "🧾 گله‌های پرورش",
      value: num(summary.flocksTotal, 0),
      sub: "از ابتدای همکاری",
      tone: "blue",
    },
    {
      id: "current",
      label: "🟢 گلهٔ در جریان",
      value: num(summary.flocksActive, 0),
      sub: "الان در پرورش",
      tone: "green",
    },
    {
      id: "completed",
      label: "✅ گلهٔ تمام‌شده",
      value: num(summary.flocksCompleted, 0),
      sub: "جمع‌آوری‌شده",
      tone: "slate",
    },
    {
      id: "fcr",
      label: "🍗 میانگین ضریب تبدیل (FCR)",
      value: fcr === null || fcr === undefined ? "-" : num(fcr, 2),
      sub: "خوراک ÷ (وزن × مرغ)",
      tone: "amber",
    },
    {
      id: "survival",
      label: "🐣 میانگین بقای گله",
      value:
        summary.survivalRate === null || summary.survivalRate === undefined
          ? "-"
          : `${num(summary.survivalRate, 1)}٪`,
      sub: `تلفات کل: ${num(summary.mortalityRate, 2)}٪`,
      tone: "teal",
    },
    {
      id: "last",
      label: "📅 آخرین جوجه‌ریزی",
      value: summary.lastPlacementDate
        ? escapeHtml(convertToPersianDate(summary.lastPlacementDate))
        : "-",
      sub: `${num(summary.totalChicks, 0)} قطعه در کل پرونده`,
      tone: "violet",
    },
  ];

  return `
    <h4 class="cd-kpi-title">📊 خلاصهٔ عملکرد کل پرونده</h4>
    <div class="cd-kpi-grid">
      ${cards
        .map(
          (c) => `
        <div class="cd-kpi cd-kpi-${c.tone}" data-cd-kpi="${c.id}">
          <span class="cd-kpi-label">${c.label}</span>
          <span class="cd-kpi-value">${c.value}</span>
          <span class="cd-kpi-sub">${c.sub}</span>
        </div>`,
        )
        .join("")}
    </div>
  `;
};

// ============================================================
// ② اطلاعات پایه
// ============================================================
const buildBaseInfoHTML = (customer = {}, summary = {}) => {
  const rows = [
    ["نام مرغدار", txt(customer.fullName)],
    ["نام فارم", txt(customer.farmName)],
    ["تلفن", txt(customer.phone)],
    ["نوع مشتری", txt(customer.customerType)],
    ["کد ملی", txt(customer.nationalCode)],
    ["استان / شهرستان", `${txt(customer.province)} / ${txt(customer.county)}`],
    ["آدرس فارم", txt(customer.address)],
    [
      "واحد / سالن",
      `${num(summary.unitsCount, 0)} واحد · ${num(summary.hallsCount, 0)} سالن`,
    ],
  ];

  return `
    <section class="cd-section">
      <h4 class="cd-section-title">👤 مشخصات مرغدار و فارم</h4>
      <div class="cd-grid">
        ${rows
          .map(
            ([label, value]) => `
          <div class="cd-field">
            <span class="cd-field-label">${label}</span>
            <span class="cd-field-value">${value}</span>
          </div>`,
          )
          .join("")}
      </div>
    </section>
  `;
};

// ============================================================
// ①.۵ خلاصهٔ اقتصادی (فقط اگر مجوز جوجه‌ریزی داشته باشد)
// ============================================================
const buildEconomicsHTML = (economics) => {
  if (!economics) return "";

  const trend = Array.isArray(economics.fcrTrend) ? economics.fcrTrend : [];

  return `
    <section class="cd-section cd-econ">
      <h4 class="cd-section-title">💰 سود و زیان کل پرونده (${num(economics.completedFlocks, 0)} گلهٔ تمام‌شده)</h4>
      <div class="cd-econ-grid">
        <div class="cd-econ-card">
          <span class="cd-econ-label">درآمد کل</span>
          <span class="cd-econ-value">${num(economics.totalIncome, 0)}</span>
        </div>
        <div class="cd-econ-card">
          <span class="cd-econ-label">جمع هزینه‌ها</span>
          <span class="cd-econ-value">${num(economics.totalCost, 0)}</span>
        </div>
        <div class="cd-econ-card ${
          Number(economics.totalProfit) >= 0 ? "cd-profit" : "cd-loss"
        }">
          <span class="cd-econ-label">سود خالص</span>
          <span class="cd-econ-value">${num(economics.totalProfit, 0)}</span>
        </div>
        <div class="cd-econ-card">
          <span class="cd-econ-label">درصد سود</span>
          <span class="cd-econ-value">${
            economics.avgProfitPercent === null
              ? "-"
              : `${num(economics.avgProfitPercent, 1)}٪`
          }</span>
        </div>
      </div>
      ${
        trend.length
          ? `
        <div class="cd-trend">
          <span class="cd-trend-label">روند FCR سه گلهٔ آخر:</span>
          ${trend
            .map((t) => {
              const arrow = t.fcr <= 1.9 ? "↘︎" : "↗︎";
              return `<span class="cd-trend-chip" title="گلهٔ ${txt(t.flockNumber)}">گلهٔ ${txt(
                t.flockNumber,
              )}: <strong>${num(t.fcr, 2)}</strong> ${arrow}</span>`;
            })
            .join("")}
        </div>`
          : ""
      }
      ${buildByHallEconomicsHTML(economics)}
    </section>
  `;
};

// ============================================================
// «سهم هر سالن از سود کل پرونده» (جمع همهٔ گله‌های تمام‌شده)
// ============================================================
const buildByHallEconomicsHTML = (economics = {}) => {
  const rows = Array.isArray(economics.byHall) ? economics.byHall : [];
  if (!rows.length) return "";

  return `
    <div class="cd-econ-block cd-econ-block-flat">
      <div class="cd-econ-head">
        <span class="cd-econ-title">🏭 سود و زیان به تفکیک سالن (جمع همهٔ گله‌ها)</span>
      </div>
      <div class="cd-table-wrap">
        <table class="cd-table cd-table-econ">
          <thead>
            <tr>
              <th>سالن</th>
              <th>تعداد گله</th>
              <th>درآمد</th>
              <th>جمع هزینه</th>
              <th>سود / زیان</th>
              <th>٪سود</th>
              <th>سهم از سود کل</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((hall) => {
                const loss = Number(hall.profit) < 0;
                const tone = loss ? "cd-td-loss" : "cd-td-profit";
                return `
              <tr>
                <td class="cd-td-name">${txt(hall.hallName)}</td>
                <td>${num(hall.flocksCount, 0)}</td>
                <td>${num(hall.income, 0)}</td>
                <td>${num(hall.totalCost, 0)}</td>
                <td class="${tone}">${num(hall.profit, 0)}</td>
                <td class="${tone}">${
                  hall.profitPercent === null
                    ? "-"
                    : `${num(hall.profitPercent, 2)}٪`
                }</td>
                <td>${
                  hall.shareOfTotalProfit === null
                    ? "-"
                    : `${num(hall.shareOfTotalProfit, 1)}٪`
                }</td>
              </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="cd-econ-foot">سهم از سود کل، فقط وقتی کل پرونده سودده باشد معنا دارد؛ در حالت زیانده با «-» نمایش داده می‌شود.</div>
    </div>
  `;
};

// ============================================================
// کارت «پایان گله» (شاخص‌های نهایی ثبت‌شده)
// ============================================================
const buildCompletionHTML = (completion) => {
  if (!completion) return "";

  const items = [
    ["FCR نهایی", completion.fcr ?? completion.systemFcr, 2],
    ["EPI", completion.epi ?? completion.systemEpi, 1],
    ["ADG (گرم/روز)", completion.adgGrams ?? completion.systemAdgGrams, 1],
    ["بقا٪", completion.survivalPercent, 1],
    ["سن کشتار", completion.slaughterAgeDays, 0],
    ["وزن میانگین (kg)", completion.avgLiveWeight, 2],
    ["تلفات حمل", completion.transportMortality, 0],
  ].filter(([, value]) => value !== null && value !== undefined);

  if (!items.length) return "";

  return `
    <div class="cd-completion">
      <span class="cd-completion-title">✅ نتیجهٔ پایان گله (ثبت‌شده)</span>
      <div class="cd-completion-grid">
        ${items
          .map(
            ([label, value, digits]) => `
          <span class="cd-completion-item">
            <span class="cd-completion-label">${label}</span>
            <strong>${num(value, digits)}</strong>
          </span>`,
          )
          .join("")}
      </div>
    </div>
  `;
};

// ============================================================
// ③ کارت گله‌ها + تب‌ها
// ============================================================
const buildFlockCard = (flock, focus) => {
  const status = statusOf(flock.status);
  const kpi = flock.kpi || {};
  const focusHit = focus && focus.flockKey === flock.key;

  const title = flock.singleHall
    ? `گلهٔ تک‌سالنه${flock.flockNumber ? ` #${escapeHtml(flock.flockNumber)}` : ""}`
    : `گله #${txt(flock.flockNumber)}`;

  const meta = [
    flock.unitName ? `واحد ${txt(flock.unitName)}` : "",
    flock.startDate ? `شروع ${faDate(flock.startDate)}` : "",
    flock.endDate ? `پایان ${faDate(flock.endDate)}` : "",
    kpi.ageDays ? `${num(kpi.ageDays, 0)} روز` : "",
    `${num(flock.halls?.length || 0, 0)} سالن`,
  ]
    .filter(Boolean)
    .map((m) => `<span class="cd-flock-meta-item">${m}</span>`)
    .join("");

  const chips = [
    [
      "جوجهٔ اولیه ← مانده",
      `${num(kpi.initialChicks, 0)} ← ${num(kpi.finalChicks, 0)}`,
      "",
    ],
    [
      "تلفات (قطعه و درصد)",
      `${num(kpi.totalMortality, 0)} (${num(kpi.mortalityRate, 2)}٪)`,
      "cd-chip-danger",
    ],
    ["خوراک مصرفی کل", `${num(kpi.totalFeed, 0)} kg`, ""],
    [
      "آخرین وزن ثبت‌شده",
      kpi.lastWeight ? `${num(kpi.lastWeight, 3)} kg` : "-",
      "",
    ],
    [
      "ضریب تبدیل (FCR)",
      kpi.fcr === null || kpi.fcr === undefined ? "-" : num(kpi.fcr, 2),
      "cd-chip-fcr",
    ],
    ["بقای گله", `${num(kpi.survivalRate, 1)}٪`, "cd-chip-ok"],
  ];

  const hallRows = (flock.halls || [])
    .map(
      (hall) => `
      <tr class="${focus && focus.placementId === hall.placementId ? "cd-row-focus" : ""}">
        <td class="cd-td-name">${txt(hall.hallName)}</td>
        <td>${num(hall.chicks, 0)}</td>
        <td>${num(hall.finalChicks, 0)}</td>
        <td class="${hall.mortalityRate > 5 ? "cd-td-danger" : ""}">${num(hall.mortalityRate, 2)}٪</td>
        <td>${num(hall.feed, 0)}</td>
        <td>${hall.lastWeight ? num(hall.lastWeight, 3) : "-"}</td>
        <td class="cd-td-fcr">${hall.fcr === null || hall.fcr === undefined ? "-" : num(hall.fcr, 2)}</td>
        <td>${num(hall.weeksCount, 0)}</td>
      </tr>`,
    )
    .join("");

  const placementIds = (flock.halls || [])
    .filter((h) => h.hasWeeklyData)
    .map((h) => h.placementId)
    .join(",");

  return `
    <article class="cd-flock ${status.cls} ${focusHit ? "cd-flock-focus" : ""}" data-cd-flock="${escapeHtml(flock.key)}">
      <header class="cd-flock-head">
        <span class="cd-flock-title">${title}</span>
        <span class="cd-badge">${status.text}</span>
        <span class="cd-flock-meta">${meta}</span>
      </header>

      <div class="cd-chips">
        ${chips
          .map(
            ([label, value, cls]) => `
          <span class="cd-chip ${cls}">
            <span class="cd-chip-label">${label}</span>
            <strong>${value}</strong>
          </span>`,
          )
          .join("")}
      </div>

      ${
        hallRows
          ? `
        <div class="cd-table-wrap">
          <table class="cd-table">
            <thead>
              <tr>
                <th>سالن</th>
                <th>جوجهٔ اولیه</th>
                <th>مانده</th>
                <th>تلفات٪</th>
                <th>خوراک (kg)</th>
                <th>وزن آخر (kg)</th>
                <th>FCR</th>
                <th>هفتهٔ ثبت‌شده</th>
              </tr>
            </thead>
            <tbody>${hallRows}</tbody>
          </table>
        </div>`
          : '<div class="cd-empty">سالنی برای این گله ثبت نشده است</div>'
      }

      ${buildFlockChartsHTML(flock)}

      ${buildCompletionHTML(flock.completion)}

      ${buildFlockEconomicsHTML(flock)}

      ${
        placementIds
          ? `
        <button type="button" class="cd-weeks-toggle"
                data-cd-weeks="${escapeHtml(placementIds)}"
                onclick="window.toggleCustomerDetailWeeks(this)">
          <i class="fas fa-chart-line"></i> مشاهدهٔ گزارش هفتگی این گله
          <span class="cd-weeks-hint">(${num(kpi.weeksCount, 0)} هفته ثبت‌شده)</span>
        </button>
        <div class="cd-weeks-wrap" hidden></div>`
          : '<div class="cd-empty cd-empty-soft">برای این گله دادهٔ هفتگی ثبت نشده است</div>'
      }
    </article>
  `;
};

const buildFlocksHTML = (flocks = [], focus = null) => {
  const subtitle =
    '<p class="cd-section-sub">هر گله = جوجه‌ریزی هم‌زمانِ سالن‌های یک واحد؛ شامل سالن‌های عضو، شاخص‌های هفتگی و نتیجهٔ پایان گله.</p>';

  if (!flocks.length) {
    return `
      <section class="cd-section">
        <h4 class="cd-section-title">🧾 تاریخچهٔ گله‌های پرورش (0)</h4>
        ${subtitle}
        <div class="cd-empty">هیچ گلهٔ پرورشی برای این مرغدار ثبت نشده است</div>
      </section>
    `;
  }

  const activeFlocks = flocks.filter(isActiveFlock);
  const pastFlocks = flocks.filter((p) => !isActiveFlock(p));

  const panels = [
    { id: "active", title: "🟢 گله‌های در جریان", list: activeFlocks },
    { id: "past", title: "🕘 گله‌های تمام‌شده", list: pastFlocks },
  ].filter((panel) => panel.list.length > 0);

  // تب پیش‌فرض: اگر گلهٔ جاری هست «جاری» وگرنه «گذشته»
  const focusFlock = focus
    ? flocks.find((p) => p.key === focus.flockKey)
    : null;
  const defaultTab = focusFlock
    ? isActiveFlock(focusFlock)
      ? "active"
      : "past"
    : activeFlocks.length
      ? "active"
      : "past";

  const tabs = panels
    .map(
      (panel) => `
      <button type="button" class="cd-tab ${
        panel.id === defaultTab ? "cd-tab-active" : ""
      }" data-cd-tab="${panel.id}"
              onclick="window.switchCustomerDetailTab('${panel.id}')">
        ${panel.title} <span class="cd-tab-count">${num(panel.list.length, 0)}</span>
      </button>`,
    )
    .join("");

  const bodies = panels
    .map(
      (panel) => `
      <div class="cd-tab-panel" data-cd-panel="${panel.id}" ${
        panel.id === defaultTab ? "" : "hidden"
      }>
        ${panel.list.map((flock) => buildFlockCard(flock, focus)).join("")}
      </div>`,
    )
    .join("");

  return `
    <section class="cd-section">
      <h4 class="cd-section-title">🧾 تاریخچهٔ گله‌های پرورش (${num(flocks.length, 0)})</h4>
      ${subtitle}
      <div class="cd-tabs">${tabs}</div>
      ${bodies}
    </section>
  `;
};

// ============================================================
// کارت‌های نمودار روند هفتگی گله (وزن · ضریب تبدیل تجمعی · تلفات)
// ------------------------------------------------------------
// • هر کارت: نوار رنگی بالا (sheet) + نمودار با **ابعاد ثابت** + عنوان
//   + مقدار جاری + تغییر نسبت به هفتهٔ قبل + پاصفحهٔ «آخرین ثبت: تاریخ»
// • ⚠️ canvas ها بعد از درج HTML توسط dashboard.service.js ساخته می‌شوند.
//   ظرف نمودار ارتفاع ثابت دارد تا Chart.js مودال را به‌هم نریزد.
// ============================================================
const FLOCK_CHART_CARDS = [
  {
    key: "weight",
    title: "وزن هفتگی گله",
    unit: "kg",
    digits: 3,
    tone: "sky",
    icon: "fa-weight-hanging",
    better: "up",
  },
  {
    key: "fcr",
    title: "ضریب تبدیل تجمعی (FCR)",
    unit: "",
    digits: 2,
    tone: "amber",
    icon: "fa-utensils",
    better: "down",
  },
  {
    key: "mortality",
    title: "تلفات هفتگی",
    unit: "قطعه",
    digits: 0,
    tone: "rose",
    icon: "fa-skull",
    better: "down",
  },
];

// ============================================================
// خلاصهٔ آماری یک سری (برای ردیف جزئیات کارت نمودار)
// تابع خالص ⇒ بدون مرورگر قابل تست است
// ============================================================
const roundTo = (value, digits = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Number(n.toFixed(Math.max(0, digits)));
};

const summarizeTrend = (values = [], digits = 0) => {
  const numbers = (Array.isArray(values) ? values : [])
    .map((value) =>
      value === null || value === undefined ? null : Number(value),
    )
    .filter((value) => value !== null && Number.isFinite(value));

  if (!numbers.length) return null;

  return {
    count: numbers.length,
    min: roundTo(Math.min(...numbers), digits),
    max: roundTo(Math.max(...numbers), digits),
    avg: roundTo(
      numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
      digits,
    ),
    last: roundTo(numbers[numbers.length - 1], digits),
  };
};

const buildFlockChartCardHTML = (card, trend) => {
  const series = Array.isArray(trend[card.key]) ? trend[card.key] : [];
  const points = series
    .map((value, index) => ({
      value: value === null || value === undefined ? null : Number(value),
      index,
    }))
    .filter((point) => point.value !== null && Number.isFinite(point.value));

  if (!points.length) return "";

  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const delta = prev ? last.value - prev.value : null;

  const improved =
    delta === null
      ? null
      : card.better === "up"
        ? delta > 0
        : delta < 0;
  const deltaClass =
    delta === null || Math.abs(delta) < 0.0001
      ? "is-flat"
      : improved
        ? "is-good"
        : "is-bad";
  const deltaArrow =
    delta === null ? "•" : delta > 0 ? "▲" : delta < 0 ? "▼" : "•";
  const deltaText =
    delta === null
      ? "بدون دادهٔ قبلی"
      : `${deltaArrow} ${num(Math.abs(delta), card.digits)}`;

  const weekNumber = trend.weeks?.[last.index] ?? last.index + 1;
  const lastDate = Array.isArray(trend.dates) ? trend.dates[last.index] : null;
  const stats = summarizeTrend(series, card.digits);

  // توضیح برای صفحه‌خوان‌ها (canvas متنی ندارد)
  const ariaLabel = stats
    ? `${card.title}: کمینه ${num(stats.min, card.digits)}، بیشینه ${num(
        stats.max,
        card.digits,
      )}، میانگین ${num(stats.avg, card.digits)}، آخرین مقدار ${num(
        last.value,
        card.digits,
      )}${card.unit ? ` ${card.unit}` : ""}`
    : card.title;

  return `
      <article class="cd-chart-card cd-chart-card-${card.tone}"
               data-cd-chart-card="${card.key}">
        <div class="cd-chart-sheet">
          <div class="cd-chart-box">
            <canvas class="cd-chart-canvas" data-cd-chart="${card.key}"
                    data-cd-color="#ffffff" data-cd-labels="all"
                    data-cd-digits="${card.digits}" data-cd-unit="${card.unit || ""}"
                    aria-label="${escapeHtml(ariaLabel)}" role="img"></canvas>
          </div>
        </div>
        <div class="cd-chart-body">
          <div class="cd-chart-title">
            <i class="fas ${card.icon}"></i> ${card.title}
          </div>
          <div class="cd-chart-value">
            <strong>${num(last.value, card.digits)}</strong>
            ${card.unit ? `<small>${card.unit}</small>` : ""}
            <span class="cd-chart-delta ${deltaClass}">${deltaText}</span>
          </div>
          <div class="cd-chart-sub">هفتهٔ ${num(weekNumber, 0)} از ${num(
            trend.weeks?.length || 0,
            0,
          )} هفتهٔ ثبت‌شده</div>
          ${
            stats
              ? `
          <div class="cd-chart-stats">
            <span>کمینه <strong>${num(stats.min, card.digits)}</strong></span>
            <span>میانگین <strong>${num(stats.avg, card.digits)}</strong></span>
            <span>بیشینه <strong>${num(stats.max, card.digits)}</strong></span>
          </div>`
              : ""
          }
          <div class="cd-chart-divider"></div>
          <div class="cd-chart-meta">
            <i class="fas fa-clock"></i>
            آخرین ثبت: ${faDate(lastDate)}
          </div>
        </div>
      </article>`;
};

const buildFlockChartsHTML = (flock = {}) => {
  const trend = flock.trend || {};
  const weeks = Array.isArray(trend.weeks) ? trend.weeks : [];

  const needNoData = weeks.length < 2;

  if (needNoData) {
    return '<div class="cd-empty cd-empty-soft">برای این گله دادهٔ کافی برای نمایش روند هفتگی ثبت نشده است</div>';
  }

  const payload = escapeHtml(
    JSON.stringify({
      weeks: trend.weeks,
      dates: trend.dates || [],
      weight: trend.weight || [],
      fcr: trend.fcr || [],
      mortality: trend.mortality || [],
    }),
  );

  const cards = FLOCK_CHART_CARDS.map((card) =>
    buildFlockChartCardHTML(card, trend),
  )
    .filter(Boolean)
    .join("");

  if (!cards) {
    return '<div class="cd-empty cd-empty-soft">برای این گله دادهٔ کافی برای نمایش روند هفتگی ثبت نشده است</div>';
  }

  return `
    <div class="cd-chart-row" data-cd-trend="${payload}">
      <div class="cd-chart-row-title">📈 روند هفتگی این گله</div>
      <div class="cd-chart-grid">${cards}</div>
    </div>`;
};

// ============================================================
// «سود و زیان این گله» به تفکیک سالن
// (اقتصاد در سطح گله ثبت می‌شود؛ تخصیص سالن‌ها در بک‌اند انجام شده است)
// ============================================================
const buildFlockEconomicsHTML = (flock = {}) => {
  const econ = flock.economics;
  const rows = (flock.halls || []).filter((hall) => hall.economics);
  if (!econ || !rows.length) return "";

  const sumOf = (key) =>
    rows.reduce((s, hall) => s + (parseFloat(hall.economics[key]) || 0), 0);

  const basisNote = [
    econ.basis?.income === "live_weight"
      ? "درآمد بر پایهٔ وزن زندهٔ هر سالن"
      : "درآمد تخصیص‌شده",
    econ.basis?.feedCost === "hall_feed"
      ? "خوراک بر پایهٔ مصرف همان سالن"
      : "خوراک تخصیص‌شده",
    "سایر هزینه‌ها (دارو/سوخت/کارگر) تخصیصی بر اساس وزن",
  ].join(" · ");

  const body = rows
    .map((hall) => {
      const h = hall.economics;
      const loss = Number(h.profit) < 0;
      const tone = loss ? "cd-td-loss" : "cd-td-profit";
      return `
        <tr>
          <td class="cd-td-name">
            ${txt(hall.hallName)}
            ${
              h.estimated
                ? '<span class="cd-badge-est" title="وزن یا خوراک این سالن ثبت نشده و تخصیصی است">تقریبی</span>'
                : ""
            }
          </td>
          <td>${num(h.liveWeight, 0)}${h.declaredWeight ? "" : " *"}</td>
          <td>${num(h.chicks, 0)}</td>
          <td>${num(h.income, 0)}</td>
          <td>${num(h.feedCost, 0)}</td>
          <td>${num(h.chickCost, 0)}</td>
          <td>${num(h.otherCost, 0)}</td>
          <td>${num(h.totalCost, 0)}</td>
          <td class="${tone}">${num(h.profit, 0)}</td>
          <td class="${tone}">${
            h.profitPercent === null ? "-" : `${num(h.profitPercent, 2)}٪`
          }</td>
        </tr>`;
    })
    .join("");

  const totalLoss = Number(econ.profit) < 0;

  return `
    <div class="cd-econ-block">
      <div class="cd-econ-head">
        <span class="cd-econ-title">💰 سود و زیان این گله — به تفکیک سالن</span>
      </div>
      <div class="cd-econ-note">${basisNote}</div>
      <div class="cd-table-wrap">
        <table class="cd-table cd-table-econ">
          <thead>
            <tr>
              <th>سالن</th>
              <th>وزن زنده (kg)</th>
              <th>جوجهٔ اولیه</th>
              <th>درآمد</th>
              <th>هزینهٔ خوراک</th>
              <th>هزینهٔ جوجه</th>
              <th>سایر (تخصیصی)</th>
              <th>جمع هزینه</th>
              <th>سود / زیان</th>
              <th>٪سود</th>
            </tr>
          </thead>
          <tbody>
            ${body}
            <tr class="cd-econ-total">
              <td class="cd-td-name">جمع گله</td>
              <td>${num(sumOf("liveWeight"), 0)}</td>
              <td>${num(sumOf("chicks"), 0)}</td>
              <td>${num(econ.income, 0)}</td>
              <td>${num(sumOf("feedCost"), 0)}</td>
              <td>${num(sumOf("chickCost"), 0)}</td>
              <td>${num(sumOf("otherCost"), 0)}</td>
              <td>${num(econ.totalCost, 0)}</td>
              <td class="${totalLoss ? "cd-td-loss" : "cd-td-profit"}">${num(econ.profit, 0)}</td>
              <td class="${totalLoss ? "cd-td-loss" : "cd-td-profit"}">${
                econ.profitPercent === null ? "-" : `${num(econ.profitPercent, 2)}٪`
              }</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${
        rows.some((hall) => !hall.economics.declaredWeight)
          ? '<div class="cd-econ-foot">* وزن کشتارگاهی این سالن ثبت نشده و از «جوجهٔ نهایی × وزن میانگین» برآورد شده است.</div>'
          : ""
      }
      <div class="cd-econ-foot">جمع هر ستون دقیقاً برابر عدد ثبت‌شدهٔ همین گله در «اطلاعات پایان گله» است.</div>
    </div>
  `;
};

// ============================================================
// ④ جدول کارنامهٔ سالن‌ها
// ============================================================
const buildHallsHTML = (halls = [], focus = null) => {
  if (!halls.length) {
    return `
      <section class="cd-section">
        <h4 class="cd-section-title">🏭 کارنامهٔ سالن‌ها (0)</h4>
      <p class="cd-section-sub">عملکرد تجمعی هر سالن در همهٔ گله‌های همین مرغدار.</p>
        <div class="cd-empty">سالنی برای این مرغدار ثبت نشده است</div>
      </section>
    `;
  }

  const hasEconomics = halls.some((hall) => hall.economics);

  const rows = halls
    .map((hall) => {
      const focusHit = focus && focus.hallId === hall.hallId;
      const econ = hall.economics;

      const loss = econ && Number(econ.profit) < 0;

      const flocksList = (hall.flocks || [])
        .map((p) => {
          const status = statusOf(p.status);
          return `
          <span class="cd-hall-flock ${status.cls}">
            ${p.flockNumber ? `گلهٔ ${txt(p.flockNumber)}` : "گله"}
            · ${faDate(p.placementDate)}
            ${p.ageDays ? `· ${num(p.ageDays, 0)} روز` : ""}
            · <strong>${num(p.weeksCount, 0)}</strong> هفته ثبت
          </span>`;
        })
        .join("");

      return `
      <tr class="cd-hall-row ${focusHit ? "cd-row-focus" : ""}" data-cd-hall="${escapeHtml(hall.hallId)}">
        <td class="cd-td-name">${txt(hall.hallName)}</td>
        <td>${hall.capacity ? num(hall.capacity, 0) : "-"}</td>
        <td>${num(hall.flocksCount, 0)}</td>
        <td>${num(hall.completedFlocks, 0)}</td>
        <td>${faDate(hall.lastPlacementDate)}</td>
        <td class="${hall.avgMortalityRate > 5 ? "cd-td-danger" : ""}">${num(hall.avgMortalityRate, 2)}٪</td>
        <td class="cd-td-fcr">${hall.avgFcr === null ? "-" : num(hall.avgFcr, 2)}</td>
        ${
          hasEconomics
            ? `
        <td class="${loss ? "cd-td-loss" : "cd-td-profit"}">${
          econ ? num(econ.profit, 0) : "-"
        }</td>
        <td class="${loss ? "cd-td-loss" : "cd-td-profit"}">${
          econ && econ.profitPercent !== null
            ? `${num(econ.profitPercent, 2)}٪`
            : "-"
        }</td>`
            : ""
        }
        <td class="cd-td-flocks">${flocksList || "-"}</td>
      </tr>`;
    })
    .join("");

  return `
    <section class="cd-section">
      <h4 class="cd-section-title">🏭 کارنامهٔ سالن‌ها (${num(halls.length, 0)})</h4>
      <p class="cd-section-sub">عملکرد تجمعی هر سالن در همهٔ گله‌های همین مرغدار.</p>
      <div class="cd-table-wrap">
        <table class="cd-table">
          <thead>
            <tr>
              <th>سالن</th>
              <th>ظرفیت (قطعه)</th>
              <th>گله‌ها</th>
              <th>گلهٔ تمام‌شده</th>
              <th>آخرین جوجه‌ریزی</th>
              <th>میانگین تلفات گله</th>
              <th>میانگین ضریب تبدیل</th>
              ${hasEconomics ? "<th>سود تجمعی</th><th>میانگین ٪سود</th>" : ""}
              <th>ریز گله‌ها</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
};

// ============================================================
// جدول هفته‌های یک گله (لود تنبل)
// options: { loading, error, chicksByPlacement, hallsByPlacement }
// ============================================================
const listText = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join("، ");
  return value ? String(value) : "";
};

const buildWeeksTableHTML = (weeks = [], options = {}) => {
  const {
    loading = false,
    error = "",
    chicksByPlacement = {},
    hallsByPlacement = {},
  } = options;

  if (loading) {
    return '<div class="cd-empty cd-empty-soft">در حال دریافت داده‌های هفتگی…</div>';
  }
  if (error) {
    return `<div class="cd-empty cd-empty-soft">${escapeHtml(error)}</div>`;
  }
  if (!weeks.length) {
    return '<div class="cd-empty cd-empty-soft">هفته‌ای برای این گله ثبت نشده است</div>';
  }

  // مرتب‌سازی بر اساس سالن و شمارهٔ هفته
  const sorted = [...weeks].sort((a, b) => {
    const pa = parseInt(a.chick_placement_id, 10) || 0;
    const pb = parseInt(b.chick_placement_id, 10) || 0;
    if (pa !== pb) return pa - pb;
    return (parseInt(a.week_number, 10) || 0) - (parseInt(b.week_number, 10) || 0);
  });

  let cumulativeFeed = 0;
  let cumulativeMortality = 0;
  let currentPlacement = null;

  const body = sorted
    .map((week) => {
      const placementId = week.chick_placement_id;

      // با تغییر سالن، تجمع‌ها صفر می‌شوند
      if (String(placementId) !== String(currentPlacement)) {
        currentPlacement = placementId;
        cumulativeFeed = 0;
        cumulativeMortality = 0;
      }

      cumulativeFeed += parseFloat(week.weekly_feed_intake) || 0;
      cumulativeMortality += parseInt(week.weekly_mortality, 10) || 0;

      const weight = parseFloat(week.weekly_weight) || 0;
      const chicks = parseInt(chicksByPlacement[placementId], 10) || 0;
      const liveChicks = Math.max(0, chicks - cumulativeMortality);

      // ✅ FCR تجمعی = خوراک تجمعی ÷ (وزن اخیر × جوجهٔ زندهٔ همان سالن)
      const fcrValue =
        weight > 0 && liveChicks > 0 && cumulativeFeed > 0
          ? num(cumulativeFeed / (weight * liveChicks), 2)
          : "-";

      const health = [
        listText(week.diseases) ? `بیماری: ${listText(week.diseases)}` : "",
        listText(week.vaccines) ? `واکسن: ${listText(week.vaccines)}` : "",
        listText(week.medicines) ? `دارو: ${listText(week.medicines)}` : "",
        listText(week.feedTypes) ? `نوع خوراک: ${listText(week.feedTypes)}` : "",
        week.additional_notes ? `توضیحات: ${week.additional_notes}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const healthShort = [
        listText(week.diseases),
        listText(week.vaccines),
        listText(week.medicines),
      ]
        .filter(Boolean)
        .join("، ");

      return `
      <tr>
        <td class="cd-td-name">${txt(
          hallsByPlacement[placementId] || `سالن ${placementId}`,
        )}</td>
        <td>${txt(week.week_number)}</td>
        <td class="cd-td-date">${faDate(week.week_start_date)} تا ${faDate(week.week_end_date)}</td>
        <td>${num(week.daily_feed_intake, 2)}</td>
        <td>${num(week.weekly_feed_intake, 2)}</td>
        <td>${num(week.weekly_weight, 3)}</td>
        <td class="${parseInt(week.weekly_mortality, 10) > 0 ? "cd-td-danger" : ""}">${num(week.weekly_mortality, 0)}</td>
        <td class="cd-td-fcr">${fcrValue}</td>
        <td>${txt(week.expertName)}</td>
        <td class="cd-td-notes" title="${escapeHtml(health)}">${txt(healthShort)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="cd-table-wrap">
      <table class="cd-table cd-table-weeks">
        <thead>
          <tr>
            <th>سالن</th>
            <th>هفته</th>
            <th>بازهٔ تاریخ</th>
            <th>خوراک روزانه</th>
            <th>خوراک هفتگی (kg)</th>
            <th>وزن (kg)</th>
            <th>تلفات</th>
            <th>FCR تجمعی</th>
            <th>کارشناس</th>
            <th>بیماری / واکسن</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
};

// ============================================================
// مودال کامل
// ============================================================
const buildCustomerDetailHTML = (data = {}) => {
  const customer = data.customer || {};
  const summary = data.summary || {};
  const flocks = Array.isArray(data.flocks) ? data.flocks : [];
  const halls = Array.isArray(data.halls) ? data.halls : [];
  const focus = data.focus || null;

  return `
    <div class="cd-root" dir="rtl">
      ${buildKpisHTML(summary)}
      ${buildBaseInfoHTML(customer, summary)}
      ${buildEconomicsHTML(data.economics)}
      ${buildFlocksHTML(flocks, focus)}
      ${buildHallsHTML(halls, focus)}
    </div>
  `;
};

export {
  buildCustomerDetailHTML,
  buildKpisHTML,
  buildBaseInfoHTML,
  buildEconomicsHTML,
  buildByHallEconomicsHTML,
  buildCompletionHTML,
  buildFlocksHTML,
  buildFlockCard,
  buildFlockChartsHTML,
  buildFlockEconomicsHTML,
  buildHallsHTML,
  buildWeeksTableHTML,
  summarizeTrend,
  roundTo,
};
