# Bella's Safari

A shared baby-care tracker for Bella, built as a PWA (Vite + React + TypeScript + Tailwind).
See `SPEC.md` for the full spec and `CLAUDE.md` for how the project is built.

Live site: https://tomrldavies-netizen.github.io/Bella/

## Run locally

```sh
npm install
npm run dev        # http://localhost:5173/Bella/
npm test           # unit tests
npm run build      # production build into dist/
DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db   # migrations + RLS tests
```

Copy `.env.example` to `.env.local` for the Supabase URL and anon key. Never commit `.env.local`.

## Database

- `supabase/migrations/`: schema and Row Level Security, applied by pasting into the Supabase SQL editor.
- `supabase/tests/`: RLS tests, run against plain Postgres (`00_supabase_stub.sql` stands in for Supabase's auth schema).
- `docs/supabase-setup.md`: step-by-step setup of the Supabase project.

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which runs the database tests, lint, unit tests and build, then publishes to GitHub Pages.
