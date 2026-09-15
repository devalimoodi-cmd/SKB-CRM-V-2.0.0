@echo off
REM ============================================================
REM  SKB-CRM Frontend (site + /api proxy) - start with auto-restart + log
REM  این فایل باید در «ریشهٔ پروژه» کنار پوشهٔ Frontend باشد.
REM ============================================================
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

REM ✅ چرخش لاگ: اگر فایل از ۱۰ مگابایت بزرگ‌تر شد، آرشیو شود
call :rotate "%ROOT%logs\frontend.log"

cd /d "%ROOT%Frontend"

echo ============================================
echo  SKB-CRM Frontend - port 3000 (site + /api proxy)
echo  Log file: %ROOT%logs\frontend.log
echo  Keep this window OPEN.
echo ============================================

:loop
echo [%date% %time%] starting frontend... >> "%ROOT%logs\frontend.log"
node server.js >> "%ROOT%logs\frontend.log" 2>&1
echo [%date% %time%] frontend stopped (exit=%errorlevel%) - restarting in 5s >> "%ROOT%logs\frontend.log"
timeout /t 5 /nobreak >nul
goto loop

:rotate
if not exist "%~1" exit /b 0
for %%A in ("%~1") do if %%~zA GTR 10485760 (
  if exist "%~1.old" del /q "%~1.old"
  move /y "%~1" "%~1.old" >nul
)
exit /b 0
