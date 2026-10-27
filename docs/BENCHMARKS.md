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

The whole benchmark ran 3 times, each with a fresh server pipeline and a fresh load-generator process.
The runs share one Node process, so later runs' peak RSS includes garbage left by earlier runs. Every figure below is the
**median across runs, with the range (lowest to highest) in brackets**.

Machine: Apple M1, 8 cores, 8 GB RAM, darwin 25.6.0 arm64. Node v22.22.3.
The load generator and the server share this machine. One-minute load average at the start of each run: 3.4, 3.0, 1.7.
Every run started with the load average below half the core count.
Generated 2026-10-27.

## Latency and throughput

End-to-end latency is measured in the child process, from the moment a vote's notification is written to the
EventSub socket until the first frame that includes it arrives at that community's overlay client. Frames are
coalesced to at most ten per second, so about 50 ms of the median is the deliberate frame interval.

| Phase | Offered load | Messages | Achieved per second | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sustained | 2,000/s for 60 s | 120,000 | 2002 (2002 to 2002) | 50.3 (50.0 to 50.7) | 95.3 (95.0 to 95.7) | 99.2 (98.9 to 100.1) | 128.1 (121.0 to 377.1) |
| Burst | 10,000/s for 10 s | 100,000 | 10001 (10001 to 10002) | 50.5 (50.4 to 50.5) | 95.1 (95.1 to 95.1) | 99.2 (99.1 to 99.3) | 106.7 (101.0 to 113.9) |

| Phase | Peak RSS (server) | Server CPU (share of one core) | Event loop delay p99 ms | Event loop delay max ms | Longest gap between overlay frames ms |
| --- | --- | --- | --- | --- | --- |
| Sustained | 144 MB (125 to 164) | 11% (10 to 13) | 2.1 (2.0 to 2.6) | 45.9 (39.3 to 290.3) | 127 (122 to 306) |
| Burst | 161 MB (149 to 176) | 29% (27 to 31) | 1.9 (1.4 to 2.0) | 23.5 (14.0 to 28.6) | 106 (101 to 114) |

## Every planted vote counted exactly once

| Run | Phase | Viewers checked one by one | Votes counted | Rate limited | Duplicates dropped | Ticker samples shed | Frames shed | Exact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sustained | 100,000 | 108,422 of 108,422 | 4,000 of 4,000 | 4,000 of 4,000 | 107,772 | 0 | yes |
| 1 | Burst | 80,000 | 86,836 of 86,836 | 2,000 of 2,000 | 6,000 of 6,000 | 87,409 | 0 | yes |
| 2 | Sustained | 100,000 | 108,422 of 108,422 | 4,000 of 4,000 | 4,000 of 4,000 | 107,729 | 0 | yes |
| 2 | Burst | 80,000 | 86,836 of 86,836 | 2,000 of 2,000 | 6,000 of 6,000 | 87,407 | 0 | yes |
| 3 | Sustained | 100,000 | 108,422 of 108,422 | 4,000 of 4,000 | 4,000 of 4,000 | 107,734 | 0 | yes |
| 3 | Burst | 80,000 | 86,836 of 86,836 | 2,000 of 2,000 | 6,000 of 6,000 | 87,407 | 0 | yes |

"Viewers checked one by one" compares each simulated viewer's final vote on the server with the model.
Ticker samples are the only thing shed under load: above 400 votes per second the ticker keeps at most one sample
every 50 ms, while every vote and every round transition is applied. Frames shed counts frames skipped for a slow
overlay socket.

## Inside the server

| Phase | Receive to frame sent, p50 ms | p95 ms | p99 ms |
| --- | --- | --- | --- |
| Sustained | 75 (50 to 75) | 100 (100 to 100) | 100 (100 to 100) |
| Burst | 75 (75 to 75) | 100 (100 to 100) | 100 (100 to 100) |

Receive to frame sent comes from the `twinclue_vote_to_frame_seconds` histogram that `/metrics` exports, so
its values are bucket upper bounds.

### Snapshots under load

| Phase | Snapshots written | Longest event-loop block while serialising, ms | Longest snapshot including file write, ms |
| --- | --- | --- | --- |
| Sustained | 62 (59 to 62) | 28.4 (19.3 to 29.0) | 39.3 (33.2 to 316.6) |
| Burst | 13 (13 to 13) | 17.4 (12.9 to 18.9) | 20.9 (14.7 to 22.6) |

A snapshot serialises the whole live vote map (up to 100,000 votes here) synchronously, then writes it to a temp
file and renames it without blocking. While votes arrive, snapshot starts are at least one second apart, and the
gap stretches to ten times the previous snapshot's duration if snapshots get slow. Round transitions and
shutdown write at once. The blocking figures are exact maxima from `twinclue_snapshot_blocking_seconds`.

## Reproduce

```sh
npm run bench               # three full runs, about five minutes; rewrites this file
npm run bench -- --runs 1   # one full run
npm run bench -- --quick    # full rates, 12 s and 8 s phases; leaves this file alone
```
