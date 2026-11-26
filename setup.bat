@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ================================================
echo   OmniFly Pro - نظام السفر والسياحة والمحاسبة
echo   إعداد وتجهيز البيئة للعمل المباشر
echo ================================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [خطأ] Node.js غير مثبت على جهازك!
    echo يرجى تحميله من: https://nodejs.org
    pause & exit /b 1
)
echo [OK] Node.js موجود ومتاح

set "NODE_OPTIONS=--dns-result-order=ipv4first"

echo.
echo [1/2] فحص وتثبيت التبعيات والحزم...
call node scripts/safe-npm-install.mjs
if errorlevel 1 (
    echo [تنبيه] حدث خطأ أثناء تثبيت الحزم عبر npm.
    pause & exit /b 1
)

echo.
echo [2/2] بناء التطبيق والسيرفر الموحد...
call npm run build
if errorlevel 1 (
    echo [تنبيه] تعذر إكمال عملية البناء المسبق، ولكن يمكنك التشغيل المباشر عبر start.bat.
)

echo.
echo ================================================
echo   اكتمل التجهيز بنجاح! يمكنك الآن تشغيل: start.bat
echo ================================================
pause
