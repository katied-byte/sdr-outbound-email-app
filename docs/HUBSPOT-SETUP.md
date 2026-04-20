# Fix HubSpot `401` / “Authentication credentials not found”

That error means **HubSpot never received a valid Private App token**. Your list ([e.g. list `10337` in the HubSpot UI](https://app.hubspot.com/contacts/6965310/objectLists/10337/filters)) exists — the API simply can’t see it until auth works.

## Use a **Private App access token** (not OAuth client secret)

1. In HubSpot, open **Settings** (gear) → **Integrations** → **Private Apps** (or **Development** → **Private apps**, depending on your account UI).
2. **Create a private app** (you may need **Super Admin**).
3. Under **Scopes**, enable at least:
   - `crm.lists.read` — list HubSpot lists in this app  
   - `crm.objects.contacts.read` — read contacts on a list  
   - `crm.objects.companies.read` — enrich with company data  
4. **Save**, then **Reveal / copy the access token** (often starts with `pat-` or is a long string).

## Put it in `.env.local`

One line, **no quotes** unless the whole value is quoted, **no spaces** around `=`:

```bash
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxx   # example — use YOUR token
```

5. **Restart** the Next dev server (`Ctrl+C`, then `npm run dev`).

## Check

```bash
npm run test:integrations
```

You should see **✓** for HubSpot (lists sample).

The app also **reads `HUBSPOT_ACCESS_TOKEN` directly from `.env.local` on disk** if `process.env` is empty (Next.js edge case). Ensure `.env.local` lives in the project root (same folder as `package.json`), or one level up in a monorepo.

## If the app says the token is “missing or still a placeholder”

That message is thrown **before** HubSpot is called. Usually:

1. **Restart dev** after changing `.env.local` (`Ctrl+C`, then `npm run dev`).
2. **Clear the Next cache** and restart: `npm run dev:clean` (removes `.next` — fixes stale static behavior).
3. **Shell override**: if your terminal has `export HUBSPOT_ACCESS_TOKEN=` (empty) or an old value, it can override `.env.local`. Run `unset HUBSPOT_ACCESS_TOKEN` and restart `npm run dev`.
4. **Variable name**: use `HUBSPOT_ACCESS_TOKEN=...` in `.env.local`. You can also set `HUBSPOT_PRIVATE_APP_TOKEN` as a fallback (same value).
5. **UTF-8 BOM**: if the file was edited on Windows, the first line can be wrong. Re-type the `HUBSPOT_ACCESS_TOKEN=` line in a plain editor or save as UTF-8 **without** BOM.

## Common mistakes

| Mistake | Result |
|--------|--------|
| Leaving `your_hubspot_access_token` from `.env.example` | 401 |
| Using an **OAuth client secret** instead of the **Private App token** | 401 |
| Token from a **different** HubSpot portal than the list | 401 or empty lists |
| Forgot to restart `npm run dev` after editing `.env.local` | Still 401 / old behavior |
| Private app missing **`crm.lists.read`** | May error or return no lists |

## After it works

Your list **ID `10337`** will appear as one of the cards on **Select a HubSpot List** (name from HubSpot, e.g. your outbound test list). The URL `objectLists/10337` is the same list the CRM Lists API can return once the token is valid.

**Note:** This app loads lists via HubSpot’s **`POST /crm/v3/lists/search`** (not `GET /crm/v3/lists` without IDs, which returns no rows). Only **contact** lists (`objectTypeId` `0-1`) are shown, since the next step loads contacts from the list.

Official overview: [HubSpot authentication](https://developers.hubspot.com/docs/guides/apps/authentication/intro-to-auth).
