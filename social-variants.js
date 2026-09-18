// ═══════════════════════════════════════════════════════════════════════
// VARIANTES PAR RÉSEAU — 3 légendes DISTINCTES générées depuis la fiche
// ═══════════════════════════════════════════════════════════════════════
// Session « durcissement Composeur Post » : jamais de contenu strictement
// identique sur Instagram + Facebook + Pinterest (anti-doublon Buffer et
// bonne pratique par plateforme). Chaque réseau reçoit un angle différent :
//   - Instagram  : accroche courte + EXACTEMENT 5 hashtags (#ArtMuralMarocain…)
//   - Facebook   : phrase longue (description) + CTA WhatsApp « Contactez-nous : +212… »
//   - Pinterest  : titre SEO + bloc « Mots-clés : tableau mural marocain, … »
//
// SESSION « QUALITÉ RÉDACTIONNELLE » (2026-09-18) — correctifs après les posts
// réels du 17/09 (hashtags dupliqués, « premium » ×3, locution du titre
// répétée en tête de description). Règles appliquées à CHAQUE variante par
// normaliserTexteReseau() / assemblerLegendeInstagram() :
//   (a) un adjectif qualifiant (premium, doré(e), sacré(e), majestueux…) ne
//       peut apparaître qu'UNE seule fois par variante ; au-delà il est
//       remplacé par un synonyme de repli (« bâche premium » → « toile tendue
//       haut de gamme », « finition premium » → « finition soignée ») ;
//   (b) la locution principale du titre n'est JAMAIS répétée mot pour mot en
//       tête de description (Pinterest) → reformulée en « cette création » ;
//   (c) Instagram : UN SEUL bloc de hashtags (Set ordonné, plafond 11) précédé
//       de la ligne CTA « lien en bio » (Instagram ne rend aucun lien
//       cliquable dans une légende). Les lignes « Mots-clés : … » (SEO) et le
//       titre SEO Pinterest restent intacts.
//
// Utilisé par :
//   - site-web/server.js : GET /api/social/variantes (aperçu) et
//     POST /api/social/publish (repli automatique si une copie manque ou
//     si deux réseaux reçoivent le même texte — invariant : 3 textes distincts).
//   - dashboard/dashboard-app.js : remplissage des champs vides du composeur.
//
// fiche = objet fiche produit (contenu.js / getCurrentCatalog()) :
//   { nom, description, categorie, style, environnement, prix,
//     materiauRecommande, montageRecommande, couleurs[], ambiance }
// ═══════════════════════════════════════════════════════════════════════

import crypto from 'crypto';

const WHATSAPP_NUMERO = String(process.env.WHATSAPP_NUMBER || '212648620364');
const WHATSAPP_AFFICHE = '+212 ' + WHATSAPP_NUMERO.replace(/^212/, '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
const WHATSAPP_LIEN = 'https://wa.me/' + WHATSAPP_NUMERO;
const SITE_PUBLIC = 'https://energivor63-hub.github.io/Tableaux-Muraux-Site/#gallery';

// ── Règles rédactionnelles (correctifs du 18/09/2026) ────────────────────
/**
 * Instagram ne rend AUCUN lien cliquable dans une légende : le seul chemin
 * vers le catalogue est la ligne « lien en bio », insérée AVANT les hashtags.
 */
const CTA_LIEN_BIO = '👉 Catalogue complet & commandes : lien en bio 🔗';
/** Plafond dur du nombre de hashtags dans une légende Instagram. */
const MAX_HASHTAGS = 11;
const MOTIF_HASHTAG = /#[\p{L}\p{N}_]+/gu;
const MOTIF_LIGNE_HASHTAGS = /^\s*(?:#[\p{L}\p{N}_]+\s*)+$/u;
/** Ligne « Mots-clés : … » : SEO, jamais réécrite par la règle (a). */
const MOTIF_LIGNE_MOTS_CLES = /^\s*mots[-\s]?cl[ée]s\s*:/i;

/**
 * Adjectifs qualifiants surveillés (règle (a)) : chaque famille ne peut
 * apparaître qu'UNE fois par variante. Les replis suivent l'accord
 * (majestueux → imposant, majestueuse → imposante…).
 */
const FAMILLES_ADJECTIFS = [
  { famille: 'premium', formes: ['premium'], replis: ['haut de gamme'] },
  { famille: 'dore', formes: ['doré', 'dorée', 'dorés', 'dorées'], replis: ['au fini lumineux'] },
  { famille: 'sacre', formes: ['sacré', 'sacrée', 'sacrés', 'sacrées'], replis: ['spirituel', 'spirituelle', 'spirituels', 'spirituelles'] },
  { famille: 'majestueux', formes: ['majestueux', 'majestueuse', 'majestueuses'], replis: ['imposant', 'imposante', 'imposantes'] },
  { famille: 'luxueux', formes: ['luxueux', 'luxueuse', 'luxueuses'], replis: ['raffiné', 'raffinée', 'raffinées'] },
  { famille: 'exceptionnel', formes: ['exceptionnel', 'exceptionnelle', 'exceptionnels', 'exceptionnelles'], replis: ['remarquable', 'remarquable', 'remarquables', 'remarquables'] },
  { famille: 'raffine', formes: ['raffiné', 'raffinée', 'raffinés', 'raffinées'], replis: ['soigné', 'soignée', 'soignés', 'soignées'] }
];

/** Expressions figées : repli demandé par la charte rédactionnelle. */
const EXPRESSIONS_REPLI = [
  { formes: ['bâche premium', 'bache premium'], famille: 'premium', repli: 'toile tendue haut de gamme' },
  { formes: ['toile premium'], famille: 'premium', repli: 'toile tendue haut de gamme' },
  { formes: ['impression premium'], famille: 'premium', repli: 'impression haut de gamme' },
  { formes: ['finition premium'], famille: 'premium', repli: 'finition soignée' }
];

/** Minuscules sans accents (clés de comparaison). */
function sansAccents(texte) {
  return String(texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const REPLI_PAR_FORME = new Map();
const FAMILLE_PAR_FORME = new Map();
FAMILLES_ADJECTIFS.forEach(({ famille, formes, replis }) => {
  formes.forEach((forme, i) => {
    REPLI_PAR_FORME.set(sansAccents(forme), replis[Math.min(i, replis.length - 1)]);
    FAMILLE_PAR_FORME.set(sansAccents(forme), famille);
  });
});
const EXPRESSION_PAR_FORME = new Map();
EXPRESSIONS_REPLI.forEach((expression) => {
  expression.formes.forEach((forme) => EXPRESSION_PAR_FORME.set(sansAccents(forme), expression));
});

const echapperRegex = (texte) => String(texte).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/**
 * Alternation triée du plus long au plus court. Les formes gardent leurs
 * accents (c'est le texte réel qui est scanné) ; les tables de repli sont
 * indexées sur les formes SANS accents (sansAccents(mot)).
 */
const FORMES_SURVEILLEES = [
  ...EXPRESSIONS_REPLI.flatMap((expression) => expression.formes),
  ...FAMILLES_ADJECTIFS.flatMap((famille) => famille.formes)
].sort((a, b) => b.length - a.length);
const MOTIF_ADJECTIFS = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' + FORMES_SURVEILLEES.map(echapperRegex).join('|') + ')(?![\\p{L}\\p{N}])',
  'giu'
);

// Mots-clés SEO par catégorie (alignés sur dashboard-app.js CONFIG.seoKeywords)
const SEO_PAR_CATEGORIE = {
  calligraphie: 'calligraphie dorée',
  paysages: 'paysage marocain',
  geometrique: 'art géométrique marocain',
  abstrait: 'art abstrait moderne',
  moderne: 'art mural moderne',
  floral: 'art floral',
  autres: 'art mural marocain'
};
const LABELS_ENVIRONNEMENT = {
  salon: 'salon contemporain', chambre: 'chambre', bureau: 'bureau',
  entree: 'entrée', riad: 'riad', cabinet: 'cabinet',
  'ecole-primaire': 'école primaire', autres: 'salon contemporain'
};

/** Tous les hashtags d'un texte, dans l'ordre d'apparition. */
export function extraireHashtags(texte) {
  return String(texte || '').match(MOTIF_HASHTAG) || [];
}

/** Hashtags dédoublonnés (Set conservant l'ordre) avec plafond dur. */
export function dedupliquerHashtags(liste, plafond = MAX_HASHTAGS) {
  const vus = new Set();
  const ordre = [];
  (Array.isArray(liste) ? liste : []).forEach((brut) => {
    const tag = String(brut || '').trim();
    if (!tag.startsWith('#') || tag.length < 2) return;
    const cle = tag.toLowerCase();
    if (vus.has(cle)) return;
    vus.add(cle);
    if (ordre.length < plafond) ordre.push(tag);
  });
  return ordre;
}

/**
 * Règle (a) — un adjectif qualifiant AU PLUS UNE fois par variante.
 * La 1ʳᵉ occurrence est conservée telle quelle ; les suivantes sont remplacées
 * par un synonyme de repli. Zones protégées (jamais réécrites) :
 *   • le nom de l'œuvre entre « … » (nom propre : « Lumière Sacrée en Or ») —
 *     ses adjectifs comptent néanmoins dans le quota de la famille ;
 *   • les lignes « Mots-clés : … » (SEO).
 */
export function limiterAdjectifsQualifiants(texte, options = {}) {
  const protegerSeoCles = options.protegerSeoCles !== false;
  const source = String(texte || '');
  const vus = new Set();
  const transformer = (segment, remplacer) => segment.replace(MOTIF_ADJECTIFS, (mot) => {
    const cle = sansAccents(mot);
    const expression = EXPRESSION_PAR_FORME.get(cle);
    const famille = expression ? expression.famille : FAMILLE_PAR_FORME.get(cle);
    if (!famille) return mot;
    if (!vus.has(famille)) { vus.add(famille); return mot; }
    if (!remplacer) return mot;
    if (expression) {
      // Évite « sur toile tendue haut de gamme (toile tendue) » : si le texte
      // mentionne déjà la toile tendue, on emploie « support haut de gamme ».
      if (expression.repli === 'toile tendue haut de gamme' && /toile tendue/i.test(source)) {
        return 'support haut de gamme';
      }
      return expression.repli;
    }
    return REPLI_PAR_FORME.get(cle) || mot;
  });
  return source.split(/\r?\n/).map((ligne) => {
    if (protegerSeoCles && MOTIF_LIGNE_MOTS_CLES.test(ligne)) return ligne;
    return ligne.split(/(«[^»]*»)/).map((segment, i) => transformer(segment, i % 2 === 0)).join('');
  }).join('\n');
}

/** Jetons normalisés (minuscules sans accents) d'un texte. */
function jetons(texte) {
  return sansAccents(texte).match(/[\p{L}\p{N}]+/gu) || [];
}

/** Plus longue suite de mots commune (≥ minimum), null si trop courte. */
function plusLongueLocutionCommune(a, b, minimum = 2) {
  const A = jetons(a);
  const B = jetons(b);
  let meilleure = [];
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      let k = 0;
      while (i + k < A.length && j + k < B.length && A[i + k] === B[j + k]) k++;
      if (k > meilleure.length) meilleure = A.slice(i, i + k);
    }
  }
  if (meilleure.length < minimum) return null;
  // Évite les faux positifs du type « de la », « en or ».
  if (!meilleure.some((mot) => mot.length >= 4)) return null;
  return meilleure;
}

/** Locution principale du titre : portion SEO, avant le premier séparateur. */
function locutionDuTitre(titre) {
  return String(titre || '').split(/\s*(?:—|–|\||·|:|\s-\s)\s*/)[0].trim();
}

/**
 * Règle (b) — la locution principale du titre n'est pas répétée mot pour mot
 * dans la première phrase de la description : elle devient « cette création »
 * (y compris le « Tableau mural <locution> » d'ouverture).
 */
export function eviterRediteTitre(corps, titre) {
  const texte = String(corps || '');
  if (!texte) return texte;
  const coupe = texte.indexOf('. ');
  const fin = coupe > 10 ? coupe + 1 : Math.min(texte.length, 240);
  const premiere = texte.slice(0, fin);
  const locution = plusLongueLocutionCommune(locutionDuTitre(titre), premiere);
  if (!locution) return texte;
  const positions = [];
  const re = /[\p{L}\p{N}]+/gu;
  let m;
  while ((m = re.exec(premiere)) !== null) {
    positions.push({ mot: sansAccents(m[0]), start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i + locution.length <= positions.length; i++) {
    const fenetre = positions.slice(i, i + locution.length).map((p) => p.mot);
    if (fenetre.join(' ') !== locution.join(' ')) continue;
    // « Tableau mural <locution> » : la formule entière devient « cette création ».
    let debut = i;
    const prefixe = positions.slice(Math.max(0, i - 2), i).map((p) => p.mot).join(' ');
    if (i >= 2 && prefixe === 'tableau mural') debut = i - 2;
    const remplacement = positions[debut].start === 0 ? 'Cette création' : 'cette création';
    return (premiere.slice(0, positions[debut].start) + remplacement
      + premiere.slice(positions[i + locution.length - 1].end) + texte.slice(fin));
  }
  return texte;
}

/**
 * Normalise un texte de réseau : règle (b) d'abord sur Pinterest (la locution
 * du titre SEO disparaît de la tête de description AVANT le comptage des
 * adjectifs, sinon « calligraphie dorée » → « calligraphie au fini lumineux »
 * empêcherait la détection), puis règle (a) sur tout le texte.
 */
export function normaliserTexteReseau(texte, options = {}) {
  const reseau = String(options.reseau || '').toLowerCase();
  const titre = String(options.titre || '');
  let resultat = String(texte || '');
  if (reseau === 'pinterest' && titre.trim()) {
    const coupe = resultat.indexOf('\n');
    if (coupe !== -1) {
      const entete = resultat.slice(0, coupe);
      const corps = resultat.slice(coupe + 1);
      const memeTitre = sansAccents(entete).replace(/\s+/g, ' ').trim()
        === sansAccents(titre).replace(/\s+/g, ' ').trim();
      if (memeTitre) resultat = `${entete}\n${eviterRediteTitre(corps, titre)}`;
    }
  }
  return limiterAdjectifsQualifiants(resultat);
}

/**
 * Assemble la légende Instagram RÉELLEMENT envoyée : corps → CTA « lien en
 * bio » → UN SEUL bloc de hashtags dédoublonnés (Set ordonné, plafond 11).
 * Corrige le doublon historique « caption + hashtags » du composeur (un hashtag
 * collé dans la légende n'apparaît plus deux fois).
 */
export function assemblerLegendeInstagram(caption, hashtags) {
  const tags = dedupliquerHashtags([...extraireHashtags(caption), ...extraireHashtags(hashtags)]);
  const corps = String(caption || '').split(/\r?\n/)
    .filter((ligne) => !MOTIF_LIGNE_HASHTAGS.test(ligne)) // ligne 100 % hashtags → retirée
    .map((ligne) => ligne.replace(MOTIF_HASHTAG, ' ').replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const corpsFinal = limiterAdjectifsQualifiants(corps);
  const cta = /lien en bio/i.test(corpsFinal) ? '' : CTA_LIEN_BIO;
  return [corpsFinal, cta, tags.join(' ')].filter((bloc) => bloc && bloc.trim()).join('\n\n');
}

function premierePhrase(texte, maxChars = 160) {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const point = t.indexOf('. ');
  const phrase = point > 20 ? t.slice(0, point + 1) : t;
  return phrase.length > maxChars ? phrase.slice(0, maxChars - 1).replace(/[ ,;]\S*$/, '') + '…' : phrase;
}

function sansPointFinal(texte) {
  return String(texte || '').trim().replace(/\.+$/, '');
}

/** 5 hashtags distincts par fiche — #ArtMuralMarocain + catégorie + couleur/style + environnement. */
function hashtagsInstagram(fiche) {
  const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '').slice(0, 22);
  const base = ['#ArtMuralMarocain', '#' + (slug(fiche.categorie) || 'DecoMarrakech'), '#Marrakech'];
  const couleur = Array.isArray(fiche.couleurs) && fiche.couleurs[0] ? '#' + slug(fiche.couleurs[0]) : '';
  const extra = couleur && !base.includes(couleur) ? couleur : '#' + (slug(fiche.style) || 'FaitMain');
  const fin = '#' + (slug(fiche.environnement) === 'salon' ? 'SalonDeco' : slug(fiche.environnement) || 'DecoMaison');
  return [...new Set([base[0], base[1], extra, fin, base[2]])].slice(0, 5);
}

/**
 * genererVariantes(fiche) → { instagram, facebook, pinterest }
 * Retourne 3 textes GARANTIS distincts (angles et gabarits différents).
 */
export function genererVariantes(fiche) {
  const nom = fiche?.nom || 'Œuvre unique';
  const seoCat = SEO_PAR_CATEGORIE[fiche?.categorie] || SEO_PAR_CATEGORIE.autres;
  const envLabel = LABELS_ENVIRONNEMENT[fiche?.environnement] || LABELS_ENVIRONNEMENT.autres;
  const matiere = fiche?.materiauRecommande || 'bâche premium';
  const prix = fiche?.prix || 'Prix sur demande';

  // ── Instagram : accroche courte + CTA « lien en bio » + 5 hashtags ──
  // Le CTA précède TOUJOURS le bloc de hashtags (aucun lien cliquable en
  // légende Instagram) ; règle (a) appliquée sur tout le texte.
  const instagram = limiterAdjectifsQualifiants([
    `✨ ${nom} — fait main à Marrakech.`,
    '',
    `${sansPointFinal(fiche?.ambiance || 'Pièce unique')}, en ${matiere.toLowerCase()}. ${premierePhrase(fiche?.description, 110)}`.trim(),
    '',
    `${prix}`,
    '',
    CTA_LIEN_BIO,
    '',
    hashtagsInstagram(fiche).join(' ')
  ].join('\n'));

  // ── Facebook : phrase longue + CTA WhatsApp + lien du site (règle (a)) ──
  const facebook = limiterAdjectifsQualifiants([
    `« ${nom} » — ${sansPointFinal(String(fiche?.ambiance || 'une ambiance unique').toLowerCase())}.`,
    '',
    String(fiche?.description || '').replace(/\s+/g, ' ').trim(),
    '',
    `${matiere} · ${fiche?.montageRecommande || 'montage au choix'} · ${prix}. Pièce unique, fabriquée à la main dans notre atelier de Marrakech.`,
    '',
    `📞 Contactez-nous : ${WHATSAPP_AFFICHE} (${WHATSAPP_LIEN})`,
    `🌐 Collection complète : ${SITE_PUBLIC}`
  ].join('\n'));

  // ── Pinterest : titre SEO + description reformulée + mots-clés ──
  // Règles (a) + (b) : la locution du titre SEO n'est jamais répétée mot pour
  // mot en tête de description (« cette création » à la place) et l'adjectif
  // qualifiant reste unique (le bloc « Mots-clés : … » reste intact).
  const motsCles = ['tableau mural marocain', seoCat, `décoration ${envLabel}`,
    ...(Array.isArray(fiche?.couleurs) ? fiche.couleurs.slice(0, 3).map((c) => String(c).toLowerCase()) : []),
    'fait main Marrakech'].join(', ');
  const pinterestTitre = `${titrePinterest(fiche)}.`;
  const pinterest = normaliserTexteReseau([
    pinterestTitre,
    '',
    `Cette création a été pensée pour votre ${envLabel}. ${premierePhrase(fiche?.description, 180)}`,
    `${prix} — expédition soignée depuis Marrakech.`,
    '',
    `Mots-clés : ${motsCles}`
  ].join('\n'), { reseau: 'pinterest', titre: pinterestTitre });

  return { instagram, facebook, pinterest };
}

/** Titre SEO Pinterest (≤ 100 caractères) : mot-clé + nom de l'œuvre. */
export function titrePinterest(fiche) {
  const seoCat = SEO_PAR_CATEGORIE[fiche?.categorie] || SEO_PAR_CATEGORIE.autres;
  const brut = `Tableau mural ${seoCat} — ${fiche?.nom || 'œuvre unique'}`;
  return brut.length > 100 ? brut.slice(0, 97).replace(/[ —]+\S*$/, '') + '…' : brut;
}

/** Hash court du contenu (garde-fou anti-doublon local). */
export function hashContenu(texte) {
  return crypto.createHash('sha256').update(String(texte || ''), 'utf8').digest('hex').slice(0, 16);
}
