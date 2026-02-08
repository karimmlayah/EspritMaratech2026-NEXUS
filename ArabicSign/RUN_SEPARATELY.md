# Run Arabic Sign app separately

The **Arabic Sign Language** web app (CNN classification) runs on its own server and does not depend on the main Voice-to-Sign translate app.

## Quick start (Windows)

1. **From repo root**, double-click or run:
   ```
   ArabicSign\run_arabic_sign.bat
   ```
   Or from a terminal:
   ```bat
   cd voice-to-sign\ArabicSign
   run_arabic_sign.bat
   ```

2. **Or run manually** from the ArabicSign project folder:
   ```bash
   cd ArabicSign\Arabic-Sign-Language-Image-Classification-With-CNN-main
   pip install -r requirements.txt
   python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
   ```

3. Open in browser: **http://localhost:8000**

## Requirements

- Python 3.8+
- Dependencies in `Arabic-Sign-Language-Image-Classification-With-CNN-main/requirements.txt` (TensorFlow, FastAPI, Uvicorn, OpenCV, Pillow, etc.)

### Si vous avez "No module named uvicorn" ou "No module named 'tensorflow'"

**Important :** Lancez `pip install -r requirements.txt` dans **votre propre terminal** (PowerShell/CMD). L’installation de TensorFlow (~330 MB) peut prendre plusieurs minutes ; un environnement limité (sandbox/timeout) peut l’interrompre.

Il faut installer **toutes** les dépendances du projet ArabicSign dans le venv actif. Dans le dossier du projet CNN-main, exécutez :

```bash
cd D:\voice-to-sign\ArabicSign\Arabic-Sign-Language-Image-Classification-With-CNN-main
pip install -r requirements.txt
```

(L’installation de TensorFlow peut prendre plusieurs minutes.) Puis relancez :

```bash
python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Si vous avez seulement "No module named uvicorn"

Le venv actif (ex: `translate\venv`) n’a peut‑être pas uvicorn. Deux options :

1. **Installer dans le venv actif** (dans le dossier ArabicSign CNN-main) :
   ```bash
   pip install uvicorn fastapi python-multipart jinja2
   ```
   ou tout le projet :
   ```bash
   pip install -r requirements.txt
   ```

2. **Utiliser un venv dédié** pour ArabicSign :
   ```bash
   cd ArabicSign\Arabic-Sign-Language-Image-Classification-With-CNN-main
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   python -m uvicorn app:app --reload --host 0.0.0.0 --port 8000
   ```

## Port

- Arabic Sign app: **8000**
- Main Voice-to-Sign translate app: **5000** (e.g. `python translate/server.py`)

You can run both at the same time on different ports.

## Model

The app looks for the model at:
`ArabicSign/Arabic-Sign-Language-Image-Classification-With-CNN-main/models/arabic_letters_model.h5`

To use another path, set:
```bash
set ARABIC_SIGN_MODEL=C:\path\to\arabic_letters_model.h5
```
then run uvicorn as above.
