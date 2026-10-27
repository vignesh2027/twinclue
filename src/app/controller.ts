import { Session, type SessionStore } from '../game/session.js';
import { Round, type Community, type ConsensusRule, type RoundOptions, type VoteBucket, type VoteResult } from '../game/round.js';
import type { VocabEntry } from '../game/vocabulary.js';
import type { Puzzle } from '../puzzle/types.js';
import { vocabularyFor } from '../puzzle/vocabulary-source.js';
import type { Metrics } from '../obs/metrics.js';

export type OverlayView = 'a' | 'b';
export type View = OverlayView | 'panel';
export type FrameListener = (frame: string, critical: boolean) => void;
export type RoundEvent = { type: 'started' | 'finished'; round: Round };

export interface SideHealth { configured: boolean; connected: boolean; subscribed: boolean; error: string | null; reauthorize: boolean }
export interface Health { a: SideHealth; b: SideHealth; sharedChat: boolean; tokenValid: boolean; lastError: string | null }

export interface OverlayState {
  type: 'state'; seq: number; serverNow: number; demo: boolean; unauditedDemo: boolean; rehearsal: boolean; side: OverlayView; commandPrefix: string;
  roundStatus: 'idle' | 'active' | 'won' | 'timed-out'; category: string | null; half: string | null; startedAt: number | null; endsAt: number | null;
  leading: string | null; voters: number; buckets: VoteBucket[]; otherVotes: number; recentVotes: Array<{ user: string; label: string }>;
  scoreboard: { rounds: number; wins: number; streak: number };
  reveal?: { answer: string; halfA: string; halfB: string; alsoFitsA: string[]; alsoFitsB: string[]; setSizeA: number; setSizeB: number;
    sideA: { topAnswer: string | null; correct: boolean; voters: number }; sideB: { topAnswer: string | null; correct: boolean; voters: number };
    solveTimeMs: number | null; finishReason: string | null };
}
export interface PanelState {
  type: 'panel-state'; demo: boolean; rehearsal: boolean; health: Health; scoreboard: Session['scoreboard']; roundStatus: string; endsAt: number | null;
  roundLengthSeconds: number; category: string; difficulty: string; options: { categories: string[]; difficultiesByCategory: Record<string, string[]> };
  recentVotes: { a: Array<{ user: string; label: string }>; b: Array<{ user: string; label: string }> }; leading: { a: string | null; b: string | null };
  voters: { a: number; b: number }; packSize: number;
}
export type ClientMessage = OverlayState | PanelState;

export interface ControllerOptions {
  demo?: boolean; now?: () => number; store?: SessionStore; metrics?: Metrics; vocabularies?: Map<string, VocabEntry[]>;
  cooldownMs?: number; consensus?: Partial<ConsensusRule>; frameIntervalMs?: number; commandPrefix?: string;
  /** Above this many votes per second the ticker stops sampling; votes and transitions are never shed. */
  shedTickerAboveRate?: number;
  onRoundEvent?: (event: RoundEvent) => void;
}

const MAX_PENDING_RECEIPTS = 20_000;
const sideOf = (view: OverlayView): Community => (view === 'a' ? 'A' : 'B');

export function makeRoundOptions(options: Pick<ControllerOptions, 'vocabularies' | 'cooldownMs' | 'consensus'>): (puzzle: Puzzle) => RoundOptions {
  return puzzle => ({ vocabulary: options.vocabularies ? vocabularyFor(puzzle, options.vocabularies) : undefined, cooldownMs: options.cooldownMs, consensus: options.consensus });
}

export class GameController {
  roundLengthSeconds = 90;
  category = 'general';
  difficulty = 'medium';
  rehearsal = false;
  readonly health: Health = {
    a: { configured: false, connected: false, subscribed: false, error: null, reauthorize: false },
    b: { configured: false, connected: false, subscribed: false, error: null, reauthorize: false },
    sharedChat: false, tokenValid: false, lastError: null,
  };
  /** Count of chat notifications handed to the game; overlay frames carry it so a client can match frames to messages. */
  ingested = 0;
  readonly demo: boolean;
  private puzzleIndex = 0;
  private rehearsalVoter = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private consensusTimer?: ReturnType<typeof setTimeout>;
  private consensusDue?: number;
  private readonly listeners = new Map<View, Set<FrameListener>>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  private lastFlushAt = -Infinity;
  private readonly pendingReceipts: number[] = [];
  private readonly frameIntervalMs: number;
  private readonly now: () => number;
  private readonly roundOptions: (puzzle: Puzzle) => RoundOptions;
  private rateWindowStart = 0;
  private rateCount = 0;
  private previousRate = 0;
  private lastTickerSample = -Infinity;

  constructor(readonly session: Session, private readonly pack: Puzzle[], private readonly options: ControllerOptions = {}) {
    this.demo = options.demo ?? false;
    this.now = options.now ?? Date.now;
    this.frameIntervalMs = options.frameIntervalMs ?? 100;
    this.roundOptions = makeRoundOptions(options);
    this.puzzleIndex = session.stats.rounds;
    if (this.demo) for (const side of ['a', 'b'] as const) Object.assign(this.health[side], { configured: true, connected: true, subscribed: true });
    this.resume();
  }

  get activeRound(): Round | undefined { return this.session.current; }
  get commandPrefix(): string { return this.options.commandPrefix ?? (process.env.COMMAND_PREFIX?.trim() || '!g'); }

  /** A restored round keeps its real end time. If that time passed while the server was down, it finishes now. */
  private resume(): void {
    const round = this.session.current;
    if (!round || round.status !== 'active' || round.startedAt === undefined) return;
    round.endsAt ??= round.startedAt + this.roundLengthSeconds * 1000;
    round.refreshConsensus(this.now());
    this.scheduleTimeout(Math.max(0, round.endsAt - this.now()));
    this.scheduleConsensus();
  }

  subscribe(view: View, listener: FrameListener): () => void {
    let set = this.listeners.get(view);
    if (!set) { set = new Set(); this.listeners.set(view, set); }
    set.add(listener);
    this.options.metrics?.overlayClients.set({ view }, set.size);
    listener(JSON.stringify(view === 'panel' ? this.panelState() : this.snapshot(view)), true);
    return () => {
      set!.delete(listener);
      this.options.metrics?.overlayClients.set({ view }, set!.size);
    };
  }

  snapshot(view: OverlayView): OverlayState {
    const round = this.session.current;
    const side = sideOf(view);
    const status = round?.status === 'active' || round?.status === 'won' || round?.status === 'timed-out' ? round.status : 'idle';
    const display = round?.displayBuckets(side) ?? { buckets: [], other: 0 };
    const reveal = round && (status === 'won' || status === 'timed-out');
    const puzzle = round?.puzzle;
    const alsoA = puzzle ? puzzle.alsoFitsA ?? puzzle.halfAAlsoFits : [];
    const alsoB = puzzle ? puzzle.alsoFitsB ?? puzzle.halfBAlsoFits : [];
    return {
      type: 'state', seq: this.ingested, serverNow: this.now(), demo: this.demo, unauditedDemo: Boolean(this.demo && puzzle?.id.startsWith('demo-')),
      rehearsal: this.rehearsal || Boolean(round?.rehearsal), side: view, commandPrefix: this.commandPrefix, roundStatus: status,
      category: puzzle?.category ?? null, half: status === 'active' ? (view === 'a' ? puzzle!.halfA : puzzle!.halfB) : null,
      startedAt: status === 'active' ? round!.startedAt ?? null : null, endsAt: status === 'active' ? round!.endsAt ?? null : null,
      leading: round?.leaderLabel(side) ?? null, voters: round?.voterCount(side) ?? 0, buckets: display.buckets, otherVotes: display.other,
      recentVotes: (round?.recentSamples(side, 3) ?? []).map(sample => ({ user: sample.user, label: sample.label })),
      scoreboard: this.session.scoreboard,
      ...(reveal ? { reveal: {
        answer: puzzle!.answer, halfA: puzzle!.halfA, halfB: puzzle!.halfB, alsoFitsA: alsoA, alsoFitsB: alsoB,
        setSizeA: puzzle!.predicates?.setSizeA ?? alsoA.length + 1, setSizeB: puzzle!.predicates?.setSizeB ?? alsoB.length + 1,
        sideA: round!.result?.A ?? { topAnswer: null, correct: false, voters: round!.voterCount('A') },
        sideB: round!.result?.B ?? { topAnswer: null, correct: false, voters: round!.voterCount('B') },
        solveTimeMs: round!.solveTimeMs ?? null, finishReason: round!.finishReason ?? null,
      } } : {}),
    };
  }

  /** The panel never receives either clue half: the streamer running it plays on one side. */
  panelState(): PanelState {
    const round = this.session.current;
    const categories = [...new Set(this.pack.map(p => p.category))];
    const difficultiesByCategory = Object.fromEntries(categories.map(category => [category, [...new Set(this.pack.filter(p => p.category === category).map(p => p.difficulty))]]));
    const recent = (side: Community) => (round?.recentSamples(side, 8) ?? []).reverse().map(sample => ({ user: sample.user, label: sample.label }));
    return {
      type: 'panel-state', demo: this.demo, rehearsal: this.rehearsal, health: structuredClone(this.health), scoreboard: this.session.scoreboard,
      roundStatus: round?.status ?? 'idle', endsAt: round?.status === 'active' ? round.endsAt ?? null : null, roundLengthSeconds: this.roundLengthSeconds,
      category: this.category, difficulty: this.difficulty, options: { categories, difficultiesByCategory },
      recentVotes: { a: recent('A'), b: recent('B') }, leading: { a: round?.leaderLabel('A') ?? null, b: round?.leaderLabel('B') ?? null },
      voters: { a: round?.voterCount('A') ?? 0, b: round?.voterCount('B') ?? 0 }, packSize: this.pack.length,
    };
  }

  startRound(): Round {
    if (this.session.current?.status === 'active') throw new Error('A round is already active.');
    const available = this.pack.filter(p => p.category === this.category && p.difficulty === this.difficulty);
    const pool = available.length ? available : this.pack;
    if (!pool.length) throw new Error('No audited puzzles are available yet. Run the Puzzle Forge first.');
    const puzzle = pool[this.puzzleIndex++ % pool.length]!;
    const round = new Round(puzzle, { ...this.roundOptions(puzzle), rehearsal: this.rehearsal });
    round.start(this.now(), this.roundLengthSeconds * 1000);
    this.clearRoundTimers();
    this.session.addRound(round);
    this.scheduleTimeout(this.roundLengthSeconds * 1000);
    void this.options.store?.now(this.session);
    this.flush(true);
    this.options.onRoundEvent?.({ type: 'started', round });
    return round;
  }

  /** Called for every chat notification that reaches the game, vote or not. */
  noteIngest(): void { this.ingested++; }

  vote(community: Community, userId: string, text: string, opts: { displayName?: string; receivedAt?: number; at?: number } = {}): VoteResult {
    const round = this.session.current;
    const metrics = this.options.metrics;
    if (!round || round.status !== 'active') { metrics?.votes.inc({ result: 'inactive' }); return 'inactive'; }
    // Under load the ticker keeps at most one sample per 50 ms; the rest are shed and counted.
    const busy = this.voteRate() > (this.options.shedTickerAboveRate ?? 400);
    const shedTicker = busy && performance.now() - this.lastTickerSample < 50;
    if (!shedTicker) this.lastTickerSample = performance.now();
    const result = round.vote(community, userId, text, opts.at ?? this.now(), opts.displayName ?? userId, !shedTicker);
    metrics?.votes.inc({ result: result.replace('-', '_') });
    if (result === 'voted') {
      this.scheduleConsensus();
      this.options.store?.request(this.session);
      this.markDirty(opts.receivedAt);
    } else if (result === 'unchanged') {
      if (shedTicker) metrics?.shed.inc({ kind: 'ticker' }); else this.markDirty(opts.receivedAt);
    }
    if (shedTicker && result === 'voted') metrics?.shed.inc({ kind: 'ticker' });
    return result;
  }

  setRehearsal(enabled: boolean): void { this.rehearsal = enabled; this.markDirty(); }

  /** Rehearsal: the host types a vote for community B as if a new viewer sent it. */
  rehearsalVote(text: string): VoteResult {
    if (!this.rehearsal) throw new Error('Rehearsal mode is off.');
    const id = ++this.rehearsalVoter;
    return this.vote('B', `rehearsal-${id}`, text, { displayName: `Rehearsal viewer ${id}` });
  }

  lockRound(): void { this.finishRound('lock'); }
  skipRound(): void { this.finishRound('skip'); }
  timeout(): void { this.finishRound('timeout'); }

  setSettings(settings: { category?: string; difficulty?: string; roundLengthSeconds?: number }): void {
    if (settings.category) this.category = settings.category;
    if (settings.difficulty) this.difficulty = settings.difficulty;
    const available = this.pack.filter(p => p.category === this.category).map(p => p.difficulty);
    if (available.length && !available.includes(this.difficulty as Puzzle['difficulty'])) this.difficulty = available[0]!;
    if (settings.roundLengthSeconds !== undefined) this.roundLengthSeconds = Math.min(600, Math.max(30, Math.round(settings.roundLengthSeconds)));
    this.markDirty();
  }

  setHealth(update: { a?: Partial<SideHealth>; b?: Partial<SideHealth>; sharedChat?: boolean; tokenValid?: boolean; lastError?: string | null }): void {
    if (update.a) Object.assign(this.health.a, update.a);
    if (update.b) Object.assign(this.health.b, update.b);
    if (update.sharedChat !== undefined) this.health.sharedChat = update.sharedChat;
    if (update.tokenValid !== undefined) this.health.tokenValid = update.tokenValid;
    if (update.lastError !== undefined) this.health.lastError = update.lastError;
    this.markDirty();
  }

  clearRoundDisplay(): void { this.clearRoundTimers(); if (this.session.current?.status !== 'active') this.session.current = undefined; this.flush(true); }

  close(): void {
    this.clearRoundTimers();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.listeners.clear();
  }

  /** Sends the latest frame to every subscriber now. Round transitions use this with critical=true so they are never skipped. */
  flush(critical = false): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = undefined; }
    this.lastFlushAt = performance.now();
    for (const [view, listeners] of this.listeners) {
      if (!listeners.size) continue;
      const frame = JSON.stringify(view === 'panel' ? this.panelState() : this.snapshot(view));
      for (const listener of listeners) listener(frame, critical);
    }
    if (this.pendingReceipts.length) {
      const sentAt = performance.now();
      for (const receivedAt of this.pendingReceipts) this.options.metrics?.latency.observe((sentAt - receivedAt) / 1000);
      this.pendingReceipts.length = 0;
    }
  }

  /** Coalesces display updates to at most one frame per interval, carrying the latest state. */
  private markDirty(receivedAt?: number): void {
    if (receivedAt !== undefined && this.pendingReceipts.length < MAX_PENDING_RECEIPTS) this.pendingReceipts.push(receivedAt);
    if (this.flushTimer) return;
    const delay = Math.max(0, this.lastFlushAt + this.frameIntervalMs - performance.now());
    this.flushTimer = setTimeout(() => { this.flushTimer = undefined; this.flush(false); }, delay);
  }

  private voteRate(): number {
    const now = performance.now();
    if (now - this.rateWindowStart >= 1000) {
      this.previousRate = now - this.rateWindowStart < 2000 ? this.rateCount : 0;
      this.rateCount = 0;
      this.rateWindowStart = now;
    }
    this.rateCount++;
    return Math.max(this.previousRate, this.rateCount);
  }

  private finishRound(reason: 'lock' | 'skip' | 'timeout' | 'consensus'): void {
    const round = this.session.current;
    if (!round || round.status !== 'active') return;
    this.clearRoundTimers();
    round.finish(this.now(), reason);
    this.session.recordResult(round);
    void this.options.store?.now(this.session);
    this.flush(true);
    this.options.onRoundEvent?.({ type: 'finished', round });
  }

  private scheduleTimeout(delay: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.timeout(), delay);
  }

  /** Keeps exactly one timer aimed at the moment the current consensus hold completes. */
  private scheduleConsensus(): void {
    const due = this.session.current?.consensusDueAt();
    if (due === this.consensusDue) return;
    if (this.consensusTimer) clearTimeout(this.consensusTimer);
    this.consensusTimer = undefined;
    this.consensusDue = due;
    if (due === undefined) return;
    this.consensusTimer = setTimeout(() => {
      this.consensusTimer = undefined;
      this.consensusDue = undefined;
      const current = this.session.current?.consensusDueAt();
      if (current !== undefined && this.now() >= current) this.finishRound('consensus'); else this.scheduleConsensus();
    }, Math.max(0, due - this.now()));
  }

  private clearRoundTimers(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.consensusTimer) clearTimeout(this.consensusTimer);
    this.timer = undefined;
    this.consensusTimer = undefined;
    this.consensusDue = undefined;
  }
}
