@echo off
cd /d "%~dp0"
title Hen Ho Hub - Local Server
echo ========================================================
echo   DANG KHOI DONG HEN HO HUB TAI:
echo   http://127.0.0.1:8001
echo ========================================================
echo.
echo [1/2] Dang mo trinh duyet...
start "" "http://127.0.0.1:8001"
echo [2/2] Dang khoi dong may chu local...
REM Double-click safe: kill any stale server still holding port 8001 first.
REM (Windows allows two python http.servers on the same port; new
REM connections then land on the wedged one -> ERR_EMPTY_RESPONSE.)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:8001" ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
python -m http.server 8001 --bind 127.0.0.1
if errorlevel 1 (
  echo Thu khoi dong voi py...
  py -m http.server 8001 --bind 127.0.0.1
)
pause
