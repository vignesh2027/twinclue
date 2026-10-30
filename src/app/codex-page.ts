import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

/** The Codex build replay: a static page plus the sanitised replay that `npm run codex:replay` writes. Public in every mode. */
const files: Record<string, { path: string; type: string }> = {
  '/codex': { path: 'public/codex.html', type: 'text/html; charset=utf-8' },
  '/codex.css': { path: 'public/codex.css', type: 'text/css; charset=utf-8' },
  '/codex.js': { path: 'public/codex.js', type: 'application/javascript; charset=utf-8' },
  '/codex/replay.json': { path: 'docs/codex/replay.json', type: 'application/json; charset=utf-8' },
};

export function registerCodexReplay(app: FastifyInstance): void {
  for (const [route, file] of Object.entries(files)) {
    app.get(route, async (_request, reply) => {
      try {
        return reply.type(file.type).header('cache-control', 'public, max-age=300').send(await readFile(resolve(file.path), 'utf8'));
      } catch {
        return reply.code(404).send({ error: 'The Codex replay has not been generated. Run npm run codex:replay.' });
      }
    });
  }
}
