# 🌐 SITE WEB - Documentation

## Présentation

Site web statique (HTML/CSS/JS) pour présenter vos tableaux muraux artisanaux.

 
**E-commerce** : Commandes via WhatsApp

---

## Structure

```
site-web/
├── index.html             # Page d'accueil principale (structure fixe)
├── process.html           # Page "Notre Processus"
├── materials.html         # Page "Matériaux Premium"
├── privacy.html           # Politique de confidentialité (RGPD)
├── contenu.js             # ⭐ Fichier principal pour TOUT le contenu modifiable (95% des cas)
├── site-config.js         # Configuration technique (référence)
├── GUIDE_MODIFICATION.md  # Guide complet pour modifier le site sans toucher au HTML
└── README.md              # Ce fichier
```

---

## Fonctionnalités

### Page d'accueil (index.html)

1. **Header sticky** avec navigation
2. **Hero section** avec appel à l'action
3. **Collections** (catégories de tableaux)
4. **Grille de produits** avec :
   - Images haute qualité
   - Prix en MAD
   - Bouton "Commander" → WhatsApp
5. **Section À Propos** (artisanat marocain)
6. **Contact** (WhatsApp, email, localisation)
7. **Footer** avec liens et réseaux sociaux
8. **Bouton WhatsApp flottant** (animation pulse)
9. **Lightbox galerie** : clic sur une image = plein écran, clic/Échap = retour à la taille initiale

### Design

- **Responsive** : Mobile, tablette, desktop
- **Moderne** : Animations, transitions fluides
- **Accessible** : Contraste élevé, navigation claire
- **SEO** : Balises meta, structure sémantique

### Couleurs

```css
--primary: #2c3e50      (Bleu foncé)
--secondary: #c9a961    (Or/Doré)
--accent: #e74c3c       (Rouge)
--whatsapp: #25d366     (Vert WhatsApp)
```

---

## Personnalisation

### Ajouter un nouveau produit (avec insertion EN TÊTE de la galerie)

⚠️ **Ne modifiez PAS `index.html` directement.** Utilisez **`contenu.js`** (source unique).

Le dernier tableau ajouté doit toujours apparaître **en première position** de la galerie.
Un script automatique applique un **décalage +1** à tous les produits existants pour que
la nouvelle image prenne automatiquement la place 1.

#### 📌 Principe du décalage +1

| Avant ajout | Après ajout |
|-------------|-------------|
| `produit-1.jpg` (1er) | `produit-1.jpg` (nouveau — **en tête**) |
| `produit-2.jpg` | `produit-2.jpg` (ancien produit-1) |
| `produit-3.jpg` | `produit-3.jpg` (ancien produit-2) |
| `produit-N.jpg` | `produit-(N+1).jpg` |

🔒 Le fichier **`images/produit-0.jpg`** est un **placeholder invisible** (fichier vide)
qui n'est **jamais affiché aux clients** et **jamais modifié** par le script.

#### 1. Méthode automatique (recommandée) — via la fiche `ajouter_produit_auto.txt`

Le script lit **toutes** les informations dans la fiche `ajouter_produit_auto.txt`
placée à côté de lui. **Aucune question, aucune option** : éditez la fiche, lancez le script.

```powershell
cd "C:\Users\AdminPC\Desktop\Sauvegarde\TableauxMuraux_Site"
# 1. Éditez la fiche avec le Bloc-notes ou VS Code :
notepad ajouter_produit_auto.txt
# 2. Lancez le script :
python ajouter_produit_auto.py
```

La fiche contient :
- une ligne `source:` → chemin absolu de la nouvelle image ;
- les champs produit (`nom`, `description`, `categorie`, `style`, `environnement`,
  `prix`, `badge`, `materiauRecommande`, `montageRecommande`, `couleurs`, `ambiance`,
  `imageFallback`).

Le script :
- ✅ Décale automatiquement tous les fichiers `produit-N.ext` vers `produit-(N+1).ext`
- ✅ Met à jour toutes les références dans `contenu.js`, `index.html` et les autres fichiers de code
- ✅ Copie la nouvelle image en position `produit-1.<extension>`
- ✅ Insère un nouveau bloc produit **en tête** de la liste dans `contenu.js` (tous les champs de la fiche)
- ✅ Ne touche **jamais** à `produit-0.jpg`
- ✅ Ne pose **aucune question** interactive

#### 2. Méthode manuelle (sans décalage automatique)

- Ouvrez `contenu.js`
- Insérez le nouveau produit **en premier** dans la section `produits: [` :
  ```javascript
  {
    nom: "Mon Nouveau Tableau",
    description: "Description de votre œuvre...",
    categorie: "abstrait",
    style: "contemporain",
    environnement: "salon",
    image: "images/produit-1.jpg",
    prix: "À partir de 850 MAD",
    badge: "Nouveau"
  }
  ```
- Renommez manuellement les images existantes (produit-1 → produit-2, etc.)
- Consultez `GUIDE_MODIFICATION.md` pour plus de détails.

### Modifier les images des sections

Depuis la version **août 2026**, les images principales des sections sont **entièrement gérées via `contenu.js`**. Cela permet de les remplacer sans toucher au HTML.

Ouvrez `contenu.js` et modifiez la section **`images`** :

```javascript
images: {
  hero: "images/hero-marrakech.jpg",           // Image d'en-tête (hero)
  materiaux: "images/Imprimante_ local1.jpg",  // Section Matériaux
  finitions: "images/detail_texture.png",      // Section Finitions
  commander: "images/Atelier_ menuiserie1.jpg" // Zone "Commander" (orange foncé)
}
```

**Pour changer une image :**
1. Placez votre nouvelle image dans le dossier `images/`
2. Modifiez simplement le chemin dans `contenu.js`
3. Rechargez la page (ou redéployez)

> Les images sont chargées dynamiquement avec un système de fallback automatique en cas de fichier manquant.

### Modifier le numéro WhatsApp

Modifiez le numéro dans le fichier **`contenu.js`** (section `whatsapp`) :

```javascript
whatsapp: {
  numero: "2126XXXXXXXX",  // ← Mettez votre nouveau numéro ici (sans le +)
}
```

Le numéro n'est jamais affiché en texte sur le site, il est uniquement utilisé dans les liens `wa.me/...` avec un marquage automatique `🌐 [SITE WEB]` pour le tracking.

### Modifier les images

Remplacer les URLs Unsplash par vos propres images :

```html
<img src="images/mon-tableau.jpg" alt="Mon tableau">
```

**Recommandé** : Utiliser les miniatures générées par l'application (section 2)

---

## Déploiement

### Option 1 : GitHub Pages (Gratuit)

```bash
cd site-web
git init
git add .
git commit -m "Initial commit"

# Créer un repo sur GitHub
git remote add origin https://github.com/VOTRE_USER/VOTRE_REPO.git
git branch -M main
git push -u origin main

# Activer GitHub Pages dans Settings → Pages
```

**URL** : `https://VOTRE_USER.github.io/VOTRE_REPO`

### Option 2 : Netlify (Gratuit)

1. Aller sur [netlify.com](https://www.netlify.com)
2. Glisser-déposer le dossier `site-web/`
3. Votre site est en ligne !

**URL** : `https://NOM_ALÉATOIRE.netlify.app`

### Option 3 : Vercel (Gratuit)

1. Aller sur [vercel.com](https://vercel.com)
2. Importer le projet
3. Sélectionner le dossier `site-web/`
4. Déployer

**URL** : `https://NOM_PROJET.vercel.app`

---

## Intégration avec l'application

L'application desktop peut utiliser les miniatures générées pour le site web :

1. **Section 1** : Importer l'image
2. **Section 1** : Générer les miniatures
3. **Récupérer** : `thumbnails/*_web_thumbnail.jpg` et `*_web_detail.jpg`
4. **Copier** dans `site-web/images/`
5. **Éditer** `index.html` pour utiliser ces images

---

## SEO (Référencement)

### Balises meta optimisées

```html
<meta name="description" content="Tableaux muraux artisanaux à Marrakech...">
<meta name="keywords" content="tableaux muraux, art marocain, marrakech...">
<meta property="og:title" content="Tableaux Muraux - Artisanat Marocain">
<meta property="og:description" content="Tableaux muraux uniques...">
<meta property="og:image" content="URL_IMAGE_PREVIEW">
```

### Améliorations SEO

- ✅ Structure sémantique HTML5
- ✅ Balises alt sur toutes les images
- ✅ URLs descriptives
- ✅ Temps de chargement rapide
- ✅ Responsive design

### Analytics (Optionnel)

Ajouter Google Analytics avant `</head>` :

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

---

## Performance

### Optimisations déjà en place

- ✅ CSS minifié (inline)
- ✅ Images optimisées (Unsplash CDN)
- ✅ Pas de JavaScript inutile
- ✅ Polices Google Fonts avec preconnect
- ✅ Lazy loading implicite (navigateur moderne)

### Améliorations possibles

```bash
# Compresser les images
# Utiliser WebP au lieu de JPEG
# Ajouter un service worker (PWA)
# Mettre en cache les ressources
```

---

## Accessibilité

- ✅ Contraste élevé (WCAG AA)
- ✅ Navigation au clavier
- ✅ Textes alternatifs sur images
- ✅ Structure de titres logique
- ✅ Liens descriptifs

---

## Maintenance

### Mettre à jour les produits

1. Ouvrir `contenu.js`
2. Modifier le bloc du produit dans la section `produits`
3. Sauvegarder
4. Committer et pousser : `git add -A && git commit -m "MAJ produit" && git push`
5. Le redéploiement sur GitHub Pages se fait automatiquement (~1 minute)

### Ajouter un nouveau produit

1. Ouvrir `contenu.js`
2. Copier un bloc `{ ... }` existant dans la section `produits`
3. Modifier les champs : `nom`, `description`, `image`, `prix`, etc.
4. Committer et pousser

### Ajouter une nouvelle catégorie

1. Ouvrir `contenu.js`
2. Ajouter un objet dans la section `options.categories`
3. Utiliser cet `id` dans les produits concernés
4. Committer et pousser

### Changer les images des sections

Voir la section **Personnalisation → Modifier les images des sections** ci-dessus.

---

## 📱 Module Social Studio (gestion réseaux sociaux)

Un module statique de gestion des réseaux sociaux (Facebook, Instagram, Pinterest) a été ajouté au projet.

### Architecture

| Fichier | Rôle |
|---------|------|
| **`social-data.js`** | ⭐ Source unique des données fictives (comptes, publications, statistiques, médiathèque) |
| `social.html` | Page principale du Social Studio (à créer) |
| `social.css` | Styles du module (à créer) |
| `social-app.js` | Contrôleur d'interface UI (à créer) |

### Décisions de conception

- ✅ **Lien discret dans le footer uniquement** (pas dans la navbar publique)
- ✅ **Persistance via `localStorage`** (les créations de test sont conservées entre les sessions)
- ✅ **Interface en français** (cohérent avec le reste du site)
- ✅ **Accessibilité WCAG AA** (navigation clavier, ARIA, contrastes)
- ✅ **Mobile-first** pour le calendrier et l'éditeur de publication

### Données fictives

Les comptes simulés utilisent la nouvelle identité visuelle :
- Instagram : `@tableaux.marrakech`
- Facebook : `tableauxmuraux.maroc`
- Pinterest : `@tableauxmuraux_art`

Aucune API réelle n'est connectée : il s'agit uniquement d'une maquette statique pour concevoir l'interface avant toute intégration future.

---

**Dernière mise à jour** : 27 août 2026 (v2.3 — rebranding « Tableaux Muraux » + module Social Studio)
