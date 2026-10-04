// ============================================================
//  گارد «حضور کاربران» (Presence) — فاز ۱۲.۰
// ------------------------------------------------------------
//  ریشهٔ باگی که این گارد از بازگشتش جلوگیری می‌کند:
//    وضعیت آنلاین قبلاً فقط در «ورود» true و در «خروج» false می‌شد؛
//    اگر کاربر مرورگر را می‌بست، اینترنت/برق قطع می‌شد یا تب ساعت‌ها
//    رها می‌شد، تا ابد «آنلاین» می‌ماند (گزارش حضور بی‌اعتبار).
//
//  چه چیزی سنجیده می‌شود؟
//    ۱) توابع خالصِ حضور (بدون دیتابیس): isOnline / secondsSince / shouldTouch
//       به‌ویژه پروندهٔ «آنلاینِ کهنه»: last_seen_at پیر ⇒ آفلاین
//    ۲) لایهٔ دیتابیس: مایگریشن last_seen_at (idempotent + ایندکس)، مدل،
//       مایگریشن‌شمار (db:verify) و نوشتنِ همیشه‌همراهِ دو فیلد
//    ۳) مسیرها: heartbeat/offline/summary + protect + mount در server.js
//    ۴) فرانت: heartbeat با fetch keepalive (نه sendBeacon ⇒ لو نرفتن توکن)،
//       بازهٔ heartbeat < پنجرهٔ آنلاین سرور (هیچ‌وقت فلشِ آفلاین ندهد)
//    ۵) ثبتِ خود گارد در package.json و هر دو gate runner
//
//  اجرا:  npm run test:presence        (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (relPath) => {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};
const exists = (relPath) => fs.existsSync(path.join(ROOT, relPath));

// ============================================================
// ۱) قواعد خالص (بدون دیتابیس) — قلب رفع باگ «آنلاین همیشه»
// ============================================================
const rules = require(path.join(ROOT, "Backend", "services", "presenceRules.js"));
const NOW = 1_700_000_000_000; // زمان ثابت برای تست قطعی (flaky نشود)
const windowMs = rules.ONLINE_WINDOW_SECONDS * 1000;

check(
  "قواعد: پنجرهٔ آنلاین و throttle عدد مثبت‌اند",
  rules.ONLINE_WINDOW_SECONDS > 0 && rules.TOUCH_THROTTLE_SECONDS > 0,
  `window=${rules.ONLINE_WINDOW_SECONDS}s throttle=${rules.TOUCH_THROTTLE_SECONDS}s`,
);

check(
  "قواعد: کاربرِ تازه‌فعال آنلاین است",
  rules.isOnline(
    { online_status: true, last_seen_at: new Date(NOW - 1000) },
    NOW,
    windowMs,
  ) === true,
);

check(
  "قواعد: کاربری که صریحاً آفلاین شده، هرچند فعالیتش تازه باشد، آفلاین است",
  rules.isOnline(
    { online_status: false, last_seen_at: new Date(NOW - 1000) },
    NOW,
    windowMs,
  ) === false,
);

check(
  "قواعد: ⭐ فعالیتِ کهنه ⇒ آفلاین (رفع باگ «آنلاین همیشه»)",
  rules.isOnline(
    { online_status: true, last_seen_at: new Date(NOW - (windowMs + 1000)) },
    NOW,
    windowMs,
  ) === false,
  `window=${rules.ONLINE_WINDOW_SECONDS}s`,
);

check(
  "قواعد: بدون last_seen_at هرگز آنلاین نیست (کاربرِ قدیمی/بدون‌مایگریشن)",
  rules.isOnline({ online_status: true, last_seen_at: null }, NOW, windowMs) === false &&
    rules.isOnline(null, NOW, windowMs) === false,
);

check(
  "قواعد: secondsSince تاریخِ ISO/کاراکتری را هم می‌فهمد",
  rules.secondsSince(new Date(NOW - 90_000).toISOString(), NOW) === 90 &&
    rules.secondsSince(null, NOW) === null,
);

check(
  "قواعد: throttle نوشتن کار می‌کند (بار اول بله، بلافاصله نه، بعد از بازه بله)",
  rules.shouldTouch(0, NOW, 60_000) === true &&
    rules.shouldTouch(NOW - 1000, NOW, 60_000) === false &&
    rules.shouldTouch(NOW - 60_000, NOW, 60_000) === true,
);

check(
  "قواعد: خلاصهٔ حضور (شمارش + مرتب‌سازی: آنلاین‌ها اول، سپس تازه‌ترین)",
  (() => {
    const summary = rules.buildSummary(
      [
        {
          id: 1,
          username: "b",
          role: "expert",
          status: "active",
          online_status: true,
          last_seen_at: new Date(NOW - 60_000),
        },
        {
          id: 2,
          username: "a",
          role: "admin",
          status: "active",
          online_status: true,
          last_seen_at: new Date(NOW - 1000),
        },
        {
          id: 3,
          username: "c",
          role: "admin",
          status: "active",
          online_status: false,
          last_seen_at: new Date(NOW - 60_000),
        },
      ],
      NOW,
    );
    const order = summary.users.map((user) => user.id).join(",");
    return (
      summary.total === 3 &&
      summary.online === 2 &&
      summary.offline === 1 &&
      summary.window_seconds === rules.ONLINE_WINDOW_SECONDS &&
      order === "2,1,3"
    );
  })(),
);

// ============================================================
// ۲) لایهٔ دیتابیس: مایگریشن، مدل، مایگریشن‌شمار
// ============================================================
const migrationFiles = fs
  .readdirSync(path.join(ROOT, "Backend", "migrations"))
  .filter((file) => file.endsWith(".js"));
const presenceMigration = migrationFiles.find((file) =>
  read(path.join("Backend", "migrations", file)).includes("last_seen_at"),
);
const migrationSource = presenceMigration
  ? read(path.join("Backend", "migrations", presenceMigration))
  : "";

check(
  "مایگریشن: ستون users.last_seen_at با ایندکس اضافه می‌شود",
  Boolean(presenceMigration) &&
    /addColumn\(\s*TABLE,\s*COLUMN|addColumn\(\s*"users",\s*"last_seen_at"/.test(
      migrationSource,
    ) &&
    /Sequelize\.DATE/.test(migrationSource) &&
    /addIndex\(/.test(migrationSource),
  presenceMigration || "-",
);

check(
  "مایگریشن: idempotent است (describeTable/showIndex قبل از تغییر) و down دارد",
  /describeTable/.test(migrationSource) &&
    /showIndex/.test(migrationSource) &&
    /async down\(/.test(migrationSource) &&
    /removeColumn/.test(migrationSource),
);

check(
  "مدل: User.last_seen_at تعریف شده است",
  /last_seen_at:\s*\{/.test(read("Backend/models/User.js")),
);

check(
  "مایگریشن‌شمار: db:verify ستون last_seen_at را جزو ستون‌های users می‌داند",
  /users:\s*\[[\s\S]{0,400}?"last_seen_at"/.test(
    read("Backend/scripts/verify-db.js"),
  ),
);

// ⭐ نگهبان باگ: هرجای بک‌اند که کاربر «آنلاین» می‌شود باید هم‌زمان
//    last_seen_at را هم بنویسد؛ وگرنه دوباره «آنلاینِ بی‌تاریخ» می‌سازیم.
const backendFilesToScan = [
  path.join("Backend", "controllers"),
  path.join("Backend", "services"),
  path.join("Backend", "middleware"),
  path.join("Backend", "routes"),
];
const walkJs = (relDir, acc = []) => {
  const full = path.join(ROOT, relDir);
  if (!fs.existsSync(full)) return acc;
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = path.join(relDir, entry.name);
    if (entry.isDirectory()) walkJs(rel, acc);
    else if (entry.name.endsWith(".js")) acc.push(rel);
  }
  return acc;
};

const onlineWithoutSeen = [];
for (const relFile of backendFilesToScan.flatMap((dir) => walkJs(dir))) {
  const source = read(relFile);
  for (const match of source.matchAll(/online_status:\s*true/g)) {
    const around = source.slice(
      Math.max(0, match.index - 250),
      match.index + 250,
    );
    if (!/last_seen_at/.test(around)) {
      onlineWithoutSeen.push(`${relFile.replace(/\\/g, "/")}:${match.index}`);
    }
  }
}
check(
  "نگهبان: هیچ‌جا کاربر «آنلاین» بدون نوشتن last_seen_at نمی‌شود",
  onlineWithoutSeen.length === 0,
  onlineWithoutSeen.join(" | "),
);

check(
  "نگهبان: کاربر نمی‌تواند با ویرایش پروفایل خودش را آنلاین/تازه نشان دهد",
  /protectedFields\s*=\s*\[[\s\S]{0,400}?"online_status"[\s\S]{0,200}?"last_seen_at"/.test(
    read("Backend/controllers/userController.js"),
  ),
);

check(
  "سرویس: presenceService نوشتن را throttle می‌کند و updated_at را آلوده نمی‌کند",
  /shouldTouch\(/.test(read("Backend/services/presenceService.js")) &&
    /silent:\s*true/.test(read("Backend/services/presenceService.js")),
);

check(
  "میدل‌ور: هر درخواست احراز‌شده حضور کاربر را تازه می‌کند",
  /presenceService["']?\)?\.touch\(user\.id\)|touch\(user\.id\)/.test(
    read("Backend/middleware/auth.js"),
  ),
);

// ============================================================
// ۳) مسیرهای API
// ============================================================
const routesSource = read("Backend/routes/presenceRoutes.js");

check(
  "مسیرها: heartbeat / offline / summary هر سه وجود دارند",
  /post\(\s*"\/heartbeat"/.test(routesSource) &&
    /post\(\s*"\/offline"/.test(routesSource) &&
    /get\(\s*"\/summary"/.test(routesSource),
);

check(
  "مسیرها: همه زیر protect هستند (هویت از توکن، نه از بدنهٔ درخواست)",
  /router\.use\(protect\)/.test(routesSource) &&
    !/req\.body\.(user_?id|id)/.test(routesSource),
);

check(
  "مسیرها: خلاصه فقط با نقش مدیریتی + کلید مجوز (users.onlineStatus.view)",
  /ADMIN_ONLY/.test(routesSource) &&
    /requirePermission\(\s*"users\.onlineStatus\.view"\s*\)/.test(routesSource),
);

check(
  "کاتالوگ: کلید مجوز استفاده‌شده در مسیر وجود دارد (نگهبانِ permissions-test)",
  /users\.onlineStatus\.view/.test(
    read("Backend/config/permissions.js"),
  ),
);

check(
  "server.js: روت‌های حضور mount شده‌اند",
  /app\.use\(\s*"\/api\/presence",\s*presenceRoutes\s*\)/.test(
    read("Backend/server.js"),
  ),
);

// ============================================================
// ۴) فرانت‌اند: heartbeat، keepalive، اتصال به auth/app
// ============================================================
const presenceSource = read("Frontend/src/core/services/presence.service.js");
const apiConstSource = read("Frontend/src/core/constants/api.const.js");

check(
  "ثابت‌ها: سه endpoint حضور در api.const.js ثبت شده‌اند",
  /PRESENCE:\s*\{[\s\S]{0,300}?"\/presence\/heartbeat"[\s\S]{0,200}?"\/presence\/offline"[\s\S]{0,200}?"\/presence\/summary"/.test(
    apiConstSource,
  ),
);

check(
  "فرانت: heartbeat نامرئی است (fetch خام، بدون توست/ریدایرکت apiService)",
  /fetch\(/.test(presenceSource) &&
    !/from\s+"[^"]*api\.service\.js"/.test(presenceSource) &&
    /setInterval\(/.test(presenceSource),
);

check(
  "فرانت: اعلام آفلاین با fetch keepalive است (نه sendBeacon ⇒ توکن در query لو نرود)",
  /keepalive:\s*true/.test(presenceSource) &&
    !/navigator\.sendBeacon\s*\(/.test(presenceSource),
);

check(
  "فرانت: heartbeat فقط وقتی تب دیده می‌شود + نصب visibilitychange/pagehide",
  /document\.hidden/.test(presenceSource) &&
    /visibilitychange/.test(presenceSource) &&
    /pagehide/.test(presenceSource),
);

check(
  "فرانت: بدون حلقهٔ وابستگی (presence هرگز authService را import نمی‌کند)",
  !/auth\.service\.js/.test(presenceSource) &&
    /presence\.service\.js/.test(read("Frontend/src/core/services/app.service.js")),
);

const heartbeatSeconds = Number(
  (presenceSource.match(/HEARTBEAT_SECONDS\s*=\s*(\d+)/) || [])[1] || 0,
);
check(
  "هم‌خوانی: بازهٔ heartbeat دست‌کم نصفِ پنجرهٔ آنلاین سرور است",
  heartbeatSeconds > 0 && heartbeatSeconds * 2 <= rules.ONLINE_WINDOW_SECONDS,
  `heartbeat=${heartbeatSeconds}s window=${rules.ONLINE_WINDOW_SECONDS}s`,
);

check(
  "هم‌خوانی: PRESENCE_HEARTBEAT_SECONDS در .env.example با فرانت یکی است",
  Number(
    (read("Backend/.env.example").match(
      /^PRESENCE_HEARTBEAT_SECONDS=(\d+)/m,
    ) || [])[1] || 0,
  ) === heartbeatSeconds,
);

check(
  "راه‌اندازی: app.service حضور را init و auth.service در ورود/خروج مدیریت می‌کند",
  /presenceService\.init\(\)/.test(read("Frontend/src/core/services/app.service.js")) &&
    /presenceService\.start\(\)/.test(read("Frontend/src/core/services/auth.service.js")) &&
    /presenceService\.logout\(\)/.test(read("Frontend/src/core/services/auth.service.js")),
);

check(
  "تنظیمات: هر سه متغیر محیطی حضور در .env.example مستند شده‌اند",
  /^PRESENCE_ONLINE_WINDOW_SECONDS=\d+/m.test(read("Backend/.env.example")) &&
    /^PRESENCE_TOUCH_THROTTLE_SECONDS=\d+/m.test(read("Backend/.env.example")) &&
    /^PRESENCE_HEARTBEAT_SECONDS=\d+/m.test(read("Backend/.env.example")),
);

// ============================================================
// ۵) ثبت گارد (جلوگیری از «تستِ فراموش‌شده»)
// ============================================================
const frontendPkg = JSON.parse(read("Frontend/package.json") || "{}");
check(
  "ثبت: test:presence در Frontend/package.json و هر دو gate runner هست",
  Boolean(frontendPkg.scripts?.["test:presence"]) &&
    /'test:presence'/.test(read("tools/gate.mjs")) &&
    /'test:presence'/.test(read("tools/gate.ps1")),
);

const backendPkg = JSON.parse(read("Backend/package.json") || "{}");
check(
  "ثبت: تست e2e حضور (دیتابیسی) در Backend تعریف شده است",
  Boolean(backendPkg.scripts?.["test:presence:e2e"]) &&
    exists("Backend/presence-e2e-test.mjs"),
);

// ============================================================
// جمع‌بندی
// ============================================================
const failed = results.filter((ok) => !ok).length;
console.log("");
console.log(
  `${failed === 0 ? "✅ ALL PASS" : `❌ ${failed} FAILED`} — ${results.length} بررسی حضور`,
);
process.exitCode = failed === 0 ? 0 : 1;
