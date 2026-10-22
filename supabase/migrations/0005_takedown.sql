-- Takedown and appeal requests for published content. Answered within 48 hours;
-- every decision records who made it and why. Contact details are erased 90 days
-- after the decision.
create table takedown_requests (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('flag', 'review', 'facility_issue')),
  target_id uuid not null,
  requester_role text not null check (requester_role in ('staff', 'representative', 'student', 'other')),
  contact_email text,
  reason text not null check (char_length(reason) between 30 and 4000),
  created_at timestamptz not null default now(),
  decision text check (decision in ('removed', 'kept')),
  decision_reasons text,
  decided_by uuid references auth.users,
  decided_at timestamptz
);
create index takedown_open_idx on takedown_requests (created_at) where decided_at is null;
alter table takedown_requests enable row level security;

alter table moderation_queue drop constraint moderation_queue_item_type_check;
alter table moderation_queue add constraint moderation_queue_item_type_check
  check (item_type in ('review', 'facility_issue', 'staff', 'verification', 'domain', 'flag', 'staff_claim', 'takedown'));
