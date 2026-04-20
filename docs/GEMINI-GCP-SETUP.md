# Connect Gemini to your Google Cloud project (fix 429 / quota)

This app uses the **Gemini API** via `GEMINI_API_KEY` in `.env.local` ([`@google/generative-ai`](https://www.npmjs.com/package/@google/generative-ai)). Quotas and billing follow **the Google Cloud project that owns that API key**, not the repo on your laptop.

We **cannot** link Cloud Console to this codebase for you—you sign in and configure the project in the browser.

## Use project `outbound-email-app`

Your quotas page for that project:

**[Quotas — outbound-email-app](https://console.cloud.google.com/iam-admin/quotas?project=outbound-email-app)**

### 1. Enable billing

1. Open **[Billing](https://console.cloud.google.com/billing)** and link a **billing account** to project **`outbound-email-app`**.
2. Without billing, you stay on **free-tier** limits (very low daily caps → `429 Too Many Requests`).

### 2. Enable the Gemini / Generative Language API

1. In Google Cloud Console, select project **`outbound-email-app`** (top bar).
2. Go to **[APIs & Services → Library](https://console.cloud.google.com/apis/library?project=outbound-email-app)**.
3. Search for **“Generative Language API”** (or **“Gemini API”**) and click **Enable**.

### 3. Create an API key **in that project**

**Option A — Google Cloud Console (recommended for clear project binding)**

1. **[APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=outbound-email-app)**  
2. **Create credentials → API key**  
3. (Optional but good practice) **Restrict key** → API restrictions → limit to **Generative Language API**  
4. Copy the key.

**Option B — Google AI Studio**

1. Open **[Google AI Studio → Get API key](https://aistudio.google.com/apikey)**  
2. When creating a key, choose / create a key for Google Cloud project **`outbound-email-app`** (not “default” or another test project unless that project has billing).

### 4. Put the key in this app

In **`.env.local`** (project root, next to `package.json`):

```bash
GEMINI_API_KEY=paste_your_key_here
```

Restart the dev server (`Ctrl+C`, then `npm run dev`).

### 5. Confirm quotas (optional)

- **[Quotas for Generative Language API](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas?project=outbound-email-app)**  
- After billing is on, paid-tier limits apply per your plan; it can take a short time to update.

## If you still see 429

- Confirm the key you pasted is from **`outbound-email-app`**, not an old AI Studio key tied to another project.  
- Check **[usage / rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)** for the model you use (`GEMINI_MODEL`, default `gemini-2.5-flash` in this app).

## This repo does not store your GCP project ID

Connection is **only** via `GEMINI_API_KEY`. There is no separate “project id” env var for the current `@google/generative-ai` setup.

## Send without Gemini (no quota usage)

Put **this** in `.env.local` (the `NEXT_PUBLIC_` prefix matters — the dashboard runs in the browser and must see the flag, or it will still call `/api/generate` and hit Gemini):

```bash
NEXT_PUBLIC_SKIP_GEMINI_PERSONALIZATION=true
```

Restart the dev server (`Ctrl+C`, then `npm run dev`). Subject + body are built from **HubSpot data only**; edit in the UI before **Send** / **Send all**.

Optional extra (server-only): `SKIP_GEMINI_PERSONALIZATION=true` — honored by `/api/generate` if something calls it without the public flag.

Remove the variable or set to `false` to use Gemini again.
