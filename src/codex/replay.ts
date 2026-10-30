/**
 * Turns the raw `codex exec --json` logs of the Twinclue build session into a compact, sanitised replay.
 * Pure functions only: scripts/codex-replay.ts does the file reading and writing.
 */

export interface SanitiseOptions {
  /** Absolute home directory, rewritten to `~`. */
  home: string;
  /** Exact values that must never appear (keys, tokens, secrets), replaced case-insensitively. */
  secrets?: string[];
  /** Exact values replaced with a readable label, such as channel names. */
  labels?: Array<{ value: string; label: string }>;
}

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

/** Shapes that are secrets wherever they appear. Order matters: specific prefixes before generic blobs. */
const SECRET_SHAPES: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, '[private key]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '[jwt]'],
  [/\bgsk_[A-Za-z0-9]{10,}/g, '[groq key]'],
  [/\bAIza[0-9A-Za-z_-]{20,}/g, '[google key]'],
  [/\bsk-(?:proj-|ant-|or-)?[A-Za-z0-9_-]{16,}/g, '[api key]'],
  [/\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/g, '[github token]'],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/g, '[slack token]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[aws key]'],
  [/\boauth:[a-z0-9]{20,}/gi, 'oauth:[redacted]'],
  [/\b(Bearer|Basic)\s+(?!\$\{)[A-Za-z0-9._~+/=-]{8,}/g, '$1 [redacted]'],
  // NAME=value where the name says it holds a secret (.env lines, shell exports, logged config).
  [/\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CLIENT_ID|CREDENTIALS?|COOKIE|AUTH))(\s*=\s*)(?!<set>|set\b|\[)(["']?)[^\s"'`;&|)]+\3/g, '$1$2[redacted]'],
  // "access_token": "..." and friends, in JSON, JS objects or form bodies.
  [/(["']?)(access_token|refresh_token|id_token|client_secret|api_key|apiKey|apikey|password|secret|authorization)\1(\s*[:=]\s*)(["'])(?!\$\{)[^"'\n]{6,}\4/gi, '$1$2$1$3$4[redacted]$4'],
  [/([?&](?:code|access_token|refresh_token|client_secret|key|token|state)=)(?!\$\{)[^&\s"'#`)]+/gi, '$1[redacted]'],
];

function count(text: string, pattern: RegExp): number { return (text.match(pattern) ?? []).length; }

/** Long opaque runs (hex digests, base64 tokens, Twitch-style lowercase tokens) that carry no meaning for a reader. */
function scrubBlobs(text: string): string {
  // A run is opaque when one unbroken piece of it is long and mixes letters and digits. UUIDs, kebab-case ids and
  // paths are made of short pieces, so the session id and file names survive.
  const opaque = (piece: string) => piece.length >= 24 && count(piece, /[0-9]/g) >= 3 && count(piece, /[A-Za-z]/g) >= 3;
  return text
    .replace(/\b[0-9a-f]{32,}\b/gi, '[hex]')
    .replace(/[A-Za-z0-9+/_=.-]{24,}/g, run => (run.split(/[-_/.]/).some(opaque) ? '[blob]' : run))
    .replace(/\b[a-z0-9]{24,}\b/g, run => (count(run, /[0-9]/g) >= 4 && count(run, /[a-z]/g) >= 4 ? '[token]' : run));
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function createSanitiser(options: SanitiseOptions): (text: string) => string {
  const exact = [...new Set((options.secrets ?? []).filter(value => value.length >= 6))].sort((a, b) => b.length - a.length);
  const exactPattern = exact.length ? new RegExp(exact.map(escapeRegExp).join('|'), 'gi') : undefined;
  const labels = (options.labels ?? []).filter(entry => entry.value.length >= 3).sort((a, b) => b.value.length - a.value.length);
  const home = options.home.replace(/\/+$/, '');
  return (input: string) => {
    let text = input.replace(ANSI, '').replace(/\r/g, '');
    if (exactPattern) text = text.replace(exactPattern, '[redacted]');
    for (const { value, label } of labels) text = text.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, 'gi'), label);
    for (const [pattern, replacement] of SECRET_SHAPES) text = text.replace(pattern, replacement);
    if (home) text = text.split(home).join('~');
    text = text.replace(/\/(?:Users|home)\/[^/\s"'`)]+/g, '~');
    text = text.replace(EMAIL, '[email removed]');
    return scrubBlobs(text);
  };
}

export type CommandKind = 'test' | 'typecheck' | 'build' | 'pipeline' | 'demo' | 'git' | 'read' | 'edit' | 'other';
export interface TestSummary { passed: number; failed: number; total: number }
export type ReplayEvent =
  | { t: 'message'; text: string }
  | { t: 'command'; cmd: string; exit: number | null; kinds: CommandKind[]; tail: string[]; tests?: TestSummary }
  | { t: 'edit'; files: Array<{ path: string; kind: string }> }
  | { t: 'search'; query: string }
  | { t: 'error'; text: string; repeats?: number };

export interface Usage { input: number; cachedInput: number; output: number; reasoning: number }
export interface SliceStats {
  messages: number; commands: number; commandsFailed: number; commandsUnfinished: number;
  filesTouched: number; fileEdits: number; testRuns: number; testRunsGreen: number;
  /** The last `npm test` (whole suite) of the turn, as vitest reported it. */
  lastFullRun: TestSummary | null;
  typecheckRuns: number; buildRuns: number; webSearches: number; errors: number;
}
export interface ParsedLog {
  threadId?: string; events: ReplayEvent[]; stats: SliceStats; usage?: Usage; failed?: string; skippedLines: number;
}

/** Strips the `/bin/zsh -lc '...'` wrapper Codex puts around every command. */
export function unwrapCommand(raw: string): string {
  const match = raw.match(/^\/bin\/(?:zsh|bash|sh) -l?c ([\s\S]*)$/);
  let inner = match ? match[1]! : raw;
  if (inner.length >= 2 && inner.startsWith("'") && inner.endsWith("'")) inner = inner.slice(1, -1);
  else if (inner.length >= 2 && inner.startsWith('"') && inner.endsWith('"')) inner = inner.slice(1, -1).replace(/\\(["\\$`])/g, '$1');
  return inner;
}

/** Heredoc bodies are file contents (a test file imports vitest), so they never decide what a command does. */
function withoutHeredocs(cmd: string): string {
  return cmd.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, '<<$2');
}

export function commandKinds(raw: string): CommandKind[] {
  const cmd = withoutHeredocs(raw);
  const kinds: CommandKind[] = [];
  if (/\bvitest\b|\bnpm (?:run )?test\b/.test(cmd)) kinds.push('test');
  if (/\bnpm run typecheck\b|\btsc --noEmit\b/.test(cmd)) kinds.push('typecheck');
  if (/\bnpm run build\b/.test(cmd)) kinds.push('build');
  if (/\bnpm run (?:audit:pack|generate:pack|forge)\b/.test(cmd)) kinds.push('pipeline');
  if (/\bnpm run demo\b/.test(cmd)) kinds.push('demo');
  if (kinds.length) return kinds;
  if (/^\s*git\b/.test(cmd)) return ['git'];
  if (/^\s*(?:python3|node)\b[\s\S]*(?:writeFile|write_text|\.replace\(|open\([^)]*['"]w)/.test(raw) || /^\s*cat >>? /.test(cmd)) return ['edit'];
  if (/^\s*(?:cat|sed -n|rg|ls|head|tail|nl|grep|find|wc|du|pwd)\b/.test(cmd)) return ['read'];
  return ['other'];
}

/** Reads vitest's closing "Tests  3 failed | 32 passed (35)" line. */
export function parseTestSummary(output: string): TestSummary | undefined {
  const lines = output.replace(ANSI, '').split('\n').filter(line => /^\s*Tests\s+\d/.test(line));
  const line = lines.at(-1);
  if (!line) return undefined;
  const failed = Number(line.match(/(\d+) failed/)?.[1] ?? 0);
  const passed = Number(line.match(/(\d+) passed/)?.[1] ?? 0);
  const total = Number(line.match(/\((\d+)\)/)?.[1] ?? passed + failed);
  return { passed, failed, total };
}

function oneLine(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

function tailOf(output: string, lines = 3, width = 160): string[] {
  return output.replace(ANSI, '').split('\n').map(line => line.trimEnd()).filter(line => line.trim() && !/^[⎯\s]+$/.test(line)).slice(-lines).map(line => oneLine(line, width));
}

interface CodexItem {
  id?: string; type?: string; text?: string; command?: string; aggregated_output?: string; exit_code?: number | null;
  status?: string; changes?: Array<{ path?: string; kind?: string }>; query?: string;
}
interface CodexEvent {
  type?: string; thread_id?: string; item?: CodexItem; message?: string; error?: { message?: string };
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number; reasoning_output_tokens?: number };
}

/**
 * Parses one `codex exec --json` log. Lines that are not JSON are stderr from Codex itself: only the first line of each
 * ERROR record is kept (sanitised); the file content that follows it is skipped.
 */
export function parseExecLog(raw: string, sanitise: (text: string) => string, repoRoot: string): ParsedLog {
  const events: ReplayEvent[] = [];
  const commands = new Map<string, Extract<ReplayEvent, { t: 'command' }>>();
  const touched = new Set<string>();
  let threadId: string | undefined;
  let usage: Usage | undefined;
  let failed: string | undefined;
  let skippedLines = 0;
  let fileEdits = 0;
  /** Codex repeats some stderr records many times (one per orphaned tool call after a resume): keep the first, count the rest. */
  const seenErrors = new Map<string, Extract<ReplayEvent, { t: 'error' }>>();
  const pushError = (text: string) => {
    const seen = seenErrors.get(text);
    if (seen) { seen.repeats = (seen.repeats ?? 1) + 1; return; }
    const entry: Extract<ReplayEvent, { t: 'error' }> = { t: 'error', text };
    seenErrors.set(text, entry);
    events.push(entry);
  };
  const relative = (path: string) => (path.startsWith(`${repoRoot}/`) ? path.slice(repoRoot.length + 1) : path);

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let event: CodexEvent;
    try { event = JSON.parse(line) as CodexEvent; } catch {
      const error = line.match(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s+ERROR\s+(\S+?):?\s+(.*)$/);
      if (error) pushError(sanitise(oneLine(`${error[1]}: ${error[2]}`, 200)));
      else skippedLines++;
      continue;
    }
    const item = event.item;
    if (event.type === 'thread.started') threadId = event.thread_id;
    else if (event.type === 'turn.completed' && event.usage) {
      usage = { input: event.usage.input_tokens ?? 0, cachedInput: event.usage.cached_input_tokens ?? 0, output: event.usage.output_tokens ?? 0, reasoning: event.usage.reasoning_output_tokens ?? 0 };
    } else if (event.type === 'turn.failed') {
      failed = sanitise(oneLine(event.error?.message ?? 'turn failed', 200));
      pushError(failed);
    } else if (event.type === 'error') pushError(sanitise(oneLine(event.message ?? 'error', 200)));
    else if (item?.type === 'command_execution' && item.id && (event.type === 'item.started' || event.type === 'item.completed')) {
      let entry = commands.get(item.id);
      if (!entry) {
        const cmd = unwrapCommand(item.command ?? '');
        entry = { t: 'command', cmd: sanitise(oneLine(cmd, 220)), exit: null, kinds: commandKinds(cmd), tail: [] };
        commands.set(item.id, entry);
        events.push(entry);
      }
      if (event.type === 'item.completed') {
        const output = item.aggregated_output ?? '';
        entry.exit = typeof item.exit_code === 'number' ? item.exit_code : null;
        entry.tail = tailOf(output).map(sanitise);
        const tests = entry.kinds.includes('test') ? parseTestSummary(output) : undefined;
        if (tests) entry.tests = tests;
      }
    } else if (event.type === 'item.completed' && item?.type === 'agent_message' && item.text) {
      events.push({ t: 'message', text: sanitise(item.text.trim()) });
    } else if (event.type === 'item.completed' && item?.type === 'file_change') {
      const files = (item.changes ?? []).map(change => ({ path: sanitise(relative(change.path ?? '')), kind: change.kind ?? 'update' }));
      fileEdits += files.length;
      for (const file of files) touched.add(file.path);
      const previous = events.at(-1);
      // Back-to-back edits form one group; a file edited twice in a row is listed once, with its first kind (add stays add).
      const group = previous?.t === 'edit' ? previous : undefined;
      const fresh = files.filter((file, index) => ![...(group?.files ?? []), ...files.slice(0, index)].some(other => other.path === file.path));
      if (group) group.files.push(...fresh);
      else events.push({ t: 'edit', files: fresh });
    } else if (event.type === 'item.completed' && item?.type === 'web_search' && item.query) {
      events.push({ t: 'search', query: sanitise(oneLine(item.query, 160)) });
    }
  }

  const all = [...commands.values()];
  const testRuns = all.filter(command => command.tests);
  const lastFull = testRuns.filter(command => /\bnpm (?:run )?test\b/.test(command.cmd)).at(-1)?.tests;
  const stats: SliceStats = {
    messages: events.filter(event => event.t === 'message').length,
    commands: all.length,
    commandsFailed: all.filter(command => command.exit !== null && command.exit !== 0).length,
    commandsUnfinished: all.filter(command => command.exit === null).length,
    filesTouched: touched.size,
    fileEdits,
    testRuns: all.filter(command => command.kinds.includes('test')).length,
    testRunsGreen: testRuns.filter(command => command.tests!.failed === 0 && command.tests!.passed > 0).length,
    lastFullRun: lastFull ?? null,
    typecheckRuns: all.filter(command => command.kinds.includes('typecheck')).length,
    buildRuns: all.filter(command => command.kinds.includes('build')).length,
    webSearches: events.filter(event => event.t === 'search').length,
    errors: events.filter(event => event.t === 'error').length,
  };
  return { threadId, events, stats, usage, failed, skippedLines };
}

export interface RolloutTurn {
  startedAt: string; endedAt: string; brief?: string; usageTotal?: Usage; compactions: number; error?: string;
}
interface RolloutLine { timestamp?: string; type?: string; payload?: Record<string, unknown> }

function usageFrom(info: unknown): Usage | undefined {
  const total = (info as { total_token_usage?: Record<string, number> } | null)?.total_token_usage;
  if (!total) return undefined;
  return { input: total.input_tokens ?? 0, cachedInput: total.cached_input_tokens ?? 0, output: total.output_tokens ?? 0, reasoning: total.reasoning_output_tokens ?? 0 };
}

/**
 * Splits the session rollout into turns. It carries what the exec logs do not: the brief each turn was given,
 * timestamps, context compactions and the running token total. Reasoning and tool payloads are never read.
 */
export function parseRollout(raw: string): { model?: string; cliVersion?: string; turns: RolloutTurn[] } {
  const turns: Array<RolloutTurn & { done?: boolean }> = [];
  let model: string | undefined;
  let cliVersion: string | undefined;
  let current: (RolloutTurn & { done?: boolean }) | undefined;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry: RolloutLine;
    try { entry = JSON.parse(line) as RolloutLine; } catch { continue; }
    const payload = entry.payload ?? {};
    const at = entry.timestamp;
    if (entry.type === 'session_meta' && typeof payload.cli_version === 'string') cliVersion = payload.cli_version;
    if (entry.type === 'turn_context' && typeof payload.model === 'string') model = payload.model;
    if (entry.type === 'event_msg' && payload.type === 'task_started' && at) {
      current = { startedAt: at, endedAt: at, compactions: 0 };
      turns.push(current);
      continue;
    }
    if (!current || !at || current.done) continue;
    // Thread bookkeeping written when a turn is resumed is not work, so it never extends the previous turn.
    if (entry.type === 'response_item' || entry.type === 'compacted' || (entry.type === 'event_msg' && payload.type !== 'thread_settings_applied')) current.endedAt = at;
    if (entry.type === 'compacted') current.compactions++;
    if (entry.type === 'event_msg' && payload.type === 'token_count') current.usageTotal = usageFrom(payload.info) ?? current.usageTotal;
    if (entry.type === 'event_msg' && payload.type === 'task_complete') {
      const error = (payload.error as { message?: string } | undefined)?.message;
      if (error) current.error = error;
      current.done = true;
    }
    if (entry.type === 'response_item' && payload.type === 'message' && payload.role === 'user' && current.brief === undefined) {
      const text = ((payload.content as Array<{ text?: string }> | undefined) ?? []).map(part => part.text ?? '').join('').trim();
      // The session's first turn also carries AGENTS.md and environment context as user messages; the brief is the rest.
      if (text && !text.startsWith('# AGENTS.md') && !text.startsWith('<environment_context>')) current.brief = text;
    }
  }
  return { model, cliVersion, turns: turns.map(({ done: _done, ...turn }) => turn) };
}

export function subtractUsage(total: Usage, before: Usage | undefined): Usage {
  if (!before) return total;
  return { input: total.input - before.input, cachedInput: total.cachedInput - before.cachedInput, output: total.output - before.output, reasoning: total.reasoning - before.reasoning };
}

export interface SliceMeta { id: string; label: string; title: string; commit: string; note?: string }
export interface CommitInfo { sha: string; subject: string; date: string; filesChanged: number; insertions: number; deletions: number }
export interface ReplaySlice extends SliceMeta {
  commitInfo?: CommitInfo; startedAt?: string; endedAt?: string; durationSeconds?: number; compactions?: number;
  outcome: 'completed' | 'interrupted' | 'usage-limit'; brief?: string; usage?: Usage; stats: SliceStats; events: ReplayEvent[];
}
export interface Replay {
  version: 1; sessionId: string; model?: string; cliVersion?: string; source: string;
  totals: { durationSeconds: number; commands: number; commandsFailed: number; fileEdits: number; testRuns: number; messages: number; usage: Usage };
  slices: ReplaySlice[];
}
