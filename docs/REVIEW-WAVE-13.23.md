# بازبینی موج ۱۳.۲۳ — «هر بخش، فرم و نمودارِ خودش»

> دو موج قبل، پورتال را «کارکردی» کرد: ۱۳.۲۱ پنل‌ها را به آکاردئون و
> شیت تبدیل کرد و ۱۳.۲۲ گیت سرور تیکت را بست. اما دو گلایهٔ واقعی از
> کاربر ماند:
>
> ۱. **شیت مودال** برای ثبت/ویرایش درخواست، دقیقاً همان چیزی بود که
>    می‌خواستیم حذف کنیم: کاربر از بخش بیرون می‌رفت، پشت یک لایه می‌افتاد
>    و صفحه قفل می‌شد.
> ۲. **نمودار واقعی وجود نداشت**؛ فقط SVG دست‌ساز ۱۳.۴ بود (بدون tooltip،
>    بدون legend، بدون بزرگ‌نمایی) در حالی که کارشناس از ۱۳.۲ همان
>    Chart.js را دارد.
>
> **۰ اندپوینت · ۰ کلید · ۰ مایگریشن** — فقط UI. تنها تغییر قراردادی،
> یک پارامتر اختیاری `group` روی همان `GET /api/portal/farm/requests`
> است که ورودی نامعتبرش «بدون فیلتر» می‌شود (fail-open برای سازگاری).

---

## ۱) مسئله

| # | شکاف | اثر |
|---|---|---|
| ۱ | فرم درخواست در شیت مودال بود (`#portalRequestSheet` + `body.portal-sheet-open`) | ثبت/ویرایشِ یک ردیف، کاربر را از همان بخش بیرون می‌برد؛ موبایل: صفحه قفل، اسکرول قطع |
| ۲ | ۱۸ نوع درخواست یک‌جا و در یک بدنه | فرمِ واحد پر بود از نوع‌هایی که به آن بخش ربطی نداشت؛ فهرست «درخواست‌های من» هم همهٔ نوع‌ها را قاطی می‌کرد |
| ۳ | پورتال هیچ کتابخانهٔ نموداری نداشت | tooltip/legend/zoom/ریسپانسیو نبود؛ مقایسه با استاندارد نژاد فقط خط SVG خام بود |
| ۴ | `decorateTables` در سه پنل صدا زده نمی‌شد | در موبایل جدول «پایان دوره»، «گزارش نهایی» و «مقایسهٔ گله‌ها» اسکرول افقی می‌ساخت |
| ۵ | هیچ لایهٔ ریسپانسیو سراسری نبود | KPIها، سرصفحهٔ کارت‌ها و پنل جزئیات روی ۳۶۰px تنگ/سرریز می‌شدند |

ریشهٔ مشترک: **«فرم و نمودار، مهمانِ صفحه بودند نه جزئی از بخش»**.

---

## ۲) دامنه

| مورد | مقدار |
|---|---|
| اندپوینت تازه | **هیچ** — همان ۲۹ اندپوینت اسکیمای ۱۳.۱۸ |
| کلید مجوز تازه | **هیچ** (۲۲۵ ⇒ ۲۲۵ / ۱۸ گروه) |
| مایگریشن | **هیچ** |
| تغییر بک‌اند | `services/portalRequestRules.js` (+گروه‌ها) · `services/portalRequestService.js` (`types` در فهرست/شمارنده) · `controllers/portalFarmController.js` (پارامتر `group`) |
| تغییر فرانت | `portal.html` · `portal.farm.js` · `portal.farm.rules.js` · `portal.farm.renderer.js` · `portal.views.js` · `portal.service.js` · `portal.extra.js` · `portal.api.js` · `portal.css` |
| فایل تازه (فرانت) | `portal.charts.js` · `portal.inline.css` · `portal.charts.css` · `portal.responsive.css` |
| فایل تازه (گارد) | `Frontend/portal-inline-forms-test.mjs` (۲۱ بررسی) · `Frontend/portal-charts-test.mjs` (۲۴ بررسی) |
| نتیجهٔ دروازه | ۵۱ ⇒ **۵۳ گام** |

---

## ۳) فرم درون‌خطی — چرا «جابه‌جایی گره» و نه چند نسخه؟

سه گره در `portal.html`:

```html
<div id="portalInlinePark" hidden></div>          <!-- پارکینگ -->
<div class="portal-inline" id="portalRequestForm" hidden> … </div>
<!-- و در هر بخش: -->
<div class="portal-inline-slot" data-inline-slot="units"> … </div>
```

`openRequestForm()` گرهٔ میزبان را با `appendChild` به جایگاه آن بخش
منتقل می‌کند و `closeRequestForm()` به پارکینگ برمی‌گرداند.

| گزینه | نتیجه |
|---|---|
| چند نسخه (یکی در هر پنل) | شناسه‌های `portalFarmBody/Status` تکراری می‌شدند و منطق ۱۳.۱۱/۱۳.۱۶ باید پنج‌تایی می‌شد |
| ساخت دوبارهٔ HTML | شنونده‌های `bindFarm` و وضعیت فرم در هر باز/بسته پاک می‌شد |
| **جابه‌جایی همان گره** | شناسه یکتا می‌ماند، شنونده‌ها و وضعیت حفظ می‌شوند، صفر رندر اضافه |

### API سرویس (بدون مسیر/تب تازه)

| متد | کار |
|---|---|
| `bindInlineForm()` | کلیک `[data-farm-action]` (ردیف‌ها از `bindViews`)، `[data-inline-open]` (دکمهٔ هر بخش)، `[data-inline-close]`، Escape |
| `openRequestForm(type, targetId, { panel, accId, origin })` | گیت `canRequestFarm()` ← mount در بخش ← `switchFarmType` ← پیش‌پرکردن هدف ← عنوان ← اسکرول/هایلایت ← فوکوس |
| `closeRequestForm({ focusBack })` | ریست فرم + بازگشت گره به پارکینگ + بازگشت فوکوس به دکمهٔ مبدأ |
| `mountRequestForm` / `unmountRequestForm` / `isRequestFormOpen` / `requestFormSlot` | خالص و تست‌پذیر؛ کلید جایگاه فقط `^[a-zA-Z]+$` است (هیچ سلکتور آزادی از بیرون) |
| `markFarmTarget(origin)` | یک کلاس روی `.portal-acc__row` + باز نگه‌داشتن `<details>` والد |

> **چرا mount در جایگاه ثابت بخش و نه داخل خودِ آکاردئون؟**
> `renderHalls()` در `ensureHallDetail` دو بار صدا زده می‌شود و `innerHTML`
> بدنه را بازنویسی می‌کند؛ فرمِ داخل بدنه هر بار نابود می‌شد. جایگاه ثابت
> بخش + هایلایت ردیف، همان حس «همان ردیف» را می‌دهد بدون هیچ remount.

### «هر بخش، فرم خودش»

`portal.farm.rules.js`:

```js
FARM_PANEL_GROUPS = {
  units:      ["unit", "hall"],          // ثبت سالن زیر همان واحد
  halls:      ["hall", "hall_details"],
  placements: ["placement"],
  weeks:      ["weekly"],
  flocks:     ["weekly"],
};
FARM_GROUP_HOME_PANEL = { unit: "units", hall: "halls", … };
```

`renderFarmPanel({ …, scope })` فقط گروه‌های همان بخش را تب می‌کند و
`farmGroupsOfPanel(panel)` به `portalApi.getFarmRequests({ groups })` می‌رود:

- فهرست «درخواست‌های من» و **شمارنده‌ها** هر دو با فیلتر گروه می‌آیند
  (`countsOf(customerId, { types })`) تا عدد «در انتظار» بیرون از بخش دروغ نباشد.
- سرور: `normalizeGroupFilter("unit,hall") ⇒ { groups, keys }`؛ مقدار ناشناخته
  ⇒ `null` (بدون فیلتر) — هیچ رشتهٔ آزادی به کوئری نمی‌رسد.
- `farmPanelOfType()` با `FARM_GROUP_HOME_PANEL` یکتاست؛ بدون آن،
  `hall_delete` به‌خاطر مشترک‌بودن گروه `hall` در «واحدها» می‌افتاد.

---

## ۴) نمودارها — Chart.js با fallback اجباری

`portal.charts.js` تنها جایی است که `window.Chart` را می‌بیند
(کتابخانه از `node_modules/chart.js` در HTML و قبل از `app.service`
بارگذاری می‌شود تا `chart-theme.service` تم را روی همان نمونه اعمال کند).

| لایه | نقش |
|---|---|
| `weeklyWeightSpec(items)` | خطی وزن هفتگی (۲۰ هفتهٔ آخر، همان دادهٔ صفحه) |
| `dashboardSpecs(data, flags)` | وزن/افزایش وزن/تلفات/دان/FCR — هر کلید فقط با پرچم سرور |
| `standardsSpec(analysis, flags)` | واقعی در برابر استاندارد نژاد (خط‌چین) |
| `chartShellHtml` | پوستهٔ `figure > canvas` با escape کامل عنوان |
| `mountChart*` / `destroyChart(s)` / `resizeCharts` | رجیستری `canvasId → Chart`؛ mount دوباره = destroy قبلی |

```js
// portal.service.js
const live = renderWeeklyLiveChart(items);
if (live) { box.innerHTML = live; mountWeeklyLiveChart(items); return; }
box.innerHTML = renderWeeklyChart(items);   // ← همان SVG ۱۳.۴
```

- **fallback اجباری:** همهٔ `render*LiveChart` ها اول `hasChartJs()` را
  می‌پرسند؛ بدون کتابخانه رشتهٔ خالی می‌دهند و SVG قدیمی جایش را می‌گیرد.
- **ضد نشتی:** `destroyChartsIn(box)` پیش از هر `innerHTML` تازه در داشبورد.
- **تلهٔ canvas پنهان:** `activateTab` بعد از نمایش پنل `resizeCharts()` را
  صدا می‌زند و `.portal-chart__box` ارتفاع صریح دارد (۲۲۰/۲۶۰px).
- **یک منبع عدد:** سری‌ها از `farmChartSeries` در `portal.renderer.js` می‌آیند
  (همان `seriesFrom`/`gainSeriesFrom`/`fcrSeriesFrom` نمودار SVG) تا دو
  نمودار هرگز دو عدد متفاوت نشان ندهند.
- **RTL و فارسی:** `tooltip.rtl`, `textDirection: "rtl"`, `legend.rtl` و
  برچسب‌ها با `faNumber`.
- **حرکت:** با `prefers-reduced-motion` انیمیشن خاموش می‌شود.

---

## ۵) ریسپانسیو و نظم صفحه

| مورد | تغییر |
|---|---|
| جدول‌های جامانده | `decorateTables` به `renderCompletion`، `renderFinalReport` و جدول مقایسهٔ داشبورد اضافه شد (ریشهٔ اسکرول افقی) |
| `portal.responsive.css` | مهار `overflow-x`، `max-width:100%` روی جدول/تصویر/canvas، `overflow-wrap` |
| لمس | دکمه‌ها ≥۴۴px و فیلدها ≥۱۶px فونت (ضد zoom خودکار iOS) |
| ارتفاع | `min-height: 100dvh` + `env(safe-area-inset-bottom)` برای کامپوزر تیکت |
| KPI | ۱ ستون <۴۸۰ · ۲ ستون ۴۸۰‑۸۹۹ · ۴ ستون ≥۹۰۰ |
| پنل جزئیات | در ≤۴۸۰ تمام‌صفحه (`100dvh`، بدون border-radius) |
| آکاردئون | `summary` و سرصفحهٔ کارت‌ها `flex-wrap` ⇒ بدون سرریز |

> `portal.css` سبک‌تر شد (بلوک `.portal-sheet*` حذف و استایل تازه به سه
> فایل جدا رفت) تا گارد ۱۳.۳ اندازه‌اش را همچنان بپاید.

---

## ۶) گاردها — چه چیزی معکوس و چه چیزی تازه شد

| فایل | تغییر |
|---|---|
| `portal-tree-test.mjs` | چهار بررسی شیت ⇒ «فرم درون‌خطی»؛ ۳۱ ⇒ **۳۳** بررسی (نگاشت بخش←گروه اجرا می‌شود) |
| `customer-portal-guard-test.mjs` | «نمودار فقط SVG» ⇒ «SVG پایه + Chart.js فقط در `portal.charts.js`»؛ بررسی شیت ⇒ بررسی میزبان/جایگاه؛ ۲۲۰ ⇒ **۲۲۱** |
| **`portal-inline-forms-test.mjs`** | **تازه** — ۲۱ بررسی: mount/unmount با DOM قلابی، جایگاه نامعتبر، `markFarmTarget`، نگاشت پنج بخش، `bindInlineForm` در سرویس |
| **`portal-charts-test.mjs`** | **تازه** — ۲۴ بررسی: اجرای واقعی specها با `Chart` قلابی، tooltip فارسی، mount/destroy/resize، fallback بدون کتابخانه، سیم‌کشی HTML/CSS/سرویس |
| `Backend/portal-request-test.mjs` | +۳ بررسی گروه‌ها؛ ۸۰ ⇒ **۸۳** |

نکتهٔ گارد: الگوی کتابخانه‌های رقیب با `\b` مهار شد — `/echarts/i` ساده
داخل `resizeCharts` هم می‌افتاد و گارد را بی‌دلیل قرمز می‌کرد.

---

## ۷) آزمون‌ها

```
npm run gate                 → ۵۳ گام، GATE-PASS
test:customer-portal         221/221
test:portal-tree              33/33
test:portal-inline            21/21   ← تازه
test:portal-charts            24/24   ← تازه
Backend/portal-request-test   83/83
```


---

## ۸) نکات و ریسک‌ها

- **`group` یک پارامتر نمایشی است:** مالکیت و وضعیت در سرور دست‌نخورده‌اند؛
  مقدار ناشناخته ⇒ بدون فیلتر (سازگاری با کلاینت قدیمی).
- **فرم به بخش خودش قفل است:** `activateTab` اگر بخش عوض شود فرم باز را
  می‌بندد (وگرنه فرمِ سرگردان در پنل پنهان می‌ماند).
- **`origin` برای فوکوس:** بستن فرم فوکوس را به همان دکمهٔ ردیف برمی‌گرداند.
- **بدون Chart.js:** پورتال مثل ۱۳.۲۲ کار می‌کند (SVG)؛ هیچ بررسی‌ای به
  کتابخانه گره نخورده است.
- **`data-inline-panel`** فقط برای تست/دیباگ است و به هیچ اندپوینتی نمی‌رود.
- **`hall` در دو بخش:** «واحدها» گروه `hall` را فقط برای *ثبت سالن زیر همان
  واحد* می‌پذیرد؛ خانهٔ نوع‌های سالن با `FARM_GROUP_HOME_PANEL` همیشه
  «سالن‌ها» است.

---

## ۹) فایل‌های این موج

| فایل | تغییر |
|---|---|
| `Frontend/src/pages/portal.html` | حذف شیت · میزبان + پارکینگ + پنج جایگاه · لینک سه CSS تازه · Chart.js + `portal.charts.js` |
| `Frontend/src/features/portal/portal.farm.js` | شیت ⇒ فرم درون‌خطی (`bindInlineForm`/`openRequestForm`/`mount…`/`markFarmTarget`) · `scope` در `renderFarm` · `groups` در `loadFarm` |
| `…/portal.farm.rules.js` | `FARM_PANEL_GROUPS` · `FARM_GROUP_HOME_PANEL` · `FARM_GROUP_KEYS` · `farmGroupsOfPanel` · `farmPanelOfType` · `farmDefaultTypeOfPanel` · `farmTypeAllowedInPanel` |
| `…/portal.farm.renderer.js` | پارامتر `scope` در `renderFarmPanel`/`groupedTabsHtml` |
| `…/portal.views.js` | `openRequestForm` با `panel`/`accId`/`origin` از خود دکمه · `decorateTables` در پایان دوره/گزارش نهایی |
| `…/portal.service.js` | `bindInlineForm` · بستن فرم با تغییر بخش · `resizeCharts` · `renderChart` با fallback |
| `…/portal.extra.js` | نمودارهای live داشبورد/استاندارد + `destroyChartsIn` + `decorateTables` جدول مقایسه |
| `…/portal.api.js` | `groups` ⇒ `group` در `getFarmRequests` (فقط کلیدهای مجاز) |
| `…/portal.css` | حذف کامل بلوک `.portal-sheet*` و `body.portal-sheet-open` |
| `…/portal.inline.css` **تازه** | بلوک درون‌خطی، نوار دکمه، ردیف `is-target` — بدون `fixed`/قفل صفحه |
| `…/portal.charts.js` **تازه** | spec/mount/destroy/resize + پوستهٔ canvas + fallback |
| `…/portal.charts.css` **تازه** | جعبهٔ canvas با ارتفاع صریح + گرید داشبورد |
| `…/portal.responsive.css` **تازه** | لایهٔ ریسپانسیو/لمس/`dvh`/safe-area |
| `Backend/services/portalRequestRules.js` | `REQUEST_TYPE_GROUPS` · `REQUEST_GROUP_KEYS` · `groupOf` · `keysOfGroup` · `normalizeGroupFilter` |
| `Backend/services/portalRequestService.js` | `listMyRequests({ types })` + `countsOf(id, { types })` |
| `Backend/controllers/portalFarmController.js` | `group` از query ⇒ `types` + بازگرداندن `group` در پاسخ |
| `Frontend/portal-inline-forms-test.mjs` **تازه** | ۲۱ بررسی |
| `Frontend/portal-charts-test.mjs` **تازه** | ۲۴ بررسی |
| `Frontend/portal-tree-test.mjs` · `customer-portal-guard-test.mjs` | بررسی‌های معکوس/تازه |
| `Backend/portal-request-test.mjs` | +۳ بررسی گروه |
| `Frontend/package.json` · `tools/gate.mjs` · `tools/gate.ps1` | `test:portal-inline` · `test:portal-charts` (۵۳ گام) |
| `Frontend/README.md` · `Backend/README.md` | بخش ۱۳.۲۳ |
| `docs/REVIEW-WAVE-13.23.md` | همین سند |

---

## ۱۰) جمع‌بندی

- «مودال» دیگر در پورتال وجود ندارد: فرم **جزئی از همان بخش** است و با
  بستن، صفحه همان‌جا می‌ماند که بود.
- «چارت» دیگر یک SVG تزئینی نیست: همان Chart.js کارشناس، با tooltip
  فارسی، legend، ریسپانسیو و تم مشترک — و اگر کتابخانه نیاید، همان SVG
  قبلی برمی‌گردد.
- هیچ اندپوینت/کلید/مایگریشنی اضافه نشد؛ تنها قرارداد تازه، پارامتر
  اختیاری `group` است که نبودش همان رفتار ۱۳.۱۶ است.
- سه باگ ریسپانسیو واقعی (اسکرول افقی سه جدول) در ریشه بسته شد.
- دروازه: **۵۳ گام، GATE-PASS**.

