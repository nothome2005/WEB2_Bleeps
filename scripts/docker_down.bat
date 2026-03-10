@echo off
setlocal

cd /d "%~dp0.."
echo Stopping Docker stack...
docker compose down
