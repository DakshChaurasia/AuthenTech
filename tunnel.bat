@echo off
REM Starts a Cloudflare quick tunnel to the local backend and updates frontend\config.js with its address.
REM The backend (run.bat) must already be running. See docs\DEPLOY.md.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tunnel.ps1" %*
pause
