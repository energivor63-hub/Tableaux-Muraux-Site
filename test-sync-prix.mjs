/**
 * 🧪 TESTS — Bouton admin « ⚡ Mise à jour des prix » (routes /api/control-tower/sync-prix/*)
 *
 *   Usage : node test-sync-prix.mjs
 *
 * Couvre :
 *   a. Auth           → sans token 401 ; token faux 401 ; token valide 200.
 *   b. Indépendance Groq → env du child filtré (GROQ_COUNT=0) ; GROQ_API_KEY
 *                        renommée temporairement dans .env → dry-run toujours ok.
 *   c. Rollback       → erreur de syntaxe injectée dans synchro_tarifs_unifie.mjs
 *                        → ok:false, etape:'tarifs', HTML + contenu.js INCHANGÉS (sha256).
 *   d. Masquage       → un log contenant « gsk_test123… » s'affiche « gsk_*** ».
 *
 * Garanties : aucune écriture permanente (restore en finally), aucune clé
 * affichée, serveur local démarré si absent et arrêté à la fin si démarré.
 */
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { spawnNode, masquerSecrets } from './control-tower-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
// P2a audit 24/09 (D4) : .env surchargeable (défaut = réel en prod, TEMP en tests —
// le rename GROQ de la section [b] n'écrit alors JAMAIS le vrai .env).
const ROOT_ENV = process.env.ENV_PATH || path.join(ROOT_DIR, '.env');
const HTML_UNIFIE = path.join(ROOT_DIR, 'registre', 'Registre-Tarifs-2026-09-14-Unifie.html');
const CONTENU_JS = path.join(__dirname, 'contenu.js');
const SCRIPT_TARIFS = path.join(ROOT_DIR, 'registre', 'synchro_tarifs_unifie.mjs');

let passed = 0;
let failed = 0;
function check(nom, cond, extra = '') {
  if (cond) { passed++; console.log('  ✅ ' + nom); }
  else { failed++; console.log('  ❌ ' + nom + (extra ? ' — ' + extra : '')); }
}
const shaFichier = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function requete(methode, chemin, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: 3000, path: chemin, method: methode, headers },
      (res) => {
        let corps = '';
        res.on('data', (c) => { corps += c; });
        res.on('end', () => resolve({ status: res.statusCode, corps }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}
const REFERER = { Referer: 'http://localhost:3000/tour-de-controle.html' };

async function attendreSante(delaiMs) {
  const debut = Date.now();
  while (Date.now() - debut < delaiMs) {
    try {
      const r = await requete('GET', '/api/health');
      if (r.status === 200) return true;
    } catch (e) { /* pas encore en écoute */ }
    await new Promise((r2) => setTimeout(r2, 400));
  }
  return false;
}

// Lecture du jeton (JAMAIS affiché) — source : .env racine
const envBrut = fs.readFileSync(ROOT_ENV, 'utf8');
const matchToken = envBrut.match(/^TOWER_SYNC_TOKEN=([0-9a-fA-F]{16,})\s*$/m);
const TOKEN = matchToken ? matchToken[1].trim() : '';


let serveur = null;
let lanceParTest = false;

async function main() {
  console.log('\n[0] Préparation — serveur local & jeton');
  const dejaUp = await attendreSante(1200);
  if (!dejaUp) {
    lanceParTest = true;
    serveur = spawn(process.execPath, ['server.js'], { cwd: __dirname, stdio: 'ignore', windowsHide: true });
    const up = await attendreSante(25000);
    check('serveur local démarré par le test', up);
  } else {
    check('serveur local déjà en écoute (réutilisé)', true);
  }
  check('TOWER_SYNC_TOKEN présent dans .env (valeur masquée)', Boolean(TOKEN));

  const authHeaders = { ...REFERER, 'X-Tower-Token': TOKEN };
  const fauxHeaders = { ...REFERER, 'X-Tower-Token': 'jeton_bidon_' + '0'.repeat(60) };

  console.log('\n[a] Authentification (sans token / faux token / bon token)');
  const rSans = await requete('GET', '/api/control-tower/sync-prix/preview', { ...REFERER });
  check('preview SANS token → 401', rSans.status === 401, 'status=' + rSans.status);
  const rFaux = await requete('GET', '/api/control-tower/sync-prix/preview', fauxHeaders);
  check('preview AVEC token faux → 401', rFaux.status === 401, 'status=' + rFaux.status);
  const rOk = await requete('GET', '/api/control-tower/sync-prix/preview', authHeaders);
  if (rOk.status === 404) {
    check('preview AVEC token valide → 200', false, 'route absente — REDÉMARRER le serveur pour charger les nouvelles routes');
  } else {
    check('preview AVEC token valide → 200', rOk.status === 200, 'status=' + rOk.status);
    if (rOk.status === 200) {
      const data = JSON.parse(rOk.corps);
      check('preview : étape "preview" + logs présents', data.etape === 'preview' && Array.isArray(data.logs) && data.logs.length > 0);
    }
  }

  console.log('\n[b] Indépendance Groq (env filtré + GROQ_API_KEY renommée)');
  // b.1 — le processus enfant ne reçoit AUCUNE variable GROQ_*
  const tmpScript = path.join(os.tmpdir(), 'tms_test_env_' + Date.now() + '.mjs');
  fs.writeFileSync(tmpScript, "console.log('GROQ_COUNT=' + Object.keys(process.env).filter(k => /^GROQ/i.test(k)).length + '|HASKEY=' + Boolean(process.env.GROQ_API_KEY));\n", 'utf8');
  const rEnv = await spawnNode(tmpScript, [], null);
  check('child env : 0 variable GROQ_* transmise', rEnv.stdout.includes('GROQ_COUNT=0|HASKEY=false'), rEnv.stdout.trim());
  check('parent (.env) possédait bien GROQ_API_KEY → contraste validé', /^GROQ_API_KEY=/m.test(envBrut));
  fs.unlinkSync(tmpScript);

  // b.2 — GROQ_API_KEY renommée temporairement dans .env → la synchro tourne quand même
  const envAvantSha = shaFichier(ROOT_ENV);
  const envRenomme = envBrut.replace(/^GROQ_API_KEY=/m, 'GROQ_API_KEY_TEST_RENOMMEE=');
  try {
    fs.writeFileSync(ROOT_ENV, envRenomme, 'utf8');
    const rDry = await spawnNode(SCRIPT_TARIFS, ['--dry-run'], null);
    check('GROQ_API_KEY renommée dans .env → synchro_tarifs --dry-run exit 0 (ok:true)', rDry.code === 0, 'code=' + rDry.code + ' ' + rDry.stderr.slice(0, 160));
  } finally {
    fs.writeFileSync(ROOT_ENV, envBrut, 'utf8');
  }
  check('.env restauré à l’identique (sha256)', shaFichier(ROOT_ENV) === envAvantSha);

  console.log('\n[c] Rollback — erreur de syntaxe injectée dans synchro_tarifs_unifie.mjs');
  const htmlAvant = shaFichier(HTML_UNIFIE);
  const contenuAvant = shaFichier(CONTENU_JS);
  const scriptOriginal = fs.readFileSync(SCRIPT_TARIFS, 'utf8');
  const scriptShaAvant = shaFichier(SCRIPT_TARIFS);
  let runCorps = null;
  try {
    // Erreur de syntaxe GARANTIE (parse immédiat, aucune écriture possible)
    fs.writeFileSync(SCRIPT_TARIFS, scriptOriginal + '\nconst ((( ;\n', 'utf8');
    const rRun = await requete('POST', '/api/control-tower/sync-prix/run', { ...authHeaders });
    if (rRun.status === 404) {
      check('run → 200 avec ok:false', false, 'route absente — REDÉMARRER le serveur');
    } else {
      check('run (erreur injectée) → 200 HTTP avec ok:false', rRun.status === 200 && rRun.corps.includes('"ok":false'), 'status=' + rRun.status);
      runCorps = JSON.parse(rRun.corps);
      check('ok:false + etape:"tarifs"', runCorps.ok === false && runCorps.etape === 'tarifs');
      check('logs : rollback annoncé + ÉTAPE b NON lancée', rRun.corps.includes('rollback') && rRun.corps.includes('NON lancée'));
      check('exactement 1 backup (HTML) — contenu.js jamais sauvegardé car jamais touché', Array.isArray(runCorps.backups) && runCorps.backups.length === 1, JSON.stringify(runCorps.backups));
      check('HTML unifié INCHANGÉ après rollback (sha256)', shaFichier(HTML_UNIFIE) === htmlAvant);
      check('contenu.js INCHANGÉ (sha256)', shaFichier(CONTENU_JS) === contenuAvant);
      check('réponse : aucune clé gsk_ brute (re-masquage)', !/gsk_(?!\*\*\*)[A-Za-z0-9]/.test(rRun.corps));
    }
  } finally {
    fs.writeFileSync(SCRIPT_TARIFS, scriptOriginal, 'utf8');
  }
  check('synchro_tarifs_unifie.mjs restauré à l’identique (sha256)', shaFichier(SCRIPT_TARIFS) === scriptShaAvant);

  console.log('\n[d] Masquage des secrets (gsk_***)');
  const tmpLog = path.join(os.tmpdir(), 'tms_test_gsk_' + Date.now() + '.mjs');
  fs.writeFileSync(tmpLog, "console.log('KEY=gsk_test123DEF et gsk_9z8y7x6w fin');\n", 'utf8');
  const rGsk = await spawnNode(tmpLog, [], null);
  fs.unlinkSync(tmpLog);
  const journalBrut = rGsk.logs.join('\n');
  check('log streaming : « gsk_test123… » masqué en « gsk_*** »', journalBrut.includes('gsk_***') && !/gsk_(?!\*\*\*)[A-Za-z0-9]/.test(journalBrut), journalBrut.slice(0, 200));
  check('masquerSecrets : "gsk_test123" → "gsk_***"', masquerSecrets('voici gsk_test123AB fin') === 'voici gsk_*** fin');
  const journalDiskPath = path.join(ROOT_DIR, 'journaux', 'sync-prix-journal.json');
  if (fs.existsSync(journalDiskPath)) {
    const journalDisk = fs.readFileSync(journalDiskPath, 'utf8');
    check('journal sync-prix sur disque : 0 clé brute', !/gsk_(?!\*\*\*)[A-Za-z0-9]/.test(journalDisk));
  } else {
    check('journal sync-prix sur disque : 0 clé brute', true, '(journal non créé — cas normal si aucun run réussi)');
  }
}

main().then(() => {
  console.log('\n════════════════════════════════════════');
  console.log('Résultat : ' + passed + ' ✅ / ' + failed + ' ❌');
  console.log('════════════════════════════════════════');
  if (serveur && lanceParTest) { try { serveur.kill(); } catch (e) { /* */ } }
  process.exitCode = failed > 0 ? 1 : 0;
});

