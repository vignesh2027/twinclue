# Puzzle audit

## Version 1
The first audit used shallow free-text prompts and low reasoning. It let through single-half giveaways and false clues. Examples included the Fandango lyric for Bohemian Rhapsody, Taylor Swift's 1989 and Folklore albums, Sachin Tendulkar's Little Master nickname and century record, the King of Pop, the ruler of Hyrule, Serena Williams's 23 major singles titles, and the Venus Rosewater Dish.

## Version 2
The stricter blind audit improved reasoning and added a fact verifier. It still tested free-text model-written clues, which often pointed to the prototype of a set. The 8 audited v2 puzzles all failed. A timing aid pointed to hourglass from one half, and a clue about more than 100 known moons pointed to Saturn. The solver panel used low reasoning and only 128 completion tokens, and did not enforce clue truth. Review also found false Mysore Palace, Pav Bhaji, and biryani claims. The report included gen-042's Master Blaster clue, gen-160's Yamuna and Agra clue, gen-016's 10-rupee-note clue, plus the Lagaan, Dangal, Kilimanjaro, Beethoven, Jai Ho, Mumbai, and Miso giveaways. The v2 report is archived in docs/archive/slice-5.

## Version 2.1 Puzzle Forge
Candidates come from curated attribute tables and deterministic set intersections. Each side set must contain at least five members. Two other members in each set must be at least as famous as the answer. A majority of solvers must reject each half alone, a majority must solve both halves together, and both halves must pass fact verification.

- Solvers: gemini:gemini-3.5-flash, gemini:gemini-2.5-flash, groq:openai/gpt-oss-20b
- Fact model: groq:openai/gpt-oss-20b
- Constraint candidates generated: 654
- Failed validation: 0
- Passed validation: 654
- Selected for blind audit: 80
- Completed blind audits: 0
- Audit failures: not measured because no audit completed
- Kept: 0
- Pass rate: not measured, 0 audited
- Aggregate single-half hit rate: not measured
- Aggregate both-halves hit rate: not measured
- Generation wording model: groq:openai/gpt-oss-20b
- Token usage by model: {"gemini:gemini-3.5-flash":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"gemini:gemini-2.5-flash":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"groq:openai/gpt-oss-20b":{"promptTokens":2285,"completionTokens":636,"totalTokens":2921},"openai/gpt-oss-120b":{"promptTokens":1159,"completionTokens":408,"totalTokens":1567}}
- Quota state: Per-minute model quota exhausted.
- Resume checkpoint: data/forge-progress.json
- Final pack category counts: {}
- Selected candidates by category before audit: {"games":52,"geography":12,"science":12,"food":4}

| Round | Puzzles audited | Passed |
|---:|---:|---:|
| 1 | 0 | 0 |

| Puzzle | Category | Set A | Set B | Answer | Pass |
|---|---|---:|---:|---|---|


## Audit failures

No completed audit results.
