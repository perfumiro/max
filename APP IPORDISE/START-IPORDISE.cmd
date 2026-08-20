@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8081' -TimeoutSec 2; if ($response.StatusCode -eq 200) { exit 0 } }; catch {}; exit 1"

if errorlevel 1 (
  start "IPORDISE SERVER - KEEP THIS WINDOW OPEN" /D "%~dp0" cmd.exe /k "set EXPO_OFFLINE=1&& npm.cmd run web -- --port 8081"
  timeout /t 7 /nobreak >nul
)

start "" "http://localhost:8081/"
endlocal
