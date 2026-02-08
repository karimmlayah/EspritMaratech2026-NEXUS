@echo off
REM Version simplifiee : zone fixe 150,150 -> 400,400 (pas de detection main)
cd /d "%~dp0"
if not defined PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION set PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python
echo Lancement test simple (zone fixe). Appuyez sur Echap pour quitter.
python simple_test.py
pause
