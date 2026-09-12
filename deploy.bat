@echo off
setlocal
set ROOT=%~dp0

echo ============================================
echo  SKB-CRM - Deploy (git pull + npm install)
echo ============================================

cd /d "%ROOT%"
echo.
echo --- git pull ---
git pull
if errorlevel 1 goto :error

echo.
echo --- Backend: npm install ---
cd /d "%ROOT%Backend"
call npm install
if errorlevel 1 goto :error

echo.
echo --- Frontend: npm install ---
cd /d "%ROOT%Frontend"
call npm install
if errorlevel 1 goto :error

echo.
echo ============================================
echo  DONE.
echo  Now restart both servers:
echo    1) close the backend / frontend windows
echo    2) run start-backend.bat
echo    3) run start-frontend.bat
echo  Test:  http://127.0.0.1:5000/api/ping
echo         http://127.0.0.1:3000/api/ping
echo ============================================
exit /b 0

:error
echo.
echo !!! ERROR - see the messages above (deploy stopped)
exit /b 1
