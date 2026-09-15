@echo off
REM ============================================================
REM  SKB-CRM Backend (API) - start with auto-restart + log
REM  این فایل باید در «ریشهٔ پروژه» کنار پوشهٔ Backend باشد.
REM  (%~dp0 یعنی همان پوشهٔ این فایل)
REM ============================================================
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

REM ✅ روی سرور: جزئیات خطاهای داخلی به کاربر نشان داده نشود
set NODE_ENV=production

REM ✅ چرخش لاگ: اگر فایل از ۱۰ مگابایت بزرگ‌تر شد، آرشیو شود
call :rotate "%ROOT%logs\backend.log"

cd /d "%ROOT%Backend"

echo ============================================
echo  SKB-CRM Backend (API) - port 5000
echo  Log file: %ROOT%logs\backend.log
echo  Keep this window OPEN.
echo ============================================

:loop
echo [%date% %time%] starting backend... >> "%ROOT%logs\backend.log"
node server.js >> "%ROOT%logs\backend.log" 2>&1
echo [%date% %time%] backend stopped (exit=%errorlevel%) - restarting in 5s >> "%ROOT%logs\backend.log"
timeout /t 5 /nobreak >nul
goto loop

:rotate
if not exist "%~1" exit /b 0
for %%A in ("%~1") do if %%~zA GTR 10485760 (
  if exist "%~1.old" del /q "%~1.old"
  move /y "%~1" "%~1.old" >nul
)
exit /b 0
