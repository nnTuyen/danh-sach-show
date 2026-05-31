@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open_show_site.ps1"
if errorlevel 1 (
  echo.
  echo Khong mo duoc trang. Hay kiem tra Python hoac port 8000.
  pause
)
