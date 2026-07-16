@echo off
rem Double-click launcher for Crammer (Windows).
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
    echo First-time setup: creating Python environment...
    python -m venv .venv || goto :fail
    .venv\Scripts\python.exe -m pip install -e . || goto :fail
)

.venv\Scripts\python.exe -m reviewer
pause
exit /b

:fail
echo.
echo Setup failed. Make sure Python 3.11+ is installed and on PATH.
pause
