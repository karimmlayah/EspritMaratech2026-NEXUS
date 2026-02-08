@echo off
chcp 65001 >nul
echo ========================================
echo Installation de Whisper (speech-to-text)
echo ========================================
echo.

echo [1/2] Installation de openai-whisper (même Python que le serveur)...
python -m pip install openai-whisper
if errorlevel 1 (
    echo.
    echo Erreur. Essayez: pip install openai-whisper
    pause
    exit /b 1
)
echo OK.
echo.

echo [2/2] Vérification de ffmpeg...
where ffmpeg >nul 2>&1
if errorlevel 1 (
    echo ffmpeg n'est pas dans le PATH.
    echo.
    echo Installez ffmpeg :
    echo   - Avec winget : winget install ffmpeg
    echo   - Ou téléchargez : https://ffmpeg.org/download.html
    echo   - Puis ajoutez le dossier de ffmpeg au PATH système.
    echo.
) else (
    echo ffmpeg trouvé.
)

echo.
echo Terminé. Redémarrez le serveur (python server.py) puis réessayez « Transcrire la vidéo ».
pause
