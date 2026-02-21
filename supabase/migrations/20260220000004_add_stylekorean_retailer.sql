-- Phase 9.4: Add StyleKorean retailer for multi-retailer price integration
INSERT INTO ss_retailers (name, website, country, trust_score, ships_international, affiliate_program, is_authorized, risk_level, verification_notes)
VALUES ('StyleKorean', 'https://www.stylekorean.com', 'South Korea', 88, true, true, true, 'low',
  'Korean-based K-beauty retailer specializing in international shipping. Authorized retailer for major K-beauty brands.')
ON CONFLICT (name) DO NOTHING;
