-- Delete bootstrap effectiveness rows for known formulation auxiliaries.
--
-- Bailey's May 17 feedback: the Routine Intelligence widget on her routine
-- page recommended Arginine, Candelilla Wax, and Stearalkonium Hectorite
-- as "high-value missing ingredients" for combination skin. Yuri herself
-- diagnosed these as garbage: Arginine is a pH buffer, Candelilla Wax is
-- a texture thickener, Stearalkonium Hectorite is a clay-based viscosity
-- agent. None are pore actors.
--
-- Root cause: the Phase 11.4 bootstrap script for ss_ingredient_effectiveness
-- scored ingredients by frequency-in-products, not by actual mechanism. So
-- waxes, solvents, silicones, and pH buffers ended up at effectiveness 1.000
-- because they're in every product. The widget surfaced them as
-- recommendations.
--
-- This denylist targets:
--   * Water variants
--   * Solvent/humectant glycols
--   * Wax/clay/gum thickeners
--   * Emollient esters and triglycerides (used as texture, not as active)
--   * Silicones (texture/feel)
--   * Surfactants/emulsifiers
--   * Preservatives + boosters
--   * pH buffers and amino acid buffers
--   * Colorants
--
-- NOT touching legit hydrators/soothers/botanicals/ceramides even when
-- ss_ingredients.is_active = false on them (data quality of that flag is
-- separately imperfect). Explicit denylist is safer than blanket filter.
--
-- A11 of v10.5.2 (companion to removing the routine-page widget). Cleans
-- the data source so other downstream surfaces (scan enrichment, sunscreen
-- finder ranking, dupe finder scoring) stop being polluted by the same
-- garbage even after the widget is gone.
DELETE FROM ss_ingredient_effectiveness
WHERE ingredient_id IN (
  SELECT id FROM ss_ingredients
  WHERE LOWER(name_en) IN (
    -- Water
    'water', 'aqua (water)', 'purified water',
    -- Solvent/humectant glycols
    'butylene glycol', 'propylene glycol', 'dipropylene glycol',
    'methylpropanediol', 'propanediol', 'pentylene glycol',
    'caprylyl glycol', 'ethylhexanediol', '1,2-hexanediol', 'glycereth-26',
    -- Thickeners, gums, clays
    'candelilla wax', 'carbomer', 'cellulose gum', 'carboxymethylcellulose',
    'xanthan gum', 'natto gum', 'hydroxyethylcellulose',
    'stearalkonium hectorite', 'sodium polyacrylate',
    -- Emollient esters / triglycerides (texture role)
    'caprylic/capric triglyceride', 'cetyl ethylhexanoate',
    'coco-caprylate/caprate', 'diethoxyethyl succinate', 'dibutyl adipate',
    'triethylhexanoin', 'hydrogenated polydecene', 'hydrogenated polyolefin',
    'cetearyl olivate', 'sorbitan olivate', 'cetearyl alcohol',
    -- Silicones
    'cyclopentasiloxane', 'cyclohexasiloxane', 'dimethicone',
    'methyl trimethicone', 'phenyl trimethicone', 'polymethylsilsesquioxane',
    -- Surfactants / emulsifier auxiliaries
    'polysorbate 60', 'peg-7 glyceryl cocoate',
    'peg-6 caprylic/capric glycerides',
    -- Preservatives + boosters
    'phenoxyethanol', 'ethylhexylglycerin', 'cetrimonium bromide',
    'disodium edta',
    -- Colorant
    'caramel',
    -- Absorbent
    'silica',
    -- pH buffer (Bailey's specific complaint)
    'arginine',
    -- Sugar polyol used as filler
    'mannitol'
  )
);
