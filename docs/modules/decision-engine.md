# Decision Engine (`src/decision.js`)

Every action Akamaru can take is classified before it runs.

**Autonomous:** discover_businesses, research_business, score_lead, build_demo, qa_demo,
deploy_preview (preview target only), draft_outreach, draft_proposal, classify_reply,
organize_lead, create_onboarding_plan.

**Owner approval:** send_outreach, send_reply, publish_production, send_contract,
charge_payment, purchase, launch_campaign, and **any unknown action** (fail-safe).

## Flow
1. A branch calls `requestApproval(action, payload, summary)`. Identical pending requests are deduplicated.
2. The owner sees the request (with a full email preview for sends) in the dashboard or `akamaru approvals`.
3. `approve(id)` marks it approved and runs the executor that branch registered with `registerExecutor`.
4. The result is stored as `executed` or `failed`, with the error. Failures are never hidden.

Executors re-check safety at execution time: the suppression list, whether Resend is connected,
and whether a campaign was already sent. A stale approval therefore can't send to someone who has since unsubscribed.
