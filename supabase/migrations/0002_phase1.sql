-- Phase 1: staff links, facility upvotes, review holds.

alter table staff add column proposed_course_codes text[] not null default '{}';
create index staff_institution_idx on staff (institution_id, status);
create index reviews_staff_idx on reviews (staff_id, created_at);
create index facility_issues_institution_idx on facility_issues (institution_id, status);

-- One upvote per account per issue. voter_hash = HMAC(server secret, user id + issue id),
-- so the table cannot be joined back to accounts without the secret.
create table facility_upvotes (
  issue_id uuid not null references facility_issues on delete cascade,
  voter_hash bytea not null,
  primary key (issue_id, voter_hash)
);
alter table facility_upvotes enable row level security;

-- Moderation queue entries for held content (burst holds, filter hits).
create table moderation_queue (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('review', 'facility_issue', 'staff')),
  item_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table moderation_queue enable row level security;

-- Accounts allowed to use the moderation page.
create table moderators (
  user_id uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);
alter table moderators enable row level security;
