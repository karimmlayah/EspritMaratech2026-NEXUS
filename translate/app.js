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
  analyses: "analyse",
  attention: "attention",
  caisse: "caisse_assurance_maladie",
  assurance: "caisse_assurance_maladie",
  maladie: "caisse_assurance_maladie",
  "caisse_assurance_maladie": "caisse_assurance_maladie",
  cin: "CIN",
  "rendez-vous": "RDV",
  rendezvous: "RDV",
  rdv: "RDV"
};
/** Semantic / lemma fallback: plural or synonym → canonical concept for video lookup (used when direct match fails). */
var CONCEPT_LEMMA_FOR_VIDEO = {
  analyses: "analyse",
  vaccins: "vaccin",
  vitamines: "vitamine",
  médicaments: "médicament",
  medicaments: "medicament",
  ordonnances: "ordonnance médicale",
  résultats: "résultat",
  resultats: "résultat",
  problèmes: "problèmes de santé",
  problemes: "problèmes de santé",
  rdvs: "RDV"
};
/** Toutes les clés vidéo chargées depuis /api/animations/list (pour matching concept + liste affichée) */
var allAnimationVideoKeys = [];
/** Une seule vidéo prioritaire : "langue des signes" → langue_des_signes.mp4 */
var LANGUE_DES_SIGNES_VIDEO_KEY = "langue_des_signes";
/** Vidéo affichée quand la vidéo du signe est introuvable (animations/inconnue.mp4) */
var FALLBACK_VIDEO_KEY = "inconnue";
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
  "rendez-vous": "RDV",
  "rendez vous": "RDV",
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
  var lemma = CONCEPT_LEMMA_FOR_VIDEO[n];
  if (lemma) return getAnimationKeyForConcept(lemma);
  var nNoAccent = (n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (CONCEPT_LEMMA_FOR_VIDEO[nNoAccent]) return getAnimationKeyForConcept(CONCEPT_LEMMA_FOR_VIDEO[nNoAccent]);
  if (n.length > 1 && n.slice(-1) === "s") {
    var singular = n.slice(0, -1);
    var keyFromSingular = CONCEPT_TO_ANIMATION_KEY[singular] || (ANIMATION_VIDEO_KEYS.indexOf(singular) !== -1 ? singular : null);
    if (keyFromSingular) return keyFromSingular;
    for (var j = 0; j < allAnimationVideoKeys.length; j++) {
      if (normalizeConcept(allAnimationVideoKeys[j]) === singular) return allAnimationVideoKeys[j];
    }
  }
  return null;
}

/**
 * Builds the list of sign items from a sentence's concepts (same logic as playSignAtIndex).
 * Each item = one "sign" to show: either a phrase or a single word, with video key if available.
 * Returns [{ label: string, videoKey: string|null, concept: string }].
 */
function buildSentenceSignItems(concepts) {
  if (!concepts || !concepts.length) return [];
  var items = [];
  var i = 0;
  while (i < concepts.length) {
    var phraseMatch = getAnimationKeyForConceptPhrase(concepts, i);
    if (phraseMatch) {
      var phraseLabel = concepts.slice(i, i + phraseMatch.length).join(" ");
      items.push({ label: phraseLabel, videoKey: phraseMatch.key, concept: phraseLabel });
      i += phraseMatch.length;
      continue;
    }
    var concept = concepts[i];
    var animationKey = getAnimationKeyForConcept(concept);
    // Pas de vidéo pour ce concept → utiliser inconnue.mp4 pour l’affichage
    var videoKey = animationKey || FALLBACK_VIDEO_KEY;
    items.push({ label: concept, videoKey: videoKey, concept: concept });
    i += 1;
  }
  return items;
}

/** Renders the "sentence signs" strip: one card per concept (vidéo réelle ou inconnue.mp4). */
function renderSentenceSignsStrip(items) {
  var container = document.getElementById("sentenceSignsStrip");
  if (!container) return;
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.classList.remove("has-items");
    return;
  }
  var withVideo = items;
  if (withVideo.length === 0) {
    container.classList.remove("has-items");
    return;
  }
  container.classList.add("has-items");
  var apiBase = typeof getApiBase === "function" ? getApiBase() : (window.location.origin || "");
  withVideo.forEach(function (item) {
    var card = document.createElement("div");
    card.className = "sentence-sign-card";
    card.setAttribute("data-concept", item.concept || item.label);
    var labelEl = document.createElement("span");
    labelEl.className = "sentence-sign-label";
    labelEl.textContent = item.label;
    card.appendChild(labelEl);
    var videoWrap = document.createElement("div");
    videoWrap.className = "sentence-sign-video-wrap";
    var video = document.createElement("video");
    video.className = "sentence-sign-video";
    video.src = apiBase + "/api/animations/video/" + encodeURIComponent(item.videoKey);
    video.playsInline = true;
    video.preload = "metadata";
    video.muted = true;
    video.setAttribute("aria-label", "Signe : " + item.label);
    video.addEventListener("error", function fallbackOnce() {
      video.removeEventListener("error", fallbackOnce);
      if (item.videoKey !== FALLBACK_VIDEO_KEY) {
        video.src = apiBase + "/api/animations/video/" + encodeURIComponent(FALLBACK_VIDEO_KEY);
      }
    }, { once: true });
    videoWrap.appendChild(video);
    var playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "sentence-sign-play";
    playBtn.innerHTML = "<i class=\"fas fa-play\"></i>";
    playBtn.title = "Lire le signe : " + item.label;
    playBtn.setAttribute("aria-label", "Lire le signe : " + item.label);
    playBtn.addEventListener("click", function () {
      showVideoInAvatarZone(item.videoKey);
      var videoEl = document.getElementById("avatarZoneVideo");
      if (videoEl) { videoEl.currentTime = 0; videoEl.play(); }
      var currentEl = document.getElementById("currentSign");
      if (currentEl) currentEl.textContent = "Signe : " + item.label;
    });
    videoWrap.appendChild(playBtn);
    card.appendChild(videoWrap);
    container.appendChild(card);
  });
}

function getGlbAnimationKeyForConcept(concept) {
  if (!concept) return null;
  var n = normalizeConcept(concept);
  return CONCEPT_TO_GLB_ANIMATION[n] || null;
}

function getAnimationVideoUrl(key) {
  var apiBase = typeof getApiBase === "function" ? getApiBase() : (window.location.origin || "");
  return apiBase + "/api/animations/video/" + encodeURIComponent(key);
}

function showVideoInAvatarZone(key, loopVideo) {
  if (loopVideo === undefined) loopVideo = true;
  var wrap = document.getElementById("sceneAndVideoWrap") || document.querySelector(".scene-and-video-wrap");
  var placeholder = document.getElementById("videoPlaceholder");
  var brightnessWrap = document.getElementById("videoBrightnessWrap");
  var videoEl = document.getElementById("avatarZoneVideo");
  if (!wrap || !videoEl) return;
  if (placeholder) placeholder.style.display = "none";
  if (brightnessWrap) brightnessWrap.style.display = "block";
  wrap.classList.add("show-video");
  var apiBase = typeof getApiBase === "function" ? getApiBase() : (window.location.origin || "");
  var url = getAnimationVideoUrl(key);
  videoEl.src = url;
  videoEl.currentTime = 0;
  function onVideoError() {
    videoEl.removeEventListener("error", onVideoError);
    if (key === FALLBACK_VIDEO_KEY) return;
    videoEl.src = getAnimationVideoUrl(FALLBACK_VIDEO_KEY);
    videoEl.load();
    videoEl.play();
  }
  videoEl.addEventListener("error", onVideoError, { once: true });
  applyVideoSpeed(getVideoSpeed());
  applyVideoBrightness(getVideoBrightness());
  videoEl.loop = !!loopVideo;
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
// Toujours pas de boucle sur une seule vidéo : la boucle est sur toute la séquence (voir playSignAtIndex).

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

function playGlbAnimationInAvatarZone(key, signNames, concepts, index, runId) {
  ensureAvatarReady();
  if (!scene || typeof THREE === "undefined" || !THREE.GLTFLoader) {
    playFallbackSignAndNext(signNames, concepts, index, runId);
    return;
  }
  if (avatar) avatar.visible = false;
  var apiBase = window.location.origin || "";
  var glbUrl = apiBase + "/api/animations/glb/" + encodeURIComponent(key);
  var loader = new THREE.GLTFLoader();
  var rId = runId;
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
        playSignAtIndex(signNames, concepts, index + 1, rId);
      }, Math.max(duration * 1000, 1800));
    },
    undefined,
    function () {
      if (avatar) avatar.visible = true;
      playFallbackSignAndNext(signNames, concepts, index, rId);
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

function playAnimationSignInAvatarZone(key, signNames, concepts, index, advanceBy, runId) {
  if (advanceBy == null) advanceBy = 1;
  var videoEl = document.getElementById("avatarZoneVideo");
  var done = false;
  var rId = runId;
  var onlyOneSign = signNames.length === 1;
  function goNext() {
    if (done) return;
    done = true;
    if (videoEl) videoEl.onended = null;
    hideVideoInAvatarZone();
    playSignAtIndex(signNames, concepts, index + advanceBy, rId);
  }
  showVideoInAvatarZone(key, onlyOneSign);
  if (onlyOneSign) {
    isPlayingSequence = false;
    return;
  }
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

/** Traduit le texte en arabe via Groq (pour les sous-titres vidéo). */
async function translateWithGroqToArabic(text) {
  if (!text || !String(text).trim()) return "";
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
          content: "You are a translator. Translate the given text into Arabic (Modern Standard Arabic). Reply ONLY with the Arabic translation, no explanation or preamble."
        },
        {
          role: "user",
          content: "Translate to Arabic (reply only with the translation):\n\n" + String(text).trim()
        }
      ],
      temperature: 0.3,
      max_tokens: 256
    })
  });
  if (!response.ok) {
    const errBody = await response.json().catch(function () { return {}; });
    const msg = errBody.error && errBody.error.message ? errBody.error.message : "Groq API " + response.status;
    throw new Error(msg);
  }
  const data = await response.json();
  const raw = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!raw) throw new Error("Réponse Groq invalide");
  return String(raw).trim();
}

/**
 * Traduit le texte : dictionnaire prioritaire (dictionary.js), puis FRENCH_TO_TUNIS, Groq uniquement si rien trouvé dans le dictionnaire.
 * Retourne { translation, source: "dictionary" | "french_to_tunis" | "groq" }.
 */
async function translateText(text) {
  if (typeof translateWithDictionary !== "function") {
    return { translation: await translateWithGroq(text), source: "groq" };
  }
  // 1) Priorité au dictionnaire : dès qu'on a une traduction (même partielle), on l'utilise, pas de Groq
  var result = translateWithDictionary(text);
  if (result.usedDictionary && result.translation && result.translation.trim()) {
    return { translation: result.translation.trim(), source: "dictionary" };
  }
  // 2) Ensuite Tunis (inverse FR→Tunis) si dispo
  var resultTunis = translateWithFrenchToTunis(text);
  if (resultTunis.usedDictionary && resultTunis.translation && resultTunis.translation.trim()) {
    return { translation: resultTunis.translation.trim(), source: "french_to_tunis" };
  }
  // 3) Groq uniquement si rien trouvé dans le dictionnaire
  var translation = await translateWithGroq(text);
  return { translation: translation, source: "groq" };
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
              text: `Sépare cette phrase française en concepts pour la langue des signes (un signe par concept).
Texte: "${text}"

RÈGLES:
- Retourne UNIQUEMENT les noms et les mots interrogatifs, sous forme de liste.
- Inclus: mots interrogatifs (quand, comment, où, pourquoi, combien) et noms importants (résultats, analyses, santé, rendez-vous, médecin, vaccin, etc.).
- N'inclus AUCUN verbe (aurons, avoir, être, seront, etc.) ni articles (le, les, des).
- Pour "Quand aurons-nous les résultats des analyses ?" → ["quand", "résultats", "analyses"]
- Réponds UNIQUEMENT par un tableau JSON. Exemple: ["quand", "résultats", "analyses"]`
            }]
          }],
          systemInstruction: {
            parts: [{
              text: "Tu sépares la traduction en concepts pour la langue des signes. Retourne uniquement un tableau JSON de noms et mots interrogatifs, sans verbes ni articles. Exemple pour 'Quand aurons-nous les résultats des analyses ?' : [\"quand\", \"résultats\", \"analyses\"]. Pas de texte avant ou après le JSON."
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
  return normalizeConceptsForSigns(out.slice(0, 12));
}

// ================================
// LEMMATIZATION / NORMALIZATION: merge multi-word expressions, remove stopwords
// ================================
/** French stopwords typically without a dedicated sign (removed from concept list). */
var SIGN_STOPWORDS = new Set([
  "est", "sont", "et", "ou", "le", "la", "les", "un", "une", "des", "du", "de", "da", "à", "a", "en", "au", "aux",
  "ce", "cette", "ces", "son", "sa", "ses", "mon", "ma", "mes", "ton", "ta", "tes", "notre", "votre", "leur", "leurs",
  "il", "elle", "on", "ils", "elles", "je", "tu", "nous", "vous", "me", "te", "se", "y", "lui", "que", "qui", "dont",
  "pas", "ne", "plus", "très", "trop", "bien", "mal", "peu", "tout", "toute", "tous", "toutes", "autre", "même",
  "avec", "sans", "pour", "par", "sur", "sous", "dans", "chez", "entre", "vers", "depuis", "pendant", "avant", "après"
]);

/** Conjugated verb forms: exclude from sign concepts (rule: do not take verbs). */
var SIGN_VERB_FORMS = new Set([
  "avoir", "être", "être", "faire", "dire", "aller", "voir", "savoir", "pouvoir", "falloir", "vouloir", "venir",
  "est", "sont", "sera", "seront", "serons", "serai", "seriez", "été", "suis", "es", "sommes", "êtes", "fut", "furent", "soit", "soient", "étant",
  "ai", "as", "a", "avons", "avez", "ont", "avais", "avait", "avions", "aviez", "avaient", "eus", "eut", "eûmes", "eûtes", "eurent",
  "aurai", "auras", "aura", "aurons", "aurez", "auront", "aurais", "aurait", "aurions", "auriez", "auraient",
  "avoir", "eu", "ayant",
  "fait", "font", "fais", "faisons", "faites", "ferai", "feront", "ferons", "faisais", "faisait", "faisions", "faisiez", "faisaient",
  "dit", "dis", "disons", "dites", "disait", "disaient", "dira", "diront",
  "va", "vont", "vas", "allons", "allez", "allé", "allait", "allaient", "ira", "iront", "irai", "irons",
  "vu", "vois", "voyons", "voyez", "voyait", "voyaient", "verra", "verront",
  "sait", "savons", "savez", "savent", "savais", "savait", "savions", "saviez", "savaient", "sut", "surent", "saura", "sauront",
  "peux", "peut", "pouvons", "pouvez", "peuvent", "pouvais", "pouvait", "pouvions", "pouviez", "pouvaient", "put", "purent", "pourra", "pourront",
  "faut", "fallu", "fallait", "faudra", "faudrait",
  "veux", "veut", "voulons", "voulez", "veulent", "voulais", "voulait", "voulions", "vouliez", "voulaient", "voulut", "voulurent", "voudra", "voudront",
  "viens", "vient", "venons", "venez", "viennent", "venu", "venais", "venait", "venions", "veniez", "venaient", "vint", "vinrent", "viendra", "viendront"
]);

/**
 * Multi-word phrases: consecutive concept tokens to merge into one (e.g. "rendez" + "vous" → "rendez-vous").
 * Order by length descending so longer phrases are matched first.
 */
var MULTI_WORD_PHRASES = [
  { words: ["rendez", "vous"], merge: "rendez-vous" },
  { words: ["rendezvous"], merge: "rendez-vous" },
  { words: ["date", "de", "naissance"], merge: "date de naissance" },
  { words: ["prénom", "et", "nom"], merge: "prénom et nom" },
  { words: ["prenom", "et", "nom"], merge: "prénom et nom" },
  { words: ["ou", "avez", "vous", "mal"], merge: "où avez-vous mal" },
  { words: ["où", "avez", "vous", "mal"], merge: "où avez-vous mal" },
  { words: ["langue", "des", "signes"], merge: "langue des signes" },
  { words: ["positif", "négatif"], merge: "positif négatif" },
  { words: ["positif", "negatif"], merge: "positif négatif" },
  { words: ["question", "réponse"], merge: "question réponse" },
  { words: ["question", "reponse"], merge: "question réponse" },
  { words: ["problèmes", "de", "santé"], merge: "problèmes de santé" },
  { words: ["problemes", "de", "sante"], merge: "problèmes de santé" },
  { words: ["régime", "amaigrissant"], merge: "régime amaigrissant" },
  { words: ["regime", "amaigrissant"], merge: "régime amaigrissant" },
  { words: ["ordonnance", "médicale"], merge: "ordonnance médicale" },
  { words: ["ordonnance", "medicale"], merge: "ordonnance médicale" },
  { words: ["caisse", "nationale", "d", "assurance", "maladie"], merge: "caisse nationale d'assurance-maladie" },
  { words: ["salut", "ça", "va"], merge: "salut ça va" },
  { words: ["salut", "ca", "va"], merge: "salut ça va" },
  { words: ["gel", "hydroalcoolique"], merge: "gel hydroalcoolique" },
  { words: ["implant", "cochléaire"], merge: "implant cochléaire" },
  { words: ["implant", "cochleaire"], merge: "implant cochléaire" },
  { words: ["masque", "médical"], merge: "masque médical" },
  { words: ["masque", "medical"], merge: "masque médical" },
  { words: ["relation", "sexuelle"], merge: "relation sexuelle" },
  { words: ["en", "pleine", "forme"], merge: "en pleine forme" },
  { words: ["qu", "est", "ce", "qui", "est", "passé"], merge: "qu'est ce qui est passé" },
  { words: ["information", "et"], merge: "information et" }
];
const FRENCH_TO_TUNIS = {
  // Corps
  "tête": ["ras"],
  "yeux": ["3inin"],
  "nez": ["mankhar"],
  "bouche": ["fomm"],
  "dents": ["snan"],
  "main": ["yed"],
  "bras": ["dhra3"],
  "dos": ["dhar"],
  "ventre": ["batn"],
  "jambe": ["se9"],
  "pied": ["rijel"],

  // Symptômes
  "douleur": ["waja3"],
  "fièvre": ["7rara"],
  "fatigué": ["ta3ban"],
  "toux": ["s3al"],
  "mal à la tête": ["waja3 ras"],
  "mal au ventre": ["waja3 batn"],

  // Médecine
  "médecin": ["tbib", "doktor"],
  "hôpital": ["sbitar"],
  "pharmacie": ["saidliya"],
  "médicament": ["dwa"],
  "ordonnance": ["wasfa"],
  "analyse": ["ta7lil"],
  "urgence": ["7ala mosta3jla"],

  // Questions
  "où avez-vous mal": ["win youja3ek"],
  "depuis quand": ["men wa9tèch"],
  "avez-vous de la fièvre": ["3andek 7rara"],
  "quand": ["wa9tèch"],
  "pourquoi": ["3lech"],
  "comment": ["kifech"],
  "combien": ["9addech"],

  // Phrases
  "je ne comprends pas": ["ma nefhemch"],
  "parlez lentement": ["ehki b chwaya"],
  "aidez-moi": ["3awnouni"],
  "c'est urgent": ["7aja mosta3jla"],
  "où est l'hôpital": ["win sbitar"],

  // Salutations
  "bonjour": ["aslema"],
  "merci": ["3aychek"],
  "au revoir": ["besslema"],

  // Verbes
  "parler": ["ne7ki"],
  "aller": ["nemchi"],
  "venir": ["iji"],
  "manger": ["nekoul"],
  "boire": ["neshreb"],
  "attendre": ["nestanna"],
  "chercher": ["nlawwej"],
  "appeler": ["n3ayyet"],
  "aider": ["n3awen"]
};

/** Tunisian → French map built from FRENCH_TO_TUNIS (used when main dictionary misses). */
var TUNISIAN_TO_FRENCH_FROM_TUNIS = {};
(function () {
  for (var french in FRENCH_TO_TUNIS) {
    var variants = FRENCH_TO_TUNIS[french];
    if (!Array.isArray(variants)) continue;
    for (var i = 0; i < variants.length; i++) {
      var v = (variants[i] || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
      if (v) TUNISIAN_TO_FRENCH_FROM_TUNIS[v] = french;
    }
  }
})();

/**
 * Translate Tunisian → French using FRENCH_TO_TUNIS (reverse map).
 * Returns { translation, usedDictionary, missing } like translateWithDictionary.
 */
function translateWithFrenchToTunis(input) {
  var normalized = (input || "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return { translation: "", usedDictionary: false, missing: [] };
  var exact = TUNISIAN_TO_FRENCH_FROM_TUNIS[normalized];
  if (exact) return { translation: exact, usedDictionary: true, missing: [] };
  var noPunct = normalized.replace(/[.?!,;:]+$/, "").trim();
  if (noPunct && TUNISIAN_TO_FRENCH_FROM_TUNIS[noPunct])
    return { translation: TUNISIAN_TO_FRENCH_FROM_TUNIS[noPunct], usedDictionary: true, missing: [] };
  var words = normalized.split(/\s+/);
  var translated = [];
  var missing = [];
  for (var w = 0; w < words.length; w++) {
    var tw = TUNISIAN_TO_FRENCH_FROM_TUNIS[words[w]];
    if (tw) translated.push(tw);
    else if (words[w].length > 0) missing.push(words[w]);
  }
  if (translated.length === 0 && missing.length > 0)
    return { translation: "", usedDictionary: false, missing: [normalized] };
  return {
    translation: translated.join(" "),
    usedDictionary: translated.length > 0,
    missing: missing
  };
}

function normalizeWordForPhraseMatch(w) {
  return String(w || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/g, "");
}

/** Merges multi-word expressions and removes stopwords from the concept list (lemmatization step). */
function normalizeConceptsForSigns(concepts) {
  if (!concepts || !concepts.length) return concepts;
  var raw = concepts.map(function (c) { return String(c).trim().toLowerCase(); }).filter(Boolean);
  if (raw.length === 0) return concepts;
  var out = [];
  var i = 0;
  while (i < raw.length) {
    var matched = false;
    for (var p = 0; p < MULTI_WORD_PHRASES.length; p++) {
      var phrase = MULTI_WORD_PHRASES[p];
      var len = phrase.words.length;
      if (i + len > raw.length) continue;
      var slice = raw.slice(i, i + len);
      var allMatch = true;
      for (var j = 0; j < len; j++) {
        if (normalizeWordForPhraseMatch(slice[j]) !== normalizeWordForPhraseMatch(phrase.words[j])) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        out.push(phrase.merge);
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      var w = raw[i];
      var wNorm = normalizeWordForPhraseMatch(w);
      var isStop = SIGN_STOPWORDS.has(w) || SIGN_STOPWORDS.has(wNorm);
      var isVerb = SIGN_VERB_FORMS.has(w) || SIGN_VERB_FORMS.has(wNorm);
      if (wNorm && !isStop && !isVerb) out.push(w);
      i += 1;
    }
  }
  return out.length ? out : concepts;
}

/** Key nouns that have signs: if they appear in the translation but are missing from concepts, add them (rule: always take these). */
var SIGN_KEY_NOUNS = [
  "analyse", "analyses", "résultats", "resultats", "résultat", "resultat", "quand", "rendez-vous", "vaccin", "vitamine",
  "santé", "sante", "médecin", "medecin", "médicament", "medicament", "ordonnance", "hôpital", "hopital", "date", "naissance",
  "prénom", "prenom", "nom", "poids", "taille", "stress", "solution", "prévention", "prevention", "question", "réponse", "reponse",
  "attention", "cin", "caisse", "assurance", "maladie", "sourd", "langue", "signes", "positif", "négatif", "negatif",
  "évaluation", "evaluation", "responsabilité", "responsabilite", "interprète", "interprete", "malentendant", "handicap",
  "implant", "cochléaire", "cochleaire", "gel", "hydroalcoolique", "information"
];
/** Key phrases (video key = phrase as used in animations folder): if translation contains these, add as one concept. */
var SIGN_KEY_PHRASES = [
  "qu'est ce qui est passé",
  "qu est ce qui est passé",
  "où avez-vous mal",
  "ou avez vous mal",
  "date de naissance",
  "rendez-vous",
  "langue des signes",
  "salut ça va",
  "question réponse"
];
function normalizeForKeyNounMatch(s) {
  return String(s || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]/g, "");
}
/** Ensures key nouns and key phrases present in the translation are in the concept list. */
function ensureKeyNounsFromTranslation(translation, concepts) {
  if (!translation || !translation.trim()) return concepts;
  var conceptSet = new Set((concepts || []).map(function (c) { return normalizeForKeyNounMatch(c); }));
  var transNorm = translation.trim().toLowerCase().replace(/['']/g, " ");
  var added = [];

  for (var p = 0; p < SIGN_KEY_PHRASES.length; p++) {
    var phrase = SIGN_KEY_PHRASES[p];
    var phraseNorm = phrase.toLowerCase().replace(/['']/g, " ").trim();
    if (transNorm.indexOf(phraseNorm) !== -1 || transNorm.indexOf(phraseNorm.replace(/\s+/g, " ")) !== -1) {
      var phraseKey = normalizeForKeyNounMatch(phrase);
      if (!conceptSet.has(phraseKey)) {
        conceptSet.add(phraseKey);
        added.push(phrase);
      }
    }
  }

  var words = transNorm.replace(/[.?!,;:'"]/g, " ").split(/\s+/).filter(function (w) { return w.length > 2; });
  var keyNormToCanonical = {};
  for (var j = 0; j < SIGN_KEY_NOUNS.length; j++) {
    var k = SIGN_KEY_NOUNS[j];
    keyNormToCanonical[normalizeForKeyNounMatch(k)] = k;
  }
  for (var i = 0; i < words.length; i++) {
    var n = normalizeForKeyNounMatch(words[i]);
    if (conceptSet.has(n)) continue;
    if (keyNormToCanonical[n]) {
      conceptSet.add(n);
      added.push(keyNormToCanonical[n]);
    }
  }
  if (added.length === 0) return concepts;
  return concepts.concat(added);
}

// ================================
// PROCESSUS DE TRADUCTION COMPLET
// ================================
async function processFullTranslation() {
  const inputText = document.getElementById("textInput").value.trim();
  currentSequenceRunId = Date.now();
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
    const sourceLabel = source === "dictionary" ? "dictionnaire" : (source === "french_to_tunis" ? "dictionnaire (Tunis)" : "Groq");
    document.getElementById("translationResult").innerHTML =
      `<span class="translation-main">${translation}</span><span class="translation-source">${sourceLabel}</span>`;
    document.getElementById("translationResult").className = "lang-text translation-text success";
    
    // ÉTAPE 2: Concepts pour les signes (sentence → list of words, then lemmatize: merge phrases, remove stopwords)
    var words = translation.trim().split(/\s+/);
    var concepts;
    if (words.length <= 4) {
      concepts = getConceptsFromShortTranslation(translation);
      concepts = ensureKeyNounsFromTranslation(translation, concepts);
      if (concepts.length === 0) concepts = [translation.trim().toLowerCase()];
    } else {
      concepts = await extractConceptsForSigns(translation);
      concepts = normalizeConceptsForSigns(concepts);
      concepts = ensureKeyNounsFromTranslation(translation, concepts);
    }
    if (concepts.length === 0) concepts = [translation.trim().toLowerCase()];
    
    document.getElementById("conceptsResult").textContent = 
      concepts.join(", ");
    
    // ÉTAPE 3: Build and show the set of videos (one per word/phrase)
    await ensureAnimationsVideoListLoaded();
    var signItems = buildSentenceSignItems(concepts);
    renderSentenceSignsStrip(signItems);
    
    // Afficher tout de suite inconnue.mp4 dans le lecteur principal (plus de placeholder)
    showVideoInAvatarZone(FALLBACK_VIDEO_KEY);
    
    // ÉTAPE 4: Animer l'avatar (play sequence in main player)
    animateAvatarWithConcepts(concepts);
    
    // ÉTAPE 5: Historique
    saveToHistory(inputText, translation, concepts);
    
  } catch (error) {
    // En cas d'erreur
    document.getElementById("translationResult").innerHTML = 
      `<span class="translation-error">❌ ${error.message}</span>`;
    document.getElementById("translationResult").className = "lang-text translation-text error";
    document.getElementById("conceptsResult").textContent = "";
    renderSentenceSignsStrip([]);
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
var currentSequenceRunId = 0; // invalidé à chaque nouvelle recherche pour fermer la boucle

function playSignAtIndex(signNames, concepts, index, runId) {
  if (runId === undefined) runId = currentSequenceRunId;
  var currentEl = document.getElementById("currentSign");
  if (index >= signNames.length) {
    // Boucle sur toute la séquence sauf si une nouvelle recherche a été faite
    if (signNames.length > 0 && runId === currentSequenceRunId) {
      playSignAtIndex(signNames, concepts, 0, runId);
      return;
    }
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
    playAnimationSignInAvatarZone(phraseMatch.key, signNames, concepts, index, phraseMatch.length, runId);
    return;
  }
  var animationKey = getAnimationKeyForConcept(concept || wordDisplay);
  if (animationKey) {
    playAnimationSignInAvatarZone(animationKey, signNames, concepts, index, 1, runId);
    return;
  }

  var glbKey = getGlbAnimationKeyForConcept(concept || wordDisplay);
  if (glbKey) {
    playGlbAnimationInAvatarZone(glbKey, signNames, concepts, index, runId);
    return;
  }

  var skeletonFile = findSkeletonFileForConcept(concept || wordDisplay);
  if (skeletonFile && avatar) {
    var apiBase = window.location.origin || "";
    var url = apiBase + "/api/skeleton_animation?name=" + encodeURIComponent(skeletonFile);
    var rId = runId;
    fetch(url)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || r.statusText); });
        return r.json();
      })
      .then(function (motion) {
        if (motion.tracks) {
          playVideoMotion(motion);
          var durationMs = (motion.duration || 2) * 1000;
          setTimeout(function () { playSignAtIndex(signNames, concepts, index + 1, rId); }, Math.max(durationMs, 1500));
          return;
        }
        throw new Error("Format invalide");
      })
      .catch(function () {
        playFallbackSignAndNext(signNames, concepts, index, rId);
      });
    return;
  }

  playFallbackSignAndNext(signNames, concepts, index, runId);
}

function playFallbackSignAndNext(signNames, concepts, index, runId) {
  // Pas de vidéo pour ce concept (ex. "danse") → afficher inconnue.mp4 dans le lecteur
  var onlyOneSign = signNames.length === 1;
  showVideoInAvatarZone(FALLBACK_VIDEO_KEY, onlyOneSign);
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
  if (onlyOneSign) {
    isPlayingSequence = false;
    return;
  }
  setTimeout(function () { playSignAtIndex(signNames, concepts, index + 1, runId); }, SIGN_DURATION_MS);
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
  playSignAtIndex(signNames, currentConceptsList, 0, currentSequenceRunId);
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
var voiceChronoIntervalId = null;
var voiceChronoStartTime = 0;
var voiceRecognitionActive = false;

function clearVoiceInput() {
  document.getElementById("textInput").value = "";
  var statusEl = document.getElementById("voiceStatus");
  if (statusEl) { statusEl.textContent = ""; statusEl.className = "voice-status"; }
  var chronoEl = document.getElementById("voiceChrono");
  if (chronoEl) chronoEl.textContent = "0:00";
  var btnMic = document.getElementById("btnMic");
  if (btnMic) btnMic.classList.remove("listening");
  var hintEl = document.getElementById("voiceListeningHint");
  if (hintEl) { hintEl.hidden = true; hintEl.setAttribute("aria-hidden", "true"); }
}

function stopVoiceChrono() {
  if (voiceChronoIntervalId) {
    clearInterval(voiceChronoIntervalId);
    voiceChronoIntervalId = null;
  }
  voiceRecognitionActive = false;
  var btnMic = document.getElementById("btnMic");
  if (btnMic) btnMic.classList.remove("listening");
  var hintEl = document.getElementById("voiceListeningHint");
  if (hintEl) { hintEl.hidden = true; hintEl.setAttribute("aria-hidden", "true"); }
}

function startVoiceChrono() {
  voiceChronoStartTime = Date.now();
  voiceRecognitionActive = true;
  var chronoEl = document.getElementById("voiceChrono");
  if (!chronoEl) return;
  chronoEl.textContent = "0:00";
  chronoEl.classList.add("voice-chrono--active");
  voiceChronoIntervalId = setInterval(function () {
    if (!voiceRecognitionActive) return;
    var sec = Math.floor((Date.now() - voiceChronoStartTime) / 1000);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    chronoEl.textContent = m + ":" + (s < 10 ? "0" : "") + s;
  }, 1000);
}

function startVoiceRecognition() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("La reconnaissance vocale n'est pas supportée par votre navigateur");
    return;
  }
  
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  
  recognition.lang = "ar";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  
  recognition.onstart = () => {
    var statusEl = document.getElementById("voiceStatus");
    statusEl.textContent = "🎤 Écoute… Parlez en dialecte tunisien";
    statusEl.className = "voice-status active";
    var btnMic = document.getElementById("btnMic");
    if (btnMic) btnMic.classList.add("listening");
    var hintEl = document.getElementById("voiceListeningHint");
    if (hintEl) { hintEl.hidden = false; hintEl.setAttribute("aria-hidden", "false"); }
    startVoiceChrono();
  };
  
  recognition.onresult = (event) => {
    stopVoiceChrono();
    var chronoEl = document.getElementById("voiceChrono");
    if (chronoEl) chronoEl.classList.remove("voice-chrono--active");
    var hintEl = document.getElementById("voiceListeningHint");
    if (hintEl) { hintEl.hidden = true; hintEl.setAttribute("aria-hidden", "true"); }
    const transcript = event.results[0][0].transcript;
    document.getElementById("textInput").value = transcript;
    document.getElementById("voiceStatus").textContent = "✓ Texte capturé";
    document.getElementById("voiceStatus").className = "voice-status success";
    setTimeout(() => {
      processFullTranslation();
      document.getElementById("voiceStatus").textContent = "";
    }, 800);
  };
  
  recognition.onerror = (event) => {
    stopVoiceChrono();
    var chronoEl = document.getElementById("voiceChrono");
    if (chronoEl) chronoEl.classList.remove("voice-chrono--active");
    var hintEl = document.getElementById("voiceListeningHint");
    if (hintEl) { hintEl.hidden = true; hintEl.setAttribute("aria-hidden", "true"); }
    console.error("Erreur reconnaissance:", event.error);
    var message = "Erreur de microphone";
    if (event.error === 'no-speech') message = "Aucune parole détectée";
    if (event.error === 'audio-capture') message = "Microphone non disponible";
    if (event.error === 'not-allowed') message = "Microphone bloqué";
    document.getElementById("voiceStatus").textContent = "❌ " + message;
    document.getElementById("voiceStatus").className = "voice-status error";
  };
  
  recognition.onend = () => {
    stopVoiceChrono();
    var chronoEl = document.getElementById("voiceChrono");
    if (chronoEl) chronoEl.classList.remove("voice-chrono--active");
    var hintEl = document.getElementById("voiceListeningHint");
    if (hintEl) { hintEl.hidden = true; hintEl.setAttribute("aria-hidden", "true"); }
    setTimeout(() => {
      document.getElementById("voiceStatus").textContent = "";
      document.getElementById("voiceStatus").className = "voice-status";
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
  document.getElementById("originalText").textContent = "—";
  document.getElementById("translationResult").innerHTML = "La traduction s'affichera ici";
  document.getElementById("translationResult").className = "lang-text translation-text";
  document.getElementById("conceptsResult").textContent = "—";
  document.getElementById("currentSign").textContent = "Prêt";
  document.getElementById("voiceStatus").textContent = "";
  renderSentenceSignsStrip([]);
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
// RACCOURCIS CLAVIER (tout le site)
// ================================
function toggleKeyboardShortcuts() {
  var panel = document.getElementById("keyboardShortcutsPanel");
  if (!panel) return;
  var isHidden = panel.hidden;
  panel.hidden = !isHidden;
  if (!isHidden) {
    var btn = document.getElementById("keyboardShortcutsBtn");
    if (btn) btn.focus();
  }
}

function handleGlobalKeydown(e) {
  var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
  var isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target && e.target.isContentEditable);
  var alt = e.altKey;
  var ctrl = e.ctrlKey || e.metaKey;

  if (e.key === "Escape") {
    e.preventDefault();
    var askOverlay = document.getElementById("eyeCursorAskOverlay");
    var eyeOverlay = document.getElementById("eyeCursorOverlay");
    var settingsPanel = document.getElementById("settingsPanel");
    var shortcutsPanel = document.getElementById("keyboardShortcutsPanel");
    if (shortcutsPanel && !shortcutsPanel.hidden) {
      shortcutsPanel.hidden = true;
      return;
    }
    if (settingsPanel && settingsPanel.classList.contains("is-open")) {
      toggleSettingsPanel();
      return;
    }
    if (eyeOverlay && !eyeOverlay.hidden && typeof stopEyeCursor === "function") {
      stopEyeCursor();
      return;
    }
    if (askOverlay && !askOverlay.hidden && typeof eyeCursorAskAnswer === "function") {
      eyeCursorAskAnswer(false);
      return;
    }
    return;
  }

  if (alt && e.key === "1") {
    e.preventDefault();
    switchMainTab("traduction");
    return;
  }
  if (alt && e.key === "2") {
    e.preventDefault();
    switchMainTab("detection");
    return;
  }
  if (alt && e.key === "3") {
    e.preventDefault();
    switchMainTab("asl");
    return;
  }
  if (alt && e.key === "4") {
    e.preventDefault();
    switchMainTab("imageText");
    return;
  }
  if (alt && e.key === "5") {
    e.preventDefault();
    switchMainTab("videoSubs");
    return;
  }
  if (alt && (e.key === "S" || e.key === "s")) {
    e.preventDefault();
    toggleSettingsPanel();
    return;
  }
  if (alt && (e.key === "M" || e.key === "m")) {
    e.preventDefault();
    var panel = document.getElementById("panelTraduction");
    if (panel && !panel.hasAttribute("hidden") && typeof startVoiceRecognition === "function")
      startVoiceRecognition();
    return;
  }

  if (ctrl && e.key === "Enter") {
    e.preventDefault();
    if (!isInput || tag === "TEXTAREA") {
      var ask = document.getElementById("eyeCursorAskOverlay");
      var eye = document.getElementById("eyeCursorOverlay");
      if (ask && !ask.hidden) return;
      if (eye && !eye.hidden) return;
      processFullTranslation();
    }
    return;
  }

  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    var tabId = e.target.id;
    var tabIds = ["tabTraduction", "tabDetection", "tabASL", "tabImageText", "tabVideoSubs"];
    var idx = tabIds.indexOf(tabId);
    if (idx >= 0) {
      e.preventDefault();
      if (e.key === "ArrowLeft") idx = Math.max(0, idx - 1);
      else idx = Math.min(4, idx + 1);
      switchMainTab(["traduction", "detection", "asl", "imageText", "videoSubs"][idx]);
      var nextTab = document.getElementById(tabIds[idx]);
      if (nextTab) nextTab.focus();
    }
  }
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
  if (isOpen) syncSettingsPanelDisplay();
}

/** Met à jour l'affichage des valeurs dans le panneau Affichage (contrast %, etc.) */
function syncSettingsPanelDisplay() {
  var rng = document.getElementById("contrastRange");
  var valEl = document.getElementById("contrastValue");
  if (rng && valEl) {
    var v = parseFloat(rng.value) || 1;
    valEl.textContent = Math.round(v * 100) + "%";
    rng.setAttribute("aria-valuenow", Math.round(v * 100));
  }
}
function applyPageContrast(value) {
  var v = parseFloat(value) || 1;
  v = Math.max(1, Math.min(1.5, v));
  var wrap = document.getElementById("pageContentWrap");
  if (wrap) {
    wrap.style.setProperty("--page-contrast", String(v));
    if (v !== 1) wrap.classList.add("page-contrast");
    else wrap.classList.remove("page-contrast");
  }
  var el = document.getElementById("contrastValue");
  if (el) el.textContent = Math.round(v * 100) + "%";
  var rng = document.getElementById("contrastRange");
  if (rng) { rng.value = String(v); rng.setAttribute("aria-valuenow", Math.round(v * 100)); }
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
    if (mode === "sombre" || mode === "clair" || mode === "nuit") applyDisplayMode(mode);
    else applyDisplayMode("sombre");
    var c = localStorage.getItem("voiceToSign_contrast");
    var v = parseFloat(c);
    if (!isNaN(v) && v >= 1 && v <= 1.5) {
      var rng = document.getElementById("contrastRange");
      if (rng) rng.value = String(v);
      applyPageContrast(v);
    }
    var t = localStorage.getItem("voiceToSign_theme");
    if (t === "default" || t === "blue" || t === "purple" || t === "orange" || t === "green") applyTheme(t);
    else applyTheme("default");
    var fs = localStorage.getItem("voiceToSign_fontSize");
    var pct = parseInt(fs, 10);
    var sel = document.getElementById("fontSizeSelect");
    if (!isNaN(pct) && pct >= 90 && pct <= 125) {
      applyFontSize(pct);
      if (sel) sel.value = String(pct);
    } else {
      applyFontSize(100);
      if (sel) sel.value = "100";
    }
  } catch (_) {}
}

// ================================
// QUESTION AU CHARGEMENT : VOULEZ-VOUS LE CURSEUR YEUX ? (agent + voix Oui/Non)
// ================================
var eyeCursorAskRecognition = null;

function eyeCursorAskAnswer(useEyeCursor) {
  var overlay = document.getElementById("eyeCursorAskOverlay");
  if (overlay) overlay.hidden = true;
  if (eyeCursorAskRecognition) {
    try { eyeCursorAskRecognition.stop(); } catch (e) {}
    eyeCursorAskRecognition = null;
  }
  var statusEl = document.getElementById("eyeCursorAskStatus");
  if (statusEl) statusEl.textContent = "";
  if (useEyeCursor && typeof startEyeCursor === "function") startEyeCursor();
}

function eyeCursorAskNormalize(t) {
  if (!t) return "";
  return t.toLowerCase().trim()
    .replace(/[.!?,;:'"]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[éèêë]/g, "e")
    .replace(/[àâä]/g, "a")
    .replace(/[îï]/g, "i")
    .replace(/[ùûü]/g, "u");
}

function eyeCursorAskIsOui(transcript) {
  if (!transcript || typeof transcript !== "string") return false;
  var t = eyeCursorAskNormalize(transcript);
  var raw = transcript.trim();
  var firstWord = (t.split(" ")[0] || t).trim();
  var ouiWords = ["oui", "yes", "ouais", "ey", "eyy", "eyyy", "eyyyy", "ay", "e", "eh", "et", "es", "ei", "ah", "a", "eui", "he", "eh"];
  if (ouiWords.indexOf(t) !== -1 || ouiWords.indexOf(firstWord) !== -1) return true;
  if (t.length <= 4 && (/^e/.test(t) || /^ey/.test(t) || /^ay/.test(t) || /^eh/.test(t) || /^he/.test(t))) return true;
  if (/^(oui|yes|ouais|ey|ay|eh|et)\s/.test(t) || /^(oui|yes|ouais|ey|ay)$/.test(t)) return true;
  if (/[\u0627\u0623\u0625]\u064a/.test(raw) || /\u0627\u064a|\u0623\u064a/.test(raw)) return true;
  return false;
}

function eyeCursorAskIsNon(transcript) {
  if (!transcript || typeof transcript !== "string") return false;
  var t = eyeCursorAskNormalize(transcript);
  var raw = transcript.trim();
  var firstWord = (t.split(" ")[0] || t).trim();
  var nonWords = ["non", "no", "nope", "le", "la", "lay", "lai", "na", "l"];
  if (nonWords.indexOf(t) !== -1) return true;
  if (firstWord.length <= 3 && nonWords.indexOf(firstWord) !== -1 && t.length <= 6) return true;
  if (t === "le" || t === "la" || t === "lay" || t === "lai" || t === "l") return true;
  if (raw.indexOf("\u0644\u0627") >= 0 || raw.indexOf("لا") >= 0) return true;
  return false;
}

var eyeCursorAskLangTried = null;

function eyeCursorAskStartVoice() {
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) return;
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = new SpeechRecognition();
  recognition.lang = eyeCursorAskLangTried === "fr-FR" ? "fr-FR" : "ar";
  if (!eyeCursorAskLangTried) eyeCursorAskLangTried = recognition.lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;
  var statusEl = document.getElementById("eyeCursorAskStatus");
  recognition.onresult = function (event) {
    for (var i = event.resultIndex; i < event.results.length; i++) {
      if (!event.results[i].isFinal) continue;
      for (var alt = 0; alt < Math.min(3, event.results[i].length); alt++) {
        var transcript = (event.results[i][alt] && event.results[i][alt].transcript) ? event.results[i][alt].transcript : "";
        if (!transcript) continue;
        if (eyeCursorAskIsOui(transcript)) {
          if (statusEl) statusEl.textContent = "Oui — activation du curseur yeux…";
          eyeCursorAskAnswer(true);
          return;
        }
        if (eyeCursorAskIsNon(transcript)) {
          if (statusEl) statusEl.textContent = "Non — fermeture.";
          eyeCursorAskAnswer(false);
          return;
        }
      }
    }
  };
  recognition.onerror = function (e) {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      if (statusEl) statusEl.textContent = "Autorisez le micro ou cliquez Oui/Non.";
    }
    if (e.error === "language-not-supported" && recognition.lang === "ar") {
      eyeCursorAskLangTried = "fr-FR";
      setTimeout(function () { eyeCursorAskStartVoice(); }, 400);
    }
  };
  recognition.onend = function () {
    if (document.getElementById("eyeCursorAskOverlay") && !document.getElementById("eyeCursorAskOverlay").hidden)
      setTimeout(function () { eyeCursorAskStartVoice(); }, 300);
  };
  try {
    recognition.start();
    eyeCursorAskRecognition = recognition;
    if (statusEl) statusEl.textContent = "Écoute… Dites « Oui » / « Ey » ou « Non » / « Le ».";
  } catch (e) {
    if (recognition.lang === "ar") {
      eyeCursorAskLangTried = "fr-FR";
      setTimeout(function () { eyeCursorAskStartVoice(); }, 400);
    } else {
      if (statusEl) statusEl.textContent = "Micro non disponible. Cliquez Oui ou Non.";
    }
  }
}

function showEyeCursorAsk() {
  eyeCursorAskLangTried = null;
  var overlay = document.getElementById("eyeCursorAskOverlay");
  if (!overlay) return;
  overlay.hidden = false;
  var statusEl = document.getElementById("eyeCursorAskStatus");
  if (statusEl) statusEl.textContent = "";
  setTimeout(function () { eyeCursorAskStartVoice(); }, 500);
}

// ================================
// CURSEUR PILOTÉ PAR LES YEUX (intégré au site, pas de script externe)
// ================================
var eyeCursorFaceLandmarker = null;
var eyeCursorStream = null;
var eyeCursorLoopId = null;
var eyeCursorCompactTimeoutId = null;
var eyeCursorVideoTs = 0;
var eyeCursorSmoothY = 0.5;
var eyeCursorBlinkCooldown = 0;
var eyeCursorLastFaceTime = 0;
var eyeCursorLastActivityTime = 0;
var eyeCursorLastX = -1;
var eyeCursorLastY = -1;
var eyeCursorHasSeenFaceOnce = false;   // true après la première détection (évite de fermer au démarrage)
var EYE_CURSOR_AUTO_CLOSE_MS = 5000;   // fermer si pas de mouvement pendant 5 s
var EYE_CURSOR_NO_FACE_CLOSE_MS = 3000; // fermer si visage/yeux non détectés pendant 3 s (après avoir vu le visage au moins une fois)
var EYE_CURSOR_SCROLL_MAX_PER_FRAME = 18;  // scroll peu à peu (petit pas par frame)
var EYE_CURSOR_DEAD_TOP = 0.40;
var EYE_CURSOR_DEAD_BOTTOM = 0.60;
var EYE_CURSOR_SMOOTH_ALPHA = 0.28;
var FACE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function startEyeCursor() {
  var btn = document.getElementById("eyeCursorBtn");
  var statusEl = document.getElementById("eyeCursorStatus");
  var overlay = document.getElementById("eyeCursorOverlay");
  var videoEl = document.getElementById("eyeCursorVideo");
  var dotEl = document.getElementById("eyeCursorDot");
  if (!overlay || !videoEl || !dotEl) return;
  if (btn) { btn.disabled = true; btn.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i> Démarrage…"; }
  if (statusEl) { statusEl.hidden = true; statusEl.textContent = ""; statusEl.className = "eye-cursor-status"; }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } }).then(function (stream) {
    eyeCursorStream = stream;
    videoEl.srcObject = stream;
    videoEl.onloadedmetadata = function () { videoEl.play().catch(function () {}); };
    function getFaceLandmarkerClasses(cb) {
      var FL = (typeof FaceLandmarker !== "undefined" ? FaceLandmarker : null) || (window.FaceLandmarker || (window.MediaPipeTasksVision && window.MediaPipeTasksVision.FaceLandmarker));
      var FR = (typeof FilesetResolver !== "undefined" ? FilesetResolver : null) || (window.FilesetResolver || (window.MediaPipeTasksVision && window.MediaPipeTasksVision.FilesetResolver));
      if (!FL && window.MediaPipeTasksVision && typeof window.MediaPipeTasksVision === "object") {
        var M = window.MediaPipeTasksVision;
        FL = M.FaceLandmarker || M.faceLandmarker;
        FR = FR || M.FilesetResolver || M.filesetResolver;
      }
      if (FL && FR) return cb(FL, FR);
      var url = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
      try {
        import(url).then(function (mod) {
          var FaceLandmarkerClass = mod.FaceLandmarker || (mod.default && mod.default.FaceLandmarker);
          var FilesetResolverClass = mod.FilesetResolver || (mod.default && mod.default.FilesetResolver);
          cb(FaceLandmarkerClass || null, FilesetResolverClass || null);
        }).catch(function () { cb(null, null); });
      } catch (e) {
        cb(null, null);
      }
    }
    getFaceLandmarkerClasses(function (FaceLandmarkerClass, FilesetResolverClass) {
      if (!FaceLandmarkerClass || !FilesetResolverClass) {
        stopEyeCursor();
        if (statusEl) { statusEl.textContent = "MediaPipe Face Landmarker non disponible. Vérifiez votre connexion ou utilisez un navigateur récent."; statusEl.classList.add("eye-cursor-status-err"); statusEl.hidden = false; }
        if (btn) { btn.disabled = false; btn.innerHTML = "<i class=\"fas fa-eye\"></i> Ouvrir le curseur piloté par les yeux"; }
        return;
      }
      var wasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
      FilesetResolverClass.forVisionTasks(wasmUrl).then(function (vision) {
        if (FaceLandmarkerClass.createFromModelPath) {
          return FaceLandmarkerClass.createFromModelPath(vision, FACE_LANDMARKER_MODEL_URL);
        }
        return FaceLandmarkerClass.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL },
          runningMode: "VIDEO",
          numFaces: 1
        });
      }).then(function (marker) {
      eyeCursorFaceLandmarker = marker;
      if (marker && marker.setOptions) marker.setOptions({ runningMode: "VIDEO" });
      overlay.hidden = false;
      overlay.setAttribute("aria-hidden", "false");
      var uiPanel = document.getElementById("eyeCursorUiPanel");
      if (uiPanel) uiPanel.classList.remove("eye-cursor-ui--compact");
      if (eyeCursorCompactTimeoutId) clearTimeout(eyeCursorCompactTimeoutId);
      eyeCursorCompactTimeoutId = setTimeout(function () {
        eyeCursorCompactTimeoutId = null;
        var p = document.getElementById("eyeCursorUiPanel");
        if (p) p.classList.add("eye-cursor-ui--compact");
      }, 4000);
      eyeCursorVideoTs = 0;
      eyeCursorSmoothY = 0.5;
      eyeCursorBlinkCooldown = 0;
      eyeCursorLastFaceTime = Date.now();
      eyeCursorLastActivityTime = Date.now();
      eyeCursorLastX = -1;
      eyeCursorLastY = -1;
      eyeCursorHasSeenFaceOnce = false;
      document.addEventListener("keydown", eyeCursorKeyHandler);
      if (statusEl) { statusEl.textContent = "Curseur yeux activé (intégré au site)."; statusEl.classList.add("eye-cursor-status-ok"); statusEl.hidden = false; }
      if (btn) { btn.disabled = false; btn.innerHTML = "<i class=\"fas fa-eye\"></i> Ouvrir le curseur piloté par les yeux"; }
      eyeCursorRunLoop();
    }).catch(function (err) {
      stopEyeCursor();
      if (statusEl) { statusEl.textContent = "Erreur chargement Face Landmarker : " + (err.message || String(err)); statusEl.classList.add("eye-cursor-status-err"); statusEl.hidden = false; }
      if (btn) { btn.disabled = false; btn.innerHTML = "<i class=\"fas fa-eye\"></i> Ouvrir le curseur piloté par les yeux"; }
    });
    });
  }).catch(function (err) {
    if (statusEl) { statusEl.textContent = "Caméra inaccessible : " + (err.message || err.name || "Erreur"); statusEl.classList.add("eye-cursor-status-err"); statusEl.hidden = false; }
    if (btn) { btn.disabled = false; btn.innerHTML = "<i class=\"fas fa-eye\"></i> Ouvrir le curseur piloté par les yeux"; }
  });
}

function eyeCursorKeyHandler(e) {
  if (e.key === "q" || e.key === "Q") {
    e.preventDefault();
    stopEyeCursor();
  }
}

function eyeCursorDrawEyePoints(landmarks, canvasEl) {
  if (!canvasEl || !landmarks || landmarks.length <= 473) return;
  var cw = 120;
  var ch = 90;
  if (canvasEl.width !== cw || canvasEl.height !== ch) {
    canvasEl.width = cw;
    canvasEl.height = ch;
  }
  var ctx = canvasEl.getContext("2d");
  ctx.clearRect(0, 0, cw, ch);
  function pt(lm) {
    if (!lm) return null;
    return { x: (1 - lm.x) * cw, y: lm.y * ch };
  }
  var irisLeft = pt(landmarks[468]);
  var irisRight = pt(landmarks[473]);
  var leftHigh = pt(landmarks[145]);
  var leftLow = pt(landmarks[159]);
  var rightHigh = pt(landmarks[386]);
  var rightLow = pt(landmarks[374]);
  if (irisLeft) {
    ctx.fillStyle = "rgba(45, 212, 191, 0.9)";
    ctx.beginPath();
    ctx.arc(irisLeft.x, irisLeft.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  if (irisRight) {
    ctx.fillStyle = "rgba(45, 212, 191, 0.9)";
    ctx.beginPath();
    ctx.arc(irisRight.x, irisRight.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  [leftHigh, leftLow, rightHigh, rightLow].forEach(function (p) {
    if (!p) return;
    ctx.fillStyle = "rgba(252, 211, 77, 0.85)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function eyeCursorRunLoop() {
  if (eyeCursorLoopId) cancelAnimationFrame(eyeCursorLoopId);
  var videoEl = document.getElementById("eyeCursorVideo");
  var dotEl = document.getElementById("eyeCursorDot");
  var canvasEl = document.getElementById("eyeCursorCanvas");
  if (!videoEl || !dotEl || !eyeCursorFaceLandmarker || videoEl.readyState < 2) {
    eyeCursorLoopId = requestAnimationFrame(eyeCursorRunLoop);
    return;
  }
  var w = window.innerWidth;
  var h = window.innerHeight;
  eyeCursorVideoTs += 33;
  var result;
  try {
    result = eyeCursorFaceLandmarker.detectForVideo(videoEl, eyeCursorVideoTs);
  } catch (err) {
    eyeCursorLoopId = requestAnimationFrame(eyeCursorRunLoop);
    return;
  }
  var landmarks = (result && (result.faceLandmarks || result.face_landmarks) && (result.faceLandmarks[0] || result.face_landmarks[0])) || null;
  if (canvasEl) {
    if (landmarks && landmarks.length > 473) {
      eyeCursorDrawEyePoints(landmarks, canvasEl);
    } else {
      var ctx = canvasEl.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvasEl.width || 120, canvasEl.height || 90);
    }
  }
  var now = Date.now();
  var noFace = !landmarks || landmarks.length <= 473;
  var noFaceMsgEl = document.getElementById("eyeCursorNoFaceMsg");
  if (noFace) {
    if (noFaceMsgEl) { noFaceMsgEl.hidden = false; noFaceMsgEl.textContent = "Recherche du visage… (redétection)"; }
    if (eyeCursorHasSeenFaceOnce && (now - eyeCursorLastFaceTime > EYE_CURSOR_NO_FACE_CLOSE_MS)) {
      stopEyeCursor();
      return;
    }
  } else {
    eyeCursorHasSeenFaceOnce = true;
    eyeCursorLastFaceTime = now;
    if (noFaceMsgEl) noFaceMsgEl.hidden = true;
    var leftIris = landmarks[468];
    var rightIris = landmarks[473];
    var screenX = 0, screenY = 0;
    if (leftIris && rightIris) {
      var pupilX = (leftIris.x + rightIris.x) / 2;
      var pupilY = (leftIris.y + rightIris.y) / 2;
      screenX = (1 - pupilX) * w;
      screenY = pupilY * h;
      var moved = (eyeCursorLastX < 0) || (Math.abs(screenX - eyeCursorLastX) > 4 || Math.abs(screenY - eyeCursorLastY) > 4);
      if (moved) {
        eyeCursorLastActivityTime = now;
        eyeCursorLastX = screenX;
        eyeCursorLastY = screenY;
      }
      dotEl.style.left = screenX + "px";
      dotEl.style.top = screenY + "px";
      eyeCursorSmoothY = EYE_CURSOR_SMOOTH_ALPHA * eyeCursorSmoothY + (1 - EYE_CURSOR_SMOOTH_ALPHA) * pupilY;
      if (eyeCursorSmoothY < EYE_CURSOR_DEAD_TOP) {
        var force = (EYE_CURSOR_DEAD_TOP - eyeCursorSmoothY) / EYE_CURSOR_DEAD_TOP;
        window.scrollBy(0, -force * EYE_CURSOR_SCROLL_MAX_PER_FRAME);
        eyeCursorLastActivityTime = now;
      } else if (eyeCursorSmoothY > EYE_CURSOR_DEAD_BOTTOM) {
        var force = (eyeCursorSmoothY - EYE_CURSOR_DEAD_BOTTOM) / (1 - EYE_CURSOR_DEAD_BOTTOM);
        window.scrollBy(0, force * EYE_CURSOR_SCROLL_MAX_PER_FRAME);
        eyeCursorLastActivityTime = now;
      }
    }
    var leftHigh = landmarks[145];
    var leftLow = landmarks[159];
    var rightHigh = landmarks[386];
    var rightLow = landmarks[374];
    if (leftHigh && leftLow && rightHigh && rightLow && eyeCursorBlinkCooldown <= 0) {
      var leftClosed = (leftHigh.y - leftLow.y) < 0.004;
      var rightClosed = (rightHigh.y - rightLow.y) < 0.004;
      if (leftClosed && rightClosed) {
        var el = document.elementFromPoint(screenX, screenY);
        if (el) {
          try { el.click(); } catch (e) {}
        }
        eyeCursorBlinkCooldown = 25;
        eyeCursorLastActivityTime = now;
      }
    }
  }
  var chronoEl = document.getElementById("eyeCursorChrono");
  if (chronoEl) {
    var noFaceRemaining = EYE_CURSOR_NO_FACE_CLOSE_MS - (now - eyeCursorLastFaceTime);
    var noMoveRemaining = EYE_CURSOR_AUTO_CLOSE_MS - (now - eyeCursorLastActivityTime);
    var remainingMs;
    var label = "Fermeture dans";
    if (noFace && eyeCursorHasSeenFaceOnce) {
      remainingMs = noFaceRemaining;
      label = "Redétection : fermeture dans";
    } else {
      remainingMs = noMoveRemaining;
    }
    var remainingSec = Math.min(5, Math.max(0, Math.ceil(remainingMs / 1000)));
    chronoEl.textContent = remainingSec > 0 ? label + " : " + remainingSec + " s" : "—";
  }
  if (now - eyeCursorLastActivityTime > EYE_CURSOR_AUTO_CLOSE_MS) {
    stopEyeCursor();
    return;
  }
  if (eyeCursorBlinkCooldown > 0) eyeCursorBlinkCooldown--;
  eyeCursorLoopId = requestAnimationFrame(eyeCursorRunLoop);
}

function stopEyeCursor() {
  document.removeEventListener("keydown", eyeCursorKeyHandler);
  if (eyeCursorCompactTimeoutId) {
    clearTimeout(eyeCursorCompactTimeoutId);
    eyeCursorCompactTimeoutId = null;
  }
  if (eyeCursorLoopId) {
    cancelAnimationFrame(eyeCursorLoopId);
    eyeCursorLoopId = null;
  }
  if (eyeCursorStream) {
    eyeCursorStream.getTracks().forEach(function (t) { t.stop(); });
    eyeCursorStream = null;
  }
  eyeCursorFaceLandmarker = null;
  var overlay = document.getElementById("eyeCursorOverlay");
  var videoEl = document.getElementById("eyeCursorVideo");
  if (overlay) { overlay.hidden = true; overlay.setAttribute("aria-hidden", "true"); }
  if (videoEl) { videoEl.srcObject = null; }
  window.location.reload();
}

// ================================
// ACCESSIBILITÉ WCAG (API WebAIM + wcag-api.js)
// ================================
function runWcagCheck() {
  var btn = document.getElementById("wcagCheckBtn");
  var block = document.getElementById("wcagCheckResults");
  if (!block) return;
  if (btn) { btn.disabled = true; btn.innerHTML = "<i class=\"fas fa-spinner fa-spin\"></i> Vérification…"; }
  block.hidden = true;
  block.innerHTML = "";
  var api = typeof WCAG_ACCESSIBILITY !== "undefined" ? WCAG_ACCESSIBILITY : null;
  if (!api || !api.runFullCheck) {
    block.innerHTML = "<p class=\"wcag-result-fail\">Module WCAG non chargé. Vérifiez que wcag-api.js est inclus.</p>";
    block.hidden = false;
    if (btn) { btn.disabled = false; btn.innerHTML = "<i class=\"fas fa-check-double\"></i> Vérifier le contraste"; }
    return;
  }
  api.runFullCheck().then(function (results) {
    var html = "";
    results.forEach(function (item) {
      if (item.error) {
        html += "<div class=\"wcag-result-line\"><span>" + item.label + "</span><span class=\"wcag-result-fail\">—</span></div>";
        return;
      }
      var r = item.result;
      var ok = r.aa || r.aaLarge;
      var cls = ok ? "wcag-result-ok" : "wcag-result-fail";
      var label = r.aa ? "AA ✓" : (r.aaLarge ? "AA (grand) ✓" : "Insuffisant");
      html += "<div class=\"wcag-result-line\"><span>" + item.label + "</span><span class=\"wcag-result-ratio\">" + r.ratio + ":1</span><span class=\"" + cls + "\">" + label + "</span></div>";
    });
    block.innerHTML = html;
    block.hidden = false;
    if (btn) { btn.disabled = false; btn.innerHTML = "<i class=\"fas fa-check-double\"></i> Vérifier le contraste"; }
  }).catch(function (err) {
    block.innerHTML = "<p class=\"wcag-result-fail\">Erreur : " + (err.message || "Vérification impossible") + "</p>";
    block.hidden = false;
    if (btn) { btn.disabled = false; btn.innerHTML = "<i class=\"fas fa-check-double\"></i> Vérifier le contraste"; }
  });
}

function applyWcagColors() {
  var root = document.documentElement;
  var api = typeof WCAG_ACCESSIBILITY !== "undefined" ? WCAG_ACCESSIBILITY : null;
  if (!api) return;
  var W = api.WCAG || { AA_TEXT: 4.5 };
  var surfaceHex = api.getComputedHex("--surface") || "0c1222";
  var surface2Hex = api.getComputedHex("--surface-2") || "151d33";
  var textHex = api.getComputedHex("--text");
  var textMutedHex = api.getComputedHex("--text-muted");
  var primaryHex = api.getComputedHex("--primary") || "0d9488";
  var ratioText = textHex ? api.contrastRatio(textHex, surfaceHex) : 21;
  var ratioMuted = textMutedHex ? api.contrastRatio(textMutedHex, surface2Hex) : 0;
  if (ratioText < W.AA_TEXT) {
    var suggested = api.suggestAccessibleFg(surfaceHex, W.AA_TEXT);
    if (suggested) root.style.setProperty("--text", "#" + suggested);
  }
  if (ratioMuted > 0 && ratioMuted < W.AA_TEXT) {
    var suggestedMuted = api.suggestAccessibleFg(surface2Hex, W.AA_LARGE);
    if (suggestedMuted) root.style.setProperty("--text-muted", "#" + suggestedMuted);
  }
  var ratioPrimary = api.contrastRatio("ffffff", primaryHex);
  if (ratioPrimary < W.AA_TEXT) {
    root.style.setProperty("--primary", "#0f766e");
    root.style.setProperty("--primary-light", "#14b8a6");
  }
  runWcagCheck();
}

// ================================
// LECTURE DU NOM DES BOUTONS (icône haut-parleur sur chaque bouton)
// ================================
function getButtonAccessibleName(btn) {
  var name = btn.getAttribute("aria-label");
  if (name && name.trim()) return name.trim();
  var clone = btn.cloneNode(true);
  var speakIcons = clone.querySelectorAll(".btn-speak-label");
  speakIcons.forEach(function (el) { el.remove(); });
  return (clone.textContent || "").trim().replace(/\s+/g, " ") || btn.getAttribute("title") || "";
}

function speakButtonLabel(event) {
  event.preventDefault();
  event.stopPropagation();
  var btn = event.target.closest("button");
  if (!btn) return;
  var label = btn.getAttribute("data-speak-label") || getButtonAccessibleName(btn);
  if (!label) return;
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(label);
    u.lang = "fr-FR";
    u.rate = 0.95;
    var voices = window.speechSynthesis.getVoices();
    var fr = voices.filter(function (v) { return v.lang.startsWith("fr"); })[0];
    if (fr) u.voice = fr;
    window.speechSynthesis.speak(u);
  }
}

function injectSpeakIconsOnButtons() {
  var buttons = document.querySelectorAll("button:not(.btn-speak-label-only)");
  buttons.forEach(function (btn) {
    if (btn.querySelector(".btn-speak-label")) return;
    var name = btn.getAttribute("aria-label") || (btn.textContent || "").trim().replace(/\s+/g, " ");
    if (name) btn.setAttribute("data-speak-label", name);
    var span = document.createElement("span");
    span.className = "btn-speak-label";
    span.setAttribute("aria-label", "Lire le nom du bouton");
    span.setAttribute("title", "Lire le nom du bouton");
    span.innerHTML = "<i class=\"fas fa-volume-up\" aria-hidden=\"true\"></i>";
    span.addEventListener("click", speakButtonLabel);
    btn.appendChild(span);
  });
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
  setTimeout(function () { showEyeCursorAsk(); }, 400);

  document.addEventListener("keydown", handleGlobalKeydown);
  setupASLCapturePanel();
  injectSpeakIconsOnButtons();

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

  setupTextToCharPanel();
  setupImageTextPanel();
  setupVideoSubsPanel();
}

// ================================
// TEXTE TO CARACTÈRE — saisie texte/vocal → une image par caractère (dataset ArabicSign/data)
// ================================
var TEXT_TO_CHAR_ARABIC_MAP = {
  "\u0627": "alif", "\u0623": "alif", "\u0625": "alif", "\u0622": "alif", "\u0621": "alif",
  "\u0628": "ba2", "\u062A": "ta2", "\u062B": "thaaa", "\u062C": "jeeem", "\u062D": "haa2",
  "\u062E": "khaaa", "\u062F": "daal", "\u0630": "thaal", "\u0631": "ra2", "\u0632": "zaay",
  "\u0633": "seeen", "\u0634": "sheeen", "\u0635": "saaad", "\u0636": "dhaad", "\u0637": "dha2",
  "\u0638": "dhaad", "\u0639": "aeyn", "\u063A": "ghayn", "\u0641": "fa2", "\u0642": "gaf",
  "\u0643": "kaaaf", "\u0644": "laaam", "\u0645": "meeem", "\u0646": "nuun", "\u0647": "haa",
  "\u0648": "waaw", "\u064A": "yaa", "\u0649": "yaa2"
};
var TEXT_TO_CHAR_LATIN_MAP = {
  "alif": "alif", "a": "alif", "ba2": "ba2", "ba": "ba2", "b": "ba2", "ta2": "ta2", "ta": "ta2", "t": "ta2",
  "thaaa": "thaaa", "th": "thaaa", "jeeem": "jeeem", "jeem": "jeeem", "j": "jeeem",
  "haa2": "haa2", "haa": "haa", "dha2": "dha2", "daal": "daal", "dal": "daal", "d": "daal",
  "thaal": "thaal", "ra2": "ra2", "ra": "ra2", "r": "ra2", "zaay": "zaay", "z": "zaay",
  "seeen": "seeen", "seen": "seeen", "s": "seeen", "sheeen": "sheeen", "sheen": "sheeen", "sh": "sheeen",
  "saaad": "saaad", "saad": "saaad", "dhaad": "dhaad", "dhad": "dhaad", "aeyn": "aeyn", "ain": "aeyn",
  "ghayn": "ghayn", "ghain": "ghayn", "fa2": "fa2", "fa": "fa2", "f": "fa2", "gaf": "gaf", "g": "gaf",
  "kaaaf": "kaaaf", "kaaf": "kaaaf", "k": "kaaaf", "laaam": "laaam", "laam": "laaam", "l": "laaam",
  "laa": "laa", "meeem": "meeem", "meem": "meeem", "m": "meeem", "nuun": "nuun", "nun": "nuun", "n": "nuun",
  "haa": "haa", "h": "haa", "waaw": "waaw", "waw": "waaw", "w": "waaw",
  "yaa": "yaa", "ya": "yaa", "yaa2": "yaa2", "taa": "taa", "toott": "toott", "toot": "toott",
  "alif_lam": "alif_lam", "al": "alif_lam", "khaaa": "khaaa", "kh": "khaaa"
};

function splitInputToLetters(text) {
  var t = (text || "").trim();
  if (!t) return [];
  var out = [];
  var hasArabic = /[\u0600-\u06FF]/.test(t);
  if (hasArabic) {
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (/\s/.test(c)) continue;
      var folder = TEXT_TO_CHAR_ARABIC_MAP[c] || TEXT_TO_CHAR_ARABIC_MAP[c.toLowerCase ? c.toLowerCase() : c];
      if (folder) out.push({ char: c, folder: folder });
    }
  } else {
    var tokens = t.split(/\s+/);
    for (var j = 0; j < tokens.length; j++) {
      var tok = tokens[j].toLowerCase().replace(/[^a-z0-9_]/g, "");
          if (!tok) continue;
      var folder = TEXT_TO_CHAR_LATIN_MAP[tok];
      if (!folder && tok.length === 1) folder = TEXT_TO_CHAR_LATIN_MAP[tok];
      if (folder) out.push({ char: tok, folder: folder });
    }
  }
  return out;
}

function updateTextToCharCounter(n) {
  var el = document.getElementById("textToCharCounter");
  if (el) el.textContent = n === 1 ? "1 caractère" : n + " caractère(s)";
}

var textToCharLoopIntervalId = null;
var textToCharLoopItems = [];

function stopTextToCharLoop() {
  if (textToCharLoopIntervalId) {
    clearInterval(textToCharLoopIntervalId);
    textToCharLoopIntervalId = null;
  }
  textToCharLoopItems = [];
  var placeholder = document.getElementById("textToCharViewerPlaceholder");
  var img = document.getElementById("textToCharViewerImage");
  var label = document.getElementById("textToCharViewerLabel");
  if (placeholder) placeholder.style.display = "";
  if (img) { img.style.display = "none"; img.removeAttribute("src"); }
  if (label) label.textContent = "";
}

function clearTextToChar() {
  var inputEl = document.getElementById("textToCharInput");
  var container = document.getElementById("textToCharImages");
  var errorEl = document.getElementById("textToCharError");
  stopTextToCharLoop();
  if (inputEl) inputEl.value = "";
  if (container) container.innerHTML = "";
  if (errorEl) { errorEl.style.display = "none"; errorEl.textContent = ""; }
  updateTextToCharCounter(0);
}

function runTextToChar() {
  var inputEl = document.getElementById("textToCharInput");
  var container = document.getElementById("textToCharImages");
  var loadingEl = document.getElementById("textToCharLoading");
  var errorEl = document.getElementById("textToCharError");
  if (!inputEl || !container) return;
  var text = inputEl.value.trim();
  var items = splitInputToLetters(text);
  if (errorEl) errorEl.style.display = "none";
  container.innerHTML = "";
  updateTextToCharCounter(0);
  if (items.length === 0) {
    if (errorEl) { errorEl.textContent = "Entrez des lettres arabes ou des noms romanisés (ex: alif ba2)."; errorEl.style.display = "block"; }
    return;
  }
  updateTextToCharCounter(items.length);
  if (loadingEl) loadingEl.style.display = "block";
  var apiBase = typeof getApiBase === "function" ? getApiBase() : (window.location.origin || "");
  var viewerItems = items.map(function (item) {
    return { char: item.char, folder: item.folder, url: apiBase + "/api/letter_image/" + encodeURIComponent(item.folder) };
  });
  items.forEach(function (item) {
    var wrap = document.createElement("div");
    wrap.className = "char-image-wrap";
    var img = document.createElement("img");
    img.alt = item.char + " (" + item.folder + ")";
    img.src = apiBase + "/api/letter_image/" + encodeURIComponent(item.folder);
    img.onerror = function () { img.style.background = "#333"; img.title = "Image non disponible"; };
    var label = document.createElement("span");
    label.className = "char-label";
    label.textContent = item.char;
    wrap.appendChild(img);
    wrap.appendChild(label);
    container.appendChild(wrap);
  });
  if (loadingEl) loadingEl.style.display = "none";
  stopTextToCharLoop();
  textToCharLoopItems = viewerItems;
  if (viewerItems.length > 0) {
    var placeholder = document.getElementById("textToCharViewerPlaceholder");
    var viewerImg = document.getElementById("textToCharViewerImage");
    var viewerLabel = document.getElementById("textToCharViewerLabel");
    if (placeholder) placeholder.style.display = "none";
    if (viewerImg) viewerImg.style.display = "block";
    var idx = 0;
    function showNext() {
      if (textToCharLoopItems.length === 0) return;
      var it = textToCharLoopItems[idx];
      if (viewerImg) { viewerImg.src = it.url; viewerImg.alt = it.char; }
      if (viewerLabel) viewerLabel.textContent = it.char;
      idx = (idx + 1) % textToCharLoopItems.length;
    }
    showNext();
    textToCharLoopIntervalId = setInterval(showNext, 2500);
  }
}

function startTextToCharVoice() {
  var inputEl = document.getElementById("textToCharInput");
  var micBtn = document.getElementById("textToCharMic");
  var micIcon = document.getElementById("textToCharMicIcon");
  var hintEl = document.getElementById("textToCharMicHint");
  var statusEl = document.getElementById("textToCharMicStatus");
  function setListening(on) {
    if (micBtn) micBtn.classList.toggle("mic-listening", on);
    if (micIcon) micIcon.className = on ? "fas fa-microphone-slash" : "fas fa-microphone";
    if (hintEl) hintEl.style.display = on ? "none" : "";
    if (statusEl) {
      statusEl.hidden = !on;
      statusEl.textContent = on ? "Écoute… Parlez maintenant." : "";
      statusEl.className = "text-to-char-mic-status" + (on ? " is-listening" : "");
    }
  }
  if (!inputEl) return;
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    alert("Reconnaissance vocale non supportée par ce navigateur.");
    return;
  }
  var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = new Recognition();
  rec.lang = "ar-SA";
  rec.continuous = false;
  rec.interimResults = false;
  rec.onstart = function () { setListening(true); };
  rec.onend = function () { setListening(false); };
  rec.onerror = function () { setListening(false); };
  rec.onresult = function (e) {
    var t = (e.results[0] && e.results[0][0]) ? e.results[0][0].transcript : "";
    if (t) inputEl.value = (inputEl.value ? inputEl.value + " " : "") + t;
  };
  rec.start();
}

function setupTextToCharPanel() {
  var btn = document.getElementById("textToCharSubmit");
  if (btn) btn.addEventListener("click", runTextToChar);
  var inputEl = document.getElementById("textToCharInput");
  var container = document.getElementById("textToCharImages");
  if (inputEl) {
    inputEl.addEventListener("input", function () {
      var items = splitInputToLetters(this.value.trim());
      updateTextToCharCounter(items.length);
      if (container) container.innerHTML = "";
      stopTextToCharLoop();
    });
  }
}

// ================================
// Image → Texte (upload image, OCR, affichage avec espacement et couleurs)
// ================================
var imageTextCurrentFontSize = 18;
var imageTextExtractedText = "";

function setupImageTextPanel() {
  var fileInput = document.getElementById("imageTextFileInput");
  var preview = document.getElementById("imageTextPreview");
  var previewWrap = document.getElementById("imageTextPreviewWrap");
  var extractBtn = document.getElementById("imageTextExtractBtn");
  var fileNameSpan = document.getElementById("imageTextFileName");
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      var f = this.files && this.files[0];
      if (!f) {
        if (fileNameSpan) fileNameSpan.textContent = "Aucun fichier";
        if (previewWrap) previewWrap.style.display = "none";
        if (extractBtn) extractBtn.style.display = "none";
        return;
      }
      if (fileNameSpan) fileNameSpan.textContent = f.name;
      if (previewWrap) previewWrap.style.display = "block";
      if (extractBtn) extractBtn.style.display = "inline-flex";
      if (preview) {
        preview.alt = "Aperçu " + f.name;
        var url = URL.createObjectURL(f);
        preview.onload = function () { URL.revokeObjectURL(url); };
        preview.src = url;
      }
    });
  }
  var letterSpacing = document.getElementById("imageTextLetterSpacing");
  var lineHeight = document.getElementById("imageTextLineHeight");
  if (letterSpacing) letterSpacing.addEventListener("input", function () {
    var v = document.getElementById("imageTextLetterSpacingVal");
    if (v) v.textContent = this.value;
    applyImageTextStyle();
  });
  if (lineHeight) lineHeight.addEventListener("input", function () {
    var v = document.getElementById("imageTextLineHeightVal");
    if (v) v.textContent = this.value;
    applyImageTextStyle();
  });
  var lsVal = document.getElementById("imageTextLetterSpacingVal");
  var lhVal = document.getElementById("imageTextLineHeightVal");
  if (lsVal && letterSpacing) lsVal.textContent = letterSpacing.value;
  if (lhVal && lineHeight) lhVal.textContent = lineHeight.value;
}

function runImageTextOCR() {
  var fileInput = document.getElementById("imageTextFileInput");
  var statusEl = document.getElementById("imageTextOCRStatus");
  var outputEl = document.getElementById("imageTextOutput");
  var extractBtn = document.getElementById("imageTextExtractBtn");
  if (!fileInput || !fileInput.files || !fileInput.files[0]) {
    if (statusEl) { statusEl.style.display = "block"; statusEl.textContent = "Choisissez d'abord une image."; }
    return;
  }
  if (typeof Tesseract === "undefined") {
    if (statusEl) { statusEl.style.display = "block"; statusEl.textContent = "Tesseract.js non chargé. Vérifiez la connexion."; }
    return;
  }
  if (statusEl) { statusEl.style.display = "block"; statusEl.textContent = "Extraction en cours…"; }
  if (extractBtn) extractBtn.disabled = true;
  var file = fileInput.files[0];
  Tesseract.recognize(file, "fra+eng", { logger: function (m) {
    if (m.status && statusEl) statusEl.textContent = m.status;
  } }).then(function (result) {
    var text = (result.data && result.data.text) ? result.data.text.trim() : "";
    imageTextExtractedText = text;
    if (outputEl) {
      outputEl.innerHTML = "";
      outputEl.classList.remove("image-text-output-placeholder-wrap");
      if (!text) {
        outputEl.innerHTML = "<p class=\"image-text-output-placeholder\">Aucun texte détecté dans l'image.</p>";
      } else {
        var p = document.createElement("p");
        p.className = "image-text-output-text";
        p.textContent = text;
        outputEl.appendChild(p);
        applyImageTextStyle();
      }
    }
    if (statusEl) statusEl.textContent = "Texte extrait.";
    if (extractBtn) extractBtn.disabled = false;
  }).catch(function (err) {
    if (statusEl) statusEl.textContent = "Erreur : " + (err && err.message ? err.message : "OCR impossible");
    if (extractBtn) extractBtn.disabled = false;
  });
}

function applyImageTextStyle() {
  var outputEl = document.getElementById("imageTextOutput");
  var letterSpacing = document.getElementById("imageTextLetterSpacing");
  var lineHeight = document.getElementById("imageTextLineHeight");
  var colorInput = document.getElementById("imageTextColor");
  var colorHex = document.getElementById("imageTextColorHex");
  if (!outputEl) return;
  var textEl = outputEl.querySelector(".image-text-output-text");
  if (!textEl) return;
  var ls = letterSpacing ? parseInt(letterSpacing.value, 10) : 2;
  var lh = lineHeight ? parseInt(lineHeight.value, 10) : 140;
  var col = colorInput ? colorInput.value : "#886183";
  if (colorHex) colorHex.value = col;
  textEl.style.letterSpacing = ls + "px";
  textEl.style.lineHeight = lh + "%";
  textEl.style.fontSize = imageTextCurrentFontSize + "px";
  textEl.style.color = col;
}

function setImageTextFontSize(delta) {
  imageTextCurrentFontSize = Math.max(10, Math.min(72, imageTextCurrentFontSize + delta));
  var valEl = document.getElementById("imageTextFontSizeVal");
  if (valEl) valEl.textContent = imageTextCurrentFontSize;
  applyImageTextStyle();
}

function applyImageTextStyleFromHex() {
  var hex = document.getElementById("imageTextColorHex");
  var colorInput = document.getElementById("imageTextColor");
  if (!hex || !colorInput) return;
  var v = (hex.value || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
    colorInput.value = v;
    applyImageTextStyle();
  }
}

// ================================
// Vidéo → Sous-titres (upload vidéo + SRT/VTT, mot en cours animé et en couleur)
// ================================
var videoSubsCues = [];
var videoSubsArabicCache = {};
var videoSubsLastArabicRequest = null;
var videoSubsPlayer = null;

function parseSrtText(text) {
  var cues = [];
  var block = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n\n+/);
  for (var i = 0; i < block.length; i++) {
    var lines = block[i].trim().split("\n");
    if (lines.length < 2) continue;
    var match = lines[1].match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;
    var start = parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10) + parseInt(match[4], 10) / 1000;
    var end = parseInt(match[5], 10) * 3600 + parseInt(match[6], 10) * 60 + parseInt(match[7], 10) + parseInt(match[8], 10) / 1000;
    var textLine = lines.slice(2).join(" ").replace(/<[^>]+>/g, "").trim();
    if (textLine) cues.push({ start: start, end: end, text: textLine });
  }
  return cues;
}

function parseVttText(text) {
  var cues = [];
  var lines = (text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  var i = 0;
  while (i < lines.length) {
    var line = lines[i].trim();
    var match = line.match(/^(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2})\.(\d{3})/);
    if (match) {
      var start = parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + parseInt(match[3], 10) / 1000;
      var end = parseInt(match[4], 10) * 60 + parseInt(match[5], 10) + parseInt(match[6], 10) / 1000;
      var parts = [];
      i++;
      while (i < lines.length && lines[i].trim()) { parts.push(lines[i].trim()); i++; }
      var textLine = parts.join(" ").replace(/<[^>]+>/g, "").trim();
      if (textLine) cues.push({ start: start, end: end, text: textLine });
    }
    i++;
  }
  return cues;
}

function getVideoSubsCueAt(time) {
  for (var j = 0; j < videoSubsCues.length; j++) {
    if (time >= videoSubsCues[j].start && time <= videoSubsCues[j].end)
      return { cue: videoSubsCues[j], index: j };
  }
  return null;
}

function updateVideoSubsDisplay() {
  var player = document.getElementById("videoSubsPlayer");
  var contentEl = document.getElementById("videoSubsSubtitleContent");
  var arabicEl = document.getElementById("videoSubsArabicTranslation");
  if (!player || !contentEl) return;
  var t = player.currentTime;
  var result = getVideoSubsCueAt(t);
  if (!result) {
    contentEl.innerHTML = "";
    contentEl.textContent = "";
    if (arabicEl) { arabicEl.textContent = ""; arabicEl.classList.remove("video-subs-arabic--loading"); }
    return;
  }
  var cue = result.cue;
  var duration = cue.end - cue.start;
  var progress = duration > 0 ? (t - cue.start) / duration : 0;
  var words = cue.text.split(/\s+/).filter(Boolean);
  var currentWordIndex = progress >= 1 ? words.length - 1 : Math.min(Math.floor(progress * words.length), words.length - 1);
  contentEl.innerHTML = "";
  for (var w = 0; w < words.length; w++) {
    var span = document.createElement("span");
    span.className = "video-subs-word" + (w === currentWordIndex ? " video-subs-word--current" : "");
    span.textContent = words[w];
    contentEl.appendChild(span);
    if (w < words.length - 1) contentEl.appendChild(document.createTextNode(" "));
  }
  var cueText = cue.text.trim();
  if (!arabicEl) return;
  if (videoSubsArabicCache[cueText] !== undefined) {
    arabicEl.textContent = videoSubsArabicCache[cueText];
    arabicEl.classList.remove("video-subs-arabic--loading");
    return;
  }
  arabicEl.textContent = "…";
  arabicEl.classList.add("video-subs-arabic--loading");
  var requestId = cueText;
  videoSubsLastArabicRequest = requestId;
  translateWithGroqToArabic(cueText).then(function (ar) {
    videoSubsArabicCache[cueText] = ar;
    if (videoSubsLastArabicRequest === requestId && arabicEl) {
      arabicEl.textContent = ar;
      arabicEl.classList.remove("video-subs-arabic--loading");
    }
  }).catch(function () {
    if (videoSubsLastArabicRequest === requestId && arabicEl) {
      arabicEl.textContent = "";
      arabicEl.classList.remove("video-subs-arabic--loading");
    }
  });
}

function transcribeVideoSubs() {
  var videoInput = document.getElementById("videoSubsVideoInput");
  var btn = document.getElementById("videoSubsTranscribeBtn");
  var statusEl = document.getElementById("videoSubsTranscribeStatus");
  var loadingEl = document.getElementById("videoSubsTranscribeLoading");
  var contentEl = document.getElementById("videoSubsSubtitleContent");
  if (!videoInput || !videoInput.files || !videoInput.files[0]) {
    if (statusEl) statusEl.textContent = "Choisissez d'abord une vidéo.";
    return;
  }
  var formData = new FormData();
  formData.append("video", videoInput.files[0]);
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = "";
  if (loadingEl) loadingEl.style.display = "block";
  if (contentEl) contentEl.textContent = "Transcription en cours…";

  var apiBase = typeof getApiBase === "function" ? getApiBase() : (window.location.origin || "");
  var ctrl = new AbortController();
  var timeoutId = setTimeout(function () { ctrl.abort(); }, 600000);
  fetch(apiBase + "/api/video/transcribe", {
    method: "POST",
    body: formData,
    signal: ctrl.signal
  }).then(function (r) {
    clearTimeout(timeoutId);
    return r.json().then(function (data) {
      if (!r.ok) throw new Error(data.error || "Erreur " + r.status);
      return data;
    });
  }).then(function (data) {
    clearTimeout(timeoutId);
    videoSubsArabicCache = {};
    videoSubsLastArabicRequest = null;
    videoSubsCues = (data.cues || []).map(function (c) {
      return { start: c.start, end: c.end, text: c.text || "" };
    });
    if (contentEl) contentEl.textContent = videoSubsCues.length ? "" : "Aucune parole détectée.";
    if (statusEl) statusEl.textContent = videoSubsCues.length ? "Transcription terminée. Lancez la lecture." : "Aucun texte transcrit.";
    updateVideoSubsDisplay();
  }).catch(function (err) {
    clearTimeout(timeoutId);
    if (contentEl) contentEl.textContent = "";
    if (statusEl) statusEl.textContent = "Erreur : " + (err.message || "transcription impossible");
    videoSubsCues = [];
  }).finally(function () {
    clearTimeout(timeoutId);
    if (btn) btn.disabled = false;
    if (loadingEl) loadingEl.style.display = "none";
  });
}

function setupVideoSubsPanel() {
  var videoInput = document.getElementById("videoSubsVideoInput");
  var player = document.getElementById("videoSubsPlayer");
  var placeholder = document.getElementById("videoSubsPlaceholder");
  var transcribeBtn = document.getElementById("videoSubsTranscribeBtn");
  videoSubsPlayer = player;

  if (videoInput) {
    videoInput.addEventListener("change", function () {
      var f = this.files && this.files[0];
      var nameEl = document.getElementById("videoSubsVideoName");
      if (nameEl) nameEl.textContent = f ? f.name : "Aucune vidéo";
      if (transcribeBtn) transcribeBtn.disabled = !f;
      var container = player && player.closest(".video-subs-video-container");
      if (!f) {
        if (player) player.removeAttribute("src");
        if (placeholder) placeholder.style.display = "";
        if (container) container.classList.remove("has-video");
        videoSubsArabicCache = {};
        videoSubsLastArabicRequest = null;
        var arabicEl = document.getElementById("videoSubsArabicTranslation");
        if (arabicEl) arabicEl.textContent = "";
        return;
      }
      var url = URL.createObjectURL(f);
      if (player) {
        player.src = url;
        player.style.display = "block";
        player.load();
        player.onloadeddata = function () { URL.revokeObjectURL(url); };
      }
      if (placeholder) placeholder.style.display = "none";
      if (container) container.classList.add("has-video");
    });
  }
  if (player) {
    player.addEventListener("timeupdate", updateVideoSubsDisplay);
    player.addEventListener("seeked", updateVideoSubsDisplay);
  }
}

// ================================
// ONGLETS (Traduction / Texte to caractère / Sign-to-Text / Image → Texte / Vidéo → Sous-titres)
// ================================
function switchMainTab(tabId) {
  var panelTraduction = document.getElementById("panelTraduction");
  var panelDetection = document.getElementById("panelDetection");
  var panelASL = document.getElementById("panelASL");
  var panelImageText = document.getElementById("panelImageText");
  var panelVideoSubs = document.getElementById("panelVideoSubs");
  var tabTraduction = document.getElementById("tabTraduction");
  var tabDetection = document.getElementById("tabDetection");
  var tabASL = document.getElementById("tabASL");
  var tabImageText = document.getElementById("tabImageText");
  var tabVideoSubs = document.getElementById("tabVideoSubs");
  var panels = [panelTraduction, panelDetection, panelASL, panelImageText, panelVideoSubs];
  var tabs = [tabTraduction, tabDetection, tabASL, tabImageText, tabVideoSubs];
  var ids = ["traduction", "detection", "asl", "imageText", "videoSubs"];
  if (!panelTraduction || !panelDetection) return;
  panels.forEach(function (p) {
    if (p) {
      p.setAttribute("hidden", "");
      p.style.display = "none";
    }
  });
  tabs.forEach(function (t) { if (t) { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); } });
  var idx = ids.indexOf(tabId);
  var activePanel = null;
  var activeTab = null;
  if (idx === 0) { activePanel = panelTraduction; activeTab = tabTraduction; }
  else if (idx === 1) { activePanel = panelDetection; activeTab = tabDetection; }
  else if (idx === 2) { activePanel = panelASL; activeTab = tabASL; }
  else if (idx === 3) { activePanel = panelImageText; activeTab = tabImageText; }
  else if (idx === 4) { activePanel = panelVideoSubs; activeTab = tabVideoSubs; }
  if (activePanel) {
    activePanel.removeAttribute("hidden");
    activePanel.style.display = "";
  }
  if (activeTab) {
    activeTab.classList.add("active");
    activeTab.setAttribute("aria-selected", "true");
  }
  if (tabId !== "asl") stopASLDetection();
}

// ================================
// Détection en temps réel (caméra) + mains/doigts (MediaPipe Hand Landmarker)
// ================================
var realtimeStream = null;
var realtimeIntervalId = null;
var realtimeCanvas = null;
var realtimeCtx = null;
var realtimeHandLandmarker = null;
var realtimeHandDrawLoopId = null;
var realtimeLastHandResult = null;
var realtimeServerHands = null;
var realtimeVideoTimestampMs = 0;
var realtimeHandLoadFailed = false;
var realtimeLastHandRequestTime = 0;
var REALTIME_HAND_CONNECTIONS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
var REALTIME_HAND_MODEL_URL_CDN = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

function startRealtimeDetection() {
  var videoEl = document.getElementById("realtimeVideo");
  var overlayEl = document.getElementById("realtimeHandOverlay");
  var placeholderEl = document.getElementById("realtimePlaceholder");
  var startBtn = document.getElementById("realtimeStartBtn");
  var stopBtn = document.getElementById("realtimeStopBtn");
  var labelEl = document.getElementById("realtimePredictedLabel");
  var confidenceEl = document.getElementById("realtimeConfidence");
  var topEl = document.getElementById("realtimeTopClasses");
  var errorEl = document.getElementById("realtimeError");
  if (!videoEl || !startBtn || !stopBtn) return;

  function onError(msg) {
    if (errorEl) { errorEl.textContent = msg; errorEl.style.display = "block"; }
    if (placeholderEl) placeholderEl.classList.remove("hidden");
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }

  startBtn.disabled = true;
  if (errorEl) errorEl.style.display = "none";
  if (labelEl) labelEl.textContent = "—";
  if (confidenceEl) confidenceEl.textContent = "";
  if (topEl) topEl.innerHTML = "";
  realtimeLastHandResult = null;
  realtimeHandLoadFailed = false;

  var constraints = { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false };
  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    realtimeStream = stream;
    videoEl.srcObject = stream;
    if (placeholderEl) placeholderEl.classList.add("hidden");
    stopBtn.disabled = false;

    if (!realtimeCanvas) {
      realtimeCanvas = document.createElement("canvas");
      realtimeCanvas.width = 224;
      realtimeCanvas.height = 224;
      realtimeCtx = realtimeCanvas.getContext("2d");
    }

    var apiBase = window.location.origin || "";
    var sending = false;

    function drawHandsFromServerData(handsData) {
      if (!overlayEl || !handsData || !handsData.hands || handsData.hands.length === 0) return;
      var w = overlayEl.width;
      var h = overlayEl.height;
      if (!w || !h) return;
      var ctx = overlayEl.getContext("2d");
      function px(x) { return x * w; }
      function py(y) { return y * h; }
      for (var handIdx = 0; handIdx < handsData.hands.length; handIdx++) {
        var hand = handsData.hands[handIdx];
        var landmarks = hand.landmarks || [];
        var bbox = hand.bbox || [];
        var color = handIdx === 0 ? "0, 212, 191" : "217, 119, 6";
        var r = "rgba(" + color + ",";
        if (bbox.length >= 4) {
          ctx.strokeStyle = r + "0.85)";
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(px(bbox[0]) - 4, py(bbox[1]) - 4, px(bbox[2] - bbox[0]) + 8, py(bbox[3] - bbox[1]) + 8);
          ctx.setLineDash([]);
        }
        for (var i = 0; i < REALTIME_HAND_CONNECTIONS.length; i++) {
          var a = landmarks[REALTIME_HAND_CONNECTIONS[i][0]];
          var b = landmarks[REALTIME_HAND_CONNECTIONS[i][1]];
          if (a && b) {
            ctx.strokeStyle = r + "0.95)";
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.moveTo(px(a.x), py(a.y));
            ctx.lineTo(px(b.x), py(b.y));
            ctx.stroke();
          }
        }
        for (var j = 0; j < landmarks.length; j++) {
          var lm = landmarks[j];
          ctx.fillStyle = r + "1)";
          ctx.strokeStyle = "rgba(255,255,255,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px(lm.x), py(lm.y), 8, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    function drawHandsOnOverlay() {
      if (!overlayEl || !videoEl || !realtimeStream) return;
      var videoW = videoEl.videoWidth;
      var videoH = videoEl.videoHeight;
      if (!videoW || !videoH) {
        var ctx = overlayEl.getContext("2d");
        ctx.clearRect(0, 0, overlayEl.width || 640, overlayEl.height || 480);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "14px sans-serif";
        ctx.fillText("Attente du flux vidéo...", 10, 24);
        realtimeHandDrawLoopId = requestAnimationFrame(drawHandsOnOverlay);
        return;
      }
      if (overlayEl.width !== videoW || overlayEl.height !== videoH) {
        overlayEl.width = videoW;
        overlayEl.height = videoH;
      }
      var ctx = overlayEl.getContext("2d");
      var w = overlayEl.width;
      var h = overlayEl.height;
      ctx.clearRect(0, 0, w, h);
      function px(x) { return x * w; }
      function py(y) { return y * h; }

      if (videoEl.readyState >= 2) {
        var now = Date.now();
        if (now - realtimeLastHandRequestTime > 150) {
          realtimeLastHandRequestTime = now;
          realtimeCanvas.width = videoW;
          realtimeCanvas.height = videoH;
          realtimeCtx.drawImage(videoEl, 0, 0, videoW, videoH);
          var dataUrl = realtimeCanvas.toDataURL("image/jpeg", 0.8);
          var b64 = dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;
          fetch(apiBase + "/api/detect_hands", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ frame: b64 })
          }).then(function (r) { return r.json(); }).then(function (data) {
            if (data.hands) {
              realtimeServerHands = data;
              realtimeLastHandResult = { landmarks: data.hands.map(function (hand) { return hand.landmarks || []; }) };
              realtimeHandLoadFailed = false;
            }
          }).catch(function () {});
        }
        if (realtimeServerHands && realtimeServerHands.hands && realtimeServerHands.hands.length > 0) {
          drawHandsFromServerData(realtimeServerHands);
        } else if (!realtimeHandLandmarker) {
          if (realtimeHandLoadFailed) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
            ctx.font = "14px sans-serif";
            ctx.fillText("Détection mains indisponible — prédiction du signe active", 10, 24);
          } else {
            ctx.fillStyle = "rgba(255,255,255,0.85)";
            ctx.font = "14px sans-serif";
            ctx.fillText("Présentez votre main devant la caméra", 10, 24);
          }
        } else {
          try {
            realtimeVideoTimestampMs += 16;
            var result = realtimeHandLandmarker.detectForVideo(videoEl, realtimeVideoTimestampMs);
            realtimeLastHandResult = result;
            if (result && result.landmarks && result.landmarks.length > 0) {
              for (var handIdx = 0; handIdx < result.landmarks.length; handIdx++) {
                var landmarks = result.landmarks[handIdx];
                var color = handIdx === 0 ? "0, 212, 191" : "217, 119, 6";
                var r = "rgba(" + color + ",";
                var minX = 1, minY = 1, maxX = 0, maxY = 0;
                for (var i = 0; i < REALTIME_HAND_CONNECTIONS.length; i++) {
                  var a = landmarks[REALTIME_HAND_CONNECTIONS[i][0]];
                  var b = landmarks[REALTIME_HAND_CONNECTIONS[i][1]];
                  if (a && b) {
                    ctx.strokeStyle = r + "0.95)";
                    ctx.lineWidth = 4;
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    ctx.moveTo(px(a.x), py(a.y));
                    ctx.lineTo(px(b.x), py(b.y));
                    ctx.stroke();
                    minX = Math.min(minX, a.x, b.x); minY = Math.min(minY, a.y, b.y);
                    maxX = Math.max(maxX, a.x, b.x); maxY = Math.max(maxY, a.y, b.y);
                  }
                }
                for (var j = 0; j < landmarks.length; j++) {
                  var lm = landmarks[j];
                  minX = Math.min(minX, lm.x); minY = Math.min(minY, lm.y);
                  maxX = Math.max(maxX, lm.x); maxY = Math.max(maxY, lm.y);
                  ctx.fillStyle = r + "1)";
                  ctx.strokeStyle = "rgba(255,255,255,0.9)";
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(px(lm.x), py(lm.y), 8, 0, 2 * Math.PI);
                  ctx.fill();
                  ctx.stroke();
                }
                ctx.strokeStyle = r + "0.85)";
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
                ctx.strokeRect(px(minX) - 8, py(minY) - 8, px(maxX - minX) + 16, py(maxY - minY) + 16);
                ctx.setLineDash([]);
              }
            } else {
              ctx.fillStyle = "rgba(255,255,255,0.85)";
              ctx.font = "14px sans-serif";
              ctx.fillText("Présentez votre main devant la caméra", 10, 24);
            }
          } catch (e) {}
        }
      }
      realtimeHandDrawLoopId = requestAnimationFrame(drawHandsOnOverlay);
    }

    function handBboxFromResult(result) {
      if (!result || !result.landmarks || result.landmarks.length === 0) return null;
      var minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (var h = 0; h < result.landmarks.length; h++) {
        for (var i = 0; i < result.landmarks[h].length; i++) {
          var x = result.landmarks[h][i].x;
          var y = result.landmarks[h][i].y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      var pad = 0.2;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(1, maxX + pad);
      maxY = Math.min(1, maxY + pad);
      return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    function captureOneFrame() {
      var w = videoEl.videoWidth;
      var h = videoEl.videoHeight;
      if (!w || !h) return null;
      realtimeCanvas.width = 224;
      realtimeCanvas.height = 224;
      var bbox = realtimeLastHandResult ? handBboxFromResult(realtimeLastHandResult) : null;
      if (bbox) {
        var sx = bbox.minX * w;
        var sy = bbox.minY * h;
        var sw = (bbox.maxX - bbox.minX) * w;
        var sh = (bbox.maxY - bbox.minY) * h;
        realtimeCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 224, 224);
      } else {
        realtimeCtx.drawImage(videoEl, 0, 0, w, h, 0, 0, 224, 224);
      }
      var dataUrl = realtimeCanvas.toDataURL("image/jpeg", 0.85);
      return dataUrl.indexOf(",") >= 0 ? dataUrl.split(",")[1] : dataUrl;
    }

    function sendFrames(frames) {
      if (frames.length < 8 || sending) return;
      sending = true;
      fetch(apiBase + "/api/video_predict_sign_frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames: frames })
      }).then(function (r) { return r.json(); }).then(function (data) {
        sending = false;
        if (data.error) return;
        if (labelEl) labelEl.textContent = data.label || "—";
        if (confidenceEl) confidenceEl.textContent = "Confiance : " + (Math.round((data.confidence || 0) * 100) + "%");
        if (topEl && data.all_classes && data.all_classes.length) {
          var html = "";
          data.all_classes.slice(0, 5).forEach(function (c) {
            html += "<div>" + c.label + " (" + Math.round((c.score || 0) * 100) + "%)</div>";
          });
          topEl.innerHTML = html;
        }
      }).catch(function () { sending = false; });
    }

    function scheduleCaptureCycle() {
      if (!realtimeStream) return;
      var frames = [];
      var step = 0;
      function take() {
        if (!realtimeStream || step >= 8) {
          if (frames.length >= 8) sendFrames(frames);
          return;
        }
        var b64 = captureOneFrame();
        if (b64) frames.push(b64);
        step++;
        if (step < 8) setTimeout(take, 150);
        else if (frames.length >= 8) sendFrames(frames);
      }
      take();
    }

    drawHandsOnOverlay();
    scheduleCaptureCycle();
    realtimeIntervalId = setInterval(scheduleCaptureCycle, 1600);

    var handLoadTimeout = setTimeout(function () {
      if (!realtimeHandLandmarker) {
        realtimeHandLoadFailed = true;
      }
    }, 5000);

    var HandLandmarkerClass = (typeof HandLandmarker !== "undefined" ? HandLandmarker : null) || (typeof window !== "undefined" && (window.HandLandmarker || (window.MediaPipeTasksVision && window.MediaPipeTasksVision.HandLandmarker)));
    var FilesetResolverClass = (typeof FilesetResolver !== "undefined" ? FilesetResolver : null) || (typeof window !== "undefined" && (window.FilesetResolver || (window.MediaPipeTasksVision && window.MediaPipeTasksVision.FilesetResolver)));
    if (HandLandmarkerClass && FilesetResolverClass) {
      realtimeVideoTimestampMs = 0;
      var wasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
      var serverModelUrl = apiBase + "/hand_landmarker.task";
      function tryCreate(modelUrl) {
        return FilesetResolverClass.forVisionTasks(wasmUrl).then(function (vision) {
          return HandLandmarkerClass.createFromOptions(vision, {
            baseOptions: { modelAssetPath: modelUrl },
            numHands: 2,
            runningMode: "VIDEO",
            minHandDetectionConfidence: 0.4,
            minHandPresenceConfidence: 0.4
          });
        });
      }
      tryCreate(serverModelUrl).then(function (marker) {
        clearTimeout(handLoadTimeout);
        realtimeHandLandmarker = marker;
        if (marker && marker.setOptions) marker.setOptions({ runningMode: "VIDEO" });
      }).catch(function () {
        return tryCreate(REALTIME_HAND_MODEL_URL_CDN);
      }).then(function (marker) {
        if (marker) {
          clearTimeout(handLoadTimeout);
          realtimeHandLandmarker = marker;
          if (marker.setOptions) marker.setOptions({ runningMode: "VIDEO" });
        }
      }).catch(function (err) {
        realtimeHandLandmarker = null;
        realtimeHandLoadFailed = true;
        console.warn("Hand Landmarker load failed:", err);
      });
    } else {
      realtimeHandLoadFailed = true;
    }
  }).catch(function (err) {
    onError("Impossible d'accéder à la caméra : " + (err.message || err.name || "Erreur"));
  });
}

function stopRealtimeDetection() {
  if (realtimeIntervalId) {
    clearInterval(realtimeIntervalId);
    realtimeIntervalId = null;
  }
  if (realtimeHandDrawLoopId) {
    cancelAnimationFrame(realtimeHandDrawLoopId);
    realtimeHandDrawLoopId = null;
  }
  realtimeHandLandmarker = null;
  realtimeLastHandResult = null;
  realtimeServerHands = null;
  realtimeHandLoadFailed = false;
  if (realtimeStream) {
    realtimeStream.getTracks().forEach(function (t) { t.stop(); });
    realtimeStream = null;
  }
  var videoEl = document.getElementById("realtimeVideo");
  if (videoEl) videoEl.srcObject = null;
  var overlayEl = document.getElementById("realtimeHandOverlay");
  if (overlayEl) {
    var ctx = overlayEl.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);
  }
  var placeholderEl = document.getElementById("realtimePlaceholder");
  if (placeholderEl) placeholderEl.classList.remove("hidden");
  var startBtn = document.getElementById("realtimeStartBtn");
  var stopBtn = document.getElementById("realtimeStopBtn");
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// ================================
// Sign-to-Text ASL — même interface que ArabicSign (Camera Feed + Prediction Results)
// ================================
var aslStream = null;
var aslCaptureIntervalId = null;
var aslRealtimeMode = false;
var aslSending = false;

function aslDisplayPredictionResults(data) {
  var mainPred = document.getElementById("aslMainPrediction");
  var mainBar = document.getElementById("aslMainConfidenceBar");
  var mainConf = document.getElementById("aslMainConfidence");
  var topEl = document.getElementById("aslTopPredictions");
  if (!mainPred || !mainBar || !mainConf) return;
  mainPred.textContent = data.prediction || data.letter_en || "unknown";
  var pct = Math.round((data.confidence != null ? data.confidence * 100 : data.score) || 0);
  mainBar.style.width = pct + "%";
  mainConf.textContent = pct + "%";
  mainBar.style.backgroundColor = pct > 80 ? "#2ecc71" : (pct > 50 ? "#f39c12" : "#e74c3c");
  if (topEl) {
    topEl.innerHTML = "";
    var list = data.top_predictions || [];
    var mainLabel = data.prediction || data.letter_en;
    list.forEach(function (pred) {
      if (pred.label === mainLabel) return;
      var predPct = Math.round((pred.confidence || 0) * 100);
      var div = document.createElement("div");
      div.className = "asl-prediction-item";
      div.innerHTML = "<span class=\"asl-prediction-label\">" + pred.label + "</span><div class=\"asl-prediction-confidence-bar-container\"><div class=\"asl-prediction-confidence-bar\" style=\"width:" + predPct + "%\"></div></div><span class=\"asl-prediction-confidence\">" + predPct + "%</span>";
      topEl.appendChild(div);
    });
  }
}

function aslSendImageForPrediction(dataUrlOrB64, callback) {
  if (aslSending) return;
  var b64 = dataUrlOrB64;
  if (b64.indexOf("data:") === 0 && b64.indexOf(",") >= 0) b64 = b64.split(",")[1];
  aslSending = true;
  var mainPred = document.getElementById("aslMainPrediction");
  if (mainPred) mainPred.textContent = "Processing...";
  var apiBase = window.location.origin || "";
  fetch(apiBase + "/api/asl/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: b64 })
  }).then(function (r) { return r.json(); }).then(function (data) {
    aslSending = false;
    aslDisplayPredictionResults(data);
    if (callback) callback();
  }).catch(function () { aslSending = false; if (callback) callback(); });
}

function aslToggleCamera() {
  var video = document.getElementById("aslVideo");
  var startBtn = document.getElementById("aslStartCamera");
  var captureBtn = document.getElementById("aslCaptureImage");
  if (!video || !startBtn) return;
  if (aslStream) {
    aslStream.getTracks().forEach(function (t) { t.stop(); });
    aslStream = null;
    video.srcObject = null;
    startBtn.innerHTML = "<i class=\"fas fa-play\"></i> Start Camera";
    if (captureBtn) captureBtn.disabled = true;
    if (aslRealtimeMode) aslStopRealtimeCapture();
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false }).then(function (stream) {
    aslStream = stream;
    video.srcObject = stream;
    startBtn.innerHTML = "<i class=\"fas fa-stop\"></i> Stop Camera";
    if (captureBtn) captureBtn.disabled = false;
    if (aslRealtimeMode) aslStartRealtimeCapture();
  }).catch(function (err) {
    alert("Caméra : " + (err.message || "Erreur"));
  });
}

function aslTo64x64GrayCanvas(sourceCanvasOrImage) {
  var c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  var ctx = c.getContext("2d");
  ctx.filter = "grayscale(100%)";
  ctx.drawImage(sourceCanvasOrImage, 0, 0, 64, 64);
  return c;
}

function aslCaptureImage() {
  var video = document.getElementById("aslVideo");
  var canvas = document.getElementById("aslCanvas");
  var capturedImg = document.getElementById("aslCapturedImage");
  if (!aslStream || !video || !canvas || !capturedImg) return;
  var w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return;
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);
  var dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  var thumb64 = aslTo64x64GrayCanvas(canvas);
  capturedImg.src = thumb64.toDataURL("image/jpeg", 0.9);
  aslSendImageForPrediction(dataUrl);
}

function aslHandleFileSelect(e) {
  var file = e.target.files[0];
  var fileNameEl = document.getElementById("aslFileName");
  var capturedImg = document.getElementById("aslCapturedImage");
  if (fileNameEl) fileNameEl.textContent = file ? file.name : "No file chosen";
  if (!file || !capturedImg) return;
  var reader = new FileReader();
  reader.onload = function (ev) {
    var img = new Image();
    img.onload = function () {
      var thumb64 = aslTo64x64GrayCanvas(img);
      capturedImg.src = thumb64.toDataURL("image/jpeg", 0.9);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function aslHandleFormSubmit(e) {
  e.preventDefault();
  var fileInput = document.getElementById("aslFileUpload");
  var file = fileInput && fileInput.files[0];
  if (!file) {
    alert("Veuillez choisir une image.");
    return;
  }
  var capturedImg = document.getElementById("aslCapturedImage");
  var reader = new FileReader();
  reader.onload = function (ev) {
    var img = new Image();
    img.onload = function () {
      var thumb64 = aslTo64x64GrayCanvas(img);
      capturedImg.src = thumb64.toDataURL("image/jpeg", 0.9);
      aslSendImageForPrediction(ev.target.result);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function aslStartRealtimeCapture() {
  if (aslCaptureIntervalId) return;
  aslCaptureIntervalId = setInterval(function () {
    if (aslStream && aslRealtimeMode) aslCaptureImage();
  }, 1000);
}

function aslStopRealtimeCapture() {
  if (aslCaptureIntervalId) {
    clearInterval(aslCaptureIntervalId);
    aslCaptureIntervalId = null;
  }
}

function aslToggleRealtimeMode() {
  var toggle = document.getElementById("aslRealtimeToggle");
  var status = document.getElementById("aslRealtimeStatus");
  if (!toggle || !status) return;
  aslRealtimeMode = toggle.checked;
  status.textContent = aslRealtimeMode ? "On" : "Off";
  if (aslRealtimeMode && aslStream) aslStartRealtimeCapture();
  else aslStopRealtimeCapture();
}

function setupASLCapturePanel() {
  var startBtn = document.getElementById("aslStartCamera");
  var captureBtn = document.getElementById("aslCaptureImage");
  var fileInput = document.getElementById("aslFileUpload");
  var form = document.getElementById("aslUploadForm");
  var toggle = document.getElementById("aslRealtimeToggle");
  if (startBtn) startBtn.addEventListener("click", aslToggleCamera);
  if (captureBtn) captureBtn.addEventListener("click", aslCaptureImage);
  if (fileInput) fileInput.addEventListener("change", aslHandleFileSelect);
  if (form) form.addEventListener("submit", aslHandleFormSubmit);
  if (toggle) toggle.addEventListener("change", aslToggleRealtimeMode);
}

function stopASLDetection() {
  if (aslStream) {
    aslStream.getTracks().forEach(function (t) { t.stop(); });
    aslStream = null;
  }
  var video = document.getElementById("aslVideo");
  if (video) video.srcObject = null;
  var startBtn = document.getElementById("aslStartCamera");
  var captureBtn = document.getElementById("aslCaptureImage");
  if (startBtn) { startBtn.innerHTML = "<i class=\"fas fa-play\"></i> Start Camera"; startBtn.disabled = false; }
  if (captureBtn) captureBtn.disabled = true;
  aslStopRealtimeCapture();
  var rtToggle = document.getElementById("aslRealtimeToggle");
  if (rtToggle) rtToggle.checked = false;
  var rtStatus = document.getElementById("aslRealtimeStatus");
  if (rtStatus) rtStatus.textContent = "Off";
  aslRealtimeMode = false;
}

function runVideoSignDetection() {
  var input = document.getElementById("detectionVideoInput");
  var runBtn = document.getElementById("detectionRunBtn");
  var resultEl = document.getElementById("detectionPredictedLabel");
  var confidenceEl = document.getElementById("detectionConfidence");
  var correctedHintEl = document.getElementById("detectionCorrectedHint");
  var topClassesEl = document.getElementById("detectionTopClasses");
  var loadingEl = document.getElementById("detectionLoading");
  var errorEl = document.getElementById("detectionError");
  if (!input || !input.files || !input.files[0]) {
    if (errorEl) { errorEl.textContent = "Veuillez choisir une vidéo."; errorEl.style.display = "block"; }
    return;
  }
  if (loadingEl) loadingEl.style.display = "block";
  if (errorEl) errorEl.style.display = "none";
  if (resultEl) resultEl.textContent = "—";
  if (confidenceEl) confidenceEl.textContent = "";
  if (correctedHintEl) correctedHintEl.style.display = "none";
  if (topClassesEl) topClassesEl.innerHTML = "";

  var form = new FormData();
  form.append("video", input.files[0]);
  var apiBase = window.location.origin || "";
  fetch(apiBase + "/api/video_predict_sign", { method: "POST", body: form })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (loadingEl) loadingEl.style.display = "none";
      if (data.error) {
        if (errorEl) { errorEl.textContent = data.error; errorEl.style.display = "block"; }
        return;
      }
      if (resultEl) resultEl.textContent = data.label || "—";
      if (confidenceEl) confidenceEl.textContent = "Confiance : " + (Math.round((data.confidence || 0) * 100) + "%");
      if (correctedHintEl) {
        if (data.corrected_by_filename) {
          correctedHintEl.textContent = "✓ Corrigé par nom du fichier (confiance modèle < 50%)";
          correctedHintEl.style.display = "block";
        } else {
          correctedHintEl.style.display = "none";
        }
      }
      if (topClassesEl && data.all_classes && data.all_classes.length) {
        var ul = document.createElement("ul");
        data.all_classes.slice(0, 5).forEach(function (c) {
          var li = document.createElement("li");
          li.textContent = c.label + " (" + (Math.round((c.score || 0) * 100) + "%)");
          ul.appendChild(li);
        });
        topClassesEl.innerHTML = "";
        topClassesEl.appendChild(ul);
      }
    })
    .catch(function (err) {
      if (loadingEl) loadingEl.style.display = "none";
      if (errorEl) { errorEl.textContent = "Erreur : " + (err.message || String(err)); errorEl.style.display = "block"; }
    });
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", onDomReady);
} else {
  onDomReady();
}