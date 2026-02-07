/**
 * Dictionnaire tunisien (romanisé) → français
 * Format source : français → [variantes tunisiennes]
 * Chaque variante tunisienne est mappée vers le français pour la recherche.
 */
const FRENCH_TO_TUNISIAN = {
  // Parties du corps
  "bouche": ["foum"],
  "dents": ["asnan"],
  "coeur": ["galb", "9alb", "9aleb"],
  "yeux": ["3youne", "3youn"],
  "nombril": ["sorra"],
  "jambe": ["rijel", "rijl"],
  "aisselle": ["bet", "abti"],
  "fesses": ["mo2akhra"],
  "main": ["yedd", "yed"],
  "taille": ["khesr", "khasr"],
  "gorge": ["hanjra", "hanjara"],
  "nez": ["mankhar", "monkhar"],
  "oreilles": ["wedan", "weden"],
  "doigts": ["asaabe3", "asaabi3"],
  "nuque": ["ra9ba", "raqba"],
  "langue": ["lessan", "lissan"],
  "bras": ["dhra3", "dhraaa"],
  "cerveau": ["mokh", "mokha"],
  "ventre": ["batn"],
  "cou": ["ra9ba", "raqba"],
  "cheveux": ["cha3r", "ch3r"],
  "sourcils": ["hawajeb", "7wajeb"],
  "visage": ["wejh", "wejhe"],
  "tête": ["ras"],
  "dos": ["dhar"],
  "cuisse": ["fkhadh", "fkhad"],
  "poitrine": ["sadr"],
  "poumons": ["ra2a", "ra2in"],
  "foie": ["kabd"],
  "intestin": ["msrane", "msrani"],
  "estomac": ["ma3da", "ma3de"],

  // Symptômes & maladies
  "douleur": ["waja3", "waj3"],
  "vertige": ["dwar"],
  "fatigué": ["ta3bane", "ta3ban"],
  "grippe": ["anflounza"],
  "stress": ["tawater"],
  "diarrhée": ["ishal", "ishaal"],
  "fièvre": ["7arara", "harara"],
  "dépression": ["iktieb", "iktaab"],
  "cancer": ["saratan"],
  "diabète": ["soukri", "sukri"],
  "allergie": ["7assasiya", "hassasiya"],
  "brûlure d'estomac": ["7ar9a"],
  "vomissement": ["tqi2", "tqi2a"],
  "évanouissement": ["ghachi"],
  "en pleine forme": ["bkhir"],

  // Termes médicaux
  "analyse": ["tahlil"],
  "thyroïde": ["ghadda dara9iya"],
  "ordonnance médical": ["wasfa tibiya", "wasfa tibi"],
  "gel hydroalcoolique": ["jel kou7ouli"],
  "gros intestin": ["9ouloun"],
  "intestin grêle": ["am3a da9i9a"],
  "COVID-19": ["korona"],
  "sida": ["idz"],
  "rougeole": ["7asba", "hasba"],
  "vaccin": ["talki7"],
  "implant cochléaire": ["sama3a dakhliya"],
  "tensiomètre": ["jehaz daghet"],
  "thermomètre": ["mizan 7arara"],
  "tomodensitométrie": ["skanir", "scanner"],
  "échographie": ["taswir"],
  "bandage": ["rebat"],
  "béquille": ["3kaza"],
  "fauteuil roulant": ["korsi met7arrek"],
  "gants médicaux": ["9fazat tibiya"],
  "masque médical": ["kamama"],
  "masque à oxygène": ["9ena3 oksijine"],

  // Personnel & lieux
  "médecin": ["doktor", "doktorh"],
  "patient": ["mridh", "maridh"],
  "hôpital": ["mustachfa"],
  "pharmacie": ["saidaliya"],
  "infirmier": ["mamarredh"],

  // Questions courantes
  "où avez-vous mal": ["wiene youja3ek", "win youja3ek"],
  "date de naissance": ["tarikh el milad"],
  "prénom et nom": ["el isem w el la9ab"],
  "quand": ["waqtash", "mtash"],
  "comment": ["kifech"],
  "pourquoi": ["3lach"],

  // États
  "positif": ["ijiyebi", "ijabi"],
  "négatif": ["salbi"],
  "attention": ["intibah"],
  "urgence": ["tari2"],

  // Autres
  "sourd": ["asamm"],
  "malentendant": ["d3if es-same3"],
  "handicap": ["i3a9a"],
  "interprète": ["motarjem"],
  "langue des signes": ["loghet el ichara"],
  "santé": ["se77a", "seha"],
  "CIN": ["bita9et ta3rif"],
  "problèmes de santé": ["mashakel se77iya"],
  "information": ["ma3louma"],
  "prévention": ["wi9aya"],
  "solution": ["7all", "hall"],
  "résultat": ["nati9a"],
  "évaluation": ["takyim"],
  "responsabilité": ["mas2ouliya"],
  "relation sexuelle": ["3ala9a jensiya"],

  // Salutations
  "salut ça va": ["ahla bik, kifech"],
  "bonjour": ["sabah el khir", "aslema", "aslema bik"],
  "merci": ["choukran", "yaishek", "3aychek"],
  "au revoir": ["bisslama"],

  // Utiles supplémentaires
  "ça va": ["labes"],
  "beaucoup": ["barcha"],
  "quoi": ["chnowa"],
  "médicament": ["dawa", "dwa"],

  // Phrases utiles / dialogues médecin-patient
  "Où avez-vous mal?": ["wiene youja3ek?", "win youja3ek?"],
  "Depuis quand?": ["men waqtash?"],
  "Avez-vous de la fièvre?": ["3andek 7arara?"],
  "Prenez-vous des médicaments?": ["takhou dawa?"],
  "J'ai mal à la tête": ["3andi waja3 fi rase"],
  "J'ai mal au ventre": ["3andi waja3 fi el batn"],
  "Je tousse": ["nsaa3l"],
  "J'ai de la fièvre": ["3andi 7arara"],
  "Je suis fatigué": ["ta3bane"],
  "Je ne peux pas bouger": ["ma nejmch net7arek"],
  "Appelez une ambulance": ["nadi 3ala el is3af"],
  "C'est urgent": ["7aja mosta3jla"],
  "Aidez-moi": ["sa3edouni"],
  "Où est l'hôpital?": ["wein el mustachfa?"],
  "Je veux des médicaments": ["n7eb dawa"],
  "J'ai une ordonnance": ["3andi wasfa"],
  "Pour la douleur": ["lil waja3"],

  // ========== ENRICHI : Verbes courants ==========
  "écrire": ["kteb", "ektob"],
  "lire": ["9ra", "9ari"],
  "manger": ["kol", "ekol", "akel"],
  "boire": ["echrab", "chrab", "chreib"],
  "dormir": ["nam", "noum", "3eysh"],
  "aller": ["emchi", "mchi", "nemchi"],
  "venir": ["eja", "eji", "ta3ala"],
  "vouloir": ["7eb", "n7eb", "bghit"],
  "avoir": ["3andi", "3andek", "3andou"],
  "faire": ["3mel", "3melt", "dir"],
  "dire": ["9oul", "9olt", "goul"],
  "savoir": ["3ref", "na3ref", "3araf"],
  "comprendre": ["fhem", "fahm", "nefhem"],
  "voir": ["chouf", "chouft", "nchouf"],
  "entendre": ["esma3", "sma3", "nesma3"],
  "parler": ["7key", "7ki", "ne7ki"],
  "donner": ["a3ti", "3tani", "na3ti"],
  "prendre": ["khoudh", "akhoudh", "nekhedh"],
  "ouvrir": ["7ell", "7allet", "ne7ell"],
  "fermer": ["sakker", "sekkert", "nesakker"],
  "attendre": ["stanna", "estanna", "nstanna"],
  "aider": ["3awen", "3aweni", "t3awen"],
  "chercher": ["9ollob", "9alleb", "n9ollob"],
  "trouver": ["l9a", "l9it", "nl9aw"],
  "appeler": ["nadi", "nadeyt", "nadi 3la"],
  "téléphoner": ["calli", "callini", "ncalli"],
  "être malade": ["mridh", "mrida", "tmaradh"],
  "guérir": ["tebra", "tebrani", "yetbra"],
  "opérer": ["jrah", "jerah", "nejrah"],
  "piquer": ["3t9", "3at9", "n3at9"],
  "mesurer": ["9is", "9est", "n9is"],
  "peser": ["wzen", "wzent", "nwzen"],

  // ========== Parties du corps (supplément) ==========
  "peau": ["jeld", "jilda"],
  "sang": ["demm", "damm"],
  "os": ["3dhem", "3dham"],
  "muscle": ["3adla", "3adlet"],
  "rein": ["kolya", "klya"],
  "vessie": ["mathana", "mathanet"],
  "genou": ["roukba", "rkoub"],
  "pied": ["rijel", "rijlin"],
  "cheville": ["ka3ba", "ka3bet"],
  "épaule": ["ketf", "ktef"],
  "ongle": ["dfer", "dfor"],
  "lèvre": ["chefa", "chefet"],
  "dent": ["senn", "snan"],
  "gencive": ["lesra", "lesret"],
  "gorge (mal)": ["hanjra", "waja3 el hanjra"],
  "oreille": ["weden", "wednin"],
  "œil": ["3in", "3youne"],
  "sourcil": ["7ajeb", "hawajeb"],
  "cils": ["ch3ar el 3in"],
  "barbe": ["le7ya", "le7yet"],
  "moustache": ["cheneb", "cheneb"],

  // ========== Symptômes & sensations (supplément) ==========
  "toux": ["s3al", "s3la"],
  "rhume": ["rech7a", "rech7"],
  "mal de gorge": ["waja3 el hanjra", "waja3 hanjra"],
  "mal aux dents": ["waja3 asnan", "waja3 senn"],
  "mal au dos": ["waja3 dhar", "waja3 fi dhar"],
  "mal au ventre": ["waja3 batn", "waja3 el batn"],
  "mal à la tête": ["waja3 ras", "waja3 el ras", "waja3 fi rase"],
  "nausée": ["doukhan", "dokhan"],
  "faible": ["d3if", "d3ifa"],
  "étourdi": ["dwar", "dawwar"],
  "essoufflé": ["tewennes", "tewennes"],
  "insomnie": ["sahar", "ma nemchich nem"],
  "démanger": ["7ak", "7akni", "ye7ouk"],
  "brûlure": ["7ar9a", "7ari9"],
  "blessure": ["jer7", "jerha"],
  "coupure": ["9at3a", "9ata3"],
  "enflure": ["werem", "waram"],
  "cicatrice": ["9ollab", "9ollbet"],
  "saignement": ["nzif", "nzif demm"],
  "constipation": ["9obd", "9obda"],
  "hypertension": ["daghet 3ali", "daghet"],
  "tension": ["daghet", "daghet eddemm"],
  "asthme": ["rabo", "rabw"],
  "migraine": ["chouja", "choujet ras"],
  "crampe": ["t9acha", "t9achat"],
  "engourdissement": ["khder", "khedra"],
  "picotement": ["tkhni9", "takhni9"],

  // ========== Termes médicaux (supplément) ==========
  "radio": ["radio", "taswir"],
  "prise de sang": ["tahlil demm", "akhdh demm"],
  "urine": ["bowl", "boul"],
  "analyse d'urine": ["tahlil bowl"],
  "piqûre": ["3t9a", "brnouka"],
  "injection": ["brnouka", "3t9a"],
  "comprimé": ["7abba", "7abbet"],
  "sirop": ["charbat", "charba"],
  "crème": ["krem", "krima"],
  "pansement": ["dawwa", "rebat"],
  "suture": ["khayat", "khayet"],
  "opération": ["amaliya", "jira7a"],
  "anesthésie": ["tabir", "moubarer"],
  "réveil": ["fay9", "fayek"],
  "consultation": ["estichara", "consultation"],
  "rendez-vous": ["rendez-vous", "mw3ed", "mw3id"],
  "salle d'attente": ["bit estanna", "salle d'attente"],
  "chambre": ["bit", "beyt", "oustra"],
  "lit": ["ferch", "fercha"],
  "ambulance": ["is3af", "el is3af", "kar el is3af"],
  "urgence": ["tari2", "el ourdouna"],
  "réanimation": ["in9adh", "in9adhh"],
  "maternité": ["welada", "el welada"],
  "bloc opératoire": ["bloc", "bloc jira7i"],
  "rayons X": ["rayons", "ch3a"],

  // ========== Lieux & directions ==========
  "maison": ["dar", "darou"],
  "rue": ["zen9a", "zen9et"],
  "ville": ["medina", "mdina"],
  "quartier": ["7ouma", "7oumet"],
  "cabinet": ["cabinet", "bit doktor"],
  "salle": ["bit", "salle"],
  "toilettes": ["bit el ma", "twalet"],
  "ascenseur": ["ascenseur", "lift"],
  "entrée": ["dokhol", "el dokhol"],
  "sortie": ["khorouj", "el khorouj"],
  "ici": ["louna", "houni"],
  "là": ["louna", "houni", "el houni"],
  "devant": ["9oddam", "9oddemi"],
  "derrière": ["wara", "wara"],
  "à gauche": ["l 9osar", "3al 9osar"],
  "à droite": ["l ymin", "3al ymin"],
  "en haut": ["l fo9", "fo9"],
  "en bas": ["l ta7t", "ta7t"],
  "près": ["9rib", "9riba"],
  "loin": ["b3id", "b3ida"],

  // ========== Temps & nombres ==========
  "aujourd'hui": ["el yom", "el youm", "njoum"],
  "hier": ["el ber7", "ber7"],
  "demain": ["ghadda", "ghodwa"],
  "maintenant": ["tawa", "dork"],
  "matin": ["sbe7", "sob7"],
  "soir": ["3chiya", "3ashiya"],
  "nuit": ["lel", "lila"],
  "heure": ["sa3a", "s3a"],
  "minute": ["da9i9a", "da9i9"],
  "jour": ["nhar", "yom"],
  "semaine": ["jom3a", "jem3a"],
  "mois": ["chher", "chhor"],
  "année": ["3am", "sna"],
  "un": ["wa7ed", "7da"],
  "deux": ["zouz", "thnin"],
  "trois": ["tlata", "tlata"],
  "quatre": ["arb3a", "arba3a"],
  "cinq": ["5amsa", "khamsa"],
  "dix": ["3achra", "3chra"],
  "premier": ["el weli", "awwel"],
  "dernier": ["el akher", "akher"],

  // ========== Famille & personnes ==========
  "père": ["baba", "bou"],
  "mère": ["mama", "ommi"],
  "enfant": ["tfol", "tfla", "wild"],
  "bébé": ["bebi", "tfol sghir"],
  "frère": ["khou", "akhu"],
  "sœur": ["oukht", "oukhti"],
  "mari": ["jouj", "mari"],
  "femme": ["mra", "mara"],
  "famille": ["3a2ila", "3ayla"],
  "homme": ["rajel", "regel"],
  "personne": ["nesen", "insen"],
  "enfant malade": ["tfol mridh", "wild mridh"],

  // ========== Adjectifs & adverbes ==========
  "grand": ["kbir", "kbira"],
  "petit": ["sghir", "sghira"],
  "bon": ["mziyen", "mzian", "bien"],
  "mauvais": ["mesh mziyen", "bish"],
  "douloureux": ["yewja3", "waja3"],
  "fort": ["9wi", "9wiya"],
  "léger": ["khfif", "khfifa"],
  "lourd": ["t9il", "t9ila"],
  "chaud": ["skhoun", "skhouna"],
  "froid": ["bared", "barda"],
  "vrai": ["7a9i9i", "7a9"],
  "faux": ["ghalt", "ghalit"],
  "possible": ["ymken", "imken"],
  "impossible": ["mouch ymken", "ma ymkench"],
  "vite": ["b sor3a", "sor3a"],
  "lentement": ["b chwiya", "b 9alel"],
  "toujours": ["dima", "dimouma"],
  "jamais": ["9att", "9atta"],
  "encore": ["barka", "barka"],
  "déjà": ["barka", "9bal"],
  "oui": ["ey", "ehe", "3ay"],
  "non": ["le", "lla", "la"],

  // ========== Noms utiles ==========
  "eau": ["ma", "may"],
  "pain": ["khobz", "khobza"],
  "nourriture": ["mekla", "ta3am"],
  "téléphone": ["telifoun", "teli"],
  "argent": ["flous", "flouss"],
  "papier": ["war9a", "war9et"],
  "carte": ["bita9a", "carte"],
  "clé": ["miftah", "mefateh"],
  "porte": ["bab", "beb"],
  "fenêtre": ["techka", "techket"],
  "voiture": ["karhba", "tomobile"],
  "bus": ["kar", "bus"],
  "train": ["train", "tren"],
  "avion": ["tayyara", "tayara"],

  // ========== Phrases supplémentaires ==========
  "Je ne comprends pas": ["ma nefhemch", "ma fhemtch"],
  "Répétez s'il vous plaît": ["a3id 9oul", "9oul barka"],
  "Parlez lentement": ["7ki b 9alel", "7key b chwiya"],
  "Où sont les toilettes?": ["win bit el ma?", "wine el twalet?"],
  "J'ai besoin d'un médecin": ["7ajet doktor", "n7eb doktor"],
  "C'est grave?": ["wesh 5tir?", "wesh mouch mziyen?"],
  "Quel est le diagnostic?": ["chnowa el tashkhis?", "chnowa el 7al?"],
  "Dois-je rester à l'hôpital?": ["lezmni n9a l mustachfa?", "n9a l sbitar?"],
  "Quand puis-je partir?": ["waqtash nemchi?", "waqtash nkhorouj?"],
  "Je suis allergique": ["3andi 7assasiya", "allergique"],
  "Je suis enceinte": ["7amla", "3andi 7aml"],
  "Où est la pharmacie?": ["win saidaliya?", "wine el pharmacie?"],
  "À quelle heure?": ["9adech el sa3a?", "f 9adech?"],
  "Combien ça coûte?": ["9adech?", "b 9adech?"],
  "Je n'ai pas d'argent": ["ma 3andich flous", "ma 3andi flous"],
  "Pas de problème": ["ma 3andekch moshkla", "bara mesh moshkla"],
  "D'accord": ["ok", "wakin", "mziyen"],
  "S'il vous plaît": ["3aychek", "min fadlek", "yaishek"],
  "Excusez-moi": ["sme7li", "sme7ni", "3afwen"]
};

// Construction du map tunisien → français (chaque variante pointe vers le français)
const TUNISIAN_TO_FRENCH = {};
for (const [french, variants] of Object.entries(FRENCH_TO_TUNISIAN)) {
  for (const v of variants) {
    const key = (v || "").toLowerCase().trim();
    if (key) TUNISIAN_TO_FRENCH[key] = french;
  }
}

/** Normalise une clé pour la recherche (minuscules, espaces uniformes). */
function normalizeKey(s) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Cherche une traduction dans le dictionnaire.
 * @returns { { translation: string, usedDictionary: boolean, missing: string[] } }
 */
function translateWithDictionary(input) {
  const normalized = normalizeKey(input);
  if (!normalized) return { translation: "", usedDictionary: false, missing: [] };

  // 1) Correspondance exacte
  const exact = TUNISIAN_TO_FRENCH[normalized];
  if (exact) return { translation: exact, usedDictionary: true, missing: [] };

  // 2) Sans ponctuation finale
  const noPunct = normalized.replace(/[.?!,;:]+$/, "").trim();
  if (noPunct && TUNISIAN_TO_FRENCH[noPunct])
    return { translation: TUNISIAN_TO_FRENCH[noPunct], usedDictionary: true, missing: [] };

  // 3) Par mots
  const words = normalized.split(/\s+/);
  const translated = [];
  const missing = [];
  for (const w of words) {
    const t = TUNISIAN_TO_FRENCH[w];
    if (t) translated.push(t);
    else if (w.length > 0) missing.push(w);
  }
  if (translated.length === 0 && missing.length > 0)
    return { translation: "", usedDictionary: false, missing: [normalized] };
  if (missing.length === 0)
    return { translation: translated.join(" "), usedDictionary: true, missing: [] };
  return {
    translation: translated.join(" "),
    usedDictionary: translated.length > 0,
    missing: missing.length ? [missing.join(" ")] : []
  };
}
