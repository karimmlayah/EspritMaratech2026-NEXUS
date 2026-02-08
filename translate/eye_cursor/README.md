# Curseur piloté par les yeux (optionnel)

Fonctionnalité **optionnelle** pour les utilisateurs qui ne peuvent pas utiliser la souris. Le regard pilote le curseur ; fermer les deux yeux = clic. Touche **Q** pour fermer la fenêtre.

## Utilisation depuis l’interface

1. Ouvrir **Paramètres** (icône engrenage).
2. Section **« Curseur piloté par les yeux »** : lire l’instruction puis cliquer sur **« Ouvrir le curseur piloté par les yeux »**.
3. Une fenêtre vidéo s’ouvre ; le curseur suit le regard. Fermer les deux yeux pour cliquer.

## Utilisation en ligne de commande

Depuis ce dossier :

```bash
pip install -r requirements.txt
python main.py
```

Au premier lancement, le modèle MediaPipe Face Landmarker est téléchargé automatiquement (`face_landmarker.task`).

## Dépendances

- opencv-python
- mediapipe >= 0.10
- pyautogui

Tout le code est contenu dans ce dossier ; le reste de l’application n’est pas modifié.
