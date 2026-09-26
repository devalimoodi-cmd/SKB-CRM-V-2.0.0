// ============================================================
//  تست مودال «جزئیات مشتری» در داشبورد کارشناس
//  اجرا:  npm run test:customer-detail      (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ پیش از این مودال:
//   • «گله‌های قبلی» هرگز نمایش داده نمی‌شد (بک‌اند flocks را پر نمی‌کرد)
//   • FCR با فرمول اشتباه (خوراک ÷ آخرین وزن) محاسبه می‌شد
//   • سابقهٔ سالن‌ها و شاخص‌های پایان گله اصلاً وجود نداشت
//  این تست (بدون مرورگر/دیتابیس) تضمین می‌کند:
//   ۱) نوار KPI و کارت‌های گله/سالن با دادهٔ واقعی رندر می‌شوند
//   ۲) تب «جاری/گذشته» و هایلایت گلهٔ کلیک‌شده درست کار می‌کند
//   ۳) جدول هفته‌ها FCR تجمعی را با فرمول درست (خوراک ÷ وزن×جوجهٔ زنده) می‌سازد
//   ۴) متن کاربر (نام مشتری) escaped می‌شود (ضد XSS)
//   ۵) حالت‌های خالی/خطا/لودینگ و «گلهٔ تک‌سالنه» پوشش داده شده‌اند
// ============================================================

import {
  buildCustomerDetailHTML,
  buildKpisHTML,
  buildFlocksHTML,
  buildHallsHTML,
  buildWeeksTableHTML,
  buildEconomicsHTML,
  buildFlockChartsHTML,
  buildFlockEconomicsHTML,
  buildByHallEconomicsHTML,
  summarizeTrend,
} from "./src/features/dashboard/customer-detail.renderer.js";
import fs from "node:fs";
import path from "node:path";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// ============================================================
// دادهٔ نمونه (شبیه پاسخ واقعی /dashboard/customer/:id/performance)
// ============================================================
const sampleData = {
  customer: {
    id: 3,
    fullName: "اسماعیل رمضانی",
    farmName: "فارم نمونه",
    phone: "09120000000",
    province: "خراسان جنوبی",
    county: "بیرجند",
    address: "آدرس تست",
    nationalCode: "1234567890",
    customerType: "گوشتی",
  },
  summary: {
    flocksTotal: 2,
    flocksActive: 1,
    flocksCompleted: 1,
    totalChicks: 20000,
    totalMortality: 1000,
    mortalityRate: 5,
    survivalRate: 95,
    totalFeed: 30000,
    lastWeight: 2.1,
    avgFcr: 1.71,
    totalWeeks: 16,
    lastPlacementDate: "2026-09-09",
    hallsCount: 2,
    unitsCount: 1,
  },
  flocks: [
    {
      key: "f:6",
      flockId: 6,
      singleHall: false,
      flockNumber: 1,
      unitName: "واحد مرغداری ۱",
      startDate: "2026-09-09",
      endDate: null,
      status: "active",
      isActive: true,
      halls: [
        {
          hallId: 7,
          hallName: "سالن A",
          placementId: 23,
          chicks: 13000,
          finalChicks: 12480,
          mortality: 520,
          mortalityRate: 4,
          survivalRate: 96,
          feed: 20000,
          lastWeight: 2.1,
          lastAgeDays: 18,
          weeksCount: 3,
          fcr: 1.71,
          hasWeeklyData: true,
          completion: null,
        },
      ],
      kpi: {
        initialChicks: 13000,
        finalChicks: 12480,
        totalMortality: 520,
        mortalityRate: 4,
        survivalRate: 96,
        totalFeed: 20000,
        lastWeight: 2.1,
        lastWeekNumber: 3,
        ageDays: 18,
        weeksCount: 3,
        fcr: 1.71,
      },
      completion: null,
    },
    {
      key: "p:9",
      flockId: null,
      singleHall: true,
      flockNumber: 2,
      unitName: null,
      startDate: "2026-04-01",
      endDate: "2026-05-20",
      status: "completed",
      isActive: false,
      halls: [
        {
          hallId: 8,
          hallName: "سالن B",
          placementId: 9,
          chicks: 7000,
          finalChicks: 6520,
          mortality: 480,
          mortalityRate: 6.86,
          survivalRate: 93.14,
          feed: 16000,
          lastWeight: 2.4,
          lastAgeDays: 45,
          weeksCount: 7,
          fcr: 1.9,
          hasWeeklyData: true,
          completion: { fcr: 1.88, finalChicks: 6520, mortalityRate: 6.8 },
        },
      ],
      kpi: {
        initialChicks: 7000,
        finalChicks: 6520,
        totalMortality: 480,
        mortalityRate: 6.86,
        survivalRate: 93.14,
        totalFeed: 16000,
        lastWeight: 2.4,
        lastWeekNumber: 7,
        ageDays: 45,
        weeksCount: 7,
        fcr: 1.9,
      },
      completion: {
        fcr: 1.88,
        systemFcr: 1.9,
        epi: 412,
        systemEpi: 405,
        adgGrams: 53.3,
        survivalPercent: 93.1,
        slaughterAgeDays: 45,
        avgLiveWeight: 2.4,
        transportMortality: 20,
      },
    },
  ],
  halls: [
    {
      hallId: 7,
      hallName: "سالن A",
      capacity: 14000,
      flocksCount: 1,
      completedFlocks: 0,
      lastPlacementDate: "2026-09-09",
      lastWeight: 2.1,
      avgMortalityRate: 4,
      avgFcr: 1.71,
      flocks: [
        {
          flockNumber: 1,
          placementDate: "2026-09-09",
          status: "active",
          isActive: true,
          ageDays: 18,
          weeksCount: 3,
        },
      ],
    },
    {
      hallId: 8,
      hallName: "سالن B",
      capacity: 8000,
      flocksCount: 1,
      completedFlocks: 1,
      lastPlacementDate: "2026-04-01",
      lastWeight: 2.4,
      avgMortalityRate: 6.86,
      avgFcr: 1.9,
      flocks: [
        {
          flockNumber: 2,
          placementDate: "2026-04-01",
          status: "completed",
          isActive: false,
          ageDays: 45,
          weeksCount: 7,
        },
      ],
    },
  ],
  economics: {
    completedFlocks: 1,
    totalIncome: 1200000000,
    totalCost: 1000000000,
    totalProfit: 200000000,
    avgProfitPercent: 16.6,
    fcrTrend: [
      { flockNumber: 1, fcr: 1.81 },
      { flockNumber: 2, fcr: 1.72 },
    ],
  },
  focus: { flockKey: "f:6", flockId: 6, placementId: 23, hallId: 7 },
};

// ============================================================
// افزودن دادهٔ «روند هفتگی» و «سود و زیان» به نمونه (بخش‌های جدید مودال)
// ============================================================
sampleData.flocks[0].trend = {
  weeks: [1, 2, 3],
  dates: ["2026-09-20", "2026-09-27", "2026-10-04"],
  weight: [0.2, 0.6, 1.0],
  fcr: [1.2, 1.15, 1.1],
  mortality: [10, 5, 4],
};
sampleData.flocks[0].economics = {
  income: 1000,
  chickCost: 200,
  feedCost: 300,
  otherCost: 50,
  totalCost: 550,
  profit: 450,
  profitPercent: 45,
  basis: { income: "live_weight", feedCost: "hall_feed" },
  hallCount: 1,
};
sampleData.flocks[0].halls[0].economics = {
  income: 1000,
  chickCost: 200,
  feedCost: 300,
  otherCost: 50,
  totalCost: 550,
  profit: 450,
  profitPercent: 45,
  liveWeight: 5000,
  declaredWeight: true,
  estimated: false,
};

// گلهٔ تمام‌شده: زیان + وزن برآوردی (برای تست رنگ زیان و برچسب «تقریبی»)
sampleData.flocks[1].economics = {
  income: 800,
  chickCost: 300,
  feedCost: 400,
  otherCost: 200,
  totalCost: 900,
  profit: -100,
  profitPercent: -12.5,
  basis: { income: "live_weight", feedCost: "hall_feed" },
  hallCount: 1,
};
sampleData.flocks[1].halls[0].economics = {
  income: 800,
  chickCost: 300,
  feedCost: 400,
  otherCost: 200,
  totalCost: 900,
  profit: -100,
  profitPercent: -12.5,
  liveWeight: 2600,
  declaredWeight: false,
  estimated: true,
};

sampleData.halls[0].economics = {
  income: 1000,
  totalCost: 550,
  profit: 450,
  profitPercent: 45,
  flocksCount: 1,
};
sampleData.halls[1].economics = {
  income: 800,
  totalCost: 900,
  profit: -100,
  profitPercent: -12.5,
  flocksCount: 1,
};

sampleData.economics.byHall = [
  {
    hallId: 7,
    hallName: "سالن A",
    income: 1000,
    totalCost: 550,
    profit: 450,
    profitPercent: 45,
    flocksCount: 1,
    shareOfTotalProfit: null,
  },
  {
    hallId: 8,
    hallName: "سالن B",
    income: 800,
    totalCost: 900,
    profit: -100,
    profitPercent: -12.5,
    flocksCount: 1,
    shareOfTotalProfit: null,
  },
];

// ============================================================
// ۱) نوار KPI
// ============================================================
const kpis = buildKpisHTML(sampleData.summary);
check("نوار KPI شش کارت دارد", (kpis.match(/class="cd-kpi /g) || []).length === 6);
check("KPI تعداد گله‌ها درست است", kpis.includes('data-cd-kpi="flocks"'));
check(
  "KPI میانگین FCR با دو رقم اعشار نمایش داده می‌شود",
  /cd-kpi-value">۱٫۷۱</.test(kpis),
  kpis.match(/cd-kpi-value">[^<]*</g)?.slice(3, 5).join(" | "),
);
check(
  "KPI بقا٪ از summary خوانده می‌شود",
  kpis.includes("۹۵٪"),
  (kpis.match(/سلامت|بقا[^<]*/g) || []).join(""),
);

// ============================================================
// ۲) تب‌ها و کارت گله‌ها
// ============================================================
const flocksHTML = buildFlocksHTML(sampleData.flocks, sampleData.focus);
check(
  "دو تب (جاری/گذشته) ساخته می‌شود",
  (flocksHTML.match(/data-cd-tab="/g) || []).length === 2,
);
check(
  "تب پیش‌فرض «جاری» است (گلهٔ فوکوس فعال است)",
  /class="cd-tab cd-tab-active"\s+data-cd-tab="active"/.test(flocksHTML),
);
check(
  "پنل «گذشته» به‌صورت پیش‌فرض مخفی است",
  /data-cd-panel="past" hidden/.test(flocksHTML),
);
check(
  "گلهٔ کلیک‌شده هایلایت می‌شود (cd-flock-focus)",
  flocksHTML.includes("cd-flock-focus"),
);
check(
  "سالن کلیک‌شده در ریز گله هایلایت می‌شود (cd-row-focus)",
  flocksHTML.includes("cd-row-focus"),
);
check(
  "گلهٔ بدون رکورد (تک‌سالنه) با برچسب «گلهٔ تک‌سالنه» نمایش داده می‌شود",
  flocksHTML.includes("گلهٔ تک‌سالنه"),
);
check(
  "چیپ FCR گله در کارت گله هست",
  flocksHTML.includes("cd-chip-fcr") && flocksHTML.includes("۱٫۷۱"),
);
check(
  "شاخص‌های پایان گله (EPI/ADG) در گلهٔ تکمیل‌شده نمایش داده می‌شود",
  flocksHTML.includes("نتیجهٔ پایان گله") &&
    flocksHTML.includes("۴۱۲") &&
    flocksHTML.includes("۵۳٫۳"),
  (flocksHTML.match(/cd-completion-item[\s\S]{0,80}?<\/span>/g) || []).length +
    " items",
);
check(
  "گلهٔ بدون دادهٔ هفتگی پیام مناسب می‌گیرد",
  buildFlocksHTML(
    [
      {
        ...sampleData.flocks[0],
        halls: [{ ...sampleData.flocks[0].halls[0], hasWeeklyData: false }],
      },
    ],
    null,
  ).includes("دادهٔ هفتگی ثبت نشده"),
);
check(
  "دکمهٔ «نمایش هفته‌های این گله» شناسهٔ جوجه‌ریزی را در data-cd-weeks دارد",
  flocksHTML.includes('data-cd-weeks="23"'),
);
check(
  "بدون گله، حالت خالی نمایش داده می‌شود",
  buildFlocksHTML([], null).includes("هیچ گلهٔ پرورشی برای این مرغدار ثبت نشده است"),
);

// ============================================================
// ۳) جدول سابقهٔ سالن‌ها
// ============================================================
const hallsHTML = buildHallsHTML(sampleData.halls, sampleData.focus);
check(
  "هر دو سالن در جدول سابقه هستند",
  (hallsHTML.match(/class="cd-hall-row/g) || []).length === 2,
);
check(
  "سالن فوکوس‌شده هایلایت است",
  /cd-hall-row cd-row-focus/.test(hallsHTML),
);
check(
  "میانگین تلفات و FCR هر سالن نمایش داده می‌شود",
  hallsHTML.includes("۶٫۸۶٪") && hallsHTML.includes("۱٫۹"),
);
check(
  "ریز گله‌های هر سالن (تعداد هفتهٔ ثبت‌شده) نمایش داده می‌شود",
  hallsHTML.includes("cd-hall-flock") && hallsHTML.includes("هفته ثبت"),
);

// ============================================================
// ۴) جدول هفته‌ها (لود تنبل) — FCR تجمعی با فرمول درست
// ============================================================
const weeks = [
  {
    chick_placement_id: 23,
    week_number: 1,
    week_start_date: "2026-09-14",
    week_end_date: "2026-09-20",
    weekly_feed_intake: 1000,
    weekly_weight: 0.2,
    weekly_mortality: 20,
    diseases: ["کوکسیدیوز"],
    vaccines: ["نیوکاسل"],
    medicines: [],
    expertName: "کارشناس تست",
  },
  {
    chick_placement_id: 23,
    week_number: 2,
    week_start_date: "2026-09-21",
    week_end_date: "2026-09-27",
    weekly_feed_intake: 2000,
    weekly_weight: 0.6,
    weekly_mortality: 30,
    diseases: [],
    vaccines: [],
    medicines: ["ویتامین"],
    expertName: "کارشناس تست",
  },
];

const weeksHTML = buildWeeksTableHTML(weeks, {
  chicksByPlacement: { 23: 13000 },
  hallsByPlacement: { 23: "سالن A" },
});

// هفته ۱: 1000 ÷ (0.2 × (13000-20)) = 0.39   |  هفته ۲: 3000 ÷ (0.6 × 12950) = 0.39
check(
  "FCR تجمعی هفتهٔ اول = خوراک تجمعی ÷ (وزن × جوجهٔ زنده)",
  weeksHTML.includes(">۰٫۳۹<"),
  (weeksHTML.match(/cd-td-fcr">[^<]*</g) || []).join(" | "),
);
check(
  "نام سالن از نقشهٔ hallsByPlacement خوانده می‌شود",
  weeksHTML.includes("سالن A"),
);
check(
  "آرایه‌های بیماری/واکسن/دارو به متن تبدیل می‌شوند",
  weeksHTML.includes("کوکسیدیوز") && weeksHTML.includes("نیوکاسل"),
);
check(
  "کارشناس خدمات در جدول هست",
  weeksHTML.includes("کارشناس تست"),
);
check(
  "حالت لودینگ و خطا و خالی پیام مناسب دارند",
  buildWeeksTableHTML([], { loading: true }).includes("در حال دریافت") &&
    buildWeeksTableHTML([], { error: "خطای تست" }).includes("خطای تست") &&
    buildWeeksTableHTML([], {}).includes("هفته‌ای برای این گله ثبت نشده است"),
);

// ============================================================
// ۵) اقتصادی + امنیت (XSS)
// ============================================================
check(
  "بلوک اقتصادی فقط با دادهٔ موجود ساخته می‌شود",
  buildEconomicsHTML(sampleData.economics).includes("سود خالص") &&
    buildEconomicsHTML(null) === "",
);
check(
  "روند FCR سه گلهٔ آخر نمایش داده می‌شود",
  buildEconomicsHTML(sampleData.economics).includes("روند FCR"),
);

const xssHTML = buildCustomerDetailHTML({
  ...sampleData,
  customer: {
    ...sampleData.customer,
    fullName: '<script>alert("x")</script>',
    address: '"><img src=x onerror=alert(1)>',
  },
});
check(
  "نام/آدرس مشتری در HTML escaped می‌شود (ضد XSS)",
  !xssHTML.includes("<script>") &&
    !xssHTML.includes("<img") &&
    xssHTML.includes("&lt;script&gt;") &&
    xssHTML.includes("&lt;img"),
);

// ============================================================
// ۶) خروجی کامل
// ============================================================
const fullHTML = buildCustomerDetailHTML(sampleData);
check(
  "خروجی کامل شامل هر چهار بلوک است",
  fullHTML.includes("cd-kpi-grid") &&
    fullHTML.includes("مشخصات مرغدار و فارم") &&
    fullHTML.includes("گله‌های پرورش") &&
    fullHTML.includes("کارنامهٔ سالن‌ها"),
);
check(
  "خروجی RTL است (dir=rtl)",
  fullHTML.includes('dir="rtl"'),
);

// ============================================================
// ۷) کارت‌های نمودار روند هفتگی + سود و زیان به تفکیک سالن
// ============================================================
const flockCard = buildFlocksHTML(
  [sampleData.flocks[0]],
  sampleData.focus,
);

check(
  "برای گلهٔ دارای داده، سه کارت نمودار (وزن/FCR/تلفات) ساخته می‌شود",
  (flockCard.match(/data-cd-chart="/g) || []).length === 3 &&
    flockCard.includes('data-cd-chart="weight"') &&
    flockCard.includes('data-cd-chart="fcr"') &&
    flockCard.includes('data-cd-chart="mortality"'),
  (flockCard.match(/data-cd-chart="[a-z]+"/g) || []).join(" | "),
);
check(
  "ساختار کارت نمودار کامل است (sheet + ظرف با ابعاد ثابت + بدنه)",
  (flockCard.match(/class="cd-chart-card /g) || []).length === 3 &&
    (flockCard.match(/class="cd-chart-sheet"/g) || []).length === 3 &&
    (flockCard.match(/class="cd-chart-box"/g) || []).length === 3 &&
    (flockCard.match(/class="cd-chart-body"/g) || []).length === 3,
);
check(
  "رنگ کارت‌ها از نوع شاخص می‌آید (آبی/کهربایی/قرمز)",
  flockCard.includes("cd-chart-card-sky") &&
    flockCard.includes("cd-chart-card-amber") &&
    flockCard.includes("cd-chart-card-rose"),
);
check(
  "هر کارت عنوان، مقدار جاری، تغییر و پاصفحهٔ تاریخ دارد",
  (flockCard.match(/class="cd-chart-title"/g) || []).length === 3 &&
    (flockCard.match(/class="cd-chart-value"/g) || []).length === 3 &&
    (flockCard.match(/cd-chart-delta/g) || []).length === 3 &&
    (flockCard.match(/class="cd-chart-meta"/g) || []).length === 3 &&
    flockCard.includes("آخرین ثبت:") &&
    flockCard.includes("هفتهٔ ۳ از ۳ هفتهٔ ثبت‌شده"),
);
check(
  "تغییر نسبت به هفتهٔ قبل با رنگ درست علامت می‌خورد (وزن ▲ خوب / تلفات ▼ خوب)",
  flockCard.includes("cd-chart-delta is-good") &&
    !flockCard.includes("cd-chart-delta is-good is-bad"),
);

// ===== اعداد و جزئیات روی نمودار (خواستهٔ کاربر) =====
check(
  "خلاصهٔ آماری سری با تابع خالص درست محاسبه می‌شود (کمینه/میانگین/بیشینه)",
  (() => {
    const stats = summarizeTrend([0.19, 0.44, 0.74, 1.13, 1.72], 3);
    return (
      stats.min === 0.19 &&
      stats.max === 1.72 &&
      stats.avg === 0.844 &&
      stats.last === 1.72 &&
      stats.count === 5 &&
      summarizeTrend([], 2) === null &&
      summarizeTrend([null, undefined], 2) === null
    );
  })(),
  JSON.stringify(summarizeTrend([0.19, 0.44, 0.74, 1.13, 1.72], 3)),
);
check(
  "هر کارت نمودار ردیف «کمینه/میانگین/بیشینه» را نشان می‌دهد",
  (flockCard.match(/class="cd-chart-stats"/g) || []).length === 3 &&
    flockCard.includes("کمینه") &&
    flockCard.includes("میانگین") &&
    flockCard.includes("بیشینه") &&
    // وزن نمونه: [0.2, 0.6, 1.0] ⇒ کمینه ۰٫۲ · میانگین ۰٫۶ · بیشینه ۱
    flockCard.includes("<strong>۰٫۲</strong>") &&
    flockCard.includes("<strong>۰٫۶</strong>"),
);
check(
  "برای هر هفته برچسب عدد فعال است (data-cd-labels=all + اعشار و واحد)",
  (flockCard.match(/data-cd-labels="all"/g) || []).length === 3 &&
    flockCard.includes('data-cd-digits="3"') &&
    flockCard.includes('data-cd-digits="2"') &&
    flockCard.includes('data-cd-digits="0"') &&
    flockCard.includes('data-cd-unit="kg"'),
);
check(
  "canvas ها توضیح صفحه‌خوان (aria-label) با خلاصهٔ عددی دارند",
  (flockCard.match(/role="img"/g) || []).length === 3 &&
    /aria-label="وزن هفتگی گله: کمینه [^"]*بیشینه [^"]*میانگین [^"]*آخرین مقدار/.test(
      flockCard,
    ),
);
check(
  "دادهٔ سری‌های روند در data-cd-trend قابل‌خواندن است (JSON escaped)",
  /data-cd-trend="[^"]*&quot;weeks&quot;/.test(flockCard) &&
    (() => {
      const raw = flockCard.match(/data-cd-trend="([^"]*)"/)?.[1] || "";
      const decoded = raw
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      try {
        const parsed = JSON.parse(decoded);
        return (
          Array.isArray(parsed.weeks) &&
          parsed.weeks.length === 3 &&
          parsed.fcr[0] === 1.2 &&
          Array.isArray(parsed.dates) &&
          parsed.dates.length === 3
        );
      } catch {
        return false;
      }
    })(),
);
check(
  "برای گلهٔ بدون دادهٔ کافی، پیام راهنما نمایش داده می‌شود",
  buildFlockChartsHTML({ trend: { weeks: [1], weight: [0.2] } }).includes(
    "دادهٔ کافی برای نمایش روند هفتگی",
  ) && buildFlockChartsHTML({}).includes("دادهٔ کافی"),
);
check(
  "ردیف/استایل قدیمی Sparkline دیگر استفاده نمی‌شود",
  !flockCard.includes("cd-spark") && !flockCard.includes("cd-flock-row"),
);

const flockEcon = buildFlockEconomicsHTML(sampleData.flocks[0]);
check(
  "جدول «سود و زیان این گله» با تفکیک سالن رندر می‌شود",
  flockEcon.includes("سود و زیان این گله — به تفکیک سالن") &&
    flockEcon.includes("جمع گله") &&
    flockEcon.includes("هزینهٔ خوراک") &&
    flockEcon.includes("سایر (تخصیصی)"),
);
check(
  "مبنای تخصیص به کاربر توضیح داده می‌شود",
  flockEcon.includes("درآمد بر پایهٔ وزن زندهٔ هر سالن") &&
    flockEcon.includes("خوراک بر پایهٔ مصرف همان سالن") &&
    flockEcon.includes("تخصیصی بر اساس وزن"),
);
check(
  "سود مثبت سبز و زیان قرمز رنگ می‌شود",
  flockEcon.includes("cd-td-profit") &&
    buildFlockEconomicsHTML(sampleData.flocks[1]).includes("cd-td-loss"),
);
check(
  "وزن برآوردی با برچسب «تقریبی» و ستاره مشخص می‌شود",
  (() => {
    const lossEcon = buildFlockEconomicsHTML(sampleData.flocks[1]);
    return (
      lossEcon.includes("cd-badge-est") &&
      lossEcon.includes("تقریبی") &&
      lossEcon.includes("وزن کشتارگاهی این سالن ثبت نشده")
    );
  })(),
);
check(
  "گلهٔ بدون اقتصاد، بلوک سود و زیان نمی‌گیرد",
  buildFlockEconomicsHTML({ halls: [{ hallName: "سالن A" }] }) === "" &&
    buildFlockEconomicsHTML({}) === "",
);

const byHallHTML = buildByHallEconomicsHTML(sampleData.economics);
check(
  "جدول «سود و زیان به تفکیک سالن (جمع همهٔ گله‌ها)» رندر می‌شود",
  byHallHTML.includes("به تفکیک سالن (جمع همهٔ گله‌ها)") &&
    byHallHTML.includes("سهم از سود کل") &&
    byHallHTML.includes("سالن B"),
);
check(
  "سهم از سود نامشخص با «-» نمایش داده می‌شود (پروندهٔ زیان‌ده)",
  byHallHTML.includes(">-<"),
);

const hallsWithEcon = buildHallsHTML(sampleData.halls, sampleData.focus);
check(
  "کارنامهٔ سالن‌ها ستون‌های «سود تجمعی» و «میانگین ٪سود» را نشان می‌دهد",
  hallsWithEcon.includes("سود تجمعی") &&
    hallsWithEcon.includes("میانگین ٪سود") &&
    hallsWithEcon.includes("۴۵٪"),
);
check(
  "بدون اقتصاد، ستون‌های اقتصادی کارنامه نمایش داده نمی‌شوند",
  !buildHallsHTML(
    sampleData.halls.map(({ economics, ...rest }) => rest),
    null,
  ).includes("سود تجمعی"),
);

// ============================================================
// ۸) نگهبان‌ها: واژگان «گله» (بدون «دوره») + کلیدهای API جدید
// ============================================================
const fullHTMLFinal = buildCustomerDetailHTML(sampleData);

check(
  "در متن مودال هیچ‌جای «دوره» استفاده نشده است (واژگان = گله)",
  !fullHTMLFinal.includes("دوره"),
  (fullHTMLFinal.match(/.{0,20}دوره.{0,20}/g) || []).join(" | "),
);
check(
  "کلاس‌های بخش گله‌ها با نام flock ساخته می‌شوند (نه period)",
  fullHTMLFinal.includes("data-cd-flock=") &&
    fullHTMLFinal.includes("cd-flock") &&
    !fullHTMLFinal.includes("cd-period"),
);
check(
  "تیترهای بخش‌ها با واژگان گله رندر می‌شوند",
  fullHTMLFinal.includes("تاریخچهٔ گله‌های پرورش") &&
    fullHTMLFinal.includes("کارنامهٔ سالن‌ها") &&
    fullHTMLFinal.includes("سود و زیان کل پرونده") &&
    fullHTMLFinal.includes("مشخصات مرغدار و فارم"),
);

// ===== نگهبان ضدکشیدگی: ظرف نمودار باید ارتفاع ثابت پیکسلی داشته باشد =====
const cssSource = fs.readFileSync(
  path.join(import.meta.dirname, "src", "features", "dashboard", "dashboard.css"),
  "utf8",
);
const chartBoxRule =
  cssSource.match(/\.cd-chart-box\s*\{[\s\S]*?\}/)?.[0] || "";
const chartCanvasRule =
  cssSource.match(/\.cd-chart-canvas\s*\{[\s\S]*?\}/)?.[0] || "";

check(
  "ظرف نمودار ارتفاع ثابت پیکسلی دارد (ضدکشیدگی/زوم متغیر)",
  /height:\s*\d+px/.test(chartBoxRule) &&
    !/height:\s*(auto|100%|vh)/.test(chartBoxRule) &&
    /position:\s*relative/.test(chartBoxRule),
  chartBoxRule.replace(/\s+/g, " ").slice(0, 90),
);
check(
  "canvas داخل ظرف به‌صورت absolute کشیده می‌شود (بدون رشد بی‌پایان)",
  /position:\s*absolute/.test(chartCanvasRule) &&
    /width:\s*100%\s*!important/.test(chartCanvasRule) &&
    /height:\s*100%\s*!important/.test(chartCanvasRule),
  chartCanvasRule.replace(/\s+/g, " ").slice(0, 90),
);
check(
  "ارتفاع ظرف نمودار برای برچسب اعداد حداقل ۷۲px است",
  (() => {
    const height = parseInt(chartBoxRule.match(/height:\s*(\d+)px/)?.[1] || "0", 10);
    return height >= 72;
  })(),
  chartBoxRule.match(/height:\s*\d+px/)?.[0] || "-",
);

// ===== نگهبان ابعاد مودال: عریض‌تر و بلندتر از قبل =====
const modalLargeRule =
  cssSource.match(/\.modal-container\.modal-large\s*\{[\s\S]*?\}/)?.[0] || "";
const modalBodyScopedRule =
  cssSource.match(/#customerDetailModal \.modal-body\s*\{[\s\S]*?\}/)?.[0] || "";

// ارزیاب سادهٔ «calc(<n>vh - <m>px)» برای مقایسهٔ ارتفاع‌ها
const evalVhCalc = (expr, viewportHeight) => {
  const match = String(expr).match(
    /calc\(\s*([\d.]+)vh\s*-\s*([\d.]+)px\s*\)/,
  );
  if (!match) return null;
  return (parseFloat(match[1]) / 100) * viewportHeight - parseFloat(match[2]);
};

check(
  "مودال جزئیات مشتری عریض‌تر شده است (سقف ≥ ۱۳۰۰px با min/vw)",
  (() => {
    const maxWidth = parseInt(
      modalLargeRule.match(/max-width:\s*(\d+)px/)?.[1] || "0",
      10,
    );
    return (
      maxWidth >= 1300 &&
      /width:\s*min\(\s*\d+px\s*,\s*\d+vw\s*\)/.test(modalLargeRule)
    );
  })(),
  modalLargeRule.replace(/\s+/g, " ").slice(0, 110),
);
check(
  "بدنهٔ مودال بلندتر از حالت قبل شده است (۱۰۰vh−۱۸۰px > ۹۰vh−۱۴۰px)",
  (() => {
    const current = evalVhCalc(modalBodyScopedRule, 900);
    const previous = evalVhCalc("calc(90vh - 140px)", 900); // مقدار قبلی modal.css
    return current !== null && previous !== null && current > previous;
  })(),
  `new=${evalVhCalc(modalBodyScopedRule, 900)}px old=${evalVhCalc("calc(90vh - 140px)", 900)}px @900vh`,
);
check(
  "قاعدهٔ موبایل، عرض و ارتفاع را داخل صفحه نگه می‌دارد (ضد سرریز)",
  (() => {
    // اسکنر بلوک‌های @media با شمارش آکولاد (مقاوم به تودرتویی)
    const mediaBlocks = [];
    const re = /@media[^{]*\{/g;
    let match;
    while ((match = re.exec(cssSource))) {
      const braceStart = match.index + match[0].length - 1;
      let depth = 0;
      for (let i = braceStart; i < cssSource.length; i++) {
        if (cssSource[i] === "{") depth += 1;
        else if (cssSource[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            mediaBlocks.push({
              header: match[0],
              body: cssSource.slice(braceStart + 1, i),
            });
            re.lastIndex = i + 1;
            break;
          }
        }
      }
    }

    const mobileBlock = mediaBlocks.find(
      (block) =>
        /max-width:\s*768px/.test(block.header) &&
        /\.modal-container\.modal-large\s*\{/.test(block.body),
    );
    if (!mobileBlock) return false;

    const rule =
      mobileBlock.body.match(
        /\.modal-container\.modal-large\s*\{([^}]*)\}/,
      )?.[1] || "";
    const widthPct = parseInt(
      rule.match(/width:\s*(\d+)%/)?.[1] || "0",
      10,
    );

    return (
      widthPct > 0 &&
      widthPct <= 100 &&
      /max-height:\s*calc\(100vh\s*-\s*\d+px\)/.test(rule)
    );
  })(),
);
check(
  "هدر و فوتر مودال همچنان sticky هستند (با بلندتر شدن بدنه گم نمی‌شوند)",
  /\.modal-header\s*\{[\s\S]*?position:\s*sticky[\s\S]*?\}/.test(cssSource) &&
    /\.modal-footer\s*\{[\s\S]*?position:\s*sticky[\s\S]*?\}/.test(cssSource),
);

// ============================================================
const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
