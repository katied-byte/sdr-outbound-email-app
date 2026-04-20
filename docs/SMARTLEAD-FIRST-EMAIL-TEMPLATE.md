# Smartlead first email: customized copy + fallbacks

Paste **only in Smartlead** (subject + body).

**Important:** When you send from this app, the API now puts the **signature inside `personalized_intro`** (intro + “Best, Name, Arketa SDR” in one field). You **do not** need `{{#if sender_signature}}` in Smartlead — that pattern often triggers parse errors (`Expecting 'OPEN_ENDBLOCK', got 'EOF'`) in their editor.

**API shape:** Smartlead’s “add leads” endpoint only allows a fixed set of top-level fields per lead (`email`, `first_name`, etc.). Values like `personalized_intro` must be sent under **`custom_fields`** in the JSON. Templates still reference `{{personalized_intro}}` and `{{custom_subject}}` the same way.

---

## Critical: use `{{` and `}}`, not `%` for conditionals

| Wrong | Right (Smartlead) |
|-------|-------------------|
| `% if personalized_intro %` | `{{#if personalized_intro}}` |
| `% else %` | `{{else}}` |
| `% endif %` | `{{/if}}` |

Docs: [Smartlead fallbacks](https://helpcenter.smartlead.ai/en/articles/26-how-to-use-liquid-syntax-to-win-leads-fallbacks)

---

## Subject line (one line)

```
{{#if custom_subject}}{{custom_subject}}{{else}}Quick question for {{#if first_name}}{{first_name}}{{else}}you{{/if}}{{/if}}
```

If the subject line ever errors, simplify to:

```
{{#if custom_subject}}{{custom_subject}}{{else}}Quick question{{/if}}
```

### Company name in the subject (fallback when no company)

This app sends **`company_name`** on each lead (HubSpot company name). If the contact has no company, it is empty, so use **`{{#if company_name}}`** in Smartlead.

**Filler only (studio / business):**

```
{{#if company_name}}{{company_name}}{{else}}your studio{{/if}}
```

**Full example (first name + company or filler):**

```
Quick question for {{#if first_name}}{{first_name}}{{else}}there{{/if}} — {{#if company_name}}{{company_name}}{{else}}your fitness studio{{/if}}
```

If the subject text comes entirely from **`custom_subject`** (generated in this app), Smartlead cannot insert a company fallback *inside* that string. Either build the subject in Smartlead with the pattern above, or adjust app-side subject generation when `company_name` is missing.

---

## Email body — **recommended (single `if`, no `sender_signature`)**

Use **exactly one** opening `{{#if personalized_intro}}` and **one** closing `{{/if}}`. No nested `{{#if}}` inside the `{{else}}` block (nested blocks confuse Smartlead’s parser for some accounts).

```
{{#if personalized_intro}}{{personalized_intro}}{{else}}Hi there,

I came across your studio and wanted to reach out about how you handle booking and client experience.

We work with studios on scheduling and member experience. Worth a quick call to see if it is a fit?

Arketa Sales Development Representative{{/if}}
```

| Lead source | What happens |
|-------------|----------------|
| **From this app** | `personalized_intro` includes the full first email **and** your rep signature (merged by the app). |
| **CSV / manual, no intro** | The `{{else}}` paragraph + sign-off line shows. |

Optional: add **`%signature%`** on a new line **only** if you want the Smartlead inbox signature **in addition** to the text above. For app-sent leads that can **duplicate** the sign-off — remove `%signature%` if you see two signatures.

---

## Old `sender_signature` block (not recommended)

Do **not** use this in Smartlead unless it parses cleanly on your account:

```liquid
{{#if sender_signature}}{{sender_signature}}{{else}}...{{/if}}
```

The app **no longer relies** on it; signature is bundled into `personalized_intro` on send.

---

## Fields reference

| Field | From app (Send) |
|-------|-----------------|
| `personalized_intro` | Full first-email HTML: AI body **+** rep signature |
| `custom_subject` | Yes |
| `first_name`, etc. | Yes |

---

## If you still see parse errors

1. Delete the whole body and paste **only** the recommended block above (between the ``` lines, without the fences).
2. Ensure the template is **plain text / source**, not rich text mangling `{{`.
3. Count: **one** `{{#if personalized_intro}}` and **one** `{{/if}}` at the very end.
