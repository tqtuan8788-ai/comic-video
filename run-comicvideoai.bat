@echo off
setlocal
cd /d "%~dp0"

set "APP_URL=http://localhost:3000"
set "PORT=3000"

echo ========================================
echo  ComicVideoAI - one click launcher
echo ========================================
echo.

if not exist node_modules (
  echo [1/3] node_modules not found. Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Dependencies already installed.
)

echo [2/3] Checking dev server on port %PORT%...
netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if errorlevel 1 (
  echo Starting Vite dev server on %APP_URL% ...
  start "ComicVideoAI Dev Server" /D "%~dp0" cmd /k "npm run dev -- --host 127.0.0.1 --port %PORT%"
  timeout /t 4 /nobreak >nul
) else (
  echo Dev server already appears to be running. Reusing it.
)

echo [3/3] Opening Chrome...
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%APP_URL%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%APP_URL%"
) else (
  echo Chrome not found in default location. Opening with default browser instead.
  start "" "%APP_URL%"
)

echo.
echo Done. Close the "ComicVideoAI Dev Server" window to stop the app.
endlocal
