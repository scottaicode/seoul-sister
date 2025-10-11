/**
 * Korean Product Database
 * Comprehensive database of trending Korean beauty products
 * Used when APIs are unavailable or for demo purposes
 */

export interface KoreanProduct {
  name: string
  brand: string
  category: string
  seoul_price: number
  us_price: number
  description: string
  image_url: string
  rating: number
  review_count: number
  trend_score: number
  skin_type: string
  key_ingredients: string[]
  viral_factor: number
}

// Comprehensive Korean beauty product database
export const KOREAN_BEAUTY_PRODUCTS: KoreanProduct[] = [
  // COSRX Products
  {
    name: "Snail 96 Mucin Power Essence",
    brand: "COSRX",
    category: "Essence",
    seoul_price: 13,
    us_price: 25,
    description: "Lightweight essence with 96% snail secretion filtrate for hydration and repair",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.6,
    review_count: 15420,
    trend_score: 95,
    skin_type: "all",
    key_ingredients: ["Snail Secretion Filtrate", "Betaine", "Panthenol"],
    viral_factor: 98
  },
  {
    name: "Advanced Snail 92 All in One Cream",
    brand: "COSRX",
    category: "Moisturizer",
    seoul_price: 16,
    us_price: 35,
    description: "All-in-one cream with 92% snail mucin for intensive moisture and healing",
    image_url: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908",
    rating: 4.5,
    review_count: 8930,
    trend_score: 88,
    skin_type: "dry,sensitive",
    key_ingredients: ["Snail Secretion Filtrate", "Hyaluronic Acid", "Arginine"],
    viral_factor: 85
  },
  {
    name: "Low pH Good Morning Gel Cleanser",
    brand: "COSRX",
    category: "Cleanser",
    seoul_price: 11,
    us_price: 18,
    description: "Gentle morning cleanser with low pH and BHA for oily skin",
    image_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b",
    rating: 4.4,
    review_count: 12560,
    trend_score: 82,
    skin_type: "oily,combination",
    key_ingredients: ["Tea Tree Oil", "BHA", "Betaine Salicylate"],
    viral_factor: 75
  },

  // Beauty of Joseon
  {
    name: "Glow Deep Serum",
    brand: "Beauty of Joseon",
    category: "Serum",
    seoul_price: 16,
    us_price: 45,
    description: "Alpha arbutin and niacinamide serum for brightening and dark spots",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    rating: 4.7,
    review_count: 9874,
    trend_score: 92,
    skin_type: "all",
    key_ingredients: ["Alpha Arbutin", "Niacinamide", "Hyaluronic Acid"],
    viral_factor: 94
  },
  {
    name: "Red Bean Water Gel",
    brand: "Beauty of Joseon",
    category: "Moisturizer",
    seoul_price: 14,
    us_price: 28,
    description: "Lightweight gel moisturizer with red bean extract for oily skin",
    image_url: "https://images.unsplash.com/photo-1556228578-8c89e6adf883",
    rating: 4.5,
    review_count: 6542,
    trend_score: 85,
    skin_type: "oily,combination",
    key_ingredients: ["Red Bean Extract", "Peptides", "Hyaluronic Acid"],
    viral_factor: 78
  },
  {
    name: "Relief Sun Rice + Probiotics SPF50+",
    brand: "Beauty of Joseon",
    category: "Sunscreen",
    seoul_price: 15,
    us_price: 35,
    description: "Chemical sunscreen with rice bran and probiotics for sensitive skin",
    image_url: "https://images.unsplash.com/photo-1556760544-74068565f05c",
    rating: 4.8,
    review_count: 11230,
    trend_score: 96,
    skin_type: "sensitive,all",
    key_ingredients: ["Rice Bran Extract", "Probiotics", "Zinc Oxide"],
    viral_factor: 92
  },

  // Laneige
  {
    name: "Water Sleeping Mask",
    brand: "Laneige",
    category: "Mask",
    seoul_price: 15,
    us_price: 34,
    description: "Overnight hydrating mask with Hydro Ionized Mineral Water",
    image_url: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908",
    rating: 4.4,
    review_count: 18950,
    trend_score: 89,
    skin_type: "dry,all",
    key_ingredients: ["Hydro Ionized Mineral Water", "Evening Primrose", "Hunza Apricot"],
    viral_factor: 88
  },
  {
    name: "Cream Skin Toner & Moisturizer",
    brand: "Laneige",
    category: "Toner",
    seoul_price: 22,
    us_price: 45,
    description: "2-in-1 toner and moisturizer with White Tea Extract",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.3,
    review_count: 7643,
    trend_score: 79,
    skin_type: "dry,normal",
    key_ingredients: ["White Tea Extract", "Ceramides", "Amino Acids"],
    viral_factor: 72
  },

  // Torriden
  {
    name: "DIVE-IN Low Molecule Hyaluronic Acid Serum",
    brand: "Torriden",
    category: "Serum",
    seoul_price: 18,
    us_price: 78,
    description: "5 types of hyaluronic acid for deep hydration",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    rating: 4.6,
    review_count: 5432,
    trend_score: 91,
    skin_type: "dry,dehydrated",
    key_ingredients: ["5 Types Hyaluronic Acid", "Panthenol", "Allantoin"],
    viral_factor: 87
  },
  {
    name: "DIVE-IN Low Molecule Hyaluronic Acid Toner",
    brand: "Torriden",
    category: "Toner",
    seoul_price: 16,
    us_price: 65,
    description: "Hydrating toner with low molecular weight hyaluronic acid",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.5,
    review_count: 4321,
    trend_score: 88,
    skin_type: "dry,all",
    key_ingredients: ["Low Molecular Hyaluronic Acid", "Beta-Glucan", "Trehalose"],
    viral_factor: 83
  },

  // Some By Mi
  {
    name: "Red Tea Tree Spot Oil",
    brand: "Some By Mi",
    category: "Treatment",
    seoul_price: 12,
    us_price: 25,
    description: "Targeted spot treatment with red tea tree for acne",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    rating: 4.7,
    review_count: 3254,
    trend_score: 86,
    skin_type: "acne-prone,oily",
    key_ingredients: ["Red Tea Tree Extract", "Centella Asiatica", "Niacinamide"],
    viral_factor: 81
  },
  {
    name: "30 Days Miracle Toner",
    brand: "Some By Mi",
    category: "Toner",
    seoul_price: 14,
    us_price: 28,
    description: "AHA BHA PHA toner for acne-prone skin",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.3,
    review_count: 6789,
    trend_score: 83,
    skin_type: "acne-prone,oily",
    key_ingredients: ["AHA", "BHA", "PHA", "Tea Tree Extract"],
    viral_factor: 76
  },

  // Round Lab
  {
    name: "1025 Dokdo Toner",
    brand: "Round Lab",
    category: "Toner",
    seoul_price: 17,
    us_price: 38,
    description: "Gentle toner with Ulleungdo deep sea water for sensitive skin",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.6,
    review_count: 8974,
    trend_score: 90,
    skin_type: "sensitive,all",
    key_ingredients: ["Ulleungdo Deep Sea Water", "Panthenol", "Allantoin"],
    viral_factor: 85
  },
  {
    name: "Birch Juice Moisturizing Cream",
    brand: "Round Lab",
    category: "Moisturizer",
    seoul_price: 19,
    us_price: 42,
    description: "Lightweight moisturizer with birch juice for hydration",
    image_url: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908",
    rating: 4.4,
    review_count: 5643,
    trend_score: 87,
    skin_type: "dry,normal",
    key_ingredients: ["Birch Juice", "Hyaluronic Acid", "Ceramides"],
    viral_factor: 79
  },

  // Anua
  {
    name: "Heartleaf 77% Soothing Toner",
    brand: "Anua",
    category: "Toner",
    seoul_price: 13,
    us_price: 29,
    description: "Soothing toner with 77% heartleaf extract for irritated skin",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.7,
    review_count: 4567,
    trend_score: 94,
    skin_type: "sensitive,acne-prone",
    key_ingredients: ["Heartleaf Extract", "Centella Asiatica", "Panthenol"],
    viral_factor: 91
  },
  {
    name: "Heartleaf 80% Soothing Ampoule",
    brand: "Anua",
    category: "Serum",
    seoul_price: 16,
    us_price: 35,
    description: "Concentrated ampoule with 80% heartleaf for acne care",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    rating: 4.8,
    review_count: 3421,
    trend_score: 96,
    skin_type: "acne-prone,sensitive",
    key_ingredients: ["Heartleaf Extract", "Centella Asiatica", "Madecassoside"],
    viral_factor: 93
  },

  // Innisfree
  {
    name: "Green Tea Seed Serum",
    brand: "Innisfree",
    category: "Serum",
    seoul_price: 20,
    us_price: 45,
    description: "Antioxidant serum with Jeju green tea for hydration",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    rating: 4.4,
    review_count: 7890,
    trend_score: 81,
    skin_type: "all",
    key_ingredients: ["Green Tea Extract", "Hyaluronic Acid", "Ceramides"],
    viral_factor: 74
  },
  {
    name: "Volcanic Pore Clay Mask",
    brand: "Innisfree",
    category: "Mask",
    seoul_price: 12,
    us_price: 22,
    description: "Deep cleansing clay mask with Jeju volcanic clay",
    image_url: "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908",
    rating: 4.3,
    review_count: 12340,
    trend_score: 77,
    skin_type: "oily,acne-prone",
    key_ingredients: ["Volcanic Clay", "AHA", "Walnut Shell Powder"],
    viral_factor: 69
  },

  // Klairs
  {
    name: "Supple Preparation Facial Toner",
    brand: "Klairs",
    category: "Toner",
    seoul_price: 18,
    us_price: 34,
    description: "Alcohol-free toner with plant extracts for sensitive skin",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.5,
    review_count: 9876,
    trend_score: 84,
    skin_type: "sensitive,all",
    key_ingredients: ["Centella Asiatica", "Phyto-Oligo", "Beta-Glucan"],
    viral_factor: 78
  },
  {
    name: "Freshly Juiced Vitamin C Serum",
    brand: "Klairs",
    category: "Serum",
    seoul_price: 22,
    us_price: 48,
    description: "Gentle vitamin C serum with 5% ascorbic acid",
    image_url: "https://images.unsplash.com/photo-1617897094665-d019c0ac14f5",
    rating: 4.2,
    review_count: 5432,
    trend_score: 79,
    skin_type: "dull,all",
    key_ingredients: ["Ascorbic Acid", "Centella Asiatica", "Yuja Extract"],
    viral_factor: 72
  },

  // Etude House
  {
    name: "SoonJung pH 6.5 Whip Cleanser",
    brand: "Etude House",
    category: "Cleanser",
    seoul_price: 8,
    us_price: 16,
    description: "Gentle whip cleanser with pH 6.5 for sensitive skin",
    image_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b",
    rating: 4.6,
    review_count: 11234,
    trend_score: 86,
    skin_type: "sensitive,all",
    key_ingredients: ["Panthenol", "Madecassoside", "Amino Acids"],
    viral_factor: 82
  },

  // Missha
  {
    name: "Time Revolution First Treatment Essence",
    brand: "Missha",
    category: "Essence",
    seoul_price: 25,
    us_price: 62,
    description: "Fermented yeast essence for anti-aging and radiance",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.3,
    review_count: 8765,
    trend_score: 75,
    skin_type: "mature,all",
    key_ingredients: ["Fermented Yeast Extract", "Niacinamide", "Adenosine"],
    viral_factor: 68
  },

  // I'm From
  {
    name: "Mugwort Essence",
    brand: "I'm From",
    category: "Essence",
    seoul_price: 24,
    us_price: 58,
    description: "Soothing essence with 100% mugwort extract from Ganghwa",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.7,
    review_count: 3456,
    trend_score: 89,
    skin_type: "sensitive,acne-prone",
    key_ingredients: ["Mugwort Extract", "Centella Asiatica", "Panthenol"],
    viral_factor: 86
  },
  {
    name: "Rice Toner",
    brand: "I'm From",
    category: "Toner",
    seoul_price: 22,
    us_price: 48,
    description: "Brightening toner with 77.78% rice bran extract",
    image_url: "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a",
    rating: 4.5,
    review_count: 4321,
    trend_score: 87,
    skin_type: "dull,dry",
    key_ingredients: ["Rice Bran Extract", "Alpha Arbutin", "Niacinamide"],
    viral_factor: 81
  }
]

// Get trending products by category
export function getTrendingByCategory(category: string, limit: number = 5): KoreanProduct[] {
  return KOREAN_BEAUTY_PRODUCTS
    .filter(p => p.category.toLowerCase() === category.toLowerCase())
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, limit)
}

// Get viral products (high viral factor)
export function getViralProducts(limit: number = 10): KoreanProduct[] {
  return KOREAN_BEAUTY_PRODUCTS
    .filter(p => p.viral_factor > 80)
    .sort((a, b) => b.viral_factor - a.viral_factor)
    .slice(0, limit)
}

// Get products by brand
export function getProductsByBrand(brand: string): KoreanProduct[] {
  return KOREAN_BEAUTY_PRODUCTS
    .filter(p => p.brand.toLowerCase() === brand.toLowerCase())
    .sort((a, b) => b.trend_score - a.trend_score)
}

// Get products by skin type
export function getProductsBySkinType(skinType: string, limit: number = 10): KoreanProduct[] {
  return KOREAN_BEAUTY_PRODUCTS
    .filter(p => p.skin_type.includes(skinType.toLowerCase()) || p.skin_type === 'all')
    .sort((a, b) => b.trend_score - a.trend_score)
    .slice(0, limit)
}

// Get random trending products
export function getRandomTrendingProducts(count: number = 10): KoreanProduct[] {
  const highTrendProducts = KOREAN_BEAUTY_PRODUCTS
    .filter(p => p.trend_score > 80)
    .sort(() => Math.random() - 0.5)

  return highTrendProducts.slice(0, count)
}

// Calculate savings percentage
export function calculateSavings(seoulPrice: number, usPrice: number): number {
  return Math.round(((usPrice - seoulPrice) / usPrice) * 100)
}

// Get products with highest savings
export function getHighestSavingsProducts(limit: number = 10): KoreanProduct[] {
  return KOREAN_BEAUTY_PRODUCTS
    .map(p => ({
      ...p,
      savings_percentage: calculateSavings(p.seoul_price, p.us_price)
    }))
    .sort((a, b) => b.savings_percentage - a.savings_percentage)
    .slice(0, limit)
}