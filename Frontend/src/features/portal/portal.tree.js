// ============================================================
// features/portal/portal.tree.js
// «درخت و آکاردئون» پورتال مشتری — موج ۱۳.۲۱
// ------------------------------------------------------------
//  چرا فایل جدا و **خالص** (بدون DOM/بدون import)؟
//   • سه پنل (واحدها، سالن‌ها، جوجه‌ریزی) و پنل هفتگی همه به یک
//     «آکاردئون» نیاز دارند: والد ← فرزندها، بدون ناوبری تازه.
//   • اگر HTML آکاردئون در سه رندرکننده کپی شود، کلاس/attribute
//     یکی از سه جا جا می‌ماند. این‌جا یک منبع است و گارد
//     (`portal-tree-test.mjs`) آن را در Node اجرا می‌کند.
//
//  🔒 قواعد سخت:
//   ۱) هیچ شناسهٔ ردیفی از URL/ورودی آزاد خوانده نمی‌شود؛ همه از
//      پاسخ همان GET‌ها (options/details) می‌آیند.
//   ۲) هر مقدار متنی که از DB می‌آید با `treeEsc` فرار می‌کند —
//      حتی نام واحد/سالن (کاربر خودش وارد کرده است).
//   ۳) سقف `TREE_MAX_ITEMS` هم‌قاعدهٔ `FARM_MAX_LIST_ITEMS` است تا
//      پنل با ۳۰۰ واحد به یکباره رندر نشود (همان درس ۱۳.۱۶).
//   ۴) هیچ دادهٔ ساختگی ساخته نمی‌شود: اگر سالنِ بی‌والد بیاید،
//      «والد نامعلوم» نمایش داده نمی‌شود؛ فقط نادیده گرفته می‌شود.
// ============================================================

// سقف آیتم هر سطح (هم‌قاعده با فرم درخواست: ۶۰)
export const TREE_MAX_ITEMS = 60;

// فرار HTML (هم‌الگو با portal.renderer.js)
export const treeEsc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });

const asRows = (rows) => (Array.isArray(rows) ? rows.filter(Boolean) : []);

const idOf = (row) => String(row?.id ?? "").trim();

// نام نمایشی امن (خالی ⇒ برچسب پیش‌فرض همان سطح)
const labelOf = (row, keys, fallback) => {
  for (const key of keys) {
    const value = String(row?.[key] ?? "").trim();
    if (value) return value;
  }
  return fallback;
};


// ============================================================
// ۱) درخت واحد ← سالن
// ------------------------------------------------------------
//  ورودی: همان `options` پاسخ /portal/farm/options
//  خروجی: [{ id, name, raw, halls: [{ id, name, raw }] }]
//  ⚠️ ترتیب خروجی = ترتیب سرور (بدون sort محلی) تا با انتخاب‌گر
//     فرم درخواست یکی بماند.
// ============================================================
export const buildUnitTree = (options = {}) => {
  const units = asRows(options.units).slice(0, TREE_MAX_ITEMS);
  const halls = asRows(options.halls).slice(0, TREE_MAX_ITEMS);

  const tree = units
    .map((unit) => ({
      id: idOf(unit),
      name: labelOf(unit, ["unit_name", "name"], "واحد بدون نام"),
      raw: unit,
      halls: [],
    }))
    .filter((node) => node.id);

  const byId = new Map(tree.map((node) => [node.id, node]));

  halls.forEach((hall) => {
    const parent = byId.get(String(hall?.unit_id ?? "").trim());
    // سالن بی‌والد یا والدِ خارج از سقف ⇒ نمایش داده نمی‌شود
    if (!parent) return;
    parent.halls.push({
      id: idOf(hall),
      name: labelOf(hall, ["hall_name", "name"], "سالن بدون نام"),
      raw: hall,
    });
  });

  return tree;
};

// شمارنده‌های درخت (برای سرصفحه/گارد)
export const treeTotals = (tree) => {
  const rows = asRows(tree);
  return rows.reduce(
    (acc, node) => {
      acc.units += 1;
      acc.halls += asRows(node?.halls).length;
      return acc;
    },
    { units: 0, halls: 0 },
  );
};

// ============================================================
// ۲) گروه‌بندی دوره‌ها بر اساس گله
// ------------------------------------------------------------
//  ورودی: `options.placements` (هر ردیف: flock_number/flock_group_id)
//  خروجی: [{ key, label, placements: [] }]
//  کلید گروه = شناسهٔ گله اگر بود، وگرنه شمارهٔ گله، وگرنه "0".
// ============================================================
export const groupPlacementsByFlock = (placements) => {
  const groups = new Map();

  asRows(placements)
    .slice(0, TREE_MAX_ITEMS)
    .forEach((placement) => {
      const flockId = String(
        placement?.flock_group_id ?? placement?.flock_id ?? "",
      ).trim();
      const flockNumber = String(placement?.flock_number ?? "").trim();
      const key = flockId || flockNumber || "0";
      const label = flockNumber ? `گله ${flockNumber}` : "بدون شمارهٔ گله";

      if (!groups.has(key)) groups.set(key, { key, label, placements: [] });
      groups.get(key).placements.push(placement);
    });

  return [...groups.values()];
};

// ============================================================
// ۳) گروه‌بندی هفته‌ها بر اساس گله
// ------------------------------------------------------------
//  ورودی: `items` پاسخ /portal/weeks (flock_number/week_number)
//  خروجی: [{ key, label, weeks: [] }] — ترتیب هفته‌ها حفظ می‌شود.
// ============================================================
export const groupWeeksByFlock = (weeks) => {
  const groups = new Map();

  asRows(weeks)
    .slice(0, TREE_MAX_ITEMS)
    .forEach((week) => {
      const flockId = String(
        week?.flock_group_id ?? week?.flock_id ?? "",
      ).trim();
      const flockNumber = String(week?.flock_number ?? "").trim();
      const key = flockId || flockNumber || "0";
      const label = flockNumber ? `گله ${flockNumber}` : "بدون شمارهٔ گله";

      if (!groups.has(key)) groups.set(key, { key, label, weeks: [] });
      groups.get(key).weeks.push(week);
    });

  return [...groups.values()];
};



// ============================================================
// ۴) «در انتظار تأیید» بر اساس هدف
// ------------------------------------------------------------
//  منبع: GET /portal/farm/requests. شکل ردیف تضمین‌شده نیست، پس
//  هر ردیف فقط وقتی شمرده می‌شود که هم نوع و هم شناسهٔ هدف را
//  داشته باشد (هیچ حدسی زده نمی‌شود).
//  خروجی: { "unit:12": 2, "hall:7": 1 }
// ============================================================
export const pendingByTarget = (requests) => {
  const out = {};
  asRows(requests).forEach((row) => {
    const status = String(row?.status ?? "").trim().toLowerCase();
    if (status && status !== "pending") return;
    const type = String(row?.target_type ?? row?.type ?? "").trim();
    const id = String(row?.target_id ?? "").trim();
    if (!type || !id) return;
    const bucket = type.startsWith("unit")
      ? "unit"
      : type.startsWith("hall")
        ? "hall"
        : "";
    if (!bucket) return;
    const key = `${bucket}:${id}`;
    out[key] = (out[key] || 0) + 1;
  });
  return out;
};

// ============================================================
// ۵) بلوک آکاردئون (همان <details> بومی — بدون JS برای باز/بسته)
// ------------------------------------------------------------
//  level 1 = والد (واحد/سالن/گله) · level 2 = فرزند (سالن/دوره/هفته)
//  هر بلوک یک `data-acc-id` دارد تا رویدادهای delegation و گارد
//  بتوانند بدون جست‌وجوی متنی هدف را پیدا کنند.
// ============================================================
export const treeAccordion = ({
  id = "",
  title = "",
  subtitle = "",
  badge = "",
  body = "",
  actions = "",
  level = 1,
  open = false,
  tone = "",
} = {}) => {
  const lvl = Math.min(2, Math.max(1, Number(level) || 1));
  const classes = ["portal-acc", `portal-acc--l${lvl}`];
  if (tone) classes.push(`portal-acc--${String(tone)}`);

  return `<details class="${classes.join(" ")}" data-acc-id="${treeEsc(id)}"${
    open ? " open" : ""
  }>
  <summary class="portal-acc__sum">
    <span class="portal-acc__title">${treeEsc(title)}</span>
    ${badge ? `<span class="portal-acc__badge">${treeEsc(badge)}</span>` : ""}
    ${subtitle ? `<span class="portal-acc__sub">${treeEsc(subtitle)}</span>` : ""}
  </summary>
  <div class="portal-acc__body">
    ${actions ? `<div class="portal-acc__actions">${actions}</div>` : ""}
    ${body}
  </div>
</details>`;
};
