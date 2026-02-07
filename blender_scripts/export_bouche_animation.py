# ---------------------------------------------------------------------------
# Export "bouche" (mouth) sign animation from Blender to JSON
# Usage (depuis le dossier voice-to-sign) :
#   blender avatar/avatar.glb --background --python blender_scripts/export_bouche_animation.py
# Ou dans Blender : ouvrir avatar.glb, puis Scripting > Run Script
#
# Le JSON exporté est au format attendu par l'app web (playVideoMotion) :
#   { "duration": float, "fps": int, "tracks": { "RightArm": { "times": [], "quaternions": [[x,y,z,w],...] }, ... } }
# Noms d'os canoniques : RightArm, LeftArm, RightForeArm, LeftForeArm, RightHand, LeftHand
# ---------------------------------------------------------------------------
import bpy
import math
import json
import os

# Configuration : durée et FPS de l'animation exportée
DURATION = 2.0  # secondes
FPS = 30
NUM_FRAMES = int(DURATION * FPS)

# Mapping nom canonique (web) -> motifs dans le nom Blender (insensible à la casse)
BONE_PATTERNS = {
    "RightArm": ["right", "arm"],
    "LeftArm": ["left", "arm"],
    "RightForeArm": ["right", "forearm", "fore arm"],
    "LeftForeArm": ["left", "forearm", "fore arm"],
    "RightHand": ["right", "hand"],
    "LeftHand": ["left", "hand"],
}


def find_armature():
    """Retourne le premier objet Armature de la scène."""
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def bone_matches(bone_name, patterns):
    """True si le nom du bone contient tous les motifs (insensible à la casse)."""
    name = (bone_name or "").lower()
    return all(p.lower() in name for p in patterns)


def find_canonical_bones(armature):
    """Trouve pour chaque nom canonique un pose bone correspondant."""
    mapping = {}
    for canonical, patterns in BONE_PATTERNS.items():
        for pbone in armature.pose.bones:
            if bone_matches(pbone.name, patterns):
                mapping[canonical] = pbone
                break
    return mapping


def quat_to_list(q):
    """Blender Quaternion -> [x, y, z, w] pour JSON."""
    return [float(q.x), float(q.y), float(q.z), float(q.w)]


def create_bouche_keyframes(armature):
    """
    Crée des keyframes pour le signe "bouche" (main vers la bouche).
    Mouvement typique : bras droit vers le visage puis retour.
    """
    bones = find_canonical_bones(armature)
    if not bones:
        return

    scene = bpy.context.scene
    scene.frame_start = 0
    scene.frame_end = NUM_FRAMES - 1
    scene.frame_set(0)

    # Sauvegarder les quaternions de repos (frame 0)
    rest_quats = {}
    for name, pbone in bones.items():
        rest_quats[name] = pbone.rotation_quaternion.copy()

    # Keyframes : frame 0 = repos, frame 10 = main vers bouche, frame 20 = retour, frame 30 = repos
    # RightArm : rotation vers le visage (élévation + légère rotation)
    if "RightArm" in bones:
        rb = bones["RightArm"]
        rb.rotation_mode = "QUATERNION"
        rb.rotation_quaternion = rest_quats["RightArm"].copy()
        rb.keyframe_insert(data_path="rotation_quaternion", frame=0)
        q_up = rest_quats["RightArm"].copy()
        q_up.rotate(blender_axis_angle(math.radians(-35), (1, 0, 0)))  # lever le bras
        q_up.rotate(blender_axis_angle(math.radians(15), (0, 1, 0)))
        rb.rotation_quaternion = q_up
        rb.keyframe_insert(data_path="rotation_quaternion", frame=10)
        rb.rotation_quaternion = rest_quats["RightArm"].copy()
        rb.keyframe_insert(data_path="rotation_quaternion", frame=20)
        rb.keyframe_insert(data_path="rotation_quaternion", frame=NUM_FRAMES - 1)

    if "RightForeArm" in bones:
        rb = bones["RightForeArm"]
        rb.rotation_mode = "QUATERNION"
        rb.rotation_quaternion = rest_quats["RightForeArm"].copy()
        rb.keyframe_insert(data_path="rotation_quaternion", frame=0)
        q_bend = rest_quats["RightForeArm"].copy()
        q_bend.rotate(blender_axis_angle(math.radians(-40), (0, 0, 1)))
        rb.rotation_quaternion = q_bend
        rb.keyframe_insert(data_path="rotation_quaternion", frame=10)
        rb.rotation_quaternion = rest_quats["RightForeArm"].copy()
        rb.keyframe_insert(data_path="rotation_quaternion", frame=20)
        rb.keyframe_insert(data_path="rotation_quaternion", frame=NUM_FRAMES - 1)

    if "RightHand" in bones:
        rb = bones["RightHand"]
        rb.rotation_mode = "QUATERNION"
        rb.rotation_quaternion = rest_quats["RightHand"].copy()
        rb.keyframe_insert(data_path="rotation_quaternion", frame=0)
        q_hand = rest_quats["RightHand"].copy()
        q_hand.rotate(blender_axis_angle(math.radians(10), (1, 0, 0)))
        rb.rotation_quaternion = q_hand
        rb.keyframe_insert(data_path="rotation_quaternion", frame=10)
        rb.rotation_quaternion = rest_quats["RightHand"].copy()
        rb.keyframe_insert(data_path="rotation_quaternion", frame=20)
        rb.keyframe_insert(data_path="rotation_quaternion", frame=NUM_FRAMES - 1)


def blender_axis_angle(angle_rad, axis):
    """Crée un Quaternion Blender à partir d'un angle (radians) et d'un axe (x,y,z)."""
    try:
        from mathutils import Quaternion
    except ImportError:
        return None
    return Quaternion(axis, angle_rad)


def export_animation_to_json(armature, output_path):
    """
    Parcourt les frames, lit les quaternions des bones canoniques,
    écrit le JSON au format attendu par l'app web.
    """
    bones = find_canonical_bones(armature)
    if not bones:
        print("Aucun bone canonique trouvé. Vérifiez les noms du rig (ex. Mixamo).")
        return

    scene = bpy.context.scene
    tracks = {}
    for canonical in bones:
        times = []
        quaternions = []
        for i in range(NUM_FRAMES):
            scene.frame_set(i)
            t = i / FPS
            times.append(t)
            pbone = bones[canonical]
            pbone.rotation_mode = "QUATERNION"
            q = pbone.rotation_quaternion
            quaternions.append(quat_to_list(q))
        tracks[canonical] = {"times": times, "quaternions": quaternions}

    data = {
        "duration": DURATION,
        "fps": FPS,
        "tracks": tracks,
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    print("Export OK:", output_path)
    print("Bones exportés:", list(tracks.keys()))


def main():
    armature = find_armature()
    if not armature:
        print("Aucune armature dans la scène. Chargez avatar.glb (riggé).")
        return

    # Option 1 : créer les keyframes "bouche" dans Blender (pour édition manuelle)
    create_bouche_keyframes(armature)

    # Chemin de sortie : à côté du projet (translate/data/bouche_animation.json)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_path = os.path.join(project_root, "translate", "data", "bouche_animation.json")

    export_animation_to_json(armature, output_path)


if __name__ == "__main__":
    main()
