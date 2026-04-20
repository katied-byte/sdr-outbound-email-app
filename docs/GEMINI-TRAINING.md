# How to train / edit outbound first emails

## Where the copy lives

| What | File / behavior |
|------|------------------|
| **Email body** (with HubSpot personalization) | **OpenAI** writes it in **`src/lib/openai-email.ts`** using **themes** from **`src/config/first-email-body.ts`** (`firstEmailBodyExamples`). Wording is **not** pasted verbatim; studio name, city, locations, ratings, booking software, etc. are woven in when present. |
| **Static body** (no AI) | Skip-AI mode or if the body API call fails → **`buildFirstEmailPersonalizedIntro()`** uses **example 1** from `first-email-body.ts` exactly. |
| **Subject line** | OpenAI + **`src/config/email-style.ts`** (`tone`, `subjectLineRules`). |
| **Signature** | Added after the body (`getEmailSignature` in `email-style.ts`). |

---

## Step 1: Steer the body (themes + static fallback)

1. Open **`src/config/first-email-body.ts`**.
2. Edit **`firstEmailBodyExamples`** — each example’s `painParagraph`, `valueParagraph`, and `defaultCta` describe **themes** the model should follow while **rephrasing**.
3. Example **1** is also the **exact** text used when AI is off or errors.
4. Restart `npm run dev`.

---

## Step 2: Tune subject lines

1. Open **`src/config/email-style.ts`**.
2. Adjust **`tone`** and **`subjectLineRules`**.
3. Restart `npm run dev`.

---

## Step 3: Test

Pick a lead with good company data → **Generate**. The first paragraph should reference real fields when HubSpot has them; pain/value paragraphs should sound like your examples but not word-for-word.

---

## Legacy note

Older docs referred to “Gemini.” Training today is **OpenAI** + **`first-email-body.ts`** examples + HubSpot fields.
