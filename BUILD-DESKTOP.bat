@echo off
chcp 65001 >nul
title OmniFly Pro - بناء تطبيق سطح المكتب

echo.
echo =======================================================
echo    OmniFly Pro - بناء وتجهيز تطبيق سطح المكتب (.exe)
echo =======================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [خطأ] Node.js غير مثبت على جهازك!
    echo يرجى تحميله وتثبيته من: https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0"
set "NODE_OPTIONS=--dns-result-order=ipv4first"

echo [1/3] جاري فحص وتجهيز الحزم والمكتبات المطلوبة (محلياً أولاً)...
call node scripts/safe-npm-install.mjs
if errorlevel 1 (
    echo [خطأ] فشل تثبيت الحزم والمكتبات.
    pause
    exit /b 1
)

echo.
echo [2/3] جاري بناء وتجميع واجهة وسيرفر النظام (Vite + Express)...
call npm run build
if errorlevel 1 (
    echo [خطأ] فشل بناء الواجهة والسيرفر.
    pause
    exit /b 1
)

echo.
echo [3/3] جاري تغليف تطبيق سطح المكتب وتضمين قاعدة بيانات SQLite المحلية (.exe)...
call npm run electron:package
if errorlevel 1 (
    echo [خطأ] فشل تغليف تطبيق سطح المكتب.
    pause
    exit /b 1
)

echo.
echo =======================================================
echo    تم بناء تطبيق سطح المكتب بنجاح تام!
echo    تجد التطبيق التنفيذي (.exe) جاهزاً للتشغيل داخل مجلد:
echo    dist-desktop\OmniFly_Pro-win32-x64\OmniFly_Pro.exe
echo =======================================================
echo.
pause
