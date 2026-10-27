# Benchmarks

This measures **our pipeline, not Twitch's delivery**. Nothing here says that 100,000 viewers were tested. It says
that when Twitch hands us chat at these rates, every vote is counted exactly once and the overlays keep moving.

Viewers never connect to Twinclue. The overlay is captured by OBS into the video, so a large audience costs us
only its chat messages plus two to four overlay browser sources. Scale for us therefore means chat throughput.

## How it was run

`npm run bench` starts the real server pipeline in one process: the EventSub WebSocket client, the JSON parser,
the dedupe cache, the command router, the game controller, throttled session snapshots to disk, and the
coalesced overlay frames sent by the real `ws` server. A child process plays Twitch and OBS. It runs a local
EventSub WebSocket server that pushes `channel.chat.message` notifications in Twitch's envelope, and it holds
five real WebSocket clients: two overlay sources per community and the control panel.

Each phase plants traffic from a fixed seed and checks the result against an independent model:

| Phase | Distinct chatters | First votes | Vote changes (5 s or more later) | Rapid changes (200 ms later, must be rejected) | Shared Chat copies (must be dropped) | Plain chat |
| --- | --- | --- | --- | --- | --- | --- |
| Sustained | 100,000 | 100,000 | 10,000 | 4,000 | 4,000 | 2,000 |
| Burst | 80,000 | 80,000 | 8,000 | 2,000 | 6,000 | 4,000 |

Votes go 35 percent to the answer, 55 percent to eleven other countries, and 10 percent to text that is not a
country (shown as "other answers"), so the consensus lock never ends a phase early.

Machine: Apple M1, 8 cores, 8 GB RAM, darwin 25.6.0 arm64. Node v22.22.3.
The load generator and the server share this machine. One-minute load average when the run started: 3.0
(this is a developer laptop with other work running, so treat the numbers as conservative).
Generated 2026-10-27.

## Results

End-to-end latency is measured in the child process, from the moment a vote's notification is written to the
EventSub socket until the first frame that includes it arrives at that community's overlay client. Frames are
coalesced to at most ten per second, so about 50 ms of the median is the deliberate frame interval.

| Phase | Offered load | Messages | Achieved | p50 ms | p95 ms | p99 ms | max ms | Peak RSS (server) | Server CPU |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sustained | 2,000/s for 60 s | 120,000 | 2,002/s | 54.4 | 101.0 | 155.2 | 391.6 | 117 MB | 11,612 ms (19% of one core) |
| Burst | 10,000/s for 10 s | 100,000 | 10,002/s | 52.4 | 97.5 | 104.2 | 127.7 | 138 MB | 4,566 ms (46% of one core) |

## Every planted vote counted exactly once

| Phase | Viewers checked one by one | Votes counted | Rate limited | Duplicates dropped | Ticker samples shed | Frames shed | Exact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sustained | 100,000 | 108,422 of 108,422 | 4,000 of 4,000 | 4,000 of 4,000 | 107,769 | 0 | yes |
| Burst | 80,000 | 86,836 of 86,836 | 2,000 of 2,000 | 6,000 of 6,000 | 87,411 | 0 | yes |

"Viewers checked one by one" compares each simulated viewer's final vote on the server with the model.
Ticker samples are the only thing shed under load: above 400 votes per second the ticker keeps at most one sample
every 50 ms, while every vote and every round transition is applied. Frames shed counts frames skipped for a slow
overlay socket.

## Inside the server

| Phase | Receive to frame sent, p50 ms | p95 ms | p99 ms | Event loop delay p99 ms | Event loop delay max ms | Longest gap between overlay frames ms | Snapshots written |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sustained | 75 | 100 | 125 | 27.0 | 205.1 | 290 | 60 |
| Burst | 75 | 100 | 100 | 16.1 | 39.7 | 122 | 13 |

Receive to frame sent comes from the `twinclue_vote_to_frame_seconds` histogram that `/metrics` exports, so
its values are bucket upper bounds. Snapshots are atomic writes of the full vote map, throttled to at most one
per second and stretched to ten times the last write's duration under load.

## Reproduce

```sh
npm run bench            # about 90 seconds; rewrites this file
npm run bench -- --quick # full rates, 12 s and 8 s phases; leaves this file alone
```
