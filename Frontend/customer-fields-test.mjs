// ============================================================
//  تست خالص فیلدهای جدید مشتری (کد ملی + نوع مشتری) — فرانت‌اند
//  اجرا:  npm run test:customer-fields     (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  این تست همان توابعی را می‌سنجد که فرم ثبت‌نام و فرم ویرایش
//  استفاده می‌کنند (بدون نیاز به مرورگر).
// ============================================================

// استاب‌های حداقلی (ماژول‌های utils در مرورگر به DOM وابسته‌اند)
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || {};

const { customerListValidation } = await import(
  "./src/features/customer-list/customer-list.validation.js"
);
const { isValidNationalCode, toEnglishDigits } = await import(
  "./src/core/utils/string.utils.js"
);

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// مشتری کامل (بدون نوع مشتری و بدون کد ملی)
const baseForm = {
  full_name: "مشتری تست",
  farm_name: "فارم تست",
  mobile_number: "09151234567",
  province: "خراسان جنوبی",
  county: "بیرجند",
  postal_code: "1234567890",
  farm_address: "آدرس تست شماره یک",
  experience_years: "3-5",
  education_level: "کارشناسی",
  sales_department: "فروش",
  gender: "مرد",
};

const hasError = (errors, needle) => errors.some((e) => e.includes(needle));

// ===== ۱) نوع مشتری: اجباری =====
check(
  "فرم مشتری: نداشتن «نوع مشتری» → خطای اجباری بودن",
  hasError(customerListValidation.validate(baseForm), "نوع مشتری"),
);
check(
  "فرم مشتری: customer_type_id = null → خطای اجباری بودن",
  hasError(
    customerListValidation.validate({ ...baseForm, customer_type_id: null }),
    "نوع مشتری",
  ),
);
check(
  "فرم مشتری: انتخاب نوع مشتری (۱) → خطای نوع مشتری ندارد",
  !hasError(
    customerListValidation.validate({ ...baseForm, customer_type_id: 1 }),
    "نوع مشتری",
  ),
);

// ===== ۲) کد ملی: اختیاری + اعتبارسنجی =====
check(
  "فرم مشتری: کد ملی خالی → خطا ندارد (اختیاری)",
  !hasError(
    customerListValidation.validate({ ...baseForm, customer_type_id: 1 }),
    "کد ملی",
  ),
);
check(
  "فرم مشتری: کد ملی معتبر → خطا ندارد",
  !hasError(
    customerListValidation.validate({
      ...baseForm,
      customer_type_id: 1,
      national_code: "1234567891",
    }),
    "کد ملی",
  ),
);
check(
  "فرم مشتری: کد ملی نامعتبر → خطا دارد",
  hasError(
    customerListValidation.validate({
      ...baseForm,
      customer_type_id: 1,
      national_code: "1234567890",
    }),
    "کد ملی",
  ),
);
check(
  "فرم مشتری: کد ملی با ارقام فارسی پذیرفته می‌شود",
  !hasError(
    customerListValidation.validate({
      ...baseForm,
      customer_type_id: 1,
      national_code: "۱۲۳۴۵۶۷۸۹۱",
    }),
    "کد ملی",
  ),
);
check(
  "فرم مشتری: مشتری کامل (نوع + کد ملی) → هیچ خطایی ندارد",
  customerListValidation.validate({
    ...baseForm,
    customer_type_id: 2,
    national_code: "1234567891",
  }).length === 0,
);

// ===== ۳) توابع مشترک =====
check("isValidNationalCode('1234567891') === true", isValidNationalCode("1234567891") === true);
check("isValidNationalCode('2234567890') === true", isValidNationalCode("2234567890") === true);
check("isValidNationalCode('1234567890') === false", isValidNationalCode("1234567890") === false);
check("isValidNationalCode('1111111111') === false", isValidNationalCode("1111111111") === false);
check("isValidNationalCode('۱۲۳۴۵۶۷۸۹۱') === true", isValidNationalCode("۱۲۳۴۵۶۷۸۹۱") === true);
check(
  "isValidNationalCode('12345') === false",
  isValidNationalCode("12345") === false,
);
check(
  "toEnglishDigits('۱۲۳abc') === '123abc'",
  toEnglishDigits("۱۲۳abc") === "123abc",
  toEnglishDigits("۱۲۳abc"),
);

// ===== ۴) رگرسیون: بقیهٔ قواعد دست‌نخورده =====
check(
  "فرم مشتری: موبایل نامعتبر هنوز خطا می‌دهد",
  hasError(
    customerListValidation.validate({
      ...baseForm,
      mobile_number: "08123",
      customer_type_id: 1,
    }),
    "موبایل",
  ),
);
check(
  "فرم مشتری: کد پستی نامعتبر هنوز خطا می‌دهد",
  hasError(
    customerListValidation.validate({
      ...baseForm,
      postal_code: "12",
      customer_type_id: 1,
    }),
    "کد پستی",
  ),
);

// ===== ۵) ساختار ردیف جدول (۱۴ سلول) — هم‌ترازی ستون‌ها =====
// چرا؟ قبلاً colgroup/سرستون‌ها ۱۴ ستون بودند ولی سطرهای کمکی
// `colspan="13"` داشتند و کلیدهای عملیات زیر ستون «نوع مشتری» می‌افتاد.
const { customerListRenderer } = await import(
  "./src/features/customer-list/customer-list.renderer.js"
);

const tableRowsHtml = customerListRenderer.renderTable(
  [
    {
      id: 1,
      customer_code: 1001,
      full_name: "مشتری الف",
      customer_type: { id: 1, name: "گوشتی" },
      active: true,
    },
    {
      id: 2,
      customer_code: 1002,
      full_name: "مشتری ب",
      customer_type: null,
      active: false,
    },
  ],
  false,
);

const rowHtmlList = tableRowsHtml.match(/<tr[\s\S]*?<\/tr>/g) || [];
const tdCounts = rowHtmlList.map((row) => (row.match(/<td/g) || []).length);

check(
  "رندرر جدول: هر ردیف مشتری دقیقاً ۱۴ سلول دارد (هم‌تراز با ۱۴ ستون)",
  rowHtmlList.length === 2 && tdCounts.every((n) => n === 14),
  `rows=${rowHtmlList.length} tds=${tdCounts.join(",")}`,
);

const firstRowCells = (rowHtmlList[0] || "").split("<td").slice(1);
const secondRowCells = (rowHtmlList[1] || "").split("<td").slice(1);
check(
  "رندرر جدول: سلول ۱۳ «نوع مشتری» و سلول ۱۴ «عملیات» است",
  (firstRowCells[12] || "").includes("گوشتی") &&
    (firstRowCells[13] || "").includes("action-buttons"),
  `cell13=${(firstRowCells[12] || "").trim().slice(0, 30)}`,
);
check(
  "رندرر جدول: مشتری بدون نوع در ستون «نوع مشتری» مقدار «—» می‌گیرد",
  (secondRowCells[12] || "").includes("—"),
);
check(
  "رندرر جدول: tooltip ستون نوع مشتری موجود است (title)",
  (firstRowCells[12] || "").includes('title="نوع مشتری: گوشتی"'),
);
check(
  "رندرر جدول: متن‌های دیتابیس escape می‌شوند (جلوگیری از XSS)",
  (() => {
    const rowsHtml = customerListRenderer.renderTable(
      [
        {
          id: 9,
          customer_code: 1009,
          full_name: "<img src=x onerror=alert(1)>",
          customer_type: { id: 2, name: "<b>نوع</b>" },
          collection_name: "<script>bad()</script>",
          active: true,
        },
      ],
      false,
    );
    return (
      !rowsHtml.includes("<img src=x") &&
      !rowsHtml.includes("<script>bad()") &&
      rowsHtml.includes("&lt;img src=x")
    );
  })(),
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
