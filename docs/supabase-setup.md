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

1. **Authentication** → **Sign In / Providers**.
2. Under **User Signups**, turn **off** “Allow new users to sign up”. Click **Save**.
3. Check **Email** is enabled in the provider list below (it is by default).

## 4. Put the 6-digit code in the sign-in email

1. **Authentication** → **Emails** → **Templates** tab → **Magic Link**.
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
   - the **Project URL** (looks like `https://abcdefgh.supabase.co`). If it's not on this page, it's under **Project Settings → Data API**.
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

## Later: adding your wife as a second parent

Until invites arrive in phase 6:

1. Add her as a user as in step 6.
2. In **SQL Editor** → **New query**, paste this, put her email in, and click **Run**:

   ```sql
   insert into public.members (household_id, user_id, display_name, colour, role)
   select (select id from public.households order by created_at limit 1), id, 'Mum', '#FBE3D3', 'parent'
   from auth.users
   where email = 'HER EMAIL';
   ```

   It should say **Success. 1 row** (or similar). If it says 0 rows, the email doesn't match the user you created.
3. She can now sign in with a code on her own phone.

## Running the app on a computer (optional)

Copy `.env.example` to `.env.local` and fill in the same two values. `.env.local` is never committed.
