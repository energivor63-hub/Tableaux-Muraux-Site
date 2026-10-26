/**
 * journal-social.js — JOURNAL SOCIAL : forme unique, dédoublonnage, archivage
 * ═════════════════════════════════════════════════════════════════════════
 * MICRO-11v2-quater (26/10/2026)
 *
 * CONSTAT : le garde-fou SHIFT affichait 42 entrées = 21 événements ×2
 * (une entrée dans journal_integrations.json + une dans social-journal.json,
 * horodatages local + UTC non dédoublonnés), tous PASSÉS. Le journal actif
 * devenait illisible (447 entrées) et ne permettait plus de distinguer un
 * post futur d'un événement archivé.
 *
 * RÈGLES :
 *   - tout horodatage est écrit en ISO UTC (une seule forme) ;
 *   - clé d'unicité : (platform, isoUTC, produitId) — le statut est ajouté
 *     à la clé UNIQUEMENT lorsque deux statuts diffèrent, pour ne jamais
 *     masquer un échec derrière un succès ;
 *   - source : 'dashboard' (créé par la tour de contrôle) ou
 *     'manuel-buffer' (programmé à la main sur Buffer Web — jamais re-médié) ;
 *   - archivage : statut published/failed/error OU entrée de plus de 7 jours
 *     → registre/journal_archive/journal-YYYY-MM.json ;
 *   - le journal ACTIF reste court ; l'historique complet est reconstitué à
 *     la lecture (actif + archives) pour l'affichage.
 *
 * Le journal n'est PLUS la source du garde-fou SHIFT (voir shift-guard.js) :
 * il sert uniquement à identifier la SOURCE d'un post Buffer et à archiver.
 * ═════════════════════════════════════════════════════════════════════════
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..');

/** Journal actif : surchargeable par les tests (SOCIAL_JOURNAL_PATH). */
export function cheminJournalActif() {
  return process.env.SOCIAL_JOURNAL_PATH
    || path.join(ROOT_DIR, 'dashboard', 'journaux', 'social-journal.json');
}

/** Dossier d'archive : jamais le dépôt réel quand le journal est sandboxé. */
export function dossierArchive() {
  if (process.env.JOURNAL_ARCHIVE_DIR) return process.env.JOURNAL_ARCHIVE_DIR;
  if (process.env.SOCIAL_JOURNAL_PATH) {
    return path.join(path.dirname(process.env.SOCIAL_JOURNAL_PATH), 'journal_archive');
  }
  return path.join(ROOT_DIR, 'registre', 'journal_archive');
}

/** ISO UTC ou null (jamais de date locale dans le journal). */
export function normaliserIso(valeur) {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  if (valeur instanceof Date) {
    return Number.isNaN(valeur.getTime()) ? null : valeur.toISOString();
  }
  const t = Date.parse(String(valeur));
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function plateformeEntree(entree) {
  const p = String((entree && (entree.platform || entree.reseau)) || '').trim().toLowerCase();
  return p || 'inconnu';
}

export function produitIdEntree(entree) {
  if (!entree) return null;
  if (entree.produitId) return String(entree.produitId);
  if (entree.produit) return String(entree.produit);
  const m = String(entree.mediaUrl || '').match(/produit-(\d+)\.(?:jpe?g|png|webp)/i);
  return m ? `produit-${Number(m[1])}` : null;
}

/** Instant canonique de l'événement : dueAt > scheduleDate > isoDate > date. */
export function isoEntree(entree) {
  if (!entree) return null;
  return normaliserIso(entree.isoUTC)
    || normaliserIso(entree.dueAt)
    || normaliserIso(entree.scheduleDate)
    || normaliserIso(entree.isoDate)
    || normaliserIso(entree.date);
}

/** Normalise UNE entrée : forme ISO unique + source + produit + postId. */
export function normaliserEntree(entree) {
  const e = { ...(entree || {}) };
  const isoDate = normaliserIso(e.isoDate || e.date);
  const isoUTC = isoEntree(e);
  return {
    ...e,
    isoUTC: isoUTC || null,
    // « date » garde sa VALEUR (création) mais sa FORME devient ISO UTC.
    date: isoDate || e.date || null,
    isoDate: isoDate || e.isoDate || null,
    source: e.source === 'manuel-buffer' ? 'manuel-buffer' : 'dashboard',
    produitId: produitIdEntree(e) || null,
    postId: e.postId || null
  };
}

/** Clé d'unicité demandée : (platform, isoUTC, produitId). */
export function cleEntree(entree) {
  const e = normaliserEntree(entree);
  return [plateformeEntree(e), isoEntree(e) || 'sans-date', produitIdEntree(e) || 'sans-produit'].join('|');
}

function fusionnerEntrees(a, b) {
  const garde = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    if (v === undefined || v === null || v === '') continue;
    if (garde[k] === undefined || garde[k] === null || garde[k] === '') garde[k] = v;
  }
  garde.postId = a.postId || b.postId || null;
  garde.source = (a.source === 'dashboard' || b.source === 'dashboard') ? 'dashboard' : (a.source || b.source);
  garde.mediaUrlStable = a.mediaUrlStable || b.mediaUrlStable || null;
  const ids = [...new Set([
    ...(a.idsFusionnes || (a.id ? [a.id] : [])),
    ...(b.idsFusionnes || (b.id ? [b.id] : [])),
    a.id, b.id
  ].filter(Boolean))];
  if (ids.length > 1) {
    garde.idsFusionnes = ids;
    garde.dedoublonne = true;
  }
  return garde;
}

/**
 * Dédoublonne un tableau d'entrées (ordre conservé, plus récentes d'abord).
 * Deux statuts différents ne sont JAMAIS fusionnés (un échec ne disparaît pas
 * derrière un succès) : l'entrée garde la clé de base avec un suffixe statut.
 */
export function dedoublonnerEntrees(entrees) {
  const parCle = new Map();
  const ordre = [];
  let fusionnees = 0;
  for (const brute of entrees || []) {
    const e = normaliserEntree(brute);
    const base = cleEntree(e);
    const statut = String(e.status || e.statut || '').toLowerCase();
    if (!parCle.has(base)) {
      parCle.set(base, e);
      ordre.push(base);
      continue;
    }
    const existant = parCle.get(base);
    const stExistant = String(existant.status || existant.statut || '').toLowerCase();
    if (stExistant && statut && stExistant !== statut) {
      const cle = `${base}|${statut}`;
      if (!parCle.has(cle)) { parCle.set(cle, e); ordre.push(cle); }
      else {
        parCle.set(cle, fusionnerEntrees(parCle.get(cle), e));
        fusionnees++;
      }
      continue;
    }
    parCle.set(base, fusionnerEntrees(existant, e));
    fusionnees++;
  }
  return { entrees: ordre.map((k) => parCle.get(k)), fusionnees };
}

const SEPT_JOURS_MS = 7 * 24 * 60 * 60 * 1000;

/** Publié/échoué OU plus de 7 jours → archive. */
export function estArchivable(entree, now = new Date()) {
  const e = normaliserEntree(entree);
  const statut = String(e.status || e.statut || '').toLowerCase();
  if (['published', 'failed', 'error', 'succes', 'echec', 'refus'].includes(statut)) return true;
  const iso = isoEntree(e);
  if (!iso) return false;
  return (now.getTime() - Date.parse(iso)) > SEPT_JOURS_MS;
}

function moisEntree(entree, now = new Date()) {
  const iso = isoEntree(entree);
  return iso ? iso.slice(0, 7) : now.toISOString().slice(0, 7);
}

function lireTableau(chemin) {
  try {
    const arr = JSON.parse(fs.readFileSync(chemin, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function ecrireTableau(chemin, entrees) {
  fs.mkdirSync(path.dirname(chemin), { recursive: true });
  fs.writeFileSync(chemin, JSON.stringify(entrees, null, 2), 'utf-8');
}

function trierRecentes(entrees) {
  return [...entrees].sort((a, b) => {
    const ta = Date.parse(isoEntree(a) || a.date) || 0;
    const tb = Date.parse(isoEntree(b) || b.date) || 0;
    return tb - ta;
  });
}

export function lireJournalActif() {
  return lireTableau(cheminJournalActif());
}

export function lireArchives() {
  const dir = dossierArchive();
  if (!fs.existsSync(dir)) return [];
  const entrees = [];
  for (const f of fs.readdirSync(dir).filter((x) => /^journal-\d{4}-\d{2}\.json$/.test(x))) {
    entrees.push(...lireTableau(path.join(dir, f)));
  }
  return entrees;
}

/** Historique complet (actif + archives), dédoublonné et trié. */
export function lireJournalComplet() {
  const { entrees } = dedoublonnerEntrees([...lireJournalActif(), ...lireArchives()]);
  return trierRecentes(entrees);
}

/**
 * Écrit un ensemble d'entrées : dédoublonne, sépare actives/archivables,
 * fusionne les archivables dans les fichiers mensuels et réécrit l'actif.
 * Idempotent.
 */
export function enregistrerEntreesJournal(entrees, { journalPath, archiveDir, now = new Date() } = {}) {
  const chemin = journalPath || cheminJournalActif();
  const dir = archiveDir || dossierArchive();
  const avant = (entrees || []).length;
  const { entrees: uniques, fusionnees } = dedoublonnerEntrees(entrees || []);

  const actives = [];
  const archivees = [];
  for (const e of uniques) (estArchivable(e, now) ? archivees : actives).push(e);

  const parMois = new Map();
  for (const e of archivees) {
    const mois = moisEntree(e, now);
    if (!parMois.has(mois)) parMois.set(mois, []);
    parMois.get(mois).push(e);
  }
  const fichiers = [];
  for (const [mois, nouvelles] of parMois) {
    const fichier = path.join(dir, `journal-${mois}.json`);
    const existantes = lireTableau(fichier);
    const { entrees: fusion } = dedoublonnerEntrees([...nouvelles, ...existantes]);
    ecrireTableau(fichier, trierRecentes(fusion));
    fichiers.push(fichier);
  }

  ecrireTableau(chemin, trierRecentes(actives));
  return {
    avant,
    uniques: uniques.length,
    fusionnees,
    actives: actives.length,
    archivees: archivees.length,
    fichiers
  };
}

/** Ajoute UNE entrée (normalisée) au journal, avec dédoublonnage + archivage. */
export function ajouterEntreeJournal(entree, options = {}) {
  const chemin = options.journalPath || cheminJournalActif();
  const existantes = lireTableau(chemin);
  const stats = enregistrerEntreesJournal([normaliserEntree(entree), ...existantes], {
    ...options, journalPath: chemin
  });
  return { entree: normaliserEntree(entree), ...stats };
}

/**
 * Migration initiale : dédoublonne et archive le journal existant.
 * Retourne le détail (avant, fusionnées, actives, archivées, fichiers).
 */
export function migrerJournal(options = {}) {
  return enregistrerEntreesJournal(lireTableau(options.journalPath || cheminJournalActif()), options);
}

/** Marque un post re-médié : mediaUrlStable + traçabilité (actif + archives). */
export function marquerJournalRemedie(postId, stableUrl, { journalPath, archiveDir, candidat, now = new Date() } = {}) {
  const chemin = journalPath || cheminJournalActif();
  const dir = archiveDir || dossierArchive();
  let touches = 0;

  const marquer = (brute) => {
    const e = normaliserEntree(brute);
    const matchPost = postId && e.postId && String(e.postId) === String(postId);
    const matchSlot = !matchPost && !e.postId && candidat
      && plateformeEntree(e) === String(candidat.reseau || '').toLowerCase()
      && isoEntree(e) === normaliserIso(candidat.dueAt)
      && produitIdEntree(e) === (candidat.produitId || null);
    if (!matchPost && !matchSlot) return e;
    touches++;
    return {
      ...e,
      mediaUrlStable: stableUrl,
      remediation: { at: (now instanceof Date ? now : new Date()).toISOString(), url: stableUrl, via: 'editPost' }
    };
  };

  enregistrerEntreesJournal(lireTableau(chemin).map(marquer), { journalPath: chemin, archiveDir: dir, now });

  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => /^journal-\d{4}-\d{2}\.json$/.test(x))) {
      const fichier = path.join(dir, f);
      const marquees = lireTableau(fichier).map(marquer);
      const { entrees } = dedoublonnerEntrees(marquees);
      ecrireTableau(fichier, trierRecentes(entrees));
    }
  }

  return { touches, mediaUrlStable: stableUrl };
}
