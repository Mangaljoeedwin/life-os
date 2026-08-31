# Life OS Web App v1

Phase 2 turns the former single-file prototype into a responsive static web app with Supabase authentication, row-level security, persistence and realtime cross-device updates. It is ready for GitHub Pages and deliberately excludes Phase 3 PWA/offline behavior.

## 1. Prepare Supabase

1. Open your Supabase project.
2. Open **SQL Editor**, create a new query, paste the full contents of `supabase/schema.sql`, and run it once.
3. In **Authentication → Providers → Email**:
   - Keep **Email provider** ON.
   - For the quickest first test, temporarily turn **Confirm email** OFF.
   - Click **Save** if Supabase shows a Save button.
4. Stop here. You do **not** create the Life OS account in Supabase. You will create it from the Life OS welcome screen after completing steps 2 and 3 below.

The schema includes private per-user access policies and Realtime registration. Never put a Supabase service-role key in this app or in GitHub.

## 2. Get the two Supabase connection values

1. In Supabase, open **Project Settings** using the gear icon near the bottom of the left sidebar.
2. Open **API**. In some versions of the Supabase dashboard, this may be labelled **Data API** or **API Keys**.
3. Copy the **Project URL**.
4. Copy the **Publishable key**. If your dashboard shows the older key names, copy **anon public**.
5. Never copy or share the **service_role** or secret key.

## 3. Connect and open Life OS on the Mac

Copy `.env.example` to `.env.local`, then fill in:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
```

You can find both values in **Supabase → Project Settings → API**. The anon/publishable key is safe for a browser when Row Level Security remains enabled.

Run:

```bash
pnpm install
pnpm dev
```

Without those values, the app intentionally opens in interactive preview mode with sample data.

## 4. Create your Life OS account

This happens on the Life OS welcome screen, not in the Supabase dashboard.

1. Open the local Life OS address shown after `pnpm dev`—normally `http://localhost:5173`.
2. You should see a page headed **Life OS** with fields for **Email** and **Password**.
3. Click **New here? Create your account** near the bottom of that card.
4. Enter your email address.
5. Choose a password containing at least six characters.
6. Click **Create account**.
7. Because **Confirm email** is currently OFF, Life OS signs you in immediately. You do not need to open an email or click a confirmation link.

If you still see a **Preview mode** badge instead of this welcome screen, the two Supabase values in step 3 have not been connected correctly yet.

## 5. Publish with GitHub Pages

1. Create an empty GitHub repository and push this folder to its `main` branch.
2. In the repository, open **Settings → Secrets and variables → Actions**.
3. Add repository variable `VITE_SUPABASE_URL`.
4. Add repository secret `VITE_SUPABASE_ANON_KEY`.
5. Open **Settings → Pages** and choose **GitHub Actions** as the source.
6. Run the included **Deploy Life OS to GitHub Pages** workflow, or push to `main`.

GitHub will then give you an address resembling:

```text
https://YOUR-GITHUB-NAME.github.io/YOUR-REPOSITORY-NAME/
```

## 6. Add the final web address to Supabase

Do this only after GitHub Pages has given you the real Life OS address.

1. Return to **Supabase → Authentication → URL Configuration**.
2. Put the full GitHub Pages address in **Site URL**.
3. Add the same full address under **Redirect URLs**.
4. While testing on your Mac, also add `http://localhost:5173` under **Redirect URLs**.
5. Save the changes.

This URL configuration tells Supabase which Life OS webpages it is allowed to return you to after an authentication email or sign-in flow. Because email confirmation is currently OFF, it is not required for creating the first local test account.

## Phase 2 acceptance test

1. Sign into the same account on Mac and phone.
2. Add a one-time task on Mac; confirm it appears on the phone without refreshing.
3. Complete it on the phone; confirm it moves to the archive on Mac.
4. Complete a Daily To Do item. It is checked only for the current date; the database retains that date’s completion.
5. On the next date in the configured `Asia/Kolkata` timezone, the daily item is naturally unchecked because there is no completion row for the new date.
6. Confirm the prior date still shows as checked in **Health → habit history**.

## Data model

- `tasks`: daily, one-time and project-subtask definitions
- `daily_completions`: date-specific completion history and manual/COROS source
- `projects`: project containers
- `weight_entries`: one manual measurement per user per date
- `focus_sessions`: completed focus blocks and task links
- `user_settings`: timezone, height and weight goal

COROS metadata is stored as JSON on eligible tasks, ready for a later integration. No COROS API or PWA/offline cache is included in Phase 2.
