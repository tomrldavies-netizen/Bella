# send-reminders

Supabase Edge Function that sends Bella's Safari push reminders. The "what's due"
logic lives in the database (`reminder_run()` in `supabase/migrations/20261109000000_phase8_reminders.sql`),
so this function only fetches and sends. Setup steps: `docs/reminders-setup.md`.
