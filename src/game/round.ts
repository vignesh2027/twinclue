import type { Puzzle } from '../puzzle/types.js';
import { normaliseGuess } from './referee.js';
import { Vocabulary, type VocabEntry } from './vocabulary.js';

export type Community = 'A' | 'B';
export type RoundStatus = 'pending' | 'active' | 'won' | 'timed-out' | 'unscored';
export type UnscoredReason = 'not-enough-voters' | 'skipped';
export type HintResult = 'inactive' | 'unavailable' | 'wrong-side' | 'already-unlocked' | 'repeat' | 'asked' | 'unlocked';
export const DEFAULT_HINT_THRESHOLD = 3;
export type VoteResult = 'voted' | 'unchanged' | 'blocked' | 'rate-limited' | 'inactive' | 'wrong-side';
export interface VoteSample { community: Community; user: string; label: string; at: number }
export interface VoteBucket { answer: string; count: number }
export interface SideReveal { topAnswer: string | null; correct: boolean; voters: number }
export interface ConsensusRule { share: number; holdMs: number; minVotes: number }
export interface RoundOptions { vocabulary?: VocabEntry[]; cooldownMs?: number; consensus?: Partial<ConsensusRule>; rehearsal?: boolean; sampleTicker?: boolean;
  /** A round with fewer voters than this on either side ends unscored as "not enough voters". */
  minVotersToWin?: number;
  /** Distinct viewers on one side who must ask (!hint) to unlock that side's hint; scaled up with the side's voters. */
  hintThreshold?: number }

export const OTHER_LABEL = 'other answers';
export const DEFAULT_CONSENSUS: ConsensusRule = { share: 0.6, holdMs: 5_000, minVotes: 3 };
export const DEFAULT_MIN_VOTERS_TO_WIN = 2;
const MAX_VOTE_CHARS = 200;
const blockedWords = ['fuck', 'shit', 'bitch', 'cunt', 'nigger', 'faggot'];
const blockedPattern = new RegExp(`\\b(${blockedWords.join('|')})\\b`, 'i');

export function isBlockedGuess(value: string): boolean {
  return blockedPattern.test(value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase());
}
export function cleanVoteText(value: string, maxLength = 80): string {
  return value.slice(0, MAX_VOTE_CHARS).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

/** One community's tally. Every operation is O(1): counts are indexed by value so the leader is always known. */
class SideTally {
  readonly votes = new Map<string, string>();
  readonly counts = new Map<string, number>();
  private readonly byCount = new Map<number, Set<string>>();
  max = 0;

  add(bucket: string): void {
    const count = this.counts.get(bucket) ?? 0;
    if (count) this.unindex(bucket, count);
    this.index(bucket, count + 1);
    this.counts.set(bucket, count + 1);
    if (count + 1 > this.max) this.max = count + 1;
  }
  remove(bucket: string): void {
    const count = this.counts.get(bucket) ?? 0;
    if (!count) return;
    this.unindex(bucket, count);
    if (count > 1) { this.index(bucket, count - 1); this.counts.set(bucket, count - 1); } else this.counts.delete(bucket);
    if (count === this.max && !this.byCount.has(count)) this.max = count - 1;
  }
  /** The bucket with strictly the most votes, or null on a tie or an empty side. */
  leader(): string | null {
    const top = this.byCount.get(this.max);
    if (!top || top.size !== 1) return null;
    return top.values().next().value ?? null;
  }
  private index(bucket: string, count: number): void {
    let set = this.byCount.get(count);
    if (!set) { set = new Set(); this.byCount.set(count, set); }
    set.add(bucket);
  }
  private unindex(bucket: string, count: number): void {
    const set = this.byCount.get(count);
    set?.delete(bucket);
    if (set && !set.size) this.byCount.delete(count);
  }
}

export interface SerializedRound {
  puzzle: Puzzle; status: RoundStatus; startedAt?: number; endedAt?: number; endsAt?: number; rehearsal: boolean;
  buckets: string[]; votesA: Array<[string, number]>; votesB: Array<[string, number]>;
  samples: VoteSample[]; result: Record<Community, SideReveal> | null; finishReason?: string; unscoredReason?: UnscoredReason;
  hintAsks?: Record<Community, string[]>; hintUnlocked?: Record<Community, boolean>; swapCueAt?: number;
}

export class Round {
  status: RoundStatus = 'pending';
  startedAt?: number;
  endedAt?: number;
  endsAt?: number;
  consensusSince?: number;
  /** Server time the swap banner fired this round, if it has. */
  swapCueAt?: number;
  private consensusLeaders?: string;
  finishReason?: 'timeout' | 'lock' | 'consensus' | 'skip';
  unscoredReason?: UnscoredReason;
  readonly minVotersToWin: number;
  readonly hintThreshold: number;
  readonly hintAsks: Record<Community, Set<string>> = { A: new Set(), B: new Set() };
  readonly hintUnlocked: Record<Community, boolean> = { A: false, B: false };
  /** Display names by viewer id, for the session recap's top voters. Never shown on the overlay. */
  private readonly names: Record<Community, Map<string, string>> = { A: new Map(), B: new Map() };
  result: Record<Community, SideReveal> | null = null;
  readonly rehearsal: boolean;
  readonly vocabulary: Vocabulary;
  readonly sampleLimit = 80;
  private readonly tallies: Record<Community, SideTally> = { A: new SideTally(), B: new SideTally() };
  private readonly lastChange = new Map<string, number>();
  private readonly samples: VoteSample[] = [];
  private sampleHead = 0;
  private readonly cooldownMs: number;
  readonly consensus: ConsensusRule;

  constructor(readonly puzzle: Puzzle, options: RoundOptions = {}) {
    const fallback = [...(puzzle.alsoFitsA ?? puzzle.halfAAlsoFits), ...(puzzle.alsoFitsB ?? puzzle.halfBAlsoFits)].map(name => ({ name, aliases: [] }));
    this.vocabulary = new Vocabulary({ name: puzzle.answer, aliases: puzzle.aliases }, options.vocabulary ?? fallback);
    this.cooldownMs = options.cooldownMs ?? 2_000;
    this.consensus = { ...DEFAULT_CONSENSUS, ...options.consensus };
    this.rehearsal = options.rehearsal ?? false;
    this.minVotersToWin = Math.max(1, options.minVotersToWin ?? DEFAULT_MIN_VOTERS_TO_WIN);
    this.hintThreshold = Math.max(1, options.hintThreshold ?? DEFAULT_HINT_THRESHOLD);
  }

  start(at = Date.now(), durationMs?: number): void {
    if (this.status !== 'pending') throw new Error('Round has already started.');
    this.status = 'active';
    this.startedAt = at;
    if (durationMs !== undefined) this.endsAt = at + durationMs;
  }

  /** Records a viewer's vote. userId is the stable Twitch chatter_user_id; displayName is only shown in the ticker. */
  vote(community: Community, userId: string, text: string, at = Date.now(), displayName = userId, sample = true): VoteResult {
    if (this.status !== 'active') return 'inactive';
    const clean = cleanVoteText(text);
    if (!clean || isBlockedGuess(clean)) return 'blocked';
    const normalised = normaliseGuess(clean);
    if (!normalised) return 'blocked';
    // One person, one side: a viewer who voted for, or asked for the hint of, one community cannot vote for the other.
    const other = community === 'A' ? 'B' : 'A';
    if (this.tallies[other].votes.has(userId) || this.hintAsks[other].has(userId)) return 'wrong-side';
    const tally = this.tallies[community];
    const current = tally.votes.get(userId);
    const bucket = this.vocabulary.match(normalised) ?? `t:${normalised}`;
    this.names[community].set(userId, cleanVoteText(displayName, 24) || 'viewer');
    if (current === bucket) { if (sample) this.sample(community, displayName, bucket, at); return 'unchanged'; }
    const changeKey = `${community}:${userId}`;
    if (current !== undefined) {
      const last = this.lastChange.get(changeKey);
      if (last !== undefined && at - last < this.cooldownMs) return 'rate-limited';
      tally.remove(current);
    }
    tally.votes.set(userId, bucket);
    tally.add(bucket);
    this.lastChange.set(changeKey, at);
    if (sample) this.sample(community, displayName, bucket, at);
    this.updateConsensus(at);
    return 'voted';
  }

  label(bucket: string): string { return this.vocabulary.label(bucket) ?? OTHER_LABEL; }
  voterCount(community: Community): number { return this.tallies[community].votes.size; }
  /** The display label of one viewer's current vote (an entity name or "other answers"), or undefined. */
  voteLabel(community: Community, userId: string): string | undefined { const bucket = this.tallies[community].votes.get(userId); return bucket === undefined ? undefined : this.label(bucket); }
  leaderLabel(community: Community): string | null { const leader = this.tallies[community].leader(); return leader === null ? null : this.label(leader); }

  /** Vote bars: only entities from the round's fact table, everything else summed as one "other answers" figure. */
  displayBuckets(community: Community, limit = 3): { buckets: VoteBucket[]; other: number } {
    const tally = this.tallies[community];
    const known: VoteBucket[] = [];
    let knownVotes = 0;
    for (const [bucket, count] of tally.counts) {
      if (!this.vocabulary.has(bucket)) continue;
      known.push({ answer: this.vocabulary.label(bucket)!, count });
      knownVotes += count;
    }
    known.sort((a, b) => b.count - a.count || a.answer.localeCompare(b.answer));
    return { buckets: known.slice(0, limit), other: tally.votes.size - knownVotes };
  }

  /** The last few ticker samples for one side, oldest first. */
  recentSamples(community?: Community, limit = this.sampleLimit): VoteSample[] {
    const ordered = this.samples.length < this.sampleLimit ? this.samples : [...this.samples.slice(this.sampleHead), ...this.samples.slice(0, this.sampleHead)];
    const filtered = community ? ordered.filter(sample => sample.community === community) : ordered;
    return filtered.slice(-limit);
  }

  private sample(community: Community, user: string, bucket: string, at: number): void {
    const entry: VoteSample = { community, user: cleanVoteText(user, 24) || 'viewer', label: this.label(bucket), at };
    if (this.samples.length < this.sampleLimit) this.samples.push(entry);
    else { this.samples[this.sampleHead] = entry; this.sampleHead = (this.sampleHead + 1) % this.sampleLimit; }
  }

  /**
   * Consensus lock: both sides have a unique leader holding at least `share` of their side's votes, with at least
   * `minVotes` voters. Correctness is never consulted here, so an early lock does not reveal anything.
   */
  private consensusHolds(): boolean {
    for (const community of ['A', 'B'] as const) {
      const tally = this.tallies[community];
      const voters = tally.votes.size;
      if (voters < this.consensus.minVotes || tally.leader() === null || tally.max / voters < this.consensus.share) return false;
    }
    return true;
  }
  /** The hold restarts when either side's leader changes, so the lock always means the same two answers for the full hold. */
  private updateConsensus(at: number): void {
    const leaders = this.consensusHolds() ? `${this.tallies.A.leader()}\u0000${this.tallies.B.leader()}` : undefined;
    if (leaders === undefined) this.consensusSince = undefined;
    else if (leaders !== this.consensusLeaders || this.consensusSince === undefined) this.consensusSince = at;
    this.consensusLeaders = leaders;
  }
  refreshConsensus(at = Date.now()): void { if (this.status === 'active') this.updateConsensus(at); }
  /** When the consensus lock is due, or undefined if consensus does not currently hold. */
  consensusDueAt(): number | undefined {
    return this.status === 'active' && this.consensusSince !== undefined ? this.consensusSince + this.consensus.holdMs : undefined;
  }

  finish(at = Date.now(), reason: Round['finishReason'] = 'timeout'): void {
    if (this.status !== 'active') return;
    const answer = this.vocabulary.answerKey;
    const side = (community: Community): SideReveal => {
      const leader = this.tallies[community].leader();
      return { topAnswer: leader === null ? null : this.label(leader), correct: leader === answer, voters: this.voterCount(community) };
    };
    this.result = { A: side('A'), B: side('B') };
    const tooFew = this.result.A.voters < this.minVotersToWin || this.result.B.voters < this.minVotersToWin;
    this.unscoredReason = reason === 'skip' ? 'skipped' : tooFew ? 'not-enough-voters' : undefined;
    this.status = this.unscoredReason ? 'unscored' : this.result.A.correct && this.result.B.correct ? 'won' : 'timed-out';
    this.endedAt = at;
    this.finishReason = reason;
    this.consensusSince = undefined;
    this.lastChange.clear();
  }
  lock(at = Date.now()): void { this.finish(at, 'lock'); }
  timeout(at = Date.now()): void { this.finish(at, 'timeout'); }

  hintText(community: Community): string | undefined { return community === 'A' ? this.puzzle.hintA : this.puzzle.hintB; }
  /** At least the base threshold, rising with the side's voter count (one fifth of them). */
  hintNeeded(community: Community): number { return Math.max(this.hintThreshold, Math.ceil(this.voterCount(community) * 0.2)); }
  get hintsUsed(): number { return Number(this.hintUnlocked.A) + Number(this.hintUnlocked.B); }

  /** One !hint request. Each viewer counts once, and only for the community they belong to this round. */
  requestHint(community: Community, userId: string): HintResult {
    if (this.status !== 'active') return 'inactive';
    if (!this.hintText(community)) return 'unavailable';
    if (this.hintUnlocked[community]) return 'already-unlocked';
    if (this.tallies[community === 'A' ? 'B' : 'A'].votes.has(userId) || this.hintAsks[community === 'A' ? 'B' : 'A'].has(userId)) return 'wrong-side';
    const asks = this.hintAsks[community];
    if (asks.has(userId)) return 'repeat';
    asks.add(userId);
    if (asks.size < this.hintNeeded(community)) return 'asked';
    this.hintUnlocked[community] = true;
    return 'unlocked';
  }

  /** Each voter's display name and whether their final vote was right, per side. */
  voterOutcomes(): Record<Community, Array<{ name: string; correct: boolean }>> {
    const answer = this.vocabulary.answerKey;
    const side = (community: Community) => [...this.tallies[community].votes].map(([user, bucket]) => ({ name: this.names[community].get(user) ?? 'viewer', correct: bucket === answer }));
    return { A: side('A'), B: side('B') };
  }

  get solveTimeMs(): number | undefined { return this.startedAt === undefined || this.endedAt === undefined ? undefined : this.endedAt - this.startedAt; }

  /** Compact snapshot: each vote is [userId, bucket index], so 100,000 votes stay a few megabytes. */
  serialize(includeVotes = this.status === 'active'): SerializedRound {
    const buckets: string[] = [];
    const indexOf = new Map<string, number>();
    const pack = (community: Community): Array<[string, number]> => {
      if (!includeVotes) return [];
      const out: Array<[string, number]> = [];
      for (const [user, bucket] of this.tallies[community].votes) {
        let index = indexOf.get(bucket);
        if (index === undefined) { index = buckets.length; buckets.push(this.vocabulary.has(bucket) ? `=${this.label(bucket)}` : bucket); indexOf.set(bucket, index); }
        out.push([user, index]);
      }
      return out;
    };
    const votesA = pack('A');
    const votesB = pack('B');
    return { puzzle: this.puzzle, status: this.status, startedAt: this.startedAt, endedAt: this.endedAt, endsAt: this.endsAt, rehearsal: this.rehearsal,
      buckets, votesA, votesB, samples: this.recentSamples(), result: this.result, finishReason: this.finishReason, unscoredReason: this.unscoredReason,
      hintAsks: { A: [...this.hintAsks.A], B: [...this.hintAsks.B] }, hintUnlocked: { ...this.hintUnlocked }, swapCueAt: this.swapCueAt };
  }

  static restore(saved: SerializedRound, options: RoundOptions = {}): Round {
    const round = new Round(saved.puzzle, { ...options, rehearsal: saved.rehearsal });
    round.status = saved.status;
    round.startedAt = saved.startedAt;
    round.endedAt = saved.endedAt;
    round.endsAt = saved.endsAt;
    round.result = saved.result;
    round.finishReason = saved.finishReason as Round['finishReason'];
    round.unscoredReason = saved.unscoredReason;
    round.swapCueAt = saved.swapCueAt;
    for (const community of ['A', 'B'] as const) {
      for (const user of saved.hintAsks?.[community] ?? []) round.hintAsks[community].add(user);
      round.hintUnlocked[community] = Boolean(saved.hintUnlocked?.[community]);
    }
    // Entity buckets are stored by name, not by key, so a changed fact table cannot misfile a restored vote.
    const buckets = saved.buckets.map(bucket => {
      if (!bucket.startsWith('=')) return bucket;
      const normalised = normaliseGuess(bucket.slice(1));
      return round.vocabulary.match(normalised) ?? `t:${normalised}`;
    });
    for (const [community, votes] of [['A', saved.votesA], ['B', saved.votesB]] as const) {
      const tally = round.tallies[community];
      for (const [user, index] of votes) {
        const bucket = buckets[index];
        const other = community === 'A' ? 'B' : 'A';
        if (bucket === undefined || tally.votes.has(user) || round.tallies[other].votes.has(user) || round.hintAsks[other].has(user)) continue;
        tally.votes.set(user, bucket);
        tally.add(bucket);
      }
    }
    for (const sample of saved.samples.slice(-round.sampleLimit)) round.samples.push(sample);
    return round;
  }
}
