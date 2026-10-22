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
npm run build
```

## Layout

- `data/institutions-seed.csv`: 513 institutions with ownership, state and source. Incomplete against official
  NUC / NBTE / NCCE totals; add rows here and rerun `npm run seed`.
- `supabase/migrations/0001_init.sql`: database schema with row-level security.
- `supabase/seed.sql`: generated institution inserts.
- `src/app`: the Next.js app (institution search and institution pages so far).
