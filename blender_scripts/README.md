# Scripts Blender pour Voice-to-Sign

## Export animation « Bouche » (dictionnaire anatomique AVST)

Le script `export_bouche_animation.py` utilise l’**API Blender (bpy)** pour :

1. Charger l’avatar riggé (`avatar.glb`)
2. Créer des keyframes pour le signe « bouche » (main vers la bouche)
3. Exporter l’animation en JSON (quaternions par frame) pour l’app web

### Lancer l’export en ligne de commande

Depuis la racine du projet `voice-to-sign` :

```bash
blender avatar/avatar.glb --background --python blender_scripts/export_bouche_animation.py
```

Le fichier généré est : `translate/data/bouche_animation.json`.

### Depuis l’interface Blender

1. Ouvrir Blender, importer `avatar/avatar.glb` (File > Import > glTF 2.0).
2. Ouvrir l’onglet **Scripting**.
3. Charger le script `export_bouche_animation.py`.
4. Modifier si besoin la variable `output_path` à la fin du script.
5. Exécuter le script (bouton Run). Le JSON est écrit dans `translate/data/bouche_animation.json`.

### Format JSON

Le JSON est au format attendu par l’app (voir `playVideoMotion` dans `app.js`) :

- `duration` : durée en secondes
- `fps` : images par seconde
- `tracks` : pour chaque os canonique (`RightArm`, `RightHand`, etc.), `times` et `quaternions` (liste de [x, y, z, w])

Les noms d’os doivent correspondre au rig (ex. Mixamo : `mixamorigRightArm`, etc.). Le script fait la correspondance via des motifs.
