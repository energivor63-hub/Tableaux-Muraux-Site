/**
 * ═══════════════════════════════════════════════════════════════
 *  🎯 MOTEUR D'INJECTION UNIVERSEL - Tableaux Muraux
 * ═══════════════════════════════════════════════════════════
 *  Permet de piloter dynamiquement toutes les zones de texte,
 *  images, attributs et balises SEO depuis contenu.js sans
 *  jamais modifier le code HTML des pages.
 * ═══════════════════════════════════════════════════════════
 */

(function () {
  'use strict';

  /**
   * Résolution sécurisée de la source de données de contenu
   */
  function getContenuData() {
    try {
      if (typeof CONTENU_SITE !== 'undefined' && CONTENU_SITE) return CONTENU_SITE;
      if (typeof siteContenu !== 'undefined' && siteContenu) return siteContenu;
      if (typeof contenu !== 'undefined' && contenu) return contenu;
      if (typeof CONTENU !== 'undefined' && CONTENU) return CONTENU;
      if (typeof siteConfig !== 'undefined' && siteConfig) return siteConfig;
    } catch (e) { /* ignore */ }

    if (typeof window !== 'undefined') {
      if (window.CONTENU_SITE) return window.CONTENU_SITE;
      if (window.siteContenu) return window.siteContenu;
      if (window.contenu) return window.contenu;
      if (window.CONTENU) return window.CONTENU;
      if (window.siteConfig) return window.siteConfig;
    }
    return null;
  }

  /**
   * Détecte le nom de la page courante
   */
  function detectCurrentPage() {
    if (document.body && document.body.getAttribute('data-page')) {
      return document.body.getAttribute('data-page').toLowerCase().trim();
    }
    const path = window.location.pathname.toLowerCase();
    if (path.includes('materials')) return 'materials';
    if (path.includes('process')) return 'process';
    if (path.includes('privacy')) return 'privacy';
    if (path.includes('social')) return 'social';
    if (path.includes('index') || path.endsWith('/') || path === '') return 'index';
    return 'index';
  }

  /**
   * Récupère une valeur imbriquée à partir d'un chemin à points (ex: "hero.title")
   */
  function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  /**
   * Résout une clé soit relativement à la page courante, soit globalement
   */
  function resolveValue(key, pageKey, data) {
    if (!data || !key) return undefined;

    // 1. Clé absolue explicite (ex: "pages.materials.hero.title" ou "marque.nom")
    let val = getNestedValue(data, key);
    if (val !== undefined) return val;

    // 2. Clé relative à la page courante (ex: "hero.title" -> data.pages[pageKey].hero.title)
    if (data.pages && data.pages[pageKey]) {
      val = getNestedValue(data.pages[pageKey], key);
      if (val !== undefined) return val;
    }

    // 3. Clé à la racine (ex: "marque.nom", "whatsapp.numero")
    val = getNestedValue(data, key);
    return val;
  }

  /**
   * Génère un lien WhatsApp préformaté avec tracking et message
   */
  function buildWhatsAppUrl(messageText, data) {
    const num = (data && data.whatsapp && data.whatsapp.numero) ? data.whatsapp.numero : '212648620364';
    const prefix = (data && data.whatsapp && data.whatsapp.indicateurSite) ? data.whatsapp.indicateurSite : '🌐 [SITE WEB]';
    const defaultMsg = (data && data.whatsapp && data.whatsapp.messageDefaut) ? data.whatsapp.messageDefaut : 'Bonjour Tableaux Muraux !';
    const msgBody = messageText || defaultMsg;
    const finalMsg = `${prefix} ${msgBody}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(finalMsg)}`;
  }

  /**
   * Injection principale dans le document
   */
  function injecterContenu() {
    const data = getContenuData();
    if (!data) {
      console.warn('[injection-contenu] Aucun objet de contenu détecté.');
      return;
    }

    const pageKey = detectCurrentPage();
    const pageData = (data.pages && data.pages[pageKey]) ? data.pages[pageKey] : null;

    // 1. Métadonnées SEO et Titre
    if (pageData && pageData.meta) {
      if (pageData.meta.title) {
        document.title = pageData.meta.title;
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', pageData.meta.title);
        const twitterTitle = document.querySelector('meta[name="twitter:title"]');
        if (twitterTitle) twitterTitle.setAttribute('content', pageData.meta.title);
      }
      if (pageData.meta.description) {
        const descTag = document.querySelector('meta[name="description"]');
        if (descTag) descTag.setAttribute('content', pageData.meta.description);
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', pageData.meta.description);
        const twitterDesc = document.querySelector('meta[name="twitter:description"]');
        if (twitterDesc) twitterDesc.setAttribute('content', pageData.meta.description);
      }
    }

    // 2. Injection de texte simple : [data-contenu="cle"]
    document.querySelectorAll('[data-contenu]').forEach(el => {
      const key = el.getAttribute('data-contenu');
      const val = resolveValue(key, pageKey, data);
      if (val !== undefined && val !== null && typeof val !== 'object') {
        el.textContent = val;
      }
    });

    // 3. Injection HTML riche : [data-contenu-html="cle"]
    document.querySelectorAll('[data-contenu-html]').forEach(el => {
      const key = el.getAttribute('data-contenu-html');
      const val = resolveValue(key, pageKey, data);
      if (val !== undefined && val !== null && typeof val !== 'object') {
        el.innerHTML = val;
      }
    });

    // 4. Injection d'images : [data-contenu-img="cle"]
    document.querySelectorAll('[data-contenu-img]').forEach(el => {
      const key = el.getAttribute('data-contenu-img');
      const val = resolveValue(key, pageKey, data);
      if (val && typeof val === 'string') {
        if (el.tagName === 'IMG') {
          el.src = val;
        } else {
          el.style.backgroundImage = `url('${val}')`;
        }
      }
    });

    // 5. Injection de texte alternatif : [data-contenu-alt="cle"]
    document.querySelectorAll('[data-contenu-alt]').forEach(el => {
      const key = el.getAttribute('data-contenu-alt');
      const val = resolveValue(key, pageKey, data);
      if (val && typeof val === 'string') {
        el.alt = val;
      }
    });

    // 6. Injection de liens : [data-contenu-href="cle"]
    document.querySelectorAll('[data-contenu-href]').forEach(el => {
      const key = el.getAttribute('data-contenu-href');
      const val = resolveValue(key, pageKey, data);
      if (val && typeof val === 'string') {
        el.href = val;
      }
    });

    // 7. Injection de liens WhatsApp intelligents : [data-contenu-wa="cle_message"]
    document.querySelectorAll('[data-contenu-wa]').forEach(el => {
      const key = el.getAttribute('data-contenu-wa');
      const msgVal = resolveValue(key, pageKey, data);
      const url = buildWhatsAppUrl(msgVal, data);
      el.href = url;
    });

    // 8. Injection de placeholders : [data-contenu-placeholder="cle"]
    document.querySelectorAll('[data-contenu-placeholder]').forEach(el => {
      const key = el.getAttribute('data-contenu-placeholder');
      const val = resolveValue(key, pageKey, data);
      if (val && typeof val === 'string') {
        el.placeholder = val;
      }
    });

    // 9. Injection de titres / bulles d'aide / aria : [data-contenu-title="cle"]
    document.querySelectorAll('[data-contenu-title]').forEach(el => {
      const key = el.getAttribute('data-contenu-title');
      const val = resolveValue(key, pageKey, data);
      if (val && typeof val === 'string') {
        el.title = val;
      }
    });

    console.log(`[injection-contenu] Contenu synchronisé avec succès pour la page "${pageKey}".`);
  }

  // Exposition globale pour appel manuel si besoin
  if (typeof window !== 'undefined') {
    window.appliquerInjectionContenu = injecterContenu;
  }

  // Exécution automatique dès le chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injecterContenu);
  } else {
    injecterContenu();
  }
})();
