/**
 * ═══════════════════════════════════════════════════════════════
 *  PRIX — SOURCE UNIQUE D'AFFICHAGE
 *  Le prix affiché vient UNIQUEMENT du champ `prix` de contenu.js.
 *  Aucun prix plancher n'est codé en dur ici ni ailleurs.
 *
 *  Règle de repli : champ absent, vide ou contenant « xxxx »
 *  → « Prix sur demande » (jamais un montant par défaut).
 *
 *  Script classique (UMD) : exposé en global `Prix` dans le navigateur
 *  et via `module.exports` hors navigateur. Les tests le chargent par
 *  eval / VM (site-web/package.json déclare "type": "module").
 * ═══════════════════════════════════════════════════════════════
 */
(function (global) {
    'use strict';

    var PRIX_SUR_DEMANDE = 'Prix sur demande';

    /** Prix brut nettoyé (chaîne vide si absent ou non textuel). */
    function prixBrut(produit) {
        if (!produit || typeof produit.prix !== 'string') return '';
        return produit.prix.trim();
    }

    /** true si le prix doit être masqué (absent, vide ou « xxxx »). */
    function prixEstMasque(produit) {
        var brut = prixBrut(produit);
        if (!brut) return true;
        return /xxxx/i.test(brut);
    }

    /** Prix à afficher, tel quel depuis contenu.js, sinon « Prix sur demande ». */
    function prixAffiche(produit) {
        if (prixEstMasque(produit)) return PRIX_SUR_DEMANDE;
        return prixBrut(produit);
    }

    var api = {
        PRIX_SUR_DEMANDE: PRIX_SUR_DEMANDE,
        prixBrut: prixBrut,
        prixEstMasque: prixEstMasque,
        prixAffiche: prixAffiche
    };

    global.Prix = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
