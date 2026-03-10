@echo off
setlocal

if "%~1"=="" (
  echo Usage: api_get_job.bat JOB_ID
  exit /b 1
)

set ID=%~1
powershell -NoProfile -Command "Invoke-RestMethod -Method Get -Uri ('http://localhost:3000/jobs/%ID%') | ConvertTo-Json -Depth 6"
