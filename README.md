# Twinclue

Twinclue is a two-community chat puzzle game. A Puzzle Forge builds clues from curated fact tables, then runs a blind solver panel and fact verification before a puzzle enters the active pack.

## Custom fact tables

Place a CSV file under `facts/custom/` with columns `name,aliases,fame` followed by one or more attribute columns. Separate multiple aliases or attribute values with `|`. Fame is an integer from 1 to 3. For example:

```csv
name,aliases,fame,neighborhood,river
Old Clock Tower,Clock Tower|The Tower,2,Market Ward,East River
Blue Garden,The Garden,3,Market Ward,East River
Hill Library,Library,2,North Hill,West Brook
```

Run `npm run forge -- --table custom/mycommunity.csv` to search that table. The forge keeps only clues that satisfy the set constraints, validate, and pass the configured audit panel. Table headers should document sources and the data license. The uploader is responsible for rights to custom data.

Use `npm run demo` to preview the voting round and reveal flow.
