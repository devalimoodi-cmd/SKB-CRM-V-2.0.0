@echo off
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

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
