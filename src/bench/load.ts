// Benchmark load generator, run as a child process by bench.ts so its CPU and memory are not counted as the server's.
// It plays Twitch: a local EventSub WebSocket server that pushes channel.chat.message notifications, plus the
// overlay browser sources (real ws clients) that receive the frames.
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { FakeEventSub } from '../test/fake-eventsub.js';

export interface PhaseSpec {
  name: string; rate: number; seconds: number; firstChatter: number; chatters: number;
  changes: number; rapidChanges: number; sharedCopies: number; plainChat: number;
  channelA: string; channelB: string; answer: string; decoys: string[];
}
export interface PhaseReport {
  name: string; sentMessages: number; routerMessages: number; plantedVotes: number; acceptedVotes: number; plantedRapidChanges: number; plantedSharedCopies: number;
  expected: { A: Array<[string, string]>; B: Array<[string, string]> };
  sendSeconds: number; achievedRate: number;
  latency: { count: number; p50: number; p95: number; p99: number; max: number };
  framesPerClient: number[]; maxFrameGapMs: number;
}
type Kind = 'first' | 'change' | 'rapid' | 'shared' | 'plain';
interface Planned { at: number; kind: Kind; side: 'A' | 'B'; chatter: string; text: string; messageId: string; sourceMessageId?: string }

const garbage = ['my streamer is the best', 'is it a country', 'no idea', 'hello from the other side', 'lol', 'what is the answer', 'pog', 'this is hard', 'island maybe', 'help'];

/** Deterministic pseudo-random numbers so every run plants the same traffic. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

function pickAnswer(random: () => number, spec: PhaseSpec, chatter: number): { text: string; label: string } {
  const roll = random();
  if (roll < 0.35) return { text: spec.answer, label: spec.answer };
  if (roll < 0.9) { const decoy = spec.decoys[Math.floor(random() * spec.decoys.length)]!; return { text: decoy, label: decoy }; }
  if (roll < 0.95) return { text: garbage[Math.floor(random() * garbage.length)]!, label: 'other answers' };
  return { text: `guess number ${chatter}`, label: 'other answers' };
}

export function planPhase(spec: PhaseSpec, seed: number): { plan: Planned[]; expected: Map<string, string>[]; acceptedVotes: number } {
  const random = rng(seed);
  const plan: Planned[] = [];
  const firstWindow = spec.seconds * 1000 * 0.9;
  const firstAt = new Map<number, number>();
  const firstText = new Map<number, string>();
  for (let i = 0; i < spec.chatters; i++) {
    const chatter = spec.firstChatter + i;
    const at = (i / spec.chatters) * firstWindow;
    const answer = pickAnswer(random, spec, chatter);
    firstAt.set(chatter, at);
    firstText.set(chatter, answer.text);
    plan.push({ at, kind: 'first', side: chatter % 2 ? 'A' : 'B', chatter: String(chatter), text: `!g ${answer.text}`, messageId: randomUUID() });
  }
  // Vote changes at least five seconds after the first vote, so the two second cooldown never applies, and rapid
  // changes 200 ms after it, which the cooldown must reject. Each targets a distinct viewer.
  const changeable = [...firstAt].filter(([, at]) => at <= spec.seconds * 1000 - 6_000);
  for (let i = changeable.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [changeable[i], changeable[j]] = [changeable[j]!, changeable[i]!]; }
  if (changeable.length < spec.changes + spec.rapidChanges) throw new Error(`Phase ${spec.name} is too short for ${spec.changes + spec.rapidChanges} planted changes.`);
  for (let i = 0; i < spec.changes; i++) {
    const [chatter, at] = changeable[i]!;
    const answer = pickAnswer(random, spec, chatter + 1_000_000);
    plan.push({ at: at + 5_000 + random() * 900, kind: 'change', side: chatter % 2 ? 'A' : 'B', chatter: String(chatter), text: `!g ${answer.text}`, messageId: randomUUID() });
  }
  for (let i = 0; i < spec.rapidChanges; i++) {
    const [chatter, at] = changeable[spec.changes + i]!;
    const different = firstText.get(chatter) === spec.answer ? spec.decoys[0]! : spec.answer;
    plan.push({ at: at + 200, kind: 'rapid', side: chatter % 2 ? 'A' : 'B', chatter: String(chatter), text: `!g ${different}`, messageId: randomUUID() });
  }
  plan.sort((a, b) => a.at - b.at);
  // Shared Chat: the same message delivered again through the other channel's subscription a moment later.
  const firsts = plan.filter(item => item.kind === 'first');
  for (let i = 0; i < spec.sharedCopies; i++) {
    const original = firsts[(i * 13) % firsts.length]!;
    plan.push({ ...original, at: original.at + 1, kind: 'shared', messageId: randomUUID(), sourceMessageId: original.messageId });
  }
  for (let i = 0; i < spec.plainChat; i++) plan.push({ at: random() * spec.seconds * 1000, kind: 'plain', side: random() < 0.5 ? 'A' : 'B', chatter: String(spec.firstChatter + Math.floor(random() * spec.chatters)), text: garbage[i % garbage.length]!, messageId: randomUUID() });
  plan.sort((a, b) => a.at - b.at);

  // The independent expected model: the latest accepted vote per viewer, labelled as the overlay would show it.
  const expected = [new Map<string, string>(), new Map<string, string>()];
  const lastText = [new Map<string, string>(), new Map<string, string>()];
  let acceptedVotes = 0;
  const labelOf = (text: string) => { const answer = text.slice(3); return answer === spec.answer || spec.decoys.includes(answer) ? answer : 'other answers'; };
  for (const item of plan) {
    if (item.kind !== 'first' && item.kind !== 'change') continue;
    const side = item.side === 'A' ? 0 : 1;
    if (lastText[side]!.get(item.chatter) !== item.text) acceptedVotes++;
    lastText[side]!.set(item.chatter, item.text);
    expected[side]!.set(item.chatter, labelOf(item.text));
  }
  return { plan, expected, acceptedVotes };
}

function percentile(sorted: Float64Array, q: number): number { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)]! : 0; }

async function main(): Promise<void> {
  const fake = await FakeEventSub.start(10);
  const clients: WebSocket[] = [];
  const frames: Array<{ seq: number; at: number }[]> = [];
  process.send!({ type: 'ready', url: fake.url });

  process.on('message', async (message: any) => {
    if (message.type === 'clients') {
      const urls: Array<{ url: string; panel?: boolean }> = [...message.overlays.map((url: string) => ({ url })), { url: message.panel, panel: true }];
      await Promise.all(urls.map(({ url, panel }, index) => new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(url, { headers: { origin: message.origin } });
        frames[index] = [];
        ws.on('open', () => { if (panel) ws.send(JSON.stringify({ type: 'auth', token: message.adminToken })); resolve(); });
        ws.on('message', data => { const at = performance.now(); const text = String(data); const seq = /"seq":(\d+)/.exec(text); frames[index]!.push({ seq: seq ? Number(seq[1]) : -1, at }); });
        ws.on('error', reject);
        clients.push(ws);
      })));
      process.send!({ type: 'clients-ready' });
      return;
    }
    if (message.type === 'phase') {
      const report = await runPhase(fake, message.spec as PhaseSpec, message.seed as number, message.seqBase as number, frames);
      process.send!({ type: 'phase-done', report });
      return;
    }
    if (message.type === 'exit') { for (const ws of clients) ws.close(); await fake.close(); process.exit(0); }
  });
}

async function runPhase(fake: FakeEventSub, spec: PhaseSpec, seed: number, seqBase: number, frames: Array<{ seq: number; at: number }[]>): Promise<PhaseReport> {
  const { plan, expected, acceptedVotes } = planPhase(spec, seed);
  const ws = fake.newest;
  // Router index of every message that reaches the game (all but Shared Chat copies), and its send time.
  const sendAt = new Float64Array(plan.length + 1);
  const measured: Array<{ r: number; side: number }> = [];
  for (const list of frames) list.length = 0;
  let router = seqBase;
  const indexOf: number[] = new Array(plan.length);
  for (let i = 0; i < plan.length; i++) if (plan[i]!.kind !== 'shared') { router++; indexOf[i] = router; }
  for (let i = 0; i < plan.length; i++) {
    const item = plan[i]!;
    if (item.kind === 'first') measured.push({ r: indexOf[i]!, side: item.side === 'A' ? 0 : 1 });
  }
  const started = performance.now();
  await new Promise<void>(resolve => {
    let next = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      while (next < plan.length && plan[next]!.at <= elapsed) {
        const item = plan[next]!;
        const own = item.side === 'A' ? spec.channelA : spec.channelB;
        const other = item.side === 'A' ? spec.channelB : spec.channelA;
        const chat = item.kind === 'shared'
          ? { broadcaster: other, source: own, chatterId: item.chatter, text: item.text, messageId: item.messageId, sourceMessageId: item.sourceMessageId }
          : { broadcaster: own, chatterId: item.chatter, text: item.text, messageId: item.messageId };
        ws.send(FakeEventSub.chatFrame(chat));
        if (indexOf[next] !== undefined) sendAt[indexOf[next]! - seqBase] = performance.now();
        next++;
      }
      if (next < plan.length) setTimeout(tick, 1); else resolve();
    };
    tick();
  });
  const sendSeconds = (performance.now() - started) / 1000;
  const finalSeq = router;
  const sideClients = [0, 2];
  const deadline = performance.now() + 15_000;
  while (performance.now() < deadline && !sideClients.every(index => frames[index]!.some(frame => frame.seq >= finalSeq))) await new Promise(resolve => setTimeout(resolve, 20));

  // Latency: a first vote is on screen in the first frame, on its own side's overlay, whose seq covers it.
  const latencies = new Float64Array(measured.length);
  let count = 0;
  for (const side of [0, 1]) {
    const list = frames[sideClients[side]!]!;
    let pointer = 0;
    for (const item of measured) {
      if (item.side !== side) continue;
      while (pointer < list.length && list[pointer]!.seq < item.r) pointer++;
      if (pointer >= list.length) break;
      latencies[count++] = list[pointer]!.at - sendAt[item.r - seqBase]!;
    }
  }
  const sorted = latencies.slice(0, count).sort();
  let maxGap = 0;
  for (const list of frames) for (let i = 1; i < list.length; i++) if (list[i]!.at - list[i - 1]!.at > maxGap && list[i]!.at - started < sendSeconds * 1000) maxGap = list[i]!.at - list[i - 1]!.at;
  return {
    name: spec.name, sentMessages: plan.length, routerMessages: finalSeq - seqBase, plantedVotes: plan.filter(item => item.kind === 'first' || item.kind === 'change').length, acceptedVotes,
    plantedRapidChanges: spec.rapidChanges, plantedSharedCopies: spec.sharedCopies,
    expected: { A: [...expected[0]!], B: [...expected[1]!] }, sendSeconds, achievedRate: plan.length / sendSeconds,
    latency: { count, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95), p99: percentile(sorted, 0.99), max: sorted.length ? sorted[sorted.length - 1]! : 0 },
    framesPerClient: frames.map(list => list.length), maxFrameGapMs: maxGap,
  };
}

if (process.send) await main();
