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
- `test/`: unit tests and database tests.

## Not built yet

- Sign-in (phone OTP) and student verification screens: need the Supabase project and an SMS provider.
- Flag reports, the review panel workflow and staff right of reply (Phase 2).
- Photo uploads on facility posts (needs storage with face blurring and location stripping).
