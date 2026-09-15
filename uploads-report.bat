@echo off
REM ============================================================
REM  SKB-CRM - Uploads report  (read-only: حجم و وضعیت فایل‌ها)
REM  اجرا: دستی یا با Task Scheduler (پیشنهاد: هفتگی)
REM  خروجی: %ROOT%logs\uploads-report.log
REM  آرگومان‌های اختیاری: --json   --no-db   --older-than=180   --top=20
REM ============================================================
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

cd /d "%ROOT%Backend"

echo ============================================
echo  SKB-CRM Uploads Report (read-only)
echo  Log: %ROOT%logs\uploads-report.log
echo ============================================

node scripts\uploads-report.js %* >> "%ROOT%logs\uploads-report.log" 2>&1
if errorlevel 1 (
  echo.
  echo !!! REPORT FAILED - see %ROOT%logs\uploads-report.log
  echo.
  exit /b 1
)

echo.
echo Report written to %ROOT%logs\uploads-report.log
echo.
