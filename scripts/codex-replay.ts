/**
 * Builds docs/codex/replay.json from the raw Codex logs of the Twinclue build session.
 *
 *   npm run codex:replay -- [--logs <dir with twinclue-codex-slice*.jsonl>] [--rollout <session rollout .jsonl>]
 *
 * The exec logs (`codex exec --json`, one per slice) give messages, commands, file changes and tests. The session
 * rollout in ~/.codex/sessions adds what they lack: each brief, timestamps and the running token total.
 * Everything is sanitised: secrets from .env and data/tokens.json are scrubbed by value, common key shapes by
 * pattern, home paths become ~ and email addresses are dropped. Secret values are never printed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseEnv } from 'dotenv';
import {
  createSanitiser, parseExecLog, parseRollout, subtractUsage,
  type CommitInfo, type Replay, type ReplaySlice, type SliceMeta, type Usage,
} from '../src/codex/replay.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SESSION_ID = '01a173c5-a449-71a1-abff-67e5a794156b';

const SLICES: SliceMeta[] = [
  { id: 'slice1', label: 'Slice 1', title: 'Game core', commit: '74d2ca9' },
  { id: 'slice2', label: 'Slice 2a and 2b', title: 'A fairer puzzle pack, and Twitch behind interfaces', commit: 'a532fa1' },
  { id: 'slice3', label: 'Slice 3a and 3b', title: 'Blind audit, overlays, control panel and demo', commit: 'd5a90b8' },
  { id: 'slice4', label: 'Slice 4, first run', title: 'Audit rounds and the lower-third overlays', commit: '16783d1',
    note: 'The run was interrupted mid-audit and resumed the next morning in the same session. Both runs went into one commit.' },
  { id: 'slice4b', label: 'Slice 4, resumed', title: 'Generate and filter, then finish the overlays', commit: '16783d1' },
  { id: 'slice5', label: 'Slice 5', title: 'Audit v2, and overlays that teach the game', commit: '6e33861' },
  { id: 'slice5b', label: 'Slice 5b', title: 'Lock-in voting and the Puzzle Forge', commit: '0339448' },
  { id: 'slice5c', label: 'Slice 5c', title: 'Forge quality and a paced audit', commit: 'd47fdde',
    note: 'The turn stopped at the Codex plan usage limit, just after a green test run. The maintainer committed it as d47fdde.' },
];

/** Model ids, the public API endpoint and numeric tuning: product names and settings, not secrets. Codex's reports quote them. */
const PUBLIC_CONFIG = new Set(['LLM_BASE_URL', 'LLM_MODEL', 'AUDIT_MODEL', 'AUDIT_MODELS', 'FACT_MODEL', 'FACT_MODELS', 'AUDIT_BATCH', 'NODE_ENV', 'PORT', 'HOST']);
const LABELS: Record<string, string> = { CHANNEL_A: '[channel A]', CHANNEL_B: '[channel B]', BOT_LOGIN: '[bot]', PUBLIC_URL: '[public url]' };

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function findRollout(): string | undefined {
  const root = join(homedir(), '.codex', 'sessions');
  if (!existsSync(root)) return undefined;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) stack.push(path);
      else if (name.includes(SESSION_ID) && name.endsWith('.jsonl')) return path;
    }
  }
  return undefined;
}

/** Collects secret values without ever printing them. */
function secretValues(): { secrets: string[]; labels: Array<{ value: string; label: string }> } {
  const secrets: string[] = [];
  const labels: Array<{ value: string; label: string }> = [];
  const envPath = join(REPO, '.env');
  if (existsSync(envPath)) {
    for (const [key, value] of Object.entries(parseEnv(readFileSync(envPath)))) {
      if (!value || PUBLIC_CONFIG.has(key) || /^\d+(\.\d+)?$/.test(value)) continue;
      if (LABELS[key]) labels.push({ value, label: LABELS[key]! });
      else secrets.push(value);
    }
  }
  const tokensPath = join(REPO, 'data', 'tokens.json');
  if (existsSync(tokensPath)) {
    const walk = (node: unknown, key = ''): void => {
      if (typeof node === 'string') { if (key !== 'scope' && key !== 'token_type') secrets.push(node); return; }
      if (Array.isArray(node)) { for (const child of node) walk(child, key); return; }
      if (node && typeof node === 'object') for (const [child, value] of Object.entries(node)) walk(value, child);
    };
    walk(JSON.parse(readFileSync(tokensPath, 'utf8')));
  }
  return { secrets, labels };
}

function commitInfo(sha: string): CommitInfo | undefined {
  try {
    const [subject, date] = execFileSync('git', ['show', '-s', '--format=%s%x1f%cI', sha], { cwd: REPO, encoding: 'utf8' }).trim().split('\x1f');
    const stat = execFileSync('git', ['show', '--shortstat', '--format=', sha], { cwd: REPO, encoding: 'utf8' });
    const number = (pattern: RegExp) => Number(stat.match(pattern)?.[1] ?? 0);
    return { sha, subject: subject!, date: date!, filesChanged: number(/(\d+) files? changed/), insertions: number(/(\d+) insertions?/), deletions: number(/(\d+) deletions?/) };
  } catch { return undefined; }
}

const addUsage = (a: Usage, b: Usage | undefined): Usage => (b ? { input: a.input + b.input, cachedInput: a.cachedInput + b.cachedInput, output: a.output + b.output, reasoning: a.reasoning + b.reasoning } : a);

function main(): void {
  const logsDir = resolve(arg('logs') ?? join(REPO, '..'));
  const rolloutPath = arg('rollout') ?? findRollout();
  const out = resolve(arg('out') ?? join(REPO, 'docs', 'codex', 'replay.json'));
  const { secrets, labels } = secretValues();
  const sanitise = createSanitiser({ home: homedir(), secrets, labels });
  const rollout = rolloutPath && existsSync(rolloutPath) ? parseRollout(readFileSync(rolloutPath, 'utf8')) : undefined;
  if (rollout && rollout.turns.length !== SLICES.length) throw new Error(`Expected ${SLICES.length} turns in the rollout, found ${rollout.turns.length}.`);

  const slices: ReplaySlice[] = [];
  let previousExecUsage: Usage | undefined;
  for (const [index, meta] of SLICES.entries()) {
    const logPath = join(logsDir, `twinclue-codex-${meta.id}.jsonl`);
    const parsed = parseExecLog(readFileSync(logPath, 'utf8'), sanitise, REPO);
    if (parsed.threadId && parsed.threadId !== SESSION_ID) throw new Error(`${meta.id} belongs to another session.`);
    const turn = rollout?.turns[index];
    const before = index > 0 ? rollout?.turns[index - 1]?.usageTotal : undefined;
    const usage = turn?.usageTotal ? subtractUsage(turn.usageTotal, before) : parsed.usage ? subtractUsage(parsed.usage, previousExecUsage) : undefined;
    if (parsed.usage) previousExecUsage = parsed.usage;
    const outcome: ReplaySlice['outcome'] = parsed.failed || turn?.error ? 'usage-limit' : parsed.usage ? 'completed' : 'interrupted';
    const slice: ReplaySlice = { ...meta, commitInfo: commitInfo(meta.commit), outcome, stats: parsed.stats, events: parsed.events };
    if (turn) {
      slice.startedAt = turn.startedAt;
      slice.endedAt = turn.endedAt;
      slice.durationSeconds = Math.round((Date.parse(turn.endedAt) - Date.parse(turn.startedAt)) / 1000);
      slice.compactions = turn.compactions;
      if (turn.brief) slice.brief = sanitise(turn.brief);
    }
    if (usage) slice.usage = usage;
    slices.push(slice);
  }

  const replay: Replay = {
    version: 1,
    sessionId: SESSION_ID,
    model: rollout?.model,
    cliVersion: rollout?.cliVersion,
    source: 'Generated by scripts/codex-replay.ts from the codex exec --json log of each slice and the session rollout. Sanitised: secrets, home paths and email addresses removed; command output cut to its last lines.',
    totals: {
      durationSeconds: slices.reduce((sum, slice) => sum + (slice.durationSeconds ?? 0), 0),
      commands: slices.reduce((sum, slice) => sum + slice.stats.commands, 0),
      commandsFailed: slices.reduce((sum, slice) => sum + slice.stats.commandsFailed, 0),
      fileEdits: slices.reduce((sum, slice) => sum + slice.stats.fileEdits, 0),
      testRuns: slices.reduce((sum, slice) => sum + slice.stats.testRuns, 0),
      messages: slices.reduce((sum, slice) => sum + slice.stats.messages, 0),
      usage: slices.reduce<Usage>((sum, slice) => addUsage(sum, slice.usage), { input: 0, cachedInput: 0, output: 0, reasoning: 0 }),
    },
    slices,
  };

  const json = `${JSON.stringify(replay, null, 1)}\n`;
  // Belt and braces: refuse to write if any known secret value survived. Only the count is reported.
  const lower = json.toLowerCase();
  const leaked = [...secrets, ...labels.map(entry => entry.value)].filter(value => value.length >= 6 && lower.includes(value.toLowerCase())).length;
  if (leaked) throw new Error(`${leaked} secret value(s) survived sanitising; nothing was written.`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, json);
  console.log(`Wrote ${out.replace(REPO + '/', '')} (${Math.round(json.length / 1024)} KB), ${slices.length} slices, ${secrets.length + labels.length} secret values scrubbed by value.`);
  for (const slice of slices) {
    const s = slice.stats;
    console.log(`${slice.id.padEnd(8)} ${String(Math.round((slice.durationSeconds ?? 0) / 60)).padStart(3)} min  ${String(s.commands).padStart(3)} commands (${s.commandsFailed} non-zero)  ${String(s.testRuns).padStart(2)} test runs, last npm test ${s.lastFullRun ? `${s.lastFullRun.passed}/${s.lastFullRun.total}` : '-'}  ${s.filesTouched} files  ${s.messages} messages  ${slice.outcome}`);
  }
}

main();
