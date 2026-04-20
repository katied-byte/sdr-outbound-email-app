#!/usr/bin/env node
/**
 * Verifies HubSpot + Smartlead credentials from .env.local (no app server needed).
 * Usage: npm run test:integrations
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnvLocal() {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) {
    console.error('Missing .env.local — copy from .env.example and fill in values.\n')
    process.exit(1)
  }
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    process.env[k] = v
  }
}

function ok(msg) {
  console.log(`  ✓ ${msg}`)
}
function fail(msg) {
  console.log(`  ✗ ${msg}`)
}

async function main() {
  loadEnvLocal()
  console.log('\nSDR Outbound — integration check\n')

  const hub = process.env.HUBSPOT_ACCESS_TOKEN
  const smart = process.env.SMARTLEAD_API_KEY
  const gemini = process.env.GEMINI_API_KEY

  // HubSpot
  console.log('HubSpot (lists + token)')
  if (!hub) {
    fail('HUBSPOT_ACCESS_TOKEN not set')
  } else {
    try {
      // GET /crm/v3/lists without listIds returns nothing; search with empty query lists all.
      const res = await fetch('https://api.hubapi.com/crm/v3/lists/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hub}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          additionalProperties: [],
          offset: 0,
          count: 20,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        fail(`${res.status} — ${JSON.stringify(data).slice(0, 200)}`)
      } else {
        const lists = data.lists || []
        const contacts = lists.filter(
          (l) => String(l.objectTypeId ?? '0-1') === '0-1'
        )
        const n = contacts.length
        ok(`API OK — ${n} contact list(s) on first page (${lists.length} total rows)`)
        if (n > 0 && contacts[0]) {
          console.log(`     e.g. "${contacts[0].name}" (id ${contacts[0].listId})`)
        }
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e))
    }
  }

  // Smartlead
  console.log('\nSmartlead (campaigns)')
  if (!smart) {
    fail('SMARTLEAD_API_KEY not set')
  } else {
    try {
      const client = (process.env.SMARTLEAD_CLIENT_ID || '').trim()
      const clientQ = client ? `&client_id=${encodeURIComponent(client)}` : ''
      const url = `https://server.smartlead.ai/api/v1/campaigns/?api_key=${encodeURIComponent(smart)}${clientQ}`
      const res = await fetch(url)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        fail(`${res.status} — ${typeof data === 'string' ? data : JSON.stringify(data).slice(0, 200)}`)
      } else {
        const campaigns = Array.isArray(data)
          ? data
          : Array.isArray(data?.campaigns)
            ? data.campaigns
            : Array.isArray(data?.data)
              ? data.data
              : []
        const n = campaigns.length
        ok(`API OK — ${n} campaign(s)${client ? ` (client_id=${client})` : ''}`)
        if (n > 0 && campaigns[0]) {
          console.log(`     e.g. "${campaigns[0].name}" (id ${campaigns[0].id})`)
        } else if (!client && n === 0 && data && typeof data === 'object' && !Array.isArray(data)) {
          console.log('     If campaigns exist in the UI but not here, try SMARTLEAD_CLIENT_ID in .env.local (agency clients).')
        }
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e))
    }
  }

  // Gemini (optional)
  console.log('\nGemini (generate — optional)')
  if (!gemini) {
    console.log('  — GEMINI_API_KEY not set (email generation will fail in live UI)')
  } else {
    ok('GEMINI_API_KEY is set (not calling API in this script)')
  }

  console.log('\n---')
  console.log('UI test: npm run dev → open /dashboard → pick campaign → pick HubSpot list.')
  console.log('With TEST_MODE=true in DashboardClient, HubSpot/Smartlead send steps use mocks.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
