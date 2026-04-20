# HubSpot: Scopes for "Last Call" (Engagements API)

The app fetches **last call date and notes** from HubSpot using the **Legacy Engagements v1 API**:

- **Endpoint:** `GET /engagements/v1/engagements/associated/contact/{contactId}/paged`
- **Used for:** Showing "Last Call" in Lead Info and feeding call notes into the email (second paragraph).

If you get a **403** when loading contacts (or "Last Call" is always empty), the private app may need an additional scope. **There is no scope literally named "engagements"** in the current HubSpot Private App UI.

---

## What to try: **`timeline`** scope

In your Private App scopes, under the **Other** category, there is a scope called **`timeline`**. In HubSpot, the timeline is what shows activities (calls, meetings, notes) on a contact record. Enabling **`timeline`** may grant access to the legacy Engagements API that we use for "Last Call."

**Steps:**
1. HubSpot → **Settings** → **Integrations** → **Private Apps** → [Your app]
2. **Scopes** tab
3. Expand **Other**
4. Check **`timeline`**
5. Save
6. Reload your app and load a list again — see if "Last Call" populates for contacts that have calls logged

If **`timeline`** doesn't fix the 403 or empty Last Call, the Legacy Engagements v1 API may not be available for private apps in your portal. In that case we'd need to switch the code to a different HubSpot API (e.g. a newer CRM activities/calls endpoint) that uses scopes you do have.

---

## Other scopes you have (for reference)

From your screenshots, the categories are: **Settings**, **Tickets**, **Other**, **CRM Schemas**, **CMS**, **Automation**, **Communication preferences**, **Conversations**, **CRM**. None of them list an "engagements" scope. The only one that is a plausible fit for call/activity data is **`timeline`** under **Other**. You already have **`crm.objects.contacts.read`** and **`crm.objects.companies.read`** (and **`crm.lists.read`**) — those are required for contacts and companies; they do not grant access to the engagements endpoint on their own.

---

## Documentation

- **Scopes reference:** https://developers.hubspot.com/docs/api/oauth/scopes
- **Legacy Engagements API:** https://developers.hubspot.com/docs/api/legacy/crm-engagements
- **Private apps:** https://developers.hubspot.com/docs/guides/apps/private-apps/overview
