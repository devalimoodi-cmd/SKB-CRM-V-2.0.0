# اجرای پروژه SKB-CRM با Nginx

> این پوشه فقط **فایل‌های آمادهٔ کانفیگ** را نگه می‌دارد (نسخه‌بندی‌شده در گیت).
> خودِ Nginx روی **سرور** نصب و اجرا می‌شود؛ پروژه هیچ تغییری لازم ندارد.

---

## ۱) کجا چه کاری انجام می‌شود؟

| کار | محل انجام |
|---|---|
| نصب و اجرای Nginx، کپی کانفیگ، SSL | **روی سرور** |
| کانفیگ آماده (همین فایل‌ها) | **داخل پروژه** (نسخه‌بندی می‌شود، روی سرور کپی می‌شود) |
| تغییر کد برنامه | **لازم نیست** |

---

## ۲) پیش‌نیاز روی سرور

1. بک‌اند بالا باشد: `start-backend.bat` → پورت `127.0.0.1:5000`
   تست: `http://127.0.0.1:5000/api/ping` باید JSON بدهد.
2. فرانت‌اند بالا باشد: `start-frontend.bat` → پورت `127.0.0.1:3000`
   تست: `http://127.0.0.1:3000/api/ping` هم باید همان JSON را بدهد.
3. Nginx نصب باشد:
   - **لینوکس:** `sudo apt install nginx`
   - **ویندوز:** دانلود نسخهٔ Windows از سایت nginx.org و اکسترکت در `C:\nginx`

---

## ۳) مراحل نصب کانفیگ

### لینوکس
```bash
sudo cp Frontend/deploy/nginx/skb-crm.conf /etc/nginx/conf.d/skb-crm.conf
sudo nano /etc/nginx/conf.d/skb-crm.conf     # server_name را عوض کن
sudo nginx -t                                # تست سینتکس
sudo systemctl reload nginx
```

### ویندوز (nginx/Windows)
```powershell
# کانفیگ را در پوشهٔ conf قرار بده، مثلاً C:\nginx\conf\conf.d\skb-crm.conf
# و در C:\nginx\conf\nginx.conf داخل بلوک http این خط را اضافه کن:
#     include conf.d/*.conf;
cd C:\nginx
.\nginx.exe -t          # تست سینتکس
.\nginx.exe             # اجرا
.\nginx.exe -s reload   # ریلود بعد از هر تغییر
```
> در ویندوز برای اینکه Nginx خودکار با سرور بالا بیاید، از **WinSW** یا **NSSM** استفاده کن
> (سرویس ویندوز بساز تا با بوت بالا بیاید). جایگزین ساده‌تر با SSL خودکار: **Caddy** که نسخهٔ ویندوزی‌اش سرویس‌پذیرتر است.

---

## ۴) چه چیزی در پروژه باید تنظیم شود؟

**هیچ.** چون مرورگر با آدرس هم‌مبدأ `/api` کار می‌کند (پروکسی داخل `Frontend/server.js`)، Nginx فقط ترافیک پورت ۳۰۰۰ را رد می‌کند.

دو تنظیم اختیاری:
- اگر بک‌اند روی **ماشین دیگری** است، در سرور فرانت متغیر محیطی بگذار:
  `API_URL=http://<آی‌پی‌بک‌اند>:5000/api`
- تایم‌اوت آپلود (پیش‌فرض ۱۰ دقیقه) قابل تغییر است:
  `PROXY_TIMEOUT_MS=900000`

⚠️ **CORS لازم نیست** — چون درخواست‌ها از دید مرورگر هم‌مبدأ هستند (Nginx → Express → backend).

---

## ۵) چک‌لیست تأیید بعد از راه‌اندازی Nginx

1. `http://<دامنه-یا-آی‌پی>/` → صفحهٔ لاگین/داشبورد می‌آید.
2. `http://<دامنه-یا-آی‌پی>/api/ping` → `{"success":true,"message":"SKB-CRM API is running",...}`
3. لاگین موفق + در DevTools → Network درخواست به `/api/users/login` با کد ۲۰۰.
4. در کنسول سرور فرانت خط `🔄 Proxy: POST http://127.0.0.1:5000/api/users/login → 200`
5. آپلود یک فایل در «گزارش بازدید» و سپس دیدن تصویر/پیوست (مسیر `/uploads/...`).
6. در `logs/skb-crm.error.log` خطایی نباشد.

---

## ۶) نکته‌های مهم

- **آپلود تا ۵۰۰MB:** به همین دلیل `client_max_body_size 600m;` و `proxy_request_buffering off;` گذاشته شده.
- **کش:** سیاست کش در `Frontend/server.js` پیاده شده و نیازی به تنظیم Nginx ندارد:
  - **HTML:** همیشه `no-cache` + `ETag` (پاسخ ۳۰۴ سبک بعد از استقرار).
  - **JS/CSS با `?v=<نسخه>`:** کش یک‌سالهٔ `immutable` — بعد از هر استقرار، نسخه عوض می‌شود و مرورگر فایل جدید را می‌گیرد.
  - **بقیهٔ فایل‌ها (importهای داخلی ماژول‌ها):** کش ۶۰ ثانیه‌ای + `ETag`.
  ⚠️ در Nginx برای این مسیرها `proxy_hide_header`/بازنویسی `Cache-Control` نگذار تا این سیاست دست‌نخورده بماند.
- **پورت ۵۰۰۰ را از اینترنت باز نکن.** همه‌چیز از Nginx رد می‌شود.
- **لاگ‌ها را دوره‌ای پاک/بچرخان**: `logs/backend.log` و `logs/frontend.log` (اسکریپت‌های `.bat` فقط append می‌کنند).

---

## ضمیمهٔ A — اگر می‌خواهی Nginx خودش فایل‌های استاتیک را سرو کند

سریع‌تر است ولی باید همهٔ مسیرهای Express تکرار شود و ریسک اشتباه دارد.
اگر این کار را کردی، حتماً این مسیرها را هم پوشش بده:

| مسیر | مقصد |
|---|---|
| `/core`, `/features`, `/shared`, `/styles`, `/vendor`, `/pages`, `/public`, `/assets` | `Frontend/src/...` |
| `/node_modules` | `Frontend/node_modules` |
| `/login`, `/dashboard.html`, `/admin`, `/customers`, `/customer-info`, `/bookmarks`, `/sms`, `/setup-admin` | فایل‌های HTML در `Frontend/src/pages` |
| `/api/`, `/uploads/` | پروکسی به `127.0.0.1:3000` (تا پروکسی Express و منطق آن حفظ شود) |

نمونهٔ پایه:
```nginx
root C:/path/SKB/Frontend/src;
location /core/    { alias C:/path/SKB/Frontend/src/core/; }
location /features/{ alias C:/path/SKB/Frontend/src/features/; }
location /styles/  { alias C:/path/SKB/Frontend/src/styles/; }
location /vendor/  { alias C:/path/SKB/Frontend/src/vendor/; }
location /pages/   { alias C:/path/SKB/Frontend/src/pages/; }
location /assets/  { alias C:/path/SKB/Frontend/src/assets/; }
location /node_modules/ { alias C:/path/SKB/Frontend/node_modules/; }
location = /login  { try_files /pages/login.html =404; }
# ... بقیهٔ روت‌های HTML ...
```
> توصیه: مسیرهای `/api/` و `/uploads/` را **حتماً** به Express پروکسی کن؛ بازنویسی آن‌ها در Nginx کار اضافه و منبع خطاست.

---

## ضمیمهٔ B — اگر می‌خواهی API روی ساب‌دامین باشد (`api.skb-crm.ir`)

```nginx
upstream skb_backend { server 127.0.0.1:5000; keepalive 16; }

server {
    listen 80;
    server_name api.skb-crm.ir;
    client_max_body_size 600m;
    location / {
        proxy_pass http://skb_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 600s;
    }
}
```
در این حالت باید:
1. در `Backend/server.js` دامنه را به لیست CORS اضافه کنی (`"http://api.skb-crm.ir"` / `https://...`)، وگرنه مرورگر بلاک می‌کند.
2. در فرانت `window.__API_BASE_URL__ = "https://api.skb-crm.ir/api"` را قبل از لود `config.const.js` ست کنی (یا کانفیگ `production` را استفاده کنی).

**توصیه:** این کار را نکن؛ همان `/api` هم‌مبدأ ساده‌تر، امن‌تر و بدون CORS است.
