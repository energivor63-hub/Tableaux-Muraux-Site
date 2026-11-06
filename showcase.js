/**
 * ═══════════════════════════════════════════════════════════════
 *  MODE VITRINE 9:16 — Tableaux Muraux
 *  Diaporama plein cadre, sans UI de navigation, pensé pour la
 *  capture vidéo (1080 × 1920) : préchargement intégral, fondu
 *  600 ms, transitions transform/opacity uniquement.
 * ═══════════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // ── Données ─────────────────────────────────────────────────
    const data = (typeof CONTENU_SITE !== 'undefined' && CONTENU_SITE)
        || window.CONTENU_SITE
        || { produits: [] };

    // ── Paramètres d'URL ────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const mode = (params.get('mode') || 'vitrine').toLowerCase();
    const isVitrine = mode !== 'preview' && mode !== 'edition';

    const clamp = (value, min, max, fallback) => {
        if (value === null || value === undefined || value === '') return fallback;
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    };

    const duration = clamp(params.get('duration'), 800, 20000, 2500);
    const ctaDuration = clamp(params.get('cta'), 800, 20000, 3000);
    const transition = clamp(params.get('transition'), 0, 2000, 600);
    const autoplay = !['0', 'false', 'non', 'no'].includes(String(params.get('autoplay') || '').toLowerCase());
    const preloadEnabled = !['0', 'false', 'non', 'no'].includes(String(params.get('preload') || '').toLowerCase());
    const fit = (params.get('fit') || 'contain').toLowerCase() === 'cover' ? 'cover' : 'contain';
    const loopParam = params.get('loop');
    const loop = loopParam === null
        ? false
        : !['0', 'false', 'non', 'no'].includes(loopParam.toLowerCase());
    const shuffle = ['1', 'true', 'oui', 'yes'].includes(String(params.get('shuffle') || '').toLowerCase());
    const includeCta = !['0', 'false', 'non', 'no'].includes(String(params.get('cta_slide') || '').toLowerCase());

    // ── Filtres ─────────────────────────────────────────────────
    const LISTES = {
        category: ['abstrait', 'paysage', 'calligraphie', 'moderne', 'geometrique', 'floral'],
        style: ['contemporain', 'traditionnel', 'minimaliste', 'boheme', 'art-deco'],
        env: ['salon', 'chambre', 'bureau', 'entree', 'riad', 'cabinet', 'ecole-primaire']
    };

    const normaliser = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    const CATEGORY_ALIASES = {
        paysage: 'paysages',
        paysages: 'paysages',
        calligraphie: 'calligraphie',
        calligraphies: 'calligraphie',
        floral: 'floral',
        abstrait: 'abstrait',
        geometrique: 'geometrique',
        moderne: 'moderne',
        autres: 'autres'
    };

    const CATEGORY_LABELS = {
        calligraphie: 'Calligraphie',
        paysages: 'Paysages',
        paysage: 'Paysages',
        floral: 'Floral',
        abstrait: 'Abstrait',
        geometrique: 'Géométrique',
        moderne: 'Moderne',
        autres: 'Autres'
    };

    const capitaliser = (value) => {
        const s = String(value || '').trim();
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    };

    const libelleCategorie = (produit) => {
        const key = normaliser(produit.categorie);
        return CATEGORY_LABELS[key] || capitaliser(produit.categorie);
    };

    function matchValeur(valeurProduit, valeurFiltre, groupe) {
        const pv = normaliser(valeurProduit);
        const fv = normaliser(valeurFiltre);
        if (!fv || fv === 'all' || fv === 'tous') return true;
        if (fv === 'autres') return !LISTES[groupe].includes(pv);
        if (groupe === 'category') {
            const alias = CATEGORY_ALIASES[fv] || fv;
            return pv === alias || pv === alias.replace(/s$/, '') || alias === pv.replace(/s$/, '');
        }
        return pv === fv;
    }

    const collectionRaw = params.get('collection') || params.get('categorie') || 'all';
    const collections = collectionRaw
        .split(',')
        .map(normaliser)
        .filter(Boolean);
    if (!collections.length) collections.push('all');

    const styleFilter = params.get('style') || 'all';
    const envFilter = params.get('env') || params.get('environnement') || 'all';

    function matchCollection(produit) {
        if (collections.includes('all') || collections.includes('tous')) return true;
        return collections.some((token) => {
            if (token === 'autres') return !LISTES.category.includes(normaliser(produit.categorie));
            return matchValeur(produit.categorie, token, 'category')
                || matchValeur(produit.style, token, 'style')
                || matchValeur(produit.environnement, token, 'env');
        });
    }

    const tousLesProduits = Array.isArray(data.produits) ? data.produits : [];
    const produitsVisibles = tousLesProduits.filter((p) => {
        if (!p || !p.image) return false;
        if (/\bproduit-0\.\w+$/.test(p.image)) return false;
        return true;
    });

    function filtrerProduits() {
        const filtres = produitsVisibles.filter((p) => (
            matchCollection(p)
            && matchValeur(p.style, styleFilter, 'style')
            && matchValeur(p.environnement, envFilter, 'env')
        ));
        // Filet de sécurité : une collection inconnue ne doit jamais produire
        // un écran vide pendant une capture.
        if (!filtres.length && produitsVisibles.length) {
            console.warn('[showcase] aucun produit pour ces filtres — repli sur toutes les œuvres');
            return produitsVisibles.slice();
        }
        return filtres;
    }

    let items = filtrerProduits();

    if (shuffle && items.length > 1) {
        items = items.slice();
        for (let i = items.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
    }

    // ── Construction des diapositives ───────────────────────────
    const slides = items.map((produit) => ({ type: 'art', produit }));
    if (includeCta) slides.push({ type: 'cta' });

    const startParam = clamp(params.get('start'), 1, Math.max(1, items.length), 1);
    let indexInitial = Math.min(slides.length - 1, Math.max(0, startParam - 1));

    // ── DOM ─────────────────────────────────────────────────────
    const frame = document.getElementById('frame');
    const layerA = document.getElementById('layer-a');
    const layerB = document.getElementById('layer-b');
    const statusEl = document.getElementById('a11y-status');
    const layers = [layerA, layerB];

    document.body.classList.toggle('is-vitrine', isVitrine);
    frame.classList.toggle('fit-cover', fit === 'cover');
    frame.style.setProperty('--transition', transition + 'ms');

    function syncUnit() {
        const width = frame.getBoundingClientRect().width;
        if (width > 0) {
            frame.style.setProperty('--u', (width / 100).toFixed(4) + 'px');
        }
    }

    syncUnit();
    if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(syncUnit).observe(frame);
    } else {
        window.addEventListener('resize', syncUnit);
    }

    const escapeHtml = (value) => String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const cssUrl = (value) => String(value || '')
        .replace(/\\/g, '/')
        .replace(/'/g, '%27')
        .replace(/"/g, '%22')
        .replace(/\)/g, '%29');

    const whatsappIcon = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${escapeHtml(data.whatsappLogoSVG || '')}"/></svg>`;

    function renderArt(produit) {
        const image = cssUrl(produit.image);
        const categorie = libelleCategorie(produit);
        const style = capitaliser(produit.style);
        const kicker = style && normaliser(style) !== normaliser(categorie)
            ? `${categorie} · ${style}`
            : categorie;
        const ambiance = produit.ambiance ? `<span class="price-note">${escapeHtml(produit.ambiance)}</span>` : '';

        return `
            <div class="slide">
                <div class="slide-bg" style="background-image:url('${image}')"></div>
                <div class="slide-art">
                    <img src="${escapeHtml(produit.image)}" alt="${escapeHtml(produit.nom)}" loading="eager" decoding="sync" draggable="false">
                </div>
                <div class="scrim"></div>
                <div class="chip">${escapeHtml(categorie)}</div>
                <div class="slide-bottom">
                    <div class="kicker">${escapeHtml(kicker)}</div>
                    <h1 class="title">${escapeHtml(produit.nom)}</h1>
                    <div class="price-row">
                        <span class="price">À partir de 70 MAD</span>
                        ${ambiance}
                    </div>
                </div>
            </div>
        `;
    }

    function renderCta() {
        const fond = items[0] ? cssUrl(items[0].image) : '';
        return `
            <div class="slide slide-cta">
                <div class="cta-bg" style="background-image:url('${fond}')"></div>
                <div class="cta-veil"></div>
                <div class="cta-inner">
                    <div class="cta-brand">Tableaux Muraux</div>
                    <div class="cta-rule"></div>
                    <h2 class="cta-title">Commandes WhatsApp — lien en bio</h2>
                    <p class="cta-sub">Réponse rapide · Livraison Marrakech &amp; Maroc</p>
                    <div class="cta-icon">${whatsappIcon}</div>
                    <p class="cta-foot">Marrakech · Atelier</p>
                </div>
            </div>
        `;
    }

    function render(item) {
        return item.type === 'cta' ? renderCta() : renderArt(item.produit);
    }

    // ── État du diaporama ───────────────────────────────────────
    const state = {
        index: indexInitial,
        playing: false,
        ready: false,
        ended: false,
        loop,
        timer: null,
        deadline: 0,
        remaining: 0,
        activeLayer: null
    };

    function dureePour(i) {
        return slides[i] && slides[i].type === 'cta' ? ctaDuration : duration;
    }

    function peindreInitial() {
        if (!slides.length) return;
        indexInitial = Math.min(indexInitial, slides.length - 1);
        layerA.innerHTML = render(slides[indexInitial]);
        layerA.classList.add('is-active');
        layerB.classList.remove('is-active');
        state.activeLayer = layerA;
        state.index = indexInitial;
    }

    function mettreAJourStatut() {
        document.body.dataset.state = state.playing ? 'playing' : 'paused';
        document.body.dataset.slide = String(state.index);
        if (statusEl) {
            const item = slides[state.index];
            if (!item) {
                statusEl.textContent = '';
            } else if (item.type === 'cta') {
                statusEl.textContent = 'Commandes WhatsApp — lien en bio';
            } else {
                statusEl.textContent = `Œuvre ${state.index + 1} sur ${items.length} : ${item.produit.nom}`;
            }
        }
    }

    function planifier(ms) {
        clearTimeout(state.timer);
        state.deadline = Date.now() + Math.max(0, ms);
        state.timer = setTimeout(avancer, Math.max(0, ms));
    }

    function allerA(index, anime) {
        if (!slides.length) return;
        const total = slides.length;
        const cible = ((index % total) + total) % total;
        const item = slides[cible];
        const depuis = state.activeLayer;
        const vers = depuis === layerA ? layerB : layerA;

        vers.innerHTML = render(item);
        vers.classList.remove('is-active');

        // Force le navigateur à peindre l'état initial avant le fondu.
        void vers.offsetWidth;

        vers.classList.add('is-active');
        if (depuis && depuis !== vers) depuis.classList.remove('is-active');

        state.activeLayer = vers;
        state.index = cible;
        state.remaining = 0;
        state.ended = false;

        if (state.playing) planifier(dureePour(cible));
        mettreAJourStatut();
    }

    function avancer() {
        if (!state.playing) return;
        const suivant = state.index + 1;
        if (suivant < slides.length) {
            allerA(suivant, true);
        } else if (state.loop) {
            allerA(0, true);
        } else {
            state.playing = false;
            state.ended = true;
            state.remaining = 0;
            clearTimeout(state.timer);
            state.timer = null;
            mettreAJourStatut();
        }
    }

    function jouer() {
        if (!state.ready || state.playing || !slides.length) return;
        if (state.ended) {
            state.ended = false;
            allerA(0, true);
        }
        state.playing = true;
        planifier(state.remaining > 0 ? state.remaining : dureePour(state.index));
        state.remaining = 0;
        mettreAJourStatut();
    }

    function pause() {
        if (!state.playing) return;
        state.playing = false;
        state.remaining = Math.max(0, state.deadline - Date.now());
        clearTimeout(state.timer);
        state.timer = null;
        mettreAJourStatut();
    }

    function basculer() {
        if (state.playing) pause();
        else jouer();
    }

    function suivant() {
        allerA(state.index + 1, true);
    }

    function precedent() {
        allerA(state.index - 1, true);
    }

    // ── Préchargement (zéro flicker) ────────────────────────────
    function precharger(urls) {
        const uniques = Array.from(new Set(urls.filter(Boolean)));
        return Promise.all(uniques.map((url) => new Promise((resolve) => {
            const img = new Image();
            let fini = false;
            let minuterie = null;

            const terminer = () => {
                if (fini) return;
                fini = true;
                if (minuterie) clearTimeout(minuterie);
                resolve();
            };

            img.onload = () => {
                if (typeof img.decode === 'function') {
                    img.decode().then(terminer, terminer);
                } else {
                    terminer();
                }
            };
            img.onerror = terminer;
            img.decoding = 'async';
            img.src = url;

            if (img.complete) {
                if (img.naturalWidth > 0 && typeof img.decode === 'function') {
                    img.decode().then(terminer, terminer);
                } else {
                    terminer();
                }
            }

            minuterie = setTimeout(terminer, 8000);
        })));
    }

    // ── Démarrage ───────────────────────────────────────────────
    async function demarrer() {
        syncUnit();
        peindreInitial();

        if (preloadEnabled) {
            await precharger(items.map((p) => p.image));
        }

        document.body.classList.add('is-ready');
        const loader = document.getElementById('loader');
        if (loader) {
            loader.hidden = true;
            loader.setAttribute('aria-hidden', 'true');
        }
        state.ready = true;
        mettreAJourStatut();

        if (autoplay) jouer();
    }

    // ── Clavier ─────────────────────────────────────────────────
    function pleinEcran() {
        const racine = document.documentElement;
        if (!document.fullscreenElement) {
            const demande = racine.requestFullscreen
                ? racine.requestFullscreen({ navigationUI: 'hide' })
                : racine.webkitRequestFullscreen && racine.webkitRequestFullscreen();
            if (demande && typeof demande.catch === 'function') demande.catch(() => {});
        } else {
            const sortie = document.exitFullscreen
                ? document.exitFullscreen()
                : document.webkitExitFullscreen && document.webkitExitFullscreen();
            if (sortie && typeof sortie.catch === 'function') sortie.catch(() => {});
        }
    }

    window.addEventListener('keydown', (event) => {
        const key = String(event.key || '').toLowerCase();

        if (key === 's' || key === ' ') {
            event.preventDefault();
            basculer();
            return;
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            suivant();
            return;
        }
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            precedent();
            return;
        }
        if (key === 'f') {
            event.preventDefault();
            pleinEcran();
            return;
        }
        if (key === 'l') {
            event.preventDefault();
            state.loop = !state.loop;
            return;
        }
        if (event.key === 'Escape') {
            if (document.fullscreenElement) {
                pleinEcran();
            } else {
                window.location.href = 'index.html#gallery';
            }
        }
    });

    // Empêche le glisser-déposer des images pendant la capture.
    document.addEventListener('dragstart', (event) => event.preventDefault());

    // ── API de diagnostic / tests ───────────────────────────────
    window.__SHOWCASE__ = {
        state,
        slides,
        items,
        params,
        filtre: filtrerProduits,
        matchValeur,
        normaliser,
        jouer,
        pause,
        basculer,
        suivant,
        precedent,
        allerA,
        dureePour
    };

    demarrer().catch((error) => {
        console.error('[showcase] démarrage impossible', error);
        document.body.classList.add('is-ready');
        state.ready = true;
        if (autoplay) jouer();
    });
})();
