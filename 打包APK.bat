@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "GradleFile=%~dp0android\app\build.gradle"
set "CurrentVersionName="
set "CurrentVersionCode="

if exist "%GradleFile%" (
  for /f "tokens=1,2" %%A in ('findstr /R /C:"^[ ]*versionCode[ ]*[0-9][0-9]*" "%GradleFile%"') do (
    if /I "%%A"=="versionCode" set "CurrentVersionCode=%%B"
  )
  for /f "tokens=1,2" %%A in ('findstr /C:"versionName" "%GradleFile%"') do (
    if /I "%%A"=="versionName" set "CurrentVersionName=%%~B"
  )
)

echo.
echo Current settings:
echo   Version Name: %CurrentVersionName%
echo   Version Code: %CurrentVersionCode%
echo.

set /p "VersionName=Enter Version Name, or press Enter to keep current [%CurrentVersionName%]: "
set /p "VersionCode=Enter Version Code, or press Enter to keep current [%CurrentVersionCode%]: "

if "%VersionName%"=="" set "VersionName=%CurrentVersionName%"
if "%VersionCode%"=="" set "VersionCode=%CurrentVersionCode%"

echo.
echo Starting Android release build: Name=%VersionName% Code=%VersionCode%
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\build-release.ps1" -VersionName "%VersionName%" -VersionCode "%VersionCode%"
echo Build process finished.

if exist "%~dp0builds" start "" "%~dp0builds"

pause
