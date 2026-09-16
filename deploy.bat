@echo off
REM ============================================================
REM  SKB-CRM — Deploy (کد + پکیج‌ها + مایگریشن دیتابیس + تأیید)
REM ------------------------------------------------------------
REM  اجرا در ریشهٔ پروژه:  deploy.bat
REM  سوییچ‌ها:
REM    --no-git       بدون git pull — وقتی با کپی فایل مستقر می‌کنید
REM    --no-npm       بدون نصب پکیج‌ها — سرور آفلاین با node_modules کپی‌شده
REM    --skip-verify  اجرای npm run db:verify را رد کن
REM    --pause        در پایان منتظر کلید بماند — برای اجرای دستی با دوبار کلیک
REM
REM  نکته: مایگریشن روی دیتابیس واقعی اجرا می‌شود، پس اگر در .env مقدار
REM        BACKUP_BEFORE_MIGRATE=1 باشد، قبلش به‌صورت خودکار بکاپ گرفته می‌شود.
REM  لاگ: logs\deploy.log
REM ============================================================
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set LOG=%ROOT%logs\deploy.log

set DO_GIT=1
set DO_NPM=1
set DO_VERIFY=1
set DO_PAUSE=0

:parse
if "%~1"=="" goto parsed
if /I "%~1"=="--no-git" set DO_GIT=0
if /I "%~1"=="--no-npm" set DO_NPM=0
if /I "%~1"=="--skip-verify" set DO_VERIFY=0
if /I "%~1"=="--pause" set DO_PAUSE=1
shift
goto parse
:parsed

echo ============================================
echo  SKB-CRM - Deploy
echo  Log: %LOG%
echo ============================================
echo [%date% %time%] deploy started >> "%LOG%"

REM ===== ۱) بررسی فایل تنظیمات =====
if exist "%ROOT%Backend\.env" goto env_ok
echo [X] فایل Backend\.env پیدا نشد.
echo     آن را از Backend\.env.example بساز و این مقادیر را بگذار:
echo     NODE_ENV, DB_*, JWT_SECRET, SMS_*, BACKUP_COPY_TO
echo [%date% %time%] ERROR: Backend\.env missing >> "%LOG%"
goto fail
:env_ok

REM ===== خواندن BACKUP_BEFORE_MIGRATE از .env (اگر در محیط ویندوز ست نشده باشد) =====
if defined BACKUP_BEFORE_MIGRATE goto backup_flag_ready
for /f "usebackq tokens=1,* delims==" %%A in ("%ROOT%Backend\.env") do (
  if /I "%%A"=="BACKUP_BEFORE_MIGRATE" set "BACKUP_BEFORE_MIGRATE=%%B"
)
:backup_flag_ready

REM ===== ۲) دریافت کد جدید =====
if "%DO_GIT%"=="0" goto git_skip
echo.
echo --- git pull ---
cd /d "%ROOT%"
git pull >> "%LOG%" 2>&1
if errorlevel 1 goto git_warn
echo [OK] git pull
goto git_skip
:git_warn
echo [!] git pull انجام نشد - تغییرات محلی یا نبود گیت - ادامه می‌دهیم.
echo [%date% %time%] WARN: git pull failed >> "%LOG%"
:git_skip
if "%DO_GIT%"=="1" goto backup_check
echo [i] git pull رد شد - سوییچ --no-git
:backup_check

REM ===== ۳) بکاپ اختیاری قبل از مایگریشن =====
if /I "%BACKUP_BEFORE_MIGRATE%"=="1" goto do_backup
echo [i] توصیه: قبل از اولین استقرار یک‌بار backup.bat را اجرا کن
echo     یا در .env مقدار BACKUP_BEFORE_MIGRATE=1 را بگذار تا خودکار انجام شود
goto npm_check
:do_backup
echo.
echo --- backup قبل از مایگریشن ---
call "%ROOT%backup.bat" >> "%LOG%" 2>&1
if errorlevel 1 goto backup_fail
echo [OK] بکاپ گرفته شد
goto npm_check
:backup_fail
echo [X] بکاپ ناموفق بود - برای احتیاط مایگریشن اجرا نشد.
echo [%date% %time%] ERROR: backup failed >> "%LOG%"
goto fail

REM ===== ۴) نصب پکیج‌ها =====
:npm_check
if "%DO_NPM%"=="0" goto npm_skip
echo.
echo --- Backend: npm ci ---
cd /d "%ROOT%Backend"
call npm ci >> "%LOG%" 2>&1
if not errorlevel 1 goto backend_done
echo [i] npm ci ناموفق بود - تلاش با npm install
call npm install >> "%LOG%" 2>&1
if errorlevel 1 goto backend_fail
:backend_done
echo [OK] Backend packages

echo --- Frontend: npm ci ---
cd /d "%ROOT%Frontend"
call npm ci >> "%LOG%" 2>&1
if not errorlevel 1 goto frontend_done
echo [i] npm ci ناموفق بود - تلاش با npm install
call npm install >> "%LOG%" 2>&1
if errorlevel 1 goto frontend_fail
:frontend_done
echo [OK] Frontend packages
goto npm_skip
:backend_fail
echo [X] نصب پکیج‌های Backend ناموفق بود - لاگ: %LOG%
goto fail
:frontend_fail
echo [X] نصب پکیج‌های Frontend ناموفق بود - لاگ: %LOG%
goto fail
:npm_skip
if "%DO_NPM%"=="1" goto migrate
echo [i] نصب پکیج‌ها رد شد - مطمئن شو node_modules کپی شده است

REM ===== ۵) مایگریشن دیتابیس =====
:migrate
echo.
echo --- db:migrate ---
cd /d "%ROOT%Backend"
call npm run db:migrate >> "%LOG%" 2>&1
if errorlevel 1 goto migrate_fail
echo [OK] مایگریشن اجرا شد
goto verify
:migrate_fail
echo [X] مایگریشن ناموفق بود - لاگ: %LOG%
goto fail

REM ===== ۶) تأیید ساختار دیتابیس =====
:verify
if "%DO_VERIFY%"=="0" goto done
echo.
echo --- db:verify ---
call npm run db:verify >> "%LOG%" 2>&1
if errorlevel 1 goto verify_fail
echo [OK] ساختار دیتابیس تأیید شد
goto done
:verify_fail
echo [X] تأیید ساختار دیتابیس ناموفق بود - لاگ: %LOG%
goto fail

:done
echo.
echo ============================================
echo  [OK] Deploy finished
echo   1. پنجرهٔ بک‌اند را ببند و start-backend.bat را اجرا کن
echo   2. پنجرهٔ فرانت را ببند و start-frontend.bat را اجرا کن
echo   تست بک‌اند : http://127.0.0.1:5000/api/ping
echo   تست فرانت  : http://127.0.0.1:3000/api/ping
echo   عیب‌یابی خطای 500 در صفحات: در پوشهٔ Backend دستور  npm run db:verify  را اجرا کن
echo     (اگر FAIL داد:  npm run db:migrate  سپس دوباره db:verify و ری‌استارت بک‌اند)
echo ============================================
echo [%date% %time%] deploy finished OK >> "%LOG%"
if "%DO_PAUSE%"=="1" pause
exit /b 0

:fail
echo.
echo !!! DEPLOY FAILED - see %LOG%
echo [%date% %time%] deploy FAILED >> "%LOG%"
if "%DO_PAUSE%"=="1" pause
exit /b 1
