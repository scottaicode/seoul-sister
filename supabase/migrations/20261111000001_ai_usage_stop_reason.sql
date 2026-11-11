-- Why the model stopped writing (end_turn, max_tokens, refusal, ...). Nov 11 2026:
-- a landing-chat reply ended mid-sentence and nothing recorded why.
ALTER TABLE ss_ai_usage ADD COLUMN IF NOT EXISTS stop_reason text;
