@echo off
REM Predire le signe et le score a partir d'une image.
REM Usage: run_predict_image.bat [chemin_image]
REM Exemple: run_predict_image.bat "D:\voice-to-sign\assets\ma_photo.png"

setlocal
cd /d "%~dp0"

set "VENV=d:\voice-to-sign\translate\venv"
if exist "%VENV%\Scripts\activate.bat" (
    call "%VENV%\Scripts\activate.bat"
) else (
    echo Venv non trouve: %VENV%
    echo Lancement avec Python systeme...
)

set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python
if "%~1"=="" (
    python predict_image.py
) else (
    python predict_image.py "%~1"
)
pause
