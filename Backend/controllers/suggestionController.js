// ============================================================
// controllers/suggestionController.js
// «نظرات و پیشنهادات» — گفتگوی دوطرفهٔ کاربر لاگین‌شده با ادمین‌ها
// ------------------------------------------------------------
// قواعد:
//  • فقط کاربران لاگین‌شده پیام می‌فرستند (protect روی همهٔ روت‌ها)
//  • هر کاربر فقط گفتگوهای خودش را می‌بیند/پاسخ می‌دهد
//  • ادمین‌ها همهٔ گفتگوها را می‌بینند و پاسخ می‌دهند
//  • رسید خواندن دوطرفه: admin_unread (برای بج پنل) و
//    user_unread (برای بج پاکت هدر) + read_at روی هر پیام
// ============================================================
const { sequelize } = require("../config/database");
const Suggestion = require("../models/Suggestion");
const SuggestionMessage = require("../models/SuggestionMessage");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
const { Op } = require("sequelize");

const ADMIN_ROLES = ["super_admin", "admin", "sub_admin"];

const SUBJECTS = ["suggestion", "complaint", "bug", "question", "other"];
const STATUSES = ["new", "in_progress", "answered", "closed"];

const MAX_TITLE = 150;
const MAX_BODY = 2000;
const MIN_BODY = 5;
// ✅ ضد ارسال دوباره: همان کاربر + همان عنوان و متن، در این بازهٔ زمانی
const DUPLICATE_WINDOW_MS = 30 * 1000;

// ============================================
// پاک‌سازی متن ورودی
// ============================================
const cleanText = (value, max, { keepNewlines = false } = {}) => {
  let text = String(value ?? "");
  text = text.replace(/\r\n?/g, "\n").trim();
  text = keepNewlines
    ? text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n")
    : text.replace(/\s+/g, " ");
  return text.slice(0, max);
};

const fullNameOf = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
  user?.username ||
  "کاربر";

const displayName = (user) =>
  isAdminUser(user) ? `${fullNameOf(user)} (ادمین)` : fullNameOf(user);

const isAdminUser = (user) => ADMIN_ROLES.includes(user?.role);

const serializeMessage = (message) => ({
  id: message.id,
  sender_type: message.sender_type,
  sender_id: message.sender_id,
  sender_name: message.sender_name,
  body: message.body,
  read_at: message.read_at,
  created_at: message.created_at,
});

const serializeSuggestion = (item, { withUser = false } = {}) => {
  const plain = item.toJSON ? item.toJSON() : item;
  const out = {
    id: plain.id,
    subject: plain.subject,
    title: plain.title,
    status: plain.status,
    admin_unread: plain.admin_unread,
    user_unread: plain.user_unread,
    messages_count: plain.messages_count,
    last_message_at: plain.last_message_at,
    last_sender: plain.last_sender,
    answered_by: plain.answered_by,
    answered_at: plain.answered_at,
    closed_at: plain.closed_at,
    created_at: plain.created_at,
  };
  if (withUser) {
    out.user_id = plain.user_id;
    out.user = plain.user
      ? {
          id: plain.user.id,
          full_name: fullNameOf(plain.user),
          role: plain.user.role,
          mobile_number: plain.user.mobile_number || null,
          username: plain.user.username || null,
        }
      : null;
  }
  return out;
};

// ============================================
// یافتن پیام تکراریِ همین کاربر در بازهٔ کوتاه (ضد ارسال دوبار)
// ⚠️ دلیل وجود: دابل‌کلیک، دابل‌تپ موبایل، retry شبکه یا شنوندهٔ تکراری سمت
// کلاینت می‌تواند یک پیام را دو بار بفرستد. این تابع جلوی ساخت رکورد تکراری
// را می‌گیرد و همان گفتگوی قبلی را برمی‌گرداند.
// ============================================
const findRecentDuplicate = async ({ userId, title, body }) => {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_MS);

  const candidate = await Suggestion.findOne({
    where: {
      user_id: userId,
      title,
      created_at: { [Op.gte]: since },
    },
    order: [["created_at", "DESC"]],
  });
  if (!candidate) return null;

  const firstMessage = await SuggestionMessage.findOne({
    where: { suggestion_id: candidate.id, sender_type: "user" },
    order: [["created_at", "ASC"], ["id", "ASC"]],
  });

  return firstMessage?.body === body ? candidate : null;
};

// ============================================
// ایجاد گفتگوی جدید (کاربر لاگین‌شده)
// ============================================
const createSuggestion = async (req, res) => {
  let transaction = null;
  try {
    const subject = SUBJECTS.includes(req.body?.subject)
      ? req.body.subject
      : "suggestion";
    const title = cleanText(req.body?.title, MAX_TITLE);
    const body = cleanText(req.body?.body, MAX_BODY, { keepNewlines: true });

    if (!title || title.length < 3) {
      return errorResponse(res, "موضوع پیام را وارد کنید (حداقل ۳ حرف)", 400);
    }
    if (!body || body.length < MIN_BODY) {
      return errorResponse(res, "متن پیام را وارد کنید (حداقل ۵ حرف)", 400);
    }

    // ✅ ضد تکرار: اگر همین لحظه همین پیام ثبت شده باشد، رکورد تکراری ساخته نشود
    const duplicate = await findRecentDuplicate({
      userId: req.user.id,
      title,
      body,
    });
    if (duplicate) {
      return successResponse(
        res,
        { ...serializeSuggestion(duplicate), duplicate: true },
        "این پیام قبلاً ثبت شده است",
        200,
      );
    }

    transaction = await sequelize.transaction();

    const created = await Suggestion.create(
      {
        user_id: req.user.id,
        subject,
        title,
        status: "new",
        admin_unread: true,
        user_unread: false,
        messages_count: 1,
        last_message_at: new Date(),
        last_sender: "user",
        page_url: cleanText(req.body?.page_url, 300) || null,
        ip: String(req.ip || "").slice(0, 64) || null,
        user_agent: String(req.headers["user-agent"] || "").slice(0, 300) || null,
      },
      { transaction },
    );

    await SuggestionMessage.create(
      {
        suggestion_id: created.id,
        sender_type: "user",
        sender_id: req.user.id,
        sender_name: fullNameOf(req.user),
        body,
      },
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    return successResponse(
      res,
      serializeSuggestion(created),
      "پیام شما ثبت شد. پاسخ ادمین در «پیام‌ها» نمایش داده می‌شود.",
      201,
    );
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        /* تراکنش قبلاً بسته شده */
      }
    }
    console.error("❌ خطا در ثبت نظر/پیشنهاد:", error.message);
    return errorResponse(res, "خطا در ثبت پیام", 500);
  }
};

// ============================================
// فهرست گفتگوهای کاربر جاری
// ============================================
const getMySuggestions = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const { rows, count } = await Suggestion.findAndCountAll({
      where: { user_id: req.user.id },
      order: [["last_message_at", "DESC"]],
      limit,
      offset,
    });

    const unread = await Suggestion.count({
      where: { user_id: req.user.id, user_unread: true },
    });

    return successResponse(res, {
      items: rows.map((item) => serializeSuggestion(item)),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) || 1 },
      unread_count: unread,
    });
  } catch (error) {
    console.error("❌ خطا در فهرست نظرات کاربر:", error.message);
    return errorResponse(res, "خطا در دریافت پیام‌ها", 500);
  }
};

// ============================================
// تعداد پاسخ‌های خوانده‌نشده (بج پاکت هدر)
// ============================================
const getUnreadCount = async (req, res) => {
  try {
    const count = await Suggestion.count({
      where: { user_id: req.user.id, user_unread: true },
    });
    return successResponse(res, { count });
  } catch (error) {
    console.error("❌ خطا در شمارش پیام‌های نخوانده:", error.message);
    return errorResponse(res, "خطا در دریافت تعداد پیام‌ها", 500);
  }
};

// ============================================
// مشاهدهٔ یک گفتگو (فقط صاحب گفتگو)
// ============================================
const getMyThread = async (req, res) => {
  try {
    const suggestion = await Suggestion.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    const messages = await SuggestionMessage.findAll({
      where: { suggestion_id: suggestion.id },
      order: [["created_at", "ASC"]],
      limit: 300,
    });

    return successResponse(res, {
      suggestion: serializeSuggestion(suggestion),
      messages: messages.map(serializeMessage),
    });
  } catch (error) {
    console.error("❌ خطا در مشاهدهٔ گفتگو:", error.message);
    return errorResponse(res, "خطا در دریافت گفتگو", 500);
  }
};

// ============================================
// پاسخ کاربر در گفتگوی خودش
// ============================================
const replyToThread = async (req, res) => {
  let transaction = null;
  try {
    const body = cleanText(req.body?.body, MAX_BODY, { keepNewlines: true });
    if (!body || body.length < MIN_BODY) {
      return errorResponse(res, "متن پیام را وارد کنید (حداقل ۵ حرف)", 400);
    }

    const suggestion = await Suggestion.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    transaction = await sequelize.transaction();

    await SuggestionMessage.create(
      {
        suggestion_id: suggestion.id,
        sender_type: "user",
        sender_id: req.user.id,
        sender_name: fullNameOf(req.user),
        body,
      },
      { transaction },
    );

    await suggestion.update(
      {
        messages_count: suggestion.messages_count + 1,
        last_message_at: new Date(),
        last_sender: "user",
        admin_unread: true,
        user_unread: false,
        status: suggestion.status === "closed" ? "in_progress" : suggestion.status,
        closed_at: null,
      },
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    return successResponse(
      res,
      serializeSuggestion(suggestion),
      "پیام شما ارسال شد",
      201,
    );
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        /* تراکنش قبلاً بسته شده */
      }
    }
    console.error("❌ خطا در ارسال پاسخ کاربر:", error.message);
    return errorResponse(res, "خطا در ارسال پیام", 500);
  }
};

// ============================================
// علامت خوانده‌شدن پاسخ‌های ادمین (پاک شدن بج هدر)
// ============================================
const markThreadRead = async (req, res) => {
  let transaction = null;
  try {
    const suggestion = await Suggestion.findOne({
      where: { id: req.params.id, user_id: req.user.id },
    });
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    transaction = await sequelize.transaction();

    await SuggestionMessage.update(
      { read_at: new Date() },
      {
        where: { suggestion_id: suggestion.id, sender_type: "admin", read_at: null },
        transaction,
      },
    );
    await suggestion.update({ user_unread: false }, { transaction });

    await transaction.commit();
    transaction = null;

    return successResponse(res, { id: suggestion.id }, "پیام‌ها خوانده شد");
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        /* تراکنش قبلاً بسته شده */
      }
    }
    console.error("❌ خطا در علامت‌گذاری خوانده‌شدن:", error.message);
    return errorResponse(res, "خطا در بروزرسانی وضعیت پیام", 500);
  }
};

// ============================================
// (ادمین) فهرست همهٔ گفتگوها + فیلتر + شمارنده‌ها
// ============================================
const listSuggestions = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 100,
    });

    const where = {};
    if (STATUSES.includes(req.query.status)) where.status = req.query.status;
    if (SUBJECTS.includes(req.query.subject)) where.subject = req.query.subject;
    if (req.query.unread === "true" || req.query.unread === "1") {
      where.admin_unread = true;
    }
    if (req.query.user_id) {
      const userId = parseInt(req.query.user_id, 10);
      if (!isNaN(userId)) where.user_id = userId;
    }

    const search = cleanText(req.query.search, 100);
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { "$user.first_name$": { [Op.iLike]: `%${search}%` } },
        { "$user.last_name$": { [Op.iLike]: `%${search}%` } },
        { "$user.username$": { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { rows, count } = await Suggestion.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "role",
            "username",
            "mobile_number",
          ],
        },
      ],
      order: [["last_message_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const [byStatus, adminUnread, total] = await Promise.all([
      Suggestion.findAll({
        attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "n"]],
        group: ["status"],
        raw: true,
      }),
      Suggestion.count({ where: { admin_unread: true } }),
      Suggestion.count(),
    ]);

    const counts = { total, admin_unread: adminUnread };
    byStatus.forEach((row) => {
      counts[row.status] = Number(row.n);
    });

    return successResponse(res, {
      items: rows.map((item) =>
        serializeSuggestion(item, { withUser: true }),
      ),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit) || 1,
      },
      counts,
    });
  } catch (error) {
    console.error("❌ خطا در فهرست نظرات (ادمین):", error.message);
    return errorResponse(res, "خطا در دریافت فهرست نظرات", 500);
  }
};

// ============================================
// (ادمین) مشاهدهٔ گفتگو + علامت خوانده‌شدن ادمین
// ============================================
const getThreadAdmin = async (req, res) => {
  try {
    const suggestion = await Suggestion.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "id",
            "first_name",
            "last_name",
            "role",
            "username",
            "mobile_number",
          ],
        },
      ],
    });
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    const messages = await SuggestionMessage.findAll({
      where: { suggestion_id: suggestion.id },
      order: [["created_at", "ASC"]],
      limit: 300,
    });

    // ✅ خوانده‌شدن توسط ادمین (رسید خواندن) — بج پنل صفر می‌شود
    if (suggestion.admin_unread) {
      await SuggestionMessage.update(
        { read_at: new Date() },
        {
          where: {
            suggestion_id: suggestion.id,
            sender_type: "user",
            read_at: null,
          },
        },
      );
      await suggestion.update({ admin_unread: false });
    }

    return successResponse(res, {
      suggestion: serializeSuggestion(suggestion, { withUser: true }),
      messages: messages.map(serializeMessage),
    });
  } catch (error) {
    console.error("❌ خطا در مشاهدهٔ گفتگو (ادمین):", error.message);
    return errorResponse(res, "خطا در دریافت گفتگو", 500);
  }
};

// ============================================
// (ادمین) پاسخ به گفتگو
// ============================================
const replyAsAdmin = async (req, res) => {
  let transaction = null;
  try {
    const body = cleanText(req.body?.body, MAX_BODY, { keepNewlines: true });
    if (!body || body.length < MIN_BODY) {
      return errorResponse(res, "متن پاسخ را وارد کنید (حداقل ۵ حرف)", 400);
    }

    const suggestion = await Suggestion.findByPk(req.params.id);
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    transaction = await sequelize.transaction();

    await SuggestionMessage.create(
      {
        suggestion_id: suggestion.id,
        sender_type: "admin",
        sender_id: req.user.id,
        sender_name: displayName(req.user),
        body,
      },
      { transaction },
    );

    await suggestion.update(
      {
        messages_count: suggestion.messages_count + 1,
        last_message_at: new Date(),
        last_sender: "admin",
        user_unread: true,
        admin_unread: false,
        status: "answered",
        answered_by: req.user.id,
        answered_at: new Date(),
      },
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    return successResponse(
      res,
      serializeSuggestion(suggestion),
      "پاسخ ارسال شد و در «پیام‌های» کاربر نمایش داده می‌شود",
      201,
    );
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        /* تراکنش قبلاً بسته شده */
      }
    }
    console.error("❌ خطا در پاسخ ادمین:", error.message);
    return errorResponse(res, "خطا در ارسال پاسخ", 500);
  }
};

// ============================================
// (ادمین) تغییر وضعیت گفتگو
// ============================================
const updateSuggestion = async (req, res) => {
  try {
    const suggestion = await Suggestion.findByPk(req.params.id);
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    const updates = {};
    if (STATUSES.includes(req.body?.status)) {
      updates.status = req.body.status;
      updates.closed_at = req.body.status === "closed" ? new Date() : null;
    }
    if (req.body?.admin_unread === false) updates.admin_unread = false;

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, "چیزی برای بروزرسانی ارسال نشده است", 400);
    }

    await suggestion.update(updates);
    return successResponse(
      res,
      serializeSuggestion(suggestion),
      "وضعیت گفتگو بروزرسانی شد",
    );
  } catch (error) {
    console.error("❌ خطا در بروزرسانی گفتگو:", error.message);
    return errorResponse(res, "خطا در بروزرسانی گفتگو", 500);
  }
};

// ============================================
// (ادمین) حذف گفتگو (پیام‌ها با CASCADE حذف می‌شوند)
// ============================================
const deleteSuggestion = async (req, res) => {
  try {
    const suggestion = await Suggestion.findByPk(req.params.id);
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    const id = suggestion.id;
    await SuggestionMessage.destroy({ where: { suggestion_id: id } });
    await suggestion.destroy();

    return successResponse(res, { id }, "گفتگو حذف شد");
  } catch (error) {
    console.error("❌ خطا در حذف گفتگو:", error.message);
    return errorResponse(res, "خطا در حذف گفتگو", 500);
  }
};

// ============================================
// (ادمین) حذف یک پیام از گفتگو
// ------------------------------------------------------------
// قاعده‌ها:
//  • پیام باید متعلق به همان گفتگو باشد (وگرنه ۴۰۴)
//  • پیام اول گفتگو از این مسیر حذف نمی‌شود؛ برای آن کل گفتگو را حذف کنید
//    (DELETE /api/suggestions/:id) چون عنوان گفتگو از پیام اول می‌آید
//  • اگر آخرین پیام حذف شود و پیامی نماند، خود گفتگو هم حذف می‌شود
// ============================================
const recalcThreadAfterDelete = async (suggestion, { transaction }) => {
  const [remaining, count] = await Promise.all([
    SuggestionMessage.findOne({
      where: { suggestion_id: suggestion.id },
      order: [["created_at", "DESC"], ["id", "DESC"]],
      transaction,
    }),
    SuggestionMessage.count({
      where: { suggestion_id: suggestion.id },
      transaction,
    }),
  ]);

  if (!remaining || count === 0) return null; // گفتگو خالی شد

  await suggestion.update(
    {
      messages_count: count,
      last_message_at: remaining.created_at,
      last_sender: remaining.sender_type,
    },
    { transaction },
  );

  return remaining;
};

const deleteSuggestionMessage = async (req, res) => {
  let transaction = null;
  try {
    const suggestion = await Suggestion.findByPk(req.params.id);
    if (!suggestion) {
      return errorResponse(res, "گفتگو یافت نشد", 404);
    }

    const message = await SuggestionMessage.findOne({
      where: { id: req.params.messageId, suggestion_id: suggestion.id },
    });
    if (!message) {
      return errorResponse(res, "پیام موردنظر در این گفتگو یافت نشد", 404);
    }

    const first = await SuggestionMessage.findOne({
      where: { suggestion_id: suggestion.id },
      order: [["created_at", "ASC"], ["id", "ASC"]],
    });
    if (first && first.id === message.id) {
      return errorResponse(
        res,
        "پیام اول گفتگو قابل حذف نیست؛ برای حذف آن کل گفتگو را حذف کنید",
        400,
      );
    }

    transaction = await sequelize.transaction();

    await message.destroy({ transaction });
    const remaining = await recalcThreadAfterDelete(suggestion, {
      transaction,
    });

    if (!remaining) {
      await suggestion.destroy({ transaction });
      await transaction.commit();
      transaction = null;
      return successResponse(
        res,
        { deleted_message_id: message.id, thread_deleted: true },
        "آخرین پیام حذف شد و کل گفتگو هم پاک شد",
      );
    }

    await transaction.commit();
    transaction = null;

    const messages = await SuggestionMessage.findAll({
      where: { suggestion_id: suggestion.id },
      order: [["created_at", "ASC"]],
      limit: 300,
    });

    return successResponse(
      res,
      {
        deleted_message_id: message.id,
        thread_deleted: false,
        suggestion: serializeSuggestion(suggestion),
        messages: messages.map(serializeMessage),
      },
      "پیام حذف شد",
    );
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch {
        /* تراکنش قبلاً بسته شده */
      }
    }
    console.error("❌ خطا در حذف پیام گفتگو:", error.message);
    return errorResponse(res, "خطا در حذف پیام", 500);
  }
};

module.exports = {
  createSuggestion,
  getMySuggestions,
  getUnreadCount,
  getMyThread,
  replyToThread,
  markThreadRead,
  listSuggestions,
  getThreadAdmin,
  replyAsAdmin,
  updateSuggestion,
  deleteSuggestion,
  deleteSuggestionMessage,
};

