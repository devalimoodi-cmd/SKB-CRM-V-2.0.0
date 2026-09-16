// ============================================================
// controllers/releaseNoteController.js
// «تغییرات جدید / What's New» — اطلاع‌رسانی نسخه‌ها به کاربران
// ------------------------------------------------------------
// قواعد:
//  • مدیریت (ساخت/ویرایش/انتشار/آرشیو/حذف): فقط سوپر ادمین
//  • خواندن فهرست/جزئیات/آمار در پنل: همهٔ ادمین‌ها (admin/sub_admin/super_admin)
//  • مودال کاربر: هر کاربر لاگین‌شده فقط «آخرین نسخهٔ منتشرشده‌ای که
//    ندیده» را می‌بیند (یک‌بار) و می‌تواند «دیگر نشان نده» بزند
//  • مخاطب (audience): all | customers | experts | admins
// ============================================================
const { Op } = require("sequelize");
const { sequelize } = require("../config/database");
const ReleaseNote = require("../models/ReleaseNote");
const ReleaseNoteItem = require("../models/ReleaseNoteItem");
const ReleaseNoteView = require("../models/ReleaseNoteView");
const User = require("../models/User");
const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");

const ADMIN_ROLES = ["super_admin", "admin", "sub_admin"];
const STATUSES = ["draft", "published", "archived"];
const CATEGORIES = ["new", "improved", "fixed", "security"];
const AUDIENCES = ["all", "customers", "experts", "admins"];

const MAX_ITEMS = Math.min(
  Math.max(Number(process.env.RELEASE_NOTE_MAX_ITEMS || 50), 1),
  200,
);
const MAX_TITLE = 150;
const MAX_ITEM_TITLE = 200;
const MAX_TEXT = 2000;
const MAX_TAG = 50;
const MAX_HISTORY = 30;

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

const isValidVersion = (value) =>
  /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(String(value ?? "").trim());

const isAdminRole = (role) => ADMIN_ROLES.includes(role);

// ============================================
// مخاطب: هر نقش چه دسته‌هایی را می‌بیند
// ============================================
const audienceKeysForRole = (role) => {
  if (role === "customer") return ["all", "customers"];
  if (role === "expert") return ["all", "experts"];
  if (isAdminRole(role)) return ["all", "admins"];
  return ["all"];
};

const audienceWhereFor = (user) => ({
  audience: { [Op.in]: audienceKeysForRole(user?.role) },
});

// ============================================
// سریال‌سازی خروجی
// ============================================
const serializeItem = (item) => {
  const plain = item.toJSON ? item.toJSON() : item;
  return {
    id: plain.id,
    category: plain.category,
    title: plain.title,
    description: plain.description,
    tag: plain.tag,
    sort_order: plain.sort_order,
  };
};

// آیتم‌ها: اول بر اساس دسته (ترتیب ثابت مودال)، بعد sort_order
const CATEGORY_ORDER = { new: 0, improved: 1, fixed: 2, security: 3 };

const sortItems = (items = []) =>
  [...items].sort((a, b) => {
    const ca = CATEGORY_ORDER[a.category] ?? 9;
    const cb = CATEGORY_ORDER[b.category] ?? 9;
    if (ca !== cb) return ca - cb;
    if ((a.sort_order ?? 0) !== (b.sort_order ?? 0)) {
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });

const serializeRelease = (
  row,
  { withItems = false, withStats = false, withCreator = false } = {},
) => {
  const plain = row.toJSON ? row.toJSON() : row;
  const out = {
    id: plain.id,
    version: plain.version,
    title: plain.title,
    description: plain.description,
    status: plain.status,
    audience: plain.audience,
    published_at: plain.published_at,
    items_count: plain.items ? plain.items.length : undefined,
    views_count: plain.views ? plain.views.length : undefined,
    created_at: plain.created_at,
    updated_at: plain.updated_at,
  };

  if (withItems) {
    out.items = sortItems(plain.items || []).map(serializeItem);
  }

  if (withStats) {
    const views = plain.views || [];
    out.stats = {
      seen_count: views.filter((v) => !v.dont_show_again).length,
      dismissed_count: views.filter((v) => v.dont_show_again).length,
      total_seen: views.length,
    };
  }

  if (withCreator) {
    out.creator = plain.creator
      ? {
          id: plain.creator.id,
          full_name: [plain.creator.first_name, plain.creator.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() || plain.creator.username,
        }
      : null;
  }

  return out;
};

// ============================================
// اعتبارسنجی آیتم‌های ارسالی
// ============================================
const normalizeItems = (rawItems) => {
  if (rawItems === undefined || rawItems === null) return null;
  if (!Array.isArray(rawItems)) {
    return { error: "آیتم‌ها باید آرایه باشند" };
  }
  if (rawItems.length > MAX_ITEMS) {
    return { error: `حداکثر ${MAX_ITEMS} آیتم در هر نسخه مجاز است` };
  }

  const items = [];
  for (let index = 0; index < rawItems.length; index += 1) {
    const raw = rawItems[index] || {};
    const title = cleanText(raw.title, MAX_ITEM_TITLE);
    const category = String(raw.category || "new").trim();

    if (!title) {
      return { error: `عنوان آیتم شمارهٔ ${index + 1} را وارد کنید` };
    }
    if (!CATEGORIES.includes(category)) {
      return { error: `دستهٔ آیتم شمارهٔ ${index + 1} نامعتبر است` };
    }

    items.push({
      category,
      title,
      description: cleanText(raw.description, MAX_TEXT, {
        keepNewlines: true,
      }),
      tag: cleanText(raw.tag, MAX_TAG),
      sort_order: Number.isFinite(Number(raw.sort_order))
        ? Number(raw.sort_order)
        : index,
    });
  }

  return { items };
};

// ============================================
// [کاربر] آخرین نسخهٔ منتشرشده‌ای که این کاربر ندیده
// ============================================
const getUnseenRelease = async (req, res) => {
  try {
    const now = new Date();
    const release = await ReleaseNote.findOne({
      where: {
        status: "published",
        published_at: { [Op.lte]: now },
        ...audienceWhereFor(req.user),
      },
      include: [{ model: ReleaseNoteItem, as: "items" }],
      order: [["published_at", "DESC"], ["id", "DESC"]],
    });

    if (!release) {
      return successResponse(res, { release: null });
    }

    const viewed = await ReleaseNoteView.findOne({
      where: { release_note_id: release.id, user_id: req.user.id },
    });

    // ✅ یک‌بار دیده شده → دیگر خودکار نمایش داده نمی‌شود
    if (viewed) {
      return successResponse(res, { release: null, seen: true });
    }

    return successResponse(res, {
      release: serializeRelease(release, { withItems: true }),
    });
  } catch (error) {
    console.error("❌ خطا در دریافت آخرین تغییرات:", error.message);
    return errorResponse(res, "خطا در دریافت تغییرات", 500);
  }
};

// ============================================
// [کاربر] ثبت بازدید یک نسخه (+ «دیگر نشان نده»)
// ============================================
const markReleaseSeen = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(res, "شناسهٔ نسخه نامعتبر است", 400);
    }

    const release = await ReleaseNote.findOne({
      where: { id, status: "published", ...audienceWhereFor(req.user) },
    });
    if (!release) {
      return errorResponse(res, "نسخه یافت نشد", 404);
    }

    const dontShowAgain = req.body?.dont_show_again === true;

    let view = await ReleaseNoteView.findOne({
      where: { release_note_id: release.id, user_id: req.user.id },
    });

    if (!view) {
      try {
        view = await ReleaseNoteView.create({
          release_note_id: release.id,
          user_id: req.user.id,
          seen_at: new Date(),
          dont_show_again: dontShowAgain,
        });
      } catch (error) {
        // ✅ رقابت همزمان (دو تب/دو دستگاه) → همان رکورد را به‌روز کن
        if (error?.name === "SequelizeUniqueConstraintError") {
          view = await ReleaseNoteView.findOne({
            where: { release_note_id: release.id, user_id: req.user.id },
          });
        } else {
          throw error;
        }
      }
    }

    if (view) {
      const nextDontShow = Boolean(view.dont_show_again || dontShowAgain);
      if (view.dont_show_again !== nextDontShow) {
        await view.update({ seen_at: new Date(), dont_show_again: nextDontShow });
      }
    }

    return successResponse(res, {
      seen: true,
      dont_show_again: Boolean(view?.dont_show_again),
    });
  } catch (error) {
    console.error("❌ خطا در ثبت بازدید تغییرات:", error.message);
    return errorResponse(res, "خطا در ثبت بازدید", 500);
  }
};

// ============================================
// [کاربر] تاریخچهٔ نسخه‌های منتشرشده (با علامت دیده‌شده)
// ============================================
const getReleaseHistory = async (req, res) => {
  try {
    const now = new Date();
    const rows = await ReleaseNote.findAll({
      where: {
        status: "published",
        published_at: { [Op.lte]: now },
        ...audienceWhereFor(req.user),
      },
      include: [{ model: ReleaseNoteItem, as: "items" }],
      order: [["published_at", "DESC"], ["id", "DESC"]],
      limit: MAX_HISTORY,
    });

    const ids = rows.map((row) => row.id);
    const views = ids.length
      ? await ReleaseNoteView.findAll({
          where: { release_note_id: { [Op.in]: ids }, user_id: req.user.id },
        })
      : [];

    const viewMap = new Map(views.map((v) => [v.release_note_id, v]));
    const items = rows.map((row) => {
      const view = viewMap.get(row.id);
      return {
        ...serializeRelease(row, { withItems: true }),
        seen: Boolean(view),
        dont_show_again: Boolean(view?.dont_show_again),
      };
    });

    return successResponse(res, {
      items,
      unseen_count: items.filter((item) => !item.seen).length,
    });
  } catch (error) {
    console.error("❌ خطا در دریافت تاریخچهٔ تغییرات:", error.message);
    return errorResponse(res, "خطا در دریافت تاریخچهٔ تغییرات", 500);
  }
};

// ============================================
// [ادمین] فهرست نسخه‌ها + شمارش وضعیت‌ها
// ============================================
const listReleases = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const where = {};
    const status = String(req.query.status || "").trim();
    const audience = String(req.query.audience || "").trim();
    const search = cleanText(req.query.search, 60);

    if (STATUSES.includes(status)) where.status = status;
    if (AUDIENCES.includes(audience)) where.audience = audience;
    if (search) {
      where[Op.or] = [
        { version: { [Op.iLike]: `%${search}%` } },
        { title: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await ReleaseNote.findAndCountAll({
      where,
      include: [
        { model: ReleaseNoteItem, as: "items", attributes: ["id", "category"] },
        { model: ReleaseNoteView, as: "views", attributes: ["id", "dont_show_again"] },
      ],
      order: [["updated_at", "DESC"], ["id", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const [draft, published, archived] = await Promise.all([
      ReleaseNote.count({ where: { status: "draft" } }),
      ReleaseNote.count({ where: { status: "published" } }),
      ReleaseNote.count({ where: { status: "archived" } }),
    ]);

    return successResponse(res, {
      items: rows.map((row) => serializeRelease(row)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit) || 1,
      },
      counts: { draft, published, archived, total: draft + published + archived },
    });
  } catch (error) {
    console.error("❌ خطا در فهرست تغییرات:", error.message);
    return errorResponse(res, "خطا در دریافت فهرست تغییرات", 500);
  }
};

// ============================================
// [ادمین] یک نسخه + آیتم‌ها
// ============================================
const getRelease = async (req, res) => {
  try {
    const release = await ReleaseNote.findByPk(req.params.id, {
      include: [
        { model: ReleaseNoteItem, as: "items" },
        { model: ReleaseNoteView, as: "views", attributes: ["id", "dont_show_again"] },
      ],
    });
    if (!release) return errorResponse(res, "نسخه یافت نشد", 404);

    return successResponse(res, {
      release: serializeRelease(release, { withItems: true, withStats: true }),
    });
  } catch (error) {
    console.error("❌ خطا در دریافت نسخه:", error.message);
    return errorResponse(res, "خطا در دریافت نسخه", 500);
  }
};

// ============================================
// [ادمین] آمار دیدن یک نسخه
// ============================================
const getReleaseStats = async (req, res) => {
  try {
    const release = await ReleaseNote.findByPk(req.params.id, {
      include: [
        { model: ReleaseNoteItem, as: "items", attributes: ["id"] },
        {
          model: ReleaseNoteView,
          as: "views",
          include: [{ model: User, as: "user", attributes: ["id", "first_name", "last_name", "role"] }],
        },
      ],
    });
    if (!release) return errorResponse(res, "نسخه یافت نشد", 404);

    const plain = release.toJSON();
    const views = plain.views || [];

    return successResponse(res, {
      id: plain.id,
      version: plain.version,
      status: plain.status,
      published_at: plain.published_at,
      items_count: (plain.items || []).length,
      stats: {
        seen_count: views.length,
        dismissed_count: views.filter((v) => v.dont_show_again).length,
      },
      recent: views
        .sort((a, b) => new Date(b.seen_at) - new Date(a.seen_at))
        .slice(0, 10)
        .map((v) => ({
          user_id: v.user_id,
          full_name: v.user
            ? [v.user.first_name, v.user.last_name].filter(Boolean).join(" ").trim()
            : null,
          role: v.user?.role || null,
          seen_at: v.seen_at,
          dont_show_again: v.dont_show_again,
        })),
    });
  } catch (error) {
    console.error("❌ خطا در آمار نسخه:", error.message);
    return errorResponse(res, "خطا در دریافت آمار نسخه", 500);
  }
};

// ============================================
// [سوپر ادمین] ساخت نسخهٔ جدید (پیش‌نویس)
// ============================================
const createRelease = async (req, res) => {
  let transaction = null;
  try {
    const version = cleanText(req.body?.version, 20);
    if (!isValidVersion(version)) {
      return errorResponse(res, "شماره نسخه را به شکل 2.1.0 وارد کنید", 400);
    }

    const title = cleanText(req.body?.title, MAX_TITLE) || "تغییرات جدید";
    const description = cleanText(req.body?.description, MAX_TEXT, {
      keepNewlines: true,
    });
    const audience = AUDIENCES.includes(String(req.body?.audience))
      ? String(req.body.audience)
      : "all";

    const normalized = normalizeItems(req.body?.items);
    if (normalized?.error) return errorResponse(res, normalized.error, 400);
    const items = normalized?.items || [];
    if (!items.length) {
      return errorResponse(res, "حداقل یک آیتم برای این نسخه اضافه کنید", 400);
    }

    const duplicated = await ReleaseNote.findOne({ where: { version } });
    if (duplicated) {
      return errorResponse(res, "این شمارهٔ نسخه قبلاً ثبت شده است", 409);
    }

    transaction = await sequelize.transaction();
    const created = await ReleaseNote.create(
      {
        version,
        title,
        description,
        audience,
        status: "draft",
        created_by: req.user.id,
        updated_by: req.user.id,
      },
      { transaction },
    );

    await ReleaseNoteItem.bulkCreate(
      items.map((item) => ({ ...item, release_note_id: created.id })),
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    const fresh = await ReleaseNote.findByPk(created.id, {
      include: [{ model: ReleaseNoteItem, as: "items" }],
    });

    return successResponse(
      res,
      { release: serializeRelease(fresh, { withItems: true }) },
      "نسخهٔ جدید ساخته شد (پیش‌نویس)",
      201,
    );
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("❌ خطا در ساخت نسخه:", error.message);
    return errorResponse(res, "خطا در ساخت نسخه", 500);
  }
};

// ============================================
// [سوپر ادمین] ویرایش نسخه (فیلدها و/یا جایگزینی آیتم‌ها)
// ============================================
const updateRelease = async (req, res) => {
  let transaction = null;
  try {
    const release = await ReleaseNote.findByPk(req.params.id);
    if (!release) return errorResponse(res, "نسخه یافت نشد", 404);

    const patch = { updated_by: req.user.id };

    if (req.body?.version !== undefined) {
      const version = cleanText(req.body.version, 20);
      if (!isValidVersion(version)) {
        return errorResponse(res, "شماره نسخه را به شکل 2.1.0 وارد کنید", 400);
      }
      if (version !== release.version) {
        const duplicated = await ReleaseNote.findOne({
          where: { version, id: { [Op.ne]: release.id } },
        });
        if (duplicated) {
          return errorResponse(res, "این شمارهٔ نسخه قبلاً ثبت شده است", 409);
        }
      }
      patch.version = version;
    }

    if (req.body?.title !== undefined) {
      patch.title = cleanText(req.body.title, MAX_TITLE) || "تغییرات جدید";
    }

    if (req.body?.description !== undefined) {
      patch.description = cleanText(req.body.description, MAX_TEXT, {
        keepNewlines: true,
      });
    }

    if (req.body?.audience !== undefined) {
      const audience = String(req.body.audience);
      if (!AUDIENCES.includes(audience)) {
        return errorResponse(res, "مخاطب نامعتبر است", 400);
      }
      patch.audience = audience;
    }

    if (req.body?.status !== undefined) {
      const status = String(req.body.status);
      if (!STATUSES.includes(status)) {
        return errorResponse(res, "وضعیت نامعتبر است", 400);
      }
      patch.status = status;
      if (status === "published" && !release.published_at) {
        patch.published_at = new Date();
      }
    }

    const normalized = normalizeItems(req.body?.items);
    if (normalized?.error) return errorResponse(res, normalized.error, 400);

    transaction = await sequelize.transaction();
    await release.update(patch, { transaction });

    // ✅ اگر آیتم‌ها ارسال شده باشند، جایگزین می‌شوند (کل فهرست)
    if (normalized?.items) {
      await ReleaseNoteItem.destroy({
        where: { release_note_id: release.id },
        transaction,
      });
      if (normalized.items.length) {
        await ReleaseNoteItem.bulkCreate(
          normalized.items.map((item) => ({
            ...item,
            release_note_id: release.id,
          })),
          { transaction },
        );
      }
    }

    await transaction.commit();
    transaction = null;

    const fresh = await ReleaseNote.findByPk(release.id, {
      include: [{ model: ReleaseNoteItem, as: "items" }],
    });

    return successResponse(
      res,
      { release: serializeRelease(fresh, { withItems: true }) },
      "نسخه به‌روزرسانی شد",
    );
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("❌ خطا در ویرایش نسخه:", error.message);
    return errorResponse(res, "خطا در ویرایش نسخه", 500);
  }
};

// ============================================
// [سوپر ادمین] انتشار نسخه (فوری یا زمان‌بندی‌شده)
// ============================================
const publishRelease = async (req, res) => {
  try {
    const release = await ReleaseNote.findByPk(req.params.id, {
      include: [{ model: ReleaseNoteItem, as: "items" }],
    });
    if (!release) return errorResponse(res, "نسخه یافت نشد", 404);

    if (!release.items || release.items.length === 0) {
      return errorResponse(res, "این نسخه هیچ آیتمی ندارد؛ ابتدا آیتم اضافه کنید", 400);
    }

    let publishedAt = new Date();
    if (req.body?.published_at) {
      const parsed = new Date(req.body.published_at);
      if (Number.isNaN(parsed.getTime())) {
        return errorResponse(res, "تاریخ انتشار نامعتبر است", 400);
      }
      publishedAt = parsed;
    }

    await release.update({
      status: "published",
      published_at: publishedAt,
      updated_by: req.user.id,
    });

    // ✅ اختیاری: «انتشار مجدد» → رسیدهای دیدن پاک می‌شوند و همه دوباره می‌بینند
    let viewsReset = 0;
    if (req.body?.resend === true) {
      viewsReset = await ReleaseNoteView.destroy({
        where: { release_note_id: release.id },
      });
    }

    const scheduled = publishedAt.getTime() > Date.now();

    return successResponse(
      res,
      { release: serializeRelease(release), views_reset: viewsReset, scheduled },
      scheduled ? "انتشار برای زمان آینده زمان‌بندی شد" : "نسخه منتشر شد",
    );
  } catch (error) {
    console.error("❌ خطا در انتشار نسخه:", error.message);
    return errorResponse(res, "خطا در انتشار نسخه", 500);
  }
};

// ============================================
// [سوپر ادمین] آرشیو نسخه (از دید کاربران خارج می‌شود)
// ============================================
const archiveRelease = async (req, res) => {
  try {
    const release = await ReleaseNote.findByPk(req.params.id);
    if (!release) return errorResponse(res, "نسخه یافت نشد", 404);

    await release.update({ status: "archived", updated_by: req.user.id });

    return successResponse(
      res,
      { release: serializeRelease(release) },
      "نسخه آرشیو شد",
    );
  } catch (error) {
    console.error("❌ خطا در آرشیو نسخه:", error.message);
    return errorResponse(res, "خطا در آرشیو نسخه", 500);
  }
};

// ============================================
// [سوپر ادمین] حذف نسخه + آیتم‌ها + رسیدهای دیدن
// ============================================
const deleteRelease = async (req, res) => {
  let transaction = null;
  try {
    const release = await ReleaseNote.findByPk(req.params.id);
    if (!release) return errorResponse(res, "نسخه یافت نشد", 404);

    transaction = await sequelize.transaction();
    await ReleaseNoteView.destroy({
      where: { release_note_id: release.id },
      transaction,
    });
    await ReleaseNoteItem.destroy({
      where: { release_note_id: release.id },
      transaction,
    });
    await release.destroy({ transaction });

    await transaction.commit();
    transaction = null;

    return successResponse(res, { id: release.id }, "نسخه و آیتم‌های آن حذف شد");
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error("❌ خطا در حذف نسخه:", error.message);
    return errorResponse(res, "خطا در حذف نسخه", 500);
  }
};

module.exports = {
  // کاربر
  getUnseenRelease,
  markReleaseSeen,
  getReleaseHistory,
  // ادمین (خواندن)
  listReleases,
  getRelease,
  getReleaseStats,
  // سوپر ادمین (نوشتن)
  createRelease,
  updateRelease,
  publishRelease,
  archiveRelease,
  deleteRelease,
};
