@echo off
REM ============================================================
REM  SKB-CRM - Backup Task Scheduler setup
REM ------------------------------------------------------------
REM  ساخت/حذف/مشاهدهٔ تسک‌های زمان‌بندی‌شدهٔ ویندوز:
REM    ۱) بکاپ روزانه (دیتابیس + uploads)
REM    ۲) گزارش هفتگی حجم uploads (دوشنبه‌ها)
REM
REM  اجرا (Run as Administrator):
REM    install-backup-task.bat install             ← بکاپ روزانه ساعت 02:00
REM    install-backup-task.bat install 23:30       ← ساعت دلخواه
REM    install-backup-task.bat install 02:00 system ← اجرا با حساب SYSTEM (بدون نیاز به لاگین)
REM    install-backup-task.bat status
REM    install-backup-task.bat uninstall
REM ============================================================
setlocal
set ROOT=%~dp0
set ACTION=%~1
set BKTIME=%~2
set RUNAS=%~3

if "%ACTION%"=="" set ACTION=install
if "%BKTIME%"=="" set BKTIME=02:00
if "%RUNAS%"=="" set RUNAS=user

set TASK_BACKUP=SKB-CRM Daily Backup
set TASK_REPORT=SKB-CRM Uploads Report

if /I "%ACTION%"=="install" goto install
if /I "%ACTION%"=="uninstall" goto uninstall
if /I "%ACTION%"=="status" goto status
echo Usage: install-backup-task.bat [install^|uninstall^|status] [HH:MM] [user^|system]
exit /b 1

:install
net session >nul 2>&1
if errorlevel 1 (
  echo [X] Administrator rights are required.
  echo     Right-click this file and choose "Run as administrator".
  exit /b 1
)

if /I "%RUNAS%"=="system" (
  set RUNOPT=/ru SYSTEM
) else (
  set RUNOPT=/it
)

echo Creating scheduled tasks...
echo   - %TASK_BACKUP%  daily at %BKTIME%   (backup.bat)
schtasks /create /tn "%TASK_BACKUP%" /tr "\"%ROOT%backup.bat\"" /sc daily /st %BKTIME% /rl highest %RUNOPT% /f
if errorlevel 1 goto fail

echo   - %TASK_REPORT%  weekly (MON) at 03:00   (uploads-report.bat)
schtasks /create /tn "%TASK_REPORT%" /tr "\"%ROOT%uploads-report.bat\"" /sc weekly /d MON /st 03:00 /rl highest %RUNOPT% /f
if errorlevel 1 goto fail

echo.
echo [OK] Tasks created.
echo   Backup output: %ROOT%backups
echo   Logs:          %ROOT%logs\backup.log   /   %ROOT%logs\uploads-report.log
echo.
echo Tip: set BACKUP_COPY_TO in Backend\.env to also copy each backup to a second disk.
echo      Tip: to clean orphan upload files later:  clean-orphans.bat           (dry-run)
echo                                                   clean-orphans.bat --delete (real delete)
exit /b 0

:uninstall
net session >nul 2>&1
if errorlevel 1 (
  echo [X] Administrator rights are required.
  exit /b 1
)
schtasks /delete /tn "%TASK_BACKUP%" /f
schtasks /delete /tn "%TASK_REPORT%" /f
echo [OK] Tasks removed.
exit /b 0

:status
schtasks /query /tn "%TASK_BACKUP%" 2>nul
schtasks /query /tn "%TASK_REPORT%" 2>nul
schtasks /query /tn "%TASK_BACKUP%" /v /fo LIST 2>nul | findstr /I "TaskName Next Run Status Last Result"
schtasks /query /tn "%TASK_REPORT%" /v /fo LIST 2>nul | findstr /I "TaskName Next Run Status Last Result"
exit /b 0

:fail
echo.
echo [X] Creating a task failed. Are you running as Administrator?
exit /b 1
