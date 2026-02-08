@echo off
REM Sign-to-Text - Reconnaissance de la langue des signes arabe en direct
REM Utilise le venv du projet translate (meme environnement que voice-to-sign)

cd /d "%~dp0"

REM Activer le venv de translate
set "VENV_SCRIPT=%~dp0..\..\translate\venv\Scripts\activate.bat"
if exist "%VENV_SCRIPT%" (call "%VENV_SCRIPT%") else (echo ATTENTION: venv translate non trouve - utilise Python systeme.)

REM Evite l'erreur protobuf "Descriptors cannot be created directly" si protobuf >= 4
if not defined PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python
REM Reduire les logs TensorFlow (0=tout, 2=erreurs seules)
if not defined TF_CPP_MIN_LOG_LEVEL set TF_CPP_MIN_LOG_LEVEL=3
if not defined TF_ENABLE_ONEDNN_OPTS set TF_ENABLE_ONEDNN_OPTS=0

echo Verification des fichiers...
if not exist "models\asl_model.h5" (
    echo ERREUR: models\asl_model.h5 introuvable.
    pause
    exit /b 1
)
if not exist "models\frozen_inference_graph.pb" (
    echo ERREUR: models\frozen_inference_graph.pb introuvable.
    pause
    exit /b 1
)
if not exist "landmarks\shape_predictor_68_face_landmarks.dat" (
    echo ATTENTION: landmarks\shape_predictor_68_face_landmarks.dat absent - telechargez-le si les landmarks visage ne marchent pas.
)

echo Lancement Sign-to-Text (webcam)...
echo Appuyez sur 'q' dans la fenetre pour quitter.
python ASL_detection_landmark.py -src 0 -nhands 1 --display 1 -fps 1

pause
