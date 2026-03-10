@echo off
setlocal

powershell -NoProfile -Command "Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/jobs' | ConvertTo-Json -Depth 6"
