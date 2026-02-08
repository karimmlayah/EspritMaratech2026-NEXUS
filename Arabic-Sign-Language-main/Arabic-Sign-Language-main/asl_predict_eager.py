"""
Prédiction ASL en mode eager uniquement (appelé en subprocess par predict_image.py).
Usage: python asl_predict_eager.py <chemin_image_crop>
Pas de disable_v2_behavior pour que model.predict() fonctionne.
"""
import os
import sys
import warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
warnings.filterwarnings('ignore', category=DeprecationWarning, module='tensorflow')

import cv2
import numpy as np
import tensorflow as tf

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

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: asl_predict_eager.py <image_path> [machine]")
        sys.exit(1)
    crop_path = sys.argv[1]
    machine = len(sys.argv) > 2 and sys.argv[2] == 'machine'
    if not os.path.isfile(crop_path):
        if machine:
            print("0.0\t")
        else:
            print("Fichier introuvable:", crop_path)
        sys.exit(1)
    img = cv2.cvtColor(cv2.imread(crop_path), cv2.COLOR_BGR2RGB)
    if img is None:
        if machine:
            print("0.0\t")
        else:
            print("Impossible de lire l'image.")
        sys.exit(1)
    model = _build_asl_model()
    script_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(script_dir, 'models', 'asl_model.h5')
    model.load_weights(model_path, by_name=True)
    x = process_image(img)
    proba = model.predict(x, verbose=0)[0]
    proba = np.asarray(proba)
    mx = int(np.argmax(proba))
    score_pct = float(proba[mx] * 100)
    nom_signe = CATEGORIES[mx][0]
    lettre_arabe = CATEGORIES[mx][1]
    if machine:
        print("%.2f\t%s" % (score_pct, lettre_arabe))
    else:
        print()
        print("  Nom du signe :", nom_signe)
        print("  Lettre arabe :", lettre_arabe)
        print("  Score        : {:.2f}%".format(score_pct))
        print()
