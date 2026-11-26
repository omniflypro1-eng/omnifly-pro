@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0"
if not exist "node.exe" (
  echo Extract the complete ZIP before starting the application.
  pause
  popd
  exit /b 1
)
"node.exe" "launcher.mjs"
set "whatsappExit=%errorlevel%"
popd
if not "%whatsappExit%"=="0" pause
exit /b %whatsappExit%
