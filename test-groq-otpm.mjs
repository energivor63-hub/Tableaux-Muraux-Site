/**
 * 🧪 TESTS — Correction Groq 429 OTPM de l'analyse vision (Tour de Contrôle).
 *
 *   Usage : node test-groq-otpm.mjs
 *
 * Couvre (v2 OTPM + v3 thinking / json_validate) :
 *   A. Chemin INSERTION    → payload Groq : max_tokens ≤ 950 + schéma compact clés courtes
 *   B. Chemin REMPLACEMENT → idem
 *   C. Chemin RÉGÉNÉRATION → idem
 *   D. 429 puis succès     → backoff spécial OTPM (2 retries espacés), succès final
 *   E. 429 persistant      → ABORT propre avec toast clair « quota Groq : nouvelle
 *                            tentative dans ~1 min » (aucun retry 15 s inutile)
 *   F. Erreur non-429      → retry normal (pause 15 s) conservé
 *   G. parseVisionChamps   → clés courtes ET longues, taxonomie, défauts moteur
 *   H. Câblage statique    → les 3 chemins du moteur appellent analyzeMockupWithAI
 *   I. 400 json_validate_failed puis 200 → UN seul retry IMMÉDIAT avec rappel de
 *      compacité, /no_think conservé en FIN de prompt (fix v3)
 *   J. 400 json_validate persistant → ABORT après 2 appels max (zéro cascade OTPM)
 *   K. 200 tronqué (budget max_tokens épuisé) → réparation JSON → fiche complète
 *
 * fetch est 100 % mocké (AUCUN appel réseau réel). Les délais sont réduits via
 * GROQ_RATE_LIMIT_DELAY_MS / GROQ_RETRY_DELAY_MS (défauts production : 65000 / 15000).
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Environnement de test (AVANT import du moteur : constantes lues à l'import) ──
process.env.GROQ_API_KEY = 'test-key-otpm';
process.env.GROQ_RETRY_DELAY_MS = '30';
process.env.GROQ_RATE_LIMIT_DELAY_MS = '150';
delete process.env.GEMINI_API_KEY;
delete process.env.CONTROL_TOWER_FAKE_AI;

const {
  analyzeMockupWithAI,
  parseVisionChamps,
  GROQ_VISION_MODEL,
  GROQ_MAX_TOKENS,
  GROQ_RETRY_DELAY_MS,
  GROQ_RATE_LIMIT_DELAY_MS,
  GROQ_RATE_LIMIT_TOAST
} = await import('./control-tower-engine.js');

// ── Réponse IA simulée (schéma COMPACT à clés courtes, comme demandé au modèle) ──
const COMPACT_OK = {
  nom: 'Volute Calligraphique Dorée',
  desc: "Thuluth noir rehaussé d'or sur fond crème texturé. Les arabesques s'enlacent dans une lumière douce et noble.",
  cat: 'calligraphie',
  style: 'traditionnel',
  env: 'salon',
  coul: ['Beige', 'Crème', 'Doré', 'Noir'],
  amb: 'Spirituelle, noble et chaleureuse',
  mat: 'Toile Canvas',
  mont: 'Cadre Américain',
  fallback: '📜'
};

// ── Harnais : fetch mocké + file d'attente de réponses ──
const captured = [];
let scripted = [];

globalThis.fetch = async (url, opts = {}) => {
  const step = scripted.shift();
  assert.ok(step, 'Aucune réponse scriptée restante (appel fetch inattendu)');
  const body = JSON.parse(opts.body || '{}');
  captured.push({ url: String(url), body, at: Date.now() });

  if (step.status === 429) {
    return {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => JSON.stringify({
        error: {
          message: "Request too large for model `qwen/qwen3.6-27b` in organization `org_test` service tier `on_demand` on output tokens per minute (OTPM): Limit 1000, Requested 1689. The request's expected output tokens exceed the enforced limit; reduce max_tokens and try again.",
          type: 'tokens',
          code: 'rate_limit_exceeded'
        }
      })
    };
  }
  if (step.status === 400 && step.jsonValidate) {
    return {
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: async () => JSON.stringify({
        error: {
          message: "Failed to validate your prompt. See 'failed_generation' for more details.",
          type: 'invalid_request_error',
          code: 'json_validate_failed',
          failed_generation: ''
        }
      })
    };
  }
  if (step.status !== 200) {
    return {
      ok: false,
      status: step.status,
      statusText: 'Internal Server Error',
      text: async () => 'erreur serveur simulée'
    };
  }
  const contentText = step.raw !== undefined ? step.raw : JSON.stringify(step.content ?? COMPACT_OK);
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ choices: [{ message: { content: contentText } }] })
  };
};

// ── Image maquette temporaire (octets JPEG factices) ──
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'groq-otpm-'));
const imagePath = path.join(tmpDir, 'maquette.jpg');
fs.writeFileSync(imagePath, Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(128, 7)]));

function assertPayload(body, label) {
  assert.strictEqual(typeof body.max_tokens, 'number', `${label}: max_tokens doit être numérique`);
  assert.ok(body.max_tokens <= 950, `${label}: max_tokens (${body.max_tokens}) doit être ≤ 950`);
  assert.strictEqual(body.max_tokens, GROQ_MAX_TOKENS, `${label}: max_tokens doit valoir GROQ_MAX_TOKENS (950)`);
  assert.strictEqual(body.model, GROQ_VISION_MODEL, `${label}: modèle vision Groq attendu`);
  assert.strictEqual(body.response_format && body.response_format.type, 'json_object', `${label}: response_format json_object`);
  const prompt = body.messages[0].content[0].text;
  assert.ok(prompt.includes('"coul"'), `${label}: le prompt doit exiger la clé courte "coul"`);
  assert.ok(prompt.includes('"desc"'), `${label}: le prompt doit exiger la clé courte "desc"`);
  assert.ok(prompt.includes('CONTRAINTES DE COMPACITÉ'), `${label}: le prompt doit verrouiller la compacité`);
  assert.ok(
    Array.isArray(body.messages[0].content) && body.messages[0].content.some((c) => c.type === 'image_url'),
    `${label}: le payload doit contenir l'image en base64`
  );
  assert.ok(
    prompt.endsWith('/no_think'),
    `${label}: la directive /no_think doit terminer le prompt utilisateur (modèle qwen)`
  );
}

async function runPath(queue) {
  scripted = queue.slice();
  captured.length = 0;
  const t0 = Date.now();
  const champs = await analyzeMockupWithAI(imagePath);
  return { champs, elapsed: Date.now() - t0, calls: captured.slice() };
}

// ═════════════════ A/B/C — LES 3 CHEMINS (fetch mocké) ═════════════════
// Un funnel unique : executeAutoIntegration (insertion), prepareReplacement
// (remplacement) et regenerateFiche (régénération) appellent tous les trois
// analyzeMockupWithAI → on exécute ce funnel 3 fois et on vérifie CHAQUE payload.
for (const label of ['INSERTION', 'REMPLACEMENT', 'RÉGÉNÉRATION']) {
  const { champs, calls } = await runPath([{ status: 200 }]);
  assert.strictEqual(calls.length, 1, `${label}: un seul appel réseau attendu`);
  assertPayload(calls[0].body, label);
  assert.strictEqual(champs.description, COMPACT_OK.desc, `${label}: desc → description`);
  assert.strictEqual(champs.categorie, 'calligraphie', `${label}: cat → categorie (taxonomie)`);
  assert.strictEqual(champs.style, 'traditionnel', `${label}: style inchangé`);
  assert.strictEqual(champs.environnement, 'salon', `${label}: env → environnement`);
  assert.deepStrictEqual(champs.couleurs, COMPACT_OK.coul, `${label}: coul → couleurs`);
  assert.strictEqual(champs.ambiance, COMPACT_OK.amb, `${label}: amb → ambiance`);
  assert.strictEqual(champs.materiauRecommande, 'Toile Canvas', `${label}: mat → materiauRecommande`);
  assert.strictEqual(champs.montageRecommande, 'Cadre Américain', `${label}: mont → montageRecommande`);
  assert.strictEqual(champs.imageFallback, '📜', `${label}: fallback → imageFallback`);
  assert.strictEqual(champs.prix, 'À partir de 180 MAD', `${label}: prix par défaut moteur`);
  assert.strictEqual(champs.badge, 'Nouveau', `${label}: badge par défaut moteur`);
  console.log(`✅ [${label}] payload Groq vérifié — max_tokens=${calls[0].body.max_tokens} (≤ 950), schéma compact clés courtes appliqué`);
}

// ═════════════════ D — 429 PUIS SUCCÈS : LE BACKOFF FONCTIONNE ═════════════════
{
  const { champs, elapsed, calls } = await runPath([{ status: 429 }, { status: 429 }, { status: 200 }]);
  assert.strictEqual(calls.length, 3, 'scénario 429,429,succès → 3 appels (1 essai + 2 retries spéciaux OTPM)');
  for (const c of calls) assertPayload(c.body, 'backoff 429');
  assert.ok(
    elapsed >= 2 * GROQ_RATE_LIMIT_DELAY_MS,
    `backoff 429 : 2 pauses fenêtre OTPM attendues (>= ${2 * GROQ_RATE_LIMIT_DELAY_MS} ms, réel ${elapsed} ms)`
  );
  assert.ok(
    elapsed < 2 * GROQ_RATE_LIMIT_DELAY_MS + GROQ_RETRY_DELAY_MS * 3,
    'backoff 429 : aucune pause normale (15 s) ne doit se glisser dans le scénario'
  );
  assert.strictEqual(champs.nom, COMPACT_OK.nom, 'succès final après backoff');
  console.log(`✅ [BACKOFF 429 → SUCCÈS] 3 appels, ${elapsed} ms (≥ 2 × ${GROQ_RATE_LIMIT_DELAY_MS} ms) — la fenêtre OTPM est respectée`);
}

// ═════════════════ E — 429 PERSISTANT : ABORT PROPRE + TOAST CLAIR ═════════════════
{
  scripted = [{ status: 429 }, { status: 429 }, { status: 429 }];
  captured.length = 0;
  const t0 = Date.now();
  await assert.rejects(
    () => analyzeMockupWithAI(imagePath),
    (err) => {
      assert.ok(/quota Groq : nouvelle tentative dans ~1 min/.test(err.message), 'le message final doit contenir la phrase toast claire');
      assert.ok(/\b429\b/.test(err.message) || /OTPM/.test(err.message), 'le message final doit expliquer le 429 OTPM');
      assert.ok(/Aucune fiche n'a été écrite/.test(err.message), "le message doit garantir qu'aucune fiche n'est écrite");
      return true;
    },
    '429 persistant doit aborter proprement avec le toast clair'
  );
  const elapsed = Date.now() - t0;
  assert.strictEqual(captured.length, 3, '429 persistant → 1 essai + 2 retries spéciaux puis ABORT (pas de retry 15 s inutile)');
  assert.ok(elapsed >= 2 * GROQ_RATE_LIMIT_DELAY_MS, "les 2 pauses OTPM de 65 s doivent être honorées avant l'abort");
  console.log(`✅ [429 PERSISTANT → ABORT PROPRE] ${captured.length} appels, toast « ${GROQ_RATE_LIMIT_TOAST} » présent, aucune fiche écrite / staging conservé`);
}

// ═════════════════ F — ERREUR NON-429 : RETRY NORMAL CONSERVÉ ═════════════════
{
  const { elapsed, calls } = await runPath([{ status: 500 }, { status: 200 }]);
  assert.strictEqual(calls.length, 2, 'erreur 500 puis succès → 2 appels (retry normal)');
  assert.ok(elapsed >= GROQ_RETRY_DELAY_MS - 5, 'la pause normale (15 s en prod) est conservée');
  assert.ok(elapsed < GROQ_RATE_LIMIT_DELAY_MS, 'aucun backoff OTPM 65 s sur une erreur non-429');
  console.log('✅ [ERREUR NON-429] retry normal conservé — pas de backoff OTPM inutile');
}

// ═════════════════ I — 400 JSON_VALIDATE_FAILED PUIS 200 : RETRY UNIQUE IMMÉDIAT ═════════════════
{
  scripted = [{ status: 400, jsonValidate: true }, { status: 200 }];
  captured.length = 0;
  const t0 = Date.now();
  const champs = await analyzeMockupWithAI(imagePath);
  const elapsed = Date.now() - t0;
  assert.strictEqual(captured.length, 2, '400 json_validate_failed → UN seul retry immédiat (2 appels au total)');
  assertPayload(captured[0].body, '400→200 (1er appel)');
  assertPayload(captured[1].body, '400→200 (retry)');
  assert.ok(
    !captured[0].body.messages[0].content[0].text.includes('RAPPEL DE COMPACITÉ'),
    'le premier appel ne contient pas encore le rappel de compacité'
  );
  const retryText = captured[1].body.messages[0].content[0].text;
  assert.ok(retryText.includes('RAPPEL DE COMPACITÉ'), 'le retry doit contenir le rappel de compacité');
  assert.ok(retryText.endsWith('/no_think'), 'la directive /no_think reste en FIN de prompt sur le retry');
  assert.ok(elapsed < GROQ_RETRY_DELAY_MS, `retry JSON immédiat : aucune pause 15 s (réel ${elapsed} ms < ${GROQ_RETRY_DELAY_MS} ms)`);
  assert.strictEqual(champs.nom, COMPACT_OK.nom, 'succès après le retry unique');
  console.log(`✅ [400 JSON → RETRY UNIQUE IMMÉDIAT] 2 appels, ${elapsed} ms, rappel de compacité présent, /no_think conservé`);
}

// ═════════════════ J — 400 JSON_VALIDATE PERSISTANT : ABORT APRÈS 2 APPELS MAX ═════════════════
{
  scripted = [{ status: 400, jsonValidate: true }, { status: 400, jsonValidate: true }];
  captured.length = 0;
  await assert.rejects(
    () => analyzeMockupWithAI(imagePath),
    (err) => {
      assert.ok(/Échec de l'analyse visuelle par l'IA Groq/.test(err.message), 'abort propre : message générique existant (toast existant)');
      assert.ok(/json_validate_failed/.test(err.message), 'le message final expose la cause json_validate_failed');
      assert.ok(/après 2 tentatives/.test(err.message), 'le message rend compte des 2 appels exactement');
      return true;
    },
    '400 persistant doit aborter après UN seul retry (2 appels max)'
  );
  assert.strictEqual(captured.length, 2, 'zéro cascade : exactement 2 appels (1 essai + 1 retry), aucune cascade OTPM');
  console.log('✅ [400 PERSISTANT → ABORT] 2 appels max, zéro cascade OTPM, toast existant');
}

// ═════════════════ K — 200 TRONQUÉ : RÉPARATION JSON → FICHE COMPLÈTE ═════════════════
{
  // K1 : tronqué en pleine chaîne à l'intérieur d'un tableau
  scripted = [{ status: 200, raw: '{"nom":"Volute Dorée","desc":"Deux phrases précises.","cat":"calligraphie","style":"traditionnel","env":"salon","coul":["Beige","Cr' }];
  captured.length = 0;
  const k1 = await analyzeMockupWithAI(imagePath);
  assert.strictEqual(captured.length, 1, '200 tronqué : réparation locale, aucun appel supplémentaire');
  assert.strictEqual(k1.nom, 'Volute Dorée');
  assert.strictEqual(k1.description, 'Deux phrases précises.');
  assert.strictEqual(k1.categorie, 'calligraphie');
  assert.deepStrictEqual(k1.couleurs, ['Beige', 'Cr'], 'chaîne tronquée refermée par la réparation');
  for (const key of ['nom', 'description', 'categorie', 'style', 'environnement', 'imageFallback', 'prix', 'badge', 'materiauRecommande', 'montageRecommande', 'couleurs', 'ambiance']) {
    assert.ok(Object.prototype.hasOwnProperty.call(k1, key), `fiche complète : champ ${key} présent (13 champs, « image » étant posé côté fiche)`);
  }

  // K2 : tronqué sur une clé sans valeur (« desc": »)
  scripted = [{ status: 200, raw: '{"nom":"Patio Zellige","desc":' }];
  captured.length = 0;
  const k2 = await analyzeMockupWithAI(imagePath);
  assert.strictEqual(k2.nom, 'Patio Zellige');
  assert.ok(k2.description.includes('Tableau mural'), 'desc pendante → null → défaut moteur appliqué');

  // K3 : tronqué juste après une virgule pendante
  scripted = [{ status: 200, raw: '{"nom":"Arc Mauve","style":"contemporain",' }];
  captured.length = 0;
  const k3 = await analyzeMockupWithAI(imagePath);
  assert.strictEqual(k3.nom, 'Arc Mauve');
  assert.strictEqual(k3.style, 'contemporain');

  console.log('✅ [200 TRONQUÉ → RÉPARATION] fiche complète récupérée (chaîne / clé sans valeur / virgule pendante), défauts moteur appliqués');
}

// ═════════════════ G — parseVisionChamps (clés courtes, longues, défauts) ═════════════════
{
  const court = parseVisionChamps({ ...COMPACT_OK, mat: 'bâche premium', mont: 'Châssis Bois', env: 'riad' });
  assert.strictEqual(court.materiauRecommande, 'bâche premium', 'mat "bâche premium" reconnu');
  assert.strictEqual(court.montageRecommande, 'Châssis Bois', 'mont "Châssis Bois" reconnu');
  assert.strictEqual(court.environnement, 'riad', 'env taxonomie riad');

  const longues = parseVisionChamps({
    nom: 'Patio aux Mille Couleurs',
    description: 'Deux phrases.',
    categorie: 'paysages',
    style: 'contemporain',
    environnement: 'salon',
    couleurs: ['Bleu', 'Blanc'],
    ambiance: 'Fraîche et minérale',
    materiauRecommande: 'haute définition',
    montageRecommande: 'châssis',
    imageFallback: '🏺',
    prix: 'À partir de 220 MAD',
    badge: 'Coup de cœur'
  });
  assert.strictEqual(longues.description, 'Deux phrases.', 'compatibilité clés longues');
  assert.strictEqual(longues.categorie, 'paysages', 'compatibilité clés longues');
  assert.strictEqual(longues.imageFallback, '🏺', 'compatibilité clés longues');
  assert.strictEqual(longues.materiauRecommande, 'bâche premium', 'détection "haute définition" → bâche premium');
  assert.strictEqual(longues.montageRecommande, 'Châssis Bois', 'détection "châssis" → Châssis Bois');
  assert.strictEqual(longues.prix, 'À partir de 220 MAD', "prix long conservé s'il est fourni");
  assert.strictEqual(longues.badge, 'Coup de cœur', "badge long conservé s'il est fourni");

  const defauts = parseVisionChamps({});
  assert.strictEqual(defauts.prix, 'À partir de 180 MAD', 'défaut prix moteur');
  assert.strictEqual(defauts.badge, 'Nouveau', 'défaut badge moteur');
  assert.strictEqual(defauts.materiauRecommande, 'Toile Canvas', 'défaut matériau');
  assert.strictEqual(defauts.montageRecommande, 'Cadre Américain', 'défaut montage');
  assert.strictEqual(defauts.couleurs.length, 3, 'défaut palette');
  console.log('✅ [parseVisionChamps] clés courtes + clés longues (compat) + défauts moteur');
}

// ═════════════════ H — CÂBLAGE STATIQUE DES 3 CHEMINS ═════════════════
{
  const src = fs.readFileSync(path.join(__dirname, 'control-tower-engine.js'), 'utf8');
  const anchors = [
    ['insertion', 'export async function executeAutoIntegration'],
    ['remplacement', 'export async function prepareReplacement'],
    ['régénération', 'export async function regenerateFiche']
  ];
  const idx = anchors.map(([, a]) => src.indexOf(a));
  assert.ok(idx.every((i) => i > 0) && idx[0] < idx[1] && idx[1] < idx[2], 'ordre inattendu des fonctions du moteur');

  const ranges = [
    ['insertion', idx[0], idx[1]],
    ['remplacement', idx[1], idx[2]],
    ['régénération', idx[2], src.length]
  ];
  for (const [label, start, end] of ranges) {
    assert.ok(src.slice(start, end).includes('analyzeMockupWithAI'), `le chemin ${label} doit appeler analyzeMockupWithAI`);
  }
  const injections = (src.match(/max_tokens:/g) || []).length;
  assert.strictEqual(injections, 1, `un seul point d'injection max_tokens attendu (trouvé : ${injections})`);
  console.log('✅ [CÂBLAGE 3 CHEMINS] insertion + remplacement + régénération → analyzeMockupWithAI ; max_tokens injecté en un point unique');
}

// ── Contrôle global : TOUS les payloads capturés respectent le plafond ──
for (const c of captured) {
  assert.strictEqual(typeof c.body.max_tokens, 'number', 'tous les payloads doivent porter max_tokens');
  assert.ok(c.body.max_tokens <= 950, `tous les payloads : max_tokens ≤ 950 (vu ${c.body.max_tokens})`);
  assert.strictEqual(c.url, 'https://api.groq.com/openai/v1/chat/completions', 'URL Groq inchangée');
}
console.log(`✅ [GLOBAL] ${captured.length} payloads capturés au total — max_tokens ≤ 950 partout, URL Groq inchangée`);

// ── Nettoyage ──
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('\n🎉 TOUS LES TESTS GROQ OTPM SONT PASSÉS.');
