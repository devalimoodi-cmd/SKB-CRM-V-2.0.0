// ============================================================
// utils/token.js
// محاسبهٔ عمر توکن بر اساس متغیر محیطی JWT_EXPIRE
// مثال‌های معتبر: "30m" , "12h" , "7d" , "3600" (ثانیه)
// ============================================================

const DEFAULT_EXPIRE = "7d";

const parseDurationToMs = (value) => {
  const raw = String(value || DEFAULT_EXPIRE).trim();
  const match = raw.match(/^(\d+)\s*(ms|s|m|h|d)?$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const amount = Number(match[1]);
  const unit = (match[2] || "s").toLowerCase();
  const table = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * (table[unit] || 1000);
};

const getTokenExpire = () => process.env.JWT_EXPIRE || DEFAULT_EXPIRE;

const getTokenExpiryMs = () => parseDurationToMs(getTokenExpire());

const getTokenExpiryDate = () => new Date(Date.now() + getTokenExpiryMs());

module.exports = {
  parseDurationToMs,
  getTokenExpire,
  getTokenExpiryMs,
  getTokenExpiryDate,
};
