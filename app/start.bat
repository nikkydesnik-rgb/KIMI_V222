@echo off
setlocal

chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   EXECUTIVE DOCS APP
echo ========================================
echo Current folder: %CD%
echo.

if not exist package.json (
  echo ERROR: package.json not found.
  echo Run start.bat from the application folder.
  pause
  exit /b 1
)

echo [1/3] Installing dependencies (if needed)...
call npm install
if errorlevel 1 (
  echo ERROR: npm install failed.
  pause
  exit /b 1
)

echo [2/3] Building frontend...
call npm run build
if errorlevel 1 (
  echo ERROR: npm run build failed.
  pause
  exit /b 1
)

echo [3/3] Starting local DOCX render server...
start http://localhost:3456
python backend_render.py
if errorlevel 1 (
  py -3 backend_render.py
)

endlocal
