@echo off
REM Starts AuthenTech at http://localhost:8000
REM Uses %AUTHENTECH_PY% if set, else .venv in this folder, else "python" on the PATH.
set PYTHONPATH=
cd /d "%~dp0backend"
if defined AUTHENTECH_PY (
  set "PY=%AUTHENTECH_PY%"
) else if exist "%~dp0.venv\Scripts\python.exe" (
  set "PY=%~dp0.venv\Scripts\python.exe"
) else (
  set "PY=python"
)
"%PY%" -m uvicorn main:app --port 8000
