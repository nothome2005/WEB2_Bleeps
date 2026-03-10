@echo off
setlocal

cd /d "%~dp0.."
echo Starting Docker stack...
docker compose up --build -d
