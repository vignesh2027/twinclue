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
- Constraint candidates generated: 196
- Failed validation: 0
- Passed validation: 196
- Selected for blind audit: 25
- Category quota targets and availability: {"video game characters":{"target":18,"available":37,"selected":18},"countries":{"target":14,"available":65,"selected":14},"animals":{"target":12,"available":17,"selected":12},"foods and dishes":{"target":12,"available":34,"selected":12},"musical instruments":{"target":8,"available":13,"selected":8},"space objects":{"target":8,"available":13,"selected":8},"sports":{"target":8,"available":17,"selected":8}}
- Fame distribution among selected candidates: {"1":11,"2":60,"3":9}
- Difficulty distribution among selected candidates: {"medium":71,"hard":4,"easy":5}
- Unique answer selection: one puzzle per answer, swapped predicate mirrors deduplicated
- Fact table pairs checked for kept puzzles: 21
- Fact table rejections: [{"id":"forge-e912a8e629","reasons":["landlocked true: false (Bolivia is not landlocked; it has a coastline on the Caribbean Sea)"]},{"id":"forge-2973d3dfee","reasons":["taste \"savoury\": unsure (Taste is subjective; commonly described as savoury but not a factual attribute)"]}]
- Completed blind audits: 25
- Audit failures: 18
- Kept: 5
- Pass rate: 20%
- Aggregate single-half hit rate: 4.9%
- Aggregate both-halves hit rate: 34.1%
- Generation wording model: predicate templates
- Token usage by model: {"gemini:gemini-3.5-flash":{"promptTokens":1831,"completionTokens":1187,"totalTokens":9011},"gemini:gemini-2.5-flash":{"promptTokens":2304,"completionTokens":1627,"totalTokens":26639},"groq:openai/gpt-oss-20b":{"promptTokens":13053,"completionTokens":13384,"totalTokens":26437}}
- Quota state: no quota stop
- Resume checkpoint: data/forge-progress.json
- Final pack category counts: {"games":2,"geography":2,"science":1}
- Selected candidates by category before audit: {"games":18,"geography":14,"science":20,"food":12,"music":8,"sport":8}

| Round | Puzzles audited | Passed |
|---:|---:|---:|
| 1 | 25 | 7 |

The Gemini solvers stopped on per-minute quotas. Groq returned partial model output, then hit its token-per-day quota before the full puzzle panel completed. Partial responses are not counted as audited puzzles.

| Puzzle | Category | Set A | Set B | Answer | Pass |
|---|---|---:|---:|---|---|
| forge-3d0b48650f | games | 8 | 7 | Aloy | yes |
| forge-3b7865ae49 | games | 11 | 10 | Link | yes |
| forge-3037239655 | geography | 14 | 7 | Switzerland | yes |
| forge-a13da6a82d | geography | 18 | 7 | Jamaica | yes |
| forge-4c21df59f2 | science | 17 | 11 | penguin | yes |

## Audit failures

- forge-79a44e9119 (Ganondorf): Both halves accepted by 0/3 available solvers; majority required. Fact check half B false: Ganondorf uses magic, no sword
- forge-8ead5667f3 (Jin Sakai): Both halves accepted by 0/3 available solvers; majority required.
- forge-35d95abb0b (Alexios): Both halves accepted by 0/3 available solvers; majority required. Fact check half B false: Appeared 2011 not 2010s decade start
- forge-f9a25090e0 (Samus): Both halves accepted by 0/3 available solvers; majority required. Fact check half A false: Samus is a space marine, not human
- forge-661bf01f68 (Olimar): Both halves accepted by 0/3 available solvers; majority required.
- forge-220332678c (Ryu): halfB alone accepted by 3/3 available solvers; majority required to fail.
- forge-8d8762c974 (Chun-Li): Both halves accepted by 0/1 available solvers; majority required.
- forge-d6a1b8d920 (Ghana): Both halves accepted by 0/1 available solvers; majority required.
- forge-091487601d (Türkiye): Both halves accepted by 0/1 available solvers; majority required.
- forge-09bb6d4eff (Canada): Both halves accepted by 0/1 available solvers; majority required.
- forge-e119dda249 (Peru): Both halves accepted by 0/1 available solvers; majority required.
- forge-7afd6fbe55 (Chile): Both halves accepted by 0/1 available solvers; majority required.
- forge-33064a02bc (Cuba): Both halves accepted by 0/1 available solvers; majority required.
- forge-2114d9c528 (Thailand): Both halves accepted by 0/1 available solvers; majority required.
- forge-265b8e1590 (Ethiopia): Both halves accepted by 0/1 available solvers; majority required.
- forge-be29f40710 (Hungary): Both halves accepted by 0/1 available solvers; majority required.
- forge-7a451ab96f (bat): Fact check half A false: Bats are mammals but do swim
- forge-690876c4cb (Haumea): Both halves accepted by 0/1 available solvers; majority required.
