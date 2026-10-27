# Puzzle audit

## Version 1
The first audit used shallow free-text prompts and low reasoning. It let through single-half giveaways and false clues. Examples included the Fandango lyric for Bohemian Rhapsody, Taylor Swift's 1989 and Folklore albums, Sachin Tendulkar's Little Master nickname and century record, the King of Pop, the ruler of Hyrule, Serena Williams's 23 major singles titles, and the Venus Rosewater Dish.

## Version 2
The stricter blind audit improved reasoning and added a fact verifier. It still tested free-text model-written clues, which often pointed to the prototype of a set. The 8 audited v2 puzzles all failed. A timing aid pointed to hourglass from one half, and a clue about more than 100 known moons pointed to Saturn. The solver panel used low reasoning and only 128 completion tokens, and did not enforce clue truth. Review also found false Mysore Palace, Pav Bhaji, and biryani claims. The report included gen-042's Master Blaster clue, gen-160's Yamuna and Agra clue, gen-016's 10-rupee-note clue, plus the Lagaan, Dangal, Kilimanjaro, Beethoven, Jai Ho, Mumbai, and Miso giveaways. The v2 report is archived in docs/archive/slice-5.

## Table and wording fixes
Link now uses the fan-recognisable species value Hylian. Kratos is recorded as a demigod. Waluigi species and the unreliable broad animal diet field were removed. Chun-Li already had Capcom in the source table; the Sony wording came from stale model-polished text that did not match its stored predicate. Polishing is disabled for this run, so clue text comes from predicate templates. This is two character attribute corrections and two disputed attribute removals.

## Version 2.1 Puzzle Forge
Candidates come from curated attribute tables and deterministic set intersections. Each side set must contain at least five members. Two other members in each set must be at least as famous as the answer. A majority of solvers must reject each half alone, a majority must solve both halves together, and both halves must pass fact verification.

- Solvers: gemini:gemini-3.5-flash, gemini:gemini-2.5-flash, groq:openai/gpt-oss-20b
- Fact model: groq:openai/gpt-oss-20b
- Constraint candidates generated: 25
- Failed validation: 0
- Passed validation: 25
- Selected for blind audit: 25
- Category quota targets and availability: {"video game characters":{"target":18,"available":9,"selected":9},"countries":{"target":14,"available":12,"selected":12},"animals":{"target":12,"available":2,"selected":2},"foods and dishes":{"target":12,"available":1,"selected":1},"musical instruments":{"target":8,"available":0,"selected":0},"space objects":{"target":8,"available":1,"selected":1},"sports":{"target":8,"available":0,"selected":0}}
- Fame distribution among selected candidates: {"2":12,"3":13}
- Difficulty distribution among selected candidates: {"medium":13,"easy":4,"hard":8}
- Unique answer selection: one puzzle per answer, swapped predicate mirrors deduplicated
- Fact table pairs checked for kept puzzles: 0
- Fact table rejections: []
- Completed blind audits: 0
- Audit failures: not measured because no audit completed
- Kept: 0
- Pass rate: not measured, 0 audited
- Aggregate single-half hit rate: not measured
- Aggregate both-halves hit rate: not measured
- Generation wording model: predicate templates
- Token usage by model: {"gemini:gemini-3.5-flash":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"gemini:gemini-2.5-flash":{"promptTokens":0,"completionTokens":0,"totalTokens":0},"groq:openai/gpt-oss-20b":{"promptTokens":4455,"completionTokens":4414,"totalTokens":8869}}
- Quota state: Rate limit reached for model `openai/gpt-oss-20b` in organization [hidden] service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 199993, Requested 939. Please try again in 6m42.624s. Need more tokens? Upgrade to Dev Tier toda
- Resume checkpoint: data/forge-progress.json
- Final pack category counts: {}
- Selected candidates by category before audit: {"games":9,"geography":12,"science":3,"food":1}

| Round | Puzzles audited | Passed |
|---:|---:|---:|
| 1 | 0 | 0 |

The Gemini solvers stopped on per-minute quotas. Groq returned partial model output, then hit its token-per-day quota before the full puzzle panel completed. Partial responses are not counted as audited puzzles.

| Puzzle | Category | Set A | Set B | Answer | Pass |
|---|---|---:|---:|---|---|


## Audit failures

No completed audit results.
