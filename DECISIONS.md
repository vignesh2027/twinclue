# Slice 1 decisions

- A viewer is rate limited independently within their community: one guess every 3,000 ms. A rejected or unclear guess also consumes that interval, which prevents rapid brute force.
- A correct guess records a community's first solver. A round becomes won on the first correct guess from the other community; its solve time is measured from start to that guess.
- Only timed-out rounds reset the streak. Pending and active rounds do not affect it; the caller records completed outcomes with `recordResult`.
- Puzzle text is normalized by removing accents and punctuation and lowercasing before containment checks. Blocklisted terms are checked as whole words.
- The referee accepts exact normalized answers/aliases or edit distance up to 1 for answers of at most 4 characters, 2 up to 8, and 3 for longer answers. Near misses at distance up to 3 beyond that accepted threshold are unclear.
- Session persistence stores puzzle, round status, timestamps, first solvers, guess counts/history, and streak as JSON.

## Slice 2a and 2b decisions

- Each puzzle carries two authored, distinct alternative-answer lists. They are the reveal promise shown to viewers; code checks their presence, uniqueness, and that they do not repeat the answer or aliases. Whether an alternative genuinely fits one half and is ruled out by the other remains an editorial check.
- The pack contains 60 authored entries, adds `halfAAlsoFits`/`halfBAlsoFits`, aliases, and easy/medium/hard labels. It includes Indian sport, food, cities, music, and films.
- `CHANNEL_A` and `CHANNEL_B` are Twitch logins. Startup resolves them, and the authenticated bot, to user IDs before creating EventSub subscriptions and sending chat.
- OAuth role state is held in memory for the short authorization round trip; access and refresh tokens are persisted to ignored `data/tokens.json`. Token refresh starts when less than 60 seconds remain.
- `!tc start` and `!tc skip` require Twitch broadcaster or moderator badges. `!tc score` and `!g` are available to all viewers. A moderator from either channel controls the shared round.
- Chat sends use one serial queue across both channels, with a one-second default gap and Twitch `Retry-After` handling for HTTP 429.
- Twitch integration is interface-driven and unit-tested with fake EventSub sockets, fake Helix, and fake HTTP token/chat responses. Real credentials are required for live Twitch operation and were not available for this slice.

## Slice 3a and 3b decisions

- Blind audits use the configured OpenAI-compatible endpoint and make three sequential requests per puzzle so half A, half B, and the pair are independent. A pass requires the referee to reject each solo best answer and accept the combined best answer. The audit stores clue-content fingerprints so edited clue pairs cannot reuse stale results.
- `AUDIT_MODEL` can override `LLM_MODEL`; the audit script falls back to `LLM_MODEL` only when the audit model returns 404. Audit output is committed under `src/puzzle/audit-report.json`, while resumable checkpoints stay in ignored `data/`.
- The configured Groq endpoint's available Qwen model was used at low concurrency after its free tier rate limited larger models. Its current blind audit passed 20 of 60 puzzles (33.3%). This is a measured failure, not a release-ready pack; the report lists every failing clue and reason in `docs/PUZZLE_AUDIT.md`.
- Overlays receive a side-specific state: only the active community's half is sent, while guess activity is sent as anonymous per-side counts. Full clues, answer, names of first solvers, and that side's also-fits list appear only at reveal. CSS transitions and the countdown run in the browser.
- The panel talks to the same in-memory controller as Twitch and the overlay. Settings constrain round length to 30–600 seconds and category/difficulty choices to the built-in pack. The local demo uses a fresh non-persistent session and scripted fake guesses, and labels the pages DEMO.
- The HTTP control panel is intended for local streamer use and currently has no login or CSRF protection; it should be bound behind a trusted local setup before public exposure.

## Slice 4 decisions

- Pack repair retained only the 32 hand-written puzzles whose current clue fingerprints passed the blind audit. Failed IDs are replaced by model-generated candidates; the referee and audit prompt remain unchanged.
- The generator asks `LLM_MODEL` for batches of up to four candidates, rejects structural violations and duplicate answers, then sends each valid candidate through the serial blind auditor. It persists candidate progress under ignored `data/` so an interrupted free-tier run can resume. Passing candidates are selected to balance categories and difficulty, with at least five India-friendly generated puzzles to bring the full pack to eight or more.
- Generation also rejects an also-fits entry that the existing referee would accept as the intended answer, which catches near-typos such as a one-letter miss.
- Overlays are compact lower thirds anchored to their community's outer edge. A completed round expands for a short celebration and reveal, then collapses. Teal and coral identify each community, and both colours meet on the shared-link animation.
- The demo runs a cooperative round with a ten-second wait between the first and second community solves, then a timeout round, with a short idle beat between rounds. Its controller is in-memory and non-persistent.
- The streamer panel embeds both live overlay pages as side-by-side previews and keeps start, skip, category, difficulty and duration controls in large hit targets.

## Slice 5 decisions

- Audit v2 keeps the blind prompt shape of one best answer plus two alternatives. A puzzle fails if any solver accepts either solo clue, needs a majority to accept the paired clue, and requires the separate fact verifier to mark both halves true. The audit fingerprint includes the audit version and model names, so v1 results cannot be reused.
- Blind requests use opaque IDs and never include the answer. Each request carries clues of only one kind and no more than one prompt per puzzle. The configured maximum is eight; the implementation caps solver batches at four because larger model responses omitted clue IDs. Fact requests can include the answer and both halves.
- Audit requests use reasoning effort medium and a 6,144-token completion cap so reasoning has room for the JSON response. If a provider rejects medium reasoning, the client retries without that parameter. Structured output falls back to JSON mode and then local JSON validation. Per-minute waits use the provider's named delay; daily quota stops preserve puzzle results and model token totals under ignored `data/` checkpoints.
- Pack generation is blocked until the old pack audit completes. It will keep only v2 passes, target 60, cap India-friendly entries at 15 while keeping at least eight, and prioritize at least 15 games puzzles. It uses `LLM_MODEL` and switches to `openai/gpt-oss-20b` if the generation model's daily quota is spent.
- Overlay state reports live, solved, time-up, and idle explicitly. The ticker shows only the side's last three guesses, with correct guesses represented as “got it” until reveal. The guess prefix comes from `COMMAND_PREFIX`, defaulting to `!g`; singular score copy uses “win.”
- During this work the free endpoint completed 8 of the 60 old puzzles before daily quota exhaustion. None of those eight passed v2. The checkpoint and token totals are retained; the remaining 52 old puzzles must be audited after the quota resets before generation can safely start.

## Slice 5b decisions

- A viewer owns one editable vote in their community. Recasting moves their previous vote. Aliases and accepted fuzzy spellings share the answer bucket; every other vote uses the whole normalized guess.
- A side's unique plurality leader is its result. Ties have no leader. The round is won only if both side leaders are correct, whether the round ends by timer or streamer lock.
- Early finish requires 15 seconds of play, correct unique leaders at 50 percent or more on both sides, and five continuous seconds in that state. A streamer lock ends voting immediately and records a win only when both leaders are correct.
- The overlay shows vote text and counts but withholds correctness until reveal. It shows only the current community's top three buckets and the other community's clue remains hidden. Recent samples are capped at 80 per round.
- The forge search is deterministic and uses only one or two typed attribute predicates per half. Each predicate set needs at least five entities, and at least two entities in each set must have fame at least equal to the answer.
- Audit v2.1 uses provider-prefixed Gemini and Groq model names. Gemini calls use its OpenAI-compatible endpoint and a separate key. The gpt-oss solver uses low reasoning. Model and audit version are included in fingerprints.
- Forge checkpoints now retain the selected candidate wording, completed puzzle results, and per-model token totals so a quota resume audits the same clues.
- Candidate text is written to the active pack only after at least 40 puzzles have matching v2.1 passes. The old pack remains in docs/archive/slice-5. The current quota stop has no completed v2.1 audit results, so no forged puzzles were kept.
- Demo mode uses a small clearly labeled sample pack only when no audited pack is available. It does not reintroduce the retired pack into the production game.
