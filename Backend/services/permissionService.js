// ============================================================
// services/permissionService.js
// «محاسبه و ذخیرهٔ سطوح دسترسی»
// ------------------------------------------------------------
// • مجوز مؤثر = استثنای کاربر ← استثنای نقش ← پیش‌فرض کاتالوگ
// • کش ۳۰ ثانیه‌ای (نقش‌ها و استثناهای کاربر) تا هر درخواست
//   به دیتابیس فشار نیاورد؛ پس از هر تغییر، کش پاک می‌شود.
// • هر تغییر در permission_audit_logs ثبت می‌شود.
// ============================================================
"use strict";

const crypto = require("crypto");
const {
  ROLES,
  ROLE_TITLES,
  PERMISSION_GROUPS,
  PERMISSIONS,
  PERMISSION_KEYS,
  LOCKED_PERMISSION_KEYS,
  isValidPermission,
  defaultFor,
  isLockedFor,
  isAlwaysOnFor,
} = require("../config/permissions");
const RolePermission = require("../models/RolePermission");
const UserPermission = require("../models/UserPermission");
const PermissionAuditLog = require("../models/PermissionAuditLog");

const CACHE_TTL_MS = Math.max(
  0,
  Number(process.env.PERMISSIONS_CACHE_TTL_MS || 30000),
);

// ===== کش =====
let roleCache = { at: 0, map: null }; // { [role]: { [key]: bool } }
const userCache = new Map(); // userId → { at, map }

// ===== نسخهٔ مجوزها =====
// برای اطلاع سریع کلاینت‌ها از تغییرات: MAX(updated_at) دو جدول استثناها
// با کش ۵ ثانیه‌ای (سبک و بدون هیچ مایگریشن جدید).
let versionCache = { at: 0, value: null };
const VERSION_TTL_MS = 5000;

const clearPermissionsCache = (userId = null) => {
  // ✅ نسخه همیشه باید بلافاصله تازه شود (تا کلاینت‌ها تغییر را بفهمند)
  versionCache = { at: 0, value: null };

  if (userId === null) {
    roleCache = { at: 0, map: null };
    userCache.clear();
    return;
  }
  userCache.delete(Number(userId));
};

const isValidRole = (role) => ROLES.includes(role);

// ===== محاسبهٔ نسخهٔ مجوزها =====
const getPermissionsVersion = async (force = false) => {
  const fresh =
    versionCache.value !== null && Date.now() - versionCache.at < VERSION_TTL_MS;
  if (fresh && !force) return versionCache.value;

  const [roleMax, userMax] = await Promise.all([
    RolePermission.max("updated_at"),
    UserPermission.max("updated_at"),
  ]);

  const timestamps = [roleMax, userMax]
    .map((value) => (value ? new Date(value).getTime() : 0))
    .filter((n) => Number.isFinite(n));

  const value = timestamps.length ? Math.max(...timestamps) : 0;
  versionCache = { at: Date.now(), value };
  return value;
};

// ===== استثناهای نقش‌ها (کش‌شده) =====
const loadRoleOverrides = async (force = false) => {
  const fresh = roleCache.map && Date.now() - roleCache.at < CACHE_TTL_MS;
  if (fresh && !force) return roleCache.map;

  const rows = await RolePermission.findAll({
    attributes: ["role", "permission_key", "allowed"],
  });

  const map = {};
  ROLES.forEach((role) => {
    map[role] = {};
  });
  rows.forEach((row) => {
    if (!map[row.role]) map[row.role] = {};
    map[row.role][row.permission_key] = Boolean(row.allowed);
  });

  roleCache = { at: Date.now(), map };
  return map;
};

// ===== استثناهای یک کاربر (کش‌شده) =====
const loadUserOverrides = async (userId, force = false) => {
  const id = Number(userId);
  const cached = userCache.get(id);
  if (cached && !force && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.map;
  }

  const rows = await UserPermission.findAll({
    where: { user_id: id },
    attributes: ["permission_key", "allowed"],
  });

  const map = {};
  rows.forEach((row) => {
    map[row.permission_key] = Boolean(row.allowed);
  });

  userCache.set(id, { at: Date.now(), map });
  return map;
};

// ===== مجوز مؤثر یک کاربر =====
const getEffectivePermissions = async (user, options = {}) => {
  const userId = user?.id;
  const role = user?.role;

  if (!isValidRole(role)) {
    return { role, permissions: new Set(), effective: {}, overrides: {} };
  }

  const [roleOverrides, userOverrides] = await Promise.all([
    loadRoleOverrides(options.force),
    userId ? loadUserOverrides(userId, options.force) : Promise.resolve({}),
  ]);

  const effective = {};
  const permissions = new Set();

  PERMISSION_KEYS.forEach((key) => {
    const roleValue =
      typeof roleOverrides[role]?.[key] === "boolean"
        ? roleOverrides[role][key]
        : defaultFor(role, key);

    const value =
      typeof userOverrides[key] === "boolean" ? userOverrides[key] : roleValue;

    effective[key] = value;
    if (value) permissions.add(key);
  });

  return { role, permissions, effective, overrides: userOverrides };
};

// ===== ماتریس نقش‌ها (برای پنل ادمین) =====
const getRoleMatrix = async () => {
  const roleOverrides = await loadRoleOverrides(true);
  const matrix = {};

  ROLES.forEach((role) => {
    matrix[role] = {};
    PERMISSION_KEYS.forEach((key) => {
      const override = roleOverrides[role]?.[key];
      matrix[role][key] =
        typeof override === "boolean" ? override : defaultFor(role, key);
    });
  });

  return matrix;
};

// ===== اعتبارسنجی درخواست تغییر =====
const normalizeUpdates = (updates) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { error: "لیست تغییرات خالی یا نامعتبر است" };
  }

  const clean = [];
  for (const entry of updates) {
    const key = String(entry?.key || "").trim();
    if (!isValidPermission(key)) {
      return { error: `کلید مجوز نامعتبر است: ${key}` };
    }
    const allowed = entry?.allowed;
    if (typeof allowed !== "boolean" && allowed !== null) {
      return { error: `مقدار مجوز «${key}» باید true/false یا null باشد` };
    }
    clean.push({ key, allowed });
  }

  return { updates: clean };
};

// چه کلیدهایی برای این نقش اجازهٔ تغییر ندارند؟
const lockedKeysForRole = (role, updates) =>
  updates
    .filter((u) => isLockedFor(role, u.key))
    .map((u) => u.key);

// ===== ثبت گزارش تغییر =====
const logChanges = async ({ actorId, targetType, targetId, changes, note }) => {
  const batchId = crypto.randomBytes(8).toString("hex");
  const rows = changes.map((change) => ({
    actor_id: actorId || null,
    target_type: targetType,
    target_id: String(targetId),
    permission_key: change.key || null,
    old_value:
      change.oldValue === undefined || change.oldValue === null
        ? null
        : String(change.oldValue),
    new_value:
      change.newValue === undefined || change.newValue === null
        ? null
        : String(change.newValue),
    batch_id: batchId,
    note: note || null,
  }));

  if (rows.length === 0) return batchId;
  await PermissionAuditLog.bulkCreate(rows);
  return batchId;
};

// ===== ذخیرهٔ سطح دسترسی یک نقش (فقط استثناها ذخیره می‌شوند) =====
const setRolePermissions = async ({ role, updates, actorId, note }) => {
  if (!isValidRole(role)) return { error: "نقش نامعتبر است" };

  const normalized = normalizeUpdates(updates);
  if (normalized.error) return { error: normalized.error };

  const locked = lockedKeysForRole(role, normalized.updates);
  if (locked.length > 0) {
    return {
      error: `این مجوزها برای نقش «${ROLE_TITLES[role]}» قابل تغییر نیستند: ${locked.join(", ")}`,
    };
  }

  const alwaysOn = normalized.updates
    .filter((u) => u.allowed === false && isAlwaysOnFor(role, u.key))
    .map((u) => u.key);
  if (alwaysOn.length > 0) {
    return {
      error: `این مجوزها برای نقش «${ROLE_TITLES[role]}» همیشه فعال‌اند: ${alwaysOn.join(", ")}`,
    };
  }

  const existing = await RolePermission.findAll({ where: { role } });
  const existingMap = new Map(existing.map((r) => [r.permission_key, r]));

  const changes = [];
  const applied = [];
  const removed = [];

  for (const { key, allowed } of normalized.updates) {
    const row = existingMap.get(key);
    const oldValue = row ? Boolean(row.allowed) : defaultFor(role, key);

    if (allowed === defaultFor(role, key)) {
      // مقدار مساوی پیش‌فرض ⇒ ردیف لازم نیست (جدول تمیز می‌ماند)
      if (row) {
        await row.destroy();
        removed.push(key);
        changes.push({ key, oldValue, newValue: null });
      }
      continue;
    }

    if (row) {
      if (Boolean(row.allowed) !== allowed) {
        row.allowed = allowed;
        row.updated_by = actorId || null;
        await row.save();
        changes.push({ key, oldValue, newValue: allowed });
      }
    } else {
      await RolePermission.create({
        role,
        permission_key: key,
        allowed,
        updated_by: actorId || null,
      });
      changes.push({ key, oldValue, newValue: allowed });
    }
    applied.push(key);
  }

  const batchId = await logChanges({
    actorId,
    targetType: "role",
    targetId: role,
    changes,
    note,
  });

  clearPermissionsCache();

  return {
    role,
    applied,
    removed,
    changed: changes.length,
    batchId,
    matrix: await getRoleMatrix(),
  };
};

// ===== بازگردانی سطح دسترسی نقش به پیش‌فرض کاتالوگ =====
const resetRolePermissions = async ({ role, actorId, note }) => {
  if (!isValidRole(role)) return { error: "نقش نامعتبر است" };

  const rows = await RolePermission.findAll({ where: { role } });
  const changes = rows.map((row) => ({
    key: row.permission_key,
    oldValue: Boolean(row.allowed),
    newValue: null,
  }));

  await RolePermission.destroy({ where: { role } });

  const batchId = await logChanges({
    actorId,
    targetType: "role",
    targetId: role,
    changes,
    note: note || "بازگردانی به پیش‌فرض",
  });

  clearPermissionsCache();

  return {
    role,
    removed: changes.length,
    batchId,
    matrix: await getRoleMatrix(),
  };
};

const getCatalog = () => ({
  roles: ROLES,
  roleTitles: ROLE_TITLES,
  lockedKeys: LOCKED_PERMISSION_KEYS,
  total: PERMISSION_KEYS.length,
  groups: PERMISSION_GROUPS.map((group) => ({
    key: group.key,
    title: group.title,
    icon: group.icon,
    items: group.items.map((entry) => ({
      key: entry.key,
      title: entry.title,
      risk: entry.risk || null,
      lockedTo: entry.lockedTo || [],
      alwaysOnFor: entry.alwaysOnFor || [],
      defaults: entry.defaults,
    })),
  })),
});

// ===== وضعیت دسترسی یک کاربر (برای پنل ادمین) =====
const getUserPermissionState = async (user) => {
  const { role, effective, overrides, permissions } =
    await getEffectivePermissions(user, { force: true });

  return {
    user: { id: user.id, role },
    roleTitles: ROLE_TITLES,
    overrides, // فقط موارد سفارشی این کاربر
    effective, // مقدار نهایی برای هر کلید
    grantedCount: permissions.size,
    total: PERMISSION_KEYS.length,
  };
};

// ===== ذخیرهٔ سطح دسترسی اختصاصی یک کاربر =====
// allowed = null ⇒ «ارثی از نقش» (ردیف حذف می‌شود)
const setUserPermissions = async ({ user, updates, actorId, note }) => {
  if (!user) return { error: "کاربر یافت نشد" };
  if (!isValidRole(user.role)) return { error: "نقش کاربر نامعتبر است" };

  const normalized = normalizeUpdates(updates);
  if (normalized.error) return { error: normalized.error };

  const locked = lockedKeysForRole(
    user.role,
    normalized.updates.filter((u) => u.allowed !== null),
  );
  if (locked.length > 0) {
    return {
      error: `این مجوزها برای نقش «${ROLE_TITLES[user.role]}» قابل فعال‌سازی نیستند: ${locked.join(", ")}`,
    };
  }

  const alwaysOn = normalized.updates
    .filter((u) => u.allowed === false && isAlwaysOnFor(user.role, u.key))
    .map((u) => u.key);
  if (alwaysOn.length > 0) {
    return {
      error: `این مجوزها برای کاربران این نقش همیشه فعال‌اند: ${alwaysOn.join(", ")}`,
    };
  }

  const existing = await UserPermission.findAll({
    where: { user_id: user.id },
  });
  const existingMap = new Map(existing.map((r) => [r.permission_key, r]));

  // مقدار نقش (برای محاسبهٔ old_value واقعی)
  const roleOverrides = await loadRoleOverrides(false);

  const changes = [];
  const applied = [];
  const removed = [];

  for (const { key, allowed } of normalized.updates) {
    const row = existingMap.get(key);
    const roleValue =
      typeof roleOverrides[user.role]?.[key] === "boolean"
        ? roleOverrides[user.role][key]
        : defaultFor(user.role, key);
    const oldValue = row ? Boolean(row.allowed) : roleValue;

    if (allowed === null || allowed === roleValue) {
      if (row) {
        await row.destroy();
        removed.push(key);
        changes.push({ key, oldValue, newValue: null });
      }
      continue;
    }

    if (row) {
      if (Boolean(row.allowed) !== allowed) {
        row.allowed = allowed;
        row.updated_by = actorId || null;
        await row.save();
        changes.push({ key, oldValue, newValue: allowed });
      }
    } else {
      await UserPermission.create({
        user_id: user.id,
        permission_key: key,
        allowed,
        updated_by: actorId || null,
      });
      changes.push({ key, oldValue, newValue: allowed });
    }
    applied.push(key);
  }

  const batchId = await logChanges({
    actorId,
    targetType: "user",
    targetId: user.id,
    changes,
    note,
  });

  clearPermissionsCache(user.id);

  return {
    userId: user.id,
    applied,
    removed,
    changed: changes.length,
    batchId,
    state: await getUserPermissionState(user),
  };
};

// ===== بازگردانی دسترسی کاربر به سطح نقش =====
const resetUserPermissions = async ({ user, actorId, note }) => {
  if (!user) return { error: "کاربر یافت نشد" };

  const rows = await UserPermission.findAll({ where: { user_id: user.id } });
  if (rows.length === 0) {
    return {
      userId: user.id,
      removed: 0,
      state: await getUserPermissionState(user),
    };
  }

  const changes = rows.map((row) => ({
    key: row.permission_key,
    oldValue: Boolean(row.allowed),
    newValue: null,
  }));

  await UserPermission.destroy({ where: { user_id: user.id } });

  const batchId = await logChanges({
    actorId,
    targetType: "user",
    targetId: user.id,
    changes,
    note: note || "بازگردانی به سطح نقش",
  });

  clearPermissionsCache(user.id);

  return {
    userId: user.id,
    removed: changes.length,
    batchId,
    state: await getUserPermissionState(user),
  };
};

// ===== گزارش تغییرات (صفحه‌بندی‌شده) =====
const getAuditLogs = async ({ page = 1, limit = 30, targetType, targetId } = {}) => {
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);

  const where = {};
  if (targetType) where.target_type = String(targetType);
  if (targetId) where.target_id = String(targetId);

  const { rows, count } = await PermissionAuditLog.findAndCountAll({
    where,
    order: [["id", "DESC"]],
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      actorId: row.actor_id,
      targetType: row.target_type,
      targetId: row.target_id,
      permissionKey: row.permission_key,
      permissionTitle: row.permission_key
        ? PERMISSIONS[row.permission_key]?.title || row.permission_key
        : null,
      oldValue: row.old_value,
      newValue: row.new_value,
      batchId: row.batch_id,
      note: row.note,
      createdAt: row.created_at,
    })),
    total: count,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(count / safeLimit)),
  };
};

module.exports = {
  ROLES,
  ROLE_TITLES,
  clearPermissionsCache,
  isValidRole,
  getEffectivePermissions,
  getRoleMatrix,
  getCatalog,
  getPermissionsVersion,
  setRolePermissions,
  resetRolePermissions,
  getUserPermissionState,
  setUserPermissions,
  resetUserPermissions,
  getAuditLogs,
};
