@echo off
REM Version simplifiee : zone fixe (utilise le venv de translate)
cd /d "%~dp0"
set "VENV_SCRIPT=%~dp0..\..\translate\venv\Scripts\activate.bat"
if exist "%VENV_SCRIPT%" call "%VENV_SCRIPT%"
if not defined PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python
echo Lancement test simple (zone fixe). Appuyez sur Echap pour quitter.
python simple_test.py
pause
