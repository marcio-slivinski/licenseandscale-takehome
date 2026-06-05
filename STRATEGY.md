# Greenscape Pro — 5 AI Agents Strategy

**Prepared for:** License & Scale | **Client:** Greenscape Pro (Marcus Tate, Phoenix AZ)
**Author:** Marcio Slivinski | **Date:** 2026-06-05

---

## Thesis (the read)

Greenscape doesn't have five problems. It has one problem with five surfaces: **tribal knowledge that lives in Marcus's head and nowhere else.** Every bottleneck in the company traces back to "nobody else knows how to do that." Proposals, approvals, follow-ups, build comms, dead leads — same root cause. Every agent below is a codification play, not an automation play.

That's also the answer to "why isn't this what the founder said." More on that at the end.

---

## #1 — Proposal Drafter Agent

**Replace Marcus's scope interpretation, not his typing speed.**

- Ingests site walk notes (text or voice memo); Sonnet extracts structured scope JSON via tool use.
- Haiku matches scope items against pricing catalog (200+ items) with confidence scoring; flags <70% for human review.
- Generates draft proposal in Marcus's voice using cached exemplars (uploaded past proposals + edit corrections captured automatically).
- HITL review UI: Marcus edits inline, approves, system fires PDF + GHL push + Slack notification.
- Guardrails: hallucination check on narrative, total-range validation, Zod schema on every boundary.

**Replaces:** Marcus rebuilding scope from notes for every single proposal. The 6–9 day cycle that loses 35–40% of qualified leads to faster competitors.

**ROI:** ~500 qualified leads/yr × 35% lost × $28K avg × 50% recoverable = **~$2.4M/yr recaptured revenue.** Cost: ~$0.08/proposal at scale (Sonnet+Haiku split + prompt caching).

**Why #1:** Largest single revenue lever in the business by an order of magnitude. Every other agent below assumes the funnel keeps growing — this one prevents the funnel from leaking. It also forces the company to codify its highest-value tribal knowledge (scope inference), which compounds into every subsequent build.

---

## #2 — Closed-Lost Reactivator

**Wake up the dead pile, in Marcus's voice, without Marcus.**

- Pulls 1,400+ closed-lost leads from GHL with full historical context (notes, project type, lost reason).
- Generates personalized re-engagement messages per lead — references specific past conversation, not a blast.
- 3-touch drip cadence via GHL SMS + email; warm responses auto-route to Marcus.
- Voice exemplars + edit corrections from #1 carry over directly.

**Replaces:** Brittany's sporadic batch re-engagement that doesn't scale and reads as mass blast (Marcus on the call: *"When it feels like Marcus is reaching out personally, people respond. When it feels like a mass blast, they do not."*).

**ROI:** 1,400 leads × 2% reclose (conservative — Marcus has seen higher when he works it personally) × $28K = **$784K latent revenue.** Marginal cost near zero per send (GHL existing infra).

**Why #2:** Pure latent value sitting in GHL right now, zero process change required, low build complexity, leverages voice infrastructure built for #1. Ships fastest.

---

## #3 — Post-Sign Concierge

**Stop bleeding revenue between signature and shovel.**

- GHL pipeline stage webhook triggers parallel sequences: HOA package chase, permit revision follow-up, deposit invoice reminder.
- Escalation timers per stage; Jenna gets a daily exception report instead of chasing 8–12 projects manually.
- Templates per HOA-board cadence (monthly meeting awareness) and per permit jurisdiction.

**Replaces:** Jenna manually chasing 8–12 stuck projects at any given time. Marcus's crews idling 2-week stretches because permits slipped (*"It compounds"* — Marcus, transcript).

**ROI:** 8–12 projects × $28K = **$224K–$336K in delayed revenue freed at any given moment.** Plus crew utilization gains — if the post-sign cycle drops from 4–6 weeks back to the targeted 2 weeks, that's roughly 4 extra build slots per year per crew lead.

**Why #3 (above comms):** This isn't customer experience polish — it's literal cash flow unblock and crew capacity. The company's stated growth target ($4.2M → $5.5M) is limited by crew throughput, not lead volume. Concierge attacks throughput.

---

## #4 — Build Progress Narrator

**Turn Marcus's referral-driving Loom updates into a system.**

- CompanyCam photo upload + Jobber milestone webhooks trigger generated update copy in Marcus's voice.
- One-click approve → SMS via GHL to customer.
- Cadence enforced: no project goes 4+ days silent (the threshold Jenna sees inbound anxiety calls at).
- Crew-lead reminder system: nudges crew to post CompanyCam if behind cadence.

**Replaces:** The 30% of projects where Marcus manages a personal Loom — and more importantly, the 70% where he doesn't and the customer calls Jenna asking what's happening. Daily.

**ROI:** Hard to quantify, but Marcus has proof: *"I have gotten referrals from people who said 'you are the only contractor who kept us informed.'"* On 150 projects/yr, even a 5% referral lift = ~7 extra deals × $28K = **$196K/yr.** Plus eliminating Jenna's reactive anxiety-call queue (daily occurrence per onboarding doc).

**Why #4:** Real revenue (referrals) but indirect, lagging, and dependent on consistent voice quality. Sits below the three direct-revenue plays.

---

## #5 — Jenna Approval Co-Pilot

**Codify Marcus's decision framework so 5–10 daily Slack pings become 5–10 daily auto-approvals.**

- RAG over Marcus's historical decisions (change orders, refunds, add-on pricing) — same voice infrastructure as #1.
- Jenna queries instead of pinging Marcus; agent auto-approves within learned thresholds, escalates outliers.
- Marcus reviews escalations daily, not in real-time. His framework gets richer with each escalation he handles.

**Replaces:** Marcus context-switching 5–10 times a day on small approvals. Jenna's stated wish on the call: *"I literally just need a rule book. Half of these I could decide myself if I knew Marcus's framework."*

**ROI:** Time-economic, not revenue. ~50 interruptions/week eliminated. Marcus's stated goal: *"I want my evenings back."* That's the goal this serves directly. Indirect revenue: faster client decisions on change orders = fewer stalled jobs.

**Why #5 (and not excluded):** It's the smallest dollar number on the list, but it's the agent Marcus explicitly listed in *"Three Tasks I Would Fire Myself From."* Founder-stated relief + lowest build complexity + ships fast. Excluding it ignores explicit founder demand for a low-cost easy win.

---

## Footer

### Why #1 is #1 — and not the founder's #1

Founder's stated #1 is *"speed up quoting — it's killing us."* I agree with the priority position. I disagree with the diagnosis, and that changes how the agent is built.

Marcus framed it as a process-speed problem. Two sentences later he said: *"I am the bottleneck. I have to touch every proposal... Nobody else knows how to do that."* That's not a speed problem. That's a **knowledge transfer** problem. Templates won't fix it. Faster typing won't fix it. The only thing that fixes it is a system that can interpret site walk notes the way Marcus does, with him as the editor instead of the author.

That diagnosis changes the build target. Instead of "proposal generator" (faster tool), we build "scope interpretation proxy" (replacement of the cognitive step). The HITL review flow is the safety net. Marcus's edits feed back as training signal. Voice and accuracy converge with use, not with more upfront engineering.

Same priority. Different solution. That's the whole point.

### Interdependencies (what unlocks what)

- #1 structures scope JSON → #3 inherits structured data for HOA package generation.
- #3 webhook infrastructure (GHL stage → action) → reused by #4 (Jobber milestone → action).
- #2 depends on GHL data hygiene; sparse notes = weak personalization. Build after voice infrastructure from #1 exists.
- #5 is fully orthogonal. Ship-first candidate.

### One agent I considered but excluded — Lead Pre-Qualifier

An SMS/voice agent that runs Marcus's qualifying questions on Meta leads before they hit his calendar. Saves the 4–6 obviously-unqualified calls Marcus does per week.

I excluded it because the auditor's own number frames it correctly: *"save 1 to 2 hours per week."* That's calendar protection, not revenue recovery. And the underlying problem — Marcus's time scarcity — is already attacked from a higher-leverage angle by #1 (which removes him from the proposal step entirely, not just protects an hour of phone time).

Pre-Qualifier is a good agent. It's not a top-5 agent given what's available.

### Honest assumptions declared

1. **GHL API supports** pipeline stage webhooks, custom field read/write, SMS/email send, opportunity update. Confirmed via public docs; sandbox access assumed within build scope.
2. **Marcus adopts some digital site walk input** (voice memo via Whisper or typed bullets). If he refuses entirely, #1 stalls. Risk flagged.
3. **Pricing spreadsheet (200+ items)** can be one-time exported to CSV and imported as structured catalog. No live sync with the Google Doc needed for P0.

### Excluded with explicit reasoning (not in the top 5)

- **Crew Coaching Agent** (founder's stated #3): ~$104K/yr by founder's own math. Order of magnitude smaller than #1–#4. Marcus accepted the framing on the call: *"You are right that it is not the same scale. Fine."*
- **Marketing / Content Agent** (founder's stated #4): Marcus killed it himself on the call: *"Quote. I cannot keep up with the leads I have."* ROAS 4.5x on Meta. The funnel doesn't need more top.

Both made the founder's stated list. Neither makes mine. That's the job.
