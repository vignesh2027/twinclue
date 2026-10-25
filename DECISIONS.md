# Slice 1 decisions

- A viewer is rate limited independently within their community: one guess every 3,000 ms. A rejected or unclear guess also consumes that interval, which prevents rapid brute force.
- A correct guess records a community's first solver. A round becomes won on the first correct guess from the other community; its solve time is measured from start to that guess.
- Only timed-out rounds reset the streak. Pending and active rounds do not affect it; the caller records completed outcomes with `recordResult`.
- Puzzle text is normalized by removing accents and punctuation and lowercasing before containment checks. Blocklisted terms are checked as whole words.
- The referee accepts exact normalized answers/aliases or edit distance up to 1 for answers of at most 4 characters, 2 up to 8, and 3 for longer answers. Near misses at distance up to 3 beyond that accepted threshold are unclear.
- Session persistence stores puzzle, round status, timestamps, first solvers, guess counts/history, and streak as JSON. This slice provides the core library and a health-only Fastify entrypoint; Twitch/model integration is deferred.
