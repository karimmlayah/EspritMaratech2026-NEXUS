"""
Processus de prédiction ASL en mode eager (appelé par ASL_detection_landmark.py).
Charge le modèle une fois, lit les chemins d'images depuis une queue, renvoie (score, lettre).
Ne pas importer depuis le script principal (TF graph mode).
"""
import os
import sys
import warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore', category=DeprecationWarning, module='tensorflow')

import cv2
import numpy as np
import tensorflow as tf  # eager par défaut

def _build_asl_model():
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

def process_image(img):
    img = cv2.flip(img, 1)
    h, w = img.shape[:2]
    # Meilleure qualite: INTER_CUBIC si agrandissement, INTER_AREA si reduction (moins pixelise)
    interp = cv2.INTER_CUBIC if (w < 64 or h < 64) else cv2.INTER_AREA
    img = cv2.resize(img, (64, 64), interpolation=interp)
    img = np.array(img, dtype=np.float32)
    img = np.reshape(img, (-1, 64, 64, 3))
    img = img.astype('float32') / 255.
    return img

CATEGORIES = [
    ["ain", 'ع'], ["al", "ال"], ["aleff", 'أ'], ["bb", 'ب'], ["dal", 'د'],
    ["dha", 'ط'], ["dhad", "ض"], ["fa", "ف"], ["gaaf", 'ج'], ["ghain", 'غ'],
    ["ha", 'ه'], ["haa", 'ه'], ["jeem", 'ج'], ["kaaf", 'ك'], ["la", 'لا'],
    ["laam", 'ل'], ["meem", 'م'], ["nun", "ن"], ["ra", 'ر'], ["saad", 'ص'],
    ["seen", 'س'], ["sheen", "ش"], ["ta", 'ت'], ["taa", 'ط'], ["thaa", "ث"],
    ["thal", "ذ"], ["toot", 'ت'], ["waw", 'و'], ["ya", "ى"], ["yaa", "ي"],
    ["zay", 'ز']
]

def run_predictor(input_q, output_q):
    """Boucle: lit chemin image depuis input_q, prédit, envoie (score, lettre) dans output_q.
    Envoyer None dans input_q pour arrêter."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'models', 'asl_model.h5')
    model = _build_asl_model()
    model.load_weights(model_path, by_name=True)
    while True:
        crop_path = input_q.get()
        if crop_path is None:
            break
        try:
            if not os.path.isfile(crop_path):
                output_q.put((0.0, ""))
                continue
            img = cv2.imread(crop_path)
            if img is None:
                output_q.put((0.0, ""))
                continue
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            x = process_image(img)
            proba = model.predict(x, verbose=0)[0]
            proba = np.asarray(proba)
            mx = int(np.argmax(proba))
            score = float(proba[mx] * 100)
            letter = CATEGORIES[mx][1]
            output_q.put((score, letter))
        except Exception:
            output_q.put((0.0, ""))
