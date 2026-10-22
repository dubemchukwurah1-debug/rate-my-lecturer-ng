-- Phase 2: flag reports, the review panel, staff right of reply.

-- Reporters follow their case anonymously with the case number plus a secret key
-- shown once at filing; only the key's hash is kept.
alter table flag_reports
  add column case_key_hash bytea,
  add column official_outcome_url text,
  add column referral_consent boolean not null default false; -- consent to a referral to police or school
create index flag_reports_staff_idx on flag_reports (staff_id, colour, status);

-- A staff member's own reply to a red-flag case, written before publication.
create table flag_responses (
  staff_id uuid primary key references staff on delete cascade,
  body text not null check (char_length(body) between 20 and 2000),
  updated_at timestamptz not null default now()
);
alter table flag_responses enable row level security;

-- Staff claim their profile to reply; a moderator checks the claim.
create table staff_claims (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  evidence text not null,
  created_at timestamptz not null default now(),
  unique (staff_id, user_id)
);
alter table staff_claims enable row level security;

alter table published_flags
  add column report_count int not null default 0,
  add column notice_sent_at timestamptz;
create unique index published_flags_staff_colour_idx on published_flags (staff_id, colour);

alter table moderation_queue drop constraint moderation_queue_item_type_check;
alter table moderation_queue add constraint moderation_queue_item_type_check
  check (item_type in ('review', 'facility_issue', 'staff', 'verification', 'domain', 'flag', 'staff_claim'));
