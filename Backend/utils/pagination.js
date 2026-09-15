// ============================================================
// utils/pagination.js
// استخراج امن page/limit از query با سقف مشخص
// جلوگیری از درخواست‌های سنگین مثل ?limit=999999
// ============================================================

const parsePagination = (
  query = {},
  { defaultLimit = 20, maxLimit = 100 } = {},
) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || defaultLimit;
  const limit = Math.min(Math.max(1, rawLimit), maxLimit);

  return { page, limit, offset: (page - 1) * limit };
};

module.exports = { parsePagination };
