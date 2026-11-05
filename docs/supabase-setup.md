# Connecting Bella's Safari to Supabase (phase 2)

Do these steps once, in order. It takes about 15 minutes. Anything in `CAPITALS` is something you fill in.

## 1. Create the Supabase project

1. Go to <https://supabase.com> and sign up (the free plan is enough).
2. Click **New project**.
   - **Name:** `bella`
   - **Database password:** click **Generate a password** and save it in your password manager. The app doesn't need it, but you might later.
   - **Region:** **West EU (London)**
3. Click **Create new project** and wait a minute or two for it to finish.

## 2. Create the database tables

1. Open the migration file on GitHub:
   <https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261103000000_phase2_schema.sql>
   and click the **Copy raw file** button (two overlapping squares, top right of the file).
2. In Supabase, open **SQL Editor** (left sidebar) → **New query**.
3. Paste the whole file and click **Run**.
4. You should see **Success. No rows returned**. If you see an error, send me a screenshot and don't run it again.
   - If Supabase warns that the query "contains destructive operations" or asks about RLS, click **Run this query**. That's expected.

## 3. Close sign-ups, so only people you add can sign in

> **From phase 6 this changes:** sign-ups go back **on** so invited family can create an account. See "Phase 6: invites" below.

1. **Authentication** → **Sign In / Providers**.
2. Under **User Signups**, turn **off** “Allow new users to sign up”. Click **Save**.
3. Check **Email** is enabled in the provider list below (it is by default).

## 4. Put the 6-digit code in the sign-in email

Supabase only lets you change its emails once it sends them through your own email account
("custom SMTP"). A Gmail account works and is free. It also lifts Supabase's limit on who can
receive sign-in emails, which the grandparents will need later.

### 4a. Make a Gmail app password

1. Turn on 2-Step Verification for the Gmail account, if it isn't already: <https://myaccount.google.com/signinoptions/twosv>
2. Go to <https://myaccount.google.com/apppasswords>.
3. Name it `Bella Supabase` and click **Create**.
4. Copy the 16-letter password it shows (ignore the spaces). You won't see it again.

### 4b. Tell Supabase to send through Gmail

1. **Authentication** → **Emails** → **SMTP Settings** tab (or click **Set up SMTP** on the template page).
2. Turn on **Enable custom SMTP** and fill in:
   - **Sender email:** YOUR GMAIL ADDRESS
   - **Sender name:** `Bella's Safari`
   - **Host:** `smtp.gmail.com`
   - **Port:** `587`
   - **Username:** YOUR GMAIL ADDRESS
   - **Password:** the 16-letter app password
   - Leave **Minimum interval** as it is.
3. Click **Save changes**.

### 4c. Edit the template

1. **Authentication** → **Emails** → **Templates** → **Magic link or OTP**.
2. Set **Subject** to `Your code for Bella's Safari`.
3. Replace the **Body** with:

   ```html
   <h2>Bella's Safari</h2>
   <p>Your sign-in code is:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Type it into the app. It works once and expires in an hour.</p>
   <p>Or, if you're in the same browser you asked from, <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
   ```

4. Click **Save**.

## 5. Tell Supabase where the app lives

1. **Authentication** → **URL Configuration**.
2. **Site URL:** `https://tomrldavies-netizen.github.io/Bella/` and click **Save**.
3. Under **Redirect URLs** click **Add URL** and add both:
   - `https://tomrldavies-netizen.github.io/Bella/`
   - `http://localhost:5173/Bella/`

## 6. Add yourself as a user

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. **Email:** YOUR EMAIL. **Password:** anything long. You'll never use it; you sign in with codes.
3. Tick **Auto Confirm User**, then **Create user**.

## 7. Copy the two keys into GitHub

1. In Supabase: **Project Settings** (cog, bottom left) → **API Keys**. Note:
   - the **Project URL**: just `https://abcdefgh.supabase.co`, with nothing after `.co`. (Under **Project Settings → Data API** it may be shown with `/rest/v1/` on the end; leave that part off.)
   - the **publishable** key (starts `sb_publishable_`), or, if your project shows the older keys, the **anon public** key.
   - **Never** use the `secret` or `service_role` key in the app.
2. In GitHub: <https://github.com/tomrldavies-netizen/Bella/settings/secrets/actions> → **New repository secret**, twice:
   - Name `VITE_SUPABASE_URL`, value: the Project URL.
   - Name `VITE_SUPABASE_ANON_KEY`, value: the publishable (or anon) key.

## 8. Redeploy

1. <https://github.com/tomrldavies-netizen/Bella/actions/workflows/deploy.yml> → **Run workflow** → **Run workflow**.
2. Wait for the green tick (about 2 minutes).

## 9. Sign in and set up

1. On your phone open <https://tomrldavies-netizen.github.io/Bella/> (or the home-screen app; pull down or reopen it so it picks up the new version).
2. Enter your email → **Email me a code** → type the code from the email.
3. Fill in your name and colour, and Bella's date of birth and gestation at birth → **Start Bella's safari**.

## Phase 6: invites

Do these once, after running the phase 6 SQL file (table below).

1. **Turn sign-ups back on.** Authentication → Sign In / Providers → **User Signups** → turn **on** "Allow new users to sign up" → **Save**.
   This is safe: a new account sees nothing at all unless it joins with a valid invite sent to that exact email,
   and no one can start a second household.
2. **Make sure step 4 (Gmail SMTP) is done.** Without it, Supabase only emails people on your Supabase team, so grandparents wouldn't get their codes.
3. In the app: **Bella's plan → Family & sharing → Invite someone**. Enter their name and email, choose Helper or Parent,
   then **Share invite** and send it by WhatsApp or text. Their link works for 7 days, once, and only for that email.

This replaces the old SQL snippet for adding your wife: invite her as a **Parent** instead.

## Running the app on a computer (optional)

Copy `.env.example` to `.env.local` and fill in the same two values. `.env.local` is never committed.

## Database updates in later phases

Some phases add a new SQL file to `supabase/migrations/`. Run each one **once, in order**, the same way as step 2
(SQL Editor → New query → paste the whole file → Run → "Success. No rows returned").

| Phase | File | What it adds |
|---|---|---|
| 2 | `20261103000000_phase2_schema.sql` | Tables, roles and security rules |
| 3 | [`20261104000000_phase3_plan.sql`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261104000000_phase3_plan.sql) | Saving Bella's plan (feeds, medicines, exercises, routines) |
| 4 | [`20261105000000_phase4_logging.sql`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261105000000_phase4_logging.sql) | Double-dose check when marking a medicine given |
| 5 | [`20261106000000_phase5_care.sql`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261106000000_phase5_care.sql) | Normal temperature range in Obs & routines |
| 6 | [`20261107000000_phase6_family.sql`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261107000000_phase6_family.sql) | Invites, joining, own name and colour, one household only |
| 7 | [`20261108000000_phase7_plan_summary.sql`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261108000000_phase7_plan_summary.sql) | Prescriptions, supply counts for helpers, freezer stock, private photo storage for Bella's firsts |
| 8 | [`20261109000000_phase8_reminders.sql`](https://github.com/tomrldavies-netizen/Bella/blob/main/supabase/migrations/20261109000000_phase8_reminders.sql) | Push reminders. Then follow [`docs/reminders-setup.md`](reminders-setup.md) |

After running the phase 7 file, check **Storage** in the Supabase sidebar: there should be a bucket called **firsts** marked **Private**. Don't make it public.

If a file has already been run, running it again gives an error like "already exists". That's harmless, but nothing more is needed.
