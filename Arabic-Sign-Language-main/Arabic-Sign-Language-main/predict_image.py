"""
Prédiction du signe (lettre arabe) et score à partir d'une image.
Usage: python predict_image.py <chemin_image>
       python predict_image.py  (utilise l'image par défaut si présente)
"""
import os
import sys
import argparse
import tempfile
import subprocess
import warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
warnings.filterwarnings('ignore', category=DeprecationWarning, module='tensorflow')
warnings.filterwarnings('ignore', message='.*input_shape.*input_dim.*')

import cv2
import numpy as np
import tensorflow.compat.v1 as tf
tf.compat.v1.disable_v2_behavior()

from utils import detector_utils

def main():
    parser = argparse.ArgumentParser(description='Prédire le signe ASL depuis une image')
    parser.add_argument('image', nargs='?', default=None,
                        help='Chemin vers l\'image (ex: assets/photo.png ou chemin absolu)')
    args = parser.parse_args()

    # Image par défaut (si pas d'argument)
    default_paths = [
        r'C:\Users\Mega-PC\Pictures\Camera Roll\WIN_20260208_04_51_04_Pro.jpg',
        os.path.join(os.path.dirname(__file__), '..', '..', 'assets',
                     'c__Users_Mega-PC_AppData_Roaming_Cursor_User_workspaceStorage_e99c4be07e275c5efbb9747e8f3bc8ce_images_WIN_20260208_04_51_04_Pro-c7f165a4-b44a-47ee-82b1-5b77624684c5.png'),
        'image.png', 'photo.png',
    ]
    image_path = args.image
    if not image_path:
        for p in default_paths:
            if os.path.isfile(p):
                image_path = p
                break
        if not image_path:
            print("Usage: python predict_image.py <chemin_image>")
            print("Exemple: python predict_image.py ..\\..\\assets\\ma_photo.png")
            sys.exit(1)

    if not os.path.isfile(image_path):
        print("Fichier introuvable:", image_path)
        print("  -> Verifiez le chemin ou copiez l'image dans le projet (ex: D:\\voice-to-sign\\mon_image.png)")
        sys.exit(1)

    print("Chargement image:", image_path)
    frame = cv2.imread(image_path)
    if frame is None:
        print("Impossible de lire l'image.")
        sys.exit(1)
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    im_height, im_width = frame.shape[:2]

    # Détection main
    print("Chargement modèle de détection main...")
    detection_graph, hand_sess = detector_utils.load_inference_graph()
    hand_sess = tf.Session(graph=detection_graph)
    boxes, scores = detector_utils.detect_objects(frame, detection_graph, hand_sess)
    num_hands_detect = min(1, len([s for s in scores if s > 0.18]))
    if num_hands_detect == 0:
        num_hands_detect = 1  # tenter quand même la première boîte
    res = detector_utils.get_box_image(
        num_hands_detect, 0.18, scores, boxes, im_width, im_height, frame)
    hand_sess.close()

    if res is None or res.size == 0:
        print("Aucune main détectée - utilisation de l'image entière (redimensionnée).")
        res = cv2.resize(frame, (64, 64))

    # Prédiction ASL dans un subprocess en mode eager (évite erreur Dataset en mode graphe)
    print("Chargement modèle ASL (lettres)...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    eager_script = os.path.join(script_dir, 'asl_predict_eager.py')
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as f:
        crop_path = f.name
    try:
        cv2.imwrite(crop_path, cv2.cvtColor(res, cv2.COLOR_RGB2BGR))
        subprocess.run(
            [sys.executable, eager_script, crop_path],
            cwd=script_dir,
            check=True
        )
    finally:
        try:
            os.unlink(crop_path)
        except Exception:
            pass

if __name__ == '__main__':
    main()
