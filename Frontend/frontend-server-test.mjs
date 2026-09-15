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
  check(
    "آدرس JS/CSSهای محلی نسخه‌دار شده‌اند (?v=)",
    versioned.length >= 3,
    `count=${versioned.length}`,
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

  const dash = await waitFor(`${base}/dashboard`);
  const dashHtml = await dash.text();
  const dashVersioned = versionOf(dashHtml);
  check(
    "صفحهٔ /dashboard هم نسخه‌دار سرو می‌شود",
    dashVersioned.length >= 3,
    `count=${dashVersioned.length}`,
  );
  check(
    "نسخهٔ دارایی‌ها در همهٔ صفحات یکسان است",
    dashVersioned.length > 0 && dashVersioned[0][2] === assetVersion,
    `${dashVersioned[0]?.[2]} vs ${assetVersion}`,
  );

  const notFound = await fetch(`${base}/this-page-does-not-exist`);
  check("مسیر ناشناخته → ۴۰۴", notFound.status === 404, `status=${notFound.status}`);
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
