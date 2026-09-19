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
//   metadata        PostInputMetaData (type PAR RÉSEAU — introspection live 2026-09-17 :
//                   PAS de champ type sur CreatePostInput lui-même) :
//                     facebook  → FacebookPostMetadataInput.type : NON_NULL PostTypeFacebook
//                                 (ENUM : post, reel, story)
//                     instagram → InstagramPostMetadataInput.type : NON_NULL PostType
//                                 (ENUM : carousel, event, ghost_post, offer, post, reel,
//                                 short, story, thread, whats_new)
//                     pinterest → PinterestPostMetadataInput { boardServiceId, title, url }
//                                 — AUCUN champ type (rien à ajouter pour Pinterest)
//                   Erreur réelle sans lui (17/09/2026, dashboard) : « Invalid post:
//                   Instagram/Facebook posts require a type (post, story, or reel) ».
//   (aussi présents, non utilisés : saveToDraft, draftId, dueAt, ideaId,
//    source, tagIds[TagId])
//
// ══ CHAMPS OBLIGATOIRES DÉCOUVERTS EN ERREUR RÉELLE (jamais supposés) ═══
// • metadata.instagram.shouldShareToFeed : NON_NULL Boolean! — OBLIGATOIRE.
//   Preuve EXACTE, journal_integrations.json entrée Instagram du 17/09/2026
//   21:29:23 (HTTP 200, transport GraphQL) :
//     « Variable "$input" got invalid value { type: "post" } at
//       "input.metadata.instagram"; Field "shouldShareToFeed" of required type
//       "Boolean!" was not provided. »
//   → cause réelle du FAUX SUCCÈS Instagram du 17/09 (aucun post IG côté
//     Buffer alors que le dashboard affichait un succès). Valeur envoyée :
//     true (partage aussi dans le fil du compte — vraie publication IG).
//
// ═══ RÉPONSE : UNION TYPÉE (jamais conclure sur la seule présence de data) ══
// Mutation.createPost → PostActionPayload (union) :
//   PostActionSuccess { post { id text status dueAt channel { id name service } } }
//   | MutationError { message } | InvalidInputError { message } | … (HTTP 200
//   DANS LES DEUX CAS : la variante erreur arrive dans data.createPost, PAS
//   dans errors[] !)
// → le succès n'est conclu QUE si __typename = PostActionSuccess ET post.id
//   présent ; toute autre variante = échec avec cause = message de la variante.
// ERREURS TRANSPORT : { errors: [{ message, extensions… }] } possible sur HTTP 200
//   → TOUJOURS inspecter .errors avant data.
// → reponseBrute (JSON tronqué 2000 car., secrets masqués côté server.js) est
//   renvoyée/journalisée PAR RÉSEAU pour chaque createPost.
// ═══════════════════════════════════════════════════════════════════════

import { resolvePinterestBoard } from './buffer-pinterest.js';
import { coupePropre, plafonnerTitrePinterest } from './social-variants.js';

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

/** Erreur Buffer GraphQL structurée (message + code optionnel + httpStatus
 * + reponseBrute : variante/réponse brute TRONQUÉE à 2000 caractères pour le
 * journal — secrets masqués côté server.js avant écriture). */
export class BufferGraphqlError extends Error {
  constructor(message, { code, httpStatus, channelId, reponseBrute } = {}) {
    super(message);
    this.name = 'BufferGraphqlError';
    this.code = code || undefined;
    this.httpStatus = httpStatus || undefined;
    this.channelId = channelId || undefined;
    this.reponseBrute = reponseBrute || undefined;
  }
}

/** Réponse brute pour le journal : JSON sérialisé, TRONQUÉ à 2000 caractères. */
function reponseBruteTronquee(valeur) {
  try { return JSON.stringify(valeur === undefined ? null : valeur).slice(0, 2000); }
  catch (e) { return String(valeur).slice(0, 2000); }
}


/**
 * Appel GraphQL POST unique : Authorization Bearer BUFFER_API_KEY, corps
 * { query, variables }. GraphQL renvoie HTTP 200 MÊME EN ERREUR → le statut
 * HTTP ne suffit JAMAIS : .errors est inspecté systématiquement.
 * Renvoie { httpStatus, data, errors, reponseBrute } (reponseBrute = réponse
 * brute JSON TRONQUÉE à 2000 car., pour le journal par réseau).
 * Lève BufferGraphqlError sur errors[] (avec reponseBrute attachée).
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
  const reponseBrute = reponseBruteTronquee(json); // journal par réseau (tronqué 2000)
  const errors = Array.isArray(json.errors) ? json.errors : [];
  // HTTP 200 + errors[] = erreur GraphQL réelle (jamais considérer 200 comme succès)
  if (errors.length) {
    const details = errors.map((e) => e && e.message ? String(e.message) : JSON.stringify(e)).join(' ; ');
    const code = errors[0] && errors[0].extensions && errors[0].extensions.code;
    throw new BufferGraphqlError(`Buffer GraphQL errors[] (HTTP ${res.status}) : ${details}`, { code, httpStatus: res.status, reponseBrute });
  }
  if (!res.ok) {
    throw new BufferGraphqlError(`Buffer HTTP ${res.status} : ${String(json.brut || texte).slice(0, 300)}`, { httpStatus: res.status, reponseBrute });
  }
  return { httpStatus: res.status, data: json.data || null, errors: [], reponseBrute };
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

// Typenames de la variante ERREUR de l'union PostActionPayload (introspection
// live 2026-09-17 + guide « Your First Post » : createPost → PostActionSuccess
// | MutationError). Toute variante HORS succès = échec (jamais de faux succès).
const TYPENAMES_ERREUR = new Set([
  'MutationError', 'InvalidInputError', 'UnauthorizedError', 'NotFoundError',
  'LimitReachedError', 'UnexpectedError', 'RestProxyError'
]);

// Mutation createPost — forme EXACTE (introspection live 2026-09-17 + guide
// « Your First Post » + exemple « Create Image Post »). Réponse en union :
// PostActionSuccess { post … } | MutationError { message } (+ variantes
// d'erreurs validées en live le 07/09/2026 — buffer-pinterest.js v5 FINAL).
// __typename est DEMANDÉ explicitement : sans lui, impossible de distinguer la
// variante succès de la variante erreur (les DEUX arrivent dans data.createPost
// avec HTTP 200 → cause du FAUX SUCCÈS Instagram du 17/09/2026).
const MUTATION_CREATE_POST = `
  mutation CreatePostBuffer($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
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
 * SUCCÈS = variante SUCCÈS de l'union typée UNIQUEMENT :
 *   data.createPost.__typename === 'PostActionSuccess' ET post.id présent.
 * Tout le reste = BufferGraphqlError (cause = message de la variante + code) —
 * y compris une variante erreur arrivée en HTTP 200 dans data.createPost
 * (FAUX SUCCÈS Instagram du 17/09/2026 : data.createPost existait mais c'était
 * la variante d'erreur ; l'ancien code concluait « succès » à tort).
 * Renvoie { postId, status, dueAt, channel, channelId, reponseBrute }.
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
  } else if (reseau === 'facebook' || reseau === 'instagram') {
    // INTROSPECTION LIVE 2026-09-17 : le champ type est NON_NULL dans les
    // métadonnées PAR RÉSEAU (PAS sur CreatePostInput lui-même). Sans lui :
    // « Invalid post: Instagram/Facebook posts require a type (post, story, or reel) ».
    //   Facebook  → metadata.facebook.type  : NON_NULL PostTypeFacebook (enum : post, reel, story)
    //   Instagram → metadata.instagram.type : NON_NULL PostType (enum : carousel, event,
    //               ghost_post, offer, post, reel, short, story, thread, whats_new)
    // Valeur du POST STANDARD = 'post' (présente dans les 2 enums).
    // Pinterest : PinterestPostMetadataInput n'a PAS de champ type → rien à ajouter.
    input.metadata = { [reseau]: { type: 'post' } };
    if (reseau === 'instagram') {
      // NON_NULL Boolean! OBLIGATOIRE — preuve : erreur réelle du 17/09/2026
      // 21:29:23 (journal_integrations.json) « Field "shouldShareToFeed" of
      // required type "Boolean!" was not provided » (HTTP 200) ; sans lui AUCUN
      // post Instagram n'était créé malgré le « succès » affiché.
      input.metadata.instagram.shouldShareToFeed = true;
    }
  }
  const { data, reponseBrute } = await requeteGraphQL({ env, query: MUTATION_CREATE_POST, variables: { input } });
  const outcome = data && data.createPost;
  if (!outcome) {
    throw new BufferGraphqlError('Buffer : réponse createPost vide (ni PostActionSuccess ni MutationError)', { channelId, reponseBrute });
  }
  // ── Parsing PAR VARIANTE (union typée) : succès UNIQUEMENT sur PostActionSuccess
  const typename = outcome.__typename ? String(outcome.__typename) : null;
  if (TYPENAMES_ERREUR.has(typename)) {
    throw new BufferGraphqlError(
      `Buffer createPost (${LABEL_RESEAU[reseau]}) : ${outcome.message || `variante ${typename} sans message`}`,
      { channelId, code: typename, reponseBrute }
    );
  }
  const varianteSucces = typename
    ? typename === 'PostActionSuccess'
    : (!outcome.message && !!(outcome.post && outcome.post.id)); // repli : __typename absent de la réponse
  if (!varianteSucces) {
    throw new BufferGraphqlError(
      `Buffer createPost (${LABEL_RESEAU[reseau]}) : ${outcome.message || `variante non identifiable (__typename=${typename || 'absent'})`}`,
      { channelId, code: typename || undefined, reponseBrute }
    );
  }
  if (!outcome.post || !outcome.post.id) {
    // Variante succès MAIS sans identifiant : publication NON confirmée.
    throw new BufferGraphqlError('Buffer : PostActionSuccess sans post.id — publication NON confirmée (aucun faux succès)', { channelId, code: typename || undefined, reponseBrute });
  }
  return {
    postId: outcome.post.id,
    status: outcome.post.status || null,
    dueAt: outcome.post.dueAt || null,
    channel: outcome.post.channel || null,
    channelId,
    reponseBrute
  };
}

/** Limite Buffer : un post Pinterest ne peut pas dépasser 500 caractères
 * (InvalidInputError « Pinterest posts cannot exceed 500 characters » —
 * 3 échecs réels le 19/09/2026 : le texte envoyé = TITRE + "\n" + DESCRIPTION).
 * Le compteur du dashboard ne mesurait QUE la description : le garde-fou
 * s'applique ici, sur le TOTAL, juste avant createPost. */
export const PINTEREST_LIMITE_TOTALE = 500;

/**
 * Garde-fou Pinterest ≤ 500 caractères (total titre + 1 + description).
 * Si le total dépasse : (a) la ligne « Commande directe : … wa.me … » est
 * retirée d'abord (le lien part via metadata.pinterest.url, pas le texte) ;
 * (b) si encore > 500, tronquature PROPRE de la DESCRIPTION seule — titre
 * préservé intégralement, coupe au dernier espace avant (500 − titre − 1),
 * + « … » (la ligne « Mots-clés : … », en fin de description, saute en premier).
 * Renvoie { texte, titre, description, tronque, totalAvant, totalApres }.
 */
export function appliquerLimitePinterest500(texte) {
  const brut = String(texte || '');
  const coupe = brut.indexOf('\n');
  const titre = coupe === -1 ? brut : brut.slice(0, coupe);
  let description = coupe === -1 ? '' : brut.slice(coupe + 1);
  const total = () => titre.length + 1 + description.length;
  const totalAvant = total();
  if (totalAvant <= PINTEREST_LIMITE_TOTALE) {
    return { texte: brut, titre, description, tronque: false, totalAvant, totalApres: totalAvant };
  }
  // (a) La ligne WhatsApp saute : le lien de destination voyage dans
  // metadata.pinterest.url, pas dans le texte (économie ~45 caractères).
  description = description.split(/\r?\n/)
    .filter((ligne) => !/commande directe\s*:.*wa\.me/i.test(ligne))
    .join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
  if (total() <= PINTEREST_LIMITE_TOTALE) {
    return { texte: titre + '\n' + description, titre, description, tronque: true, totalAvant, totalApres: total() };
  }
  // (b) Tronquature propre : titre intact, coupe mot-entier + « … »
  // (coupePropre : jamais mi-mot, jamais dans un nom entre « … »).
  const budget = PINTEREST_LIMITE_TOTALE - titre.length - 1;
  if (description.length > budget) description = coupePropre(description, Math.max(0, budget));
  return { texte: titre + '\n' + description, titre, description, tronque: true, totalAvant, totalApres: total() };
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
  // Garde-fou Pinterest ≤ 500 (total titre + description, 19/09/2026) : le
  // texte envoyé ne dépasse JAMAIS la limite Buffer (InvalidInputError).
  let limitePin = null;
  if (reseau === 'pinterest') {
    board = await resolvePinterestBoard({ apiKey: String(env.BUFFER_API_KEY || ''), channelId: canalId, env });
    // Titre ≤ 100 d'abord (compteur du champ), puis total titre+description ≤ 500.
    const coupeTitre = String(texte || '').indexOf('\n');
    if (coupeTitre !== -1) {
      const titrePlafonne = plafonnerTitrePinterest(String(texte).slice(0, coupeTitre));
      if (titrePlafonne.corrige) texte = titrePlafonne.texte + String(texte).slice(coupeTitre);
    }
    limitePin = appliquerLimitePinterest500(texte);
    texte = limitePin.texte;
  }
  const outcome = await creerPost({ reseau, channelId: canalId, texte, mediaUrl, altText: alt, titrePin, lien, board, env });
  return {
    ...outcome, board, mode: 'shareNow',
    ...(limitePin && limitePin.tronque
      ? { tronque: true, totalAvant: limitePin.totalAvant, totalApres: limitePin.totalApres }
      : {})
  };
}
