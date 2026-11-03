# Bella's Safari

A baby-care tracker PWA for a premature baby, shared by her parents and grandparents (iPhone and Android). Built with Vite + React + TypeScript + Tailwind, Supabase backend, hosted on GitHub Pages.

## Read first
- `SPEC.md` is the source of truth for features, data model, roles, theme and build phases. Follow its phases in order.
- `mockups/` holds the approved screen designs, one file per screen (390×844 phone screens, plus `Tablet.dc.html` at 1180×820). Match their layout, copy, colours, fonts, spacing and animal SVGs.
  - They are design files, not app code: ignore `support.js`, `<x-dc>`, `<helmet>`, `<sc-for>`, `<sc-if>` and the `DCLogic` script blocks. Read the markup and inline styles for the look.
  - `Main.dc.html` is the Today screen; `HelperToday.dc.html` is Today for a helper; the others are named after their screen.
  - Sample numbers and names in the mockups are placeholders, not real data.
  - Reuse the animal SVGs from the mockups as React components in `src/animals/`.

## How to work
- Before each phase, outline what you'll build and wait for my OK.
- Ask before choosing anything SPEC.md leaves open.
- Never commit secrets. Supabase URL and anon key come from environment variables (`.env.local` locally, GitHub Actions secrets for deploys). Keep `.env.local` in `.gitignore`.
- Put database changes in `supabase/migrations/` as SQL files, including Row Level Security policies. Enforce parent vs helper roles in RLS, not only in the UI.
- Use `HashRouter` so routes work on GitHub Pages.
- Write plain-English steps for anything I need to do by hand (Supabase dashboard, GitHub settings, secrets), and tell me when to do it.
- After each phase: run the build and tests, commit with a clear message, and tell me how to check it on my phone.

## Safety
The app records care. It never suggests doses, feed volumes or clinical actions. Parents enter the plan agreed with Bella's clinical team.
