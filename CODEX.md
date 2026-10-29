# How Twinclue was built

Twinclue was built slice by slice with AI coding assistants, under the rules in [AGENTS.md](AGENTS.md) and the
product brief in [SPEC.md](SPEC.md). Every decision is recorded in [DECISIONS.md](DECISIONS.md).

- **OpenAI Codex** built slices 1 to 5c, in session `01a173c5-a449-71a1-abff-67e5a794156b`. The maintainer committed
  each slice after review. Codex's slice 5c turn stopped at the usage limit just after a green test run, and `d47fdde`
  was committed five minutes later.
- When the Codex plan reached its usage limit, **another AI coding assistant** continued from commit `d47fdde`. It
  built the later slices, and separate review passes (also AI-assisted) found and fixed bugs. The hackathon FAQ
  allows other AI coding assistants.

Not all of the code was written by Codex. The table below says which assistant built each commit, from `git log`.

| Commit | Date | Slice | What it built | Built by |
| --- | --- | --- | --- | --- |
| `370ca2a` | 25 Oct | Brief | SPEC.md (the product) and AGENTS.md (the build rules), written before any code | Maintainer, before coding |
| `74d2ca9` | 25 Oct | 1 | Game core: puzzle schema and fairness checks, the referee, two-community rounds, sessions | OpenAI Codex |
| `a532fa1` | 25 Oct | 2a, 2b | Puzzle pack with also-fits lists; Twitch OAuth, EventSub, chat and commands behind interfaces | OpenAI Codex |
| `d5a90b8` | 25 Oct | 3a, 3b | Blind puzzle audit, the first overlays, the control panel and demo mode | OpenAI Codex |
| `16783d1` | 26 Oct | 4 | Generated puzzle pipeline, overlay redesign and the paced demo | OpenAI Codex |
| `6e33861` | 26 Oct | 5 | Audit v2 with a solver panel and fact check; overlays that teach the game | OpenAI Codex |
| `0339448` | 26 Oct | 5b | Community lock-in voting and the Puzzle Forge | OpenAI Codex |
| `d47fdde` | 26 Oct | 5c | Forge quality: one puzzle per answer, fact checks, natural clue wording, paced audit | OpenAI Codex |
| `85d2284` | 27 Oct | 6 | Production hardening: one bot socket, admin token, overlay keys, EventSub reconnects, chat limits, metrics, fault tests, benchmark | Another AI coding assistant |
| `fc2b447` | 27 Oct | 6 review | Review fixes: rehearsal isolation, custom-table vocabulary, save ordering | Another AI coding assistant (review pass) |
| `aabfd39` | 27 Oct | 6 follow-up | One person per side, unscored skips, safer OAuth and demo, benchmark medians | Another AI coding assistant |
| `b864542` | 27 Oct | 6 fix | Forge test skips the verdict cache | Another AI coding assistant (review pass) |
| `97ed5c6` | 27 Oct | Audit v3 | Plain clue prompts, pending on thin panels, two-model fact checks | Another AI coding assistant |
| `94b5ae0` | 27 Oct | Overlay | Preview stage, premium card, centre-stage reveal | Another AI coding assistant |
| `d2e2ba5` | 28 Oct | Overlay review | Readable ticker, confetti behind the reveal, icon | Another AI coding assistant (review pass) |
| `36bca05` | 28 Oct | 7 | Live control panel, hint vote, session recap and sound cues | Another AI coding assistant |
| `46fcaba` | 29 Oct | 8 | Swap moment, video-safe showcase, OBS dock panel, the hosted sandbox, LICENSE and these docs | Another AI coding assistant |

## How Codex was used

Codex received one slice at a time, with AGENTS.md as its constitution: TypeScript strict, tests for every module,
Twitch and the model behind interfaces, no secrets in logs, plain English with no em dashes or arrows. Each slice
ended with green tests and a DECISIONS.md entry, so the next session (Codex or not) could pick up the reasoning, not
just the code. The rules that Codex followed are the same rules the later slices followed.
