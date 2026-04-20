# Why recipients might not see an email yet

This app **does not send SMTP mail itself**. On **Send** / **Send all** it calls Smartlead’s **Add leads to campaign** API. Smartlead then runs your **sequence** on its own schedule.

## 1. Confirm the lead was added

In **Smartlead** → open the **same campaign** you picked in the app → **Leads**.

- If the contact is **not there**, the API may have returned `added_count: 0` (duplicate in that campaign, block list, etc.). The app now surfaces that in the error message when possible.
- If the contact **is there**, enrollment worked.

## 2. Campaign must be running

Sequences only go out if the campaign is **started / active** in Smartlead (not paused or draft-only). In the Smartlead UI, start the campaign if it’s still stopped.

See Smartlead’s API docs for updating status (e.g. start campaign) if you automate that elsewhere: [Update campaign status](https://api.smartlead.ai/api-reference/campaigns/update-status).

## 3. Sending windows & delays

Smartlead applies **sending schedules**, **delays between steps**, **warmup**, and **per-inbox limits**. The first email is often **not instant** even right after a lead is added.

## 4. Template & variables

The first email in Smartlead must use the same **custom variables** this app sends in `custom_fields`, e.g. `{{personalized_intro}}` and `{{custom_subject}}`. If the template doesn’t reference them, content can look empty or wrong.

See **[SMARTLEAD-FIRST-EMAIL-TEMPLATE.md](./SMARTLEAD-FIRST-EMAIL-TEMPLATE.md)**.

## 5. Inboxes on the campaign

The app attaches your **checked inboxes** to the campaign before adding each lead. Those accounts must be **connected and healthy** in Smartlead.

---

**Summary:** “Success” in this app means **Smartlead accepted adding the lead** (and reported `added_count > 0` when the API provides it). **Delivery** is determined entirely inside Smartlead (status, schedule, templates, and deliverability).
