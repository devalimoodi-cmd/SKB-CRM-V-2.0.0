// ============================================================
// scripts/verify-db.js
// تأیید ساختار دیتابیس — «فقط خواندنی» (مناسب اجرا روی سرور)
// ------------------------------------------------------------
// اجرا:  npm run db:verify      (یا: node scripts/verify-db.js --json)
// ------------------------------------------------------------
// بررسی می‌کند:
//   ۱) وجود جدول‌های کلیدی
//   ۲) وجود ستون‌های کلیدی
//   ۳) وجود ایندکس‌های جدول‌های «نظرات و پیشنهادات»
//   ۴) اعمال‌شدن همهٔ فایل‌های migrations (مقایسه با جدول SequelizeMeta)
//   ۵) شمارندهٔ اطلاعاتی چند جدول
// ⚠️ هیچ INSERT/UPDATE/DELETE/DROP انجام نمی‌دهد؛ امن برای production.
// ============================================================
const fs = require("node:fs");
const path = require("node:path");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

const { sequelize } = require("../config/database");

const AS_JSON = process.argv.includes("--json");
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

const EXPECTED_TABLES = [
  "users",
  "customer_personal_information",
  "units",
  "unit_statuses",
  "unit_experts",
  "halls",
  "hall_physical_info",
  "hall_systems",
  "hall_water_feed",
  "hall_hygiene",
  "chick_placements",
  "flocks",
  "weekly_management",
  "weekly_diseases",
  "weekly_vaccines",
  "weekly_medicines",
  "weekly_feeds",
  "weekly_suggestions",
  "flock_completions",
  "flock_completion_halls",
  "visit_reports",
  "visit_report_attachments",
  "bookmarks",
  "sms_logs",
  "app_settings",
  "breed_weight_standards",
  "diseases",
  "vaccines",
  "medicines",
  "feed_types",
  "suggestion_types",
  "cities",
  "suggestions",
  "suggestion_messages",
  // ✅ «تغییرات جدید / What's New»
  "release_notes",
  "release_note_items",
  "release_note_views",
  // ✅ «نوع مشتری» (جدول دیکشنری)
  "customer_types",
  "SequelizeMeta",
];

const EXPECTED_COLUMNS = {
  users: [
    "profile_image",
    "role",
    "status",
    "failed_login_attempts",
    "locked_until",
    "online_status",
  ],
  customer_personal_information: [
    "customer_code",
    "full_name",
    "active",
    "province",
    "county",
    // ✅ فیلدهای جدید (مایگریشن 20260919120000)
    "national_code",
    "customer_type_id",
  ],
  units: ["customer_personal_information_id", "unit_name", "is_active"],
  halls: ["unit_id", "is_active"],
  chick_placements: ["flock_id", "hall_id", "is_active"],
  flocks: ["customer_id", "unit_id", "flock_number", "status"],
  weekly_management: [
    "chick_placement_id",
    "week_number",
    "weekly_weight",
    "weekly_mortality",
  ],
  visit_report_attachments: ["visit_report_id", "file_name", "file_path", "mime_type"],
  suggestions: [
    "user_id",
    "subject",
    "title",
    "status",
    "admin_unread",
    "user_unread",
    "messages_count",
    "last_message_at",
    "last_sender",
  ],
  suggestion_messages: [
    "suggestion_id",
    "sender_type",
    "sender_id",
    "body",
    "read_at",
  ],
  release_notes: [
    "version",
    "title",
    "description",
    "status",
    "audience",
    "published_at",
    "created_by",
    "updated_by",
  ],
  release_note_items: [
    "release_note_id",
    "category",
    "title",
    "description",
    "tag",
    "sort_order",
  ],
  release_note_views: [
    "release_note_id",
    "user_id",
    "seen_at",
    "dont_show_again",
  ],
  customer_types: ["name", "description", "sort_order", "active"],
};

const EXPECTED_INDEXES = [
  "suggestions_user_id",
  "suggestions_status",
  "suggestions_admin_unread",
  "suggestions_user_unread",
  "suggestions_last_message_at",
  "suggestion_messages_suggestion_id",
  "suggestion_messages_created_at",
  // ✅ «تغییرات جدید / What's New»
  "release_notes_status",
  "release_notes_audience",
  "release_notes_published_at",
  "release_note_items_release_note_id",
  "release_note_items_category",
  "release_note_views_release_note_id",
  "release_note_views_user_id",
  "release_note_views_release_user_unique",
];

const COUNT_TABLES = [
  "suggestions",
  "suggestion_messages",
  "release_notes",
  "release_note_items",
  "release_note_views",
  "customer_types",
];

// ============================================
// ابزار گزارش
// ============================================
const results = { pass: [], fail: [], info: [] };

const log = (msg) => {
  if (!AS_JSON) console.log(msg);
};
const ok = (name, extra = "") => {
  results.pass.push(name);
  log(`${extra ? extra + " :: " : ""}PASS - ${name}`);
};
const bad = (name, extra = "") => {
  results.fail.push(name);
  log(`${extra ? extra + " :: " : ""}FAIL - ${name}`);
};
const info = (name) => {
  results.info.push(name);
  log(`ℹ️  ${name}`);
};
const query = (sql) => sequelize.query(sql);

// ============================================
// اجرای بررسی‌ها
// ============================================
const main = async () => {
  try {
    await sequelize.authenticate();
    ok("اتصال به دیتابیس برقرار شد");
  } catch (error) {
    bad(`اتصال به دیتابیس ناموفق بود (${error.message})`);
    return;
  }

  const [tableRows] = await query(
    "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'",
  );
  const tables = new Set(tableRows.map((row) => row.name));

  // ===== ۱) جدول‌ها =====
  const missingTables = EXPECTED_TABLES.filter((name) => !tables.has(name));
  if (missingTables.length === 0) {
    ok(`همهٔ ${EXPECTED_TABLES.length} جدول کلیدی موجود است`);
  } else {
    bad(`جدول‌های غایب: ${missingTables.join(", ")}`);
    if (missingTables.includes("suggestions")) {
      info("راهنما: مایگریشن را اجرا کن → npm run db:migrate");
    }
  }

  // ===== ۲) ستون‌ها =====
  const [columnRows] = await query(
    "SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema='public'",
  );
  const columns = new Set(columnRows.map((row) => `${row.t}.${row.c}`));

  const missingColumns = [];
  Object.entries(EXPECTED_COLUMNS).forEach(([table, cols]) => {
    cols.forEach((col) => {
      if (!columns.has(`${table}.${col}`)) missingColumns.push(`${table}.${col}`);
    });
  });
  if (missingColumns.length === 0) {
    ok("همهٔ ستون‌های کلیدی موجود است");
  } else {
    bad(`ستون‌های غایب: ${missingColumns.join(", ")}`);
  }

  // ===== ۳) ایندکس‌های «نظرات و پیشنهادات» =====
  const [indexRows] = await query(
    "SELECT indexname FROM pg_indexes WHERE schemaname='public'",
  );
  const indexes = new Set(indexRows.map((row) => row.indexname));
  const missingIndexes = EXPECTED_INDEXES.filter((name) => !indexes.has(name));
  if (missingIndexes.length === 0) {
    ok("ایندکس‌های «نظرات و پیشنهادات» موجود است");
  } else {
    bad(`ایندکس‌های غایب: ${missingIndexes.join(", ")}`);
  }

  // ===== ۴) مایگریشن‌ها =====
  let migrationFiles = [];
  try {
    migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".js"))
      .sort();
  } catch {
    info("پوشهٔ migrations خوانده نشد");
  }

  let applied = [];
  if (tables.has("SequelizeMeta")) {
    const [rows] = await query('SELECT name FROM "SequelizeMeta" ORDER BY name');
    applied = rows.map((row) => String(row.name));
  }

  const pending = migrationFiles.filter((file) => !applied.includes(file));
  if (pending.length === 0) {
    ok(`همهٔ ${migrationFiles.length} مایگریشن اعمال شده است`);
  } else {
    bad(`مایگریشن‌های اعمال‌نشده: ${pending.join(", ")}`);
    info("راهنما: npm run db:migrate");
  }

  // ===== ۴ب) شمارهٔ مشتری (customer_code) =====
  // ✅ ترتیبی‌سازی: هیچ مشتری بدون شماره نباشد و هیچ شماره‌ای تکراری نباشد
  if (tables.has("customer_personal_information")) {
    try {
      const [rows] = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT("customer_code")::int AS with_code,
                COUNT(DISTINCT "customer_code")::int AS distinct_codes,
                COALESCE(MIN("customer_code"), 0)::int AS min_code,
                COALESCE(MAX("customer_code"), 0)::int AS max_code
           FROM customer_personal_information`,
      );
      const row = rows[0] || {};
      const total = Number(row.total || 0);
      const withCode = Number(row.with_code || 0);
      const distinctCodes = Number(row.distinct_codes || 0);

      if (total === withCode && withCode === distinctCodes) {
        ok(
          `شمارهٔ مشتری: هر ${total} مشتری شمارهٔ یکتا دارد (${row.min_code} تا ${row.max_code})`,
        );
      } else {
        bad(
          `شمارهٔ مشتری: بدون‌شماره=${total - withCode} تکراری=${withCode - distinctCodes}`,
        );
        info("راهنما: npm run db:migrate  (ترتیبی‌سازی شمارهٔ مشتری)");
      }
    } catch (error) {
      bad(`بررسی شمارهٔ مشتری انجام نشد: ${error.message}`);
    }
  }

  // ===== ۴ج) نوع مشتری (جدول دیکشنری customer_types) =====
  // ✅ چهار نوع پیش‌فرض باید موجود باشد و هیچ مشتری به نوع ناموجود ارجاع ندهد
  if (tables.has("customer_types")) {
    try {
      const [typeRows] = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE active)::int AS active_count
           FROM customer_types`,
      );
      const row = typeRows[0] || {};
      const total = Number(row.total || 0);
      const activeCount = Number(row.active_count || 0);

      if (total > 0) {
        ok(`انواع مشتری: ${total} نوع ثبت شده (${activeCount} فعال)`);
      } else {
        bad("جدول customer_types خالی است (۴ نوع پیش‌فرض باید وجود داشته باشد)");
        info("راهنما: npm run db:migrate");
      }

      if (tables.has("customer_personal_information")) {
        const [refRows] = await query(
          `SELECT COUNT(*)::int AS broken
             FROM customer_personal_information c
            WHERE c.customer_type_id IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM customer_types t WHERE t.id = c.customer_type_id
              )`,
        );
        const broken = Number(refRows[0]?.broken || 0);
        if (broken === 0) {
          ok("ارجاع‌های «نوع مشتری» مشتریان معتبر است");
        } else {
          bad(`ارجاع «نوع مشتری» نامعتبر برای ${broken} مشتری`);
        }
      }
    } catch (error) {
      bad(`بررسی نوع مشتری انجام نشد: ${error.message}`);
    }
  }

  // ===== ۵) شمارنده‌های اطلاعاتی =====
  for (const table of COUNT_TABLES) {
    if (!tables.has(table)) continue;
    try {
      const [rows] = await query(`SELECT COUNT(*)::int AS n FROM "${table}"`);
      info(`تعداد رکورد «${table}»: ${rows[0]?.n ?? 0}`);
    } catch {
      /* بی‌صدا */
    }
  }
};

// ============================================
// اجرا + جمع‌بندی
// ============================================
main()
  .catch((error) => {
    bad(`خطای غیرمنتظره در بررسی: ${error.message}`);
  })
  .finally(async () => {
    const failed = results.fail.length;

    if (AS_JSON) {
      process.stdout.write(
        JSON.stringify(
          {
            ok: failed === 0,
            pass: results.pass,
            fail: results.fail,
            info: results.info,
          },
          null,
          2,
        ) + "\n",
      );
    } else {
      log("");
      log(failed === 0 ? "✅ ALL PASS" : `❌ ${failed} FAILED`);
      if (failed > 0) {
        log("   راهنما: اگر جدول/ستون غایب است → npm run db:migrate");
      }
    }

    try {
      await sequelize.close();
    } catch {
      /* بی‌صدا */
    }
    process.exitCode = failed === 0 ? 0 : 1;
  });

