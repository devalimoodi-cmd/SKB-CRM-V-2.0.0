"use strict";

// ============================================================
//  ایجاد جدول «نشست‌های کاربران» (user_sessions) — فاز ۱۲.۱
// ------------------------------------------------------------
//  • هر ردیف = یک «ورود» (login) به سیستم:
//      چه کاربری · با چه دستگاهی (ip / user_agent) · از چه زمانی
//      · آخرین فعالیت · چه زمانی و «چرا» بسته شد
//  • هر نشست یک `sid` یکتا دارد که داخل توکن JWT می‌رود
//    (`models/User.generateToken({ sid })`) — میدل‌ور احراز هویت هر
//    درخواست را با همین sid به ردیف نشست گره می‌زند. نتیجه:
//    «بستن یک نشست» واقعاً همان دستگاه را ۴۰۱ می‌کند.
//  • ✅ عمداً هیچ FOREIGN KEY به `users` ندارد (هم‌الگو با
//    `permission_audit_logs.actor_id`): تاریخچهٔ ورودها باید بعد از
//    حذف کاربر هم باقی بماند. به‌جای FK، `username` و `role`
//    به‌صورت «عکس لحظهٔ ورود» ذخیره می‌شوند.
//  • idempotent است: اگر جدول/ایندکس از قبل وجود داشته باشد دست نمی‌خورد
//    (اجرای دوباره روی دیتابیس فعلی/سرور خطا نمی‌دهد).
//  • اجرا:  npm run db:migrate      سپس  npm run db:verify
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/db/README.md
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

    if (!existing.includes("user_sessions")) {
      await queryInterface.createTable("user_sessions", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment: "کاربر (بدون FK تا تاریخچه پس از حذف کاربر بماند)",
        },
        username: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: "عکس نام کاربری در لحظهٔ ورود",
        },
        role: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: "عکس نقش کاربر در لحظهٔ ورود",
        },
        sid: {
          type: Sequelize.STRING(64),
          allowNull: false,
          comment: "شناسهٔ یکتای نشست (claim داخل JWT)",
        },
        ip: {
          type: Sequelize.STRING(64),
          allowNull: true,
          comment: "آی‌پی دستگاهی که با آن وارد شده",
        },
        user_agent: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: "User-Agent مرورگر/دستگاه",
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
          comment: "زمان شروع نشست",
        },
        last_activity_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
          comment:
            "آخرین فعالیت (نوشتن با throttle: SESSION_TOUCH_THROTTLE_SECONDS)",
        },
        ended_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "زمان پایان نشست (null = نشست هنوز باز است)",
        },
        end_reason: {
          type: Sequelize.STRING(30),
          allowNull: true,
          comment:
            "logout | revoked | replaced | password_change | role_change | reset | expired | cleanup",
        },
        ended_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "کاربری که نشست را بست (معمولاً مدیر — بدون FK)",
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
    const currentIndexes = await indexNames(queryInterface, "user_sessions");

    if (!currentIndexes.includes("user_sessions_sid_unique")) {
      await queryInterface.addIndex("user_sessions", ["sid"], {
        unique: true,
        name: "user_sessions_sid_unique",
      });
    }

    // ✅ واژهٔ اصلی همهٔ کوئری‌ها: «نشست‌های بازِ این کاربر»
    if (!currentIndexes.includes("user_sessions_user_id_ended_at")) {
      await queryInterface.addIndex("user_sessions", ["user_id", "ended_at"], {
        name: "user_sessions_user_id_ended_at",
      });
    }

    // ✅ برای مرتب‌سازی/گزارش «تازه‌ترین فعالیت» و پاک‌سازی نگهداری
    if (!currentIndexes.includes("user_sessions_last_activity_at")) {
      await queryInterface.addIndex("user_sessions", ["last_activity_at"], {
        name: "user_sessions_last_activity_at",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_sessions");
  },
};
