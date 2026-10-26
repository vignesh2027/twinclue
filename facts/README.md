# Forge fact tables

The JSON tables are a curated, manually maintained compilation intended for Twinclue's deterministic constraint search. Facts should be backed by sources listed in each table header and kept to well-established claims. The compilation is released under CC0 1.0; source references remain listed for attribution and verification. A model fact check is required before a forged clue enters the pack.

Custom CSV files go in `facts/custom/`. Use columns `name,aliases,fame` followed by any attribute columns. Separate multiple aliases or attribute values with `|`. Fame is 1 to 3. Run `npm run forge -- --table custom/mycommunity.csv` to build a pack for that table.
