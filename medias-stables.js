/**
 * medias-stables.js — SOURCE DE VÉRITÉ des médias stables (MICRO-11v2-ter)
 * ═══════════════════════════════════════════════════════════════════════
 * PROBLÈME RÉSOLU (preuve 23/10/2026) : stable-map.json était un INSTANTANÉ
 * (34 œuvres au 22/10). Après une insertion en tête (35 œuvres), la carte
 * désignait encore l'ancienne œuvre du rang 1 → Buffer recevait l'image du
 * rang N+1 (rang 1 envoyé, image rang 2 reçue sur IG/FB/PIN).
 *
 * RÈGLE : la carte statique n'est JAMAIS consultée pour résoudre un rang.
 * À l'envoi, on relit contenu.js (état COURANT) :
 *   rang N → œuvre courante → slug → images/stables/<slug>.jpg
 *   - fichier absent → créé immédiatement (copie de l'image source du rang,
 *     SHA-256 vérifié après copie) ;
 *   - fichier présent mais SHA différent de la source → BLOCAGE
 *     (média stable désynchronisé — jamais d'image périmée chez Buffer).
 *
 * Si le nom de l'œuvre est fourni (produitNom), il PRIME sur le rang : un
 * dashboard resté ouvert pendant une insertion en tête envoie un rang périmé,
 * mais le nom reste l'identité fiable de l'œuvre choisie.
 *
 * Ce module est utilisé par :
 *   - site-web/buffer-graphql.js   (résolution + garde-fou à l'envoi)
 *   - site-web/server.js           (hooks resync ajout/remplacement/édition)
 *   - registre/stabiliser_medias.mjs --resync (reconstruction de la carte)
 * ═══════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const SITE_DIR = __dirname;
export const IMAGES_DIR = path.join(SITE_DIR, 'images');
export const STABLES_DIR = path.join(IMAGES_DIR, 'stables');
export const CONTENU_JS = path.join(SITE_DIR, 'contenu.js');

/** Erreur typée : le code est journalisé et affiché tel quel au dashboard. */
export class MediaStableError extends Error {
  constructor(message, { code, details } = {}) {
    super(message);
    this.name = 'MediaStableError';
    this.code = code || 'MEDIA_STABLE_ERREUR';
    this.details = details || null;
  }
}

/** Résout la racine du site (surchargeable pour les tests / sandbox). */
export function racineSite(siteDir) {
  return siteDir || process.env.MEDIAS_STABLES_SITE_DIR || SITE_DIR;
}

/** Slug canonique d'une œuvre : minuscules, accents retirés, espaces → « - ». */
export function slugifier(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Chemin relatif d'image depuis une URL ou un chemin (origine, base GitHub
 *  Pages et query retirés).
 *  Ex. « https://…/Tableaux-Muraux-Site/images/produit-1.jpg?v=42 »
 *      → « images/produit-1.jpg ».
 *  (Le segment « /images/ » est le repère fiable : la base Pages peut varier.) */
export function cheminRelatifImage(url) {
  let s = String(url || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/\\/g, '/');
  const i = s.indexOf('/images/');
  if (i !== -1) {
    s = s.slice(i + 1);
  } else {
    s = s.replace(/^https?:\/\/[^/]+\//i, '').replace(/^\/+/, '');
    const j = s.indexOf('images/');
    if (j > 0) s = s.slice(j);
  }
  return s;
}

export function sha256Fichier(cheminAbsolu) {
  return crypto.createHash('sha256').update(fs.readFileSync(cheminAbsolu)).digest('hex');
}

// ── Lecture de contenu.js (état courant) ────────────────────────────────
let cacheContenu = null;

/**
 * Lit le catalogue COURANT depuis contenu.js (CommonJS/UMD : on exécute le
 * fichier dans un contexte isolé et on récupère CONTENU_SITE). Cache invalidé
 * par mtime → un ajout/remplacement est vu immédiatement.
 */
export function lireCatalogue({ siteDir } = {}) {
  const racine = racineSite(siteDir);
  const fichier = path.join(racine, 'contenu.js');
  if (!fs.existsSync(fichier)) {
    throw new MediaStableError(`contenu.js introuvable : ${fichier}`, { code: 'MEDIA_STABLE_CONTENU_ABSENT' });
  }
  const stat = fs.statSync(fichier);
  if (cacheContenu && cacheContenu.fichier === fichier && cacheContenu.mtimeMs === stat.mtimeMs) {
    return cacheContenu.catalogue;
  }

  const code = fs.readFileSync(fichier, 'utf-8').replace(/^\uFEFF/, '');
  const sandbox = { window: {}, module: { exports: {} }, exports: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: fichier, timeout: 5000 });
  const contenu = sandbox.window.CONTENU_SITE || sandbox.module.exports;
  const produits = contenu && contenu.produits;
  if (!Array.isArray(produits)) {
    throw new MediaStableError(`contenu.js ne contient aucun tableau « produits » exploitable.`, { code: 'MEDIA_STABLE_CONTENU_INVALIDE' });
  }

  // Slug déterministe + désambiguïsation des homonymes (suffixe -2, -3…).
  const vus = new Map();
  const catalogue = produits.map((p, i) => {
    const rang = i + 1;
    const nom = String(p.nom || `Tableau #${rang}`);
    const base = slugifier(nom);
    const n = (vus.get(base) || 0) + 1;
    vus.set(base, n);
    const slug = n === 1 ? base : `${base}-${n}`;
    return {
      rang,
      nom,
      slug,
      image: String(p.image || '').split('?')[0],
      videoUrl: p.videoUrl || null
    };
  });

  cacheContenu = { fichier, mtimeMs: stat.mtimeMs, catalogue };
  return catalogue;
}

/** Liste les fichiers stables existants pour un slug (toutes extensions). */
function fichierStableExistant(stablesDir, slug) {
  if (!fs.existsSync(stablesDir)) return null;
  const nom = fs.readdirSync(stablesDir).find(
    (f) => /\.(jpe?g|png|webp)$/i.test(f) && f.replace(/\.[a-z0-9]+$/i, '') === slug
  );
  return nom ? path.join(stablesDir, nom) : null;
}

/**
 * Résout un média stable à partir de l'état COURANT de contenu.js.
 *
 * @param {string} mediaUrl        URL/chemin envoyé par le dashboard (rang ou stable)
 * @param {object} options
 *   - siteDir      : racine (tests/sandbox), défaut = dépôt site-web
 *   - produitNom   : identité fiable de l'œuvre (prime sur le rang)
 *   - creerSiAbsent: crée la copie stable manquante (défaut true)
 * @returns {object} { statut, url, cheminRelatif, cheminAbsolu, slug, rang, nom,
 *                     imageSource, shaSource, shaStable, cree, orphelin }
 * @throws {MediaStableError} MEDIA_STABLE_DESYNC / _ABSENT / _RANG_INCONNU…
 */
export function resoudreMediaStable(mediaUrl, options = {}) {
  const racine = racineSite(options.siteDir);
  const creerSiAbsent = options.creerSiAbsent !== false;
  const catalogue = lireCatalogue({ siteDir: racine });
  const rel = cheminRelatifImage(mediaUrl);
  const stablesDir = path.join(racine, 'images', 'stables');

  if (!rel) {
    throw new MediaStableError('mediaUrl vide : impossible de résoudre un média stable.', {
      code: 'MEDIA_STABLE_URL_VIDE', details: { mediaUrl }
    });
  }

  // ── Cas A : URL DÉJÀ stable (posts historiques / renvois) ──────────────
  if (/^images\/stables\//i.test(rel)) {
    const fichier = path.basename(rel);
    const slug = fichier.replace(/\.[a-z0-9]+$/i, '');
    const abs = path.join(stablesDir, fichier);
    if (!fs.existsSync(abs)) {
      throw new MediaStableError(
        `Média stable introuvable sur disque : images/stables/${fichier} (URL pourtant déjà stable).`,
        { code: 'MEDIA_STABLE_ABSENT', details: { slug, chemin: rel } }
      );
    }
    const oeuvre = catalogue.find((o) => o.slug === slug) || null;
    let shaSource = null;
    let shaStable = sha256Fichier(abs);
    if (oeuvre) {
      const srcAbs = path.join(racine, oeuvre.image);
      if (!fs.existsSync(srcAbs)) {
        throw new MediaStableError(
          `Image source introuvable pour l'œuvre « ${oeuvre.nom} » : ${oeuvre.image}`,
          { code: 'MEDIA_STABLE_SOURCE_ABSENTE', details: { slug, rang: oeuvre.rang, source: oeuvre.image } }
        );
      }
      shaSource = sha256Fichier(srcAbs);
      if (shaSource !== shaStable) {
        throw new MediaStableError(
          `Média stable désynchronisé pour « ${oeuvre.nom} » : ${oeuvre.image} (SHA ${shaSource.slice(0, 12)}…) ≠ images/stables/${fichier} (SHA ${shaStable.slice(0, 12)}…). Envoi bloqué — lancez « node registre/stabiliser_medias.mjs --resync ».`,
          { code: 'MEDIA_STABLE_DESYNC', details: { slug, rang: oeuvre.rang, source: oeuvre.image, shaSource, shaStable } }
        );
      }
    }
    return {
      statut: 'deja-stable', url: mediaUrl, cheminRelatif: rel, cheminAbsolu: abs,
      slug, rang: oeuvre ? oeuvre.rang : null, nom: oeuvre ? oeuvre.nom : null,
      imageSource: oeuvre ? oeuvre.image : null, shaSource, shaStable,
      cree: false, orphelin: !oeuvre
    };
  }

  // ── Cas B : URL de RANG → œuvre COURANTE (jamais la carte statique) ────
  const m = rel.match(/^images\/produit-(\d+)\.(jpe?g|png|webp)$/i);
  if (!m) {
    // Média non concerné (URL externe, image de section…) : laissé tel quel.
    return {
      statut: 'non-concerne', url: mediaUrl, cheminRelatif: rel, cheminAbsolu: null,
      slug: null, rang: null, nom: null, imageSource: null,
      shaSource: null, shaStable: null, cree: false, orphelin: false
    };
  }
  const rangUrl = Number(m[1]);

  // Identité : le NOM fourni prime (dashboard resté ouvert pendant une
  // insertion en tête) ; sinon le rang de l'URL désigne l'œuvre courante.
  const nomFourni = String(options.produitNom || '').trim().toLowerCase();
  const parNom = nomFourni ? catalogue.find((o) => o.nom.toLowerCase() === nomFourni) : null;
  const oeuvre = parNom || catalogue.find((o) => o.rang === rangUrl) || null;
  if (!oeuvre) {
    throw new MediaStableError(
      `Rang produit-${rangUrl} absent du catalogue courant (${catalogue.length} œuvres) — envoi bloqué.`,
      { code: 'MEDIA_STABLE_RANG_INCONNU', details: { rang: rangUrl, total: catalogue.length } }
    );
  }

  // Source de vérité = image de l'œuvre dans contenu.js (pas un chemin deviné).
  const imageSource = cheminRelatifImage(oeuvre.image);
  const srcAbs = path.join(racine, imageSource);
  if (!fs.existsSync(srcAbs)) {
    throw new MediaStableError(
      `Image source de l'œuvre « ${oeuvre.nom} » introuvable : ${imageSource}`,
      { code: 'MEDIA_STABLE_SOURCE_ABSENTE', details: { slug: oeuvre.slug, rang: oeuvre.rang, source: imageSource } }
    );
  }

  const ext = path.extname(imageSource).toLowerCase() || '.jpg';
  const stableRel = `images/stables/${oeuvre.slug}${ext}`;
  let stableAbs = path.join(racine, stableRel);
  const existant = fichierStableExistant(stablesDir, oeuvre.slug);
  if (existant) stableAbs = existant;

  const shaSource = sha256Fichier(srcAbs);
  let cree = false;
  if (!fs.existsSync(stableAbs)) {
    if (!creerSiAbsent) {
      throw new MediaStableError(
        `Média stable absent pour « ${oeuvre.nom} » : ${stableRel}`,
        { code: 'MEDIA_STABLE_ABSENT', details: { slug: oeuvre.slug, rang: oeuvre.rang, chemin: stableRel } }
      );
    }
    try {
      fs.mkdirSync(path.dirname(stableAbs), { recursive: true });
      fs.copyFileSync(srcAbs, stableAbs);
    } catch (e) {
      throw new MediaStableError(
        `Création du média stable impossible pour « ${oeuvre.nom} » (${stableRel}) : ${e.message}`,
        { code: 'MEDIA_STABLE_COPIE_ECHEC', details: { slug: oeuvre.slug, rang: oeuvre.rang } }
      );
    }
    cree = true;
  }

  const shaStable = sha256Fichier(stableAbs);
  if (shaSource !== shaStable) {
    throw new MediaStableError(
      `Média stable désynchronisé pour « ${oeuvre.nom} » : ${imageSource} (SHA ${shaSource.slice(0, 12)}…) ≠ ${cheminRelatifImage(stableAbs.replace(racine, ''))} (SHA ${shaStable.slice(0, 12)}…). Envoi bloqué — lancez « node registre/stabiliser_medias.mjs --resync ».`,
      { code: 'MEDIA_STABLE_DESYNC', details: { slug: oeuvre.slug, rang: oeuvre.rang, source: imageSource, shaSource, shaStable } }
    );
  }

  return {
    statut: 'rang', url: mediaUrl,
    cheminRelatif: cheminRelatifImage(stableAbs.replace(racine, '')),
    cheminAbsolu: stableAbs,
    slug: oeuvre.slug, rang: oeuvre.rang, nom: oeuvre.nom,
    imageSource, shaSource, shaStable, cree, orphelin: false,
    rangUrl
  };
}

/**
 * Reconstruit INTÉGRALEMENT stable-map.json depuis contenu.js :
 *   - clés par rang courant (produit-N) ET par slug (stable:<slug>) ;
 *   - copies manquantes créées, copies périmées actualisées (SHA comparé) ;
 *   - slugs orphelins (fichier stable sans œuvre) + clés obsolètes listés.
 * Ne touche NI contenu.js NI les journaux.
 */
export function resynchroniserStables({ siteDir, dryRun = false } = {}) {
  const racine = racineSite(siteDir);
  const catalogue = lireCatalogue({ siteDir: racine });
  const stablesDir = path.join(racine, 'images', 'stables');
  const mappingFile = path.join(racine, '..', 'registre', 'stable-map.json');
  if (!dryRun) fs.mkdirSync(stablesDir, { recursive: true });

  const ancien = (() => {
    try { return JSON.parse(fs.readFileSync(mappingFile, 'utf-8')); } catch { return {}; }
  })();

  const mapping = {};
  const details = [];
  const slugs = new Set();
  let crees = 0;
  let actualises = 0;
  let inchanges = 0;
  const erreurs = [];

  for (const oeuvre of catalogue) {
    slugs.add(oeuvre.slug);
    const imageSource = cheminRelatifImage(oeuvre.image);
    const srcAbs = path.join(racine, imageSource);
    if (!imageSource || !fs.existsSync(srcAbs)) {
      erreurs.push({ rang: oeuvre.rang, nom: oeuvre.nom, error: `image source absente : ${oeuvre.image || '(vide)'}` });
      continue;
    }
    const ext = path.extname(imageSource).toLowerCase() || '.jpg';
    let stableRel = `images/stables/${oeuvre.slug}${ext}`;
    let stableAbs = path.join(racine, stableRel);
    const existant = fichierStableExistant(stablesDir, oeuvre.slug);
    if (existant) {
      stableAbs = existant;
      stableRel = `images/stables/${path.basename(existant)}`;
    }

    const shaSource = sha256Fichier(srcAbs);
    let action = 'inchange';
    if (!fs.existsSync(stableAbs)) {
      if (!dryRun) fs.copyFileSync(srcAbs, stableAbs);
      action = 'cree';
      crees++;
    } else {
      const shaStable = sha256Fichier(stableAbs);
      if (shaStable !== shaSource) {
        if (!dryRun) fs.copyFileSync(srcAbs, stableAbs);
        action = 'actualise';
        actualises++;
      } else {
        inchanges++;
      }
    }

    // SHA vérifié APRÈS copie (une copie partielle ne doit jamais passer).
    if (!dryRun && action !== 'inchange') {
      const shaApres = sha256Fichier(stableAbs);
      if (shaApres !== shaSource) {
        erreurs.push({ rang: oeuvre.rang, nom: oeuvre.nom, error: `SHA différent après copie (${stableRel})` });
        continue;
      }
    }

    mapping[`produit-${oeuvre.rang}`] = stableRel;
    mapping[`stable:${oeuvre.slug}`] = stableRel;
    details.push({ rang: oeuvre.rang, nom: oeuvre.nom, slug: oeuvre.slug, stableRel, action, shaSource });
  }

  // Orphelins : fichiers stables dont le slug n'appartient à aucune œuvre.
  const fichiers = fs.existsSync(stablesDir) ? fs.readdirSync(stablesDir) : [];
  const orphelins = fichiers
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && !slugs.has(f.replace(/\.[a-z0-9]+$/i, '')))
    .map((f) => `images/stables/${f}`);

  // Clés obsolètes : présentes dans l'ancienne carte mais PLUS dans la nouvelle
  // (rang supprimé, slug disparu). Les rangs dont la cible a changé (insertion
  // en tête = décalage attendu) sont comptés à part : « rangsDecales ».
  const clesObsoletes = Object.keys(ancien).filter((k) => {
    if (/^produit-\d+$/.test(k)) return !mapping[k];
    if (k.startsWith('stable:')) return !slugs.has(k.slice('stable:'.length));
    return !mapping[k];
  });
  const rangsDecales = Object.keys(ancien)
    .filter((k) => /^produit-\d+$/.test(k) && mapping[k] && ancien[k] !== mapping[k])
    .map((k) => ({ cle: k, avant: ancien[k], apres: mapping[k] }));

  let mappingEcrit = false;
  if (!dryRun) {
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8');
    mappingEcrit = true;
  }

  return {
    racine, dryRun, catalogue: catalogue.length,
    crees, actualises, inchanges, erreurs,
    orphelins, clesObsoletes, rangsDecales,
    mappingEcrit, mappingFile, details, mapping
  };
}

/** Résumé compact (réponses HTTP / journaux) — sans la carte ni les détails. */
export function resumeResync(resultat) {
  return {
    catalogue: resultat.catalogue,
    crees: resultat.crees,
    actualises: resultat.actualises,
    inchanges: resultat.inchanges,
    orphelins: resultat.orphelins,
    clesObsoletes: resultat.clesObsoletes,
    rangsDecales: resultat.rangsDecales,
    erreurs: resultat.erreurs,
    mappingEcrit: resultat.mappingEcrit
  };
}
