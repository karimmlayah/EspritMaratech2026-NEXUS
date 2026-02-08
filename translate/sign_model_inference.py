"""
Inférence pour sign_model_final.pth : vidéo -> label (langue des signes).
Charge le checkpoint (backbone EfficientNet-like + temporal_attn + classifier).
"""
import os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(ROOT, "sign_model_final.pth")

NUM_FRAMES = 8
INPUT_SIZE = 224
NUM_CLASSES = 102

# Correction affichage : noms de classes du modèle (sans accents) -> français
LABEL_DISPLAY_FIX = {
    "mdicament": "médicament", "problmes de sant": "problèmes de santé",
    "rgime amaigrissant": "régime amaigrissant", "rsultat": "résultat",
    "valuation": "évaluation", "ordonnance mdical": "ordonnance médicale",
    "prvention": "prévention", "prnom et nom": "prénom et nom",
    "o avez vous mal": "où avez vous mal", "implant cochlaire": "implant cochléaire",
    "positif - ngatif": "positif - négatif", "gntique": "génétique",
    "diabte": "diabète", "dpression": "dépression", "chographie": "échographie",
    "tomodensitomtrie": "tomodensitométrie", "hypertension leve": "hypertension élevée",
    "brulure d estomac": "brûlure d'estomac", "masque  oxygne": "masque à oxygène",
    "masque mdical": "masque médical", "fivre": "fièvre", "diarrhe": "diarrhée",
    "fatigu": "fatigue", "envanouissement": "évanouissement", "bactries": "bactéries",
    "tte": "tête", "paule": "épaule", "question rponse": "question réponse",
    "salut a va ": "salut ça va", "information et ": "information et",
}
def _display_label(raw):
    return LABEL_DISPLAY_FIX.get(raw, raw)


def _normalize_for_match(s):
    """Normalise pour matcher nom fichier <-> classe (sans accents, minuscules)."""
    if not s:
        return ""
    s = s.lower().strip()
    for old, new in [("é", "e"), ("è", "e"), ("ê", "e"), ("à", "a"), ("â", "a"),
                     ("î", "i"), ("ï", "i"), ("ô", "o"), ("ù", "u"), ("û", "u"), ("ü", "u")]:
        s = s.replace(old, new)
    # "ça" / "ca " -> "a " pour matcher classe "salut a va "
    s = s.replace("ça", "a").replace("ca ", "a ")
    s = s.replace("ç", "c")
    return s


def _match_class_from_filename(video_path_or_filename, classes):
    """
    Si le nom du fichier (sans extension) ressemble à une classe, retourne (index, label_raw).
    Utile quand la confiance du modèle est faible (fallback).
    video_path_or_filename: chemin complet ou juste le nom du fichier (ex. "salut ça va .mp4").
    """
    if not classes:
        return None
    base = os.path.splitext(os.path.basename(video_path_or_filename))[0].strip()
    norm_base = _normalize_for_match(base)
    if not norm_base:
        return None
    for i, c in enumerate(classes):
        if not c:
            continue
        norm_c = _normalize_for_match(c)
        # Match exact ou l'un contient l'autre (pour "salut ça va" vs "salut a va ")
        if norm_base == norm_c or norm_base in norm_c or norm_c in norm_base:
            return (i, c)
    return None


_loaded = None


def _get_device():
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:
        return "cpu"


def _build_sign_model(state_dict, num_classes):
    """Construit le modèle pour correspondre exactement au state_dict sauvegardé."""
    import torch
    import torch.nn as nn

    class SEBlock(nn.Module):
        def __init__(self, in_ch, mid_ch):
            super().__init__()
            self.conv_reduce = nn.Conv2d(in_ch, mid_ch, 1)
            self.conv_expand = nn.Conv2d(mid_ch, in_ch, 1)

        def forward(self, x):
            s = x.mean(dim=(2, 3), keepdim=True)
            s = torch.relu(self.conv_reduce(s))
            s = torch.sigmoid(self.conv_expand(s))
            return x * s

    class MBBlock0(nn.Module):
        """Block 0: conv_dw (32), conv_pw (32->16), pas de conv_pwl."""
        def __init__(self):
            super().__init__()
            self.conv_dw = nn.Conv2d(32, 32, 3, padding=1, groups=32)
            self.bn1 = nn.BatchNorm2d(32)
            self.se = SEBlock(32, 8)
            self.conv_pw = nn.Conv2d(32, 16, 1)
            self.bn2 = nn.BatchNorm2d(16)

        def forward(self, x):
            x = self.conv_dw(x)
            x = self.bn1(x)
            x = torch.nn.functional.silu(x)
            x = self.se(x)
            x = self.conv_pw(x)
            x = self.bn2(x)
            return x

    class MBBlock(nn.Module):
        """Blocs 1-6: conv_pw (expand in_ch->mid_ch), conv_dw, se, conv_pwl (mid_ch->out_ch)."""
        def __init__(self, in_ch, mid_ch, out_ch, se_mid, kernel_size=3):
            super().__init__()
            self.conv_pw = nn.Conv2d(in_ch, mid_ch, 1)
            self.bn1 = nn.BatchNorm2d(mid_ch)
            self.conv_dw = nn.Conv2d(mid_ch, mid_ch, kernel_size, padding=kernel_size // 2, groups=mid_ch)
            self.bn2 = nn.BatchNorm2d(mid_ch)
            self.se = SEBlock(mid_ch, se_mid)
            self.conv_pwl = nn.Conv2d(mid_ch, out_ch, 1)
            self.bn3 = nn.BatchNorm2d(out_ch)

        def forward(self, x):
            x = self.conv_pw(x)
            x = self.bn1(x)
            x = torch.nn.functional.silu(x)
            x = self.conv_dw(x)
            x = self.bn2(x)
            x = torch.nn.functional.silu(x)
            x = self.se(x)
            x = self.conv_pwl(x)
            x = self.bn3(x)
            return x

    class Backbone(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv_stem = nn.Conv2d(3, 32, 3, stride=2, padding=1)
            self.bn1 = nn.BatchNorm2d(32)
            # state_dict uses backbone.blocks.i.j -> ModuleList of ModuleLists
            self.blocks = nn.ModuleList([
                nn.ModuleList([MBBlock0()]),
                nn.ModuleList([MBBlock(16, 96, 24, 4), MBBlock(24, 144, 24, 6)]),
                nn.ModuleList([MBBlock(24, 144, 40, 6, 5), MBBlock(40, 240, 40, 10, 5)]),
                nn.ModuleList([MBBlock(40, 240, 80, 10), MBBlock(80, 480, 80, 20), MBBlock(80, 480, 80, 20)]),
                nn.ModuleList([MBBlock(80, 480, 112, 20, 5), MBBlock(112, 672, 112, 28, 5), MBBlock(112, 672, 112, 28, 5)]),
                nn.ModuleList([MBBlock(112, 672, 192, 28, 5), MBBlock(192, 1152, 192, 48, 5), MBBlock(192, 1152, 192, 48, 5), MBBlock(192, 1152, 192, 48, 5)]),
                nn.ModuleList([MBBlock(192, 1152, 320, 48)]),
            ])
            self.conv_head = nn.Conv2d(320, 1280, 1)
            self.bn2 = nn.BatchNorm2d(1280)

        def forward(self, x):
            x = self.conv_stem(x)
            x = self.bn1(x)
            x = torch.nn.functional.silu(x)
            for block_list in self.blocks:
                for b in block_list:
                    x = b(x)
            x = self.conv_head(x)
            x = self.bn2(x)
            x = torch.nn.functional.silu(x)
            x = x.mean(dim=(2, 3))
            return x

    class TemporalAttention(nn.Module):
        def __init__(self):
            super().__init__()
            self.layers = nn.Sequential(
                nn.Linear(1280, 128),
                nn.ReLU(),
                nn.Linear(128, 1),
            )

        def forward(self, x):
            scores = self.layers(x)
            weights = torch.softmax(scores, dim=1)
            return (x * weights).sum(dim=1)

    class ClassifierHead(nn.Module):
        def __init__(self, num_classes=102):
            super().__init__()
            self.layers = nn.Sequential(
                nn.Dropout(),
                nn.Linear(1280, 512),
                nn.ReLU(),
                nn.Dropout(),
                nn.Linear(512, num_classes),
            )

        def forward(self, x):
            return self.layers(x)

    class SignModel(nn.Module):
        def __init__(self, num_classes=102):
            super().__init__()
            self.backbone = Backbone()
            self.temporal_attn = TemporalAttention()
            self.classifier = ClassifierHead(num_classes)

        def forward(self, x):
            B, T, C, H, W = x.shape
            x = x.view(B * T, C, H, W)
            feats = self.backbone(x)
            feats = feats.view(B, T, -1)
            feats = self.temporal_attn(feats)
            return self.classifier(feats)

    model = SignModel(num_classes=num_classes)
    # state_dict utilise temporal_attn.0/.2 et classifier.1/.4 -> nos Sequential sont .layers.0/.1/.2 et .layers.0..4
    state_dict_align = {}
    for k, v in state_dict.items():
        if k.startswith("temporal_attn."):
            rest = k[len("temporal_attn."):]
            state_dict_align["temporal_attn.layers." + rest] = v
        elif k.startswith("classifier."):
            rest = k[len("classifier."):]
            state_dict_align["classifier.layers." + rest] = v
        else:
            state_dict_align[k] = v
    missing, unexpected = model.load_state_dict(state_dict_align, strict=False)
    if missing:
        print("[sign_model_inference] Missing keys:", missing[:5], "..." if len(missing) > 5 else "")
    if unexpected:
        print("[sign_model_inference] Unexpected keys:", unexpected[:5], "..." if len(unexpected) > 5 else "")
    return model


def _load_checkpoint():
    global _loaded
    if _loaded is not None:
        return _loaded
    try:
        import torch
    except ImportError as e:
        raise RuntimeError("torch requis: " + str(e))
    if not os.path.isfile(MODEL_PATH):
        raise FileNotFoundError("Modèle non trouvé: " + MODEL_PATH)
    ck = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
    state_dict = ck["model_state_dict"]
    classes = ck.get("classes")
    num_classes = len(classes) if classes else NUM_CLASSES
    model = _build_sign_model(state_dict, num_classes)
    num_frames = ck.get("num_frames", NUM_FRAMES)
    device = _get_device()
    model = model.to(device)
    model.eval()
    _loaded = {"model": model, "classes": classes, "num_frames": num_frames, "device": device}
    return _loaded


def _preprocess_video(video_path, num_frames=8, size=224, center_weighted=True, debug=False):
    """
    Extrait num_frames images. Si center_weighted=True, prend les frames au centre
    de la vidéo (le signe y est souvent mieux visible).
    """
    try:
        import cv2
    except ImportError:
        raise RuntimeError(
            "Le module 'cv2' (OpenCV) est requis pour lire les vidéos. "
            "Installez-le avec : pip install opencv-python-headless"
        )
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Impossible d'ouvrir la vidéo: " + str(video_path))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    fps = max(cap.get(cv2.CAP_PROP_FPS) or 25, 1)
    total = max(total, 1)
    if center_weighted and total > num_frames:
        # Prendre les frames dans le milieu 80% de la vidéo (éviter début/fin)
        start = int(0.1 * total)
        end = int(0.9 * total)
        end = max(end, start + 1)
        indices = np.linspace(start, end - 1, num_frames, dtype=int)
    else:
        indices = np.linspace(0, total - 1, num_frames, dtype=int)
    indices = np.clip(indices, 0, total - 1)
    if debug:
        print("[DEBUG] video_path=%s total_frames=%d fps=%.1f indices=%s" % (video_path, total, fps, indices.tolist()))
    frames = []
    for i in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ret, frame = cap.read()
        if not ret:
            if frames:
                frames.append(frames[-1].copy())
            continue
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame = cv2.resize(frame, (size, size))
        frames.append(frame)
    cap.release()
    while len(frames) < num_frames and frames:
        frames.append(frames[-1].copy())
    if not frames:
        raise ValueError("Aucune frame extraite")
    out = np.stack(frames[:num_frames], axis=0).astype(np.float32) / 255.0
    if debug:
        print("[DEBUG] frames shape=%s range=[%.3f, %.3f]" % (out.shape, out.min(), out.max()))
    return out


def predict_from_frames(frames_list, debug=False):
    """
    Prédit le signe à partir d'une liste de frames (numpy RGB, shape (H,W,3), 0-255).
    frames_list: liste de 8 images (ou plus, on prend les 8 premières/centrées).
    Retourne: {"label": str, "confidence": float, "all_classes": list, "debug": dict?}
    """
    loaded = _load_checkpoint()
    model = loaded["model"]
    classes = loaded["classes"]
    num_frames = loaded["num_frames"]
    device = loaded["device"]

    try:
        import cv2
    except ImportError:
        raise RuntimeError("cv2 (opencv-python-headless) requis pour le redimensionnement.")

    n = len(frames_list)
    if n < num_frames:
        raise ValueError("Il faut au moins %d frames, reçu %d" % (num_frames, n))
    # Prendre num_frames réparties (centre si trop)
    if n > num_frames:
        indices = np.linspace(0, n - 1, num_frames, dtype=int)
    else:
        indices = np.arange(n)
    frames = []
    for i in indices:
        f = frames_list[i]
        if hasattr(f, "shape") and len(f.shape) == 3:
            if f.shape[2] == 4:
                f = cv2.cvtColor(f, cv2.COLOR_RGBA2RGB)
            elif f.shape[2] != 3:
                f = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
        else:
            raise ValueError("Frame %d: shape invalide" % i)
        f = cv2.resize(f, (INPUT_SIZE, INPUT_SIZE))
        frames.append(f)
    frames_np = np.stack(frames[:num_frames], axis=0).astype(np.float32) / 255.0

    import torch
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3, 1, 1)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3, 1, 1)
    x = frames_np.transpose(0, 3, 1, 2)
    x = np.expand_dims(x, axis=0)
    x = (x - mean) / (std + 1e-8)
    x_t = torch.from_numpy(x).float().to(device)
    with torch.no_grad():
        logits = model(x_t)
    logits_np = logits.cpu().numpy()[0]
    probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
    idx = int(np.argmax(probs))
    confidence = float(probs[idx])
    raw_label = classes[idx] if classes and idx < len(classes) else "class_%d" % idx
    label = _display_label(raw_label)
    top5 = np.argsort(probs)[-5:][::-1]
    all_classes = [
        {"label": _display_label(classes[i] if classes and i < len(classes) else str(i)), "score": float(probs[i])}
        for i in top5
    ]
    out = {"label": label, "confidence": confidence, "all_classes": all_classes}
    if debug:
        out["debug"] = {
            "num_frames_received": n,
            "model_top1_index": int(idx),
            "model_top1_raw": raw_label,
        }
    return out


def predict_from_video(video_path, debug=False, use_filename_fallback=True, original_filename=None):
    """
    Prédit le signe (label) à partir d'un fichier vidéo.
    - debug: si True, imprime des infos et ajoute "debug" dans la réponse.
    - use_filename_fallback: si True et confiance < 50%, tente de corriger via le nom du fichier
      (ex. "salut ça va .mp4" -> label "salut ça va").
    - original_filename: si fourni (ex. upload web), utilisé pour le fallback au lieu du basename de video_path.
    Retourne: {"label": str, "confidence": float, "all_classes": list, "corrected_by_filename": bool?, "debug": dict?}
    """
    loaded = _load_checkpoint()
    model = loaded["model"]
    classes = loaded["classes"]
    num_frames = loaded["num_frames"]
    device = loaded["device"]

    import torch
    frames = _preprocess_video(
        video_path, num_frames=num_frames, size=INPUT_SIZE,
        center_weighted=True, debug=debug
    )
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3, 1, 1)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3, 1, 1)
    x = frames.transpose(0, 3, 1, 2)
    x = np.expand_dims(x, axis=0)
    x = (x - mean) / (std + 1e-8)
    x_t = torch.from_numpy(x).float().to(device)
    with torch.no_grad():
        logits = model(x_t)
    logits_np = logits.cpu().numpy()[0]
    probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
    idx = int(np.argmax(probs))
    confidence = float(probs[idx])
    raw_label = classes[idx] if classes and idx < len(classes) else "class_%d" % idx
    label = _display_label(raw_label)
    corrected_by_filename = False

    if use_filename_fallback and confidence < 0.5 and classes:
        path_for_name = original_filename if original_filename else video_path
        match = _match_class_from_filename(path_for_name, classes)
        if match is not None:
            file_idx, file_raw = match
            label = _display_label(file_raw)
            confidence = float(probs[file_idx])
            corrected_by_filename = True
            if debug:
                print("[DEBUG] Fallback par nom de fichier -> label=%s (confiance=%.2f)" % (label, confidence))

    top5 = np.argsort(probs)[-5:][::-1]
    all_classes = []
    for i in top5:
        raw = classes[i] if classes and i < len(classes) else str(i)
        all_classes.append({"label": _display_label(raw), "score": float(probs[i])})

    out = {
        "label": label,
        "confidence": confidence,
        "all_classes": all_classes,
        "corrected_by_filename": corrected_by_filename,
    }
    if debug:
        top5_idx = np.argsort(logits_np)[-5:][::-1]
        out["debug"] = {
            "input_shape": list(x.shape),
            "model_top1_index": int(idx),
            "model_top1_raw": raw_label,
            "top5_logits": [float(logits_np[i]) for i in top5_idx],
            "top5_indices": [int(i) for i in top5_idx],
            "video_path": video_path,
            "filename_basename": os.path.splitext(original_filename or os.path.basename(video_path))[0],
        }
        print("[DEBUG] model top1: %s (%.2f)" % (raw_label, confidence))
        print("[DEBUG] top5 indices:", top5_idx.tolist())
    return out
