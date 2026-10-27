import { describe, it, expect, afterEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { GameController } from './controller.js';
import { overlayKeys, registerWebRoutes } from './web.js';
import { Session } from '../game/session.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';
import { Metrics } from '../obs/metrics.js';

const ADMIN = 'test-admin-token-0123456789abcdef';
const apps: FastifyInstance[] = [];
async function secured(readiness?: () => { ready: boolean; reasons: string[]; detail: unknown }) {
  const app = Fastify();
  const controller = new GameController(new Session(), [puzzleFixture]);
  registerWebRoutes(app, controller, { security: { adminToken: ADMIN }, metrics: new Metrics(), readiness });
  apps.push(app);
  app.addHook('onClose', async () => controller.close());
  return { app, controller };
}
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });

function open(url: string, headers: Record<string, string> = {}): Promise<{ ws?: WebSocket; status?: number; first?: any; closeCode?: number }> {
  return new Promise(resolve => {
    const ws = new WebSocket(url, { headers });
    ws.on('unexpected-response', (_request, response) => resolve({ status: response.statusCode }));
    ws.on('message', data => resolve({ ws, first: JSON.parse(String(data)) }));
    ws.on('close', code => resolve({ closeCode: code }));
    ws.on('error', () => undefined);
  });
}

describe('web routes', () => {
  it('runs open in demo mode and shows only the host overlay preview', async () => {
    const app = Fastify();
    apps.push(app);
    const controller = new GameController(new Session(), [puzzleFixture], { demo: true });
    registerWebRoutes(app, controller);
    const setting = await app.inject({ method: 'POST', url: '/api/settings', payload: { category: 'geography', roundLengthSeconds: 75 } });
    expect(setting.json()).toMatchObject({ category: 'geography', roundLengthSeconds: 75 });
    const start = await app.inject({ method: 'POST', url: '/api/round/start' });
    expect(start.json().roundStatus).toBe('active');
    const panel = (await app.inject({ url: '/panel' })).body;
    expect(panel).toContain('id="preview-a"');
    expect(panel).not.toContain('preview-b');
    expect(panel).toContain('Rehearsal mode');
    controller.close();
  });

  it('ships the overlay states, call to action, closed vocabulary row and rehearsal label', async () => {
    const { app } = await secured();
    const script = (await app.inject({ url: '/overlay.js' })).body;
    expect(script).toContain('VOTING LIVE');
    expect(script).toContain('other answers');
    expect(script).toContain('REHEARSAL');
    expect(script).toContain("Type ${s.commandPrefix || '!g'} and your answer in chat");
  });

  it('requires the admin token in a header for the API and metrics', async () => {
    const { app } = await secured();
    expect((await app.inject({ url: '/api/state' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/state', query: { token: ADMIN } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/api/state', headers: { authorization: `Bearer ${ADMIN}` } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/api/round/start', headers: { authorization: 'Bearer wrong' } })).statusCode).toBe(401);
    expect((await app.inject({ url: '/metrics' })).statusCode).toBe(401);
    const metrics = await app.inject({ url: '/metrics', headers: { 'x-admin-token': ADMIN } });
    expect(metrics.body).toContain('twinclue_vote_to_frame_seconds_bucket');
    const crossSite = await app.inject({ method: 'POST', url: '/api/round/start', headers: { authorization: `Bearer ${ADMIN}`, origin: 'https://evil.example', host: 'localhost:3000' } });
    expect(crossSite.statusCode).toBe(403);
  });

  it('serves each overlay page only with its own key', async () => {
    const { app } = await secured();
    const keys = overlayKeys(ADMIN);
    expect((await app.inject({ url: '/overlay/a' })).statusCode).toBe(403);
    expect((await app.inject({ url: `/overlay/a?k=${keys.a}` })).statusCode).toBe(200);
    expect((await app.inject({ url: `/overlay/b?k=${keys.a}` })).statusCode).toBe(403);
    const links = (await app.inject({ url: '/api/overlay-links', headers: { authorization: `Bearer ${ADMIN}` } })).json();
    expect(links.b).toContain(`k=${keys.b}`);
  });

  it('checks the key and Origin on overlay sockets and authenticates the panel socket', async () => {
    const { app, controller } = await secured();
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const ws = address.replace('http', 'ws');
    const host = new URL(address).host;
    const keys = overlayKeys(ADMIN);
    controller.startRound();
    expect((await open(`${ws}/overlay/ws/a`)).status).toBe(403);
    expect((await open(`${ws}/overlay/ws/b?k=${keys.a}`)).status).toBe(403);
    expect((await open(`${ws}/overlay/ws/a?k=${keys.a}`, { origin: 'https://evil.example' })).status).toBe(403);
    const good = await open(`${ws}/overlay/ws/a?k=${keys.a}`, { origin: `http://${host}` });
    expect(good.first.type).toBe('state');
    expect(good.first.half).toBe(puzzleFixture.halfA);
    good.ws!.close();
    const silentPanel = await open(`${ws}/overlay/ws/panel`);
    expect(silentPanel.first).toBeUndefined();
    const panel = await new Promise<any>(resolve => {
      const socket = new WebSocket(`${ws}/overlay/ws/panel`);
      socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', token: ADMIN })));
      socket.on('message', data => { resolve(JSON.parse(String(data))); socket.close(); });
    });
    expect(panel.type).toBe('panel-state');
    const rejected = await new Promise<number>(resolve => {
      const socket = new WebSocket(`${ws}/overlay/ws/panel`);
      socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', token: 'nope' })));
      socket.on('close', code => resolve(code));
    });
    expect(rejected).toBe(4401);
    silentPanel.ws?.close();
  }, 15_000);

  it('reports liveness and readiness with reasons', async () => {
    const { app } = await secured(() => ({ ready: false, reasons: ['Channel B: EventSub not connected.'], detail: null }));
    expect((await app.inject({ url: '/healthz' })).json()).toEqual({ ok: true });
    const ready = await app.inject({ url: '/readyz' });
    expect(ready.statusCode).toBe(503);
    expect(ready.json().reasons).toEqual(['Channel B: EventSub not connected.']);
  });
});
