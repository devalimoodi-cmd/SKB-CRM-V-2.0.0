#!/usr/bin/env bash
# ============================================================
#  SKB-CRM — Deploy (Linux / PM2)
# ------------------------------------------------------------
#  اجرا در ریشهٔ پروژه:   bash deploy.sh
#  سوییچها:
#    --no-git       بدون git pull
#    --no-npm       بدون نصب پکیجها (سرور آفلاین؛ node_modules کپیشده)
#    --skip-verify  بدون npm run db:verify
#    --no-pm2       بدون ریاستارت PM2 (فقط راهنما چاپ میشود)
#    -h | --help    همین راهنما
#
#  متغیرهای محیطی اختیاری:
#    PM2_BACKEND=skb-backend     PM2_FRONTEND=skb-frontend
#    BACKUP_BEFORE_MIGRATE=1     (یا در Backend/.env بگذار)
#
#  ⛔ این اسکریپت هیچوقت sequelize.sync اجرا نمیکند؛ فقط مایگریشن.
#  لاگ: logs/deploy.log
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
mkdir -p "$ROOT/logs"
LOG="$ROOT/logs/deploy.log"

DO_GIT=1
DO_NPM=1
DO_VERIFY=1
DO_PM2=1
PM2_BACKEND="${PM2_BACKEND:-skb-backend}"
PM2_FRONTEND="${PM2_FRONTEND:-skb-frontend}"

for arg in "$@"; do
  case "$arg" in
    --no-git) DO_GIT=0 ;;
    --no-npm) DO_NPM=0 ;;
    --skip-verify) DO_VERIFY=0 ;;
    --no-pm2) DO_PM2=0 ;;
    -h | --help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) echo "⚠️ سوییچ ناشناخته: $arg" ;;
  esac
done

log_line() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"$LOG"
}

say() {
  echo "$1"
  log_line "$1"
}

fail() {
  say "❌ $1"
  say "DEPLOY FAILED"
  exit 1
}

say "============================================"
say " SKB-CRM - Deploy (Linux/PM2)"
say " Log: $LOG"
say "============================================"

# ===== ۱) فایل تنظیمات =====
if [[ ! -f "$ROOT/Backend/.env" ]]; then
  fail "فایل Backend/.env پیدا نشد؛ آن را از Backend/.env.example بساز (DB_*, JWT_SECRET, SMS_*)"
fi

# پیش‌فرض BACKUP_BEFORE_MIGRATE از .env (اگر در محیط شل ست نشده باشد)
if [[ -z "${BACKUP_BEFORE_MIGRATE:-}" ]]; then
  BACKUP_BEFORE_MIGRATE="$(
    grep -E '^BACKUP_BEFORE_MIGRATE=' "$ROOT/Backend/.env" 2>/dev/null |
      tail -n1 | cut -d= -f2- | tr -d ' \r"' || true
  )"
fi
BACKUP_BEFORE_MIGRATE="${BACKUP_BEFORE_MIGRATE:-0}"

# ===== ۲) دریافت کد جدید =====
if [[ "$DO_GIT" == "1" ]]; then
  say "--- git pull ---"
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git pull >>"$LOG" 2>&1; then
      say "[OK] git pull"
    else
      say "[!] git pull انجام نشد (تغییرات محلی یا تنظیم گیت) - ادامه می‌دهیم"
    fi
  else
    say "[!] این پوشه مخزن گیت نیست - از git pull صرف‌نظر شد"
  fi
else
  say "[i] git pull رد شد (--no-git)"
fi

# ===== ۳) بکاپ اختیاری قبل از مایگریشن =====
if [[ "$BACKUP_BEFORE_MIGRATE" == "1" ]]; then
  say "--- backup قبل از مایگریشن ---"
  if (cd "$ROOT/Backend" && node scripts/backup.js >>"$LOG" 2>&1); then
    say "[OK] بکاپ گرفته شد"
  else
    fail "بکاپ ناموفق بود - برای احتیاط مایگریشن اجرا نشد (جزئیات: logs/backup.log)
     راهنما: نصب postgresql-client (pg_dump) یا BACKUP_BEFORE_MIGRATE=0 در Backend/.env"
  fi
else
  say "[i] توصیه: BACKUP_BEFORE_MIGRATE=1 را در Backend/.env بگذار تا خودکار بکاپ بگیرد"
fi

# ===== ۴) نصب پکیج‌ها =====
if [[ "$DO_NPM" == "1" ]]; then
  say "--- Backend: npm ci ---"
  if ! (cd "$ROOT/Backend" && npm ci >>"$LOG" 2>&1); then
    say "[i] npm ci ناموفق بود - تلاش با npm install"
    (cd "$ROOT/Backend" && npm install >>"$LOG" 2>&1) ||
      fail "نصب پکیج‌های Backend ناموفق بود (لاگ: $LOG)"
  fi
  say "[OK] Backend packages"

  say "--- Frontend: npm ci ---"
  if ! (cd "$ROOT/Frontend" && npm ci >>"$LOG" 2>&1); then
    say "[i] npm ci ناموفق بود - تلاش با npm install"
    (cd "$ROOT/Frontend" && npm install >>"$LOG" 2>&1) ||
      fail "نصب پکیج‌های Frontend ناموفق بود (لاگ: $LOG)"
  fi
  say "[OK] Frontend packages"
else
  say "[i] نصب پکیج‌ها رد شد (--no-npm) - مطمئن شو node_modules کپی شده است"
fi

# ===== ۵) مایگریشن دیتابیس (هرگز sequelize.sync) =====
say "--- db:migrate ---"
(cd "$ROOT/Backend" && npm run db:migrate >>"$LOG" 2>&1) ||
  fail "مایگریشن ناموفق بود (لاگ: $LOG)"
say "[OK] مایگریشن اجرا شد"

# ===== ۶) تأیید ساختار دیتابیس =====
if [[ "$DO_VERIFY" == "1" ]]; then
  say "--- db:verify ---"
  (cd "$ROOT/Backend" && npm run db:verify >>"$LOG" 2>&1) ||
    fail "تأیید ساختار دیتابیس ناموفق بود (لاگ: $LOG)"
  say "[OK] ساختار دیتابیس تأیید شد"
fi

# ===== ۷) ری‌استارت سرویس‌ها (PM2) =====
if [[ "$DO_PM2" == "1" ]]; then
  if command -v pm2 >/dev/null 2>&1; then
    say "--- pm2 restart ---"
    pm2 restart "$PM2_BACKEND" "$PM2_FRONTEND" >>"$LOG" 2>&1 ||
      fail "ری‌استارت PM2 ناموفق بود"
    say "[OK] سرویس‌ها ری‌استارت شدند: $PM2_BACKEND , $PM2_FRONTEND"
  else
    say "[i] pm2 پیدا نشد؛ دستی ری‌استارت کن:  pm2 restart $PM2_BACKEND $PM2_FRONTEND"
  fi
else
  say "[i] ری‌استارت PM2 رد شد (--no-pm2)"
fi

say "============================================"
say " ✅ Deploy finished"
say "   تست بک‌اند : http://127.0.0.1:5000/api/ping"
say "   تست فرانت  : http://127.0.0.1:3000/api/ping"
say "   بررسی ساختار دیتابیس (با توکن ادمین): /api/server-status"
say "   عیب‌یابی خطای 500:  cd Backend و بعد  npm run db:verify"
say "============================================"
say "deploy finished OK"
exit 0
