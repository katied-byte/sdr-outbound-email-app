# How HubSpot, this app, and Smartlead work together

## The three systems

| System | Role |
|--------|------|
| **HubSpot** | Source of truth for **who** the leads are and **rich data** (contact + company) used to personalize the first email. |
| **This app** | Lets each SDR pick a **Smartlead campaign** + a **HubSpot list**, then for each contact: pull HubSpot data → **Gemini** writes the first email → **Send** pushes that lead into Smartlead with the right copy and **the right sending inbox**. |
| **Smartlead** | **Campaign** = first email template + **full sequence** (follow-ups). When a lead is added from the app, they enter **that** campaign and receive the whole series from the **inbox** tied to that send. |

---

## Smartlead UI wants a CSV — how do we use HubSpot instead?

In the **Smartlead web app**, creating a campaign often **requires uploading a CSV** of leads. That flow is built for people who keep their list in a spreadsheet — not for HubSpot → this app.

**You do not need that CSV for the HubSpot workflow.** Leads are added when the SDR **sends from this app** (Smartlead’s **Add leads to campaign** API). The campaign can exist with **zero leads** until the first send.

### Option A — Create the campaign via API (no file)

Smartlead’s official API creates an **empty** campaign (draft) with **no leads**:

```bash
curl -X POST "https://server.smartlead.ai/api/v1/campaigns/create?api_key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "HubSpot outbound – Q1"}'
```

**Do not open that URL in a browser** — that sends **GET**, and Smartlead may treat `create` as a numeric `campaign_id` and return `"campaign_id" must be a number`. **POST + JSON body** (curl/Postman) is required.

Response includes `id` (your **campaign id**). Then in the Smartlead UI (or API):

1. Open that campaign → add **sequences** (first email template per `SMARTLEAD-FIRST-EMAIL-TEMPLATE.md`, follow-ups).
2. Attach **sending email accounts** to the campaign.
3. Set schedule / settings → **activate** when ready.

**Requirements:** API access is typically on **Smartlead Pro** (or your plan’s API tier). Use the same API key as in `.env.local` (`SMARTLEAD_API_KEY`).

After that, this app’s campaign picker will list the campaign; HubSpot lists feed leads **only through the app**, not via CSV.

### Option B — Minimal CSV in the UI (if you can’t use the API)

If you **must** use the UI and it won’t accept an “empty” upload:

1. Create a tiny CSV with **one row** — e.g. your own email or a internal test address (`email` column only is enough).
2. Finish campaign setup (sequence, inboxes).
3. **Pause** the campaign or remove that test lead after setup if you don’t want them emailed.
4. Real prospects still come from **HubSpot → this app → Send**; they’re added via API alongside (or instead of) that seed lead.

### Option C — Duplicate an existing campaign

If you already have a campaign configured correctly, **duplicate** it in Smartlead and clear or ignore the old leads — then use the **new campaign id** in the app. (Exact steps depend on Smartlead’s current UI.)

---

## Where does the list live? How does it get into the app?

1. **Lists stay in HubSpot.** You build and maintain lists there (e.g. static lists, or active lists based on filters).
2. **You do not upload a CSV into this app** for the main flow. The app calls HubSpot’s API and shows **every list** your HubSpot private app can read (`crm.lists.read`).
3. **In the app**, after sign-in, the SDR:
   - Chooses a **Smartlead campaign** (the sequence that lead should enter).
   - Chooses a **HubSpot list** from the dropdown.
4. The app then loads **contacts on that list** (plus company data) from HubSpot and walks the SDR through them one by one.

So: **list = HubSpot list; feeding the app = selecting that list in the UI.**

---

## How does a lead get into Smartlead with the right first email?

When the SDR clicks **Send & Next** (live mode):

1. The app calls Smartlead’s API to **add one lead** to the **selected campaign**.
2. It sends merge/custom fields Smartlead expects, for example:
   - `first_name`, `email`, `company_name`, …
   - `custom_fields.personalized_intro` — full AI body for email 1 (Smartlead API does not allow `personalized_intro` at the top level of each lead)
   - `custom_fields.custom_subject` — subject line
   - Rep signature is merged into `personalized_intro` on send (see `SMARTLEAD-FIRST-EMAIL-TEMPLATE.md`).
3. Smartlead’s **first email** in that campaign should use those fields (see the Smartlead template doc).
4. **Follow-up emails** are whatever you configured **in that same Smartlead campaign** — no extra step in the app. The lead is **in the campaign** for the whole series.

So: **one campaign in Smartlead = first personalized touch (from app) + rest of sequence (from Smartlead).**

---

## How does each SDR send “their” part of the list?

**Today, the app does not auto-split one HubSpot list by rep.** Any SDR who selects a list sees **all contacts on that list**.

**Practical ways to assign portions:**

1. **Separate HubSpot lists per SDR (simplest)**  
   Examples: `Outbound – Alex March`, `Outbound – Jordan March`. Each SDR only selects **their** list. Same Smartlead campaign can be used for everyone.

2. **HubSpot owner + process**  
   Keep one list but filter in HubSpot (e.g. “Owner is current user”) into **saved views/lists per owner**, then each SDR uses their list in the app.

3. **Coordination**  
   One shared list; teams agree who works which rows (fragile, not ideal at scale).

**Future product idea:** filter contacts in the app by HubSpot **contact owner** matching the logged-in user — not built today.

---

## How is each lead tied to the right representative (SDR)?

When a lead is added to Smartlead, the API specifies **which Smartlead email account(s)** send for that lead.

1. You stay signed in with **your Google account** (Orli, ops, etc.). The app does **not** let you “log in as” another person in Google.
2. After you pick a campaign, the app loads **every mailbox** connected to your Smartlead API key and shows **“Send from which Smartlead inbox?”** with checkboxes.
3. Check one or more SDR mailboxes (e.g. `alex@company.com`, `jordan@company.com`). Those IDs are sent on **Send** / **Send all**. Your choice is **remembered in the browser** (per logged-in user).
4. If your Google **first + last name** auto-matched some inboxes, those are pre-selected when possible; you can change the selection anytime.

So: **who sends** = which Smartlead inboxes you select, not which Google user Smartlead would guess from your name alone.

**Operational notes**

- SDRs’ addresses must exist as **sending accounts** in Smartlead (same workspace as the API key).
- **HubSpot lists** are unrelated to Smartlead inboxes; “No lists found” means **HubSpot token / scopes / list setup**, not inbox selection.

---

## End-to-end flow (one sentence)

**HubSpot list** → **SDR picks list + campaign in app** → **Gemini personalizes email 1 from HubSpot data** → **Send adds lead to Smartlead campaign with that copy + SDR’s inbox** → **Smartlead sends email 1 and the rest of the sequence.**
