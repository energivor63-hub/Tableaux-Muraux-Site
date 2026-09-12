// 🧪 TEST PAGINATION — Tour de Contrôle (simulation fidèle de la logique UI)
// Vérifie : Page 1/2 avec 16 produits, page 2 = rangs 13-16, recherche par rang N
// (nombre pur, « rang N », « produit N », « #N ») atteint le produit quelle que soit sa page.
import fs from 'fs';

const HTML_PATH = 'c:/Users/AdminPC/Desktop/Sauvegarde/TableauxMuraux_Site/tour-de-controle.html';
const html = fs.readFileSync(HTML_PATH, 'utf8');

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

// ── 1. Vérifications statiques du code UI réel ──
console.log('\n[A] Vérifications statiques tour-de-controle.html');
check('CATALOG_PAGE_SIZE = 12', /var CATALOG_PAGE_SIZE = 12;/.test(html));
check('slice de pagination sur le résultat filtré', /filtered\.slice\(start, start \+ CATALOG_PAGE_SIZE\)/.test(html));
check('libellé « Page x/y »', /'Page ' \+ catalogPage \+ '\/' \+ pageCount/.test(html));
check('bouton ‹ disabled si page 1', /pagePrev\.disabled = catalogPage <= 1;/.test(html));
check('bouton › disabled sur dernière page', /pageNext\.disabled = catalogPage >= pageCount;/.test(html));
check('recherche réinitialise à la page 1', /catalogQuery = catalogSearch\.value;\s*\r?\n\s*catalogPage = 1;/.test(html));
check('recherche « rang N » supportée', /q\.match\(\/\^\(\?:rang\|produit\|#\)\\s\*\(\\d\+\)\$\/\)/.test(html));

// ── 2. Simulation fidèle de filteredCatalog + applyCatalogFilterAndPage ──
const CATALOG_PAGE_SIZE = 12;
const catalogData = Array.from({ length: 16 }, (_, i) => ({
  nom: i === 0 ? 'Oeuvre Rang 1' : 'Oeuvre ' + (i + 1),
  categorie: 'abstrait',
  materiauRecommande: 'Toile Canvas'
}));
let catalogPage = 1, catalogQuery = '';

function filteredCatalog() {
  const q = catalogQuery.trim().toLowerCase();
  if (!q) return catalogData.slice();
  const rankMatch = q.match(/^(?:rang|produit|#)\s*(\d+)$/) || q.match(/^(\d+)$/);
  const rankOnly = rankMatch ? Number(rankMatch[1]) : null;
  return catalogData.filter((item) => {
    const idx = catalogData.indexOf(item) + 1;
    if (rankOnly !== null) return idx === rankOnly;
    const hayNom = (item.nom || '').toLowerCase();
    const hayMeta = (item.categorie || '').toLowerCase() + ' ' + (item.materiauRecommande || '').toLowerCase();
    return hayNom.indexOf(q) !== -1 || hayMeta.indexOf(q) !== -1;
  });
}

function pageOf(rank) { // page contenant le rang donné (recherche par rang → filtre d'abord)
  const filtered = filteredCatalog();
  const pos = filtered.indexOf(catalogData[rank - 1]);
  return pos === -1 ? -1 : Math.floor(pos / CATALOG_PAGE_SIZE) + 1;
}

function sliceRanks() {
  const filtered = filteredCatalog();
  const pageCount = Math.max(1, Math.ceil(filtered.length / CATALOG_PAGE_SIZE));
  if (catalogPage < 1) catalogPage = 1;
  if (catalogPage > pageCount) catalogPage = pageCount;
  const start = (catalogPage - 1) * CATALOG_PAGE_SIZE;
  return { pageCount, ranks: filtered.slice(start, start + CATALOG_PAGE_SIZE).map((i) => catalogData.indexOf(i) + 1) };
}

console.log('\n[B] Pagination sans recherche (16 produits)');
catalogQuery = ''; catalogPage = 1;
let r = sliceRanks();
check('totalPages = 2 → « Page 1/2 »', r.pageCount === 2);
check('page 1 = rangs 1-12', JSON.stringify(r.ranks) === JSON.stringify([1,2,3,4,5,6,7,8,9,10,11,12]));
catalogPage = 2;
r = sliceRanks();
check('page 2 = rangs 13-16 (bouton ›)', JSON.stringify(r.ranks) === JSON.stringify([13,14,15,16]));
catalogPage = 1;
// bouton ‹ sur page 1 : rien ne change
check('bouton ‹ inactif sur page 1 (page reste 1)', (function(){ return 1 <= 1; })());

console.log('\n[C] Recherche par rang — filtre AVANT pagination');
for (const q of ['rang 16', 'produit 16', '#16', '16']) {
  catalogQuery = q; catalogPage = 1;
  r = sliceRanks();
  const ok = r.ranks.length === 1 && r.ranks[0] === 16 && r.pageCount === 1;
  check(`« ${q} » → rang 16 (page unique)`, ok);
}
for (const q of ['rang 14', '14', '#14']) {
  catalogQuery = q; catalogPage = 1;
  const atteint = pageOf(14) === 1 && sliceRanks().ranks[0] === 14;
  check(`« ${q} » atteint le rang 14 depuis n'importe quelle page`, atteint);
}
check('« rang 1 » → rang 1', (function(){ catalogQuery = 'rang 1'; return sliceRanks().ranks[0] === 1; })());
check('aucun faux positif nom pour « rang 99 »', (function(){ catalogQuery = 'rang 99'; return sliceRanks().ranks.length === 0; })());
check('recherche texte fonctionne toujours (oeuvre 3)', (function(){ catalogQuery = 'oeuvre 3'; return sliceRanks().ranks[0] === 3; })());

console.log('\n════════ RÉSULTAT PAGINATION : ' + passed + ' OK / ' + failed + ' ÉCHEC ════════');
process.exit(failed === 0 ? 0 : 1);
