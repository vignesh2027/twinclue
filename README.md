# Twinclue

**Two streamers. Two communities. Each holds half of every clue.**

Twinclue is a cooperative puzzle show for Twitch collabs. Each stream's overlay shows a different half of the same
clue. Viewers vote in their own chat with `!g answer`, and the streamers have to talk to each other on stream to put
the halves together. A round is won only when both communities lock in the right answer.

A Puzzle Forge builds the clues from curated fact tables, then a blind solver panel and a fact check decide which
ones enter the pack.

## Quickstart (host)

You run one server. Only you sign in with Twitch. Your partner needs nothing but their channel name in your config
and an overlay link from you.

1. **Install.** Node 22, then `npm install`.
2. **Create a Twitch application** at <https://dev.twitch.tv/console>. Set its OAuth redirect URL to
   `PUBLIC_URL/auth/callback` (see step 4 for the URL).
3. **Configure.** Copy `.env.example` to `.env` and fill in:
   - `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from the application.
   - `CHANNEL_A`: your channel login. `CHANNEL_B`: your partner's login (leave it empty to start alone).
   - `BOT_LOGIN`: the account that reads and posts in both chats. Leave it empty to use your own channel account.
   - `ADMIN_TOKEN`: run `openssl rand -hex 24` and paste the result. It protects the control panel.
4. **Get one public HTTPS address.** Your partner's OBS must load their overlay from your server, and Twitch must
   redirect back to it. A Cloudflare Tunnel costs nothing and needs no open ports:
   ```sh
   brew install cloudflared            # or see Cloudflare's docs for your OS
   cloudflared tunnel --url http://127.0.0.1:3000
   ```
   It prints an `https://....trycloudflare.com` address. Put it in `PUBLIC_URL` and in the Twitch application's
   redirect URL. For a stable address, create a named tunnel on your own domain.
5. **Start.** `npm run build && npm start` (or `npm run dev`). The server listens on 127.0.0.1 only; the tunnel
   publishes it.
6. **Open the panel** at `PUBLIC_URL/panel`, enter the admin token, and press **Connect bot account**. Sign in as
   `BOT_LOGIN` (or your own account). A different account is refused.
7. **Add the overlays.** In the panel, **Copy overlay A link** and add it to your OBS as a 1920 x 1080 browser
   source. **Copy overlay B link for streamer B** and send it to your partner. Each link carries its own key, so it
   only shows its own half.
8. **Play.** Press **Start round**, or a moderator types `!tc start`. `!tc lock` and `!tc skip` also work for
   moderators and both broadcasters.

No partner yet? Turn on **Rehearsal mode** in the panel and type community B's votes yourself. Both overlays and the
panel say "REHEARSAL", and rehearsal rounds never change the score or post in chat.

### Docker

```sh
docker build -t twinclue .
docker run --env-file .env -p 127.0.0.1:3000:3000 -v twinclue-data:/app/data twinclue
```

The `data` volume keeps the session (score, streak, the round in progress) and the Twitch tokens across restarts.

## Health and metrics

- `GET /healthz`: the process is up.
- `GET /readyz`: 200 when the bot token is valid and each configured channel's chat subscription is live,
  otherwise 503 with the reasons in plain words.
- `GET /metrics` with the admin token: Prometheus text (votes, duplicates, reconnects, chat sends, latency).

## How it works

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the components, the life of a vote, Twitch limits, failure
modes and security. [docs/BENCHMARKS.md](docs/BENCHMARKS.md) has the measured throughput (`npm run bench`).

## Custom fact tables

Place a CSV file under `facts/custom/` with columns `name,aliases,fame` followed by one or more attribute columns.
Separate multiple aliases or attribute values with `|`. Fame is an integer from 1 to 3. For example:

```csv
name,aliases,fame,neighborhood,river
Old Clock Tower,Clock Tower|The Tower,2,Market Ward,East River
Blue Garden,The Garden,3,Market Ward,East River
Hill Library,Library,2,North Hill,West Brook
```

Run `npm run forge -- --table custom/mycommunity.csv` to search that table, or `npm run forge -- --dry-run` to see
how many candidates each table yields without calling any model. The forge keeps only clues that satisfy the set
constraints, validate, and pass the configured audit panel. Table headers should document sources and the data
license. The uploader is responsible for rights to custom data.

## Development

```sh
npm test            # unit, fault-injection and log-safety tests
npm run typecheck
npm run demo        # local demo on 127.0.0.1 with scripted votes, labelled DEMO
npm run bench       # throughput benchmark; rewrites docs/BENCHMARKS.md
```
