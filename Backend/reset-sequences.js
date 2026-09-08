// ================================================================
// reset-sequences.js — ریست توالی‌های (id) دیتابیس به ۱
// ----------------------------------------------------------------
// کاربرد (فقط قبل از استارت رسمی و پس از حذف داده‌های تستی):
//
//   node reset-sequences.js
//
// رفتار امن:
//   - فقط جدول‌هایی که در حال حاضر ۰ رکورد دارند ریست می‌شوند
//     تا شناسهٔ بعدی از ۱ شروع شود.
//   - جدول‌هایی که هنوز رکورد دارند «دست‌نخورده» می‌مانند و فقط
//     گزارش می‌شوند (چون ریست آن‌ها باعث تداخل شناسه می‌شود).
//
// اگر بخواهید داده‌های تستی را هم پاک کنید، ابتدا خارج از این اسکریپت
// و با احتیاط از دستور مشابه زیر استفاده کنید:
//
//   TRUNCATE TABLE customer_personal_information RESTART IDENTITY CASCADE;
//
// سپس دوباره این اسکریپت را اجرا کنید تا بقیه توالی‌های خالی هم ریست شوند.
//
// ⚠️ این اسکریپت را روی دیتابیس رسمیِ دارای داده‌ی واقعی اجرا نکنید.
// ================================================================

const { sequelize } = require("./config/database");

async function findAutoIncrementColumns() {
  // ۱) ستون‌های SERIAL / BIGSERIAL (دارای sequence)
  const serialRows = await sequelize.query(
    `SELECT c.relname AS table_name,
            a.attname AS column_name,
            pg_get_serial_sequence('"' || c.relname || '"', a.attname) AS seq_name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      WHERE c.relkind = 'r'
        AND pg_get_serial_sequence('"' || c.relname || '"', a.attname) IS NOT NULL
      ORDER BY c.relname, a.attnum`,
    { type: sequelize.QueryTypes.SELECT },
  );

  // ۲) ستون‌های IDENTITY که pg_get_serial_sequence برایشان خالی می‌ماند
  const identityRows = await sequelize.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND is_identity = 'YES'
      ORDER BY table_name, ordinal_position`,
    { type: sequelize.QueryTypes.SELECT },
  );

  const identityByTable = new Map();
  (identityRows || []).forEach((r) => {
    if (!identityByTable.has(r.table_name)) {
      identityByTable.set(r.table_name, r.column_name);
    }
  });

  const columns = new Map(); // table -> column
  const seqByTable = new Map(); // table -> seq
  (serialRows || []).forEach((r) => {
    columns.set(r.table_name, r.column_name);
    seqByTable.set(r.table_name, r.seq_name);
  });
  // اگر ستون IDENTITY بود و هنوز در لیست بالا نیست، اضافه کن
  identityByTable.forEach((col, table) => {
    if (!columns.has(table)) {
      columns.set(table, col);
    }
  });

  return { columns, seqByTable };
}

async function countRows(tableName) {
  const rows = await sequelize.query(
    `SELECT count(*)::int AS cnt FROM "${tableName}"`,
    { type: sequelize.QueryTypes.SELECT },
  );
  return Number(rows?.[0]?.cnt || 0);
}

async function resetEmptySequence(tableName, columnName, seqName) {
  if (seqName) {
    await sequelize.query(
      `SELECT setval('${seqName}', 1, false)`,
    );
  } else {
    // ستون IDENTITY
    await sequelize.query(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" RESTART WITH 1`,
    );
  }
}

async function main() {
  console.log("🔄 بررسی توالی‌های دیتابیس...");
  const { columns, seqByTable } = await findAutoIncrementColumns();

  const reset = [];
  const skipped = [];

  for (const [table, column] of columns.entries()) {
    const count = await countRows(table);
    const seq = seqByTable.get(table) || null;
    if (count === 0) {
      await resetEmptySequence(table, column, seq);
      reset.push({ table, column, seq });
      console.log(`✅ ریست شد: ${table}.${column}${seq ? ` (seq: ${seq})` : ""}`);
    } else {
      skipped.push({ table, count });
      console.log(
        `⏭️ دست‌نخورده (${count} رکورد): ${table}.${column} — بعد از پاک‌سازی دوباره اجرا کنید`,
      );
    }
  }

  console.log("");
  console.log(`📊 خلاصه: ${reset.length} توالی به ۱ ریست شد، ${skipped.length} جدول دارای داده دست‌نخورده ماند.`);
}

main()
  .then(() => {
    return sequelize.close();
  })
  .then(() => {
    console.log("✅ اسکریپت با موفقیت پایان یافت.");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ خطا:", error.message || error);
    try {
      await sequelize.close();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  });
