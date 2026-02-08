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
  "analyse": ["tahlil", "t7lil", "ta7lil", "tahlel", "tahlil demm", "tahlil eddemm", "analyse", "el tahlil", "na3mel tahlil", "3mel tahlil", "tahlilat", "analyses"],
  "analyses": ["tahlil", "t7lil", "ta7lil", "tahlilat", "el tahlil", "nati9et tahlil", "resultats tahlil", "analyses"],
  "résultats": ["nati9a", "nati9et", "nata2ij", "resultats", "el nati9a", "nati9et el tahlil", "kharjet", "résultats"],
  "resultats": ["nati9a", "nati9et", "el nati9a", "resultats"],
  "thyroïde": ["ghadda dara9iya"],
  "ordonnance médical": ["wasfa tibiya", "wasfa tibi", "wasfa", "el wasfa", "ordonnance", "wasfet doktor", "wasfet tibiya", "prescription", "ordonnance medical"],
  "ordonnance médicale": ["wasfa tibiya", "wasfa tibi", "wasfa", "el wasfa", "ordonnance", "wasfet doktor", "ordonnance medicale"],
  "ordonnance medical": ["wasfa", "wasfa tibiya", "ordonnance", "wasfet doktor"],
  "ordonnance medicale": ["wasfa", "wasfa tibiya", "ordonnance", "wasfet doktor"],
  "gel hydroalcoolique": ["jel kou7ouli", "jel 7ou7ouli", "jel kouhouli", "jel stérilisant", "jel el yedd", "désinfectant yedd", "jel tibiya", "hydroalcoolique", "gel", "hydroalcoolique"],
  "gros intestin": ["9ouloun"],
  "intestin grêle": ["am3a da9i9a"],
  "COVID-19": ["korona"],
  "sida": ["idz"],
  "rougeole": ["7asba", "hasba"],
  "vaccin": ["talki7", "t7in", "vaccin", "el talki7", "3t9a talki7", "brnouket talki7", "vaccination", "yet3am b talki7", "teli7", "vaccin"],
  "implant cochléaire": ["sama3a dakhliya", "sama3a dakhliya", "implant fi weden", "sama3a el weden", "appareil sam3", "implant cochléaire", "sama3et eddakhli", "implant cochleaire", "implant weden"],
  "implant cochleaire": ["sama3a dakhliya", "implant fi weden", "implant cochléaire"],
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
  "médecin": ["doktor", "doktorh", "tabib", "doktorh"],
  "patient": ["mridh", "maridh"],
  "hôpital": ["mustachfa", "sbitar", "sbitar", "l hopital", "el mustachfa"],
  "hopital": ["mustachfa", "sbitar", "el mustachfa"],
  "pharmacie": ["saidaliya", "saidliya", "el saidaliya"],
  "infirmier": ["mamarredh"],

  // Questions courantes
  "où avez-vous mal": ["wiene youja3ek", "win youja3ek", "wine youja3ek", "fen youja3ek", "wesh youja3ek", "ash men wejetek", "warien el waja3", "warien te7es b waja3"],
  "ou avez vous mal": ["wiene youja3ek", "win youja3ek", "wine youja3ek"],
  "date de naissance": ["tarikh el milad", "tarikh miladek", "ta3rif milad", "el milad", "wechnt 3omrek", "3omrek chhal", "milad", "date milad"],
  "prénom et nom": ["el isem w el la9ab", "isem w la9ab", "esmek w la9abek", "chnowa esmek", "esmek kamil", "el isem el kamil", "isem w nasab", "prenom w nom"],
  "prenom et nom": ["el isem w el la9ab", "isem w la9ab", "esmek w la9abek", "chnowa esmek"],
  "quand": ["waqtash", "wa9tash", "wa9tèch", "mtash", "f wa9tash", "9adech el wa9t", "el wa9t", "f 9adech", "wa9té", "f ay wa9t", "l wa9tash", "weqtash", "quand"],
  "comment": ["kifech", "kifach", "comment"],
  "pourquoi": ["3lach", "3lech", "pourquoi", "lech"],
  "qu'est ce qui est passé": ["chnowa 3mel", "chnowa 7asal", "chneya 7adet", "wesh 7asal", "el 7aja elli 7asalet", "7adet chneya", "wesh 3malt", "ech sar", "chneya sar", "ch sar"],

  // États
  "positif": ["ijiyebi", "ijabi", "mijeb", "ijabi", "positif"],
  "négatif": ["salbi", "salbi", "manijebch", "négatif"],
  "positif négatif": ["ijabi salbi", "mijeb wela salbi", "positif négatif", "ijabi w salbi", "nati9a ijabi wela salbi"],
  "positif negatif": ["ijabi salbi", "mijeb wela salbi", "positif négatif"],
  "attention": ["intibah", "intiba", "entibah", "tnbih", "khoudh balek", "khodh balek", "7ott balek", "attention", "soy 9alek", "intiba"],

  // Urgence
  "urgence": ["tari2"],

  // Sourd, malentendant, handicap, interprète, langue des signes
  "sourd": ["asamm", "asam", "el asamm", "ma yesma3ch", "ma yesma3ouch", "sourd", "d3if es-same3", "ma 3andouch sam3"],
  "malentendant": ["d3if es-same3", "d3if es same3", "ma yesma3ch mziyen", "ma yesma3ouch b mziyen", "malentendant", "el weden ma t7ottch"],
  "handicap": ["i3a9a", "i3a9a", "mo3a99a", "handicap", "3a9a", "ma 3andouch 9owa", "personne mo3a99a"],
  "interprète": ["motarjem", "motarjem el icharat", "tarjem el ichara", "interprète", "el motarjem", "yfhem el loghet el ichara"],
  "interprete": ["motarjem", "motarjem el icharat", "tarjem el ichara"],
  "langue des signes": ["loghet el ichara", "logha el ichara", "el icharat", "icharat", "langue des signes", "el logha el ichara", "tarjem b el yedd", "parler b el yedd", "7key b el icharat"],
  "information et": ["ma3louma w", "ma3loumat w", "information w", "el ma3louma", "ta3ref chneya"],
  "information": ["ma3louma", "ma3loumat", "ta3ref", "el ma3louma"],

  // Santé, CIN, problèmes, prévention, etc.
  "santé": ["se77a", "seha", "s7a", "el se77a", "santé", "sante", "3andou se77a", "mziyen b el se77a"],
  "sante": ["se77a", "seha", "s7a", "el se77a", "santé"],
  "CIN": ["bita9et ta3rif", "bita9a ta3rif", "cin", "el cin", "bita9et el 7ouwiya", "carte ta3rif", "bita9a", "bita9a ta3rif", "carte identite"],
  "RDV": ["mw3ed", "mw3id", "rendez-vous", "rdv", "el mw3ed", "3andou mw3ed", "mw3ed m3a doktor", "rendez vous", "mw3ed", "rdv"],
  "rendez-vous": ["mw3ed", "mw3id", "rdv", "el mw3ed", "mw3ed m3a doktor", "rendez vous", "mw3ed"],
  "problèmes de santé": ["mashakel se77iya", "mashakel se77a", "moshkel fi se77a", "el 3ilaj", "mashakel tibiya", "problemes sante", "moshkilat es se77a"],
  "problemes de sante": ["mashakel se77iya", "mashakel se77a", "moshkel fi se77a"],
  "prévention": ["wi9aya", "wi9aya", "prevention", "7ott 9alek", "te9i", "el wi9aya", "bch ma tmaradhch", "prevention"],
  "prevention": ["wi9aya", "wi9aya", "el wi9aya"],
  "solution": ["7all", "hall", "el 7all", "solution", "kifech n7allou", "7all el moshkla", "el hall"],
  "résultat": ["nati9a", "nati9a", "resultat", "el nati9a", "chneya kharjet", "nati9et el tahlil", "el résultat"],
  "resultat": ["nati9a", "el nati9a", "nati9et el tahlil"],
  "évaluation": ["takyim", "takyim", "evaluation", "9im", "takyim el 7ala", "chkoun 9im", "el takyim", "eval", "evaluation"],
  "evaluation": ["takyim", "9im", "el takyim"],
  "responsabilité": ["mas2ouliya", "mas2ouliya", "responsabilité", "chkoun mas2oul", "el mas2ouliya", "responsabilite", "mas2ouliya"],
  "responsabilite": ["mas2ouliya", "el mas2ouliya"],
  "relation sexuelle": ["3ala9a jensiya", "3ala9a jensiya", "relation jensiya", "el 3ala9a el jensiya", "3ala9at jensiya"],
  "régime amaigrissant": ["régime", "regime", "nzel wzen", "nzoul wzen", "regime nzel", "barcha nzel", "régime amaigrissant", "regime amaigrissant", "rgime amaigrissant"],
  "regime amaigrissant": ["régime", "nzel wzen", "regime nzel"],
  "question réponse": ["soal w jawab", "soal jawab", "s2al w jawab", "question réponse", "soal w jwab", "el as2ila w el jawabat", "question reponse"],
  "question reponse": ["soal w jawab", "soal jawab", "s2al w jawab"],
  "poids": ["wzen", "wazn", "el wzen", "9adech wzenek", "wzent", "poids", "el wazn", "wzeni", "wzn"],
  "vitamine": ["vitamine", "vitamin", "el vitamine", "vitamines", "3andou vitamine", "na9es vitamine", "vitamin"],
  "taille": ["khesr", "khasr", "9adech toulék", "el khesr", "taille", "9is el khesr", "toulék chhal", "khesr", "toul"],

  // Salutations
  "salut ça va": ["ahla bik, kifech", "ahla", "kifech", "labes", "salut", "ça va", "salam", "ahla w sahla", "kifech 7alka", "chbik", "ahla labes", "salut ca va"],
  "salut ca va": ["ahla bik", "ahla labes", "kifech", "ahla", "kifech", "labes", "salut", "ça va", "salut ca va"],
  "bonjour": ["sabah el khir", "aslema", "aslema bik"],
  "merci": ["choukran", "yaishek", "3aychek"],
  "au revoir": ["bisslama"],

  // Utiles supplémentaires
  "ça va": ["labes"],
  "beaucoup": ["barcha"],
  "quoi": ["chnowa"],
  "médicament": ["dawa", "dwa", "adwiya", "dawet", "el dawa", "médicament", "medicament", "dawa tibiya", "3andou dawa"],
  "medicament": ["dawa", "dwé","dweyett","dweyette","dweyet","dweyat","dwa", "adwiya", "el dawa", "dawa tibiya"],
  "caisse nationale d'assurance-maladie": ["cnam", "el cnam", "caisse assurance", "bita9et se77a", "assurance maladie", "caisse nationale", "cnss", "mutuelle", "kasse enaf"],
  "caisse nationale d assurance maladie": ["cnam", "el cnam", "caisse assurance", "bita9et se77a", "assurance maladie"],
  "en pleine forme": ["bkhir", "b khir", "mziyen", "7atta bkhir", "b el 5ir", "en pleine forme", "3andou se77a", "labes barcha", "kif kif mziyen"],
  "stress": ["tawater", "tawater", "stress", "stressé", "mstewter", "el stress", "3andou stress", "tawater barcha"],

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
