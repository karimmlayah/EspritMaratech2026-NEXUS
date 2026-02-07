/**
 * Voice-To-Sign (AVST) — Hackathon MVP
 *
 * Pipeline:
 * 1. User types or speaks Tunisian dialect
 * 2. Speech-to-text (Web Speech API) if voice
 * 3. LLM normalizes dialect → list of simple French concepts (or fallback dictionary)
 * 4. Concepts → sign names (SIGN_WANT, SIGN_GO, etc.)
 * 5. Avatar plays sign animations sequentially (or console.log if no animations)
 *
 * Run: npx serve then open http://localhost:3000
 * LLM: Groq API (clé ci-dessous ou window.AVST_GROQ_API_KEY). En prod, ne pas exposer la clé côté client.
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// Clé API Groq (priorité à window.AVST_GROQ_API_KEY si définie)
var GROQ_API_KEY = window.AVST_GROQ_API_KEY || "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";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

// =============================================================================
// LLM PROMPT (required in code — used to convert Tunisian to French concepts)
// =============================================================================
var LLM_PROMPT =
  "Convert the following Tunisian dialect sentence into a list of simple French concepts.\n" +
  "Use infinitive verbs and nouns only.\n" +
  "Do not explain.\n" +
  "Return only a JSON array of words.";

// =============================================================================
// FALLBACK: Local Tunisian → French concept (if LLM fails or no API key)
// =============================================================================
// Dictionnaire tunisien → français (tous les mots reconnus sont traduits)
var FALLBACK_DICT = {
  aslema: "bonjour",
  aaslema: "bonjour",
  salam: "salut",
  nheb: "vouloir",
  n7eb: "vouloir",
  mous3da: "aide",
  mousaada: "aide",
  bsaha: "merci",
  yezzi: "assez",
  ey: "oui",
  le: "non",
  chnowa: "quoi",
  wesh: "quoi",
  kifech: "comment",
  rame: "aller",
  yallah: "aller",
  nemchi: "aller",
  emchi: "aller",
  sbitar: "hopital",
  falsa: "encore",
  okhra: "autre",
  lel: "vers",
  brabi: "s'il te plaît",
  labes: "ça va",
  mesh: "pas",
  mouch: "pas",
  tawa: "maintenant",
  lyoum: "aujourd'hui",
  bachar: "demain",
  bch: "aller",
  ejja: "venir",
  baba: "papa",
  mama: "maman",
  // Livre, objets, lieux
  kteb: "livre",
  ktab: "livre",
  maktaba: "bibliothèque",
  dar: "maison",
  beet: "maison",
  flous: "argent",
  lma: "eau",
  maya: "eau",
  khobz: "pain",
  hlib: "lait",
  jebena: "café",
  bnat: "filles",
  wled: "garçons",
  rajel: "homme",
  mara: "femme",
  sghir: "petit",
  kbir: "grand",
  jdid: "nouveau",
  9dim: "vieux",
  mlih: "bien",
  mesh mlih: "pas bien",
  bnin: "bon",
  tayeb: "bon",
  hkeya: "histoire",
  7aja: "chose",
  we7ed: "un",
  zouz: "deux",
  tlata: "trois",
  arba3a: "quatre",
  khamsa: "cinq",
  sitta: "six",
  seba3a: "sept",
  thmanya: "huit",
  tsa3: "neuf",
  3ashra: "dix",
  chwaya: "un peu",
  barcha: "beaucoup",
  koll: "tout",
  wheda: "un",
  elli: "qui",
  ken: "si",
  w: "et",
  oula: "ou",
  ama: "mais",
  3la: "sur",
  f: "dans",
  m3a: "avec",
  men: "de",
  l: "à",
  9oddem: "devant",
  wara: "derrière",
  el barcha: "hier",
  daba: "maintenant",
};

// =============================================================================
// Concept (French) → Sign name (for avatar / console)
// =============================================================================
var CONCEPT_TO_SIGN = {
  bonjour: "SIGN_HELLO",
  salut: "SIGN_HELLO",
  vouloir: "SIGN_WANT",
  veux: "SIGN_WANT",
  aller: "SIGN_GO",
  aide: "SIGN_HELP",
  aider: "SIGN_HELP",
  merci: "SIGN_THANKS",
  oui: "SIGN_YES",
  non: "SIGN_NO",
  quoi: "SIGN_WHAT",
  comment: "SIGN_HOW",
  assez: "SIGN_ENOUGH",
  encore: "SIGN_AGAIN",
  autre: "SIGN_OTHER",
  hopital: "SIGN_HOSPITAL",
  hôpital: "SIGN_HOSPITAL",
  vers: "SIGN_TO",
  "s\'il te plaît": "SIGN_PLEASE",
  "ça va": "SIGN_OK",
  pas: "SIGN_NOT",
  maintenant: "SIGN_NOW",
  "aujourd\'hui": "SIGN_TODAY",
  demain: "SIGN_TOMORROW",
  venir: "SIGN_COME",
  papa: "SIGN_FATHER",
  maman: "SIGN_MOTHER",
  livre: "SIGN_BOOK",
  bibliothèque: "SIGN_LIBRARY",
  maison: "SIGN_HOUSE",
  argent: "SIGN_MONEY",
  eau: "SIGN_WATER",
  pain: "SIGN_BREAD",
  lait: "SIGN_MILK",
  café: "SIGN_COFFEE",
  petit: "SIGN_SMALL",
  grand: "SIGN_BIG",
  nouveau: "SIGN_NEW",
  bien: "SIGN_GOOD",
  bon: "SIGN_GOOD",
  chose: "SIGN_THING",
  un: "SIGN_ONE",
  deux: "SIGN_TWO",
  trois: "SIGN_THREE",
  tout: "SIGN_ALL",
  peu: "SIGN_LITTLE",
  beaucoup: "SIGN_MANY",
};

// =============================================================================
// Three.js scene & avatar
// =============================================================================
var scene, camera, renderer, avatar;
var mixer = null;
var clock = new THREE.Clock();
var isPlayingSequence = false;

var sceneContainer = document.getElementById("scene");
var placeholder = document.getElementById("scene-placeholder");
if (placeholder) placeholder.remove();

scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a2a);
camera = new THREE.PerspectiveCamera(45, window.innerWidth / 400, 0.1, 1000);
camera.position.set(0, 1.6, 3);
renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, 400);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
if (sceneContainer) sceneContainer.appendChild(renderer.domElement);

var light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 2, 3);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

function showSceneMessage(msg, isError) {
  var el = document.getElementById("scene-message");
  if (!el) {
    el = document.createElement("div");
    el.id = "scene-message";
    el.className = "scene-message";
    if (sceneContainer) sceneContainer.appendChild(el);
  }
  el.textContent = msg;
  el.className = "scene-message" + (isError ? " scene-message-error" : "");
}

if (window.location.protocol === "file:") {
  showSceneMessage("Ouvrez la page via un serveur local : npx serve", true);
} else {
  showSceneMessage("Chargement de l'avatar… 0 %");
  var loadTimeout = setTimeout(function () {
    var msgEl = document.getElementById("scene-message");
    if (msgEl && msgEl.textContent.indexOf("Chargement") !== -1) {
      showSceneMessage("Chargement long. Vérifiez la console (F12).", true);
    }
  }, 12000);
  var loader = new GLTFLoader();
  loader.load(
    "avatar/michel_v3.glb",
    function (gltf) {
      clearTimeout(loadTimeout);
      var msgEl = document.getElementById("scene-message");
      if (msgEl) msgEl.remove();
      avatar = gltf.scene;
      scene.add(avatar);
      var box = new THREE.Box3().setFromObject(avatar);
      var center = box.getCenter(new THREE.Vector3());
      var size = box.getSize(new THREE.Vector3());
      avatar.position.sub(center);
      var maxDim = Math.max(size.x, size.y, size.z, 0.001);
      avatar.scale.setScalar(1.5 / maxDim);
      avatar.position.y = -0.5;
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(avatar);
        avatar.userData.animations = gltf.animations;
      }
    },
    function (xhr) {
      if (xhr.lengthComputable) {
        var pct = Math.round((xhr.loaded / xhr.total) * 100);
        showSceneMessage("Chargement de l'avatar… " + pct + " %");
      } else {
        showSceneMessage("Chargement de l'avatar… " + Math.round(xhr.loaded / 1024) + " Ko");
      }
    },
    function (err) {
      clearTimeout(loadTimeout);
      console.error("Erreur chargement avatar:", err);
      showSceneMessage("Impossible de charger avatar/michel_v3.glb. Vérifiez le chemin.", true);
    }
  );
}

function animate() {
  requestAnimationFrame(animate);
  var delta = clock.getDelta();
  if (mixer) mixer.update(delta);
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", function () {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / 400;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, 400);
});

// =============================================================================
// Step 3: LLM normalization — Tunisian → French concepts (or fallback)
// =============================================================================

/**
 * Appel API Groq (compatible OpenAI) pour obtenir les concepts français depuis le tunisien.
 * Si pas de clé ou erreur, utilisation de FALLBACK_DICT.
 */
function normalizeWithLLM(tunisianText) {
  var apiKey = GROQ_API_KEY || "";
  if (!apiKey || !tunisianText.trim()) {
    return Promise.resolve(normalizeWithFallbackDict(tunisianText));
  }

  var payload = {
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: LLM_PROMPT },
      { role: "user", content: tunisianText.trim() },
    ],
    temperature: 0.2,
  };

  return fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify(payload),
  })
    .then(function (res) {
      if (!res.ok) throw new Error("API " + res.status);
      return res.json();
    })
    .then(function (data) {
      var content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
      var match = content.match(/\[[\s\S]*?\]/);
      if (match) {
        var arr = JSON.parse(match[0]);
        return Array.isArray(arr) ? arr.map(function (w) { return String(w).trim().toLowerCase(); }).filter(Boolean) : normalizeWithFallbackDict(tunisianText);
      }
      return normalizeWithFallbackDict(tunisianText);
    })
    .catch(function (err) {
      console.warn("LLM fallback (dictionary):", err.message);
      return normalizeWithFallbackDict(tunisianText);
    });
}

/**
 * Fallback: map each Tunisian word to French concept using FALLBACK_DICT.
 */
function normalizeWithFallbackDict(text) {
  var normalized = text.trim().toLowerCase();
  if (!normalized) return [];
  var words = normalized.split(/\s+/);
  var concepts = [];
  words.forEach(function (word) {
    var clean = word.replace(/[^\wàâäéèêëïîôùûüç3]/gi, "");
    if (!clean) return;
    var concept = FALLBACK_DICT[clean];
    if (concept) concepts.push(concept);
    else concepts.push(clean);
  });
  return concepts;
}

// =============================================================================
// Step 4: Concept → Sign name
// =============================================================================
function conceptsToSignNames(concepts) {
  return concepts.map(function (c) {
    var key = c.toLowerCase().trim();
    return CONCEPT_TO_SIGN[key] || "SIGN_" + key.toUpperCase().replace(/\s+/g, "_");
  });
}

// =============================================================================
// Step 5: Play signs sequentially (avatar or console)
// =============================================================================
var SIGN_DURATION_MS = 1500;

function pulseAvatar() {
  if (!avatar) return;
  var baseScale = avatar.scale.x;
  avatar.scale.setScalar(baseScale * 1.08);
  setTimeout(function () {
    if (avatar) avatar.scale.setScalar(baseScale);
  }, 200);
}

function playSignAtIndex(signNames, index, resultEl, currentSignEl) {
  if (index >= signNames.length) {
    isPlayingSequence = false;
    if (currentSignEl) {
      currentSignEl.textContent = "";
      currentSignEl.classList.remove("active");
    }
    return;
  }
  var signName = signNames[index];
  if (currentSignEl) {
    currentSignEl.textContent = "Signe : " + signName;
    currentSignEl.classList.add("active");
  }
  // Required: log for jury / when no animations exist
  console.log("Playing sign:", signName);

  var playedClip = false;
  if (mixer && avatar && avatar.userData.animations) {
    var clips = avatar.userData.animations;
    var clip = clips.find(function (c) {
      return c.name.toUpperCase().indexOf(signName) !== -1;
    }) || clips[index % clips.length];
    if (clip) {
      mixer.clipAction(clip).reset().play();
      playedClip = true;
    }
  }
  if (avatar && !playedClip) pulseAvatar();

  setTimeout(function () {
    playSignAtIndex(signNames, index + 1, resultEl, currentSignEl);
  }, SIGN_DURATION_MS);
}

// =============================================================================
// Main: Translate (pipeline entry)
// =============================================================================
function translate() {
  var textInput = document.getElementById("textInput");
  var resultEl = document.getElementById("result");
  var currentSignEl = document.getElementById("currentSign");
  if (!textInput || !resultEl) return;
  if (isPlayingSequence) return;

  var text = textInput.value.trim();
  if (!text) {
    resultEl.textContent = "Écrivez ou parlez en tunisien (ex: falsa okhra nheb nemchi lel sbitar).";
    resultEl.className = "result result-empty";
    return;
  }

  resultEl.textContent = "Analyse du dialecte tunisien…";
  resultEl.className = "result result-loading";

  normalizeWithLLM(text).then(function (concepts) {
    if (concepts.length === 0) {
      resultEl.textContent = "Aucun concept reconnu. Essayez d’autres mots tunisiens.";
      resultEl.className = "result result-empty";
      return;
    }

    var signNames = conceptsToSignNames(concepts);
    resultEl.textContent = "Concepts : " + concepts.join(", ") + " → Signes : " + signNames.join(", ");
    resultEl.className = "result result-ok";

    isPlayingSequence = true;
    playSignAtIndex(signNames, 0, resultEl, currentSignEl);
  }).catch(function (err) {
    resultEl.textContent = "Erreur : " + (err.message || "réessayez.");
    resultEl.className = "result result-empty";
  });
}

// =============================================================================
// Web Speech API (Speech-to-Text)
// =============================================================================
function startVoice() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Reconnaissance vocale non supportée.");
    return;
  }
  var recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = function (event) {
    var transcript = event.results[0][0].transcript;
    var input = document.getElementById("textInput");
    if (input) input.value = transcript;
  };
  recognition.onerror = function (e) {
    console.warn("Speech recognition error:", e.error);
  };
  recognition.start();
}

/**
 * Bouton "Tester" : lance un exemple fixe (dictionnaire uniquement, pas de LLM).
 * Pour vérifier que l’affichage et la séquence de signes fonctionnent.
 */
function runTest() {
  var resultEl = document.getElementById("result");
  var currentSignEl = document.getElementById("currentSign");
  if (!resultEl || !currentSignEl) return;
  if (isPlayingSequence) return;

  var exampleText = "aslema nheb mous3da";
  var concepts = normalizeWithFallbackDict(exampleText);
  if (concepts.length === 0) {
    resultEl.textContent = "Test : aucun concept (vérifiez FALLBACK_DICT).";
    resultEl.className = "result result-empty";
    return;
  }

  var signNames = conceptsToSignNames(concepts);
  resultEl.textContent = "[Test] Concepts : " + concepts.join(", ") + " → Signes : " + signNames.join(", ");
  resultEl.className = "result result-ok";

  isPlayingSequence = true;
  playSignAtIndex(signNames, 0, resultEl, currentSignEl);
}

window.translate = translate;
window.startVoice = startVoice;
window.runTest = runTest;
