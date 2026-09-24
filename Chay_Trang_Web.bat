@echo off
cd /d "%~dp0"
title Hen Ho Hub - Local Server
echo ========================================================
echo   DANG KHOI DONG HEN HO HUB TAI:
echo   http://127.0.0.1:8000
echo ========================================================
echo.
echo [1/2] Dang mo trinh duyet...
start "" "http://127.0.0.1:8000"
echo [2/2] Dang khoi dong may chu local...
python -m http.server 8000 --bind 127.0.0.1
if errorlevel 1 (
  echo Thu khoi dong voi py...
  py -m http.server 8000 --bind 127.0.0.1
)
pause
