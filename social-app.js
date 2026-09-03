/**
 * ==========================================================================
 * TABLEAUX MURAUX — SOCIAL STUDIO APP CONTROLLER
 * Gestion des onglets, CRUD Publications, Calendrier, Médiathèque, Mockups
 * Persistance via localStorage & compatibilité stricte CONTENU_SITE.produits
 * ==========================================================================
 */

(function () {
  'use strict';

  // Clé de persistance locale
  const STORAGE_KEY = 'tableaux_muraux_social_state_v2';

  /**
   * Normalise tout chemin (C:\..., file:///..., https://...) en "images/..."
   * Corrige le bug d'affichage des chemins absolus en texte dans la galerie
   */
  function normalizeSrc(src) {
    if (!src) return 'images/hero-marrakech.jpg';
    const s = String(src);
    const i = s.indexOf('images/');
    return i >= 0 ? s.slice(i) : s;
  }

  // État local réactif initialisé à partir de socialData ou du localStorage
  let state = {
    comptes: [],
    statistiquesGlobales: {},
    publications: [],
    mediatheque: [],
    currentCalDate: new Date(2026, 7, 1) // Août 2026 par défaut
  };

  /**
   * Initialisation de l'application
   */
  function init() {
    console.log('[Social Studio] Démarrage de l\'initialisation...');
    try {
      buildFreshMediaLibrary();
      loadState();
      setupTabNavigation();
      setupComposer();
      setupCalendar();
      setupMediaFilters();
      setupPostsFilter();
      setupSyncSimulation();
      renderAll();
      console.log('[Social Studio] Initialisation terminée avec succès.');
    } catch (e) {
      console.error('[Social Studio] Erreur lors de l\'initialisation :', e);
    }
  }

  /**
   * Charge les données depuis le localStorage ou bascule sur social-data.js
   */
  function loadState() {
    // Restauration SÉLECTIVE : uniquement comptes / stats / publications (pas la médiathèque).
    // La médiathèque est toujours reconstruite à neuf par buildFreshMediaLibrary().
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const s = JSON.parse(saved);
          if (Array.isArray(s.comptes)) state.comptes = s.comptes;
          if (s.statistiquesGlobales && typeof s.statistiquesGlobales === 'object') {
            state.statistiquesGlobales = s.statistiquesGlobales;
          }
          if (Array.isArray(s.publications)) {
            state.publications = s.publications.map(p => {
              p.image = normalizeSrc(p.image);
              return p;
            });
          }
          console.log('[Social Studio] État restauré depuis localStorage (médiathèque reconstruite à neuf).');
          return;
        } catch (e) {
          console.warn('localStorage illisible, utilisation des données par défaut.', e);
        }
      }
    } catch (e) {
      console.warn('Accès au localStorage impossible (mode privé ?), données par défaut.', e);
    }

    if (typeof socialData !== 'undefined') {
      state.comptes = JSON.parse(JSON.stringify(socialData.comptes || []));
      state.statistiquesGlobales = JSON.parse(JSON.stringify(socialData.statistiquesGlobales || {}));
      state.publications = (JSON.parse(JSON.stringify(socialData.publications || []))).map(p => {
        p.image = normalizeSrc(p.image);
        return p;
      });
      console.log('[Social Studio] État initialisé depuis social-data.js.');
    }
  }

  /**
   * Sauvegarde l'état actuel dans le localStorage
   */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        comptes: state.comptes,
        statistiquesGlobales: state.statistiquesGlobales,
        publications: state.publications
      }));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde dans le localStorage', e);
    }
  }

  /**
   * Détection UNIVERSELLE des produits (quel que soit le mode de déclaration de contenu.js)
   * Teste d'abord l'accès direct aux variables de portée lexicale (const/let),
   * puis window, puis balaie les propriétés globales.
   */
  function resolveProduits() {
    try {
      if (typeof CONTENU_SITE !== 'undefined' && CONTENU_SITE && Array.isArray(CONTENU_SITE.produits)) {
        return CONTENU_SITE.produits;
      }
      if (typeof siteContenu !== 'undefined' && siteContenu && Array.isArray(siteContenu.produits)) {
        return siteContenu.produits;
      }
      if (typeof contenu !== 'undefined' && contenu && Array.isArray(contenu.produits)) {
        return contenu.produits;
      }
      if (typeof CONTENU !== 'undefined' && CONTENU && Array.isArray(CONTENU.produits)) {
        return CONTENU.produits;
      }
      if (typeof siteConfig !== 'undefined' && siteConfig && Array.isArray(siteConfig.produits)) {
        return siteConfig.produits;
      }
    } catch (e) {
      /* ignore */
    }

    if (typeof window !== 'undefined') {
      const candidats = [window.CONTENU_SITE, window.siteContenu, window.contenu, window.CONTENU, window.siteConfig];
      for (const c of candidats) {
        if (c && typeof c === 'object' && Array.isArray(c.produits)) return c.produits;
      }
      for (const key of Object.keys(window)) {
        try {
          const v = window[key];
          if (v && typeof v === 'object' && Array.isArray(v.produits)) return v.produits;
        } catch (e) { /* ignore access errors */ }
      }
    }

    console.warn('[Social Studio] Aucun tableau produits détecté dans les variables globales.');
    return [];
  }

  /**
   * Médiathèque reconstruite À NEUF à chaque chargement (JAMAIS restaurée depuis localStorage).
   * Source unique de vérité : contenu.js (produits du catalogue) + social-data.js (base médias atelier/ambiance).
   * Les produits du catalogue (produit-1.jpg ... produit-N.jpg) sont insérés dans l'ordre naturel.
   * Élimine définitivement les chemins C:\... pollués.
   */
  function buildFreshMediaLibrary() {
    const rawBase = (typeof socialData !== 'undefined' && Array.isArray(socialData.mediatheque))
      ? socialData.mediatheque
      : (typeof window !== 'undefined' && window.socialData && Array.isArray(window.socialData.mediatheque) ? window.socialData.mediatheque : []);

    const baseMedias = rawBase.map((m, idx) => ({
      id: m.id || ('base-media-' + idx),
      src: normalizeSrc(m.src),
      titre: m.titre || ('Visuel ' + (idx + 1)),
      tag: m.tag || 'Atelier'
    }));

    const produits = resolveProduits();
    const productMedias = [];

    produits.forEach((prod, index) => {
      const rawSrc = prod.image || (prod.id !== undefined ? `images/produit-${prod.id}.jpg` : `images/produit-${index + 1}.jpg`);
      const src = normalizeSrc(rawSrc);
      if (!src || src.includes('produit-0')) return;

      const prodId = prod.id !== undefined ? prod.id : (index + 1);
      productMedias.push({
        id: 'prod-media-' + prodId,
        src: src,
        titre: prod.nom ? `${prod.nom} (Tableau ${prodId})` : `Tableau ${prodId}`,
        tag: 'Catalogue'
      });
    });

    // Assemblage final : Produits d'abord (produit-1 en tête), puis visuels d'atelier/ambiance sans doublons
    state.mediatheque = [...productMedias];
    baseMedias.forEach(baseItem => {
      if (!state.mediatheque.some(existing => existing.src === baseItem.src)) {
        state.mediatheque.push(baseItem);
      }
    });

    console.log('[Social Studio] Médiathèque reconstruite : ' + state.mediatheque.length +
      ' visuels (' + state.mediatheque.filter(m => m.tag === 'Catalogue').length + ' produits).');
  }

  /**
   * Rendu global de l'interface
   */
  function renderAll() {
    renderKPIs();
    renderUpcomingPosts();
    renderAccounts();
    renderCalendar();
    renderMediaGrid('all');
    renderPostsTable('all');
    renderAnalytics();
    populateImageSelect();
    renderComposerGallery();
    updateLivePreview();
  }

  /**
   * Système de navigation par onglets & gestion de l'accessibilité ARIA
   */
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.social-tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');

        tabButtons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        tabPanels.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        const targetPanel = document.getElementById(targetId);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }
      });
    });

    const quickCreateBtn = document.getElementById('btn-quick-create');
    if (quickCreateBtn) {
      quickCreateBtn.addEventListener('click', () => {
        const composerTab = document.querySelector('[data-tab="tab-composer"]');
        if (composerTab) composerTab.click();
      });
    }
  }

  /**
   * Rendu des 4 KPIs du Dashboard
   */
  function renderKPIs() {
    const container = document.getElementById('kpi-container');
    if (!container) return;

    const stats = state.statistiquesGlobales;
    container.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-label">Portée Totale</div>
        <div class="kpi-value">${(stats.porteeTotale || 148200).toLocaleString('fr-FR')}</div>
        <div class="kpi-delta">▲ +12.4% ce mois</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Engagements</div>
        <div class="kpi-value">${(stats.engagements || 18950).toLocaleString('fr-FR')}</div>
        <div class="kpi-delta">▲ Taux moyen ${stats.tauxEngagementMoyen || '5.8%'}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Clics vers la boutique</div>
        <div class="kpi-value">${(stats.clicsLien || 1420).toLocaleString('fr-FR')}</div>
        <div class="kpi-delta">▲ +8.1% vs mois préc.</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Abonnés Cumulés</div>
        <div class="kpi-value">${calculateTotalFollowers().toLocaleString('fr-FR')}</div>
        <div class="kpi-delta">▲ +${stats.nouveauxAbonnes || 980} nouveaux</div>
      </div>
    `;
  }

  function calculateTotalFollowers() {
    return state.comptes.reduce((acc, c) => acc + (c.abonnes || 0), 0);
  }

  /**
   * Rendu des prochaines parutions sur le Dashboard
   */
  function renderUpcomingPosts() {
    const list = document.getElementById('dashboard-upcoming-list');
    if (!list) return;

    const upcoming = state.publications
      .filter(p => p.statut === 'programme')
      .sort((a, b) => new Date(a.datePublication) - new Date(b.datePublication));

    if (upcoming.length === 0) {
      list.innerHTML = `<p style="color: var(--gray); font-size: 0.9rem;">Aucune publication programmée pour le moment.</p>`;
      return;
    }

    list.innerHTML = upcoming.slice(0, 3).map(p => {
      const dateStr = p.datePublication ? new Date(p.datePublication).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      }) : 'Date non définie';

      return `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem 0; border-bottom:1px solid var(--gray-light);">
          <div style="display:flex; align-items:center; gap:0.9rem;">
            <img src="${p.image}" alt="" style="width:44px; height:44px; border-radius:6px; object-fit:cover;">
            <div>
              <strong style="font-size:0.92rem; color:var(--dark);">${escapeHTML(p.titre)}</strong>
              <div style="font-size:0.78rem; color:var(--gray);">Prévu le ${dateStr}</div>
            </div>
          </div>
          <span class="status-pill pill-programme">Programmé</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Rendu de la gestion des comptes
   */
  function renderAccounts() {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    container.innerHTML = state.comptes.map(c => `
      <div class="account-card" id="account-${c.id}">
        <div class="account-card-header">
          <img src="${c.avatar || 'images/hero-marrakech.jpg'}" alt="${c.nom}" class="account-avatar">
          <div class="account-info">
            <h3>${c.nom}</h3>
            <div class="account-handle">${c.handle}</div>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="account-status ${c.statut === 'connecte' ? 'status-connected' : 'status-disconnected'}">
            ${c.statut === 'connecte' ? '● Connecté' : '○ Déconnecté'}
          </span>
          <span style="font-weight: 700; color: var(--secondary);">${(c.abonnes || 0).toLocaleString('fr-FR')} abonnés</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--gray);">Dernière synchro : ${c.derniereSynchro}</div>
        <button class="btn btn-sm btn-outline toggle-account-btn" data-id="${c.id}">
          ${c.statut === 'connecte' ? 'Déconnecter' : 'Reconnexion'}
        </button>
      </div>
    `).join('');

    // Toggle connexion simulée
    container.querySelectorAll('.toggle-account-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const acc = state.comptes.find(c => c.id === id);
        if (acc) {
          acc.statut = acc.statut === 'connecte' ? 'deconnecte' : 'connecte';
          acc.derniereSynchro = "À l'instant";
          saveState();
          renderAccounts();
          showToast(`Compte ${acc.plateforme} : statut mis à jour.`);
        }
      });
    });
  }

  /**
   * Configuration de l'éditeur & aperçu direct
   */
  function setupComposer() {
    const form = document.getElementById('composer-form');
    const imageSelect = document.getElementById('post-image-select');
    const postText = document.getElementById('post-text');
    const chips = document.querySelectorAll('.hashtag-chip');

    // Remplissage auto des hashtags au clic
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.getAttribute('data-tag');
        if (!postText.value.includes(tag)) {
          postText.value = (postText.value.trim() + ' ' + tag).trim();
          updateLivePreview();
        }
      });
    });

    if (postText) {
      postText.addEventListener('input', updateLivePreview);
    }
    if (imageSelect) {
      imageSelect.addEventListener('change', updateLivePreview);
    }

    // Bouton Brouillon
    const draftBtn = document.getElementById('btn-save-draft');
    if (draftBtn) {
      draftBtn.addEventListener('click', () => savePostWithStatus('brouillon'));
    }

    // Bouton Programmer
    const scheduleBtn = document.getElementById('btn-schedule-post');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', () => savePostWithStatus('programme'));
    }

    // Submit -> Publier immédiatement
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        savePostWithStatus('publie');
      });
    }
  }

  function populateImageSelect() {
    const select = document.getElementById('post-image-select');
    if (!select) return;

    select.innerHTML = state.mediatheque.map(m => `
      <option value="${normalizeSrc(m.src)}">${escapeHTML(m.titre)} (${escapeHTML(m.tag)})</option>
    `).join('');
  }

  /**
   * Galerie intégrée dans le compositeur :
   * affichage des miniatures cliquables des produits & médias,
   * alimenté dynamiquement depuis state.mediatheque (compatible décalage +1)
   */
  function renderComposerGallery() {
    const grid = document.getElementById('composer-media-grid');
    if (!grid) return;
    grid.innerHTML = state.mediatheque.map(m => `
      <div class="media-item" tabindex="0" role="button" data-src="${normalizeSrc(m.src)}" title="${escapeHTML(m.titre)}">
        <img src="${normalizeSrc(m.src)}" alt="${escapeHTML(m.titre)}" loading="lazy">
        <span class="media-tag">${escapeHTML(m.tag)}</span>
      </div>`).join('');
    grid.querySelectorAll('.media-item').forEach(item => {
      item.addEventListener('click', () => {
        const select = document.getElementById('post-image-select');
        if (select) select.value = item.getAttribute('data-src');
        updateLivePreview();
        showToast('Visuel sélectionné pour la publication.');
      });
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });
  }

  function updateLivePreview() {
    const postText = document.getElementById('post-text');
    const imageSelect = document.getElementById('post-image-select');
    const previewImg = document.getElementById('mockup-img');
    const previewText = document.getElementById('mockup-text');
    const previewAvatar = document.getElementById('mockup-avatar');

    if (previewImg && imageSelect) {
      previewImg.src = normalizeSrc(imageSelect.value);
    }
    if (previewText && postText) {
      previewText.textContent = postText.value.trim() || 'Votre texte apparaîtra ici en temps réel...';
    }
    if (previewAvatar && state.comptes.length > 0) {
      previewAvatar.src = state.comptes[0].avatar || 'images/hero-marrakech.jpg';
    }
  }

  function savePostWithStatus(status) {
    const titleInput = document.getElementById('post-title');
    const textInput = document.getElementById('post-text');
    const imageSelect = document.getElementById('post-image-select');
    const dateInput = document.getElementById('post-date');

    const selectedPlatforms = Array.from(document.querySelectorAll('input[name="platform"]:checked'))
      .map(cb => cb.value);

    if (!titleInput.value.trim()) {
      showToast('Veuillez renseigner un titre de travail.', 'warning');
      titleInput.focus();
      return;
    }

    if (selectedPlatforms.length === 0) {
      showToast('Sélectionnez au moins un réseau cible.', 'warning');
      return;
    }

    const newPost = {
      id: 'post-' + Date.now(),
      titre: titleInput.value.trim(),
      texte: textInput.value.trim(),
      image: imageSelect.value,
      reseaux: selectedPlatforms,
      statut: status,
      datePublication: (status === 'programme' && dateInput.value)
        ? new Date(dateInput.value).toISOString()
        : new Date().toISOString(),
      statistiques: status === 'publie' ? { vues: 120, likes: 14, commentaires: 2, partages: 1, clics: 5 } : null
    };

    state.publications.unshift(newPost);
    saveState();
    renderAll();

    // Réinitialisation du formulaire
    titleInput.value = '';
    textInput.value = '';
    showToast(status === 'publie' ? '🚀 Publication effectuée avec succès !' : '💾 Publication enregistrée.');

    // Redirection vers l'historique
    const postsTab = document.querySelector('[data-tab="tab-posts"]');
    if (postsTab) postsTab.click();
  }

  /**
   * Calendrier Éditorial
   */
  function setupCalendar() {
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        state.currentCalDate.setMonth(state.currentCalDate.getMonth() - 1);
        renderCalendar();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        state.currentCalDate.setMonth(state.currentCalDate.getMonth() + 1);
        renderCalendar();
      });
    }
  }

  function renderCalendar() {
    const container = document.getElementById('calendar-days-container');
    const title = document.getElementById('cal-month-title');
    if (!container || !title) return;

    const year = state.currentCalDate.getFullYear();
    const month = state.currentCalDate.getMonth();

    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    title.textContent = `${monthNames[month]} ${year}`;

    // Nettoyage des anciennes cellules tout en conservant les 7 en-têtes
    const headers = container.querySelectorAll('.calendar-day-head');
    container.innerHTML = '';
    headers.forEach(h => container.appendChild(h));

    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // Lundi = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Jours vides avant le 1er du mois
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'calendar-cell other-month';
      container.appendChild(emptyCell);
    }

    // Jours du mois courant
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';
      cell.innerHTML = `<span class="day-number">${day}</span>`;

      // Recherche des posts de ce jour
      const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayPosts = state.publications.filter(p => p.datePublication && p.datePublication.startsWith(cellDateStr));

      dayPosts.forEach(p => {
        const badge = document.createElement('button');
        badge.className = `event-badge event-${p.reseaux[0] || 'instagram'}`;
        badge.textContent = p.titre;
        badge.title = `${p.titre} (${p.reseaux.join(', ')})`;
        badge.addEventListener('click', () => {
          showToast(`Post : ${p.titre} [${p.statut.toUpperCase()}]`);
        });
        cell.appendChild(badge);
      });

      container.appendChild(cell);
    }
  }

  /**
   * Médiathèque
   */
  function setupMediaFilters() {
    const buttons = document.querySelectorAll('.filter-media-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => {
          b.classList.remove('active', 'btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-outline');
        renderMediaGrid(btn.getAttribute('data-filter'));
      });
    });
  }

  function renderMediaGrid(filter) {
    const grid = document.getElementById('media-grid-container');
    if (!grid) return;

    const filtered = filter === 'all'
      ? state.mediatheque
      : state.mediatheque.filter(m => m.tag === filter);

    grid.innerHTML = filtered.map(m => `
      <div class="media-item" tabindex="0" role="button" data-src="${m.src}" title="Utiliser pour un post">
        <img src="${m.src}" alt="${m.titre}">
        <span class="media-tag">${m.tag}</span>
      </div>
    `).join('');

    grid.querySelectorAll('.media-item').forEach(item => {
      item.addEventListener('click', () => {
        const src = item.getAttribute('data-src');
        const select = document.getElementById('post-image-select');
        if (select) {
          select.value = src;
          updateLivePreview();
        }
        const composerTab = document.querySelector('[data-tab="tab-composer"]');
        if (composerTab) composerTab.click();
        showToast('Image sélectionnée dans le créateur.');
      });
    });
  }

  /**
   * Tableau des publications
   */
  function setupPostsFilter() {
    const select = document.getElementById('filter-posts-status');
    if (select) {
      select.addEventListener('change', () => {
        renderPostsTable(select.value);
      });
    }
  }

  function renderPostsTable(filter) {
    const tbody = document.getElementById('posts-table-body');
    if (!tbody) return;

    const filtered = filter === 'all'
      ? state.publications
      : state.publications.filter(p => p.statut === filter);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--gray);">Aucune publication trouvée.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => `
      <tr>
        <td><img src="${p.image}" alt="" style="width:48px; height:48px; border-radius:6px; object-fit:cover;"></td>
        <td>
          <strong>${escapeHTML(p.titre)}</strong>
          <div style="font-size:0.78rem; color:var(--gray);">${escapeHTML(p.texte ? p.texte.substring(0, 50) + '...' : '')}</div>
        </td>
        <td>${p.reseaux.map(r => `<span style="text-transform:capitalize; font-size:0.8rem; font-weight:600;">${r}</span>`).join(', ')}</td>
        <td><span class="status-pill pill-${p.statut}">${p.statut}</span></td>
        <td style="font-size:0.82rem;">${p.datePublication ? new Date(p.datePublication).toLocaleDateString('fr-FR') : '—'}</td>
        <td>
          <button class="btn btn-sm btn-outline delete-post-btn" data-id="${p.id}" style="color:var(--danger); border-color:#fee2e2;">🗑️</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.delete-post-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        state.publications = state.publications.filter(p => p.id !== id);
        saveState();
        renderAll();
        showToast('Publication supprimée.');
      });
    });
  }

  /**
   * Statistiques & Graphiques CSS
   */
  function renderAnalytics() {
    const followersChart = document.getElementById('followers-chart');
    const engagementChart = document.getElementById('engagement-chart');

    if (followersChart) {
      const maxAbonnes = Math.max(...state.comptes.map(c => c.abonnes), 1);
      followersChart.innerHTML = state.comptes.map(c => {
        const pct = Math.round((c.abonnes / maxAbonnes) * 100);
        return `
          <div class="bar-row">
            <div class="bar-label-group">
              <span>${c.plateforme}</span>
              <span>${c.abonnes.toLocaleString('fr-FR')} (${c.croissance})</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${pct}%; background: var(--${c.id});"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    if (engagementChart) {
      const mockRates = { instagram: 6.4, facebook: 3.8, pinterest: 8.2 };
      engagementChart.innerHTML = state.comptes.map(c => {
        const rate = mockRates[c.id] || 5.0;
        return `
          <div class="bar-row">
            <div class="bar-label-group">
              <span>${c.plateforme}</span>
              <span>${rate}%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" style="width: ${rate * 10}%; background: var(--primary);"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  /**
   * Simulation globale de synchronisation
   */
  function setupSyncSimulation() {
    const syncBtn = document.getElementById('btn-sync-all');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        syncBtn.disabled = true;
        syncBtn.textContent = '⏳ Synchronisation...';
        setTimeout(() => {
          state.comptes.forEach(c => {
            if (c.statut === 'connecte') {
              c.derniereSynchro = "À l'instant";
              c.abonnes += Math.floor(Math.random() * 5) + 1;
            }
          });
          saveState();
          renderAll();
          syncBtn.disabled = false;
          syncBtn.textContent = '🔄 Tout synchroniser';
          showToast('Synchronisation terminée avec succès.');
        }, 900);
      });
    }
  }

  /**
   * Système Toast Notification
   */
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>🔔</span> <span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // Lancement dès que le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
