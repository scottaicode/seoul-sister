-- Trial ledger: remember which network a trial started from (Nov 10 2026).
--
-- The first version capped trials per network with the request rate limiter,
-- which counts every press of the paywall button, including abandoned
-- checkouts. Review showed one hesitant person (or a shared mobile-carrier
-- address) would exhaust it and then be CHARGED on a button that said "Start 7
-- days free". The cap now counts trials that actually started, from this
-- column, and the paywall reads the same rule.
ALTER TABLE ss_trial_starts ADD COLUMN IF NOT EXISTS ip_hash text;
CREATE INDEX IF NOT EXISTS ss_trial_starts_ip_hash_idx ON ss_trial_starts (ip_hash, started_at);
COMMENT ON COLUMN ss_trial_starts.ip_hash IS 'Grouping key for the network the trial started from (not reversible to an address). NULL when unknown.';
