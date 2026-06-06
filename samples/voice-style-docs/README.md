# Voice Training Test Docs

10 fake past-proposal samples for A/B testing voice training.

## How to test

### Test 1 — surfer/casual style takeover

1. Open `/settings/voice` on the deploy.
2. Upload all 5 files from `style-a-surfer-casual/` under "Past proposals".
3. Go back to dashboard, open David Martinez (or create a fresh manual lead).
4. Paste any site walk notes, draft a proposal.
5. Expect: narrative shifts dramatically casual — "Yo" / "stoked" / "dude" / "killer" / fragments.

### Test 2 — corporate/formal style takeover

1. Wipe the previous uploads (Remove each from `/settings/voice`).
2. Upload all 5 files from `style-b-corporate-formal/`.
3. Draft a fresh proposal on another lead.
4. Expect: narrative shifts hard formal — "Dear Mr. and Mrs." / "It is our distinct pleasure" / "Sincerely" / no contractions / passive voice / "respectfully submitted".

### Test 3 — cold start (no exemplars)

1. Wipe all uploads.
2. Draft a proposal.
3. Expect: default Marcus voice (the synthetic exemplar baked into the prompt) — direct, contractions, plain English.

### Test 4 — edit corrections kick in

1. Draft a proposal (any style depending on uploads).
2. On the review page, edit the narrative HARD — rewrite it in a totally different voice.
3. Approve.
4. Draft ANOTHER proposal on a different lead.
5. Expect: new draft pulls your edit as a few-shot example, voice shifts toward what you wrote.

## Why these two styles

Both are very distant from the default Marcus voice (direct + confident + plain). If the system shifts to either extreme based on uploads, voice training is working.

## File contents at a glance

| Style | File | Notable phrases |
|---|---|---|
| A casual | 01-jakes-backyard.txt | "Yo Jake", "killer", "dude", "Hit me up" |
| A casual | 02-amys-poolside.txt | "Stoked", "killer", "sweet", "totally worth it" |
| A casual | 03-mike-firepit.txt | "Quick one", "cooler", "lock you in" |
| A casual | 04-tina-turf-job.txt | "So pumped", "live out there", "Costco parking lot" |
| A casual | 05-tom-pergola.txt | "beast", "Way better call", "looks insane" |
| B formal | 01-johnson-residence.txt | "distinct pleasure", "pursuant to", "Sincerely" |
| B formal | 02-blackwood-estate.txt | "honored to extend", "Yours faithfully" |
| B formal | 03-henderson-residence.txt | "great pleasure", "Respectfully submitted" |
| B formal | 04-whitfield-residence.txt | "privileged to present", "Sincerely" |
| B formal | 05-stratton-estate.txt | "pleased to submit", "Respectfully yours" |
