// ============================================================
// features/portal/portal.payload.js
// «نمایش نامدار» payload درخواست‌های فارم — موج ۱۳.۱۶
// ------------------------------------------------------------
//  مسئله (پیش از این موج):
//   ۱) کارشناس در صف و مودال بازبینی به‌جای «نام بیماری/واکسن/دارو»
//      فقط «۵ مورد» می‌دید و شناسه‌های دیکشنری عدد خام بودند
//      (`breed_id: 3`) ⇒ تأیید بدون دانستن محتوا.
//   ۲) ردیف‌های تجهیزات `hall_system_save` حتی دیده نمی‌شدند.
//   ۳) مشتری در «درخواست‌های من» همین مشکل را داشت، در حالی که
//      دیکشنری‌ها از قبل در پاسخ `GET /farm/options` بود و استفاده
//      نمی‌شد.
//   ۴) برچسب‌ها در دو فایل (`PAYLOAD_LABELS` پنل کارشناس و
//      `FARM_FIELD_LABEL` پورتال) جدا تکرار می‌شدند.
//
//  راه‌حل:
//   • برچسب/نوع/دیکشنری هر کلید از **spec فرم** مشتق می‌شود
//     (`FARM_FIELD_LABEL` / `FARM_FIELD_TYPE` / `FARM_FIELD_DICT` در
//     `portal.farm.rules.js`) ⇒ نسخهٔ دوم برچسب ساخته نمی‌شود.
//   • این فایل فقط «مقدار ⇒ متن خوانا» را می‌داند.
//
//  🔒 قواعد:
//   ۱) کلید ناشناخته هرگز ردیف نمی‌سازد (payload سرور فهرست سفید
//      دارد؛ نمایش هم نباید کلید خام را بیرون بدهد).
//   ۲) مقدار آرایه‌ای در ردیف‌های ساده نمی‌آید؛ آرایه‌های شناسه در
//      `payloadIdRowsOf` و ردیف‌های تجهیزات در `equipmentRowsOf`.
//   ۳) خروجی این فایل **متن خام** است (بدون HTML)؛ escape در رندرر
//      انجام می‌شود ⇒ یک نقطهٔ XSS تازه ساخته نمی‌شود.
//   ۴) این فایل DOM نمی‌شناسد ⇒ در گارد پورتال واقعاً اجرا می‌شود.
// ============================================================
import {
  FARM_FIELD_DICT,
  FARM_FIELD_LABEL,
  FARM_FIELD_TYPE,
  FARM_MAX_LIST_ITEMS,
  FARM_PAYLOAD_KEYS,
} from "./portal.farm.rules.js";
import { faNumber, jalaliDate } from "./portal.renderer.js";

// ============================================================
// ۱) نگاشت «نوع فیلد spec» ⇒ «نوع نمایش»
// ------------------------------------------------------------
//  typespec: text|tel|textarea|number|date|radio|check|dict|multi|
//            items|unit|hall|placement|week|flock|static
// ============================================================
const KIND_BY_TYPE = {
  text: "text",
  tel: "text",
  textarea: "text",
  static: "text",
  number: "number",
  date: "date",
  radio: "boolean",
  check: "boolean",
  dict: "id",
  multi: "ids",
  items: "items",
  unit: "context",
  hall: "context",
  placement: "context",
  week: "context",
  flock: "context",
};

// نوع فیلد ⇒ کلید نگاشت «زمینهٔ درخواست» (نام واحد/سالن/دوره/هفته)
const CONTEXT_OF_TYPE = {
  unit: "units",
  hall: "halls",
  placement: "placements",
  week: "weeklies",
  flock: "flocks",
};

// برچسب‌هایی که در چند فرم معنی متفاوت دارند ⇒ برچسب کوتاه و عمومی
// (بقیهٔ برچسب‌ها از spec می‌آید؛ این نقشه «نسخهٔ دوم برچسب‌ها» نیست)
const LABEL_OVERRIDES = {
  notes: "توضیحات",
  hall_number: "شمارهٔ سالن",
  manager_phone: "تلفن مدیر",
  confirm_name: "نام واحد برای تأیید",
};

// کلیدهایی که در خلاصهٔ فهرست نمایش داده نمی‌شوند
// (`note` جدا و به‌صورت «توضیح مشتری» رندر می‌شود، `confirm_name`
//  فقط تأیید تایپی حذف است و ارزش خواندن ندارد)
export const PAYLOAD_HIDDEN_KEYS = ["note", "confirm_name"];

// ============================================================
// ۲) متادیتای هر کلید payload — دقیقاً کلیدهای سفید ۱۸ نوع
// ------------------------------------------------------------
//  🔒 مجموعهٔ کلیدها = اجتماع `FARM_PAYLOAD_KEYS` (۷۲ کلید) ⇒
//     گارد برابری این دو مجموعه را می‌سنجد (جاافتادگی = شکست).
// ============================================================
export const PAYLOAD_KEY_UNION = [
  ...new Set(Object.values(FARM_PAYLOAD_KEYS).flat()),
];

export const PAYLOAD_FIELD_META = PAYLOAD_KEY_UNION.reduce((acc, key) => {
  const type = FARM_FIELD_TYPE[key] || "text";
  const kind = KIND_BY_TYPE[type] || "text";
  acc[key] = {
    key,
    label: LABEL_OVERRIDES[key] || FARM_FIELD_LABEL[key] || key,
    kind,
    dict: kind === "id" || kind === "ids" ? FARM_FIELD_DICT[key] || "" : "",
    context: kind === "context" ? CONTEXT_OF_TYPE[type] || "" : "",
  };
  return acc;
}, {});

export const PAYLOAD_LABEL = (key) =>
  (PAYLOAD_FIELD_META[key] || {}).label || String(key ?? "");

export const PAYLOAD_KIND = (key) => (PAYLOAD_FIELD_META[key] || {}).kind || "";

export const PAYLOAD_DICT_OF = (key) => (PAYLOAD_FIELD_META[key] || {}).dict || "";

// آیا این کلید شناسه/آرایهٔ شناسهٔ دیکشنری است؟ (برای ویرایشگر کارشناس)
export const payloadIsDictionaryKey = (key) =>
  ["id", "ids"].includes(PAYLOAD_KIND(key));

// ============================================================
// ۳) نام یک ردیف دیکشنری
// ------------------------------------------------------------
//  شکل ورودی همان چیزی است که سرور می‌دهد (پورتال و صف کارشناس):
//    dictionaries = { breeds: [{id, name}], … }
//  🔒 هر چیزی جز ردیف شناخته‌شده ⇒ رشتهٔ خالی (نام جعلی ساخته
//     نمی‌شود) و در `idTextOf` به «#شناسه» تبدیل می‌شود.
// ============================================================
export const dictionaryNameOf = (dictionaries, dictKey, id) => {
  const target = Number(id);
  if (!dictKey || !Number.isFinite(target)) return "";
  const rows = (dictionaries && dictionaries[dictKey]) || [];
  if (!Array.isArray(rows)) return "";
  const found = rows.find((row) => Number(row && row.id) === target);
  return found && found.name ? String(found.name).trim() : "";
};

// مقدار متنی یک شناسه: نام دیکشنری ⇒ «#۱۲»
const idTextOf = (id, dictionaries, dictKey) =>
  dictionaryNameOf(dictionaries, dictKey, id) || `#${faNumber(id)}`;

// ============================================================
// ۴) یک مقدار ⇒ متن خوانا
// ------------------------------------------------------------
//  context: { units:{12:"نام"}, halls:{…}, placements:{…},
//             weeklies:{…}, flocks:{…} }  (فقط صف کارشناس)
// ============================================================
export const payloadTextOf = (key, value, dictionaries = {}, context = {}) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return "";
  if (typeof value === "object") return "";

  const meta = PAYLOAD_FIELD_META[key] || { kind: "text" };

  if (meta.kind === "boolean") return value ? "بله" : "خیر";
  if (meta.kind === "date") {
    const jalali = jalaliDate(value);
    return jalali === "—" ? String(value) : jalali;
  }
  if (meta.kind === "number") return faNumber(value);
  if (meta.kind === "id") return idTextOf(value, dictionaries, meta.dict);
  if (meta.kind === "context") {
    const map = (context && context[meta.context]) || {};
    const name = map[String(value)] ?? map[Number(value)];
    return name ? String(name) : `#${faNumber(value)}`;
  }
  return String(value).trim();
};

// ============================================================
// ۵) ردیف‌های نمایش (مقادیر ساده)
// ------------------------------------------------------------
//  ترتیب = ترتیب خود payload (سرور ترتیب فهرست سفید را نگه می‌دارد).
// ============================================================
export const payloadRowsOf = (
  payload,
  dictionaries = {},
  context = {},
  { skip = PAYLOAD_HIDDEN_KEYS } = {},
) => {
  const source = payload && typeof payload === "object" ? payload : {};
  return Object.keys(source)
    .filter((key) => PAYLOAD_FIELD_META[key])
    .filter((key) => !skip.includes(key))
    .map((key) => ({
      key,
      label: PAYLOAD_LABEL(key),
      kind: PAYLOAD_KIND(key),
      text: payloadTextOf(key, source[key], dictionaries, context),
    }))
    .filter((row) => row.text);
};

// ============================================================
// ۶) پنج آرایهٔ شناسهٔ هفتگی ⇒ نام‌ها
// ------------------------------------------------------------
//  «۵ مورد» بی‌فایده است: کارشناس باید بداند کدام بیماری/واکسن/دارو
//  ثبت می‌شود و مشتری باید ببیند چه فرستاده است.
// ============================================================
export const payloadIdRowsOf = (payload, dictionaries = {}) => {
  const source = payload && typeof payload === "object" ? payload : {};
  return Object.keys(PAYLOAD_FIELD_META)
    .filter((key) => PAYLOAD_FIELD_META[key].kind === "ids")
    .map((key) => {
      const list = Array.isArray(source[key]) ? source[key] : [];
      const dictKey = PAYLOAD_FIELD_META[key].dict;
      return {
        key,
        label: PAYLOAD_LABEL(key),
        dict: dictKey,
        items: list.map((id) => ({
          id: Number(id),
          name: idTextOf(id, dictionaries, dictKey),
        })),
      };
    })
    .filter((row) => row.items.length);
};

// ============================================================
// ۷) ردیف‌های تجهیزات (`items` در hall_system_save)
// ------------------------------------------------------------
//  کلیدهای سفید سرور: category/spec/size/capacity/quantity/type_id
//  🔒 ردیف بدون `category` دور ریخته می‌شود (همان قاعدهٔ نرمال‌سازی
//     سرور و `farmPayload` کلاینت).
// ============================================================
const itemTextOf = (value) =>
  String(value === null || value === undefined ? "" : value).trim();

export const equipmentRowsOf = (payload) => {
  const rows = Array.isArray(payload && payload.items) ? payload.items : [];
  return rows
    .slice(0, FARM_MAX_LIST_ITEMS)
    .map((row, index) => {
      const source = row && typeof row === "object" ? row : {};
      return {
        index: index + 1,
        category: itemTextOf(source.category),
        type_id: Number(source.type_id) || 0,
        spec: itemTextOf(source.spec),
        size: itemTextOf(source.size),
        capacity: itemTextOf(source.capacity),
        quantity: Number(source.quantity) || 0,
      };
    })
    .filter((row) => row.category);
};

// تعداد ردیف‌های تجهیزات (برای خلاصهٔ کوتاه فهرست)
export const equipmentCountOf = (payload) => equipmentRowsOf(payload).length;

// ============================================================
// ۸) ردیف‌های «زمینهٔ درخواست» (صف کارشناس)
// ------------------------------------------------------------
//  شناسهٔ واحد/سالن/دوره/هفته/گله بدون نام بی‌معناست: کارشناس باید
//  بداند کدام سالن ویرایش می‌شود. برچسب‌ها را سرور می‌دهد
//  (`context` در پاسخ جزئیات) و این‌جا فقط مرتب می‌شوند.
// ============================================================
export const payloadContextRowsOf = (payload, context = {}) => {
  const source = payload && typeof payload === "object" ? payload : {};
  return Object.keys(PAYLOAD_FIELD_META)
    .filter((key) => PAYLOAD_FIELD_META[key].kind === "context")
    .map((key) => ({ key, value: source[key] }))
    .filter((row) => Number.isInteger(Number(row.value)) && Number(row.value) > 0)
    .map((row) => ({
      key: row.key,
      label: PAYLOAD_LABEL(row.key),
      text: payloadTextOf(row.key, row.value, {}, context),
    }));
};
