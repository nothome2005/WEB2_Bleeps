@echo off
setlocal

cd /d "%~dp0.."
echo Starting backend locally on http://localhost:3000
echo.
npm start
