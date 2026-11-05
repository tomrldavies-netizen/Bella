# How Bella's Safari works

A short map for whoever works on the app next.

## The pieces

| Piece | Where | Notes |
|---|---|---|
| App | `src/` | React + TypeScript, Tailwind v4 theme tokens in `src/index.css`. Hash routes (`#/feeds`) for GitHub Pages. |
| Screens | `src/screens/` | Today is in the main bundle; every other screen loads on first open (`src/routes.tsx`). |
| Bella's plan | `src/plan/`, `src/screens/plan/` | Feed plan versions, medicine dose versions, exercises, routines. Saves go through `save_*` database functions. |
| Care logging | `src/care/` | Feeds, nappies, medicines given, obs, tummy time, NG tube. `useToday()` loads a UK day (midnight to midnight). |
| Plan screen, summary, expressing, firsts | `src/organise/`, `src/growth/` | |
| Family and invites | `src/family/`, `src/screens/Family.tsx` | |
| Reminders | `src/reminders/`, `src/sw.ts`, `supabase/functions/send-reminders/` | See below. |
| Offline | `src/offline/` | See below. |
| Database | `supabase/migrations/` | Tables, Row Level Security and functions, one file per phase. |
| Database tests | `supabase/tests/` | Plain Postgres with a small stand-in for Supabase's auth schema. |

## Who can do what

Enforced by Row Level Security in the database, not just hidden in the app:
- **Parents** can do everything: change the plan, invite and remove people, log care.
- **Helpers** see everything and log care, change supply counts, tick care tasks and add questions. They can't change the plan, doses, people or invites.
- Nobody outside the household sees anything. Joining needs an invite for that exact email.
- Every log entry records who made it (`logged_by`), stamped by the database.

## Times

Plan times ("06:00 feed") are UK time (Europe/London), whatever the phone's own time zone. Day boundaries are UK midnight.
Helpers are in `src/lib/ukTime.ts` and `src/lib/age.ts`, and `app.uk()` in SQL.

## Reminders

1. Supabase Cron calls the `send-reminders` Edge Function every minute (with the `x-cron-secret` header).
2. It calls `reminder_run()` in the database, which works out what's due, records each reminder once in `reminders_sent`,
   and returns notifications per phone, respecting each person's settings (`members.reminder_settings`).
   Quiet hours never silence medicines.
3. The function sends them with Web Push (VAPID keys in Edge Function secrets). `src/sw.ts` shows them.
4. When something is logged, its reminder is cleared. Anyone already notified gets a quiet "✓ done" replacement (same notification tag).
5. **Alarm mode** (per phone, feeds and medicines only, `reminder_settings.alarm`). The first notice stays on screen
   (`requireInteraction`) and has Snooze 5 min / Stop buttons where the phone supports them. From the due time it re-rings
   every 2 minutes for up to 20 minutes until the item is logged, snoozed or stopped (`reminder_alarms` table,
   `alarm_action()` and `my_alarms()` functions). With the app open, a full-screen alarm with sound shows instead.
   During quiet hours or work hours (`reminder_settings.work`) alarms fall back to one ordinary notification.
   iPhones can't vibrate from the web, show no action buttons, and silent mode mutes it: there it's a repeating notification.

## Overdue

`src/care/overdue.ts` works out what's past its time (planned feeds not logged, doses due or missed, obs, tube change,
care tasks). Today shows them at the top: amber "Due now" from the due time, red "Overdue" once 15 minutes late,
with how late and a button to log it. The tabs get a red dot and the home-screen icon a badge count where supported.

## Offline

- The service worker keeps the app on the phone; `src/offline/cache.ts` keeps the last-loaded data, so it opens with no signal.
- Writes go through `runOrQueue()` (`src/offline/outbox.ts`). Without signal they're kept on the phone and sent in order
  when it returns. Inserts carry their own id, so a retry can't duplicate. The newest edit wins.
- A dose marked given offline is recorded when it syncs. If someone else also gave it, it's still recorded and flagged.
- Plan edits, invites and photos need signal.

## Accessibility

- `src/a11y.test.tsx` runs axe on every screen in the unit tests.
- Colour contrast and touch targets were checked in Chromium with axe: no issues, and tap targets are 44 px.
- Animations are gentle and switch off with "Reduce motion".

## Not done yet / known gaps

- **Growth centile lines** need official preterm reference data (RCPCH API subscription, or RCPCH's AGPL-licensed tables after confirming the data terms).
- **"Send a test"** in Reminders looks the server function up by name. If the function's address isn't `.../functions/v1/send-reminders`, the test button shows an error, though scheduled reminders still work.
