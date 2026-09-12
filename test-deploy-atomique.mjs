/**
 * 🧪 TESTS — Déploy du mode remplacement ATOMIQUE et VÉRIFIÉ (SHA256).
 *
 *   Usage : node test-deploy-atomique.mjs
 *
 * S'exécute dans un bac à sable isolé `.tmp-test-deploy/` (copie du moteur, du
 * contenu.js et d'images synthétiques) avec un dépôt git DÉDIÉ : le vrai dépôt
 * site-web n'est jamais modifié. Couvre :
 *   A. Déploy nominal (hash différent)  → image vivante == staging + commit OK
 *   B. Image identique à l'existante    → ABORT, contenu.js inchangé, staging conservé
 *   C. Échec simulé de copie            → ABORT explicite « copie d'image échouée »
 *   D. Régression insertion produit-0   → mode « insert » intact
 *   E. Cosmétique contenu.js + BOM/CRLF + node --check
 */
import { execFileSync, spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REAL_SITE_DIR = __dirname;
const REAL_ENGINE = path.join(REAL_SITE_DIR, 'control-tower-engine.js');
const REAL_CONTENU = path.join(REAL_SITE_DIR, 'contenu.js');
const SANDBOX = path.join(REAL_SITE_DIR, '.tmp-test-deploy');
const SANDBOX_SITE = path.join(SANDBOX, 'site-web');
const SANDBOX_ENGINE = path.join(SANDBOX_SITE, 'control-tower-engine.js');
const SANDBOX_CONTENU = path.join(SANDBOX_SITE, 'contenu.js');
const SANDBOX_IMAGES = path.join(SANDBOX_SITE, 'images');
const SANDBOX_STAGING = path.join(SANDBOX_IMAGES, '_staging');
const SANDBOX_JOURNAL_TXT = path.join(SANDBOX, 'journal_integrations.txt');

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}
const sha = (bufOrPath) => crypto.createHash('sha256')
  .update(Buffer.isBuffer(bufOrPath) ? bufOrPath : fs.readFileSync(bufOrPath))
  .digest('hex');
const git = (args) => execFileSync('git', args, { cwd: SANDBOX_SITE, encoding: 'utf-8' });

console.log('═'.repeat(78));
console.log('🧪 TESTS DEPLOY REMPLACEMENT ATOMIQUE (sandbox isolé)');
console.log('═'.repeat(78));

// ── Préparation du bac à sable ───────────────────────────────────────────────
try { fs.rmSync(SANDBOX, { recursive: true, force: true, maxRetries: 3 }); } catch { /* néant */ }
fs.mkdirSync(SANDBOX_SITE, { recursive: true });
fs.copyFileSync(REAL_ENGINE, SANDBOX_ENGINE);
fs.copyFileSync(REAL_CONTENU, SANDBOX_CONTENU);
fs.mkdirSync(SANDBOX_IMAGES, { recursive: true });
fs.mkdirSync(SANDBOX_STAGING, { recursive: true });

const imgOld = crypto.randomBytes(2048); // image vivante de départ (produit-7)
const imgNew = crypto.randomBytes(4096); // VRAIE nouvelle image (staging, test A)
fs.writeFileSync(path.join(SANDBOX_IMAGES, 'produit-7.jpg'), imgOld);

execFileSync('git', ['init'], { cwd: SANDBOX_SITE });
execFileSync('git', ['config', 'user.email', 'test@local'], { cwd: SANDBOX_SITE });
execFileSync('git', ['config', 'user.name', 'Test Sandbox'], { cwd: SANDBOX_SITE });
execFileSync('git', ['add', '.'], { cwd: SANDBOX_SITE });
execFileSync('git', ['commit', '-m', 'init sandbox'], { cwd: SANDBOX_SITE });

const engine = await import(pathToFileURL(SANDBOX_ENGINE).href);
const catalogBefore = engine.getCurrentCatalog();
check('sandbox prêt : 16 produits lus depuis la copie de contenu.js', catalogBefore.length === 16, `trouvé : ${catalogBefore.length}`);

const champsA = {
  nom: 'Arc de Test Nominal',
  description: 'Description de test pour le deploy nominal atomique du remplacement.',
  categorie: 'paysages',
  style: 'traditionnel',
  environnement: 'riad',
  imageFallback: '🏺',
  prix: 'À partir de 250 MAD',
  badge: 'Nouveau',
  materiauRecommande: 'Toile Canvas',
  montageRecommande: 'Cadre Américain',
  couleurs: ['Beige', 'Bleu Majorelle', 'Doré'],
  ambiance: 'Sérène et traditionnelle'
};

// ═════════════════════════════════════════════════════════════════════════════
// TEST A — Déploy NOMINAL (hash différent) : commit OK, hash vivant == staging
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n▶ TEST A — deploy nominal (hash différent) → commit OK');
engine.writePendingMeta({ mode: 'replace', productRank: 7, originalName: 'produit-7.jpg', aiChamps: JSON.parse(JSON.stringify(champsA)) });
fs.writeFileSync(path.join(SANDBOX_STAGING, 'produit-7.jpg'), imgNew);
const contenuBeforeA = fs.readFileSync(SANDBOX_CONTENU);
const hashStagingA = sha(imgNew);

const resA = await engine.executeReplacement(7, 'À partir de 250 MAD', JSON.parse(JSON.stringify(champsA)));

check('résultat success = true', resA && resA.success === true);
check('hash image vivante == hash staging', sha(path.join(SANDBOX_IMAGES, 'produit-7.jpg')) === hashStagingA);
check('resultat expose imageSha256 == staging', resA.imageSha256 === hashStagingA);
check('contenu.js : fiche rang 7 réécrite', engine.getCurrentCatalog()[6].nom === champsA.nom);
check('contenu.js : BOM préservé', contenuBeforeA[0] === 0xEF && fs.readFileSync(SANDBOX_CONTENU)[0] === 0xEF);
check('contenu.js : CRLF préservés', contenuBeforeA.includes(Buffer.from([13, 10])) && fs.readFileSync(SANDBOX_CONTENU).includes(Buffer.from([13, 10])));
const catalogAfterA = engine.getCurrentCatalog();
check('contenu.js : les 10 autres fiches INCHANGÉES (zéro décalage)',
  catalogBefore.every((p, i) => i === 6 || (p.nom === catalogAfterA[i].nom && p.image === catalogAfterA[i].image && p.prix === catalogAfterA[i].prix)));
check('staging purgé après succès', fs.existsSync(SANDBOX_STAGING) && fs.readdirSync(SANDBOX_STAGING).length === 0);
check('méta purge après succès', !fs.existsSync(path.join(SANDBOX_IMAGES, '_pending-meta.json')));
check('journal (txt) écrit : REMPLACEMENT produit-7', fs.existsSync(SANDBOX_JOURNAL_TXT) && fs.readFileSync(SANDBOX_JOURNAL_TXT, 'utf-8').includes('REMPLACEMENT produit-7'));
check('commit créé (status 0)', resA.commit && resA.commit.commit && resA.commit.commit.status === 0);
const statA = git(['show', '--stat', '--format=%s', 'HEAD']);
check('commit contient contenu.js', statA.includes('contenu.js'), statA.split('\n').slice(0, 6).join(' | '));
check('commit contient images/produit-7.jpg', statA.includes('images/produit-7.jpg'));
check('commit = image + fiche ENSEMBLE (atomique)', statA.includes('contenu.js') && statA.includes('images/produit-7.jpg'));
check('arbre git propre après deploy', git(['status', '--porcelain']).trim() === '');
const journalAfterA = fs.readFileSync(SANDBOX_JOURNAL_TXT, 'utf-8');

// ═════════════════════════════════════════════════════════════════════════════
// TEST B — Image IDENTIQUE à l'existante → ABORT complet (cas du run 3d84f72)
// ═════════════════════════════════════════════════════════════════════════════
console.log("\n▶ TEST B — image identique à l'existante → abort, contenu.js inchangé");
engine.writePendingMeta({ mode: 'replace', productRank: 7, originalName: 'produit-7.jpg', aiChamps: JSON.parse(JSON.stringify(champsA)) });
fs.writeFileSync(path.join(SANDBOX_STAGING, 'produit-7.jpg'), imgNew); // mêmes octets que la vivante
const contenuBeforeB = fs.readFileSync(SANDBOX_CONTENU);
const headBeforeB = git(['rev-parse', 'HEAD']);

let errB = null;
try { await engine.executeReplacement(7, 'À partir de 250 MAD', JSON.parse(JSON.stringify(champsA))); }
catch (e) { errB = e; }

check('abort levé', errB !== null, 'aucune erreur levée !');
check("erreur explicite « image déposée identique à l'existante »", errB && errB.message.includes("image déposée identique à l'existante"), errB && errB.message);
check('contenu.js INCHANGÉ (aucune écriture)', Buffer.compare(contenuBeforeB, fs.readFileSync(SANDBOX_CONTENU)) === 0);
check('image vivante inchangée', sha(path.join(SANDBOX_IMAGES, 'produit-7.jpg')) === sha(imgNew));
check('staging CONSERVÉ (retry possible)', fs.existsSync(path.join(SANDBOX_STAGING, 'produit-7.jpg')));
check('aucun commit parasite', git(['rev-parse', 'HEAD']) === headBeforeB);
check('journal inchangé', fs.readFileSync(SANDBOX_JOURNAL_TXT, 'utf-8') === journalAfterA);

// ═════════════════════════════════════════════════════════════════════════════
// TEST C — Échec SIMULÉ de copie → ABORT explicite « copie d'image échouée »
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n▶ TEST C — échec simulé de copie → abort explicite');
const imgC = crypto.randomBytes(8192);
engine.writePendingMeta({ mode: 'replace', productRank: 7, originalName: 'produit-7.jpg', aiChamps: JSON.parse(JSON.stringify(champsA)) });
fs.writeFileSync(path.join(SANDBOX_STAGING, 'produit-7.jpg'), imgC);
fs.mkdirSync(`${path.join(SANDBOX_IMAGES, 'produit-7.jpg')}.deploy-tmp`); // bloque la copie (EISDIR/EPERM)
const contenuBeforeC = fs.readFileSync(SANDBOX_CONTENU);
const headBeforeC = git(['rev-parse', 'HEAD']);

let errC = null;
try { await engine.executeReplacement(7, 'À partir de 250 MAD', JSON.parse(JSON.stringify(champsA))); }
catch (e) { errC = e; }

check('abort levé', errC !== null, 'aucune erreur levée !');
check("erreur explicite « copie d'image échouée »", errC && errC.message.includes("copie d'image échouée"), errC && errC.message);
check('contenu.js INCHANGÉ', Buffer.compare(contenuBeforeC, fs.readFileSync(SANDBOX_CONTENU)) === 0);
check('image vivante inchangée', sha(path.join(SANDBOX_IMAGES, 'produit-7.jpg')) === sha(imgNew));
check('staging CONSERVÉ', fs.existsSync(path.join(SANDBOX_STAGING, 'produit-7.jpg')));
check('aucun commit parasite', git(['rev-parse', 'HEAD']) === headBeforeC);
try { fs.rmSync(`${path.join(SANDBOX_IMAGES, 'produit-7.jpg')}.deploy-tmp`, { recursive: true, force: true }); } catch { /* néant */ }

// ═════════════════════════════════════════════════════════════════════════════
// TEST D — Régression INSERTION produit-0 (pipeline « insert » inchangé)
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n▶ TEST D — régression insertion produit-0 inchangée');
fs.writeFileSync(path.join(SANDBOX_IMAGES, 'produit-0.jpg'), crypto.randomBytes(1024));
const pend = engine.detectPendingMockup();
check('detectPendingMockup voit produit-0.jpg', pend && pend.exists === true && pend.filename === 'produit-0.jpg');
const mode0 = engine.detectDroppedMode('produit-0.jpg', catalogBefore);
check('produit-0 → mode "insert" (productRank 0)', mode0 && mode0.mode === 'insert' && mode0.productRank === 0);
const mode7 = engine.detectDroppedMode('produit-7.jpg', catalogBefore);
check('produit-7 → mode "replace" (productRank 7)', mode7 && mode7.mode === 'replace' && mode7.productRank === 7);
check('detectReplacementStaging ignore produit-0 (N ≥ 1 seulement)',
  (fs.writeFileSync(path.join(SANDBOX_STAGING, 'produit-0.jpg'), crypto.randomBytes(512)),
    fs.writeFileSync(path.join(SANDBOX_STAGING, 'produit-7.jpg'), imgC),
    engine.detectReplacementStaging().filename === 'produit-7.jpg'));

// ═════════════════════════════════════════════════════════════════════════════
// TEST E — Cosmétique contenu.js réel + BOM/CRLF + node --check
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n▶ TEST E — cosmétique contenu.js réel + BOM/CRLF + node --check');
const realContenu = fs.readFileSync(REAL_CONTENU);
const realTxt = realContenu.toString('utf-8');
check('produit-7 : « À partir de 100 MAD » (accent ajouté)', realTxt.includes('prix: "À partir de 100 MAD"'));
check('aucun « A partir de 100 MAD » restant', !realTxt.includes('A partir de 100 MAD'));
check('commentaire options : « commit + push GitHub »', realTxt.includes('redéployez le site via commit + push GitHub'));
check('commentaire options : plus de « Netlify Drop »', !realTxt.includes('Netlify Drop'));
check('commentaire produits : environnements alignés (cabinet, ecole-primaire, autres)', realTxt.includes('salon, chambre, bureau, entree, riad, cabinet, ecole-primaire, autres'));
check('commentaire produits : plus de salle-de-bain/cuisine', !realTxt.includes('salle-de-bain') && !realTxt.includes('cuisine'));
check('commentaire produits : art-deco, autres (styles)', realTxt.includes('minimaliste, boheme, art-deco, autres'));
check('BOM préservé sur contenu.js réel', realContenu[0] === 0xEF && realContenu[1] === 0xBB && realContenu[2] === 0xBF);
check('CRLF préservés sur contenu.js réel', realContenu.includes(Buffer.from([13, 10])));
for (const f of ['control-tower-engine.js', 'contenu.js', 'server.js']) {
  const r = spawnSync('node', ['--check', f], { cwd: REAL_SITE_DIR });
  check(`node --check ${f} → exit 0`, r.status === 0, r.stderr && r.stderr.toString('utf-8').slice(0, 300));
}

// ── Nettoyage du bac à sable ────────────────────────────────────────────────
try { fs.rmSync(SANDBOX, { recursive: true, force: true, maxRetries: 3 }); } catch { /* néant */ }

console.log('\n' + '═'.repeat(78));
console.log(`RÉSULTAT : ${passed} ✅ / ${failed} ❌`);
console.log('═'.repeat(78));
process.exitCode = failed > 0 ? 1 : 0;
