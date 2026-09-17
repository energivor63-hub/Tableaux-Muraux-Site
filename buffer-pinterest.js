// ═══════════════════════════════════════════════════════════════════════
// BUFFER PINTEREST — CIBLAGE DU BOARD OFFICIEL (résolution + cache)
// ═══════════════════════════════════════════════════════════════════════
// SESSION 10 : toute épingle publiée via Buffer doit atterrir dans le board
// officiel « Nos meilleures œuvres — art mural marocain ». JAMAIS de
// publication sans board cible résolu (sinon erreur explicite « Tableau
// Pinterest introuvable » au journal + toast dashboard).
//
// SESSION 2026-09-17 : la PUBLICATION (mutation createPost unifiée
// facebook + instagram + pinterest) vit désormais dans site-web/buffer-graphql.js.
// Ce fichier ne conserve QUE la résolution du board officiel Pinterest,
// réutilisée par buffer-graphql.js (publierViaBufferGraphql).
//
// Mécanisme (réutilise la logique VALIDÉE des scripts de test du projet) :
//  - Listing des boards : GraphQL `channel(input:)` → PinterestMetadata.boards
//    (test_buffer_boards.py). Les endpoints REST v1 (/1/profiles.json,
//    /1/boards/{id}.json) répondent 400 « Unsupported Content-Type » avec la
//    clé actuelle → voie GraphQL retenue (vérifié en direct le 07/09/2026).
//  - Détection du board cible : slug d'URL ou nom normalisé (œ → oe).
//  - Publication (dans buffer-graphql.js) : mutation `createPost` +
//    metadata.pinterest.boardServiceId + metadata.pinterest.url = lien de
//    destination du site (test_buffer_publish.py v5 FINAL ; introspection
//    live 2026-09-17 : PinterestPostMetadataInput { boardServiceId, title, url }).
//
// SESSION 13 (introspection GraphQL en direct, 07/09/2026) : transmission de
// l'alt text ET de la transparence IA à Buffer (gérée côté buffer-graphql.js) :
//  - altText : champ `ImageMetadataInput.altText` via `assets[].image.metadata.altText`.
//  - disclosure IA : champ `CreatePostInput.aiAssisted` → `aiAssisted: true`.
// ═══════════════════════════════════════════════════════════════════════

// BOARD CIBLE (exact) — constantes de référence
export const PINTEREST_BOARD_URL =
  'https://www.pinterest.com/ideawovenartmural/nos-meilleures-%C5%93uvres-art-mural-marocain/';
export const PINTEREST_BOARD_SLUG = 'nos-meilleures-œuvres-art-mural-marocain';
export const PINTEREST_BOARD_NAME = 'Nos meilleures œuvres — art mural marocain';

const BUFFER_GRAPHQL_URL = (String(process.env.BUFFER_GRAPHQL_BASE || 'https://api.buffer.com').replace(/\/+$/, '')) + '/graphql';
const BOARD_CACHE_TTL_MS = 10 * 60 * 1000; // mise en cache : 10 minutes

let boardCache = null; // { board, resolvedAt }

// Clé de comparaison : décodage URI, minuscules, mapping explicite des
// ligatures sans décomposition Unicode (œ → oe, æ → ae, ß → ss), NFKD +
// diacritiques supprimés, tout caractère non alphanumérique → '-'
export function normalizeBoardKey(value) {
  if (!value) return '';
  let s = String(value).trim().toLowerCase();
  try { s = decodeURIComponent(s); } catch { /* déjà décodé */ }
  s = s.replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/ß/g, 'ss');
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Listing des boards du canal Pinterest (GraphQL Buffer)
export async function fetchPinterestBoards(apiKey, channelId) {
  const query = `
    query GetChannel($input: ChannelInput!) {
      channel(input: $input) {
        id
        name
        service
        metadata {
          __typename
          ... on PinterestMetadata {
            boards { id name serviceId url }
          }
        }
      }
    }`;
  const res = await fetch(BUFFER_GRAPHQL_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { input: { id: channelId } } })
  });
  if (!res.ok) throw new Error(`Buffer HTTP ${res.status} (listing des boards)`);
  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(`Buffer GraphQL : ${json.errors.map((e) => e.message).join(' ; ')}`);
  }
  const channel = json && json.data && json.data.channel;
  if (!channel) throw new Error('Buffer : canal Pinterest introuvable');
  const meta = channel.metadata;
  if (!meta || meta.__typename !== 'PinterestMetadata' || !Array.isArray(meta.boards)) {
    throw new Error("Buffer : le canal n'expose pas de boards Pinterest (metadata absente)");
  }
  return meta.boards.map((b) => ({ id: b.id, serviceId: b.serviceId, name: b.name || '', url: b.url || '' }));
}

// Résolution du board cible (cache 10 min ; override BUFFER_PINTEREST_BOARD_ID)
export async function resolvePinterestBoard({ apiKey, channelId, env = process.env, forceRefresh = false } = {}) {
  if (!apiKey) throw new Error('BUFFER_API_KEY manquante dans .env');
  if (!channelId) throw new Error('BUFFER_PINTEREST_CHANNEL_ID manquante dans .env');
  if (!forceRefresh && boardCache && Date.now() - boardCache.resolvedAt < BOARD_CACHE_TTL_MS) {
    return boardCache.board;
  }
  const boards = await fetchPinterestBoards(apiKey, channelId);
  const forcedId = String(env.BUFFER_PINTEREST_BOARD_ID || '').trim();
  let board = null;
  if (forcedId) {
    // Override : forcer l'ID (validé contre la liste réelle du canal)
    board = boards.find((b) => b.id === forcedId || b.serviceId === forcedId) || null;
    if (!board) {
      throw new Error(
        `Tableau Pinterest introuvable : BUFFER_PINTEREST_BOARD_ID=${forcedId} ne correspond à aucun board du canal. Boards disponibles : ${boards.map((b) => `${b.name} (${b.url})`).join(' | ')}`
      );
    }
  } else {
    const targetKey = normalizeBoardKey(PINTEREST_BOARD_SLUG);
    board =
      boards.find((b) => normalizeBoardKey(b.url).includes(targetKey) || normalizeBoardKey(b.name).includes(targetKey)) ||
      null;
    if (!board) {
      throw new Error(
        `Tableau Pinterest introuvable : aucun board ne correspond au board cible « ${PINTEREST_BOARD_NAME} » (${PINTEREST_BOARD_URL}). Boards disponibles : ${boards.map((b) => `${b.name} (${b.url})`).join(' | ')}. Le board doit être synchronisé dans Buffer, ou forcer BUFFER_PINTEREST_BOARD_ID dans .env.`
      );
    }
  }
  boardCache = { board, resolvedAt: Date.now() };
  return board;
}

// Réinitialisation du cache (tests)
export function resetBoardCache() {
  boardCache = null;
}
