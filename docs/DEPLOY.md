# Deploying the Twinclue sandbox

The public "try it now" page runs on Modal as the app `twinclue-sandbox`:

https://applemacbook6sep2004--twinclue-sandbox.us-east.modal.run

It is the server's `SANDBOX=1` mode (see "Hosted sandbox" in the README): no Twitch connection, no admin token and no secrets of any kind. Each browser gets its own in-memory game.

Everything for it is in `deploy/modal-sandbox/`:

| File | Purpose |
|---|---|
| `app.py` | The Modal app: the image and one always-on container. |
| `smoke-round.ts` | Plays one full round against a deployed sandbox, the way the page does. |

## How the image is built

Modal needs Python inside the image, and the repository `Dockerfile` uses `node:22-alpine`, which has none. So `app.py` builds the same thing on Modal's Debian base instead:

1. Debian slim with Python 3.12 (for Modal's own runtime).
2. The official Node.js 22.22.3 build for Linux x64 from nodejs.org, checked against the release's published SHA-256 sums.
3. `package.json`, `package-lock.json`, `tsconfig.json`, `src/`, `public/` and `facts/` from the working tree (never `node_modules`, `dist` or `data`).
4. `npm ci && npm test && npm run build && npm prune --omit=dev`, then the TypeScript sources are removed. The full test suite runs at build time, so a red suite never ships.

Modal caches each step, so a change under `src/` rebuilds only the last steps.

## What runs

One container, always on (`min_containers=1`, `max_containers=1`), so a visitor never waits for a cold start. It asks for half a CPU core and 512 MiB of memory, with a hard limit of 1 GiB, and accepts up to 500 concurrent requests, since every open page holds two overlay WebSockets and polls the state every 1.5 seconds.

On start it runs `node dist/server.js` with only these variables (nothing from the deploying machine's environment reaches it):

| Variable | Value | Why |
|---|---|---|
| `SANDBOX` | `1` | The hosted sandbox mode |
| `PUBLIC` | `1` | Listen on all interfaces inside the container, so Modal's proxy can reach it |
| `PORT` | `3000` | The port `@modal.web_server` routes the public URL to |
| `TRUST_PROXY` | `1` | Rate limits use the visitor's address, not the proxy's |
| `PUBLIC_URL` | the Modal URL above | The server refuses actions whose `Origin` is not this address |
| `SANDBOX_MAX_GAMES` | `200` | Games held at once |
| `NODE_ENV` | `production` | |

These can be changed at deploy time by exporting `TWINCLUE_SANDBOX_CPU`, `TWINCLUE_SANDBOX_MEMORY_MB`, `TWINCLUE_SANDBOX_MEMORY_LIMIT_MB`, `TWINCLUE_SANDBOX_PUBLIC_URL` or `TWINCLUE_SANDBOX_MAX_GAMES` before `modal deploy`. If the app or label is ever renamed, the URL changes and `TWINCLUE_SANDBOX_PUBLIC_URL` must follow it, or every vote is refused as cross-site.

A redeploy starts the new container while the old one keeps serving, so a deploy does not take the page down. Games live in memory only, so a redeploy or restart forgets games in progress; visitors just start a new one.

## Limits behind Modal's proxy

The sandbox's own limits all work through Modal:

- **Actions per game:** a token bucket of 12 with 4 more each second. Faster than that gets 429 "Slow down a little."
- **New games per address:** 20 per ten minutes. The 21st gets 503 "The sandbox is busy."
- **Games at once:** 200. Each is forgotten after 30 idle minutes.
- **Same-site only:** a POST with any other `Origin` gets 403.
- **Overlay sockets:** a socket can only join a game that already exists, and each game holds at most six. Games are created only by HTTP requests (the overlay page load, or an action), because only those carry the visitor's address through the proxy.

With `TRUST_PROXY=1`, the server trusts exactly one proxy: the visitor's address is the right-most entry in `X-Forwarded-For`, the one the proxy itself added, so a forged entry further left is ignored. (It used to be Fastify's `trustProxy: true`, which takes the left-most entry and could be forged behind a proxy that appends to the header.) Modal's proxy replaces the header with the visitor's own address, so the right-most entry is the visitor either way. On the live app, after 20 new games from one address, five more with forged `X-Forwarded-For` values, and three with a forged two-entry chain plus a forged `X-Real-IP`, were all refused with 503, the same as plain requests. Behind more than one proxy, set `TRUST_PROXY` to the number of proxies.

The first deployment, at commit 46fcaba, let an overlay WebSocket create a game. An upgrade request carries only the proxy's own internal address, so on Modal every game opened that way was counted against one shared address: on the live app, 20 sockets with fresh cookies opened games and the next ones were refused, whatever the visitor's own count. Under real traffic, visitors whose overlays connected before their first action would have shared one budget of 20 games per ten minutes. Commit 1d9882a closed this, and that is what is deployed now: sockets with an unknown cookie are refused, and the overlay page load creates the game with the visitor's address.

## Cost

Modal bills a container for the larger of what it asks for and what it uses. The server uses well under its 512 MiB, so the request is what is billed. At Modal's published rates on 28 October 2026 ($0.0473 per core hour and $0.008 per GiB hour), half a core and half a GiB held all day come to 24 x (0.5 x 0.0473 + 0.5 x 0.008) = $0.66 a day. Network egress is $0.04 per GiB and small for this page. It shares the workspace and its credit with other apps.

## Updating and checking

From the repository root:

```sh
modal deploy deploy/modal-sandbox/app.py
```

Then (the deployment records nothing about the commit, so note which commit you deployed):

```sh
U=https://applemacbook6sep2004--twinclue-sandbox.us-east.modal.run
curl -s $U/healthz                                    # {"ok":true,"sandbox":true,"games":N}
npx tsx deploy/modal-sandbox/smoke-round.ts $U        # plays one round and prints each step
modal app logs twinclue-sandbox
modal container list
modal billing summary
```

`smoke-round.ts` loads the page for a cookie, loads both overlay pages (which creates the game), opens both overlay WebSockets, starts a round, reads each overlay's half, sends a wrong vote on side A, asks for side B's hint, votes the answer on both sides, locks the votes and prints the final state of both overlays, which should say `won`.

To take the page down: `modal app stop twinclue-sandbox`.
