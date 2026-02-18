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

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Enable Google OAuth in Authentication > Providers > Google
3. Add your Google OAuth credentials
4. Set the redirect URL to: `https://your-domain.com/auth/callback`

### 3. HubSpot Setup

1. Create a private app in HubSpot with these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
   - `crm.lists.read`
2. Copy the access token to your env

### 4. Smartlead Setup

1. Get your API key from Smartlead settings
2. Ensure your campaigns have email templates with `{{personalized_intro}}` variable

### 5. Gemini Setup

1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deployment

Deploy to Vercel:

```bash
vercel
```

## Workflow

1. SDR signs in with Google
2. Select a Smartlead campaign
3. Select a HubSpot list
4. For each lead:
   - View contact and company data
   - AI generates personalized opening
   - Edit as needed
   - Click "Send" to push to Smartlead
5. Smartlead handles sending and follow-ups

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
