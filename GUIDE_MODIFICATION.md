# 📚 Guide de Modification du Site Web — Tableaux Muraux

## 🎯 Objectif
Ce guide vous explique comment modifier facilement le contenu de votre site web (textes, images, prix, témoignages) **sans toucher au HTML**.

**Site en ligne** : https://energivor63-hub.github.io/Tableaux-Muraux-Site

---

## 📁 Structure des fichiers

| Fichier | Rôle | Quand l'utiliser |
|---------|------|------------------|
| **`contenu.js`** | ⭐ **Source unique** : TOUT le contenu modifiable | 95% des modifications |
| **`site-config.js`** | Configuration technique (référence) | Rarement |
| **`index.html`** | Page d'accueil (structure fixe) | ❌ Ne pas modifier |
| **`process.html`** | Page "Notre Processus" | ❌ Ne pas modifier |
| **`materials.html`** | Page "Matériaux Premium" | ❌ Ne pas modifier |
| **`privacy.html`** | Politique de confidentialité | ❌ Ne pas modifier |
| **`images/`** | Vos photos de tableaux | Ajouter/remplacer les images |
| **`ajouter_produit_auto.py`** | Script d'ajout automatique | Pour gagner du temps |

---

## ✏️ Modifier un texte

### Exemple : changer le slogan

1. Ouvrez le fichier **`contenu.js`** avec :
   - Bloc-notes Windows, ou
   - Notepad++ (gratuit), ou
   - VS Code (recommandé, gratuit)

2. Cherchez la section `marque` (Ctrl+F) :
   ```javascript
   marque: {
   nom: "Tableaux",
   extension: "Muraux",
   slogan: "L'art mural nouvelle génération, fabriqué à Marrakech",
   },
   ```

3. Modifiez uniquement le texte entre les guillemets `"..."` :
   ```javascript
   slogan: "Votre nouveau slogan ici",
   ```

4. **Sauvegardez** (Ctrl+S)

---

## 🖼️ Ajouter ou remplacer une image

### 🤖 Méthode AUTOMATIQUE (RECOMMANDÉE) — avec décalage +1

Le nouveau tableau sera **automatiquement placé en première position** de la galerie,
et tous les produits existants seront décalés d'une position vers le bas
(produit-1 → produit-2, produit-2 → produit-3, etc.).

🔒 **Le fichier `images/produit-0.jpg` est un placeholder invisible** (fichier vide,
jamais affiché aux clients). Il n'est **jamais modifié** par le script.

**Procédure :**

1. **Préparez l'image** où vous voulez sur votre PC (n'importe quel nom, n'importe quel dossier).

2. **Ouvrez la fiche** `ajouter_produit_auto.txt` (située à côté du script, dans
   `C:\Users\AdminPC\Desktop\Sauvegarde\TableauxMuraux_Site\`) avec votre éditeur préféré.

3. **Renseignez TOUTES les informations** dans la fiche (aucune question ne vous sera posée) :
   - Ligne `source:` → le chemin absolu de la nouvelle image ;
   - Les champs produit : `nom`, `description`, `categorie`, `style`, `environnement`,
     `prix`, `badge`, `materiauRecommande`, `montageRecommande`, `couleurs`, `ambiance`,
     `imageFallback`.

4. **Lancez simplement le script** (sans argument) :
   ```powershell
   cd "C:\Users\AdminPC\Desktop\Sauvegarde\TableauxMuraux_Site"
   python ajouter_produit_auto.py
   ```

5. **Le script exécute automatiquement :**
   - ✅ Renomme tous les fichiers `produit-N.ext` → `produit-(N+1).ext`
   - ✅ Met à jour toutes les références dans `contenu.js` et les fichiers HTML
   - ✅ Copie votre image en `images/produit-1.<extension>`
   - ✅ Insère un nouveau bloc produit **en tête** de la liste dans `contenu.js` (avec TOUS les champs de la fiche)
   - ✅ Laisse `produit-0.jpg` intact
   - ✅ Ne pose **aucune question** : tout vient de la fiche

6. **Optionnel** : vous pouvez encore ajuster les champs dans `contenu.js` si besoin
   (prix, couleurs, ambiance, etc.).

### ✋ Méthode manuelle

1. Placez votre image dans `images/` (ex: `mon-tableau.jpg`)
2. Ouvrez `contenu.js`
3. Copiez un bloc produit existant
4. Adaptez les champs :
   ```javascript
   {
     nom: "Mon Nouveau Tableau",
     description: "Description de votre œuvre...",
     categorie: "abstrait",
     style: "contemporain",
     environnement: "salon",
     image: "images/mon-tableau.jpg",
     prix: "À partir de 850 MAD",
     badge: "Nouveau",
     materiauRecommande: "Bâche Oragite®",
     montageRecommande: "Cadre Américain",
     couleurs: ["Beige", "Terracotta"],
     ambiance: "Chaleureuse et moderne"
   }
   ```

---

## 💰 Modifier les prix

Les prix sont actuellement au format : **"À partir de xxxx MAD"**

### Pour afficher un prix réel

Remplacez `xxxx` par votre chiffre :
```javascript
// Avant (masqué)
prix: "À partir de xxxx MAD"

// Après (réel)
prix: "À partir de 850 MAD"
```

### Pour masquer à nouveau
Remettez `xxxx` à la place du chiffre.

### Prix sur demande
```javascript
prix: "Prix sur demande"
```

---

## 🏷️ Gérer les catégories, styles et environnements

### ⚠️ Règle d'or : tout en minuscules, sans accents

Les IDs utilisés dans les produits doivent correspondre exactement aux IDs définis dans les options :

| Champ | ❌ Mauvais | ✅ Bon |
|-------|-----------|-------|
| `categorie` | `"Abstrait"` | `"abstrait"` |
| `style` | `"Contemporain"` | `"contemporain"` |
| `environnement` | `"Riad"` | `"riad"` |
| `environnement` | `"Ecole primaire"` | `"ecole-primaire"` |

### Listes disponibles

#### 🎨 Catégories (7 options)
```javascript
tous | abstrait | paysages | calligraphie | moderne | geometrique | floral | autres
```

#### 🖌️ Styles (5 options)
```javascript
tous | contemporain | traditionnel | minimaliste | boheme | art-deco | autres
```

#### 🏠 Environnements (7 options)
```javascript
tous | salon | chambre | bureau | entree | riad | cabinet | ecole-primaire | autres
```

### Ajouter une nouvelle option

Dans `contenu.js`, section `options` :
```javascript
categories: [
  { id: "tous", label: "Tous" },
  // ... existants
  { id: "animalier", label: "Animalier" }  // ← nouvelle option
]
```

⚠️ **Important** : Il faut aussi ajouter le bouton dans `index.html` (section filtres) pour que le nouveau filtre apparaisse sur le site.

### Utiliser le filtre "Autres"

Si un produit a une valeur **hors liste standard**, il sera visible uniquement quand on clique sur le bouton **"Autres"** du filtre correspondant.

---

## ⚙️ Modifier le processus créatif

### Ajouter une étape

Dans `contenu.js`, section `processus` :
```javascript
{
  numero: 4,
  icone: "🎁",
  titre: "Emballage soigné",
  description: "Chaque tableau est emballé avec soin...",
  lien: "#contact"
}
```

### Supprimer une étape
Supprimez tout le bloc `{ numero: X, ... }` de l'étape concernée.

**Note** : L'étape "Traitement protecteur" a été supprimée. Ne pas la rajouter.

---

## 🖼️ Modifier les options de montage

### Toile Tendue vs Cadre Américain

Chaque produit peut recommander un type de montage :
```javascript
montageRecommande: "Cadre Américain"    // ou "Toile Tendue"
```

### Dimensions personnalisées
Les dimensions sont listées dans la section `finitions` de `contenu.js`.

---

## ⭐ Modifier un témoignage

Dans la section `temoignages` de `contenu.js` :
```javascript
{
  initiales: "SA",          // Initiales affichées dans le cercle
  nom: "Sarah A.",          // Nom du client
  ville: "Marrakech",       // Ville
  texte: "Son témoignage...", // Commentaire
  note: 5                   // Étoiles (1 à 5)
}
```

---

## 🔒 Numéro WhatsApp

Le numéro **n'est JAMAIS affiché en texte** sur votre site.
Il est uniquement utilisé dans les liens `wa.me/...`.

### Tracking automatique des clients

Tous les messages reçus via votre site porteront automatiquement le marqueur :
```
🌐 [SITE WEB]
```

Vous saurez immédiatement qu'un client vient du site web.

### Changer le numéro WhatsApp

Modifiez dans `contenu.js` :
```javascript
whatsapp: {
  numero: "2126XXXXXXXX",  // ← Mettez votre nouveau numéro ici
  ...
}
```

Format : sans le `+`, sans espaces (ex: `212648620364`)

---

## 🌐 Mettre le site en ligne (déploiement)

Après chaque modification, vous devez **redéployer** le site :

### Netlify (Méthode officielle)

1. Allez sur **https://app.netlify.com**
2. Sélectionnez votre site **`ideawoven-marrakech`**
3. Onglet **"Deploys"**
4. **Glissez-déposez le dossier `site-web`** (tout le dossier)
5. Attendez 30 secondes
6. Votre site est mis à jour !

⚠️ **Important** : vous devez glisser le dossier **ENTIER**, pas juste `index.html`

### Netlify Drop (Sans compte)

Pour un déploiement rapide de test :
1. Allez sur **https://app.netlify.com/drop**
2. Glissez le dossier `site-web`
3. URL temporaire générée

---

## ❓ Problèmes courants

### Mon site ne se met pas à jour après modification
→ **Cache du navigateur** : appuyez sur `Ctrl + F5` pour forcer le rechargement

### J'ai fait une erreur dans `contenu.js`
→ Ouvrez la console du navigateur (F12), l'erreur s'affichera en rouge

### Mes images ne s'affichent pas
→ Vérifiez le nom exact du fichier (minuscules, pas d'espaces, extension correcte)
→ Vérifiez le chemin dans `contenu.js` : `"images/produit-1.png"`
→ Vérifiez que l'extension correspond (`.jpg` vs `.png`)

### Un produit n'apparaît pas quand je filtre
→ Vérifiez que `categorie`/`style`/`environnement` est bien en **minuscules sans accents**
→ Vérifiez que l'ID existe dans `options.categories`/`styles`/`environnements`
→ Utilisez le filtre **"Autres"** pour voir les produits hors liste standard

### Je veux revenir en arrière
→ Utilisez Git (`git checkout .`) si vous avez initialisé le repo
→ Sinon, gardez une copie de sauvegarde du dossier `site-web` avant chaque modification

---

## 🎨 Modifier le design (couleurs, polices)

⚠️ **Attention** : Modifier les couleurs nécessite de toucher au HTML.

Les couleurs sont définies dans `index.html`, section `:root { ... }` :

```css
:root {
  --primary: #C65D3B;        /* Terracotta (principal) */
  --primary-dark: #A84A2D;   /* Terracotta foncé (actif nav) */
  --secondary: #2C3E50;      /* Bleu foncé */
  --accent: #D4A574;         /* Beige */
  --dark: #1a1a1a;           /* Texte foncé */
  --light: #F8F5F0;          /* Fond clair */
  --whatsapp: #25D366;       /* Vert WhatsApp officiel */
}
```

Changez les codes hexadécimaux pour modifier les couleurs.

---

## 📊 Workflow recommandé

### Workflow quotidien (5 minutes)

1. 📸 Prendre une photo du nouveau tableau
2. 📝 Éditer `ajouter_produit_auto.txt` : ligne `source:` + champs produit
3. 🤖 Exécuter `python ajouter_produit_auto.py` (aucune question posée)
4. 🚀 Committer et pousser (`git add -A && git commit -m "Nouveau produit : ..." && git push`)

### Workflow hebdomadaire

- ✅ Ajouter 2-3 nouveaux tableaux
- ✅ Répondre aux messages WhatsApp (marqués 🌐 [SITE WEB])
- ✅ Publier sur les réseaux sociaux (Facebook, Instagram, Pinterest)
- ✅ Vérifier les statistiques Google Analytics

---

## 📞 Besoin d'aide ?

Si vous rencontrez un problème non documenté ici :
- 📚 Consultez le fichier `README.md` pour la documentation technique
- 💬 Contactez le développeur qui a créé ce site

---

## 🎯 Récapitulatif des fichiers à ne PAS modifier

| Fichier | Raison |
|---------|--------|
| ❌ `index.html` | Structure complexe avec filtres codés en dur |
| ❌ `process.html` | Page HTML dédiée au processus |
| ❌ `materials.html` | Page HTML dédiée aux matériaux |
| ❌ `privacy.html` | Politique de confidentialité RGPD |

**Uniquement** `contenu.js` + dossier `images/` pour 95% des modifications.

---

**Dernière mise à jour** : 27 août 2026
**Version du site** : Tableaux Muraux v2.3 (rebranding + module Social Studio)
