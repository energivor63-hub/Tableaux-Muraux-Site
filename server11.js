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
  getCurrentCatalog,
  executeAutoIntegration,
  getJournalHistory,
  listBackups,
  restoreBackup
} from './control-tower-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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

    res.type('application/json').json({
      success: true,
      rootDir: ROOT_DIR,
      siteDir: SITE_DIR,
      imagesDir: IMAGES_DIR,
      tourHtmlFile: TOUR_HTML_FILE,
      hasApiKey: hasKey,
      hasPendingMockup: pending.exists,
      pendingMockup: pending,
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

// 2. Upload de maquette (Multipart)
app.post('/api/control-tower/upload-mockup', upload.single('mockup'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).type('application/json').json({ success: false, error: 'Aucun fichier image reçu.' });
    }
    const pending = detectPendingMockup();
    res.type('application/json').json({
      success: true,
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
