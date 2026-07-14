-- ss_reddit_intel — capture the ONE live acquisition channel so it can be measured.
--
-- WHY (Jul 13 2026): glass_skin_atx has 503 contributions / 1,205 karma, comments
-- pulling 265–1,300 views each, and a profile link to the Seoul Sister ingredient
-- checker. Yet ss_widget_sessions shows ZERO reddit-sourced sessions, ever. We cannot
-- answer the question that decides whether this channel is worth Scott's evenings:
-- "does Reddit send anyone to the site?" The top of the only funnel we have is
-- uninstrumented, and every comment's outcome evaporates the moment it's posted.
--
-- SCOPE (per /ship-guard): this is CAPTURE + ATTRIBUTION only — growth/measurement,
-- the always-allowed lane. The EXTRACTION of validated ingredient claims into Yuri's
-- context is DEFERRED; see REDDIT-INTELLIGENCE-BLUEPRINT.md for the design and the
-- explicit unfreeze condition. The extraction columns are created now (nullable) so
-- the corpus banks immediately and a later backfill needs no schema change.
--
-- THE TEACHER (per the owner's overriding learning-loop principle — find the
-- LEAST-GAMEABLE teacher in the domain): upvote score + views, and — far more
-- valuable — whether an ingredient-literate peer PUBLICLY CORRECTED a factual claim.
-- Reddit's K-beauty subs are full of people who read INCI lists for fun. A claim that
-- survives them is validated; a claim they contradict is a graded error. That is a
-- brutally honest grader, and it is free.
--
-- Apply with: psql "$DATABASE_URL" -f scripts/migrations/create_ss_reddit_intel.sql

create table if not exists ss_reddit_intel (
  id uuid primary key default gen_random_uuid(),

  -- Identity. permalink is the natural key so re-scrapes UPSERT and never duplicate.
  permalink        text not null unique,
  reddit_id        text,
  subreddit        text not null,
  thread_title     text,
  thread_permalink text,
  is_reply         boolean not null default false,
  parent_author    text,

  -- What we said.
  body             text not null,
  posted_at        timestamptz,

  -- THE TEACHER: the community verdict. Refreshed on every scan so we can watch it
  -- move (a comment's score is not final for hours or days).
  score            integer,
  views            integer,
  reply_count      integer not null default 0,
  -- Set when a knowledgeable peer publicly contradicts a factual claim we made.
  -- This is the highest-value row in the table: a graded, dated, public error.
  was_corrected    boolean not null default false,
  correction_note  text,
  score_last_checked_at timestamptz,

  -- ATTRIBUTION: did this comment actually send anyone to the site? Populated by
  -- matching ss_widget_sessions.source = 'reddit' arrivals against posting times.
  -- This is the number that decides whether the whole channel is real.
  attributed_sessions integer not null default 0,

  -- DEFERRED (Piece B). Do NOT populate until the blueprint's unfreeze condition is
  -- met. Shape: [{product, brand, ingredient, claim, claim_type, community_verdict}]
  extracted_claims jsonb,
  extracted_at     timestamptz,
  fed_to_yuri      boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reddit_intel_subreddit   on ss_reddit_intel(subreddit);
create index if not exists idx_reddit_intel_posted      on ss_reddit_intel(posted_at desc);
create index if not exists idx_reddit_intel_score       on ss_reddit_intel(score desc nulls last);
create index if not exists idx_reddit_intel_corrected   on ss_reddit_intel(was_corrected) where was_corrected = true;
-- The extraction queue for when Piece B unfreezes: high-signal, not yet mined.
create index if not exists idx_reddit_intel_unextracted on ss_reddit_intel(score desc) where extracted_at is null;

-- Service-role only. This is an internal intelligence corpus — never user-facing,
-- and it contains no third-party PII beyond public usernames we deliberately avoid
-- storing (parent_author is the only one, and only for correction context).
alter table ss_reddit_intel enable row level security;

drop trigger if exists trg_reddit_intel_updated_at on ss_reddit_intel;
create trigger trg_reddit_intel_updated_at
  before update on ss_reddit_intel
  for each row execute function update_updated_at_column();

comment on table ss_reddit_intel is
  'Captured glass_skin_atx Reddit comments + their community verdict (score/views/corrections) + site attribution. Instruments the only live acquisition channel. Claim EXTRACTION into Yuri is DEFERRED — see REDDIT-INTELLIGENCE-BLUEPRINT.md.';
comment on column ss_reddit_intel.was_corrected is
  'A knowledgeable peer publicly contradicted a factual claim here. A graded error — the highest-value signal in the table.';
comment on column ss_reddit_intel.attributed_sessions is
  'Widget sessions with source=reddit that plausibly followed this comment. THE number that decides whether this channel is real.';
comment on column ss_reddit_intel.extracted_claims is
  'DEFERRED. Populate only when the blueprint unfreeze condition is met. Nullable by design so the corpus banks now and backfills later.';
