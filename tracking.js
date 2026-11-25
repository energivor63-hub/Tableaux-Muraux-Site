/* ═══════════════════════════════════════════════════════════════════════
 * tracking.js — MESURE GA4 + META PIXEL (LOT P1-TRACKING-01)
 *
 * Rôle UNIQUE : lire les UTM de l'URL et émettre les événements de mesure
 * vers les balises DÉJÀ chargées dans la page :
 *   GA4  — G-BP8100DQ8B      : gtag('event', nom, params)
 *   Meta — 4010403609112081  : fbq('trackCustom', nom, params)
 *
 * Événements (noms exacts, identiques sur les deux plateformes) :
 *   view_item      { slug, nom }                        œuvre ouverte
 *   select_item    { slug, format, support, finition }  variante choisie
 *   whatsapp_click { slug, montant }                    CTA WhatsApp
 *
 * UTM lus depuis l'URL (utm_source, utm_medium, utm_campaign, utm_content)
 * et joints à chaque événement quand ils sont présents.
 *
 * Chargement DIRECT, sans CMP (décision opérateur) : aucune bannière, aucun
 * blocage, aucune condition de consentement. Ce fichier n'ouvre AUCUNE
 * connexion de lui-même : il ne fait qu'appeler gtag/fbq s'ils existent.
 * Sans balise (test jsdom, navigateur qui bloque), les appels sont muets et
 * ne lèvent jamais d'exception.
 * ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
    'use strict';

    var GA4_ID = 'G-BP8100DQ8B';
    var PIXEL_ID = '4010403609112081';
    var CLES_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
    var MAX_JOURNAL = 100;

    /** UTM réellement présents dans la requête (clé absente si valeur vide). */
    function lireUtm(recherche) {
        var utm = {};
        if (!recherche) return utm;
        var params;
        try {
            params = new global.URLSearchParams(recherche);
        } catch (err) {
            return utm;
        }
        CLES_UTM.forEach(function (cle) {
            var valeur = params.get(cle);
            if (valeur) utm[cle] = String(valeur).trim();
        });
        return utm;
    }

    /** Montant numérique en MAD, ou null (jamais NaN dans la charge utile). */
    function montantOuNull(valeur) {
        if (valeur === null || valeur === undefined || valeur === '') return null;
        var n = Number(valeur);
        return isFinite(n) ? n : null;
    }

    var utm = lireUtm(global.location && global.location.search);
    var journal = [];
    var dejaVus = Object.create(null);

    /** Émet un événement sur les deux plateformes ; rend la charge utile. */
    function envoyer(nom, params) {
        var charge = {};
        Object.keys(params || {}).forEach(function (cle) {
            var valeur = params[cle];
            if (valeur === null || valeur === undefined || valeur === '') return;
            charge[cle] = valeur;
        });
        Object.keys(utm).forEach(function (cle) { charge[cle] = utm[cle]; });

        journal.push({ nom: nom, params: charge });
        if (journal.length > MAX_JOURNAL) journal.shift();

        // Mesure muette : une balise absente ou cassée ne touche pas le visiteur.
        try {
            if (typeof global.gtag === 'function') global.gtag('event', nom, charge);
        } catch (err) { /* ignoré */ }
        try {
            if (typeof global.fbq === 'function') global.fbq('trackCustom', nom, charge);
        } catch (err) { /* ignoré */ }
        return charge;
    }

    global.Suivi = {
        ga4: GA4_ID,
        pixel: PIXEL_ID,

        /** UTM lus au chargement de la page (copie). */
        utm: function () { return Object.assign({}, utm); },

        /** Journal local des événements (diagnostic / tests). */
        journal: function () { return journal.slice(); },

        envoyer: envoyer,

        /** Œuvre consultée (lightbox ou ancre #oeuvre-<slug>) — une fois par slug. */
        viewItem: function (options) {
            var o = options || {};
            var slug = o.slug ? String(o.slug) : '';
            if (!slug || dejaVus[slug]) return null;
            dejaVus[slug] = true;
            return envoyer('view_item', { slug: slug, nom: o.nom || '' });
        },

        /** Variante choisie sur une œuvre (format / support / finition). */
        selectItem: function (options) {
            var o = options || {};
            return envoyer('select_item', {
                slug: o.slug || '',
                format: o.format || '',
                support: o.support || '',
                finition: o.finition || ''
            });
        },

        /** Clic WhatsApp : slug de l'œuvre (ou de la page) + montant en MAD. */
        whatsappClick: function (options) {
            var o = options || {};
            return envoyer('whatsapp_click', {
                slug: o.slug || '',
                montant: montantOuNull(o.montant),
                format: o.format || '',
                support: o.support || '',
                finition: o.finition || '',
                offre: o.offre || ''
            });
        }
    };
})(window);
