# Twinclue: plan to win Codex x TwitchCon

Deadline: 2 Nov 2026, 2:00 PM PST (3 Nov, 3:30 AM IST). Submit by 2 Nov evening IST; the last day is buffer.

## What the judges score, and how Twinclue answers it

| Criterion | What we will show |
| --- | --- |
| Innovation | The only entry built for streamer collaboration: two communities, each holding half of every clue. Research found no other entry in this lane. |
| Potential impact | Collab streams are common, but the two audiences rarely talk. A measured live session: rounds played, solve times, and how many viewers from each side took part. |
| Technical implementation and use of Codex | Real Twitch integration (EventSub WebSocket, Helix chat, Shared Chat events, Channel Points), tests on every module, and one Codex session that built it slice by slice with AGENTS.md as its constitution. |
| Design | Two overlays that are fun to watch at a glance, a reveal that shows what each half alone could have meant, and a control panel a streamer can run while live. |

## Quality bars (no shortcuts)
1. Everything in the video is real Twitch, live, on two real channels. No mocked chat in the demo.
2. Every puzzle passes a blind test: a model given one half alone must not name the answer, and given both halves must. We publish the pass rate.
3. A real session with real numbers in the write-up.
4. All code written in the main Codex session (ID in DECISIONS.md and the submission); Claude designs, reviews and tests.
5. Writing: professional, human, no em dashes, no arrows.

## Schedule (IST)

| Day | Date | Work | Done when |
| --- | --- | --- | --- |
| 1 | Sun 26 Oct | Twitch app and OAuth live; bot reads and writes in the main channel; blind puzzle audit script and pack fixes; overlay v1 | a guess typed in real chat shows on the overlay |
| 2 | Mon 27 Oct | Overlays polished (timer, both halves, celebration, reveal with "your half alone could have been..."), control panel | a full round plays end to end on one channel |
| 3 | Tue 28 Oct | Second channel end to end; Shared Chat support; Channel Points "buy a hint"; scoreboard and streak | a round needs a correct guess from both channels to win |
| 4 | Wed 29 Oct | AI puzzle generator gated by code checks and the blind audit; moderation and length limits; resume after restart; recap page | 20 generated puzzles pass the audit; crash and resume tested |
| 5 | Thu 30 Oct | Live session on both channels with friends in each chat; collect metrics; fix everything found | a recorded session with real numbers |
| 6 | Fri 31 Oct | Video (about 2:45): problem moment, live demo from both streams, the reveal, Codex building it, results | video uploaded, public |
| 7 | Sat 1 Nov | README, Devpost story (about 1,000 words, measured numbers, "How we used Codex"), screenshots, landing page | everything linked and checked logged out |
| 8 | Sun 2 Nov | Buffer, final review; the user presses Submit | submitted before the deadline |

## Risks and answers
- **Shared Chat needs affiliate or partner channels.** Twinclue works across two separate chats by default and switches to Shared Chat when the session events arrive; the video shows the two-chat mode live and Shared Chat events through the Twitch CLI if the channels are not eligible, said plainly.
- **Codex usage limits on ChatGPT Go.** Keep prompts focused per slice; if limits hit, wait for the reset rather than writing code outside Codex.
- **Two simultaneous streams from one Mac.** OBS for channel A, a second OBS profile or an ffmpeg push for channel B, both at 720p.
- **Viewers for the live test.** Friends in each chat, plus the second account; numbers are reported honestly, however small.
