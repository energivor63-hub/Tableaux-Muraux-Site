/**
 * video-watch.js — WATCHDOG DES VIDÉOS PROGRAMMÉES (MICRO-13)
 * ═════════════════════════════════════════════════════════════════════════
 * Logique PURE (dépendances injectées) : le serveur branche le journal réel,
 * le vérificateur HEAD, l'hébergeur et editPost ; les tests branchent des
 * faux sans réseau.
 *
 *  1. Sélection : journal social, source dashboard (jamais manuel-buffer),
 *     mediaType === 'video', postId présent, dueAt FUTUR.
 *  2. HEAD de l'URL publique envoyée à Buffer.
 *  3. URL morte → re-téléversement depuis ../videos (la carte video-map
 *     réutilise l'entrée si le SHA est identique), puis editPost(id, assets
 *     video) : dueAt, texte et planification restent inchangés.
 *  4. Journal marqué « remediation » (via editPost).
 * ═════════════════════════════════════════════════════════════════════════
 */

export const MOTIF_FICHIER_VIDEO = /^produit-\d+(?:-reel)?\.mp4$/i;

/** Instant d'un post vidéo : dueAt > isoUTC > scheduleDate > date. */
function instantPost(entree) {
  const iso = entree && (entree.dueAt || entree.isoUTC || entree.scheduleDate || entree.date);
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Sélectionne les vidéos futures à surveiller.
 * Les entrées `manuel-buffer` sont TOUJOURS ignorées (jamais re-médiées).
 */
export function selectionnerVideosFutures(journal = [], now = Date.now()) {
  const tNow = now instanceof Date ? now.getTime() : Number(now);
  return (journal || []).filter((e) => {
    if (!e || e.mediaType !== 'video') return false;
    if (e.source === 'manuel-buffer') return false;
    if (!e.postId) return false;
    const t = instantPost(e);
    return t !== null && t > tNow;
  });
}

/** Nom de fichier local : videoFichier valide, sinon produit-N.mp4. */
export function fichierVideoPour(entree) {
  const fichier = String((entree && entree.videoFichier) || '').trim();
  if (MOTIF_FICHIER_VIDEO.test(fichier)) return fichier;
  const produitId = String((entree && entree.produitId) || '').trim();
  const candidat = produitId ? `${produitId}.mp4` : '';
  return MOTIF_FICHIER_VIDEO.test(candidat) ? candidat : null;
}

/**
 * Exécute le watchdog.
 * @param {object} deps
 * @param {Array}  deps.journal       journal social complet
 * @param {Function} deps.verifierUrl (url) => { ok, cause?, contentLength? }
 * @param {Function} deps.upload      ({ cheminFichier, slug }) => { urlPublique, sha256, octets, fournisseur, reutilise }
 * @param {Function} deps.editPost    ({ postId, videoUrl, thumbnailUrl, titreVideo }) => { postId, status, dueAt }
 * @param {Function} deps.marquer     (postId, url, opts) => { touches }
 * @param {Function} deps.journaliser (entree) => void
 * @param {Function} deps.cheminVideoLocale (fichier) => chemin|null
 * @param {Function} deps.slugVideoDepuisFichier (fichier) => slug|null
 * @param {boolean} deps.dryRun
 */
export async function executerVideoWatch({
  journal = [],
  verifierUrl,
  upload,
  editPost,
  marquer = () => ({ touches: 0 }),
  journaliser = () => {},
  cheminVideoLocale = () => null,
  slugVideoDepuisFichier = (f) => String(f || '').replace(/\.mp4$/i, '') || null,
  dryRun = false,
  now = Date.now()
} = {}) {
  const candidats = selectionnerVideosFutures(journal, now);
  const resultats = [];

  // MICRO-13.3 v2.1 — DÉDOUBLONNAGE PAR PASSAGE : plusieurs posts partagent
  // la même URL vidéo (3 réseaux pour un MP4) → un seul contrôle par URL.
  const etatsPassage = new Map(); // url -> { ok, cause, ... }
  let appelsVerification = 0;

  for (const entree of candidats) {
    const postId = String(entree.postId);
    const urlPublique = String(entree.mediaUrlPublique || entree.videoUrl || '').trim();
    const produitId = String(entree.produitId || '').trim();
    const nomFichier = fichierVideoPour(entree);

    let etatUrl = null;
    if (urlPublique) {
      if (etatsPassage.has(urlPublique)) {
        etatUrl = etatsPassage.get(urlPublique);
      } else {
        appelsVerification++;
        try {
          etatUrl = await verifierUrl(urlPublique);
        } catch (e) {
          etatUrl = { ok: false, cause: e.message, code: 'VIDEO_URL_MORTE' };
        }
        etatsPassage.set(urlPublique, etatUrl);
      }
    }
    // État INCONNU (cache vide, badge sans HEAD) : jamais de re-médiation —
    // une absence de contrôle n'est pas une URL morte.
    if (etatUrl && etatUrl.ok === null) {
      resultats.push({
        postId, produitId, urlPublique, statut: 'inconnue',
        code: etatUrl.code || 'MEDIA_CHECK_NON_VERIFIEE',
        cause: etatUrl.cause || 'aucun contrôle récent (cache)',
        dueAt: entree.dueAt || entree.isoUTC || null
      });
      continue;
    }
    const urlVivante = !!(etatUrl && etatUrl.ok);

    if (urlVivante) {
      resultats.push({
        postId, produitId, urlPublique, statut: 'vivante',
        dueAt: entree.dueAt || entree.isoUTC || null,
        contentLength: etatUrl.contentLength || null,
        contentType: etatUrl.contentType || null
      });
      continue;
    }

    const chemin = nomFichier ? cheminVideoLocale(nomFichier) : null;
    if (!chemin) {
      resultats.push({
        postId, produitId, urlPublique, statut: 'echec',
        code: 'VIDEO_LOCALE_ABSENTE',
        error: `URL morte et MP4 local introuvable (${nomFichier || 'fichier inconnu'}) — re-médiation impossible, action manuelle requise.`
      });
      continue;
    }

    if (dryRun) {
      resultats.push({
        postId, produitId, urlPublique, statut: 'a_remesier', fichier: nomFichier,
        cause: (etatUrl && (etatUrl.cause || etatUrl.erreur)) || 'URL absente'
      });
      continue;
    }

    try {
      const slug = slugVideoDepuisFichier(nomFichier);
      const nouvelle = await upload({ cheminFichier: chemin, slug });
      const edition = await editPost({
        postId,
        videoUrl: nouvelle.urlPublique,
        thumbnailUrl: entree.thumbnailUrl || '',
        titreVideo: entree.titreVideo || ''
      });
      const marque = marquer(postId, nouvelle.urlPublique, {
        candidat: {
          reseau: entree.platform,
          dueAt: entree.dueAt || entree.isoUTC,
          produitId: entree.produitId
        }
      });
      journaliser({
        type: 'video-watch', integrateur: 'buffer', reseau: entree.platform,
        produit: produitId || 'inconnu', produitNom: entree.produitNom || null,
        statut: 'succes', httpStatus: 200,
        message: `Vidéo re-médiée via editPost — post ${postId} (nouvelle URL ${nouvelle.urlPublique})`,
        cause: null,
        mediaUrl: entree.mediaUrl || null,
        videoUrl: nouvelle.urlPublique,
        mediaUrlPublique: nouvelle.urlPublique,
        videoFichier: nomFichier,
        videoSha256: nouvelle.sha256,
        mediaType: 'video',
        mode: 'editPost',
        remediation: true,
        journalTouches: marque.touches
      });
      resultats.push({
        postId, produitId, statut: 'remesie',
        ancienneUrl: urlPublique || null,
        urlPublique: nouvelle.urlPublique,
        sha256: nouvelle.sha256,
        octets: nouvelle.octets,
        fournisseur: nouvelle.fournisseur,
        reutilise: nouvelle.reutilise === true,
        editPost: { status: edition.status, dueAt: edition.dueAt },
        journalTouches: marque.touches
      });
    } catch (err) {
      resultats.push({
        postId, produitId, urlPublique: urlPublique || null, statut: 'echec',
        code: (err && err.code) || 'VIDEO_REMEDIATION_ECHEC',
        error: err.message || 'Re-médiation vidéo impossible'
      });
    }
  }

  return {
    success: true,
    date: new Date().toISOString(),
    dryRun,
    total: candidats.length,
    // Compteurs anti-throttle : URLs distinctes vs contrôles réellement émis.
    urlsDistinctes: etatsPassage.size,
    appelsVerification,
    vivantes: resultats.filter((r) => r.statut === 'vivante').length,
    inconnues: resultats.filter((r) => r.statut === 'inconnue').length,
    remesiees: resultats.filter((r) => r.statut === 'remesie').length,
    aRemesier: resultats.filter((r) => r.statut === 'a_remesier').length,
    echecs: resultats.filter((r) => r.statut === 'echec').length,
    resultats
  };
}
