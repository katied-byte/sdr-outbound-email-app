# SDR Outbound Email App

AI-powered personalized cold email outreach tool that integrates HubSpot, Smartlead, and Google Gemini.

## Features

- **Google SSO Authentication** - Secure login via Google
- **HubSpot Integration** - Pull leads from HubSpot lists with contact and company data
- **AI-Powered Personalization** - Generate personalized email openings using Gemini AI
- **Smartlead Integration** - Push leads to campaigns with personalized first emails
- **Automatic Inbox Matching** - SDRs are matched to their Smartlead email accounts by name

## Setup

### 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `HUBSPOT_ACCESS_TOKEN` | HubSpot private app access token |
| `SMARTLEAD_API_KEY` | Smartlead API key |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NEXT_PUBLIC_LIVE_OUTBOUND` | Set to `true` for real HubSpot + Smartlead; omit for mock demo mode |

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Enable Google OAuth in Authentication > Providers > Google
3. Add your Google OAuth credentials
4. Set the redirect URL to: `https://your-domain.com/auth/callback`

### 3. HubSpot Setup

1. Create a **Private App** in HubSpot and copy its **access token** (not an OAuth client secret).  
2. Required scopes: `crm.lists.read`, `crm.objects.contacts.read`, `crm.objects.companies.read`  
3. Set `HUBSPOT_ACCESS_TOKEN` in `.env.local` and restart `npm run dev`.

If you see **401** or “No lists”, follow **[docs/HUBSPOT-SETUP.md](docs/HUBSPOT-SETUP.md)** step by step.

### 4. Smartlead Setup

1. Get your API key from Smartlead settings  
   **After “Send”:** this app **adds leads** to your campaign; Smartlead sends on **its** schedule. If no one got mail yet, see **[docs/SMARTLEAD-SENDING-CHECKLIST.md](docs/SMARTLEAD-SENDING-CHECKLIST.md)**.
2. **First email:** The app sends **`personalized_intro`** with the full body **and** your rep signature merged in one field. Use the **single-`if`** template in **[docs/SMARTLEAD-FIRST-EMAIL-TEMPLATE.md](docs/SMARTLEAD-FIRST-EMAIL-TEMPLATE.md)** — avoid `{{#if sender_signature}}` (Smartlead often throws parse errors on that).

### 5. Gemini Setup

1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey) **or** create one in [Google Cloud → Credentials](https://console.cloud.google.com/apis/credentials) for the project that has **billing** enabled.
2. **`429` / quota errors:** the key must belong to a GCP project with **billing** and **Generative Language API** enabled. Step-by-step for tying this to a project (e.g. `outbound-email-app`): **[docs/GEMINI-GCP-SETUP.md](docs/GEMINI-GCP-SETUP.md)**.  
   **Temporary workaround:** set **`NEXT_PUBLIC_SKIP_GEMINI_PERSONALIZATION=true`** in `.env.local` and **restart** `npm run dev`. That flag is available in the browser so **Send all** never hits Gemini (avoids 429). You can also set `SKIP_GEMINI_PERSONALIZATION=true` for server-only skips. Edit the template in the UI before send.
3. To train Gemini on your email language and style, see **[docs/GEMINI-TRAINING.md](docs/GEMINI-TRAINING.md)** (step-by-step guide and prompt templates)

## Development

```bash
npm install
npm run dev
```

**Leave that terminal open** while you work. Then open **[http://localhost:3000](http://localhost:3000)** in Chrome/Safari or Cursor’s Simple Browser.

### “Connection Failed” / `ERR_CONNECTION_REFUSED`

Nothing is listening on the port yet — the dev server isn’t running.

1. Open a terminal in the project folder (`sdr-outbound-email-app`).
2. Run: `npm run dev`
3. Wait until you see **“Ready”** (and `Local: http://localhost:3000`).
4. Load **exactly** `http://localhost:3000` (not `https`, not another port).

If you close the terminal or press Ctrl+C, the app will stop and the browser will show connection refused again.

### macOS: `EMFILE: too many open files, watch`

The project enables **polling** in `next.config.js` to avoid that. You can also raise limits: `ulimit -n 10240` in the same terminal before `npm run dev`.

### Quick integration test (API keys)

With `.env.local` filled in:

```bash
npm run test:integrations
```

This calls HubSpot (lists) and Smartlead (campaigns) directly and prints ✓/✗. Does not start the web app.

**If you see `Cannot find module './276.js'` (or similar) in dev:** the `.next` cache is stale. Stop the dev server, then run `npm run dev:clean` (or `rm -rf .next` then `npm run dev`).

## Deployment

Deploy to [Vercel](https://vercel.com):

```bash
npx vercel login
npx vercel --prod
```

The CLI prints your production URL (e.g. `https://sdr-outbound-email-app.vercel.app`). If you see “token is not valid”, run `vercel login` again.

**Environment variables (Vercel → Project → Settings → Environment Variables)** — add the same values as `.env.local`, for **Production** (and Preview if you use it):

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Required |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required |
| `HUBSPOT_ACCESS_TOKEN` | Required for lists/contacts |
| `SMARTLEAD_API_KEY` | Required for live send |
| `OPENAI_API_KEY` | Required for AI email body |
| `NEXT_PUBLIC_LIVE_OUTBOUND` | `true` for real HubSpot |
| `NEXT_PUBLIC_SMARTLEAD_TEST_MODE` | Omit or `false` for real Smartlead enrollments; `true` for demos only |
| `NEXT_PUBLIC_SKIP_GEMINI_PERSONALIZATION` | Optional (legacy name; skips AI when `true`) |
| `NEXT_PUBLIC_MAX_SENDS_PER_DAY` | Optional daily cap per browser |

After the first deploy, add your production URL and `https://<your-app>/auth/callback` to **Supabase → Authentication → URL Configuration** and to **Google Cloud OAuth redirect URIs** (see “Sharing with SDRs” below).

## Sharing with SDRs (when the app is live)

Once the app is deployed and you’re ready for the team to use it:

1. **Production URL**  
   Use your live URL (e.g. `https://your-app.vercel.app` from Vercel).

2. **Supabase (Google OAuth)**  
   - In [Supabase](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**, add your production URL to **Site URL** and add `https://your-app.vercel.app/auth/callback` to **Redirect URLs**.  
   - In **Authentication** → **Providers** → **Google**, ensure the OAuth **Authorized redirect URI** in Google Cloud Console includes `https://your-app.vercel.app/auth/callback`.  
   - (Optional) To limit access to your company only, use Supabase **Authentication** → **Providers** → **Google** → restrict to your Google Workspace domain, or use Supabase auth policies to allow only certain emails.

3. **Share with SDRs**  
   Send them the production URL and tell them to:
   - Open the link and click **Sign in with Google** (use their work Google account).
   - After sign-in they’ll land on the dashboard: choose a Smartlead campaign, pick a HubSpot list, then work through leads (edit AI draft, Skip or Send & Next).

4. **Smartlead inbox matching**  
   The app matches SDRs to Smartlead inboxes by **first + last name** (from their Google profile). Ensure each SDR has a Smartlead inbox whose sender name matches their name so “Send & Next” uses the right inbox.

5. **Going live (sending real emails)**  
   Set **`NEXT_PUBLIC_SMARTLEAD_TEST_MODE=false`** (or remove it) in `.env.local` and **`NEXT_PUBLIC_LIVE_OUTBOUND=true`**. Restart `npm run dev`. On Vercel, set the same env vars on the project. Until test mode is off, the primary button stays **Log & next** / **Preview** and only logs to the console—no Smartlead Add Lead API.

## Workflow

1. SDR signs in with Google
2. Select a Smartlead campaign
3. Select a HubSpot list → **List hub** (choose how to work the list):
   - **Select all unsent** → list unfolds with name, email, short blurb per lead → **Send all** runs Gemini for each and sends to Smartlead (or logs in test mode).
   - **Clear selection** resets the batch.
   - **Choose lead** → search → opens the **one-by-one** editor (contact + AI email); **Send to Smartlead & return** or **Back to list** without sending.

### Where "Preview & Next" goes (test mode)

When **test mode** is on (purple banner), the primary button says **Preview & Next**. Clicking it:

- Logs the email (to, subject, body) to the **browser console** (DevTools → Console)
- Marks this lead as done and **moves you to the next lead**
- **Does not call Smartlead** – no email is sent. Use this to run through the flow without sending.

### How the email is actually sent (live mode)

When **test mode** is off, the button says **Send & Next**. Clicking it:

1. The app calls **`/api/smartlead/send`** with: campaign ID, lead (contact + company), subject, full first-email body, and your Smartlead inbox IDs.
2. The API **adds the lead to the Smartlead campaign** with `personalized_intro` and `custom_subject` inside **`custom_fields`** (Smartlead rejects those keys at the top level of `lead_list` items). Templates still use `{{personalized_intro}}` / `{{custom_subject}}` as usual.
3. **Smartlead** sends the first email from your linked inbox and runs the rest of the sequence (follow-ups, etc.) according to the campaign.
4. The app moves you to the **next lead** and generates the next email.

So: **this app personalizes and adds leads to the campaign; Smartlead does the actual sending and sequences.**

## HubSpot Properties Used

**Contact:**
- First name, Last name, Job title, Email

**Company:**
- Name, Website, City, State
- GTM Modality
- Promptloop: Modalities, Booking software, Locations, Class count, Staff counts
- Google Maps: Rating, Reviews

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Auth:** Supabase (Google SSO)
- **Database:** Supabase Postgres
- **AI:** Google Gemini
- **Integrations:** HubSpot API, Smartlead API
