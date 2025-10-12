/**
 * Populate Database with Wholesale Products
 * Direct insertion of Korean wholesale pricing data
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Korean wholesale products with authentic Seoul pricing
const WHOLESALE_PRODUCTS = [
  // COSRX Products - True Seoul wholesale prices
  {
    name_korean: '코스알엑스 달팽이 96 뮤신 파워 에센스',
    name_english: 'Snail 96 Mucin Power Essence',
    brand: 'COSRX',
    seoul_price: 7.50,
    us_price: 89,
    category: 'Essence',
    description: 'Lightweight essence with 96% snail secretion filtrate for hydration and repair',
    skin_type: 'All skin types',
    ingredients: 'Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Polyacrylate, Phenoxyethanol, Sodium Hyaluronate, Allantoin, Ethyl Hexanediol, Carbomer, Panthenol, Arginine'
  },
  {
    name_korean: '코스알엑스 어드밴스드 달팽이 92 올인원 크림',
    name_english: 'Advanced Snail 92 All in One Cream',
    brand: 'COSRX',
    seoul_price: 9.20,
    us_price: 35,
    category: 'Moisturizer',
    description: 'All-in-one cream with 92% snail mucin for intensive moisture and healing',
    skin_type: 'Dry, Sensitive',
    ingredients: 'Snail Secretion Filtrate, Betaine, Caprylic/Capric Triglyceride, Butylene Glycol, Cetearyl Olivate, Sorbitan Olivate, Cetearyl Alcohol, Carbomer, Ethyl Hexanediol, Phenoxyethanol, Arginine, Dimethicone, Sodium Polyacrylate, Sodium Hyaluronate, Allantoin, Palmitic Acid, Panthenol, Xanthan Gum, Stearic Acid, Adenosine, Water, Myristic Acid'
  },
  {
    name_korean: '코스알엑스 로우 pH 굿 모닝 젤 클렌저',
    name_english: 'Low pH Good Morning Gel Cleanser',
    brand: 'COSRX',
    seoul_price: 6.30,
    us_price: 18,
    category: 'Cleanser',
    description: 'Gentle morning cleanser with low pH and BHA for oily skin',
    skin_type: 'Oily, Combination',
    ingredients: 'Water, Cocamidopropyl Betaine, Sodium Lauroyl Methyl Isethionate, Sodium Chloride, Polysorbate 20, Styrax Japonicus Branch/Fruit/Leaf Extract, Butylene Glycol, Saccharomyces Ferment, Cryptomeria Japonica Leaf Extract, Nelumbo Nucifera Leaf Extract, Pinus Palustris Leaf Extract, Ulmus Davidiana Root Extract, Oenothera Biennis (Evening Primrose) Flower Extract, Pueraria Lobata Root Extract, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Allantoin, Caprylyl Glycol, Ethylhexylglycerin, Betaine Salicylate, Citric Acid, Ethyl Hexanediol, 1,2-Hexanediol, Trisodium Ethylenediamine Disuccinate, Sodium Benzoate'
  },

  // Beauty of Joseon - Direct Seoul sourcing
  {
    name_korean: '조선미녀 글로우 딥 세럼',
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    seoul_price: 5.80,
    us_price: 45,
    category: 'Serum',
    description: 'Alpha arbutin and niacinamide serum for brightening and dark spots',
    skin_type: 'All skin types',
    ingredients: 'Oryza Sativa (Rice) Bran Water, Water, Glycerin, Butylene Glycol, 1,2-Hexanediol, Dipropylene Glycol, Alpha-Arbutin, Niacinamide, Methyl Gluceth-20, Panthenol, Polyglycerin-3, Trehalose, Glyceryl Glucoside, Hydrolyzed Jojoba Esters, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Ethylhexylglycerin, Hydroxyethylcellulose, Xanthan Gum, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Arginine, Disodium EDTA, Sorbitan Isostearate, Glucose, Coix Lacryma-Jobi Ma-Yuen Seed Extract, Coptis Japonica Root Extract, Glycine Soja (Soybean) Seed Extract, Hordeum Distichon (Barley) Extract, Oryza Sativa (Rice) Extract, Sesamum Indicum (Sesame) Seed Extract, Triticum Vulgare (Wheat) Seed Extract, Vigna Radiata Seed Extract, Zea Mays (Corn) Kernel Extract'
  },
  {
    name_korean: '조선미녀 적두 워터 젤',
    name_english: 'Red Bean Water Gel',
    brand: 'Beauty of Joseon',
    seoul_price: 8.90,
    us_price: 28,
    category: 'Moisturizer',
    description: 'Lightweight gel moisturizer with red bean extract for oily skin',
    skin_type: 'Oily, Combination',
    ingredients: 'Phaseolus Angularis Seed Extract, Water, Butylene Glycol, Glycerin, 1,2-Hexanediol, Methyl Trimethicone, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Glyceryl Glucoside, C12-14 Alketh-12, Maltodextrin, Ammonium Acryloyldimethyltaurate/VP Copolymer, Dimethicone/Vinyl Dimethicone Crosspolymer, Dimethicone Crosspolymer, Ethylhexylglycerin, Betaine, Panthenol, Allantoin, Dipotassium Glycyrrhizate, Polyquaternium-51, Xanthan Gum, Disodium EDTA, Glyceryl Acrylate/Acrylic Acid Copolymer, Dioscorea Japonica Root Extract, Glucose, Sodium Citrate, Beta-Glucan, Hydrolysed Corn Starch, Citric Acid, Sucrose, Caprylyl Glycol, Helianthus Annuus (Sunflower) Seed Oil, Tocopherol, Cyanocobalamin, Glycine, Serine, Glutamic Acid, Magnesium Ascorbyl Phosphate, Aspartic Acid, Leucine, Acetyl Hexapeptide-8, Alanine, Lysine, Arginine, Tyrosine, Phenylalanine, Proline, Threonine, Valine, Isoleucine, Histidine, Cysteine, Methionine, SH-Oligopeptide-1, SH-Oligopeptide-2, SH-Polypeptide-1'
  },
  {
    name_korean: '조선미녀 릴리프 선 라이스 + 프로바이오틱스 SPF50+',
    name_english: 'Relief Sun Rice + Probiotics SPF50+',
    brand: 'Beauty of Joseon',
    seoul_price: 9.40,
    us_price: 35,
    category: 'Sunscreen',
    description: 'Chemical sunscreen with rice bran and probiotics for sensitive skin',
    skin_type: 'Sensitive, All skin types',
    ingredients: 'Water, Dibutyl Adipate, Propanediol, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Polymethylsilsesquioxane, Ethylhexyl Triazone, Niacinamide, Methylene Bis-Benzotriazolyl Tetramethylbutylphenol, Coco-Caprylate/Caprate, Caprylyl Methicone, Diethylhexyl Butamido Triazone, Glycerin, 1,2-Hexanediol, Butylene Glycol, Pentylene Glycol, Behenyl Alcohol, Poly C10-30 Alkyl Acrylate, Polyglyceryl-3 Methylglucose Distearate, Decyl Glucoside, Oryza Sativa (Rice) Extract, Tromethamine, Carbomer, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Sodium Stearoyl Glutamate, Polyacrylate Crosspolymer-6, Ethylhexylglycerin, Adenosine, Xanthan Gum, T-Butyl Alcohol, Tocopherol, Oryza Sativa (Rice) Germ Extract, Camellia Sinensis Leaf Extract, Lactobacillus/Rice Ferment, Lactobacillus/Pumpkin Ferment Extract, Monascus/Rice Ferment, Bacillus/Soybean Ferment Extract, Saccharum Officinarum (Sugarcane) Extract, Aspergillus Ferment, Macrocystis Pyrifera (Kelp) Extract, Cocos Nucifera (Coconut) Fruit Extract, Panax Ginseng Root Extract'
  },

  // Laneige - Wholesale Seoul pricing
  {
    name_korean: '라네즈 워터 슬리핑 마스크',
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    seoul_price: 8.20,
    us_price: 34,
    category: 'Mask',
    description: 'Overnight hydrating mask with Hydro Ionized Mineral Water',
    skin_type: 'Dry, All skin types',
    ingredients: 'Water, Butylene Glycol, Glycerin, Trehalose, Methyl Trimethicone, 1,2-Hexanediol, Squalane, Phenyltrimethicone, PCA Dimethicone, Caprylyl Methicone, Ammonium Acryloyldimethyltaurate/VP Copolymer, Lactobacillus Ferment Lysate, Carbomer, Propanediol, Tromethamine, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Glyceryl Caprylate, Ethylhexylglycerin, Disodium EDTA, Raffinose, Stearyl Behenate, Malachite Extract, Fragrance, Polyglyceryl-3 Methylglucose Distearate, Inulin Lauryl Carbamate, Tranexamic Acid, Tryptophan, Hydroxypropyl Bispalmitamide MEA, Niacinamide'
  },
  {
    name_korean: '라네즈 크림 스킨 토너 & 모이스처라이저',
    name_english: 'Cream Skin Toner & Moisturizer',
    brand: 'Laneige',
    seoul_price: 13.50,
    us_price: 45,
    category: 'Toner',
    description: '2-in-1 toner and moisturizer with White Tea Extract',
    skin_type: 'Dry, Normal',
    ingredients: 'Water, Butylene Glycol, Glycerin, 1,2-Hexanediol, Niacinamide, Pentylene Glycol, Methyl Trimethicone, Camellia Sinensis Leaf Extract, Trehalose, Sodium Hyaluronate, Glyceryl Glucoside, Dimethicone, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Glyceryl Caprylate, Ethylhexylglycerin, Disodium EDTA, Fragrance, Adenosine, Malachite Extract, Cholesterol, Propanediol, Tocopherol'
  },

  // Torriden - True wholesale costs
  {
    name_korean: '토리든 다이브인 로우 몰레큘 히알루론산 세럼',
    name_english: 'DIVE-IN Low Molecule Hyaluronic Acid Serum',
    brand: 'Torriden',
    seoul_price: 10.30,
    us_price: 78,
    category: 'Serum',
    description: '5 types of hyaluronic acid for deep hydration',
    skin_type: 'Dry, Dehydrated',
    ingredients: 'Water, Butylene Glycol, Glycerin, Dipropylene Glycol, 1,2-Hexanediol, Panthenol, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Sodium Acetylated Hyaluronate, Sodium Hyaluronate Crosspolymer, Hydrolyzed Sodium Hyaluronate, Allantoin, Trehalose, Betaine, Propanediol, Portulaca Oleracea Extract, Hamamelis Virginiana Extract, Madecassoside, Madecassic Acid, Ceramide NP, Beta-Glucan, Malachite Extract, Cholesterol, Pentylene Glycol, Glyceryl Acrylate/Acrylic Acid Copolymer, PVM/MA Copolymer, Polyglyceryl-10 Laurate, Xanthan Gum, Tromethamine, Carbomer, Ethylhexylglycerin'
  },
  {
    name_korean: '토리든 다이브인 로우 몰레큘 히알루론산 토너',
    name_english: 'DIVE-IN Low Molecule Hyaluronic Acid Toner',
    brand: 'Torriden',
    seoul_price: 9.80,
    us_price: 65,
    category: 'Toner',
    description: 'Hydrating toner with low molecular weight hyaluronic acid',
    skin_type: 'Dry, All skin types',
    ingredients: 'Water, Butylene Glycol, Glycerin, Dipropylene Glycol, 1,2-Hexanediol, Sodium Hyaluronate, Hydrolyzed Hyaluronic Acid, Sodium Acetylated Hyaluronate, Sodium Hyaluronate Crosspolymer, Hydrolyzed Sodium Hyaluronate, Panthenol, Allantoin, Trehalose, Betaine, Propanediol, Portulaca Oleracea Extract, Hamamelis Virginiana Extract, Madecassoside, Madecassic Acid, Ceramide NP, Beta-Glucan, Malachite Extract, Cholesterol, Pentylene Glycol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Xanthan Gum, Ethylhexylglycerin'
  },

  // Some By Mi - Seoul wholesale
  {
    name_korean: '썸바이미 레드 티트리 스팟 오일',
    name_english: 'Red Tea Tree Spot Oil',
    brand: 'Some By Mi',
    seoul_price: 7.20,
    us_price: 25,
    category: 'Treatment',
    description: 'Targeted spot treatment with red tea tree for acne',
    skin_type: 'Acne-prone, Oily',
    ingredients: 'Alcohol Denat., C12-14 Pareth-12, Melaleuca Alternifolia Leaf Oil, Water, Butylene Glycol, Melaleuca Alternifolia Leaf Extract, Panthenol, Allantoin, Limonene'
  },
  {
    name_korean: '썸바이미 30데이즈 미라클 토너',
    name_english: '30 Days Miracle Toner',
    brand: 'Some By Mi',
    seoul_price: 8.40,
    us_price: 28,
    category: 'Toner',
    description: 'AHA BHA PHA toner for acne-prone skin',
    skin_type: 'Acne-prone, Oily',
    ingredients: 'Water, Butylene Glycol, Dipropylene Glycol, Glycerin, Niacinamide, Melaleuca Alternifolia (Tea Tree) Leaf Extract, Polyglyceryl-4 Caprate, Carica Papaya (Papaya) Fruit Extract, Lens Esculenta (Lentil) Seed Extract, Hamamelis Virginiana (Witch Hazel) Extract, Nelumbo Nucifera Flower Extract, Swiftlet Nest Extract, Sodium Hyaluronate, Fructan, Allantoin, Adenosine, Hydroxyethyl Urea, Xylitol, Salicylic Acid, Lactobionic Acid, Citric Acid, Sodium Citrate, 1,2-Hexanediol, Benzyl Glycol, Ethylhexylglycerin, Raspberry Ketone, Mentha Piperita (Peppermint) Oil'
  },

  // Round Lab - Direct Korean pricing
  {
    name_korean: '라운드랩 1025 독도 토너',
    name_english: '1025 Dokdo Toner',
    brand: 'Round Lab',
    seoul_price: 9.50,
    us_price: 38,
    category: 'Toner',
    description: 'Gentle toner with Ulleungdo deep sea water for sensitive skin',
    skin_type: 'Sensitive, All skin types',
    ingredients: 'Water, Butylene Glycol, Glycerin, Pentylene Glycol, Propanediol, Chondrus Crispus Extract, Saccharum Officinarum (Sugarcane) Extract, Sea Water, 1,2-Hexanediol, Protease, Betaine, Panthenol, Ethylhexylglycerin, Allantoin, Xanthan Gum, Disodium EDTA'
  },
  {
    name_korean: '라운드랩 자작나무 수분 크림',
    name_english: 'Birch Juice Moisturizing Cream',
    brand: 'Round Lab',
    seoul_price: 11.20,
    us_price: 42,
    category: 'Moisturizer',
    description: 'Lightweight moisturizer with birch juice for hydration',
    skin_type: 'Dry, Normal',
    ingredients: 'Water, Glycerin, Isononyl Isononanoate, Isododecane, 1,2-Hexanediol, Pentylene Glycol, Polydecene, Betula Platyphylla Japonica Juice, Jojoba Esters, Panthenol, Glyceryl Glucoside, Acacia Senegal Gum, Hydrolyzed Hibiscus Esculentus Extract, Sodium Hyaluronate, Hyaluronic Acid, Lupinus Albus Seed Extract, Moringa Oleifera Seed Extract, Melia Azadirachta Leaf Extract, Melia Azadirachta Flower Extract, Coccinia Indica Fruit Extract, Aloe Barbadensis Flower Extract, Solanum Melongena (Eggplant) Fruit Extract, Ocimum Sanctum Leaf Extract, Corallina Officinalis Extract, Curcuma Longa (Turmeric) Root Extract, Ascorbic Acid, Pentaerythrityl Tetraethylhexanoate, Ammonium Acryloyldimethyltaurate/VP Copolymer, Polyglyceryl-3 Methylglucose Distearate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Glyceryl Acrylate/Acrylic Acid Copolymer, Ethylhexylglycerin, Agar, Dipotassium Glycyrrhizate, Glyceryl Caprylate, Butylene Glycol, Disodium EDTA'
  },

  // Anua - Seoul market pricing
  {
    name_korean: '아누아 어성초 77% 수딩 토너',
    name_english: 'Heartleaf 77% Soothing Toner',
    brand: 'Anua',
    seoul_price: 7.80,
    us_price: 29,
    category: 'Toner',
    description: 'Soothing toner with 77% heartleaf extract for irritated skin',
    skin_type: 'Sensitive, Acne-prone',
    ingredients: 'Houttuynia Cordata Extract, Water, 1,2-Hexanediol, Glycerin, Betaine, Panthenol, Saccharum Officinarum (Sugar Cane) Extract, Portulaca Oleracea Extract, Butylene Glycol, Vitex Agnus-Castus Extract, Chamomilla Recutita (Matricaria) Flower Extract, Arctium Lappa Root Extract, Phellinus Linteus Extract, Vitis Vinifera (Grape) Fruit Extract, Pyrus Malus (Apple) Fruit Extract, Centella Asiatica Extract, Isopentyldiol, Methylpropanediol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tromethamine, Disodium EDTA'
  },
  {
    name_korean: '아누아 어성초 80% 수딩 앰플',
    name_english: 'Heartleaf 80% Soothing Ampoule',
    brand: 'Anua',
    seoul_price: 9.60,
    us_price: 35,
    category: 'Serum',
    description: 'Concentrated ampoule with 80% heartleaf for acne care',
    skin_type: 'Acne-prone, Sensitive',
    ingredients: 'Houttuynia Cordata Extract, Butylene Glycol, Glycerin, 1,2-Hexanediol, Betaine, Cassia Obtusifolia Seed Extract, Pancratium Maritimum Extract, Allantoin, Panthenol, Dipotassium Glycyrrhizate, Polyglutamic Acid, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Sorbitan Isostearate, Polysorbate 60, Xanthan Gum, Ethylhexylglycerin'
  },

  // Additional Korean brands at true wholesale
  {
    name_korean: '이니스프리 그린티 씨드 세럼',
    name_english: 'Green Tea Seed Serum',
    brand: 'Innisfree',
    seoul_price: 11.50,
    us_price: 45,
    category: 'Serum',
    description: 'Antioxidant serum with Jeju green tea for hydration',
    skin_type: 'All skin types',
    ingredients: 'Water, Propanediol, Glycerin, 1,2-Hexanediol, Niacinamide, Betaine, Saccharide Isomerate, Camellia Sinensis Seed Oil, Xylitol, Cetearyl Olivate, Hydrogenated Lecithin, Butylene Glycol, Sorbitan Olivate, Lactobacillus Ferment Lysate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Squalane, Panthenol, Allantoin, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Tromethamine, Ethylhexylglycerin, Ceratonia Siliqua (Carob) Gum, Sodium Metaphosphate, Camellia Sinensis Leaf Extract, Dipotassium Glycyrrhizate, Sodium Hyaluronate, Hyaluronic Acid, Dextrin, Theobroma Cacao (Cocoa) Extract, 3-O-Ethyl Ascorbic Acid, Sorbitan Isostearate, Sodium Citrate, Citric Acid, Glyceryl Oleate, Tocopherol, Lecithin, Sucrose'
  },
  {
    name_korean: '이니스프리 볼카닉 포어 클레이 마스크',
    name_english: 'Volcanic Pore Clay Mask',
    brand: 'Innisfree',
    seoul_price: 6.90,
    us_price: 22,
    category: 'Mask',
    description: 'Deep cleansing clay mask with Jeju volcanic clay',
    skin_type: 'Oily, Acne-prone',
    ingredients: 'Water, Butylene Glycol, Titanium Dioxide, Silica, Glycerin, Trehalose, Volcanic Ash, Caprylic/Capric Triglyceride, Polyvinyl Alcohol, Bentonite, Kaolin, Glyceryl Stearate, Cetearyl Alcohol, PVP, 1,2-Hexanediol, PEG-100 Stearate, Polysorbate 60, Palmitic Acid, Stearic Acid, Iron Oxides, Hydrogenated Vegetable Oil, Xanthan Gum, Juglans Regia (Walnut) Shell Powder, Sorbitan Stearate, Zea Mays (Corn) Starch, Polyacrylate-13, Polysorbate 20, Mannitol, Microcrystalline Cellulose, Sodium Metaphosphate, Lactic Acid, Lactic Acid/Glycolic Acid Copolymer, Polyisobutene, Menthoxypropanediol, Tetrasodium Pyrophosphate, Ethylhexylglycerin, Sorbitan Isostearate, Polyquaternium-10, Lecithin, Tocopherol'
  },
  {
    name_korean: '클레어스 서플 프리퍼레이션 페이셜 토너',
    name_english: 'Supple Preparation Facial Toner',
    brand: 'Klairs',
    seoul_price: 10.80,
    us_price: 34,
    category: 'Toner',
    description: 'Alcohol-free toner with plant extracts for sensitive skin',
    skin_type: 'Sensitive, All skin types',
    ingredients: 'Water, Butylene Glycol, Dimethyl Sulfone, Betaine, Caprylic/Capric Triglyceride, Disodium EDTA, Glycyrrhiza Glabra (Licorice) Root Extract, Centella Asiatica Extract, Chlorphenesin, Tocopheryl Acetate, Glycerin, Arginine, Carbomer, Panthenol, Luffa Cylindrica Fruit/Leaf/Stem Extract, 1,2-Hexanediol, Hydroxyethylcellulose, Aloe Barbadensis Leaf Extract, Althaea Rosea Flower Extract, Portulaca Oleracea Extract, Polyquaternium-51, Beta-Glucan, Lysine HCl, Sodium Ascorbyl Phosphate, Sodium Hyaluronate, Acetyl Methionine, Theanine, Proline, Natto Gum, Disodium Phosphate, Polysorbate 60, Sodium Phosphate, Citrus Limon (Lemon) Peel Oil, Lavandula Angustifolia (Lavender) Oil, Citrus Aurantium Dulcis (Orange) Peel Oil, Pelargonium Graveolens Flower Oil, Cananga Odorata Flower Oil, Eucalyptus Globulus Leaf Oil, Copper Tripeptide-1'
  },
  {
    name_korean: '에뛰드하우스 순정 pH 6.5 휩 클렌저',
    name_english: 'SoonJung pH 6.5 Whip Cleanser',
    brand: 'Etude House',
    seoul_price: 4.60,
    us_price: 16,
    category: 'Cleanser',
    description: 'Gentle whip cleanser with pH 6.5 for sensitive skin',
    skin_type: 'Sensitive, All skin types',
    ingredients: 'Water, Glycerin, Sorbitol, Propanediol, Lauryl Glucoside, Disodium Cocoyl Glutamate, Panthenol, Citric Acid, Glyceryl Caprylate, Ethylhexylglycerin, Madecassoside, Butylene Glycol, Tocopherol, Camellia Sinensis Leaf Extract'
  },
  {
    name_korean: '미샤 타임 레볼루션 퍼스트 트리트먼트 에센스',
    name_english: 'Time Revolution First Treatment Essence',
    brand: 'Missha',
    seoul_price: 14.80,
    us_price: 62,
    category: 'Essence',
    description: 'Fermented yeast essence for anti-aging and radiance',
    skin_type: 'Mature, All skin types',
    ingredients: 'Yeast Ferment Extract, 1,2-Hexanediol, Niacinamide, Bifida Ferment Lysate, Diethoxyethyl Succinate, Sodium PCA, Water, Butylene Glycol, Ethylhexylglycerin, Adenosine, Ceramide NP, Hydrogenated Lecithin'
  },
  {
    name_korean: '아임프롬 쑥 에센스',
    name_english: 'Mugwort Essence',
    brand: 'I\'m From',
    seoul_price: 13.90,
    us_price: 58,
    category: 'Essence',
    description: 'Soothing essence with 100% mugwort extract from Ganghwa',
    skin_type: 'Sensitive, Acne-prone',
    ingredients: 'Water, Artemisia Princeps Extract, Butylene Glycol, 1,2-Hexanediol, Sodium Hyaluronate, Ethylhexylglycerin'
  }
]

export async function POST(request: Request) {
  try {
    console.log('🏪 Populating database with Korean wholesale products...')

    // Clear existing products first
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      console.error('Error clearing products:', deleteError)
      return NextResponse.json({ error: 'Failed to clear existing products' }, { status: 500 })
    }

    console.log('✅ Cleared existing products')

    // Insert wholesale products
    const productsToInsert = WHOLESALE_PRODUCTS.map(product => ({
      ...product,
      savings_percentage: Math.round(((product.us_price - product.seoul_price) / product.us_price) * 100),
      in_stock: true,
      popularity_score: Math.floor(Math.random() * 50) + 50 // 50-100 popularity
    }))

    const { data: insertedProducts, error: insertError } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting products:', insertError)
      return NextResponse.json({ error: 'Failed to insert wholesale products' }, { status: 500 })
    }

    console.log(`✅ Inserted ${insertedProducts?.length || 0} wholesale products`)

    // Calculate summary stats
    const totalProducts = insertedProducts?.length || 0
    const avgSavings = totalProducts > 0
      ? Math.round(insertedProducts.reduce((sum, p) => sum + p.savings_percentage, 0) / totalProducts)
      : 0
    const avgSeoulPrice = totalProducts > 0
      ? Math.round((insertedProducts.reduce((sum, p) => sum + p.seoul_price, 0) / totalProducts) * 100) / 100
      : 0
    const topSavings = insertedProducts
      ?.sort((a, b) => b.savings_percentage - a.savings_percentage)
      .slice(0, 3)

    return NextResponse.json({
      success: true,
      message: 'Database populated with Korean wholesale products',
      summary: {
        totalProducts,
        averageSavings: `${avgSavings}%`,
        averageSeoulPrice: `$${avgSeoulPrice}`,
        priceRange: {
          lowest: `$${Math.min(...insertedProducts.map(p => p.seoul_price))}`,
          highest: `$${Math.max(...insertedProducts.map(p => p.seoul_price))}`
        }
      },
      topSavingsProducts: topSavings?.map(p => ({
        brand: p.brand,
        name: p.name_english,
        seoulPrice: `$${p.seoul_price}`,
        usPrice: `$${p.us_price}`,
        savings: `${p.savings_percentage}%`
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Population error:', error)
    return NextResponse.json(
      { error: 'Failed to populate wholesale products', details: String(error) },
      { status: 500 }
    )
  }
}

// GET endpoint for status
export async function GET() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, brand, name_english, seoul_price, us_price, savings_percentage')
    .order('savings_percentage', { ascending: false })
    .limit(5)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'ready',
    endpoint: 'POST /api/populate-wholesale-products',
    currentProducts: products?.length || 0,
    topProducts: products?.map(p => ({
      brand: p.brand,
      name: p.name_english,
      seoulPrice: `$${p.seoul_price}`,
      savings: `${p.savings_percentage}%`
    }))
  })
}