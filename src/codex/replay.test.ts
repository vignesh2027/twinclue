import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseEnv } from 'dotenv';
import { describe, expect, it } from 'vitest';
import { commandKinds, createSanitiser, parseExecLog, parseRollout, parseTestSummary, unwrapCommand, type Replay } from './replay.js';

const REPLAY_PATH = resolve('docs/codex/replay.json');
const replayText = readFileSync(REPLAY_PATH, 'utf8');
const replay = JSON.parse(replayText) as Replay;

/**
 * Values in .env that are public product names or settings, quoted in the briefs and in Codex's reports:
 * the model ids, the provider's public API endpoint and the audit batch size. Everything else in .env must be absent.
 */
const PUBLIC_ENV_KEYS = new Set(['LLM_BASE_URL', 'LLM_MODEL', 'AUDIT_MODEL', 'AUDIT_MODELS', 'FACT_MODEL', 'FACT_MODELS', 'AUDIT_BATCH']);
/** In data/tokens.json, Twitch's public scope names and the token type ("bearer") are not secrets; every other value is. */
const PUBLIC_TOKEN_FIELDS = new Set(['scope', 'token_type']);

/** Pattern names only: a failing assertion must never print the matched text. */
const KEY_PATTERNS: Record<string, RegExp> = {
  groqKey: /gsk_[A-Za-z0-9]{10,}/,
  googleKey: /AIza[0-9A-Za-z_-]{20,}/,
  openaiStyleKey: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}/,
  githubToken: /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/,
  awsKey: /\bAKIA[0-9A-Z]{16}\b/,
  slackToken: /\bxox[abposr]-[A-Za-z0-9-]{10,}/,
  privateKey: /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  jwt: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  bearerHeader: /\bBearer\s+(?!\$\{)[A-Za-z0-9._~+/=-]{12,}/,
  twitchOauth: /\boauth:[a-z0-9]{20,}/i,
  secretAssignment: /\b[A-Z_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*=\s*["']?(?!\[redacted\])[A-Za-z0-9_\-./+=]{12,}/,
  jsonSecret: /"(?:access_token|refresh_token|client_secret|api_key)"\s*:\s*"(?!\[redacted\])[^"]{12,}"/i,
  longHex: /\b[0-9a-f]{32,}\b/i,
  homePath: /\/(?:Users|home)\/[A-Za-z0-9._-]+/,
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/,
};

function secretFields(): Array<{ name: string; value: string }> {
  const fields: Array<{ name: string; value: string }> = [];
  const envPath = resolve('.env');
  if (existsSync(envPath)) {
    for (const [name, value] of Object.entries(parseEnv(readFileSync(envPath)))) if (!PUBLIC_ENV_KEYS.has(name)) fields.push({ name: `.env ${name}`, value });
  }
  const tokensPath = resolve('data/tokens.json');
  if (existsSync(tokensPath)) {
    const walk = (node: unknown, path: string, key: string): void => {
      if (typeof node === 'string' || typeof node === 'number') { if (!PUBLIC_TOKEN_FIELDS.has(key)) fields.push({ name: `tokens.json ${path}`, value: String(node) }); return; }
      if (Array.isArray(node)) { node.forEach((child, index) => walk(child, `${path}[${index}]`, key)); return; }
      if (node && typeof node === 'object') for (const [child, value] of Object.entries(node)) walk(value, path ? `${path}.${child}` : child, child);
    };
    walk(JSON.parse(readFileSync(tokensPath, 'utf8')), '', '');
  }
  // Very short values ("1", "true") would match ordinary text; nothing that short is a credential.
  return fields.filter(field => field.value.trim().length >= 6);
}

describe('Codex replay: nothing secret is published', () => {
  it('contains no value from .env or data/tokens.json', () => {
    const haystack = replayText.toLowerCase();
    const leaked = secretFields().filter(field => haystack.includes(field.value.toLowerCase())).map(field => field.name);
    expect(leaked, 'these fields leaked into docs/codex/replay.json (names only)').toEqual([]);
  });

  it('matches no common key, token, home path or email pattern', () => {
    const hits = Object.entries(KEY_PATTERNS).filter(([, pattern]) => pattern.test(replayText)).map(([name]) => name);
    expect(hits, 'pattern names that matched docs/codex/replay.json').toEqual([]);
  });

  it('has the expected shape: eight slices of one session, each with its commit and counts that add up', () => {
    expect(replay.version).toBe(1);
    expect(replay.sessionId).toBe('01a173c5-a449-71a1-abff-67e5a794156b');
    expect(replay.slices.map(slice => slice.id)).toEqual(['slice1', 'slice2', 'slice3', 'slice4', 'slice4b', 'slice5', 'slice5b', 'slice5c']);
    expect(replay.slices.map(slice => slice.commit)).toEqual(['74d2ca9', 'a532fa1', 'd5a90b8', '16783d1', '16783d1', '6e33861', '0339448', 'd47fdde']);
    for (const slice of replay.slices) {
      const commands = slice.events.filter(event => event.t === 'command');
      expect(commands.length).toBe(slice.stats.commands);
      expect(slice.events.filter(event => event.t === 'message').length).toBe(slice.stats.messages);
      expect(slice.brief, `${slice.id} brief`).toBeTruthy();
      for (const event of commands) {
        expect(event.cmd.length).toBeLessThanOrEqual(220);
        expect(event.tail.length).toBeLessThanOrEqual(3);
      }
    }
    expect(replay.totals.commands).toBe(replay.slices.reduce((sum, slice) => sum + slice.stats.commands, 0));
    expect(replay.slices.at(-1)!.outcome).toBe('usage-limit');
    expect(replay.slices.find(slice => slice.id === 'slice4')!.outcome).toBe('interrupted');
  });
});

describe('Codex replay sanitiser', () => {
  const home = '/Users/someone';
  const sanitise = createSanitiser({ home, secrets: ['exact-secret-value-123'], labels: [{ value: 'somechannel', label: '[channel A]' }] });

  it('scrubs key shapes, headers, assignments and exact values', () => {
    const groq = `gsk_${'A1b2'.repeat(12)}`;
    const google = `AIza${'Xy9_'.repeat(9)}`;
    const text = [
      `key ${groq} and ${google}`,
      `Authorization: Bearer ${'abc123'.repeat(5)}`,
      `LLM_API_KEY=${'q'.repeat(30)}`,
      `{"access_token":"${'z9'.repeat(15)}","refresh_token":"r"}`,
      'callback?code=abcdef123456&scope=chat',
      'the exact-secret-value-123 is here, so is EXACT-SECRET-VALUE-123',
      'hello somechannel!',
      `digest ${'ab12'.repeat(10)}`,
    ].join('\n');
    const clean = sanitise(text);
    for (const leak of [groq, google, 'abc123abc123', 'q'.repeat(30), 'z9z9z9', 'abcdef123456', 'exact-secret', 'EXACT-SECRET', 'somechannel', 'ab12ab12']) expect(clean).not.toContain(leak);
    expect(clean).toContain('Bearer [redacted]');
    expect(clean).toContain('LLM_API_KEY=[redacted]');
    expect(clean).toContain('[channel A]');
  });

  it('keeps template code, uuids, set markers and ordinary words', () => {
    const text = "headers: { authorization: `Bearer ${token}` } session 01a173c5-a449-71a1-abff-67e5a794156b GEMINI_API_KEY=<set> src/puzzle/forge-pack.test.ts";
    expect(sanitise(text)).toBe(text);
  });

  it('rewrites home paths to ~ and drops email addresses', () => {
    expect(sanitise('/Users/someone/twinclue/DECISIONS.md and /home/other/x')).toBe('~/twinclue/DECISIONS.md and ~/x');
    expect(sanitise('mail dev.person+tag@example.co.uk now')).toBe('mail [email removed] now');
  });
});

describe('Codex log parsing', () => {
  const sanitise = createSanitiser({ home: '/Users/someone' });
  it('unwraps shell commands and classifies them by what runs, not by heredoc contents', () => {
    expect(unwrapCommand("/bin/zsh -lc 'npm test'")).toBe('npm test');
    expect(unwrapCommand('/bin/zsh -lc "sed -n \'1,20p\' src/a.ts"')).toBe("sed -n '1,20p' src/a.ts");
    expect(commandKinds('npm test && npm run typecheck && npm run build')).toEqual(['test', 'typecheck', 'build']);
    expect(commandKinds("cat > src/a.test.ts <<'EOF'\nimport { it } from 'vitest';\nEOF")).toEqual(['edit']);
    expect(commandKinds("python3 - <<'PY'\nprint('vitest')\nPY\nnpx vitest run src/a.test.ts")).toEqual(['test']);
    expect(commandKinds('npm run forge')).toEqual(['pipeline']);
  });

  it('reads the vitest summary line', () => {
    expect(parseTestSummary(' Test Files  3 failed | 9 passed (12)\n      Tests  3 failed | 32 passed (35)\n')).toEqual({ passed: 32, failed: 3, total: 35 });
    expect(parseTestSummary('\u001b[2m      Tests \u001b[22m 6 passed (6)')).toEqual({ passed: 6, failed: 0, total: 6 });
    expect(parseTestSummary('no summary')).toBeUndefined();
  });

  it('turns an exec log into events and stats, skipping stderr bodies and collapsing repeated errors', () => {
    const lines = [
      { type: 'thread.started', thread_id: 't1' },
      { type: 'item.completed', item: { id: 'm1', type: 'agent_message', text: 'Reading /Users/someone/repo/SPEC.md first.' } },
      { type: 'item.started', item: { id: 'c1', type: 'command_execution', command: "/bin/zsh -lc 'npm test'" } },
      { type: 'item.completed', item: { id: 'c1', type: 'command_execution', command: "/bin/zsh -lc 'npm test'", exit_code: 0, aggregated_output: ' Tests  4 passed (4)\n' } },
      { type: 'item.completed', item: { id: 'f1', type: 'file_change', changes: [{ path: '/Users/someone/repo/src/a.ts', kind: 'update' }] } },
      { type: 'item.completed', item: { id: 'f2', type: 'file_change', changes: [{ path: '/Users/someone/repo/src/b.ts', kind: 'add' }] } },
      { type: 'item.started', item: { id: 'c2', type: 'command_execution', command: "/bin/zsh -lc 'npm run forge'" } },
      { type: 'turn.completed', usage: { input_tokens: 10, cached_input_tokens: 5, output_tokens: 3, reasoning_output_tokens: 1 } },
    ].map(line => JSON.stringify(line));
    const stderr = ['2026-10-25T16:18:30.624416Z ERROR codex_core::tools::router: error=apply_patch verification failed', 'const leaked = "file body";',
      '2026-10-25T16:18:31.000000Z ERROR codex_core::tools::router: error=apply_patch verification failed'];
    const parsed = parseExecLog([...lines.slice(0, 4), ...stderr, ...lines.slice(4)].join('\n'), sanitise, '/Users/someone/repo');
    expect(parsed.threadId).toBe('t1');
    expect(parsed.events.map(event => event.t)).toEqual(['message', 'command', 'error', 'edit', 'command']);
    expect(parsed.events[0]).toEqual({ t: 'message', text: 'Reading ~/repo/SPEC.md first.' });
    expect(parsed.events[2]).toMatchObject({ t: 'error', repeats: 2 });
    expect(parsed.events[3]).toEqual({ t: 'edit', files: [{ path: 'src/a.ts', kind: 'update' }, { path: 'src/b.ts', kind: 'add' }] });
    expect(JSON.stringify(parsed)).not.toContain('file body');
    expect(parsed.stats).toMatchObject({ commands: 2, commandsUnfinished: 1, testRuns: 1, testRunsGreen: 1, filesTouched: 2, lastFullRun: { passed: 4, failed: 0, total: 4 } });
    expect(parsed.usage).toEqual({ input: 10, cachedInput: 5, output: 3, reasoning: 1 });
  });

  it('splits the rollout into turns with their brief, timing, compactions and running token total', () => {
    const rows = [
      { timestamp: '2026-10-25T15:00:00Z', type: 'turn_context', payload: { model: 'm' } },
      { timestamp: '2026-10-25T15:00:01Z', type: 'event_msg', payload: { type: 'task_started' } },
      { timestamp: '2026-10-25T15:00:02Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ text: '# AGENTS.md instructions' }] } },
      { timestamp: '2026-10-25T15:00:03Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ text: 'Slice 1, the game core.' }] } },
      { timestamp: '2026-10-25T15:01:00Z', type: 'compacted', payload: {} },
      { timestamp: '2026-10-25T15:02:00Z', type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 9, cached_input_tokens: 4, output_tokens: 2, reasoning_output_tokens: 1 } } } },
      { timestamp: '2026-10-25T15:03:00Z', type: 'event_msg', payload: { type: 'task_complete' } },
      { timestamp: '2026-10-25T16:00:00Z', type: 'event_msg', payload: { type: 'thread_settings_applied' } },
    ].map(row => JSON.stringify(row)).join('\n');
    const { model, turns } = parseRollout(rows);
    expect(model).toBe('m');
    expect(turns).toEqual([{ startedAt: '2026-10-25T15:00:01Z', endedAt: '2026-10-25T15:03:00Z', brief: 'Slice 1, the game core.', compactions: 1, usageTotal: { input: 9, cachedInput: 4, output: 2, reasoning: 1 } }]);
  });
});
