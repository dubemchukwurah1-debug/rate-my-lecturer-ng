-- Core schema. Design rule: nothing a student writes (review, flag report,
-- facility post) references the account that wrote it. Accounts only prove
-- eligibility; spending a one-time token proves "a verified student wrote this".

create extension if not exists pgcrypto;

create type institution_type as enum ('university', 'polytechnic', 'college_of_education');
create type ownership as enum ('federal', 'state', 'private');
create type staff_role as enum ('lecturer', 'administrative');
create type record_status as enum ('pending', 'approved', 'rejected', 'left');
create type flag_colour as enum ('green', 'yellow', 'red');
create type case_status as enum ('received', 'triage', 'panel_review', 'awaiting_reply', 'published', 'kept_on_file', 'dismissed');
create type facility_status as enum ('open', 'acknowledged', 'in_progress', 'fixed', 'stale');

-- Directory -------------------------------------------------------------

create table institutions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  type institution_type not null,
  ownership ownership not null,
  state text not null,
  aliases text[] not null default '{}',
  student_email_domains text[] not null default '{}',
  source_url text,
  created_at timestamptz not null default now()
);

create table departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions on delete cascade,
  name text not null,
  unique (institution_id, name)
);

create table staff (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions on delete cascade,
  department_id uuid references departments on delete set null,
  full_name text not null,
  title text,
  role staff_role not null default 'lecturer',
  status record_status not null default 'pending', -- students propose, moderators approve
  claimed_by uuid references auth.users, -- staff right-of-reply account
  created_at timestamptz not null default now()
);

-- Accounts and verification ---------------------------------------------

create table student_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  institution_id uuid references institutions,
  phone_verified_at timestamptz,
  verified_via text check (verified_via in ('school_email', 'id_selfie')),
  verified_at timestamptz,
  is_alumni boolean not null default false
);

-- ID + selfie checks. Files live in a private bucket and are deleted within
-- 7 days; this row is deleted when the check is decided.
create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  id_card_path text not null,
  selfie_path text not null,
  created_at timestamptz not null default now(),
  delete_after timestamptz not null default now() + interval '7 days'
);

-- How many anonymous tokens an account has been issued per semester. Token
-- values are blind-signed, so the server never sees them at issuance.
create table token_issuance (
  user_id uuid not null references auth.users on delete cascade,
  semester text not null,
  issued int not null,
  primary key (user_id, semester)
);

-- Hashes of spent tokens, to stop double spending. No user link.
create table spent_tokens (
  token_hash bytea primary key,
  spent_at date not null default current_date
);

-- Reviews ----------------------------------------------------------------

create table reviews (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  course_code text,
  semester text not null,
  overall smallint not null check (overall between 1 and 5),
  clarity smallint check (clarity between 1 and 5),
  fairness smallint check (fairness between 1 and 5),
  availability smallint check (availability between 1 and 5),
  respect smallint check (respect between 1 and 5),
  would_take_again boolean,
  tags text[] not null default '{}',
  body text not null check (char_length(body) between 50 and 1000),
  is_alumni boolean not null default false,
  counts_from timestamptz not null default now() + interval '48 hours',
  hidden_reason text, -- set by moderation or burst detection
  created_at date not null default current_date -- day only, to blunt timing correlation
);

create table review_replies (
  review_id uuid primary key references reviews on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Flags ------------------------------------------------------------------

create table flag_reports (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  colour flag_colour not null,
  category text not null,
  details_encrypted bytea, -- red reports: encrypted, panel-only
  merit_points smallint not null default 0,
  status case_status not null default 'received',
  case_number text unique not null default upper(substr(md5(gen_random_uuid()::text), 1, 10)),
  created_at date not null default current_date
);

-- Public red flags need 2+ independent reports, neutral wording, 7-day reply.
create table published_flags (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff on delete cascade,
  colour flag_colour not null,
  public_text text not null,
  official_outcome_url text,
  reply_deadline date,
  published_at timestamptz
);

-- Every panel decision is logged with its reasons (good-faith record).
create table case_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references flag_reports on delete cascade,
  decided_by uuid not null references auth.users,
  decision case_status not null,
  reasons text not null,
  decided_at timestamptz not null default now()
);

-- Facilities board -------------------------------------------------------

create table facility_issues (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions on delete cascade,
  category text not null,
  title text not null,
  description text not null,
  location text,
  photo_paths text[] not null default '{}', -- blurred, EXIF stripped
  status facility_status not null default 'open',
  upvotes int not null default 0,
  created_at date not null default current_date
);

-- Row-level security: public reads of approved content only; all writes go
-- through server routes that check and spend a token.
alter table institutions enable row level security;
alter table departments enable row level security;
alter table staff enable row level security;
alter table student_accounts enable row level security;
alter table verification_requests enable row level security;
alter table token_issuance enable row level security;
alter table spent_tokens enable row level security;
alter table reviews enable row level security;
alter table review_replies enable row level security;
alter table flag_reports enable row level security;
alter table published_flags enable row level security;
alter table case_decisions enable row level security;
alter table facility_issues enable row level security;

create policy "public read" on institutions for select using (true);
create policy "public read" on departments for select using (true);
create policy "public read approved" on staff for select using (status in ('approved', 'left'));
create policy "public read visible" on reviews for select using (hidden_reason is null and counts_from <= now());
create policy "public read" on review_replies for select using (true);
create policy "public read" on published_flags for select using (published_at is not null);
create policy "public read" on facility_issues for select using (true);
create policy "own account" on student_accounts for select using (auth.uid() = user_id);
