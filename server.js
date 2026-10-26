import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import {
  ROOT_DIR,
  SITE_DIR,
  IMAGES_DIR,
  TOUR_HTML_FILE,
  FICHE_TXT,
  JOURNAL_TXT,
  ROOT_ENV_FILE,
  PYTHON_SCRIPT,
  hasApiKeyConfigured,
  detectPendingMockup,
  detectDroppedMode,
  readPendingMeta,
  writePendingMeta,
  clearPendingMeta,
  getCurrentCatalog,
  executeAutoIntegration,
  detectReplacementStaging,
  getReplacementState,
  clearReplacementStaging,
  prepareReplacement,
  regenerateFiche,
  executeReplacement,
  getJournalHistory,
  listBackups,
  restoreBackup,
  rewriteProductAtRank,
  commitAndPushSite,
  definirVideoUrlFiche
} from './control-tower-engine.js';
// SESSION 2026-09-17 : publication unifiée Buffer GraphQL (facebook + instagram + pinterest)
import { publierViaBufferGraphql, appliquerLimitePinterest500, lireCanaux, requeteGraphQL, sonderEditionPost, remesierPostMedia } from './buffer-graphql.js';
// 🖼️ MICRO-11v2-ter — médias stables : résolution DYNAMIQUE à l'envoi +
// resynchronisation (hooks ajout/remplacement/édition). Jamais de carte périmée.
import { resynchroniserStables, resumeResync } from './medias-stables.js';
// 🗂️ MICRO-11v2-quater — journal social : ISO UTC unique, dédoublonnage,
// archivage mensuel (le journal actif reste court ; l'historique est reconstitué).
import {
  normaliserEntree,
  produitIdEntree,
  ajouterEntreeJournal,
  enregistrerEntreesJournal,
  lireJournalActif,
  lireJournalComplet,
  migrerJournal,
  marquerJournalRemedie
} from './journal-social.js';
// 🛡️ MICRO-11v2-quater — garde-fou SHIFT : référentiel = inventaire Buffer réel,
// filtre futur/rang/source dashboard + suggestion stable lue à l'affichage.
import {
  construireSujets,
  indexerJournal,
  sourcePourPost,
  listeManuelle,
  EXPLICATION_FILTRE
} from './shift-guard.js';
// 🛡️ Phase B — variantes par réseau + hash anti-doublon (légendes distinctes IG/FB/PIN)
// 🎯 Session 2026-09-18 — qualité rédactionnelle : hashtags Instagram
// dédoublonnés (Set ordonné, plafond 11) + CTA « lien en bio », adjectifs
// qualifiants uniques par variante, locution du titre SEO non répétée en tête
// de description Pinterest (voir social-variants.js).
import {
  genererVariantes, titrePinterest, hashContenu,
  assemblerLegendeInstagram, normaliserTexteReseau,
  legendeEditeurInstagram,
  plafonnerLegendeInstagram, plafonnerTexteFacebook,
  plafonnerTitrePinterest, plafonnerAlt, plafonnerHashtags
} from './social-variants.js';
// 💰 Synchro prix (ajout v2) — import ADDITIF : aucune fonction existante retouchée.
import { spawnNode, masquerSecrets, masquerReponseBrute } from './control-tower-engine.js';
import crypto from 'crypto';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000; // ajout : PORT surchargeable (instances de test)

// CORS — P1 audit 24/09 (C1) : allowlist loopback explicite (usage 100 % local).
// Le dashboard est servi same-origin par ce serveur ; file:// et sites tiers
// ne reçoivent plus Access-Control-Allow-Origin (le dashboard affiche alors le
// bandeau N3 « Serveur injoignable », jamais de panne silencieuse).
app.use((req, res, next) => {
  const origin = String(req.headers.origin || '');
  const autorise = !origin
    || origin === `http://localhost:${PORT}`
    || origin === `http://127.0.0.1:${PORT}`;
  if (autorise) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(autorise ? 200 : 403);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Hook MICRO-11v2-ter : resynchronise stable-map.json + les copies
 * images/stables/* depuis contenu.js COURANT, juste APRÈS toute opération qui
 * change le catalogue (ajout en tête, remplacement, édition de nom).
 * Objectif : aucun envoi Buffer ne peut plus utiliser une carte périmée —
 * même si l'opérateur enchaîne « ajout → envoi » sans étape manuelle.
 * Ne touche ni contenu.js ni les journaux ; n'échoue jamais l'opération
 * métier (retourne { erreur } et laisse le garde-fou SHA bloquer l'envoi).
 */
function resyncMediasStablesApres(changement) {
  try {
    const resume = resumeResync(resynchroniserStables());
    if (resume.crees || resume.actualises || resume.erreurs.length) {
      console.log(
        `[medias-stables] resync (${changement}) : ${resume.crees} créé(s), ` +
        `${resume.actualises} actualisé(s), ${resume.inchanges} inchangé(s), ` +
        `${resume.orphelins.length} orphelin(s), ${resume.erreurs.length} erreur(s).`
      );
    }
    if (resume.crees || resume.actualises) {
      resume.message = `Médias stables resynchronisés (${resume.crees} créé(s), ${resume.actualises} actualisé(s)) — commit + push site-web requis avant tout envoi Buffer pour que les URLs soient servies par GitHub Pages.`;
    }
    return resume;
  } catch (e) {
    console.error(`[medias-stables] resync (${changement}) ÉCHEC :`, e.message);
    return { erreur: e.message };
  }
}

// Configuration Multer pour enregistrer la maquette sous images/produit-0.ext
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(IMAGES_DIR)) {
      fs.mkdirSync(IMAGES_DIR, { recursive: true });
    }
    cb(null, IMAGES_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `produit-0${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Multer dédié au remplacement : fichier temporaire à nom unique — ne touche JAMAIS produit-0.*
const uploadStaging = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
      cb(null, IMAGES_DIR);
    },
    filename: (req, file, cb) => cb(null, '_tmp_replace_' + Date.now() + (path.extname(file.originalname).toLowerCase() || '.jpg'))
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Endpoint de contrôle de santé
app.get('/api/health', (req, res) => {
  res.type('application/json').json({
    status: 'ok',
    rootDir: ROOT_DIR,
    siteDir: SITE_DIR,
    imagesDir: IMAGES_DIR,
    tourHtmlFile: TOUR_HTML_FILE,
    hasApiKey: hasApiKeyConfigured(),
    time: new Date().toISOString()
  });
});

// ==========================================
// 🗼 ROUTES API TOUR DE CONTRÔLE
// ==========================================

// 1. Statut en temps réel
app.get('/api/control-tower/status', (req, res) => {
  try {
    const pending = detectPendingMockup();
    const catalog = getCurrentCatalog();
    const journal = getJournalHistory();
    const backups = listBackups();
    const hasKey = hasApiKeyConfigured();
    const pendingMeta = readPendingMeta();
    const replacementState = getReplacementState();

    res.type('application/json').json({
      success: true,
      rootDir: ROOT_DIR,
      siteDir: SITE_DIR,
      imagesDir: IMAGES_DIR,
      tourHtmlFile: TOUR_HTML_FILE,
      hasApiKey: hasKey,
      hasPendingMockup: pending.exists,
      pendingMockup: pending,
      pendingMode: pendingMeta ? pendingMeta.mode : null,
      pendingOriginalName: pendingMeta ? (pendingMeta.originalName || null) : null,
      pendingProductRank: pendingMeta && pendingMeta.productRank ? Number(pendingMeta.productRank) : null,
      replacementState,
      totalCatalogProducts: catalog.length,
      currentTopProduct: catalog.length > 0 ? catalog[0] : null,
      lastIntegration: journal.length > 0 ? journal[0] : null,
      totalBackups: backups.length
    });
  } catch (err) {
    console.error('Erreur API statut:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 2. Upload de maquette (Multipart) — zone GAUCHE (insertion produit-0)
app.post('/api/control-tower/upload-mockup', upload.single('mockup'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).type('application/json').json({ success: false, error: 'Aucun fichier image reçu.' });
    }
    // Détection du mode (insert / replace / notfound) + méta-données pour la Tour
    const catalog = getCurrentCatalog();
    const originalName = req.file.originalname || req.file.filename || 'produit-0.jpg';
    const detected = detectDroppedMode(originalName, catalog);
    const pending = detectPendingMockup();
    writePendingMeta({
      originalName,
      mode: detected.mode === 'replace' ? 'replace' : 'insert',
      productRank: detected.mode === 'replace' ? detected.productRank : 0,
      detectedAt: new Date().toISOString()
    });
    res.type('application/json').json({
      success: true,
      zone: 'insert',
      mode: detected.mode === 'replace' ? 'replace' : 'insert',
      productRank: detected.mode === 'replace' ? detected.productRank : 0,
      message: 'Maquette enregistrée avec succès sous produit-0 !',
      file: req.file,
      pendingMockup: pending
    });
  } catch (err) {
    console.error('Erreur upload:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 2bis. Upload de maquette (Base64 direct)
app.post('/api/control-tower/upload-base64', (req, res) => {
  try {
    const { base64, filename } = req.body;
    if (!base64) {
      return res.status(400).type('application/json').json({ success: false, error: 'Données Base64 manquantes.' });
    }

    const ext = filename ? (path.extname(filename).toLowerCase() || '.jpg') : '.jpg';
    const targetFile = path.join(IMAGES_DIR, `produit-0${ext}`);

    const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFileSync(targetFile, buffer);

    const pending = detectPendingMockup();
    res.type('application/json').json({
      success: true,
      message: 'Maquette enregistrée avec succès sous produit-0 !',
      filename: `produit-0${ext}`,
      pendingMockup: pending
    });
  } catch (err) {
    console.error('Erreur upload base64:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 3. Annulation de la maquette en attente
app.delete('/api/control-tower/clear-mockup', (req, res) => {
  try {
    const pending = detectPendingMockup();
    if (pending.exists && fs.existsSync(pending.fullPath)) {
      fs.unlinkSync(pending.fullPath);
    }
    clearPendingMeta();
    res.type('application/json').json({ success: true, message: 'Maquette en attente effacée.' });
  } catch (err) {
    console.error('Erreur clear mockup:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 4. Déclenchement de l'intégration automatique
app.post('/api/control-tower/trigger-integration', async (req, res) => {
  try {
    const result = await executeAutoIntegration();
    // Hook MICRO-11v2-ter : l'insertion en tête décale TOUS les rangs →
    // resync immédiate (carte + copies stables) avant tout envoi possible.
    const mediasStables = resyncMediasStablesApres('ajout produit');
    res.type('application/json').json({ ...result, mediasStables });
  } catch (err) {
    console.error('Erreur intégration automatique:', err);
    res.status(400).type('application/json').json({
      success: false,
      error: err.message,
      messageClair: err.message
    });
  }
});

// 5. Lecture du catalogue en direct
app.get('/api/control-tower/catalog', (req, res) => {
  try {
    const catalog = getCurrentCatalog();
    // Anti-cache : un navigateur peut resservir un catalogue obsolete (ex : 11
    // oeuvres alors que contenu.js en contient 25). no-store + must-revalidate
    // garantit que le dashboard recoit toujours l'etat reel du catalogue.
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.type('application/json').json({ success: true, catalog, total: catalog.length });
  } catch (err) {
    console.error('Erreur catalogue:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 6. Historique du journal
app.get('/api/control-tower/journal', (req, res) => {
  try {
    const history = getJournalHistory();
    let txtContent = '';
    if (fs.existsSync(JOURNAL_TXT)) {
      txtContent = fs.readFileSync(JOURNAL_TXT, 'utf-8');
    }
    res.type('application/json').json({ success: true, history, txtContent });
  } catch (err) {
    console.error('Erreur journal:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 7. Liste des sauvegardes
app.get('/api/control-tower/backups', (req, res) => {
  try {
    const backups = listBackups();
    res.type('application/json').json({ success: true, backups });
  } catch (err) {
    console.error('Erreur sauvegardes:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 8. Restauration d'une sauvegarde
app.post('/api/control-tower/restore-backup', (req, res) => {
  try {
    const { backupName } = req.body;
    if (!backupName) {
      return res.status(400).type('application/json').json({ success: false, error: 'Nom de sauvegarde manquant.' });
    }
    const result = restoreBackup(backupName);
    res.type('application/json').json(result);
  } catch (err) {
    console.error('Erreur restauration:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// 9. Contenu du fichier ajouter_produit_auto.txt à la racine
app.get('/api/control-tower/fiche-txt', (req, res) => {
  try {
    if (fs.existsSync(FICHE_TXT)) {
      const content = fs.readFileSync(FICHE_TXT, 'utf-8');
      res.type('text/plain; charset=utf-8').send(content);
    } else {
      res.type('text/plain; charset=utf-8').send('# Aucune fiche générée pour le moment.');
    }
  } catch (err) {
    res.status(500).type('text/plain; charset=utf-8').send('Erreur lecture fiche: ' + err.message);
  }
});

// ==========================================
// 🔁 MODE REMPLACEMENT (produit-N) — ROUTES API TOUR DE CONTRÔLE
// ==========================================

// 2ter. Upload de maquette de remplacement (zone DROITE) → staging images/_staging/produit-N.<ext>
//  - nom produit-N (1 ≤ N ≤ catalogue)  → staging + méta
//  - N hors plage                        → toast refus « produit-N introuvable » + AUCUNE écriture durable
//  - sans numéro                         → toast « Pour remplacer, nommez le fichier produit-N.jpg. »
app.post('/api/control-tower/upload-replacement', uploadStaging.single('mockup'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).type('application/json').json({ success: false, error: 'Aucun fichier image reçu.' });
    }
    const originalName = req.file.originalname || req.file.filename || '';
    const catalog = getCurrentCatalog();
    const m = String(originalName).trim().match(/produit[-_ ]?0*(\d+)/i);

    // ⛔ Sans numéro : refus immédiat + suppression du fichier temporaire (ZÉRO écriture durable)
    if (!m) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* déjà supprimé */ }
      return res.status(400).type('application/json').json({
        success: false,
        refused: 'naming',
        zone: 'replace',
        error: 'Pour remplacer, nommez le fichier produit-N.jpg.',
        messageClair: 'Pour remplacer, nommez le fichier produit-N.jpg.'
      });
    }

    const n = parseInt(m[1], 10);
    // ⛔ N hors plage : refus immédiat + suppression du fichier temporaire
    if (n < 1 || n > catalog.length) {
      try { fs.unlinkSync(req.file.path); } catch (e) { /* déjà supprimé */ }
      return res.status(400).type('application/json').json({
        success: false,
        refused: 'notfound',
        zone: 'replace',
        productRank: n,
        catalogueN: catalog.length,
        error: `produit-${n} introuvable (catalogue : 1..${catalog.length}) — dépôt annulé`,
        messageClair: `produit-${n} introuvable (catalogue : 1..${catalog.length}) — dépôt annulé`
      });
    }

    // ✅ Staging : copie vers _staging/produit-N.<ext> — l'image vivante images/produit-N.* reste intacte
    if (!fs.existsSync(path.join(IMAGES_DIR, '_staging'))) {
      fs.mkdirSync(path.join(IMAGES_DIR, '_staging'), { recursive: true });
    }
    const ext = path.extname(originalName).toLowerCase() || '.jpg';
    const stagingName = `produit-${n}${ext}`;
    const stagingFull = path.join(IMAGES_DIR, '_staging', stagingName);
    fs.copyFileSync(req.file.path, stagingFull);
    try { fs.unlinkSync(req.file.path); } catch (e) { /* nettoyage du fichier temporaire multer */ }

    writePendingMeta({
      originalName,
      mode: 'replace',
      productRank: n,
      detectedAt: new Date().toISOString()
    });

    const staging = detectReplacementStaging();
    res.type('application/json').json({
      success: true,
      zone: 'replace',
      mode: 'replace',
      productRank: n,
      catalogueN: catalog.length,
      message: `Maquette produit-${n} mise en staging (image vivante non touchée).`,
      staging
    });
  } catch (err) {
    console.error('Erreur upload remplacement:', err);
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// État complet du mode remplacement (staging + méta)
app.get('/api/control-tower/replacement-state', (req, res) => {
  try {
    res.type('application/json').json(getReplacementState());
  } catch (err) {
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// « Annuler » : purge du staging + méta (ZÉRO écriture durable)
app.delete('/api/control-tower/clear-replacement-staging', (req, res) => {
  try {
    clearReplacementStaging();
    res.type('application/json').json({ success: true, message: 'Staging de remplacement vidé (aucune écriture durable effectuée).' });
  } catch (err) {
    res.status(500).type('application/json').json({ success: false, error: err.message });
  }
});

// « Lancer remplacer_produit_auto » : aperçu du remplacement (ancienne image vs staging + fiche pré-remplie)
app.get('/api/control-tower/replacement-preview', async (req, res) => {
  try {
    const result = await prepareReplacement();
    res.type('application/json').json(result);
  } catch (err) {
    console.error('Erreur aperçu remplacement:', err);
    res.status(400).type('application/json').json({ success: false, error: err.message, messageClair: err.message });
  }
});

// « Régénérer la fiche produit » : relance IA vision, réécrit TOUS les champs SAUF le prix saisi
app.post('/api/control-tower/regenerate-fiche', async (req, res) => {
  try {
    const { prix } = req.body || {};
    const result = await regenerateFiche(typeof prix === 'string' ? prix : undefined);
    res.type('application/json').json(result);
  } catch (err) {
    console.error('Erreur régénération fiche:', err);
    res.status(400).type('application/json').json({ success: false, error: err.message, messageClair: err.message });
  }
});

// « Déployer » : exécution complète du remplacement (sauvegarde + copie + fiche + journal + commit/push)
app.post('/api/control-tower/trigger-replacement', async (req, res) => {
  try {
    const { productRank, prix, champs } = req.body || {};
    if (!productRank) {
      return res.status(400).type('application/json').json({ success: false, error: 'productRank manquant dans la requête.' });
    }
    const result = await executeReplacement(Number(productRank), typeof prix === 'string' ? prix : undefined, champs);
    // Hook MICRO-11v2-ter : l'image de CE rang change → la copie stable du
    // slug doit être actualisée (SHA) avant tout envoi.
    const mediasStables = resyncMediasStablesApres(`remplacement produit-${productRank}`);
    res.type('application/json').json({ ...result, mediasStables });
  } catch (err) {
    console.error('Erreur déclenchement remplacement:', err);
    res.status(400).type('application/json').json({ success: false, error: err.message, messageClair: err.message });
  }
});

// « Édition de fiche » (prix, nom, badge, catégorie, style, environnement, couleurs, ambiance,
// matériau, montage, description) : backup horodaté → contenu.js réécrit SANS décalage
// (BOM + CRLF préservés) → journal « ÉDITION produit-N : ancien prix → nouveau prix » →
// commit + push. L'image n'est JAMAIS touchée ici (réservée au remplacement produit-N).
app.post('/api/control-tower/update-product', async (req, res) => {
  try {
    const body = req.body || {};
    const rank = Number(body.productRank);
    const uiChamps = (body.champs && typeof body.champs === 'object') ? body.champs : {};

    const catalog = getCurrentCatalog();
    if (!Number.isInteger(rank) || rank < 1 || rank > catalog.length) {
      return res.status(400).type('application/json').json({
        success: false,
        error: `produit-${rank} introuvable (catalogue : 1..${catalog.length}) — édition annulée, aucune écriture.`
      });
    }
    const oldProduct = catalog[rank - 1];

    // 0. Fusion des champs éditables : valeur fournie > valeur actuelle. Image INTACTE.
    const str = (v) => (typeof v === 'string' ? v : (v == null ? '' : String(v)));
    const couleursFournies = Array.isArray(uiChamps.couleurs)
      ? uiChamps.couleurs.map((c) => String(c).trim()).filter(Boolean)
      : (typeof uiChamps.couleurs === 'string'
        ? uiChamps.couleurs.split(',').map((c) => c.trim()).filter(Boolean)
        : null);

    const champs = {
      nom: str(uiChamps.nom).trim() || oldProduct.nom,
      description: str(uiChamps.description).trim() || oldProduct.description,
      categorie: str(uiChamps.categorie).trim() || oldProduct.categorie,
      style: str(uiChamps.style).trim() || oldProduct.style,
      environnement: str(uiChamps.environnement).trim() || oldProduct.environnement,
      prix: str(uiChamps.prix).trim() || oldProduct.prix || 'À partir de 180 MAD',
      badge: str(uiChamps.badge).trim() || oldProduct.badge || null,
      materiauRecommande: str(uiChamps.materiauRecommande).trim() || oldProduct.materiauRecommande,
      montageRecommande: str(uiChamps.montageRecommande).trim() || oldProduct.montageRecommande,
      couleurs: (couleursFournies && couleursFournies.length ? couleursFournies : (oldProduct.couleurs || [])),
      ambiance: str(uiChamps.ambiance).trim() || oldProduct.ambiance
    };

    // 1. Sauvegarde horodatée AVANT toute modification (miroir de createReplacementBackup,
    //    moteur laissé intact) : contenu.js + pages clés dans sauvegardes/backup_..._edition_pN
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}m${pad(now.getSeconds())}s`;
    const backupName = `backup_${timestamp}_edition_p${rank}`;
    const backupFolder = path.join(ROOT_DIR, 'sauvegardes', backupName);
    fs.mkdirSync(backupFolder, { recursive: true });
    ['contenu.js', 'site-config.js', 'index.html', 'materials.html', 'process.html', 'privacy.html'].forEach((f) => {
      const src = path.join(SITE_DIR, f);
      if (fs.existsSync(src)) {
        try { fs.copyFileSync(src, path.join(backupFolder, f)); } catch (e) { console.warn('Backup édition:', e.message); }
      }
    });
    const relativeBackup = `sauvegardes/${backupName}`;

    // 2. Écriture contenu.js SANS décalage (BOM + CRLF préservés, image du rang inchangée)
    rewriteProductAtRank(rank, champs, undefined);
    // 2bis. Hook MICRO-11v2-ter : si le NOM change, le slug change → nouvelle
    // copie stable + carte reconstruite AVANT tout envoi (l'image, elle, est
    // inchangée : les autres copies restent identiques).
    const mediasStables = resyncMediasStablesApres(`édition produit-${rank}`);
    // 3. Journal des Intégrations : « ÉDITION produit-N : ancien prix → nouveau prix »
    const entry = {
      type: 'EDITION',
      id: `ed_${Date.now()}`,
      date: now.toISOString(),
      isoDate: now.toISOString(),
      source: 'dashboard',
      produitId: `produit-${rank}`,
      produit: `produit-${rank}`,
      productRank: rank,
      nouveauNom: champs.nom,
      ancienNom: oldProduct.nom || '(sans nom)',
      ancienPrix: oldProduct.prix || '',
      nouveauPrix: champs.prix,
      prix: champs.prix,
      backupFolder: relativeBackup,
      champs,
      statut: 'Édition Réussie via Tour de Contrôle (fiche réécrite sans décalage, image inchangée)'
    };
    const journalJsonPath = JOURNAL_INTEGRATIONS_PATH;
    let history = [];
    try { history = JSON.parse(fs.readFileSync(journalJsonPath, 'utf-8')); } catch (e) { history = []; }
    if (!Array.isArray(history)) history = [];
    history.unshift(entry);
    fs.writeFileSync(journalJsonPath, JSON.stringify(history, null, 2), 'utf-8');
    const txtLine =
      `[${entry.date}] ÉDITION ${entry.produit} : ancien prix « ${entry.ancienPrix} » → nouveau prix « ${entry.nouveauPrix} » | Nom : « ${entry.ancienNom} » → « ${entry.nouveauNom} » | Sauvegarde : ${relativeBackup} | Statut : ${entry.statut}\n` +
      `  ↳ Détails : Catégorie: ${champs.categorie} | Style: ${champs.style} | Pièce: ${champs.environnement} | Matériau: ${champs.materiauRecommande} | Finition: ${champs.montageRecommande} | Couleurs: ${JSON.stringify(champs.couleurs)}\n\n`;
    try { fs.appendFileSync(JOURNAL_TXT, txtLine, 'utf-8'); } catch (e) { console.error('Erreur écriture journal TXT édition:', e.message); }

    // 4. Commit + push site-web (contenu.js uniquement — moteurs et UI exclus du commit)
    const commitResult = commitAndPushSite(
      `chore: édition fiche produit-${rank} : « ${entry.ancienNom} » — prix « ${entry.ancienPrix} » → « ${entry.nouveauPrix} » (sans décalage)`,
      [path.join(SITE_DIR, 'contenu.js')]
    );

    // 5. Réponse : toast + rafraîchissement grille côté UI
    return res.type('application/json').json({
      success: true,
      type: 'EDITION',
      productRank: rank,
      produit: `produit-${rank}`,
      ancienPrix: entry.ancienPrix,
      nouveauPrix: entry.nouveauPrix,
      backupFolder: relativeBackup,
      commit: commitResult,
      mediasStables,
      messageClair: `Fiche du produit-${rank} éditée : prix « ${entry.ancienPrix} » → « ${entry.nouveauPrix} ». Image inchangée (pour l'image : remplacement produit-${rank}). Sauvegarde : ${relativeBackup}.`
    });
  } catch (err) {
    console.error('Erreur édition produit:', err);
    return res.status(400).type('application/json').json({ success: false, error: err.message, messageClair: err.message });
  }
});

// ==========================================
// 📱 SOCIAL STUDIO — ROUTES API (Buffer GraphQL, 3 réseaux)
// ==========================================

// Chemins des journaux Social Studio
// ==========================================
// 🛡️ PHASE B — DURCISSEMENT COMPOSEUR POST
// variantes par réseau · anti-doublon 24 h · média public · réponses Buffer journalisées
// ==========================================
const PUBLIC_MEDIA_BASE = 'https://energivor63-hub.github.io/Tableaux-Muraux-Site/';
const ANTI_DOUBLON_MS = 24 * 60 * 60 * 1000; // refus du renvoi vers le MÊME réseau sous 24 h (sauf Forcer)
// ROUTAGE DES RÉSEAUX — NEUTRALISATION (19/09/2026, migration terminée) :
//   facebook + instagram + pinterest → Buffer GraphQL (createPost, mode shareNow).
//   INTEGRATEUR_RESEAU = 'buffer' sur les 3 réseaux ; tout le code d'appel
//   alternatif a été SUPPRIMÉ (aucune référence restante — pas de code mort).
const INTEGRATEUR_RESEAU = 'buffer';
/** Intégrateur d'un réseau : toujours 'buffer' (neutralisation 19/09/2026). */
function integrateurPour(reseau) {
  return INTEGRATEUR_RESEAU;
}
const LABEL_RESEAU = { facebook: 'Facebook', instagram: 'Instagram', pinterest: 'Pinterest' };

/** Masquage : fonction UNIQUE importée du moteur (P2a C5 — aucun doublon local). */

/** Journal OBLIGATOIRE (journal_integrations.json) : entrée horodatée en TÊTE
 * du tableau. ORDRE D'INSERTION DOCUMENTÉ : `unshift` → les entrées les PLUS
 * RÉCENTES sont au DÉBUT du fichier (l'entrée du 17/09 n'apparaît donc PAS en
 * fin de fichier : un `-Tail` ne montre que les entrées les plus anciennes). */
function journaliserIntegration(entree) {
  try {
    const chemin = JOURNAL_INTEGRATIONS_PATH;
    let hist = [];
    try { hist = JSON.parse(fs.readFileSync(chemin, 'utf-8')); } catch (e) { hist = []; }
    if (!Array.isArray(hist)) hist = [];
    // MICRO-11v2-quater : UNE SEULE forme d'horodatage (ISO UTC) + source.
    const iso = new Date().toISOString();
    hist.unshift({
      ...entree,
      date: iso,
      isoDate: iso,
      source: entree && entree.source === 'manuel-buffer' ? 'manuel-buffer' : 'dashboard',
      produitId: (entree && (entree.produitId || entree.produit))
        || nomProduitDepuisUrl(entree && entree.mediaUrl)
        || null
    });
    fs.writeFileSync(chemin, JSON.stringify(hist, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[social] journal_integrations.json non écrit :', e.message);
  }
}

/** « produit-9 » depuis une URL image (…/images/produit-9.jpg) ou un chemin de fiche. */
function nomProduitDepuisUrl(url) {
  const m = String(url || '').match(/produit-0*(\d+)\.(?:jpe?g|png|webp)/i);
  return m ? `produit-${Number(m[1])}` : null;
}

/** Fiche par nom d'image produit-N, rang (#N) ou nom d'œuvre. */
function trouverFiche(critere) {
  const catalog = getCurrentCatalog();
  if (!critere) return { fiche: null, catalog };
  const c = String(critere).trim().toLowerCase();
  const base = c.replace(/^.*[\\\/]/, '').replace(/\.(jpe?g|png|webp)$/i, '');
  const num = base.match(/produit-0*(\d+)$/);
  const fiche = catalog.find((f) => {
    const imgBase = String(f.image || '').replace(/^.*[\\\/]/, '').replace(/\.(jpe?g|png|webp)$/i, '').toLowerCase();
    if (num && imgBase === 'produit-' + Number(num[1])) return true;
    if (imgBase === base) return true;
    return String(f.nom || '').toLowerCase() === c;
  }) || null;
  return { fiche, catalog };
}

/** URL média : JAMAIS localhost — refus explicite + fetch de vérification (→ 200). */
async function verifierMediaPublic(mediaUrl, fiche) {
  const url = String(mediaUrl || '').trim();
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(url);
  if (local) {
    return { ok: false, url, erreur: 'URL média locale interdite (localhost) — envoi annulé. URL publique attendue : ' + PUBLIC_MEDIA_BASE + 'images/produit-N.jpg' };
  }
  if (!url) {
    const nom = fiche && nomProduitDepuisUrl(fiche.image);
    if (!nom) {
      return { ok: false, url, erreur: 'URL média absente et produit non identifiable — envoi annulé. URL attendue : ' + PUBLIC_MEDIA_BASE + 'images/produit-N.jpg' };
    }
    const reconstruite = PUBLIC_MEDIA_BASE + 'images/' + nom + '.jpg';
    return verifierUrlMedia(reconstruite);
  }
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, url, erreur: 'URL média non publique (HTTPS obligatoire) — envoi annulé. URL attendue : ' + PUBLIC_MEDIA_BASE + 'images/produit-N.jpg' };
  }
  // Branche unique : toute URL https passe par le check instrumenté UNIQUE
  // (statut 200/206 + content-type image/*, log [media-check] URL/statut/type/octet).
  return verifierUrlMedia(url);
}

/** URL VIDÉO PUBLIQUE (Buffer télécharge l'URL — localhost impossible).
 * Les MP4 vivent HORS dépôt (../videos, jamais sur GitHub Pages) : l'URL
 * publique est fournie par l'utilisateur (dashboard « URL vidéo publique »,
 * ex. fichier catbox.moe — gratuit, sans compte). AUCUN upload auto codé.
 * Refus actionnables (jamais de localhost envoyé) : URL vide → « fournir une
 * URL publique » ; localhost/127 → interdite ; non-https → refusée ; puis
 * DOUBLE CONTRÔLE :
 *   1) HEAD d'abord — HEAD honnête exigé : statut 2xx + Content-Length > 0
 *      (et == tailleAttendueOctets si connue). Certains hébergeurs (ex.
 *      catbox.moe) annoncent Content-Length: 0 alors que le GET Range
 *      fonctionne — mais Buffer rejette ces URLs (« Video could not be
 *      read ») → refus actionnable « hébergeur incompatible Buffer —
 *      choisissez Internet Archive / B2 / R2 » ;
 *   2) Range GET bytes=0-0 conservé — HTTP 200/206 + content-type video/*.
 * TEST-ONLY : ALLOW_LOCAL_VIDEO_URL_TEST=1 lève la barrière localhost/http
 * (faux serveur vidéo local) — JAMAIS en production. */
async function verifierVideoPublique(videoUrl, tailleAttendueOctets) {
  const url = String(videoUrl || '').trim();
  if (!url) {
    return { ok: false, url, erreur: 'URL vidéo publique manquante — collez l’URL publique de la vidéo (ex. fichier catbox.moe, gratuit sans compte) ; localhost non publiable.' };
  }
  const testLocalAutorise = process.env.ALLOW_LOCAL_VIDEO_URL_TEST === '1'; // TEST-ONLY
  if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(url) && !testLocalAutorise) {
    return { ok: false, url, erreur: 'URL vidéo locale interdite (localhost) — Buffer ne peut pas la télécharger. Fournissez une URL publique https de la vidéo.' };
  }
  if (!/^https:\/\//i.test(url) && !testLocalAutorise) {
    return { ok: false, url, erreur: 'URL vidéo non publique (HTTPS obligatoire) — envoi annulé. Fournissez une URL publique https de la vidéo.' };
  }
  const tailleAttendue = Number(tailleAttendueOctets);
  const tailleConnue = Number.isFinite(tailleAttendue) && tailleAttendue > 0;
  // Chiffres remontés pour la route /api/social/verifier-video (pré-contrôle
  // dashboard délégué — le navigateur, bloqué par CORS, ne peut pas les lire).
  let contentLength = null;
  let contentType = null;
  // 1) HEAD d'abord : refuse les hébergeurs à HEAD malhonnête AVANT tout GET.
  try {
    const h = await fetch(url, { method: 'HEAD' });
    console.log(`[media-check] HEAD ${url} → HTTP ${h.status} | content-length: ${h.headers.get('content-length') ?? '?'} | content-type: ${h.headers.get('content-type') || '?'}`);
    if (h.ok) {
      const typeHead = String(h.headers.get('content-type') || '').trim();
      if (typeHead && !/^video\//i.test(typeHead)) {
        return { ok: false, url, contentLength, contentType: typeHead || null, erreur: `Vidéo refusée : l’hébergeur annonce content-type « ${typeHead} » (vidéo attendue) — hébergeur incompatible Buffer, choisissez Internet Archive / B2 / R2 : ${url}` };
      }
      if (/^video\//i.test(typeHead)) contentType = typeHead;
      const clBrut = h.headers.get('content-length');
      const annonce = clBrut === null ? NaN : Number(clBrut);
      if (Number.isFinite(annonce)) {
        if (annonce <= 0) {
          return { ok: false, url, contentLength: annonce, contentType, erreur: `Vidéo refusée : hébergeur incompatible Buffer (HEAD Content-Length: ${annonce}) — le fichier répond en GET mais Buffer le rejette (« Video could not be read »). Choisissez Internet Archive / B2 / R2 : ${url}` };
        }
        contentLength = annonce;
        if (tailleConnue && annonce !== tailleAttendue) {
          return { ok: false, url, contentLength: annonce, contentType, erreur: `Vidéo refusée : taille HEAD (${annonce} o) ≠ taille attendue (${tailleAttendue} o) — fichier différent ou tronqué. Choisissez Internet Archive / B2 / R2 : ${url}` };
        }
      }
    }
    // HEAD non-2xx ou sans Content-Length : non concluant → second contrôle.
  } catch (e) {
    console.log(`[media-check] HEAD ${url} → ERREUR ${e.message} (second contrôle Range conservé)`);
  }
  // 2) Range GET bytes=0-0 (contrôle conservé) : HTTP 200/206 + video/*.
  try {
    const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    const type = String((r.headers && r.headers.get('content-type')) || '').trim();
    console.log(`[media-check] ${url} → HTTP ${r.status} | content-type: ${type || '?'}`);
    if ((r.status === 200 || r.status === 206) && /^video\//i.test(type)) {
      if (contentLength === null) {
        const plage = String((r.headers && r.headers.get('content-range')) || '');
        const total = plage.match(/\/(\d+)\s*$/);
        const cl = Number(r.headers.get('content-length'));
        contentLength = total ? Number(total[1]) : (Number.isFinite(cl) && cl > 1 ? cl : null);
      }
      return { ok: true, url, contentLength, contentType: type };
    }
    return { ok: false, url, contentLength, contentType: (/^video\//i.test(type) ? type : contentType), erreur: `Vidéo publique inaccessible (HTTP ${r.status}${type ? `, content-type: ${type}` : ''}) : ${url}` };
  } catch (e) {
    console.log(`[media-check] ${url} → ERREUR ${e.message}`);
    return { ok: false, url, contentLength, contentType, erreur: `Vidéo publique inaccessible (${e.message}) : ${url}` };
  }
}

/** Check média unique : HTTP 200/206 + content-type image/* UNIQUEMENT —
 * JAMAIS de comparaison hash/taille avec le fichier local (GitHub sert
 * l'image pré-push jusqu'au push). Instrumentation demandée : URL exacte +
 * statut + content-type + octets (via content-range). */
async function verifierUrlMedia(cible) {
  try {
    const r = await fetch(cible, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    const type = String((r.headers && r.headers.get('content-type')) || '').trim();
    const plage = String((r.headers && r.headers.get('content-range')) || '');
    const taillePlage = plage.match(/\/(\d+)\s*$/);
    const octets = taillePlage ? Number(taillePlage[1]) : (Number(r.headers.get('content-length')) || 0);
    console.log(`[media-check] ${cible} → HTTP ${r.status} | content-type: ${type || '?'} | octets: ${octets || '?'}`);
    if ((r.status === 200 || r.status === 206) && /^image\//i.test(type)) {
      return { ok: true, url: cible, httpStatus: r.status, contentType: type, octets };
    }
    return { ok: false, url: cible, erreur: `Média public inaccessible (HTTP ${r.status}${type ? `, content-type: ${type}` : ''}) : ${cible}` };
  } catch (e) {
    console.log(`[media-check] ${cible} → ERREUR ${e.message}`);
    return { ok: false, url: cible, erreur: `Média public inaccessible (${e.message}) : ${cible}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GARDE-FOU ANTI-DOUBLON LOCAL + JOURNALISATION OBLIGATOIRE BUFFER
//   journal_integrations.json (racine) : une entrée par tentative (produit,
//   réseau, hash du contenu, horodatage, statut HTTP + réponse brute Buffer).
// ─────────────────────────────────────────────────────────────────────────
// SANDBOX TEST (18/09/2026) : les suites de test démarrent le serveur avec
// JOURNAL_INTEGRATIONS_PATH = copie TEMP du journal vidée de ses entrées
// sociales → le garde-fou 24 h est inactif en début de suite et le journal
// RÉEL n'est jamais lu ni écrit pendant les tests. Fallback = chemin réel
// (comportement production inchangé quand la variable est absente).
const JOURNAL_INTEGRATIONS_PATH = process.env.JOURNAL_INTEGRATIONS_PATH
  || path.join(ROOT_DIR, 'journal_integrations.json');

/** Lecture robuste du journal d'intégrations (jamais d'exception bloquante). */
function lireJournalIntegrations() {
  try {
    const arr = JSON.parse(fs.readFileSync(JOURNAL_INTEGRATIONS_PATH, 'utf-8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

/** Horodatage exploitable d'une entrée (isoDate prioritaire, sinon date FR). */
function dateEntree(entree) {
  const iso = Date.parse(entree && entree.isoDate);
  if (!Number.isNaN(iso)) return iso;
  const fr = Date.parse(entree && entree.date);
  return Number.isNaN(fr) ? 0 : fr;
}

/**
 * Vrai si l'entrée correspond à un SUCCÈS pour l'un des identifiants produit
 * fournis (slug « produit-9 », nom d'œuvre, rang…) et ce réseau.
 * Appariement canonique : le slug ET le nom d'œuvre sont journalisés, donc un
 * appel avec produitId=slug ou produitNom=nom d'œuvre retrouve bien l'entrée.
 */
function entreeSucces(entree, identifiants, reseau) {
  if (!entree) return false;
  if (String(entree.reseau || '').toLowerCase() !== String(reseau || '').toLowerCase()) return false;
  const demandes = (Array.isArray(identifiants) ? identifiants : [identifiants])
    .filter(Boolean).map((v) => String(v).toLowerCase());
  const cibles = [entree.produit, entree.produitNom, entree.produitId, entree.produitSlug]
    .filter(Boolean).map((v) => String(v).toLowerCase());
  if (!demandes.length) return true; // sans identifiant : garde-fou par réseau seul
  if (!cibles.some((k) => demandes.includes(k))) return false;
  return ['succes', 'published', 'reussi', 'success'].includes(String(entree.statut || '').toLowerCase());
}

/**
 * GARDE-FOU ANTI-DOUBLON (UNIQUE) : refuse tout renvoi vers le MÊME réseau
 * sous 24 h — identique pour 'now' (shareNow) et 'queue' (addToQueue).
 * Une entrée 'queue' à succès COMPTE comme publication (elle partira au
 * prochain créneau Buffer) → bloque un doublon même non encore envoyé.
 * Seuls les SUCCÈS bloquent (un échec Buffer — ex. file 10/10 pleine — peut
 * toujours être réessayé ; l'erreur Buffer remonte telle quelle, AUCUN quota
 * de volume n'est inventé côté app).
 * `identifiants` = tableau (slug produit-N, nom d'œuvre, rang…).
 * Retourne { bloque, message, heures, derniere }.
 */
function verifierAntiDoublon(identifiants, reseau, forcer) {
  const recentes = lireJournalIntegrations()
    .filter((e) => entreeSucces(e, identifiants, reseau))
    .sort((a, b) => dateEntree(b) - dateEntree(a));
  const derniere = recentes[0] || null;
  if (!derniere || forcer) return { bloque: false, derniere };
  const age = Date.now() - dateEntree(derniere);
  if (age > ANTI_DOUBLON_MS) return { bloque: false, derniere };
  const heures = Math.max(1, Math.round(age / 3600000));
  return {
    bloque: true,
    heures,
    derniere,
    message: `${LABEL_RESEAU[reseau] || reseau} déjà programmé/publié il y a ${heures} h — cochez « Forcer » pour republier.`
  };
}

// ── NEUTRALISATION (19/09/2026, migration terminée) : les helpers d'appel
// alternatif (extraction de messages, codes, sessions) ont été SUPPRIMÉS —
// aucune référence restante, pas de code mort. Seule la journalisation
// Buffer (journaliserIntegration + masquerReponseBrute) subsiste.

// ── NEUTRALISATION (19/09/2026) : le classifieur d'erreurs alternatif
// (lots B/D/E) est SUPPRIMÉ avec le code d'appel — les causes d'échec
// Buffer sont produites par site-web/buffer-graphql.js.

// ── NEUTRALISATION (19/09/2026) : résolution et persistance IG_USER_ID
// SUPPRIMÉES avec le code d'appel alternatif (Buffer résout ses canaux via
// query channels — site-web/buffer-graphql.js).

// ── NEUTRALISATION (19/09/2026) : recherche et résolution d'ID alternatif
// SUPPRIMÉES (voir note ci-dessus).

// ── NEUTRALISATION (19/09/2026) : construction des arguments et appel
// alternatif SUPPRIMÉS (voir notes ci-dessus).

// ── NEUTRALISATION (19/09/2026) : détection de succès et extraction
// d'ID alternatif SUPPRIMÉES (voir notes ci-dessus).

// ── NEUTRALISATION (19/09/2026) : la fonction de publication alternative
// est SUPPRIMÉE — les 3 réseaux partent via publierViaBufferGraphql
// (createPost, mode shareNow). Aucune référence restante, pas de code mort.

const SOCIAL_JOURNAL_DIR = path.join(ROOT_DIR, 'dashboard', 'journaux');
// SANDBOX TEST (18/09/2026) : même mécanisme que JOURNAL_INTEGRATIONS_PATH —
// les suites pointent le journal social vers un fichier TEMP (fallback réel).
const SOCIAL_JOURNAL_PATH = process.env.SOCIAL_JOURNAL_PATH
  || path.join(SOCIAL_JOURNAL_DIR, 'social-journal.json');
const SOCIAL_DRAFTS_PATH = path.join(SOCIAL_JOURNAL_DIR, 'social-drafts.json');

// Garantir l'existence du dossier journaux
if (!fs.existsSync(SOCIAL_JOURNAL_DIR)) {
  fs.mkdirSync(SOCIAL_JOURNAL_DIR, { recursive: true });
}

// 🗂️ MICRO-11v2-quater — MIGRATION IDEMPOTENTE AU DÉMARRAGE :
// dédoublonne (platform, isoUTC, produitId), normalise les horodatages ISO UTC
// et archive published/error + entrées > 7 jours dans journal-YYYY-MM.json.
// Le journal actif reste court ; l'historique complet est reconstitué à la
// lecture (lireJournalComplet → actif + archives).
try {
  const migration = migrerJournal();
  if (migration.fusionnees || migration.archivees) {
    console.log(
      `[journal] migration : ${migration.fusionnees} doublon(s) fusionné(s), ` +
      `${migration.archivees} entrée(s) archivée(s), ${migration.actives} active(s) ` +
      `(avant : ${migration.avant}).`
    );
  }
} catch (e) {
  console.warn(`[journal] migration ignorée : ${e.message}`);
}

// ═══ LOT C — CACHE-BUSTING : JAMAIS d'UI périmée après un correctif ═══
// /dashboard.html, /dashboard/*.js|css|html et /contenu.js sont servis avec
// Cache-Control: no-store (les assets restent vérifiables par curl -I).
app.use((req, res, next) => {
  if (req.path === '/dashboard.html' || req.path.startsWith('/dashboard/') || req.path === '/contenu.js') {
    res.set('Cache-Control', 'no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Service du dashboard Social Studio
app.get('/dashboard.html', (req, res) => {
  const dashboardPath = path.join(ROOT_DIR, 'dashboard', 'dashboard.html');
  if (fs.existsSync(dashboardPath)) {
    res.set('Cache-Control', 'no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.sendFile(dashboardPath);
  } else {
    res.status(404).send('Dashboard introuvable.');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLICATION MULTI-RÉSEAUX DURCIE (Phase B)
//   • 1 variante de légende PAR RÉSEAU (jamais de contenu strictement identique)
//   • garde-fou anti-doublon 24 h par réseau (sauf case « Forcer »)
//   • erreurs regroupées dans le bloc Buffer (intégrateur unique)
//   • TOUTE réponse Buffer journalisée (journal_integrations.json)
//   • URLs média publiques GitHub Pages uniquement (fetch → 200 vérifié)
// SESSION 10 : Pinterest est publié UNIQUEMENT dans le board officiel
// « Nos meilleures œuvres — art mural marocain » (voir site-web/buffer-pinterest.js).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Texte du dashboard pour un réseau ('' si l'utilisateur n'a rien saisi).
 * SESSION 2026-09-18 : le texte saisi passe par les règles rédactionnelles
 * (social-variants.js) AVANT envoi :
 *   • Instagram : un SEUL bloc de hashtags dédoublonnés (plafond 11) précédé du
 *     CTA « lien en bio » — corrige le doublon réel du 17/09 (caption qui
 *     contenait déjà les hashtags + champ hashtags) ;
 *   • Facebook : adjectifs qualifiants uniques (CTA WhatsApp + lien conservés) ;
 *   • Pinterest : adjectifs uniques + locution du titre SEO non répétée en tête
 *     de description (le titre et les « Mots-clés » restent intacts).
 */
function texteDashboardPour(copies, reseau, fiche) {
  const c = (copies && copies[reseau]) || {};
  if (reseau === 'instagram') {
    const caption = String(c.caption || '').trim();
    const hashtags = String(c.hashtags || '').trim();
    if (!caption && !hashtags) return '';
    return assemblerLegendeInstagram(caption, hashtags);
  }
  if (reseau === 'facebook') {
    const texte = String(c.text || '').trim();
    return texte ? normaliserTexteReseau(texte, { reseau: 'facebook', fiche }) : '';
  }
  const titre = String(c.title || '').trim();
  const description = String(c.description || '').trim();
  const texte = [titre, description].filter(Boolean).join('\n').trim();
  return texte ? normaliserTexteReseau(texte, { reseau: 'pinterest', titre }) : '';
}

/**
 * 3 légendes GARANTIES DISTINCTES pour les réseaux demandés.
 * Le texte saisi dans le dashboard prime (normalisé par les règles
 * rédactionnelles du 18/09/2026 : hashtags IG dédoublonnés + CTA « lien en
 * bio », adjectifs qualifiants uniques, locution du titre SEO non répétée) ;
 * sinon la variante générée depuis la fiche (social-variants.js). Deux réseaux
 * ne peuvent JAMAIS partir avec un texte strictement identique (anti-doublon
 * Buffer).
 */
function resoudreTextesParReseau(plateformes, copies, fiche) {
  const variantes = genererVariantes(fiche || {});
  const textes = {};
  const origine = {};
  plateformes.forEach((p) => {
    const saisi = texteDashboardPour(copies, p, fiche);
    textes[p] = saisi || variantes[p] || '';
    origine[p] = saisi ? 'dashboard' : 'variante-auto';
  });
  // Invariant : jamais deux réseaux avec un texte strictement identique
  const vus = new Map();
  plateformes.forEach((p) => {
    if (vus.has(textes[p])) {
      textes[p] = variantes[p] || (textes[p] + ' #' + p);
      origine[p] = 'variante-auto(anti-doublon)';
    }
    vus.set(textes[p], p);
  });
  return { textes, origine, variantes };
}
/**
 * CŒUR DE PUBLICATION (utilisé par /api/social/publish ET
 * /api/social/retry-failed). Renvoie toujours un objet sérialisable :
 * { success, error, errors, erreursParIntegrateur, resultats, reseauxPublies,
 *   reseauxEchoues, postUrls, variantes, textesEnvoyes }
 */
async function executerPublication(body, ciblesForcees) {
    const mediaUrlDemande = body.mediaUrl;
    const scheduleDate = body.scheduleDate || null;
    // 🎬 MÉDIA : 'image' (défaut, URL publique GitHub Pages) ou 'video'
    // (MP4 hors dépôt — Buffer exige une URL PUBLIQUE https fournie par
    // l'utilisateur ; localhost refusé AVANT tout envoi, 0 mutation).
    const mediaType = body.mediaType === 'video' ? 'video' : 'image';
    const videoUrlDemande = String(body.videoUrl || '').trim();
    // Payload dashboard (« plateformes » + « copies ») ou legacy (« platform » + « content »)
    const platforms = (Array.isArray(ciblesForcees) && ciblesForcees.length)
      ? ciblesForcees
      : (Array.isArray(body.plateformes) && body.plateformes.length > 0
        ? body.plateformes
        : (body.platform ? [body.platform] : []));
    if (!platforms.length) {
      return { success: false, error: 'Aucune plateforme cible dans la requête', resultats: [], reseauxPublies: [], reseauxEchoues: [] };
    }
    const forcer = body.forcer === true || body.forcerRepublication === true;
    // ROUTAGE MODE (bouton « 📬 File d'attente Buffer ») : 'queue' → Buffer
    // mode addToQueue + schedulingType automatic (prochain créneau du canal,
    // heure renvoyée dans post.dueAt) ; 'schedule' → customScheduled + dueAt
    // explicite (ISO 8601 UTC) = programmation CLOUD réelle (PC éteint OK) ;
    // défaut 'now' → shareNow (inchangé).
    // AUCUNE limite de volume côté serveur : l'utilisateur choisit
    // canaux/volumes, la limite 10/canal est gérée côté Buffer (ses erreurs
    // remontent telles quelles, message + code).
    const modePublication = body.modePublication === 'queue' ? 'queue' : (body.modePublication === 'schedule' ? 'schedule' : 'now');
    const modeBuffer = modePublication === 'queue' ? 'addToQueue' : (modePublication === 'schedule' ? 'customScheduled' : 'shareNow');
    const fileAttente = modePublication === 'queue' || modePublication === 'schedule';
    const scheduledAt = modePublication === 'schedule' ? body.scheduledAt : null;

    // 1 ─ Fiche produit + variantes DISTINCTES par réseau
    const critere = body.produitId || body.produitNom || nomProduitDepuisUrl(mediaUrlDemande) || null;
    const { fiche } = trouverFiche(critere);
    // Identifiants canoniques du produit (slug + nom d'œuvre) : le garde-fou
    // retrouve une entrée quel que soit l'identifiant envoyé par le dashboard.
    const produitCles = [...new Set([body.produitId, body.produitNom,
      nomProduitDepuisUrl(mediaUrlDemande), fiche && fiche.nom,
      fiche && nomProduitDepuisUrl(fiche.image), critere].filter(Boolean).map(String))];
    const produit = nomProduitDepuisUrl(mediaUrlDemande)
      || (fiche && nomProduitDepuisUrl(fiche.image))
      || (produitCles[0] || 'inconnu');
    const produitNom = (fiche && fiche.nom) || body.produitNom || null;
    const { textes, origine, variantes } = resoudreTextesParReseau(platforms, body.copies, fiche);

    // 2 ─ Média : URL PUBLIQUE vérifiée (fetch → 200/206) AVANT envoi.
    // Image = GitHub Pages (verifierMediaPublic) ; vidéo = URL publique
    // fournie (verifierVideoPublique — localhost refusé, 0 mutation).
    // Les variantes texte sont INCHANGÉES (mêmes légendes/titres en vidéo).
    let mediaUrl = null;
    let videoUrl = null;
    if (mediaType === 'video') {
      // videoTailleOctets (optionnel) : comparée au HEAD Content-Length quand
      // le dashboard la connaît (sinon seul « > 0 » est exigé).
      const tailleAttendue = Number(body.videoTailleOctets);
      const verifVideo = await verifierVideoPublique(
        videoUrlDemande,
        Number.isFinite(tailleAttendue) && tailleAttendue > 0 ? tailleAttendue : undefined
      );
      if (!verifVideo.ok) {
        journaliserIntegration({
          type: 'pre-vol', integrateur: 'media', reseau: 'tous', produit,
          statut: 'echec', erreur: verifVideo.erreur, mediaUrl: mediaUrlDemande,
          videoUrl: videoUrlDemande || undefined, mediaType,
          cause: 'URL vidéo non publique ou inaccessible (localhost interdit)'
        });
        return {
          success: false, error: verifVideo.erreur,
          erreursParIntegrateur: [], resultats: [],
          reseauxPublies: [], reseauxEchoues: platforms.slice(), variantes, mediaType
        };
      }
      videoUrl = verifVideo.url;
    } else {
      const verifMedia = await verifierMediaPublic(mediaUrlDemande, fiche);
      if (!verifMedia.ok) {
        journaliserIntegration({
          type: 'pre-vol', integrateur: 'media', reseau: 'tous', produit,
          statut: 'echec', erreur: verifMedia.erreur, mediaUrl: mediaUrlDemande,
          cause: 'URL média non publique ou inaccessible (localhost interdit)'
        });
        return {
          success: false, error: verifMedia.erreur,
          erreursParIntegrateur: [], resultats: [],
          reseauxPublies: [], reseauxEchoues: platforms.slice(), variantes, mediaType
        };
      }
      mediaUrl = verifMedia.url;
    }

    // 3 ─ Pré-vérification des clés (journalisée, puis échec rapide) —
    //    Buffer GraphQL exige BUFFER_API_KEY pour les 3 réseaux
    //    (neutralisation 19/09/2026 : intégrateur unique).
    const manquantes = [];
    if (!process.env.BUFFER_API_KEY) manquantes.push('BUFFER_API_KEY');
    if (manquantes.length) {
      journaliserIntegration({
        type: 'pre-vol', integrateur: 'config', reseau: platforms.join(', '), produit,
        statut: 'echec', cause: `${manquantes.join(' + ')} manquante(s) dans .env`, mediaUrl
      });
      return {
        success: false, error: `${manquantes.join(' + ')} manquante dans .env`,
        erreursParIntegrateur: [], resultats: [],
        reseauxPublies: [], reseauxEchoues: platforms.slice(), variantes
      };
    }

    // 4 ─ GARDE-FOU ANTI-DOUBLON (même réseau < 24 h, sauf « Forcer »)
    const refus = [];
    const autorises = [];
    platforms.forEach((p) => {
      const etat = verifierAntiDoublon(produitCles, p, forcer);
      if (etat.bloque) {
        refus.push({ reseau: p, message: etat.message, heures: etat.heures, date: (etat.derniere && (etat.derniere.isoDate || etat.derniere.date)) || null, isoDate: (etat.derniere && (etat.derniere.isoDate || etat.derniere.date)) || null });
      } else {
        autorises.push(p);
      }
    });
    if (refus.length) {
      journaliserIntegration({
        type: 'garde-fou', integrateur: 'anti-doublon', reseau: refus.map((r) => r.reseau).join(', '),
        produit, produitNom, statut: 'refus', message: refus.map((r) => r.message).join(' | '),
        hashContenu: hashContenu(textes[refus[0].reseau] || ''), mediaUrl,
        isoDate: new Date().toISOString()
      });
    }
    if (!autorises.length) {
      return {
        success: false, error: refus[0].message, refusDoublon: refus,
        erreursParIntegrateur: [],
        resultats: refus.map((r) => ({ reseau: r.reseau, integrateur: 'anti-doublon', succes: false, statut: 'refus', message: r.message })),
        reseauxPublies: [], reseauxEchoues: [], reseauxRefuses: refus.map((r) => r.reseau),
        reseauxNonEnvoyes: [], variantes, forcer: false
      };
    }

    let journal = [];
    if (fs.existsSync(SOCIAL_JOURNAL_PATH)) {
      journal = JSON.parse(fs.readFileSync(SOCIAL_JOURNAL_PATH, 'utf-8'));
    }
    const resultats = [];
    const postUrls = {};
    const erreursBuffer = [];
    const textesEnvoyes = [];

    for (const platform of autorises) {
      const texte = textes[platform] || '';
      textesEnvoyes.push({ reseau: platform, origine: origine[platform], hashContenu: hashContenu(texte), longueur: texte.length });
      // Copies dashboard du réseau (lien de destination, alt text, titre Pinterest)
      const copie = ((body.copies || {})[platform]) || {};

      if (platform === 'facebook' || platform === 'instagram' || platform === 'pinterest') {
        // ── Buffer GraphQL (createPost) : Facebook + Instagram + Pinterest.
        // UNE mutation createPost par réseau avec SA variante de texte
        // (genererVariantes inchangée — mêmes légendes en vidéo) + média =
        // image (URL publique GitHub Pages) OU vidéo (URL publique fournie,
        // assets [{ video: { url } }] — introspection VideoAssetInput
        // 2026-09-22), pré-vérifié 200/206 au-dessus + mode shareNow (immédiat)
        // OU addToQueue (file d'attente), selon body.modePublication ;
        // schedulingType automatic dans les 2 cas.
        // Pinterest : board officiel OBLIGATOIRE (résolu dans buffer-graphql.js).
        let outcome = null;
        let erreurBuf = null;
        try {
          outcome = await publierViaBufferGraphql({
            reseau: platform, texte, mediaUrl,
            lien: copie.link || '', alt: copie.alt || '', titrePin: copie.title || '',
            modePublication, mediaType, videoUrl,
            scheduledAt, useStableUrl: fileAttente, produitNom
          });
        } catch (bufErr) {
          erreurBuf = bufErr;
        }
        // 📓 journal intégrations (garde-fou 24 h + traçabilité) : intégrateur
        // 'buffer', champs inchangés (statut, cause, secrets masqués) + channelIds
        const integratorMode = fileAttente
            ? (modePublication === 'schedule' ? 'buffer-cloud-schedule' : 'buffer-queue')
            : 'buffer-graphql';
          const journalMode = outcome ? (outcome.mode || modeBuffer) : modeBuffer;
          journaliserIntegration({
          type: 'publication', integrateur: 'buffer', reseau: LABEL_RESEAU[platform],
          produit, produitNom,
          statut: outcome ? 'succes' : 'echec',
          httpStatus: outcome ? 200 : ((erreurBuf && erreurBuf.httpStatus) || null),
          message: outcome
            ? (fileAttente
              ? (modePublication === 'schedule'
                ? `Programmé via Buffer Cloud (${LABEL_RESEAU[platform]}) — post ${outcome.postId} (mode customScheduled, envoi : ${outcome.scheduledAt || outcome.dueAt})`
                : `Ajouté à la file Buffer (${LABEL_RESEAU[platform]}) — post ${outcome.postId} (mode addToQueue${outcome.dueAt ? `, envoi prévu : ${outcome.dueAt}` : ''})`)
              : `Publié via Buffer GraphQL (${LABEL_RESEAU[platform]}) — post ${outcome.postId} (mode ${outcome.mode || modeBuffer})`)
            : (erreurBuf && erreurBuf.message) || 'Erreur Buffer inconnue',
          cause: outcome ? null : (erreurBuf && erreurBuf.message) || 'Erreur Buffer inconnue',
          code: erreurBuf && erreurBuf.code ? erreurBuf.code : undefined,
          // reponseBrute PAR RÉSEAU : réponse GraphQL brute (union typée /
          // errors[]) tronquée 2000 car., secrets masqués.
          reponseBrute: masquerReponseBrute((outcome && outcome.reponseBrute) || (erreurBuf && erreurBuf.reponseBrute)),
          mediaUrl, videoUrl: videoUrl || undefined, mediaType,
          mediaUrlEnvoyee: outcome ? (outcome.mediaUrl || null) : null,
          mediaStable: (outcome && outcome.mediaStable)
            ? { slug: outcome.mediaStable.slug, chemin: outcome.mediaStable.cheminRelatif, sha256: outcome.mediaStable.shaStable, cree: outcome.mediaStable.cree }
            : (erreurBuf && erreurBuf.mediaStable ? erreurBuf.mediaStable : undefined),
          hashContenu: hashContenu(texte), contenu: texte,
          channelIds: ((outcome && outcome.channelId) || (erreurBuf && erreurBuf.channelId))
            ? [(outcome && outcome.channelId) || (erreurBuf && erreurBuf.channelId)]
            : undefined,
          mode: journalMode,
          integratorMode,
          fileAttente,
          dueAtRetour: (outcome && (outcome.dueAt || outcome.scheduledAt)) || null,
          board: outcome && outcome.board
            ? { id: outcome.board.id, name: outcome.board.name, serviceId: outcome.board.serviceId, url: outcome.board.url }
            : undefined,
          // Garde-fou Pinterest ≤ 500 (19/09/2026) : tronquature propre
          // tracée quand le total titre + description dépassait la limite.
          tronque: (outcome && outcome.tronque) || undefined,
          totalAvant: (outcome && outcome.totalAvant) || undefined,
          totalApres: (outcome && outcome.totalApres) || undefined
        });
        if (outcome) {
          if (platform === 'pinterest' && outcome.board && outcome.board.url) postUrls.pinterest = outcome.board.url;
          resultats.push({
            reseau: platform, integrateur: 'buffer', succes: true,
            action: 'createPost', httpStatus: 200,
            message: fileAttente
              ? (modePublication === 'schedule'
                ? `Programmé via Buffer Cloud (${LABEL_RESEAU[platform]}) — post ${outcome.postId} (mode customScheduled, envoi : ${outcome.scheduledAt || outcome.dueAt})`
                : `Ajouté à la file Buffer (${LABEL_RESEAU[platform]}) — post ${outcome.postId}${outcome.dueAt ? ` — envoi prévu : ${outcome.dueAt}` : ''}`)
              : `Publié via Buffer GraphQL (${LABEL_RESEAU[platform]}) — post ${outcome.postId}`,
            postId: outcome.postId,
            mode: outcome.mode || modeBuffer,
            fileAttente,
            dueAt: outcome.dueAt || null,
            scheduledAt: outcome.scheduledAt || null,
            reponseBrute: masquerReponseBrute(outcome.reponseBrute),
            board: outcome.board || undefined,
            mediaUrlEnvoyee: outcome.mediaUrl || null,
            mediaStable: outcome.mediaStable
              ? { slug: outcome.mediaStable.slug, chemin: outcome.mediaStable.cheminRelatif, sha256: outcome.mediaStable.shaStable, cree: outcome.mediaStable.cree }
              : undefined
          });
        } else {
          const message = `Buffer GraphQL (${LABEL_RESEAU[platform]}) : ${(erreurBuf && erreurBuf.message) || 'Erreur inconnue'}`;
          erreursBuffer.push(message);
          resultats.push({
            reseau: platform, integrateur: 'buffer', succes: false,
            action: 'createPost', message,
            cause: (erreurBuf && erreurBuf.message) || null,
            code: erreurBuf && erreurBuf.code ? erreurBuf.code : undefined,
            mediaStable: erreurBuf && erreurBuf.mediaStable ? erreurBuf.mediaStable : undefined,
            reponseBrute: masquerReponseBrute(erreurBuf && erreurBuf.reponseBrute)
          });
        }
        const sjMode = fileAttente
            ? (modePublication === 'schedule' ? 'buffer-cloud-schedule' : 'buffer-queue')
            : 'buffer-graphql';
          const sjStatus = outcome ? (fileAttente ? 'scheduled' : 'published') : 'error';
          const sjDueAt = outcome ? (outcome.scheduledAt || outcome.dueAt) : (scheduledAt || null);
          journal.unshift({
          id: `${fileAttente ? 'queue' : 'pub'}_${Date.now()}_${platform}`,
          date: new Date().toISOString(),
          platform,
          content: texte,
          mediaUrl,
          // MICRO-11v2-quater : traçabilité + source + clé de dédoublonnage.
          postId: outcome ? outcome.postId : undefined,
          source: 'dashboard',
          produitId: produitIdEntree({ mediaUrl }) || undefined,
          isoUTC: sjDueAt || new Date().toISOString(),
          mediaUrlStable: outcome && outcome.mediaStable && outcome.mediaStable.cheminRelatif
            ? `${PUBLIC_MEDIA_BASE}${outcome.mediaStable.cheminRelatif}`
            : undefined,
          videoUrl: videoUrl || undefined,
          mediaType,
          status: sjStatus,
          scheduleDate: sjDueAt,
          integrateur: 'buffer',
          mode: sjMode,
          fileAttente,
          dueAt: sjDueAt,
          channelIds: ((outcome && outcome.channelId) || (erreurBuf && erreurBuf.channelId))
            ? [(outcome && outcome.channelId) || (erreurBuf && erreurBuf.channelId)]
            : undefined,
          board: outcome && outcome.board
            ? { id: outcome.board.id, serviceId: outcome.board.serviceId, name: outcome.board.name, url: outcome.board.url }
            : undefined,
          error: outcome ? undefined : (erreurBuf && erreurBuf.message) || 'Erreur Buffer inconnue',
          // P2a (N2) : code d'erreur tracé pour la liste des erreurs sociales.
          code: outcome ? undefined : ((erreurBuf && erreurBuf.code) || undefined)
        });
      } else {
        const message = `Plateforme non supportée : ${platform}`;
        erreursBuffer.push(message);
        resultats.push({ reseau: platform, integrateur: 'inconnu', succes: false, message });
      }
    }

    // 🔭 Instrumentation demandée : slug + statut PAR RÉSEAU (traçabilité des
    // envois réels ; un « succes » sans appel HTTP devient immédiatement visible).
    console.log('[publication] plateformes autorisées :', autorises.join(', '));
    resultats.forEach((r) => {
      console.log(`[publication] ${r.reseau} | statut=${r.succes ? 'succes' : 'echec'} | integrateur=${r.integrateur} | action=${r.action || '-'}${r.httpStatus !== undefined ? ` | HTTP=${r.httpStatus}` : ''}`);
    });
    refus.forEach((r) => {
      console.log(`[publication] ${r.reseau} | statut=refus (garde-fou anti-doublon) | ${r.message}`);
    });

    // 🗂️ MICRO-11v2-quater : normalisation ISO + dédoublonnage + archivage.
    // Le journal actif ne garde que les entrées non archivables ; published/
    // error partent dans journal-YYYY-MM.json (historique reconstitué à la lecture).
    try {
      enregistrerEntreesJournal(journal);
    } catch (e) {
      console.warn(`[journal] écriture : ${e.message}`);
      fs.writeFileSync(SOCIAL_JOURNAL_PATH, JSON.stringify(journal, null, 2), 'utf-8');
    }

    // Erreurs regroupées dans le bloc de l'intégrateur unique (Buffer).
    // Neutralisation 19/09/2026 : plus de bloc alternatif.
    const erreursParIntegrateur = [];
    if (erreursBuffer.length) {
      erreursParIntegrateur.push({ integrateur: 'buffer', label: 'Buffer (Facebook / Instagram / Pinterest)', erreurs: erreursBuffer });
    }
    const erreursPlates = [...erreursBuffer];
    const reseauxPublies = resultats.filter((r) => r.succes).map((r) => r.reseau);
    const reseauxEchoues = resultats.filter((r) => !r.succes).map((r) => r.reseau);
    const reseauxRefuses = refus.map((r) => r.reseau);
    const reseauxNonEnvoyes = [];

    // MICRO-8 — URL vidéo liée à la FICHE : à l'envoi réussi, si l'URL collée
    // diffère de fiche.videoUrl, la fiche est mise à jour (backup horodaté,
    // recherche par nom exact — jamais par rang) + journal mode 'videoUrl-maj'.
    // Jamais bloquant : toute erreur est loggée et ignorée (réponse inchangée).
    let videoUrlMaj = null;
    if (mediaType === 'video' && videoUrl && reseauxPublies.length && produitNom) {
      try {
        const ficheCourante = trouverFiche(produitNom).fiche;
        const ancienneUrl = String((ficheCourante && ficheCourante.videoUrl) || '').trim();
        if (ancienneUrl !== videoUrl) {
          const resMaj = definirVideoUrlFiche({ nom: produitNom, videoUrl });
          videoUrlMaj = { ancienne: resMaj.ancienne || null, nouvelle: videoUrl, backup: resMaj.backupDir || null };
          journaliserIntegration({
            type: 'videoUrl-maj', integrateur: 'local', reseau: reseauxPublies.join(', '),
            produit, produitNom, statut: 'succes',
            ancienneUrl: videoUrlMaj.ancienne, nouvelleUrl: videoUrl,
            mode: 'videoUrl-maj'
          });
        }
      } catch (e) { console.warn('[videoUrl-maj] mise à jour ignorée :', e.message); }
    }
    const parReseau = {};
    resultats.forEach((r) => {
      parReseau[r.reseau] = { statut: r.succes ? 'succes' : 'echec', message: r.message, mode: r.mode || modeBuffer, fileAttente: !!r.fileAttente, dueAt: r.dueAt || null };
    });
    refus.forEach((r) => {
      parReseau[r.reseau] = { statut: 'refus', message: r.message };
    });

    if (erreursPlates.length) {
      // error = 1re erreur Buffer (intégrateur unique depuis le 19/09/2026).
      // SUCCES PARTIEL : les reseaux autorises partis avec succes restent acquis
      // meme si d'autres echouent ; les refus garde-fou sont joints (pas d'annulation).
      // `succesPartiel` + `message` explicites : le dashboard NE DOIT PAS afficher
      // « Publication réussie » global quand un reseau a echoue (bug du faux
      // succes Instagram du 17/09/2026) → il affiche « Publication partielle »
      // avec Diffusé sur = reseauxPublies UNIQUEMENT + la cause par réseau.
      const partiel = reseauxPublies.length > 0;
      return {
        success: partiel,
        succesPartiel: partiel,
        message: partiel
          ? `Publication PARTIELLE — réussis : ${reseauxPublies.join(' + ') || 'aucun'} · en échec : ${[...reseauxEchoues, ...reseauxRefuses].join(' + ') || 'aucun'}`
          : null,
        error: erreursPlates[0],
        errors: erreursPlates,
        erreursParIntegrateur,
        refusDoublon: refus,
        resultats, reseauxPublies, reseauxEchoues, reseauxRefuses, reseauxNonEnvoyes,
        parReseau, postUrls, variantes, textesEnvoyes,
        produit, produitNom, mediaUrl, mediaType, modePublication, mode: modeBuffer, fileAttente,
        videoUrlMaj: videoUrlMaj || undefined
      };
    }
    return {
      success: true,
      succesPartiel: false,
      platform: autorises.join(','),
      message: fileAttente ? 'Ajouté à la file Buffer (GraphQL)' : 'Publie via Buffer (GraphQL)',
      erreursParIntegrateur: [],
      refusDoublon: refus,
      resultats, reseauxPublies, reseauxEchoues, reseauxRefuses, reseauxNonEnvoyes,
      parReseau, postUrls, variantes, textesEnvoyes,
      produit, produitNom, mediaUrl, mediaType, modePublication, mode: modeBuffer, fileAttente,
      videoUrlMaj: videoUrlMaj || undefined
    };
}

// POST /api/social/appliquer-limites — bouton « ✂️ Appliquer la limite » PAR CHAMP
// (dashboard, 20/09/2026). SOURCE DE VÉRITÉ UNIQUE : les MÊMES fonctions pures
// que le garde-fou d'envoi (social-variants.js + buffer-graphql.js).
// Entrée : { reseau: 'pinterest'|'instagram'|'facebook', champs: {...} }.
//   pinterest : titre ≤ 100 PUIS total titre+1+description ≤ 500 (ligne WhatsApp
//               retirée d'abord, mots-clés sacrifiés en premier, coupe mot-entier) ;
//   instagram : légende ≤ 200 (CTA « lien en bio » conservé en fin,
//               nom d'œuvre entre « … » jamais amputé), hashtags dédup ≤ 11, alt ≤ 500 ;
//   facebook  : texte ≤ 400 (CTA WhatsApp + lien site conservés en fin), alt ≤ 500.
// Sortie : { success, reseau, champs: {...corrigés}, corriges: [champs modifiés] }.
app.post('/api/social/appliquer-limites', (req, res) => {
  try {
    const { reseau, champs } = req.body || {};
    const brut = (champs && typeof champs === 'object') ? champs : {};
    // Anti-vidage (20/09/2026) : alias de clés toléré (`desc` → `description`,
    // formes historiques du dashboard) — une clé absente/mal nommée ne produit
    // plus jamais de valeur undefined côté écriture (garde dashboard exigée).
    const c = { ...brut };
    if (c.description === undefined && c.desc !== undefined) c.description = c.desc;
    const corriges = [];
    if (reseau === 'pinterest') {
      const rTitre = plafonnerTitrePinterest(c.titre ?? '');
      if (rTitre.corrige) corriges.push('titre');
      const garde = appliquerLimitePinterest500(rTitre.texte + '\n' + String(c.description ?? ''));
      if (garde.tronque) corriges.push('description');
      const champsPin = { titre: garde.titre, description: garde.description };
      if (c.alt !== undefined) {
        const rAlt = plafonnerAlt(c.alt);
        champsPin.alt = rAlt.texte;
        if (rAlt.corrige) corriges.push('alt');
      }
      return res.json({
        success: true, reseau, corriges, totalApres: garde.totalApres, champs: champsPin
      });
    }
    if (reseau === 'instagram') {
      const out = {};
      const rLeg = plafonnerLegendeInstagram(c.legende ?? '');
      out.legende = rLeg.texte;
      if (rLeg.corrige) corriges.push('legende');
      const rTag = plafonnerHashtags(c.hashtags ?? '');
      out.hashtags = rTag.texte;
      if (rTag.corrige) corriges.push('hashtags');
      if (c.alt !== undefined) {
        const rAlt = plafonnerAlt(c.alt);
        out.alt = rAlt.texte;
        if (rAlt.corrige) corriges.push('alt');
      }
      return res.json({ success: true, reseau, champs: out, corriges });
    }
    if (reseau === 'facebook') {
      const out = {};
      const rTxt = plafonnerTexteFacebook(c.texte ?? '');
      out.texte = rTxt.texte;
      if (rTxt.corrige) corriges.push('texte');
      if (c.alt !== undefined) {
        const rAlt = plafonnerAlt(c.alt);
        out.alt = rAlt.texte;
        if (rAlt.corrige) corriges.push('alt');
      }
      return res.json({ success: true, reseau, champs: out, corriges });
    }
    return res.json({ success: false, error: `Réseau non pris en charge : ${reseau || '(absent)'}` });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ═══ QUARANTAINE P0 audit 24/09 (G1) : garde-fou anti-doublon ATOMIQUE ═══
// Map clé (produit + réseaux) -> promesse de fin d'exécution en cours.
// Sérialise lecture-garde + envoi + journalisation : 2 publishes concurrents
// du même contenu ne peuvent plus passer le garde-fou tous les deux
// (preuves AUDIT-2026-09-24/preuves/bloc2.md §5 : 2/2 succès avant mutex).
const VERROUS_PUBLICATION = new Map();
function clePublicationDepuisBody(body, ciblesForcees) {
  const b = body || {};
  const plats = (Array.isArray(ciblesForcees) && ciblesForcees.length)
    ? ciblesForcees
    : (Array.isArray(b.plateformes) && b.plateformes.length ? b.plateformes : (b.platform ? [b.platform] : []));
  const ids = [b.produitId, b.produitNom, nomProduitDepuisUrl(b.mediaUrl)]
    .filter(Boolean).map((v) => String(v).toLowerCase()).sort().join('|');
  return plats.map((p) => String(p).toLowerCase()).sort().join(',') + '§' + ids;
}
async function avecVerrouPublication(cle, fn) {
  const precedent = VERROUS_PUBLICATION.get(cle) || Promise.resolve();
  let liberer;
  const actuel = new Promise((res) => { liberer = res; });
  VERROUS_PUBLICATION.set(cle, actuel);
  try { try { await precedent; } catch { /* prédécesseur en échec : on exécute quand même */ } return await fn(); }
  finally { liberer(); if (VERROUS_PUBLICATION.get(cle) === actuel) VERROUS_PUBLICATION.delete(cle); }
}

// POST /api/social/publish — publication multi-réseaux DURCIE (Phase B)
app.post('/api/social/publish', async (req, res) => {
  try {
    const reponse = await avecVerrouPublication(
      clePublicationDepuisBody(req.body || {}, null),
      async () => executerPublication(req.body || {}, null));
    res.json(reponse);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// POST /api/social/retry-failed — « Réessayer les réseaux en échec uniquement »
// Ne renvoie QUE les réseaux en échec : jamais Pinterest s'il a réussi.
app.post('/api/social/retry-failed', async (req, res) => {
  try {
    const body = req.body || {};
    const produit = body.produitId || body.produitNom || nomProduitDepuisUrl(body.mediaUrl) || null;
    let reseaux = Array.isArray(body.reseauxEchoues) && body.reseauxEchoues.length ? body.reseauxEchoues : null;
    if (!reseaux) {
      // Dérivation depuis journal_integrations.json : dernière tentative de l'œuvre
      const entrees = lireJournalIntegrations()
        .filter((e) => e.type === 'publication' && e.produit && produit
          && String(e.produit).toLowerCase() === String(produit).toLowerCase())
        .sort((a, b) => dateEntree(b) - dateEntree(a));
      const derniers = {};
      entrees.forEach((e) => {
        const r = String(e.reseau || '').toLowerCase();
        if (r && derniers[r] === undefined) derniers[r] = String(e.statut || '').toLowerCase();
      });
      reseaux = Object.keys(derniers)
        .filter((r) => !['succes', 'published', 'reussi', 'success'].includes(derniers[r]));
    }
    if (!reseaux || !reseaux.length) {
      return res.json({ success: false, error: 'Aucun réseau en échec à réessayer pour cette œuvre.' });
    }
    const reponse = await avecVerrouPublication(
      clePublicationDepuisBody(body, reseaux),
      async () => executerPublication(body, reseaux));
    // Sécurité : un réseau publié avec succès sous 24 h n'est JAMAIS renvoyé,
    // même si le dashboard l'a inclus par erreur dans reseauxEchoues.
    const forcerRetry = body.forcer === true || body.forcerRepublication === true;
    const dejaPublies = (reponse.refusDoublon || []).map((r) => String(r.reseau || '').toLowerCase());
    const reseauxEchouesFiltres = (reponse.reseauxEchoues || []).filter((r) => !dejaPublies.includes(String(r).toLowerCase()));
    const reseauxPubliesFiltres = (reponse.reseauxPublies || []).filter((r) => !dejaPublies.includes(String(r).toLowerCase()));
    if (dejaPublies.length && !forcerRetry) {
      reponse.reseauxPublies = reseauxPubliesFiltres;
      reponse.reseauxEchoues = reseauxEchouesFiltres;
      reponse.reseauxIgnores = dejaPublies;
      reponse.message = (reponse.message ? reponse.message + ' ' : '') + 'Réseau(x) déjà publié(s) non renvoyé(s) : ' + dejaPublies.join(', ') + '.';
    }
    res.json(reponse);
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET /api/social/videos — inventaire des MP4 locaux (lecture dashboard).
// Convention : videos/produit-N.mp4 (+ variante 9:16 videos/produit-N-reel.mp4).
// Réponse : [{ produit, variante, fichier, urlLocale, tailleOctets }].
// Dossier absent → [] (garde sans crash). La DURÉE est lue côté dashboard
// (métadonnées <video> sur l'URL locale) — aucun ffprobe côté serveur.
app.get('/api/social/videos', (req, res) => {
  try {
    if (!fs.existsSync(VIDEOS_DIR)) return res.json({ success: true, videos: [] });
    const videos = fs.readdirSync(VIDEOS_DIR)
      .filter((f) => /^produit-\d+(?:-reel)?\.mp4$/i.test(f))
      .map((f) => {
        const m = f.match(/^produit-(\d+)(-reel)?\.mp4$/i);
        let tailleOctets = 0;
        try { tailleOctets = fs.statSync(path.join(VIDEOS_DIR, f)).size; } catch (e) { tailleOctets = 0; }
        return {
          produit: `produit-${Number(m[1])}`,
          variante: m[2] ? 'reel' : 'standard',
          fichier: f,
          urlLocale: `/videos/${encodeURIComponent(f)}`,
          tailleOctets
        };
      })
      .sort((a, b) => a.fichier.localeCompare(b.fichier));
    res.json({ success: true, videos });
  } catch (err) {
    res.json({ success: false, error: err.message, videos: [] });
  }
});

// GET /api/social/verifier-video?url=… — pré-contrôle vidéo DÉLÉGUÉ au serveur.
// Le navigateur ne peut PAS vérifier les URLs cross-origin avec redirect
// (ex. miroirs archive.org sans CORS → NetworkError, boutons bloqués À TORT)
// : seule autorité fiable = le serveur (verifierVideoPublique : HEAD
// Content-Length honnête + Range, sans CORS — mêmes gardes et mêmes messages
// actionnables que l'envoi : localhost, https, HEAD 0, type non-video).
// Réponse : { ok, cause, contentLength, contentType, url }.
app.get('/api/social/verifier-video', async (req, res) => {
  try {
    const url = String(req.query.url || '').trim();
    const taille = Number(req.query.tailleAttendue);
    const v = await verifierVideoPublique(url, Number.isFinite(taille) && taille > 0 ? taille : undefined);
    res.type('application/json').json({
      ok: v.ok === true,
      cause: v.ok ? null : (v.erreur || 'Vérification impossible'),
      contentLength: (v.contentLength ?? null),
      contentType: (v.contentType || null),
      url: v.url ?? null
    });
  } catch (err) {
    res.type('application/json').json({ ok: false, cause: err.message, contentLength: null, contentType: null, url: null });
  }
});

// GET /api/social/variantes?produit=produit-9 — aperçu des 3 légendes DISTINCTES
app.get('/api/social/variantes', (req, res) => {
  try {
    const critere = req.query.produit || req.query.produitId || null;
    const { fiche } = trouverFiche(critere);
    const variantes = genererVariantes(fiche || { nom: critere || 'Œuvre unique' });
    // SESSION 2026-09-18 (alt text) : introspection LIVE api.buffer.com du
    // 18/09/2026 (clé .env) → ImageMetadataInput.altText = NON_NULL String!
    // via assets[].image.metadata → l'alt text des 3 réseaux EST transmis
    // dans createPost (buffer-graphql.js: assets[0].image.metadata.altText).
    // Le champ « Texte alternatif » du composeur n'est donc PAS une simple
    // documentation locale.
    res.json({
      success: true,
      produit: critere,
      fiche: fiche ? { nom: fiche.nom, categorie: fiche.categorie, prix: fiche.prix, image: fiche.image } : null,
      variantes,
      // Légende IG PRÊTE POUR L'ÉDITEUR : CTA « lien en bio » inclus dans le
      // champ légende (plus d'écart aperçu/texte envoyé).
      editeurInstagram: legendeEditeurInstagram(fiche || { nom: critere || 'Œuvre unique' }),
      altTextSupporte: true,
      hashes: {
        instagram: hashContenu(variantes.instagram),
        facebook: hashContenu(variantes.facebook),
        pinterest: hashContenu(variantes.pinterest)
      },
      titrePinterest: titrePinterest(fiche || {})
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Programmation d'une publication — PROGRAMMATION BUFFER CLOUD RÉELLE (MICRO-11)
app.post('/api/social/schedule', async (req, res) => {
  try {
    const { platform, content, mediaUrl, scheduleDate, produitId, produitNom, copies, alt, title, link } = req.body;

    // Validation : date requise, plateforme unique, mediaUrl requise
    if (!platform || !['facebook', 'instagram', 'pinterest'].includes(platform)) {
      return res.json({ success: false, error: 'Plateforme invalide ou manquante (facebook, instagram, pinterest)' });
    }
    if (!scheduleDate) {
      return res.json({ success: false, error: 'Date/heure de programmation requise (scheduleDate ISO 8601)' });
    }
    // Buffer `dueAt` = DateTime : on n'accepte qu'un INSTANT valide. Une date
    // sans fuseau (« 2026-10-27T14:30 ») serait interprétée en UTC ou refusée →
    // normalisation ISO explicite + refus des dates passées.
    const dateProg = new Date(scheduleDate);
    if (Number.isNaN(dateProg.getTime())) {
      return res.json({ success: false, error: `Date de programmation invalide : « ${scheduleDate} » (ISO 8601 attendu).` });
    }
    if (dateProg.getTime() <= Date.now() + 60 * 1000) {
      return res.json({ success: false, error: 'La date de programmation doit être dans le futur (au moins +1 minute).' });
    }
    const scheduledAtIso = dateProg.toISOString();
    if (!mediaUrl) {
      return res.json({ success: false, error: 'mediaUrl requise pour la programmation' });
    }

    // Résoudre le produit (via produitId, produitNom, ou mediaUrl)
    const critere = produitId || produitNom || nomProduitDepuisUrl(mediaUrl) || null;
    const { fiche } = trouverFiche(critere);
    const produitNomFinal = fiche?.nom || produitNom || nomProduitDepuisUrl(mediaUrl) || 'Œuvre inconnue';
    const produitCles = [...new Set([produitId, produitNom, nomProduitDepuisUrl(mediaUrl), fiche?.nom, fiche && nomProduitDepuisUrl(fiche?.image), critere].filter(Boolean).map(String))];

    // Vérifier média public AVANT envoi (même logique que /api/social/publish)
    const mediaType = req.body.mediaType || 'image';
    let finalMediaUrl = mediaUrl;
    let finalVideoUrl = null;
    if (mediaType === 'video') {
      const verifVideo = await verifierVideoPublique(mediaUrl);
      if (!verifVideo.ok) {
        return res.json({ success: false, error: verifVideo.erreur });
      }
      finalVideoUrl = verifVideo.url;
    } else {
      const verifMedia = await verifierMediaPublic(mediaUrl, fiche);
      if (!verifMedia.ok) {
        return res.json({ success: false, error: verifMedia.erreur });
      }
      finalMediaUrl = verifMedia.url;
    }

    // Garde-fou anti-doublon 24h (même logique)
    const forcer = req.body.forcer === true;
    const etat = verifierAntiDoublon(produitCles, platform, forcer);
    if (etat.bloque) {
      return res.json({ success: false, error: etat.message, refusDoublon: true, heures: etat.heures });
    }

    // Appel Buffer GraphQL avec mode 'schedule' + dueAt explicite + URL stable
    // (résolution DYNAMIQUE depuis contenu.js courant, produitNom = identité fiable)
    const outcome = await publierViaBufferGraphql({
      reseau: platform,
      texte: content,
      mediaUrl: finalMediaUrl,
      alt: alt || '',
      titrePin: title || '',
      lien: link || '',
      modePublication: 'schedule',
      mediaType,
      videoUrl: finalVideoUrl,
      scheduledAt: scheduledAtIso,
      useStableUrl: mediaType !== 'video',
      produitNom: produitNomFinal
    });

    // Journal intégrations (traçabilité complète)
    const LABEL_RESEAU = { facebook: 'Facebook', instagram: 'Instagram', pinterest: 'Pinterest' };
    journaliserIntegration({
      type: 'publication', integrateur: 'buffer', reseau: LABEL_RESEAU[platform],
      produit: produitCles[0] || 'inconnu', produitNom: produitNomFinal,
      statut: 'succes', httpStatus: 200,
      message: `Programmé via Buffer Cloud (${LABEL_RESEAU[platform]}) — post ${outcome.postId} (mode customScheduled, envoi : ${outcome.scheduledAt || outcome.dueAt})`,
      cause: null, code: undefined,
      reponseBrute: masquerReponseBrute(outcome.reponseBrute),
      mediaUrl: finalMediaUrl, videoUrl: finalVideoUrl || undefined, mediaType,
      hashContenu: hashContenu(content), contenu: content,
      channelIds: outcome.channelId ? [outcome.channelId] : undefined,
      mode: outcome.mode || 'customScheduled',
      integratorMode: 'buffer-cloud-schedule',
      fileAttente: true,
      dueAtRetour: outcome.scheduledAt || outcome.dueAt || null,
      board: outcome.board ? { id: outcome.board.id, name: outcome.board.name, serviceId: outcome.board.serviceId, url: outcome.board.url } : undefined,
      scheduledAt: outcome.scheduledAt || outcome.dueAt || null
    });

    // Journal social (dashboard) — module unique : ISO UTC, dédoublonnage,
    // source dashboard, archivage. SOCIAL_JOURNAL_PATH est respecté (tests).
    try {
      ajouterEntreeJournal({
        id: `queue_${Date.now()}_${platform}`,
        date: new Date().toISOString(),
        platform,
        content,
        mediaUrl: finalMediaUrl,
        postId: outcome.postId,
        source: 'dashboard',
        produitId: produitIdEntree({ mediaUrl: finalMediaUrl }) || undefined,
        isoUTC: outcome.scheduledAt || outcome.dueAt || scheduledAtIso || null,
        mediaUrlStable: outcome.mediaStable && outcome.mediaStable.cheminRelatif
          ? `${PUBLIC_MEDIA_BASE}${outcome.mediaStable.cheminRelatif}`
          : undefined,
        // Média réellement envoyé (URL stable) + preuve SHA (MICRO-11v2-ter)
        mediaUrlEnvoyee: outcome.mediaUrl || null,
        mediaStable: outcome.mediaStable
          ? { slug: outcome.mediaStable.slug, chemin: outcome.mediaStable.cheminRelatif, sha256: outcome.mediaStable.shaStable, cree: outcome.mediaStable.cree }
          : undefined,
        videoUrl: finalVideoUrl || undefined,
        mediaType,
        status: 'scheduled',
        scheduleDate: outcome.scheduledAt || outcome.dueAt || scheduledAtIso,
        integrateur: 'buffer',
        mode: 'buffer-cloud-schedule',
        fileAttente: true,
        dueAt: outcome.scheduledAt || outcome.dueAt || null,
        channelIds: outcome.channelId ? [outcome.channelId] : undefined,
        board: outcome.board ? { id: outcome.board.id, serviceId: outcome.board.serviceId, name: outcome.board.name, url: outcome.board.url } : undefined
      });
    } catch (e) {
      console.warn(`[journal] programmation : ${e.message}`);
    }

    res.json({
      success: true,
      message: `Programmé via Buffer Cloud — envoi prévu le ${new Date(outcome.scheduledAt || outcome.dueAt || scheduledAtIso).toLocaleString('fr-FR', { timeZone: 'UTC' })} UTC`,
      postId: outcome.postId,
      dueAt: outcome.scheduledAt || outcome.dueAt,
      mode: 'buffer-cloud-schedule',
      mediaUrlEnvoyee: outcome.mediaUrl || null,
      mediaStable: outcome.mediaStable
        ? { slug: outcome.mediaStable.slug, chemin: outcome.mediaStable.cheminRelatif, sha256: outcome.mediaStable.shaStable, cree: outcome.mediaStable.cree }
        : undefined
    });
  } catch (err) {
    // Erreur Buffer (quota, auth, etc.) OU garde-fou média stable → message
    // clair + code machine (MEDIA_STABLE_DESYNC / _ABSENT / _RANG_INCONNU…).
    res.json({
      success: false,
      error: err.message || 'Erreur lors de la programmation Buffer',
      code: err && err.code ? err.code : undefined,
      mediaStable: err && err.mediaStable ? err.mediaStable : undefined
    });
  }
});

// ── INVENTAIRE BUFFER — RÉFÉRENTIEL UNIQUE DU GARDE-FOU SHIFT ──────────
// Lecture seule GraphQL : posts scheduled/queued des canaux gérés.
// Aucune décision ici : le filtre « à re-médier » vit dans shift-guard.js
// (statut + dueAt futur + média rang + source dashboard).
const QUERY_POSTS_QUEUE = `
  query GetPosts($input: PostsInput!) {
    posts(input: $input) {
      edges {
        node {
          id
          text
          status
          dueAt
          channel { id name service }
          assets { source }
        }
      }
    }
  }
`;

async function lireInventaireBuffer() {
  const canaux = await lireCanaux();
  const orgId = process.env.BUFFER_ORGANIZATION_ID;
  if (!orgId) throw new Error('BUFFER_ORGANIZATION_ID manquant');

  const { data, reponseBrute } = await requeteGraphQL({
    query: QUERY_POSTS_QUEUE,
    variables: { input: { organizationId: orgId } }
  });
  const edges = (data && data.posts && data.posts.edges) ? data.posts.edges : [];

  const canauxById = {};
  for (const [reseau, channelId] of Object.entries(canaux)) {
    if (channelId) canauxById[channelId] = reseau;
  }

  const posts = [];
  for (const edge of edges) {
    const post = edge && edge.node;
    if (!post) continue;
    const channelId = post.channel && post.channel.id;
    const reseau = canauxById[channelId];
    if (!reseau) continue; // canal non géré (ex. Twitter, LinkedIn)
    if (post.status !== 'scheduled' && post.status !== 'queued') continue;

    posts.push({
      postId: post.id,
      reseau,
      channelId,
      channelName: post.channel && post.channel.name,
      channelService: post.channel && post.channel.service,
      texte: post.text ? post.text.slice(0, 120) : '',
      statut: post.status,
      dueAt: post.dueAt,
      mediaUrl: (post.assets && post.assets[0] && post.assets[0].source) || null,
      reponseBrute: masquerSecrets(reponseBrute)
    });
  }
  return { posts, canaux };
}

// 📬 INVENTAIRE FILE BUFFER (MICRO-11) — lecture seule, badge source.
app.get('/api/social/buffer-queue', async (req, res) => {
  try {
    const { posts } = await lireInventaireBuffer();
    const index = indexerJournal(lireJournalComplet());
    for (const p of posts) {
      p.source = sourcePourPost(p, index);
      // « inconnu » = absent du journal dashboard → programmé à la main sur
      // Buffer Web (vidéos) : jamais re-médié par le garde-fou.
      p.inconnu = p.source === 'manuel-buffer';
    }
    res.json({ success: true, posts });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 🛡️ GARDE-FOU SHIFT (MICRO-11v2-quater) — référentiel = inventaire Buffer.
// Renvoie UNIQUEMENT les posts futurs qui portent encore un rang, hors
// source manuel-buffer, avec la suggestion stable lue à l'affichage.
app.get('/api/social/shift-guard', async (req, res) => {
  try {
    const { posts } = await lireInventaireBuffer();
    const journal = lireJournalComplet();
    const sujets = construireSujets(posts, { journal });
    const edition = await sonderEditionPost();
    res.json({
      success: true,
      now: new Date().toISOString(),
      total: sujets.length,
      posts: sujets,
      edition,
      filtre: EXPLICATION_FILTRE
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Vérifie que l'URL stable est réellement servie (GitHub Pages) avant de
// toucher au post Buffer : une copie créée par resync n'est pas déployée.
async function urlPubliqueDisponible(url) {
  try {
    const reponse = await fetch(url, { method: 'HEAD' });
    if (reponse.status === 405) return true; // HEAD refusé mais GET possible
    return reponse.ok;
  } catch {
    return false;
  }
}

// 🔧 RE-MÉDIATION BULK — editPost (assets) si supporté, sinon liste manuelle.
app.post('/api/social/shift-guard/remedier', async (req, res) => {
  try {
    const { postIds, forcer = false } = req.body || {};
    const { posts } = await lireInventaireBuffer();
    const journal = lireJournalComplet();
    let sujets = construireSujets(posts, { journal });

    if (Array.isArray(postIds) && postIds.length) {
      const demandes = new Set(postIds.map(String));
      sujets = sujets.filter((s) => demandes.has(String(s.postId)));
    }
    if (!sujets.length) {
      return res.json({
        success: true, total: 0, supporte: true, remediés: 0, echecs: [],
        message: 'Aucun post futur à re-médier.'
      });
    }

    const edition = await sonderEditionPost();
    if (!edition.supporte) {
      return res.json({
        success: true,
        supporte: false,
        edition,
        total: sujets.length,
        aEditerManuellement: listeManuelle(sujets),
        message: 'Édition automatique non supportée par Buffer — éditez ces posts manuellement.'
      });
    }

    const resultats = [];
    for (const sujet of sujets) {
      if (!sujet.stableUrl) {
        resultats.push({
          postId: sujet.postId, ok: false,
          error: sujet.erreurStable || 'URL stable indisponible',
          code: 'MEDIA_STABLE_INDISPONIBLE'
        });
        continue;
      }
      if (!forcer) {
        const dispo = await urlPubliqueDisponible(sujet.stableUrl);
        if (!dispo) {
          resultats.push({
            postId: sujet.postId, ok: false,
            code: 'MEDIA_STABLE_NON_DEPLOYE',
            error: `URL stable non servie (404) : ${sujet.stableUrl} — commit/push site-web requis.`
          });
          continue;
        }
      }
      try {
        const outcome = await remesierPostMedia({
          postId: sujet.postId,
          stableUrl: sujet.stableUrl,
          altText: sujet.altText || ''
        });
        marquerJournalRemedie(sujet.postId, sujet.stableUrl, { candidat: sujet });
        resultats.push({
          postId: sujet.postId, ok: true,
          stableUrl: sujet.stableUrl, post: outcome
        });
      } catch (e) {
        resultats.push({
          postId: sujet.postId, ok: false,
          error: e.message, code: e.code || null
        });
      }
    }

    const remediés = resultats.filter((r) => r.ok).length;
    res.json({
      success: true,
      supporte: true,
      edition,
      total: sujets.length,
      remediés,
      echecs: resultats.filter((r) => !r.ok),
      resultats
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 📅 PROCHAINS CRÉNEAUX PAR CANAL (MICRO-11) : simule un addToQueue
// pour chaque plateforme demandée et renvoie le dueAt prévu.
// Si scheduledAt fourni → mode customScheduled (date choisie).
// Sinon → mode addToQueue (prochain créneau auto du canal).
app.post('/api/social/buffer-next-slots', async (req, res) => {
  try {
    const { platforms, scheduledAt } = req.body;
    if (!Array.isArray(platforms) || !platforms.length) {
      return res.json({ success: false, error: 'Platforms array requis' });
    }
    const canaux = await lireCanaux();
    const slots = {};

    for (const p of platforms) {
      const channelId = canaux[p];
      if (!channelId) {
        slots[p] = { erreur: `Canal ${p} non configuré` };
        continue;
      }
      if (scheduledAt) {
        // Mode customScheduled : la date est imposée par l'utilisateur
        slots[p] = { mode: 'customScheduled', dueAt: scheduledAt };
      } else {
        // Mode addToQueue : simuler via un createPost "dry-run" n'est pas possible
        // sans envoyer vraiment. On renvoie une estimation basée sur l'heure actuelle
        // et la règle du canal (Buffer gère sa file interne).
        // Pour l'affichage prévisionnel, on indique que Buffer choisira.
        slots[p] = { mode: 'addToQueue', dueAt: null, note: 'Buffer attribue le prochain créneau libre du canal' };
      }
    }
    res.json({ success: true, slots });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Historique des publications (actif + archives, dédoublonné).
// ?actif=1 → journal actif seul (fichier court).
app.get('/api/social/journal', (req, res) => {
  try {
    const journal = req.query.actif === '1'
      ? lireJournalActif().map(normaliserEntree)
      : lireJournalComplet();
    res.json({ success: true, journal });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Statistiques par plateforme (historique complet : actif + archives)
app.get('/api/social/stats', (req, res) => {
  try {
    const journal = lireJournalComplet();
    const stats = { facebook: 0, instagram: 0, pinterest: 0 };
    journal.forEach(entry => {
      if (stats[entry.platform] !== undefined) stats[entry.platform]++;
    });
    res.json({ success: true, stats });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Gestion des brouillons
app.get('/api/social/drafts', (req, res) => {
  try {
    if (!fs.existsSync(SOCIAL_DRAFTS_PATH)) {
      return res.json({ success: true, drafts: [] });
    }
    const drafts = JSON.parse(fs.readFileSync(SOCIAL_DRAFTS_PATH, 'utf-8'));
    res.json({ success: true, drafts });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/social/drafts', (req, res) => {
  try {
    let drafts = [];
    if (fs.existsSync(SOCIAL_DRAFTS_PATH)) {
      drafts = JSON.parse(fs.readFileSync(SOCIAL_DRAFTS_PATH, 'utf-8'));
    }
    const draft = { id: `draft_${Date.now()}`, ...req.body, createdAt: new Date().toISOString() };
    drafts.unshift(draft);
    fs.writeFileSync(SOCIAL_DRAFTS_PATH, JSON.stringify(drafts, null, 2), 'utf-8');
    res.json({ success: true, draft });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/api/social/drafts/:id', (req, res) => {
  try {
    if (!fs.existsSync(SOCIAL_DRAFTS_PATH)) {
      return res.json({ success: false, error: 'Aucun brouillon' });
    }
    let drafts = JSON.parse(fs.readFileSync(SOCIAL_DRAFTS_PATH, 'utf-8'));
    drafts = drafts.filter(d => d.id !== req.params.id);
    fs.writeFileSync(SOCIAL_DRAFTS_PATH, JSON.stringify(drafts, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ==========================================
// 💰 SYNCHRO PRIX — routes admin (ajout v2, bouton Tour de Contrôle)
//   GET  /api/control-tower/sync-prix/preview  → lecture seule (dry-run/preview)
//   POST /api/control-tower/sync-prix/run      → tarifs puis contenu (--apply)
// Auth : X-Tower-Token (temps constant) + Referer localhost/tour-de-controle.html.
// Indépendant de Groq : si GROQ_API_KEY est absente/invalide, ces routes marchent.
// TOUTES les réponses et logs passent par masquerSecrets() (gsk_*** — jamais de clé).
// ==========================================

const TOWER_SYNC_TOKEN = String(process.env.TOWER_SYNC_TOKEN || '').trim();
const SYNC_TARIFS_SCRIPT = path.join(ROOT_DIR, 'registre', 'synchro_tarifs_unifie.mjs');
const SYNC_CONTENU_SCRIPT = path.join(ROOT_DIR, 'registre', 'synchro_contenu_images.mjs');
const SYNC_HTML_UNIFIE = path.join(ROOT_DIR, 'registre', 'Registre-Tarifs-2026-09-14-Unifie.html');
const SYNC_CONTENU_JS = path.join(SITE_DIR, 'contenu.js');
const SYNC_BACKUP_DIR = path.join(ROOT_DIR, 'sauvegardes', 'sync-prix');
const SYNC_JOURNAL_JSON = path.join(ROOT_DIR, 'journaux', 'sync-prix-journal.json');

/** Lecture des 5 taux v7 — garde de version (v6 détecté → erreur claire). */
function lireTauxV7() {
  const chemin = path.join(ROOT_DIR, 'tarifs.json');
  const t = JSON.parse(fs.readFileSync(chemin, 'utf-8'));
  if (t.version === 'v6') throw new Error('tarifs.json v6 détecté, attendu v7');
  if (t.version !== 'v7') throw new Error('tarifs.json : version inattendue « ' + (t.version || '(absente)') + ' », attendu v7');
  const tmp = t.taux_matieres_premieres || {};
  return {
    bache_m2: tmp.bache_m2,
    canvas_m2: tmp.canvas_m2,
    cadre_pin_ml: tmp.cadre_pin_ml,
    cadre_hetre_ml: tmp.cadre_hetre_ml,
    cadre_chene_ml: tmp.cadre_chene_ml,
    affichage: 'Taux actuels : Bâche ' + tmp.bache_m2 + ' MAD/m² · Canvas ' + tmp.canvas_m2 + ' MAD/m² · Pin ' + tmp.cadre_pin_ml + ' MAD/ml · Hêtre ' + tmp.cadre_hetre_ml + ' MAD/ml · Chêne ' + tmp.cadre_chene_ml + ' MAD/ml'
  };
}

/** Journal synchro (JSON local) — entrées déjà masquées, jamais de secret. */
function journaliserSynchro(entree) {
  try {
    let historique = [];
    if (fs.existsSync(SYNC_JOURNAL_JSON)) {
      try { historique = JSON.parse(fs.readFileSync(SYNC_JOURNAL_JSON, 'utf-8')); } catch (e) { historique = []; }
    }
    if (!Array.isArray(historique)) historique = [];
    historique.unshift(entree);
    fs.mkdirSync(path.dirname(SYNC_JOURNAL_JSON), { recursive: true });
    fs.writeFileSync(SYNC_JOURNAL_JSON, JSON.stringify(historique, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[sync-prix] journal non écrit :', e.message);
  }
}

/** Comparaison du jeton en TEMPS CONSTANT (sha256 + timingSafeEqual). */
function jetonValide(req) {
  const fourni = String(req.headers['x-tower-token'] || '');
  const attendu = TOWER_SYNC_TOKEN;
  if (!attendu || !fourni) return false;
  const hFourni = crypto.createHash('sha256').update(fourni).digest();
  const hAttendu = crypto.createHash('sha256').update(attendu).digest();
  return crypto.timingSafeEqual(hFourni, hAttendu);
}

/** L'action doit venir de tour-de-controle.html servi en localhost. */
function refererValide(req) {
  const ref = String(req.headers.referer || '').toLowerCase();
  if (!ref) return false;
  if (!ref.includes('tour-de-controle.html')) return false;
  return ref.includes('//localhost') || ref.includes('//127.0.0.1');
}

/** Envoi d'une réponse JSON re-masquée en dernière barrière. */
function reponseMasquee(res, code, payload) {
  res.status(code).type('application/json').send(masquerSecrets(JSON.stringify(payload)));
}

/** Garde commune : 503 config absente → 401 jeton → 403 referer. */
function gardeSynchro(req, res) {
  if (!TOWER_SYNC_TOKEN) {
    console.warn('[sync-prix] 503 — synchro non configurée : TOWER_SYNC_TOKEN manquant dans .env (valeur jamais affichée).');
    reponseMasquee(res, 503, {
      ok: false,
      code: 503,
      error: 'synchro non configurée',
      message: 'Synchro non configurée : TOWER_SYNC_TOKEN manquant dans .env'
    });
    return false;
  }
  if (!jetonValide(req)) {
    reponseMasquee(res, 401, {
      ok: false,
      code: 401,
      error: 'jeton invalide ou absent',
      message: 'Jeton X-Tower-Token invalide ou absent.'
    });
    return false;
  }
  if (!refererValide(req)) {
    reponseMasquee(res, 403, {
      ok: false,
      code: 403,
      error: 'referer invalide',
      message: "Origine non autorisée : l'action doit venir de tour-de-controle.html en localhost."
    });
    return false;
  }
  return true;
}

// ── ROUTES SYNC-PRIX (définies ci-dessous) ──

// GET /preview — AUCUNE écriture : tarifs en --dry-run + contenu en --preview.
app.get('/api/control-tower/sync-prix/preview', async (req, res) => {
  if (!gardeSynchro(req, res)) return;
  let taux;
  try {
    taux = lireTauxV7();
  } catch (err) {
    return reponseMasquee(res, 409, { ok: false, etape: 'preview', error: masquerSecrets(err.message) });
  }
  try {
    const rTarifs = await spawnNode(SYNC_TARIFS_SCRIPT, ['--dry-run'], null);
    const rContenu = await spawnNode(SYNC_CONTENU_SCRIPT, ['--preview'], null);
    reponseMasquee(res, 200, {
      ok: rTarifs.code === 0 && rContenu.code === 0,
      etape: 'preview',
      taux,
      tarifs: {
        code: rTarifs.code,
        changements: rTarifs.stdout.includes('CHANGEMENTS DÉTECTÉS'),
        logs: rTarifs.logs
      },
      contenu: {
        code: rContenu.code,
        logs: rContenu.logs
      },
      logs: [...rTarifs.logs, ...rContenu.logs]
    });
  } catch (err) {
    reponseMasquee(res, 500, { ok: false, etape: 'preview', error: masquerSecrets(err.message) });
  }
});

// POST /run — DÉSACTIVÉ (quarantaine D2, audit 24/09) : répond 423 AVANT tout
// backup/écriture. Aucun `--apply` (ni synchro_tarifs_unifie, ni
// synchro_contenu_images) ne peut plus être déclenché par cette route ; le
// legacy a été supprimé. Réactivation = mission dédiée (offsets).
app.post('/api/control-tower/sync-prix/run', async (req, res) => {
  if (!gardeSynchro(req, res)) return;
  // D2 (MICRO-11) : quarantaine MAINTENUE. Refus AVANT tout backup/écriture :
  // l'étape (a) ne doit pas modifier le registre HTML, et (b) n'exécute jamais
  // `--apply`. La levée se fera dans une mission dédiée (offsets).
  return res.status(423).json({
    ok: false,
    quarantaine: true,
    code: 'SYNCHRO_PRIX_QUARANTAINE',
    etape: 'refus',
    message: 'Désactivé — synchro en quarantaine audit 24/09, offsets à corriger en mission dédiée. Aucun --apply exécuté.'
  });
});
app.get('/tour-de-controle.html', (req, res) => {
  if (fs.existsSync(TOUR_HTML_FILE)) {
    res.sendFile(TOUR_HTML_FILE);
  } else {
    res.status(404).send(`Interface tour-de-controle.html introuvable à la racine : ${TOUR_HTML_FILE}`);
  }
});

app.get('/tour', (req, res) => {
  res.redirect('/tour-de-controle.html');
});

// 1bis. 🎬 VIDÉOS LOCALES (lecture dashboard) : ../videos = dossier RACINE
// (HORS site-web/ et HORS dépôt GitHub Pages — jamais commité).
// Convention : videos/produit-N.mp4 (+ variante 9:16 videos/produit-N-reel.mp4).
// GARDE : dossier racine absent → route inactive SANS crash (pas de statique
// vers un dossier inexistant, aucun envoi impacté).
const VIDEOS_DIR = path.join(ROOT_DIR, 'videos');
if (fs.existsSync(VIDEOS_DIR)) {
  app.use('/videos', express.static(VIDEOS_DIR, { index: false }));
  console.log(`[videos] lecture locale active : ${VIDEOS_DIR} → http://localhost:${PORT}/videos/produit-N.mp4`);
} else {
  console.log('[videos] dossier racine ../videos absent : route /videos inactive (lecture locale désactivée, sans crash).');
}

// 2. Fichiers statiques du site (images, CSS, JS) depuis SITE_DIR
app.use(express.static(SITE_DIR, { index: false }));

// 3. Fichiers statiques depuis ROOT_DIR (racine)
if (ROOT_DIR !== SITE_DIR) {
  app.use(express.static(ROOT_DIR, { index: false }));
}

// 4. Accueil "/"
app.get('/', (req, res) => {
  const indexPath = path.join(SITE_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else if (fs.existsSync(TOUR_HTML_FILE)) {
    res.sendFile(TOUR_HTML_FILE);
  } else {
    res.send('Tableaux Muraux Server Ready');
  }
});

// P1 audit 24/09 (C1) : écoute loopback UNIQUEMENT (usage 100 % local).
// '0.0.0.0' exposait les routes destructrices (upload, restore, publish, sans
// auth) à tout le LAN — voir preuves/bloc3.md §4. Surcharge possible via HOST.
app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`\n================================================================`);
  console.log(`?? SERVEUR TABLEAUX MURAUX D?MARR? SUR http://localhost:${PORT}`);
  console.log(`?? INTERFACE SERVIE : ${TOUR_HTML_FILE}`);
  console.log(`?? RACINE DU PROJET : ${ROOT_DIR}`);
  console.log(`?? SOUS-DOSSIER SITE: ${SITE_DIR}`);
  console.log(`?? DOSSIER IMAGES   : ${IMAGES_DIR}`);
  console.log(`?? FICHIER .ENV     : ${ROOT_ENV_FILE} (${hasApiKeyConfigured() ? 'CONFIGUR?E ?' : 'NON D?FINIE ? (Ajoutez GROQ_API_KEY dans .env)'})`);
  console.log(`?? SCRIPT PYTHON    : ${PYTHON_SCRIPT} (${fs.existsSync(PYTHON_SCRIPT) ? 'TROUV? ?' : 'NON TROUV? ?'})`);
  console.log(`================================================================\n`);
});
