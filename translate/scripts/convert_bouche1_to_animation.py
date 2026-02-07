"""
Convertit translate/data/bouche (1).json (MediaPipe Pose: frames avec pose_landmarks)
vers translate/data/bouche_animation.json pour l'animation "bouche".

Format entrée: { "metadata": { "fps", "duration_seconds" }, "frames": [ { "timestamp", "pose_landmarks": [ [x,y,z,vis], ... ] } ] }
MediaPipe Pose: 33 landmarks, indices 11=left_shoulder, 12=right_shoulder, 13=left_elbow, 14=right_elbow, 15=left_wrist, 16=right_wrist.

Usage (depuis la racine du projet):
  python translate/scripts/convert_bouche1_to_animation.py
"""
import json
import math
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSLATE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(TRANSLATE_DIR, "data")
INPUT_PATH = os.path.join(DATA_DIR, "bouche (1).json")
OUTPUT_PATH = os.path.join(DATA_DIR, "bouche_animation.json")

RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST = 12, 14, 16
LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST = 11, 13, 15
CANONICAL_ORDER = ["RightArm", "LeftArm", "RightForeArm", "LeftForeArm", "RightHand", "LeftHand"]
IDENTITY_QUAT = [0.0, 0.0, 0.0, 1.0]


def normalize(v):
    n = (v[0]**2 + v[1]**2 + v[2]**2) ** 0.5
    if n < 1e-8:
        return [0.0, 0.0, 1.0]
    return [v[0]/n, v[1]/n, v[2]/n]


def quat_from_two_vectors(v_from, v_to):
    v_from = normalize(v_from)
    v_to = normalize(v_to)
    dot = v_from[0]*v_to[0] + v_from[1]*v_to[1] + v_from[2]*v_to[2]
    if dot >= 1.0 - 1e-6:
        return IDENTITY_QUAT[:]
    if dot <= -1.0 + 1e-6:
        ax = [1, 0, 0] if abs(v_from[0]) < 0.9 else [0, 1, 0]
        axis = [
            v_from[1]*ax[2] - v_from[2]*ax[1],
            v_from[2]*ax[0] - v_from[0]*ax[2],
            v_from[0]*ax[1] - v_from[1]*ax[0],
        ]
        n = (axis[0]**2 + axis[1]**2 + axis[2]**2) ** 0.5
        if n < 1e-8:
            return IDENTITY_QUAT[:]
        return [axis[0]/n, axis[1]/n, axis[2]/n, 0.0]
    axis = [
        v_from[1]*v_to[2] - v_from[2]*v_to[1],
        v_from[2]*v_to[0] - v_from[0]*v_to[2],
        v_from[0]*v_to[1] - v_from[1]*v_to[0],
    ]
    w = 1.0 + dot
    n = (axis[0]**2 + axis[1]**2 + axis[2]**2 + w**2) ** 0.5
    return [axis[0]/n, axis[1]/n, axis[2]/n, w/n]


def landmarks_to_quats(pose_landmarks, side="right"):
    if side == "right":
        i_sh, i_el, i_wr = RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST
    else:
        i_sh, i_el, i_wr = LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST
    if len(pose_landmarks) <= max(i_sh, i_el, i_wr):
        return None
    def pt(i):
        p = pose_landmarks[i]
        return [float(p[0]), float(p[1]), float(p[2])]
    shoulder = pt(i_sh)
    elbow = pt(i_el)
    wrist = pt(i_wr)
    rest = [0.0, 1.0, 0.0]
    arm_dir = [elbow[j] - shoulder[j] for j in range(3)]
    forearm_dir = [wrist[j] - elbow[j] for j in range(3)]
    q_arm = quat_from_two_vectors(rest, arm_dir)
    q_forearm = quat_from_two_vectors(rest, forearm_dir)
    return {"arm": q_arm, "forearm": q_forearm}


def convert(data):
    frames = data.get("frames") or []
    if not frames:
        return {"duration": 0, "fps": 30, "tracks": {}}

    meta = data.get("metadata") or {}
    fps = float(meta.get("fps") or 30)
    duration = float(meta.get("duration_seconds") or (len(frames) / fps))

    times = []
    quats = {name: [] for name in CANONICAL_ORDER}

    for f in frames:
        t = float(f.get("timestamp", len(times) / fps))
        times.append(t)
        pl = f.get("pose_landmarks") or []

        for side, arm_name, forearm_name, hand_name in [
            ("right", "RightArm", "RightForeArm", "RightHand"),
            ("left", "LeftArm", "LeftForeArm", "LeftHand"),
        ]:
            qs = landmarks_to_quats(pl, side=side)
            if qs:
                quats[arm_name].append(qs["arm"])
                quats[forearm_name].append(qs["forearm"])
            else:
                quats[arm_name].append(IDENTITY_QUAT[:])
                quats[forearm_name].append(IDENTITY_QUAT[:])
            quats[hand_name].append(IDENTITY_QUAT[:])

    n = len(times)
    motion = {
        "duration": round(duration, 3),
        "fps": round(fps, 2),
        "tracks": {},
    }
    for name in CANONICAL_ORDER:
        motion["tracks"][name] = {
            "times": [round(t, 4) for t in times],
            "quaternions": [[round(x, 5) for x in q] for q in quats[name][:n]],
        }
    return motion


def main():
    if not os.path.isfile(INPUT_PATH):
        print("Fichier introuvable:", INPUT_PATH)
        return 1

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    motion = convert(data)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(motion, f, indent=2)

    print("Écrit:", OUTPUT_PATH)
    print("Source: bouche (1).json (MediaPipe Pose)")
    print("Duration:", motion["duration"], "s, FPS:", motion["fps"])
    print("Tracks:", list(motion["tracks"].keys()))
    return 0


if __name__ == "__main__":
    exit(main())
