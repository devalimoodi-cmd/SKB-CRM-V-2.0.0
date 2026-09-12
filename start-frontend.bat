@echo off
setlocal
set ROOT=%~dp0
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

cd /d "%ROOT%Frontend"
echo ============================================
echo  SKB-CRM Frontend (site + API proxy) - port 3000
echo  Log file: %ROOT%logs\frontend.log
echo  Keep this window OPEN.
echo ============================================

:loop
echo [%date% %time%] starting frontend... >> "%ROOT%logs\frontend.log"
node server.js >> "%ROOT%logs\frontend.log" 2>&1
echo [%date% %time%] frontend stopped (exit=%errorlevel%) - restarting in 5s >> "%ROOT%logs\frontend.log"
timeout /t 5 /nobreak >nul
goto loop
