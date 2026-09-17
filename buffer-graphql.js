// ═══════════════════════════════════════════════════════════════════════
// BUFFER GRAPHQL — PUBLICATION UNIFIÉE (facebook + instagram + pinterest)
// ═══════════════════════════════════════════════════════════════════════
// SESSION 2026-09-17 : TOUTE la publication sociale migre vers Buffer GraphQL
// (https://api.buffer.com/graphql). Le REST v1 Buffer est MORT pour les tokens
// personnels (« Public API tokens are not accepted », sunset 2027-02-01) ; la
// clé personnelle (Bearer) fonctionne UNIQUEMENT via GraphQL.
//
// ═══ SOURCE DE LA FORME createPost (AUCUNE supposition) ═══
// 1. INTROSPECTION GraphQL LIVE api.buffer.com, le 2026-09-17, avec la clé
//    personnelle (query __type(name:"CreatePostInput") / "ShareMode" /
//    "SchedulingType" / "AssetInput" / "ImageAssetInput" / "PostInputMetaData" /
//    "PinterestPostMetadataInput" / "ImageMetadataInput" + __schema.mutationType).
// 2. Documentation developers.buffer.com : guides/your-first-post (mutation
//    createPost + PostActionSuccess/MutationError) et examples/create-image-post
//    (assets[{ image: { url } }] — « The url must point to a publicly
//    accessible file »).
//
// CHAMPS EXACTS CreatePostInput (introspection live 2026-09-17) :
//   text            String                          (texte de la publication)
//   channelId       NON_NULL ChannelId              ← SINGULIER (PAS « channelIds »)
//   mode            NON_NULL ShareMode (ENUM : addToQueue, customScheduled,
//                   shareNext, shareNow)            ← « publishNow » N'EXISTE PAS
//                   dans le schéma : la publication IMMÉDIATE = « shareNow »
//                   (valeur validée en live le 07/09/2026, test_buffer_publish.py v5)
//   schedulingType  NON_NULL SchedulingType (ENUM : automatic | notification)
//   needsApproval   NON_NULL Boolean
//   assets          NON_NULL LIST<NON_NULL AssetInput>
//                   AssetInput { image: ImageAssetInput | video | document }
//                   ImageAssetInput { url: NON_NULL String, thumbnailUrl,
//                   metadata: ImageMetadataInput { altText: NON_NULL String, … } }
//   aiAssisted      Boolean                         (disclosure IA)
//   metadata        PostInputMetaData { pinterest: PinterestPostMetadataInput {
//                   boardServiceId: String, title: String, url: String }, … }
//   (aussi présents, non utilisés : saveToDraft, draftId, dueAt, ideaId,
//    source, tagIds[TagId])
// RÉPONSE : Mutation.createPost → PostActionPayload (union) :
//   PostActionSuccess { post { id text status dueAt channel { id name service } } }
//   | MutationError { message } (réponse HTTP 200 quand même !)
// ERREURS TRANSPORT : { errors: [{ message, extensions… }] } possible sur HTTP 200
//   → TOUJOURS inspecter .errors avant data.
// ═══════════════════════════════════════════════════════════════════════

import { resolvePinterestBoard } from './buffer-pinterest.js';

const BUFFER_GRAPHQL_BASE = String(process.env.BUFFER_GRAPHQL_BASE || 'https://api.buffer.com').replace(/\/+$/, '');
const BUFFER_GRAPHQL_URL = BUFFER_GRAPHQL_BASE + '/graphql';
const CANAUX_CACHE_TTL_MS = 10 * 60 * 1000; // cache des canaux : 10 minutes

const LABEL_RESEAU = { facebook: 'Facebook', instagram: 'Instagram', pinterest: 'Pinterest' };
const SERVICE_ATTENDU = { facebook: 'facebook', instagram: 'instagram', pinterest: 'pinterest' };
// Overrides .env : ID de canal figé par réseau (courte-circuite la query channels)
const OVERRIDE_ENV = {
  facebook: 'BUFFER_FACEBOOK_CHANNEL_ID',
  instagram: 'BUFFER_INSTAGRAM_CHANNEL_ID',
  pinterest: 'BUFFER_PINTEREST_CHANNEL_ID'
};

let canauxCache = null; // { map: {facebook: id, instagram: id, pinterest: id}, resolvedAt }

/** Erreur Buffer GraphQL structurée (message + code optionnel + httpStatus). */
export class BufferGraphqlError extends Error {
  constructor(message, { code, httpStatus, channelId } = {}) {
    super(message);
    this.name = 'BufferGraphqlError';
    this.code = code || undefined;
    this.httpStatus = httpStatus || undefined;
    this.channelId = channelId || undefined;
  }
}

/**
 * Appel GraphQL POST unique : Authorization Bearer BUFFER_API_KEY, corps
 * { query, variables }. GraphQL renvoie HTTP 200 MÊME EN ERREUR → le statut
 * HTTP ne suffit JAMAIS : .errors est inspecté systématiquement.
 * Renvoie { httpStatus, data, errors }. Lève BufferGraphqlError sur errors[].
 */
export async function requeteGraphQL({ env = process.env, query, variables = {} } = {}) {
  const apiKey = String(env.BUFFER_API_KEY || '').trim();
  if (!apiKey) throw new BufferGraphqlError('BUFFER_API_KEY manquante dans .env (clé personnelle Buffer, Settings → API)');
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 30000);
  let res;
  try {
    res = await fetch(BUFFER_GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controleur.signal
    });
  } catch (e) {
    throw new BufferGraphqlError(`Buffer GraphQL injoignable (${e.message}) : ${BUFFER_GRAPHQL_URL}`, { httpStatus: 0 });
  } finally {
    clearTimeout(minuteur);
  }
  const texte = await res.text();
  let json;
  try { json = JSON.parse(texte); } catch (e) { json = { brut: texte.slice(0, 1500) }; }
  const errors = Array.isArray(json.errors) ? json.errors : [];
  // HTTP 200 + errors[] = erreur GraphQL réelle (jamais considérer 200 comme succès)
  if (errors.length) {
    const details = errors.map((e) => e && e.message ? String(e.message) : JSON.stringify(e)).join(' ; ');
    const code = errors[0] && errors[0].extensions && errors[0].extensions.code;
    throw new BufferGraphqlError(`Buffer GraphQL errors[] (HTTP ${res.status}) : ${details}`, { code, httpStatus: res.status });
  }
  if (!res.ok) {
    throw new BufferGraphqlError(`Buffer HTTP ${res.status} : ${String(json.brut || texte).slice(0, 300)}`, { httpStatus: res.status });
  }
  return { httpStatus: res.status, data: json.data || null, errors: [] };
}

// Query canaux : channels(input:{organizationId}) { id name service } —
// source : introspection live 2026-09-17 + developers.buffer.com/guides/your-first-post (Step 2)
const QUERY_CANAUX = `
  query GetChannels($input: ChannelsInput!) {
    channels(input: $input) { id name service }
  }`;

/**
 * Résolution des canaux : query channels(input:{organizationId}) → map
 * service→id, cache 10 min. Overrides .env (BUFFER_*_CHANNEL_ID) appliqués
 * PAR-DESSUS la réponse (l'override gagne : canal figé volontairement).
 * Canal manquant → BufferGraphqlError ACTIONNABLE (voir resoudreCanalReseau).
 */
export async function lireCanaux({ env = process.env, forceRefresh = false } = {}) {
  const organizationId = String(env.BUFFER_ORGANIZATION_ID || '').trim();
  if (!organizationId) {
    throw new BufferGraphqlError("BUFFER_ORGANIZATION_ID manquant dans .env — récupérez l'id d'organisation via query { account { organizations { id name } } } (guide « Your First Post », Step 1)");
  }
  const map = {};
  ['facebook', 'instagram', 'pinterest'].forEach((reseau) => {
    const override = String(env[OVERRIDE_ENV[reseau]] || '').trim();
    if (override) map[reseau] = override;
  });
  const manquants = ['facebook', 'instagram', 'pinterest'].filter((r) => !map[r]);
  if (!forceRefresh && canauxCache && Date.now() - canauxCache.resolvedAt < CANAUX_CACHE_TTL_MS) {
    manquants.forEach((r) => { if (canauxCache.map[r]) map[r] = canauxCache.map[r]; });
    return map;
  }
  if (manquants.length) {
    const { data } = await requeteGraphQL({ env, query: QUERY_CANAUX, variables: { input: { organizationId } } });
    const canaux = (data && Array.isArray(data.channels)) ? data.channels : [];
    canaux.forEach((c) => {
      const service = String((c && c.service) || '').trim().toLowerCase();
      if (SERVICE_ATTENDU[service] && !map[service]) map[service] = String(c.id || '');
    });
  }
  canauxCache = { map: { ...map }, resolvedAt: Date.now() };
  return map;
}

/** Réinitialisation du cache canaux (tests). */
export function resetCanauxCache() {
  canauxCache = null;
}

/**
 * Canal d'un réseau : override .env SINON map channels. Absent → cause
 * ACTIONNABLE (« connectez le canal X dans Buffer (Settings → Channels) »).
 */
export async function resoudreCanalReseau({ reseau, env = process.env } = {}) {
  let map;
  try {
    map = await lireCanaux({ env });
  } catch (e) {
    if (e instanceof BufferGraphqlError) throw e;
    throw new BufferGraphqlError(`Résolution des canaux Buffer impossible : ${e.message}`);
  }
  const canalId = String(map[reseau] || '').trim();
  if (!canalId) {
    throw new BufferGraphqlError(
      `Canal ${LABEL_RESEAU[reseau]} introuvable dans l'organisation Buffer — connectez le canal ${LABEL_RESEAU[reseau]} dans Buffer (Settings → Channels), puis redémarrez le serveur (ou figez BUFFER_${reseau.toUpperCase()}_CHANNEL_ID dans .env).`
    );
  }
  return canalId;
}

// Mutation createPost — forme EXACTE (introspection live 2026-09-17 + guide
// « Your First Post » + exemple « Create Image Post »). Réponse en union :
// PostActionSuccess { post … } | MutationError { message } (+ variantes
// d'erreurs validées en live le 07/09/2026 — buffer-pinterest.js v5 FINAL).
const MUTATION_CREATE_POST = `
  mutation CreatePostBuffer($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess { post { id text status dueAt channel { id name service } } }
      ... on MutationError { message }
      ... on InvalidInputError { message }
      ... on UnauthorizedError { message }
      ... on NotFoundError { message }
      ... on LimitReachedError { message }
      ... on UnexpectedError { message }
      ... on RestProxyError { message }
    }
  }`;

/**
 * UNE mutation createPost par réseau, avec SA variante de texte :
 *   channelId (SINGULIER — introspection) · text · mode shareNow (publication
 *   immédiate — « publishNow » absent du schéma, cf. commentaire d'en-tête) ·
 *   schedulingType automatic · needsApproval false · aiAssisted true (disclosure
 *   IA) · assets [{ image: { url } }] (URL publique GitHub Pages, pré-vérifiée
 *   200 côté server.js) · altText optionnel · metadata.pinterest
 *   { boardServiceId, title, url } pour le ciblage du board officiel Pinterest.
 * Succès = post.id dans data.createPost (PostActionSuccess) ; échec = errors[]
 * ou MutationError → BufferGraphqlError (cause : message + code).
 */
export async function creerPost({ reseau, channelId, texte, mediaUrl, altText, titrePin, lien, board, env = process.env } = {}) {
  const input = {
    channelId, // NON_NULL ChannelId — SINGULIER (introspection 2026-09-17)
    text: texte || '',
    schedulingType: 'automatic', // NON_NULL SchedulingType — ENUM automatic|notification
    mode: 'shareNow',            // NON_NULL ShareMode — publication IMMÉDIATE (pas de « publishNow » dans le schéma)
    needsApproval: false,        // NON_NULL Boolean — publication directe, sans file d'approbation
    aiAssisted: true,            // disclosure IA (CreatePostInput.aiAssisted — SESSION 13)
    assets: [{ image: { url: mediaUrl } }] // AssetInput { image: { url } } — url publique obligatoire
  };
  if (altText) input.assets[0].image.metadata = { altText }; // ImageMetadataInput.altText
  if (reseau === 'pinterest' && board) {
    input.metadata = { pinterest: { boardServiceId: board.serviceId } };
    if (titrePin) input.metadata.pinterest.title = titrePin;
    if (lien) input.metadata.pinterest.url = lien; // lien de destination du site
  }
  const { data } = await requeteGraphQL({ env, query: MUTATION_CREATE_POST, variables: { input } });
  const outcome = data && data.createPost;
  if (!outcome) throw new BufferGraphqlError('Buffer : réponse createPost vide (ni PostActionSuccess ni MutationError)', { channelId });
  if (outcome.message) {
    // MutationError / InvalidInputError / UnauthorizedError / … → message lisible
    throw new BufferGraphqlError(`Buffer createPost (${LABEL_RESEAU[reseau]}) : ${outcome.message}`, { channelId });
  }
  if (!outcome.post || !outcome.post.id) {
    throw new BufferGraphqlError('Buffer : publication sans identifiant de post (PostActionSuccess.post.id absent)', { channelId });
  }
  return {
    postId: outcome.post.id,
    status: outcome.post.status || null,
    dueAt: outcome.post.dueAt || null,
    channel: outcome.post.channel || null,
    channelId
  };
}

/**
 * Orchestrateur serveur : UNE publication Buffer GraphQL pour UN réseau.
 *   1. canal = override .env SINON channels(input:{organizationId}) (cache 10 min) ;
 *   2. Pinterest : board officiel OBLIGATOIRE résolu via channel(input:) →
 *      PinterestMetadata.boards (site-web/buffer-pinterest.js, SESSION 10) ;
 *   3. mutation createPost mode shareNow avec la variante du réseau.
 * Renvoie { postId, status, dueAt, channelId, channel, board, mode } — lève
 * BufferGraphqlError (message + code) que server.js journalise.
 */
export async function publierViaBufferGraphql({ reseau, texte, mediaUrl, alt, titrePin, lien, env = process.env } = {}) {
  if (!SERVICE_ATTENDU[reseau]) throw new BufferGraphqlError(`Réseau non routé vers Buffer : ${reseau}`);
  const canalId = await resoudreCanalReseau({ reseau, env });
  let board = null;
  if (reseau === 'pinterest') {
    board = await resolvePinterestBoard({ apiKey: String(env.BUFFER_API_KEY || ''), channelId: canalId, env });
  }
  const outcome = await creerPost({ reseau, channelId: canalId, texte, mediaUrl, altText: alt, titrePin, lien, board, env });
  return { ...outcome, board, mode: 'shareNow' };
}
