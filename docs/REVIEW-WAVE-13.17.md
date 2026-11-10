# بازبینی موج ۱۳.۱۷ — پوستهٔ ناوبری «منو + زیرمنو» در پورتال مشتری

> ادامهٔ مستقیم ۱۳.۱۶: پس از آن موج، همهٔ ۱۸ نوع درخواست فرم و نمایش خوانا
> داشتند، ولی **خودِ پورتال** هنوز یک صفحهٔ تک‌تبی بود؛ مشتری برای دیدن
> «سالن‌ها» باید کارت‌های فارم را اسکرول می‌کرد و آدرسی برای اشتراک‌گذاری
> وجود نداشت. ۱۳.۱۷ همین را به یک پوستهٔ ناوبری واقعی تبدیل می‌کند:
> **۷ منو · ۲۱ زیرمنو · ۲۸ مسیر · ۱۲ پنل** — بدون یک اندپوینت یا نوع
> درخواست تازه.

---

## ۱) مسئله

| # | شکاف | اثر |
|---|---|---|
| ۱ | همهٔ پورتال در یک فهرست تب افقی + کارت‌های پشت‌سرهم | رسیدن به «جزئیات سالن» فقط با اسکرول طولانی و گم‌شدن زمینه |
| ۲ | آدرس صفحه مسیر نداشت (`#` خالی) | رفرش، back/forward و «این لینک را ببین» کار نمی‌کرد |
| ۳ | نوار تب افقی در موبایل بیرون از کادر | دسترسی به تب‌های آخر عملاً ناممکن بود |
| ۴ | مجوز «دیده‌شدن منو» و مجوز «دادهٔ سرور» دو چیز جدا بود | می‌شد لینکی دید که با کلیک ۴۰۳ می‌گیرد (یا پنل خالی) |
| ۵ | ۲۸ آیتم تازه باید از پنل مدیریت باز/بسته شود | بدون کلید، مدیر نمی‌توانست «سالن‌ها» را ببندد و «واحدها» را باز بگذارد |

---

## ۲) مدل منو — یک قرارداد خالص (`portal.menu.js`)

| مورد | مقدار |
|---|---|
| فایل | `Frontend/src/features/portal/portal.menu.js` (تازه) |
| درخت | `PORTAL_MENUS` = ۷ منو (داشبورد، پروندهٔ من، مزرعهٔ من، جوجه‌ریزی، مدیریت هفتگی، درخواست‌های من، گزارش‌ها) |
| زیرمنو | ۲۱ آیتم ⇒ **۲۸ مسیر** در `PORTAL_ROUTES` |
| پنل‌ها | ۱۲ پنل یکتا در `PORTAL_MENU_PANELS` = دقیقاً `data-portal-panel` های `portal.html` |
| alias | ۶ منو (پرونده/مزرعه/جوجه‌ریزی/هفتگی/درخواست/گزارش) ریشهٔ مستقل ندارند و به اولین زیرمنوی مجاز می‌روند |
| خالص بودن | نه DOM، نه `import` ⇒ گارد تست همان مدل را در Node **اجرا** می‌کند (الگوی `portal.farm.rules.js`) |

هر ردیف مسیر یک شیء با کلیدهای ثابت است:

```js
{
  route: "#/farm/units",
  menuId: "farm", itemId: "units",
  label: "واحدها", menuLabel: "مزرعهٔ من",
  panel: "units",              // پنل مقصد در HTML
  key: "customer.portal.menu.farm.units", // لایهٔ منو (دیده‌شدن)
  contentKey: "customer.portal.farm",     // لایهٔ محتوا (همان کلید سرور)
  section: "", farmType: "", anchor: "", focus: "", alias: false,
}
```

---

## ۳) مسیر امن — ضد IDOR

`normalizeHash` → `parseHash` → `resolveRoute`. هیچ بخشی از URL به‌عنوان
شناسهٔ ردیف/مشتری تفسیر نمی‌شود؛ **حداکثر دو بخش** مجاز است:

| ورودی | نتیجه |
|---|---|
| `#/farm/units` | `#/farm/units` |
| `#/FARM/HALLS` | `#/farm/halls` |
| `#//farm//halls` | `#/farm/halls` |
| `#/farm/units/12` | `null` (سه بخش ⇒ عمق غیرمجاز) |
| `#/farm/units?customer_id=5` | `null` (پارامتر آزاد پذیرفته نمی‌شود) |
| `""` یا `#/x/y` | `#/dashboard` (پیش‌فرض) |
| `#/farm` با مجوز کامل | `#/farm/units` (alias) |
| `#/farm` و بسته‌بودن `customer.portal.farm` | `#/farm/halls` (اولین مجاز همان منو) |
| هیچ مسیری مجاز نیست | `""` ⇒ پوسته پیام «هیچ بخشی برای شما باز نیست» می‌دهد |

---

## ۴) دو لایهٔ کلید: منو و محتوا

| مورد | مقدار |
|---|---|
| کلیدهای تازه | **۲۸** کلید `customer.portal.menu.*` (۱۹۷ ⇒ **۲۲۵** کلید، همان **۱۸** گروه، گروه «portal») |
| پیش‌فرض | `customer: true` و سایر نقش‌ها `false` (هم‌الگو با `customer.portal.view`) |
| قفل‌شدگی | هیچ کلید منویی `lockedTo` ندارد ⇒ مدیر می‌تواند هر آیتم را باز/بسته کند |
| `contentKey` | همان کلیدی که **سرور** اجرا می‌کند (`customer.portal.farm/halls/flocks/weeks/visits/profile/documents/dashboard`) |
| سه بخش «به‌زودی» | `contentKey` **خالی** و `panel: "soon"` — صادقانه: اندپوینتی وجود ندارد و دادهٔ ساختگی هم نشان داده نمی‌شود |

ترتیب تصمیم در `menuAllowed(entry)`:

1. `contentKey` بسته باشد ⇒ پنهان (حتی اگر منو باز باشد)
2. پنل مقصد برای این کاربر باز نباشد (`canSee(panel)`) ⇒ پنهان
3. کلید منو بسته باشد ⇒ پنهان
4. کلید منو **ناشناخته** باشد (کاربری که صفحه را قبل از دیپلوی باز کرده) ⇒ `menuFallbackMode()` و قضاوت با لایهٔ محتوا ⇒ «منوی خالی هرگز»

بستن منو دسترسی داده را باز نمی‌کند و بازکردن منو هم داده نمی‌دهد؛ دو لایه مستقل‌اند.

---

## ۵) پوسته — `portal.shell.js`

| قابلیت | جزئیات |
|---|---|
| hash routing | `#/<menu>/<item>` ⇒ `activateTab(entry.panel)` + `applyRouteView(entry)`؛ بدون reload |
| back/forward | `window.addEventListener("hashchange")` ⇒ همان `activateRoute` (با نادیده‌گرفتن حالت `loading/unlinked`) |
| اصلاح URL | ریشهٔ alias یا مسیر ناشناخته با `history.replaceState` به مسیر واقعی تبدیل می‌شود (بدون ورودی تاریخچهٔ اضافه) |
| ناوبری فعال | `is-active` + `aria-current="page"` + آکاردئون منوی باز + عنوان صفحه (`document.title`) |
| drawer موبایل | `portalNavToggle` · `portalNavBackdrop` · `Escape` · بستن خودکار پس از هر مسیر (`closeNav`) |
| کلیک لینک | `preventDefault` + `goToRoute` تا کلیک روی مسیر فعلی هم drawer را ببندد و تاریخچه شلوغ نشود |
| بدون درخواست | این فایل هیچ `portalApi`/`fetch`/`localStorage` ندارد (گارد می‌سنجد) |

---

## ۶) نماهای خواندنی — `portal.views.js`

| پنل | منبع داده | نکته |
|---|---|---|
| `units` | `GET /portal/farm/options` (`units[]`) | کارت واحد: تعداد سالن، ظرفیت، مدیر، تلفن، مختصات، وضعیت |
| `hallDetail` | `GET /portal/farm/halls/:id` | چهار بخش: فیزیکی · سیستم‌ها · آب‌خوری/دان‌خوری · بهداشت؛ انتخابگر سالن + جدول فیلدها |
| `placements` | `options` + `GET /portal/farm/placements/:id` | فهرست دوره‌ها + جدول هفته‌های ثبت‌شده |
| `soon` | — | سه مسیر `#/hatchery/hygiene` · `#/hatchery/completion` · `#/reports/final` با متن «چه چیزی نیست و کِی می‌آید» |

قواعد سخت:

- **فقط سه GET** — هیچ POST/PATCH/DELETE و هیچ `fetch` خام (گارد شمارش می‌کند).
- برچسب فیلدها از `portal.payload.js` (`PAYLOAD_LABEL`/`PAYLOAD_KIND`/`dictionaryNameOf`) و فهرست هر بخش از `farmSpecOf` می‌آید ⇒ **یک منبع برچسب** با فرم‌های ۱۳.۱۶.
- شناسهٔ سالن/دوره فقط از پاسخ همان GET می‌آید (نه از URL) و با `rowId` در `portal.api` اعتبارسنجی می‌شود.
- همهٔ مقادیر escape می‌شوند (تست اجرای واقعی با `<script>`/`<img onerror>`).

---

## ۷) سیم‌کشی سرویس

| مورد | جزئیات |
|---|---|
| ثبت تب‌ها | `Object.assign(EXTRA_TABS, DOCUMENT_TABS, FARM_TABS, VIEW_TABS)` پیش از ساخت `ALL_TAB_KEYS` |
| ترتیب mixin | `applyPortalFarm` ⇒ `applyPortalViews` ⇒ `applyPortalShell` (هر کدام `loadExtraTab`/`activateRoute` لایهٔ قبل را واگذار می‌کند) و هر سه **پیش از** `new PortalService()` |
| پس از `getSummary` | `applyTabVisibility()` ⇒ `applyMenuVisibility()` ⇒ اگر منویی باز بود `activateRoute(parseHash(hash))`؛ وگرنه همان رفتار ۱۳.۵ (اولین تب مجاز) |
| تب‌های کلاسیک | لینک‌های ناوبری هم `data-portal-tab` دارند ⇒ `applyTabVisibility`/`setTabsEnabled` بدون تغییر کار می‌کنند؛ اما `bindTabs` صریحاً `data-portal-route` را رد می‌کند تا کلیک دوباره پردازش نشود |
| حالت بسته | `setTabsEnabled(false)` حالا `#portalNav` را هم پنهان می‌کند |

---

## ۸) استایل — `portal.nav.css`

۳۶۰ خط CSS جدا از `portal.css` (که گارد ۱۳.۳ اندازه‌اش را می‌سنجد):
سایدبار ثابت در دسکتاپ (`min-width: 1025px`)، drawer + backdrop + همبرگری زیر آن،
`@media (prefers-reduced-motion: reduce)` برای احترام به تنظیم حرکت،
حالت‌های `is-active`/`is-open`/`--soon` و بدنهٔ قفل‌شدهٔ اسکرول (`portal-nav-open`).

---

## ۹) آزمون‌ها

| آزمون | مقدار |
|---|---|
| `npm run test:portal-menu` (تازه) | **۷۷** بررسی — شامل اجرای واقعی مدل مسیر، رندر چهار نما، پوستهٔ مجوز/مسیر (با نمونهٔ جعلی) و بارگذاری نمونهٔ سرویس |
| `npm run test:customer-portal` | ۲۲۰ بررسی (بدون تغییر ساختار؛ فقط انتظار شمارش کلید ۱۹۷ ⇒ ۲۲۵) |
| `npm run test:permissions` | ۲۲۵ کلید / ۱۸ گروه |
| `npm run gate` | `test:portal-menu` به هر دو runner (`tools/gate.mjs` و `tools/gate.ps1`) اضافه شد |

نمونهٔ بررسی‌های کلیدی گارد تازه:

- برابری دقیق `PORTAL_ROUTE_LIST` با `data-portal-route` های HTML (۲۸ = ۲۸)
- برابری `PORTAL_MENU_PANELS` با `data-portal-panel` های HTML (۱۲ = ۱۲) و `data-portal-tab` هر لینک با `panel` همان مسیر
- رد شدن `#/farm/units/12` و `#/farm/units?customer_id=5` (ضد IDOR)
- پنهان‌شدن آیتم وقتی `contentKey` بسته است، و fail-open وقتی `permissionService` در دسترس نیست
- نبود `POST/PATCH/PUT/DELETE` و نبود `fetch` در نماها؛ فقط سه GET
- escape شدن دادهٔ سالن و نبود دادهٔ ساختگی در «به‌زودی»

---

## ۱۰) فایل‌ها

| فایل | وضعیت |
|---|---|
| `Frontend/src/features/portal/portal.menu.js` | تازه — مدل درخت + جدول مسیر + کمکی‌های خالص |
| `Frontend/src/features/portal/portal.views.js` | تازه — چهار پنل تازه (mixin) |
| `Frontend/src/features/portal/portal.shell.js` | تازه — ناوبری/hash/drawer (mixin) |
| `Frontend/src/features/portal/portal.nav.css` | تازه — استایل سایدبار و drawer |
| `Frontend/src/features/portal/portal.service.js` | import ها، ثبت `VIEW_TABS`، ترتیب mixin، `hasMenu` در `load()`، رد لینک‌های ناوبری در `bindTabs`، پنهان‌سازی `portalNav` |
| `Frontend/src/pages/portal.html` | اسکلت ناوبری (۷ بلوک `data-portal-menu`، ۲۸ لینک)، ۴ پنل تازه، لینک CSS و سه `<script>` |
| `Backend/config/permissions.js` | ۲۸ کلید `customer.portal.menu.*` (۱۹۷ ⇒ ۲۲۵) |
| `Backend/permissions-test.mjs` | انتظار ۲۲۵ کلید / ۱۸ گروه + گروه «portal» |
| `Frontend/portal-menu-guard-test.mjs` | تازه — گارد ۷۷ بررسی |
| `Frontend/customer-portal-guard-test.mjs` | شمارش کلیدها ۱۹۷ ⇒ ۲۲۵ |
| `Frontend/package.json` · `tools/gate.mjs` · `tools/gate.ps1` | ثبت `test:portal-menu` |

---

## ۱۱) آنچه عمداً انجام نشد

- **سه بخش «به‌زودی»** (`ضدعفونی دوره` · `پایان دوره` · `گزارش نهایی دوره`) هیچ اندپوینتی ندارند ⇒ پنل متن صادقانه داد، نه دادهٔ جعلی و نه دکمهٔ بی‌اثر.
- **هیچ نوشتن تازه‌ای** در پورتال اضافه نشد (همان ۶ نوشتن ۱۳.۱۵) و هیچ اندپوینت تازه‌ای هم ساخته نشد.
- **شناسه در URL ممنوع ماند**: لینک مستقیم به «سالن شمارهٔ ۱۲» وجود ندارد؛ انتخاب سالن داخل `hallDetail` انجام می‌شود (ضد IDOR).
- تب‌های کلاسیک حذف نشدند تا مسیرهای ۱۳.۱۴/۱۳.۱۵ و آزمون‌هایشان دست‌نخورده بمانند.

---

## ۱۲) ریسک‌های باقی‌مانده

| ریسک | کاهش |
|---|---|
| کاربری که صفحه را **قبل از دیپلوی** باز کرده، کلیدهای `customer.portal.menu.*` را در کش ندارد | `menuFallbackMode()` تا اولین تازه‌سازی مجوزها با لایهٔ محتوا قضاوت می‌کند |
| بوکمارک‌های قدیمی بدون مسیر | `resolveRoute` آن‌ها را به `#/dashboard` می‌برد (بدون خطا) |
| مسیرهای `contentKey` خالی (`soon`) فقط با کلید منو کنترل می‌شوند | خود پنل هیچ درخواستی نمی‌فرستد و داده‌ای افشا نمی‌شود |
| رشد آیندهٔ منو | افزودن یک آیتم = یک ردیف در `PORTAL_MENUS` + یک لینک HTML + یک کلید مجوز؛ گارد هر سه را هم‌راستا نگه می‌دارد |
