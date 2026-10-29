import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { Session, SessionStore } from './game/session.js';
import { puzzlePack } from './puzzle/pack.js';
import { demoPuzzlePack } from './puzzle/demo-pack.js';
import { isVideoSafe, showcasePuzzles } from './puzzle/showcase.js';
import { loadFactVocabularies } from './puzzle/vocabulary-source.js';
import type { Puzzle } from './puzzle/types.js';
import { GameController, makeRoundOptions, type RoundEvent } from './app/controller.js';
import { registerWebRoutes, type Readiness } from './app/web.js';
import { recapSummary } from './app/recap.js';
import { registerSandbox } from './app/sandbox.js';
import { createChatRouter } from './app/router.js';
import { sideHealth } from './app/health.js';
import { registerAuthRoutes, TokenStore } from './twitch/auth.js';
import { EventSubClient, sharedChatJoinsBoth, type Side, type SocketFactory } from './twitch/eventsub.js';
import { ChatSender } from './twitch/chat.js';
import { TwitchHelix } from './twitch/helix.js';
import { loggerOptions } from './obs/log.js';
import { Metrics } from './obs/metrics.js';

const optional = z.string().trim().transform(value => value || undefined).optional();
const EnvSchema = z.object({
  TWITCH_CLIENT_ID: z.string().min(1), TWITCH_CLIENT_SECRET: z.string().min(1), PUBLIC_URL: z.string().url(),
  CHANNEL_A: z.string().trim().min(1, 'CHANNEL_A (the host channel login) is required.'), CHANNEL_B: optional, BOT_LOGIN: optional,
  ADMIN_TOKEN: z.string().min(24, 'ADMIN_TOKEN must be at least 24 characters. Generate one with: openssl rand -hex 24'),
  PORT: optional, PUBLIC: optional, COMMAND_PREFIX: z.string().min(1).max(20).default('!g'),
  MIN_VOTERS_TO_WIN: z.coerce.number().int().min(1).max(1000).default(2),
  HINT_THRESHOLD: z.coerce.number().int().min(1).max(1000).default(3),
  VIDEO_SAFE: optional,
});

export interface ServerOverrides { logStream?: NodeJS.WritableStream; sessionPath?: string; tokenPath?: string; fetcher?: typeof fetch; eventsubUrl?: string; socketFactory?: SocketFactory; pack?: Puzzle[] }
export interface BuiltServer {
  app: FastifyInstance; session: Session; controller: GameController; metrics: Metrics; listen: () => Promise<string>; shutdown: () => Promise<void>;
  /** Demo mode only: the random admin token generated for this run, so the demo can print the panel link once. */
  demoAdminToken?: string;
  /** Resolves when any EventSub (re)start in progress has finished. */
  twitchSettled: () => Promise<void>;
}

async function createServer(demo: boolean, env: NodeJS.ProcessEnv, overrides: ServerOverrides = {}): Promise<BuiltServer> {
  const config = demo ? undefined : EnvSchema.parse(env);
  const publicBind = env.PUBLIC === '1';
  // Demo mode gets its own random admin token, so it is protected exactly like a live server.
  const demoAdminToken = demo ? randomBytes(24).toString('hex') : undefined;
  const metrics = new Metrics();
  const app = Fastify({ logger: loggerOptions(overrides.logStream), disableRequestLogging: false });
  const vocabularies = loadFactVocabularies();
  const minVotersToWin = config?.MIN_VOTERS_TO_WIN ?? 2;
  const hintThreshold = config?.HINT_THRESHOLD ?? 3;
  const roundOptions = makeRoundOptions({ vocabularies, minVotersToWin, hintThreshold });
  const store = new SessionStore(overrides.sessionPath ?? 'data/session.json', app.log.child({ component: 'session' }), metrics);
  const session = demo ? new Session() : await store.load(roundOptions);
  const prefix = config?.COMMAND_PREFIX ?? (env.COMMAND_PREFIX?.trim() || '!g');
  // The demo plays the eight audited showcase puzzles; the unaudited sample is only a fallback for an empty pack.
  const showcase = showcasePuzzles(puzzlePack);
  const pack = overrides.pack ?? (demo ? (showcase.length ? showcase : demoPuzzlePack) : puzzlePack);
  const videoSafe = demo || config?.VIDEO_SAFE === '1';

  let chat: ChatSender | undefined;
  let eventsub: EventSubClient | undefined;
  let validation: ReturnType<typeof setInterval> | undefined;
  let twitchChain: Promise<void> = Promise.resolve();
  const onRoundEvent = (event: RoundEvent) => {
    if (!chat || event.round.rehearsal) return;
    const round = event.round;
    if (event.type === 'started') { void chat.send('both', `Twinclue round started! Each community holds half of the clue on stream. Vote with ${prefix} followed by your answer.`); return; }
    const result = round.result;
    const text = round.status === 'won'
      ? `Both communities locked in ${round.puzzle.answer}. That is a win! Streak: ${session.stats.streak}.`
      : round.unscoredReason === 'skipped' ? `Round skipped, so it does not count. The answer was ${round.puzzle.answer}.`
      : round.unscoredReason === 'not-enough-voters' ? `Round over, but each community needs at least ${round.minVotersToWin} voters for it to count. The answer was ${round.puzzle.answer}.`
      : `Round over. The answer was ${round.puzzle.answer}. Community A chose ${result?.A.topAnswer ?? 'nothing'}, community B chose ${result?.B.topAnswer ?? 'nothing'}.`;
    void chat.send('both', text);
  };
  const controller = new GameController(session, pack, { demo, store: demo ? undefined : store, metrics, vocabularies, minVotersToWin, hintThreshold, videoSafe: videoSafe && pack.some(isVideoSafe), commandPrefix: prefix, onRoundEvent });

  let readiness: () => Readiness = () => ({ ready: true, reasons: [], detail: { mode: 'demo' } });
  if (config) {
    const channelLogins: Record<Side, string | undefined> = { a: config.CHANNEL_A, b: config.CHANNEL_B };
    const tokens = new TokenStore({ path: overrides.tokenPath, clientId: config.TWITCH_CLIENT_ID, clientSecret: config.TWITCH_CLIENT_SECRET, fetcher: overrides.fetcher, log: app.log.child({ component: 'tokens' }) });
    await tokens.load();
    const helix = new TwitchHelix({ clientId: config.TWITCH_CLIENT_ID, tokens, fetcher: overrides.fetcher });
    let channelIds: Partial<Record<Side, string>> = {};
    controller.setHealth({ a: { configured: true }, b: { configured: Boolean(config.CHANNEL_B) } });

    const startTwitch = async () => {
      eventsub?.stop();
      eventsub = undefined;
      const identity = await tokens.validate('bot');
      controller.setHealth({ tokenValid: Boolean(identity), lastError: identity ? null : 'The bot account is not authorised. Use "Connect bot account" in the panel.' });
      if (!identity) return;
      const ids: Partial<Record<Side, string>> = {};
      for (const side of ['a', 'b'] as const) {
        const login = channelLogins[side];
        if (!login) continue;
        try { ids[side] = await helix.userId(login, 'bot'); } catch (error) {
          controller.setHealth({ [side]: { error: `Could not find Twitch channel "${login}": ${error instanceof Error ? error.message : String(error)}` } });
        }
      }
      channelIds = ids;
      // A Shared Chat session may already be running; events only report changes, so ask once at start.
      if (ids.a && ids.b) {
        try {
          const shared = await helix.call('GET', `/shared_chat/session?broadcaster_id=${ids.a}`, 'bot');
          const session = (shared.body as { data?: Array<{ participants?: unknown }> } | undefined)?.data?.[0];
          controller.setHealth({ sharedChat: Boolean(session && sharedChatJoinsBoth('channel.shared_chat.begin', session, ids)) });
        } catch { /* events will correct it */ }
      }
      const sender = new ChatSender({ helix, botUserId: identity.userId, channels: ids, sharedChat: () => controller.health.sharedChat, metrics, log: app.log.child({ component: 'chat' }) });
      chat = sender;
      eventsub = new EventSubClient({
        channels: ids, botUserId: identity.userId, helix, url: overrides.eventsubUrl, socketFactory: overrides.socketFactory, metrics, log: app.log.child({ component: 'eventsub' }),
        onChat: createChatRouter({ controller, broadcasterIds: ids, prefix, metrics }),
        onShared: (type, event) => controller.setHealth({ sharedChat: sharedChatJoinsBoth(type, event, ids) }),
        onStatus: status => controller.setHealth(sideHealth(status, ids)),
      });
      eventsub.connect();
    };
    // Restarts run one at a time: two OAuth callbacks in quick succession must never leave two clients running.
    const startSafely = () => {
      twitchChain = twitchChain.then(startTwitch).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        app.log.error({ event: 'twitch_start_failed', reason: message }, 'Could not start the Twitch connection.');
        controller.setHealth({ lastError: `Could not connect to Twitch: ${message}` });
      });
      return twitchChain;
    };

    registerWebRoutes(app, controller, { security: { adminToken: config.ADMIN_TOKEN }, publicUrl: config.PUBLIC_URL, metrics, readiness: () => readiness(),
      postRecap: async (url, recap) => chat ? chat.send('both', `Twinclue recap: ${recapSummary(recap)} Highlights: ${url}`) : false });
    registerAuthRoutes(app, { clientId: config.TWITCH_CLIENT_ID, clientSecret: config.TWITCH_CLIENT_SECRET, publicUrl: config.PUBLIC_URL, store: tokens, fetcher: overrides.fetcher,
      expectedLogin: role => (role === 'bot' ? config.BOT_LOGIN ?? config.CHANNEL_A : channelLogins[role]), requireAdmin: app.requireAdmin, log: app.log.child({ component: 'auth' }),
      onAuthorized: () => { void startSafely(); } });

    readiness = () => {
      const reasons: string[] = [];
      const status = eventsub?.status();
      if (!tokens.status.bot.valid) reasons.push(tokens.status.bot.error ?? 'Bot token missing or not yet validated.');
      for (const side of ['a', 'b'] as const) {
        if (!channelLogins[side]) continue;
        const label = `Channel ${side.toUpperCase()}`;
        if (!channelIds[side]) { reasons.push(`${label}: channel id not resolved.`); continue; }
        if (!status?.connected) reasons.push(`${label}: EventSub not connected.`);
        const sub = status?.subscriptions.find(entry => entry.side === side && entry.type === 'channel.chat.message');
        if (sub?.status !== 'enabled') reasons.push(`${label}: chat subscription ${sub?.status ?? 'missing'}${sub?.error ? ` (${sub.error})` : ''}.`);
      }
      return { ready: reasons.length === 0, reasons, detail: { health: controller.health, eventsub: status ?? null, bot: tokens.status.bot } };
    };

    await startSafely();
    validation = setInterval(() => {
      void tokens.validate('bot').then(identity => controller.setHealth({ tokenValid: Boolean(identity), ...(identity ? {} : { lastError: 'Hourly token check failed. Authorise the bot account again.' }) }));
    }, 60 * 60_000);
    validation.unref();
  } else {
    registerWebRoutes(app, controller, { security: { adminToken: demoAdminToken }, metrics, readiness: () => readiness() });
  }

  const shutdown = async () => {
    if (validation) clearInterval(validation);
    await twitchChain;
    eventsub?.stop();
    controller.close();
    store.stop();
    if (!demo) await store.now(session);
    await app.close();
  };
  const host = publicBind ? '0.0.0.0' : '127.0.0.1';
  return { app, session, controller, metrics, shutdown, demoAdminToken, twitchSettled: () => twitchChain, listen: () => app.listen({ host, port: Number(config?.PORT ?? env.PORT ?? 3000) }) };
}

export function buildServer(env: NodeJS.ProcessEnv = process.env, overrides?: ServerOverrides) { return createServer(false, env, overrides); }
export function buildDemoServer(env: NodeJS.ProcessEnv = process.env, overrides?: ServerOverrides) { return createServer(true, env, overrides); }

/**
 * TRUST_PROXY=N trusts N proxies in front of the server, so the client is the Nth X-Forwarded-For entry from the
 * right: the address the outermost trusted proxy saw. `trustProxy: true` would take the leftmost entry, which a client
 * can forge behind any proxy that appends to the header, and Fastify ignores plain hop counts, so this is a function.
 */
export function trustedProxies(value: string | undefined): ((address: string, hop: number) => boolean) | false {
  const hops = Math.min(10, Math.floor(Number(value?.trim() || 0)) || 0);
  return hops > 0 ? (_address, hop) => hop < hops : false;
}

/**
 * SANDBOX=1: the hosted "try it now" mode. No Twitch, no admin token, one isolated in-memory game per browser,
 * only audited video-safe puzzles. Binds to 127.0.0.1 unless PUBLIC=1.
 */
export async function buildSandboxServer(env: NodeJS.ProcessEnv = process.env, overrides: { pack?: Puzzle[]; logStream?: NodeJS.WritableStream } = {}) {
  const app = Fastify({ logger: loggerOptions(overrides.logStream), trustProxy: trustedProxies(env.TRUST_PROXY) });
  // Showcase puzzles come first, then every other audited video-safe puzzle.
  const showcase = showcasePuzzles(puzzlePack);
  const ordered = [...showcase, ...puzzlePack.filter(puzzle => !showcase.includes(puzzle))];
  const manager = registerSandbox(app, { pack: overrides.pack ?? ordered, vocabularies: loadFactVocabularies(), publicUrl: env.PUBLIC_URL?.trim() || undefined,
    maxSessions: Number(env.SANDBOX_MAX_GAMES ?? 200) });
  const host = env.PUBLIC === '1' ? '0.0.0.0' : '127.0.0.1';
  return { app, manager, listen: () => app.listen({ host, port: Number(env.PORT ?? 3000) }), shutdown: () => app.close() };
}

export function installShutdown(server: BuiltServer): void {
  let closing = false;
  const stop = (signal: string) => {
    if (closing) return;
    closing = true;
    server.app.log.info({ event: 'shutdown', signal }, 'Shutting down; saving the session.');
    server.shutdown().then(() => process.exit(0), () => process.exit(1));
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  process.on('unhandledRejection', reason => server.app.log.error({ event: 'unhandled_rejection', reason: reason instanceof Error ? reason.message : String(reason) }, 'Unhandled rejection.'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.SANDBOX === '1') {
    const sandbox = await buildSandboxServer();
    const stop = () => { void sandbox.shutdown().then(() => process.exit(0)); };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    const address = await sandbox.listen();
    console.log(`Twinclue sandbox is running at ${address}`);
  } else {
    const server = await buildServer();
    installShutdown(server);
    await server.listen();
  }
}
