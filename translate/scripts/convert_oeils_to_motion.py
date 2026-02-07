"""
Convertit Oeils.json (tableau de { "pose": [ [x,y,z,w], ... ] }) vers le format
attendu par l'app : { "duration", "fps", "tracks": { "RightArm": { "times", "quaternions" }, ... } }.
Usage: python convert_oeils_to_motion.py [chemin_entree] [chemin_sortie]
Par défaut: Downloads/Oeils.json -> translate/data/Oeils_animation.json
"""
import json
import os
import sys

# Ordre des 6 os canoniques utilisés par l'avatar (indices dans le tableau pose)
# Ajustez si votre export utilise un autre ordre (ex. ordre Mixamo/Blender).
CANONICAL_BONE_ORDER = [
    "RightArm",
    "LeftArm",
    "RightForeArm",
    "LeftForeArm",
    "RightHand",
    "LeftHand",
]

DEFAULT_FPS = 30


def convert_pose_frames_to_motion(frames, fps=DEFAULT_FPS, bone_order=None):
    """
    frames: list of { "pose": [ [x,y,z,w], ... ] }
    Returns: { "duration", "fps", "tracks": { boneName: { "times", "quaternions" } } }
    """
    bone_order = bone_order or CANONICAL_BONE_ORDER
    n_frames = len(frames)
    if n_frames == 0:
        return {"duration": 0, "fps": fps, "tracks": {}}

    duration = n_frames / fps
    num_bones = min(len(bone_order), len(frames[0]["pose"]) if frames[0].get("pose") else 0)
    if num_bones == 0:
        return {"duration": duration, "fps": fps, "tracks": {}}

    tracks = {}
    for bi in range(num_bones):
        bone_name = bone_order[bi]
        times = []
        quaternions = []
        for fi, frame in enumerate(frames):
            pose = frame.get("pose") or []
            if bi < len(pose):
                q = pose[bi]
                if len(q) >= 4:
                    times.append(fi / fps)
                    quaternions.append([float(q[0]), float(q[1]), float(q[2]), float(q[3])])
        if times:
            tracks[bone_name] = {"times": times, "quaternions": quaternions}

    return {
        "duration": duration,
        "fps": fps,
        "tracks": tracks,
    }


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_translate = os.path.dirname(script_dir)
    project_root = os.path.dirname(project_translate)

    if len(sys.argv) >= 3:
        input_path = sys.argv[1]
        output_path = sys.argv[2]
    else:
        input_path = os.path.join(os.path.expanduser("~"), "Downloads", "Oeils.json")
        output_path = os.path.join(project_translate, "data", "Oeils_animation.json")

    if not os.path.isfile(input_path):
        print("Fichier introuvable:", input_path)
        sys.exit(1)

    print("Lecture de", input_path, "...")
    with open(input_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        frames = data
    elif isinstance(data, dict) and "frames" in data:
        frames = data["frames"]
    elif isinstance(data, dict) and "pose" in data:
        frames = [data]
    else:
        print("Format non reconnu (attendu: tableau de { pose: [...] })")
        sys.exit(1)

    print("Frames:", len(frames))
    if frames and "pose" in frames[0]:
        print("Quaternions par frame:", len(frames[0]["pose"]))

    motion = convert_pose_frames_to_motion(frames, DEFAULT_FPS)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(motion, f, indent=2)

    print("Écrit:", output_path)
    print("Duration:", motion["duration"], "s, Tracks:", list(motion["tracks"].keys()))


if __name__ == "__main__":
    main()
