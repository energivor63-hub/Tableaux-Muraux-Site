/**
 * ═══════════════════════════════════════════════════════════════
 *  TARIFS-LOADER — charge l'artefact publié site-web/tarifs.json
 *
 *  Source éditoriale unique : tarifs.json (racine), recopié en artefact
 *  COMMITÉ par registre/sync_tarifs_site.mjs (GitHub Pages ne publie que
 *  site-web/ : le navigateur ne peut pas lire la racine).
 *
 *  Garde v8 : version === 'v8', taux numériques, formats non vide,
 *  format de référence présent. Toute grille invalide est refusée.
 *  En test, `TARIFS_SITE` peut être injecté pour éviter tout accès réseau.
 * ═══════════════════════════════════════════════════════════════
 */
(function (global) {
  'use strict';

  var CLES_TAUX = ['bache_m2', 'canvas_m2', 'cadre_pin_ml'];
  var cache = null;
  var promesse = null;

  function clone(valeur) {
    return JSON.parse(JSON.stringify(valeur));
  }

  function valider(tarifs) {
    var erreurs = [];
    if (!tarifs || typeof tarifs !== 'object') {
      return ['grille absente ou non objet'];
    }
    if (tarifs.version !== 'v8') {
      erreurs.push('version « ' + (tarifs.version || '(absente)') + ' » inattendue, attendu v8');
    }
    var taux = tarifs.taux_matieres_premieres || {};
    CLES_TAUX.forEach(function (cle) {
      if (typeof taux[cle] !== 'number' || !isFinite(taux[cle])) {
        erreurs.push('taux_matieres_premieres.' + cle + ' manquant ou non numérique');
      }
    });
    if (!Array.isArray(tarifs.formats) || tarifs.formats.length === 0) {
      erreurs.push('formats absents');
    } else if (!tarifs.formats.some(function (f) { return String(f.id) === String(tarifs.reference_format); })) {
      erreurs.push('reference_format « ' + tarifs.reference_format + ' » absent des formats');
    }
    return erreurs;
  }

  function depuisObjet(tarifs) {
    var erreurs = valider(tarifs);
    if (erreurs.length) {
      throw new Error('Grille tarifaire invalide — ' + erreurs.join(' ; '));
    }
    cache = clone(tarifs);
    return cache;
  }

  function actuels() {
    return cache;
  }

  function charger(url) {
    if (cache) return Promise.resolve(cache);
    if (promesse) return promesse;
    if (global.TARIFS_SITE) {
      try { return Promise.resolve(depuisObjet(global.TARIFS_SITE)); }
      catch (e) { return Promise.reject(e); }
    }
    var cible = url || 'tarifs.json';
    var f = typeof global.fetch === 'function'
      ? global.fetch.bind(global)
      : (typeof fetch === 'function' ? fetch : null);
    if (!f) {
      return Promise.reject(new Error('Grille tarifaire inaccessible : fetch indisponible (' + cible + ').'));
    }
    promesse = f(cible, { cache: 'no-store' })
      .then(function (reponse) {
        if (!reponse || !reponse.ok) {
          throw new Error('Grille tarifaire inaccessible (' + cible + ').');
        }
        return reponse.json();
      })
      .then(depuisObjet)
      .catch(function (erreur) {
        promesse = null;
        throw erreur;
      });
    return promesse;
  }

  function viderCache() {
    cache = null;
    promesse = null;
  }

  var api = {
    charger: charger,
    actuels: actuels,
    depuisObjet: depuisObjet,
    valider: valider,
    viderCache: viderCache
  };

  global.Tarifs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
