@echo off
chcp 65001 >nul
title Khởi động Hẹn Hò Hub (Local)
echo ===================================================
echo   Đang khởi động Hẹn Hò Hub trên máy tính...
echo ===================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0chay_web.ps1"
if errorlevel 1 (
  echo.
  echo [LỖI] Không thể tự động mở trang web.
  echo Bạn có thể mở PowerShell trong thư mục này và chạy:
  echo   python -m http.server 8000
  echo Sau đó mở trình duyệt vào http://127.0.0.1:8000
  echo.
  pause
)
