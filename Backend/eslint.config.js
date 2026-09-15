// ============================================================
// eslint.config.js (Flat config - ESLint 9/10)
// هدف: گرفتن خطاهای واقعی (متغیر تعریف‌نشده، کلید تکراری، کد مرده)
// نه سخت‌گیری استایل. اجرا: npm run lint
// ============================================================

const COMMON_GLOBALS = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly",
  AbortSignal: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  global: "readonly",
  structuredClone: "readonly",
  // Node 18+ globals (برای فایل‌های تست و آپلود)
  FormData: "readonly",
  Blob: "readonly",
  File: "readonly",
};

const COMMON_RULES = {
  "no-undef": "error",
  // ✅ پارامترها و متغیر catch بدون استفاده هشدار نمی‌گیرند (قرارداد رایج)،
  // اما import/متغیر بدون استفاده (کد مرده) هشدار می‌گیرد.
  "no-unused-vars": [
    "warn",
    {
      args: "none",
      caughtErrors: "none",
      varsIgnorePattern: "^_",
      ignoreRestSiblings: true,
    },
  ],
  "no-dupe-keys": "error",
  "no-dupe-args": "error",
  "no-dupe-class-members": "error",
  "no-unreachable": "error",
  "no-cond-assign": "error",
  "no-constant-condition": "warn",
  // ✅ catch خالی (نادیده‌گرفتن آگاهانهٔ خطا) هشدار ندارد
  "no-empty": ["warn", { allowEmptyCatch: true }],
  "no-fallthrough": "error",
  "no-redeclare": "error",
  "no-self-assign": "error",
  "no-useless-escape": "warn",
  "no-unsafe-finally": "error",
};

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "uploads/**",
      "logs/**",
      "db/**",
      "seeders/**",
      "migrations/**",
    ],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "commonjs",
      globals: {
        ...COMMON_GLOBALS,
        require: "readonly",
        module: "writable",
        exports: "writable",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
    rules: COMMON_RULES,
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...COMMON_GLOBALS },
    },
    rules: COMMON_RULES,
  },
];
