@echo off
chcp 65001 >nul
title Khởi chạy Võ Lâm Idle
echo ========================================================
echo          Đang khởi động Võ Lâm Idle Web Game...
echo ========================================================
echo.

set TARGET_DIR=%~dp0

where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [OK] Đang khởi chạy Local Web Server trên cổng 8888...
    start "" http://localhost:8888/index.html
    cd /d "%TARGET_DIR%"
    python -m http.server 8888
) else (
    where npx >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo [OK] Đang khởi chạy Local Web Server trên cổng 8888...
        cd /d "%TARGET_DIR%"
        npx --yes http-server -p 8888 -o /index.html
    ) else (
        echo [INFO] Mở trực tiếp trên trình duyệt web mặc định...
        start "" "%TARGET_DIR%\index.html"
    )
)
pause
