# Forge fact tables

The JSON tables are a curated, manually maintained compilation intended for Twinclue's deterministic constraint search. Facts should be backed by sources listed in each table header and kept to well-established claims. The compilation is released under CC0 1.0; source references remain listed for attribution and verification. A model fact check is required before a forged clue enters the pack.

Prefer crisp categorical attributes that a reader can check on a reference page, such as a flag colour, a cooking method or a discovery century. When a value is disputed or fuzzy for an entity, leave that attribute out for that entity rather than guessing. Fill an attribute for every entity it clearly applies to, because a missing value can make a clue pair look unique when it is not. Fame is 1 to 3 and should reflect how widely the answer is known.

Every attribute needs a short clue template in `src/puzzle/forge.ts` so each clue half stays within 14 words. `src/puzzle/facts.test.ts` checks that every table has templates for all of its attributes and still yields at least its category quota of valid candidates. Run `npx tsx src/puzzle/forge-pack.ts --dry-run` to see per-table availability without any model calls or file writes.

`scripts/seed-facts.mjs` only bootstrapped the first tables. It now skips any table that already exists, so edit the JSON files directly.

Custom CSV files go in `facts/custom/`. Use columns `name,aliases,fame` followed by any attribute columns. Separate multiple aliases or attribute values with `|`. Fame is 1 to 3. Run `npm run forge -- --table custom/mycommunity.csv` to build a pack for that table.
