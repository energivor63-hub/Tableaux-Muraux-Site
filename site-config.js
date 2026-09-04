// ============================================
// CONFIGURATION DU SITE - Tableaux Muraux
// ============================================
// ⚠️ IMPORTANT : Ce fichier est une référence technique.
// Pour modifier le contenu du site, utilisez UNIQUEMENT `contenu.js`.
// Ce fichier (site-config.js) est conservé pour compatibilité et documentation.
//
// Dernière mise à jour : 27 août 2026
// Version : 2.3

const SITE_CONFIG = {
    // ========================================
    // INFORMATIONS GÉNÉRALES
    // ========================================
    brand: {
        name: "Tableaux Muraux",
        nom: "Tableaux",
        extension: "Muraux",
        slogan: "L'art mural nouvelle génération, fabriqué à Marrakech",
        description: "Tableaux muraux artisanaux co-créés par IA et fabriqués à la main à Marrakech",
        logo: "Tableaux",
        logoSuffix: "Muraux",
        year: 2026,
        location: "Marrakech, Maroc",
        transparency: "Co-création IA + Artisanat"
    },

    // ========================================
    // CONTACT (Le numéro est caché côté site)
    // ========================================
    contact: {
        whatsapp: {
            number: "212648620364",  // Format international sans +
            trackingPrefix: "🌐 [SITE WEB]",
            trackingMessage: "🌐 [SITE WEB] Bonjour Tableaux Muraux ! Je viens de votre site web et je suis intéressé(e) par vos tableaux muraux.",
            displayLabel: "Contactez-nous sur WhatsApp",  // Texte affiché (sans numéro)
            officialColor: "#25D366"
        },
        instagram: {
            username: "ideawoven.marrakech",
            url: "https://instagram.com/ideawoven.marrakech",
            label: "Instagram"
        },
        facebook: {
            name: "Tableaux Muraux Marrakech",
            pageId: "952942547902065",
            url: "https://facebook.com/profile.php?id=952942547902065",
            label: "Facebook"
        },
        pinterest: {
            name: "Tableaux Muraux Art",
            username: "tableauxmuraux_art",
            url: "https://pinterest.com/tableauxmuraux_art",
            label: "Pinterest"
        },
        website: {
            url: "https://energivor63-hub.github.io/Tableaux-Muraux-Site",
            label: "Site web"
        }
    },

    // ========================================
    // CHARTE GRAPHIQUE
    // ========================================
    colors: {
        primary: "#C65D3B",         // Terracotta (principal)
        primaryDark: "#A84A2D",     // Terracotta foncé (actif)
        secondary: "#2C3E50",       // Bleu foncé
        accent: "#D4A574",          // Beige doré
        dark: "#1a1a1a",            // Texte principal
        light: "#F8F5F0",           // Fond clair
        gray: "#6B7280",            // Gris
        success: "#10B981",         // Vert succès
        gold: "#D4AF37",            // Or (premium)
        whatsapp: "#25D366"         // Vert WhatsApp officiel
    },

    fonts: {
        titles: "'Playfair Display', serif",
        body: "'Inter', sans-serif"
    },

    // ========================================
    // SECTION HERO
    // ========================================
    hero: {
        badges: [
            { icon: "🤖", text: "Co-création IA" },
            { icon: "🇲🇦", text: "Made in Marrakech" },
            { icon: "✨", text: "Premium" }
        ],
        titleBefore: "L'art mural",
        titleHighlight: "réinventé",
        titleAfter: "à Marrakech",
        description: "Des tableaux uniques, co-créés par l'intelligence artificielle et fabriqués à la main par nos artisans. Impression premium sur bâche Oragite® et toile canvas, encadrement artisanal en bois.",
        primaryButton: "Découvrir la collection →",
        secondaryButton: "Notre processus"
    },

    // ========================================
    // SECTION PROCESSUS (3 étapes)
    // Note : L'étape "Traitement protecteur" a été supprimée
    // ========================================
    process: {
        sectionTag: "Notre Processus",
        title: "De l'idée à l'œuvre d'art",
        subtitle: "Un processus unique alliant technologie de pointe et savoir-faire artisanal marocain",
        steps: [
            {
                number: 1,
                icon: "🤖",
                title: "Conception IA",
                description: "Nos artistes guident des modèles d'IA avancés pour créer des compositions originales, inspirées par la richesse visuelle du Maroc et les tendances contemporaines.",
                linkText: "En savoir plus →",
                linkUrl: "process.html"
            },
            {
                number: 2,
                icon: "🖨️",
                title: "Impression Premium",
                description: "Chaque œuvre est imprimée sur bâche brillante Oragite® (qualité muséale) ou sur toile canvas artistique, pour des couleurs éclatantes et durables.",
                linkText: "Voir les matériaux →",
                linkUrl: "materials.html"
            },
            {
                number: 3,
                icon: "🪵",
                title: "Fabrication Artisanale",
                description: "Nos artisans de Marrakech réalisent à la main les cadres en bois massif, avec des finitions soignées et un montage expert pour une qualité exceptionnelle.",
                linkText: "Nous contacter →",
                linkUrl: "#contact"
            }
        ]
    },

    // ========================================
    // SECTION MATÉRIAUX
    // Note : "Résistance aux UV" remplacé par "Résistance"
    // ========================================
    materials: {
        sectionTag: "Qualité Premium",
        title: "Des matériaux d'exception",
        subtitle: "Nous sélectionnons les meilleurs matériaux pour garantir la beauté et la longévité de vos tableaux",
        items: [
            {
                icon: "✨",
                title: "Bâche Oragite®",
                description: "Impression sur bâche brillante de qualité muséale, offrant des couleurs vibrantes et une netteté exceptionnelle.",
                price: "À partir de xxxx MAD",  // xxxx = masqué
                features: [
                    "Couleurs éclatantes et durables",
                    "Résistance",              // Pas "Résistance aux UV"
                    "Finition brillante premium",
                    "Qualité muséale",
                    "Facile à nettoyer"
                ]
            },
            {
                icon: "🎨",
                title: "Toile Canvas",
                description: "Toile canvas artistique de haute qualité, offrant une texture traditionnelle et un rendu authentique.",
                price: "À partir de xxxx MAD",  // xxxx = masqué
                features: [
                    "Texture naturelle du tissu",
                    "Rendu artistique authentique",
                    "Résistance au temps",
                    "Aspect galerie d'art",
                    "Montage sur châssis bois"
                ]
            },
            {
                icon: "🪵",
                title: "Cadres en Bois",
                description: "Cadres réalisés à la main par nos artisans de Marrakech, en bois massif de qualité.",
                features: [
                    "Bois massif sélectionné",
                    "Fabrication artisanale",
                    "Multiples formes disponibles",
                    "Finitions soignées",
                    "Sur mesure possible"
                ]
            }
        ]
    },

    // ========================================
    // SECTION FINITIONS
    // ========================================
    finishes: {
        sectionTag: "Finitions",
        title: "Options de montage",
        subtitle: "Choisissez la finition qui correspond à votre style",
        options: [
            {
                icon: "🖼️",
                title: "Toile Tendue sur Cadre",
                features: ["Prêt à accrocher", "Aspect galerie", "Légèreté", "Idéal canvas"]
            },
            {
                icon: "🎨",
                title: "Cadre Américain (Flottant)",
                features: ["Design contemporain", "Effet flottant", "Protection", "Idéal Oragite®"]
            },
            {
                icon: "📏",
                title: "Dimensions sur Mesure",
                sizes: [
                    "Petit : 30×40 cm, 40×50 cm",
                    "Standard : 50×70 cm, 60×80 cm",
                    "Grand : 80×120 cm, 100×150 cm",
                    "Panoramique : sur demande"
                ]
            }
        ]
    },

    // ========================================
    // GALERIE DE PRODUITS
    // ========================================
    gallery: {
        sectionTag: "Notre Collection",
        title: "Découvrez nos créations",
        subtitle: "Des œuvres uniques pour sublimer votre intérieur",

        // ⚠️ IMPORTANT : Les IDs doivent correspondre aux options ci-dessous
        filters: {
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
            styles: [
                { id: "tous", label: "Tous" },
                { id: "contemporain", label: "Contemporain" },
                { id: "traditionnel", label: "Traditionnel" },
                { id: "minimaliste", label: "Minimaliste" },
                { id: "boheme", label: "Bohème" },
                { id: "art-deco", label: "Art Déco" },
                { id: "autres", label: "Autres" }
            ],
            environments: [
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

        // Produits d'exemple (voir contenu.js pour la liste complète)
        products: [
            {
                id: 1,
                name: "Horizon Abstrait",
                description: "Composition abstraite aux tons terracotta et ocre",
                category: "abstrait",
                style: "contemporain",
                environment: "salon",
                image: "images/produit-5.png",
                badge: "Nouveau",
                price: "À partir de xxxx MAD",
                material: "Bâche Oragite®",
                finish: "Cadre Américain",
                colors: ["Terracotta", "Ocre", "Beige"],
                ambiance: "Chaleureuse et moderne"
            },
            {
                id: 2,
                name: "Harmonie Terracotta",
                description: "Composition géométrique minimaliste aux formes triangulaires",
                category: "geometrique",
                style: "minimaliste",
                environment: "riad",
                image: "images/produit-6.jpg",
                badge: "Populaire",
                price: "À partir de xxxx MAD",
                material: "Toile Canvas",
                finish: "Cadre Américain",
                colors: ["Beige", "Terracotta", "Taupe", "Blanc cassé"],
                ambiance: "Zen et contemporaine"
            }
            // ... autres produits dans contenu.js
        ]
    },

    // ========================================
    // TÉMOIGNAGES
    // ========================================
    testimonials: {
        sectionTag: "Témoignages",
        title: "Ce que disent nos clients",
        subtitle: "Des clients satisfaits à Marrakech et partout au Maroc",
        items: [
            {
                stars: 5,
                text: "Un tableau magnifique qui a complètement transformé mon salon. La qualité d'impression sur Oragite est exceptionnelle, les couleurs sont vibrantes !",
                author: "Sarah A.",
                location: "Marrakech",
                initials: "SA"
            },
            {
                stars: 5,
                text: "J'adore le concept de co-création IA + artisanat. Le cadre en bois est superbe et le service client via WhatsApp est très réactif. Je recommande !",
                author: "Karim M.",
                location: "Casablanca",
                initials: "KM"
            },
            {
                stars: 5,
                text: "Offert en cadeau à ma mère, elle a adoré ! Le tableau sur canvas a un rendu vraiment authentique. Livraison rapide et emballage soigné.",
                author: "Fatima B.",
                location: "Rabat",
                initials: "FB"
            },
            {
                stars: 5,
                text: "Excellent travail ! Le tableau reflète parfaitement l'ambiance que je recherchais pour mon riad. Les dimensions personnalisées s'intègrent parfaitement dans l'architecture traditionnelle.",
                author: "Youssef M.",
                location: "Marrakech",
                initials: "YM"
            }
        ]
    },

    // ========================================
    // SECTION CONTACT
    // ========================================
    contactSection: {
        sectionTag: "Contact",
        title: "Commandez votre tableau",
        subtitle: "Contactez-nous directement via WhatsApp pour une réponse rapide",
        heading: "Parlons de votre projet",
        description: "Que vous ayez une idée précise ou besoin de conseils, nous sommes là pour vous accompagner dans la création de votre tableau idéal. Réponse garantie en moins de 2 heures !",
        responseTime: "< 2 heures"
    },

    // ========================================
    // FOOTER
    // ========================================
    footer: {
        description: "Art mural artisanal, co-créé par IA et fabriqué à la main à Marrakech. Des œuvres uniques pour sublimer votre intérieur.",
        copyright: "© 2026 Tableaux Muraux. Tous droits réservés.",
        tagline: "Co-créé par IA 🤖 et fabriqué à la main à Marrakech 🇲🇦",
        links: [
            { label: "Accueil", url: "index.html" },
            { label: "Processus", url: "process.html" },
            { label: "Matériaux", url: "materials.html" },
            { label: "Confidentialité", url: "privacy.html" }
        ]
    },

    // ========================================
    // SEO
    // ========================================
    seo: {
        title: "Tableaux Muraux - Art Mural Artisanal | Tableaux Premium",
        description: "Tableaux Muraux - Tableaux muraux artisanaux créés par IA et fabriqués à la main à Marrakech. Impression premium sur bâche Oragite et toile canvas.",
        keywords: [
            "tableau mural marrakech",
            "art mural maroc",
            "canvas premium",
            "cadre bois artisanal",
            "idée cadeau marrakech",
            "décoration murale",
            "art IA",
            "tableau artisanal",
            "bâche oragite",
            "artisanat marocain"
        ]
    }
};

// ============================================
// FONCTIONS D'AIDE
// ============================================

/**
 * Génère le lien WhatsApp avec tracking automatique
 */
function getWhatsAppLink(customMessage = null) {
    const message = customMessage || SITE_CONFIG.contact.whatsapp.trackingMessage;
    return `https://wa.me/${SITE_CONFIG.contact.whatsapp.number}?text=${encodeURIComponent(message)}`;
}

/**
 * Génère le lien WhatsApp pour commander un produit spécifique
 */
function getProductWhatsAppLink(productName) {
    const message = `${SITE_CONFIG.contact.whatsapp.trackingPrefix} Bonjour Tableaux Muraux ! Je viens de votre site web et je suis intéressé(e) par le tableau "${productName}". Pouvez-vous me donner plus d'informations ?`;
    return `https://wa.me/${SITE_CONFIG.contact.whatsapp.number}?text=${encodeURIComponent(message)}`;
}

/**
 * Initialise la configuration au chargement de la page
 */
function initSiteConfig() {
    console.log("✅ Configuration Tableaux Muraux v2.3 chargée");
    console.log("📝 Pour modifier le contenu, éditez : contenu.js");
    console.log("🌐 Site en ligne : " + SITE_CONFIG.contact.website.url);
}

// Exécuter au chargement de la page
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initSiteConfig);
}

// Export pour Node.js (si utilisé en dehors du navigateur)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SITE_CONFIG, getWhatsAppLink, getProductWhatsAppLink };
}


