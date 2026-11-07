"use strict";

// ============================================================
//  جدول «چالش‌های ورود» (login_challenges) — فاز ۱۳.۱
// ------------------------------------------------------------
//  چرا این جدول؟
//    ورود دومرحله‌ای: مرحلهٔ ۱ (شناسه + رمز + کپچا) هیچ توکنی صادر
//    نمی‌کند؛ فقط یک «چالش» می‌سازد و کد ۶ رقمی را پیامک می‌کند.
//    مرحلهٔ ۲ (کد) با همین چالش اعتبارسنجی می‌شود و تنها آن‌گاه
//    نشست (user_sessions) و توکن ساخته می‌شود.
//  ⇒ کاربری که فقط رمز را می‌داند، هیچ نشستی ندارد.
// ------------------------------------------------------------
//  🔒 اصول امنیتی که در ساختار جدول رعایت شده:
//   • `code_hash` = SHA-256(code + ":" + OTP_PEPPER)
//     ⇒ کد خام هرگز در دیتابیس و لاگ‌ها نوشته نمی‌شود.
//   • چالش «یک‌بارمصرف» است: پس از تایید موفق status='consumed'.
//   • سقف تلاش (`attempts` / `max_attempts`) ⇒ کرک ۶ رقم عملی نیست.
//   • سقف ارسال مجدد (`resend_count`) و `last_sent_at` ⇒ ضدّ SMS-bombing.
//   • `expires_at` کوتاه (پیش‌فرض ۳ دقیقه) ⇒ پنجرهٔ حمله کوچک.
//   • بدون FOREIGN KEY به users (هم‌الگو با user_sessions/activity_logs)
//     تا تاریخچه بعد از حذف کاربر هم بماند؛ username/role «عکس» دارند.
// ------------------------------------------------------------
//  idempotent است: اجرای دوباره روی دیتابیس فعلی خطا نمی‌دهد.
//  اجرا:  npm run db:migrate      سپس  npm run db:verify
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const tableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName));
};

const indexNames = async (queryInterface, table) => {
  try {
    const indexes = await queryInterface.showIndex(table);
    return indexes.map((index) => index.name);
  } catch {
    return [];
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await tableNames(queryInterface);

    if (!existing.includes("login_challenges")) {
      await queryInterface.createTable("login_challenges", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        challenge_id: {
          type: Sequelize.STRING(64),
          allowNull: false,
          comment: "شناسهٔ عمومی چالش (به فرانت‌اند داده می‌شود)",
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: "کاربر (بدون FK تا تاریخچه پس از حذف کاربر بماند)",
        },
        username: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: "عکس نام کاربری در لحظهٔ ورود",
        },
        role: {
          type: Sequelize.STRING(20),
          allowNull: true,
          comment: "عکس نقش کاربر در لحظهٔ ورود",
        },
        purpose: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "login",
          comment: "login | register | reset_password",
        },
        code_hash: {
          type: Sequelize.STRING(64),
          allowNull: false,
          comment: "SHA-256(code + ':' + OTP_PEPPER) — کد خام ذخیره نمی‌شود",
        },
        attempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "تعداد تلاش‌های ناموفق روی همین چالش",
        },
        max_attempts: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 5,
          comment: "سقف تلاش (LOGIN_OTP_MAX_ATTEMPTS)",
        },
        resend_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "چند بار کد دوباره ارسال شد",
        },
        expires_at: {
          type: Sequelize.DATE,
          allowNull: false,
          comment: "انقضای کد (پیش‌فرض: now + 180s)",
        },
        last_sent_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
          comment: "کنترل فاصلهٔ ارسال مجدد (LOGIN_OTP_RESEND_SECONDS)",
        },
        mobile_masked: {
          type: Sequelize.STRING(20),
          allowNull: true,
          comment: "شمارهٔ ماسک‌شده برای نمایش (0912***4567)",
        },
        ip: {
          type: Sequelize.STRING(64),
          allowNull: true,
          comment: "آی‌پی درخواست‌کنندهٔ چالش (برای بررسی تقلب)",
        },
        ua_hash: {
          type: Sequelize.STRING(64),
          allowNull: true,
          comment: "هش User-Agent (بدون ذخیرهٔ متن کامل)",
        },
        status: {
          type: Sequelize.STRING(15),
          allowNull: false,
          defaultValue: "pending",
          comment:
            "pending | consumed | expired | blocked | failed | cancelled",
        },
        used_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "زمان مصرف موفق چالش (یک‌بارمصرف)",
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
        },
      });
    }

    // ===== ایندکس‌ها (هر کدام مستقل و idempotent) =====
    const currentIndexes = await indexNames(queryInterface, "login_challenges");

    if (!currentIndexes.includes("login_challenges_challenge_id_unique")) {
      await queryInterface.addIndex("login_challenges", ["challenge_id"], {
        unique: true,
        name: "login_challenges_challenge_id_unique",
      });
    }

    // ✅ واژهٔ اصلی کوئری‌ها: «چالش‌های بازِ این کاربر» (سقف ساعتی)
    if (!currentIndexes.includes("login_challenges_user_status")) {
      await queryInterface.addIndex("login_challenges", ["user_id", "status"], {
        name: "login_challenges_user_status",
      });
    }

    // ✅ پاک‌سازی نگهداری و یافتن چالش‌های منقضی
    if (!currentIndexes.includes("login_challenges_expires_at")) {
      await queryInterface.addIndex("login_challenges", ["expires_at"], {
        name: "login_challenges_expires_at",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("login_challenges");
  },
};
