@echo off
setlocal

set TITLE=%~1
if "%TITLE%"=="" set TITLE=Test job

powershell -NoProfile -Command "Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/jobs' -ContentType 'application/json' -Body ('{""title"":""%TITLE%"",""description"":""from bat""}') | ConvertTo-Json -Depth 6"
