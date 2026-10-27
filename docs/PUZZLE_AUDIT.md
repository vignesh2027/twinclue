# Puzzle audit

## History

- **Version 1** used shallow free-text prompts and let through single-half giveaways and false clues.
- **Version 2** added a stricter blind audit and a fact verifier, but tested free-text model-written clues. All 8 audited v2 puzzles failed; the report is archived in docs/archive/slice-5.
- **Version 2.1** moved to the Puzzle Forge: clues from curated attribute tables and deterministic set intersections.
- **Version 3** (this report) fixes four faults found in the 2.1 run. Clue prompts carried the labels "Half A alone" and "Half B alone", and one solver answered the label "B" for every half B. A puzzle failed when only one of three solvers answered, because the Gemini models were dropped on a per-minute quota. A single fact model rejected true facts ("2011 is not in the 2010s", "Bolivia is not landlocked"). And only the first 80 candidates were ever audited. Every 2.1 result is audited again under the new rules.

## Rules

Each of half A, half B and both halves together needs at least 2 valid solver answers, or the puzzle stays pending. A majority of valid solvers must miss each half alone and a majority must solve both halves together. Facts are checked per attribute by a two-model panel; a fact is rejected only when both models call it false.

- Solver prompts carry no labels. Clue ids are random 4 to 6 character strings, and the solver is told an id is only a label. An answer that repeats an id, has one or two characters (unless a fact table lists such a name, like Io), or puts the same value in all three fields is retried one clue at a time and otherwise ignored.
- A per-minute quota error waits and continues with the same model. Only a daily quota drops a model, and only for the rest of the run.
- Derived values (a debut decade, a discovery century) are computed in code from the table's raw year; the fact models are asked about the year itself.
- Auditing works through every ranked candidate across runs until enough puzzles pass within the category quotas, or the candidates run out.

## This run

- Solvers: gemini:gemini-3.5-flash, gemini:gemini-2.5-flash, groq:openai/gpt-oss-20b, groq:openai/gpt-oss-120b
- Fact panel: groq:openai/gpt-oss-120b + groq:openai/gpt-oss-20b
- Audited: 187 (passed 35, failed 152, pending 0)
- Pass rate of settled audits: 18.7%
- Single-half hit rate: 8.2%; both-halves hit rate: 39.0%
- Kept in the pack: 35
- Stopped because: candidates exhausted
- Token usage: {"gemini:gemini-3.5-flash":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"gemini:gemini-2.5-flash":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"groq:openai/gpt-oss-20b":{"promptTokens":70446,"completionTokens":79471,"totalTokens":149917},"groq:openai/gpt-oss-120b":{"promptTokens":70109,"completionTokens":94880,"totalTokens":164989}}

| Category | Quota | Candidates | Audited | Passed | Failed | Pending | Fact rejected | Pass rate | Kept |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| video game characters | 18 | 37 | 34 | 3 | 31 | 0 | 2 | 8.8% | 3 |
| musical instruments | 8 | 13 | 13 | 4 | 9 | 0 | 0 | 30.8% | 4 |
| countries | 14 | 65 | 62 | 8 | 54 | 0 | 1 | 12.9% | 8 |
| animals | 12 | 17 | 16 | 3 | 13 | 0 | 1 | 18.8% | 3 |
| foods and dishes | 12 | 34 | 33 | 10 | 23 | 0 | 1 | 30.3% | 10 |
| space objects | 8 | 13 | 13 | 3 | 10 | 0 | 0 | 23.1% | 3 |
| sports | 8 | 17 | 16 | 4 | 12 | 0 | 1 | 25.0% | 4 |

## Kept puzzles

| Puzzle | Category | Set A | Set B | Answer |
| --- | --- | ---: | ---: | --- |
| forge-3b7865ae49 | video game characters | 10 | 9 | Link |
| forge-7e8cb07986 | video game characters | 8 | 7 | Mega Man |
| forge-4fc54ce6db | video game characters | 5 | 8 | Sephiroth |
| forge-c4a645943d | countries | 9 | 10 | Iceland |
| forge-3f36e4a0b8 | countries | 10 | 9 | Morocco |
| forge-165704b5d9 | countries | 10 | 8 | Ecuador |
| forge-08838cb671 | countries | 10 | 10 | Spain |
| forge-5843427be1 | countries | 10 | 7 | Bulgaria |
| forge-289c87bf59 | countries | 11 | 10 | Switzerland |
| forge-20e5fc7f57 | countries | 6 | 13 | Cuba |
| forge-836ad8450a | countries | 25 | 8 | Japan |
| forge-cdbfc9b572 | animals | 10 | 9 | pig |
| forge-1d1813e286 | animals | 15 | 10 | cat |
| forge-161e9d7023 | animals | 29 | 12 | penguin |
| forge-b8813f0192 | foods and dishes | 9 | 11 | takoyaki |
| forge-19753100c9 | foods and dishes | 9 | 11 | tempura |
| forge-0fc13d8985 | foods and dishes | 10 | 5 | cornbread |
| forge-774c053ae4 | foods and dishes | 5 | 8 | gazpacho |
| forge-d699dbe215 | foods and dishes | 10 | 5 | polenta |
| forge-ed80615956 | foods and dishes | 11 | 5 | falafel |
| forge-5de71bc762 | foods and dishes | 14 | 8 | fried rice |
| forge-2973d3dfee | foods and dishes | 10 | 14 | risotto |
| forge-29194f9716 | foods and dishes | 5 | 7 | tamales |
| forge-3d42d657d0 | foods and dishes | 5 | 5 | tom yum |
| forge-bfb227a198 | musical instruments | 11 | 9 | bansuri |
| forge-30054dde67 | musical instruments | 9 | 5 | sheng |
| forge-0154b54d89 | musical instruments | 5 | 10 | mandolin |
| forge-5245adec6a | musical instruments | 6 | 5 | erhu |
| forge-cec9a54e17 | space objects | 8 | 7 | Ceres |
| forge-ac5b802003 | space objects | 6 | 10 | Mars |
| forge-431df05c79 | space objects | 5 | 5 | Ganymede |
| forge-0352d68a5e | sports | 8 | 12 | darts |
| forge-09857ed25d | sports | 15 | 9 | badminton |
| forge-abf8ec3239 | sports | 5 | 14 | squash |
| forge-f0db3d3caa | sports | 15 | 17 | golf |

## Every audited puzzle

### forge-abca7dc5fb: Jin Sakai (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Link (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Kratos (rejected); groq:openai/gpt-oss-120b: Nathan Drake (rejected)
- Both halves: groq:openai/gpt-oss-20b: Kratos (rejected); groq:openai/gpt-oss-120b: Kratos (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-35d95abb0b: Alexios (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Joker (rejected); groq:openai/gpt-oss-120b: Aloy (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Link (unclear); groq:openai/gpt-oss-120b: Link (unclear)
- Both halves: groq:openai/gpt-oss-20b: Aloy (unclear); groq:openai/gpt-oss-120b: Kratos (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-6c8ada375f: Chell (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Princess Peach (rejected); groq:openai/gpt-oss-120b: Princess Peach (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Link (unclear); groq:openai/gpt-oss-120b: Link (unclear)
- Both halves: groq:openai/gpt-oss-20b: A character is a human and is female (rejected); groq:openai/gpt-oss-120b: Chell (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-0cb9067385: Donkey Kong (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (rejected); groq:openai/gpt-oss-120b: Link (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Mickey Mouse (rejected); groq:openai/gpt-oss-120b: Sonic the Hedgehog (rejected)
- Both halves: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Donkey Kong (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-d340781465: Ezio (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Tony Stark (rejected); groq:openai/gpt-oss-120b: Nathan Drake (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Link (unclear); groq:openai/gpt-oss-120b: Link (unclear)
- Both halves: groq:openai/gpt-oss-20b: Mario (unclear); groq:openai/gpt-oss-120b: Sora (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-3b7865ae49: Link (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (unclear); groq:openai/gpt-oss-120b: Mario (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Arthur (rejected); groq:openai/gpt-oss-120b: Kirito (unclear)
- Both halves: groq:openai/gpt-oss-20b: Link (accepted); groq:openai/gpt-oss-120b: Link (accepted)

### forge-51ba4e9913: Isabelle (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mickey Mouse (rejected); groq:openai/gpt-oss-120b: Sonic the Hedgehog (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Joker (2021 film) (rejected); groq:openai/gpt-oss-120b: Sona (rejected)
- Both halves: groq:openai/gpt-oss-20b: Rango (rejected); groq:openai/gpt-oss-120b: Crash Bandicoot (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-8be9b60b85: Peach (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (unclear); groq:openai/gpt-oss-120b: Link (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Hermione Granger (rejected); groq:openai/gpt-oss-120b: Princess Zelda (rejected)
- Both halves: groq:openai/gpt-oss-20b: Zelda (unclear); groq:openai/gpt-oss-120b: Princess Peach (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-8f6e31d0de: Sora (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Tony Stark (rejected); groq:openai/gpt-oss-120b: Sora (accepted)
- Half B alone: groq:openai/gpt-oss-20b: Cloud Strife (rejected); groq:openai/gpt-oss-120b: Cloud Strife (rejected)
- Both halves: groq:openai/gpt-oss-20b: Geralt of Rivia (rejected); groq:openai/gpt-oss-120b: Tidus (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-c89529f49d: Albert Wesker (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Joker (unclear); groq:openai/gpt-oss-120b: Darth Vader (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Ryu (rejected); groq:openai/gpt-oss-120b: Ryu (rejected)
- Both halves: groq:openai/gpt-oss-20b: Mileena (rejected); groq:openai/gpt-oss-120b: Albert Wesker (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-05cdae3a8f: Fox McCloud (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mickey Mouse (rejected); groq:openai/gpt-oss-120b: Mickey Mouse (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Master Chief (rejected); groq:openai/gpt-oss-120b: Doomguy (rejected)
- Both halves: groq:openai/gpt-oss-20b: Ratchet (rejected); groq:openai/gpt-oss-120b: Fox McCloud (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-79a44e9119: Ganondorf (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Fox McCloud (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Link (rejected)
- Both halves: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Marth (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-7e8cb07986: Mega Man (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (rejected); groq:openai/gpt-oss-120b: Mario (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Ryu (rejected); groq:openai/gpt-oss-120b: Ryu (rejected)
- Both halves: groq:openai/gpt-oss-20b: Mega Man (accepted); groq:openai/gpt-oss-120b: Mega Man (accepted)

### forge-d202d501db: Porky Minch (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (rejected); groq:openai/gpt-oss-120b: Mario (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Darth Vader (rejected); groq:openai/gpt-oss-120b: Joker (rejected)
- Both halves: groq:openai/gpt-oss-20b: Ganondorf (rejected); groq:openai/gpt-oss-120b: Ganondorf (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-aa82469df5: Shulk (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Link (unclear); groq:openai/gpt-oss-120b: Marth (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Link (unclear); groq:openai/gpt-oss-120b: Link (unclear)
- Both halves: groq:openai/gpt-oss-20b: Link (unclear); groq:openai/gpt-oss-120b: Link (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-f0838dc097: Solid Snake (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (rejected); groq:openai/gpt-oss-120b: Mario (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Mario (rejected); groq:openai/gpt-oss-120b: Lara Croft (rejected)
- Both halves: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Link (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-3158360950: Villager (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Bowser Jr. (rejected); groq:openai/gpt-oss-20b: Inkling (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Link (rejected)
- Both halves: groq:openai/gpt-oss-20b: Link (rejected); groq:openai/gpt-oss-120b: Mii (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-c600e36801: Wario (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Mario (accepted); groq:openai/gpt-oss-20b: Mario (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Crash Bandicoot (rejected); groq:openai/gpt-oss-20b: Sonic (unclear)
- Both halves: groq:openai/gpt-oss-120b: Mario (accepted); groq:openai/gpt-oss-20b: Mario (accepted)
- Notes: halfA alone was solved by 2/2 valid solvers; a majority must miss it.

### forge-379d65a0f0: Aloy (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Cloud Strife (rejected); groq:openai/gpt-oss-20b: Link (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Nathan Drake (rejected); groq:openai/gpt-oss-20b: Solid Snake (rejected)
- Both halves: groq:openai/gpt-oss-120b: Cloud Strife (rejected); groq:openai/gpt-oss-20b: Sora (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-b1b370022f: Bowser Jr. (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (rejected); groq:openai/gpt-oss-120b: Master Chief (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Pikachu (rejected); groq:openai/gpt-oss-120b: Yoshi (rejected)
- Both halves: groq:openai/gpt-oss-20b: Shrek (rejected); groq:openai/gpt-oss-120b: Spyro (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-64151abf99: Dr. Eggman (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mario (rejected); groq:openai/gpt-oss-120b: Jak (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Maleficent (rejected); groq:openai/gpt-oss-120b: Darth Vader (rejected)
- Both halves: groq:openai/gpt-oss-20b: Wario (rejected); groq:openai/gpt-oss-120b: Dr. Robotnik (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-753fff729e: Ellie (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Princess Leia (rejected); groq:openai/gpt-oss-120b: Princess Zelda (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Nathan Drake (rejected); groq:openai/gpt-oss-120b: Nathan Drake (rejected)
- Both halves: groq:openai/gpt-oss-20b: Aloy (unclear); groq:openai/gpt-oss-120b: Aloy (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-5f7cc1eb92: Kiryu (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Katniss Everdeen (rejected); groq:openai/gpt-oss-120b: Sora (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Sonic (unclear); groq:openai/gpt-oss-120b: Sonic the Hedgehog (rejected)
- Both halves: groq:openai/gpt-oss-120b: Kazuma Kiryu (rejected); groq:openai/gpt-oss-20b: Tommy (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-c508f1bfa5: Ness (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Cloud Strife (rejected); groq:openai/gpt-oss-20b: Mario (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Link (unclear); groq:openai/gpt-oss-20b: Link (unclear)
- Both halves: groq:openai/gpt-oss-120b: The Nameless Hero (rejected); groq:openai/gpt-oss-20b: Link (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-4fc54ce6db: Sephiroth (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Cloud Strife (rejected); groq:openai/gpt-oss-20b: Link (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Darth Vader (rejected); groq:openai/gpt-oss-20b: Lord Voldemort (rejected)
- Both halves: groq:openai/gpt-oss-120b: Sephiroth (accepted); groq:openai/gpt-oss-20b: Sephiroth (accepted)

### forge-58c8fe6779: Cloud Strife (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Lara Croft (rejected); groq:openai/gpt-oss-20b: Lara Croft (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Link (rejected); groq:openai/gpt-oss-20b: Link (rejected)
- Both halves: groq:openai/gpt-oss-120b: Link (rejected); groq:openai/gpt-oss-20b: Link (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-64ce25959e: Joel (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Kratos (rejected); groq:openai/gpt-oss-20b: Kratos (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Elsa (unclear); groq:openai/gpt-oss-20b: Aloy (unclear)
- Both halves: groq:openai/gpt-oss-120b: Joel (accepted); groq:openai/gpt-oss-20b: Nathan Drake (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-28ba42a0c6: King K. Rool (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Mario (unclear); groq:openai/gpt-oss-20b: Mario (unclear)
- Half B alone: groq:openai/gpt-oss-120b: M. Bison (unclear); groq:openai/gpt-oss-20b: Agent Smith (rejected)
- Both halves: groq:openai/gpt-oss-120b: King Dedede (rejected); groq:openai/gpt-oss-20b: Bowser (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-242cb3e432: Bayonetta (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Nathan Drake (rejected); groq:openai/gpt-oss-20b: Nathan Drake (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Princess Peach (rejected); groq:openai/gpt-oss-20b: Mulan (rejected)
- Both halves: groq:openai/gpt-oss-120b: Aloy (rejected); groq:openai/gpt-oss-20b: Senua (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-53a4b346ee: Geralt (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Sora (unclear); groq:openai/gpt-oss-20b: Kratos (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Cloud Strife (rejected); groq:openai/gpt-oss-20b: Cloud Strife (rejected)
- Both halves: groq:openai/gpt-oss-120b: Arthas Menethil (rejected); groq:openai/gpt-oss-20b: Sora (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-8e3e026647: Kazuya Mishima (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Lara Croft (rejected); groq:openai/gpt-oss-20b: Lara Croft (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Ryu (unclear); groq:openai/gpt-oss-20b: Goku (unclear)
- Both halves: groq:openai/gpt-oss-120b: Naruto Uzumaki (rejected); groq:openai/gpt-oss-20b: Monkey D. Luffy (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-773ba9228b: Lara Croft (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Geralt of Rivia (rejected); groq:openai/gpt-oss-20b: Ash Ketchum (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Lara Croft (accepted); groq:openai/gpt-oss-20b: Zelda (rejected)
- Both halves: groq:openai/gpt-oss-120b: Lara Croft (accepted); groq:openai/gpt-oss-20b: Samus Aran (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-ebb3b678dd: Leon Kennedy (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Lara Croft (rejected); groq:openai/gpt-oss-20b: Mario (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Steve Rogers (rejected); groq:openai/gpt-oss-20b: Indiana Jones (rejected)
- Both halves: groq:openai/gpt-oss-120b: Sam Fisher (rejected); groq:openai/gpt-oss-20b: Nathan Drake (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-b174b91520: Toadette (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Rosalina (rejected); groq:openai/gpt-oss-20b: Waluigi (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Princess Peach (rejected); groq:openai/gpt-oss-20b: Hermione Granger (rejected)
- Both halves: groq:openai/gpt-oss-120b: Rosalina (rejected); groq:openai/gpt-oss-20b: Princess Peach (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-8c22cb1100: shehnai (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Clarinet (rejected); groq:openai/gpt-oss-120b: Oboe (rejected)
- Half B alone: groq:openai/gpt-oss-20b: sitar (unclear); groq:openai/gpt-oss-120b: Sitar (unclear)
- Both halves: groq:openai/gpt-oss-20b: Bansuri (rejected); groq:openai/gpt-oss-120b: Shehnai (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-bfb227a198: bansuri (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Flute (rejected); groq:openai/gpt-oss-120b: Flute (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Sitar (rejected); groq:openai/gpt-oss-120b: Sitar (rejected)
- Both halves: groq:openai/gpt-oss-20b: Bansuri (accepted); groq:openai/gpt-oss-120b: Bansuri (accepted)

### forge-1c91b69e2a: sarangi (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Violin (rejected); groq:openai/gpt-oss-120b: Violin (rejected)
- Half B alone: groq:openai/gpt-oss-20b: sitar (unclear); groq:openai/gpt-oss-120b: Sitar (unclear)
- Both halves: groq:openai/gpt-oss-20b: violin (rejected); groq:openai/gpt-oss-120b: Sarangi (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-1e03e6fe23: pipa (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Sitar (unclear); groq:openai/gpt-oss-120b: Erhu (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Violin (unclear); groq:openai/gpt-oss-120b: Violin (unclear)
- Both halves: groq:openai/gpt-oss-20b: kamancheh (rejected); groq:openai/gpt-oss-120b: Pipa (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-30054dde67: sheng (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Clarinet (rejected); groq:openai/gpt-oss-120b: Oboe (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Erhu (unclear); groq:openai/gpt-oss-120b: Erhu (unclear)
- Both halves: groq:openai/gpt-oss-20b: Sheng (accepted); groq:openai/gpt-oss-120b: Sheng (accepted)

### forge-0154b54d89: mandolin (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Violin (unclear); groq:openai/gpt-oss-120b: Violin (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Guitar (rejected); groq:openai/gpt-oss-120b: Guitar (rejected)
- Both halves: groq:openai/gpt-oss-20b: Mandolin (accepted); groq:openai/gpt-oss-120b: Mandolin (accepted)

### forge-53e2d54dfa: steelpan (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Trumpet (rejected); groq:openai/gpt-oss-120b: Trumpet (rejected)
- Half B alone: groq:openai/gpt-oss-20b: xylophone (rejected); groq:openai/gpt-oss-120b: Xylophone (rejected)
- Both halves: groq:openai/gpt-oss-20b: Xylophone (rejected); groq:openai/gpt-oss-120b: Glockenspiel (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-36ab22191e: dizi (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Flute (unclear); groq:openai/gpt-oss-120b: Flute (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Pipa (unclear); groq:openai/gpt-oss-120b: Erhu (unclear)
- Both halves: groq:openai/gpt-oss-20b: Sheng (unclear); groq:openai/gpt-oss-120b: Dizi (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-3a0f026f1c: guzheng (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Sitar (rejected); groq:openai/gpt-oss-120b: Harp (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Erhu (rejected); groq:openai/gpt-oss-120b: Erhu (rejected)
- Both halves: groq:openai/gpt-oss-20b: Erhu (rejected); groq:openai/gpt-oss-120b: Guqin (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-5245adec6a: erhu (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Violin (rejected); groq:openai/gpt-oss-20b: Violin (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Erhu (accepted); groq:openai/gpt-oss-20b: Pipa (unclear)
- Both halves: groq:openai/gpt-oss-120b: Erhu (accepted); groq:openai/gpt-oss-20b: Erhu (accepted)

### forge-caca8c80f2: cajón (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Timpani (rejected); groq:openai/gpt-oss-120b: Didgeridoo (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Handpan (unclear); groq:openai/gpt-oss-120b: Handpan (unclear)
- Both halves: groq:openai/gpt-oss-20b: Conga (unclear); groq:openai/gpt-oss-120b: Cajón (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-117ab83c5b: piccolo (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Flute (rejected); groq:openai/gpt-oss-120b: Flute (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Clarinet (rejected); groq:openai/gpt-oss-120b: Clarinet (rejected)
- Both halves: groq:openai/gpt-oss-120b: Flute (rejected); groq:openai/gpt-oss-20b: flute (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-a47faa2fa9: harp (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Violin (rejected); groq:openai/gpt-oss-20b: Violin (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Harp (accepted); groq:openai/gpt-oss-20b: Ukulele (rejected)
- Both halves: groq:openai/gpt-oss-120b: Harp (accepted); groq:openai/gpt-oss-20b: violin (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-fb9b9bbef8: South Africa (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Kenya (rejected); groq:openai/gpt-oss-120b: Kenya (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Australia (rejected); groq:openai/gpt-oss-120b: Australia (rejected)
- Both halves: groq:openai/gpt-oss-20b: Morocco (rejected); groq:openai/gpt-oss-120b: South Africa (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-4eb5a3c3cd: Belgium (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Nigeria (rejected); groq:openai/gpt-oss-120b: Germany (rejected)
- Half B alone: groq:openai/gpt-oss-20b: United Kingdom (rejected); groq:openai/gpt-oss-120b: United Kingdom (rejected)
- Both halves: groq:openai/gpt-oss-20b: Japan (rejected); groq:openai/gpt-oss-120b: Spain (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-f13a677ece: Botswana (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Luxembourg (rejected); groq:openai/gpt-oss-120b: Switzerland (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Botswana (accepted); groq:openai/gpt-oss-120b: Kenya (rejected)
- Both halves: groq:openai/gpt-oss-20b: Kazakhstan (rejected); groq:openai/gpt-oss-120b: Botswana (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-98acb7fbf8: Czechia (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Austria (unclear); groq:openai/gpt-oss-120b: Kazakhstan (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Ireland (rejected); groq:openai/gpt-oss-120b: Poland (rejected)
- Both halves: groq:openai/gpt-oss-20b: Austria (unclear); groq:openai/gpt-oss-120b: Czech Republic (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-f131670a30: Germany (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: France (unclear); groq:openai/gpt-oss-120b: United Kingdom (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Mali (unclear); groq:openai/gpt-oss-120b: Germany (accepted)
- Both halves: groq:openai/gpt-oss-20b: Hungary (unclear); groq:openai/gpt-oss-120b: Germany (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-2a5daf6734: Ghana (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Nigeria (unclear); groq:openai/gpt-oss-120b: Germany (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Brazil (unclear); groq:openai/gpt-oss-120b: Brazil (unclear)
- Both halves: groq:openai/gpt-oss-20b: Uganda (unclear); groq:openai/gpt-oss-120b: Mozambique (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-c4a645943d: Iceland (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Russia (rejected); groq:openai/gpt-oss-120b: Norway (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Japan (unclear); groq:openai/gpt-oss-120b: Japan (unclear)
- Both halves: groq:openai/gpt-oss-20b: Iceland (accepted); groq:openai/gpt-oss-120b: Iceland (accepted)

### forge-ff8607e705: Jordan (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Germany (unclear); groq:openai/gpt-oss-120b: Germany (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Saudi Arabia (rejected); groq:openai/gpt-oss-120b: Saudi Arabia (rejected)
- Both halves: groq:openai/gpt-oss-20b: Saudi Arabia (rejected); groq:openai/gpt-oss-120b: Jordan (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-7d890d1b90: Laos (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Switzerland (rejected); groq:openai/gpt-oss-120b: Switzerland (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Kyrgyzstan (rejected); groq:openai/gpt-oss-120b: Mongolia (rejected)
- Both halves: groq:openai/gpt-oss-20b: Mongolia (rejected); groq:openai/gpt-oss-120b: Tajikistan (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-3f36e4a0b8: Morocco (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Saudi Arabia (rejected); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Kenya (rejected); groq:openai/gpt-oss-20b: South Africa (rejected)
- Both halves: groq:openai/gpt-oss-20b: Morocco (accepted); groq:openai/gpt-oss-120b: Morocco (accepted)

### forge-940568f2e3: Pakistan (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: United Kingdom (rejected); groq:openai/gpt-oss-120b: India (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Brazil (rejected); groq:openai/gpt-oss-120b: Brazil (rejected)
- Both halves: groq:openai/gpt-oss-20b: Malaysia (rejected); groq:openai/gpt-oss-120b: Pakistan (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-1a358a41a5: Peru (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mexico (unclear); groq:openai/gpt-oss-120b: Mexico (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Japan (unclear); groq:openai/gpt-oss-120b: Canada (rejected)
- Both halves: groq:openai/gpt-oss-120b: Peru (accepted); groq:openai/gpt-oss-20b: Mexico (unclear)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-ce24cb270f: Albania (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Kenya (unclear); groq:openai/gpt-oss-20b: Morocco (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Norway (rejected); groq:openai/gpt-oss-20b: Canada (unclear)
- Both halves: groq:openai/gpt-oss-120b: Nigeria (unclear); groq:openai/gpt-oss-20b: Egypt (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-68eca4b8af: Algeria (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Nigeria (accepted); groq:openai/gpt-oss-20b: Kenya (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Italy (rejected); groq:openai/gpt-oss-20b: Italy (rejected)
- Both halves: groq:openai/gpt-oss-120b: Algeria (accepted); groq:openai/gpt-oss-20b: Kenya (unclear)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-7d21380646: Austria (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Mongolia (rejected); groq:openai/gpt-oss-20b: Switzerland (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Germany (rejected); groq:openai/gpt-oss-20b: Italy (rejected)
- Both halves: groq:openai/gpt-oss-120b: Slovakia (rejected); groq:openai/gpt-oss-20b: Luxembourg (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-daa7982292: Azerbaijan (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Kazakhstan (rejected); groq:openai/gpt-oss-20b: Belarus (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Pakistan (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Both halves: groq:openai/gpt-oss-120b: Azerbaijan (accepted); groq:openai/gpt-oss-20b: Kazakhstan (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-47d20e1a98: Belarus (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Finland (rejected); groq:openai/gpt-oss-20b: Kazakhstan (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Italy (rejected); groq:openai/gpt-oss-20b: Hungary (rejected)
- Both halves: groq:openai/gpt-oss-120b: Belarus (accepted); groq:openai/gpt-oss-20b: Kyrgyzstan (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-8930da7dfb: Brazil (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Brazil (accepted); groq:openai/gpt-oss-20b: Brazil (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Pakistan (rejected); groq:openai/gpt-oss-20b: Brazil (accepted)
- Both halves: groq:openai/gpt-oss-120b: Brazil (accepted); groq:openai/gpt-oss-20b: Brazil (accepted)
- Notes: halfA alone was solved by 2/2 valid solvers; a majority must miss it.

### forge-165704b5d9: Ecuador (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Mexico (rejected); groq:openai/gpt-oss-20b: Mexico (rejected)
- Half B alone: groq:openai/gpt-oss-120b: United States (rejected); groq:openai/gpt-oss-20b: United States (rejected)
- Both halves: groq:openai/gpt-oss-120b: Ecuador (accepted); groq:openai/gpt-oss-20b: Ecuador (accepted)

### forge-929411b5d6: Georgia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Norway (unclear); groq:openai/gpt-oss-20b: Sweden (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Indonesia (rejected); groq:openai/gpt-oss-20b: Poland (rejected)
- Both halves: groq:openai/gpt-oss-120b: Georgia (accepted); groq:openai/gpt-oss-20b: Poland (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-5e760bd8fd: Ireland (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Poland (unclear); groq:openai/gpt-oss-20b: Ireland (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Japan (unclear); groq:openai/gpt-oss-20b: Japan (unclear)
- Both halves: groq:openai/gpt-oss-120b: Cyprus (rejected); groq:openai/gpt-oss-20b: Malta (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-5959e8e1fb: Italy (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Germany (unclear); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Italy (accepted); groq:openai/gpt-oss-20b: Ireland (unclear)
- Both halves: groq:openai/gpt-oss-120b: Italy (accepted); groq:openai/gpt-oss-20b: France (unclear)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-d5a71a96e9: Malaysia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Norway (rejected); groq:openai/gpt-oss-20b: Norway (rejected)
- Half B alone: groq:openai/gpt-oss-120b: China (rejected); groq:openai/gpt-oss-20b: United States (rejected)
- Both halves: groq:openai/gpt-oss-120b: Malaysia (accepted); groq:openai/gpt-oss-20b: Jordan (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-98c5b35aa2: New Zealand (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Belgium (rejected); groq:openai/gpt-oss-20b: Denmark (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Japan (rejected); groq:openai/gpt-oss-20b: Iceland (rejected)
- Both halves: groq:openai/gpt-oss-120b: New Zealand (accepted); groq:openai/gpt-oss-20b: Jersey (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-fffe65974b: Norway (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Qatar (unclear); groq:openai/gpt-oss-20b: Thailand (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Norway (accepted); groq:openai/gpt-oss-20b: Norway (accepted)
- Both halves: groq:openai/gpt-oss-120b: Norway (accepted); groq:openai/gpt-oss-20b: Thailand (rejected)
- Notes: halfB alone was solved by 2/2 valid solvers; a majority must miss it. Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-bfdf46f92f: Philippines (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Japan (rejected); groq:openai/gpt-oss-20b: Ireland (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Vietnam (rejected); groq:openai/gpt-oss-20b: Brazil (rejected)
- Both halves: groq:openai/gpt-oss-120b: Solomon Islands (rejected); groq:openai/gpt-oss-20b: Philippines (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-40daaf2649: Poland (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Portugal (rejected); groq:openai/gpt-oss-20b: Romania (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Kazakhstan (rejected); groq:openai/gpt-oss-20b: Kazakhstan (rejected)
- Both halves: groq:openai/gpt-oss-120b: Finland (unclear); groq:openai/gpt-oss-20b: Estonia (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-3c070d5d2f: Russia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Mongolia (rejected); groq:openai/gpt-oss-20b: India (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Norway (rejected); groq:openai/gpt-oss-20b: Japan (rejected)
- Both halves: groq:openai/gpt-oss-120b: Mongolia (rejected); groq:openai/gpt-oss-20b: China (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-08838cb671: Spain (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Mexico (unclear); groq:openai/gpt-oss-20b: Mexico (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Greece (rejected); groq:openai/gpt-oss-20b: Greece (rejected)
- Both halves: groq:openai/gpt-oss-120b: Spain (accepted); groq:openai/gpt-oss-20b: Spain (accepted)

### forge-d666ca98e2: Sweden (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Switzerland (rejected); groq:openai/gpt-oss-20b: Sweden (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Japan (unclear); groq:openai/gpt-oss-20b: Spain (unclear)
- Both halves: groq:openai/gpt-oss-120b: Sweden (accepted); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-8551223595: United Kingdom (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Greece (rejected); groq:openai/gpt-oss-20b: Greece (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Japan (unclear); groq:openai/gpt-oss-20b: Jamaica (rejected)
- Both halves: groq:openai/gpt-oss-120b: United Kingdom (accepted); groq:openai/gpt-oss-20b: Greece (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-e40e31f238: Bhutan (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: India (unclear); groq:openai/gpt-oss-20b: India (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Saudi Arabia (rejected); groq:openai/gpt-oss-20b: Saudi Arabia (rejected)
- Both halves: groq:openai/gpt-oss-120b: Bhutan (accepted); groq:openai/gpt-oss-20b: Brunei (unclear)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-5843427be1: Bulgaria (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Portugal (rejected); groq:openai/gpt-oss-20b: Poland (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Greece (rejected); groq:openai/gpt-oss-20b: Greece (rejected)
- Both halves: groq:openai/gpt-oss-120b: Bulgaria (accepted); groq:openai/gpt-oss-20b: Bulgaria (accepted)

### forge-0d3e9ceefc: Chile (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Uruguay (rejected); groq:openai/gpt-oss-20b: Colombia (rejected)
- Half B alone: groq:openai/gpt-oss-120b: United States (rejected); groq:openai/gpt-oss-20b: Australia (rejected)
- Both halves: groq:openai/gpt-oss-120b: Paraguay (rejected); groq:openai/gpt-oss-20b: Chile (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-12f2b0b399: Ethiopia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Austria (rejected); groq:openai/gpt-oss-20b: Bolivia (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Nigeria (rejected); groq:openai/gpt-oss-20b: Ghana (rejected)
- Both halves: groq:openai/gpt-oss-120b: Ethiopia (accepted); groq:openai/gpt-oss-20b: Rwanda (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-0c58ab582d: Greece (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Spain (rejected); groq:openai/gpt-oss-20b: Greece (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Greece (accepted); groq:openai/gpt-oss-20b: Greece (accepted)
- Both halves: groq:openai/gpt-oss-120b: Greece (accepted); groq:openai/gpt-oss-20b: Greece (accepted)
- Notes: halfB alone was solved by 2/2 valid solvers; a majority must miss it.

### forge-f21ff34869: India (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Bangladesh (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Australia (rejected); groq:openai/gpt-oss-20b: India (accepted)
- Both halves: groq:openai/gpt-oss-120b: Pakistan (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-190289b3b0: Iraq (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Pakistan (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Kenya (unclear); groq:openai/gpt-oss-20b: Gabon (unclear)
- Both halves: groq:openai/gpt-oss-120b: Bangladesh (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-289c87bf59: Switzerland (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Hungary (rejected); groq:openai/gpt-oss-20b: Bolivia (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Finland (rejected); groq:openai/gpt-oss-20b: Sweden (rejected)
- Both halves: groq:openai/gpt-oss-120b: Switzerland (accepted); groq:openai/gpt-oss-20b: Switzerland (accepted)

### forge-eed7b0269b: Maldives (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Saudi Arabia (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Japan (rejected); groq:openai/gpt-oss-20b: Philippines (rejected)
- Both halves: groq:openai/gpt-oss-120b: Pakistan (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-0d39677eb0: Mongolia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: China (rejected); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Austria (rejected); groq:openai/gpt-oss-20b: Bolivia (unclear)
- Both halves: groq:openai/gpt-oss-120b: Kazakhstan (rejected); groq:openai/gpt-oss-20b: Kazakhstan (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-ea2530fc12: Myanmar (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Saudi Arabia (rejected); groq:openai/gpt-oss-20b: Thailand (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Brazil (rejected); groq:openai/gpt-oss-20b: China (unclear)
- Both halves: groq:openai/gpt-oss-120b: Pakistan (rejected); groq:openai/gpt-oss-20b: Kazakhstan (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-d9c2f19197: Singapore (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: China (rejected); groq:openai/gpt-oss-20b: India (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Japan (rejected); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Both halves: groq:openai/gpt-oss-120b: Malaysia (rejected); groq:openai/gpt-oss-20b: India (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-512958cfdd: Iran (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Iran (accepted); groq:openai/gpt-oss-20b: Greece (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Italy (unclear); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Both halves: groq:openai/gpt-oss-120b: Iran (accepted); groq:openai/gpt-oss-20b: Afghanistan (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-b0e4699bc2: Netherlands (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Spain (rejected); groq:openai/gpt-oss-20b: Cyprus (rejected)
- Half B alone: groq:openai/gpt-oss-120b: United Kingdom (rejected); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Both halves: groq:openai/gpt-oss-120b: Spain (rejected); groq:openai/gpt-oss-20b: Spain (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-4d508529c9: Thailand (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: India (rejected); groq:openai/gpt-oss-20b: India (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Spain (unclear); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Both halves: groq:openai/gpt-oss-120b: Thailand (accepted); groq:openai/gpt-oss-20b: Malaysia (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-3b335acd8f: Afghanistan (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Nepal (rejected); groq:openai/gpt-oss-20b: Vietnam (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Turkmenistan (rejected); groq:openai/gpt-oss-20b: Turkey (rejected)
- Both halves: groq:openai/gpt-oss-120b: Afghanistan (accepted); groq:openai/gpt-oss-20b: Pakistan (unclear)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-56f8853391: Andorra (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Norway (unclear); groq:openai/gpt-oss-20b: Canada (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Spain (rejected); groq:openai/gpt-oss-20b: Germany (rejected)
- Both halves: groq:openai/gpt-oss-120b: Montenegro (rejected); groq:openai/gpt-oss-20b: Kosovo (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-dfd8f4b200: Australia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: United States (rejected); groq:openai/gpt-oss-20b: Brazil (rejected)
- Half B alone: groq:openai/gpt-oss-120b: United Kingdom (rejected); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Both halves: groq:openai/gpt-oss-120b: Australia (accepted); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-2d29dd5a73: North Korea (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Vietnam (rejected); groq:openai/gpt-oss-20b: India (rejected)
- Half B alone: groq:openai/gpt-oss-120b: United States (rejected); groq:openai/gpt-oss-20b: United States (rejected)
- Both halves: groq:openai/gpt-oss-120b: North Korea (accepted); groq:openai/gpt-oss-20b: Kazakhstan (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-2381e2beba: South Korea (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Kazakhstan (rejected); groq:openai/gpt-oss-20b: Thailand (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Brazil (rejected); groq:openai/gpt-oss-20b: Brazil (rejected)
- Both halves: groq:openai/gpt-oss-120b: South Korea (accepted); groq:openai/gpt-oss-20b: Greece (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-b007e4c5d6: Canada (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: France (unclear); groq:openai/gpt-oss-20b: United States (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Canada (accepted); groq:openai/gpt-oss-20b: Japan (unclear)
- Both halves: groq:openai/gpt-oss-120b: Canada (accepted); groq:openai/gpt-oss-20b: Turkey (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-8270c0d1e3: Bolivia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Austria (unclear); groq:openai/gpt-oss-20b: Switzerland (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Mexico (rejected); groq:openai/gpt-oss-20b: Mexico (rejected)
- Both halves: groq:openai/gpt-oss-120b: Paraguay (rejected); groq:openai/gpt-oss-20b: Bolivia (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-20e5fc7f57: Cuba (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Canada (unclear); groq:openai/gpt-oss-20b: Canada (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Japan (unclear); groq:openai/gpt-oss-20b: Japan (unclear)
- Both halves: groq:openai/gpt-oss-120b: Cuba (accepted); groq:openai/gpt-oss-20b: Cuba (accepted)

### forge-2d70652ad6: Panama (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: United States (rejected); groq:openai/gpt-oss-20b: Canada (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Spain (unclear); groq:openai/gpt-oss-20b: Mexico (rejected)
- Both halves: groq:openai/gpt-oss-120b: Mexico (rejected); groq:openai/gpt-oss-20b: Mexico (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-1125dbbeed: Ukraine (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Colombia (rejected); groq:openai/gpt-oss-20b: Portugal (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Norway (rejected); groq:openai/gpt-oss-20b: Brazil (unclear)
- Both halves: groq:openai/gpt-oss-120b: Ukraine (accepted); groq:openai/gpt-oss-20b: Bangladesh (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-210ecae403: Türkiye (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: United States (rejected); groq:openai/gpt-oss-20b: United States (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Denmark (rejected); groq:openai/gpt-oss-20b: Japan (rejected)
- Both halves: groq:openai/gpt-oss-120b: Turkey (accepted); groq:openai/gpt-oss-20b: United States (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-751bd5f573: Argentina (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Ecuador (rejected); groq:openai/gpt-oss-20b: Portugal (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Argentina (accepted); groq:openai/gpt-oss-20b: Argentina (accepted)
- Both halves: groq:openai/gpt-oss-120b: Venezuela (rejected); groq:openai/gpt-oss-20b: Colombia (rejected)
- Notes: halfB alone was solved by 2/2 valid solvers; a majority must miss it. Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-82b826c5b5: Colombia (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Ukraine (rejected); groq:openai/gpt-oss-20b: Bhutan (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Spain (rejected); groq:openai/gpt-oss-20b: Spain (rejected)
- Both halves: groq:openai/gpt-oss-120b: Mali (rejected); groq:openai/gpt-oss-20b: Colombia (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-a3394de045: Jamaica (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: United Kingdom (rejected); groq:openai/gpt-oss-20b: Australia (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Canada (unclear); groq:openai/gpt-oss-20b: Canada (unclear)
- Both halves: groq:openai/gpt-oss-120b: Canada (unclear); groq:openai/gpt-oss-20b: Jamaica (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-836ad8450a: Japan (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Japan (accepted); groq:openai/gpt-oss-20b: China (unclear)
- Half B alone: groq:openai/gpt-oss-120b: United Kingdom (rejected); groq:openai/gpt-oss-20b: United Kingdom (rejected)
- Both halves: groq:openai/gpt-oss-120b: Japan (accepted); groq:openai/gpt-oss-20b: Japan (accepted)

### forge-963cad6729: Hungary (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Nigeria (rejected); groq:openai/gpt-oss-20b: Sri Lanka (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Germany (unclear); groq:openai/gpt-oss-20b: Germany (unclear)
- Both halves: groq:openai/gpt-oss-120b: Switzerland (rejected); groq:openai/gpt-oss-20b: Slovenia (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-cdbfc9b572: pig (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Sheep (unclear); groq:openai/gpt-oss-120b: Goat (unclear)
- Half B alone: groq:openai/gpt-oss-20b: bear (unclear); groq:openai/gpt-oss-120b: Raccoon (rejected)
- Both halves: groq:openai/gpt-oss-20b: Pig (accepted); groq:openai/gpt-oss-120b: Pig (accepted)

### forge-3460add9e0: chimpanzee (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Bear (unclear); groq:openai/gpt-oss-120b: Raccoon (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Giraffe (rejected); groq:openai/gpt-oss-120b: African Elephant (rejected)
- Both halves: groq:openai/gpt-oss-20b: Lion (unclear); groq:openai/gpt-oss-120b: Spotted hyena (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-33fb57b154: opossum (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Bear (rejected); groq:openai/gpt-oss-120b: Raccoon (rejected)
- Half B alone: groq:openai/gpt-oss-20b: kangaroo (rejected); groq:openai/gpt-oss-120b: Kangaroo (rejected)
- Both halves: groq:openai/gpt-oss-20b: kangaroo (rejected); groq:openai/gpt-oss-120b: Opossum (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-d1fd44e802: clownfish (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Zebra (rejected); groq:openai/gpt-oss-120b: Zebra (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Octopus (rejected); groq:openai/gpt-oss-120b: Snake (rejected)
- Both halves: groq:openai/gpt-oss-20b: Snake (rejected); groq:openai/gpt-oss-120b: Coral snake (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-b87444506f: king cobra (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Snow Leopard (rejected); groq:openai/gpt-oss-120b: Giant panda (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Snake (rejected); groq:openai/gpt-oss-120b: Snake (rejected)
- Both halves: groq:openai/gpt-oss-20b: Shark (rejected); groq:openai/gpt-oss-120b: King cobra (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-3fa62bb139: orca (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Panda (unclear); groq:openai/gpt-oss-120b: Zebra (unclear)
- Half B alone: groq:openai/gpt-oss-20b: worm (unclear); groq:openai/gpt-oss-120b: Snake (unclear)
- Both halves: groq:openai/gpt-oss-20b: Penguin (rejected); groq:openai/gpt-oss-120b: Slug (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-b3c3b2e07a: skunk (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Opossum (rejected); groq:openai/gpt-oss-120b: Bat (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Zebra (unclear); groq:openai/gpt-oss-120b: Zebra (unclear)
- Both halves: groq:openai/gpt-oss-20b: Ocelot (rejected); groq:openai/gpt-oss-120b: Tiger (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-78ce6763d4: zebra (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Zebra (accepted); groq:openai/gpt-oss-120b: Zebra (accepted)
- Half B alone: groq:openai/gpt-oss-20b: Deer (unclear); groq:openai/gpt-oss-120b: Cow (unclear)
- Both halves: groq:openai/gpt-oss-20b: Zebra (accepted); groq:openai/gpt-oss-120b: Zebra (accepted)
- Notes: halfA alone was solved by 2/2 valid solvers; a majority must miss it.

### forge-81710fa2fa: emu (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Koala (unclear); groq:openai/gpt-oss-20b: Kangaroo (rejected)
- Half B alone: groq:openai/gpt-oss-120b: African Grey Parrot (rejected); groq:openai/gpt-oss-20b: Penguin (unclear)
- Both halves: groq:openai/gpt-oss-120b: Emu (accepted); groq:openai/gpt-oss-20b: Kookaburra (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-e0ddceea3f: owl (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Platypus (rejected); groq:openai/gpt-oss-120b: Komodo dragon (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Owl (accepted); groq:openai/gpt-oss-120b: Owl (accepted)
- Both halves: groq:openai/gpt-oss-20b: Crocodile (rejected); groq:openai/gpt-oss-120b: Echidna (rejected)
- Notes: halfB alone was solved by 2/2 valid solvers; a majority must miss it. Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-1d1813e286: cat (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Lion (unclear); groq:openai/gpt-oss-120b: Tiger (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Cow (unclear); groq:openai/gpt-oss-120b: Chicken (rejected)
- Both halves: groq:openai/gpt-oss-120b: Cat (accepted); groq:openai/gpt-oss-20b: cat (accepted)

### forge-c8f906bba7: Komodo dragon (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Platypus (rejected); groq:openai/gpt-oss-20b: Platypus (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Giant panda (rejected); groq:openai/gpt-oss-20b: Snow leopard (rejected)
- Both halves: groq:openai/gpt-oss-120b: Komodo dragon (accepted); groq:openai/gpt-oss-20b: tortoise (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-d4f6a10c76: platypus (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Platypus (accepted); groq:openai/gpt-oss-20b: Platypus (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Koala (rejected); groq:openai/gpt-oss-20b: Kangaroo (rejected)
- Both halves: groq:openai/gpt-oss-120b: Saltwater crocodile (rejected); groq:openai/gpt-oss-20b: Platypus (accepted)
- Notes: halfA alone was solved by 2/2 valid solvers; a majority must miss it. Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-44c7a7e55a: Tasmanian devil (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Lion (rejected); groq:openai/gpt-oss-20b: Lion (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Bat (rejected); groq:openai/gpt-oss-20b: Opossum (rejected)
- Both halves: groq:openai/gpt-oss-120b: Tiger (rejected); groq:openai/gpt-oss-20b: Bat (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-7386431cb8: ladybug (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Leopard (unclear); groq:openai/gpt-oss-20b: leopard (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Bat (rejected); groq:openai/gpt-oss-20b: eagle (rejected)
- Both halves: groq:openai/gpt-oss-120b: Spotted owl (rejected); groq:openai/gpt-oss-20b: Flying Squirrel (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-161e9d7023: penguin (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Tiger (rejected); groq:openai/gpt-oss-20b: lion (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Penguin (accepted); groq:openai/gpt-oss-20b: eagle (unclear)
- Both halves: groq:openai/gpt-oss-120b: Penguin (accepted); groq:openai/gpt-oss-20b: Penguin (accepted)

### forge-59fe606b71: yakitori (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Taco (rejected); groq:openai/gpt-oss-120b: Tacos (rejected)
- Half B alone: groq:openai/gpt-oss-20b: sushi (rejected); groq:openai/gpt-oss-120b: Ramen (rejected)
- Both halves: groq:openai/gpt-oss-20b: Okonomiyaki (rejected); groq:openai/gpt-oss-120b: Takoyaki (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-0ea84aff74: chow mein (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Pasta (rejected); groq:openai/gpt-oss-120b: Pizza (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Peking duck (rejected); groq:openai/gpt-oss-120b: Peking Duck (rejected)
- Both halves: groq:openai/gpt-oss-20b: Noodles (rejected); groq:openai/gpt-oss-120b: Jianbing (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-a7b9acae7a: croissant (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Lasagna (rejected); groq:openai/gpt-oss-120b: Lasagna (rejected)
- Half B alone: groq:openai/gpt-oss-20b: pancakes (rejected); groq:openai/gpt-oss-120b: Pancakes (rejected)
- Both halves: groq:openai/gpt-oss-20b: pancake (rejected); groq:openai/gpt-oss-120b: Bagel (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-b8813f0192: takoyaki (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Sushi (rejected); groq:openai/gpt-oss-120b: Ramen (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Taco (unclear); groq:openai/gpt-oss-120b: Tacos (unclear)
- Both halves: groq:openai/gpt-oss-20b: Takoyaki (accepted); groq:openai/gpt-oss-120b: Takoyaki (accepted)

### forge-19753100c9: tempura (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Sushi (rejected); groq:openai/gpt-oss-120b: Sushi (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Chicken wings (rejected); groq:openai/gpt-oss-120b: Tempura (accepted)
- Both halves: groq:openai/gpt-oss-20b: Tempura (accepted); groq:openai/gpt-oss-120b: Tempura (accepted)

### forge-a9f10e7a6b: burrito (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Pizza (rejected); groq:openai/gpt-oss-120b: Pizza (rejected)
- Half B alone: groq:openai/gpt-oss-20b: taco (rejected); groq:openai/gpt-oss-120b: Taco (rejected)
- Both halves: groq:openai/gpt-oss-20b: Tortilla (rejected); groq:openai/gpt-oss-120b: Tortilla (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-3e733f2fc0: samosa (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Samosa (accepted); groq:openai/gpt-oss-120b: Samosa (accepted)
- Half B alone: groq:openai/gpt-oss-20b: Tacos (unclear); groq:openai/gpt-oss-120b: Taco (unclear)
- Both halves: groq:openai/gpt-oss-20b: Samosa (accepted); groq:openai/gpt-oss-120b: Falafel (rejected)
- Notes: halfA alone was solved by 2/2 valid solvers; a majority must miss it. Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-2a59e2f68c: tacos (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Taco (accepted); groq:openai/gpt-oss-120b: Tacos (accepted)
- Half B alone: groq:openai/gpt-oss-20b: Tacos (accepted); groq:openai/gpt-oss-120b: Tacos (accepted)
- Both halves: groq:openai/gpt-oss-20b: Taco (accepted); groq:openai/gpt-oss-120b: Taco (accepted)
- Notes: halfA alone was solved by 2/2 valid solvers; a majority must miss it. halfB alone was solved by 2/2 valid solvers; a majority must miss it.

### forge-0fc13d8985: cornbread (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Lasagna (rejected); groq:openai/gpt-oss-20b: Pizza (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Tamale (rejected); groq:openai/gpt-oss-20b: Tortilla (rejected)
- Both halves: groq:openai/gpt-oss-120b: Cornbread (accepted); groq:openai/gpt-oss-20b: Cornbread (accepted)

### forge-8b9019e456: focaccia (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Lasagna (rejected); groq:openai/gpt-oss-120b: Risotto (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Naan (rejected); groq:openai/gpt-oss-120b: Pita (rejected)
- Both halves: groq:openai/gpt-oss-20b: Pizza (rejected); groq:openai/gpt-oss-120b: Focaccia (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-774c053ae4: gazpacho (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Gazpacho (accepted); groq:openai/gpt-oss-120b: Tom Yum (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Salad (rejected); groq:openai/gpt-oss-120b: Gazpacho (accepted)
- Both halves: groq:openai/gpt-oss-120b: Gazpacho (accepted); groq:openai/gpt-oss-20b: Gazpacho (accepted)

### forge-325b450f2b: gelato (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Risotto (unclear); groq:openai/gpt-oss-20b: Lasagna (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Paneer (rejected); groq:openai/gpt-oss-20b: Paneer (rejected)
- Both halves: groq:openai/gpt-oss-120b: Panna cotta (rejected); groq:openai/gpt-oss-20b: panna cotta (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-eda378a80f: pad thai (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Tacos (rejected); groq:openai/gpt-oss-20b: Kebab (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Ramen (rejected); groq:openai/gpt-oss-20b: Ramen (rejected)
- Both halves: groq:openai/gpt-oss-120b: Pho (rejected); groq:openai/gpt-oss-20b: Pho (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-d699dbe215: polenta (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Pizza (unclear); groq:openai/gpt-oss-20b: pizza (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Polenta (accepted); groq:openai/gpt-oss-20b: tortilla (rejected)
- Both halves: groq:openai/gpt-oss-120b: Polenta (accepted); groq:openai/gpt-oss-20b: Polenta (accepted)

### forge-a1b064fd88: xiaolongbao (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Momos (rejected); groq:openai/gpt-oss-20b: Dumplings (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Kung Pao Chicken (rejected); groq:openai/gpt-oss-20b: Peking duck (rejected)
- Both halves: groq:openai/gpt-oss-120b: Baozi (rejected); groq:openai/gpt-oss-20b: Dumplings (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-ed80615956: falafel (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Tempura (rejected); groq:openai/gpt-oss-20b: Fries (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Hummus (rejected); groq:openai/gpt-oss-20b: Hummus (rejected)
- Both halves: groq:openai/gpt-oss-120b: Falafel (accepted); groq:openai/gpt-oss-20b: Falafel (accepted)

### forge-36e483e70e: gulab jamun (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Tempura (rejected); groq:openai/gpt-oss-20b: fried chicken (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Rice pudding (rejected); groq:openai/gpt-oss-20b: Cheesecake (rejected)
- Both halves: groq:openai/gpt-oss-120b: Mozzarella sticks (rejected); groq:openai/gpt-oss-20b: Churros (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-5de71bc762: fried rice (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Paella (rejected); groq:openai/gpt-oss-20b: paella (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Kung Pao Chicken (rejected); groq:openai/gpt-oss-20b: Peking duck (rejected)
- Both halves: groq:openai/gpt-oss-120b: Fried rice (accepted); groq:openai/gpt-oss-20b: Fried rice (accepted)

### forge-8321932cc6: paratha (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Butter chicken (rejected); groq:openai/gpt-oss-20b: Biryani (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Naan (unclear); groq:openai/gpt-oss-20b: Pita (unclear)
- Both halves: groq:openai/gpt-oss-120b: Naan (unclear); groq:openai/gpt-oss-20b: Naan (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-2973d3dfee: risotto (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Risotto (accepted); groq:openai/gpt-oss-20b: Pasta (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Paella (rejected); groq:openai/gpt-oss-20b: Paella (rejected)
- Both halves: groq:openai/gpt-oss-120b: Risotto (accepted); groq:openai/gpt-oss-20b: Risotto (accepted)

### forge-29194f9716: tamales (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Steamed buns (rejected); groq:openai/gpt-oss-20b: Dim sum (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Tacos (unclear); groq:openai/gpt-oss-20b: Tacos (unclear)
- Both halves: groq:openai/gpt-oss-120b: Tamales (accepted); groq:openai/gpt-oss-20b: Tamale (accepted)

### forge-81ad3506b9: baguette (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Naan (rejected); groq:openai/gpt-oss-20b: Pita (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Coq au vin (rejected); groq:openai/gpt-oss-20b: Coq au vin (rejected)
- Both halves: groq:openai/gpt-oss-120b: Brioche (rejected); groq:openai/gpt-oss-20b: Baguette (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-45c5bd3366: dhokla (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Baozi (unclear); groq:openai/gpt-oss-20b: Dumplings (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Hummus (rejected); groq:openai/gpt-oss-20b: Hummus (rejected)
- Both halves: groq:openai/gpt-oss-120b: Dhokla (accepted); groq:openai/gpt-oss-20b: Hummus (rejected)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-066f3212e7: pani puri (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Samosa (rejected); groq:openai/gpt-oss-20b: Curry (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Tempura (rejected); groq:openai/gpt-oss-20b: Fried chicken (rejected)
- Both halves: groq:openai/gpt-oss-120b: Samosa (rejected); groq:openai/gpt-oss-20b: Samosa (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-3d42d657d0: tom yum (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Minestrone (rejected); groq:openai/gpt-oss-20b: Tomato soup (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Pad Thai (rejected); groq:openai/gpt-oss-20b: Pad Thai (rejected)
- Both halves: groq:openai/gpt-oss-120b: Tom Yum (accepted); groq:openai/gpt-oss-20b: Tom Yum (accepted)

### forge-439162d4f5: idli (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Risotto (rejected); groq:openai/gpt-oss-20b: Biryani (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Baozi (unclear); groq:openai/gpt-oss-20b: Dumpling (rejected)
- Both halves: groq:openai/gpt-oss-120b: Sushi (unclear); groq:openai/gpt-oss-20b: Mochi (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-7a616a7bdb: mango sticky rice (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Sushi (rejected); groq:openai/gpt-oss-20b: Arroz con leche (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Tiramisu (rejected); groq:openai/gpt-oss-20b: Chocolate cake (rejected)
- Both halves: groq:openai/gpt-oss-120b: Rice pudding (rejected); groq:openai/gpt-oss-20b: Rice pudding (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-1510397555: nachos (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Tacos (accepted); groq:openai/gpt-oss-20b: Samosa (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Polenta (rejected); groq:openai/gpt-oss-20b: Tortilla (rejected)
- Both halves: groq:openai/gpt-oss-120b: Taco (unclear); groq:openai/gpt-oss-20b: Tortilla (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-19100ccb29: pho (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Paella (unclear); groq:openai/gpt-oss-20b: Paella (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Minestrone (rejected); groq:openai/gpt-oss-20b: Tomato soup (rejected)
- Both halves: groq:openai/gpt-oss-120b: Congee (rejected); groq:openai/gpt-oss-20b: Congee (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-66656e5003: brownie (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Tacos (rejected); groq:openai/gpt-oss-20b: Samosa (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Cheesecake (rejected); groq:openai/gpt-oss-20b: Pudding (rejected)
- Both halves: groq:openai/gpt-oss-120b: Samosa (rejected); groq:openai/gpt-oss-20b: Churros (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-c724b8b54b: jalebi (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Bread (unclear); groq:openai/gpt-oss-20b: Bread (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Gelato (unclear); groq:openai/gpt-oss-20b: Gelatin (unclear)
- Both halves: groq:openai/gpt-oss-120b: Baklava (unclear); groq:openai/gpt-oss-20b: Cookie (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-4251ee09f4: onigiri (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Taco (rejected); groq:openai/gpt-oss-20b: Pizza (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Paella (rejected); groq:openai/gpt-oss-20b: Paella (rejected)
- Both halves: groq:openai/gpt-oss-120b: Sushi (rejected); groq:openai/gpt-oss-20b: Biryani (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-22b1fce26a: rasmalai (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Biryani (rejected); groq:openai/gpt-oss-20b: Curry (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Ice cream (rejected); groq:openai/gpt-oss-20b: Ice cream (rejected)
- Both halves: groq:openai/gpt-oss-120b: Kulfi (rejected); groq:openai/gpt-oss-20b: Kulfi (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-cec9a54e17: Ceres (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Mercury (unclear); groq:openai/gpt-oss-120b: Mercury (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Ceres (accepted); groq:openai/gpt-oss-120b: Neptune (rejected)
- Both halves: groq:openai/gpt-oss-20b: Ceres (accepted); groq:openai/gpt-oss-120b: Ceres (accepted)

### forge-dc8183791f: Io (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Jupiter (rejected); groq:openai/gpt-oss-120b: Ganymede (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Asteroid (rejected); groq:openai/gpt-oss-120b: Mars (unclear)
- Both halves: groq:openai/gpt-oss-20b: Mars (unclear); groq:openai/gpt-oss-120b: Mars (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-ac5b802003: Mars (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Mercury (unclear); groq:openai/gpt-oss-120b: Mercury (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Saturn (unclear); groq:openai/gpt-oss-120b: Jupiter (rejected)
- Both halves: groq:openai/gpt-oss-20b: Mars (accepted); groq:openai/gpt-oss-120b: Mars (accepted)

### forge-93ff72ce48: Mercury (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Mercury (accepted); groq:openai/gpt-oss-120b: Mercury (accepted)
- Half B alone: groq:openai/gpt-oss-20b: Ceres (unclear); groq:openai/gpt-oss-120b: Mercury (accepted)
- Both halves: groq:openai/gpt-oss-20b: Mercury (accepted); groq:openai/gpt-oss-120b: Mercury (accepted)
- Notes: halfA alone was solved by 2/2 valid solvers; a majority must miss it.

### forge-f5941c798c: Neptune (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Venus (unclear); groq:openai/gpt-oss-120b: Mars (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Uranus (rejected); groq:openai/gpt-oss-120b: Pluto (unclear)
- Both halves: groq:openai/gpt-oss-20b: Mars (rejected); groq:openai/gpt-oss-120b: Uranus (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-98c59af62f: Venus (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Earth (unclear); groq:openai/gpt-oss-120b: Mercury (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Venus (accepted); groq:openai/gpt-oss-120b: Venus (accepted)
- Both halves: groq:openai/gpt-oss-20b: Earth (unclear); groq:openai/gpt-oss-120b: Venus (accepted)
- Notes: halfB alone was solved by 2/2 valid solvers; a majority must miss it. Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-ade7e82474: Haumea (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Asteroid (rejected); groq:openai/gpt-oss-120b: Mercury (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Saturn (unclear); groq:openai/gpt-oss-120b: Saturn (unclear)
- Both halves: groq:openai/gpt-oss-20b: Saturn (unclear); groq:openai/gpt-oss-120b: Haumea (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-baba8bebef: Eris (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Jupiter (rejected); groq:openai/gpt-oss-120b: Earth (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Dactyl (rejected); groq:openai/gpt-oss-120b: Phobos (unclear)
- Both halves: groq:openai/gpt-oss-20b: Mars (unclear); groq:openai/gpt-oss-120b: Phobos (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-9905908efa: Triton (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Enceladus (rejected); groq:openai/gpt-oss-120b: Europa (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Chlorine (rejected); groq:openai/gpt-oss-120b: Neptune (unclear)
- Both halves: groq:openai/gpt-oss-20b: Europa (rejected); groq:openai/gpt-oss-120b: Enceladus (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-8dee3a463a: Chariklo (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Saturn (rejected); groq:openai/gpt-oss-20b: Saturn (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Phobos (rejected); groq:openai/gpt-oss-20b: Ceres (rejected)
- Both halves: groq:openai/gpt-oss-120b: Europa (rejected); groq:openai/gpt-oss-20b: Saturn (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-d9202f61f9: Pluto (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Venus (unclear); groq:openai/gpt-oss-120b: Pluto (accepted)
- Half B alone: groq:openai/gpt-oss-20b: Saturn (unclear); groq:openai/gpt-oss-120b: Jupiter (rejected)
- Both halves: groq:openai/gpt-oss-20b: Mars (unclear); groq:openai/gpt-oss-120b: Mars (unclear)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-762dc57784: Titan (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Jupiter (unclear); groq:openai/gpt-oss-120b: Venus (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Europa (rejected); groq:openai/gpt-oss-120b: Europa (rejected)
- Both halves: groq:openai/gpt-oss-120b: Titan (accepted); groq:openai/gpt-oss-20b: Neptune (unclear)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-431df05c79: Ganymede (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Mars (rejected); groq:openai/gpt-oss-20b: Jupiter (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Europa (rejected); groq:openai/gpt-oss-20b: Europa (rejected)
- Both halves: groq:openai/gpt-oss-120b: Ganymede (accepted); groq:openai/gpt-oss-20b: Ganymede (accepted)

### forge-0352d68a5e: darts (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Cricket (rejected); groq:openai/gpt-oss-120b: Cricket (rejected)
- Half B alone: groq:openai/gpt-oss-20b: chess (unclear); groq:openai/gpt-oss-120b: Fencing (rejected)
- Both halves: groq:openai/gpt-oss-20b: Darts (accepted); groq:openai/gpt-oss-120b: Darts (accepted)

### forge-d164488611: water polo (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Soccer (rejected); groq:openai/gpt-oss-120b: Basketball (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Sailing (rejected); groq:openai/gpt-oss-120b: Rowing (rejected)
- Both halves: groq:openai/gpt-oss-20b: Swimming (rejected); groq:openai/gpt-oss-120b: Water polo (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-fc205fd187: ice hockey (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Soccer (rejected); groq:openai/gpt-oss-120b: Soccer (rejected)
- Half B alone: groq:openai/gpt-oss-20b: ice hockey (accepted); groq:openai/gpt-oss-120b: Ice hockey (accepted)
- Both halves: groq:openai/gpt-oss-20b: soccer (rejected); groq:openai/gpt-oss-120b: Ice hockey (accepted)
- Notes: halfB alone was solved by 2/2 valid solvers; a majority must miss it. Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-06e4230e8b: padel (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Basketball (rejected); groq:openai/gpt-oss-120b: Basketball (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Squash (rejected); groq:openai/gpt-oss-120b: American football (rejected)
- Both halves: groq:openai/gpt-oss-20b: Squash (rejected); groq:openai/gpt-oss-120b: Squash (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-8cdc3188f1: sumo (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Judo (unclear); groq:openai/gpt-oss-120b: Boxing (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Squash (unclear); groq:openai/gpt-oss-120b: Cricket (rejected)
- Both halves: groq:openai/gpt-oss-20b: Mixed Martial Arts (rejected); groq:openai/gpt-oss-120b: Mixed Martial Arts (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-09857ed25d: badminton (PASSED)
- Half A alone: groq:openai/gpt-oss-20b: Athletics (rejected); groq:openai/gpt-oss-120b: Gymnastics (rejected)
- Half B alone: groq:openai/gpt-oss-20b: basketball (rejected); groq:openai/gpt-oss-120b: Tennis (rejected)
- Both halves: groq:openai/gpt-oss-20b: Badminton (accepted); groq:openai/gpt-oss-120b: Badminton (accepted)

### forge-da0fdbaa03: curling (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Basketball (rejected); groq:openai/gpt-oss-120b: Basketball (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Ice hockey (rejected); groq:openai/gpt-oss-120b: Curling (accepted)
- Both halves: groq:openai/gpt-oss-20b: Ice hockey (rejected); groq:openai/gpt-oss-120b: Ice hockey (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-ea94f1d12e: handball (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Soccer (rejected); groq:openai/gpt-oss-120b: Soccer (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Basketball (unclear); groq:openai/gpt-oss-120b: Volleyball (rejected)
- Both halves: groq:openai/gpt-oss-20b: Basketball (unclear); groq:openai/gpt-oss-120b: Handball (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-a3718c46d7: kabaddi (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Basketball (rejected); groq:openai/gpt-oss-20b: Basketball (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Fencing (rejected); groq:openai/gpt-oss-20b: Chess (rejected)
- Both halves: groq:openai/gpt-oss-120b: Volleyball (rejected); groq:openai/gpt-oss-20b: Badminton (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-e68409093f: netball (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Football (unclear); groq:openai/gpt-oss-120b: Basketball (unclear)
- Half B alone: groq:openai/gpt-oss-20b: Bossaball (unclear); groq:openai/gpt-oss-120b: Cricket (rejected)
- Both halves: groq:openai/gpt-oss-20b: American football (rejected); groq:openai/gpt-oss-120b: American football (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-5f7b4e3a38: rugby (FAILED)
- Half A alone: groq:openai/gpt-oss-20b: Basketball (rejected); groq:openai/gpt-oss-120b: Fencing (rejected)
- Half B alone: groq:openai/gpt-oss-20b: Soccer (rejected); groq:openai/gpt-oss-120b: Rugby (accepted)
- Both halves: groq:openai/gpt-oss-120b: Rugby sevens (rejected); groq:openai/gpt-oss-20b: Rugby (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-61f123d972: snooker (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Tennis (rejected); groq:openai/gpt-oss-20b: Golf (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Cricket (unclear); groq:openai/gpt-oss-20b: Snooker (accepted)
- Both halves: groq:openai/gpt-oss-120b: Squash (rejected); groq:openai/gpt-oss-20b: snooker (accepted)
- Notes: Both halves were solved by 1/2 valid solvers; a majority is required.

### forge-425196464d: skateboarding (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Swimming (rejected); groq:openai/gpt-oss-20b: Swimming (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Basketball (rejected); groq:openai/gpt-oss-20b: American football (rejected)
- Both halves: groq:openai/gpt-oss-120b: Surfing (rejected); groq:openai/gpt-oss-20b: Gymnastics (rejected)
- Notes: Both halves were solved by 0/2 valid solvers; a majority is required.

### forge-ce1c1965e0: volleyball (FAILED)
- Half A alone: groq:openai/gpt-oss-120b: Soccer (rejected); groq:openai/gpt-oss-20b: soccer (rejected)
- Half B alone: groq:openai/gpt-oss-120b: Volleyball (accepted); groq:openai/gpt-oss-20b: volleyball (accepted)
- Both halves: groq:openai/gpt-oss-120b: Volleyball (accepted); groq:openai/gpt-oss-20b: Volleyball (accepted)
- Notes: halfB alone was solved by 2/2 valid solvers; a majority must miss it.

### forge-abf8ec3239: squash (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Handball (rejected); groq:openai/gpt-oss-20b: Squash (accepted)
- Half B alone: groq:openai/gpt-oss-120b: Boxing (rejected); groq:openai/gpt-oss-20b: Tennis (rejected)
- Both halves: groq:openai/gpt-oss-120b: Squash (accepted); groq:openai/gpt-oss-20b: Squash (accepted)

### forge-f0db3d3caa: golf (PASSED)
- Half A alone: groq:openai/gpt-oss-120b: Baseball (rejected); groq:openai/gpt-oss-20b: Soccer (unclear)
- Half B alone: groq:openai/gpt-oss-120b: Gymnastics (rejected); groq:openai/gpt-oss-20b: Archery (rejected)
- Both halves: groq:openai/gpt-oss-120b: Golf (accepted); groq:openai/gpt-oss-20b: Golf (accepted)
