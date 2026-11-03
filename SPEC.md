# Bella's Safari — Build Spec

A shared baby-care tracker for two parents caring for a premature baby at home. Phone and tablet, live sync between devices, push reminders, soft pastel cartoon safari theme.

Give this file to Claude Code as `SPEC.md` in the repo root and build in the phases at the bottom.

---

## 1. Goals

- Two parents (Mum, Dad) and helpers (e.g. grandparents) log care from their own phones, a mix of iPhone and Android, and see each other's entries instantly.
- Parents can change Bella's plan (feeds, medicines, exercises, routines) in the app, and everyone is told when it changes.
- One glance answers "what's due next?" and "what's happened today?"
- Logging anything takes one or two taps, one-handed, at 3am.
- Works on phones and tablets (portrait and landscape), installable to the home screen.
- Private: only the two parents can see any data.

Non-goals: no clinical decision-making, no dose calculation, no sharing outside the household (v1).

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Front end | Vite + React + TypeScript | Fast, static output for GitHub Pages |
| Styling | Tailwind CSS with the theme tokens in §7 | Responsive layouts are simple |
| App shell | PWA via `vite-plugin-pwa` | Home-screen install, offline cache, required for iPhone push |
| Backend | Supabase (free tier): Postgres, Auth, Realtime, Edge Functions | Live sync between phones without running a server |
| Auth | Supabase magic-link email, allow-list of two emails | No passwords to remember |
| Push | Web Push (VAPID) sent from a Supabase Edge Function, triggered by `pg_cron` every minute | Reminders reach both phones even when the app is closed |
| Charts | Recharts (or plain SVG) | Growth chart, daily feed bars |
| Hosting | GitHub Pages, deployed by GitHub Actions on push to `main` | Free |
| Routing | `HashRouter` (or a `404.html` redirect) | GitHub Pages has no server-side routing |

Notes:
- The app is a PWA, so it works on both iPhone and Android with no app store.
  - iPhone: open the link in Safari → Share → Add to Home Screen. Push only works when opened from the Home Screen (iOS 16.4+).
  - Android: open the link in Chrome → Install app (or ⋮ → Add to Home screen). Push works in Chrome.
  - Detect the platform and show the matching install steps on first open, then ask for notification permission.
- Supabase URL and anon key go in GitHub Actions secrets and are injected at build time. Never commit real data or keys.
- The repo can be public; the data is protected by Supabase Auth and Row Level Security. Making the repo private is still sensible.

---

## 3. Users and household

- One `household` with one `baby` (Bella) and several `members`, each with a display name, colour and **role**:
  - **Parent** (Mum peach `#FBE3D3`, Dad sky `#DCEBF2`): change the plan, log care, invite and remove people.
  - **Helper** (e.g. Grandma lilac `#ECE4F5`, Grandad sand `#FBF0CF`): see everything, log feeds, nappies, meds given, obs and exercises; cannot change doses, the feed plan, exercises or routines, and cannot invite people.
- Invites: a parent creates an invite (name + role); the app generates a link to send by text or WhatsApp. Opening the link signs the person in by magic link and joins them to the household. Invites expire after 7 days and can be resent or cancelled. Parents can remove a member at any time.
- The two-email allow-list is replaced by invites: only invited emails can join.
- Every record stores `logged_by` (member) and `logged_at` (when it happened, editable) plus `created_at`.
- Every list shows a small name pill so you can see who did what.
- Enforce roles in the database (RLS), not just in the UI: plan tables are writable by parents only.

---

## 4. Features

### 4.1 Today (home)
- Header: Bella's name, actual age, corrected age (tap → Growth).
- **Up next**: horizontal cards with countdowns: next feed, next medicine, next obs, next appointment, tube change due.
- **Quick log**: Feed, Nappy, Meds, Obs, Tummy time, Note. Nappy logs in one tap via a bottom sheet (Wet / Dirty / Both).
- **Today timeline**: everything logged since midnight, newest first, with who logged it. Tap to edit or delete.
- Link to Daily summary.

### 4.2 Feeds (NG tube)
- Feed timer (start / pause / finish), shows "started at".
- Method: Tube only / Bottle + tube / Breast + tube.
- Volumes: "by mouth" ml and "via tube" ml with +/- steppers (5 ml steps, long-press for 1 ml). Show total vs planned volume and % by mouth.
- Milk: Expressed / Formula, Fortifier on/off.
- Sick or reflux: None / Posset / Small / Large, optional note.
- **Planned feed**: the Feeds screen and the Up next card show what the next feed should be, from the feed plan (e.g. "00:00 · 50 ml breast milk"). Logging a feed pre-fills milk type and planned volume from that slot.
- The feed plan itself is edited in Bella's plan (§4.10).
- **NG tube card**: nostril (left/right), date inserted, retaped, planned change interval. "Log change" records a new tube. Reminder when a change is due.
- **Expressing log** (opened from Feeds header): pump session time, duration, volume per side, stored (fridge/freezer), freezer stock total.

### 4.3 Medicines
- Medicine list: name, dose, unit, route, times of day, start/end date, notes.
- Daily schedule generated from the list; each slot shows Given (with who and when) / Due / Missed.
- "Mark given" records the dose actually given. Prevent double-dosing: if a slot is already marked given, show who gave it and ask before logging again.
- **Edit dose** creates a new dose version with an effective date and reason (e.g. "after weigh-in"); history is kept and shown.
- **Prescriptions**: bottle size and dose per day → estimated days left; reorder reminder at a threshold (default 7 days).

### 4.4 Growth
- Weigh-ins: date, weight (g or kg), optional length and head circumference.
- **Corrected age**: from birth date and gestation at birth. Before 40 weeks show post-menstrual age ("36+2 wks"); after term show corrected age in weeks/months alongside actual age. Show days until due date.
- Weekly gain and g/day.
- **Preterm growth chart**: plot weight by post-menstrual / corrected age on the UK preterm chart (UK-WHO neonatal) or Fenton 2013. Claude Code must use the published reference data from the official source and check its licence, and must not invent centile values. Consider the RCPCH Digital Growth Charts API as an alternative.
- **Bella's firsts**: free-text milestones with dates and an optional photo.

### 4.5 Care
- **Obs checklist**: Temperature (°C stepper, 0.1 steps), Breathing & colour (Normal / Noisy / Pauses / Colour change), Sleep & settling (Settled / Unsettled / Very sleepy), note. Obs interval setting → "obs due" reminder. Highlight any non-normal entry in the timeline and summary.
- **Exercises**: physio and speech & language exercises from the plan, each showing its how-to steps and how often. Tap "Done" to log one; show progress dots for today (e.g. 2 of 3). Helpers can tick these off.
- **Tummy time**: timer with a daily goal (default 30 min) and progress bar.

### 4.6 Plan
- **Appointments**: date, time, who, where, notes. Each links to questions tagged for it.
- **Questions for the team**: quick add, tag to an appointment (or "any"), tick when answered, store the answer.
- **Supplies**: item, quantity, low-stock threshold, "order" flag; quick +/- buttons. Defaults: NG tubes, syringes, tube tape, fortifier.
- **Bath & skin care**: recurring tasks (e.g. bath day, skin check) with a tick-off.

### 4.7 Daily summary
- Day picker (previous / next).
- Totals: milk vs target and number of feeds, % by mouth, nappies (wet / dirty), medicines given vs scheduled, tummy time vs goal, sick/reflux count, obs normal vs flagged, weight if measured.
- Stacked bar chart of feeds through the day (mouth vs tube).
- Notes written that day.

### 4.8 Reminders (push)
- Reminder types: feed due, medicine due, obs due, tube change due, appointment (day before and 1 h before), supplies low, prescription reorder.
- Sent to both parents. When one parent logs the item, the reminder is cleared for the other.
- Per-member settings: which reminder types, quiet hours, lead time (e.g. 10 min before).
- In-app countdowns as well, in case push is not enabled.

### 4.9 Offline
- Cache the app shell. Queue writes made offline and sync when back online, newest edit wins.

### 4.10 Bella's plan (parents edit, helpers view)
Opened from a "Bella's plan" button on Today. Helpers see it read-only.

- **Feed plan**: a list of feed slots for the day. Each slot has a **time**, a **milk type** (Breast milk / Formula / Mix) and an **amount (ml)**.
  - Tap the milk type to switch it; +/- changes the amount in 5 ml steps.
  - "Set all to breast milk / formula" for quick changes. Add, remove or move feed times.
  - Shows the day total and the count of each milk type.
  - Changes start from a chosen time (default: the next feed). Old plans are kept as history, so past feeds still show what was planned at the time.
- **Medicines**: pick a medicine (or add a new one) and edit name, dose (0.1 ml steps), route (by mouth / via tube / either), times each day, start and end date, and a "why it changed" note. A dose change creates a new version from a chosen time; the previous dose stays in history ("was 1.0 ml until 19 Oct"). The Meds schedule (§4.3) is generated from this.
- **Exercises**: two tabs, Physio and Speech & language. Each exercise has a name, numbered **how-to steps** (add, edit, reorder, delete) and **how often** (times a day). Add new exercises or retire old ones.
- **Obs & routines**: obs interval, tummy time daily goal, NG tube change interval, bath day and other care tasks.
- **Family & sharing**: §3 (members, roles, invites, install help).
- **Recent changes**: a list of every plan change: what changed, who changed it, when, and who hasn't seen it yet.

### 4.11 Change notifications
- When a parent saves a plan change, "Tell everyone about this change" is on by default.
- Everyone else gets a push notification ("Bella's plan changed: 06:00 and 15:00 feeds are now formula, 50 ml") and a **"Bella's plan has changed"** banner at the top of Today. The banner stays until that person taps "Got it".
- Record who has seen each change, shown in Recent changes.
- Write the change summary automatically from the before/after values, in plain words.

---

## 5. Data model (Supabase / Postgres)

All tables include `id uuid pk`, `household_id`, `created_at`, `updated_at`. Log tables also include `logged_by` (member id) and `logged_at` (timestamptz).

- `households`
- `members` (user_id → auth.users, display_name, colour, role: 'parent' | 'helper', active)
- `invites` (display_name, role, email, token, expires_at, accepted_at, created_by)
- `babies` (name, birth_date, gestation_weeks, gestation_days, due_date)
- `settings` (obs_interval_min, tummy_goal_min, tube_change_days)
- `feed_plans` (effective_from, created_by, note) — one row per version of the plan
- `feed_plan_slots` (feed_plan_id, time_of_day, milk_type: 'breast' | 'formula' | 'mix', volume_ml)
- `plan_changes` (area: 'feeds' | 'medicines' | 'exercises' | 'routines', summary, before jsonb, after jsonb, changed_by, notify bool)
- `plan_change_seen` (plan_change_id, member_id, seen_at)
- `feeds` (feed_plan_slot_id null, started_at, ended_at, method, oral_ml, tube_ml, milk_type, fortified, sick_level, note)
- `tube_changes` (nostril, inserted_at, retaped_at, note)
- `expressing_sessions` (duration_min, left_ml, right_ml, storage)
- `nappies` (wet bool, dirty bool, note)
- `medicines` (name, route, active, notes)
- `medicine_doses` (medicine_id, dose, unit, route, times text[], effective_from, effective_to, reason, created_by)
- `medicine_given` (medicine_id, scheduled_for, given_at, dose_given)
- `prescriptions` (medicine_id, bottle_volume, opened_at, reorder_threshold_days)
- `weights` (measured_on, weight_g, length_cm, head_cm)
- `milestones` (title, date, photo_url)
- `obs` (temperature_c, breathing, sleep, note)
- `exercises` (type: 'physio' | 'speech_language', name, per_day, active, sort_order)
- `exercise_steps` (exercise_id, position, text)
- `exercise_logs` (exercise_id)
- `tummy_time` (duration_min)
- `appointments` (starts_at, with_whom, location, notes)
- `questions` (text, appointment_id null, answered bool, answer)
- `supplies` (name, quantity, low_threshold)
- `care_tasks` (name, recurrence) and `care_task_logs`
- `notes` (text)
- `push_subscriptions` (member_id, endpoint, keys, settings jsonb)
- `reminders_sent` (type, ref_id, due_at, cleared_at)

Row Level Security on every table: a row is readable only by active members of its household.
- **Log tables** (feeds, nappies, medicine_given, obs, exercise_logs, tummy_time, notes, etc.): writable by parents and helpers.
- **Plan tables** (feed_plans, feed_plan_slots, medicines, medicine_doses, prescriptions, exercises, exercise_steps, settings, care_tasks, appointments, supplies): writable by parents only.
- **members, invites**: writable by parents only. Helpers can update their own push settings.
- `plan_change_seen`: each member can insert their own rows.

Enable Realtime on all log tables, `plan_changes` and the plan tables.

---

## 6. Screens and layout

- **Phone** (< 768 px): bottom tab bar — Today, Feeds, Meds, Growth, Care. Plan and Daily summary open from Today.
- **Tablet** (≥ 768 px): left navigation rail with all sections; Today becomes two columns (up next, quick log, timeline | today's totals, next appointment, running low).
- Touch targets at least 44 px. Large numerals for volumes and timers. Steppers instead of keyboards wherever possible.
- Respect `prefers-reduced-motion`; keep animal animations subtle.

- Plan editing screens have a back link to Bella's plan at the top, and a fixed bar at the bottom with the "Tell everyone" toggle and Save.
- Helpers see the same tabs. Plan screens open read-only for them, with no edit controls.

The mockup (Claude Design canvas) shows: Today, Feeds, Medicines, Growth, Care, Plan, Daily summary, Tablet home, Bella's plan, Edit feed plan, Edit medicine, Edit exercises (physio + speech & language), Family & sharing, and Today as a helper sees it (with the "plan has changed" banner).

---

## 7. Theme — soft pastel safari

Fonts (Google Fonts): **Baloo 2** (headings, numbers) and **Nunito** (body).

| Token | Hex | Use |
|---|---|---|
| sand (background) | `#FBF6EC` | App background |
| card | `#FFFFFF` with border `#EFE4D2` | Cards |
| ink | `#3B3127` | Main text |
| ink-muted | `#5C5146` | Secondary text |
| primary | `#3F6B4B` | Primary buttons, active nav |
| alert | `#A2502F` | Due / low-stock text |

Each section has an animal guide and a pastel tint:

| Section | Animal | Tint | Accent |
|---|---|---|---|
| Feeds | Baby elephant | `#DCEBF2` | `#7FA9C1` |
| Nappies | Hippo | `#ECE4F5` | `#A994C4` |
| Medicines | Lion cub | `#FBE3D3` | `#E9A06B` |
| Growth | Giraffe | `#FBF0CF` | `#D9B45A` |
| Obs | Meerkat | `#E3EFE4` | `#8DB596` |
| Physio and tummy time | Monkey | `#F8E1E4` | `#B5677D` |
| Speech & language | Hornbill | `#DDF0EE` | `#6FA89F` |
| Bella's plan | Clipboard on peach | `#FCE9D6` | `#3F6B4B` |
| Plan change banner | — | `#FFF7E0` | `#D9B45A` |
| Plan | Zebra | `#E6E9F4` | `#9AA3C7` |

Home header: savanna scene (sun, rolling hills, acacia tree) with the elephant. Animals are simple flat SVG faces; keep them as React components in `src/animals/`.

---

## 8. Build phases

1. **Scaffold**: Vite + React + TS + Tailwind + PWA, theme tokens, fonts, responsive shell (bottom tabs / side rail), GitHub Actions deploy to Pages.
2. **Supabase**: schema + role-aware RLS migrations, magic-link login, household + baby setup screen, Realtime subscriptions.
3. **Bella's plan**: feed plan with per-slot milk type and amount, medicines with dose versions, exercises (physio + speech & language), routines. Build this before logging, because logging reads from the plan.
4. **Core logging**: Today, Feeds (pre-filled from the plan, incl. NG tube card), Nappies, Medicines schedule from the plan.
5. **Care and growth**: Obs, Exercises tick-off, Tummy time, Weigh-ins, corrected age, preterm chart with official reference data.
6. **Family**: invites, parent/helper roles, read-only plan for helpers, platform-specific install help.
7. **Plan, summary and changes**: Appointments, Questions, Supplies, Care tasks, Daily summary, Expressing log, Firsts, Recent changes, "plan has changed" banner.
8. **Reminders**: push subscription, Edge Function + `pg_cron`, clear-on-log, plan-change pushes, per-member settings. Test on one iPhone and one Android phone.
9. **Polish**: offline queue, animations, accessibility pass.

Suggested first prompt for Claude Code:

> Read SPEC.md. Start with phase 1: scaffold the app, set up the theme and responsive shell, and add a GitHub Actions workflow that deploys to GitHub Pages. Ask me before choosing anything the spec leaves open.

---

## 9. Safety note

The app is a record-keeping aid. It follows the plan from Bella's clinical team and never suggests doses, volumes or clinical actions. Doses, feed amounts and exercises are entered and changed by the parents only, copied from what the team has agreed.
