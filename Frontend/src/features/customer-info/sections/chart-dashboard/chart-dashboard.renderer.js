// ================================================================
// chart-dashboard.renderer.js
// رندر ماژول نمودارهای تحلیلی داینامیک (تب داشبورد اطلاعات مشتری)
// ================================================================

export const chartDashboardRenderer = {
  // ساخت HTML کامل بخش نمودارها داخل .skb-charts-container
  renderContainer(flocks, selectedFlockIds, weekCount, options = {}) {
    const container = document.querySelector(".skb-charts-container");
    if (!container) return;

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

    const viewMode = options.viewMode === "hall" ? "hall" : "flock";
    const layoutMode = options.layoutMode || "stacked";
    const hallFlocks = options.hallFlocks || [];
    const groupMeta = options.groupMeta || [];
    const selSet = new Set(selectedFlockIds.map((x) => String(x)));
    const isChecked = (uid) => selSet.has(String(uid));

    const chip = (u) => `
            <label class="analysis-flock-check">
              <input type="checkbox" value="${u._uid || u.flock.id}" ${
                isChecked(u._uid) ? "checked" : ""
              }
                     onchange="chartDashboardService.toggleFlock('${u._uid || u.flock.id}', this.checked)">
              <span class="flock-check-color" style="background: ${u.color}"></span>
              ${u._chipLabel || `گله ${u.flock.flockNumber}`}
            </label>`;

    let flockChecks = "";
    if (viewMode === "hall") {
      flockChecks = groupMeta
        .map((g) => {
          const members = (g.members || []).map((m) =>
            hallFlocks.find((h) => h._uid === m._uid),
          );
          const memberChips = members.filter(Boolean).map(chip).join("");
          if ((g.members || []).length > 1) {
            return `
            <div class="analysis-group-block">
              <div class="analysis-group-head">
                <i class="fas fa-layer-group"></i> گله ${g.flockNumber}
                <span class="analysis-group-count">${g.members.length} سالن</span>
                <button type="button" class="analysis-btn-mini"
                  onclick="chartDashboardService.selectGroupMembers('${g._groupKey}', true)">همه</button>
                <button type="button" class="analysis-btn-mini"
                  onclick="chartDashboardService.selectGroupMembers('${g._groupKey}', false)">هیچ</button>
              </div>
              <div class="analysis-flock-list">${memberChips}</div>
            </div>`;
          }
          return `<div class="analysis-group-block analysis-group-single">${memberChips}</div>`;
        })
        .join("");
    } else {
      flockChecks = flocks.map(chip).join("");
    }

    container.innerHTML = `
            <div class="analysis-module">

                <!-- ===== کنترل‌های بالا ===== -->
                <div class="analysis-controls">
                    <div class="analysis-control-group analysis-view-group">
                        <label class="analysis-control-label"><i class="fas fa-arrows-split-up-and-left"></i> نمایش بر اساس:</label>
                        <div class="analysis-seg" id="analysisViewSeg">
                            <button type="button" class="analysis-seg-btn ${viewMode === "flock" ? "active" : ""}" data-view="flock"
                                    onclick="chartDashboardService.setViewMode('flock')"><i class="fas fa-warehouse"></i> کل گله</button>
                            <button type="button" class="analysis-seg-btn ${viewMode === "hall" ? "active" : ""}" data-view="hall"
                                    onclick="chartDashboardService.setViewMode('hall')"><i class="fas fa-door-open"></i> سالن‌ها</button>
                        </div>
                    </div>
                    <div class="analysis-control-group analysis-flock-group">
                        <label class="analysis-control-label"><i class="fas ${viewMode === "hall" ? "fa-door-open" : "fa-warehouse"}"></i> ${viewMode === "hall" ? "سالن‌ها (گروه‌بندی گله):" : "گله‌ها:"}</label>
                        <div class="${viewMode === "hall" ? "analysis-flock-groups" : "analysis-flock-list"}">${flockChecks}</div>
                        <button class="analysis-btn-mini" onclick="chartDashboardService.selectAllFlocks(true)">همه</button>
                        <button class="analysis-btn-mini" onclick="chartDashboardService.selectAllFlocks(false)">هیچ</button>
                    </div>
                    <div class="analysis-control-group">
                        <label class="analysis-control-label"><i class="fas fa-calendar-week"></i> هفته:</label>
                        <button class="analysis-btn-toggle" onclick="chartDashboardService.changeWeekRange(-1)">−</button>
                        <input type="number" id="analysisWeekRange" class="analysis-week-input" value="${weekCount}" min="2" max="16"
                               onchange="chartDashboardService.setWeekRange(this.value)">
                        <button class="analysis-btn-toggle" onclick="chartDashboardService.changeWeekRange(1)">+</button>
                        <span class="analysis-hint">هفته</span>
                    </div>
                    <div class="analysis-control-group analysis-layout-group" id="chartLayoutGroup">
                        <label class="analysis-control-label"><i class="fas fa-table-cells-large"></i> چیدمان:</label>
                        <div class="analysis-seg">
                            <button type="button" class="analysis-seg-btn ${layoutMode === "stacked" ? "active" : ""}" data-layout="stacked" title="عمودی (پیش‌فرض)"
                                    onclick="chartDashboardService.setChartLayout('stacked')"><i class="fas fa-bars-staggered"></i> عمودی</button>
                            <button type="button" class="analysis-seg-btn ${layoutMode === "duo" ? "active" : ""}" data-layout="duo" title="دو ستونه"
                                    onclick="chartDashboardService.setChartLayout('duo')"><i class="fas fa-table-columns"></i> دو ستونه</button>
                            <button type="button" class="analysis-seg-btn ${layoutMode === "side" ? "active" : ""}" data-layout="side" title="داشبوردی"
                                    onclick="chartDashboardService.setChartLayout('side')"><i class="fas fa-grip"></i> داشبوردی</button>
                        </div>
                    </div>
                </div>

                <div class="analysis-cards" id="analysisCards" data-layout="${layoutMode}">

                <!-- ===== نمودار داینامیک اصلی ===== -->
                <div class="analysis-chart-card analysis-main-card">
                    <div class="analysis-chart-header">
                        <h3 class="analysis-chart-title"><i class="fas fa-chart-line"></i> <span id="mainChartTitle">وزنگیری (روند وزن هفتگی)</span></h3>
                        <div class="analysis-chart-actions">
                            <button class="analysis-action-btn" onclick="chartDashboardService.downloadChart('mainChart','png')" title="دانلود PNG"><i class="fas fa-download"></i> PNG</button>
                            <button class="analysis-action-btn" onclick="chartDashboardService.downloadChart('mainChart','jpg')" title="دانلود JPG"><i class="fas fa-file-image"></i> JPG</button>
                            <button class="analysis-action-btn" onclick="chartDashboardService.resetZoom('mainChart')" title="ریست زوم"><i class="fas fa-search-minus"></i></button>
                            <button class="analysis-action-btn" onclick="window.print()" title="چاپ"><i class="fas fa-print"></i></button>
                            <button class="analysis-action-btn analysis-cmp-btn" onclick="chartDashboardService.openChartComparePicker()"
                                    title="مقایسه با گله/سالن سایر مشتریان"><i class="fas fa-people-arrows"></i> مقایسه</button>
                        </div>
                    </div>

                    <div class="analysis-indicator-tabs" id="mainIndicatorTabs">
                        <button class="analysis-tab ${options.mainIndicator === "weight" ? "active" : ""}" data-ind="weight"
                                onclick="chartDashboardService.setMainIndicator('weight')"><i class="fas fa-weight"></i> وزنگیری</button>
                        <button class="analysis-tab ${options.mainIndicator === "gain" ? "active" : ""}" data-ind="gain"
                                onclick="chartDashboardService.setMainIndicator('gain')"><i class="fas fa-arrow-trend-up"></i> افزایش وزن هفتگی</button>
                        <button class="analysis-tab ${options.mainIndicator === "dailyGain" ? "active" : ""}" data-ind="dailyGain"
                                onclick="chartDashboardService.setMainIndicator('dailyGain')"><i class="fas fa-gauge-high"></i> نرخ رشد روزانه</button>
                    </div>

                    <div class="analysis-settings-row">
                        <label>نوع نمودار
                            <select id="mainChartType" onchange="chartDashboardService.updateMainSettings()">
                                <option value="line" selected>خطی</option>
                                <option value="bar">میله‌ای</option>
                                <option value="radar">راداری</option>
                            </select>
                        </label>
                        <label>ضخامت خط
                            <select id="mainLineWidth" onchange="chartDashboardService.updateMainSettings()">
                                <option value="1">نازک</option>
                                <option value="2" selected>متوسط</option>
                                <option value="3">ضخیم</option>
                            </select>
                        </label>
                        <label>سایز نقاط
                            <select id="mainPointSize" onchange="chartDashboardService.updateMainSettings()">
                                <option value="2">کوچک</option>
                                <option value="4" selected>متوسط</option>
                                <option value="6">بزرگ</option>
                            </select>
                        </label>
                        <label class="analysis-switch"><input type="checkbox" id="showStandards" checked onchange="chartDashboardService.updateMainSettings()"> نمایش استاندارد نژاد</label>
                        <label class="analysis-switch"><input type="checkbox" id="showDataLabels" onchange="chartDashboardService.updateMainSettings()"> نمایش مقادیر</label>
                        <label class="analysis-switch"><input type="checkbox" id="showTooltip" checked onchange="chartDashboardService.updateMainSettings()"> نمایش تولتیپ</label>
                    </div>

                    <!-- ===== پنل نمایش و تنظیم سری‌ها (بالای نمودار اصلی) ===== -->
                    <div class="analysis-series-controls" id="mainSeriesControls"></div>

                    <div class="analysis-chart-body">
                        <div class="analysis-legend-side" id="mainChartLegend"></div>
                        <div class="analysis-chart-wrapper">
                            <canvas id="mainChart"></canvas>
                        </div>
                    </div>
                </div>

                <!-- ===== نمودارهای جداگانه ===== -->
                <div class="analysis-chart-grid">
                    ${this.renderSimpleCard(
                      "totalWeightGainChart",
                      "fa-arrow-trend-up",
                      "افزایش وزن کل گله (هفتگی)",
                    )}
                    ${this.renderSimpleCard(
                      "totalLiveWeightChart",
                      "fa-weight-hanging",
                      "وزن زنده کل گله (هفتگی)",
                    )}
                    ${this.renderSimpleCard("fcrChart", "fa-utensils", "ضریب تبدیل هفتگی (FCR)")}
                    ${this.renderMiniTabsCard(
                      "mortalityPctChart",
                      "fa-skull",
                      "درصد تلفات",
                      [
                        { mode: "weekly", label: "هفتگی", active: true },
                        { mode: "total", label: "کل" },
                      ],
                      "chartDashboardService.setMortalityMode",
                    )}
                    ${this.renderSimpleCard(
                      "mortalityCountChart",
                      "fa-calculator",
                      "تلفات (قطعه) هفته به هفته",
                    )}
                    ${this.renderMiniTabsCard(
                      "survivalPctChart",
                      "fa-heart-pulse",
                      "درصد زنده مانی",
                      [
                        { mode: "weekly", label: "هفتگی" },
                        { mode: "cumulative", label: "تجمعی", active: true },
                      ],
                      "chartDashboardService.setSurvivalMode",
                    )}
                    ${this.renderSimpleCard("blackoutChart", "fa-moon", "میزان خاموشی (ساعت)")}
                </div>

                </div>

            </div>
        `;
  },

  renderSeriesControls(items) {
    const container = document.getElementById("mainSeriesControls");
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
            <div class="series-controls-title"><i class="fas fa-sliders"></i> نمایش و تنظیم سری‌ها</div>
            <div class="series-controls-list">
                ${items
                  .map(
                    (it) => `
                    <div class="series-control-row">
                        <input type="checkbox" class="series-visible" ${it.visible ? "checked" : ""}
                               onchange="chartDashboardService.toggleSeries('${it.key}', this.checked)">
                        <span class="series-color-dot" style="background:${it.color}"></span>
                        <input type="color" class="series-color" value="${it.color}"
                               onchange="chartDashboardService.setSeriesColor('${it.key}', this.value)">
                        <select class="series-linetype" onchange="chartDashboardService.setSeriesLineType('${it.key}', this.value)">
                            <option value="solid" ${it.lineType === "solid" ? "selected" : ""}>توپر</option>
                            <option value="dashed" ${it.lineType === "dashed" ? "selected" : ""}>خط‌چین</option>
                            <option value="dotted" ${it.lineType === "dotted" ? "selected" : ""}>نقطه‌چین</option>
                        </select>
                        <span class="series-label">${it.label}</span>
                        ${it.key && String(it.key).indexOf("cmp:") === 0
                          ? `<button type="button" class="series-remove-btn" title="حذف سری مقایسه"
                               onclick="chartDashboardService.removeCompareSeries('${it.key.slice(4, -7)}')">&times;</button>`
                          : ""}
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;
  },

  renderSimpleCard(canvasId, icon, title) {
    return `
            <div class="analysis-chart-card">
                <div class="analysis-chart-header">
                    <h3 class="analysis-chart-title"><i class="fas ${icon}"></i> ${title}</h3>
                    <div class="analysis-chart-actions">
                        <button class="analysis-action-btn" onclick="chartDashboardService.downloadChart('${canvasId}','png')" title="دانلود PNG"><i class="fas fa-download"></i></button>
                        <button class="analysis-action-btn" onclick="chartDashboardService.resetZoom('${canvasId}')" title="ریست زوم"><i class="fas fa-search-minus"></i></button>
                        <button class="analysis-action-btn analysis-cmp-btn" onclick="chartDashboardService.openChartComparePicker()"
                                title="مقایسه با گله/سالن سایر مشتریان"><i class="fas fa-people-arrows"></i></button>
                    </div>
                </div>
                <div class="analysis-chart-body">
                    <div class="analysis-legend-side" id="${canvasId}Legend"></div>
                    <div class="analysis-chart-wrapper small">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            </div>
        `;
  },

  renderMiniTabsCard(canvasId, icon, title, modes, setterFn) {
    return `
            <div class="analysis-chart-card">
                <div class="analysis-chart-header">
                    <h3 class="analysis-chart-title"><i class="fas ${icon}"></i> ${title}</h3>
                    <div class="analysis-chart-actions">
                        <button class="analysis-action-btn" onclick="chartDashboardService.downloadChart('${canvasId}','png')" title="دانلود PNG"><i class="fas fa-download"></i></button>
                        <button class="analysis-action-btn" onclick="chartDashboardService.resetZoom('${canvasId}')" title="ریست زوم"><i class="fas fa-search-minus"></i></button>
                        <button class="analysis-action-btn analysis-cmp-btn" onclick="chartDashboardService.openChartComparePicker()"
                                title="مقایسه با گله/سالن سایر مشتریان"><i class="fas fa-people-arrows"></i></button>
                    </div>
                </div>
                <div class="analysis-indicator-tabs mini" id="${canvasId}Tabs">
                    ${modes
                      .map(
                        (m) =>
                          `<button class="analysis-tab ${m.active ? "active" : ""}" data-mode="${m.mode}" onclick="${setterFn}('${m.mode}')">${m.label}</button>`,
                      )
                      .join("")}
                </div>
                <div class="analysis-chart-body">
                    <div class="analysis-legend-side" id="${canvasId}Legend"></div>
                    <div class="analysis-chart-wrapper small">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            </div>
        `;
  },
};
