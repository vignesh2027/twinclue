// npm run bench: drives the real pipeline in this process (EventSub socket client, parser, command router,
// controller, session snapshots, coalesced overlay frames, ws server) with traffic from a child process that
// plays Twitch and the overlay browser sources. It measures our pipeline, not Twitch's delivery.
import { fork } from 'node:child_process';
import { cpus, totalmem, platform, release, arch, tmpdir, loadavg } from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
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
  serverLatency: { p50: number; p95: number; p99: number }; rateLimited: number; shedTicker: number; shedFrames: number; duplicatesDropped: number; votesCounted: number; snapshots: number }

async function main(): Promise<void> {
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
    const loop = monitorEventLoopDelay({ resolution: 10 });
    loop.enable();
    // A fresh histogram per phase so its percentiles describe this phase only.
    const phaseMetrics = new Metrics();
    const original = metrics.latency;
    (metrics as { latency: typeof original }).latency = phaseMetrics.latency;
    console.log(`Phase ${spec.name}: ${spec.rate} messages per second for ${spec.seconds} seconds...`);
    child.send({ type: 'phase', spec, seed: 42 + index, seqBase: controller.ingested });
    const { report } = await nextMessage<{ report: PhaseReport }>('phase-done');
    const deadline = Date.now() + 15_000;
    while (controller.ingested < report.routerMessages && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    clearInterval(rssTimer);
    loop.disable();
    const cpu = process.cpuUsage(before.cpu);
    (metrics as { latency: typeof original }).latency = original;

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
    results.push({ spec, report, exact: mismatches.length === 0, mismatches, serverCpuMs: (cpu.user + cpu.system) / 1000, peakRssMb: peakRss / 2 ** 20,
      loopDelayP99Ms: loop.percentile(99) / 1e6, loopDelayMaxMs: loop.max / 1e6,
      serverLatency: { p50: phaseMetrics.latency.quantile(0.5) * 1000, p95: phaseMetrics.latency.quantile(0.95) * 1000, p99: phaseMetrics.latency.quantile(0.99) * 1000 },
      rateLimited, shedTicker: metrics.shed.get({ kind: 'ticker' }) - before.shedTicker, shedFrames: metrics.shed.get({ kind: 'frame' }) - before.shedFrames,
      duplicatesDropped, votesCounted, snapshots: metrics.snapshots.total() - before.snapshots });
    const last = results.at(-1)!;
    console.log(`  ${report.sentMessages} messages in ${report.sendSeconds.toFixed(1)} s (${Math.round(report.achievedRate)} per second); end-to-end p50 ${report.latency.p50.toFixed(1)} ms, p95 ${report.latency.p95.toFixed(1)} ms, p99 ${report.latency.p99.toFixed(1)} ms; peak RSS ${last.peakRssMb.toFixed(0)} MB; exact: ${last.exact}`);
    console.log(`  server: CPU ${Math.round(last.serverCpuMs)} ms, loop delay p99 ${last.loopDelayP99Ms.toFixed(1)} ms max ${last.loopDelayMaxMs.toFixed(1)} ms, receive-to-frame p50/p95/p99 ${last.serverLatency.p50}/${last.serverLatency.p95}/${last.serverLatency.p99} ms, max frame gap ${Math.round(report.maxFrameGapMs)} ms, snapshots ${last.snapshots}, shed ticker ${last.shedTicker}, frames ${last.shedFrames}`);
    for (const line of mismatches) console.log(`  MISMATCH ${line}`);
  }

  child.send({ type: 'exit' });
  client.stop();
  controller.close();
  await app.close();
  store.stop();
  await rm(dir, { recursive: true, force: true });
  if (!QUICK) await writeFile('docs/BENCHMARKS.md', render(results));
  console.log(QUICK ? 'Quick run: docs/BENCHMARKS.md not updated.' : 'Wrote docs/BENCHMARKS.md');
  const failed = results.some(result => !result.exact || result.report.maxFrameGapMs > 1_000);
  process.exit(failed ? 1 : 0);
}

const fmt = (value: number, digits = 1) => value.toFixed(digits);
const int = (value: number) => Math.round(value).toLocaleString('en-US');

function render(results: Result[]): string {
  const cpu = cpus();
  const rows = results.map(r => `| ${r.spec.name === 'sustained' ? 'Sustained' : 'Burst'} | ${int(r.spec.rate)}/s for ${r.spec.seconds} s | ${int(r.report.sentMessages)} | ${int(r.report.achievedRate)}/s | ${fmt(r.report.latency.p50)} | ${fmt(r.report.latency.p95)} | ${fmt(r.report.latency.p99)} | ${fmt(r.report.latency.max)} | ${fmt(r.peakRssMb, 0)} MB | ${int(r.serverCpuMs)} ms (${fmt(r.serverCpuMs / 10 / r.report.sendSeconds, 0)}% of one core) |`).join('\n');
  const integrity = results.map(r => `| ${r.spec.name === 'sustained' ? 'Sustained' : 'Burst'} | ${int(r.report.expected.A.length + r.report.expected.B.length)} | ${int(r.votesCounted)} of ${int(r.report.acceptedVotes)} | ${int(r.rateLimited)} of ${int(r.report.plantedRapidChanges)} | ${int(r.duplicatesDropped)} of ${int(r.report.plantedSharedCopies)} | ${int(r.shedTicker)} | ${int(r.shedFrames)} | ${r.exact ? 'yes' : `NO: ${r.mismatches.join('; ')}`} |`).join('\n');
  const server = results.map(r => `| ${r.spec.name === 'sustained' ? 'Sustained' : 'Burst'} | ${fmt(r.serverLatency.p50, 0)} | ${fmt(r.serverLatency.p95, 0)} | ${fmt(r.serverLatency.p99, 0)} | ${fmt(r.loopDelayP99Ms)} | ${fmt(r.loopDelayMaxMs)} | ${fmt(r.report.maxFrameGapMs, 0)} | ${r.snapshots} |`).join('\n');
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
${results.map(r => `| ${r.spec.name === 'sustained' ? 'Sustained' : 'Burst'} | ${int(r.spec.chatters)} | ${int(r.spec.chatters)} | ${int(r.spec.changes)} | ${int(r.spec.rapidChanges)} | ${int(r.spec.sharedCopies)} | ${int(r.spec.plainChat)} |`).join('\n')}

Votes go 35 percent to the answer, 55 percent to eleven other countries, and 10 percent to text that is not a
country (shown as "other answers"), so the consensus lock never ends a phase early.

Machine: ${cpu[0]?.model ?? 'unknown CPU'}, ${cpu.length} cores, ${fmt(totalmem() / 2 ** 30, 0)} GB RAM, ${platform()} ${release()} ${arch()}. Node ${process.version}.
The load generator and the server share this machine. One-minute load average when the run started: ${startLoad}
(this is a developer laptop with other work running, so treat the numbers as conservative).
Generated ${new Date().toISOString().slice(0, 10)}.

## Results

End-to-end latency is measured in the child process, from the moment a vote's notification is written to the
EventSub socket until the first frame that includes it arrives at that community's overlay client. Frames are
coalesced to at most ten per second, so about 50 ms of the median is the deliberate frame interval.

| Phase | Offered load | Messages | Achieved | p50 ms | p95 ms | p99 ms | max ms | Peak RSS (server) | Server CPU |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

## Every planted vote counted exactly once

| Phase | Viewers checked one by one | Votes counted | Rate limited | Duplicates dropped | Ticker samples shed | Frames shed | Exact |
| --- | --- | --- | --- | --- | --- | --- | --- |
${integrity}

"Viewers checked one by one" compares each simulated viewer's final vote on the server with the model.
Ticker samples are the only thing shed under load: above 400 votes per second the ticker keeps at most one sample
every 50 ms, while every vote and every round transition is applied. Frames shed counts frames skipped for a slow
overlay socket.

## Inside the server

| Phase | Receive to frame sent, p50 ms | p95 ms | p99 ms | Event loop delay p99 ms | Event loop delay max ms | Longest gap between overlay frames ms | Snapshots written |
| --- | --- | --- | --- | --- | --- | --- | --- |
${server}

Receive to frame sent comes from the \`twinclue_vote_to_frame_seconds\` histogram that \`/metrics\` exports, so
its values are bucket upper bounds. Snapshots are atomic writes of the full vote map, throttled to at most one
per second and stretched to ten times the last write's duration under load.

## Reproduce

\`\`\`sh
npm run bench            # about 90 seconds; rewrites this file
npm run bench -- --quick # full rates, 12 s and 8 s phases; leaves this file alone
\`\`\`
`;
}

await main();
