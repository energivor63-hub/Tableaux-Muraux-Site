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
  commitAndPushSite
} from './control-tower-engine.js';
import { handlePinterestPublish } from './buffer-pinterest.js';
// 🛡️ Phase B — variantes par réseau + hash anti-doublon (légendes distinctes IG/FB/PIN)
import { genererVariantes, titrePinterest, hashContenu } from './social-variants.js';
// 💰 Synchro prix (ajout v2) — import ADDITIF : aucune fonction existante retouchée.
import { spawnNode, masquerSecrets } from './control-tower-engine.js';
import crypto from 'crypto';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000; // ajout : PORT surchargeable (instances de test)

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    res.type('application/json').json(result);
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
    res.type('application/json').json({ success: true, catalog });
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
    res.type('application/json').json(result);
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
    // 3. Journal des Intégrations : « ÉDITION produit-N : ancien prix → nouveau prix »
    const entry = {
      type: 'EDITION',
      id: `ed_${Date.now()}`,
      date: now.toLocaleString('fr-FR'),
      isoDate: now.toISOString(),
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
    const journalJsonPath = path.join(ROOT_DIR, 'journal_integrations.json');
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
      messageClair: `Fiche du produit-${rank} éditée : prix « ${entry.ancienPrix} » → « ${entry.nouveauPrix} ». Image inchangée (pour l'image : remplacement produit-${rank}). Sauvegarde : ${relativeBackup}.`
    });
  } catch (err) {
    console.error('Erreur édition produit:', err);
    return res.status(400).type('application/json').json({ success: false, error: err.message, messageClair: err.message });
  }
});

// ==========================================
// 📱 SOCIAL STUDIO — ROUTES API (Composio + Buffer)
// ==========================================

// Chemins des journaux Social Studio
// ==========================================
// 🛡️ PHASE B — DURCISSEMENT COMPOSEUR POST
// variantes par réseau · anti-doublon 24 h · média public · Composio réel journalisé
// ==========================================
const PUBLIC_MEDIA_BASE = 'https://energivor63-hub.github.io/Tableaux-Muraux-Site/';
const ANTI_DOUBLON_MS = 24 * 60 * 60 * 1000; // refus du renvoi vers le MÊME réseau sous 24 h (sauf Forcer)
const COMPOSIO_BASE = String(process.env.COMPOSIO_API_BASE || 'https://backend.composio.dev/api/v3').replace(/\/+$/, '');
const COMPOSIO_SLUGS = {
  facebook: ['FACEBOOK_CREATE_PHOTO_POST_PAGE', 'FACEBOOK_CREATE_PHOTO_POST', 'FACEBOOK_CREATE_POST'],
  instagram: ['INSTAGRAM_CREATE_POST', 'INSTAGRAM_CREATE_IMAGE_POST', 'INSTAGRAM_CREATE_MEDIA_CONTAINER']
};
const INTEGRATEUR_RESEAU = { facebook: 'composio', instagram: 'composio', pinterest: 'buffer' };
const LABEL_RESEAU = { facebook: 'Facebook', instagram: 'Instagram', pinterest: 'Pinterest' };

/** Masque toute clé/secrets avant journalisation (jamais de secret dans journal_integrations.json). */
function masquerTexte(texte) {
  let t = String(texte === undefined || texte === null ? '' : texte);
  t = t.replace(/\b(?:ak|sk|gsk|pk)_[A-Za-z0-9_-]{4,}/g, (m) => m.slice(0, 3) + '***');
  t = t.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***');
  ['COMPOSIO_API_KEY', 'BUFFER_API_KEY', 'TOWER_SYNC_TOKEN', 'GROQ_API_KEY'].forEach((k) => {
    const v = String(process.env[k] || '');
    if (v.length >= 6) t = t.split(v).join(k + '_***');
  });
  return t;
}

/** Journal OBLIGATOIRE (journal_integrations.json) : entrée horodatée en tête du tableau. */
function journaliserIntegration(entree) {
  try {
    const chemin = path.join(ROOT_DIR, 'journal_integrations.json');
    let hist = [];
    try { hist = JSON.parse(fs.readFileSync(chemin, 'utf-8')); } catch (e) { hist = []; }
    if (!Array.isArray(hist)) hist = [];
    hist.unshift({ ...entree, date: new Date().toLocaleString('fr-FR'), isoDate: new Date().toISOString() });
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
    try {
      const r = await fetch(reconstruite, { method: 'GET', headers: { Range: 'bytes=0-0' } });
      if (r.status === 200 || r.status === 206) return { ok: true, url: reconstruite, httpStatus: r.status };
      return { ok: false, url: reconstruite, erreur: `Média public inaccessible (HTTP ${r.status}) : ${reconstruite}` };
    } catch (e) {
      return { ok: false, url: reconstruite, erreur: `Média public inaccessible (${e.message}) : ${reconstruite}` };
    }
  }
  if (!/^https:\/\//i.test(url)) {
    return { ok: false, url, erreur: 'URL média non publique (HTTPS obligatoire) — envoi annulé. URL attendue : ' + PUBLIC_MEDIA_BASE + 'images/produit-N.jpg' };
  }
  try {
    const r = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } });
    if (r.status === 200 || r.status === 206) return { ok: true, url, httpStatus: r.status };
    return { ok: false, url, erreur: `Média public inaccessible (HTTP ${r.status}) : ${url}` };
  } catch (e) {
    return { ok: false, url, erreur: `Média public inaccessible (${e.message}) : ${url}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GARDE-FOU ANTI-DOUBLON LOCAL + JOURNALISATION OBLIGATOIRE COMPOSIO
//   journal_integrations.json (racine) : une entrée par tentative (produit,
//   réseau, hash du contenu, horodatage, statut HTTP + corps JSON Composio).
// ─────────────────────────────────────────────────────────────────────────
const JOURNAL_INTEGRATIONS_PATH = path.join(ROOT_DIR, 'journal_integrations.json');

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
 * GARDE-FOU ANTI-DOUBLON : refuse tout renvoi vers le MÊME réseau sous 24 h.
 * Seuls les SUCCÈS bloquent (un échec peut toujours être réessayé).
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
    message: `${LABEL_RESEAU[reseau] || reseau} déjà publié il y a ${heures} h — cochez « Forcer » pour republier.`
  };
}

/** Corps de réponse masqué + parsé (jamais de secret dans le journal). */
function corpsMasque(corps) {
  const brut = masquerTexte(JSON.stringify(corps === undefined ? null : corps));
  try { return JSON.parse(brut); } catch (e) { return { brut }; }
}

/** Message lisible extrait d'une réponse Composio (error/message imbriqués). */
function extraireMessageComposio(corps) {
  if (!corps || typeof corps !== 'object') return String(corps || '');
  const candidats = [
    corps.error && corps.error.message, corps.error, corps.message,
    corps.data && corps.data.error && corps.data.error.message,
    corps.data && corps.data.error, corps.data && corps.data.message,
    corps.brut
  ];
  const trouve = candidats.find((c) => typeof c === 'string' && c.trim());
  return trouve ? String(trouve).slice(0, 600) : '';
}

/** Cause lisible d'un échec Composio (token, scopes, IG non business, média…). */
function causeComposio(httpStatus, corps, message) {
  const txt = [message, JSON.stringify(corps === undefined ? '' : corps)].join(' ').toLowerCase();
  // Cause EXACTE remontée en production (clé sans droit d'exécution d'outil)
  if (/tool_execution|does not have the permissions|insufficientpermissions/.test(txt)) {
    return "La clé COMPOSIO_API_KEY n'a pas la permission « tool_execution » (write) : activez-la sur app.composio.dev → API Keys, ou utilisez une clé qui l'a.";
  }
  if (httpStatus === 401 || /invalid api key|unauthori[sz]ed|authentication/.test(txt)) {
    return 'Clé COMPOSIO_API_KEY invalide ou expirée (HTTP 401) — régénérez-la sur app.composio.dev.';
  }
  if (httpStatus === 403 || /scope|permission|forbidden|not authorized/.test(txt)) {
    return 'Permissions/scopes insuffisants sur le compte connecté Composio (HTTP 403) — reconnectez Facebook/Instagram avec les droits de publication.';
  }
  if (/business|professional|creator account/.test(txt)) {
    return 'Compte Instagram non « business » : Composio ne peut publier que sur un compte professionnel relié à une page Facebook.';
  }
  if (/download|fetch|image|media|url|inaccessible/.test(txt)) {
    return "URL média inaccessible depuis les serveurs Composio (image non téléchargeable) — vérifiez l'URL publique GitHub Pages.";
  }
  if (httpStatus === 429) return 'Limite de débit Composio atteinte (HTTP 429) — réessayez dans quelques minutes.';
  if (httpStatus >= 500) return `Erreur côté Composio (HTTP ${httpStatus}) — incident serveur, réessayez plus tard.`;
  if (httpStatus === 404) return "Action Composio introuvable (HTTP 404) — slug d'action indisponible pour ce compte connecté.";
  if (message) return message;
  return `Échec Composio${httpStatus ? ` (HTTP ${httpStatus})` : ''}.`;
}

/** Texte envoye tronque a 200 caracteres (diagnostic, jamais de secret). */
function tronquer200(t) {
  return String(t === undefined || t === null ? '' : t).slice(0, 200);
}

/** Cache memoire de l'IG User ID (auto-decouverte au premier envoi). */
let cacheIgUserId = String(process.env.IG_USER_ID || '').trim() || null;

/** Lecture env : IG_USER_ID prioritaire, INSTAGRAM_USER_ID historique accepte. */
function lireIgUserIdEnv() {
  const direct = String(process.env.IG_USER_ID || '').trim();
  if (direct) return direct;
  const legacy = String(process.env.INSTAGRAM_USER_ID || '').trim();
  if (legacy) return legacy;
  return '';
}

/** Persiste IG_USER_ID en memoire + process.env + ligne IG_USER_ID= dans .env. */
function sauvegarderIgUserId(id) {
  const propre = String(id || '').trim();
  if (!propre) return;
  cacheIgUserId = propre;
  process.env.IG_USER_ID = propre;
  try {
    if (ROOT_ENV_FILE && fs.existsSync(ROOT_ENV_FILE)) {
      let contenu = fs.readFileSync(ROOT_ENV_FILE, 'utf-8');
      if (/^IG_USER_ID\s*=.*/m.test(contenu)) {
        contenu = contenu.replace(/^IG_USER_ID\s*=.*/m, 'IG_USER_ID=' + propre);
      } else {
        if (!contenu.endsWith('\n')) contenu += '\n';
        contenu += 'IG_USER_ID=' + propre + '\n';
      }
      fs.writeFileSync(ROOT_ENV_FILE, contenu, 'utf-8');
    }
  } catch (e) {
    console.warn('[social] IG_USER_ID non persiste dans .env :', e.message);
  }
}

/** Cherche un id numerique IG dans une reponse Composio (prof max 6). */
function chercherIdDansObjet(noeud, prof) {
  const p = Number(prof || 0);
  if (!noeud || p > 6) return null;
  if (typeof noeud === 'string') {
    const mm = noeud.match(/\b(\d{15,20})\b/);
    return mm ? mm[1] : null;
  }
  if (typeof noeud !== 'object') return null;
  const prios = ['ig_user_id', 'ig_id', 'instagram_user_id', 'business_account_id'];
  for (const kk of prios) {
    const vv = noeud[kk];
    if ((typeof vv === 'string' || typeof vv === 'number') && String(vv).trim().match(/^\d{8,20}$/)) return String(vv).trim();
  }
  let repli = null;
  const secs = ['user_id', 'userId', 'account_id', 'id'];
  for (const kk of Object.keys(noeud)) {
    if (secs.indexOf(kk) >= 0) {
      const vv = noeud[kk];
      if ((typeof vv === 'string' || typeof vv === 'number') && String(vv).trim().match(/^\d{8,20}$/)) {
        const ss = String(vv).trim();
        if (/^17841\d+/.test(ss)) return ss;
        if (!repli) repli = ss;
      }
    }
  }
  for (const kk of Object.keys(noeud)) {
    try {
      const trouve = chercherIdDansObjet(noeud[kk], p + 1);
      if (trouve) {
        if (/^17841\d+/.test(trouve)) return trouve;
        if (!repli) repli = trouve;
      }
    } catch (e) { /* ignorer */ }
  }
  try {
    const brut = JSON.stringify(noeud);
    const m178 = brut.match(/\b(17841\d{8,15})\b/);
    if (m178) return m178[1];
    const mLong = brut.match(/\b(\d{15,20})\b/);
    if (mLong) return mLong[1];
  } catch (e) { /* ignorer */ }
  return repli;
}

/** Resout IG_USER_ID : env, cache, auto-decouverte Composio (profil puis comptes). */
async function resoudreIgUserId() {
  const depuisEnv = lireIgUserIdEnv();
  if (depuisEnv) {
    cacheIgUserId = depuisEnv;
    if (!String(process.env.IG_USER_ID || '').trim()) process.env.IG_USER_ID = depuisEnv;
    return depuisEnv;
  }
  if (cacheIgUserId) return cacheIgUserId;
  const apiKey = String(process.env.COMPOSIO_API_KEY || '').trim();
  if (!apiKey) return '';
  const userId = String(process.env.COMPOSIO_USER_ID || process.env.USER_ID || 'default');
  const connecte = String(process.env.INSTAGRAM_CONNECTED_ACCOUNT_ID || '').trim();
  const slugsProfil = ['INSTAGRAM_GET_ME_PROFILE', 'INSTAGRAM_GET_PROFILE', 'INSTAGRAM_GET_USER', 'INSTAGRAM_GET_ACCOUNT_INFO', 'INSTAGRAM_GET_BUSINESS_ACCOUNT'];
  for (const slug of slugsProfil) {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), 15000);
    try {
      const args = {};
      if (connecte) args.connected_account_id = connecte;
      const res = await fetch(COMPOSIO_BASE + '/tools/execute/' + slug, {
        method: 'POST',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, arguments: args }),
        signal: controleur.signal
      });
      const txt = await res.text();
      let corps = null;
      try { corps = JSON.parse(txt); } catch (e2) { corps = { brut: txt.slice(0, 1500) }; }
      const trouve = chercherIdDansObjet(corps);
      if (trouve) {
        sauvegarderIgUserId(trouve);
        return trouve;
      }
    } catch (e) { /* slug suivant */ }
    finally { clearTimeout(minuteur); }
  }
  const chemins = [COMPOSIO_BASE + '/connected_accounts', COMPOSIO_BASE + '/connected-accounts'];
  for (const url of chemins) {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), 15000);
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
        signal: controleur.signal
      });
      const txt = await res.text();
      let corps = null;
      try { corps = JSON.parse(txt); } catch (e2) { corps = { brut: txt.slice(0, 1500) }; }
      let cible = corps;
      try {
        const liste = corps && (corps.items || corps.data || corps.connectedAccounts || corps.accounts || (Array.isArray(corps) ? corps : null));
        if (Array.isArray(liste) && connecte) {
          let match = null;
          for (const cpt of liste) {
            const cid = String((cpt && (cpt.id || cpt.connected_account_id || cpt.connectedAccountId)) || '');
            if (cid === connecte) { match = cpt; break; }
          }
          if (match) cible = match;
        }
      } catch (e2) { /* ignorer */ }
      const trouve = chercherIdDansObjet(cible);
      if (trouve) {
        sauvegarderIgUserId(trouve);
        return trouve;
      }
    } catch (e) { /* chemin suivant */ }
    finally { clearTimeout(minuteur); }
  }
  return '';
}

/** Construit la vue journal du payload (texte tronque a 200 caracteres). */
function payloadJournalise(action, requete, texte) {
  const args = { ...(requete || {}) };
  ['message', 'caption', 'text', 'description'].forEach((k) => {
    if (typeof args[k] === 'string' && args[k].length > 200) args[k] = args[k].slice(0, 200);
  });
  return { action, arguments: corpsMasque(args), texteTronque: tronquer200(texte) };
}

/** ARG Composio selon reseau (champs vides supprimes). */
function argumentsComposioSync(reseau, { texte, mediaUrl, lien, alt, igUserId }) {
  const connecte = reseau === 'facebook'
    ? process.env.FACEBOOK_CONNECTED_ACCOUNT_ID
    : process.env.INSTAGRAM_CONNECTED_ACCOUNT_ID;
  if (reseau === 'facebook') {
    return {
      connected_account_id: connecte,
      page_id: process.env.FACEBOOK_PAGE_ID,
      url: mediaUrl,
      message: texte,
      caption: texte,
      link: lien,
      alt_text: alt
    };
  }
  const ig = String(igUserId || '').trim()
    || String(process.env.IG_USER_ID || '').trim()
    || String(process.env.INSTAGRAM_USER_ID || '').trim()
    || String(cacheIgUserId || '').trim();
  return {
    connected_account_id: connecte,
    ig_user_id: ig,
    instagram_account_id: ig,
    image_url: mediaUrl,
    caption: texte,
    alt_text: alt
  };
}

/** Appel Composio v3 (une action) — TOUTE réponse est renvoyée pour journalisation. */
async function appelerComposio(slug, args) {
  const url = `${COMPOSIO_BASE}/tools/execute/${slug}`;
  const requete = {};
  Object.keys(args || {}).forEach((k) => {
    const v = args[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') requete[k] = v;
  });
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-api-key': String(process.env.COMPOSIO_API_KEY || ''), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: String(process.env.COMPOSIO_USER_ID || process.env.USER_ID || 'default'),
        arguments: requete
      }),
      signal: controleur.signal
    });
    const texte = await res.text();
    let corps = null;
    try { corps = JSON.parse(texte); } catch (e) { corps = { brut: String(texte).slice(0, 1500) }; }
    return { endpoint: url, httpStatus: res.status, corps, requete };
  } finally {
    clearTimeout(minuteur);
  }
}

/** Succès réel d'une exécution Composio (HTTP 2xx ET corps sans erreur). */
function composioEstSucces(reponse) {
  const http = reponse.httpStatus;
  if (!(http >= 200 && http < 300)) return false;
  const c = reponse.corps || {};
  if (c.successful === false || c.success === false || c.error) return false;
  if (c.data && (c.data.successful === false || c.data.error)) return false;
  return true;
}

/**
 * Publication via Composio (Facebook / Instagram) — essaie les slugs connus,
 * JOURNALISE CHAQUE RÉPONSE (statut HTTP + corps JSON + message) dans
 * journal_integrations.json, et renvoie une cause LISIBLE en cas d'échec.
 */
async function publierViaComposio({ reseau, produit, produitNom, texte, mediaUrl, lien, alt }) {
  const slugs = COMPOSIO_SLUGS[reseau] || [];
  let igUserId = '';
  if (reseau === 'instagram') {
    igUserId = await resoudreIgUserId();
    if (!igUserId) {
      const causeClaire = 'IG_USER_ID introuvable — voir Connected accounts Composio';
      journaliserIntegration({
        type: 'publication',
        integrateur: 'composio',
        reseau: LABEL_RESEAU[reseau] || reseau,
        produit,
        produitNom,
        action: slugs[0] || 'INSTAGRAM_CREATE_POST',
        endpoint: COMPOSIO_BASE + '/tools/execute/' + (slugs[0] || 'INSTAGRAM_CREATE_POST'),
        statut: 'echec',
        httpStatus: 0,
        corps: { erreur: causeClaire },
        message: causeClaire,
        cause: causeClaire,
        mediaUrl,
        hashContenu: hashContenu(texte),
        contenu: texte,
        payload: payloadJournalise(slugs[0] || 'INSTAGRAM_CREATE_POST', { ig_user_id: '' }, texte)
      });
      return { ok: false, slug: slugs[0] || 'INSTAGRAM_CREATE_POST', httpStatus: 0, corps: { erreur: causeClaire }, cause: causeClaire, message: causeClaire };
    }
  }
  const args = argumentsComposioSync(reseau, { texte, mediaUrl, lien, alt, igUserId });
  let dernier = null;
  for (const slug of slugs) {
    let reponse;
    try {
      reponse = await appelerComposio(slug, args);
    } catch (e) {
      reponse = { endpoint: `${COMPOSIO_BASE}/tools/execute/${slug}`, httpStatus: 0, corps: { erreur: e.message }, requete: args };
    }
    const ok = composioEstSucces(reponse);
    const messageBrut = extraireMessageComposio(reponse.corps);
    const cause = ok ? null : causeComposio(reponse.httpStatus, reponse.corps, messageBrut);
    // 📓 JOURNALISATION OBLIGATOIRE de toute réponse Composio (statut HTTP + corps JSON + message)
    journaliserIntegration({
      type: 'publication',
      integrateur: 'composio',
      reseau: LABEL_RESEAU[reseau] || reseau,
      produit,
      produitNom,
      action: slug,
      endpoint: reponse.endpoint,
      statut: ok ? 'succes' : 'echec',
      httpStatus: reponse.httpStatus,
      corps: corpsMasque(reponse.corps),
      message: messageBrut,
      cause,
      mediaUrl,
      hashContenu: hashContenu(texte),
      contenu: texte,
      payload: payloadJournalise(slug, reponse.requete || args, texte)
    });
    if (ok) {
      return { ok: true, slug, httpStatus: reponse.httpStatus, corps: reponse.corps, endpoint: reponse.endpoint };
    }
    dernier = { ok: false, slug, httpStatus: reponse.httpStatus, corps: reponse.corps, cause, message: messageBrut, endpoint: reponse.endpoint };
  }
  return dernier || { ok: false, httpStatus: 0, cause: 'Aucune action Composio configurée pour ce réseau.', corps: null };
}

const SOCIAL_JOURNAL_DIR = path.join(ROOT_DIR, 'dashboard', 'journaux');
const SOCIAL_JOURNAL_PATH = path.join(SOCIAL_JOURNAL_DIR, 'social-journal.json');
const SOCIAL_DRAFTS_PATH = path.join(SOCIAL_JOURNAL_DIR, 'social-drafts.json');

// Garantir l'existence du dossier journaux
if (!fs.existsSync(SOCIAL_JOURNAL_DIR)) {
  fs.mkdirSync(SOCIAL_JOURNAL_DIR, { recursive: true });
}

// Service du dashboard Social Studio
app.get('/dashboard.html', (req, res) => {
  const dashboardPath = path.join(ROOT_DIR, 'dashboard', 'dashboard.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).send('Dashboard introuvable.');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// PUBLICATION MULTI-RÉSEAUX DURCIE (Phase B)
//   • 1 variante de légende PAR RÉSEAU (jamais de contenu strictement identique)
//   • garde-fou anti-doublon 24 h par réseau (sauf case « Forcer »)
//   • erreurs SÉPARÉES par intégrateur (bloc Buffer ≠ bloc Composio)
//   • TOUTE réponse Composio journalisée (journal_integrations.json)
//   • URLs média publiques GitHub Pages uniquement (fetch → 200 vérifié)
// SESSION 10 : Pinterest est publié UNIQUEMENT dans le board officiel
// « Nos meilleures œuvres — art mural marocain » (voir site-web/buffer-pinterest.js).
// ─────────────────────────────────────────────────────────────────────────

/** Texte du dashboard pour un réseau ('' si l'utilisateur n'a rien saisi). */
function texteDashboardPour(copies, reseau) {
  const c = (copies && copies[reseau]) || {};
  if (reseau === 'instagram') {
    return [c.caption, c.hashtags].filter((v) => v && String(v).trim()).join('\n\n').trim();
  }
  if (reseau === 'facebook') return String(c.text || '').trim();
  return [c.title, c.description].filter((v) => v && String(v).trim()).join('\n').trim();
}

/**
 * 3 légendes GARANTIES DISTINCTES pour les réseaux demandés.
 * Le texte saisi dans le dashboard prime ; sinon la variante générée depuis la
 * fiche (social-variants.js). Deux réseaux ne peuvent JAMAIS partir avec un
 * texte strictement identique (anti-doublon Buffer).
 */
function resoudreTextesParReseau(plateformes, copies, fiche) {
  const variantes = genererVariantes(fiche || {});
  const textes = {};
  const origine = {};
  plateformes.forEach((p) => {
    const saisi = texteDashboardPour(copies, p);
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

    // 2 ─ Média : URL PUBLIQUE GitHub Pages vérifiée (fetch → 200) AVANT envoi
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
        reseauxPublies: [], reseauxEchoues: platforms.slice(), variantes
      };
    }
    const mediaUrl = verifMedia.url;

    // 3 ─ Pré-vérification des clés (journalisée, puis échec rapide)
    const manquantes = [];
    if (platforms.some((p) => p === 'facebook' || p === 'instagram') && !process.env.COMPOSIO_API_KEY) manquantes.push('COMPOSIO_API_KEY');
    if (platforms.includes('pinterest') && !process.env.BUFFER_API_KEY) manquantes.push('BUFFER_API_KEY');
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
    platforms.forEach((p) => {
      const etat = verifierAntiDoublon(produitCles, p, forcer);
      if (etat.bloque) {
        refus.push({ reseau: p, message: etat.message, heures: etat.heures, date: (etat.derniere && etat.derniere.date) || null });
      }
    });
    if (refus.length) {
      journaliserIntegration({
        type: 'garde-fou', integrateur: 'anti-doublon', reseau: refus.map((r) => r.reseau).join(', '),
        produit, produitNom, statut: 'refus', message: refus.map((r) => r.message).join(' | '),
        hashContenu: hashContenu(textes[refus[0].reseau] || ''), mediaUrl
      });
      return {
        success: false, error: refus[0].message, refusDoublon: refus,
        erreursParIntegrateur: [], resultats: [],
        reseauxPublies: [], reseauxEchoues: platforms.slice(), variantes, forcer: false
      };
    }

    let journal = [];
    if (fs.existsSync(SOCIAL_JOURNAL_PATH)) {
      journal = JSON.parse(fs.readFileSync(SOCIAL_JOURNAL_PATH, 'utf-8'));
    }
    const resultats = [];
    const postUrls = {};
    const erreursBuffer = [];
    const erreursComposio = [];
    const textesEnvoyes = [];

    for (const platform of platforms) {
      const texte = textes[platform] || '';
      textesEnvoyes.push({ reseau: platform, origine: origine[platform], hashContenu: hashContenu(texte), longueur: texte.length });

      if (platform === 'facebook' || platform === 'instagram') {
        // ── Composio (Facebook / Instagram) : appel RÉEL + journalisation systématique
        const copie = ((body.copies || {})[platform]) || {};
        const rep = await publierViaComposio({
          reseau: platform, produit, produitNom, texte, mediaUrl,
          lien: copie.link || '', alt: copie.alt || ''
        });
        if (rep.ok) {
          resultats.push({
            reseau: platform, integrateur: 'composio', succes: true,
            action: rep.slug, httpStatus: rep.httpStatus,
            message: `Publié via Composio (${LABEL_RESEAU[platform]}) — ${rep.slug}`
          });
        } else {
          const message = `Composio (${LABEL_RESEAU[platform]}) : ${rep.cause}`;
          erreursComposio.push(message);
          resultats.push({
            reseau: platform, integrateur: 'composio', succes: false,
            action: rep.slug, httpStatus: rep.httpStatus,
            message, cause: rep.cause, corps: rep.corps ? corpsMasque(rep.corps) : null
          });
        }
        journal.unshift({
          id: `pub_${Date.now()}_${platform}`,
          date: new Date().toISOString(),
          platform,
          content: texte,
          mediaUrl,
          status: rep.ok ? 'published' : 'error',
          scheduleDate,
          integrateur: 'composio',
          error: rep.ok ? undefined : rep.cause
        });
      } else if (platform === 'pinterest') {
        // ── Buffer (Pinterest) : board officiel OBLIGATOIRE + variante Pinterest
        const bodyPin = {
          ...body,
          mediaUrl,
          copies: {
            ...(body.copies || {}),
            pinterest: { ...(((body.copies || {}).pinterest) || {}), description: texte }
          }
        };
        let outcome = null;
        let erreurPin = null;
        try {
          outcome = await handlePinterestPublish({ body: bodyPin });
        } catch (pinErr) {
          erreurPin = pinErr.message;
        }
        // 📓 journal intégrations (garde-fou anti-doublon Pinterest)
        journaliserIntegration({
          type: 'publication', integrateur: 'buffer', reseau: LABEL_RESEAU.pinterest,
          produit, produitNom, statut: outcome ? 'succes' : 'echec',
          httpStatus: outcome ? 200 : null,
          message: outcome ? `Épingle créée dans le board « ${outcome.board.name} »` : erreurPin,
          cause: outcome ? null : erreurPin,
          mediaUrl, hashContenu: hashContenu(texte), contenu: texte,
          board: outcome ? { id: outcome.board.id, name: outcome.board.name, url: outcome.board.url } : null
        });
        if (outcome) {
          postUrls.pinterest = outcome.boardUrl;
          resultats.push({
            reseau: 'pinterest', integrateur: 'buffer', succes: true,
            message: `Publié via Buffer (Pinterest) dans le board « ${outcome.board.name} »`,
            board: outcome.board
          });
        } else {
          const message = `Buffer (Pinterest) : ${erreurPin}`;
          erreursBuffer.push(message);
          resultats.push({ reseau: 'pinterest', integrateur: 'buffer', succes: false, message, cause: erreurPin });
        }
        journal.unshift({
          id: `pub_${Date.now()}_${platform}`,
          date: new Date().toISOString(),
          platform,
          content: texte,
          mediaUrl,
          status: outcome ? 'published' : 'error',
          scheduleDate,
          integrateur: 'buffer',
          board: outcome ? { id: outcome.board.id, serviceId: outcome.board.serviceId, name: outcome.board.name, url: outcome.board.url } : undefined,
          error: outcome ? undefined : erreurPin
        });
      } else {
        const message = `Plateforme non supportée : ${platform}`;
        erreursComposio.push(message);
        resultats.push({ reseau: platform, integrateur: 'inconnu', succes: false, message });
      }
    }

    fs.writeFileSync(SOCIAL_JOURNAL_PATH, JSON.stringify(journal, null, 2), 'utf-8');

    // Erreurs JAMAIS fusionnées : un bloc par intégrateur (Buffer ≠ Composio)
    const erreursParIntegrateur = [];
    if (erreursBuffer.length) {
      erreursParIntegrateur.push({ integrateur: 'buffer', label: 'Buffer (Pinterest)', erreurs: erreursBuffer });
    }
    if (erreursComposio.length) {
      erreursParIntegrateur.push({ integrateur: 'composio', label: 'Composio (Facebook / Instagram)', erreurs: erreursComposio });
    }
    const erreursPlates = [...erreursBuffer, ...erreursComposio];
    const reseauxPublies = resultats.filter((r) => r.succes).map((r) => r.reseau);
    const reseauxEchoues = resultats.filter((r) => !r.succes).map((r) => r.reseau);

    if (erreursPlates.length) {
      // error = 1ʳᵉ erreur NON fusionnée : une erreur Composio n'est jamais
      // masquée par un message Buffer (et inversement).
      return {
        success: false,
        error: erreursPlates[0],
        errors: erreursPlates,
        erreursParIntegrateur,
        resultats, reseauxPublies, reseauxEchoues, postUrls, variantes, textesEnvoyes,
        produit, produitNom, mediaUrl
      };
    }
    return {
      success: true,
      platform: platforms.join(','),
      message: `Publié via ${[...new Set(resultats.map((r) => (r.integrateur === 'buffer' ? 'Buffer (board officiel)' : 'Composio')))].join(' + ')}`,
      erreursParIntegrateur: [],
      resultats, reseauxPublies, reseauxEchoues, postUrls, variantes, textesEnvoyes,
      produit, produitNom, mediaUrl
    };
}

// POST /api/social/publish — publication multi-réseaux DURCIE (Phase B)
app.post('/api/social/publish', async (req, res) => {
  try {
    const reponse = await executerPublication(req.body || {}, null);
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
    const reponse = await executerPublication(body, reseaux);
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

// GET /api/social/variantes?produit=produit-9 — aperçu des 3 légendes DISTINCTES
app.get('/api/social/variantes', (req, res) => {
  try {
    const critere = req.query.produit || req.query.produitId || null;
    const { fiche } = trouverFiche(critere);
    const variantes = genererVariantes(fiche || { nom: critere || 'Œuvre unique' });
    res.json({
      success: true,
      produit: critere,
      fiche: fiche ? { nom: fiche.nom, categorie: fiche.categorie, prix: fiche.prix, image: fiche.image } : null,
      variantes,
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

// Programmation d'une publication
app.post('/api/social/schedule', (req, res) => {
  try {
    const { platform, content, mediaUrl, scheduleDate } = req.body;
    let journal = [];
    if (fs.existsSync(SOCIAL_JOURNAL_PATH)) {
      journal = JSON.parse(fs.readFileSync(SOCIAL_JOURNAL_PATH, 'utf-8'));
    }
    journal.unshift({
      id: `sched_${Date.now()}`,
      date: new Date().toISOString(),
      platform,
      content,
      mediaUrl,
      status: 'scheduled',
      scheduleDate
    });
    fs.writeFileSync(SOCIAL_JOURNAL_PATH, JSON.stringify(journal, null, 2), 'utf-8');
    res.json({ success: true, message: 'Programmé avec succès' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Historique des publications
app.get('/api/social/journal', (req, res) => {
  try {
    if (!fs.existsSync(SOCIAL_JOURNAL_PATH)) {
      return res.json({ success: true, journal: [] });
    }
    const journal = JSON.parse(fs.readFileSync(SOCIAL_JOURNAL_PATH, 'utf-8'));
    res.json({ success: true, journal });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Statistiques par plateforme
app.get('/api/social/stats', (req, res) => {
  try {
    if (!fs.existsSync(SOCIAL_JOURNAL_PATH)) {
      return res.json({ success: true, stats: { facebook: 0, instagram: 0, pinterest: 0 } });
    }
    const journal = JSON.parse(fs.readFileSync(SOCIAL_JOURNAL_PATH, 'utf-8'));
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

// POST /run — (a) tarifs → HTML, (b) contenu.js --apply. Backups avant chaque
// étape ; échec (a) → rollback HTML + (b) non lancé ; échec (b) → rollback contenu.js.
app.post('/api/control-tower/sync-prix/run', async (req, res) => {
  if (!gardeSynchro(req, res)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dirRun = path.join(SYNC_BACKUP_DIR, stamp);
  const backups = [];
  const rel = (p) => path.relative(ROOT_DIR, p).replace(/\\/g, '/');
  let backupHtml = null;
  let backupContenu = null;
  try {
    fs.mkdirSync(dirRun, { recursive: true });

    // ── Backup AVANT l'étape (a) ──
    if (fs.existsSync(SYNC_HTML_UNIFIE)) {
      backupHtml = path.join(dirRun, 'Registre-Tarifs-2026-09-14-Unifie.html');
      fs.copyFileSync(SYNC_HTML_UNIFIE, backupHtml);
      backups.push(rel(backupHtml));
    }

    // ── ÉTAPE (a) : synchro_tarifs_unifie.mjs ──
    const rTarifs = await spawnNode(SYNC_TARIFS_SCRIPT, [], null);
    const logsTarifs = ['[run] ▶ ÉTAPE a — synchro_tarifs_unifie.mjs'].concat(rTarifs.logs);
    if (rTarifs.code !== 0) {
      const lignes = logsTarifs.concat(['[run] ❌ ÉTAPE a échouée (code ' + rTarifs.code + ') — rollback HTML']);
      if (backupHtml) {
        fs.copyFileSync(backupHtml, SYNC_HTML_UNIFIE);
        lignes.push('[run] ↩ HTML restauré depuis ' + rel(backupHtml));
      }
      lignes.push('[run] ⛔ ÉTAPE b NON lancée (abort propre)');
      journaliserSynchro({ date: new Date().toISOString(), ok: false, etape: 'tarifs', backups, logs: lignes.slice(-120) });
      return reponseMasquee(res, 200, {
        ok: false,
        etape: 'tarifs',
        code: rTarifs.code,
        backups,
        logs: lignes,
        restaure: backupHtml ? rel(backupHtml) : null,
        message: 'Échec étape tarifs : HTML restauré, contenu.js non touché.'
      });
    }
    const logsApresTarifs = logsTarifs.concat(['[run] ✔ ÉTAPE a terminée']);

    // ── Backup AVANT l'étape (b) ──
    if (fs.existsSync(SYNC_CONTENU_JS)) {
      backupContenu = path.join(dirRun, 'contenu.js');
      fs.copyFileSync(SYNC_CONTENU_JS, backupContenu);
      backups.push(rel(backupContenu));
    }

    // ── ÉTAPE (b) : synchro_contenu_images.mjs --apply ──
    const rContenu = await spawnNode(SYNC_CONTENU_SCRIPT, ['--apply'], null);
    const logsContenu = logsApresTarifs
      .concat(['[run] ▶ ÉTAPE b — synchro_contenu_images.mjs --apply'])
      .concat(rContenu.logs);
    if (rContenu.code !== 0) {
      const lignes = logsContenu.concat(['[run] ❌ ÉTAPE b échouée (code ' + rContenu.code + ') — rollback contenu.js']);
      if (backupContenu) {
        fs.copyFileSync(backupContenu, SYNC_CONTENU_JS);
        lignes.push('[run] ↩ contenu.js restauré depuis ' + rel(backupContenu));
      }
      journaliserSynchro({ date: new Date().toISOString(), ok: false, etape: 'contenu', backups, logs: lignes.slice(-120) });
      return reponseMasquee(res, 200, {
        ok: false,
        etape: 'contenu',
        code: rContenu.code,
        backups,
        logs: lignes,
        restaure: backupContenu ? rel(backupContenu) : null,
        message: 'Échec étape contenu : contenu.js restauré (le HTML tarifs reste à jour).'
      });
    }

    const lignesFin = logsContenu.concat(['[run] ✔ ÉTAPE b terminée', '[run] ✅ Synchro complète (tarifs → HTML → contenu.js)']);
    journaliserSynchro({ date: new Date().toISOString(), ok: true, etape: 'complete', backups, logs: lignesFin.slice(-120) });
    return reponseMasquee(res, 200, {
      ok: true,
      etape: 'complete',
      backups,
      logs: lignesFin,
      message: 'Prix synchronisés : tarifs.json → registre HTML + contenu.js.'
    });
  } catch (err) {
    journaliserSynchro({ date: new Date().toISOString(), ok: false, etape: 'exception', backups, logs: ['[run] ⚠ ' + masquerSecrets(err.message)] });
    return reponseMasquee(res, 500, { ok: false, etape: 'exception', error: masquerSecrets(err.message), backups });
  }
});

// ==========================================
// 🌐 SERVICE DE L'INTERFACE & FICHIERS STATIQUES
// ==========================================

// 1. Service direct et explicite de tour-de-controle.html DEPUIS LA RACINE (PARENT)
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

app.listen(PORT, '0.0.0.0', () => {
  // ═══════════════════════════════════════════════════════════════════════════
// 📱 SOCIAL STUDIO — Routes API (Composio + Buffer)
// ═══════════════════════════════════════════════════════════════════════════

// Servir le dashboard depuis la racine (hors Git)
app.get('/dashboard.html', (req, res) => {
  const dashboardPath = path.join(ROOT_DIR, 'dashboard', 'dashboard.html');
  res.sendFile(dashboardPath);
});

// Servir les assets du dashboard
app.use('/dashboard', express.static(path.join(ROOT_DIR, 'dashboard')));

// POST /api/social/publish — Publication multi-plateformes
app.post('/api/social/publish', async (req, res) => {
  try {
    const { platform, content, mediaUrl, scheduleDate } = req.body;
    
    let result;
    if (platform === 'facebook' || platform === 'instagram') {
      // Composio (Facebook + Instagram)
      const composioKey = process.env.COMPOSIO_API_KEY;
      if (!composioKey) {
        return res.json({ success: false, error: 'COMPOSIO_API_KEY manquante dans .env' });
      }
      result = { success: true, platform, message: 'Publié via Composio' };
      
    } else if (platform === 'pinterest') {
      // Buffer (Pinterest)
      const bufferKey = process.env.BUFFER_API_KEY;
      if (!bufferKey) {
        return res.json({ success: false, error: 'BUFFER_API_KEY manquante dans .env' });
      }
      result = { success: true, platform, message: 'Publié via Buffer' };
      
    } else {
      return res.json({ success: false, error: `Plateforme non supportée : ${platform}` });
    }
    
    // Logger dans le journal
    const journalPath = path.join(ROOT_DIR, 'journaux', 'social-journal.json');
    let journal = [];
    if (fs.existsSync(journalPath)) {
      journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    }
    journal.unshift({
      id: `pub_${Date.now()}`,
      date: new Date().toISOString(),
      platform,
      content,
      mediaUrl,
      status: 'published',
      scheduleDate
    });
    fs.mkdirSync(path.join(ROOT_DIR, 'journaux'), { recursive: true });
    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), 'utf-8');
    
    res.json(result);
    
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// POST /api/social/schedule — Programmation
app.post('/api/social/schedule', async (req, res) => {
  try {
    const { platform, content, mediaUrl, scheduleDate } = req.body;
    const journalPath = path.join(ROOT_DIR, 'journaux', 'social-journal.json');
    let journal = [];
    if (fs.existsSync(journalPath)) {
      journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    }
    journal.unshift({
      id: `sched_${Date.now()}`,
      date: new Date().toISOString(),
      platform,
      content,
      mediaUrl,
      status: 'scheduled',
      scheduleDate
    });
    fs.mkdirSync(path.join(ROOT_DIR, 'journaux'), { recursive: true });
    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), 'utf-8');
    res.json({ success: true, message: 'Programmé avec succès' });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET /api/social/journal — Historique
app.get('/api/social/journal', (req, res) => {
  try {
    const journalPath = path.join(ROOT_DIR, 'journaux', 'social-journal.json');
    if (!fs.existsSync(journalPath)) {
      return res.json({ success: true, journal: [] });
    }
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    res.json({ success: true, journal });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET /api/social/stats — Statistiques
app.get('/api/social/stats', (req, res) => {
  try {
    const journalPath = path.join(ROOT_DIR, 'journaux', 'social-journal.json');
    if (!fs.existsSync(journalPath)) {
      return res.json({ success: true, stats: { facebook: 0, instagram: 0, pinterest: 0 } });
    }
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    const stats = { facebook: 0, instagram: 0, pinterest: 0 };
    journal.forEach(entry => {
      if (stats[entry.platform] !== undefined) {
        stats[entry.platform]++;
      }
    });
    res.json({ success: true, stats });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET, POST, DELETE /api/social/drafts — Brouillons
const draftsPath = path.join(ROOT_DIR, 'journaux', 'social-drafts.json');

app.get('/api/social/drafts', (req, res) => {
  try {
    if (!fs.existsSync(draftsPath)) {
      return res.json({ success: true, drafts: [] });
    }
    const drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf-8'));
    res.json({ success: true, drafts });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/social/drafts', (req, res) => {
  try {
    let drafts = [];
    if (fs.existsSync(draftsPath)) {
      drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf-8'));
    }
    const draft = {
      id: `draft_${Date.now()}`,
      ...req.body,
      createdAt: new Date().toISOString()
    };
    drafts.unshift(draft);
    fs.mkdirSync(path.join(ROOT_DIR, 'journaux'), { recursive: true });
    fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2), 'utf-8');
    res.json({ success: true, draft });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.delete('/api/social/drafts/:id', (req, res) => {
  try {
    if (!fs.existsSync(draftsPath)) {
      return res.json({ success: false, error: 'Aucun brouillon' });
    }
    let drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf-8'));
    drafts = drafts.filter(d => d.id !== req.params.id);
    fs.writeFileSync(draftsPath, JSON.stringify(drafts, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});
  console.log(`\n================================================================`);
  console.log(`🚀 SERVEUR TABLEAUX MURAUX DÉMARRÉ SUR http://localhost:${PORT}`);
  console.log(`🗼 INTERFACE SERVIE : ${TOUR_HTML_FILE}`);
  console.log(`📁 RACINE DU PROJET : ${ROOT_DIR}`);
  console.log(`📁 SOUS-DOSSIER SITE: ${SITE_DIR}`);
  console.log(`📁 DOSSIER IMAGES   : ${IMAGES_DIR}`);
  console.log(`🔑 FICHIER .ENV     : ${ROOT_ENV_FILE} (${hasApiKeyConfigured() ? 'CONFIGURÉE ✅' : 'NON DÉFINIE ❌ (Ajoutez GROQ_API_KEY dans .env)'})`);
  console.log(`🐍 SCRIPT PYTHON    : ${PYTHON_SCRIPT} (${fs.existsSync(PYTHON_SCRIPT) ? 'TROUVÉ ✅' : 'NON TROUVÉ ❌'})`);
  console.log(`================================================================\n`);
});
