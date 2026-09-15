@echo off
REM ============================================================
REM  SKB-CRM - Backup  (database + uploaded files)
REM  اجرا: دستی (دابل‌کلیک) یا با Task Scheduler (پیشنهاد: روزانه)
REM  خروجی: <ریشهٔ پروژه>\backups\<تاریخ-ساعت>\
REM ============================================================
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

cd /d "%ROOT%Backend"

echo ============================================
echo  SKB-CRM Backup (db + uploads)
echo  Output: %ROOT%backups
echo  Log:    %ROOT%logs\backup.log
echo ============================================

node scripts\backup.js >> "%ROOT%logs\backup.log" 2>&1
if errorlevel 1 (
  echo.
  echo !!! BACKUP FAILED - see %ROOT%logs\backup.log
  echo.
  exit /b 1
)

echo.
echo Backup finished successfully.
echo.
