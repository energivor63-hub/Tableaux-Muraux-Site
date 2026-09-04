// ═══════════════════════════════════════════════════════════════
//  📝 FICHIER DE CONTENU - Tableaux Muraux
// ═══════════════════════════════════════════════════════════════
//  ✏️  MODIFIEZ CE FICHIER pour mettre à jour votre site web
//  📚 Consultez GUIDE_MODIFICATION.md pour les instructions
//  🔄 Après modification, redéployez via Netlify Drop
// ═══════════════════════════════════════════════════════════════

const CONTENU_SITE = {

  // ─────────────────────────────────────────────────────────────
  // 🎯 IDENTITÉ DE LA MARQUE
  // ─────────────────────────────────────────────────────────────
  marque: {
    nom: "Tableaux",
    extension: "Muraux",
    slogan: "L'art mural nouvelle génération, fabriqué à Marrakech",
    description: "Art mural artisanal, co-créé par IA et fabriqué à la main à Marrakech. Des œuvres uniques pour sublimer votre intérieur."
  },

  // ─────────────────────────────────────────────────────────────
  // 🖼️ IMAGES DES SECTIONS (modifiables ici)
  // ─────────────────────────────────────────────────────────────
  // ✏️ Modifiez les chemins ci-dessous pour changer les images
  // 📁 Placez vos images dans le dossier "images/"
  // ─────────────────────────────────────────────────────────────
  images: {
    hero: "images/hero-marrakech.jpg",
    materiaux: "images/Imprimante_ local1.jpg",
    finitions: "images/detail_texture.jpg",
    commander: "images/Atelier_ menuiserie1.jpg"
  },

  // ─────────────────────────────────────────────────────────────
  // 💬 WHATSAPP (numéro MASQUÉ sur le site)
  // ─────────────────────────────────────────────────────────────
  // Le numéro n'est NULLE PART affiché en texte sur le site.
  // Tous les messages envoyés portent le marqueur "🌐 SITE WEB"
  // pour que vous reconnaissiez immédiatement les clients venus du site.
  whatsapp: {
    numero: "212648620364",                    // Format international sans le +
    indicateurSite: "🌐 [SITE WEB]",           // Préfixe ajouté automatiquement
    messageDefaut: "Bonjour Tableaux Muraux ! Je suis intéressé(e) par vos tableaux muraux.",
  },

  // ─────────────────────────────────────────────────────────────
  // 🏠 SECTION HÉRO (en-tête de la page)
  // ─────────────────────────────────────────────────────────────
  hero: {
    image: "images/hero-marrakech.jpg",
    badges: ["🤖 Co-création IA", "🇲🇦 Made in Marrakech", "✨ Premium"],
    titreAvant: "L'art mural",
    titreItalique: "réinventé",
    titreApres: "à Marrakech",
    sousTitre: "Des tableaux uniques, co-créés par l'intelligence artificielle et fabriqués à la main par nos artisans. Impression premium sur bâche Oragite® et toile canvas, encadrement artisanal en bois.",
    boutonPrincipal: "Découvrir la collection →",
    boutonSecondaire: "Notre processus"
  },

  // ─────────────────────────────────────────────────────────────
  // ⚙️ PROCESSUS CRÉATIF (étapes affichées)
  // Pour ajouter une étape, copiez un objet { ... } ci-dessous
  // Pour supprimer une étape, supprimez l'objet { ... } entier
  // ─────────────────────────────────────────────────────────────
  processus: [
    {
      numero: 1,
      icone: "🤖",
      titre: "Co-Conception IA",
      description: "Nos artistes guident des modèles d'IA avancés pour créer des compositions originales, inspirées par la richesse visuelle du Maroc et les tendances contemporaines.",
      lien: "#contact"
    },
    {
      numero: 2,
      icone: "🖨️",
      titre: "Impression Premium",
      description: "Chaque œuvre est imprimée sur bâche brillante Oragite® (qualité muséale) ou sur toile canvas artistique, pour des couleurs éclatantes et durables.",
      lien: "#materials"
    },
    {
      numero: 3,
      icone: "🪵",
      titre: "Fabrication Artisanale",
      description: "Nos artisans de Marrakech réalisent à la main les cadres en bois massif, avec des finitions soignées et un montage expert pour une qualité exceptionnelle.",
      lien: "#contact"
    }
    // ❌ Étape "Traitement protecteur" supprimée (ne pas réajouter)
  ],

  // ─────────────────────────────────────────────────────────────
  // 🧱 MATÉRIAUX PREMIUM
  // ─────────────────────────────────────────────────────────────
  materiaux: [
    {
      icone: "✨",
      titre: "Bâche Oragite®",
      description: "Impression sur bâche brillante de qualité muséale, offrant des couleurs vibrantes et une netteté exceptionnelle. Idéale pour les pièces modernes et contemporaines.",
      features: [
        "Couleurs éclatantes et durables",
        "Résistance",
        "Finition brillante premium",
        "Qualité muséale",
        "Tendue sur cadre ou Cadre américain"
      ]
    },
    {
      icone: "🎨",
      titre: "Toile Canvas",
      description: "Toile canvas artistique de haute qualité, offrant une texture traditionnelle et un rendu authentique. Parfaite pour les intérieurs classiques et bohèmes.",
      features: [
        "Texture naturelle du tissu",
        "Rendu artistique authentique",
        "Résistance au temps",
        "Aspect galerie d'art",
        "Tendue sur cadre ou Cadre américain"
      ]
    },
    {
      icone: "🪵",
      titre: "Cadres en Bois",
      description: "Cadres réalisés à la main par nos artisans de Marrakech, en bois massif de qualité. Disponibles en multiples formes et finitions pour s'adapter à tous les intérieurs.",
      features: [
        "Bois massif sélectionné",
        "Fabrication artisanale",
        "Multiples formes disponibles",
        "Finitions soignées",
        "Sur mesure possible"
      ]
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // 🖼️ OPTIONS DE MONTAGE & FINITION
  // ─────────────────────────────────────────────────────────────
  montage: {
    titre: "Options de Montage & Finition",
    sousTitre: "Chaque œuvre est réalisée selon vos préférences avec des dimensions sur mesure",
    options: [
      {
        icone: "📐",
        titre: "Toile ou Bâche Tendue sur Cadre",
        description: "La toile canvas ou Bâche est tendue et agrafée sur un châssis en bois massif, prête à être accrochée. Aspect traditionnel et élégant, style galerie d'art.",
        avantages: [
          "Prêt à accrocher",
          "Aspect traditionnel galerie",
          "Légèreté et rigidité",
          "Idéal pour Oragite® et canvas"
        ]
      },
      {
        icone: "🖼️",
        titre: "Cadre Américain (Flottant)",
        description: "Encadrement moderne avec espace entre l'œuvre et le cadre, créant un effet de lévitation. Finition haut de gamme qui met en valeur votre tableau.",
        avantages: [
          "Design contemporain",
          "Effet flottant élégant",
          "Protection de l'œuvre",
          "Idéal pour Oragite® et canvas"
        ]
      }
    ],
    dimensions: {
      titre: "Dimensions sur Mesure",
      description: "Toutes nos œuvres sont disponibles dans les dimensions de votre choix. Nos artisans s'adaptent à vos besoins pour un rendu parfait dans votre espace.",
      exemples: [
        "Petit format : 30×40 cm, 40×50 cm",
        "Format standard : 50×70 cm, 60×80 cm",
        "Grand format : 80×120 cm, 100×150 cm",
        "Format panoramique : sur demande",
        "Dimensions personnalisées : nous consulter"
      ]
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 🏷️ OPTIONS CONFIGURABLES (filtres & catégories)
  // ─────────────────────────────────────────────────────────────
  // ✏️ Modifiez ces listes pour les adapter aux demandes de vos clients.
  // 💡 Chaque option possède un "id" (utilisé dans les produits) et un "label" (affiché).
  // 🔄 Après modification, redéployez le site via Netlify Drop.
  // ─────────────────────────────────────────────────────────────
  options: {

    // 🎨 CATÉGORIES DE TABLEAUX
    // Utilisez l'id exact (minuscules, sans accents) dans le champ "categorie" des produits
    categories: [
      { id: "tous", label: "Tous" },
      { id: "abstrait", label: "Abstrait" },
      { id: "paysages", label: "Paysages" },
      { id: "calligraphie", label: "Calligraphie" },
      { id: "moderne", label: "Moderne" },
      { id: "geometrique", label: "Géométrique" },
      { id: "floral", label: "Floral" },
      { id: "autres", label: "Autres" }
    ],

    // 🖌️ STYLES ARTISTIQUES
    // Utilisez l'id exact (minuscules, tirets) dans le champ "style" des produits
    styles: [
      { id: "tous", label: "Tous" },
      { id: "contemporain", label: "Contemporain" },
      { id: "traditionnel", label: "Traditionnel" },
      { id: "minimaliste", label: "Minimaliste" },
      { id: "boheme", label: "Bohème" },
      { id: "art-deco", label: "Art Déco" },
      { id: "autres", label: "Autres" }
    ],

    // 🏠 ENVIRONNEMENTS / PIÈCES
    // Utilisez l'id exact (minuscules, tirets) dans le champ "environnement" des produits
    environnements: [
      { id: "tous", label: "Tous" },
      { id: "salon", label: "Salon" },
      { id: "chambre", label: "Chambre" },
      { id: "bureau", label: "Bureau" },
      { id: "entree", label: "Entrée" },
      { id: "riad", label: "Riad" },
      { id: "cabinet", label: "Cabinet" },
      { id: "ecole-primaire", label: "École primaire" },
      { id: "autres", label: "Autres" }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // 🖼️ PRODUITS / GALERIE
  // ─────────────────────────────────────────────────────────────
  // 📸 Pour remplacer une image :
  //   1. Placez votre photo dans le dossier "images/"
  //   2. Modifiez le champ "image" ci-dessous
  //   Exemple : "image": "images/mon-tableau.jpg"
  //
  // 💰 Prix : utilisez "xxxx" pour masquer, ou mettez le prix réel
  //   Exemple : "prix": "À partir de xxxx MAD" (masqué)
  //   Exemple : "prix": "À partir de 850 MAD" (réel)
  //
  // 🏷️ Catégories disponibles : abstrait, paysage, calligraphie, moderne, geometrique, floral
  // 🎨 Styles disponibles : contemporain, traditionnel, minimaliste, boheme, art-deco
  // 🏠 Environnements : salon, chambre, bureau, entree, salle-de-bain, cuisine
  // ─────────────────────────────────────────────────────────────
  produits: [
    {
      nom: "L'Éclat de la Gloire Divine",
      description: "Cette œuvre sublime met en valeur la calligraphie arabe 'Subhan Allah' dans une écriture noire audacieuse et fluide. Le fond texturé, rappelant une peinture à l'huile épaisse, mêle des nuances de crème et de beige rehaussées de paillettes d'or qui captent la lumière. Une pièce maîtresse apportant sérénité et spiritualité à votre intérieur.",
      categorie: "calligraphie",
      style: "traditionnel",
      environnement: "salon",
      image: "images/produit-1.jpg",
      imageFallback: "📜",
      prix: "À partir de 180 MAD",
      badge: "Nouveau",
      materiauRecommande: "Toile Canvas",
      montageRecommande: "Cadre Américain",
      couleurs: ["Beige", "Crème", "Doré", "Noir"],
      ambiance: "Spirituelle, noble et chaleureuse",
    },
    {
      nom: "Calligraphie Islamique Marocaine Dorée",
      description: "Tableau mural de calligraphie islamique en relief, sublimé par des arabesques dorées sur fond ocre texturé, encadré de bois et intégré dans un riad marocain chaleureux et raffiné.",
      categorie: "autres",
      style: "traditionnel",
      environnement: "riad",
      image: "images/produit-2.jpg",
      imageFallback: "🏺",
      prix: "À partir de 100 MAD",
      badge: "Nouveau",
      materiauRecommande: "Bâche Oragite®",
      montageRecommande: "Cadre Américain",
      couleurs: ["Doré", "Marron", "Bleu", "Doré"],
      ambiance: "Chaleureuse, authentique et raffinée",
    },
    {
      nom: "Triptyque Patrimoine Marocain et Astrolabe",
      description: "Triptyque d'art marocain : coin thé traditionnel avec zelliges et lanterne, astrolabe ancien sur parchemin, et patio de riad avec fontaine ouvrant sur l'Atlas",
      categorie: "autres",
      style: "traditionnel",
      environnement: "riad",
      image: "images/produit-3.jpg",
      imageFallback: "🏺",
      prix: "À partir de 190 MAD",
      badge: "Nouveau",
      materiauRecommande: "Bâche Oragite®",
      montageRecommande: "Cadre Américain",
      couleurs: ["Ocre", "Bleu", "Marron", "Doré"],
      ambiance: "Chaleureuse et authentique",
    },
    {
      nom: "Patio Traditionnel à l'Olivier",
      description: "Scène de patio méditerranéen/marocain peinte à l'aquarelle, mettant en valeur un grand olivier en pot, une porte en bois bleue surmontée de bougainvilliers en fleurs, et un tapis traditionnel aux motifs délicats.",
      categorie: "autres",
      style: "autres",
      environnement: "riad",
      image: "images/produit-4.jpg",
      imageFallback: "🎨",
      prix: "À partir de 100 MAD",
      badge: "Nouveau",
      materiauRecommande: "Bâche Oragite®",
      montageRecommande: "Cadre Américain",
      couleurs: ["Beige", "Bleu", "Rose", "Vert"],
      ambiance: "Authentique et apaisante",
    },
    {
      nom: "Tableau Géométrique Abstrait",
      description: "Patio marocain baigné de lumière, fontaine centrale ciselée, arches élégantes et mosaïques raffinées créant une atmosphère paisible et authentique.",
      categorie: "moderne",
      style: "contemporain",
      environnement: "riad",
      image: "images/produit-5.jpg",
      imageFallback: "🎨",
      prix: "À partir de 70 MAD",
      badge: "Nouveau",
      materiauRecommande: "Bâche Oragite®",
      montageRecommande: "Cadre Américain",
      couleurs: ["Jaune", "Rose", "Bleu", "Noir"],
      ambiance: "Chaleureuse et moderne"
    },
    {
      nom: "Cour Riad Andalou",
      description: "Une cour de riad somptueuse aux arches sculptées, mosaïques raffinées et lumière dorée, capturée dans une composition chaleureuse et élégante.",
      categorie: "paysages",
      style: "traditionnel",
      environnement: "riad",
      image: "images/produit-6.jpg",
      imageFallback: "🎨",
      prix: "À partir de 100 MAD",
      badge: null,
      materiauRecommande: "Toile Canvas",
      montageRecommande: "Cadre Américain",
      couleurs: ["Terracotta", "Beige", "Brun", "Bleu", "Doré"],
      ambiance: "Chaleureuse, raffinée"
    },
    {
      nom: "Oasis Mauresque",
      description: "Une scène mauresque riche en zelliges, arches sculptées et lanternes dorées, sublimée par des tons terre et bleu pour une ambiance chaleureuse et raffinée.",
      categorie: "geometrique",
      style: "traditionnel",
      environnement: "entree",
      image: "images/produit-7.jpg",
      imageFallback: "🎨",
      prix: "À partir de 100 MAD",
      badge: null,
      materiauRecommande: "Toile Canvas",
      montageRecommande: "Cadre Américain",
      couleurs: ["Terracotta", "Bleu", "Beige", "Doré", "Brun"],
      ambiance: "Chaleureuse, majestueuse"
    },
    {
      nom: "Terres Murmurantes",
      description: "Abstraction minérale aux tons bruns, ocres et beiges, évoquant la douceur et la chaleur des intérieurs apaisants.",
      categorie: "moderne",
      style: "boheme",
      environnement: "salon",
      image: "images/produit-8.jpg",
      imageFallback: "🪨",
      prix: "À partir de 100 MAD",
      badge: null,
      materiauRecommande: "Toile Canvas",
      montageRecommande: "Toile Tendue",
      couleurs: ["Bleu Majorelle", "Jaune", "Vert"],
      ambiance: "Fraîche et inspirante"
    },
    {
      nom: "Coucher de Soleil Médina",
      description: "Abstraction lyrique évoquant les lumières dorées de la médina au crépuscule. Les dégradés chauds apportent une touche romantique et poétique.",
      categorie: "abstrait",
      style: "contemporain",
      environnement: "chambre",
      image: "images/produit-9.jpg",
      imageFallback: "🌅",
      prix: "À partir de 190 MAD",
      badge: "Élégance Terre",
      materiauRecommande: "Bâche Oragite®",
      montageRecommande: "Cadre Américain",
      couleurs: ["Brun", "Ocre", "Beige", "Crème"],
      ambiance: "Chaleureuse et apaisante"
    },
    {
      nom: "Cour Intérieure Marocaine",
      description: "Une scène de cour intérieure marocaine baignée de lumière, avec arches sculptées, porte verte, zelliges traditionnels, palmiers et poteries en terre cuite. Une œuvre chaleureuse qui associe l'architecture traditionnelle marocaine à une esthétique contemporaine et raffinée.",
      categorie: "paysages",
      style: "contemporain",
      environnement: "salon",
      image: "images/produit-10.jpg",
      imageFallback: "🏡",
      prix: "À partir de 70 MAD",
      badge: "Nouveau",
      materiauRecommande: "Toile Canvas",
      montageRecommande: "Sans cadre",
      couleurs: ["Ocre", "Terracotta", "Vert olive", "Crème"],
      ambiance: "Chaleureuse, lumineuse et méditerranéenne"
    },
    // ✏️ Pour ajouter un produit, copiez un bloc { ... } ci-dessus
    {
      nom: "Ondes Sculpturales",
      description: "Triptyque abstrait aux lignes organiques et reliefs subtils, dans des tons naturels. Une composition élégante qui apporte lumière, douceur et modernité au salon.",
      categorie: "abstrait",
      style: "minimaliste",
      environnement: "salon",
      image: "images/produit-11.jpg",
      imageFallback: "🎨",
      prix: "À partir de 190 MAD",
      badge: null,
      materiauRecommande: "Toile Canvas",
      montageRecommande: "Toile Tendue",
      couleurs: ["Ivoire", "Beige", "Taupe", "Grège"],
      ambiance: "Calme, lumineuse"
    },
    // 📝 Champs modifiables : nom, description, categorie, style, environnement,
    //                        image, prix, badge, materiauRecommande, montageRecommande,
    //                        couleurs, ambiance
  ],

  // ─────────────────────────────────────────────────────────────
  // ⭐ TÉMOIGNAGES CLIENTS
  // ─────────────────────────────────────────────────────────────
  temoignages: [
    {
      initiales: "SA",
      nom: "Sarah A.",
      ville: "Marrakech",
      texte: "Un tableau magnifique qui a complètement transformé mon salon. La qualité d'impression sur Oragite est exceptionnelle, les couleurs sont vibrantes ! J'ai opté pour le cadre américain flottant, c'est d'une élégance rare.",
      note: 5
    },
    {
      initiales: "KM",
      nom: "Karim M.",
      ville: "Casablanca",
      texte: "J'adore le concept de co-création IA + artisanat. Le cadre en bois est superbe et le service client via WhatsApp est très réactif. J'ai commandé un format sur mesure 80×120 cm, parfait pour mon mur !",
      note: 5
    },
    {
      initiales: "FB",
      nom: "Fatima B.",
      ville: "Rabat",
      texte: "Offert en cadeau à ma mère, elle a adoré ! Le tableau sur canvas tendu a un rendu vraiment authentique, digne d'une galerie d'art. Livraison rapide et emballage soigné.",
      note: 5
    },
    {
      initiales: "YM",
      nom: "Youssef M.",
      ville: "Marrakech",
      texte: "Excellent travail ! Le tableau reflète parfaitement l'ambiance que je recherchais pour mon riad. Les dimensions personnalisées s'intègrent parfaitement dans l'architecture traditionnelle.",
      note: 5
    }
  ],

  // ─────────────────────────────────────────────────────────────
  // 📱 RÉSEAUX SOCIAUX
  // ─────────────────────────────────────────────────────────────
  reseaux: {
    instagram: "https://instagram.com/ideawoven.marrakech",
    facebook: "https://facebook.com/profile.php?id=952942547902065",
    pinterest: "https://pinterest.com/tableauxmuraux_art",
    siteWeb: "https://energivor63-hub.github.io/Tableaux-Muraux-Site"
  },

  // ─────────────────────────────────────────────────────────────
  // 🎨 LOGO WHATSAPP OFFICIEL (SVG path)
  // NE PAS MODIFIER sauf si vous savez ce que vous faites
  // ─────────────────────────────────────────────────────────────
  whatsappLogoSVG: `M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z`,

  // ─────────────────────────────────────────────────────────────
  // 📄 CONTENU DÉTAILLÉ DES PAGES INTERNES (ÉDITABLE ICI)
  // ─────────────────────────────────────────────────────────────
  // Pilote automatiquement materials.html, process.html, privacy.html, social.html
  // ─────────────────────────────────────────────────────────────
  pages: {

    // ═══════════════════════════════════════════════════════════
    // 1. PAGE MATÉRIAUX (materials.html)
    // ═══════════════════════════════════════════════════════════
    materials: {
      meta: {
        title: "Nos Matériaux Premium | Tableaux Muraux",
        description: "Des matériaux de qualité professionnelle pour des tableaux qui durent toute une vie : Bâche Oragite® brillante et Toile Canvas artistique sur cadres bois de Marrakech."
      },
      nav: {
        brandName: "Tableaux",
        brandExtension: " Muraux",
        linkProcess: "Notre Processus",
        linkGallery: "Galerie",
        linkReviews: "Avis",
        btnOrder: "Commander"
      },
      hero: {
        title: "Nos Matériaux Premium",
        subtitle: "Des matériaux de qualité professionnelle pour des tableaux qui durent toute une vie",
        breadcrumbHome: "Accueil",
        breadcrumbCurrent: "Nos Matériaux"
      },
      oragite: {
        visual: "images/bache-oragite.jpg",
        title: "Bâche Oragite® Brillante",
        subtitle: "La référence en matière d'impression grand format. <strong>Oragite®</strong> est une marque du groupe allemand <strong>ORAFOL</strong>, reconnue mondialement pour la qualité professionnelle de ses supports d'impression numérique.",
        features: [
          {
            title: "Couleurs vibrantes et éclatantes",
            desc: "La finition brillante fait ressortir les couleurs avec une intensité exceptionnelle, idéale pour des visuels percutants."
          },
          {
            title: "Résistance",
            desc: "Protection contre le fading pour une durabilité exceptionnelle, adaptée à une exposition prolongée."
          },
          {
            title: "Qualité professionnelle",
            desc: "Support privilégié par les imprimeurs et les professionnels de la communication visuelle pour des impressions haut de gamme."
          },
          {
            title: "Facile à nettoyer",
            desc: "Surface lisse en PVC qui se nettoie d'un simple coup de chiffon humide, sans altération de l'impression."
          },
          {
            title: "Idéal pour les pièces modernes",
            desc: "Parfait pour les intérieurs contemporains, les bureaux, les commerces et les espaces d'exposition."
          }
        ]
      },
      canvas: {
        visual: "images/toile-canvas.jpg",
        title: "Toile Canvas Artistique",
        subtitle: "La toile canvas offre un rendu authentique et traditionnel, rappelant les grandes œuvres classiques. Parfaite pour créer une atmosphère chaleureuse et artistique.",
        features: [
          {
            title: "Texture naturelle du tissu",
            desc: "Toucher authentique qui rappelle les peintures traditionnelles"
          },
          {
            title: "Rendu artistique authentique",
            desc: "Aspect galerie d'art avec profondeur et relief"
          },
          {
            title: "Résistance au temps",
            desc: "Matériau noble qui se bonifie avec les années"
          },
          {
            title: "Montage sur châssis bois",
            desc: "Structure solide et stable pour une présentation parfaite"
          },
          {
            title: "Idéal pour les intérieurs classiques",
            desc: "Parfait pour les décors bohèmes, rustiques et traditionnels"
          }
        ]
      },
      comparison: {
        title: "Comparaison détaillée",
        subtitle: "Choisissez le matériau idéal pour votre projet",
        thFeature: "Caractéristique",
        thOragite: "Oragite® Brillante",
        thCanvas: "Canvas Artistique",
        row1: { name: "Finition", oragite: "Brillante", canvas: "Mate texturée" },
        row2: { name: "Intensité des couleurs", oragiteRating: "★★★★★", canvasRating: "★★★★☆" },
        row3: { name: "Résistance UV", oragiteCheck: "✓", canvasCheck: "✓" },
        row4: { name: "Facilité d'entretien", oragiteRating: "★★★★★", canvasRating: "★★★☆☆" },
        row5: { name: "Aspect traditionnel", oragiteRating: "★★★☆☆", canvasRating: "★★★★★" },
        row6: { name: "Style moderne", oragiteRating: "★★★★★", canvasRating: "★★★☆☆" },
        row7: { name: "Prix (taille standard)", oragite: "À partir de 70 MAD", canvas: "À partir de 120 MAD" }
      },
      useCases: {
        title: "Quel matériau pour quelle pièce ?",
        subtitle: "Nos recommandations selon l'ambiance souhaitée",
        cardOragite: {
          visual: "images/hero-marrakech.jpg",
          icon: "✨",
          title: "Oragite® Brillante",
          desc: "Idéale pour les espaces modernes qui ont besoin d'éclat et de luminosité. La finition brillante capte la lumière et dynamise la pièce.",
          rooms: ["🛋️ Salon moderne", "🏢 Bureau", "🍽️ Salle à manger", "🏪 Commerce"]
        },
        cardCanvas: {
          visual: "images/detail_texture.jpg",
          icon: "🎨",
          title: "Canvas Artistique",
          desc: "Parfaite pour créer une atmosphère chaleureuse et authentique. La texture naturelle du canvas apporte du caractère et de l'élégance.",
          rooms: ["🛏️ Chambre", "📚 Bibliothèque", "🏡 Riad", "☕ Café"]
        }
      },
      frames: {
        title: "Nos Cadres en Bois",
        subtitle: "Fabriqués à la main par nos artisans de Marrakech",
        item1: { icon: "⬜", title: "Rectangulaire", desc: "Format classique et élégant" },
        item2: { icon: "⬛", title: "Carré", desc: "Moderne et équilibré" },
        item3: { icon: "📏", title: "Panoramique", desc: "Format large et impactant" },
        item4: { icon: "🎯", title: "Sur Mesure", desc: "Dimensions personnalisées" },
        item5: { icon: "🪵", title: "Bois Naturel", desc: "Finition brute authentique" },
        item6: { icon: "⚫", title: "Bois Noir", desc: "Élégance contemporaine" }
      },
      quality: {
        title: "Notre Garantie Qualité",
        subtitle: "Nous nous engageons sur la qualité de chaque tableau",
        item1: { icon: "🏆", title: "Matériaux Premium", desc: "Uniquement des matériaux de marques reconnues mondialement" },
        item2: { icon: "🔨", title: "Artisanat Local", desc: "Cadres fabriqués à la main par des artisans de Marrakech" },
        item3: { icon: "✅", title: "Contrôle Rigoureux", desc: "Chaque tableau inspecté avant expédition" },
        item4: { icon: "💯", title: "Satisfaction Garantie", desc: "Si vous n'êtes pas satisfait, nous trouvons une solution" }
      },
      cta: {
        title: "Choisissez votre matériau idéal",
        subtitle: "Contactez-nous pour discuter de votre projet et obtenir des conseils personnalisés",
        btnWhatsapp: "Demander conseil",
        btnGallery: "Voir la galerie →",
        whatsappMessage: "Bonjour Tableaux Muraux ! Je souhaite des conseils sur le choix du matériau pour mon tableau."
      },
      footer: {
        brandName: "Tableaux",
        brandExtension: " Muraux",
        desc: "Art mural artisanal, co-créé par IA et fabriqué à la main à Marrakech",
        copyright: "© 2026 Tableaux Muraux. Tous droits réservés.",
        socialStudioLink: "Social Studio"
      }
    },

    // ═══════════════════════════════════════════════════════════
    // 2. PAGE PROCESSUS (process.html)
    // ═══════════════════════════════════════════════════════════
    process: {
      meta: {
        title: "Notre Processus Créatif | Tableaux Muraux",
        description: "Découvrez notre processus créatif unique : co-création IA + artisanat marocain. De l'idée à l'œuvre d'art murale."
      },
      nav: {
        brandName: "Tableaux",
        brandExtension: " Muraux",
        linkProcess: "Notre Processus",
        linkMaterials: "Matériaux",
        linkGallery: "Galerie",
        btnOrder: "Commander"
      },
      hero: {
        title: "Notre Processus Créatif",
        subtitle: "De l'idée à l'œuvre d'art : comment nous créons des tableaux uniques alliant technologie de pointe et savoir-faire artisanal marocain",
        breadcrumbHome: "Accueil",
        breadcrumbCurrent: "Notre Processus"
      },
      step1: {
        number: "1",
        visual: "images/Co-Conception.jpg",
        title: "Co-Conception Numérique avec IA",
        desc: "Chaque œuvre commence par une collaboration unique entre l'intelligence créative humaine et les technologies de pointe en génération artistique. Nos artistes guident des modèles d'IA avancés pour créer des compositions originales.",
        features: [
          { icon: "🎨", title: "Direction artistique humaine", desc: "Nos artistes définissent le concept, le style et la palette de couleurs" },
          { icon: "🤖", title: "Génération par IA avancée", desc: "Utilisation de modèles de dernière génération (DALL-E, Midjourney, Stable Diffusion)" },
          { icon: "✨", title: "Itérations et raffinement", desc: "Plusieurs versions sont créées et affinées jusqu'à obtenir l'œuvre parfaite" },
          { icon: "🇲🇦", title: "Inspirations marocaines", desc: "Motifs, couleurs et thèmes inspirés de la richesse culturelle du Maroc" }
        ]
      },
      step2: {
        number: "2",
        visual: "images/Imprimante_ local1.jpg",
        title: "Impression Premium",
        desc: "Une fois l'œuvre validée, elle est imprimée sur des supports de qualité professionnelle. Nous utilisons exclusivement des matériaux haut de gamme pour garantir des couleurs éclatantes et une durabilité exceptionnelle.",
        features: [
          { icon: "✨", title: "Bâche Oragite® brillante", desc: "Qualité professionnelle avec couleurs vibrantes et résistance aux UV" },
          { icon: "🎨", title: "Toile canvas artistique", desc: "Texture traditionnelle pour un rendu authentique de galerie d'art" },
          { icon: "🖨️", title: "Impression haute résolution", desc: "Technologie d'impression de dernière génération pour une netteté parfaite" }
        ]
      },
      step3: {
        number: "3",
        visual: "images/Atelier_ menuiserie1.jpg",
        title: "Fabrication Artisanale",
        desc: "La touche finale est apportée par nos artisans de Marrakech. Chaque cadre est réalisé à la main avec un savoir-faire traditionnel, garantissant une qualité exceptionnelle et une attention aux détails incomparable.",
        features: [
          { icon: "🪵", title: "Bois massif sélectionné", desc: "Choix minutieux des meilleures essences de bois pour chaque cadre" },
          { icon: "🔨", title: "Fabrication à la main", desc: "Chaque cadre est assemblé et fini manuellement par nos artisans" },
          { icon: "📐", title: "Multiples formes disponibles", desc: "Rectangulaire, carré, panoramique ou sur mesure selon vos besoins" },
          { icon: "✅", title: "Contrôle qualité rigoureux", desc: "Chaque tableau est inspecté avant expédition pour garantir la perfection" }
        ]
      },
      transparency: {
        title: "Notre Engagement de Transparence",
        subtitle: "Nous croyons en l'honnêteté envers nos clients. Voici ce qui nous distingue.",
        goodTitle: "✅ Notre approche transparente",
        goodItems: [
          "Nous informons clairement que nos œuvres sont co-créées avec l'IA",
          "Nous expliquons en détail notre processus créatif",
          "Nous valorisons le travail artisanal humain (cadres, finitions)",
          "Nous utilisons des matériaux premium de marques reconnues",
          "Nous offrons un service client réactif et personnalisé",
          "Nous garantissons la qualité et la satisfaction client"
        ],
        badTitle: "❌ Ce que nous ne faisons PAS",
        badItems: [
          "Nous ne prétendons pas que nos œuvres sont 100% faites à la main",
          "Nous ne cachons pas l'utilisation de l'IA dans le processus créatif",
          "Nous ne vendons pas de simples impressions digitales sans valeur ajoutée",
          "Nous n'utilisons pas de matériaux de qualité inférieure",
          "Nous ne faisons pas de promesses que nous ne pouvons pas tenir",
          "Nous ne négligeons pas le service après-vente"
        ]
      },
      stats: {
        stat1: { value: "100%", label: "Artisanat marocain pour les cadres" },
        stat2: { value: "50+", label: "Créations uniques réalisées" },
        stat3: { value: "⭐ 5/5", label: "Satisfaction client" },
        stat4: { value: "72h", label: "Délai de production moyen" }
      },
      cta: {
        title: "Prêt à créer votre tableau unique ?",
        subtitle: "Contactez-nous sur WhatsApp pour discuter de votre projet et obtenir un devis personnalisé",
        btnWhatsapp: "Discuter sur WhatsApp",
        btnGallery: "Voir la galerie →",
        whatsappMessage: "Bonjour Tableaux Muraux ! Je souhaite discuter d'un projet de tableau personnalisé."
      },
      footer: {
        brandName: "Tableaux",
        brandExtension: " Muraux",
        desc: "Art mural artisanal, co-créé par IA et fabriqué à la main à Marrakech",
        copyright: "© 2026 Tableaux Muraux. Tous droits réservés.",
        socialStudioLink: "Social Studio"
      }
    },

    // ═══════════════════════════════════════════════════════════
    // 3. PAGE CONFIDENTIALITÉ (privacy.html)
    // ═══════════════════════════════════════════════════════════
    privacy: {
      meta: {
        title: "Politique de Confidentialité - Tableaux Muraux",
        description: "Politique de confidentialité de Tableaux Muraux - Art mural artisanal co-créé par IA et fabriqué à Marrakech"
      },
      nav: {
        brandName: "Tableaux Muraux Marrakech",
        linkHome: "Accueil",
        linkProcess: "Notre Processus",
        linkMaterials: "Matériaux",
        linkGallery: "Galerie",
        linkPrivacy: "Confidentialité"
      },
      header: {
        title: "Politique de Confidentialité",
        updateDate: "Dernière mise à jour : 19 août 2026"
      },
      intro: {
        title: "Introduction",
        text: "Chez <strong>Tableaux Muraux Marrakech</strong>, nous respectons votre vie privée et nous engageons à protéger vos données personnelles. Cette politique explique comment nous collectons, utilisons et protégeons vos informations lorsque vous visitez notre site, passez commande ou interagissez avec nous via WhatsApp et nos réseaux sociaux."
      },
      section1: {
        title: "1. Collecte des données",
        introText: "Tableaux Muraux Marrakech collecte les données personnelles que vous nous fournissez directement, notamment via WhatsApp, nos formulaires ou nos réseaux sociaux :",
        items: [
          "Nom et prénom",
          "Numéro de téléphone (WhatsApp)",
          "Adresse email (si fournie)",
          "Adresse de livraison (pour les commandes)",
          "Préférences et demandes spécifiques concernant vos tableaux",
          "Historique de nos échanges pour assurer un suivi personnalisé"
        ],
        paymentNote: "💳 Informations de paiement :",
        paymentText: "Nous ne stockons <strong>jamais</strong> vos informations bancaires. Les paiements sont traités de manière sécurisée par nos processeurs de paiement certifiés (virement bancaire, paiement à la livraison, ou plateformes sécurisées)."
      },
      section2: {
        title: "2. Utilisation des données",
        introText: "Vos données sont utilisées pour :",
        items: [
          "Traiter et expédier vos commandes de tableaux muraux",
          "Communiquer avec vous concernant vos commandes (suivi, livraison)",
          "Personnaliser vos créations selon vos préférences (dimensions, couleurs, style)",
          "Améliorer nos services et votre expérience client",
          "Vous envoyer des informations sur nos nouvelles collections (avec votre consentement)",
          "Répondre à vos questions via WhatsApp, email ou réseaux sociaux"
        ]
      },
      section3: {
        title: "3. Partage des données",
        introText: "<strong>Nous ne vendons jamais vos données personnelles.</strong> Nous pouvons les partager uniquement avec :",
        items: [
          "<strong>Nos prestataires de livraison</strong> (pour acheminer vos tableaux)",
          "<strong>Nos processeurs de paiement</strong> (uniquement pour finaliser les transactions)",
          "<strong>Les autorités compétentes</strong> si la loi l'exige"
        ]
      },
      section4: {
        title: "4. Transparence sur l'utilisation de l'IA",
        boxTitle: "🤖 Co-création artistique",
        boxIntro: "Chez Tableaux Muraux, nos œuvres sont le fruit d'une <strong>co-création entre intelligence artificielle et artisanat humain</strong> :",
        boxItems: [
          "<strong>Conception numérique :</strong> Nos artistes guident des modèles d'IA pour créer des compositions originales",
          "<strong>Impression premium :</strong> Sur bâche Oragite® brillante ou toile canvas",
          "<strong>Fabrication artisanale :</strong> Cadres en bois réalisés à la main par nos artisans de Marrakech"
        ],
        boxNote: "Les données que vous nous fournissez pour personnaliser vos œuvres (thèmes, couleurs, dimensions) sont utilisées <strong>uniquement</strong> pour guider ce processus créatif et ne sont jamais partagées avec des tiers à des fins d'entraînement d'IA."
      },
      section5: {
        title: "5. Vos droits (RGPD)",
        introText: "Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :",
        items: [
          "<strong>Droit d'accès</strong> à vos données personnelles",
          "<strong>Droit de rectification</strong> des données inexactes",
          "<strong>Droit à l'effacement</strong> (\"droit à l'oubli\")",
          "<strong>Droit à la portabilité</strong> de vos données",
          "<strong>Droit d'opposition</strong> au traitement de vos données",
          "<strong>Droit de retirer votre consentement</strong> à tout moment"
        ],
        contactNote: "Pour exercer ces droits, contactez-nous simplement via WhatsApp. Nous répondrons dans un délai de 30 jours maximum."
      },
      section6: {
        title: "6. Conservation des données",
        introText: "Nous conservons vos données personnelles :",
        items: [
          "<strong>Données de commande :</strong> 3 ans (obligation comptable)",
          "<strong>Échanges WhatsApp :</strong> Aussi longtemps que nécessaire pour le suivi client",
          "<strong>Inscriptions marketing :</strong> Jusqu'à votre désinscription"
        ]
      },
      section7: {
        title: "7. Cookies et traceurs",
        text: "Notre site utilise uniquement des cookies essentiels au fonctionnement (préférences de langue, filtres). Nous n'utilisons pas de cookies publicitaires ni de traceurs tiers sans votre consentement explicite."
      },
      section8: {
        title: "8. Sécurité des données",
        introText: "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données :",
        items: [
          "Communication HTTPS sécurisée",
          "Accès restreint aux données sensibles",
          "Formation de notre équipe sur la protection des données"
        ]
      },
      section9: {
        title: "9. Modifications de cette politique",
        text: "Nous nous réservons le droit de mettre à jour cette politique. Toute modification sera publiée sur cette page avec une nouvelle date de mise à jour. Nous vous encourageons à la consulter régulièrement."
      },
      contactBox: {
        title: "📞 Nous contacter",
        text: "Pour toute question concernant cette politique de confidentialité ou vos données personnelles :",
        whatsappLabel: "WhatsApp",
        instagramLabel: "Instagram",
        facebookLabel: "Facebook",
        pinterestLabel: "Pinterest",
        address: "📍 Adresse : Marrakech, Maroc",
        whatsappMessage: "Bonjour Tableaux Muraux ! J'ai une question concernant la politique de confidentialité."
      },
      cta: {
        btnGallery: "Voir la galerie →"
      },
      footer: {
        copyright: "© 2026 Tableaux Muraux - Art mural artisanal co-créé par IA",
        tagline: "Conçu et fabriqué avec ❤️ à Marrakech",
        socialStudioLink: "Social Studio"
      }
    },

    // ═══════════════════════════════════════════════════════════
    // 4. PAGE SOCIAL STUDIO (social.html)
    // ═══════════════════════════════════════════════════════════
    social: {
      meta: {
        title: "Social Media Studio | Tableaux Muraux",
        description: "Module de gestion éditoriale et de publication réseaux sociaux pour Tableaux Muraux."
      },
      header: {
        brandName: "Tableaux",
        brandExtension: " Muraux",
        moduleName: "Social Media Studio",
        statusBadge: "Mode Local"
      },
      sidebar: {
        title: "Social Studio",
        subtitle: "Tableaux Muraux v3.1",
        tabs: {
          dashboard: "Tableau de bord",
          accounts: "Comptes Réseaux",
          composer: "Créateur de Post",
          calendar: "Calendrier",
          media: "Médiathèque",
          posts: "Publications",
          analytics: "Analytique"
        }
      },
      dashboard: {
        title: "Vue d'ensemble",
        subtitle: "Performances globales et prochaines parutions",
        btnNewPost: "+ Nouveau Post",
        upcomingTitle: "⏳ Prochaines publications programmées"
      },
      accounts: {
        title: "Comptes Réseaux Sociaux",
        subtitle: "Statut des connexions et synchronisation simulée",
        btnSyncAll: "🔄 Tout synchroniser"
      },
      composer: {
        title: "Composer une Publication",
        subtitle: "Rédigez, choisissez vos visuels et visualisez l'aperçu en temps réel",
        targetPlatformsLabel: "Réseaux cibles",
        titleLabel: "Titre de travail / Objet interne",
        titlePlaceholder: "Ex: Focus Collection Patio...",
        imageLabel: "Visuel associé",
        galleryHelper: "Ou cliquez directement sur un produit de la galerie",
        textLabel: "Texte de la publication",
        textPlaceholder: "Rédigez la légende de votre publication...",
        hashtagsLabel: "Suggestions de Hashtags",
        dateLabel: "Date & Heure de planification",
        btnDraft: "💾 Enregistrer Brouillon",
        btnSchedule: "⏰ Programmer",
        btnPublish: "🚀 Publier Immédiatement",
        previewTitle: "Aperçu en temps réel",
        previewDefaultText: "Votre texte apparaîtra ici en temps réel..."
      },
      calendar: {
        title: "Calendrier Éditorial",
        subtitle: "Planning mensuel des publications prévues",
        btnPrev: "◀ Précédent",
        btnNext: "Suivant ▶",
        days: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
      },
      media: {
        title: "Médiathèque Visuelle",
        subtitle: "Catalogue de créations et visuels d'atelier disponibles",
        filterAll: "Tous les médias",
        filterCatalogue: "Catalogue Produits",
        filterAtelier: "Atelier & Coulisses",
        filterAmbiance: "Ambiances"
      },
      posts: {
        title: "Historique des Publications",
        subtitle: "Brouillons, parutions actives et programmées",
        filterAll: "Tous les statuts",
        filterPublished: "Publiés",
        filterScheduled: "Programmés",
        filterDraft: "Brouillons"
      },
      analytics: {
        title: "Analytique des Publications",
        subtitle: "Performance moyenne par format et meilleurs créneaux horaires",
        bestHoursTitle: "🕒 Meilleurs créneaux de publication",
        topPostsTitle: "🏆 Top 3 des publications les plus engageantes"
      },
      footer: {
        brandName: "Tableaux",
        brandExtension: " Muraux",
        desc: "Module de gestion sociale Tableaux Muraux Marrakech",
        copyright: "© 2026 Tableaux Muraux. Tous droits réservés.",
        secretLink: "Social Studio"
      }
    }
  }
};

// Export universel pour garantir l'accès direct et via window
if (typeof window !== 'undefined') {
  window.CONTENU_SITE = CONTENU_SITE;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONTENU_SITE;
}

