# بازبینی موج ۱۳.۲۱ — «آکاردئون، شیت درخواست و ارسال تیکت»

> ادامهٔ طبیعی ۱۳.۱۷ (ساخت ناوبری پورتال) و ۱۳.۱۸ (اسکیمای مشترک).
> سه منو کارِ پنل را انجام می‌دادند که خودشان پنل نبودند: «درخواست‌های من»
> فقط فرم‌های همان چهار مسیر `/farm/*` را باز می‌کرد، «ثبت هفته» زیرمنوی
> مستقل بود در حالی که «هفته‌های ثبت‌شده» همان پنل را داشت، و چهار مسیر
> «بخش سالن» هر کدام یک پنل جدا با صفحهٔ جدا بودند. این موج همهٔ آن‌ها را
> در **جای طبیعی‌شان** گذاشت و جای خالی منو را با پنل واقعی «ارسال تیکت» پر کرد.
>
> **۰ اندپوینت تازه · ۰ مایگریشن · ۰ ستون نو** — فقط شکل اعلام و لایهٔ UI.
> کلید مجوز: ۲۲۷ ⇒ **۲۲۵** (۴ کلید منو حذف، ۲ کلید تیکت اضافه).

---

## ۱) مسئله

| # | شکاف | اثر |
|---|---|---|
| ۱ | منوی «درخواست‌های من» یک **صفحهٔ مستقل** برای کاری بود که ماهیتش «اقدام روی یک ردیف» است | کاربر باید ردیف را در یک صفحه می‌دید، صفحه را عوض می‌کرد، نوع درخواست را از یک `<select>` انتخاب می‌کرد و هدف را دوباره پیدا می‌کرد ⇒ سه کلیک اضافه و یک انتخاب تکراری |
| ۲ | «ثبت هفته» زیرمنوی مستقل با پنل جدا بود | دو مسیر برای یک کار؛ پنل «هفته‌های ثبت‌شده» خودش دکمهٔ ثبت داشت |
| ۳ | چهار مسیر `#/farm/physical`، `#/farm/systems`، `#/farm/water-feed` و `#/farm/hygiene` هر یک یک پنل مستقل با فهرست سالن‌ها بودند | چهار بار همان فهرست، چهار بار صفحه‌عوض‌کردن، و پنل `hallDetail` به‌عنوان پنلِ شناسه‌دار (نزدیک‌ترین جا به IDOR) |
| ۴ | فهرست‌ها جدول‌های عریض بودند | روی موبایل اسکرول افقی؛ ستون‌ها بی‌نام وقتی از context بیرون می‌زدند |
| ۵ | جای «ارتباط با پشتیبانی» در پورتال خالی بود | مشتری برای هر پرسش باید از سایت اصلی استفاده می‌کرد |

ریشهٔ مشترک: **ساختار ناوبری از «صفحه» ساخته شده بود، نه از «موجودیت»** —
واحد، سالن، گله و هفته موجودیت‌اند؛ درخواست یک اقدام روی همان‌هاست.

---

## ۲) دامنه

| مورد | مقدار |
|---|---|
| اندپوینت تازه | **هیچ** — همان ۲۹ اندپوینت اسکیمای ۱۳.۱۸ (۲۲ خواندن + ۷ نوشتن) |
| مایگریشن | **هیچ** |
| کلید مجوز | ۲۲۷ ⇒ **۲۲۵** / همان ۱۸ گروه (۴ حذف، ۲ افزودن) |
| منو/مسیر/پنل | ۷ منو (بی‌تغییر) / **۲۸ ⇒ ۲۱** مسیر / **۱۴ ⇒ ۱۳** پنل — هشت مسیر حذف و یک مسیر (`#/tickets`) اضافه شد؛ پنل `hallDetail` و پنل `farm` حذف، پنل `tickets` تازه |
| فایل تازه (فرانت) | `portal.tree.js` · `portal.table.js` · `portal.tickets.js` · `portal-tree-test.mjs` |
| فایل تازه (بک‌اند) | **هیچ** |
| گارد | `test:portal-tree` تازه (**۳۱**) · `customer-portal` ۲۲۱ · `portal-menu` ۸۲ · `portal-schema-guard` ۳۰ |
| دروازه | ۴۹ ⇒ **۵۰ گام** — `GATE-PASS` |

---

## ۳) تغییرات بک‌اند — «اعلام»، نه «اجرا»

### ۳.۱) کلیدهای مجوز (`Backend/config/permissions.js`)

| تغییر | کلیدها |
|---|---|
| حذف (۴) | `customer.portal.menu.requests` · `customer.portal.menu.requests.new` · `customer.portal.menu.requests.list` · `customer.portal.menu.weekly.create` |
| افزودن (۲) | `customer.portal.menu.tickets` (لایهٔ منو) و `customer.portal.tickets` (لایهٔ محتوا) |
| برچسب‌ها | برچسب چهار کلید گیت‌بخش سالن (`farm.physical`، `farm.systems`، `farm.waterFeed`، `farm.hygiene`) از «مسیر بخش سالن» به «گیت بخش آکاردئون سالن» بازنویسی شد — کلیدها ماندند، نقششان عوض شد |
| نتیجه | **۲۲۵** کلید / ۱۸ گروه؛ پیش‌فرض هر دو کلید تازه «فقط مشتری» و بدون `lockedTo` |

> کلیدهای گیت‌بخش سالن عمداً **حذف نشدند**: همان‌ها تعیین می‌کنند یک بخش از
> آکاردئون سالن دیده شود یا نه (`hallSectionsAllowed()`)، و سرور همان‌ها را
> در `GET /portal/farm/halls/:id` اجرا می‌کند.

### ۳.۲) اسکیما (`Backend/config/portalSchema.js`)

| مورد | قبل | بعد |
|---|---|---|
| پنل `farm` | پنل واقعی با `route: "#/requests"` | حذف شد؛ جایش صف تازهٔ `PORTAL_SHEETS` با id `farm` (بدون `route`/`menuKeys`) |
| پنل `hallDetail` | پنل با `menuKeys` چهارگانه | حذف شد؛ `FARM_HALL_DETAIL.panel` ⇒ `"halls"` (پاسخ همان پنل سالن‌ها را تغذیه می‌کند) |
| پنل `tickets` | — | تازه: `route: "#/tickets"`، `menuKeys: ["customer.portal.menu.tickets"]`، `content: { keys: [KEYS.TICKETS] }` |
| قابلیت‌ها | — | `PORTAL_FEATURES` یک ردیف `tickets` گرفت (سرور از «پنل باز + کلید» می‌سازد) |
| شمارنده‌ها | `PORTAL_TOTALS` بدون شیت | `sheets` اضافه شد و `PANELS_BY_ID` هم شیت‌ها را می‌شناسد |

```js
// شیت = کارِ پنل را می‌کند ولی پنل نیست: نه مسیر دارد نه آیتم منو
const PORTAL_SHEETS = [
  {
    id: "farm",
    title: "ثبت درخواست",
    route: "",            // ← هیچ هش/بوکمارکی به آن نمی‌رسد
    menuKeys: [],         // ← دیده‌شدنش با دکمهٔ همان ردیف است
    content: { keys: [KEYS.FARM], mode: "any" },
    status: "live",
    note: "شیت contextual: نوع/هدف از دکمهٔ همان ردیف می‌آید، نه از URL",
  },
];
```

🔒 چرا «شیت» و نه «پنل»: پنل در این پروژه *همیشه* یک `route` و یک `menuKey`
دارد و گاردهای ۱۳.۱۷ همین را می‌سنجند. شیت هیچ‌کدام را ندارد ⇒ نه در
`PORTAL_ROUTE_LIST` ظاهر می‌شود، نه در آکاردئون منو، و نه راهی برای رسیدن با
لینک مستقیم به آن وجود دارد.

### ۳.۳) روتر — بدون تغییر

`Backend/routes/portalRoutes.js` دست‌نخورده ماند: هویت پنل در اسکیما زندگی
می‌کند نه در روتر. `chainFor("FARM_HALL_DETAIL")` همان زنجیره را می‌سازد و
تنها تغییر این بود که `FARM_HALL_DETAIL.panel` حالا `"halls"` است؛ هیچ
مسیر، میدل‌ور یا لیمیت‌ری لمس نشد.

> این «عدم تغییر» عمدی است و خودش یک ادعا را اثبات می‌کند: اسکیمای ۱۳.۱۸
> واقعاً تنها منبع حقیقت است — با عوض شدن ساختار ناوبری، صفر خط در روتر
> عوض شد.

---

## ۴) تغییرات فرانت

### ۴.۱) منو (`portal.menu.js`)

```
داشبورد            #/dashboard            (+ نمودارها · مقایسهٔ گله‌ها)
پروندهٔ من          #/profile              (+ پروفایل من · مدارک من)
واحدهای من          #/farm                 (+ واحدها · سالن‌ها)      ← نام تازه
جوجه‌ریزی           #/hatchery             (+ گله‌های من · دوره‌ها · ضدعفونی · پایان دوره)
مدیریت هفتگی        #/weekly               (+ هفته‌های ثبت‌شده · نمودار روند)
ارسال تیکت          #/tickets              ← تازه (تک‌صفحه، بدون زیرمنو)
گزارش‌ها            #/reports              (+ بازدیدها · گزارش نهایی)
```

`PORTAL_MENUS` هفت منو دارد؛ `PORTAL_ROUTE_LIST` بیست‌و‌یک مسیر (سه مسیر
`#/requests*`، یک مسیر `#/weekly/new` و چهار مسیر بخش سالن حذف شدند) و
`PORTAL_MENU_PANELS` سیزده پنل.

**لینک‌های قدیمی** — `PORTAL_LEGACY_HASH` (هشت کلید):

```js
export const PORTAL_LEGACY_HASH = Object.freeze({
  "#/requests": "#/farm/units",
  "#/requests/new": "#/farm/units",
  "#/requests/list": "#/farm/units",
  "#/weekly/new": "#/weekly/list",
  "#/farm/physical": "#/farm/halls",
  "#/farm/systems": "#/farm/halls",
  "#/farm/water-feed": "#/farm/halls",
  "#/farm/hygiene": "#/farm/halls",
});
```

`resolveRoute` اول `legacyRoute` را می‌خواند، بعد alias/deny/fallback را.
هیچ شناسهٔ ردیفی از URL خوانده نمی‌شود؛ `parseHash("#/farm/units/12")`
همچنان `null` است (همان قاعدهٔ ضد IDOR موج ۱۳.۱۷).

### ۴.۲) درخت و آکاردئون (`portal.tree.js` — خالص)

| تابع | کار |
|---|---|
| `buildUnitTree(options)` | واحد ← سالن از پاسخ `/portal/farm/options`؛ **ترتیب سرور** حفظ می‌شود، سالن بی‌والد/خارج از سقف حذف می‌شود، سقف `TREE_MAX_ITEMS = 60` در هر سطح |
| `groupPlacementsByFlock(placements)` | گروه‌بندی دوره‌ها بر اساس شمارهٔ گله |
| `groupWeeksByFlock(weeks)` | گروه‌بندی هفته‌ها بر اساس شمارهٔ گله |
| `pendingByTarget(requests)` | `{ [targetId]: true }` برای نشان‌دادن «در انتظار» روی همان ردیف |
| `treeAccordion({ id, title, meta, level, open, body })` | `<details>` بومی + همهٔ متن‌ها با `treeEsc` |
| `treeTotals(tree)` | شمارش واحد/سالن برای خلاصه |

این فایل **هیچ import و هیچ DOM‌ای** ندارد تا گارد بتواند بدون jsdom اجرایش
کند (همان الگوی «خالص‌سازی» موج ۱۳.۱۷ برای `portal.menu.js`).

`renderUnitsView`، `renderWeeksTree` و `renderFlocksTree` روی همین توابع
ساخته شده‌اند؛ درخت معتبر است (`<ul>` ← `<li>` ← `<details>`) و هر ردیف
دکمهٔ شیت دارد.

### ۴.۳) شیت درخواست (`portal.farm.js` + `portal.html`)

```html
<div class="portal-sheet" id="portalRequestSheet" data-portal-sheet="requests" hidden>
  <div class="portal-sheet__backdrop" data-sheet-close="1"></div>
  <div class="portal-sheet__dialog" role="dialog" aria-modal="true" …>
    <div class="portal-sheet__head">… <button data-sheet-close="1">…</button></div>
    <div class="portal-tab__status" id="portalFarmStatus"></div>
    <div class="portal-farm" id="portalFarmBody"></div>   <!-- همان body ۱۳.۱۶ -->
  </div>
</div>
```

| متد | کار |
|---|---|
| `openRequestSheet(rawType, rawTargetId)` | فقط نوع‌های شناخته‌شدهٔ `farmSpecOf(type)`؛ گیت `canRequestFarm()`؛ پر کردن نوع و هدف از همان ردیف |
| `closeRequestSheet()` | `hidden = true` + حذف `body.portal-sheet-open` |
| `isRequestSheetOpen()` | برای تصمیم کلید Escape |
| `bindRequestSheet()` | کلیک `[data-farm-action]`، بستن با backdrop/دکمه، Escape، و بازگرداندن فوکوس |

🔒 ساختار داخلی عیناً همان `portalFarmStatus`/`portalFarmBody` موج ۱۳.۱۶
است ⇒ اعتبارسنجی، لیمیتر، پیام‌های خطا و «لغو درخواست» بدون یک خط تغییر
کار می‌کنند. تفاوت فقط این است که **نوع و هدف** از دکمهٔ ردیف می‌آید، نه
از `<select>` کاربر — یعنی انتخاب تکراری حذف شد و مسیر تازه‌ای هم باز نشد.

### ۴.۴) سالن‌ها — آکاردئون تنبل (`portal.views.js`)

| قبل | بعد |
|---|---|
| فهرست صفحه‌بندی‌شدهٔ سالن‌ها + پنل `hallDetail` با شناسه در هش | آکاردئون تودرتو: سالن ← چهار بخش؛ جزئیات **فقط با باز شدن** گرفته می‌شود (`ensureHallDetail(rawId)` — یک بار برای هر سالن) |
| بخش‌ها با مسیر جدا انتخاب می‌شدند | `hallSectionsAllowed()` گیت هر بخش را از پرچم‌های سرور می‌خواند؛ بدون مجوز ⇒ پیام قفل، نه درخواست اضافه |
| `#/farm/halls/7` در هش | هیچ شناسه‌ای در هش نیست؛ `hallNodeOf()` شناسه را از همان فهرست `halls` می‌گیرد (ضد IDOR) |

`VIEW_TABS` هفت کلید دارد (`units`، `halls`، `placements`، `soon`،
`completion`، `finalReport`، `tickets`) و `hallDetail` **دیگر وجود ندارد**؛
`applyRouteView` برای `farmType` به‌جای عوض‌کردن پنل، `openRequestSheet`
صدا می‌زند. هفته‌ها و گله‌ها پنل `VIEW_TABS` نمی‌خواهند: رندرشان در
`SECTION_CONF` سرویس به `renderWeeksTree`/`renderFlocksTree` سپرده شد.

### ۴.۵) پنل «ارسال تیکت» (`portal.tickets.js`)

| موضوع | مقدار |
|---|---|
| زیرساخت | همان `Suggestion`/`SuggestionMessage` و همان `messagesApi`/`/api/suggestions*` — سامانهٔ دوم ساخته نشد |
| تب | `TICKETS_TAB = { permission: "customer.portal.menu.tickets", requires: "customer.portal.tickets", bodyId: "portalTicketsBody", … }` |
| گیت | اول `features.tickets` (سرور)، بعد همان کلید در مرورگر (fallback برای پاسخ کش‌شده) |
| فرم | بدون `<form>`؛ همهٔ دکمه‌ها `type="button"`؛ سقف‌های سرور در کلاینت: عنوان ≤۱۵۰، متن ≤۲۰۰۰ و ≥۵ نویسه |
| موضوع‌ها | همان پنج مقدار مجاز سرور: پیشنهاد · پرسش · شکایت · مشکل فنی · سایر |
| گفتگو | `sendTicketReply` شناسه را فقط از `state.threadId` (که خودش از ردیف فهرست آمده) می‌پذیرد؛ هیچ `customer_id`/`user_id` فرستاده نمی‌شود |
| وضعیت | `new` · `in_progress` · `answered` · `closed` با برچسب فارسی و نقطهٔ «پاسخ خوانده‌نشده» |

⚠️ **گیت سرور عمداً به تعویق افتاد**: `/api/suggestions` امروز فقط
`protect` دارد (چون مودال هدر برای کارشناس/ادمین هم هست). در این موج فقط
«دیده‌شدن» در پورتال کنترل می‌شود؛ **گیت سرور برای ۱۳.۲۲** ثبت شد (تصمیم C).

### ۴.۶) جدول ریسپانسیو (`portal.table.js` + `portal.css`)

```js
// decorateTables: فقط attribute — هیچ innerHTML
table.dataset.cards = "1";
cell.dataset.label = headerText; // برای هر td بر اساس سرستون همان ستون
```

`idempotent` است (دو بار اجرا = یک بار) و روی ورودی نامعتبر بی‌اثر. در CSS:

```css
@media (max-width: 640px) {
  table.portal-table[data-cards="1"] tr { display: grid; /* … */ }
  table.portal-table[data-cards="1"] td::before { content: attr(data-label); /* … */ }
}
```

⇒ هیچ `overflow-x` افقی روی موبایل نمی‌ماند و هر «سلول» نام ستون خودش را
بالای سر دارد.

---


## ۵) گاردها — چیزی «شل» نشد

### ۵.۱) گارد تازهٔ `Frontend/portal-tree-test.mjs` (۳۱ بررسی)

| گروه | نمونهٔ بررسی |
|---|---|
| خلوص | `portal.tree.js` هیچ `import`/`document`/`fetch` ندارد؛ `portal.table.js` هیچ `innerHTML` نمی‌سازد |
| درخت | ترتیب سرور حفظ می‌شود، سالن بی‌والد حذف، سقف ۶۰ واحد، `treeTotals` درست |
| آکاردئون | `<details>` بومی، `level` و `open`، escape کامل پنج کاراکتر خطرناک |
| جدول | `data-label` روی هر `td`، `data-cards="1"` روی جدول، idempotent، ورودی نامعتبر بی‌اثر |
| نماها | اجرای واقعی `renderUnitsView` · `renderHallsAccordion` · `renderWeeksTree` · `renderFlocksTree` · `renderPlacementsView` · `renderTicketsView` · `renderTicketThread` |
| گیت‌ها | سالن بدون بخش مجاز ⇒ پیام قفل؛ تیکت بدون مجوز ⇒ فرم قفل؛ سقف ۱۵۰/۲۰۰۰ در کلاینت |
| امنیت | شناسهٔ گفتگو فقط از فهرست خودِ سرور؛ هیچ `parseHash`/`location.hash` در تیکت |
| منو | ۷/۲۱/۱۳ · هشت لینک قدیمی · `parseHash("#/farm/units/12") === null` |
| ثبت | `test:portal-tree` در `package.json` و هر دو `gate.mjs`/`gate.ps1` |

### ۵.۲) گاردهای به‌روزشده

| گارد | تغییر |
|---|---|
| `portal-menu-guard-test.mjs` | ۷ منو / ۲۱ مسیر / ۱۳ پنل / ۵ alias / ۲۱ contentKey؛ بررسی آکاردئون واحد/سالن؛ `VIEW_TABS` هفت کلید؛ `resolveRoute` با لینک قدیمی ⇒ **۸۲** بررسی |
| `customer-portal-guard-test.mjs` | `portalHallsBody` + پنل `halls` به‌جای `hallDetail`؛ `SECTION_CONF` روی `flocks`/`weeks`/`visits`؛ شیت به‌جای پنل `farm`؛ کاتالوگ ۲۲۵ ⇒ **۲۲۱** بررسی |
| `portal-schema-guard-test.mjs` | ۷/۲۱/۱۳، `TICKETS_TAB` در `VIEW_TABS`، ۳۰ بررسی |
| `Backend/portal-schema-test.mjs` | ۱۳ پنل + **۱ شیت** (با `route: ""` و `menuKeys: []`) ⇒ **۴۷** |
| `Backend/permissions-test.mjs` | ۲۲۵/۱۸ و ۲۵ کلید `customer.portal.menu.*` ⇒ **۳۴** |
| `Backend/portal-completion-test.mjs` | انتظار شمارش ۲۲۷ ⇒ ۲۲۵ ⇒ **۳۱** |

هیچ بررسی‌ای حذف نشد؛ بررسی‌هایی که به ساختار حذف‌شده اشاره می‌کردند
**معکوس** شدند (مثلاً «`data-portal-panel="farm"` نباید باشد»).

---


## ۶) آزمون‌ها

| فرمان | نتیجه |
|---|---|
| `node tools/gate.mjs` | **GATE-PASS** — ۵۰ گام، همه `exit=0` |
| `cd Frontend && npm run test:portal-tree` | **۳۱/۳۱** (تازه) |
| `cd Frontend && npm run test:portal-menu` | **۸۲/۸۲** |
| `cd Frontend && npm run test:customer-portal` | **۲۲۱/۲۲۱** |
| `cd Frontend && npm run test:portal-schema-guard` | **۳۰/۳۰** |
| `cd Frontend && npm run test:portal-requests` | **۳۵/۳۵** |
| `cd Frontend && npm run test:farm-write` | **۳۹/۳۹** |
| `cd Backend && npm run test:portal-schema` | **۴۷/۴۷** |
| `cd Backend && npm run test:portal-completion` | **۳۱/۳۱** |
| `cd Backend && npm run test:permissions` | **۳۴/۳۴** (۲۲۵ کلید / ۱۸ گروه) |
| `cd Frontend && npm run lint` | **exit=0** |
| `cd Frontend && npm run lint:guards` | **exit=0** — صفر هشدار (`--max-warnings=0`) |
| `cd Frontend && npm run audit:surface` | **exit=0** — قرارداد فراخوانی سرویس‌ها |
| `cd Frontend && npm run audit:big-methods` | **exit=0** |

---

## ۷) نکات و ریسک‌ها

| # | نکته | چرا مهم است |
|---|---|---|
| ۱ | «ارسال تیکت» امروز فقط **گیت نمایش** دارد | `/api/suggestions` برای مودال هدر هم استفاده می‌شود و فعلاً فقط `protect` دارد؛ گیت سرور در **۱۳.۲۲** (تصمیم C). تا آن زمان کلید `customer.portal.tickets` فقط UI را می‌بندد |
| ۲ | شیت هیچ مسیری ندارد | اگر روزی کسی خواست با لینک به شیت برسد، باید اول یک مسیر امن با `farmType` در `PORTAL_ROUTES` تعریف شود — عمداً همین‌طور ماند |
| ۳ | `decorateTables` بعد از هر رندر لازم است | چون فقط attribute می‌گذارد، اجرای دوباره بی‌خطر است؛ در `renderTicketsView`/`renderPlacementsView`/`loadHallsView` صدا زده می‌شود |
| ۴ | آکاردئون «تنبل» است | جزئیات هر سالن یک بار گرفته و کش می‌شود؛ باز/بسته کردن دوباره درخواست نمی‌فرستد (`ensureHallDetail`) |
| ۵ | `HALL_SECTION_LABELS` ماند | برچسب چهار بخش از یک منبع می‌آید؛ فقط جای نمایشش از «پنل» به «آکاردئون» رفت |
| ۶ | شمارندهٔ کلید در سه گارد | `permissions-test` (۲۲۵/۱۸)، `portal-completion` (۲۲۵) و `customer-portal` (کاتالوگ ۲۲۵) باید هم‌زمان عوض شوند — فراموشی هر کدام ⇒ FAIL صریح |
| ۷ | بک‌اند دست‌نخورده | `portalSchema.js` تنها منبع حقیقت ماند؛ شیت هم در همان اسکیما اعلام شد تا «مسیرهای بی‌پنل» صفر بماند |

---


## ۸) فایل‌های این موج

| فایل | تغییر |
|---|---|
| `Backend/config/permissions.js` | حذف ۴ کلید منو، افزودن ۲ کلید تیکت، بازنویسی برچسب گیت‌بخش‌ها (⇒ ۲۲۵/۱۸) |
| `Backend/config/portalSchema.js` | `KEYS.TICKETS` · پنل `tickets` · حذف پنل `farm`/`hallDetail` · `PORTAL_SHEETS` · `PORTAL_TOTALS.sheets` |
| `Backend/permissions-test.mjs` · `portal-schema-test.mjs` · `portal-completion-test.mjs` | شمارش‌ها و بررسی شیت |
| `Frontend/src/features/portal/portal.menu.js` | منوی تازه، حذف سه منو/چهار مسیر، `PORTAL_LEGACY_HASH`/`legacyRoute` |
| `Frontend/src/features/portal/portal.tree.js` | **تازه** — درخت/گروه‌بندی/آکاردئون خالص |
| `Frontend/src/features/portal/portal.table.js` | **تازه** — `decorateTables` (فقط attribute) |
| `Frontend/src/features/portal/portal.tickets.js` | **تازه** — پنل تیکت (فهرست/گفتگو/ارسال/پاسخ) |
| `Frontend/src/features/portal/portal.views.js` | `VIEW_TABS` تازه، `renderUnitsView`/`renderHallsAccordion`/`renderWeeksTree`/`renderFlocksTree`، حذف مسیر `hallDetail` |
| `Frontend/src/features/portal/portal.farm.js` | شیت: `bindRequestSheet`/`openRequestSheet`/`closeRequestSheet` |
| `Frontend/src/features/portal/portal.service.js` | `initTickets`/`bindTickets`، `SECTION_CONF` هفته/گله با درخت، `bindRequestSheet` |
| `Frontend/src/features/portal/portal.css` | ~۶۰۰ خط: آکاردئون، شیت، تیکت، جدول کارتی زیر ۶۴۰px |
| `Frontend/src/pages/portal.html` | حذف چهار لینک بخش سالن/«ثبت هفته»/منوی درخواست‌ها، شیت درخواست، پنل تیکت، بدنهٔ آکاردئون سالن‌ها |
| `Frontend/portal-tree-test.mjs` | **تازه** — گارد ۳۱ بررسی |
| `Frontend/portal-menu-guard-test.mjs` · `customer-portal-guard-test.mjs` · `portal-schema-guard-test.mjs` | به‌روزرسانی ساختار تازه |
| `Frontend/package.json` · `tools/gate.mjs` · `tools/gate.ps1` | ثبت `test:portal-tree` (⇒ ۵۰ گام) |
| `Frontend/README.md` · `Backend/README.md` | بخش موج ۱۳.۲۱ |
| `docs/REVIEW-WAVE-13.21.md` | همین سند |

---

## ۹) جمع‌بندی

- **اقدام سر جای خودش نشست**: درخواست دیگر یک صفحهٔ مستقل نیست؛ دکمهٔ همان
  ردیف است و نوع/هدف از قبل انتخاب شده‌اند (`data-farm-action`).
- **یک منو آزاد شد و با پنل واقعی پر شد**: «ارسال تیکت» روی همان
  `Suggestion`/`SuggestionMessage` سوار شد — صفر جدول، صفر اندپوینت.
- **ناوبری از «موجودیت» ساخته شد**: واحد ← سالن، گله ← دوره/هفته، با
  بارگذاری تنبل و گیت هر بخش؛ پنل شناسه‌دار `hallDetail` حذف شد.
- **جدول‌ها روی موبایل کارت می‌شوند**: `data-label` + `data-cards="1"` ⇒
  اسکرول افقی صفر.
- **هیچ‌چیز شل نشد**: ۳۱ بررسی تازه، ۴ گارد به‌روز، کلید ۲۲۵/۱۸، دروازهٔ
  ۵۰ گامی سبز.

