# Connect the two COROS scheduled tasks to Life OS

This is the Phase 2 COROS bridge. Complete the sections in order. The app code is ready, but nothing will be written to your Supabase project until you deploy the database update and sync function.

## Before you start: check ChatGPT access

The final step uses a custom MCP app with one write action. OpenAI currently documents full MCP write actions for ChatGPT Business, Enterprise and Edu workspaces. If **Settings → Apps → Advanced settings → Developer mode** or **Apps → Create** is unavailable, stop after section 4. The Life OS and Supabase work will still be ready, but the existing ChatGPT scheduled tasks cannot use this custom write action on that account yet.

## 1. Add the COROS tables and rules

1. Sign in to Supabase and open the Life OS project.
2. In the left sidebar, select **SQL Editor**.
3. Select **New query**.
4. Open `supabase/coros-integration.sql` from this project and copy all of it.
5. Paste it into the Supabase query editor.
6. Select **Run**.
7. A successful run normally shows **Success. No rows returned**.

This creates storage for daily COROS values and individual activities, adds the two new daily commitments, and preserves the original completion history.

## 2. Find your Life OS user ID

1. In Supabase, select **Authentication → Users**.
2. Find the email address you use to sign in to Life OS.
3. Open that user.
4. Copy the **User UID**. It looks like a long value containing letters, numbers and hyphens.
5. Keep it available for section 3. This is not your email address and it is not your Supabase project ID.

## 3. Create the three server secrets

Install the Supabase CLI if it is not already installed, then sign in:

```bash
npx supabase login
```

Link this folder to the existing project:

```bash
npx supabase link --project-ref fmsvoiuxucvyvuiyuioq
```

Create a private random sync token:

```bash
openssl rand -hex 32
```

Copy the result. Do not put it in GitHub, the Life OS frontend, a screenshot, or a scheduled-task prompt.

Set the user ID and token as Edge Function secrets. Replace the two placeholder values, but keep the quotation marks:

```bash
npx supabase secrets set LIFE_OS_USER_ID="PASTE_YOUR_USER_UID" LIFE_OS_COROS_SYNC_TOKEN="PASTE_YOUR_RANDOM_TOKEN"
```

Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to its hosted Edge Functions. The service-role key stays on the server and must never be placed in the web app.

## 4. Deploy and test the sync function

From the Life OS project folder, run:

```bash
npx supabase functions deploy life-os-sync-mcp --no-verify-jwt
```

Your private MCP endpoint is:

```text
https://fmsvoiuxucvyvuiyuioq.supabase.co/functions/v1/life-os-sync-mcp?token=YOUR_RANDOM_TOKEN
```

Treat that entire address like a password because it contains the token. Do not commit it to GitHub.

Before connecting ChatGPT, test the endpoint in a private browser tab by opening the full address. You should see:

```json
{"name":"Life OS Sync MCP","status":"ready"}
```

If you see `Unauthorized`, the token in the address does not match the secret saved in Supabase.

## 5. Add Life OS Sync as a custom ChatGPT app

The exact menus depend on the ChatGPT plan and workspace permissions.

1. Open ChatGPT on the web.
2. Open **Settings → Apps → Advanced settings** and enable **Developer mode** if it is available.
3. Go back to **Settings → Apps** and select **Create**.
4. Name it **Life OS Sync**.
5. Paste the full private endpoint from section 4, including `?token=...`.
6. Choose no additional authentication; the private token is already part of this one-purpose endpoint.
7. Select **Scan tools**.
8. Confirm that ChatGPT finds one tool named `upsert_coros_daily_snapshot`.
9. Select **Create**. Keep it as a private/draft app while testing.

Only connect an MCP endpoint you control and trust. If the custom-app or write-action option is unavailable on your plan, do not try to work around it by exposing the Supabase service-role key.

## 6. Update the two scheduled tasks

Use the complete prompts in `supabase/COROS_SCHEDULE_PROMPTS.md`.

For each task:

1. Open ChatGPT **Scheduled**.
2. Open **COROS Morning Sync** or **COROS Night Sync**.
3. Select its edit option.
4. Replace its instructions with the matching prompt.
5. Make sure both the existing COROS app and **Life OS Sync** are available to the task.
6. Save without changing the existing schedule or the `Asia/Kolkata` timezone.

## 7. Test once before waiting for the schedule

Run the morning task manually once, if the interface offers **Run now**. Otherwise use the same prompt in a normal ChatGPT chat with both apps selected.

A successful result must say that Life OS returned `saved=true`. Then:

1. Open **Supabase → Table Editor → coros_daily_metrics** and confirm today has one row.
2. Open `coros_activities` and confirm individual activities appear when COROS returned them.
3. Open Life OS and go to **Health**.
4. Confirm the widgets and task progress appear without entering values manually.
5. Confirm only rules that genuinely passed are checked.

## What happens every day

- The morning task records sleep and reconciles the previous day when COROS has late-arriving activity data.
- The night task records the current day's near-final steps, calories, exercise minutes and activities.
- Re-running either task safely updates the same date instead of creating duplicate daily rows.
- One Walk or Run must be at least 5.00 km. Shorter activities are not added together.
- One Jump Rope session must contain at least 1,000 jumps. Multiple smaller sessions are not added together.
- Sleep must be greater than 450 minutes. Exactly 450 minutes does not pass.
- Missing COROS information remains **Awaiting sync** and never becomes a false zero.

