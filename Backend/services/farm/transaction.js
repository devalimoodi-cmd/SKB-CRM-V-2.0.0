// ============================================================
// services/farm/transaction.js
// «یک تراکنش، دو مسیر» — موج ۱۳.۱۲
// ------------------------------------------------------------
//  چرا؟
//   هر تابع نوشتن در services/farm باید هم مستقل قابل صدا زدن باشد
//   (کنترلر کارشناس) و هم داخل تراکنشِ تأیید درخواست مشتری
//   (portalRequestService.approveRequest) اجرا شود. یک الگوی واحد
//   از «تراکنش تودرتو» و «commit دوباره» جلوگیری می‌کند.
//
// 🔒 قواعد:
//   ۱) اگر فراخوان تراکنش داده باشد، **مرز تراکنش مال اوست**؛
//      این توابع هیچ commit/rollback نمی‌کنند.
//   ۲) اگر نداده باشد، یک تراکنش تازه باز و همان‌جا بسته می‌شود
//      (همان رفتار قبلی کنترلرها).
//   ۳) rollback همیشه «ایمن» است: اگر تراکنش قبلاً بسته شده باشد
//      خطا پرتاب نمی‌شود.
// ============================================================
"use strict";

const { sequelize } = require("../../config/database");

const safeRollback = async (transaction) => {
  if (!transaction) return;
  try {
    await transaction.rollback();
  } catch {
    /* تراکنش قبلاً بسته شده — کاری لازم نیست */
  }
};

const runInTransaction = async (work, existing = null) => {
  if (existing) return work(existing);

  const transaction = await sequelize.transaction();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await safeRollback(transaction);
    throw error;
  }
};

module.exports = { runInTransaction, safeRollback };
