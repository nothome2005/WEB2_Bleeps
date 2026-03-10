@echo off
setlocal

if "%~2"=="" (
  echo Usage: api_set_status.bat JOB_ID STATUS [RESULT] [ERROR]
  echo Example: api_set_status.bat 1 QUEUED
  echo Example: api_set_status.bat 1 DONE ok
  echo Example: api_set_status.bat 1 ERROR "" "something failed"
  exit /b 1
)

set ID=%~1
set STATUS=%~2
set RESULT=%~3
set ERR=%~4

if "%RESULT%"=="" set RESULT=null
if not "%RESULT%"=="null" set RESULT="%RESULT%"

if "%ERR%"=="" set ERR=null
if not "%ERR%"=="null" set ERR="%ERR%"

powershell -NoProfile -Command "Invoke-RestMethod -Method Patch -Uri ('http://localhost:3000/jobs/%ID%/status') -ContentType 'application/json' -Body ('{""status"":""%STATUS%"",""result"":' + '%RESULT%' + ',""error"":' + '%ERR%' + '}') | ConvertTo-Json -Depth 6"
