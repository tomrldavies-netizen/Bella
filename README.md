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
```

Copy `.env.example` to `.env.local` for Supabase settings (from phase 2). Never commit `.env.local`.

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`, which tests, builds and publishes to GitHub Pages.
