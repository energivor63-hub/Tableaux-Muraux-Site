// ═══════════════════════════════════════════════════════════════
//  📱 SOCIAL DATA — Tableaux Muraux (gestion réseaux sociaux)
// ═══════════════════════════════════════════════════════════════
//  ⚙️  Module statique : aucune API réelle, aucune publication
//  💾 Persistance via localStorage (gérée par social-app.js)
//  🔒 Les données ici sont des DONNÉES FICTIVES RÉALISTES
// ═══════════════════════════════════════════════════════════════

const socialData = {

  // ─────────────────────────────────────────────────────────────
  // 📱 COMPTES CONNECTÉS (simulés)
  // ─────────────────────────────────────────────────────────────
  comptes: [
    {
      id: "instagram",
      plateforme: "Instagram",
      handle: "@tableaux.marrakech",
      nom: "Tableaux Muraux | Art Mural",
      icone: "📸",
      statut: "connecte",
      abonnes: 4280,
      croissance: "+8.4%",
      derniereSynchro: "Aujourd'hui à 10:15",
      avatar: "images/hero-marrakech.jpg"
    },
    {
      id: "facebook",
      plateforme: "Facebook",
      handle: "tableauxmuraux.maroc",
      nom: "Tableaux Muraux Maroc - Tableaux d'Exception",
      icone: "👥",
      statut: "connecte",
      abonnes: 8650,
      croissance: "+3.1%",
      derniereSynchro: "Hier à 18:40",
      avatar: "images/Atelier_ menuiserie1.jpg"
    },
    {
      id: "pinterest",
      plateforme: "Pinterest",
      handle: "@tableauxmuraux_art",
      nom: "Tableaux Muraux | Déco & Art Marrakech",
      icone: "📌",
      statut: "connecte",
      abonnes: 12400,
      croissance: "+14.2%",
      derniereSynchro: "Aujourd'hui à 08:00",
      avatar: "images/detail_texture.jpg"
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // 📊 STATISTIQUES GLOBALES (simulées — 30 derniers jours)
  // ─────────────────────────────────────────────────────────────
  statistiquesGlobales: {
    periode: "30 derniers jours",
    porteeTotale: 148200,
    impressions: 215400,
    engagements: 18950,
    tauxEngagementMoyen: "5.8%",
    clicsLien: 1420,
    nouveauxAbonnes: 980
  },

  // ─────────────────────────────────────────────────────────────
  // 📑 PUBLICATIONS (exemples fictifs)
  // Statuts possibles : "brouillon" | "programme" | "publie" | "echec"
  // ─────────────────────────────────────────────────────────────
  publications: [
    {
      id: "post-101",
      titre: "Zoom sur le Patio Traditionnel",
      texte: "L'authenticité d'un patio de la médina immortalisée sur bâche Oragite premium. Disponible avec cadre américain en bois massif.",
      hashtags: ["#MarrakechArt", "#ArtMural", "#DecorationMaroc", "#TableauModerne", "#MadeInMorocco"],
      image: "images/produit-1.jpg",
      reseaux: ["instagram", "facebook", "pinterest"],
      statut: "publie",
      datePublication: "2026-08-25T14:30:00",
      statistiques: { vues: 3420, likes: 284, commentaires: 19, partages: 42, clics: 78 }
    },
    {
      id: "post-102",
      titre: "Lancement de la Collection Riad",
      texte: "Découvrez notre nouvelle sélection d'art mural conçue pour sublimer les intérieurs élégants. Finition artisanale dans notre atelier de Sidi Ghanem.",
      hashtags: ["#RiadStyle", "#TableauxMuraux", "#ArtisanatMarrakech", "#DecoDesign"],
      image: "images/produit-2.jpg",
      reseaux: ["instagram", "pinterest"],
      statut: "programme",
      datePublication: "2026-08-28T18:00:00",
      statistiques: null
    },
    {
      id: "post-103",
      titre: "Conseil Déco : Choisir entre Toile Canvas & Oragite",
      texte: "Canvas pour la texture fine d'artiste ou Oragite pour des contrastes intenses et une durabilité absolue ? Notre guide complet est disponible.",
      hashtags: ["#ConseilDeco", "#ToileCanvas", "#Oragite", "#MarrakechArt"],
      image: "images/detail_texture.jpg",
      reseaux: ["facebook"],
      statut: "brouillon",
      datePublication: null,
      statistiques: null
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // 📁 MÉDIATHÈQUE (visuels réutilisables)
  // ─────────────────────────────────────────────────────────────
  mediatheque: [
    { id: "media-1", src: "images/hero-marrakech.jpg",            titre: "Ambiance Riad Marrakech",  tag: "Ambiance" },
    { id: "media-2", src: "images/Atelier_ menuiserie1.jpg",      titre: "Atelier Menuiserie Châssis", tag: "Atelier" },
    { id: "media-3", src: "images/Imprimante_ local1.jpg",        titre: "Impression Haute Définition", tag: "Atelier" },
    { id: "media-4", src: "images/detail_texture.jpg",            titre: "Texture et Finition",      tag: "Matériaux" }
  ]
};
