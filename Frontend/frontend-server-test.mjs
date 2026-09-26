// ============================================================
//  تست سرور فرانت‌اند (بدون نیاز به بک‌اند/دیتابیس)
//  موارد بررسی‌شده:
//   ۱) سرو صفحات HTML با هدر no-cache
//   ۲) نسخه‌دهی خودکار JS/CSS محلی (?v=) — و دست‌نزدن به node_modules/آدرس خارجی
//   ۳) سیاست کش: نسخه‌دار = یک‌ساله immutable، بدون نسخه = ۶۰ ثانیه، ۳۰۴ با ETag
//   ۴) یکسان‌بودن نسخه در همهٔ صفحات + پاسخ ۴۰۴ برای مسیر ناشناخته
//  اجرا:  npm run test:cache      (در پوشهٔ Frontend)
// ============================================================
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 3996;
const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};


const child = spawn(process.execPath, ["server.js"], {
  cwd: import.meta.dirname,
  env: {
    ...process.env,
    PORT: String(PORT),
    API_URL: "http://127.0.0.1:5999/api", // بک‌اند لازم نیست
    PROXY_STRICT: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
child.stdout.on("data", (d) => (log += d.toString()));
child.stderr.on("data", (d) => (log += d.toString()));

const base = `http://127.0.0.1:${PORT}`;

const waitFor = async (url, opts) => {
  for (let i = 0; i < 80; i++) {
    try {
      return await fetch(url, opts);
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw new Error("frontend not ready: " + url);
};

const versionOf = (html) => {
  const matches = [
    ...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))\?v=([^"&\s]+)"/g),
  ];
  return matches;
};

// ✅ درخواست خام HTTP (مثل مرورگر واقعی)
// نکته: fetch خودش `cache-control: no-cache` می‌فرستد و باعث می‌شود سرور
// پاسخ ۳۰۴ ندهد؛ برای تست کش باید درخواست خام بفرستیم.
const rawGet = (reqPath, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port: PORT, path: reqPath, headers },
      (res) => {
        let body = "";
        res.on("data", (d) => (body += d));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });

const run = async () => {
  const page = await waitFor(`${base}/login`);
  const html = await page.text();

  check("صفحهٔ /login سرو می‌شود", page.status === 200, `status=${page.status}`);
  check(
    "صفحهٔ HTML با no-cache سرو می‌شود",
    /no-cache/.test(page.headers.get("cache-control") || ""),
    String(page.headers.get("cache-control")),
  );

  const versioned = versionOf(html);
  // نکته: تا پیش از پاک‌سازی موج ۰، این شمارش با دو فایل صفر‌بایتی
  // (`/styles/reset.css` و `/styles/variables.css`) به عدد ۳ می‌رسید؛ پس از حذف
  // آن‌ها تنها دارایی CSS محلی واقعی صفحهٔ لاگین `/styles/global.css` است.
  // پس به‌جای آستانهٔ عددی شکننده، «همان دارایی واقعی نسخه‌دار شده باشد» بررسی می‌شود.
  check(
    "آدرس JS/CSSهای محلی نسخه‌دار شده‌اند (?v=)",
    versioned.length >= 1 &&
      versioned.some(([, url]) => url.endsWith("/styles/global.css")),
    `count=${versioned.length} urls=${versioned.map(([, url]) => url).join(",")}`,
  );
  check(
    "کتابخانه‌های npm نسخه‌دار نمی‌شوند (بی‌جهت)",
    !/node_modules\/[^"]+\.(?:js|css)\?v=/.test(html),
  );
  check(
    "آدرس‌های خارجی (http) دست‌نخورده می‌مانند",
    !/https?:\/\/[^"\s]+\.(?:js|css)\?v=/.test(html),
  );

  const [, assetUrl, assetVersion] = versioned[0];
  const asset = await waitFor(`${base}${assetUrl}?v=${assetVersion}`);
  check("فایل نسخه‌دار سرو می‌شود", asset.status === 200, `status=${asset.status}`);
  const cc = asset.headers.get("cache-control") || "";
  check(
    "فایل نسخه‌دار: کش یک‌سالهٔ immutable",
    /max-age=31536000/.test(cc) && /immutable/.test(cc),
    cc,
  );

  const etag = asset.headers.get("etag");
  check("فایل استاتیک ETag دارد", Boolean(etag), String(etag));

  const rawFirst = await rawGet(`${assetUrl}?v=${assetVersion}`);
  check(
    "درخواست خام (مثل مرورگر) → ۲۰۰ با ETag",
    rawFirst.status === 200 && Boolean(rawFirst.headers.etag),
    `status=${rawFirst.status}`,
  );
  const revalidated = await rawGet(`${assetUrl}?v=${assetVersion}`, {
    "If-None-Match": rawFirst.headers.etag,
  });
  check(
    "درخواست تکراری با ETag → پاسخ ۳۰۴ بدون بدنه (ترافیک نزدیک صفر)",
    revalidated.status === 304,
    `status=${revalidated.status}`,
  );

  const plain = await waitFor(`${base}${assetUrl}`);
  check(
    "فایل بدون نسخه: کش کوتاه ۶۰ ثانیه (به‌روزرسانی سریع)",
    /max-age=60/.test(plain.headers.get("cache-control") || ""),
    String(plain.headers.get("cache-control")),
  );

  const dash = await waitFor(`${base}/`);
  const dashHtml = await dash.text();
  const dashVersioned = versionOf(dashHtml);
  check(
    "صفحهٔ داشبورد (/) نسخه‌دار سرو می‌شود",
    dash.status === 200 && dashVersioned.length >= 3,
    `status=${dash.status} count=${dashVersioned.length}`,
  );
  check(
    "نسخهٔ دارایی‌ها در همهٔ صفحات یکسان است",
    dashVersioned.length > 0 && dashVersioned[0][2] === assetVersion,
    `${dashVersioned[0]?.[2]} vs ${assetVersion}`,
  );

  const notFound = await fetch(`${base}/this-page-does-not-exist`);
  check("مسیر ناشناخته → ۴۰۴", notFound.status === 404, `status=${notFound.status}`);

  // ===== صفحه‌های اطلاعاتی (درباره ما / تماس با ما / راهنما) =====
  const infoPages = [
    ["/about", "درباره ما"],
    ["/contact", "تماس با ما"],
    ["/help", "راهنما"],
  ];
  for (const [path, label] of infoPages) {
    const res = await waitFor(`${base}${path}`);
    const body = await res.text();
    check(
      `صفحهٔ ${label} (${path}) سرو می‌شود`,
      res.status === 200 && body.length > 500,
      `status=${res.status} len=${body.length}`,
    );
    check(
      `صفحهٔ ${label}: دارایی‌ها نسخه‌دار شده‌اند (?v=)`,
      versionOf(body).length >= 3,
      `count=${versionOf(body).length}`,
    );
  }

  // ===== ✅ قاعدهٔ مهم: تگ‌های type="module" نباید نسخه‌دار شوند =====
  // دلیل: URL یک ماژول ES هویت آن است؛ اگر در HTML `?v=` بگذاریم ولی همان
  // فایل با `import "…/x.js"` (بدون ?v) هم صدا زده شود، مرورگر آن را دو ماژول
  // جدا می‌بیند و **دو بار اجرا** می‌کند → دو سینگلتون، دو شنوندهٔ click روی
  // یک دکمه و دو درخواست برای یک کلیک (باگ واقعی: ثبت دوبارهٔ پیام).
  const contactRes = await waitFor(`${base}/contact`);
  const contactHtml = await contactRes.text();
  const moduleTags = [
    ...contactHtml.matchAll(/<script\b[^>]*type="module"[^>]*>/gi),
  ].map((m) => m[0]);
  const versionedModules = moduleTags.filter((tag) => /\.js\?v=/.test(tag));
  check(
    'تگ‌های <script type="module"> نسخه‌دار نمی‌شوند (ضد اجرای دوبارهٔ ماژول)',
    moduleTags.length >= 3 && versionedModules.length === 0,
    `modules=${moduleTags.length} versioned=${versionedModules.length}`,
  );
  check(
    "در عوض CSSهای صفحه همچنان نسخه‌دار می‌شوند (کش یک‌سالهٔ immutable)",
    /<link\b[^>]*href="[^"]+\.css\?v=/.test(contactHtml),
  );
  check(
    "اسکریپت‌های کلاسیک node_modules دست‌نخورده می‌مانند",
    !/node_modules[^"]+\.js\?v=/.test(contactHtml),
  );

  // ===== ✅ لودر سیستمی (تزریق سمت سرور — بدون بک‌اند → پیش‌فرض classic) =====
  const dashLoader = await waitFor(`${base}/`);
  const dashLoaderHtml = await dashLoader.text();
  check(
    "لودر سیستمی در داشبورد تزریق شده (overlay + data-loader)",
    dashLoader.status === 200 &&
      dashLoaderHtml.includes('id="pageLoadingOverlay"') &&
      dashLoaderHtml.includes('data-loader="classic"'),
    `status=${dashLoader.status} overlay=${dashLoaderHtml.includes(
      'id="pageLoadingOverlay"',
    )}`,
  );
  check(
    "هر دو حالت لودر (کلاسیک + لوگوی ستاره کیان) در HTML هست",
    dashLoaderHtml.includes("skb-loader--classic") &&
      dashLoaderHtml.includes("skb-loader--logo") &&
      dashLoaderHtml.includes("skb-logo-svg"),
  );
  check(
    "متن هر دو لودر یکسان است (در حال بارگذاری...)",
    (dashLoaderHtml.match(/در حال بارگذاری\.\.\./g) || []).length >= 2,
    `count=${(dashLoaderHtml.match(/در حال بارگذاری\.\.\./g) || []).length}`,
  );
  check(
    "CSS لودر با نسخه (?v=) تزریق می‌شود",
    /href="\/shared\/components\/Loader\/loader\.css\?v=/.test(dashLoaderHtml),
  );
  check(
    "لودر فقط در صفحه‌های لیست سفید تزریق می‌شود (login بدون لودر)",
    !(await (await waitFor(`${base}/login`)).text()).includes(
      'id="pageLoadingOverlay"',
    ),
  );
  const dashLogoOverride = await waitFor(`${base}/dashboard.html?loader=logo`);
  const dashLogoHtml = await dashLogoOverride.text();
  check(
    "پارامتر ?loader=logo حالت لودر را تغییر می‌دهد (پیش‌نمایش)",
    dashLogoOverride.status === 200 &&
      dashLogoHtml.includes('data-loader="logo"') &&
      dashLogoHtml.includes('id="pageLoadingOverlay"'),
    `status=${dashLogoOverride.status}`,
  );

  // ===== ✅ یکدست‌سازی: همهٔ لودرهای داخل صفحه هم پیرو انتخاب ادمین هستند =====
  const listPage = await waitFor(`${base}/customers`);
  const listHtml = await listPage.text();
  check(
    "لودر داخل جدول مشتریان با placeholder مشترک است (نه اسپینر قدیمی)",
    listPage.status === 200 &&
      listHtml.includes('data-skb-loader') &&
      !listHtml.includes("fa-spinner") &&
      listHtml.includes("Loader/loader.css"),
    `status=${listPage.status} placeholder=${listHtml.includes(
      'data-skb-loader',
    )} oldSpinner=${listHtml.includes("fa-spinner")}`,
  );

  const infoPage = await waitFor(`${base}/customer-info`);
  const infoHtml = await infoPage.text();
  const infoPlaceholders = (infoHtml.match(/data-skb-loader/g) || []).length;
  check(
    "لودرهای اطلاعات مشتری (هوا/وضعیت گله) پیرو لودر سیستم شده‌اند",
    infoPage.status === 200 && infoPlaceholders >= 2 && !infoHtml.includes("fa-spinner"),
    `status=${infoPage.status} placeholders=${infoPlaceholders}`,
  );

  const aboutPage = await waitFor(`${base}/about`);
  const aboutHtml = await aboutPage.text();
  check(
    "صفحه‌های بدون لودر: نه اورلی، نه placeholder و نه CSS لودر",
    aboutPage.status === 200 &&
      !aboutHtml.includes('id="pageLoadingOverlay"') &&
      !aboutHtml.includes("data-skb-loader") &&
      !aboutHtml.includes("Loader/loader.css"),
    `status=${aboutPage.status}`,
  );

  const adminPage = await waitFor(`${base}/admin`);
  const adminHtml = await adminPage.text();
  check(
    "کارت‌های پیش‌نمایش پنل ادمین (div + دکمهٔ تمام‌صفحه) درست سرو می‌شوند",
    adminPage.status === 200 &&
      adminHtml.includes('role="button"') &&
      adminHtml.includes('data-loader-preview="classic"') &&
      adminHtml.includes('data-loader-preview="logo"') &&
      adminHtml.includes("loaderPreviewClassic") &&
      adminHtml.includes("loaderPreviewLogo") &&
      adminHtml.includes("Loader/loader.css"),
    `status=${adminPage.status}`,
  );

  // ===== ✅ «تغییرات جدید / What's New» (مودال کاربر + بخش پنل ادمین) =====
  const headerPartial = await waitFor(`${base}/shared/layouts/Header/header.html`);
  const headerPartialHtml = await headerPartial.text();
  check(
    "مودال «تغییرات جدید» و دکمهٔ هدر در header.html موجودند",
    headerPartial.status === 200 &&
      headerPartialHtml.includes('id="whatsNewOverlay"') &&
      headerPartialHtml.includes('id="whatsNewModal"') &&
      headerPartialHtml.includes('id="whatsNewBtn"') &&
      headerPartialHtml.includes('id="whatsNewCount"'),
    `status=${headerPartial.status}`,
  );

  const headerCss = await waitFor(`${base}/shared/layouts/Header/header.css`);
  const headerCssText = await headerCss.text();
  check(
    "استایل مودال تغییرات در header.css سرو می‌شود",
    headerCss.status === 200 &&
      headerCssText.includes(".wn-overlay") &&
      headerCssText.includes(".wn-modal") &&
      headerCssText.includes(".wn-section-icon"),
    `status=${headerCss.status}`,
  );

  const whatsNewAssets = [
    "/features/whats-new/whats-new.api.js",
    "/features/whats-new/whats-new.renderer.js",
    "/features/whats-new/whats-new.service.js",
    "/features/whats-new/whats-new.manager.js",
  ];
  const assetStatuses = [];
  for (const assetPath of whatsNewAssets) {
    const res = await waitFor(`${base}${assetPath}`);
    assetStatuses.push(`${assetPath.split("/").pop()}=${res.status}`);
  }
  check(
    "فایل‌های ماژول تغییرات درست سرو می‌شوند (۲۰۰)",
    assetStatuses.every((item) => item.endsWith("=200")),
    assetStatuses.join(" "),
  );

  check(
    "بخش «تغییرات و اطلاع‌رسانی» در پنل ادمین موجود است",
    adminPage.status === 200 &&
      adminHtml.includes('data-menu="release-notes"') &&
      adminHtml.includes('id="releaseNotesContainer"') &&
      adminHtml.includes('id="release-notes"'),
    `status=${adminPage.status}`,
  );

  // ===== ✅ جدول لیست مشتریان: عرض ستون‌ها + بدون اسکرول افقی =====
  check(
    "جدول مشتریان: colgroup با ۱۴ ستون عرض‌دار + سرستون «شماره مشتری» و «نوع مشتری»",
    listPage.status === 200 &&
      listHtml.includes("<colgroup>") &&
      listHtml.includes("<th>شماره مشتری</th>") &&
      listHtml.includes("<th>نوع مشتری</th>") &&
      (listHtml.match(/<col class="col-/g) || []).length === 14,
    `cols=${(listHtml.match(/<col class="col-/g) || []).length}`,
  );

  check(
    "فرم مشتریان: فیلد «کد ملی» + سلکت «نوع مشتری» + فیلتر نوع مشتری موجود است",
    listPage.status === 200 &&
      listHtml.includes('id="national-code"') &&
      listHtml.includes('id="customer-type"') &&
      listHtml.includes('id="customerTypeFilter"') &&
      listHtml.includes('<option value="12">نوع مشتری</option>'),
    `nationalCode=${listHtml.includes('id="national-code"')} filter=${listHtml.includes('id="customerTypeFilter"')}`,
  );

  // ✅ هم‌ترازی ستون‌ها: تعداد <th> سرستون‌ها باید با تعداد <col>ها یکی باشد
  // (بود: <colgroup> و سرستون‌ها ۱۴ ستون شدند ولی سطر لودر/فوتر/جستجو
  //  `colspan="13"` مانده بود و کلیدهای عملیات زیر ستون «نوع مشتری» می‌افتاد)
  const listTheadHtml = (listHtml.match(/<thead>[\s\S]*?<\/thead>/) || [""])[0];
  const listThCount = (listTheadHtml.match(/<th>/g) || []).length;
  const listColCount = (listHtml.match(/<col class="col-/g) || []).length;
  check(
    "جدول مشتریان: تعداد <th> با تعداد <col>ها برابر است (۱۴)",
    listThCount === 14 && listColCount === 14,
    `th=${listThCount} col=${listColCount}`,
  );

  check(
    'جدول مشتریان: هیچ سطر `colspan="13"` نمانده است',
    listPage.status === 200 &&
      !listHtml.includes('colspan="13"') &&
      listHtml.includes('colspan="14"'),
    `has13=${listHtml.includes('colspan="13"')} has14=${listHtml.includes('colspan="14"')}`,
  );

  const listService = await waitFor(
    `${base}/features/customer-list/customer-list.service.js`,
  );
  const listServiceText = await listService.text();
  check(
    "سرویس جدول مشتریان: سطرهای خالی/«در حال جستجو» با colspan=14 هم‌خوان‌اند",
    listService.status === 200 &&
      !listServiceText.includes('colspan="13"') &&
      listServiceText.includes('colspan="14"'),
    `status=${listService.status} has13=${listServiceText.includes('colspan="13"')}`,
  );

  // ✅ منبع واحد رندر: سرویس باید ردیف‌ها را از رندرر بگیرد (نه inline)
  // (بود: سرویس ردیف ۱۳سلولی خودش را می‌ساخت و ستون «نوع مشتری» خالی می‌ماند)
  check(
    "سرویس جدول مشتریان: ردیف‌ها از customerListRenderer.renderTable ساخته می‌شوند",
    listService.status === 200 &&
      listServiceText.includes("customerListRenderer.renderTable("),
    `usesRenderer=${listServiceText.includes("customerListRenderer.renderTable(")}`,
  );

  const listCss = await waitFor(`${base}/features/customer-list/customer-list.css`);
  const listCssText = await listCss.text();
  const colWidthRules = (
    listCssText.match(/col\.col-[\w-]+\s*\{\s*width:\s*[\d.]+%/g) || []
  ).length;
  check(
    "CSS جدول مشتریان: عرض ستون‌ها درصدی است (بدون min-width سنگین)",
    listCss.status === 200 &&
      colWidthRules === 14 &&
      !listCssText.includes("min-width: 1510px") &&
      /\.data-table\s*\{[^}]*table-layout:\s*fixed/.test(listCssText),
    `status=${listCss.status} widthRules=${colWidthRules} heavyMinWidth=${listCssText.includes("min-width: 1510px")}`,
  );

  check(
    "CSS جدول مشتریان: بدون اسکرول افقی در جدول",
    /overflow-x:\s*hidden/.test(listCssText) &&
      !/min-width:\s*1[0-9]{3}px/.test(listCssText),
    `hasOverflowHidden=${/overflow-x:\s*hidden/.test(listCssText)}`,
  );

  // ===== ✅ پایداری بوت صفحهٔ پروفایل مشتری (بدون گیر کردن لودینگ) =====
  // بود: انتظار برای appService با setInterval بدون سقف زمانی؛ اگر آن سرویس
  // خطا می‌داد، اورلی لودینگ تا ابد روی صفحه می‌ماند.
  // (از همان infoPage/infoHtml که بالاتر برای بررسی لودرها گرفته شد استفاده می‌شود)
  check(
    "صفحهٔ پروفایل مشتری: انتظار appService سقف زمانی دارد (Promise.race + timeout)",
    infoPage.status === 200 &&
      infoHtml.includes("waitForAppReady") &&
      infoHtml.includes("Promise.race") &&
      infoHtml.includes("timeoutMs") &&
      infoHtml.includes("clearInterval"),
    `status=${infoPage.status} race=${infoHtml.includes("Promise.race")} timeout=${infoHtml.includes("timeoutMs")}`,
  );

  // ✅ مانیفست فرانت نباید کلید تکراری devDependencies داشته باشد
  const pkgRaw = fs.readFileSync(
    path.join(import.meta.dirname, "package.json"),
    "utf8",
  );
  const devDepKeys = (pkgRaw.match(/"devDependencies"\s*:/g) || []).length;
  check(
    "package.json فرانت: کلید devDependencies تکراری نیست",
    devDepKeys === 1,
    `devDependencies=${devDepKeys}`,
  );
  // ===== ✅ پیام‌های کاربر: از کنسول به توست کم‌مزاحمت (SweetAlert2) =====
  const readSrc = (rel) =>
    fs.readFileSync(path.join(import.meta.dirname, "src", rel), "utf8");

  const notifySrc = readSrc("core/services/notification.service.js");
  check(
    "اعلان کاربر: notifyOnce با ضدتکرار/سقف نرخ/خاموشی اختیاری وجود دارد",
    notifySrc.includes("notifyOnce(") &&
      notifySrc.includes("cooldownMs") &&
      notifySrc.includes("maxPerMinute") &&
      notifySrc.includes("skb_user_toasts"),
    `cooldown=${notifySrc.includes("cooldownMs")} maxPerMinute=${notifySrc.includes("maxPerMinute")}`,
  );
  const notifyStart = notifySrc.indexOf("notifyOnce(");
  const notifyEnd = notifySrc.indexOf("_userToastsDisabled() {", notifyStart);
  const notifyBody =
    notifyStart >= 0 && notifyEnd > notifyStart
      ? notifySrc.slice(notifyStart, notifyEnd)
      : "";
  check(
    "اعلان کاربر: notifyOnce فقط توست می‌سازد (نه مودال/اعتبارسنجی)",
    notifyBody.includes("this._showToast(") && !notifyBody.includes("showError("),
    `bodyLen=${notifyBody.length}`,
  );

  const dictSrc = readSrc("features/admin-panel/dictionary.manager.js");
  const dictNotifyCalls = (dictSrc.match(/notifyOnce\(/g) || []).length;
  check(
    "پیام کاربر: پنل دیکشنری ۳ شکست بی‌صدا را توست می‌کند",
    dictNotifyCalls >= 3 &&
      dictSrc.includes("تغییر وضعیت ذخیره") &&
      dictSrc.includes("بارگذاری جدول ناموفق بود") &&
      dictSrc.includes("این فیلد دریافت نشد"),
    `calls=${dictNotifyCalls}`,
  );
  check(
    "پیام کاربر: رفرش بخش پروفایل مشتری → توست (نه فقط کنسول)",
    readSrc("features/customer-info/customer-info.service.js").includes(
      "این بخش ناموفق بود",
    ),
  );
  check(
    "پیام کاربر: نبود شناسهٔ مشتری → توست هشدار",
    readSrc(
      "features/customer-info/section-header/section-header.service.js",
    ).includes("مشتری یافت نشد"),
  );
  check(
    "پیام کاربر: شکست دریافت «تغییرات جدید» → توست هشدار",
    readSrc("features/whats-new/whats-new.service.js").includes(
      "دریافت تغییرات جدید ناموفق بود",
    ),
  );

  const loginPageText = readSrc("pages/login.html");
  check(
    "صفحهٔ ورود: شکست کپچا و انقضای نشست به کاربر اطلاع داده می‌شود",
    loginPageText.includes("login-captcha-failed") &&
      loginPageText.includes("showSessionExpiredOnce") &&
      loginPageText.includes("skb_session_expired"),
  );
  check(
    "api.service: انقضای نشست قبل از هدایت با فلگ یک‌بارمصرف ثبت می‌شود",
    readSrc("core/services/api.service.js").includes(
      'sessionStorage.setItem("skb_session_expired", "1")',
    ),
  );
  check(
    "بوت کند صفحه: اطلاع کم‌مزاحمت به کاربر (app-boot-slow)",
    readSrc("pages/customer-info.html").includes("app-boot-slow"),
  );
  check(
    "۴۰۴: SweetAlert2 لود می‌شود (تنها صفحهٔ بدون آن)",
    /sweetalert2/.test(readSrc("pages/404.html")),
  );

  // ===== ✅ «کد ملی»: فقط ۱۰ رقم عددی (بدون رقم کنترلی) + ورودی فقط عددی =====
  const stringUtilsSrc = readSrc("core/utils/string.utils.js");
  check(
    "کد ملی: قاعدهٔ اعتبارسنجی «۱۰ رقم عددی» است (بدون الگوریتم رقم کنترلی)",
    stringUtilsSrc.includes("export function isValidNationalCode") &&
      stringUtilsSrc.includes("export function digitsOnlyValue") &&
      !stringUtilsSrc.includes("remainder"),
  );
  check(
    "کد ملی: فیلدهای ثبت/ویرایش و پروفایل فقط عددی‌اند (inputmode + فیلتر ورودی)",
    listHtml.includes('id="national-code"') &&
      listHtml.includes('inputmode="numeric"') &&
      infoHtml.includes('id="skb-national-code"') &&
      infoHtml.includes('inputmode="numeric"') &&
      readSrc("features/customer-list/customer-list.service.js").includes(
        "setupNationalCodeInput()",
      ) &&
      readSrc(
        "features/customer-info/sections/basic-info/basic-info.service.js",
      ).includes("setupNationalCodeInput()"),
  );
  // ===== ✅ «مدیریت نقش‌ها و سطوح دسترسی» (پنل ادمین) =====
  const permissionManagerSrc = readSrc(
    "features/admin-panel/permission.manager.js",
  );
  const adminPanelServiceSrc = readSrc(
    "features/admin-panel/admin-panel.service.js",
  );
  check(
    "پنل ادمین: بخش «مدیریت نقش‌ها» دیگر جای‌خالی نیست (کانتینر واقعی)",
    adminHtml.includes('id="permissionManagerContainer"') &&
      !adminHtml.includes("بخش مدیریت نقش‌ها در حال ساخت") &&
      adminHtml.includes('data-menu="role-management"'),
  );
  check(
    "پنل ادمین: ماتریس نقش‌ها + دسترسی کاربران + گزارش تغییرات",
    permissionManagerSrc.includes("renderRolesTab()") &&
      permissionManagerSrc.includes("renderUsersTab()") &&
      permissionManagerSrc.includes("renderAuditTab()") &&
      permissionManagerSrc.includes("permissionApi.updateRole(") &&
      permissionManagerSrc.includes("permissionApi.updateUser("),
  );
  check(
    "پنل ادمین: سه‌حالته‌بودن دسترسی کاربر (ارثی از نقش / فعال / غیرفعال)",
    permissionManagerSrc.includes("ارثی از نقش") &&
      permissionManagerSrc.includes("perm-select"),
  );
  check(
    "پنل ادمین: خدمت مدیریت مجوزها به loadMenuData وصل شده است",
    adminPanelServiceSrc.includes('case "role-management"') &&
      adminPanelServiceSrc.includes("initPermissionManager"),
  );

  // ===== ✅ گیت دسترسی در UI (data-permission) =====
  const headerHtmlSrc = readSrc("shared/layouts/Header/header.html");
  check(
    "گیت دسترسی: منوهای هدر با data-permission مشخص شده‌اند",
    (headerHtmlSrc.match(/data-permission="/g) || []).length >= 3,
    `count=${(headerHtmlSrc.match(/data-permission="/g) || []).length}`,
  );
  check(
    "گیت دسترسی: منوهای پنل ادمین با data-permission مشخص شده‌اند",
    (adminHtml.match(/data-permission="/g) || []).length >= 7,
    `count=${(adminHtml.match(/data-permission="/g) || []).length}`,
  );
  check(
    "گیت دسترسی: منوهای پروفایل مشتری با data-permission مشخص شده‌اند",
    (infoHtml.match(/data-permission="/g) || []).length >= 6,
    `count=${(infoHtml.match(/data-permission="/g) || []).length}`,
  );
  const appServiceSrc = readSrc("core/services/app.service.js");
  const permissionServiceSrc = readSrc("core/services/permission.service.js");
  const apiConstSrc = readSrc("core/constants/api.const.js");
  const apiServiceSrc = readSrc("core/services/api.service.js");
  const customerInfoServiceSrc = readSrc(
    "features/customer-info/customer-info.service.js",
  );
  const globalCssSrc = readSrc("styles/global.css");
  check(
    "گیت دسترسی: app.service مجوزها را می‌خواند و applyGuards می‌کند",
    appServiceSrc.includes("permissionService.load()") &&
      appServiceSrc.includes("applyGuards(document)") &&
      appServiceSrc.includes("installAutoRefresh()"),
  );

  // ✅ سایدبار پنل ادمین از کلیدهای «منو» استفاده می‌کند (نه کلید یک جدول)
  const adminMenuKeys = [
    "admin.menu.superAdmins",
    "admin.menu.users",
    "admin.menu.dictionary",
    "admin.menu.roles",
    "admin.menu.settings",
    "admin.menu.suggestions",
    "admin.menu.releases",
  ];
  check(
    "گیت دسترسی: سایدبار پنل با ۷ کلید admin.menu.* گیت شده است",
    adminMenuKeys.every((key) => adminHtml.includes(`data-permission="${key}"`)) &&
      !adminHtml.includes('data-permission="dictionary.hall-types.view"'),
    `found=${adminMenuKeys.filter((key) => adminHtml.includes(`data-permission="${key}"`)).length}/7`,
  );
  check(
    "گیت دسترسی: سایدبار اگر منوی فعال مخفی شد، بخش دیگری انتخاب می‌کند",
    adminPanelServiceSrc.includes("syncMenuVisibility()") &&
      adminPanelServiceSrc.includes('addEventListener("permissions:applied"'),
  );

  // ✅ کش هوشمند: مدت ۶۰ ثانیه + بررسی نسخه + ضد ناپدیدشدن
  check(
    "سرویس مجوزها: کش ۶۰ ثانیه + بررسی نسخه + تازه‌سازی خودکار",
    permissionServiceSrc.includes("const TTL_MS = 60 * 1000") &&
      permissionServiceSrc.includes("async ensureFresh(") &&
      permissionServiceSrc.includes("installAutoRefresh()") &&
      permissionServiceSrc.includes("visibilitychange"),
  );
  check(
    "سرویس مجوزها: اگر داده در دسترس نباشد، هیچ المنتی مخفی نمی‌شود",
    /applyGuards\(root = document\) \{\s*\n\s*\/\/[\s\S]{0,200}?if \(!this\.hasData\(\)\) return;/.test(
      permissionServiceSrc,
    ),
  );
  check(
    "ثابت‌های API: مسیر نسخهٔ مجوزها ثبت شده است",
    apiConstSrc.includes('VERSION: "/permissions/version"'),
  );

  // ✅ پیام «عدم دسترسی»: ۴۰۳ ⇒ توست + مودال + کارت بخش
  check(
    "عدم دسترسی: api.service خطای ۴۰۳ را به پیام کاربر تبدیل می‌کند",
    apiServiceSrc.includes("notifyPermissionDenied(endpoint, errorData)") &&
      apiServiceSrc.includes("errorData.permissionDenied !== true") &&
      (apiServiceSrc.match(/this.notifyPermissionDenied\(endpoint, errorData\);/g) || [])
        .length >= 3,
    `calls=${(apiServiceSrc.match(/this.notifyPermissionDenied\(endpoint, errorData\);/g) || []).length}`,
  );
  check(
    "عدم دسترسی: ۴۰۳ روی خود /permissions/me موجب حلقه نمی‌شود",
    apiServiceSrc.includes('includes("/permissions/me")'),
  );
  check(
    "عدم دسترسی: سرویس مجوزها handleForbidden/titleOf/کارت بخش دارد",
    permissionServiceSrc.includes("handleForbidden(payload = {})") &&
      permissionServiceSrc.includes("titleOf(key)") &&
      permissionServiceSrc.includes("renderDeniedNotice(") &&
      permissionServiceSrc.includes("clearDeniedNotice(") &&
      permissionServiceSrc.includes("deniedTitles"),
  );
  check(
    "عدم دسترسی: پیام عملیات به‌صورت توست ضدنکرار است (نه مودال)",
    permissionServiceSrc.includes("notificationService.notifyOnce(") &&
      permissionServiceSrc.includes("perm-denied:"),
  );
  check(
    "عدم دسترسی: مودال تک‌دکمه‌ای در notification.service تعریف شده است",
    notifySrc.includes("async modalMessage(") &&
      notifySrc.includes('confirmText = "متوجه شدم"'),
  );
  check(
    "عدم دسترسی: هر ۴ صفحهٔ اصلی کلید مجوز صفحه دارند",
    [
      'requiresPermission: "admin.panel.access"',
      'requiresPermission: "customer.basic.view"',
      'requiresPermission: "dashboard.view"',
      'requiresPermission: "customers.list.view"',
    ].every((needle) => appServiceSrc.includes(needle)),
  );
  check(
    "عدم دسترسی: ورود به صفحهٔ بسته ⇒ مودال + خروج (و ناظر تغییر در حین کار)",
    appServiceSrc.includes("async denyPageAccess(reasonKey)") &&
      appServiceSrc.includes("installPagePermissionWatch()") &&
      appServiceSrc.includes('"permissions:applied"') &&
      appServiceSrc.includes("modalMessage({"),
  );
  check(
    "عدم دسترسی: بخش‌های پروفایل مشتری گارد + کارت بخش دارند",
    [
      '"Basic-Information": "customer.basic.view"',
      '"Chart-Dashboard": "charts.view"',
      '"customer-AddHals": "halls.view"',
      '"Hatchery-Management": "hatchery.view"',
      '"weekly-card": "weekly.view"',
      '"Visit-Report": "visit.view"',
    ].every((needle) => customerInfoServiceSrc.includes(needle)) &&
      customerInfoServiceSrc.includes("renderDeniedNotice("),
  );
  check(
    "عدم دسترسی: منوهای پنل ادمین گارد + کارت بخش دارند",
    adminPanelServiceSrc.includes("get menuPermissions()") &&
      adminPanelServiceSrc.includes('"role-management": "admin.menu.roles"') &&
      adminPanelServiceSrc.includes("renderDeniedNotice(menuSection, menuKey)"),
  );
  check(
    "عدم دسترسی: استایل کارت «این بخش بسته است» در global.css هست",
    globalCssSrc.includes(".perm-denied-box ") ||
      globalCssSrc.includes(".perm-denied-box {"),
  );
  check(
    "عدم دسترسی: ضدحلقهٔ ریدایرکت (نقش مشتری + صفحهٔ مقصد) رعایت شده است",
    appServiceSrc.includes('permissionService.role !== "customer"') &&
      appServiceSrc.includes("isLandingPage()") &&
      appServiceSrc.includes("async handlePagePermissionLoss("),
  );

  check(
    "سرویس مجوزهای فرانت: can/applyGuards/refresh دارد",
    permissionServiceSrc.includes("can(key)") &&
      permissionServiceSrc.includes("applyGuards(") &&
      permissionServiceSrc.includes("refresh()") &&
      permissionServiceSrc.includes("PERMISSIONS.ME"),
  );

  check(
    "ثابت‌های API: مسیرهای /permissions ثبت شده‌اند",
    apiConstSrc.includes("PERMISSIONS:") &&
      apiConstSrc.includes('"/permissions/me"') &&
      apiConstSrc.includes('"/permissions/roles/:role"'),
  );

  check(
    "سیاست کم‌مزاحمت: این پیام‌ها هرگز مودال showError نمی‌سازند",
    !dictSrc.includes("showError(") &&
      !readSrc("features/customer-info/customer-info.service.js").includes(
        "showError(",
      ) &&
      !readSrc(
        "features/customer-info/section-header/section-header.service.js",
      ).includes("showError("),
  );
};

run()
  .catch((e) => {
    console.error("❌ Test error:", e.message);
    console.error(log.slice(-500));
    results.push(false);
  })
  .finally(() => {
    try {
      child.kill();
    } catch {}
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
    const failed = results.filter((x) => !x).length;
    console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
    process.exit(failed === 0 ? 0 : 1);
  });
