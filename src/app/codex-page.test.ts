import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { Session } from '../game/session.js';
import { forgedPack } from '../puzzle/forged-pack.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';
import { GameController } from './controller.js';
import { registerSandbox } from './sandbox.js';
import { registerWebRoutes } from './web.js';

const apps: FastifyInstance[] = [];
afterEach(async () => { for (const app of apps.splice(0)) await app.close(); });

function hosted(): FastifyInstance {
  const app = Fastify();
  const controller = new GameController(new Session(), [puzzleFixture]);
  // An admin token is set, as in real and demo mode: the replay must still be public.
  registerWebRoutes(app, controller, { security: { adminToken: 'test-admin-token-0123456789abcdef' } });
  app.addHook('onClose', async () => controller.close());
  apps.push(app);
  return app;
}
function sandboxed(): FastifyInstance {
  const app = Fastify();
  registerSandbox(app, { pack: forgedPack });
  apps.push(app);
  return app;
}

describe('/codex replay page', () => {
  for (const [mode, make] of [['normal and demo', hosted], ['sandbox', sandboxed]] as const) {
    it(`is served without a token in ${mode} mode, with its assets and the replay data`, async () => {
      const app = make();
      const page = await app.inject({ url: '/codex' });
      expect(page.statusCode).toBe(200);
      expect(page.headers['content-type']).toContain('text/html');
      expect(page.body).toContain('How Codex built Twinclue');
      expect(page.body).toContain('id="session-id"');
      for (const asset of ['/codex.css', '/codex.js']) expect((await app.inject({ url: asset })).statusCode).toBe(200);
      const data = await app.inject({ url: '/codex/replay.json' });
      expect(data.statusCode).toBe(200);
      expect(data.json()).toMatchObject({ sessionId: '01a173c5-a449-71a1-abff-67e5a794156b' });
    });
  }

  it('is linked from the sandbox page and the README', async () => {
    const page = await sandboxed().inject({ url: '/' });
    expect(page.body).toContain('href="/codex"');
    expect(readFileSync('README.md', 'utf8')).toContain('docs/CODEX-SESSION.md');
  });

  it('escapes every replay string it renders and keeps its own wording plain', () => {
    const html = readFileSync('public/codex.html', 'utf8');
    const script = readFileSync('public/codex.js', 'utf8');
    for (const field of ['event.cmd', 'event.query', 'f.path', 'slice.title', 'slice.label', 'c.subject']) {
      expect(script, field).toContain(`esc(${field}`);
      expect(script.split(field).length - 1, `${field} is only used escaped`).toBe(1);
    }
    for (const field of ['event.text', 'slice.brief']) expect(script).toContain(`markdown(${field}`);
    // Markdown input is escaped before any tag is added, and only https links become anchors.
    expect(script).toMatch(/function inline\(text\) \{\s*return esc\(text\)/);
    expect(script).toMatch(/\/\^https:\\\/\\\/\//);
    expect(html).not.toMatch(/—|->|→/);
    expect(script.replace(/=>/g, '')).not.toMatch(/'[^']*(?:—|->|→)[^']*'/);
  });
});
