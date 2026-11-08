// ============================================================
// services/registrationRules.js
// منطق خالص «ثبت‌نام عمومی + صف تأیید» — فاز ۱۳.۶
// ------------------------------------------------------------
// چرا این فایل جدا شد؟ (هم‌الگو با otpRules / sessionRules / activityRules)
//   ۱) تست گارد می‌تواند قانون‌ها را **بدون دیتابیس** بسنجد
//   ۲) قواعد یک‌جا دیده می‌شوند: فیلدهای سفید، اعتبارسنجی، گذار وضعیت
//   ۳) هیچ تابعی در این فایل I/O ندارد (بدون await، بدون دیتابیس)
// ------------------------------------------------------------
// 🔒 اصول امنیتی:
//   • فقط «فیلدهای سفید» به لایهٔ داده می‌روند ⇒ role/status/customer_id
//     ارسالی از سمت کاربر هرگز اعمال نمی‌شود (ضد mass-assignment).
//   • درخواست همیشه pending است؛ گذار مجاز فقط pending → approved|rejected.
//   • خروجی عمومی (`publicRequestView`) هیچ ستون حساسی ندارد.
//   • رمز خام در هیچ خروجی/لاگ این فایل برنمی‌گردد.
// ============================================================
"use strict";

const STATUS = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };
const STATUSES = [STATUS.PENDING, STATUS.APPROVED, STATUS.REJECTED];

// ⚠️ حداقل رمز ثبت‌نام عمومی ۸ است (مدل User روی ۶ می‌ماند تا حساب‌های
//    قدیمی نشکنند؛ این سخت‌گیری فقط برای حساب‌های تازه است).
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 100;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 100;
const MAX_CUSTOMER_CODE_LENGTH = 50;
const MAX_NOTE_LENGTH = 500;
const MIN_REJECT_REASON = 3;
const MAX_REJECT_REASON = 300;

// ===== تأیید خودکار (موج ۱۳.۷.۳) =====
// طول متن «دلیلِ شکست تأیید خودکار» — برابر با VARCHAR(200) ستون auto_approve_error
const MAX_AUTO_APPROVE_ERROR = 200;

// ===== پروندهٔ مشتری (حالت «ثبت مشتری جدید» در تأیید) =====
const MAX_FULL_NAME_LENGTH = 200;
const MAX_FARM_NAME_LENGTH = 200;
const MAX_REGION_LENGTH = 50;
const MAX_FARM_ADDRESS_LENGTH = 500;
const NATIONAL_CODE_LENGTH = 10;

// فیلدهایی که «کاربر مهمان» اجازهٔ ارسالشان را دارد — و بس.
const ALLOWED_FIELDS = [
  "first_name",
  "last_name",
  "username",
  "email",
  "mobile_number",
  "password",
  "confirm_password",
  "requested_customer_code",
  "note",
  // موج ۱۳.۷.۲ — اطلاعات پروندهٔ مشتری (پیش‌تر فقط مدیر آن را وارد می‌کرد)
  "customer_type_id",
  "national_code",
  "farm_name",
  "province",
  "county",
];

// فیلدهایی که در بدنه **دیده شدنشان** هم ارزش هشدار دارد (تلاش ارتقای نقش)
const FORBIDDEN_FIELDS = ["role", "status", "customer_id", "created_by", "active"];

// ============================================
// ابزارهای پایه
// ============================================
// ارقام فارسی/عربی → لاتین (کاربر موبایل را با کیبورد فارسی می‌نویسد)
const normalizeDigits = (value) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

const cleanText = (value) =>
  normalizeDigits(value).replace(/[\u200c\u200f\u200e]/g, "").trim();

// فاصله‌های تکراری → یک فاصله (نام‌ها)
const cleanName = (value) => cleanText(value).replace(/\s+/g, " ");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value));

const maskMobile = (value) => {
  const digits = normalizeDigits(value).replace(/\D/g, "");
  if (digits.length < 7) return "";
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
};

// آیا این مقدار یک bcrypt hash است؟ (محافظ در برابر هشِ دوباره)
const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || ""));


// ============================================
// اعتبارسنجی فرم ثبت‌نام عمومی
// ------------------------------------------------------------
// خروجی: { ok, errors: {field: message}, values: {...فیلدهای سفید} }
// ⚠️ هیچ‌کدام از فیلدهای FORBIDDEN در values بازتولید نمی‌شوند.
// ============================================
const validateRegistration = (body = {}) => {
  const errors = {};
  const input = body || {};

  const first_name = cleanName(input.first_name);
  const last_name = cleanName(input.last_name);
  const username = cleanText(input.username).toLowerCase();
  const email = cleanText(input.email).toLowerCase();
  const mobile_number = normalizeDigits(input.mobile_number).replace(/\D/g, "");
  const password = String(input.password ?? "");
  const confirm_password = String(input.confirm_password ?? input.confirmPassword ?? "");
  const requested_customer_code = cleanText(input.requested_customer_code);
  const note = cleanText(input.note);

  // ===== موج ۱۳.۷.۲ — اطلاعات پروندهٔ مشتری (فرم عمومی) =====
  const rawTypeId = normalizeDigits(input.customer_type_id).trim();
  const customer_type_id = rawTypeId === "" ? null : Number(rawTypeId);
  const national_code = normalizeDigits(input.national_code).replace(/\D/g, "");
  const farm_name = cleanText(input.farm_name);
  const province = cleanText(input.province);
  const county = cleanText(input.county);

  if (first_name.length < MIN_NAME_LENGTH || first_name.length > MAX_NAME_LENGTH) {
    errors.first_name = `نام باید بین ${MIN_NAME_LENGTH} تا ${MAX_NAME_LENGTH} کاراکتر باشد`;
  }
  if (last_name.length < MIN_NAME_LENGTH || last_name.length > MAX_NAME_LENGTH) {
    errors.last_name = `نام خانوادگی باید بین ${MIN_NAME_LENGTH} تا ${MAX_NAME_LENGTH} کاراکتر باشد`;
  }
  if (
    username.length < MIN_USERNAME_LENGTH ||
    username.length > MAX_USERNAME_LENGTH ||
    !/^[a-z0-9._-]+$/.test(username)
  ) {
    errors.username =
      "نام کاربری باید ۳ تا ۱۰۰ کاراکتر و شامل حروف انگلیسی، رقم، نقطه، خط تیره یا زیرخط باشد";
  }
  if (!email || email.length > MAX_EMAIL_LENGTH || !isEmail(email)) {
    errors.email = "ایمیل معتبر نیست";
  }
  if (!/^09[0-9]{9}$/.test(mobile_number)) {
    errors.mobile_number = "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `رمز عبور حداکثر ${MAX_PASSWORD_LENGTH} کاراکتر است`;
  } else if (confirm_password !== "" && password !== confirm_password) {
    errors.confirm_password = "تکرار رمز عبور با رمز یکسان نیست";
  }
  if (requested_customer_code.length > MAX_CUSTOMER_CODE_LENGTH) {
    errors.requested_customer_code = `کد/نام پرونده حداکثر ${MAX_CUSTOMER_CODE_LENGTH} کاراکتر است`;
  }
  if (note.length > MAX_NOTE_LENGTH) {
    errors.note = `توضیح حداکثر ${MAX_NOTE_LENGTH} کاراکتر است`;
  }

  // ===== موج ۱۳.۷.۲ — قواعد اطلاعات پروندهٔ مشتری =====
  // نوع مشتری در فرم عمومی اجباری است (بدون آن پروندهٔ مشتری معنا ندارد)
  if (!Number.isInteger(customer_type_id) || customer_type_id <= 0) {
    errors.customer_type_id = "نوع مشتری را از فهرست انتخاب کنید";
  }
  if (national_code !== "" && national_code.length !== NATIONAL_CODE_LENGTH) {
    errors.national_code = `کد ملی باید ${NATIONAL_CODE_LENGTH} رقم باشد`;
  }
  if (farm_name.length > MAX_FARM_NAME_LENGTH) {
    errors.farm_name = `نام واحد/مزرعه حداکثر ${MAX_FARM_NAME_LENGTH} کاراکتر است`;
  }
  if (province.length > MAX_REGION_LENGTH) {
    errors.province = `استان حداکثر ${MAX_REGION_LENGTH} کاراکتر است`;
  }
  if (county.length > MAX_REGION_LENGTH) {
    errors.county = `شهرستان حداکثر ${MAX_REGION_LENGTH} کاراکتر است`;
  }
  // شهرستان بدون استان معنا ندارد (هم‌قاعده با فرم مدیر در موج ۱۳.۷.۱)
  if (county !== "" && province === "") {
    errors.county = "برای انتخاب شهرستان، ابتدا استان را انتخاب کنید";
  }

  const values = {
    first_name,
    last_name,
    username,
    email,
    mobile_number,
    password,
    requested_customer_code: requested_customer_code || null,
    note: note || null,
    // نوع مشتری فقط اگر عدد صحیح مثبت باشد عبور می‌کند (خطا در بالا ثبت شده است)
    customer_type_id:
      Number.isInteger(customer_type_id) && customer_type_id > 0 ? customer_type_id : null,
    national_code: national_code || null,
    farm_name: farm_name || null,
    province: province || null,
    // بدون استان، شهرستان ذخیره نمی‌شود (حتی اگر اعتبارسنجی نادیده گرفته شود)
    county: province && county ? county : null,
  };

  return { ok: Object.keys(errors).length === 0, errors, values };
};

// ============================================
// ساخت ردیف درخواست (فقط فیلدهای سفید)
// ------------------------------------------------------------
// ⚠️ `password` عمداً اینجا نیست: هش‌کردن در registrationService انجام می‌شود
//    تا این فایل «خالص» بماند و رمز خام در هیچ خروجی این ماژول نباشد.
// ============================================
const buildRequestRow = (values = {}, ctx = {}) => {
  const userAgent = String(ctx.userAgent ?? "").slice(0, 255);
  const ip = String(ctx.ip ?? "").slice(0, 45);

  return {
    first_name: values.first_name,
    last_name: values.last_name,
    username: values.username,
    email: values.email,
    mobile_number: values.mobile_number,
    requested_customer_code: values.requested_customer_code || null,
    note: values.note || null,
    // موج ۱۳.۷.۲ — اطلاعات پروندهٔ مشتری (خالی ⇒ null)
    customer_type_id: values.customer_type_id ?? null,
    national_code: values.national_code || null,
    farm_name: values.farm_name || null,
    province: values.province || null,
    county: values.county || null,
    status: STATUS.PENDING,
    ip: ip || null,
    user_agent: userAgent || null,
  };
};

// آیا بدنه تلاش کرده فیلدهای ممنوع را ست کند؟ (برای لاگ هشدار، نه رد کردن)
const forbiddenFieldsIn = (body = {}) =>
  FORBIDDEN_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(body || {}, field));


// ============================================
// گذارهای وضعیت (فقط pending → approved | rejected)
// ============================================
const canReview = (request = {}) => {
  const status = String(request?.status || "");
  if (status === STATUS.PENDING) return { ok: true };
  if (status === STATUS.APPROVED) {
    return { ok: false, message: "این درخواست قبلاً تأیید شده است" };
  }
  if (status === STATUS.REJECTED) {
    return { ok: false, message: "این درخواست قبلاً رد شده است" };
  }
  return { ok: false, message: "وضعیت درخواست نامشخص است" };
};

const validateRejectReason = (raw) => {
  const reason = cleanText(raw);
  if (reason.length < MIN_REJECT_REASON) {
    return {
      ok: false,
      message: `دلیل رد الزامی است (حداقل ${MIN_REJECT_REASON} کاراکتر)`,
      value: "",
    };
  }
  if (reason.length > MAX_REJECT_REASON) {
    return {
      ok: false,
      message: `دلیل رد حداکثر ${MAX_REJECT_REASON} کاراکتر است`,
      value: "",
    };
  }
  return { ok: true, value: reason };
};

// ============================================
// «حالت پروندهٔ مشتری» در لحظهٔ تأیید (موج ۱۳.۷)
// ------------------------------------------------------------
//   existing → اتصال به پروندهٔ موجود (customer_id اجباری)
//   new      → ساخت پروندهٔ مشتری تازه در همان تراکنش (مشتری بدون پرونده)
// ⚠️ هر مقدار ناشناخته ⇒ null تا کنترلر ۴۰۰ بدهد (fail-closed).
// ============================================
const CUSTOMER_MODE = { EXISTING: "existing", NEW: "new" };
const CUSTOMER_MODES = [CUSTOMER_MODE.EXISTING, CUSTOMER_MODE.NEW];

const normalizeCustomerMode = (raw) => {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "") return CUSTOMER_MODE.EXISTING;
  return CUSTOMER_MODES.includes(value) ? value : null;
};

// ============================================
// اعتبارسنجی «پروندهٔ مشتری تازه» (حالت new)
// ------------------------------------------------------------
// ورودی: { customer_type_id, full_name?, farm_name?, national_code?,
//          province?, county?, farm_address?, collection_name? }
// ورودی دوم: ردیف درخواست (برای پیش‌فرض‌ها: نام + موبایل + ایمیل)
// خروجی:  { ok, errors: {field: message}, values: {...فیلدهای سفید} }
// ------------------------------------------------------------
// 🔒 فقط فیلدهای سفید عبور می‌کنند؛ mobile_number/email همیشه از «درخواست»
//    می‌آیند (نه از بدنهٔ مدیر) تا هویت متقاضی دستکاری‌شدنی نباشد.
// ============================================
const validateNewCustomer = (input = {}, request = {}) => {
  const errors = {};
  const src = input || {};

  // ✅ موج ۱۳.۷.۲ — هر فیلدی که مدیر **نفرستد** (null/undefined) از «درخواست»
  //    خوانده می‌شود؛ رشتهٔ خالی عمداً «پاک‌کردن فیلد» است (نه fallback)
  const pick = (key) => {
    const fromInput = src[key];
    if (fromInput === undefined || fromInput === null) return request[key];
    return fromInput;
  };

  const fullName = cleanName(src.full_name) || cleanName(
    `${request.first_name || ""} ${request.last_name || ""}`,
  );
  if (fullName.length < MIN_NAME_LENGTH) {
    errors.full_name = "نام و نام خانوادگی مشتری الزامی است";
  } else if (fullName.length > MAX_FULL_NAME_LENGTH) {
    errors.full_name = `نام مشتری حداکثر ${MAX_FULL_NAME_LENGTH} کاراکتر است`;
  }

  const rawType = normalizeDigits(pick("customer_type_id")).trim();
  const typeId = rawType === "" ? NaN : Number(rawType);
  if (!Number.isInteger(typeId) || typeId <= 0) {
    errors.customer_type_id = "نوع مشتری را از فهرست انتخاب کنید";
  }

  const rawNational = normalizeDigits(pick("national_code")).replace(/\D/g, "");
  if (rawNational !== "" && rawNational.length !== NATIONAL_CODE_LENGTH) {
    errors.national_code = `کد ملی باید ${NATIONAL_CODE_LENGTH} رقم باشد`;
  }

  const farmName = cleanText(pick("farm_name"));
  if (farmName.length > MAX_FARM_NAME_LENGTH) {
    errors.farm_name = `نام واحد/مزرعه حداکثر ${MAX_FARM_NAME_LENGTH} کاراکتر است`;
  }

  const province = cleanText(pick("province"));
  if (province.length > MAX_REGION_LENGTH) {
    errors.province = `استان حداکثر ${MAX_REGION_LENGTH} کاراکتر است`;
  }

  const county = cleanText(pick("county"));
  if (county.length > MAX_REGION_LENGTH) {
    errors.county = `شهرستان حداکثر ${MAX_REGION_LENGTH} کاراکتر است`;
  }
  if (county !== "" && province === "") {
    errors.county = "برای انتخاب شهرستان، ابتدا استان را انتخاب کنید";
  }

  const farmAddress = cleanText(src.farm_address);
  if (farmAddress.length > MAX_FARM_ADDRESS_LENGTH) {
    errors.farm_address = `آدرس حداکثر ${MAX_FARM_ADDRESS_LENGTH} کاراکتر است`;
  }

  const collectionName = cleanText(src.collection_name);
  if (collectionName.length > MAX_FULL_NAME_LENGTH) {
    errors.collection_name = `نام مجموعه حداکثر ${MAX_FULL_NAME_LENGTH} کاراکتر است`;
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: {
      full_name: fullName,
      customer_type_id: Number.isInteger(typeId) && typeId > 0 ? typeId : null,
      national_code: rawNational === "" ? null : rawNational,
      farm_name: farmName || null,
      province: province || null,
      county: province && county ? county : null,
      farm_address: farmAddress || null,
      collection_name: collectionName || null,
    },
  };
};

// ============================================
// «تأیید خودکار» ثبت‌نام (موج ۱۳.۷.۳)
// ------------------------------------------------------------
// وقتی پرچم registration_auto_approve روشن است، کنترلر بلافاصله پس از
// ثبت درخواست، مسیر تأیید را اجرا می‌کند؛ پس هیچ مدیر بازبینی در حلقه
// نیست و ممیزی با auto_approved=true (و reviewed_by = NULL) ثبت می‌شود.
// ============================================
// ستون‌های ممیزیِ نتیجهٔ تأیید: auto_approved + پاک‌کردن دلیل شکست قبلی
const approvalPatch = ({
  reviewerId,
  userId,
  customerId = null,
  customerCreated = false,
  autoApproved = false,
  now = new Date(),
} = {}) => ({
  status: STATUS.APPROVED,
  reviewed_by: reviewerId ?? null,
  reviewed_at: now,
  created_user_id: userId ?? null,
  created_customer_id: customerId ?? null,
  customer_created: customerCreated === true,
  reject_reason: null,
  // ✅ موج ۱۳.۷.۳ — تأیید بدون دخالت مدیر
  auto_approved: autoApproved === true,
  auto_approve_error: null,
});

// شکست تأیید خودکار ⇒ درخواست در صف می‌ماند و دلیلش ثبت می‌شود
const autoApprovalFailurePatch = (reason) => {
  const text = cleanText(reason).slice(0, MAX_AUTO_APPROVE_ERROR);
  return { auto_approve_error: text || null };
};


const rejectionPatch = ({ reviewerId, reason, now = new Date() } = {}) => ({
  status: STATUS.REJECTED,
  reviewed_by: reviewerId ?? null,
  reviewed_at: now,
  reject_reason: reason,
});

// ============================================
// خروجی‌های API (هیچ‌گاه password_hash)
// ============================================
// آنچه «مدیر بازبین» می‌بیند: کل دادهٔ درخواست بدون هش رمز.
const adminRequestView = (row = {}) => ({
  id: row.id,
  first_name: row.first_name,
  last_name: row.last_name,
  username: row.username,
  email: row.email,
  mobile_number: row.mobile_number,
  mobile_masked: maskMobile(row.mobile_number),
  requested_customer_code: row.requested_customer_code || null,
  note: row.note || null,
  // ✅ موج ۱۳.۷.۲ — اطلاعات پروندهٔ مشتری (مودال تأیید از همین‌ها پیش‌پر می‌شود)
  customer_type_id: row.customer_type_id ?? null,
  national_code: row.national_code || null,
  farm_name: row.farm_name || null,
  province: row.province || null,
  county: row.county || null,
  status: row.status,
  reject_reason: row.reject_reason || null,
  reviewed_by: row.reviewed_by ?? null,
  reviewed_at: row.reviewed_at || null,
  created_user_id: row.created_user_id ?? null,
  created_customer_id: row.created_customer_id ?? null,
  customer_created: row.customer_created === true,
  // ✅ موج ۱۳.۷.۳ — آیا این درخواست بدون بازبینی مدیر تأیید شد؟ و اگر نشد چرا؟
  auto_approved: row.auto_approved === true,
  auto_approve_error: row.auto_approve_error || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// پاسخ «ثبت درخواست» به کاربر مهمان — حداقلی و بدون شناسهٔ داخلی
const PUBLIC_PENDING_MESSAGE =
  "درخواست ثبت‌نام شما ثبت شد. پس از بررسی و تأیید مدیر، می‌توانید وارد شوید.";
const PUBLIC_AUTO_APPROVED_MESSAGE =
  "ثبت‌نام شما کامل شد و حساب مشتری‌تان فعال است؛ اکنون می‌توانید با همان نام کاربری و رمز وارد شوید.";

// autoApproved=true فقط وقتی فرستاده می‌شود که تأیید خودکار **موفق** بوده باشد
const publicRequestView = (autoApproved = false) => {
  const approved = autoApproved === true;
  return {
    status: approved ? STATUS.APPROVED : STATUS.PENDING,
    auto_approved: approved,
    message: approved ? PUBLIC_AUTO_APPROVED_MESSAGE : PUBLIC_PENDING_MESSAGE,
  };
};



// ============================================
// پرچم سراسری «ثبت‌نام عمومی باز است؟»
// ------------------------------------------------------------
// • پیش‌فرض بسته است (امن به‌صورت پیش‌فرض).
// • مقدار از تنظیمات سراسری (settingsController: registration_enabled) می‌آید؛
//   هم صفحهٔ ثبت‌نام و هم اندپوینت همین یک منبع را می‌خوانند.
// ============================================
const isRegistrationEnabled = (settingValue) => {
  if (settingValue === true) return true;
  const raw = String(settingValue ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
};

// ✅ موج ۱۳.۷.۳ — پرچم «تأیید خودکار» هم‌قاعده با پرچم «ثبت‌نام باز است»
// (پیش‌فرض خاموش؛ هر مقدار ناشناخته = خاموش ⇒ fail-closed)
const isAutoApproveEnabled = (settingValue) => isRegistrationEnabled(settingValue);


// فیلتر وضعیت صف (query منوی مدیر) — نامعتبر → همه
const normalizeStatusFilter = (raw) => {
  const value = String(raw ?? "").trim().toLowerCase();
  return STATUSES.includes(value) ? value : null;
};

module.exports = {
  // ثابت‌ها
  STATUS,
  STATUSES,
  ALLOWED_FIELDS,
  FORBIDDEN_FIELDS,
  MIN_PASSWORD_LENGTH,
  MIN_REJECT_REASON,
  MAX_REJECT_REASON,
  MAX_FULL_NAME_LENGTH,
  MAX_FARM_NAME_LENGTH,
  MAX_REGION_LENGTH,
  MAX_FARM_ADDRESS_LENGTH,
  NATIONAL_CODE_LENGTH,
  // ابزارهای پایه
  normalizeDigits,
  cleanText,
  isEmail,
  maskMobile,
  isBcryptHash,
  // اعتبارسنجی/ساخت ردیف
  validateRegistration,
  buildRequestRow,
  forbiddenFieldsIn,
  // گذار وضعیت
  canReview,
  validateRejectReason,
  approvalPatch,
  rejectionPatch,
  // پروندهٔ مشتری (موج ۱۳.۷)
  CUSTOMER_MODE,
  CUSTOMER_MODES,
  normalizeCustomerMode,
  validateNewCustomer,
  // تأیید خودکار (موج ۱۳.۷.۳)
  MAX_AUTO_APPROVE_ERROR,
  autoApprovalFailurePatch,
  isAutoApproveEnabled,
  PUBLIC_PENDING_MESSAGE,
  PUBLIC_AUTO_APPROVED_MESSAGE,
  // خروجی API
  adminRequestView,
  publicRequestView,
  // پرچم و فیلتر
  isRegistrationEnabled,
  normalizeStatusFilter,
};
