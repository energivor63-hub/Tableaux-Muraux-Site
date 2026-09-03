import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═════════════════════════════════════════════════════════════════════════════
// 📁 ARCHITECTURE À DEUX NIVEAUX : RACINE ET SOUS-DOSSIER site-web
// ═════════════════════════════════════════════════════════════════════════════
const isInsideSiteWeb = path.basename(__dirname).toLowerCase() === 'site-web' ||
  fs.existsSync(path.resolve(__dirname, '../ajouter_produit_auto.py')) ||
  fs.existsSync(path.resolve(__dirname, '../tour-de-controle.html'));

export const ROOT_DIR = isInsideSiteWeb ? path.resolve(__dirname, '..') : __dirname;
export const SITE_DIR = isInsideSiteWeb ? __dirname : (fs.existsSync(path.join(__dirname, 'site-web')) ? path.join(__dirname, 'site-web') : __dirname);

// 🔑 Lecture du fichier .env à la RACINE du projet (C:\...\TableauxMuraux_Site\.env)
export const ROOT_ENV_FILE = path.join(ROOT_DIR, '.env');
if (fs.existsSync(ROOT_ENV_FILE)) {
  dotenv.config({ path: ROOT_ENV_FILE });
} else {
  dotenv.config();
}

// Chemins des fichiers et répertoires stratégiques
export const TOUR_HTML_FILE = fs.existsSync(path.join(ROOT_DIR, 'tour-de-controle.html'))
  ? path.join(ROOT_DIR, 'tour-de-controle.html')
  : path.join(__dirname, 'tour-de-controle.html');

export const FICHE_TXT = path.join(ROOT_DIR, 'ajouter_produit_auto.txt');
export const PYTHON_SCRIPT = path.join(ROOT_DIR, 'ajouter_produit_auto.py');

export const IMAGES_DIR = path.join(SITE_DIR, 'images');
export const CONTENU_JS = path.join(SITE_DIR, 'contenu.js');
export const BACKUPS_DIR = path.join(ROOT_DIR, 'sauvegardes');
export const JOURNAL_JSON = path.join(ROOT_DIR, 'journal_integrations.json');
export const JOURNAL_TXT = path.join(ROOT_DIR, 'journal_integrations.txt');

// Garantir l'existence des répertoires vitaux
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Taxonomies officielles de TableauxMuraux_Site (définies dans contenu.js)
export const ALLOWED_CATEGORIES = ["abstrait", "paysages", "calligraphie", "moderne", "geometrique", "floral", "autres"];
export const ALLOWED_STYLES = ["contemporain", "traditionnel", "minimaliste", "boheme", "art-deco", "autres"];
export const ALLOWED_ENVIRONNEMENTS = ["salon", "chambre", "bureau", "entree", "riad", "cabinet", "ecole-primaire", "autres"];
export const ALLOWED_MATERIAUX = ["Toile Canvas", "Bâche Oragite®"];
export const ALLOWED_MONTAGES = ["Cadre Américain", "Châssis Bois"];

// ⚙️ Paramètres Groq Vision
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b';
export const GROQ_TIMEOUT_MS = 180000; // Timeout 3 minutes par tentative
export const GROQ_MAX_RETRIES = 3;      // 3 tentatives maximum
export const GROQ_RETRY_DELAY_MS = 15000; // Pause de 15s entre chaque essai

/**
 * Récupère la clé API configurée (GROQ_API_KEY prioritaire)
 */
export function getApiKey() {
  const key = process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
  return key && key.trim().length > 5 ? key.trim() : null;
}

/**
 * Vérifie si la clé API est configurée dans le .env racine
 */
export function hasApiKeyConfigured() {
  return Boolean(getApiKey());
}

/**
 * Détecte si une maquette `produit-0` (ou staging) est présente
 */
export function detectPendingMockup() {
  const possibleNames = [
    'produit-0.jpg', 'produit-0.jpeg', 'produit-0.png', 'produit-0.webp',
    'produit-0-staging.jpg', 'produit-0-staging.jpeg', 'produit-0-staging.png', 'produit-0-staging.webp'
  ];

  const dirsToCheck = [IMAGES_DIR];
  const rootImages = path.join(ROOT_DIR, 'images');
  if (rootImages !== IMAGES_DIR && fs.existsSync(rootImages)) {
    dirsToCheck.push(rootImages);
  }

  for (const dir of dirsToCheck) {
    for (const name of possibleNames) {
      const fullPath = path.join(dir, name);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        if (stats.size > 100) { // Fichier non vide
          return {
            exists: true,
            filename: name,
            fullPath,
            size: stats.size,
            modified: stats.mtime,
            ext: path.extname(name).toLowerCase(),
            url: `images/${name}?t=${stats.mtimeMs}`
          };
        }
      }
    }
  }

  return { exists: false };
}

/**
 * Lecture du catalogue actuel depuis contenu.js
 */
export function getCurrentCatalog() {
  try {
    if (!fs.existsSync(CONTENU_JS)) {
      return [];
    }
    const code = fs.readFileSync(CONTENU_JS, 'utf-8');
    const match = code.match(/produits:\s*\[([\s\S]*?)\n\s*\]/);
    if (!match) return [];

    const items = [];
    const block = match[1];
    const objectRegex = /\{([\s\S]*?)\}(?=,|\s*\]|$)/g;
    let m;
    let rank = 1;

    while ((m = objectRegex.exec(block)) !== null) {
      const body = m[1];
      const getField = (field) => {
        const fieldMatch = body.match(new RegExp(`${field}:\\s*(?:"([^"]*)"|'([^']*)'|(\\[[^\\]]*\\])|(null|true|false|\\d+))`));
        if (!fieldMatch) return null;
        if (fieldMatch[1] !== undefined) return fieldMatch[1];
        if (fieldMatch[2] !== undefined) return fieldMatch[2];
        if (fieldMatch[3] !== undefined) {
          try { return JSON.parse(fieldMatch[3]); } catch (e) { return fieldMatch[3]; }
        }
        if (fieldMatch[4] === 'null') return null;
        return fieldMatch[4];
      };

      const nom = getField('nom') || `Tableau #${rank}`;
      const image = getField('image') || `images/produit-${rank}.jpg`;
      const description = getField('description') || '';
      const categorie = getField('categorie') || 'autres';
      const style = getField('style') || 'traditionnel';
      const environnement = getField('environnement') || 'salon';
      const prix = getField('prix') || 'À partir de 180 MAD';
      const badge = getField('badge');
      const materiauRecommande = getField('materiauRecommande') || 'Toile Canvas';
      const montageRecommande = getField('montageRecommande') || 'Cadre Américain';
      const couleurs = getField('couleurs') || ['Ocre', 'Bleu', 'Doré'];
      const ambiance = getField('ambiance') || 'Chaleureuse et authentique';

      items.push({
        rank,
        nom,
        description,
        categorie,
        style,
        environnement,
        image,
        prix,
        badge,
        materiauRecommande,
        montageRecommande,
        couleurs: Array.isArray(couleurs) ? couleurs : [couleurs],
        ambiance
      });
      rank++;
    }

    return items;
  } catch (err) {
    console.error('Erreur lecture catalogue contenu.js:', err);
    return [];
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 👁️ VRAIE ANALYSE VISUELLE DE L'IMAGE PAR GROQ VISION (LLAMA-3.2-90B-VISION)
 * ═══════════════════════════════════════════════════════════════════════════
 * Déduit fidèlement les 13 attributs métier d'après l'image réelle déposée.
 * 🛑 Garde-fous :
 * - Timeout 3 minutes par requête (AbortController)
 * - 3 tentatives avec pause de 15 secondes
 * - Si échec total : interruption propre et explicite (jamais de copier-coller)
 */
export async function analyzeMockupWithAI(imagePath) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Analyse visuelle indisponible : renseignez GROQ_API_KEY dans votre fichier .env à la racine du projet.\n" +
      "Obtenez votre clé Groq 100% gratuite et sans carte bancaire sur https://console.groq.com/keys"
    );
  }

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Le fichier image de la maquette est introuvable : ${imagePath}`);
  }

  const ext = path.extname(imagePath).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Data = imageBuffer.toString('base64');
  const imageUrl = `data:${mimeType};base64,${base64Data}`;

  const systemPrompt = `Tu es l'expert en histoire de l'art décoratif et conservateur de collection pour la maison d'artisanat d'art « Tableaux Muraux » à Marrakech.

Ton rôle est d'analyser l'image fournie de cette maquette de tableau mural et d'en extraire avec une PRÉCISION ABSOLUE sa fiche technique de 13 champs pour le catalogue officiel.

INSTRUCTIONS D'OBSERVATION VISUELLE STRICTE :
1. SUJET RÉEL :
   - Si l'œuvre est une calligraphie islamique / arabe (ex: "الله", "سبحان الله و بحمده", calligraphie kufique ou thuluth noire sur fond texturé beige/crème/or), la catégorie DOIT impérativement être "calligraphie". Le nom et la description doivent expliciter la calligraphie sacrée et ses arabesques.
   - Si l'œuvre montre un patio de riad avec fontaine, zelliges, arcades, palmiers, la catégorie est "paysages".
   - Si l'œuvre montre des motifs purement géométriques / rosaces zelliges, la catégorie est "geometrique".
   - Si l'œuvre est abstraite minérale / texturée sans texte, la catégorie est "abstrait".
   - Si l'œuvre représente des fleurs / végétation, la catégorie est "floral".

2. PALETTE DE COULEURS OBSERVÉE (champ "couleurs") :
   - Extrais uniquement les 3 à 5 teintes RÉELLEMENT et VISIBLEMENT présentes dans l'image (ex: ["Beige", "Crème", "Doré", "Noir Profond"] pour une calligraphie dorée sur fond crème, ou ["Bleu Majorelle", "Vert Émeraude", "Blanc"] pour un patio).

3. SUPPORT ET MATÉRIAU RECOMMANDÉ (champ "materiauRecommande") :
   - Choisis "Toile Canvas" si l'image présente un grain texturé artistique, un effet de peinture sur toile, un fond granuleux, de la matière ou des touches dorées artisanales.
   - Choisis "Bâche Oragite®" si l'image est un rendu photographique ultra-lisse, brillant, à haute netteté ou contemporain.

4. TAXONOMIE OBLIGATOIRE (valeurs exactes autorisées) :
   - "categorie" : STRICTEMENT l'une de ["abstrait", "paysages", "calligraphie", "moderne", "geometrique", "floral", "autres"].
   - "style" : STRICTEMENT l'une de ["contemporain", "traditionnel", "minimaliste", "boheme", "art-deco", "autres"].
   - "environnement" : STRICTEMENT l'une de ["salon", "chambre", "bureau", "entree", "riad", "cabinet", "ecole-primaire", "autres"].
   - "materiauRecommande" : STRICTEMENT "Toile Canvas" ou "Bâche Oragite®".
   - "montageRecommande" : STRICTEMENT "Cadre Américain" ou "Châssis Bois".
   - "badge" : "Nouveau" (ou "Coup de cœur", "Collection Riad", "Édition Limitée", ou null).
   - "prix" : "À partir de 180 MAD" (ou "À partir de 120 MAD", "À partir de 220 MAD", "À partir de 250 MAD").
   - "imageFallback" : Un emoji adapté (ex: "📜" pour calligraphie, "🏺" pour riad/poterie, "✨" pour or/zellige, "🕌" pour islamique, "🎨" pour abstrait, "🌴" pour paysages).

5. FORMAT DE RÉPONSE :
Réponds UNIQUEMENT avec un objet JSON pur conforme au schéma suivant, sans bloc markdown additionnel :
{
  "nom": "Titre poétique et noble en français",
  "description": "2 à 3 phrases vendeuses décrivant avec exactitude la composition, les textures, les jeux de lumière et l'élégance de l'œuvre",
  "categorie": "calligraphie",
  "style": "traditionnel",
  "environnement": "salon",
  "imageFallback": "📜",
  "prix": "À partir de 180 MAD",
  "badge": "Nouveau",
  "materiauRecommande": "Toile Canvas",
  "montageRecommande": "Cadre Américain",
  "couleurs": ["Beige", "Crème", "Doré", "Noir"],
  "ambiance": "Spirituelle, noble et chaleureuse"
}`;

  let lastError = null;

  // Si GEMINI_API_KEY est configurée, prioriser Gemini 3.6 Flash
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 5) {
    try {
      console.log(`[Gemini Vision] Analyse visuelle haute précision via gemini-3.6-flash...`);
      const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { text: systemPrompt },
          { inlineData: { mimeType, data: base64Data } }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      });

      const rawContent = response.text?.trim() || '';
      if (!rawContent) {
        throw new Error("L'API Gemini Vision n'a retourné aucun contenu pour cette image.");
      }

      const cleanJson = rawContent.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      const normalizeTaxonomy = (val, allowed, defaultVal) => {
        if (!val) return defaultVal;
        const lower = String(val).toLowerCase().trim();
        const match = allowed.find(a => a.toLowerCase() === lower);
        return match || defaultVal;
      };

      const categorie = normalizeTaxonomy(parsed.categorie, ALLOWED_CATEGORIES, 'autres');
      const style = normalizeTaxonomy(parsed.style, ALLOWED_STYLES, 'traditionnel');
      const environnement = normalizeTaxonomy(parsed.environnement, ALLOWED_ENVIRONNEMENTS, 'salon');

      let materiauRecommande = 'Toile Canvas';
      if (parsed.materiauRecommande && parsed.materiauRecommande.toLowerCase().includes('oragite')) {
        materiauRecommande = 'Bâche Oragite®';
      }

      let montageRecommande = 'Cadre Américain';
      if (parsed.montageRecommande && parsed.montageRecommande.toLowerCase().includes('châssis')) {
        montageRecommande = 'Châssis Bois';
      }

      const couleurs = Array.isArray(parsed.couleurs) && parsed.couleurs.length > 0
        ? parsed.couleurs.slice(0, 5)
        : ['Beige', 'Doré', 'Noir'];

      const result = {
        nom: parsed.nom || 'Calligraphie & Arabesques Dorées',
        description: parsed.description || 'Tableau mural d\'exception alliant la noblesse de la calligraphie à des finitions contemporaines haut de gamme.',
        categorie,
        style,
        environnement,
        imageFallback: parsed.imageFallback || (categorie === 'calligraphie' ? '📜' : '🎨'),
        prix: parsed.prix || 'À partir de 180 MAD',
        badge: parsed.badge !== undefined ? parsed.badge : 'Nouveau',
        materiauRecommande,
        montageRecommande,
        couleurs,
        ambiance: parsed.ambiance || 'Spirituelle, noble et chaleureuse'
      };

      console.log(`[Gemini Vision] ✅ Analyse réussie pour « ${result.nom} » (Catégorie : ${result.categorie})`);
      return result;
    } catch (err) {
      console.warn(`[Gemini Vision] ⚠️ Erreur Gemini : ${err.message}, basculement vers Groq si disponible...`);
      lastError = err;
    }
  }

  // Si Groq Vision est demandé ou en fallback
  for (let attempt = 1; attempt <= GROQ_MAX_RETRIES; attempt++) {
    console.log(`[Groq Vision] Tentative ${attempt}/${GROQ_MAX_RETRIES} d'analyse visuelle via ${GROQ_VISION_MODEL}...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

      const requestBody = {
        model: GROQ_VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: systemPrompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      };

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'tableaux-muraux-control-tower/1.0'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Erreur API Groq (${response.status} ${response.statusText}): ${errBody}`);
      }

      const jsonResponse = await response.json();
      const rawContent = jsonResponse.choices?.[0]?.message?.content?.trim() || '';

      if (!rawContent) {
        throw new Error("L'API Groq Vision n'a retourné aucun contenu pour cette image.");
      }

      const cleanJson = rawContent.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      // Validation et normalisation stricte selon la taxonomie de contenu.js
      const normalizeTaxonomy = (val, allowed, defaultVal) => {
        if (!val) return defaultVal;
        const lower = String(val).toLowerCase().trim();
        const match = allowed.find(a => a.toLowerCase() === lower);
        return match || defaultVal;
      };

      const categorie = normalizeTaxonomy(parsed.categorie, ALLOWED_CATEGORIES, 'autres');
      const style = normalizeTaxonomy(parsed.style, ALLOWED_STYLES, 'traditionnel');
      const environnement = normalizeTaxonomy(parsed.environnement, ALLOWED_ENVIRONNEMENTS, 'salon');
      
      let materiauRecommande = 'Toile Canvas';
      if (parsed.materiauRecommande && parsed.materiauRecommande.toLowerCase().includes('oragite')) {
        materiauRecommande = 'Bâche Oragite®';
      }

      let montageRecommande = 'Cadre Américain';
      if (parsed.montageRecommande && parsed.montageRecommande.toLowerCase().includes('châssis')) {
        montageRecommande = 'Châssis Bois';
      }

      const couleurs = Array.isArray(parsed.couleurs) && parsed.couleurs.length > 0
        ? parsed.couleurs.slice(0, 5)
        : ['Beige', 'Doré', 'Noir'];

      const result = {
        nom: parsed.nom || 'Calligraphie & Arabesques Dorées',
        description: parsed.description || 'Tableau mural d\'exception alliant la noblesse de la calligraphie à des finitions contemporaines haut de gamme.',
        categorie,
        style,
        environnement,
        imageFallback: parsed.imageFallback || (categorie === 'calligraphie' ? '📜' : '🎨'),
        prix: parsed.prix || 'À partir de 180 MAD',
        badge: parsed.badge !== undefined ? parsed.badge : 'Nouveau',
        materiauRecommande,
        montageRecommande,
        couleurs,
        ambiance: parsed.ambiance || 'Spirituelle, noble et chaleureuse'
      };

      console.log(`[Groq Vision] ✅ Analyse réussie pour « ${result.nom} » (Catégorie : ${result.categorie})`);
      return result;

    } catch (err) {
      lastError = err;
      const isAbort = err.name === 'AbortError';
      const errMsg = isAbort ? 'Délai d\'attente dépassé (Timeout 3 min)' : err.message;
      console.warn(`[Groq Vision] ⚠️ Échec tentative ${attempt}/${GROQ_MAX_RETRIES} : ${errMsg}`);

      if (attempt < GROQ_MAX_RETRIES) {
        console.log(`[Groq Vision] ⏳ Pause de ${GROQ_RETRY_DELAY_MS / 1000}s avant nouvelle tentative...`);
        await new Promise(resolve => setTimeout(resolve, GROQ_RETRY_DELAY_MS));
      }
    }
  }

  // Si les 3 tentatives échouent : arrêt bloquant sans copier-coller
  throw new Error(
    `Échec de l'analyse visuelle par l'IA Groq (${GROQ_VISION_MODEL}) après ${GROQ_MAX_RETRIES} tentatives : ${lastError?.message || 'Erreur inconnue'}.\n` +
    `L'intégration a été interrompue afin de préserver l'intégrité du catalogue et d'éviter toute fausse fiche.`
  );
}

/**
 * Crée une sauvegarde horodatée de sécurité complète
 */
export function createSecurityBackup() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}m${pad(now.getSeconds())}s`;
  const backupFolder = path.join(BACKUPS_DIR, `backup_${timestamp}`);

  fs.mkdirSync(backupFolder, { recursive: true });

  const copiedFiles = [];
  const filesToCheck = [
    'contenu.js',
    'site-config.js',
    'index.html',
    'materials.html',
    'process.html',
    'privacy.html',
    'social.html',
    'social-data.js'
  ];

  for (const filename of filesToCheck) {
    const src = path.join(SITE_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(backupFolder, filename));
      copiedFiles.push(filename);
    }
  }

  if (fs.existsSync(FICHE_TXT)) {
    fs.copyFileSync(FICHE_TXT, path.join(backupFolder, 'ajouter_produit_auto.txt'));
  }

  return {
    timestamp,
    backupFolder,
    relativeFolder: `sauvegardes/backup_${timestamp}`,
    copiedFiles
  };
}

/**
 * 📝 Écrit la fiche 13 champs dans ../ajouter_produit_auto.txt à la racine
 */
export function writeFicheTxt(champs, mockupFullPath) {
  const sourcePath = mockupFullPath.replace(/\\/g, '/');

  const content = `# ═══════════════════════════════════════════════════════════════
#  📋 FICHE PRODUIT — lue automatiquement par ajouter_produit_auto.py
# ═══════════════════════════════════════════════════════════════
#  Générée automatiquement par la Tour de Contrôle (Analyse Visuelle Groq Vision)
#  Date : ${new Date().toLocaleString('fr-FR')}
# ═══════════════════════════════════════════════════════════════

# 📸 CHEMIN ABSOLU DE LA NOUVELLE IMAGE
source: "${sourcePath}"

# 🖼️ MÉTADONNÉES DU PRODUIT (13 champs métier déduits de l'image)
nom: "${champs.nom.replace(/"/g, '\\"')}"
description: "${champs.description.replace(/"/g, '\\"')}"
categorie: "${champs.categorie}"
style: "${champs.style}"
environnement: "${champs.environnement}"
image: "images/produit-1.jpg"
imageFallback: "${champs.imageFallback}"
prix: "${champs.prix}"
badge: ${champs.badge ? `"${champs.badge}"` : 'null'}
materiauRecommande: "${champs.materiauRecommande}"
montageRecommande: "${champs.montageRecommande}"
couleurs: ${JSON.stringify(champs.couleurs)}
ambiance: "${champs.ambiance.replace(/"/g, '\\"')}"
`;

  fs.writeFileSync(FICHE_TXT, content, 'utf-8');
  return FICHE_TXT;
}

/**
 * ⚡ Moteur JavaScript de secours pour le décalage et l'insertion de produit
 */
export function executeNodeShiftAndInsert(fichePath = FICHE_TXT) {
  if (!fs.existsSync(fichePath)) {
    throw new Error(`Fiche produit introuvable : ${fichePath}`);
  }

  const lines = fs.readFileSync(fichePath, 'utf-8').split('\n');
  const data = {};
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([a-zA-Z0-9_]+)\s*:\s*(.*)$/);
    if (match) {
      let [, key, val] = match;
      val = val.trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      } else if (val.startsWith('[') && val.endsWith(']')) {
        try { val = JSON.parse(val); } catch (e) {}
      } else if (val.toLowerCase() === 'null') {
        val = null;
      } else if (val.toLowerCase() === 'true') {
        val = true;
      } else if (val.toLowerCase() === 'false') {
        val = false;
      }
      data[key] = val;
    }
  }

  const source = data.source;
  if (!source || !fs.existsSync(source)) {
    throw new Error(`Fichier image source introuvable : ${source}`);
  }

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Trouver tous les fichiers produit-N.ext avec N >= 1
  const pattern = /^produit-(\d+)\.([a-zA-Z0-9]+)$/;
  const productFiles = [];
  for (const fname of fs.readdirSync(IMAGES_DIR)) {
    const m = fname.match(pattern);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num >= 1) {
        productFiles.push({ num, fname, ext: m[2] });
      }
    }
  }

  productFiles.sort((a, b) => b.num - a.num);

  let shiftedCount = 0;
  for (const item of productFiles) {
    const oldPath = path.join(IMAGES_DIR, item.fname);
    const newFname = `produit-${item.num + 1}.${item.ext}`;
    const newPath = path.join(IMAGES_DIR, newFname);
    fs.renameSync(oldPath, newPath);
    shiftedCount++;
  }

  const sourceExt = path.extname(source).toLowerCase() || '.jpg';
  const targetP1 = path.join(IMAGES_DIR, `produit-1${sourceExt}`);
  fs.copyFileSync(source, targetP1);
  const targetImageRel = `images/produit-1${sourceExt}`;

  // Mettre à jour contenu.js
  if (!fs.existsSync(CONTENU_JS)) {
    throw new Error(`contenu.js introuvable : ${CONTENU_JS}`);
  }

  let content = fs.readFileSync(CONTENU_JS, 'utf-8');

  // Décaler les images existantes dans contenu.js
  const nums = new Set();
  const regexNums = /images\/produit-(\d+)\.(?:jpg|jpeg|png|webp)/g;
  let rm;
  while ((rm = regexNums.exec(content)) !== null) {
    nums.add(parseInt(rm[1], 10));
  }
  const sortedNums = Array.from(nums).sort((a, b) => b - a);
  for (const n of sortedNums) {
    if (n >= 1) {
      content = content.replace(new RegExp(`images/produit-${n}\\.([a-zA-Z0-9]+)`, 'g'), `images/produit-${n + 1}.$1`);
    }
  }

  const nom = data.nom || 'Nouveau Tableau';
  const desc = data.description || '';
  const cat = data.categorie || 'autres';
  const style = data.style || 'traditionnel';
  const env = data.environnement || 'salon';
  const fallback = data.imageFallback || '🎨';
  const prix = data.prix || 'À partir de 180 MAD';
  const badge = data.badge ? `"${data.badge}"` : 'null';
  const mat = data.materiauRecommande || 'Toile Canvas';
  const montage = data.montageRecommande || 'Cadre Américain';
  const couleurs = Array.isArray(data.couleurs) ? data.couleurs : ['Beige', 'Doré', 'Noir'];
  const couleursStr = JSON.stringify(couleurs);
  const ambiance = data.ambiance || 'Chaleureuse et authentique';

  const newBlock = `    {\n      nom: "${nom.replace(/"/g, '\\"')}",\n      description: "${desc.replace(/"/g, '\\"')}",\n      categorie: "${cat}",\n      style: "${style}",\n      environnement: "${env}",\n      image: "${targetImageRel}",\n      imageFallback: "${fallback}",\n      prix: "${prix}",\n      badge: ${badge},\n      materiauRecommande: "${mat}",\n      montageRecommande: "${montage}",\n      couleurs: ${couleursStr},\n      ambiance: "${ambiance.replace(/"/g, '\\"')}"\n    },`;

  const match = content.match(/(produits\s*:\s*\[)/);
  if (!match) {
    throw new Error("Tableau `produits: [` introuvable dans contenu.js");
  }

  const insertPos = match.index + match[0].length;
  content = content.slice(0, insertPos) + '\n' + newBlock + content.slice(insertPos);

  fs.writeFileSync(CONTENU_JS, content, 'utf-8');

  return {
    code: 0,
    stdout: `[Node Engine] ✅ ${shiftedCount} images décalées avec succès.\n[Node Engine] ✅ Nouveau tableau « ${nom} » inséré en position n°1 dans contenu.js (${targetImageRel}).\n`,
    stderr: ''
  };
}

/**
 * 🐍 Exécute le moteur Python racine `python ../ajouter_produit_auto.py` (avec fallback Node)
 */
export function runPythonEngine() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(PYTHON_SCRIPT)) {
      console.log(`[Engine] Script Python introuvable, exécution via le moteur JavaScript intégré...`);
      try {
        const result = executeNodeShiftAndInsert();
        return resolve(result);
      } catch (err) {
        return reject(err);
      }
    }

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    const child = spawn(pythonCmd, [PYTHON_SCRIPT], {
      cwd: ROOT_DIR,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        console.warn(`[Python Engine] Erreur Python (Code ${code}), basculement vers le moteur JavaScript : ${stderr || stdout}`);
        try {
          const result = executeNodeShiftAndInsert();
          resolve(result);
        } catch (nodeErr) {
          reject(new Error(`Erreur Python (${code}) et échec fallback Node : ${nodeErr.message}`));
        }
      }
    });

    child.on('error', (err) => {
      console.warn(`[Python Engine] Impossible de lancer Python (${pythonCmd}) : ${err.message}, basculement vers le moteur JavaScript...`);
      try {
        const result = executeNodeShiftAndInsert();
        resolve(result);
      } catch (nodeErr) {
        reject(new Error(`Erreur commande Python et échec fallback Node : ${nodeErr.message}`));
      }
    });
  });
}

/**
 * Enregistrement dans le journal d'historique (JSON + TXT)
 */
export function appendToJournal(entry) {
  let history = [];
  try {
    if (fs.existsSync(JOURNAL_JSON)) {
      history = JSON.parse(fs.readFileSync(JOURNAL_JSON, 'utf-8'));
    }
  } catch (e) {
    history = [];
  }
  history.unshift(entry);
  fs.writeFileSync(JOURNAL_JSON, JSON.stringify(history, null, 2), 'utf-8');

  const txtLine = `[${entry.date}] NOUVEAU TABLEAU N°1 : « ${entry.nouveauNom} » (Ancien n°1 : « ${entry.ancienNom} ») | Sauvegarde : ${entry.backupFolder} | Statut : ${entry.statut}\n` +
    `  ↳ Détails : Catégorie: ${entry.champs.categorie} | Style: ${entry.champs.style} | Pièce: ${entry.champs.environnement} | Matériau: ${entry.champs.materiauRecommande} | Finition: ${entry.champs.montageRecommande} | Couleurs: ${JSON.stringify(entry.champs.couleurs)}\n\n`;

  try {
    fs.appendFileSync(JOURNAL_TXT, txtLine, 'utf-8');
  } catch (e) {
    console.error('Erreur écriture journal TXT:', e);
  }
}

/**
 * Lecture du journal
 */
export function getJournalHistory() {
  try {
    if (fs.existsSync(JOURNAL_JSON)) {
      return JSON.parse(fs.readFileSync(JOURNAL_JSON, 'utf-8'));
    }
  } catch (e) {
    console.error('Erreur lecture journal JSON:', e);
  }
  return [];
}

/**
 * Liste des sauvegardes
 */
export function listBackups() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) return [];
    const dirs = fs.readdirSync(BACKUPS_DIR);
    return dirs
      .filter(d => d.startsWith('backup_'))
      .sort()
      .reverse()
      .map(name => {
        const fullPath = path.join(BACKUPS_DIR, name);
        const stats = fs.statSync(fullPath);
        return {
          id: name,
          name,
          date: stats.mtime,
          formattedDate: stats.mtime.toLocaleString('fr-FR')
        };
      });
  } catch (e) {
    return [];
  }
}

/**
 * Restauration d'une sauvegarde
 */
export function restoreBackup(backupName) {
  const backupFolder = path.join(BACKUPS_DIR, backupName);
  if (!fs.existsSync(backupFolder)) {
    throw new Error(`La sauvegarde ${backupName} est introuvable.`);
  }

  const restored = [];
  for (const file of fs.readdirSync(backupFolder)) {
    const src = path.join(backupFolder, file);
    const dest = file === 'ajouter_produit_auto.txt'
      ? path.join(ROOT_DIR, file)
      : path.join(SITE_DIR, file);

    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
      restored.push(file);
    }
  }

  return {
    success: true,
    backupName,
    restored
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚀 PIPELINE COMPLET D'INTÉGRATION AUTOMATIQUE
 * ═══════════════════════════════════════════════════════════════════════════
 */
export async function executeAutoIntegration() {
  // 1. Détection de la maquette dans images/produit-0.jpg
  const pending = detectPendingMockup();
  if (!pending.exists) {
    throw new Error("Aucune maquette `produit-0` détectée dans `site-web/images/`. Déposez une image avant de lancer.");
  }

  const currentCatalogBefore = getCurrentCatalog();
  const ancienNumero1 = currentCatalogBefore.length > 0 ? currentCatalogBefore[0].nom : 'Aucun tableau précédent';

  // 2. VRAIE Analyse Visuelle par Groq Vision (bloquant si clé absente ou échec)
  const champs = await analyzeMockupWithAI(pending.fullPath);

  // 3. Sauvegarde préalable de sécurité
  const backupResult = createSecurityBackup();

  // 4. Écriture de la fiche dans ../ajouter_produit_auto.txt à la racine
  writeFicheTxt(champs, pending.fullPath);

  // 5. Exécution du moteur Python racine (décalage + insertion dans contenu.js)
  const pyResult = await runPythonEngine();

  // 6. Nettoyage de la maquette temporaire pour réarmer la Tour
  try {
    if (fs.existsSync(pending.fullPath)) {
      fs.unlinkSync(pending.fullPath);
    }
  } catch (e) {
    console.warn('Nettoyage maquette temporaire:', e.message);
  }

  // 7. Enregistrement dans le journal
  const now = new Date();
  const journalEntry = {
    id: `integ_${Date.now()}`,
    date: now.toLocaleString('fr-FR'),
    isoDate: now.toISOString(),
    nouveauNom: champs.nom,
    ancienNom: ancienNumero1,
    backupFolder: backupResult.relativeFolder,
    champs,
    pythonOutput: pyResult.stdout,
    statut: 'Intégration Réussie via Groq Vision & Moteur Python'
  };
  appendToJournal(journalEntry);

  return {
    success: true,
    nouveauNom: champs.nom,
    ancienNom: ancienNumero1,
    rang: 1,
    champs,
    targetImageRel: 'images/produit-1.jpg',
    backupFolder: backupResult.relativeFolder,
    pythonOutput: pyResult.stdout,
    messageClair: `Le tableau « ${champs.nom} » (Catégorie : ${champs.categorie}, Matériau : ${champs.materiauRecommande}) est désormais n°1 du catalogue ! Le moteur Python a décalé les anciens tableaux sans aucune perte.`
  };
}