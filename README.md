# Rate My Lecturer NG

Anonymous, verified ratings and reviews of lecturers and staff at Nigerian universities,
polytechnics and colleges of education, plus misconduct flags and a facilities board.

See [docs/DECISIONS.md](docs/DECISIONS.md) for the product decisions behind the code.

## Development

```bash
npm install
npm run dev     # http://localhost:3000
npm run seed    # rebuild src/data/institutions.json and supabase/seed.sql from data/institutions-seed.csv
npm run lint
npm test        # unit tests; database tests run when DATABASE_URL is set
npm run build
```

### Local database

`scripts/test-db.sh` starts a throwaway Postgres 16, applies `supabase/migrations` and the seed, and prints its
`DATABASE_URL`. Copy `.env.example` to `.env.local`, then set `DATABASE_URL`, the token keys
(`node scripts/gen-token-keys.mjs`) and `UPVOTE_SECRET`. To try the student flows without Supabase Auth, insert a
verified account and set `DEV_FAKE_USER_ID` to its id:

```sql
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001');
insert into student_accounts (user_id, phone_verified_at, verified_via, verified_at)
values ('00000000-0000-0000-0000-000000000001', now(), 'school_email', now());
insert into moderators (user_id) values ('00000000-0000-0000-0000-000000000001');
```

## Layout

- `data/institutions-seed.csv`: 513 institutions with ownership, state and source. Incomplete against official
  NUC / NBTE / NCCE totals; add rows here and rerun `npm run seed`.
- `supabase/migrations/0001_init.sql`: database schema with row-level security.
- `supabase/seed.sql`: generated institution inserts.
- `supabase/migrations/0002_phase1.sql`: facility upvotes, moderation queue, moderators.
- `src/lib`: data access and rules (content checks, scoring, anonymous tokens, reviews, facilities, staff, moderation).
- `src/app`: pages (search, institution, staff profile, add staff, facilities, `/moderate`) and `api/` routes.
- `supabase/migrations/0003_signin.sql`: email-domain suggestions, ID-check fields, used ID cards.
- `supabase/migrations/0004_flags.sql`: report case keys, staff claims, flag responses.
- Phase 2 pages: `/staff/[id]/report` (file a flag), `/case` (follow a case), `/panel` (red-flag review panel),
  `/staff/[id]/claim` and `/portal` (staff right of reply).
- `test/`: unit tests and database tests.

## Going live on Supabase

1. Create a project in an EU region. Run the migrations in `supabase/migrations` in order, then `supabase/seed.sql`.
2. Auth: enable email sign-in (magic link) and add `https://<your-domain>/auth/callback` to the redirect URLs.
3. Storage: create a **private** bucket named `verification`.
4. Generate `REPORT_ENCRYPTION_KEY` (command in `.env.example`) and keep a copy offline: without it, stored
   reports cannot be read.
5. Set the variables in `.env.example` on the host (Vercel). The daily cron in `vercel.json` deletes ID photos after 7 days.
6. Add moderator accounts: `insert into moderators (user_id) values ('<auth user id>');`

## Not built yet

- Phone OTP: deferred until an SMS provider is chosen. Sign-in is email-only.
- Takedown and appeal form for published flags (next).
- Photo uploads on facility posts (needs storage with face blurring and location stripping).
