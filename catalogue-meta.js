/**
 * ═══════════════════════════════════════════════════════════════
 *  CATALOGUE-META — listes RUNTIME dérivées de contenu.js
 *
 *  Aucune liste de valeurs n'est codée en dur ici : types, montages,
 *  triptyques, styles et pièces sont recalculés à chaque lecture.
 *  `ALIAS_TYPES` et `LABELS_CONNUS` sont des TABLES DE LIBELLÉS (présentation),
 *  pas des listes d'options : tout type inconnu reçoit un libellé dérivé.
 *
 *  Le slug est calculé ICI (implémentation canonique, celle de
 *  medias-stables.js) et exposé par fiche : index.html le consomme au lieu
 *  de le recalculer (D4 : le nom prime sur le rang, homonymes suffixés -2).
 *
 *  Chargé comme script classique dans le navigateur (global
 *  `CatalogueMeta`) et exécuté dans un bac VM côté serveur/tests.
 * ═══════════════════════════════════════════════════════════════
 */
(function (global) {
  'use strict';

  function sansAccents(texte) {
    return String(texte == null ? '' : texte)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  /** Slug canonique d'une œuvre (identique à site-web/medias-stables.js). */
  function slugifier(texte) {
    var s = sansAccents(texte)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    return s;
  }

  var ALIAS_TYPES = {
    paysage: 'paysages',
    paysages: 'paysages',
    geometrique: 'geometrique',
    'art-deco': 'art-deco',
    'art deco': 'art-deco',
    autre: 'autres',
    autres: 'autres'
  };

  /** Table de libellés (présentation uniquement) — repli dérivé sinon. */
  var LABELS_CONNUS = {
    abstrait: 'Abstrait',
    paysages: 'Paysages',
    calligraphie: 'Calligraphie',
    moderne: 'Moderne',
    geometrique: 'Géométrique',
    floral: 'Floral',
    autres: 'Autres',
    contemporain: 'Contemporain',
    traditionnel: 'Traditionnel',
    minimaliste: 'Minimaliste',
    boheme: 'Bohème',
    'art-deco': 'Art Déco',
    salon: 'Salon',
    chambre: 'Chambre',
    bureau: 'Bureau',
    entree: 'Entrée',
    riad: 'Riad',
    cabinet: 'Cabinet',
    'ecole-primaire': 'École primaire'
  };

  function normaliserValeur(valeur) {
    var brut = String(valeur == null ? '' : valeur).trim();
    if (!brut) return '';
    var slug = slugifier(brut);
    return ALIAS_TYPES[slug] || slug;
  }

  function labeliser(valeur) {
    var id = normaliserValeur(valeur);
    if (!id) return '';
    if (LABELS_CONNUS[id]) return LABELS_CONNUS[id];
    return id
      .split('-')
      .filter(Boolean)
      .map(function (mot) { return mot.charAt(0).toUpperCase() + mot.slice(1); })
      .join(' ');
  }

  function typeDe(produit) {
    if (!produit) return 'autres';
    return normaliserValeur(produit.type || produit.categorie) || 'autres';
  }

  function montageBrut(produit) {
    if (!produit) return '';
    return String(produit.montageRecommande || produit.montage || '').trim().replace(/\s+/g, ' ');
  }

  /** Clé de comparaison d'un montage (accents/casse/espaces neutralisés). */
  function cleMontage(label) {
    return sansAccents(label).toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Canonicalise un libellé de montage sur la PREMIÈRE graphie rencontrée dans
   * le catalogue : « Châssis bois » et « Châssis Bois » ne créent plus deux
   * entrées. `canon` est construit à l'exécution (aucune liste en dur).
   */
  function montageDe(produit, canon) {
    var brut = montageBrut(produit);
    if (!brut || !canon) return brut;
    return canon.get(cleMontage(brut)) || brut;
  }

  function booleen(valeur) {
    if (valeur === true || valeur === 1) return true;
    if (typeof valeur === 'string') {
      var v = valeur.trim().toLowerCase();
      return v === 'true' || v === 'oui' || v === '1';
    }
    return false;
  }

  function panneauxDe(produit) {
    if (!produit) return null;
    var n = Number(produit.panneaux);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /**
   * `panneaux` reste la source éditoriale prioritaire ; `triptyque` ne peut
   * jamais contredire un nombre de panneaux explicite. Option = 3 exactement.
   */
  function estTriptyque(produit) {
    if (!produit) return false;
    var panneaux = panneauxDe(produit);
    if (panneaux != null) return panneaux === 3;
    return booleen(produit.triptyque);
  }

  function estIncertaine(produit) {
    return Boolean(produit && booleen(produit.metaIncertaine));
  }

  function ajouterCompteur(map, id) {
    if (!id) return;
    map[id] = (map[id] || 0) + 1;
  }

  /** Cache des libellés canoniques de montage, dérivé du catalogue fourni. */
  function construireCanonMontages(produits) {
    var canon = new Map();
    (produits || []).forEach(function (produit) {
      var brut = montageBrut(produit);
      if (!brut) return;
      var cle = cleMontage(brut);
      if (!canon.has(cle)) canon.set(cle, brut);
    });
    return canon;
  }

  function listeDepuisCompteur(compteur, labelFn) {
    return Object.keys(compteur)
      .map(function (id) {
        return { id: id, label: labelFn ? labelFn(id) : id, count: compteur[id] };
      })
      .sort(function (a, b) {
        if (b.count !== a.count) return b.count - a.count;
        return String(a.label).localeCompare(String(b.label), 'fr');
      });
  }

  /**
   * Analyse complète du catalogue.
   * @param {Array<object>|{produits:Array<object>}} entree
   */
  function analyserCatalogue(entree) {
    var produits = Array.isArray(entree)
      ? entree
      : (entree && Array.isArray(entree.produits) ? entree.produits : []);

    var types = {};
    var montages = {};
    var styles = {};
    var environnements = {};
    var triptyques = [];
    var incertains = [];
    var fiches = [];
    var avertissements = [];
    var canonMontages = construireCanonMontages(produits);
    var slugsVus = new Map();

    produits.forEach(function (produit, index) {
      var rang = index + 1;
      var nom = (produit && produit.nom) || '(sans nom)';
      var base = slugifier(nom) || ('oeuvre-' + rang);
      var occurrence = (slugsVus.get(base) || 0) + 1;
      slugsVus.set(base, occurrence);
      var slug = occurrence === 1 ? base : base + '-' + occurrence;

      var type = typeDe(produit);
      var montage = montageDe(produit, canonMontages);
      var style = normaliserValeur(produit && produit.style);
      var environnement = normaliserValeur(produit && produit.environnement);
      var panneaux = panneauxDe(produit);
      var triptyque = estTriptyque(produit);
      var incertaine = estIncertaine(produit);

      if (panneaux == null) {
        avertissements.push({
          code: 'PANNEAUX_ABSENT',
          index: index,
          rang: rang,
          nom: nom,
          message: 'champ `panneaux` absent — hypothèse uni, à corriger dans contenu.js'
        });
      } else if (panneaux !== 1 && panneaux !== 3) {
        avertissements.push({
          code: 'PANNEAUX_INVALIDE',
          index: index,
          rang: rang,
          nom: nom,
          message: 'panneaux=' + panneaux + ' hors {1,3} — fiche à arbitrer'
        });
      }

      var fiche = {
        index: index,
        rang: rang,
        nom: nom,
        slug: slug,
        type: type,
        typeLabel: labeliser(type),
        montage: montage,
        montageLabel: montage || 'Non précisé',
        style: style,
        styleLabel: labeliser(style),
        environnement: environnement,
        environnementLabel: labeliser(environnement),
        panneaux: panneaux,
        triptyque: triptyque,
        metaIncertaine: incertaine
      };

      ajouterCompteur(types, type);
      ajouterCompteur(montages, montage);
      ajouterCompteur(styles, style);
      ajouterCompteur(environnements, environnement);
      if (triptyque) triptyques.push(fiche);
      if (incertaine) incertains.push(fiche);
      fiches.push(fiche);
    });

    return {
      produits: fiches,
      types: listeDepuisCompteur(types, labeliser),
      montages: listeDepuisCompteur(montages, function (id) { return id; }),
      groupes: {
        type: listeDepuisCompteur(types, labeliser),
        style: listeDepuisCompteur(styles, labeliser),
        env: listeDepuisCompteur(environnements, labeliser),
        montage: listeDepuisCompteur(montages, function (id) { return id; })
      },
      triptyques: triptyques,
      incertains: incertains,
      avertissements: avertissements,
      total: fiches.length
    };
  }

  /** Différentiel utilisé par les hooks serveur (types ajoutés, triptyques…). */
  function comparerAnalyses(avant, apres) {
    var typesAvant = {};
    (avant && avant.types ? avant.types : []).forEach(function (t) { typesAvant[t.id] = true; });
    var typesAjoutes = (apres && apres.types ? apres.types : [])
      .filter(function (t) { return !typesAvant[t.id]; })
      .map(function (t) { return t.id; });

    var triptyquesAvant = {};
    (avant && avant.triptyques ? avant.triptyques : []).forEach(function (p) { triptyquesAvant[p.rang] = true; });
    var triptyquesDetectes = (apres && apres.triptyques ? apres.triptyques : [])
      .filter(function (p) { return !triptyquesAvant[p.rang]; })
      .map(function (p) { return { rang: p.rang, nom: p.nom }; });

    return {
      typesAjoutes: typesAjoutes,
      triptyquesDetectes: triptyquesDetectes,
      metaIncertaine: (apres && apres.incertains ? apres.incertains : []).map(function (p) {
        return { rang: p.rang, nom: p.nom };
      }),
      totalTypes: apres && apres.types ? apres.types.length : 0,
      totalMontages: apres && apres.montages ? apres.montages.length : 0,
      totalTriptyques: apres && apres.triptyques ? apres.triptyques.length : 0,
      totalIncertains: apres && apres.incertains ? apres.incertains.length : 0,
      totalAvertissements: apres && apres.avertissements ? apres.avertissements.length : 0
    };
  }

  var api = {
    analyserCatalogue: analyserCatalogue,
    comparerAnalyses: comparerAnalyses,
    typeDe: typeDe,
    montageDe: montageDe,
    estTriptyque: estTriptyque,
    estIncertaine: estIncertaine,
    normaliserValeur: normaliserValeur,
    slugifier: slugifier,
    labeliser: labeliser
  };

  global.CatalogueMeta = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
