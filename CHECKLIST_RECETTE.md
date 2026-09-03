# 📋 CHECKLIST DE RECETTE MÉTIER — TOUR DE CONTRÔLE

Cette checklist vous permet de vérifier en quelques secondes que chaque promesse métier de votre application est scrupuleusement respectée.

---

| Étape | Ce que vous faites | Ce que vous devez observer | Statut |
| :--- | :--- | :--- | :---: |
| **1. État Initial** | Vous ouvrez `tour-de-controle.html` sans avoir déposé d'image. | Le bouton **« ajouter_produit_auto »** est affiché **GRISÉ** et non cliquable. Le badge indique *« En attente de maquette »*. | ✅ Validé |
| **2. Surveillance & Dépôt** | Vous glissez une image dans la zone ou déposez `produit-0.jpg` dans `images/`. | Le sous-dossier `images/` détecte l'image. Le bouton **S'ALLUME** immédiatement en terracotta vibrant avec le texte *« 🚀 Lancer ajouter_produit_auto »*. | ✅ Validé |
| **3. Zéro Question** | Vous cliquez sur le bouton allumé. | Aucune boîte de dialogue ne s'ouvre. L'analyse visuelle IA rédige automatiquement la fiche des 13 champs. | ✅ Validé |
| **4. Sauvegarde de Sécurité** | Pendant l'intégration. | Un dossier horodaté est créé dans `sauvegardes/backup_...` contenant tous les fichiers critiques. | ✅ Validé |
| **5. Position N°1** | Fin de l'intégration. | Le nouveau tableau est positionné en **Rang 1** en tête du catalogue. | ✅ Validé |
| **6. Décalage des Rangs** | Vérification du catalogue. | L'ancien n°1 est passé au rang 2, l'ancien n°2 est passé au rang 3, sans aucune perte de visuel. | ✅ Validé |
| **7. Fichier TXT produit** | Vérification du fichier `ajouter_produit_auto.txt`. | Le fichier est généré avec les 13 champs conformes au modèle Python. | ✅ Validé |
| **8. Journalisation** | Consultation du journal. | Une entrée claire est ajoutée au journal avec la date, l'heure, le nom du tableau et le nombre de décalages. | ✅ Validé |
| **9. Remise à zéro** | Après l'intégration. | La maquette `produit-0` n'est plus en attente et le bouton redevient **GRISÉ**, prêt pour le prochain tableau. | ✅ Validé |
| **10. Social Studio & Pages** | Ouverture de `social.html` et `index.html`. | Les publications existantes et les pages du site conservent exactement leurs œuvres d'art d'origine. | ✅ Validé |

---

### En cas d'anomalie :
- Si l'image déposée est corrompue ou illisible, l'application s'arrête immédiatement et affiche un message clair en français.
- Vous pouvez à tout moment restaurer une version précédente en 1 clic dans l'onglet **Sauvegardes** de la Tour de Contrôle.
