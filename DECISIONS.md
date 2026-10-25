# Slice 1 decisions

- A viewer is rate limited independently within their community: one guess every 3,000 ms. A rejected or unclear guess also consumes that interval, which prevents rapid brute force.
- A correct guess records a community's first solver. A round becomes won on the first correct guess from the other community; its solve time is measured from start to that guess.
- Only timed-out rounds reset the streak. Pending and active rounds do not affect it; the caller records completed outcomes with `recordResult`.
- Puzzle text is normalized by removing accents and punctuation and lowercasing before containment checks. Blocklisted terms are checked as whole words.
- The referee accepts exact normalized answers/aliases or edit distance up to 1 for answers of at most 4 characters, 2 up to 8, and 3 for longer answers. Near misses at distance up to 3 beyond that accepted threshold are unclear.
- Session persistence stores puzzle, round status, timestamps, first solvers, guess counts/history, and streak as JSON.

## Slice 2a and 2b decisions

- Each puzzle carries two authored, distinct alternative-answer lists. They are the reveal promise shown to viewers; code checks their presence, uniqueness, and that they do not repeat the answer or aliases. Whether an alternative genuinely fits one half and is ruled out by the other remains an editorial check.
- The pack contains 60 authored entries, adds `halfAAlsoFits`/`halfBAlsoFits`, aliases, and easy/medium/hard labels. It includes Indian sport, food, cities, music, and films.
- `CHANNEL_A` and `CHANNEL_B` are Twitch logins. Startup resolves them, and the authenticated bot, to user IDs before creating EventSub subscriptions and sending chat.
- OAuth role state is held in memory for the short authorization round trip; access and refresh tokens are persisted to ignored `data/tokens.json`. Token refresh starts when less than 60 seconds remain.
- `!tc start` and `!tc skip` require Twitch broadcaster or moderator badges. `!tc score` and `!g` are available to all viewers. A moderator from either channel controls the shared round.
- Chat sends use one serial queue across both channels, with a one-second default gap and Twitch `Retry-After` handling for HTTP 429.
- Twitch integration is interface-driven and unit-tested with fake EventSub sockets, fake Helix, and fake HTTP token/chat responses. Real credentials are required for live Twitch operation and were not available for this slice.
