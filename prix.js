/**
 * ═══════════════════════════════════════════════════════════════
 *  PRIX — SOURCE UNIQUE D'AFFICHAGE
 *
 *  1) Prix éditorial (`prixAffiche`) : champ `prix` de contenu.js, qui reste
 *     le PLANCHER RÉEL de la combinaison (70/140/210/420 à 40×50). Aucun
 *     montant n'est codé en dur.
 *  2) Offre publique (`prixCarte`) : référence calculée depuis la grille v8
 *     (80×120 bâche tendue châssis pin = 335 MAD ; triptyque 3 panneaux =
 *     1005 MAD). `metaIncertaine` ⇒ « Sur demande ».
 *
 *  Miroir Node : registre/formules_tarifs.mjs — test de PARITÉ obligatoire.
 *  Script classique (UMD) : global `Prix` + module.exports hors navigateur.
 * ═══════════════════════════════════════════════════════════════
 */
(function (global) {
    'use strict';

    var PRIX_SUR_DEMANDE = 'Prix sur demande';
    var MENTION_SUR_DEMANDE = 'Sur demande';
    var ARRONDI = 5;
    var MULTIPLICATEUR_TRIPTYQUE = 3;
    var FORMAT_REFERENCE_DEFAUT = '80x120';

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

    /** Prix éditorial, tel quel depuis contenu.js, sinon « Prix sur demande ». */
    function prixAffiche(produit) {
        if (prixEstMasque(produit)) return PRIX_SUR_DEMANDE;
        return prixBrut(produit);
    }

    // ── OFFRE v8 : prix calculés depuis la grille tarifs.json ───────────
    function arrondi5(valeur) {
        return Math.round(Number(valeur) / ARRONDI) * ARRONDI;
    }

    function formatDe(tarifs, id) {
        if (!tarifs || !Array.isArray(tarifs.formats)) return null;
        var cible = String(id || tarifs.reference_format || FORMAT_REFERENCE_DEFAUT);
        return tarifs.formats.find(function (f) {
            return String(f.id) === cible || String(f.label) === cible;
        }) || null;
    }

    function supportDe(tarifs, id) {
        if (!tarifs || !Array.isArray(tarifs.supports)) return null;
        var cible = String(id || 'bache').toLowerCase();
        return tarifs.supports.find(function (s) {
            return String(s.id).toLowerCase() === cible;
        }) || null;
    }

    function finitionDe(tarifs, id) {
        if (!tarifs || !Array.isArray(tarifs.finitions)) return null;
        var cible = String(id || 'tendu').toLowerCase();
        return tarifs.finitions.find(function (f) {
            return String(f.id).toLowerCase() === cible;
        }) || null;
    }

    function tauxMatiere(tarifs, support) {
        var taux = tarifs && tarifs.taux_matieres_premieres ? tarifs.taux_matieres_premieres : {};
        var cle = support && support.taux;
        if (cle && typeof taux[cle] === 'number') return taux[cle];
        if (support && support.id === 'canvas') return Number(taux.canvas_m2) || 0;
        return Number(taux.bache_m2) || 0;
    }

    function tauxCadre(tarifs, finition) {
        var taux = tarifs && tarifs.taux_matieres_premieres ? tarifs.taux_matieres_premieres : {};
        var cle = finition && finition.taux_cadre;
        if (!cle) return 0;
        return Number(taux[cle]) || 0;
    }

    /**
     * Prix d'une combinaison réelle (arrondi5 en fin de formule, triptyque ×3).
     * @param {object} tarifs grille tarifs.json
     * @param {{formatId?:string,support?:string,finition?:string,triptyque?:boolean}} options
     */
    function calculerPrix(tarifs, options) {
        var opts = options || {};
        if (!tarifs || !Array.isArray(tarifs.formats)) {
            throw new Error('Grille tarifaire indisponible.');
        }
        var format = formatDe(tarifs, opts.formatId);
        if (!format) throw new Error('Format tarifaire inconnu.');
        if (!isFinite(Number(format.l_m)) || !isFinite(Number(format.h_m))) {
            throw new Error('Format tarifaire invalide.');
        }
        var support = supportDe(tarifs, opts.support || 'bache');
        if (!support) throw new Error('Support tarifaire inconnu.');
        var finition = finitionDe(tarifs, opts.finition || 'tendu');
        if (!finition) throw new Error('Finition tarifaire inconnue.');
        var surface = Number(format.l_m) * Number(format.h_m);
        var perimetre = 2 * (Number(format.l_m) + Number(format.h_m));
        var panneau = arrondi5(surface * tauxMatiere(tarifs, support) + perimetre * tauxCadre(tarifs, finition));
        var montant = opts.triptyque ? panneau * MULTIPLICATEUR_TRIPTYQUE : panneau;
        return {
            montant: montant,
            panneau: panneau,
            triptyque: Boolean(opts.triptyque),
            format: format,
            support: support,
            finition: finition,
            surface: surface
        };
    }

    /** Prix de référence : 80×120 bâche tendue châssis pin (335 / 1005 MAD). */
    function prixReference(tarifs, triptyque) {
        return calculerPrix(tarifs, {
            formatId: (tarifs && tarifs.reference_format) || FORMAT_REFERENCE_DEFAUT,
            support: 'bache',
            finition: 'tendu',
            triptyque: Boolean(triptyque)
        }).montant;
    }

    /** Libellé exact : « 335 MAD » (jamais « à partir de »). */
    function libelleReference(tarifs, triptyque) {
        return prixReference(tarifs, triptyque) + ' MAD';
    }

    /** Mention exacte affichée sous la galerie. */
    function mentionReference(tarifs) {
        var format = formatDe(tarifs, (tarifs && tarifs.reference_format) || FORMAT_REFERENCE_DEFAUT);
        return libelleReference(tarifs, false)
            + ' — format ' + (format ? format.label : '80 × 120 cm')
            + ', bâche tendue sur châssis pin · autres formats et finitions disponibles';
    }

    /** Libellé exact de l'option triptyque. */
    function libelleTriptyque(tarifs) {
        var format = formatDe(tarifs, (tarifs && tarifs.reference_format) || FORMAT_REFERENCE_DEFAUT);
        if (!format) throw new Error('Format de référence introuvable.');
        return 'Triptyque — 3 panneaux de ' + format.label + ' chacun';
    }

    /** Panneaux explicites : nombre > 0, sinon null. */
    function panneauxDe(produit) {
        if (!produit) return null;
        var n = Number(produit.panneaux);
        return isFinite(n) && n > 0 ? n : null;
    }

    /** true si la fiche est un triptyque (le champ `panneaux` fait foi). */
    function estTriptyqueProduit(produit) {
        var panneaux = panneauxDe(produit);
        if (panneaux != null) return panneaux === 3;
        if (typeof produit.triptyque === 'string') {
            return /^(true|oui|1)$/i.test(produit.triptyque.trim());
        }
        return Boolean(produit && produit.triptyque === true);
    }

    /** Option « Triptyque » visible UNIQUEMENT si panneaux === 3. */
    function optionTriptyqueDisponible(produit) {
        return panneauxDe(produit) === 3;
    }

    /** metaIncertaine → exclue de l'envoi automatique et affichée « Sur demande ». */
    function estIncertaine(produit) {
        if (!produit) return false;
        var v = produit.metaIncertaine;
        return v === true || (typeof v === 'string' && /^(true|oui|1)$/i.test(v.trim()));
    }

    /** Prix de carte public : « 335 MAD » / « 1005 MAD » / « Sur demande ». */
    function prixCarte(produit, tarifs) {
        if (!tarifs) return null;
        if (estIncertaine(produit)) return MENTION_SUR_DEMANDE;
        return libelleReference(tarifs, estTriptyqueProduit(produit));
    }

    /** Message WhatsApp pré-rempli — NON encodé (le caller encode UNE fois). */
    function messageOffre(produit, tarifs, options) {
        var opts = options || {};
        var triptyque = opts.triptyque != null ? Boolean(opts.triptyque) : estTriptyqueProduit(produit);
        var calcul = calculerPrix(tarifs, {
            formatId: opts.formatId || (tarifs && tarifs.reference_format) || FORMAT_REFERENCE_DEFAUT,
            support: opts.support || 'bache',
            finition: opts.finition || 'tendu',
            triptyque: triptyque
        });
        var nom = produit && produit.nom ? produit.nom : 'cette œuvre';
        var designation = triptyque
            ? libelleTriptyque(tarifs)
            : calcul.format.label;
        return 'Je suis intéressé(e) par « ' + nom + ' » — '
            + designation + ', ' + calcul.support.label + ', '
            + calcul.finition.label + ' : ' + calcul.montant + ' MAD.';
    }

    var api = {
        PRIX_SUR_DEMANDE: PRIX_SUR_DEMANDE,
        MENTION_SUR_DEMANDE: MENTION_SUR_DEMANDE,
        prixBrut: prixBrut,
        prixEstMasque: prixEstMasque,
        prixAffiche: prixAffiche,
        arrondi5: arrondi5,
        formatDe: formatDe,
        supportDe: supportDe,
        finitionDe: finitionDe,
        calculerPrix: calculerPrix,
        prixReference: prixReference,
        libelleReference: libelleReference,
        mentionReference: mentionReference,
        libelleTriptyque: libelleTriptyque,
        panneauxDe: panneauxDe,
        estTriptyqueProduit: estTriptyqueProduit,
        optionTriptyqueDisponible: optionTriptyqueDisponible,
        estIncertaine: estIncertaine,
        prixCarte: prixCarte,
        messageOffre: messageOffre
    };

    global.Prix = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
