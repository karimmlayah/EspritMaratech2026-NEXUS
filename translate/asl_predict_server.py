"""
Prédiction ASL (lettres arabes) pour le site translate.
Utilise le modèle ArabicSign: asl_model.h5
  - Préprocessing: image en niveaux de gris 64x64, puis 3 canaux pour le modèle, normalisation /255
  - 32 classes (labels identiques à app.py ArabicSign), softmax pour les confidences
"""
import os
import io
import warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore', category=DeprecationWarning, module='tensorflow')

import numpy as np
import tensorflow as tf
from PIL import Image

# Chemin vers le modèle ASL (dossier ArabicSign, comme app.py)
def _asl_model_path():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(root, "ArabicSign", "Arabic-Sign-Language-Image-Classification-With-CNN-main", "models", "asl_model.h5")

# 32 classes, même ordre que ArabicSign app.py
LABELS = [
    'ain', 'al', 'aleff', 'bb', 'dal', 'dha', 'dhad', 'fa', 'gaaf', 'ghain',
    'ha', 'haa', 'jeem', 'kaaf', 'la', 'laam', 'meem', 'nun', 'ra', 'saad',
    'seen', 'sheen', 'ta', 'taa', 'thaa', 'thal', 'toot', 'waw', 'ya', 'yaa', 'zay', 'unknown'
]

# Mapping label anglais -> lettre arabe (pour affichage)
LABEL_TO_AR = {
    'ain': 'ع', 'al': 'ال', 'aleff': 'أ', 'bb': 'ب', 'dal': 'د',
    'dha': 'ط', 'dhad': 'ض', 'fa': 'ف', 'gaaf': 'ج', 'ghain': 'غ',
    'ha': 'ه', 'haa': 'ه', 'jeem': 'ج', 'kaaf': 'ك', 'la': 'لا',
    'laam': 'ل', 'meem': 'م', 'nun': 'ن', 'ra': 'ر', 'saad': 'ص',
    'seen': 'س', 'sheen': 'ش', 'ta': 'ت', 'taa': 'ط', 'thaa': 'ث',
    'thal': 'ذ', 'toot': 'ت', 'waw': 'و', 'ya': 'ى', 'yaa': 'ي',
    'zay': 'ز', 'unknown': ''
}

def _build_asl_model():
    """Architecture asl_model.h5 (64x64 RGB, 32 classes) - identique à ArabicSign app.py"""
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(64, 64, 3)),
        tf.keras.layers.Conv2D(32, (3, 3), activation='relu', name='conv2d_6'),
        tf.keras.layers.MaxPooling2D((2, 2), name='max_pooling2d_4'),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu', name='conv2d_7'),
        tf.keras.layers.MaxPooling2D((2, 2), name='max_pooling2d_5'),
        tf.keras.layers.Conv2D(64, (3, 3), activation='relu', name='conv2d_8'),
        tf.keras.layers.Flatten(name='flatten_2'),
        tf.keras.layers.Dense(64, activation='relu', name='dense_4'),
        tf.keras.layers.Dense(32, activation='softmax', name='dense_5'),
    ])
    return model

_model = None

def get_model():
    global _model
    if _model is None:
        path = _asl_model_path()
        if not os.path.isfile(path):
            raise FileNotFoundError("Modèle ASL introuvable: %s" % path)
        try:
            _model = tf.keras.models.load_model(path, compile=False)
        except Exception:
            _model = _build_asl_model()
            _model.load_weights(path, by_name=True)
    return _model

def process_image(img_rgb):
    """
    Préprocessing pour asl_model.h5: image en niveaux de gris 64x64.
    - Entrée: numpy (H, W, 3) RGB
    - Sortie: batch (1, 64, 64, 3) float32 [0,1] (gris dupliqué sur 3 canaux)
    """
    pil = Image.fromarray(img_rgb.astype(np.uint8)).convert('L')  # grayscale
    pil = pil.resize((64, 64))
    gray = np.array(pil, dtype=np.float32) / 255.0  # (64, 64)
    # Modèle attend (64, 64, 3) : dupliquer le canal gris
    img_array = np.stack([gray, gray, gray], axis=-1)
    return np.expand_dims(img_array, axis=0)

def predict_from_image_rgb(img_rgb):
    """
    img_rgb: numpy (H, W, 3) RGB.
    Returns: (letter_ar, letter_en, score 0-100, top_predictions)
    top_predictions: list of {"label": str, "confidence": 0.0-1.0}
    Comme ArabicSign: on applique softmax pour les confidences affichées.
    """
    try:
        model = get_model()
        x = process_image(img_rgb)
        predictions = model.predict(x, verbose=0)
        # Appliquer softmax comme ArabicSign app.py
        softmax_proba = tf.nn.softmax(predictions, axis=1).numpy()[0]
        predicted_class = int(np.argmax(softmax_proba))
        confidence = float(softmax_proba[predicted_class])
        letter_en = LABELS[predicted_class]
        letter_ar = LABEL_TO_AR.get(letter_en, '')
        score = round(confidence * 100.0, 2)
        top_indices = np.argsort(softmax_proba)[-4:][::-1]
        top_predictions = [
            {"label": LABELS[i], "confidence": float(softmax_proba[i])}
            for i in top_indices
        ]
        return (letter_ar, letter_en, score, top_predictions)
    except Exception:
        return (None, None, 0.0, [])
