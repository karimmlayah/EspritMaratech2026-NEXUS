@echo off
REM Run Arabic Sign Language web app separately (port 8000)
cd /d "%~dp0Arabic-Sign-Language-Image-Classification-With-CNN-main"
if not exist "models\arabic_letters_model.h5" (
    echo Error: models\arabic_letters_model.h5 not found.
    pause
    exit /b 1
)
REM Install dependencies if uvicorn or tensorflow is missing
python -c "import uvicorn" 2>nul || set NEED_DEPS=1
python -c "import tensorflow" 2>nul || set NEED_DEPS=1
if defined NEED_DEPS (
    echo Installing dependencies (TensorFlow, FastAPI, Uvicorn, etc.) - may take a few minutes...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo Install failed. Run manually: pip install -r requirements.txt
        pause
        exit /b 1
    )
)
echo Starting Arabic Sign app at http://localhost:8000
echo Press Ctrl+C to stop.
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
pause
