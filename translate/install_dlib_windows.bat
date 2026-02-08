@echo off
REM Installe dlib sous Windows sans Visual Studio (wheel precompilee).
REM Source: https://github.com/eddiehe99/dlib-whl

cd /d "%~dp0"
if exist "venv\Scripts\activate.bat" call venv\Scripts\activate.bat

echo Installation de dlib via wheel precompilee pour votre version de Python...
python "%~dp0install_dlib_windows.py"

pause
