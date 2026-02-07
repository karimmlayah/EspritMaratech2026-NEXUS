// ================================
// CONFIGURATION GLOBALE
// ================================
// Dictionnaire tunisien → français (dictionary.js) en priorité
// Groq LLM en repli si non trouvé dans le dictionnaire
const GROQ_API_KEY = "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";
const GROQ_MODEL = "llama-3.3-70b-versatile";
// Gemini - extraction des concepts pour les signes
const GEMINI_API_KEY = "AIzaSyBXoB-mg-yiB2kwhv2jgHvhNdFejlBq0gM";
const GEMINI_MODEL = "gemini-1.5-flash";

// ================================
// SETUP THREE.JS AVATAR (stylized_girl_readyplayerme_avatar_3d_model.glb)
// ================================
let scene, camera, renderer, avatar, mixer, clock;

function getSceneContainer() {
  return document.getElementById("scene");
}

/** Affiche la zone avatar et charge la scène si besoin (comme le template : pas d’avatar au départ). */
function ensureAvatarReady() {
  var wrap = document.getElementById("sceneAndVideoWrap") || document.querySelector(".scene-and-video-wrap");
  var sceneEl = document.getElementById("scene");
  if (wrap) wrap.classList.add("has-content");
  if (sceneEl) sceneEl.classList.remove("scene-container--hidden");
  if (typeof THREE !== "undefined" && THREE.GLTFLoader && !avatar && !scene) {
    initScene();
    if (typeof animate === "function") animate();
  }
}

function hideSceneLoading() {
  const el = document.getElementById("scene-loading");
  if (el) el.style.display = "none";
}

function showSceneError(msg) {
  const container = getSceneContainer();
  if (!container) return;
  let el = document.getElementById("scene-error");
  if (!el) {
    el = document.createElement("div");
    el.id = "scene-error";
    el.className = "scene-error";
    container.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = "block";
}

function initScene() {
  const container = getSceneContainer();
  if (!container) return;
  // Attendre que le conteneur ait des dimensions (layout prêt)
  const w = Math.max(container.clientWidth || 400, 300);
  const h = Math.max(container.clientHeight || 380, 300);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2a);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
  camera.position.set(0, 1.2, 2.8);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else if (renderer.outputEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;

  const existingCanvas = container.querySelector("canvas");
  if (existingCanvas) existingCanvas.remove();
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(3, 4, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);
  const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
  backLight.position.set(-2, 1, -2);
  scene.add(backLight);

  clock = new THREE.Clock();
  const loader = new THREE.GLTFLoader();

  // URL absolue quand on est sur le serveur Flask, relative sinon (file://)
  const isHttp = window.location.origin && window.location.origin.startsWith("http");
  const avatarFileName = "michel_v3.glb";
  const avatarUrl = isHttp
    ? window.location.origin + "/avatar/" + avatarFileName
    : new URL("../avatar/" + avatarFileName, window.location.href).href;

  let loadTimeoutId = null;

  function onAvatarLoaded(gltf) {
    if (loadTimeoutId) clearTimeout(loadTimeoutId);
    loadTimeoutId = null;
    hideSceneLoading();
    if (avatar && avatar.parent) avatar.parent.remove(avatar);
    avatar = gltf.scene;
    scene.add(avatar);
    const box = new THREE.Box3().setFromObject(avatar);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    avatar.position.sub(center);
    avatar.scale.setScalar(1.5 / maxDim);
    avatar.position.y = -0.5;
    avatar.traverse(function (child) {
      if (child.isMesh && child.material) {
        child.material.depthWrite = true;
        if (Array.isArray(child.material)) child.material.forEach(m => { m.depthWrite = true; });
      }
    });
    mixer = new THREE.AnimationMixer(avatar);
    avatar.userData.baseScale = avatar.scale.x;
    if (gltf.animations && gltf.animations.length > 0) {
      avatar.userData.animations = gltf.animations;
      console.log("Avatar: animations disponibles =", gltf.animations.map(function (a) { return a.name; }));
    } else {
      avatar.userData.animations = [];
    }
    // Animations procédurales (mains, bras) sans clips dans le .glb
    buildProceduralSignAnimations(avatar);
    // Skeleton POC: detect all bones, build bones map, log names
    buildSkeletonBonesMap(avatar);
    if (window.pendingConceptsForAvatar && window.pendingConceptsForAvatar.length > 0) {
      var pending = window.pendingConceptsForAvatar;
      window.pendingConceptsForAvatar = null;
      animateAvatarWithConcepts(pending);
    }
  }

  function onAvatarFailed(msg) {
    if (loadTimeoutId) clearTimeout(loadTimeoutId);
    loadTimeoutId = null;
    hideSceneLoading();
    showSceneError(msg || "Avatar non chargé.");
    createPlaceholderAvatar();
  }

  // Chargement direct avec GLTFLoader.load (évite problèmes fetch/CORS)
  function doLoad() {
    loader.load(
      avatarUrl,
      onAvatarLoaded,
      function (xhr) {
        if (xhr.lengthComputable && xhr.total > 0) {
          const pct = Math.round((xhr.loaded / xhr.total) * 100);
          var el = document.getElementById("scene-loading");
          if (el) el.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i> Chargement de l'avatar… " + pct + "%";
        }
      },
      function (err) {
        console.error("Erreur chargement avatar:", err);
        onAvatarFailed(err && err.message ? err.message : "Impossible de charger l'avatar. Vérifiez l'onglet Réseau.");
      }
    );
  }

  // Démarrer après un court délai pour que le layout soit prêt
  setTimeout(doLoad, 150);

  loadTimeoutId = setTimeout(function () {
    if (avatar) return;
    loadTimeoutId = null;
    hideSceneLoading();
    showSceneError("Délai dépassé. Vérifiez que le serveur Flask tourne et que avatar/" + avatarFileName + " existe.");
    createPlaceholderAvatar();
  }, 12000);
}

function createPlaceholderAvatar() {
  hideSceneLoading();
  const g = new THREE.BoxGeometry(0.5, 1, 0.3);
  const m = new THREE.MeshPhongMaterial({ color: 0x0d9488 });
  avatar = new THREE.Mesh(g, m);
  avatar.position.set(0, -0.3, 0);
  avatar.userData.baseScale = 1;
  scene.add(avatar);
}

// ================================
// ANIMATIONS PROCÉDURALES (mains, bras) sans fichiers d'animation
// ================================
function getPathToBone(root, target) {
  if (root === target) return root.name || "root";
  for (var i = 0; i < root.children.length; i++) {
    var sub = getPathToBone(root.children[i], target);
    if (sub) return (root.name || "node") + "/" + sub;
  }
  return null;
}

function collectBones(root) {
  var list = [];
  root.traverse(function (obj) {
    if (obj.type === "Bone" || (obj.isBone !== undefined && obj.isBone)) list.push(obj);
  });
  if (list.length === 0) {
    root.traverse(function (obj) {
      if (obj.skeleton && obj.skeleton.bones) {
        for (var i = 0; i < obj.skeleton.bones.length; i++) list.push(obj.skeleton.bones[i]);
      }
    });
  }
  return list;
}

function findBoneByPattern(bones, root, patterns) {
  for (var i = 0; i < bones.length; i++) {
    var name = (bones[i].name || "").toLowerCase();
    for (var p = 0; p < patterns.length; p++) {
      if (name.indexOf(patterns[p]) !== -1) return bones[i];
    }
  }
  return bones.length ? bones[0] : null;
}

/**
 * Find a bone whose name contains ALL of the given patterns (e.g. "right" + "index").
 * Used for logical names like Index_R -> right hand index finger bone.
 */
function findBoneByAllPatterns(bones, patterns) {
  for (var i = 0; i < bones.length; i++) {
    var name = (bones[i].name || "").toLowerCase();
    var allMatch = true;
    for (var p = 0; p < patterns.length; p++) {
      if (name.indexOf(patterns[p].toLowerCase()) === -1) { allMatch = false; break; }
    }
    if (allMatch) return bones[i];
  }
  return null;
}

var CANONICAL_BONE_PATTERNS = {
  RightArm: ["rightarm", "right_arm", "mixamorigrightarm", "r_arm", "bracedroite"],
  LeftArm: ["leftarm", "left_arm", "mixamorigleftarm", "l_arm", "brasgauche"],
  RightForeArm: ["rightforearm", "right_forearm", "mixamorigrightforearm", "r_forearm"],
  LeftForeArm: ["leftforearm", "left_forearm", "mixamorigleftforearm", "l_forearm"],
  RightHand: ["righthand", "right_hand", "mixamorigrighthand", "maindroite"],
  LeftHand: ["lefthand", "left_hand", "mixamoriglefthand", "maingauche"]
};

function buildBoneMap(avatarRoot) {
  var bones = collectBones(avatarRoot);
  if (bones.length === 0) return;
  var map = {};
  for (var canonical in CANONICAL_BONE_PATTERNS) {
    var b = findBoneByPattern(bones, avatarRoot, CANONICAL_BONE_PATTERNS[canonical]);
    if (b) map[canonical] = b;
  }
  avatarRoot.userData.canonicalBones = map;
}

// ================================
// SKELETON-BASED SIGN SYSTEM (POC)
// ================================
// Each sign is defined as DATA (JSON): bone name -> Euler rotations (x, y, z in radians).
// This is scalable to thousands of signs without creating animations in Blender.
// For the jury: we avoid manual animation authoring; signs are data-driven.

/** Logical bone name -> list of substrings that must all appear in the real bone name (e.g. Mixamo). */
var LOGICAL_BONE_PATTERNS = {
  Index_R: ["right", "index"],
  Middle_R: ["right", "middle"],
  Ring_R: ["right", "ring"],
  Pinky_R: ["right", "pinky"],
  Thumb_R: ["right", "thumb"],
  Index_L: ["left", "index"],
  Middle_L: ["left", "middle"],
  Ring_L: ["left", "ring"],
  Pinky_L: ["left", "pinky"],
  Thumb_L: ["left", "thumb"],
  RightHand: ["right", "hand"],
  LeftHand: ["left", "hand"],
  RightForeArm: ["right", "forearm"],
  LeftForeArm: ["left", "forearm"],
  RightArm: ["right", "arm"],
  LeftArm: ["left", "arm"]
};

/**
 * After loading the avatar: detect ALL bones, store in a map by name, build logical map,
 * store rest pose for reset, and log all bone names to the console.
 */
function buildSkeletonBonesMap(avatarRoot) {
  var bones = collectBones(avatarRoot);
  if (bones.length === 0) return;

  // 1) Map: actual bone name -> bone reference
  var bonesMap = {};
  for (var i = 0; i < bones.length; i++) {
    var b = bones[i];
    var name = b.name || ("bone_" + i);
    bonesMap[name] = b;
    // Store rest quaternion so we can reset pose later
    b.userData.restQuaternion = b.quaternion.clone();
  }
  avatarRoot.userData.bonesMap = bonesMap;

  // 2) Map: logical name (e.g. Index_R) -> bone (for SIGN_DATA keys)
  var logicalBones = {};
  for (var logical in LOGICAL_BONE_PATTERNS) {
    var bone = findBoneByAllPatterns(bones, LOGICAL_BONE_PATTERNS[logical]);
    if (bone) logicalBones[logical] = bone;
  }
  avatarRoot.userData.logicalBones = logicalBones;

  // 3) Log all bone names for debugging / jury
  var allNames = Object.keys(bonesMap);
  console.log("[Skeleton POC] All bone names (" + allNames.length + "):", allNames);
  console.log("[Skeleton POC] Logical bones mapped:", Object.keys(logicalBones));
}

/**
 * Sign definitions as DATA (JSON). Each sign: bone key -> { x, y, z } Euler rotations in radians.
 * Bone keys can be logical names (Index_R, etc.) or actual bone names from the .glb.
 * Missing bones are skipped gracefully. Scalable to thousands of signs without Blender animations.
 */
var SIGN_DATA = {
  POINT: {
    Index_R: { x: 0, y: 0, z: 0 },
    Middle_R: { x: 1.2, y: 0, z: 0 },
    Ring_R: { x: 1.2, y: 0, z: 0 },
    Pinky_R: { x: 1.2, y: 0, z: 0 },
    RightHand: { x: 0.2, y: 0, z: 0 }
  },
  OPEN_HAND: {
    Index_R: { x: 0, y: 0, z: 0 },
    Middle_R: { x: 0, y: 0, z: 0 },
    Ring_R: { x: 0, y: 0, z: 0 },
    Pinky_R: { x: 0, y: 0, z: 0 },
    Thumb_R: { x: 0, y: 0, z: 0 },
    RightHand: { x: 0, y: 0, z: 0 },
    LeftHand: { x: 0, y: 0, z: 0 }
  },
  /** Pose « bouche » : main droite vers le visage (comme dans la vidéo AVST anatomie). */
  BOUCHE: {
    RightArm: { x: 0.85, y: -0.15, z: 0.1 },
    RightForeArm: { x: 1.35, y: 0, z: 0 },
    RightHand: { x: 0, y: 0, z: 0 }
  },
  REST: {}
};

/**
 * Applies a sign pose by setting bone rotations from SIGN_DATA. Uses only bone rotations (no AnimationMixer).
 * Always resets to rest pose first so POINT and OPEN_HAND don't stack into a broken pose.
 */
function playSignPose(signName) {
  ensureAvatarReady();
  if (!avatar) return;
  if (signName === "REST" || !signName) {
    playRestPose();
    return;
  }
  if (signName === "BOUCHE" && mixer && avatar.userData.proceduralClips && avatar.userData.proceduralClips.SIGN_BOUCHE) {
    mixer.clipAction(avatar.userData.proceduralClips.SIGN_BOUCHE).reset().play();
    var currentEl = document.getElementById("currentSign");
    if (currentEl) currentEl.textContent = "Pose : BOUCHE (animation)";
    return;
  }
  var pose = SIGN_DATA[signName];
  if (!pose) {
    console.warn("[Skeleton POC] Unknown sign:", signName);
    return;
  }
  playRestPose();
  if (!avatar.userData.bonesMap) return;

  var logicalBones = avatar.userData.logicalBones || {};
  var bonesMap = avatar.userData.bonesMap || {};

  for (var key in pose) {
    var bone = logicalBones[key] || bonesMap[key];
    if (!bone) continue;
    var r = pose[key];
    bone.quaternion.setFromEuler(new THREE.Euler(r.x, r.y, r.z));
  }

  var currentEl = document.getElementById("currentSign");
  if (currentEl) currentEl.textContent = "Pose : " + signName;
}

/**
 * Restore all bones to their rest pose (as stored when the avatar was loaded).
 */
function playRestPose() {
  if (!avatar || !avatar.userData.bonesMap) return;
  var bonesMap = avatar.userData.bonesMap;
  for (var name in bonesMap) {
    var bone = bonesMap[name];
    if (bone.userData.restQuaternion) bone.quaternion.copy(bone.userData.restQuaternion);
  }
  var currentEl = document.getElementById("currentSign");
  if (currentEl) currentEl.textContent = "Prêt";
}

function buildProceduralSignAnimations(avatarRoot) {
  var bones = collectBones(avatarRoot);
  if (bones.length === 0) return;
  buildBoneMap(avatarRoot);
  var rightArm = (avatarRoot.userData.canonicalBones && avatarRoot.userData.canonicalBones.RightArm) || findBoneByPattern(bones, avatarRoot, CANONICAL_BONE_PATTERNS.RightArm);
  var leftArm = (avatarRoot.userData.canonicalBones && avatarRoot.userData.canonicalBones.LeftArm) || findBoneByPattern(bones, avatarRoot, CANONICAL_BONE_PATTERNS.LeftArm);
  var rightForeArm = (avatarRoot.userData.canonicalBones && avatarRoot.userData.canonicalBones.RightForeArm) || findBoneByPattern(bones, avatarRoot, CANONICAL_BONE_PATTERNS.RightForeArm);
  var rightHand = (avatarRoot.userData.canonicalBones && avatarRoot.userData.canonicalBones.RightHand) || findBoneByPattern(bones, avatarRoot, CANONICAL_BONE_PATTERNS.RightHand);
  var boneToAnimate = rightArm || leftArm || rightHand || bones[0];
  var path = getPathToBone(avatarRoot, boneToAnimate);
  if (!path) return;

  var duration = 1.6;
  var times = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration];
  var restQ = boneToAnimate.quaternion.clone();
  var qWave1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6, 0, 0.2));
  var qWave2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0.1));
  var v0 = restQ.toArray();
  var v1 = restQ.clone().multiply(qWave1).toArray();
  var v2 = restQ.clone().multiply(qWave2).toArray();
  var values = [].concat(v0, v1, v0, v2, v0);
  var track = new THREE.QuaternionKeyframeTrack(path + ".quaternion", times, values);
  var clipWave = new THREE.AnimationClip("ProceduralWave", duration, [track]);

  var clipThanks = new THREE.AnimationClip("ProceduralThanks", duration, [
    new THREE.QuaternionKeyframeTrack(path + ".quaternion", [0, duration * 0.5, duration], [].concat(v0, restQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0.3, 0))).toArray(), v0))
  ]);

  var clipBouche = null;
  if (rightArm && rightForeArm) {
    var pathRA = getPathToBone(avatarRoot, rightArm);
    var pathRFA = getPathToBone(avatarRoot, rightForeArm);
    if (pathRA && pathRFA) {
      var durBouche = 2.2;
      var t = [0, 0.4, 0.85, 1.25, 1.6, durBouche];
      var restRA = rightArm.quaternion.clone();
      var restRFA = rightForeArm.quaternion.clone();
      var qBoucheRA = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.85, -0.15, 0.1));
      var qBoucheRFA = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.35, 0, 0));
      var qBoucheRA2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, -0.1, 0.08));
      var qBoucheRFA2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.4, 0.02, 0));
      var valRA = [].concat(
        restRA.toArray(),
        restRA.clone().slerp(qBoucheRA, 0.5).toArray(),
        qBoucheRA.toArray(),
        qBoucheRA2.toArray(),
        qBoucheRA.clone().toArray(),
        restRA.toArray()
      );
      var valRFA = [].concat(
        restRFA.toArray(),
        restRFA.clone().slerp(qBoucheRFA, 0.5).toArray(),
        qBoucheRFA.toArray(),
        qBoucheRFA2.toArray(),
        qBoucheRFA.toArray(),
        restRFA.toArray()
      );
      clipBouche = new THREE.AnimationClip("ProceduralBouche", durBouche, [
        new THREE.QuaternionKeyframeTrack(pathRA + ".quaternion", t, valRA),
        new THREE.QuaternionKeyframeTrack(pathRFA + ".quaternion", t, valRFA)
      ]);
    }
  }

  avatarRoot.userData.proceduralClips = {
    SIGN_HELLO: clipWave,
    SIGN_THANKS: clipThanks,
    SIGN_GO: clipWave,
    SIGN_HELP: clipWave,
    SIGN_YES: clipThanks,
    SIGN_NO: clipWave,
    SIGN_BOUCHE: clipBouche || clipWave
  };
  console.log("Avatar: animations procédurales (mains/bras) créées pour", Object.keys(avatarRoot.userData.proceduralClips));
}

// ================================
// LECTURE MOUVEMENT DEPUIS VIDÉO (modèle: vidéo signe → mouvement avatar)
// ================================
var videoMotionData = null;
var videoMotionStartTime = 0;

/** Modèle .glb temporaire (ex. aisselle.glb) affiché pendant son animation. */
var tempGlbModel = null;
var tempGlbMixer = null;

function sampleQuaternionAtTime(track, t) {
  var times = track.times;
  var quats = track.quaternions;
  if (!times || !quats || times.length === 0) return null;
  if (t <= times[0]) return quats[0];
  if (t >= times[times.length - 1]) return quats[quats.length - 1];
  var i = 0;
  while (i + 1 < times.length && times[i + 1] < t) i++;
  var t0 = times[i];
  var t1 = times[i + 1];
  var u = (t - t0) / (t1 - t0 || 1e-6);
  var q0 = new THREE.Quaternion(quats[i][0], quats[i][1], quats[i][2], quats[i][3]);
  var q1 = new THREE.Quaternion(quats[i + 1][0], quats[i + 1][1], quats[i + 1][2], quats[i + 1][3]);
  var q = new THREE.Quaternion().copy(q0).slerp(q1, u);
  return [q.x, q.y, q.z, q.w];
}

/** Retourne l'os canonique (RightArm, etc.) depuis l'avatar pour appliquer l'animation Three.js. */
function getCanonicalBone(avatarRoot, boneName) {
  var canonical = avatarRoot.userData.canonicalBones;
  if (canonical && canonical[boneName]) return canonical[boneName];
  var bones = collectBones(avatarRoot);
  if (bones.length === 0) return null;
  var patterns = CANONICAL_BONE_PATTERNS[boneName];
  if (patterns) return findBoneByPattern(bones, avatarRoot, patterns);
  return null;
}

function updateVideoMotionPlayback() {
  if (!videoMotionData || !avatar || !clock) return;
  if (videoMotionData._paused) return;
  var elapsed = clock.getElapsedTime() - videoMotionStartTime;
  if (elapsed >= videoMotionData.duration) {
    videoMotionData = null;
    playRestPose();
    var el = document.getElementById("currentSign");
    if (el) el.textContent = "Prêt";
    return;
  }
  var tracks = videoMotionData.tracks || {};
  for (var boneName in tracks) {
    var bone = getCanonicalBone(avatar, boneName);
    if (!bone) continue;
    var q = sampleQuaternionAtTime(tracks[boneName], elapsed);
    if (!q) continue;
    bone.quaternion.set(q[0], q[1], q[2], q[3]);
    bone.updateMatrix();
  }
  avatar.updateMatrixWorld(true);
}

/**
 * Convertit un JSON avec frames[].pose_landmarks (MediaPipe Pose, 33 points)
 * en format tracks pour playVideoMotion.
 * Mapping Pose -> body 9 points: 0=nose, 11=L_shoulder, 12=R_shoulder, 13=L_elbow, 14=R_elbow, 15=L_wrist, 16=R_wrist, 23=L_hip, 24=R_hip.
 */
function poseLandmarksJsonToTracks(motion) {
  var frames = motion.frames;
  if (!frames || !frames.length || !frames[0].pose_landmarks) return null;
  var meta = motion.metadata || {};
  var fps = meta.fps != null ? meta.fps : (motion.fps != null ? motion.fps : 30);
  var duration = meta.duration_sec != null ? meta.duration_sec
    : (motion.duration_sec != null ? motion.duration_sec
    : (motion.duration != null ? motion.duration : (meta.total_frames / fps)));
  var poseToBodyIds = [0, 11, 12, 13, 14, 15, 16, 23, 24];
  var data = [];
  for (var i = 0; i < frames.length; i++) {
    var pl = frames[i].pose_landmarks;
    var byId = {};
    for (var k = 0; k < pl.length; k++) { byId[pl[k].id] = pl[k]; }
    var body = [];
    for (var b = 0; b < poseToBodyIds.length; b++) {
      var lm = byId[poseToBodyIds[b]];
      body.push(lm ? { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility != null ? lm.visibility : 1 } : null);
    }
    data.push({
      time: frames[i].timestamp != null ? frames[i].timestamp : i / fps,
      body: body
    });
  }
  return keypointsJsonToTracks({
    duration_sec: duration,
    fps: fps,
    data: data
  });
}

/**
 * Convertit un JSON keypoints (data[] ou frames[].body = 9 points: nez, épaules, coudes, poignets, hanches)
 * en format tracks { duration, tracks: { RightArm: {times, quaternions}, ... } } pour playVideoMotion.
 * Indices body: 0=nez, 1=L_épaule, 2=R_épaule, 3=L_coude, 4=R_coude, 5=L_poignet, 6=R_poignet, 7=L_hanche, 8=R_hanche.
 */
function keypointsJsonToTracks(keypointsJson) {
  var data = keypointsJson.data || keypointsJson.frames;
  if (!data || !data.length) return null;
  var duration = keypointsJson.duration_sec != null ? keypointsJson.duration_sec
    : (keypointsJson.duration != null ? keypointsJson.duration : (keypointsJson.total_frames / (keypointsJson.fps || 30)));
  var restArm = new THREE.Vector3(0, -1, 0);
  var restFore = new THREE.Vector3(0, -1, 0);
  var times = [];
  var quatsRightArm = [];
  var quatsLeftArm = [];
  var quatsRightFore = [];
  var quatsLeftFore = [];
  var prevQ = { rightArm: [0, 0, 0, 1], leftArm: [0, 0, 0, 1], rightFore: [0, 0, 0, 1], leftFore: [0, 0, 0, 1] };
  for (var i = 0; i < data.length; i++) {
    var t = data[i].time != null ? data[i].time : i / (keypointsJson.fps || 30);
    var body = data[i].body;
    if (!body || body.length < 7) continue;
    times.push(t);
    function pt(idx) {
      var p = body[idx];
      return p && p.visibility > 0.1 ? new THREE.Vector3(p.x, p.y, p.z) : null;
    }
    function dirQuat(fromIdx, toIdx, restDir, prev) {
      var a = pt(fromIdx);
      var b = pt(toIdx);
      if (!a || !b) return prev;
      var d = new THREE.Vector3().subVectors(b, a);
      var len = d.length();
      if (len < 1e-5) return prev;
      d.normalize();
      var q = new THREE.Quaternion().setFromUnitVectors(restDir, d);
      return [q.x, q.y, q.z, q.w];
    }
    prevQ.rightArm = dirQuat(2, 4, restArm, prevQ.rightArm);
    prevQ.leftArm = dirQuat(1, 3, restArm, prevQ.leftArm);
    prevQ.rightFore = dirQuat(4, 6, restFore, prevQ.rightFore);
    prevQ.leftFore = dirQuat(3, 5, restFore, prevQ.leftFore);
    quatsRightArm.push(prevQ.rightArm.slice());
    quatsLeftArm.push(prevQ.leftArm.slice());
    quatsRightFore.push(prevQ.rightFore.slice());
    quatsLeftFore.push(prevQ.leftFore.slice());
  }
  if (times.length === 0) return null;
  return {
    duration: duration,
    fps: keypointsJson.fps || 30,
    tracks: {
      RightArm: { times: times, quaternions: quatsRightArm },
      LeftArm: { times: times, quaternions: quatsLeftArm },
      RightForeArm: { times: times, quaternions: quatsRightFore },
      LeftForeArm: { times: times, quaternions: quatsLeftFore }
    }
  };
}

/**
 * Convertit un JSON "bone_rotations_euler" (metadata + animation.keyframes[].skeleton.bones avec pitch, yaw, roll en degrés)
 * en format tracks { duration, tracks } pour playVideoMotion.
 * Mapping: left_upper_arm->LeftArm, right_upper_arm->RightArm, left_forearm->LeftForeArm, right_forearm->RightForeArm.
 */
function eulerBonesJsonToTracks(json) {
  var keyframes = json.animation && json.animation.keyframes;
  if (!keyframes || !keyframes.length) return null;
  var duration = (json.metadata && json.metadata.duration_seconds != null) ? json.metadata.duration_seconds : 3.2;
  var toRad = Math.PI / 180;
  var boneMap = {
    left_upper_arm: "LeftArm",
    right_upper_arm: "RightArm",
    left_forearm: "LeftForeArm",
    right_forearm: "RightForeArm"
  };
  var tracks = {};
  for (var canon in boneMap) tracks[boneMap[canon]] = { times: [], quaternions: [] };
  for (var i = 0; i < keyframes.length; i++) {
    var kf = keyframes[i];
    var t = kf.time != null ? kf.time : i / (json.metadata && json.metadata.fps ? json.metadata.fps : 30);
    var bones = kf.skeleton && kf.skeleton.bones;
    if (!bones) continue;
    for (var name in boneMap) {
      var b = bones[name];
      if (!b || b.pitch == null) continue;
      var euler = new THREE.Euler(
        (b.pitch || 0) * toRad,
        (b.yaw != null ? b.yaw : 0) * toRad,
        (b.roll != null ? b.roll : 0) * toRad,
        "XYZ"
      );
      var q = new THREE.Quaternion().setFromEuler(euler);
      var canon = boneMap[name];
      tracks[canon].times.push(t);
      tracks[canon].quaternions.push([q.x, q.y, q.z, q.w]);
    }
  }
  var hasAny = false;
  for (var k in tracks) if (tracks[k].times.length) { hasAny = true; break; }
  if (!hasAny) return null;
  return { duration: duration, fps: (json.metadata && json.metadata.fps) || 30, tracks: tracks };
}

function playVideoMotion(motion) {
  if (!avatar || !motion) return;
  // Format "bone_rotations_euler" (metadata + animation.keyframes[].skeleton.bones)
  if (!motion.tracks && motion.animation && motion.animation.keyframes && (motion.metadata || motion.animation.keyframes[0].skeleton)) {
    var converted = eulerBonesJsonToTracks(motion);
    if (converted && converted.tracks) {
      motion = converted;
    }
  }
  // Si le JSON est au format MediaPipe pose (frames[].pose_landmarks), convertir en tracks
  if (!motion.tracks && motion.frames && motion.frames[0] && motion.frames[0].pose_landmarks) {
    motion = poseLandmarksJsonToTracks(motion);
    if (!motion || !motion.tracks) return;
  }
  // Si le JSON est au format keypoints (data[] ou frames[] avec body), convertir en tracks
  if (!motion.tracks) {
    var keypointsFrames = motion.data || motion.frames;
    if (keypointsFrames && Array.isArray(keypointsFrames) && keypointsFrames.length > 0 && keypointsFrames[0].body) {
      motion = keypointsJsonToTracks(motion);
      if (!motion || !motion.tracks) return;
    }
  }
  if (!motion.tracks) return;
  if (!avatar.userData.canonicalBones) buildBoneMap(avatar);
  if (mixer) mixer.stopAllAction();
  videoMotionData = motion;
  videoMotionStartTime = clock ? clock.getElapsedTime() : 0;
  var el = document.getElementById("currentSign");
  if (el) el.textContent = "Animation en cours…";
}

function uploadVideoAndMimic() {
  var input = document.getElementById("videoInput");
  if (!input || !input.files || !input.files[0]) {
    alert("Veuillez sélectionner une vidéo (langue des signes).");
    return;
  }
  var el = document.getElementById("videoMimicStatus");
  if (el) el.textContent = "Analyse de la vidéo…";
  var form = new FormData();
  form.append("video", input.files[0]);
  var apiBase = window.location.origin || "";
  fetch(apiBase + "/api/video_to_motion", { method: "POST", body: form })
    .then(function (r) {
      if (!r.ok) throw new Error(r.statusText);
      return r.json();
    })
    .then(function (motion) {
      if (el) el.textContent = "Mouvement reçu. Lecture sur l'avatar.";
      playVideoMotion(motion);
    })
    .catch(function (err) {
      if (el) el.textContent = "Erreur: " + (err.message || err);
      console.error("video_to_motion:", err);
    });
}

// ================================
// DICTIONNAIRE ANATOMIQUE AVST (vidéo + animation export Blender)
// ================================
// Termes qui ont une animation JSON (export Blender, keypoints, ou MediaPipe pose: frames[].pose_landmarks)
var ANATOMIE_ANIMATION_JSON = {
  bouche: "data/bouche (6).json",
  dents: "data/dents.json",
  oeil: "data/Oeils_animation.json",
  yeux: "data/Oeils_animation.json"
};

function onAnatomieTermSelected(value) {
  var videoEl = document.getElementById("dictionaryVideo");
  var captionEl = document.getElementById("dictionaryVideoCaption");
  if (!videoEl) return;
  if (!value) {
    videoEl.removeAttribute("src");
    videoEl.pause();
    if (captionEl) captionEl.textContent = "";
    return;
  }
  var apiBase = window.location.origin || "";
  var videoUrl = apiBase + "/api/dictionary/video/anatomie/" + encodeURIComponent(value);
  videoEl.src = videoUrl;
  if (captionEl) captionEl.textContent = "Signe : " + value.charAt(0).toUpperCase() + value.slice(1) + " (AVST)";
}

function playSelectedAnatomie() {
  var select = document.getElementById("anatomieSelect");
  var value = (select && select.value) || "";
  if (!value) {
    alert("Choisissez un terme anatomique.");
    return;
  }
  var videoEl = document.getElementById("dictionaryVideo");
  if (videoEl && videoEl.src) {
    videoEl.currentTime = 0;
    videoEl.play();
  }
  // Si une animation JSON existe pour ce terme (export Blender), la jouer sur l'avatar
  var jsonPath = ANATOMIE_ANIMATION_JSON[value];
  if (jsonPath && avatar) {
    var url = (window.location.origin + "/translate/" + jsonPath).split("/translate/translate").join("/translate");
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.statusText)); })
      .then(function (motion) {
        playVideoMotion(motion);
        var el = document.getElementById("currentSign");
        if (el) el.textContent = "Dictionnaire : " + value;
      })
      .catch(function (err) { console.warn("Animation Blender non chargée pour " + value + ":", err.message); });
  }
}

// ================================
// ANIMATIONS VIDÉOS (dossier animations/) : liste chargée depuis l’API, toutes affichées
// ================================
var ANIMATION_VIDEO_KEYS = ["analyse", "attention", "caisse_assurance_maladie", "CIN"];
var CONCEPT_TO_ANIMATION_KEY = {
  analyse: "analyse",
  attention: "attention",
  caisse: "caisse_assurance_maladie",
  assurance: "caisse_assurance_maladie",
  maladie: "caisse_assurance_maladie",
  "caisse_assurance_maladie": "caisse_assurance_maladie",
  cin: "CIN"
};
/** Toutes les clés vidéo chargées depuis /api/animations/list (pour matching concept + liste affichée) */
var allAnimationVideoKeys = [];
/** Une seule vidéo prioritaire : "langue des signes" → langue_des_signes.mp4 */
var LANGUE_DES_SIGNES_VIDEO_KEY = "langue_des_signes";
/** Mapping phrase normalisée → clé vidéo (fallback si la liste API n'est pas encore chargée) */
var PHRASE_TO_VIDEO_KEY = {
  "langue des signes": LANGUE_DES_SIGNES_VIDEO_KEY,
  "date de naissance": "date de naissance",
  "en pleine forme": "en pleine forme",
  "gel hydroalcoolique": "gel hydroalcoolique",
  "caisse nationale d assurance maladie": "caisse nationale d'assurance-maladie",
  "information et": "information_et",
  "implant cochleaire": "implant_cochleaire",
  "medicament": "medicament",
  "ordonnance medicale": "ordonnance_medical",
  "ordonnance médicale": "ordonnance_medical",
  "ou avez vous mal": "ou_avez_vous_mal",
  "où avez vous mal": "ou_avez_vous_mal",
  "poids": "poids",
  "positif negatif": "positif_-_negatif",
  "positif négatif": "positif_-_negatif",
  "problèmes de santé": "problèmes de santé",
  "problemes de sante": "problèmes de santé",
  "prévention": "prévention",
  "prevention": "prévention",
  "prénom et nom": "prénom et nom",
  "prenom et nom": "prénom et nom",
  "qu est ce qui est passé": "qu'est ce qui est passé",
  "quand": "quand",
  "rdv": "RDV",
  "question reponse": "question réponse",
  "question réponse": "question réponse",
  "responsabilite": "responsabilité",
  "responsabilité": "responsabilité",
  "relation sexuelle": "relation sexuelle",
  "regime amaigrissant": "régime amaigrissant",
  "régime amaigrissant": "régime amaigrissant",
  "sourd": "sourd",
  "solution": "solution",
  "sante": "sante",
  "santé": "sante",
  "salut ça va": "salut ça va ",
  "salut ca va": "salut ça va ",
  "resultat": "résultat",
  "résultat": "résultat",
  "stress": "stress",
  "vitamine": "vitamine",
  "vaccin": "vaccin",
  "taille": "taille"
};

/** Concepts qui déclenchent l’affichage d’une animation .glb (dossier animations/). */
var CONCEPT_TO_GLB_ANIMATION = { aisselle: "aisselle" };

function normalizePhraseForVideoMatch(s) {
  return String(s).toLowerCase().trim().replace(/[\s_'-]+/g, " ").replace(/\s+/g, " ").replace(/[^\wàâäéèêëïîôùûüç\s]/g, "").replace(/\s+/g, " ").trim();
}
function normalizeVideoKeyForMatch(key) {
  return String(key).replace(/[_'-]/g, " ").replace(/-/g, " ").toLowerCase().trim().replace(/\s+/g, " ");
}
function foldAccents(s) {
  return String(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function videoMatchPhraseToKey(normPhrase, key) {
  var normKey = normalizeVideoKeyForMatch(key);
  if (normPhrase === normKey) return true;
  if (foldAccents(normPhrase) === foldAccents(normKey)) return true;
  return false;
}
function isLangueDesSignesPhrase(normPhrase) {
  return normPhrase === "langue des signes" || foldAccents(normPhrase) === "langue des signes";
}
function getAnimationKeyForConceptPhrase(concepts, startIndex) {
  if (!concepts || startIndex >= concepts.length) return null;
  var maxLen = Math.min(6, concepts.length - startIndex);
  for (var len = maxLen; len >= 1; len--) {
    var phrase = concepts.slice(startIndex, startIndex + len).join(" ");
    var normPhrase = normalizePhraseForVideoMatch(phrase);
    if (!normPhrase) continue;
    if (isLangueDesSignesPhrase(normPhrase)) return { key: LANGUE_DES_SIGNES_VIDEO_KEY, length: len };
    var staticKey = PHRASE_TO_VIDEO_KEY[normPhrase];
    if (staticKey) return { key: staticKey, length: len };
    for (var i = 0; i < allAnimationVideoKeys.length; i++) {
      var key = allAnimationVideoKeys[i];
      if (videoMatchPhraseToKey(normPhrase, key)) return { key: key, length: len };
    }
  }
  return null;
}
function getAnimationKeyForConcept(concept) {
  if (!concept) return null;
  var n = normalizeConcept(concept);
  var fromMap = CONCEPT_TO_ANIMATION_KEY[n] || (ANIMATION_VIDEO_KEYS.indexOf(n) !== -1 ? n : null);
  if (fromMap) return fromMap;
  for (var i = 0; i < allAnimationVideoKeys.length; i++) {
    var key = allAnimationVideoKeys[i];
    if (normalizeConcept(key) === n) return key;
    if (normalizeVideoKeyForMatch(key) === normalizePhraseForVideoMatch(concept)) return key;
  }
  return null;
}

function getGlbAnimationKeyForConcept(concept) {
  if (!concept) return null;
  var n = normalizeConcept(concept);
  return CONCEPT_TO_GLB_ANIMATION[n] || null;
}

function showVideoInAvatarZone(key) {
  var wrap = document.getElementById("sceneAndVideoWrap") || document.querySelector(".scene-and-video-wrap");
  var placeholder = document.getElementById("videoPlaceholder");
  var brightnessWrap = document.getElementById("videoBrightnessWrap");
  var videoEl = document.getElementById("avatarZoneVideo");
  if (!wrap || !videoEl) return;
  if (placeholder) placeholder.style.display = "none";
  if (brightnessWrap) brightnessWrap.style.display = "block";
  wrap.classList.add("show-video");
  var apiBase = typeof getApiBase === "function" ? getApiBase() : (window.location.origin || "");
  videoEl.src = apiBase + "/api/animations/video/" + encodeURIComponent(key);
  videoEl.currentTime = 0;
  applyVideoSpeed(getVideoSpeed());
  applyVideoBrightness(getVideoBrightness());
  applyVideoRepeat(getVideoRepeat());
  setupVideoRepeatOnce(videoEl);
  videoEl.play();
}

function hideVideoInAvatarZone() {
  var wrap = document.getElementById("sceneAndVideoWrap") || document.querySelector(".scene-and-video-wrap");
  var placeholder = document.getElementById("videoPlaceholder");
  var brightnessWrap = document.getElementById("videoBrightnessWrap");
  var videoEl = document.getElementById("avatarZoneVideo");
  if (wrap) wrap.classList.remove("show-video");
  if (placeholder) placeholder.style.display = "block";
  if (brightnessWrap) brightnessWrap.style.display = "none";
  if (videoEl) {
    videoEl.pause();
    videoEl.removeAttribute("src");
  }
}

function getVideoSpeed() {
  var sel = document.getElementById("videoSpeedSelect");
  return sel ? parseFloat(sel.value) || 1 : 1;
}
function getVideoBrightness() {
  var rng = document.getElementById("videoBrightnessRange");
  return rng ? parseFloat(rng.value) || 1 : 1;
}
function getVideoRepeat() {
  var sel = document.getElementById("videoRepeatSelect");
  return sel ? sel.value : "none";
}

function applyVideoSpeed(value) {
  var videoEl = document.getElementById("avatarZoneVideo");
  if (videoEl) videoEl.playbackRate = parseFloat(value) || 1;
}

function applyVideoBrightness(value) {
  var v = parseFloat(value) || 1;
  var wrap = document.getElementById("videoBrightnessWrap");
  if (wrap) wrap.style.filter = "brightness(" + v + ")";
  var valEl = document.getElementById("videoBrightnessValue");
  if (valEl) valEl.textContent = Math.round(v * 100) + "%";
}

function applyVideoRepeat(value) {
  var videoEl = document.getElementById("avatarZoneVideo");
  if (!videoEl) return;
  if (value === "loop") {
    videoEl.loop = true;
  } else {
    videoEl.loop = false;
    if (value === "once") setupVideoRepeatOnce(videoEl);
  }
}

function setupVideoRepeatOnce(videoEl) {
  if (!videoEl || getVideoRepeat() !== "once") return;
  function replayOnce() {
    videoEl.removeEventListener("ended", replayOnce);
    videoEl.currentTime = 0;
    videoEl.play();
  }
  videoEl.addEventListener("ended", replayOnce);
}

/** Joue une vidéo dans la zone principale (clic sur la liste) — pas de chaîne « signe suivant ». */
function playVideoByKey(key) {
  showVideoInAvatarZone(key);
  var videoEl = document.getElementById("avatarZoneVideo");
  if (videoEl) videoEl.onended = null;
}

var _animationsVideoListPromise = null;
function getApiBase() {
  var o = window.location.origin;
  if (o && o !== "null" && (o.indexOf("http://") === 0 || o.indexOf("https://") === 0)) return o;
  return "http://127.0.0.1:5000";
}
function loadAnimationsVideoList() {
  if (_animationsVideoListPromise) return _animationsVideoListPromise;
  var apiBase = getApiBase();
  var listEl = document.getElementById("animationsVideoList");
  _animationsVideoListPromise = fetch(apiBase + "/api/animations/list")
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.status + " " + r.statusText)); })
    .then(function (data) {
      var videos = data.videos || [];
      allAnimationVideoKeys = videos.map(function (v) { return v.key; });
      if (listEl) {
        listEl.innerHTML = "";
        videos.forEach(function (v) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn-animation-video";
          btn.textContent = v.key;
          btn.title = "Lire : " + v.key;
          btn.addEventListener("click", function () { playVideoByKey(v.key); });
          listEl.appendChild(btn);
        });
      }
      return allAnimationVideoKeys;
    })
    .catch(function (err) {
      if (listEl) {
        listEl.innerHTML = "<p class=\"animations-list-error\">Impossible de charger la liste des vidéos.</p>" +
          "<p class=\"animations-list-help\">Ouvrez l'application via <strong>http://127.0.0.1:5000/translate/</strong> et lancez le serveur depuis le dossier translate : <code>python server.py</code></p>";
      }
      return [];
    });
  return _animationsVideoListPromise;
}
function ensureAnimationsVideoListLoaded() {
  return loadAnimationsVideoList();
}

function playGlbAnimationInAvatarZone(key, signNames, concepts, index) {
  ensureAvatarReady();
  if (!scene || typeof THREE === "undefined" || !THREE.GLTFLoader) {
    playFallbackSignAndNext(signNames, concepts, index);
    return;
  }
  if (avatar) avatar.visible = false;
  var apiBase = window.location.origin || "";
  var glbUrl = apiBase + "/api/animations/glb/" + encodeURIComponent(key);
  var loader = new THREE.GLTFLoader();
  loader.load(
    glbUrl,
    function (gltf) {
      if (tempGlbModel && tempGlbModel.parent) tempGlbModel.parent.remove(tempGlbModel);
      if (tempGlbMixer) tempGlbMixer = null;
      var model = gltf.scene;
      tempGlbModel = model;
      scene.add(model);
      var box = new THREE.Box3().setFromObject(model);
      var center = box.getCenter(new THREE.Vector3());
      var size = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z, 0.001);
      model.position.sub(center);
      model.scale.setScalar(1.5 / maxDim);
      model.position.y = -0.5;
      tempGlbMixer = new THREE.AnimationMixer(model);
      var clips = gltf.animations || [];
      var duration = 2;
      if (clips.length > 0) {
        var action = tempGlbMixer.clipAction(clips[0]);
        action.reset().play();
        duration = clips[0].duration;
      }
      setTimeout(function () {
        if (tempGlbModel && tempGlbModel.parent) tempGlbModel.parent.remove(tempGlbModel);
        tempGlbModel = null;
        tempGlbMixer = null;
        if (avatar) avatar.visible = true;
        playSignAtIndex(signNames, concepts, index + 1);
      }, Math.max(duration * 1000, 1800));
    },
    undefined,
    function () {
      if (avatar) avatar.visible = true;
      playFallbackSignAndNext(signNames, concepts, index);
    }
  );
}

function toggleAvatarPlayPause() {
  var videoEl = document.getElementById("avatarZoneVideo");
  var wrap = document.getElementById("sceneAndVideoWrap") || document.querySelector(".scene-and-video-wrap");
  var iconEl = document.getElementById("avatarPlayPauseIcon");
  var labelEl = document.getElementById("avatarPlayPauseLabel");
  if (videoEl && wrap && wrap.classList.contains("show-video")) {
    if (videoEl.paused) {
      videoEl.play();
      if (iconEl) { iconEl.className = "fas fa-pause"; }
      if (labelEl) labelEl.textContent = "Pause";
    } else {
      videoEl.pause();
      if (iconEl) { iconEl.className = "fas fa-play"; }
      if (labelEl) labelEl.textContent = "Play";
    }
    return;
  }
  if (avatar && videoMotionData) {
    if (videoMotionData._paused) {
      videoMotionData._paused = false;
      videoMotionStartTime = clock.getElapsedTime() - (videoMotionData._pausedAt || 0);
      if (iconEl) { iconEl.className = "fas fa-pause"; }
      if (labelEl) labelEl.textContent = "Pause";
    } else {
      videoMotionData._paused = true;
      videoMotionData._pausedAt = clock.getElapsedTime() - videoMotionStartTime;
      if (iconEl) { iconEl.className = "fas fa-play"; }
      if (labelEl) labelEl.textContent = "Play";
    }
    return;
  }
  if (iconEl) { iconEl.className = "fas fa-play"; }
  if (labelEl) labelEl.textContent = "Play";
}

function playAnimationSignInAvatarZone(key, signNames, concepts, index, advanceBy) {
  if (advanceBy == null) advanceBy = 1;
  var videoEl = document.getElementById("avatarZoneVideo");
  var done = false;
  function goNext() {
    if (done) return;
    done = true;
    if (videoEl) videoEl.onended = null;
    hideVideoInAvatarZone();
    playSignAtIndex(signNames, concepts, index + advanceBy);
  }
  showVideoInAvatarZone(key);
  if (videoEl) videoEl.onended = goNext;
  else setTimeout(goNext, 2500);
}

// ================================
// ANIMATIONS SQUELETTE (dossier skeletons/)
// ================================
// Liste des animations disponibles (remplie au chargement) pour associer concept -> fichier
var skeletonAnimationsList = [];
// Mapping concept normalisé -> nom de fichier (noms dans skeletons avec fautes de frappe / sans accents)
var CONCEPT_TO_SKELETON_FILE = {
  medicament: "mdicament.json", médicament: "mdicament.json",
  oeil: "Oeils.json", yeux: "Oeils.json", oeils: "Oeils.json", œil: "Oeils.json",
  epaule: "paule.json", épaule: "paule.json",
  fievre: "fivre.json", fièvre: "fivre.json",
  diabete: "diabte.json", diabète: "diabte.json",
  genétique: "gntique.json", génétique: "gntique.json",
  medicaux: "gants mdicaux.json", echographie: "chographie.json", échographie: "chographie.json",
  bequille: "bquille.json", béquille: "bquille.json",
  depression: "dpression.json", dépression: "dpression.json",
  resultat: "rsultat.json", résultat: "rsultat.json", resultats: "rsultat.json",
  allergie: "Allergie.json", bacteries: "bactries.json", bactéries: "bactries.json",
  brulure: "brulure d estomac.json", estomac: "brulure d estomac.json",
  bequille: "bquille.json", fatigue: "fatigu.json", fatigué: "fatigu.json",
  evanouissement: "envanouissement.json", évanouissement: "envanouissement.json",
  genetique: "gntique.json", hypertension: "hypertension leve.json",
  interprete: "interprte.json", interprète: "interprte.json",
  intestin: "intestin grle.json", grele: "intestin grle.json",
  ordonnance: "ordonnance mdical.json", medical: "ordonnance mdical.json",
  prenom: "prnom et nom.json", nom: "prnom et nom.json",
  problemes: "problmes de sant.json", santé: "sante.json", sante: "sante.json",
  prevention: "prvention.json", prévention: "prvention.json",
  regime: "rgime amaigrissant.json", amaigrissant: "rgime amaigrissant.json",
  responsabilite: "responsabilit.json", responsabilité: "responsabilit.json",
  evaluation: "valuation.json", évaluation: "valuation.json",
  masque: "masque mdical.json", oxygene: "masque  oxygne.json", oxygène: "masque  oxygne.json",
  negatif: "positif - ngatif.json", positif: "positif - ngatif.json",
  salut: "salut a va .json", medicaments: "mdicament.json"
};

function normalizeForSkeleton(s) {
  return String(s).toLowerCase().trim().replace(/[^\wàâäéèêëïîôùûüç]/g, "");
}

function stripAccents(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\w]/g, "");
}

function findSkeletonFileForConcept(concept) {
  if (!concept || !String(concept).trim()) return null;
  var key = normalizeForSkeleton(concept);
  var keyNoAccent = stripAccents(concept);
  if (CONCEPT_TO_SKELETON_FILE[key]) return CONCEPT_TO_SKELETON_FILE[key];
  if (CONCEPT_TO_SKELETON_FILE[keyNoAccent]) return CONCEPT_TO_SKELETON_FILE[keyNoAccent];
  for (var i = 0; i < skeletonAnimationsList.length; i++) {
    var lab = (skeletonAnimationsList[i].label || "").toLowerCase();
    var labNorm = lab.replace(/[^\wàâäéèêëïîôùûüç]/g, "");
    var labNoAccent = stripAccents(lab);
    if (labNorm === key || labNoAccent === keyNoAccent) return skeletonAnimationsList[i].id;
    if (key.length >= 3 && (labNoAccent.indexOf(keyNoAccent) === 0 || keyNoAccent.indexOf(labNoAccent) === 0)) return skeletonAnimationsList[i].id;
  }
  return null;
}

function ensureSkeletonListLoaded() {
  if (skeletonAnimationsList.length > 0) return Promise.resolve();
  var apiBase = window.location.origin || "";
  return fetch(apiBase + "/api/skeleton_animations/list")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      skeletonAnimationsList = data.animations || [];
      return skeletonAnimationsList;
    })
    .catch(function () { return []; });
}

function loadSkeletonAnimationsList() {
  var select = document.getElementById("skeletonSelect");
  var apiBase = window.location.origin || "";
  fetch(apiBase + "/api/skeleton_animations/list")
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var list = data.animations || [];
      skeletonAnimationsList = list;
      if (select) {
        select.innerHTML = "<option value=\"\">-- Choisir une animation --</option>";
        for (var i = 0; i < list.length; i++) {
          var opt = document.createElement("option");
          opt.value = list[i].id;
          opt.textContent = list[i].label || list[i].id;
          select.appendChild(opt);
        }
      }
    })
    .catch(function (err) {
      if (select) select.innerHTML = "<option value=\"\">Erreur chargement liste</option>";
      console.warn("skeleton_animations/list:", err);
    });
}

function playSkeletonAnimation() {
  var select = document.getElementById("skeletonSelect");
  var name = (select && select.value) || "";
  if (!name) {
    alert("Choisissez une animation dans la liste.");
    return;
  }
  if (!avatar) {
    alert("Avatar non chargé.");
    return;
  }
  var apiBase = window.location.origin || "";
  var url = apiBase + "/api/skeleton_animation?name=" + encodeURIComponent(name);
  var currentEl = document.getElementById("currentSign");
  if (currentEl) currentEl.textContent = "Chargement…";
  fetch(url)
    .then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || r.statusText); });
      return r.json();
    })
    .then(function (motion) {
      if (!motion.tracks) throw new Error("Format motion invalide");
      playVideoMotion(motion);
      if (currentEl) currentEl.textContent = "Squelette : " + (name.replace(".json", ""));
    })
    .catch(function (err) {
      if (currentEl) currentEl.textContent = "Prêt";
      alert("Erreur : " + (err.message || err));
      console.error("skeleton_animation:", err);
    });
}

// Animation de secours quand le .glb n'a pas de clips : mouvement visible (scale + rotation)
var signFallbackStart = 0;
var signFallbackDuration = 1.8;
var signFallbackBaseScale = 1;

function startFallbackSignAnimation() {
  if (!avatar) return;
  signFallbackBaseScale = avatar.userData && avatar.userData.baseScale > 0 ? avatar.userData.baseScale : avatar.scale.x;
  signFallbackStart = clock ? clock.getElapsedTime() : 0;
}

function animate() {
  requestAnimationFrame(animate);
  var dt = clock ? clock.getDelta() : 0.016;
  if (mixer) mixer.update(dt);
  if (tempGlbMixer) tempGlbMixer.update(dt);

  // Animation de secours (mouvement visible pour chaque signe si pas de clip dans le .glb)
  if (signFallbackStart > 0 && avatar && clock) {
    var elapsed = clock.getElapsedTime() - signFallbackStart;
    if (elapsed >= signFallbackDuration) {
      signFallbackStart = 0;
      avatar.scale.setScalar(signFallbackBaseScale);
      avatar.rotation.y = 0;
    } else {
      var t = elapsed / signFallbackDuration;
      var scaleFac = 1 + 0.25 * Math.sin(t * Math.PI);
      avatar.scale.setScalar(signFallbackBaseScale * scaleFac);
      avatar.rotation.y = 0.15 * Math.sin(t * Math.PI);
    }
  }

  updateVideoMotionPlayback();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

// ================================
// TRADUCTION : Dictionnaire puis Groq LLM
// ================================
function cleanTranslation(text) {
  let cleaned = (text || "")
    .replace(/^["']|["']$/g, "")
    .replace(/^(Traduction|Français|Réponse):\s*/i, "")
    .replace(/^🇫🇷\s*\w+:\s*/i, "")
    .replace(/\*\*/g, "")
    .trim();
  const firstLine = cleaned.split("\n")[0].trim();
  return firstLine || cleaned;
}

async function translateWithGroq(text) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: "Tu es un traducteur dialecte tunisien vers français. Réponds UNIQUEMENT par la traduction en français, sans explication ni préambule."
        },
        {
          role: "user",
          content: `Traduis en français (réponds uniquement par la traduction):\n\n${text}`
        }
      ],
      temperature: 0.3,
      max_tokens: 256
    })
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const msg = errBody.error?.message || errBody.error?.code || `Groq API ${response.status}`;
    throw new Error(msg);
  }
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Réponse Groq invalide");
  return cleanTranslation(raw.trim());
}

/**
 * Traduit le texte : d'abord dictionnaire (dictionary.js), si non trouvé ou partiel → Groq LLM.
 * Retourne { translation, source: "dictionary" | "groq" }.
 */
async function translateText(text) {
  if (typeof translateWithDictionary !== "function") {
    return { translation: await translateWithGroq(text), source: "groq" };
  }
  const result = translateWithDictionary(text);
  const fullyFound = result.usedDictionary && result.missing.length === 0 && result.translation;
  if (fullyFound) {
    return { translation: result.translation, source: "dictionary" };
  }
  const translation = await translateWithGroq(text);
  return { translation, source: "groq" };
}

// ================================
// ANALYSE DES CONCEPTS POUR LES SIGNES (GEMINI)
// ================================
async function extractConceptsForSigns(text) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Extrais les concepts clés du texte français pour la langue des signes.
Texte: "${text}"

Réponds UNIQUEMENT par un tableau JSON de mots-clés (verbes à l'infinitif, noms).
Exemple de format: ["bonjour", "aller", "hôpital", "aide"]`
            }]
          }],
          systemInstruction: {
            parts: [{
              text: "Tu extrais des concepts pour la langue des signes. Réponds uniquement par un tableau JSON, sans texte avant ou après. Exemple: [\"bonjour\", \"aide\"]"
            }]
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 150
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error("API " + response.status);
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      throw new Error("Réponse vide");
    }

    const jsonStr = (candidate.content.parts[0].text || "").trim();
    const match = jsonStr.match(/\[[\s\S]*?\]/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed.concepts) ? parsed.concepts : Object.values(parsed));

  } catch (err) {
    console.error("Erreur extraction concepts:", err);
    return text.toLowerCase()
               .replace(/[^\w\sàâäéèêëïîôùûüç]/g, " ")
               .split(/\s+/)
               .filter(function (word) { return word.length > 2; })
               .slice(0, 5);
  }
}

/** Pour un texte court (1–5 mots), extrait les mots comme concepts pour les signes. */
function getConceptsFromShortTranslation(translation) {
  if (!translation || !translation.trim()) return [];
  var words = translation.trim().toLowerCase()
    .replace(/[.?!,;:]/g, " ")
    .split(/\s+/)
    .filter(function (w) { return w.length > 1; });
  var out = [];
  for (var i = 0; i < words.length; i++) {
    var n = normalizeConcept(words[i]);
    if (n && out.indexOf(n) === -1) out.push(n);
  }
  return out.slice(0, 6);
}

// ================================
// PROCESSUS DE TRADUCTION COMPLET
// ================================
async function processFullTranslation() {
  const inputText = document.getElementById("textInput").value.trim();
  
  if (!inputText) {
    alert("Veuillez entrer du texte en dialecte tunisien");
    return;
  }
  
  // Afficher le texte tunisien (original)
  document.getElementById("originalText").textContent = inputText;
  
  // Activer l'état de chargement
  showLoading(true);
  
  try {
    // ÉTAPE 1: Traduction (dictionnaire puis Groq si non trouvé)
    const { translation, source } = await translateText(inputText);

    // Afficher la traduction française
    const sourceLabel = source === "dictionary" ? "dictionnaire" : "Groq";
    document.getElementById("translationResult").innerHTML =
      `<span class="translation-main">${translation}</span><span class="translation-source">${sourceLabel}</span>`;
    document.getElementById("translationResult").className = "lang-text translation-text success";
    
    // ÉTAPE 2: Concepts pour les signes (mot traduit = signe à afficher)
    var words = translation.trim().split(/\s+/);
    var concepts;
    if (words.length <= 4) {
      // Texte court : utiliser les mots traduits comme concepts (le mot = le signe)
      concepts = getConceptsFromShortTranslation(translation);
      if (concepts.length === 0) concepts = [translation.trim().toLowerCase()];
    } else {
      concepts = await extractConceptsForSigns(translation);
    }
    
    document.getElementById("conceptsResult").textContent = 
      "🎭 Signes : " + concepts.join(", ");
    
    // ÉTAPE 3: Animer l'avatar (affiche le signe pour chaque concept/mot)
    animateAvatarWithConcepts(concepts);
    
    // ÉTAPE 4: Historique
    saveToHistory(inputText, translation, concepts);
    
  } catch (error) {
    // En cas d'erreur
    document.getElementById("translationResult").innerHTML = 
      `<span class="translation-error">❌ ${error.message}</span>`;
    document.getElementById("translationResult").className = "lang-text translation-text error";
    document.getElementById("conceptsResult").textContent = "";
    
    console.error("Process error:", error);
  } finally {
    // Désactiver le chargement
    showLoading(false);
  }
}

// ================================
// SIGNS: mot français → nom d'animation (pour l'avatar)
// ================================
const CONCEPT_TO_SIGN = {
  bonjour: "SIGN_HELLO", salut: "SIGN_HELLO", hello: "SIGN_HELLO", aslema: "SIGN_HELLO",
  vouloir: "SIGN_WANT", aller: "SIGN_GO", aide: "SIGN_HELP", aider: "SIGN_HELP",
  merci: "SIGN_THANKS", oui: "SIGN_YES", non: "SIGN_NO", quoi: "SIGN_WHAT",
  comment: "SIGN_HOW", hôpital: "SIGN_HOSPITAL", hopital: "SIGN_HOSPITAL",
  douleur: "SIGN_PAIN", médecin: "SIGN_DOCTOR", docteur: "SIGN_DOCTOR",
  santé: "SIGN_HEALTH", médicament: "SIGN_MEDICINE", dawa: "SIGN_MEDICINE",
  bouche: "SIGN_BOUCHE",
  aisselle: "SIGN_AISSELLE",
  pain: "SIGN_PAIN", thanks: "SIGN_THANKS", help: "SIGN_HELP", yes: "SIGN_YES", no: "SIGN_NO",
  hospital: "SIGN_HOSPITAL", doctor: "SIGN_DOCTOR", go: "SIGN_GO", want: "SIGN_WANT"
};

/** Normalise un mot pour la recherche (minuscules, sans accents optionnel). */
function normalizeConcept(word) {
  return String(word).toLowerCase().trim().replace(/[^\wàâäéèêëïîôùûüç]/g, "");
}

/** Concepts → noms de signes (SIGN_XXX). */
function conceptsToSignNames(concepts) {
  return (concepts || []).map(function (c) {
    var key = normalizeConcept(c);
    return CONCEPT_TO_SIGN[key] || "SIGN_" + key.replace(/\s+/g, "_").toUpperCase();
  });
}

/** Trouve un clip d'animation dont le nom correspond au signe (ex: SIGN_HELLO → clip "Hello" ou "sign_hello"). */
function findClipForSign(clips, signName) {
  if (!clips || !clips.length) return null;
  var signUpper = signName.toUpperCase();
  var signKey = signUpper.replace("SIGN_", ""); // HELLO, GO, etc.
  for (var i = 0; i < clips.length; i++) {
    var name = clips[i].name;
    var nameUpper = name.toUpperCase();
    if (nameUpper.indexOf(signUpper) !== -1) return clips[i];
    if (nameUpper.indexOf(signKey) !== -1) return clips[i];
  }
  return clips[0]; // fallback: première animation
}

const SIGN_DURATION_MS = 2200;
var isPlayingSequence = false;
var currentConceptsList = []; // pour afficher le mot en cours

function playSignAtIndex(signNames, concepts, index) {
  var currentEl = document.getElementById("currentSign");
  if (index >= signNames.length) {
    isPlayingSequence = false;
    hideVideoInAvatarZone();
    if (tempGlbModel && tempGlbModel.parent) tempGlbModel.parent.remove(tempGlbModel);
    tempGlbModel = null;
    tempGlbMixer = null;
    if (avatar) avatar.visible = true;
    if (currentEl) currentEl.textContent = "Prêt";
    return;
  }
  var signName = signNames[index];
  var concept = (concepts && concepts[index] !== undefined) ? concepts[index] : "";
  var wordDisplay = concept || signName;
  if (currentEl) currentEl.textContent = "Signe : " + wordDisplay;

  ensureAvatarReady();

  var phraseMatch = getAnimationKeyForConceptPhrase(concepts, index);
  if (phraseMatch) {
    if (currentEl) currentEl.textContent = "Signe : " + concepts.slice(index, index + phraseMatch.length).join(" ");
    playAnimationSignInAvatarZone(phraseMatch.key, signNames, concepts, index, phraseMatch.length);
    return;
  }
  var animationKey = getAnimationKeyForConcept(concept || wordDisplay);
  if (animationKey) {
    playAnimationSignInAvatarZone(animationKey, signNames, concepts, index, 1);
    return;
  }

  var glbKey = getGlbAnimationKeyForConcept(concept || wordDisplay);
  if (glbKey) {
    playGlbAnimationInAvatarZone(glbKey, signNames, concepts, index);
    return;
  }

  var skeletonFile = findSkeletonFileForConcept(concept || wordDisplay);
  if (skeletonFile && avatar) {
    var apiBase = window.location.origin || "";
    var url = apiBase + "/api/skeleton_animation?name=" + encodeURIComponent(skeletonFile);
    fetch(url)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || r.statusText); });
        return r.json();
      })
      .then(function (motion) {
        if (motion.tracks) {
          playVideoMotion(motion);
          var durationMs = (motion.duration || 2) * 1000;
          setTimeout(function () { playSignAtIndex(signNames, concepts, index + 1); }, Math.max(durationMs, 1500));
          return;
        }
        throw new Error("Format invalide");
      })
      .catch(function () {
        playFallbackSignAndNext(signNames, concepts, index);
      });
    return;
  }

  playFallbackSignAndNext(signNames, concepts, index);
}

function playFallbackSignAndNext(signNames, concepts, index) {
  var played = false;
  if (mixer && avatar) {
    var clips = avatar.userData.animations || [];
    var signName = signNames[index];
    if (clips.length > 0) {
      var clip = findClipForSign(clips, signName);
      if (clip) {
        mixer.clipAction(clip).reset().play();
        played = true;
      }
    }
    if (!played && avatar.userData.proceduralClips && avatar.userData.proceduralClips[signName]) {
      mixer.clipAction(avatar.userData.proceduralClips[signName]).reset().play();
      played = true;
    }
    if (!played && avatar.userData.proceduralClips) {
      var clipHello = avatar.userData.proceduralClips["SIGN_HELLO"];
      var clipThanks = avatar.userData.proceduralClips["SIGN_THANKS"];
      var clip = (index % 2 === 0 ? clipHello : clipThanks) || clipHello || clipThanks;
      if (clip) {
        mixer.clipAction(clip).reset().play();
        played = true;
      }
    }
  }
  if (avatar && !played) startFallbackSignAnimation();
  setTimeout(function () { playSignAtIndex(signNames, concepts, index + 1); }, SIGN_DURATION_MS);
}

// ================================
// ANIMATION AVATAR (concepts → signes : affiche le signe du mot traduit)
// ================================
async function animateAvatarWithConcepts(concepts) {
  if (!concepts || concepts.length === 0) return;
  if (isPlayingSequence) return;
  ensureAvatarReady();
  var signNames = conceptsToSignNames(concepts);
  try {
    var apiBase = window.location.origin || "";
    var res = await fetch(apiBase + "/api/predict_signs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ concepts: concepts })
    });
    if (res.ok) {
      var data = await res.json();
      if (data.signs && data.signs.length) signNames = data.signs;
    }
  } catch (_) {}

  currentConceptsList = concepts.slice();
  isPlayingSequence = true;
  await ensureSkeletonListLoaded();
  await ensureAnimationsVideoListLoaded();
  playSignAtIndex(signNames, currentConceptsList, 0);
}

// ================================
// HISTORIQUE
// ================================
function saveToHistory(original, translation, concepts) {
  const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
  
  history.unshift({
    date: new Date().toISOString(),
    original,
    translation,
    concepts
  });
  
  // Garder seulement les 10 dernières entrées
  if (history.length > 10) history.pop();
  
  localStorage.setItem('translationHistory', JSON.stringify(history));
  updateHistoryDisplay();
}

function updateHistoryDisplay() {
  const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
  const historyElement = document.getElementById("historyList");
  
  if (!historyElement) return;
  
  if (history.length === 0) {
    historyElement.innerHTML = "<li>Aucune traduction dans l'historique</li>";
    return;
  }
  
  historyElement.innerHTML = history.map((item, index) => `
    <li>
      <div class="history-item">
        <div class="history-original"><strong>${item.original}</strong></div>
        <div class="history-translation">${item.translation}</div>
        <div class="history-concepts">${item.concepts.join(', ')}</div>
        <div class="history-date">${new Date(item.date).toLocaleTimeString()}</div>
      </div>
    </li>
  `).join('');
}

// ================================
// RECONNAISSANCE VOCALE
// ================================
function startVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("La reconnaissance vocale n'est pas supportée par votre navigateur");
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  // Configurer pour l'arabe (le tunisien n'a pas de code spécifique)
  recognition.lang = "ar"; // Arabe standard
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  
  // État
  recognition.onstart = () => {
    document.getElementById("voiceStatus").textContent = "🎤 Écoute en cours... Parlez en tunisien";
    document.getElementById("voiceStatus").className = "voice-status active";
  };
  
  // Résultat
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById("textInput").value = transcript;
    document.getElementById("voiceStatus").textContent = "✓ Texte capturé";
    document.getElementById("voiceStatus").className = "voice-status success";
    
    // Lancer la traduction après un court délai
    setTimeout(() => {
      processFullTranslation();
      document.getElementById("voiceStatus").textContent = "";
    }, 800);
  };
  
  // Erreurs
  recognition.onerror = (event) => {
    console.error("Erreur reconnaissance:", event.error);
    let message = "Erreur de microphone";
    if (event.error === 'no-speech') message = "Aucune parole détectée";
    if (event.error === 'audio-capture') message = "Microphone non disponible";
    if (event.error === 'not-allowed') message = "Microphone bloqué";
    
    document.getElementById("voiceStatus").textContent = `❌ ${message}`;
    document.getElementById("voiceStatus").className = "voice-status error";
  };
  
  // Fin
  recognition.onend = () => {
    setTimeout(() => {
      document.getElementById("voiceStatus").textContent = "";
    }, 2000);
  };
  
  recognition.start();
}

// ================================
// FONCTIONS UI
// ================================
function showLoading(show) {
  const translateBtn = document.querySelector(".translate-btn");
  const displayBtn = document.querySelector(".btn-display");
  const loadingDiv = document.getElementById("loading");

  if (show) {
    [translateBtn, displayBtn].forEach(btn => {
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...'; }
    });
    if (loadingDiv) loadingDiv.style.display = "block";
  } else {
    if (translateBtn) { translateBtn.disabled = false; translateBtn.innerHTML = '<i class="fas fa-language"></i> Traduire'; }
    if (displayBtn) { displayBtn.disabled = false; displayBtn.innerHTML = '<i class="fas fa-eye"></i> Afficher la traduction'; }
    if (loadingDiv) loadingDiv.style.display = "none";
  }
}

function clearAll() {
  document.getElementById("textInput").value = "";
  document.getElementById("originalText").textContent = "Tapez ou parlez en tunisien...";
  document.getElementById("translationResult").innerHTML = "La traduction s'affichera ici";
  document.getElementById("translationResult").className = "lang-text translation-text";
  document.getElementById("conceptsResult").textContent = "—";
  document.getElementById("currentSign").textContent = "Prêt";
  document.getElementById("voiceStatus").textContent = "";
}

/** Copie la traduction française dans le presse-papier. */
function copyTranslation() {
  const el = document.getElementById("translationResult");
  const text = el.querySelector(".translation-main") ? el.querySelector(".translation-main").textContent : el.textContent;
  if (!text || text.includes("s'affichera") || text.includes("Erreur")) return;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector(".copy-btn");
    if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Copié!'; setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i> Copier'; }, 2000); }
  }).catch(() => alert("Copie impossible"));
}

/** Lit la traduction à voix haute (synthèse vocale). */
function speakTranslation() {
  const el = document.getElementById("translationResult");
  const text = el.querySelector(".translation-main") ? el.querySelector(".translation-main").textContent : el.textContent;
  if (!text || text.includes("s'affichera") || text.includes("Erreur")) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

// ================================
// PARAMÈTRES D'AFFICHAGE (bouton fixe)
// ================================
function toggleSettingsPanel() {
  var panel = document.getElementById("settingsPanel");
  var backdrop = document.getElementById("settingsBackdrop");
  var fab = document.getElementById("settingsFab");
  if (!panel || !backdrop) return;
  var isOpen = panel.classList.toggle("is-open");
  backdrop.classList.toggle("is-open", isOpen);
  backdrop.setAttribute("aria-hidden", !isOpen);
  panel.setAttribute("aria-hidden", !isOpen);
  if (fab) fab.setAttribute("aria-expanded", isOpen);
}
function applyPageContrast(value) {
  var v = parseFloat(value) || 1;
  var wrap = document.getElementById("pageContentWrap");
  if (wrap) {
    wrap.style.setProperty("--page-contrast", v);
    if (v !== 1) wrap.classList.add("page-contrast");
    else wrap.classList.remove("page-contrast");
  }
  var el = document.getElementById("contrastValue");
  if (el) el.textContent = Math.round(v * 100) + "%";
  try { localStorage.setItem("voiceToSign_contrast", String(v)); } catch (_) {}
}
function applyDisplayMode(mode) {
  ["clair", "sombre", "nuit"].forEach(function (m) { document.body.classList.remove("mode-" + m); });
  if (mode) document.body.classList.add("mode-" + mode);
  else document.body.classList.add("mode-sombre");
  var sel = document.getElementById("displayModeSelect");
  if (sel) sel.value = mode || "sombre";
  try { localStorage.setItem("voiceToSign_displayMode", mode || "sombre"); } catch (_) {}
}
function applyTheme(theme) {
  ["default", "blue", "purple", "orange", "green"].forEach(function (t) { document.body.classList.remove("theme-" + t); });
  if (theme && theme !== "default") document.body.classList.add("theme-" + theme);
  document.querySelectorAll(".settings-theme-btn").forEach(function (btn) {
    var t = btn.getAttribute("data-theme");
    btn.classList.toggle("active", t === theme);
    btn.setAttribute("aria-pressed", t === theme ? "true" : "false");
  });
  try { localStorage.setItem("voiceToSign_theme", theme || "default"); } catch (_) {}
}
function applyFontSize(value) {
  var pct = parseInt(value, 10) || 100;
  document.documentElement.style.fontSize = pct + "%";
  try { localStorage.setItem("voiceToSign_fontSize", String(pct)); } catch (_) {}
}
function loadSettingsFromStorage() {
  try {
    var mode = localStorage.getItem("voiceToSign_displayMode");
    if (mode) applyDisplayMode(mode);
    else document.body.classList.add("mode-sombre");
    var c = localStorage.getItem("voiceToSign_contrast");
    if (c) { var v = parseFloat(c); if (!isNaN(v) && v >= 1 && v <= 1.5) { var rng = document.getElementById("contrastRange"); if (rng) rng.value = v; applyPageContrast(v); } }
    var t = localStorage.getItem("voiceToSign_theme");
    if (t) applyTheme(t);
    var fs = localStorage.getItem("voiceToSign_fontSize");
    if (fs) { var pct = parseInt(fs, 10); if (!isNaN(pct)) { applyFontSize(pct); var sel = document.getElementById("fontSizeSelect"); if (sel) sel.value = String(pct); } }
  } catch (_) {}
}

// ================================
// INITIALISATION
// ================================
function onDomReady() {
  /* Ne pas charger l’avatar au démarrage (template : zone vide). Il sera chargé au premier signe. */
  loadSettingsFromStorage();
  updateHistoryDisplay();
  loadSkeletonAnimationsList();
  loadAnimationsVideoList();

  function onResize() {
    const container = getSceneContainer();
    if (!container || !camera || !renderer) return;
    const w = Math.max(container.clientWidth || 400, 300);
    const h = Math.max(container.clientHeight || 380, 300);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);
  setTimeout(onResize, 50);
  setTimeout(onResize, 300);

  document.getElementById("textInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      processFullTranslation();
    }
  });

  document.querySelectorAll(".example").forEach(function (el) {
    el.addEventListener("click", function () {
      document.getElementById("textInput").value = el.textContent;
      document.getElementById("textInput").focus();
    });
  });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", onDomReady);
} else {
  onDomReady();
}