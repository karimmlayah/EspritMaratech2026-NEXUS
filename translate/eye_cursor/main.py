"""
Curseur piloté par les yeux (optionnel).
Utilise la webcam + MediaPipe Face Landmarker pour déplacer la souris et cliquer (en fermant les yeux).
À lancer seul : python main.py (depuis ce dossier) ou via l'API /api/eye-cursor/start.
Fermer : touche Q dans la fenêtre.
"""
import os
import sys
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)

# Télécharger le modèle Face Landmarker s'il n'existe pas (requis par MediaPipe 0.10+)
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
MODEL_PATH = os.path.join(SCRIPT_DIR, "face_landmarker.task")

if not os.path.exists(MODEL_PATH):
    print("Téléchargement du modèle Face Landmarker...")
    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("Modèle téléchargé.")
    except Exception as e:
        print("Erreur téléchargement:", e)
        sys.exit(1)

import cv2
import mediapipe as mp
import pyautogui

BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=VisionRunningMode.VIDEO,
    num_faces=1,
)
landmarker = FaceLandmarker.create_from_options(options)

cam = cv2.VideoCapture(0)
if not cam.isOpened():
    print("Impossible d'ouvrir la webcam.")
    sys.exit(1)

screen_w, screen_h = pyautogui.size()
frame_timestamp_ms = 0
window_name = "Curseur piloté par les yeux"

# Scroll smooth : proportionnel à la position du regard (haut = scroll up, bas = scroll down)
# Zone morte au centre (pas de scroll), puis proportionnel
SCROLL_DEAD_ZONE_TOP = 0.40    # en dessous de ça = regard en haut → scroll up
SCROLL_DEAD_ZONE_BOTTOM = 0.60 # au dessus de ça = regard en bas → scroll down
SCROLL_STRENGTH = 2.0          # intensité du scroll (plus = plus réactif)
smooth_scroll_y = 0.5          # lissage de la position pour scroll fluide (0-1)
SMOOTH_SCROLL_ALPHA = 0.25     # plus petit = plus smooth

while True:
    _, frame = cam.read()
    if frame is None:
        break
    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    frame_h, frame_w, _ = frame.shape

    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    result = landmarker.detect_for_video(mp_image, frame_timestamp_ms)
    frame_timestamp_ms += 33

    if result.face_landmarks:
        landmarks = result.face_landmarks[0]
        left_iris = landmarks[468]
        right_iris = landmarks[473]
        pupil_x = (left_iris.x + right_iris.x) / 2
        pupil_y = (left_iris.y + right_iris.y) / 2
        screen_x = screen_w * pupil_x
        screen_y = screen_h * pupil_y
        pyautogui.moveTo(screen_x, screen_y)
        for lm in (left_iris, right_iris):
            x = int(lm.x * frame_w)
            y = int(lm.y * frame_h)
            cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)
        left = [landmarks[145], landmarks[159]]
        for landmark in left:
            x = int(landmark.x * frame_w)
            y = int(landmark.y * frame_h)
            cv2.circle(frame, (x, y), 3, (0, 255, 255))
        left_closed = (left[0].y - left[1].y) < 0.004
        right = [landmarks[386], landmarks[374]]
        for landmark in right:
            x = int(landmark.x * frame_w)
            y = int(landmark.y * frame_h)
            cv2.circle(frame, (x, y), 3, (0, 255, 255))
        right_closed = (right[0].y - right[1].y) < 0.004
        if left_closed and right_closed:
            pyautogui.click()
            pyautogui.sleep(1)

        # Scroll smooth : plus le regard est en haut, plus on scroll up ; en bas = scroll down
        smooth_scroll_y = SMOOTH_SCROLL_ALPHA * smooth_scroll_y + (1 - SMOOTH_SCROLL_ALPHA) * pupil_y
        if smooth_scroll_y < SCROLL_DEAD_ZONE_TOP:
            # Regard en haut : scroll up, proportionnel (plus c'est haut, plus on scroll)
            force = (SCROLL_DEAD_ZONE_TOP - smooth_scroll_y) / SCROLL_DEAD_ZONE_TOP
            pyautogui.scroll(int(force * SCROLL_STRENGTH + 0.5))
        elif smooth_scroll_y > SCROLL_DEAD_ZONE_BOTTOM:
            # Regard en bas : scroll down, proportionnel
            force = (smooth_scroll_y - SCROLL_DEAD_ZONE_BOTTOM) / (1 - SCROLL_DEAD_ZONE_BOTTOM)
            pyautogui.scroll(-int(force * SCROLL_STRENGTH + 0.5))

    # Textes descriptifs dans la cam : Fermer, Clic, Scroll
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.5
    thickness = 1
    color = (220, 220, 220)
    lines = [
        "Fermer : touche Q",
        "Clic : fermer les deux yeux",
        "Scroll : regarder en haut ou en bas de l'écran",
    ]
    line_h = 22
    pad = 8
    max_w = 0
    for line in lines:
        (tw, th), _ = cv2.getTextSize(line, font, font_scale, thickness)
        max_w = max(max_w, tw)
    box_w = max_w + 2 * pad
    box_h = len(lines) * line_h + 2 * pad
    x_box = (frame_w - box_w) // 2
    y_box = frame_h - box_h - 10
    overlay = frame.copy()
    cv2.rectangle(overlay, (x_box, y_box), (x_box + box_w, y_box + box_h), (40, 40, 40), -1)
    cv2.addWeighted(overlay, 0.75, frame, 0.25, 0, frame)
    for i, line in enumerate(lines):
        y_text = y_box + pad + (i + 1) * line_h - 4
        cv2.putText(frame, line, (x_box + pad, y_text), font, font_scale, color, thickness, cv2.LINE_AA)

    cv2.imshow(window_name, frame)
    if cv2.waitKey(1) == ord("q"):
        break

cam.release()
cv2.destroyAllWindows()
