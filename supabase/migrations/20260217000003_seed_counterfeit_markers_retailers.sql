-- =============================================================================
-- Seed: Counterfeit markers and retailer verification data
-- =============================================================================

-- Update existing retailers with verification fields
UPDATE ss_retailers SET
    is_authorized = true,
    risk_level = 'low',
    authorized_brands = ARRAY['COSRX', 'Sulwhasoo', 'Laneige', 'Innisfree', 'Etude', 'Dr. Jart+', 'Missha', 'Klairs', 'Beauty of Joseon', 'Torriden', 'Anua', 'Isntree', 'Round Lab'],
    verification_notes = 'Official Korean beauty retailer operated by CJ Olive Young. Authorized seller of all major K-beauty brands. Products sourced directly from Korean manufacturers.',
    last_verified_at = NOW()
WHERE name = 'Olive Young';

UPDATE ss_retailers SET
    is_authorized = true,
    risk_level = 'low',
    authorized_brands = ARRAY['Sulwhasoo', 'Laneige', 'Dr. Jart+', 'COSRX', 'Missha', 'Klairs', 'Banila Co', 'Neogen'],
    verification_notes = 'US-based K-beauty specialty retailer. Curates authentic Korean products with direct brand relationships. Founded by Charlotte Cho.',
    last_verified_at = NOW()
WHERE name = 'Soko Glam';

UPDATE ss_retailers SET
    is_authorized = true,
    risk_level = 'low',
    authorized_brands = ARRAY['COSRX', 'Innisfree', 'Etude', 'Missha', 'Some By Mi', 'Klairs', 'Benton', 'Purito'],
    verification_notes = 'Hong Kong-based Asian beauty retailer with direct brand partnerships. Reliable for authentic K-beauty products with international shipping.',
    last_verified_at = NOW()
WHERE name = 'YesStyle';

UPDATE ss_retailers SET
    is_authorized = false,
    risk_level = 'medium',
    authorized_brands = ARRAY[]::TEXT[],
    verification_notes = 'Major marketplace with commingled inventory risk. Some products are sold by authorized sellers, but commingling means genuine and counterfeit inventory may be mixed. Check seller carefully.',
    last_verified_at = NOW()
WHERE name ILIKE '%amazon%';


-- Counterfeit markers for known hotspot brands
INSERT INTO ss_counterfeit_markers (brand, marker_type, description, severity) VALUES
-- COSRX
('COSRX', 'packaging', 'Authentic COSRX Advanced Snail 96 Mucin Power Essence has sharp, clear printing. Counterfeits show blurry font edges, especially on small Korean text.', 'high'),
('COSRX', 'label', 'Check the back label: authentic products have the Korean MFDS certification number clearly printed. Counterfeits often have incorrect or missing certification numbers.', 'critical'),
('COSRX', 'texture', 'Authentic snail mucin essence has a clear, slightly viscous texture that stretches without breaking. Counterfeits may be more watery or have an unusual color tint.', 'medium'),
('COSRX', 'packaging', 'The COSRX logo font spacing on authentic products is precise and consistent. Counterfeits often have slightly wider or narrower letter spacing.', 'medium'),
('COSRX', 'barcode', 'Authentic COSRX products have barcodes starting with 880 (South Korea). Non-880 prefix barcodes are suspicious.', 'high'),

-- Sulwhasoo
('Sulwhasoo', 'packaging', 'Authentic Sulwhasoo products use heavy, high-quality glass containers. Counterfeits often use lighter, thinner glass or plastic that mimics glass.', 'high'),
('Sulwhasoo', 'label', 'The Sulwhasoo logo uses a specific gold foil stamping. Counterfeits use printed gold ink that appears flatter and less reflective.', 'high'),
('Sulwhasoo', 'packaging', 'Authentic Sulwhasoo outer boxes have a specific embossed pattern. Feel for raised texture -- counterfeits print the pattern flat.', 'medium'),
('Sulwhasoo', 'texture', 'Authentic First Care Activating Serum has a distinctive herbal scent from Korean medicinal herbs. Counterfeits smell synthetic or overly perfumed.', 'medium'),

-- Laneige
('Laneige', 'packaging', 'Authentic Laneige Lip Sleeping Mask has a precisely molded container with uniform color. Counterfeits show color inconsistencies or rough molding seams.', 'high'),
('Laneige', 'label', 'The "LANEIGE" text on authentic products uses a specific font weight and spacing. Counterfeits often have slightly bolder or thinner lettering.', 'medium'),
('Laneige', 'texture', 'Authentic Water Sleeping Mask has a light gel texture with a subtle floral scent. Counterfeits may have a heavier, greasier texture.', 'medium'),

-- Dr. Jart+
('Dr. Jart+', 'packaging', 'Authentic Cicapair products have precise color-changing technology (green to beige). Counterfeits may have poor color-change performance or wrong initial color.', 'critical'),
('Dr. Jart+', 'label', 'Check for "HAVE & BE Co. Ltd" as manufacturer on back label. Missing or incorrect manufacturer info is a red flag.', 'high'),

-- Innisfree
('Innisfree', 'packaging', 'Authentic Innisfree products updated to minimalist packaging in 2023. Old-style elaborate packaging sold as new may be old stock or counterfeit.', 'low'),
('Innisfree', 'label', 'Innisfree products should show Amorepacific as parent company on the back label.', 'medium'),

-- General markers
('ANY', 'packaging', 'Compare shrink wrap: authentic K-beauty products have tight, professional-grade shrink wrap. Counterfeits often have loose or wrinkled shrink wrap with visible seams.', 'medium'),
('ANY', 'label', 'All legitimate K-beauty products must display Korean text including manufacturer, address, and MFDS registration. Missing Korean regulatory info is a major red flag.', 'critical'),
('ANY', 'barcode', 'South Korean barcodes start with 880. Japanese start with 45/49. Check that the barcode prefix matches the claimed country of origin.', 'high');


-- Safety alerts seed data
INSERT INTO ss_safety_alerts (alert_type, severity, title, description, affected_brands, source, is_active) VALUES
('counterfeit_wave', 'high', 'COSRX Snail Mucin Counterfeit Alert', 'Reports of counterfeit COSRX Advanced Snail 96 Mucin Power Essence on Amazon have increased. Commingled inventory means even "Fulfilled by Amazon" orders may be affected. Purchase from authorized retailers for guaranteed authenticity.', ARRAY['COSRX'], 'community_reports', true),
('seller_warning', 'medium', 'Temu K-Beauty Seller Warning', 'Multiple reports of suspicious K-beauty products sold on Temu at significantly below retail prices. While some may be genuine parallel imports, the platform lacks seller verification. Exercise caution.', ARRAY['ANY'], 'internal_detection', true),
('ingredient_warning', 'medium', 'Mercury in Counterfeit Whitening Products', 'FDA warning about mercury contamination in counterfeit Asian beauty products marketed as skin lightening or whitening. Only purchase from verified retailers. If a brightening product produces dramatic results in days, stop use immediately.', ARRAY['ANY'], 'kfda', true);
