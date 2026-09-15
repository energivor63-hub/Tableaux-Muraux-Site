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

  // ── Instagram : accroche courte + 5 hashtags ──
  const instagram = [
    `✨ ${nom} — fait main à Marrakech.`,
    '',
    `${sansPointFinal(fiche?.ambiance || 'Pièce unique')}, en ${matiere.toLowerCase()}. ${premierePhrase(fiche?.description, 110)}`.trim(),
    '',
    `${prix}`,
    hashtagsInstagram(fiche).join(' ')
  ].join('\n');

  // ── Facebook : phrase longue + CTA WhatsApp ──
  const facebook = [
    `« ${nom} » — ${sansPointFinal(String(fiche?.ambiance || 'une ambiance unique').toLowerCase())}.`,
    '',
    String(fiche?.description || '').replace(/\s+/g, ' ').trim(),
    '',
    `${matiere} · ${fiche?.montageRecommande || 'montage au choix'} · ${prix}. Pièce unique, fabriquée à la main dans notre atelier de Marrakech.`,
    '',
    `📞 Contactez-nous : ${WHATSAPP_AFFICHE} (${WHATSAPP_LIEN})`,
    `🌐 Collection complète : ${SITE_PUBLIC}`
  ].join('\n');

  // ── Pinterest : titre SEO + mots-clés ──
  const motsCles = ['tableau mural marocain', seoCat, `décoration ${envLabel}`,
    ...(Array.isArray(fiche?.couleurs) ? fiche.couleurs.slice(0, 3).map((c) => String(c).toLowerCase()) : []),
    'fait main Marrakech'].join(', ');
  const pinterest = [
    `${titrePinterest(fiche)}.`,
    '',
    `${sansPointFinal(seoCat)} · ${matiere.toLowerCase()} · ${envLabel}. ${premierePhrase(fiche?.description, 180)}`,
    `${prix} — expédition soignée depuis Marrakech.`,
    '',
    `Mots-clés : ${motsCles}`
  ].join('\n');

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
