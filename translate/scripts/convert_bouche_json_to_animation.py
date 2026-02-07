"""
Convertit translate/data/bouche.json (keyframes avec bones en Euler x,y,z)
vers translate/data/bouche_animation.json (format app: duration, fps, tracks avec quaternions).

Mapping des os bouche.json -> app:
  right_arm -> RightArm, left_arm -> LeftArm
  right_forearm -> RightForeArm, left_forearm -> LeftForeArm
  (RightHand, LeftHand = identité si absents)

Usage (depuis la racine du projet):
  python translate/scripts/convert_bouche_json_to_animation.py
"""
import json
import math
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRANSLATE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(TRANSLATE_DIR, "data")
INPUT_PATH = os.path.join(DATA_DIR, "bouche.json")
OUTPUT_PATH = os.path.join(DATA_DIR, "bouche_animation.json")

# Noms dans bouche.json -> noms attendus par l'app
BONE_MAP = {
    "right_arm": "RightArm",
    "left_arm": "LeftArm",
    "right_forearm": "RightForeArm",
    "left_forearm": "LeftForeArm",
}
CANONICAL_ORDER = ["RightArm", "LeftArm", "RightForeArm", "LeftForeArm", "RightHand", "LeftHand"]
IDENTITY_QUAT = [0.0, 0.0, 0.0, 1.0]


def euler_to_quaternion_xyz(x, y, z):
    """Euler angles (radians) XYZ -> quaternion [x, y, z, w]."""
    cx, sx = math.cos(x / 2), math.sin(x / 2)
    cy, sy = math.cos(y / 2), math.sin(y / 2)
    cz, sz = math.cos(z / 2), math.sin(z / 2)
    qw = cx * cy * cz + sx * sy * sz
    qx = sx * cy * cz - cx * sy * sz
    qy = cx * sy * cz + sx * cy * sz
    qz = cx * cy * sz - sx * sy * cz
    return [qx, qy, qz, qw]


def convert_bouche_to_motion(data):
    keyframes = data.get("keyframes") or []
    if not keyframes:
        return {"duration": 0, "fps": 30, "tracks": {}}

    fps = float(data.get("fps") or 30)
    duration = float(data.get("duration") or (len(keyframes) / fps))

    times = []
    quats_by_bone = {name: [] for name in CANONICAL_ORDER}

    for kf in keyframes:
        t = float(kf.get("timestamp", len(times) / fps))
        times.append(t)
        bones = kf.get("bones") or {}

        for src, dst in BONE_MAP.items():
            b = bones.get(src)
            if b is not None and "x" in b:
                q = euler_to_quaternion_xyz(
                    float(b["x"]), float(b["y"]), float(b["z"])
                )
                quats_by_bone[dst].append(q)
            else:
                quats_by_bone[dst].append(IDENTITY_QUAT[:])

        quats_by_bone["RightHand"].append(IDENTITY_QUAT[:])
        quats_by_bone["LeftHand"].append(IDENTITY_QUAT[:])

    n = len(times)
    for name in CANONICAL_ORDER:
        if len(quats_by_bone[name]) < n:
            quats_by_bone[name].extend([IDENTITY_QUAT[:]] * (n - len(quats_by_bone[name])))

    tracks = {}
    for name in CANONICAL_ORDER:
        tracks[name] = {
            "times": [round(t, 4) for t in times],
            "quaternions": [[round(x, 5) for x in q] for q in quats_by_bone[name][:n]],
        }

    return {
        "duration": round(duration, 3),
        "fps": round(fps, 2),
        "tracks": tracks,
    }


def main():
    if not os.path.isfile(INPUT_PATH):
        print("Fichier introuvable:", INPUT_PATH)
        return 1

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    motion = convert_bouche_to_motion(data)
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(motion, f, indent=2)

    print("Écrit:", OUTPUT_PATH)
    print("Duration:", motion["duration"], "s, FPS:", motion["fps"])
    print("Tracks:", list(motion["tracks"].keys()))
    return 0


if __name__ == "__main__":
    exit(main())
