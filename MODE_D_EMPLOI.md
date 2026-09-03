# 📖 MODE D'EMPLOI — TOUR DE CONTRÔLE TABLEAUX MURAUX
**Application métier d'intégration automatique de produits**  
*Maison d'Artisanat Tableaux Muraux — Marrakech*

---

## 🎯 Votre nouveau geste : 1 seul dépôt, zéro question

Auparavant, l'ajout d'un nouveau tableau vous demandait d'écrire une fiche texte à la main puis de lancer des commandes dans PowerShell.  
Désormais, **tout est automatique** :

```
    [ 📸 Déposer votre image ]  ──▶  [ ⚡ Bouton allumé ]  ──▶  [ 🏆 Tableau n°1 en direct ]
```

---

## 🚀 Comment ajouter un nouveau tableau (Pas à pas)

### 1. Ouvrez votre Tour de Contrôle
Rendez-vous sur votre Tour de contrôle (lien direct : `tour-de-controle.html` ou depuis le menu haut de votre site).

### 2. Déposez la maquette de l'œuvre
- **Option A (Recommandée) :** Glissez-déposez directement votre fichier image dans le grand cadre en pointillés de la page.
- **Option B (Dossier) :** Enregistrez votre maquette sous le nom `produit-0.jpg` (ou `.png` / `.webp`) dans votre sous-dossier `images/`.

### 3. Le bouton s'allume automatiquement
- Tant qu'aucune maquette n'est présente, le bouton **« ajouter_produit_auto »** reste **GRISÉ**.
- Dès que votre maquette est détectée, le bouton **S'ALLUME en terracotta vibrant**.

### 4. Cliquez sur le bouton allumé
L'application réalise instantanément et toute seule :
1. **L'analyse visuelle de l'œuvre :** Elle identifie les couleurs, le sujet (riad, calligraphie, paysage de l'Atlas, abstraction...), l'ambiance et rédige les **13 champs de la fiche**.
2. **La sauvegarde de sécurité :** Une copie exacte de votre site est archivée avec la date et l'heure dans `sauvegardes/`.
3. **Le décalage des rangs :** Le nouveau tableau prend la **position n°1**. L'ancien n°1 devient n°2, le n°2 devient n°3, etc.
4. **La synchronisation totale :** Toutes vos pages de site et vos visuels du Social Studio restent parfaitement alignés.
5. **Le journal d'activité :** Une ligne claire est inscrite dans votre historique.

---

## 🛡️ Garde-fous et Sécurité absolue

- **Zéro Perte :** Chaque intégration crée une sauvegarde horodatée complète. En cas d'erreur, vous pouvez restaurer une ancienne version en 1 clic dans l'onglet *Sauvegardes*.
- **Zéro Question :** L'application ne vous interrompt jamais avec des demandes techniques.
- **Zéro Collision :** L'image `produit-0` est immédiatement transformée en `produit-1` et le bouton redevient grisé pour le prochain tableau.

---

*Tableaux Muraux Marrakech • Tour de Contrôle v2.0 • Conçu pour l'artisanat d'exception*
