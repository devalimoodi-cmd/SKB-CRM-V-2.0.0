export function toNumber(value, defaultValue = 0) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

export function toFixed(value, decimals = 2) {
  const num = toNumber(value);
  return num.toFixed(decimals);
}

export function formatCurrency(amount) {
  const num = toNumber(amount);
  return toPersianNumber(num.toLocaleString("en-US")) + " تومان";
}

export function formatWeight(kg) {
  const num = toNumber(kg);
  return toPersianNumber(num.toFixed(2)) + " کیلوگرم";
}

export function formatPercent(value) {
  const num = toNumber(value);
  return toPersianNumber(num.toFixed(1)) + "%";
}

export function clamp(value, min, max) {
  return Math.min(Math.max(toNumber(value), min), max);
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function average(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const valid = numbers.filter((n) => !isNaN(n));
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function sum(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  return numbers.filter((n) => !isNaN(n)).reduce((a, b) => a + b, 0);
}

export function min(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  return Math.min(...numbers.filter((n) => !isNaN(n)));
}

export function max(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  return Math.max(...numbers.filter((n) => !isNaN(n)));
}
