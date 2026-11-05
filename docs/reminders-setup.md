# Turning on push reminders (phase 8)

About 20 minutes, once. Do it on a computer if you can: there's some copying and pasting.
Anything in `CAPITALS` is something you fill in.

## 1. Run the database update

Supabase → **SQL Editor** → **New query** → paste the whole of
[`20261109000000_phase8_reminders.sql`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261109000000_phase8_reminders.sql)
(**Copy raw file** button) → **Run** → "Success. No rows returned".

## 2. Make the reminder keys (in the app)

1. Open the app (on the computer is easiest) → **Bella's plan → Family & sharing**.
2. In the **Reminders** card, tap **making the reminder keys** → **Make the keys**.
3. Leave that page open. You'll copy three values from it:
   - `VAPID_PUBLIC_KEY`: safe to share.
   - `VAPID_PRIVATE_KEY`: secret. It goes **only** into Supabase.
   - `CRON_SECRET`: secret. It goes **only** into Supabase.

The keys are made in your browser and aren't sent anywhere. If you lose the page before finishing, just make new ones.

## 3. Add the public key to GitHub

<https://github.com/tomrldavies-netizen/Bella/settings/secrets/actions> → **New repository secret**:
- Name `VITE_VAPID_PUBLIC_KEY`, value: the `VAPID_PUBLIC_KEY`.

Then re-run the deploy: <https://github.com/tomrldavies-netizen/Bella/actions/workflows/deploy.yml> → **Run workflow**.

## 4. Add the secrets to Supabase

Supabase → **Edge Functions** (left sidebar) → **Secrets** (or *Manage secrets*) → add each of these:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | the public key |
| `VAPID_PRIVATE_KEY` | the private key |
| `CRON_SECRET` | the cron secret |
| `VAPID_SUBJECT` | `mailto:YOUR EMAIL` (e.g. `mailto:tom@example.com`) |

Click **Save**.

## 5. Create the server function

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly **`send-reminders`**.
3. Delete the example code, then paste the whole of
   [`supabase/functions/send-reminders/index.ts`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/functions/send-reminders/index.ts)
   (**Copy raw file**).
4. Click **Deploy function**.
5. Open the function's **Details** (or **Settings**) and turn **off** "Enforce JWT verification" (also called *Verify JWT*). Save.
   The function checks callers itself (the cron secret, or a signed-in family member for "Send a test").

## 6. Run it every minute

1. Supabase → **Integrations** → **Cron**. If asked, click **Enable pg_cron**.
2. **Create job**:
   - **Name:** `send-reminders`
   - **Schedule:** `* * * * *` (every minute)
   - **Type:** *Supabase Edge Function*
   - **Method:** POST, **Edge Function:** `send-reminders`
   - **HTTP headers:** add `x-cron-secret` with the value of your `CRON_SECRET`
   - **Timeout:** 5000 ms
3. **Create cron job**.

<details>
<summary>If your dashboard has no Cron page: do it with SQL instead</summary>

Supabase → **Database → Extensions**: enable **pg_cron** and **pg_net**. Then in the **SQL Editor** run:

```sql
select cron.schedule('send-reminders', '* * * * *', $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR CRON SECRET'),
    body := '{}'::jsonb
  )
$$);
```

`YOUR-PROJECT-REF` is the part of your Project URL before `.supabase.co`.
</details>

**Check it's running:** Edge Functions → `send-reminders` → **Logs** or **Invocations** should show a call every minute, each with status 200.

## 7. Turn reminders on, on each phone

Each person, on their own phone:

1. Open the app **from the Home Screen** (on iPhone this is required; reminders don't work in Safari itself).
2. **Bella's plan → Family & sharing → Reminders → Turn on reminders** → **Allow**.
3. Tap **Send a test**. A notification should arrive within a few seconds.
4. Choose which reminders you want, how many minutes before, and quiet hours (medicines always come through), then **Save reminder settings**.

## Testing on an iPhone and an Android phone

With one iPhone and one Android phone both turned on:

- [ ] **Send a test** arrives on each phone.
- [ ] **Feed:** with a feed planned soon, the reminder arrives 10 minutes before (or your chosen time).
- [ ] **Medicine:** the reminder arrives before a dose. Mark it given on the *other* phone, and within a minute the first phone's notification changes to "✓ … given by …" without buzzing.
- [ ] **Logged early:** mark a dose given before its reminder time, and no reminder comes at all.
- [ ] **Quiet hours:** set quiet hours on one phone. A feed reminder doesn't come, but a medicine reminder does.
- [ ] **Plan change:** change the plan on one phone with "Tell everyone" on. The other phone gets "Bella's plan changed"; the phone that made the change doesn't.
- [ ] **Tap a notification:** the app opens on the right screen.
- [ ] **Open the app:** old notifications are tidied away.

If something doesn't arrive, check the function's **Logs** in Supabase. Errors appear there, e.g. a missing secret.
