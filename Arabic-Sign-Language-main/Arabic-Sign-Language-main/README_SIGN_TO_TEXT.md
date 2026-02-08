# Sign to Text - Langue des signes arabe

Reconnaissance en direct des signes de la langue arabe via la webcam. Les lettres reconnues s'affichent en arabe à l'écran.

## Prérequis

- **Python 3.7 ou 3.8** (recommandé pour TensorFlow 2.4)
- **Webcam**
- **Windows** : [CMake](https://cmake.org/download/) installé et dans le PATH (nécessaire pour installer `dlib`)

## Installation

1. Ouvrir un terminal dans ce dossier :
   ```
   cd "d:\voice-to-sign\Arabic-Sign-Language-main\Arabic-Sign-Language-main"
   ```

2. Créer un environnement virtuel (recommandé) :
   ```
   python -m venv venv
   venv\Scripts\activate
   ```

3. Installer les dépendances :
   ```
   pip install -r requirements.txt
   ```

   Si `dlib` échoue sous Windows, installez d’abord les [outils de build Visual C++](https://visualstudio.microsoft.com/visual-cpp-build-tools/) puis réessayez, ou utilisez une wheel précompilée pour votre version de Python.

4. **Protobuf** : si vous voyez `TypeError: Descriptors cannot be created directly` au lancement, installez une version compatible :
   ```
   pip install "protobuf>=3.19,<4"
   ```
   Idéalement, faites l’installation dans un **environnement virtuel** (étape 2) pour éviter les conflits.

## Exécution

### Option 1 : Script complet (détection main + reconnaissance)

Double-cliquez sur **`run_sign_to_text.bat`** ou en ligne de commande :

```
python ASL_detection_landmark.py -src 0 -nhands 1 -display 1 -fps 1
```

- **`-src 0`** : caméra par défaut (changez en 1, 2… pour une autre caméra)
- **`-nhands 1`** : nombre de mains à détecter
- **`-display 1`** : afficher les fenêtres (0 = pas d’affichage)
- **`-fps 1`** : afficher les FPS

Quitter : appuyer sur **`q`** dans une des fenêtres.

### Option 2 : Test simple (zone fixe, sans détection de main)

Double-cliquez sur **`run_simple_test.bat`** ou :

```
python simple_test.py
```

Une zone fixe (rectangle vert) est utilisée ; placez votre main dans ce cadre. Touche **Échap** pour quitter.

## Fichiers importants

| Fichier / Dossier | Rôle |
|-------------------|------|
| `models/asl_model.h5` | Modèle Keras (lettres arabe) |
| `models/frozen_inference_graph.pb` | Détection de la main (TensorFlow) |
| `landmarks/shape_predictor_68_face_landmarks.dat` | Landmarks visage (déjà présent) |
| `fonts/Sahel.ttf` | Police pour l’affichage arabe |

## Intégration dans votre projet voice-to-sign

Pour ajouter la fonctionnalité **Sign to Text** dans l’app `translate` :

1. Exposer une API (Flask/FastAPI) dans ce dossier qui prend une image ou un flux vidéo et renvoie la lettre/le texte reconnu.
2. Depuis le front (translate), appeler cette API (par exemple après capture d’une image depuis la webcam) et afficher le résultat.

Si vous voulez, je peux vous proposer un petit serveur Flask et les appels côté `translate` pour brancher Sign to Text dans votre interface.
