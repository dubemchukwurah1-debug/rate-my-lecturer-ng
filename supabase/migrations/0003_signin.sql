-- Email sign-in and student verification.

-- Student email domains are crowd-sourced: students suggest, moderators confirm.
create table domain_suggestions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions on delete cascade,
  domain text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  created_at timestamptz not null default now(),
  unique (institution_id, domain)
);
alter table domain_suggestions enable row level security;

-- ID-card checks. id_number_hash is a keyed hash of the card number, used only to
-- spot the same card being used for two accounts.
alter table verification_requests
  add column institution_id uuid references institutions,
  add column id_number_hash bytea;
create index verification_requests_id_hash_idx on verification_requests (id_number_hash);

-- Keep the hashes of approved cards after the request row (and photos) are deleted.
create table used_id_cards (
  id_number_hash bytea primary key,
  used_at date not null default current_date
);
alter table used_id_cards enable row level security;

alter table moderation_queue drop constraint moderation_queue_item_type_check;
alter table moderation_queue add constraint moderation_queue_item_type_check
  check (item_type in ('review', 'facility_issue', 'staff', 'verification', 'domain'));
