"""
Détection des landmarks main (MediaPipe) sur une vidéo de signe.
- Chemin vidéo en raw string (r"...") pour éviter SyntaxWarning avec \\D, \\L, etc.
- MediaPipe : sous Python 3.13 seul l'API Tasks est dispo (0.10.30+). Le script
  télécharge automatiquement hand_landmarker.task si besoin.
  Sinon : pip install "mediapipe==0.10.14" (Python 3.11) pour l'API solutions.
"""
import cv2
import numpy as np
import json
import math
import os

# Chemin vidéo : raw string pour éviter \D, \L etc. interprétés comme échappements
VIDEO_PATH = r"D:\voice-to-sign\DICTIONNAIRE MÉDICAL EN LANGUE DES SIGNES TUNISIENNE _AVST_\DICTIONNAIRE MÉDICAL EN LANGUE DES SIGNES TUNISIENNE _AVST_\8. Les outils de communications\médicament.mp4"

# MediaPipe : ancienne API (solutions) ou nouvelle (tasks)
hands = None
try:
    import mediapipe as mp
    if hasattr(mp, "solutions") and hasattr(mp.solutions, "hands"):
        mp_hands = mp.solutions.hands
        hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.5,
        )
        _mp_use_tasks_api = False
    else:
        # Nouvelle API MediaPipe Tasks (modèle .task requis)
        from mediapipe.tasks import python as mp_tasks_py
        from mediapipe.tasks.python import vision
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, "hand_landmarker.task")
        if not os.path.isfile(model_path):
            # Téléchargement automatique du modèle officiel
            _url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
            try:
                import urllib.request
                print("Téléchargement de hand_landmarker.task...")
                urllib.request.urlretrieve(_url, model_path)
                print("Modèle téléchargé:", model_path)
            except Exception as e:
                print("Échec du téléchargement:", e)
                print("Téléchargez manuellement depuis https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/index#models")
                hands = None
                _mp_use_tasks_api = False
        if hands is None and os.path.isfile(model_path):
            base_options = mp_tasks_py.BaseOptions(model_asset_path=model_path)
            options = vision.HandLandmarkerOptions(
                base_options=base_options,
                num_hands=1,
                min_hand_detection_confidence=0.5,
            )
            hands = vision.HandLandmarker.create_from_options(options)
            _mp_use_tasks_api = True
        elif hands is None:
            _mp_use_tasks_api = False
except (ImportError, AttributeError) as e:
    print("MediaPipe non disponible ou API différente:", e)
    print("Pour l'API 'solutions' (recommandé): pip install 'mediapipe==0.10.14'")
    print("Ou avec la nouvelle API: téléchargez hand_landmarker.task et placez-le dans ce dossier.")
    _mp_use_tasks_api = False

if hands is None:
    raise SystemExit("Impossible d'initialiser MediaPipe (mains). Vérifiez l'installation.")

cap = cv2.VideoCapture(VIDEO_PATH)
if not cap.isOpened():
    raise SystemExit("Impossible d'ouvrir la vidéo:", VIDEO_PATH)

frames_landmarks = []
frame_idx = 0
fps = max(cap.get(cv2.CAP_PROP_FPS) or 30, 1)

while True:
    ret, frame = cap.read()
    if not ret:
        break

    image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    if _mp_use_tasks_api:
        # Nouvelle API MediaPipe Tasks
        import mediapipe as mp
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
        timestamp_ms = int(1000 * frame_idx / fps)
        result = hands.detect_for_video(mp_image, timestamp_ms)
        if result.hand_landmarks:
            hand = result.hand_landmarks[0]
            landmarks = {}
            for i, lm in enumerate(hand):
                landmarks[i] = {"x": lm.x, "y": lm.y, "z": lm.z}
            frames_landmarks.append(landmarks)
    else:
        # Ancienne API solutions.hands
        result = hands.process(image_rgb)
        if result.multi_hand_landmarks:
            hand = result.multi_hand_landmarks[0]
            landmarks = {}
            for i, lm in enumerate(hand.landmark):
                landmarks[i] = {"x": lm.x, "y": lm.y, "z": lm.z}
            frames_landmarks.append(landmarks)

    frame_idx += 1

cap.release()
print("Frames avec mains détectées:", len(frames_landmarks))
def compute_rotation(p1, p2):
    dx = p2["x"] - p1["x"]
    dy = p2["y"] - p1["y"]
    dz = p2["z"] - p1["z"]

    rot_x = math.atan2(dy, dz)
    rot_y = math.atan2(dx, dz)
    rot_z = 0  # simplification

    return {
        "x": rot_x,
        "y": rot_y,
        "z": rot_z
    }
