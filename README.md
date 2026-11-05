# Bella's Safari

A shared baby-care tracker for Bella, a premature baby, used by her parents and grandparents on iPhone and Android.
It's an installable web app (PWA): Vite + React + TypeScript + Tailwind, with Supabase for the database, sign-in, live sync, photos and push reminders.

- **Live app:** <https://tomrldavies-netizen.github.io/Bella/>
- **What it does:** see `SPEC.md`. **How it's built:** see `docs/how-it-works.md`.
- **Setting up Supabase:** `docs/supabase-setup.md`. **Reminders:** `docs/reminders-setup.md`.

The app records care. It never suggests doses, feed volumes or clinical actions; parents enter the plan agreed with Bella's clinical team.

## Run locally

```sh
npm install
cp .env.example .env.local      # fill in the Supabase URL, anon key and VAPID public key
npm run dev                     # http://localhost:5173/Bella/
```

## Checks

```sh
npm run lint
npm test                        # unit, screen and accessibility tests (Vitest)
npm run build                   # type-check and production build into dist/
DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db   # migrations + database tests (plain Postgres 16)
```

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`: database tests, lint, unit tests and build, then publishes to GitHub Pages.
Database changes are SQL files in `supabase/migrations/`, run once each, in order, in the Supabase SQL editor (see the table in `docs/supabase-setup.md`).
The reminder server function is `supabase/functions/send-reminders`, deployed in the Supabase dashboard.
