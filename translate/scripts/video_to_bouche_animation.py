"""
Génère bouche_animation.json à partir de la vidéo du signe "bouche" (AVST).
- Si MediaPipe Pose (solutions) est disponible : extrait épaule/coude/poignet et
  produit une animation fidèle à la vidéo.
- Sinon : génère une animation procédurale (main vers la bouche puis retour)
  synchronisée avec la durée et le FPS de la vidéo.

Pour une animation exacte comme la vidéo, installez une version avec Pose :
  pip install "mediapipe==0.10.14"   (Python 3.11 recommandé)

Usage (depuis la racine du projet) :
  python translate/scripts/video_to_bouche_animation.py
  python translate/scripts/video_to_bouche_animation.py "chemin/vers/bouche.mp4"

Sortie : translate/data/bouche_animation.json
"""
import json
import math
import os
import sys

import cv2
import numpy as np

# Chemins
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DICT_AVST = os.path.join(
    ROOT,
    "DICTIONNAIRE MÉDICAL EN LANGUE DES SIGNES TUNISIENNE _AVST_",
    "DICTIONNAIRE MÉDICAL EN LANGUE DES SIGNES TUNISIENNE _AVST_",
)
DEFAULT_VIDEO = os.path.join(DICT_AVST, "1.L'anatomie du corps humain", "bouche.mp4")
OUTPUT_JSON = os.path.join(ROOT, "translate", "data", "bouche_animation.json")

# MediaPipe Pose : indices (documentation MediaPipe)
# 11=left_shoulder, 12=right_shoulder, 13=left_elbow, 14=right_elbow, 15=left_wrist, 16=right_wrist
RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST = 12, 14, 16
LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST = 11, 13, 15

# Os canoniques attendus par l'app (ordre)
BONE_ORDER = ["RightArm", "LeftArm", "RightForeArm", "LeftForeArm", "RightHand", "LeftHand"]


def normalize(v):
    n = np.linalg.norm(v)
    if n < 1e-8:
        return np.array([0, 0, 1.0])
    return v / n


def quat_from_two_vectors(v_from, v_to):
    """Quaternion [x,y,z,w] qui fait tourner v_from vers v_to (coordonnées monde)."""
    v_from = normalize(np.asarray(v_from, dtype=float))
    v_to = normalize(np.asarray(v_to, dtype=float))
    dot = float(np.dot(v_from, v_to))
    if dot >= 1.0 - 1e-6:
        return [0.0, 0.0, 0.0, 1.0]
    if dot <= -1.0 + 1e-6:
        ax = np.array([1, 0, 0]) if abs(v_from[0]) < 0.9 else np.array([0, 1, 0])
        axis = normalize(np.cross(v_from, ax))
        return [float(axis[0]), float(axis[1]), float(axis[2]), 0.0]
    axis = np.cross(v_from, v_to)
    w = 1.0 + dot
    q = np.array([axis[0], axis[1], axis[2], w])
    q = q / np.linalg.norm(q)
    return [float(q[0]), float(q[1]), float(q[2]), float(q[3])]


def landmarks_to_quaternions(lm, side="right"):
    """
    À partir des landmarks Pose (épaule, coude, poignet), calcule des quaternions
    pour bras, avant-bras et main (approximation).
    lm: dict ou liste de {x, y, z} (coords normalisées MediaPipe : x droite, y bas, z profondeur)
    """
    if side == "right":
        i_shoulder, i_elbow, i_wrist = RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST
    else:
        i_shoulder, i_elbow, i_wrist = LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST

    def get(idx):
        if hasattr(lm, "__getitem__") and not isinstance(lm, dict):
            p = lm[idx]
            return np.array([p.x, p.y, p.z])
        return np.array([lm[idx]["x"], lm[idx]["y"], lm[idx]["z"]])

    try:
        shoulder = get(i_shoulder)
        elbow = get(i_elbow)
        wrist = get(i_wrist)
    except (KeyError, IndexError, AttributeError):
        return None

    # Directions (en convention image : Y vers le bas, X vers la droite)
    # Repos : bras le long du corps = vers le bas en Y
    rest_arm = np.array([0.0, 1.0, 0.0])
    rest_forearm = np.array([0.0, 1.0, 0.0])

    arm_dir = normalize(elbow - shoulder)
    forearm_dir = normalize(wrist - elbow)

    q_arm = quat_from_two_vectors(rest_arm, arm_dir)
    q_forearm = quat_from_two_vectors(rest_forearm, forearm_dir)
    q_hand = [0.0, 0.0, 0.0, 1.0]

    return {"arm": q_arm, "forearm": q_forearm, "hand": q_hand}


def _procedural_bouche_motion(num_frames, fps):
    """
    Génère une animation "bouche" procédurale (main vers la bouche puis retour)
    synchronisée avec la durée de la vidéo. Quaternions pour RightArm principalement.
    """
    duration = num_frames / fps
    times = [i / fps for i in range(num_frames)]
    rest = [0.0, 0.0, 0.0, 1.0]
    # Vers le visage: rotation bras (approximative)
    angle = 0.65
    qx = math.sin(angle / 2)
    qw = math.cos(angle / 2)
    toward_face = [qx, 0.0, 0.0, qw]
    # Avant-bras légère flexion
    angle2 = 0.4
    qf = [math.sin(angle2 / 2), 0.0, 0.0, math.cos(angle2 / 2)]

    def lerp_q(q0, q1, t):
        if t <= 0:
            return q0
        if t >= 1:
            return q1
        return [
            q0[i] + (q1[i] - q0[i]) * t for i in range(4)
        ]

    def slerp_q(q0, q1, t):
        if t <= 0:
            return q0[:]
        if t >= 1:
            return q1[:]
        dot = sum(a * b for a, b in zip(q0, q1))
        if dot < 0:
            q1 = [-x for x in q1]
            dot = -dot
        if dot > 0.9995:
            return lerp_q(q0, q1, t)
        theta = math.acos(min(1, dot))
        sin_theta = math.sin(theta)
        a = math.sin((1 - t) * theta) / sin_theta
        b = math.sin(t * theta) / sin_theta
        return [a * q0[i] + b * q1[i] for i in range(4)]

    quats_arm = []
    quats_forearm = []
    for i in range(num_frames):
        t = i / max(num_frames - 1, 1)
        phase = math.sin(t * math.pi)
        q_arm = slerp_q(rest, toward_face, phase)
        q_forearm = slerp_q(rest, qf, phase)
        quats_arm.append(q_arm)
        quats_forearm.append(q_forearm)

    return {
        "duration": duration,
        "fps": fps,
        "tracks": {
            "RightArm": {"times": times, "quaternions": quats_arm},
            "LeftArm": {"times": times, "quaternions": [rest] * num_frames},
            "RightForeArm": {"times": times, "quaternions": quats_forearm},
            "LeftForeArm": {"times": times, "quaternions": [rest] * num_frames},
            "RightHand": {"times": times, "quaternions": [rest] * num_frames},
            "LeftHand": {"times": times, "quaternions": [rest] * num_frames},
        },
    }


def run_mediapipe_pose_on_video(video_path, fps_target=30):
    """
    Lit la vidéo, exécute MediaPipe Pose sur chaque frame si disponible, sinon
    génère une animation procédurale synchronisée avec la durée de la vidéo.
    Retourne une liste de { "pose": [ 6 quaternions ] } ou directement le motion dict.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError("Vidéo introuvable: " + video_path)

    fps = max(cap.get(cv2.CAP_PROP_FPS) or 30, 1)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    pose_detector = None
    use_pose = False

    try:
        import mediapipe as mp
        if hasattr(mp, "solutions") and hasattr(mp.solutions, "pose"):
            pose_detector = mp.solutions.pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
            use_pose = True
    except Exception:
        pass

    if not use_pose or pose_detector is None:
        cap.release()
        print("MediaPipe Pose (solutions) non disponible: animation procédurale synchronisée à la vidéo.")
        return _procedural_bouche_motion(total_frames, fps), fps, True

    frames_out = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = pose_detector.process(image_rgb)

        pose_quats = []
        if results.pose_landmarks:
            lm = results.pose_landmarks.landmark
            for side in ("right", "left"):
                quats = landmarks_to_quaternions(lm, side=side)
                if quats:
                    pose_quats.append(quats["arm"])
                    pose_quats.append(quats["forearm"])
                    pose_quats.append(quats["hand"])
                else:
                    pose_quats.extend([[0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 1]])
        else:
            pose_quats = [[0, 0, 0, 1]] * 6

        if len(pose_quats) < 6:
            pose_quats.extend([[0, 0, 0, 1]] * (6 - len(pose_quats)))
        frames_out.append({"pose": pose_quats[:6]})

    cap.release()
    if pose_detector:
        pose_detector.close()

    return frames_out, fps, False


def build_motion_json(frames, fps):
    """Construit le JSON attendu par l'app : duration, fps, tracks (RightArm, etc.)."""
    n = len(frames)
    if n == 0:
        return {"duration": 0, "fps": fps, "tracks": {}}

    duration = n / fps
    times = [i / fps for i in range(n)]
    tracks = {}
    for bi, bone_name in enumerate(BONE_ORDER):
        quats = []
        for f in frames:
            pose = f.get("pose") or []
            if bi < len(pose):
                q = pose[bi]
                if len(q) >= 4:
                    quats.append([float(q[0]), float(q[1]), float(q[2]), float(q[3])])
                else:
                    quats.append([0, 0, 0, 1])
            else:
                quats.append([0, 0, 0, 1])
        tracks[bone_name] = {"times": times, "quaternions": quats}

    return {"duration": duration, "fps": fps, "tracks": tracks}


def main():
    video_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_VIDEO
    if not os.path.isfile(video_path):
        print("Vidéo introuvable:", video_path)
        print("Usage: python video_to_bouche_animation.py [chemin/bouche.mp4]")
        sys.exit(1)

    print("Vidéo:", video_path)
    print("Extraction des poses (MediaPipe Pose)...")
    result = run_mediapipe_pose_on_video(video_path)
    def round_motion(m):
        m["duration"] = round(m["duration"], 3)
        m["fps"] = round(m["fps"], 2)
        for name, track in m.get("tracks", {}).items():
            track["times"] = [round(t, 4) for t in track["times"]]
            track["quaternions"] = [[round(x, 5) for x in q] for q in track["quaternions"]]
        return m

    if result[2]:
        motion, fps, _ = result
        print("Animation procédurale (durée vidéo):", motion["duration"], "s, FPS:", fps)
    else:
        frames, fps = result[0], result[1]
        print("Frames extraites:", len(frames), "FPS:", fps)
        motion = build_motion_json(frames, fps)

    motion = round_motion(motion)
    os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(motion, f, indent=2)

    print("Écrit:", OUTPUT_JSON)
    print("Duration:", motion["duration"], "s, Tracks:", list(motion["tracks"].keys()))


if __name__ == "__main__":
    main()
