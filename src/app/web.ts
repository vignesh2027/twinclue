import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { resolve } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import type { Metrics } from '../obs/metrics.js';
import type { GameController, View } from './controller.js';

export interface WebSecurity {
  /** Required for the panel, /api/*, /auth/* and /metrics. When absent (demo and tests on localhost) those routes are open. */
  adminToken?: string;
  /** Extra origins allowed to open sockets and post, such as PUBLIC_URL's origin. Same-host origins are always allowed. */
  allowedOrigins?: string[];
}
export interface Readiness { ready: boolean; reasons: string[]; detail: unknown }
export interface WebOptions {
  security?: WebSecurity; metrics?: Metrics; readiness?: () => Readiness; publicUrl?: string;
  onRecap?: () => Promise<boolean>;
  /** Frames above this many buffered bytes are skipped for that socket (and resent shortly), except round transitions. */
  slowSocketBytes?: number;
}

const SettingsSchema = z.object({ category: z.enum(['general', 'games', 'music', 'science', 'sport', 'food', 'geography', 'movies', 'custom']).optional(), difficulty: z.enum(['easy', 'medium', 'hard']).optional(), roundLengthSeconds: z.number().int().min(30).max(600).optional() });
const RehearsalSchema = z.object({ enabled: z.boolean() });
const RehearsalVoteSchema = z.object({ text: z.string().min(1).max(80) });

/** Per-side overlay keys derived from the admin token, so there is one secret to manage and key A never opens side B. */
export function overlayKeys(adminToken: string): { a: string; b: string } {
  const derive = (side: string) => createHmac('sha256', adminToken).update(`twinclue-overlay-${side}`).digest('hex').slice(0, 32);
  return { a: derive('a'), b: derive('b') };
}

function safeEqual(given: string | undefined, expected: string): boolean {
  if (typeof given !== 'string') return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function adminTokenFrom(headers: IncomingMessage['headers']): string | undefined {
  const bearer = /^Bearer\s+(.+)$/i.exec(String(headers.authorization ?? ''))?.[1];
  const header = headers['x-admin-token'];
  return bearer ?? (typeof header === 'string' ? header : undefined);
}

/** Browsers always send Origin on WebSocket upgrades and cross-site posts; a page on another site is refused. */
export function originAllowed(origin: string | undefined, host: string | undefined, allowed: string[] = []): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (host && url.host === host) return true;
    return allowed.some(entry => { try { return new URL(entry).origin === url.origin; } catch { return false; } });
  } catch { return false; }
}

const files: Record<string, { path: string; type: string }> = {
  '/overlay.css': { path: 'public/overlay.css', type: 'text/css; charset=utf-8' },
  '/overlay.js': { path: 'public/overlay.js', type: 'application/javascript; charset=utf-8' },
  '/logo.svg': { path: 'public/logo.svg', type: 'image/svg+xml; charset=utf-8' },
  '/panel': { path: 'public/panel.html', type: 'text/html; charset=utf-8' },
  '/panel.css': { path: 'public/panel.css', type: 'text/css; charset=utf-8' },
  '/panel.js': { path: 'public/panel.js', type: 'application/javascript; charset=utf-8' },
};

export function registerWebRoutes(app: FastifyInstance, controller: GameController, options: WebOptions = {}): WebSocketServer {
  const security = options.security ?? {};
  const keys = security.adminToken ? overlayKeys(security.adminToken) : undefined;
  const allowed = [...(security.allowedOrigins ?? []), ...(options.publicUrl ? [options.publicUrl] : [])];
  const metrics = options.metrics;
  const slowBytes = options.slowSocketBytes ?? 512 * 1024;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  const requireAdmin: preHandlerHookHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!originAllowed(request.headers.origin, request.headers.host, allowed)) return reply.code(403).send({ error: 'Cross-site request refused.' });
    if (security.adminToken && !safeEqual(adminTokenFrom(request.headers), security.adminToken)) return reply.code(401).send({ error: 'Admin token required.' });
  };
  app.decorate('requireAdmin', requireAdmin);

  app.server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const view = url.pathname.match(/^\/overlay\/ws\/(a|b|panel)$/)?.[1] as View | undefined;
    const reject = (code: number, text: string) => { socket.write(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); socket.destroy(); };
    if (!view) return reject(404, 'Not Found');
    if (!originAllowed(request.headers.origin, request.headers.host, allowed)) return reject(403, 'Forbidden');
    if (keys && view !== 'panel' && !safeEqual(url.searchParams.get('k') ?? undefined, keys[view])) return reject(403, 'Forbidden');
    wss.handleUpgrade(request, socket, head, ws => attach(ws, view));
  });

  function attach(ws: WebSocket, view: View): void {
    let stop: (() => void) | undefined;
    let latest: string | undefined;
    let resendTimer: ReturnType<typeof setTimeout> | undefined;
    const deliver = (frame: string, critical: boolean) => {
      latest = frame;
      if (ws.readyState !== WebSocket.OPEN) return;
      if (!critical && ws.bufferedAmount > slowBytes) {
        metrics?.shed.inc({ kind: 'frame' });
        resendTimer ??= setTimeout(() => { resendTimer = undefined; if (latest) deliver(latest, false); }, 250);
        return;
      }
      ws.send(frame);
      metrics?.framesSent.inc({ view });
    };
    const begin = () => { stop = controller.subscribe(view, deliver); };
    ws.on('close', () => { stop?.(); if (resendTimer) clearTimeout(resendTimer); });
    ws.on('error', () => ws.terminate());
    if (view !== 'panel' || !security.adminToken) { begin(); return; }
    // Browsers cannot set headers on a WebSocket, so the panel proves itself with its first message.
    const deadline = setTimeout(() => ws.close(4401, 'auth required'), 5_000);
    ws.once('message', data => {
      clearTimeout(deadline);
      let token: string | undefined;
      try { token = (JSON.parse(String(data)) as { type?: string; token?: string }).token; } catch { /* treated as missing */ }
      if (!safeEqual(token, security.adminToken!)) { ws.close(4401, 'auth required'); return; }
      begin();
    });
  }

  app.get('/overlay/:side', async (request, reply) => {
    const side = (request.params as { side: string }).side;
    if (side !== 'a' && side !== 'b') return reply.code(404).send({ error: 'Not found' });
    if (keys && !safeEqual((request.query as { k?: string }).k, keys[side])) {
      return reply.code(403).type('text/html; charset=utf-8').send('<!doctype html><title>Twinclue</title><p style="font:24px system-ui;color:#fff">This overlay link is missing its key. Copy the full link from the Twinclue control panel.</p>');
    }
    return reply.type('text/html; charset=utf-8').header('cache-control', 'no-store').send(await readFile(resolve('public/overlay.html'), 'utf8'));
  });
  for (const [route, file] of Object.entries(files)) app.get(route, async (_request, reply) => reply.type(file.type).send(await readFile(resolve(file.path), 'utf8')));

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/health', async () => ({ ok: true }));
  app.get('/readyz', async (_request, reply) => {
    const readiness = options.readiness?.() ?? { ready: true, reasons: [], detail: null };
    return reply.code(readiness.ready ? 200 : 503).send(readiness);
  });
  app.get('/metrics', { preHandler: requireAdmin }, async (_request, reply) => reply.type('text/plain; version=0.0.4; charset=utf-8').send(metrics?.render() ?? ''));

  app.get('/api/state', { preHandler: requireAdmin }, async () => controller.panelState());
  app.get('/api/overlay-links', { preHandler: requireAdmin }, async request => {
    const base = (options.publicUrl ?? `${request.protocol}://${request.headers.host}`).replace(/\/$/, '');
    const link = (side: 'a' | 'b') => `${base}/overlay/${side}${keys ? `?k=${keys[side]}` : ''}`;
    return { a: link('a'), b: link('b') };
  });
  app.post('/api/round/start', { preHandler: requireAdmin }, async (_request, reply) => {
    try { controller.startRound(); return controller.panelState(); } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : 'Could not start round.' }); }
  });
  app.post('/api/round/skip', { preHandler: requireAdmin }, async () => { controller.skipRound(); return controller.panelState(); });
  app.post('/api/round/lock', { preHandler: requireAdmin }, async (_request, reply) => {
    if (controller.activeRound?.status !== 'active') return reply.code(409).send({ error: 'No active round to lock.' });
    controller.lockRound();
    return controller.panelState();
  });
  app.post('/api/settings', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = SettingsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid settings.' });
    controller.setSettings(parsed.data);
    return controller.panelState();
  });
  app.post('/api/rehearsal', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = RehearsalSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Send {"enabled": true or false}.' });
    controller.setRehearsal(parsed.data.enabled);
    return controller.panelState();
  });
  app.post('/api/rehearsal/vote', { preHandler: requireAdmin }, async (request, reply) => {
    const parsed = RehearsalVoteSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Type a vote of up to 80 characters.' });
    try { return { result: controller.rehearsalVote(parsed.data.text) }; } catch (error) { return reply.code(409).send({ error: error instanceof Error ? error.message : 'Rehearsal is off.' }); }
  });
  app.post('/api/recap', { preHandler: requireAdmin }, async (_request, reply) => {
    if (!options.onRecap) return reply.code(409).send({ error: 'Chat is not connected.' });
    return { sent: await options.onRecap() };
  });
  app.addHook('onClose', async () => { for (const client of wss.clients) client.terminate(); wss.close(); });
  return wss;
}

declare module 'fastify' {
  interface FastifyInstance { requireAdmin: preHandlerHookHandler }
}
