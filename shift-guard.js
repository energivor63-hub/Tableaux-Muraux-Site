/**
 * shift-guard.js — GARDE-FOU SHIFT (MICRO-11v2-quater, 26/10/2026)
 * ═════════════════════════════════════════════════════════════════════════
 * RÉFÉRENTIEL UNIQUE : les posts de /api/social/buffer-queue (inventaire
 * Buffer réel), JAMAIS les journaux locaux. Un post est « à re-médier »
 * si et seulement si :
 *   1. statut Buffer = scheduled / queued ;
 *   2. dueAt > maintenant ;
 *   3. mediaUrl pointe vers un RANG (images/produit-N.jpg) ;
 *   4. source = 'dashboard' (les posts source 'manuel-buffer' — vidéos
 *      programmées à la main sur Buffer Web — sont TOUJOURS ignorés).
 *
 * Le journal local ne sert qu'à taguer la SOURCE (match postId, repli
 * (platform, isoUTC, produitId)) : il n'alimente plus la liste.
 *
 * La suggestion de remplacement est lue dans registre/stable-map.json AU
 * MOMENT de l'affichage ; si le slug manque ou si la copie stable est
 * périmée (SHA), stabiliser_medias.mjs --resync (resynchroniserStables)
 * est exécuté AVANT de proposer l'URL.
 * ═════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  SITE_DIR,
  lireCatalogue,
  resynchroniserStables,
  sha256Fichier,
  cheminRelatifImage
} from './medias-stables.js';
import {
  normaliserIso,
  normaliserEntree,
  plateformeEntree,
  produitIdEntree,
  isoEntree
} from './journal-social.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RACINE_DEPOT = path.resolve(__dirname, '..');

/** Rang : images/produit-N.jpg (absolu, relatif, query/hash tolérés). */
export const FILTRE_MEDIA_RANG = /(?:^|\/)images\/produit-(\d+)\.(?:jpe?g|png|webp)(?:[?#]|$)/i;

export const STATUTS_FUTURS = ['scheduled', 'queued'];

export const EXPLICATION_FILTRE =
  'Posts Buffer au statut scheduled/queued, dueAt futur, média images/produit-N.jpg (rang), ' +
  'hors source manuel-buffer (vidéos programmées à la main sur Buffer Web). ' +
  'Le journal local ne sert qu’à identifier la source, jamais à lister les posts.';

/** Fichier de mapping lu à CHAQUE affichage (jamais de snapshot en mémoire). */
export function cheminMappingStable() {
  return path.join(RACINE_DEPOT, 'registre', 'stable-map.json');
}

export function lireMappingStable() {
  try {
    const m = JSON.parse(fs.readFileSync(cheminMappingStable(), 'utf-8'));
    return m && typeof m === 'object' ? m : {};
  } catch {
    return {};
  }
}

/** Indexe le journal (actif + archives) pour retrouver la source d'un post. */
export function indexerJournal(journal = []) {
  const parPostId = new Map();
  const parSlot = new Map();
  const parSlotSansProduit = new Map();
  for (const brute of journal) {
    const e = normaliserEntree(brute);
    if (e.postId) parPostId.set(String(e.postId), e);
    const iso = isoEntree(e);
    const produit = produitIdEntree(e);
    if (produit) {
      const cle = `${plateformeEntree(e)}|${iso || 'sans-date'}|${produit}`;
      if (!parSlot.has(cle)) parSlot.set(cle, e);
    }
    if (iso) {
      const cle = `${plateformeEntree(e)}|${iso}`;
      if (!parSlotSansProduit.has(cle)) parSlotSansProduit.set(cle, e);
    }
  }
  return { parPostId, parSlot, parSlotSansProduit };
}

/**
 * Source d'un post Buffer :
 *   1. postId présent dans le journal → sa source ;
 *   2. repli slot (platform, isoUTC, produitId) pour les entrées legacy
 *      sans postId (posts créés par le dashboard AVANT ce correctif) ;
 *   3. sinon 'manuel-buffer' (jamais touché : vidéo/édition Buffer Web).
 */
export function sourcePourPost(post, index) {
  if (!post) return 'manuel-buffer';
  const direct = post.postId ? index.parPostId.get(String(post.postId)) : null;
  if (direct) return direct.source === 'manuel-buffer' ? 'manuel-buffer' : 'dashboard';

  const produit = post.produitId || produitIdEntree(post);
  const reseau = String(post.reseau || post.platform || '').toLowerCase();
  if (produit && reseau) {
    const cle = `${reseau}|${normaliserIso(post.dueAt) || 'sans-date'}|${produit}`;
    const slot = index.parSlot.get(cle);
    if (slot) return slot.source === 'manuel-buffer' ? 'manuel-buffer' : 'dashboard';
  }
  // Média déjà stable / vidéo (pas un rang) : le produit n'est plus lisible
  // dans l'URL. Repli sur le créneau (platform, isoUTC) pour l'AFFICHAGE de
  // la source — jamais utilisé par le filtre (qui exige un rang).
  if (!FILTRE_MEDIA_RANG.test(String(post.mediaUrl || '')) && reseau) {
    const slot = index.parSlotSansProduit.get(`${reseau}|${normaliserIso(post.dueAt) || 'sans-date'}`);
    if (slot) return slot.source === 'manuel-buffer' ? 'manuel-buffer' : 'dashboard';
  }
  return 'manuel-buffer';
}

/**
 * FILTRE PUR (testable sans réseau) : renvoie les posts à re-médier.
 * @param {Array} posts   posts de l'inventaire Buffer
 * @param {object} opts   { now, journal }
 */
export function filtrerPostsARemedier(posts, { now = new Date(), journal = [] } = {}) {
  const index = indexerJournal(journal);
  const maintenant = now instanceof Date ? now : new Date(now);
  const tNow = Number.isNaN(maintenant.getTime()) ? Date.now() : maintenant.getTime();
  const sortie = [];

  for (const post of posts || []) {
    const statut = String(post.statut || post.status || '').toLowerCase();
    if (!STATUTS_FUTURS.includes(statut)) continue;

    const dueAt = normaliserIso(post.dueAt);
    if (!dueAt || Date.parse(dueAt) <= tNow) continue;

    const mediaUrl = String(post.mediaUrl || '');
    const match = mediaUrl.match(FILTRE_MEDIA_RANG);
    if (!match) continue;

    const produitId = `produit-${Number(match[1])}`;
    const enrichi = { ...post, statut, dueAt, mediaUrl, produitId };
    const source = sourcePourPost(enrichi, index);
    if (source === 'manuel-buffer') continue;

    sortie.push({ ...enrichi, source });
  }
  return sortie;
}

function urlPublique(cheminRelatif) {
  const base = String(process.env.WEBSITE_URL || 'https://energivor63-hub.github.io/Tableaux-Muraux-Site/')
    .replace(/\/+$/, '');
  return `${base}/${cheminRelatifImage(cheminRelatif)}`;
}

/**
 * Lit stable-map.json AU MOMENT de l'appel ; vérifie que la copie stable
 * existe et que son SHA correspond à l'image source COURANTE. Sinon :
 * resynchroniserStables() puis relecture. Ne renvoie JAMAIS une URL stable
 * dont le SHA diffère de la source.
 */
export function resoudreStableDepuisMap(mediaUrl, { siteDir = SITE_DIR, catalogue } = {}) {
  const match = String(mediaUrl || '').match(FILTRE_MEDIA_RANG);
  if (!match) return { erreur: 'média non concerné (pas un rang produit-N)' };

  const rang = Number(match[1]);
  const produitId = `produit-${rang}`;
  let cat = catalogue;
  if (!cat) {
    try { cat = lireCatalogue({ siteDir }); } catch (e) {
      return { produitId, rang, erreur: `catalogue illisible : ${e.message}` };
    }
  }
  const oeuvre = cat.find((o) => o.rang === rang);
  if (!oeuvre) return { produitId, rang, erreur: `rang ${produitId} absent du catalogue contenu.js` };

  const sourceAbs = path.join(siteDir, cheminRelatifImage(oeuvre.image));
  if (!fs.existsSync(sourceAbs)) {
    return { produitId, rang, slug: oeuvre.slug, nom: oeuvre.nom, erreur: `image source absente : ${oeuvre.image}` };
  }
  const shaSource = sha256Fichier(sourceAbs);

  const evaluer = (mapping) => {
    const cible = mapping[produitId];
    if (!cible) return { cible: null, raison: `slug ${produitId} absent de stable-map.json` };
    const abs = path.join(siteDir, cible);
    if (!fs.existsSync(abs)) return { cible, raison: `copie stable absente : ${cible}` };
    const sha = sha256Fichier(abs);
    if (sha !== shaSource) return { cible, raison: `copie stable périmée (SHA différent) : ${cible}` };
    return { cible, sha };
  };

  let mapping = lireMappingStable();
  let etat = evaluer(mapping);
  let resync = null;

  if (!etat.sha) {
    try {
      resync = resynchroniserStables({ siteDir });
    } catch (e) {
      return { produitId, rang, erreur: `resync stable impossible : ${e.message}`, raison: etat.raison };
    }
    mapping = lireMappingStable();
    etat = evaluer(mapping);
  }

  if (!etat.sha) {
    return {
      produitId, rang, slug: oeuvre.slug, nom: oeuvre.nom,
      erreur: etat.raison || 'URL stable introuvable après resync',
      resync: resync ? { crees: resync.crees, actualises: resync.actualises, erreurs: resync.erreurs } : null
    };
  }

  return {
    produitId,
    rang,
    slug: oeuvre.slug,
    nom: oeuvre.nom,
    cheminRelatif: etat.cible,
    url: urlPublique(etat.cible),
    sha256: etat.sha,
    resync: resync ? { crees: resync.crees, actualises: resync.actualises, erreurs: resync.erreurs } : null
  };
}

/**
 * Sujets affichables : filtre (référentiel Buffer) + suggestion stable
 * dynamique. Pur côté filtre, I/O côté mapping (stable-map + resync).
 */
export function construireSujets(posts, { now = new Date(), journal = [], siteDir = SITE_DIR } = {}) {
  const filtres = filtrerPostsARemedier(posts, { now, journal });
  if (!filtres.length) return [];

  let catalogue;
  try { catalogue = lireCatalogue({ siteDir }); } catch (e) {
    return filtres.map((p) => ({ ...p, stableUrl: null, erreurStable: `catalogue illisible : ${e.message}` }));
  }

  return filtres.map((p) => {
    const stable = resoudreStableDepuisMap(p.mediaUrl, { siteDir, catalogue });
    return {
      ...p,
      stableUrl: stable.url || null,
      stableChemin: stable.cheminRelatif || null,
      slug: stable.slug || null,
      nom: stable.nom || null,
      sha256: stable.sha256 || null,
      erreurStable: stable.erreur || null,
      resync: stable.resync || null
    };
  });
}

/** Liste manuelle (quand Buffer ne supporte pas l'édition automatique). */
export function listeManuelle(sujets = []) {
  return sujets.map((s) => ({
    postId: s.postId,
    reseau: s.reseau || s.platform,
    dueAt: s.dueAt,
    mediaUrl: s.mediaUrl,
    stableUrl: s.stableUrl,
    erreurStable: s.erreurStable || null
  }));
}
