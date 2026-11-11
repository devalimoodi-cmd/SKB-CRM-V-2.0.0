// ============================================================
//  گارد «ارسال تیکت» — موج ۱۳.۲۲
// ------------------------------------------------------------
//  مسئله‌ای که این گارد می‌بندد:
//   ۱۳.۲۱ پنل «ارسال تیکت» را ساخت و کلید محتوایی
//   `customer.portal.tickets` را در کاتالوگ گذاشت، ولی روت‌های
//   `/api/suggestions` فقط `protect` داشتند. یعنی «بستن کلید از پنل
//   مدیریت نقش‌ها» فقط دکمه را پنهان می‌کرد و درخواست دستی همان
//   گفتگوها را برمی‌گرداند. این موج همان کلید را به سرور آورد.
//
//  چرا `requireRolePermission` و نه `requirePermission`؟
//   همان روت‌ها مودال «پاکت پیام‌ها»ی هدر برای کارشناس/ادمین را هم
//   سرو می‌کنند؛ کلید فقط-مشتری است (D.customerOnly). گیت عمومی،
//   مودال کارکنان را می‌بست. پس گیتِ کلید فقط برای نقش مشتری اجرا
//   می‌شود و بقیهٔ نقش‌ها همان رفتار ۱۳.۲۱ را دارند.
//
//  اجرا:  npm run test:portal-tickets      (در پوشهٔ Backend)
//  ⭐ بخش‌های ۱ و ۲ **واقعاً اجرا** می‌شوند (بدون دیتابیس).
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const BACKEND = import.meta.dirname;
const ROOT = path.join(BACKEND, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (relPath) => {
  try {
    return fs
      .readFileSync(path.join(ROOT, relPath), "utf8")
      .replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};
const exists = (relPath) => fs.existsSync(path.join(ROOT, relPath));

const stripComments = (source) =>
  String(source || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

// ============================================================
// ۰) فایل‌ها و ماژول‌های واقعی
// ============================================================
const FILES = {
  middleware: "Backend/middleware/permissions.js",
  routes: "Backend/routes/suggestionRoutes.js",
  schema: "Backend/config/portalSchema.js",
  catalog: "Backend/config/permissions.js",
  panel: "Frontend/src/features/portal/portal.tickets.js",
  messagesApi: "Frontend/src/features/messages/messages.api.js",
  apiConst: "Frontend/src/core/constants/api.const.js",
  service: "Frontend/src/features/portal/portal.service.js",
  fePackage: "Frontend/package.json",
  bePackage: "Backend/package.json",
  gateMjs: "tools/gate.mjs",
  gatePs1: "tools/gate.ps1",
};

check(
  "۱۳.۲۲ · همهٔ فایل‌های کلیدی موجود و غیرخالی‌اند",
  Object.values(FILES).every((rel) => exists(rel) && read(rel).trim().length > 200),
);

const schema = require(path.join(BACKEND, "config/portalSchema.js"));
const catalog = require(path.join(BACKEND, "config/permissions.js"));
const { requireRolePermission, requirePermission } = require(
  path.join(BACKEND, "middleware/permissions.js"),
);
const { protect } = require(path.join(BACKEND, "middleware/auth.js"));
const router = require(path.join(BACKEND, "routes/suggestionRoutes.js"));

const KEY = schema.KEYS.TICKETS;

const CODE = {
  middleware: stripComments(read(FILES.middleware)),
  routes: stripComments(read(FILES.routes)),
  panel: stripComments(read(FILES.panel)),
};


// ============================================================
// ۱) میان‌افزار: گیت نقش‌محور واقعاً چه می‌کند؟
// ============================================================
const makeRes = () => {
  const state = { statusCode: 200, body: null };
  const res = {
    status(code) {
      state.statusCode = code;
      return res;
    },
    json(payload) {
      state.body = payload;
      return res;
    },
  };
  return { res, state };
};

const runGuard = async (guard, req) => {
  const { res, state } = makeRes();
  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };
  await guard(req, res, next);
  return { ...state, nextCalls };
};

const customerReq = (granted = []) => ({
  user: {
    id: 7,
    role: "customer",
    customer_id: 12,
    permissions: new Set(granted),
  },
});
const staffReq = (role, granted = []) => ({
  user: { id: 8, role, permissions: new Set(granted) },
});

const GUARD = requireRolePermission("customer", KEY);

// حالت «اجرا» (PERMISSIONS_ENFORCE=true) — همان چیزی که در سرور واقعی است
process.env.PERMISSIONS_ENFORCE = "true";

const denied = await runGuard(GUARD, customerReq());
check(
  "۱۳.۲۲ · مشتری بدون کلید ⇒ ۴۰۳ با پرچم permissionDenied و کلید لازم",
  denied.statusCode === 403 &&
    denied.body?.permissionDenied === true &&
    Array.isArray(denied.body?.required) &&
    denied.body.required.includes(KEY) &&
    denied.nextCalls === 0,
  `status=${denied.statusCode} next=${denied.nextCalls}`,
);

const allowed = await runGuard(GUARD, customerReq([KEY]));
check(
  "۱۳.۲۲ · مشتری با کلید ⇒ عبور (بدون پاسخ ۴۰۳)",
  allowed.statusCode === 200 && allowed.body === null && allowed.nextCalls === 1,
);

for (const role of ["expert", "sub_admin", "admin"]) {
  const result = await runGuard(GUARD, staffReq(role));
  check(
    `۱۳.۲۲ · نقش «${role}» بدون کلید ⇒ عبور (مودال هدر دست‌نخورده)`,
    result.statusCode === 200 && result.body === null && result.nextCalls === 1,
  );
}

const superAdmin = await runGuard(GUARD, staffReq("super_admin"));
check(
  "۱۳.۲۲ · سوپرادمین همیشه عبور می‌کند",
  superAdmin.nextCalls === 1 && superAdmin.statusCode === 200,
);

const anonymous = await runGuard(GUARD, {});
check(
  "۱۳.۲۲ · بدون احراز هویت ⇒ ۴۰۱ (protect همیشه اول است)",
  anonymous.statusCode === 401 && anonymous.nextCalls === 0,
);

check(
  "۱۳.۲۲ · نشانه‌های خوانا: __permissionKeys و __onlyRoles",
  Array.isArray(GUARD.__permissionKeys) &&
    GUARD.__permissionKeys.length === 1 &&
    GUARD.__permissionKeys[0] === KEY &&
    Array.isArray(GUARD.__onlyRoles) &&
    GUARD.__onlyRoles.length === 1 &&
    GUARD.__onlyRoles[0] === "customer",
  `${JSON.stringify(GUARD.__permissionKeys)} / ${JSON.stringify(GUARD.__onlyRoles)}`,
);

check(
  "۱۳.۲۲ · خروجی گیت هم‌شکل با requirePermission است (کلید یکتا)",
  Array.isArray(requirePermission(KEY).__permissionKeys) &&
    requirePermission(KEY).__permissionKeys.length === 1,
);

// حالت «آزمایشی» (پیش‌فرض سرور): هیچ ۴۰۳ برگردانده نمی‌شود
const warn = console.warn;
console.warn = () => {};
process.env.PERMISSIONS_ENFORCE = "false";
const dryRun = await runGuard(GUARD, customerReq());

// ============================================================
// ۲) روتر: کدام مسیرها گیت دارند و کدام‌ها نه؟
// ============================================================
const routes = router.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    method: Object.keys(layer.route.methods)[0],
    path: layer.route.path,
    stack: layer.route.stack.map((entry) => entry.handle),
  }));

const routeOf = (method, routePath) =>
  routes.find((row) => row.method === method && row.path === routePath);

const CUSTOMER_ROUTES = [
  ["post", "/"],
  ["get", "/mine"],
  ["get", "/unread-count"],
  ["get", "/:id"],
  ["post", "/:id/reply"],
  ["post", "/:id/read"],
];

const ADMIN_ROUTES = [
  ["get", "/"],
  ["get", "/:id/admin"],
  ["post", "/:id/admin-reply"],
  ["patch", "/:id"],
  ["delete", "/:id/messages/:messageId"],
  ["delete", "/:id"],
];

check(
  "۱۳.۲۲ · روتر همان ۱۲ مسیر را ثبت کرده است",
  routes.length === 12,
  String(routes.length),
);

check(
  "۱۳.۲۲ · protect سطح روتر است و هیچ مسیری بی‌احراز هویت نیست",
  router.stack[0]?.handle === protect &&
    routes.every((route) => !route.stack.includes(protect)),
);

const gateOf = (route) =>
  route ? route.stack.find((handle) => handle.__onlyRoles) : null;

const missingGate = CUSTOMER_ROUTES.filter(([method, routePath]) => {
  const gate = gateOf(routeOf(method, routePath));
  return (
    !gate ||
    !Array.isArray(gate.__permissionKeys) ||
    !gate.__permissionKeys.includes(KEY) ||
    gate.__onlyRoles.join(",") !== "customer"
  );
});

check(
  "۱۳.۲۲ · شش روت گفتگوی مشتری گیت «ارسال تیکت» دارند (فقط نقش مشتری)",
  missingGate.length === 0,
  missingGate.map((row) => row.join(" ")).join(" | "),
);

const gateFirst = CUSTOMER_ROUTES.every(([method, routePath]) => {
  const route = routeOf(method, routePath);
  return Boolean(route) && gateOf(route) === route.stack[0];
});

check("۱۳.۲۲ · گیت همیشه اولین هندلر بعد از protect است", gateFirst);

const limiterAfterGate = ["/", "/:id/reply"].every((routePath) => {
  const route = routeOf("post", routePath);
  if (!route) return false;
  const gateIndex = route.stack.indexOf(gateOf(route));
  const limiterIndex = route.stack.findIndex(
    (handle) => handle.__rateLimiter && handle !== gateOf(route),
  );
  return gateIndex === 0 && limiterIndex > gateIndex;
});

check(
  "۱۳.۲۲ · محدودیت نرخ ارسال بعد از گیت می‌آید (۴۰۳ سهمِ کاربر را نمی‌سوزاند)",
  limiterAfterGate,
);

const adminLeak = ADMIN_ROUTES.filter(([method, routePath]) => {
  const route = routeOf(method, routePath);
  if (!route) return true;
  return route.stack.some(
    (handle) =>
      Array.isArray(handle.__permissionKeys) &&
      handle.__permissionKeys.includes(KEY),
  );
});

check(
  "۱۳.۲۲ · هیچ روت ادمینی کلید «ارسال تیکت» را نمی‌خواهد",
  adminLeak.length === 0,
  adminLeak.map((row) => row.join(" ")).join(" | "),
);

check(
  "۱۳.۲۲ · کلیدهای مدیریتی گفتگو سر جای خود هستند",
  (routeOf("get", "/")?.stack || []).some((handle) =>
    (handle.__permissionKeys || []).includes("suggestions.admin.view"),
  ) &&
    (routeOf("post", "/:id/admin-reply")?.stack || []).some((handle) =>
      (handle.__permissionKeys || []).includes("suggestions.reply"),
    ) &&
    (routeOf("patch", "/:id")?.stack || []).some((handle) =>
      (handle.__permissionKeys || []).includes("suggestions.status"),
    ),
);

check(
  "۱۳.۲۲ · حذف گفتگو/پیام همچنان ادمین‌محور است (authorize + کلید حذف)",
  ["/messages/:messageId", ""].every((suffix) => {
    const route = routeOf("delete", `/:id${suffix}`);
    if (!route) return false;
    const roles = route.stack.find((handle) => handle.__roles);
    const keys = route.stack.flatMap((handle) => handle.__permissionKeys || []);
    return (
      Boolean(roles) &&
      ["super_admin", "admin", "sub_admin"].every((role) =>
        roles.__roles.includes(role),
      ) &&
      keys.includes("suggestions.delete")
    );
  }),
);

check(
  "۱۳.۲۲ · منبعِ مسیر: کلید از اسکیمای پورتال خوانده می‌شود، نه رشتهٔ دستی",
  /require\(\s*"\.\.\/config\/portalSchema"\s*\)/.test(CODE.routes) &&
    /KEYS:\s*PORTAL_KEYS/.test(CODE.routes) &&
    /PORTAL_KEYS\.TICKETS/.test(CODE.routes) &&
    !CODE.routes.includes(`"${KEY}"`),
);

check(
  "۱۳.۲۲ · منبعِ مسیر: requireRolePermission(\"customer\", …) و نه گیت عمومی",
  /requireRolePermission\(\s*"customer"/.test(CODE.routes) &&
    !/requirePermission\(\s*PORTAL_KEYS\.TICKETS\s*\)/.test(CODE.routes),
);

const controller = require(path.join(BACKEND, "controllers/suggestionController.js"));

const handlerNames = {
  "post /": "createSuggestion",
  "get /mine": "getMySuggestions",
  "get /unread-count": "getUnreadCount",
  "get /:id": "getMyThread",
  "post /:id/reply": "replyToThread",
  "post /:id/read": "markThreadRead",
};

const wrongHandler = CUSTOMER_ROUTES.filter(([method, routePath]) => {
  const route = routeOf(method, routePath);
  const expected = controller[handlerNames[`${method} ${routePath}`]];
  return !route || route.stack[route.stack.length - 1] !== expected;
});

check(
  "۱۳.۲۲ · کنترلر همچنان آخرین هندلر هر شش مسیر است",
  wrongHandler.length === 0,
  wrongHandler.map((row) => row.join(" ")).join(" | "),
);

// ============================================================
// ۳) یک منبع بودن کلید (اسکیما / کاتالوگ / پنل)
// ============================================================
check(
  "۱۳.۲۲ · کلید در اسکیما و کاتالوگ دقیقاً customer.portal.tickets است",
  KEY === "customer.portal.tickets" &&
    Object.values(schema.KEYS).includes(KEY) &&
    catalog.PERMISSION_KEYS.includes(KEY),
);

check(
  "۱۳.۲۲ · پیش‌فرض کاتالوگ: مشتری روشن، کارکنان خاموش، بدون قفل",
  catalog.defaultFor("customer", KEY) === true &&
    ["expert", "sub_admin", "admin", "super_admin"].every(
      (role) => catalog.defaultFor(role, KEY) === false,
    ) &&
    catalog.PERMISSIONS[KEY].lockedTo.length === 0,
);

check(
  "۱۳.۲۲ · پنل tickets و پرچم features.tickets به همین کلید اشاره می‌کنند",
  schema.panelById("tickets").content.keys.includes(KEY) &&
    schema.PORTAL_FEATURES.find((row) => row.key === "tickets")?.extra === KEY,
);

// ============================================================
// ۴) هم‌ترازی فرانت (همان کلید، همان اندپوینت‌ها)
// ============================================================
const tabConf = /export const TICKETS_TAB = \{([\s\S]*?)\n\};/.exec(
  read(FILES.panel),
);
const tabBody = tabConf ? tabConf[1] : "";

check(
  "۱۳.۲۲ · TICKETS_TAB.requires همان کلید سرور است",
  new RegExp(`requires:\\s*"${KEY}"`).test(tabBody) &&
    /permission:\s*"customer\.portal\.menu\.tickets"/.test(tabBody),
);

check(
  "۱۳.۲۲ · پنل فقط از پنج متد گفتگوی خودِ کاربر استفاده می‌کند (نه متد ادمین)",
  ["getMine", "getThread", "create", "reply", "markRead"].every((method) =>
    new RegExp(`messagesApi\\.${method}\\(`).test(CODE.panel),
  ) &&
    !/messagesApi\.(getAdminList|getAdminThread|adminReply|updateStatus|remove|removeMessage)\(/.test(
      CODE.panel,
    ),
);

check(
  "۱۳.۲۲ · گیت محتوا در پنل سرور-اول است (canCreateTicket)",
  /if\s*\(conf\s*&&\s*!this\.canCreateTicket\(\)\)/.test(CODE.panel) &&
    /typeof features\.tickets === "boolean"/.test(CODE.panel),
);

const apiConst = read(FILES.apiConst);

check(
  "۱۳.۲۲ · هر شش مسیر گیت‌شده در api.const تعریف شده‌اند",
  ["/suggestions", "/suggestions/mine", "/suggestions/unread-count"].every(
    (routePath) => apiConst.includes(`"${routePath}"`),
  ) &&
    ["/suggestions/:id", "/suggestions/:id/reply", "/suggestions/:id/read"].every(
      (routePath) => apiConst.includes(`"${routePath}"`),
    ),
);

const serviceSrc = read(FILES.service);

check(
  "۱۳.۲۲ · سرویس پورتال mixin تیکت را سوار می‌کند (بدون مسیر دوم)",
  /applyPortalTickets\(PortalService\)/.test(serviceSrc) &&
    /import\s*\{\s*applyPortalTickets\s*\}/.test(serviceSrc),
);

check(
  "۱۳.۲۲ · هدر سراسری همان API را می‌خواند (یک اندپوینت، دو نما)",
  /SUGGESTIONS/.test(read(FILES.messagesApi)) &&
    /getUnreadCount\(\)/.test(read(FILES.messagesApi)),
);

// ============================================================
// ۵) ثبت در npm و دروازه
// ============================================================
const fePkg = JSON.parse(read(FILES.fePackage) || "{}");
const bePkg = JSON.parse(read(FILES.bePackage) || "{}");

check(
  "۱۳.۲۲ · اسکریپت test:portal-tickets در Backend/package.json ثبت شده است",
  bePkg.scripts?.["test:portal-tickets"] === "node portal-tickets-test.mjs",
  String(bePkg.scripts?.["test:portal-tickets"]),
);

check(
  "۱۳.۲۲ · همان اسکریپت از Frontend قابل اجراست (هم‌الگوی بقیهٔ گاردها)",
  fePkg.scripts?.["test:portal-tickets"] ===
    "node ../Backend/portal-tickets-test.mjs",
  String(fePkg.scripts?.["test:portal-tickets"]),
);

check(
  "۱۳.۲۲ · دروازهٔ کیفیت (gate.mjs و gate.ps1) این گارد را اجرا می‌کند",
  read(FILES.gateMjs).includes("'test:portal-tickets'") &&
    read(FILES.gatePs1).includes("'test:portal-tickets'"),
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log("");
console.log("============================================================");
console.log(`  گیت «ارسال تیکت» (سرور) — ${passed}/${results.length} بررسی`);
console.log(`  کلید: ${KEY} · مسیرهای گیت‌شده: ${CUSTOMER_ROUTES.length}`);
console.log("============================================================");

if (failed > 0) {
  console.error(`❌ ${failed} بررسی ناموفق`);
  process.exit(1);
}

console.log("✅ گیت سرور «ارسال تیکت» کامل و هم‌تراز با اسکیماست");
process.exit(0);


process.env.PERMISSIONS_ENFORCE = "true";
console.warn = warn;
check(
  "۱۳.۲۲ · در حالت dry-run (PERMISSIONS_ENFORCE=false) عبور می‌کند",
  dryRun.statusCode === 200 && dryRun.nextCalls === 1,
);
