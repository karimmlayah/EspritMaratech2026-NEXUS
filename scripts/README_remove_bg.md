# Suppression du fond des vidéos (remove.bg → MP4 fond vert)

Ce script traite **toutes les vidéos `.mp4`** du dossier `animations/` avec l’API [remove.bg](https://www.remove.bg/api) pour supprimer l’arrière-plan. Le résultat est une vidéo **.mp4** où le sujet est **sans fond** (posé sur un **fond vert**), lisible partout.

## Prérequis

- **Python 3** avec `requests` : `pip install requests`
- **ffmpeg** dans le PATH (extraction des images et encodage WebM VP9 alpha)

## Utilisation

Depuis la racine du projet :

```bash
# Toutes les vidéos, chaque image envoyée à remove.bg (beaucoup d’appels API)
python scripts/remove_video_background.py

# Réduire les appels : 1 image sur 3 (vidéo 3× plus courte en durée, ou fps divisé par 3)
python scripts/remove_video_background.py --every 3

# Test rapide : max 50 images par vidéo
python scripts/remove_video_background.py --max-frames 50

# Dossier de sortie personnalisé
python scripts/remove_video_background.py --output-dir d:\mes_videos_transparentes
```

## Comportement

1. **Extraction** : pour chaque `animations/*.mp4`, ffmpeg extrait les images (optionnellement 1 sur N avec `--every N`).
2. **remove.bg** : chaque image est envoyée à l’API ; la réponse est un PNG avec fond transparent.
3. **Encodage** : la séquence de PNG (sujet sans fond) est compositée sur un **fond vert** et encodée en **MP4 H.264** (`.mp4`), lisible partout.

Les fichiers générés sont écrits dans **`animations_no_bg/`** (ou le dossier indiqué par `--output-dir`), avec le même nom de base et l’extension **`.mp4`**.

## Quota API remove.bg

- Environ **50 appels gratuits par mois** ; au-delà, l’API est payante.
- Une vidéo de 100 images = 100 appels. Utiliser `--every 5` ou `--max-frames 50` pour limiter les appels.

La clé API est lue dans le script (valeur par défaut) ou via la variable d’environnement **`REMOVE_BG_API_KEY`**.
