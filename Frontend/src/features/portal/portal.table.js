// ============================================================
// features/portal/portal.table.js
// «جدول ریسپانسیو» پورتال — موج ۱۳.۲۱
// ------------------------------------------------------------
//  خواستهٔ کارفرما: در هیچ صفحه‌ای اسکرول افقی نداشته باشیم.
//  راه‌حل بدون دست‌زدن به ۹ رندرکنندهٔ جدول:
//   ۱) هر `td` برچسب سرستون خودش را در `data-label` می‌گیرد
//      (یک‌بار، idempotent).
//   ۲) CSS در عرض کم، `thead` را پنهان و هر ردیف را «کارت» می‌کند؛
//      برچسب هر خانه با `::before { content: attr(data-label) }`
//      نمایش داده می‌شود.
//  ⇒ جدول تازه‌ای که فردا اضافه شود، خودکار پوشش می‌گیرد.
//
//  🔒 چرا تابع خالص/بی‌اثر است؟ چون روی DOM واقعی اجرا می‌شود ولی
//     هیچ محتوایی را عوض نمی‌کند (فقط attribute) — پس خطر XSS ندارد.
// ============================================================

// برچسب سرستون‌ها را روی هر خانه می‌نویسد. خروجی: تعداد خانه‌های تازه‌برچسب‌خورده.
export const decorateTables = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return 0;

  let touched = 0;

  root.querySelectorAll("table.portal-table").forEach((table) => {
    const heads = table.querySelectorAll("thead th");
    // جدول «برچسب/مقدار» سرستون ندارد ⇒ کاری لازم نیست
    if (!heads.length) return;

    // نشانهٔ «این جدول در موبایل کارت می‌شود» (CSS همین را هدف می‌گیرد)
    if (table.getAttribute("data-cards") !== "1") {
      table.setAttribute("data-cards", "1");
      touched += 1;
    }

    const labels = [];
    heads.forEach((th) => labels.push(String(th.textContent ?? "").trim()));

    table.querySelectorAll("tbody tr").forEach((tr) => {
      const cells = tr.querySelectorAll("td");
      cells.forEach((td, index) => {
        const label = labels[index] || "";
        if (!label) return;
        if (td.getAttribute("data-label") === label) return;
        td.setAttribute("data-label", label);
        touched += 1;
      });
    });
  });

  return touched;
};
