import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { PuzzleSchema, type Puzzle } from '../puzzle/types.js';
import { silentLog, type Log } from '../obs/log.js';
import type { Metrics } from '../obs/metrics.js';
import { Round, type RoundOptions, type SerializedRound, type SideReveal, type UnscoredReason } from './round.js';

export interface RoundSummary { puzzleId: string; answer: string; status: 'won' | 'timed-out' | 'unscored'; unscoredReason?: UnscoredReason; rehearsal: boolean; startedAt?: number; endedAt?: number; sideA: SideReveal; sideB: SideReveal }

const SideRevealSchema = z.object({ topAnswer: z.string().nullable(), correct: z.boolean(), voters: z.number() });
const RoundSchema = z.object({
  puzzle: PuzzleSchema, status: z.enum(['pending', 'active', 'won', 'timed-out', 'unscored']), startedAt: z.number().optional(), endedAt: z.number().optional(),
  endsAt: z.number().optional(), rehearsal: z.boolean(), buckets: z.array(z.string()), votesA: z.array(z.tuple([z.string(), z.number().int()])),
  votesB: z.array(z.tuple([z.string(), z.number().int()])),
  samples: z.array(z.object({ community: z.enum(['A', 'B']), user: z.string(), label: z.string(), at: z.number() })),
  result: z.object({ A: SideRevealSchema, B: SideRevealSchema }).nullable(), finishReason: z.string().optional(), unscoredReason: z.enum(['not-enough-voters', 'skipped']).optional(),
});
const SessionFileSchema = z.object({
  version: z.literal(2),
  stats: z.object({ rounds: z.number().int().nonnegative(), wins: z.number().int().nonnegative(), streak: z.number().int().nonnegative() }),
  recent: z.array(z.object({ puzzleId: z.string(), answer: z.string(), status: z.enum(['won', 'timed-out', 'unscored']), unscoredReason: z.enum(['not-enough-voters', 'skipped']).optional(), rehearsal: z.boolean(), startedAt: z.number().optional(), endedAt: z.number().optional(), sideA: SideRevealSchema, sideB: SideRevealSchema })),
  current: RoundSchema.nullable(),
});
export type SessionFile = z.infer<typeof SessionFileSchema>;

/** Score, streak, a bounded history and the current round. Nothing in here grows without limit. */
export class Session {
  readonly stats = { rounds: 0, wins: 0, streak: 0 };
  readonly recent: RoundSummary[] = [];
  readonly historyLimit = 50;
  current?: Round;

  get scoreboard(): { rounds: number; wins: number; streak: number } { return { ...this.stats }; }
  get streak(): number { return this.stats.streak; }

  addRound(round: Round): void { this.current = round; }

  /**
   * Rehearsal rounds and unscored rounds (skipped, or not enough voters) never touch the score or the streak.
   * Only a scored round that was not won resets the streak.
   */
  recordResult(round: Round): void {
    if (round.status !== 'won' && round.status !== 'timed-out' && round.status !== 'unscored') return;
    if (!round.rehearsal && round.status !== 'unscored') {
      this.stats.rounds++;
      if (round.status === 'won') { this.stats.wins++; this.stats.streak++; } else this.stats.streak = 0;
    }
    this.recent.push({ puzzleId: round.puzzle.id, answer: round.puzzle.answer, status: round.status, ...(round.unscoredReason ? { unscoredReason: round.unscoredReason } : {}), rehearsal: round.rehearsal, startedAt: round.startedAt, endedAt: round.endedAt,
      sideA: round.result?.A ?? { topAnswer: null, correct: false, voters: 0 }, sideB: round.result?.B ?? { topAnswer: null, correct: false, voters: 0 } });
    if (this.recent.length > this.historyLimit) this.recent.splice(0, this.recent.length - this.historyLimit);
  }

  serialize(): SessionFile {
    return { version: 2, stats: { ...this.stats }, recent: this.recent, current: this.current ? this.current.serialize() as SerializedRound : null };
  }

  static fromFile(data: unknown, roundOptions: (puzzle: Puzzle) => RoundOptions = () => ({})): Session {
    const parsed = SessionFileSchema.parse(data);
    const session = new Session();
    Object.assign(session.stats, parsed.stats);
    session.recent.push(...parsed.recent.slice(-session.historyLimit));
    if (parsed.current) session.current = Round.restore(parsed.current as SerializedRound, roundOptions(parsed.current.puzzle as Puzzle));
    return session;
  }
}

/**
 * Writes the session atomically (temp file then rename) at most once per interval while votes arrive, and
 * immediately on round transitions. The interval stretches to ten times the last write's duration, so a very
 * large vote map cannot keep the event loop busy.
 */
export class SessionStore {
  private writing?: Promise<void>;
  private followUp?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private lastStartAt = 0;
  private lastDurationMs = 0;
  private queued = false;

  constructor(readonly path = 'data/session.json', private readonly log: Log = silentLog, private readonly metrics?: Metrics, readonly minIntervalMs = 1_000) {}

  async load(roundOptions?: (puzzle: Puzzle) => RoundOptions): Promise<Session> {
    let raw: string;
    try { raw = await readFile(this.path, 'utf8'); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Session();
      throw error;
    }
    try {
      return Session.fromFile(JSON.parse(raw), roundOptions);
    } catch (error) {
      const aside = `${this.path}.corrupt-${Date.now()}`;
      await rename(this.path, aside);
      this.log.error({ event: 'session_corrupt', movedTo: aside, reason: error instanceof Error ? error.message.slice(0, 300) : String(error) },
        'SESSION FILE WAS CORRUPT. It was moved aside and a fresh session started. The score and streak were reset.');
      return new Session();
    }
  }

  /** Throttled save for vote changes: write starts are at least one interval apart. */
  request(session: Session): void {
    if (this.timer || this.queued) return;
    const interval = Math.max(this.minIntervalMs, this.lastDurationMs * 10);
    const delay = Math.max(0, this.lastStartAt + interval - Date.now());
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.writing) { void this.now(session); return; }
      this.queued = true;
      void this.writing.finally(() => { this.queued = false; this.request(session); });
    }, delay);
    this.timer.unref?.();
  }

  /** Immediate save for round transitions and shutdown. Concurrent calls coalesce into one extra write. */
  async now(session: Session): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    // A caller arriving mid-write waits for the follow-up write that includes its state, not the older one in flight.
    if (this.writing) {
      this.followUp ??= this.writing.then(() => { this.followUp = undefined; return this.now(session); });
      return this.followUp;
    }
    this.writing = this.write(session).finally(() => { this.writing = undefined; });
    await this.writing;
  }

  private async write(session: Session): Promise<void> {
    const started = performance.now();
    this.lastStartAt = Date.now();
    try {
      const body = JSON.stringify(session.serialize());
      this.metrics?.snapshotBlockingSeconds.observe((performance.now() - started) / 1000);
      await mkdir(dirname(this.path), { recursive: true });
      const temp = `${this.path}.tmp-${process.pid}`;
      await writeFile(temp, body, 'utf8');
      await rename(temp, this.path);
      this.metrics?.snapshots.inc({ result: 'ok' });
    } catch (error) {
      this.metrics?.snapshots.inc({ result: 'error' });
      this.log.error({ event: 'session_save_failed', reason: error instanceof Error ? error.message : String(error) }, 'Could not save the session snapshot.');
    } finally {
      this.lastDurationMs = performance.now() - started;
      this.metrics?.snapshotSeconds.observe(this.lastDurationMs / 1000);
    }
  }

  stop(): void { if (this.timer) clearTimeout(this.timer); this.timer = undefined; }
}
