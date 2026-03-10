@echo off
setlocal

echo Creating job...
for /f %%i in ('powershell -NoProfile -Command "$job = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/jobs' -ContentType 'application/json' -Body '{\"title\":\"Demo full cycle\",\"description\":\"batch scenario\"}'; $job.id"') do set ID=%%i

if "%ID%"=="" (
  echo Failed to create job. Is backend running on localhost:3000?
  exit /b 1
)

echo Job ID: %ID%
echo CREATED -^> QUEUED
call "%~dp0api_set_status.bat" %ID% QUEUED
echo QUEUED -^> PROCESSING
call "%~dp0api_set_status.bat" %ID% PROCESSING
echo PROCESSING -^> DONE
call "%~dp0api_set_status.bat" %ID% DONE ok

echo.
echo Final job:
call "%~dp0api_get_job.bat" %ID%
