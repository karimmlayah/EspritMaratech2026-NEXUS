"""
Détection des mains côté serveur (MediaPipe Hands).
Utilisé par /api/detect_hands pour afficher le graphe mains/doigts en temps réel
sans dépendre du chargement MediaPipe dans le navigateur.
"""
import base64
import numpy as np

_hands = None


def _get_hands():
    global _hands
    if _hands is not None:
        return _hands
    try:
        import cv2
        import mediapipe as mp
    except ImportError as e:
        raise RuntimeError("mediapipe et opencv requis: pip install mediapipe opencv-python-headless") from e
    _hands = mp.solutions.hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    return _hands


def detect_hands_from_frame_b64(frame_b64):
    """
    frame_b64: image JPEG en base64 (ou data URL avec préfixe enlevé).
    Retourne: { "hands": [ { "bbox": [x_min, y_min, x_max, y_max] (0-1), "landmarks": [ {"x","y","z"}, ... ] }, ... ] }
    """
    try:
        import cv2
    except ImportError:
        raise RuntimeError("opencv-python-headless requis")
    if isinstance(frame_b64, str) and frame_b64.startswith("data:"):
        frame_b64 = frame_b64.split(",", 1)[-1]
    raw = base64.b64decode(frame_b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return {"hands": []}
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    return detect_hands_from_image(img_rgb)


def detect_hands_from_image(img_rgb):
    """img_rgb: numpy (H, W, 3) RGB. Retourne { hands: [ { bbox, landmarks }, ... ] }."""
    hands_obj = _get_hands()
    h, w = img_rgb.shape[:2]
    results = hands_obj.process(img_rgb)
    out_hands = []
    if not results.multi_hand_landmarks:
        return {"hands": []}
    for hand_landmarks in results.multi_hand_landmarks:
        points = []
        min_x, min_y = 1.0, 1.0
        max_x, max_y = 0.0, 0.0
        for lm in hand_landmarks.landmark:
            x = lm.x
            y = lm.y
            z = lm.z
            points.append({"x": x, "y": y, "z": z})
            if x < min_x:
                min_x = x
            if x > max_x:
                max_x = x
            if y < min_y:
                min_y = y
            if y > max_y:
                max_y = y
        bbox = [min_x, min_y, max_x, max_y]
        out_hands.append({"bbox": bbox, "landmarks": points})
    return {"hands": out_hands}
