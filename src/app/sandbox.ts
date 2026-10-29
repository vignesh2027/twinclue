import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import { Session } from '../game/session.js';
import type { VocabEntry } from '../game/vocabulary.js';
import { isVideoSafe } from '../puzzle/showcase.js';
import type { Puzzle } from '../puzzle/types.js';
import { GameController, type OverlayView } from './controller.js';
import { allowedOrigins, originAllowed } from './web.js';

/**
 * The hosted "try it now" mode: every browser gets its own in-memory game, found by a random cookie. There is no
 * Twitch connection and no admin token; the visitor types both communities' votes. Sessions are capped, expire
 * after 30 idle minutes, and every action is rate limited.
 */
export interface SandboxOptions {
  pack: Puzzle[]; vocabularies?: Map<string, VocabEntry[]>; publicUrl?: string;
  maxSessions?: number; idleMs?: number; now?: () => number;
  /** Token bucket per visitor for actions: refill per second and burst size. */
  actionsPerSecond?: number; actionBurst?: number;
  /** New games one IP address may open per ten minutes. */
  sessionsPerIpPer10Min?: number;
  roundLengthSeconds?: number;
}

interface Bucket { tokens: number; at: number }
interface Visitor { controller: GameController; lastSeen: number; bucket: Bucket; voters: number }

const COOKIE = 'tc_sandbox';
const ID_PATTERN = /^[a-f0-9]{32}$/;
const VoteSchema = z.object({ side: z.enum(['A', 'B']), text: z.string().min(1).max(80) });
const SideSchema = z.object({ side: z.enum(['A', 'B']) });

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

export class SandboxManager {
  readonly visitors = new Map<string, Visitor>();
  private readonly ipStarts = new Map<string, number[]>();
  private readonly pack: Puzzle[];
  private readonly now: () => number;
  private sweeper?: ReturnType<typeof setInterval>;

  constructor(private readonly options: SandboxOptions) {
    // Only audited puzzles from non-trademark tables are ever played here.
    this.pack = options.pack.filter(isVideoSafe);
    this.now = options.now ?? Date.now;
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  get size(): number { return this.visitors.size; }
  get playable(): number { return this.pack.length; }

  /** The visitor's game, created on first use. Undefined when the sandbox is full or the IP opened too many. */
  visitor(id: string, ip: string): Visitor | undefined {
    const existing = this.visitors.get(id);
    if (existing) { existing.lastSeen = this.now(); return existing; }
    this.sweep();
    if (this.visitors.size >= (this.options.maxSessions ?? 200)) return undefined;
    const window = (this.ipStarts.get(ip) ?? []).filter(at => this.now() - at < 10 * 60_000);
    if (window.length >= (this.options.sessionsPerIpPer10Min ?? 20)) return undefined;
    window.push(this.now());
    this.ipStarts.set(ip, window);
    const controller = new GameController(new Session(), this.pack, {
      sandbox: true, videoSafe: true, vocabularies: this.options.vocabularies,
      // One person plays both chats, so one voter per side counts and one ask unlocks a hint.
      minVotersToWin: 1, hintThreshold: 1,
    });
    controller.setSettings({ roundLengthSeconds: this.options.roundLengthSeconds ?? 60 });
    const visitor: Visitor = { controller, lastSeen: this.now(), bucket: { tokens: this.options.actionBurst ?? 12, at: this.now() }, voters: 0 };
    this.visitors.set(id, visitor);
    return visitor;
  }

  /** Token bucket: true when the action may proceed. */
  allow(visitor: Visitor): boolean {
    const rate = this.options.actionsPerSecond ?? 4;
    const burst = this.options.actionBurst ?? 12;
    const now = this.now();
    visitor.bucket.tokens = Math.min(burst, visitor.bucket.tokens + ((now - visitor.bucket.at) / 1000) * rate);
    visitor.bucket.at = now;
    if (visitor.bucket.tokens < 1) return false;
    visitor.bucket.tokens -= 1;
    return true;
  }

  sweep(): void {
    const idle = this.options.idleMs ?? 30 * 60_000;
    for (const [id, visitor] of this.visitors) if (this.now() - visitor.lastSeen > idle) { visitor.controller.close(); this.visitors.delete(id); }
    for (const [ip, starts] of this.ipStarts) if (starts.every(at => this.now() - at >= 10 * 60_000)) this.ipStarts.delete(ip);
  }

  close(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    for (const visitor of this.visitors.values()) visitor.controller.close();
    this.visitors.clear();
  }
}

const files: Record<string, { path: string; type: string }> = {
  '/': { path: 'public/sandbox.html', type: 'text/html; charset=utf-8' },
  '/sandbox.css': { path: 'public/sandbox.css', type: 'text/css; charset=utf-8' },
  '/sandbox.js': { path: 'public/sandbox.js', type: 'application/javascript; charset=utf-8' },
  '/overlay.css': { path: 'public/overlay.css', type: 'text/css; charset=utf-8' },
  '/overlay.js': { path: 'public/overlay.js', type: 'application/javascript; charset=utf-8' },
  '/logo.svg': { path: 'public/logo.svg', type: 'image/svg+xml; charset=utf-8' },
};

export function registerSandbox(app: FastifyInstance, options: SandboxOptions): SandboxManager {
  const manager = new SandboxManager(options);
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  const secure = Boolean(options.publicUrl?.startsWith('https://'));
  const extra = options.publicUrl ? [options.publicUrl] : [];
  const allowed = () => { const address = app.server.address(); return allowedOrigins(extra, address && typeof address === 'object' ? address.port : undefined); };
  const ipOf = (request: IncomingMessage | FastifyRequest) => ('ip' in request && typeof request.ip === 'string' ? request.ip : (request as IncomingMessage).socket.remoteAddress) ?? 'unknown';

  /** Every page load carries a cookie; the game behind it is created on first use. */
  function cookieId(request: FastifyRequest, reply: FastifyReply): string {
    const current = readCookie(request.headers.cookie, COOKIE);
    if (current && ID_PATTERN.test(current)) return current;
    const id = randomBytes(16).toString('hex');
    reply.header('set-cookie', `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure ? '; Secure' : ''}`);
    return id;
  }

  for (const [route, file] of Object.entries(files)) {
    app.get(route, async (request, reply) => {
      if (route === '/') cookieId(request, reply);
      return reply.type(file.type).header('cache-control', 'no-store').send(await readFile(resolve(file.path), 'utf8'));
    });
  }
  app.get('/overlay/:side', async (request, reply) => {
    const side = (request.params as { side: string }).side;
    if (side !== 'a' && side !== 'b') return reply.code(404).send({ error: 'Not found' });
    return reply.type('text/html; charset=utf-8').header('cache-control', 'no-store').send(await readFile(resolve('public/overlay.html'), 'utf8'));
  });
  app.get('/healthz', async () => ({ ok: true, sandbox: true, games: manager.size }));

  // Every action goes through the same guard: a known cookie, a game slot, a same-site Origin and the rate limit.
  async function act(request: FastifyRequest, reply: FastifyReply, run: (controller: GameController, visitor: Visitor) => unknown) {
    if (!originAllowed(request.headers.origin, allowed())) return reply.code(403).send({ error: 'Cross-site request refused.' });
    const id = readCookie(request.headers.cookie, COOKIE);
    if (!id || !ID_PATTERN.test(id)) return reply.code(400).send({ error: 'Reload the page to start a sandbox game.' });
    const visitor = manager.visitor(id, ipOf(request));
    if (!visitor) return reply.code(503).send({ error: 'The sandbox is busy. Try again in a few minutes.' });
    if (!manager.allow(visitor)) return reply.code(429).send({ error: 'Slow down a little.' });
    try { return { ok: true, result: run(visitor.controller, visitor) ?? null, state: summary(visitor.controller) }; } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : 'That did not work.' });
    }
  }
  const summary = (controller: GameController) => {
    const panel = controller.panelState();
    return { roundStatus: panel.roundStatus, endsAt: panel.endsAt, serverNow: panel.serverNow, voters: panel.voters, leading: panel.leading, hints: panel.hints, scoreboard: panel.scoreboard };
  };
  app.get('/sandbox/api/state', (request, reply) => act(request, reply, () => null));
  app.post('/sandbox/api/start', (request, reply) => act(request, reply, controller => { controller.startRound(); }));
  app.post('/sandbox/api/lock', (request, reply) => act(request, reply, controller => {
    if (controller.activeRound?.status !== 'active') throw new Error('No round is running.');
    controller.lockRound();
  }));
  app.post('/sandbox/api/vote', (request, reply) => {
    const parsed = VoteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Type an answer of up to 80 characters.' });
    // Each vote is a new simulated viewer of that community.
    return act(request, reply, (controller, visitor) => { const n = ++visitor.voters; return controller.vote(parsed.data.side, `you-${n}`, parsed.data.text, { displayName: `You (${parsed.data.side}${n})` }); });
  });
  app.post('/sandbox/api/hint', (request, reply) => {
    const parsed = SideSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Pick community A or B.' });
    return act(request, reply, (controller, visitor) => controller.requestHint(parsed.data.side, `hint-${++visitor.voters}`));
  });

  // "Watch a sample round": the server plays both chats for one round, so a first-time visitor sees every beat.
  app.post('/sandbox/api/watch', (request, reply) => act(request, reply, (controller, visitor) => {
    if (controller.activeRound?.status === 'active') throw new Error('A round is already running.');
    const round = controller.startRound();
    const steps: Array<[number, () => void]> = [];
    const voter = (side: 'A' | 'B', text: string) => () => { const n = ++visitor.voters; controller.vote(side, `watch-${n}`, text, { displayName: `Viewer ${side}${n}` }); };
    const [a1, a2] = round.puzzle.alsoFitsA ?? round.puzzle.halfAAlsoFits;
    const [b1] = round.puzzle.alsoFitsB ?? round.puzzle.halfBAlsoFits;
    steps.push([1_200, voter('A', a1 ?? 'a guess')], [1_800, voter('B', b1 ?? 'a guess')], [2_600, voter('A', a2 ?? 'a guess')]);
    if (round.hintText('A')) steps.push([3_400, () => controller.requestHint('A', `watch-hint-${++visitor.voters}`)]);
    steps.push([5_000, voter('A', round.puzzle.answer)], [5_600, voter('A', round.puzzle.answer)], [6_200, voter('B', round.puzzle.answer)], [6_800, voter('B', round.puzzle.answer)]);
    steps.push([8_200, () => { if (controller.activeRound === round && round.status === 'active') controller.lockRound(); }]);
    for (const [delay, step] of steps) setTimeout(() => { if (controller.activeRound === round && round.status === 'active') step(); }, delay).unref();
    return 'watching';
  }));

  app.server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const view = url.pathname.match(/^\/sandbox\/ws\/(a|b)$/)?.[1] as OverlayView | undefined;
    const reject = (code: number, text: string) => { socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); socket.destroy(); };
    if (!view) return reject(404, 'Not Found');
    if (!originAllowed(request.headers.origin, allowed())) return reject(403, 'Forbidden');
    const id = readCookie(request.headers.cookie, COOKIE);
    if (!id || !ID_PATTERN.test(id)) return reject(400, 'Bad Request');
    const visitor = manager.visitor(id, ipOf(request));
    if (!visitor) return reject(503, 'Service Unavailable');
    wss.handleUpgrade(request, socket, head, ws => {
      const stop = visitor.controller.subscribe(view, frame => { if (ws.readyState === WebSocket.OPEN) ws.send(frame); });
      ws.on('close', stop);
      ws.on('error', () => ws.terminate());
    });
  });
  app.addHook('onClose', async () => { for (const client of wss.clients) client.terminate(); wss.close(); manager.close(); });
  return manager;
}
