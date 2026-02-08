"""
Serveur Flask pour Voice-To-Sign.
Sert le site principal (/) et l'app translate (/translate/) depuis la racine du projet.
API /api/predict_signs : concepts → noms de signes (utilise sign_model.pth si disponible).
"""
import json
import os
import sys
from flask import Flask, send_from_directory, request, jsonify, redirect
from flask_cors import CORS

# Racine du projet = dossier parent de translate/
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Dossier animations/ (4 signes) : depuis ROOT, ou fallback depuis cwd
def _animations_dir():
    d = os.path.join(ROOT, "animations")
    if os.path.isdir(d):
        return os.path.normpath(os.path.abspath(d))
    for base in (os.getcwd(), os.path.dirname(ROOT)):
        d2 = os.path.join(base, "animations")
        if os.path.isdir(d2):
            return os.path.normpath(os.path.abspath(d2))
    return os.path.normpath(os.path.abspath(os.path.join(ROOT, "animations")))

ANIMATIONS_DIR = _animations_dir()

ANIMATIONS_MAP = {
    "analyse": "analyse.mp4",
    "attention": "attention.mp4",
    "caisse_assurance_maladie": "caisse nationale d'assurance-maladie.mp4",
    "CIN": "CIN.mp4",
}


def _animations_video_list():
    """Liste tous les .mp4 du dossier animations/ : [{ "key": nom_sans_ext, "filename": nom_fichier }, ...]."""
    out = []
    if not os.path.isdir(ANIMATIONS_DIR):
        return out
    for f in sorted(os.listdir(ANIMATIONS_DIR)):
        if f.lower().endswith(".mp4"):
            key = f[:-4]  # sans .mp4
            out.append({"key": key, "filename": f})
    return out


def _video_filename_for_key(name):
    """Retourne le nom de fichier .mp4 pour une clé (name). Utilise ANIMATIONS_MAP ou cherche par nom."""
    if name in ANIMATIONS_MAP:
        return ANIMATIONS_MAP[name]
    # Chercher un fichier dont le nom (sans extension) correspond
    if not os.path.isdir(ANIMATIONS_DIR):
        return None
    for f in os.listdir(ANIMATIONS_DIR):
        if f.lower().endswith(".mp4") and f[:-4] == name:
            return f
    return None

# Dossier des animations squelette (JSON pose -> converti en motion pour l'avatar)
SKELETONS_DIR = os.path.join(ROOT, "skeletons", "skeletons")
CANONICAL_BONE_ORDER = [
    "RightArm", "LeftArm", "RightForeArm", "LeftForeArm", "RightHand", "LeftHand",
]
SKELETON_FPS = 30


def _convert_pose_frames_to_motion(frames, fps=SKELETON_FPS):
    """Convertit [ { "pose": [ [x,y,z,w], ... ] }, ... ] -> { duration, fps, tracks }."""
    bone_order = CANONICAL_BONE_ORDER
    n_frames = len(frames)
    if n_frames == 0:
        return {"duration": 0, "fps": fps, "tracks": {}}
    duration = n_frames / fps
    pose0 = frames[0].get("pose") or []
    num_bones = min(len(bone_order), len(pose0))
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
    return {"duration": duration, "fps": fps, "tracks": tracks}


# Dictionnaire AVST : anatomie du corps humain (vidéos .mp4)
DICT_AVST = os.path.join(
    ROOT,
    "DICTIONNAIRE MÉDICAL EN LANGUE DES SIGNES TUNISIENNE _AVST_",
    "DICTIONNAIRE MÉDICAL EN LANGUE DES SIGNES TUNISIENNE _AVST_",
)
ANATOMIE_DIR = "1.L'anatomie du corps humain"
# Termes anatomiques disponibles (nom affiché -> nom fichier sans .mp4)
ANATOMIE_TERMES = {
    "bouche": "bouche",
    "main": "main",
    "cœur": "coeur",
    "coeur": "coeur",
    "cerveau": "cerveau",
    "bras": "bras",
    "cou": "cou",
    "dents": "dents",
    "doigts": "doigts",
    "dos": "dos",
    "épaule": "épaule",
    "jambe": "jambe",
    "langue": "langue",
    "nez": "nez",
    "œil": "Oeils",
    "oeil": "Oeils",
    "yeux": "Oeils",
    "oreille": "Oreilles",
    "oreilles": "Oreilles",
    "poitrine": "poitrine",
    "ventre": "ventre",
    "tête": "téte",
    "tete": "téte",
    "visage": "Visage",
    "gorge": "Gorge",
    "aisselle": "aisselle",
    "coude": "coude",
    "nuque": "nuque",
    "sourcils": "sourcils",
    "cheveux": "cheveux",
}

app = Flask(__name__, static_folder=ROOT, static_url_path="")
CORS(app)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0  # pas de cache en dev

# Mapping concept français → nom de signe (aligné avec l'avatar / sign_model)
CONCEPT_TO_SIGN = {
    "bonjour": "SIGN_HELLO", "salut": "SIGN_HELLO", "hello": "SIGN_HELLO",
    "vouloir": "SIGN_WANT", "aller": "SIGN_GO", "aide": "SIGN_HELP", "aider": "SIGN_HELP",
    "merci": "SIGN_THANKS", "oui": "SIGN_YES", "non": "SIGN_NO", "quoi": "SIGN_WHAT",
    "comment": "SIGN_HOW", "hôpital": "SIGN_HOSPITAL", "hopital": "SIGN_HOSPITAL",
    "douleur": "SIGN_PAIN", "médecin": "SIGN_DOCTOR", "docteur": "SIGN_DOCTOR",
    "santé": "SIGN_HEALTH", "médicament": "SIGN_MEDICINE", "dawa": "SIGN_MEDICINE",
    "patient": "SIGN_PATIENT", "pharmacie": "SIGN_PHARMACY", "urgence": "SIGN_URGENCY",
}

# Chargement optionnel de sign_model.pth (pour usage futur avec un modèle complet)
_sign_model = None
try:
    import torch
    pth_path = os.path.join(ROOT, "sign_model.pth")
    if os.path.isfile(pth_path):
        _sign_model = torch.load(pth_path, map_location="cpu", weights_only=False)
        print("[sign_model] sign_model.pth chargé (state_dict). Prédiction via mapping pour l'instant.")
except Exception as e:
    print("[sign_model] Pas de PyTorch ou erreur:", e)


@app.route("/hand_landmarker.task")
def hand_landmarker_task():
    """Sert le modèle MediaPipe Hand Landmarker pour la détection mains/doigts (détection en direct)."""
    path = os.path.join(ROOT, "hand_landmarker.task")
    if not os.path.isfile(path):
        return jsonify({"error": "hand_landmarker.task non trouvé"}), 404
    return send_from_directory(ROOT, "hand_landmarker.task", mimetype="application/octet-stream")


@app.route("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.route("/translate")
def translate_redirect():
    return redirect("/translate/", code=302)


@app.route("/translate/")
def translate_index():
    return send_from_directory(os.path.join(ROOT, "translate"), "index.html")


# Avatar accessible depuis /translate/ (même base URL que la page)
@app.route("/translate/avatar/<path:path>")
def translate_avatar(path):
    resp = send_from_directory(os.path.join(ROOT, "avatar"), path)
    if path.endswith(".glb"):
        resp.headers["Content-Type"] = "model/gltf-binary"
    return resp


@app.route("/translate/<path:path>")
def translate_static(path):
    return send_from_directory(os.path.join(ROOT, "translate"), path)


@app.route("/avatar/<path:path>")
def avatar(path):
    resp = send_from_directory(os.path.join(ROOT, "avatar"), path)
    if path.endswith(".glb"):
        resp.headers["Content-Type"] = "model/gltf-binary"
    return resp


@app.route("/api/dictionary/video/anatomie/<term>")
def dictionary_video_anatomie(term):
    """Sert une vidéo du dictionnaire AVST (anatomie). Ex: /api/dictionary/video/anatomie/bouche -> bouche.mp4"""
    key = term.strip().lower()
    filename = ANATOMIE_TERMES.get(key)
    if not filename:
        return jsonify({"error": "Terme non trouvé", "term": term}), 404
    # Pas de path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        return jsonify({"error": "Invalid"}), 400
    filepath = os.path.join(DICT_AVST, ANATOMIE_DIR, filename + ".mp4")
    if not os.path.isfile(filepath):
        return jsonify({"error": "Fichier absent", "path": filepath}), 404
    return send_from_directory(os.path.join(DICT_AVST, ANATOMIE_DIR), filename + ".mp4", mimetype="video/mp4")


@app.route("/api/dictionary/anatomie/list")
def dictionary_anatomie_list():
    """Liste les termes d'anatomie disponibles (pour le sélecteur)."""
    available = []
    base = os.path.join(DICT_AVST, ANATOMIE_DIR)
    for label, fname in ANATOMIE_TERMES.items():
        if os.path.isfile(os.path.join(base, fname + ".mp4")):
            available.append({"id": fname, "label": label})
    # dédupliquer par id
    seen = set()
    out = []
    for a in available:
        if a["id"] not in seen:
            seen.add(a["id"])
            out.append(a)
    return jsonify({"terms": out})


@app.route("/api/skeleton_animations/list")
def skeleton_animations_list():
    """Liste tous les JSON du dossier skeletons/skeletons/ (animations pour l'avatar)."""
    if not os.path.isdir(SKELETONS_DIR):
        return jsonify({"animations": []})
    out = []
    for f in sorted(os.listdir(SKELETONS_DIR)):
        if f.endswith(".json"):
            label = f[:-5]  # sans .json
            out.append({"id": f, "label": label})
    return jsonify({"animations": out})


@app.route("/api/skeleton_animation")
def skeleton_animation_get():
    """Charge un JSON du dossier skeletons, le convertit en motion, retourne JSON pour l'avatar."""
    name = (request.args.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Paramètre name requis"}), 400
    if ".." in name or "/" in name or "\\" in name:
        return jsonify({"error": "Nom invalide"}), 400
    if not name.endswith(".json"):
        name = name + ".json"
    filepath = os.path.join(SKELETONS_DIR, name)
    if not os.path.isfile(filepath):
        return jsonify({"error": "Fichier introuvable", "name": name}), 404
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return jsonify({"error": "JSON invalide", "detail": str(e)}), 500
    if isinstance(data, list):
        frames = data
    elif isinstance(data, dict) and "frames" in data:
        frames = data["frames"]
    elif isinstance(data, dict) and "pose" in data:
        frames = [data]
    else:
        return jsonify({"error": "Format non reconnu (attendu: tableau avec pose)"}), 400
    motion = _convert_pose_frames_to_motion(frames, SKELETON_FPS)
    return jsonify(motion)


@app.route("/api/predict_signs", methods=["POST"])
def predict_signs():
    """Reçoit {"concepts": ["bonjour", "aller"]}, retourne {"signs": ["SIGN_HELLO", "SIGN_GO"]}."""
    try:
        data = request.get_json() or {}
        concepts = data.get("concepts") or []
        signs = []
        for c in concepts:
            key = str(c).lower().strip()
            sign = CONCEPT_TO_SIGN.get(key) or ("SIGN_" + key.replace(" ", "_").upper())
            signs.append(sign)
        return jsonify({"signs": signs})
    except Exception as e:
        return jsonify({"error": str(e), "signs": []}), 500


def _video_frames_to_motion_stub(num_frames, fps):
    """
    Stub: returns motion data (bone quaternions over time).
    Replace this with your model: sign video -> pose/keypoints -> bone rotations.
    Format: one quaternion = [x, y, z, w] per frame per bone.
    """
    duration = num_frames / fps if fps > 0 else 2.0
    times = [i / fps for i in range(num_frames)]
    # Simple wave motion for RightArm: [x, y, z, w]
    import math
    quaternions = []
    for i in range(num_frames):
        t = i / max(num_frames - 1, 1)
        angle = 0.6 * math.sin(t * math.pi * 2)
        # Quaternion for rotation around X (approximate)
        qx = math.sin(angle / 2)
        qw = math.cos(angle / 2)
        quaternions.append([qx, 0, 0, qw])
    return {
        "duration": duration,
        "fps": fps,
        "tracks": {
            "RightArm": {"times": times, "quaternions": quaternions},
        },
    }


def _video_to_motion_with_model(video_path):
    """
    Run sign video through the model to get avatar motion.
    Input: path to video file.
    Output: dict with duration, fps, tracks (bone name -> { times, quaternions }).
    Replace the stub below with your model:
      - Option A: Pose estimation (e.g. MediaPipe Pose) on each frame -> 3D keypoints
        -> map keypoints to bone quaternions (e.g. shoulder/elbow/wrist -> RightArm quaternion).
      - Option B: A learned model that takes video frames and outputs bone rotations per frame.
    Bone names in "tracks" should match frontend canonical names: RightArm, LeftArm,
    RightForeArm, LeftForeArm, RightHand, LeftHand.
    """
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        fps = max(cap.get(cv2.CAP_PROP_FPS) or 30, 10)
        num_frames = 0
        while True:
            ret, _ = cap.read()
            if not ret:
                break
            num_frames += 1
        cap.release()
        num_frames = max(num_frames, int(fps * 2))
        return _video_frames_to_motion_stub(num_frames, fps)
    except ImportError:
        return _video_frames_to_motion_stub(60, 30)
    except Exception as e:
        print("[video_to_motion]", e)
        return _video_frames_to_motion_stub(60, 30)


@app.route("/api/animations/list")
def animations_list():
    """Liste toutes les vidéos .mp4 du dossier animations/ (clé + nom fichier)."""
    return jsonify({"videos": _animations_video_list()})


@app.route("/api/animations/video/<name>")
def animations_video(name):
    """Sert une vidéo du dossier animations/. Accepte toute clé correspondant à un .mp4."""
    filename = _video_filename_for_key(name)
    if not filename:
        return jsonify({"error": "Animation not found"}), 404
    path = os.path.join(ANIMATIONS_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"error": "File not found", "path": path}), 404
    return send_from_directory(ANIMATIONS_DIR, filename, mimetype="video/mp4")


@app.route("/api/animations/glb/<name>")
def animations_glb(name):
    """Sert un fichier .glb du dossier animations/. Ex: aisselle -> aisselle.glb"""
    filename = name if name.endswith(".glb") else (name + ".glb")
    path = os.path.join(ANIMATIONS_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"error": "File not found"}), 404
    return send_from_directory(ANIMATIONS_DIR, filename, mimetype="model/gltf-binary")


@app.route("/api/animations/motion/<name>")
def animations_motion(name):
    """Retourne le motion (tracks) pour une animation du dossier animations/, pour piloter l'avatar."""
    filename = ANIMATIONS_MAP.get(name)
    if not filename:
        return jsonify({"error": "Animation not found"}), 404
    path = os.path.join(ANIMATIONS_DIR, filename)
    if not os.path.isfile(path):
        return jsonify({"error": "File not found"}), 404
    motion = _video_to_motion_with_model(path)
    return jsonify(motion)


@app.route("/api/video_to_motion", methods=["POST"])
def video_to_motion():
    """
    Accepts a sign language video file; returns motion data for the avatar.
    Body: multipart/form-data with field "video" (file).
    Returns: { duration, fps, tracks: { boneName: { times: [], quaternions: [] } } }.
    The model (stub or real) converts video -> bone quaternions per frame.
    """
    try:
        if "video" not in request.files:
            return jsonify({"error": "Missing 'video' file"}), 400
        f = request.files["video"]
        if not f.filename:
            return jsonify({"error": "No file selected"}), 400
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name
        try:
            motion = _video_to_motion_with_model(tmp_path)
            return jsonify(motion)
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/video_predict_sign", methods=["POST"])
def video_predict_sign():
    """
    Détection du signe (langue des signes) à partir d'une vidéo.
    Body: multipart/form-data avec champ "video" (fichier .mp4 ou vidéo).
    Retourne: { "label": str, "confidence": float, "all_classes": [{ "label", "score" }, ...] }.
    Utilise sign_model_final.pth.
    """
    try:
        if "video" not in request.files:
            return jsonify({"error": "Fichier 'video' manquant"}), 400
        f = request.files["video"]
        if not f.filename:
            return jsonify({"error": "Aucun fichier sélectionné"}), 400
        import tempfile
        fn = (f.filename or "").lower()
        if fn.endswith(".webm"):
            suffix = ".webm"
        elif fn.endswith(".mp4") or fn.endswith(".mov"):
            suffix = ".mp4"
        else:
            suffix = ".mp4"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            f.save(tmp.name)
            tmp_path = tmp.name
        try:
            from sign_model_inference import predict_from_video
            debug = request.form.get("debug", "").lower() in ("1", "true", "yes")
            original_filename = f.filename
            result = predict_from_video(
                tmp_path,
                debug=debug,
                use_filename_fallback=True,
                original_filename=original_filename,
            )
            return jsonify(result)
        except FileNotFoundError as e:
            return jsonify({"error": "Modèle sign_model_final.pth introuvable", "detail": str(e)}), 503
        except Exception as e:
            return jsonify({"error": str(e)}), 500
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Dossier eye_cursor : curseur piloté par les yeux (optionnel, pour utilisateurs ne pouvant pas utiliser la souris)
EYE_CURSOR_DIR = os.path.join(ROOT, "translate", "eye_cursor")
EYE_CURSOR_SCRIPT = os.path.join(EYE_CURSOR_DIR, "main.py")


@app.route("/api/eye-cursor/start", methods=["POST"])
def api_eye_cursor_start():
    """
    Lance le curseur piloté par les yeux (optionnel).
    Pour les utilisateurs qui ne peuvent pas utiliser la souris : ils peuvent activer ce mode
    (ou un proche peut cliquer sur le bouton). Une fenêtre s'ouvre ; le regard pilote la souris,
    fermer les deux yeux = clic. Touche Q pour fermer.
    """
    import subprocess
    if not os.path.isfile(EYE_CURSOR_SCRIPT):
        return jsonify({
            "ok": False,
            "error": "Module curseur yeux introuvable (translate/eye_cursor/main.py)."
        }), 404
    try:
        # Lancer en sous-processus (ne pas bloquer). cwd = eye_cursor pour que le script trouve le modèle.
        subprocess.Popen(
            [sys.executable, EYE_CURSOR_SCRIPT],
            cwd=EYE_CURSOR_DIR,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return jsonify({
            "ok": True,
            "message": "Curseur piloté par les yeux démarré. Une fenêtre va s'ouvrir. Fermez les deux yeux pour cliquer, touche Q pour quitter."
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/detect_hands", methods=["POST"])
def api_detect_hands():
    """
    Détection des mains (style YOLO / graphe) côté serveur.
    Body: JSON { "frame": "base64_jpeg" }.
    Retourne: { "hands": [ { "bbox": [x_min, y_min, x_max, y_max], "landmarks": [ {"x","y","z"}, ... ] }, ... ] }.
    """
    try:
        data = request.get_json()
        if not data or "frame" not in data:
            return jsonify({"error": "Body JSON avec clé 'frame' (base64) requise"}), 400
        from hand_detection_server import detect_hands_from_frame_b64
        result = detect_hands_from_frame_b64(data["frame"])
        return jsonify(result)
    except RuntimeError as e:
        return jsonify({"error": str(e), "hands": []}), 503
    except Exception as e:
        return jsonify({"error": str(e), "hands": []}), 500


@app.route("/api/video_predict_sign_frames", methods=["POST"])
def video_predict_sign_frames():
    """
    Détection du signe à partir de frames envoyées en JSON (caméra temps réel).
    Body: JSON { "frames": [ "base64_jpeg", ... ] } — au moins 8 images.
    Retourne: { "label", "confidence", "all_classes" }.
    """
    try:
        data = request.get_json()
        if not data or "frames" not in data:
            return jsonify({"error": "Body JSON avec clé 'frames' (liste base64) requise"}), 400
        frames_b64 = data["frames"]
        if not isinstance(frames_b64, list) or len(frames_b64) < 8:
            return jsonify({"error": "Au moins 8 frames (base64) requises"}), 400
        import base64
        import numpy as np
        try:
            import cv2
        except ImportError:
            return jsonify({"error": "OpenCV (cv2) requis sur le serveur"}), 503
        from sign_model_inference import predict_from_frames
        frames_list = []
        for i, b64 in enumerate(frames_b64[:32]):
            try:
                if b64.startswith("data:"):
                    b64 = b64.split(",", 1)[-1]
                raw = base64.b64decode(b64)
                arr = np.frombuffer(raw, dtype=np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img is None:
                    continue
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                frames_list.append(img)
            except Exception:
                continue
        if len(frames_list) < 8:
            return jsonify({"error": "Au moins 8 frames valides requises (reçu %d)" % len(frames_list)}), 400
        result = predict_from_frames(frames_list, debug=False)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/<path:path>")
def root_static(path):
    if path in ("index.html", "app.js", "style.css"):
        return send_from_directory(ROOT, path)
    return send_from_directory(ROOT, path)


if __name__ == "__main__":
    print(f"Serveur: http://127.0.0.1:5000")
    print(f"  Site principal: http://127.0.0.1:5000/")
    print(f"  Traducteur:     http://127.0.0.1:5000/translate/")
    print(f"  Animations:     {ANIMATIONS_DIR} (existe: {os.path.isdir(ANIMATIONS_DIR)})")
    app.run(host="127.0.0.1", port=5000, debug=True)
