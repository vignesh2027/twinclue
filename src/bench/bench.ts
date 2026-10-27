// npm run bench: drives the real pipeline in this process (EventSub socket client, parser, command router,
// controller, session snapshots, coalesced overlay frames, ws server) with traffic from a child process that
// plays Twitch and the overlay browser sources. It measures our pipeline, not Twitch's delivery.
import { fork } from 'node:child_process';
import { cpus, totalmem, platform, release, arch, tmpdir, loadavg } from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import Fastify from 'fastify';
import { GameController } from '../app/controller.js';
import { registerWebRoutes, overlayKeys } from '../app/web.js';
import { createChatRouter } from '../app/router.js';
import { Session, SessionStore } from '../game/session.js';
import { Metrics } from '../obs/metrics.js';
import { EventSubClient } from '../twitch/eventsub.js';
import { loadFactVocabularies } from '../puzzle/vocabulary-source.js';
import type { Puzzle } from '../puzzle/types.js';
import type { PhaseReport, PhaseSpec } from './load.js';

const QUICK = process.argv.includes('--quick');
const startLoad = loadavg()[0]!.toFixed(1);
const A = '1001', B = '2002', BOT = '3003';
const ADMIN = 'bench-admin-token-not-a-secret-0000';
const decoys = ['China', 'South Korea', 'Thailand', 'Vietnam', 'Indonesia', 'Philippines', 'Mongolia', 'Nepal', 'India', 'Australia', 'Canada'];
const puzzle: Puzzle = { id: 'bench-japan', category: 'geography', difficulty: 'medium', answer: 'Japan', aliases: [], sourceTable: 'countries',
  halfA: 'This country is an island nation in Asia.', halfB: 'This country drives on the left and hosted the Summer Olympics.',
  halfAAlsoFits: ['Philippines', 'Indonesia'], halfBAlsoFits: ['Australia', 'United Kingdom'] };

const common = { channelA: A, channelB: B, answer: 'Japan', decoys };
// The quick run keeps the full rates but shortens both phases; only the full run rewrites docs/BENCHMARKS.md.
const phases: PhaseSpec[] = QUICK ? [
  { name: 'sustained', rate: 2_000, seconds: 12, firstChatter: 1, chatters: 20_000, changes: 2_000, rapidChanges: 800, sharedCopies: 800, plainChat: 400, ...common },
  { name: 'burst', rate: 10_000, seconds: 8, firstChatter: 200_001, chatters: 64_000, changes: 6_400, rapidChanges: 1_600, sharedCopies: 4_800, plainChat: 3_200, ...common },
] : [
  { name: 'sustained', rate: 2_000, seconds: 60, firstChatter: 1, chatters: 100_000, changes: 10_000, rapidChanges: 4_000, sharedCopies: 4_000, plainChat: 2_000, ...common },
  { name: 'burst', rate: 10_000, seconds: 10, firstChatter: 200_001, chatters: 80_000, changes: 8_000, rapidChanges: 2_000, sharedCopies: 6_000, plainChat: 4_000, ...common },
];

interface Result { spec: PhaseSpec; report: PhaseReport; exact: boolean; mismatches: string[]; serverCpuMs: number; peakRssMb: number; loopDelayP99Ms: number; loopDelayMaxMs: number;
  serverLatency: { p50: number; p95: number; p99: number }; rateLimited: number; shedTicker: number; shedFrames: number; duplicatesDropped: number; votesCounted: number;
  snapshots: number; snapshotBlockingP50Ms: number; snapshotBlockingMaxMs: number; snapshotTotalMaxMs: number }
interface Run { load: number; results: Result[] }

/** Event loop lag: how late a 10 ms timer fires. Simple and robust on a busy machine. */
function lagSampler(): { stop: () => { p99: number; max: number } } {
  const lags: number[] = [];
  let expected = performance.now() + 10;
  const timer = setInterval(() => { const now = performance.now(); lags.push(Math.max(0, now - expected)); expected = now + 10; }, 10);
  return { stop: () => { clearInterval(timer); const sorted = lags.sort((a, b) => a - b); return { p99: sorted[Math.max(0, Math.ceil(sorted.length * 0.99) - 1)] ?? 0, max: sorted.at(-1) ?? 0 }; } };
}

const RUNS = QUICK ? 1 : Number(process.argv.find((_arg, i, all) => all[i - 1] === '--runs') ?? 3);

/** One complete run: a fresh server pipeline, a fresh load-generator process, both phases. */
async function runOnce(runIndex: number): Promise<Run> {
  const load = loadavg()[0]!;
  const dir = await mkdtemp(join(tmpdir(), 'twinclue-bench-'));
  const metrics = new Metrics();
  const store = new SessionStore(join(dir, 'session.json'), undefined, metrics);
  const controller = new GameController(new Session(), [puzzle], { metrics, store, vocabularies: loadFactVocabularies() });
  controller.roundLengthSeconds = 600;
  const app = Fastify();
  registerWebRoutes(app, controller, { security: { adminToken: ADMIN }, metrics });
  const address = await app.listen({ host: '127.0.0.1', port: 0 });

  const child = fork(resolve('src/bench/load.ts'), [], { execArgv: ['--import', 'tsx'], stdio: 'inherit' });
  const nextMessage = <T>(type: string) => new Promise<T>(done => { const on = (message: any) => { if (message.type === type) { child.off('message', on); done(message); } }; child.on('message', on); });
  const { url } = await nextMessage<{ url: string }>('ready');

  const helix = { call: async () => ({ status: 202, body: {}, headers: new Headers() }) };
  const client = new EventSubClient({ channels: { a: A, b: B }, botUserId: BOT, helix, url, metrics, onChat: createChatRouter({ controller, broadcasterIds: { a: A, b: B }, metrics }) });
  client.connect();
  while (!client.status().subscriptions.every(sub => sub.status === 'enabled')) await new Promise(r => setTimeout(r, 20));

  const keys = overlayKeys(ADMIN);
  const ws = address.replace('http', 'ws');
  child.send({ type: 'clients', origin: address, adminToken: ADMIN, panel: `${ws}/overlay/ws/panel`,
    overlays: [`${ws}/overlay/ws/a?k=${keys.a}`, `${ws}/overlay/ws/a?k=${keys.a}`, `${ws}/overlay/ws/b?k=${keys.b}`, `${ws}/overlay/ws/b?k=${keys.b}`] });
  await nextMessage('clients-ready');

  const results: Result[] = [];
  for (const [index, spec] of phases.entries()) {
    if (controller.activeRound?.status === 'active') controller.lockRound();
    controller.startRound();
    const before = { cpu: process.cpuUsage(), rateLimited: metrics.votes.get({ result: 'rate_limited' }), voted: metrics.votes.get({ result: 'voted' }), shedTicker: metrics.shed.get({ kind: 'ticker' }),
      shedFrames: metrics.shed.get({ kind: 'frame' }), duplicates: metrics.duplicates.total(), snapshots: metrics.snapshots.total() };
    let peakRss = process.memoryUsage.rss();
    const rssTimer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage.rss()); }, 50);
    const loop = lagSampler();
    // Per-phase histograms, so percentiles describe this phase only.
    metrics.latency.reset();
    metrics.snapshotBlockingSeconds.reset();
    metrics.snapshotSeconds.reset();
    console.log(`Run ${runIndex + 1}, phase ${spec.name}: ${spec.rate} messages per second for ${spec.seconds} seconds...`);
    child.send({ type: 'phase', spec, seed: 42 + index, seqBase: controller.ingested });
    const { report } = await nextMessage<{ report: PhaseReport }>('phase-done');
    const deadline = Date.now() + 15_000;
    while (controller.ingested < report.routerMessages && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    clearInterval(rssTimer);
    const lag = loop.stop();
    const cpu = process.cpuUsage(before.cpu);

    const round = controller.activeRound!;
    const mismatches: string[] = [];
    for (const [side, entries] of [['A', report.expected.A], ['B', report.expected.B]] as const) {
      if (round.voterCount(side) !== entries.length) mismatches.push(`${side}: ${round.voterCount(side)} voters counted, ${entries.length} planted`);
      let wrong = 0;
      for (const [chatter, label] of entries) if (round.voteLabel(side, chatter) !== label) { wrong++; if (mismatches.length < 10) mismatches.push(`${side}:${chatter} expected ${label}, got ${round.voteLabel(side, chatter)}`); }
      if (wrong) mismatches.push(`${side}: ${wrong} viewers with the wrong vote`);
    }
    const rateLimited = metrics.votes.get({ result: 'rate_limited' }) - before.rateLimited;
    const votesCounted = metrics.votes.get({ result: 'voted' }) - before.voted;
    const duplicatesDropped = metrics.duplicates.total() - before.duplicates;
    if (rateLimited !== report.plantedRapidChanges) mismatches.push(`rate limited ${rateLimited}, planted rapid changes ${report.plantedRapidChanges}`);
    if (votesCounted !== report.acceptedVotes) mismatches.push(`votes counted ${votesCounted}, expected ${report.acceptedVotes}`);
    if (duplicatesDropped !== report.plantedSharedCopies) mismatches.push(`duplicates dropped ${duplicatesDropped}, planted Shared Chat copies ${report.plantedSharedCopies}`);
    const last: Result = { spec, report, exact: mismatches.length === 0, mismatches, serverCpuMs: (cpu.user + cpu.system) / 1000, peakRssMb: peakRss / 2 ** 20,
      loopDelayP99Ms: lag.p99, loopDelayMaxMs: lag.max,
      serverLatency: { p50: metrics.latency.quantile(0.5) * 1000, p95: metrics.latency.quantile(0.95) * 1000, p99: metrics.latency.quantile(0.99) * 1000 },
      rateLimited, shedTicker: metrics.shed.get({ kind: 'ticker' }) - before.shedTicker, shedFrames: metrics.shed.get({ kind: 'frame' }) - before.shedFrames,
      duplicatesDropped, votesCounted, snapshots: metrics.snapshots.total() - before.snapshots,
      snapshotBlockingP50Ms: metrics.snapshotBlockingSeconds.quantile(0.5) * 1000, snapshotBlockingMaxMs: metrics.snapshotBlockingSeconds.max * 1000, snapshotTotalMaxMs: metrics.snapshotSeconds.max * 1000 };
    results.push(last);
    console.log(`  ${report.sentMessages} messages in ${report.sendSeconds.toFixed(1)} s (${Math.round(report.achievedRate)} per second); end-to-end p50 ${report.latency.p50.toFixed(1)} ms, p95 ${report.latency.p95.toFixed(1)} ms, p99 ${report.latency.p99.toFixed(1)} ms; peak RSS ${last.peakRssMb.toFixed(0)} MB; exact: ${last.exact}`);
    console.log(`  server: CPU ${Math.round(last.serverCpuMs)} ms, loop delay p99 ${last.loopDelayP99Ms.toFixed(1)} ms max ${last.loopDelayMaxMs.toFixed(1)} ms, max frame gap ${Math.round(report.maxFrameGapMs)} ms, snapshots ${last.snapshots} (blocking max ${last.snapshotBlockingMaxMs.toFixed(1)} ms)`);
    for (const line of mismatches) console.log(`  MISMATCH ${line}`);
  }

  child.send({ type: 'exit' });
  client.stop();
  controller.close();
  await app.close();
  store.stop();
  await rm(dir, { recursive: true, force: true });
  return { load, results };
}

async function main(): Promise<void> {
  const runs: Run[] = [];
  for (let i = 0; i < RUNS; i++) {
    console.log(`Run ${i + 1} of ${RUNS}: one-minute load average ${loadavg()[0]!.toFixed(1)}`);
    runs.push(await runOnce(i));
  }
  if (!QUICK) await writeFile('docs/BENCHMARKS.md', render(runs));
  console.log(QUICK ? 'Quick run: docs/BENCHMARKS.md not updated.' : 'Wrote docs/BENCHMARKS.md');
  const failed = runs.some(run => run.results.some(result => !result.exact || result.report.maxFrameGapMs > 1_000));
  process.exit(failed ? 1 : 0);
}

const fmt = (value: number, digits = 1) => value.toFixed(digits);
const int = (value: number) => Math.round(value).toLocaleString('en-US');

function median(values: number[]): number { const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2; }
/** "median (min to max)" across runs; a single run prints just the value. */
function spread(values: number[], digits = 1, unit = ''): string {
  if (values.length === 1) return `${fmt(values[0]!, digits)}${unit}`;
  return `${fmt(median(values), digits)}${unit} (${fmt(Math.min(...values), digits)} to ${fmt(Math.max(...values), digits)})`;
}
const label = (name: string) => (name === 'sustained' ? 'Sustained' : 'Burst');

function render(runs: Run[]): string {
  const cpu = cpus();
  const phaseRows = (pick: (result: Result) => string) => phases.map((_spec, index) => pick(runs[0]!.results[index]!)).join('\n');
  const across = (index: number, value: (result: Result) => number) => runs.map(run => value(run.results[index]!));
  const latencyRows = phases.map((spec, i) => `| ${label(spec.name)} | ${int(spec.rate)}/s for ${spec.seconds} s | ${int(runs[0]!.results[i]!.report.sentMessages)} | ${spread(across(i, r => r.report.achievedRate), 0)} | ${spread(across(i, r => r.report.latency.p50))} | ${spread(across(i, r => r.report.latency.p95))} | ${spread(across(i, r => r.report.latency.p99))} | ${spread(across(i, r => r.report.latency.max))} |`).join('\n');
  const resourceRows = phases.map((spec, i) => `| ${label(spec.name)} | ${spread(across(i, r => r.peakRssMb), 0, ' MB')} | ${spread(across(i, r => r.serverCpuMs / 10 / r.report.sendSeconds), 0, '%')} | ${spread(across(i, r => r.loopDelayP99Ms))} | ${spread(across(i, r => r.loopDelayMaxMs))} | ${spread(across(i, r => r.report.maxFrameGapMs), 0)} |`).join('\n');
  const serverRows = phases.map((spec, i) => `| ${label(spec.name)} | ${spread(across(i, r => r.serverLatency.p50), 0)} | ${spread(across(i, r => r.serverLatency.p95), 0)} | ${spread(across(i, r => r.serverLatency.p99), 0)} |`).join('\n');
  const snapshotRows = phases.map((spec, i) => `| ${label(spec.name)} | ${spread(across(i, r => r.snapshots), 0)} | ${spread(across(i, r => r.snapshotBlockingMaxMs))} | ${spread(across(i, r => r.snapshotTotalMaxMs))} |`).join('\n');
  const integrity = runs.flatMap((run, runIndex) => run.results.map(r => `| ${runIndex + 1} | ${label(r.spec.name)} | ${int(r.report.expected.A.length + r.report.expected.B.length)} | ${int(r.votesCounted)} of ${int(r.report.acceptedVotes)} | ${int(r.rateLimited)} of ${int(r.report.plantedRapidChanges)} | ${int(r.duplicatesDropped)} of ${int(r.report.plantedSharedCopies)} | ${int(r.shedTicker)} | ${int(r.shedFrames)} | ${r.exact ? 'yes' : `NO: ${r.mismatches.join('; ')}`} |`)).join('\n');
  const loads = runs.map(run => fmt(run.load)).join(', ');
  const heavy = runs.some(run => run.load > cpu.length / 2);
  return `# Benchmarks

This measures **our pipeline, not Twitch's delivery**. Nothing here says that 100,000 viewers were tested. It says
that when Twitch hands us chat at these rates, every vote is counted exactly once and the overlays keep moving.

Viewers never connect to Twinclue. The overlay is captured by OBS into the video, so a large audience costs us
only its chat messages plus two to four overlay browser sources. Scale for us therefore means chat throughput.

## How it was run

\`npm run bench\` starts the real server pipeline in one process: the EventSub WebSocket client, the JSON parser,
the dedupe cache, the command router, the game controller, throttled session snapshots to disk, and the
coalesced overlay frames sent by the real \`ws\` server. A child process plays Twitch and OBS. It runs a local
EventSub WebSocket server that pushes \`channel.chat.message\` notifications in Twitch's envelope, and it holds
five real WebSocket clients: two overlay sources per community and the control panel.

Each phase plants traffic from a fixed seed and checks the result against an independent model:

| Phase | Distinct chatters | First votes | Vote changes (5 s or more later) | Rapid changes (200 ms later, must be rejected) | Shared Chat copies (must be dropped) | Plain chat |
| --- | --- | --- | --- | --- | --- | --- |
${phaseRows(r => `| ${label(r.spec.name)} | ${int(r.spec.chatters)} | ${int(r.spec.chatters)} | ${int(r.spec.changes)} | ${int(r.spec.rapidChanges)} | ${int(r.spec.sharedCopies)} | ${int(r.spec.plainChat)} |`)}

Votes go 35 percent to the answer, 55 percent to eleven other countries, and 10 percent to text that is not a
country (shown as "other answers"), so the consensus lock never ends a phase early.

The whole benchmark ran ${runs.length} times, each with a fresh server pipeline and a fresh load-generator process.
The runs share one Node process, so later runs' peak RSS includes garbage left by earlier runs. Every figure below is the
**median across runs, with the range (lowest to highest) in brackets**.

Machine: ${cpu[0]?.model ?? 'unknown CPU'}, ${cpu.length} cores, ${fmt(totalmem() / 2 ** 30, 0)} GB RAM, ${platform()} ${release()} ${arch()}. Node ${process.version}.
The load generator and the server share this machine. One-minute load average at the start of each run: ${loads}.
${heavy ? 'Some runs started with the machine busy (load above half the core count), so treat those numbers as conservative.' : 'Every run started with the load average below half the core count.'}
Generated ${new Date().toISOString().slice(0, 10)}.

## Latency and throughput

End-to-end latency is measured in the child process, from the moment a vote's notification is written to the
EventSub socket until the first frame that includes it arrives at that community's overlay client. Frames are
coalesced to at most ten per second, so about 50 ms of the median is the deliberate frame interval.

| Phase | Offered load | Messages | Achieved per second | p50 ms | p95 ms | p99 ms | max ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
${latencyRows}

| Phase | Peak RSS (server) | Server CPU (share of one core) | Event loop delay p99 ms | Event loop delay max ms | Longest gap between overlay frames ms |
| --- | --- | --- | --- | --- | --- |
${resourceRows}

## Every planted vote counted exactly once

| Run | Phase | Viewers checked one by one | Votes counted | Rate limited | Duplicates dropped | Ticker samples shed | Frames shed | Exact |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${integrity}

"Viewers checked one by one" compares each simulated viewer's final vote on the server with the model.
Ticker samples are the only thing shed under load: above 400 votes per second the ticker keeps at most one sample
every 50 ms, while every vote and every round transition is applied. Frames shed counts frames skipped for a slow
overlay socket.

## Inside the server

| Phase | Receive to frame sent, p50 ms | p95 ms | p99 ms |
| --- | --- | --- | --- |
${serverRows}

Receive to frame sent comes from the \`twinclue_vote_to_frame_seconds\` histogram that \`/metrics\` exports, so
its values are bucket upper bounds.

### Snapshots under load

| Phase | Snapshots written | Longest event-loop block while serialising, ms | Longest snapshot including file write, ms |
| --- | --- | --- | --- |
${snapshotRows}

A snapshot serialises the whole live vote map (up to 100,000 votes here) synchronously, then writes it to a temp
file and renames it without blocking. While votes arrive, snapshot starts are at least one second apart, and the
gap stretches to ten times the previous snapshot's duration if snapshots get slow. Round transitions and
shutdown write at once. The blocking figures are exact maxima from \`twinclue_snapshot_blocking_seconds\`.

## Reproduce

\`\`\`sh
npm run bench               # three full runs, about five minutes; rewrites this file
npm run bench -- --runs 1   # one full run
npm run bench -- --quick    # full rates, 12 s and 8 s phases; leaves this file alone
\`\`\`
`;
}

await main();
