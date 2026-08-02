import { convertToPersianDate } from "../../../../core/utils/date.utils.js";
import { toNumber } from "../../../../core/utils/number.utils.js";

export const chartDashboardRenderer = {
  // ===== رندر آیتم‌های آکاردئون =====

  renderAccordionItems(flocks) {
    const container = document.querySelector(".skb-charts-container");
    if (!container) return;

    // اگر قبلاً رندر شده، پاک کن
    const existingItems = container.querySelectorAll(
      ".skb-charts-accordion-item",
    );
    existingItems.forEach((item) => item.remove());

    if (!flocks || flocks.length === 0) {
      container.innerHTML = `
                <div class="charts-empty-state">
                    <i class="fas fa-chart-bar"></i>
                    <h4>هیچ گله فعالی وجود ندارد</h4>
                    <p>برای مشاهده نمودارها، ابتدا یک گله ثبت کنید</p>
                </div>
            `;
      return;
    }

    // دکمه‌های کنترل
    const controlsHTML = `
            <div class="accordion-controls">
                <button class="accordion-control-btn btn-expand" onclick="chartDashboardService.openAllAccordion()">
                    <i class="fas fa-chevron-down"></i> باز کردن همه
                </button>
                <button class="accordion-control-btn btn-collapse" onclick="chartDashboardService.closeAllAccordion()">
                    <i class="fas fa-chevron-up"></i> بستن همه
                </button>
            </div>
        `;

    let html = controlsHTML;

    flocks.forEach((flock, index) => {
      const flockNumber = flock.flock_number || index + 1;
      const customerName = flock.customer?.full_name || "مشتری";
      const hallName = flock.hall?.hall_name || `سالن ${flock.hall_id}`;
      const placementDate = flock.placement_date
        ? convertToPersianDate(flock.placement_date)
        : "-";

      html += `
                <div class="skb-charts-accordion-item" data-flock-id="${flock.id}">
                    <div class="skb-charts-accordion-header">
                        <div class="accordion-title">
                            <i class="fas fa-egg"></i>
                            <span>گله ${flockNumber} - ${customerName} (${hallName})</span>
                            <span class="accordion-badge">${this.getChartCount()} نمودار</span>
                        </div>
                        <i class="fas fa-chevron-down accordion-icon"></i>
                    </div>
                    <div class="skb-charts-accordion-body">
                        ${this.renderChartsForFlock(flock)}
                    </div>
                </div>
            `;
    });

    container.innerHTML = html;
  },

  renderChartsForFlock(flock) {
    // بررسی نوع گله و نمایش نمودارهای مناسب
    const charts = [
      // گروه ۱: نمودارهای وزن و خوراک
      {
        id: "weightTrendChart",
        title: "روند وزن گیری سالن‌ها",
        icon: "fa-chart-line",
        color: "#4a90e2",
        type: "line",
        stats: [
          { label: "میانگین وزن", key: "avgWeight", suffix: " کیلوگرم" },
          { label: "بیشترین وزن", key: "maxWeight", suffix: " کیلوگرم" },
        ],
      },
      {
        id: "totalFeedTrendChart",
        title: "روند مصرف خوراک کل گله",
        icon: "fa-utensils",
        color: "#10b981",
        type: "line",
        stats: [
          { label: "کل مصرف", key: "totalFeed", suffix: " کیلوگرم" },
          { label: "میانگین هفتگی", key: "avgFeed", suffix: " کیلوگرم" },
        ],
      },
      // گروه ۲: نمودارهای تلفات و مصرف خوراک
      {
        id: "mortalityRateChart",
        title: "نرخ تلفات سالن‌ها",
        icon: "fa-skull-crossbones",
        color: "#ef4444",
        type: "bar",
        stats: [
          { label: "میانگین تلفات", key: "avgMortality", suffix: " %" },
          { label: "کل تلفات", key: "totalMortality", suffix: " قطعه" },
        ],
      },
      {
        id: "feedTypeChart",
        title: "مصرف خوراک براساس نوع دان",
        icon: "fa-chart-pie",
        color: "#f59e0b",
        type: "doughnut",
        stats: [
          { label: "کل مصرف", key: "totalFeed", suffix: " کیلوگرم" },
          { label: "دان غالب", key: "dominantFeed" },
        ],
      },
    ];

    let html = '<div class="skb-charts-row">';

    charts.forEach((chart, index) => {
      if (index % 2 === 0 && index > 0) {
        html += '</div><div class="skb-charts-row">';
      }

      html += `
                <div class="skb-chart-card">
                    <div class="skb-chart-title" style="border-bottom-color: ${chart.color};">
                        <i class="fas ${chart.icon}"></i> ${chart.title}
                    </div>
                    <canvas id="${chart.id}"></canvas>
                    <div class="skb-chart-stats">
                        ${chart.stats
                          .map(
                            (stat) => `
                            <div class="skb-stat-item">
                                ${stat.label}: <span id="${stat.key}">-</span>${stat.suffix || ""}
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
            `;
    });

    html += "</div>";
    return html;
  },

  getChartCount() {
    return 4; // تعداد نمودارها
  },

  // ===== دریافت تنظیمات نمودار =====

  getChartConfig(chartId, flock) {
    const data = flock.data || {};
    const summary = flock.summary || {};
    const labels = data.weekLabels || [
      "هفته 1",
      "هفته 2",
      "هفته 3",
      "هفته 4",
      "هفته 5",
      "هفته 6",
    ];

    const configs = {
      weightTrendChart: {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "وزن (کیلوگرم)",
              data: data.weighting || [0.5, 0.8, 1.2, 1.7, 2.2, 2.8],
              borderColor: "#4a90e2",
              backgroundColor: "rgba(74, 144, 226, 0.1)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw} کیلوگرم`,
              },
            },
          },
          scales: {
            y: { beginAtZero: true },
          },
        },
      },

      totalFeedTrendChart: {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "مصرف خوراک (کیلوگرم)",
              data: data.feed || [10, 18, 30, 45, 55, 60],
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw} کیلوگرم`,
              },
            },
          },
          scales: {
            y: { beginAtZero: true },
          },
        },
      },

      mortalityRateChart: {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            {
              label: "تلفات",
              data: data.loss || [2, 5, 8, 6, 4, 3],
              backgroundColor: "#ef4444",
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.raw} قطعه`,
              },
            },
          },
          scales: {
            y: { beginAtZero: true },
          },
        },
      },

      feedTypeChart: {
        type: "doughnut",
        data: {
          labels: ["آغازین", "پیش دان", "میان دان", "پس دان ۱", "پس دان ۲"],
          datasets: [
            {
              data: data.feedTypes || [42, 28, 18, 8, 4],
              backgroundColor: [
                "#10b981",
                "#3b82f6",
                "#f59e0b",
                "#8b5cf6",
                "#ef4444",
              ],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                font: { family: "Vazir", size: 10 },
              },
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${ctx.raw}%`,
              },
            },
          },
        },
      },
    };

    return configs[chartId] || null;
  },

  // ===== رندر خلاصه آماری =====

  renderSummary(data) {
    if (!data) return;

    const elements = {
      avgWeight: data.avgWeight,
      maxWeight: data.maxWeight,
      totalMortality: data.totalMortality,
      avgMortality: data.avgMortality,
      totalFeed: data.totalFeed,
      avgFeed: data.avgFeed,
      avgConversion: data.avgConversion,
      bestConversion: data.bestConversion,
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) {
        if (typeof value === "number") {
          el.textContent = value.toFixed(1);
        } else {
          el.textContent = value;
        }
      }
    });

    // به‌روزرسانی آمار ویژه
    const avgMortality = document.getElementById("avgMortality");
    if (avgMortality && data.avgMortality !== undefined) {
      avgMortality.textContent = data.avgMortality.toFixed(1);
    }

    const dominantFeed = document.getElementById("dominantFeed");
    if (dominantFeed && data.dominantFeed) {
      dominantFeed.textContent = data.dominantFeed;
    }
  },

  // ===== داده‌های نمونه برای Fallback =====

  getMockData() {
    return {
      weighting: [0.5, 0.8, 1.2, 1.7, 2.2, 2.8, 3.2],
      loss: [2, 5, 8, 6, 4, 3, 2],
      feed: [10, 18, 30, 45, 55, 60, 65],
      feedTypes: [42, 28, 18, 8, 4],
      weekLabels: [
        "هفته 1",
        "هفته 2",
        "هفته 3",
        "هفته 4",
        "هفته 5",
        "هفته 6",
        "هفته 7",
      ],
      summary: {
        avgWeight: 2.85,
        maxWeight: 3.25,
        totalMortality: 30,
        avgMortality: 4.2,
        totalFeed: 15800,
        avgFeed: 41.6,
        avgConversion: 1.85,
        bestConversion: 1.72,
        dominantFeed: "آغازین",
      },
    };
  },
};
