#!/usr/bin/env python3
"""
Traite toutes les vidéos .mp4 du dossier animations/ avec l'API remove.bg :
- Extrait les images de chaque vidéo
- Supprime l'arrière-plan de chaque image (remove.bg)
- Réassemble en vidéo .mp4 avec fond vert (sujet sans fond, lisible partout)

Usage:
  python scripts/remove_video_background.py
  python scripts/remove_video_background.py --every 3   # 1 image sur 3 (réduit les appels API)
  python scripts/remove_video_background.py --max-frames 50  # test sur 50 images max

Nécessite: ffmpeg dans le PATH, requests (pip install requests)
Clé API remove.bg : https://www.remove.bg/api (50 appels gratuits/mois)
"""

import os
import sys
import subprocess
import tempfile
import shutil
import argparse
from pathlib import Path

# Clé API remove.bg (priorité à la variable d'environnement)
REMOVE_BG_API_KEY = os.environ.get("REMOVE_BG_API_KEY", "79nuwzL8o32CG9akZYgMUAqX")
REMOVE_BG_URL = "https://api.remove.bg/v1.0/removebg"

# Dossiers (par rapport à la racine du projet)
ROOT = Path(__file__).resolve().parent.parent
ANIMATIONS_DIR = ROOT / "animations"
OUTPUT_DIR = ROOT / "animations_no_bg"


class InsufficientCreditsError(RuntimeError):
    """Quota remove.bg épuisé (402). Arrêt du script."""
    pass


def get_video_info(video_path):
    """Retourne (fps, nb_frames) via ffprobe."""
    cmd = [
        "ffprobe", "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=r_frame_rate,nb_frames",
        "-of", "default=noprint_wrappers=1", str(video_path)
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    if out.returncode != 0:
        return None, None
    fps_str = None
    nb_frames = None
    for line in out.stdout.strip().split("\n"):
        if "r_frame_rate=" in line:
            fps_str = line.split("=")[1].strip()
        if "nb_frames=" in line:
            nb_frames = line.split("=")[1].strip()
    if fps_str:
        a, b = map(int, fps_str.split("/"))
        fps = a / b if b else a
    else:
        fps = 30.0
    if nb_frames:
        nb_frames = int(nb_frames)
    else:
        nb_frames = None
    return fps, nb_frames


def extract_frames(video_path, out_dir, every_n=1):
    """Extrait une image toutes les every_n frames. Retourne le nombre d'images et le fps."""
    fps, _ = get_video_info(video_path)
    if fps is None:
        fps = 30.0
    # ffmpeg: extraire une frame toutes les every_n (select=not(mod(n\,N)))
    pattern = out_dir / "frame_%04d.png"
    vf = f"select=not(mod(n\\,{every_n}))" if every_n > 1 else "null"
    if every_n > 1:
        cmd = [
            "ffmpeg", "-y", "-i", str(video_path),
            "-vf", vf, "-vsync", "vfr", "-frame_pts", "1", str(pattern)
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    else:
        r = subprocess.run(
            ["ffmpeg", "-y", "-i", str(video_path), str(pattern)],
            capture_output=True, text=True, timeout=300
        )
    if r.returncode != 0 or not list(out_dir.glob("frame_*.png")):
        # Fallback: extraire toutes les frames
        cmd = ["ffmpeg", "-y", "-i", str(video_path), str(pattern)]
        subprocess.run(cmd, capture_output=True, timeout=300)
    frames = sorted(out_dir.glob("frame_*.png"))
    # FPS de sortie = fps original / every_n
    out_fps = fps / every_n
    return len(frames), out_fps, fps


def remove_bg_from_image(image_path, out_path, api_key):
    """Appelle remove.bg sur une image, enregistre le PNG avec transparence."""
    try:
        import requests
    except ImportError:
        print("Installez requests: pip install requests", file=sys.stderr)
        sys.exit(1)
    with open(image_path, "rb") as f:
        data = f.read()
    resp = requests.post(
        REMOVE_BG_URL,
        headers={"X-Api-Key": api_key},
        files={"image_file": (image_path.name, data, "image/png")},
        data={"size": "auto", "format": "png"},
        timeout=60,
    )
    if resp.status_code != 200:
        msg = f"remove.bg error {resp.status_code}: {resp.text[:200]}"
        raise RuntimeError(msg)
    with open(out_path, "wb") as f:
        f.write(resp.content)


def encode_mp4_green(frames_dir, output_mp4, fps):
    """Encode la séquence PNG (sujet sans fond) sur fond vert en MP4 H.264."""
    pattern = frames_dir / "nobg_%04d.png"
    # Fond vert même taille que les images, puis overlay des PNG (avec alpha)
    cmd = [
        "ffmpeg", "-y", "-framerate", str(fps), "-start_number", "1", "-i", str(pattern),
        "-f", "lavfi", "-i", "color=c=0x00FF00:r={}:s=1920x1080".format(fps),
        "-filter_complex", "[1][0]scale2ref=iw:ih[bg][fg];[bg][fg]overlay=0:0:format=auto",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", str(output_mp4)
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        print(r.stderr[-500:] if r.stderr else "ffmpeg failed", file=sys.stderr)
        return False
    return True


def process_video(video_path, output_dir, api_key, every_n=1, max_frames=None):
    """Traite une vidéo : extraction -> remove.bg -> MP4 fond vert."""
    name = video_path.stem
    out_mp4 = output_dir / f"{name}.mp4"
    if out_mp4.exists():
        print(f"  Déjà fait: {out_mp4.name}")
        return True

    with tempfile.TemporaryDirectory(prefix="vbg_") as tmp:
        tmp = Path(tmp)
        print(f"  Extraction des images (1 / {every_n})...")
        n_frames, out_fps, _ = extract_frames(video_path, tmp, every_n)
        if n_frames == 0:
            print("  Aucune image extraite.", file=sys.stderr)
            return False
        if max_frames and n_frames > max_frames:
            for i, p in enumerate(sorted(tmp.glob("frame_*.png"))):
                if i >= max_frames:
                    p.unlink()
            frames_list = sorted(tmp.glob("frame_*.png"))[:max_frames]
            n_frames = len(frames_list)
        else:
            frames_list = sorted(tmp.glob("frame_*.png"))

        print(f"  remove.bg sur {n_frames} images...")
        last_ok_nobg = None  # ne jamais mettre l'image originale (avec fond)
        for i, img in enumerate(frames_list):
            if max_frames and i >= max_frames:
                break
            out_png = tmp / f"nobg_{i+1:04d}.png"
            try:
                remove_bg_from_image(img, out_png, api_key)
                last_ok_nobg = out_png
            except RuntimeError as e:
                if "insufficient_credits" in str(e).lower() or "402" in str(e):
                    raise InsufficientCreditsError(
                        "Quota remove.bg épuisé (402). Aucun crédit restant."
                    ) from e
                print(f"  Erreur image {img.name}: {e}", file=sys.stderr)
                if last_ok_nobg and last_ok_nobg.exists():
                    shutil.copy(last_ok_nobg, out_png)
                elif i > 0:
                    prev_nobg = tmp / f"nobg_{i:04d}.png"
                    if prev_nobg.exists():
                        shutil.copy(prev_nobg, out_png)
                else:
                    return False
            except Exception as e:
                print(f"  Erreur image {img.name}: {e}", file=sys.stderr)
                if last_ok_nobg and last_ok_nobg.exists():
                    shutil.copy(last_ok_nobg, out_png)
                elif i > 0:
                    prev_nobg = tmp / f"nobg_{i:04d}.png"
                    if prev_nobg.exists():
                        shutil.copy(prev_nobg, out_png)
                else:
                    return False

        print(f"  Encodage MP4 (sujet sans fond sur fond vert)...")
        if not encode_mp4_green(tmp, out_mp4, out_fps):
            return False
    print(f"  -> {out_mp4}")
    return True


def main():
    parser = argparse.ArgumentParser(description="Suppression du fond des vidéos (remove.bg) -> MP4 fond vert")
    parser.add_argument("--every", type=int, default=1, help="Traiter 1 image sur N (réduit les appels API)")
    parser.add_argument("--max-frames", type=int, default=None, help="Nombre max d'images par vidéo (test)")
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR, help="Dossier de sortie (défaut: animations_no_bg)")
    args = parser.parse_args()

    if not ANIMATIONS_DIR.is_dir():
        print(f"Dossier introuvable: {ANIMATIONS_DIR}", file=sys.stderr)
        sys.exit(1)

    videos = sorted(ANIMATIONS_DIR.glob("*.mp4"))
    if not videos:
        print("Aucune vidéo .mp4 dans animations/", file=sys.stderr)
        sys.exit(1)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    print(f"API remove.bg (clé utilisée: ...{REMOVE_BG_API_KEY[-6:]})")
    print(f"Vidéos: {len(videos)}, sortie: {args.output_dir}")
    if args.every > 1:
        print(f"Réduction: 1 image sur {args.every} (moins d'appels API)")
    if args.max_frames:
        print(f"Limite: {args.max_frames} images par vidéo")

    for v in videos:
        print(f"\n{v.name}")
        try:
            process_video(v, args.output_dir, REMOVE_BG_API_KEY, args.every, args.max_frames)
        except InsufficientCreditsError:
            print("\nQuota remove.bg épuisé (402). Arrêt.", file=sys.stderr)
            print("Réessayez le mois prochain ou ajoutez des crédits sur https://www.remove.bg/api", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"  Erreur: {e}", file=sys.stderr)

    print("\nTerminé. Vidéos sans fond (MP4 fond vert) dans:", args.output_dir)


if __name__ == "__main__":
    main()
