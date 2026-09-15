@echo off
REM ============================================================
REM  SKB-CRM - Clean orphan upload files
REM ------------------------------------------------------------
REM  فایل یتیم = فایلی در uploads که در دیتابیس ارجاعی ندارد.
REM
REM  ⚠️ بدون آرگومان فقط «نمایش» می‌دهد و هیچ فایلی حذف نمی‌شود.
REM
REM  اجرا:
REM    clean-orphans.bat                       ← فقط نمایش (امن)
REM    clean-orphans.bat --delete              ← حذف واقعی
REM    clean-orphans.bat --delete --min-age-hours=48
REM
REM  خروجی: %ROOT%logs\clean-orphans.log و
REM         %ROOT%logs\orphan-uploads-<تاریخ>.txt (فهرست کامل)
REM ============================================================
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

cd /d "%ROOT%Backend"

echo ============================================
echo  SKB-CRM Clean Orphan Uploads
if "%~1"=="" (
  echo  MODE: DRY-RUN ^(nothing will be deleted^)
  echo  برای حذف واقعی: clean-orphans.bat --delete
) else (
  echo  ARGS: %*
)
echo  Log: %ROOT%logs\clean-orphans.log
echo ============================================

node scripts\clean-orphan-uploads.js %* >> "%ROOT%logs\clean-orphans.log" 2>&1
if errorlevel 1 (
  echo.
  echo !!! Some files could not be processed - see %ROOT%logs\clean-orphans.log
  echo.
  exit /b 1
)

echo.
echo Done. See %ROOT%logs\clean-orphans.log
echo.
