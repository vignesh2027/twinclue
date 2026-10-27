import { describe, it, expect } from 'vitest';
import { Round, OTHER_LABEL } from './round.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';

const vocabulary = [
  { name: 'Paris', aliases: ['City of Light'] }, { name: 'Rome', aliases: [] }, { name: 'Vienna', aliases: [] },
  { name: 'Prague', aliases: [] }, { name: 'Rouen', aliases: [] }, { name: 'Berlin', aliases: [] },
];
// Most tests use one voter per side, so they lower the minimum; the minimum has its own tests below.
const round = (options = {}) => { const r = new Round(puzzleFixture, { vocabulary, minVotersToWin: 1, ...options }); r.start(0, 90_000); return r; };

describe('community lock-in votes', () => {
  it('wins only when both sides lead with the answer', () => {
    const r = round();
    r.vote('A', '1', 'Paris', 100);
    r.vote('B', '2', 'Rome', 100);
    r.timeout(200);
    expect(r.status).toBe('timed-out');
    const s = round();
    s.vote('A', '1', 'Paris', 100);
    s.vote('B', '2', 'city of light', 200);
    s.timeout(300);
    expect(s.status).toBe('won');
    expect(s.result?.A).toEqual({ topAnswer: 'Paris', correct: true, voters: 1 });
  });

  it('keys viewers by user id, so a renamed viewer still has one vote', () => {
    const r = round();
    r.vote('A', '42', 'Rome', 0, 'OldName');
    r.vote('A', '42', 'Vienna', 5_000, 'NewName');
    expect(r.voterCount('A')).toBe(1);
    expect(r.displayBuckets('A').buckets).toEqual([{ answer: 'Vienna', count: 1 }]);
  });

  it('applies the two second cooldown only to changing a vote', () => {
    const r = round();
    expect(r.vote('A', '1', 'Rome', 0)).toBe('voted');
    expect(r.vote('A', '1', 'Rome', 500)).toBe('unchanged');
    expect(r.vote('A', '1', 'Vienna', 1_999)).toBe('rate-limited');
    expect(r.vote('A', '1', 'Vienna', 2_000)).toBe('voted');
    expect(r.vote('A', '2', 'Vienna', 2_001)).toBe('voted');
    expect(r.vote('A', 'x', 'shit', 3_000)).toBe('blocked');
  });

  it('tracks a unique plurality leader in O(1) through moves and ties', () => {
    const r = round();
    r.vote('A', '1', 'Rome', 0);
    r.vote('A', '2', 'Rome', 0);
    r.vote('A', '3', 'Vienna', 0);
    expect(r.leaderLabel('A')).toBe('Rome');
    r.vote('A', '4', 'Vienna', 0);
    expect(r.leaderLabel('A')).toBeNull();
    r.vote('A', '1', 'Vienna', 5_000);
    expect(r.leaderLabel('A')).toBe('Vienna');
    r.vote('A', '3', 'Prague', 9_000);
    r.vote('A', '2', 'Prague', 9_000);
    expect(r.leaderLabel('A')).toBeNull();
    r.vote('A', '4', 'Prague', 9_000);
    expect(r.leaderLabel('A')).toBe('Prague');
  });

  it('shows only fact-table entities in the vote bars and groups everything else as other answers', () => {
    const r = round();
    r.vote('A', '1', 'Rome', 0);
    r.vote('A', '2', 'my streamer is great', 0);
    r.vote('A', '3', 'buy followers dot com', 0);
    r.vote('A', '4', 'Berln', 0);
    const display = r.displayBuckets('A');
    expect(display.buckets.map(bucket => bucket.answer).sort()).toEqual(['Berlin', 'Rome']);
    expect(display.other).toBe(2);
    expect(r.recentSamples('A').map(sample => sample.label)).toContain(OTHER_LABEL);
    expect(JSON.stringify(r.recentSamples('A'))).not.toContain('followers');
  });

  it('matches close spellings of every entity the same way, so grouping does not reveal the answer', () => {
    const r = round();
    r.vote('A', '1', 'Pariss', 0);
    r.vote('A', '2', 'Romee', 0);
    expect(r.displayBuckets('A').buckets.map(bucket => bucket.answer).sort()).toEqual(['Paris', 'Rome']);
  });

  it('locks on consensus whether the leaders are right or wrong, and never before the minimum votes', () => {
    const r = round();
    for (const id of ['1', '2']) r.vote('A', id, 'Rome', 1_000);
    for (const id of ['3', '4']) r.vote('B', id, 'Rome', 1_000);
    expect(r.consensusDueAt()).toBeUndefined();
    r.vote('A', '5', 'Rome', 1_000);
    r.vote('B', '6', 'Rome', 2_000);
    expect(r.consensusDueAt()).toBe(7_000);
    r.vote('B', '7', 'Vienna', 3_000);
    r.vote('B', '8', 'Vienna', 3_000);
    expect(r.consensusDueAt()).toBe(7_000);
    r.vote('B', '9', 'Vienna', 3_000);
    expect(r.consensusDueAt()).toBeUndefined();
  });

  it('restarts the consensus hold when a side switches leader without dropping below the share', () => {
    const r = round();
    for (const id of ['1', '2', '3']) r.vote('A', id, 'Rome', 1_000);
    r.vote('B', '4', 'Rome', 1_000);
    r.vote('B', '5', 'Rome', 1_000);
    r.vote('B', '6', 'Vienna', 1_000);
    expect(r.consensusDueAt()).toBe(6_000);
    // Rome 2 of 3 becomes Vienna 2 of 3: still 66 percent, but a different answer.
    expect(r.vote('B', '4', 'Vienna', 3_000)).toBe('voted');
    expect(r.consensusDueAt()).toBe(8_000);
  });

  it('round-trips a compact snapshot without losing or doubling a vote', () => {
    const r = round();
    for (let i = 0; i < 50; i++) r.vote(i % 2 ? 'A' : 'B', `u${i}`, i % 3 ? 'Paris' : `nonsense ${i % 5}`, 10);
    const restored = Round.restore(JSON.parse(JSON.stringify(r.serialize())), { vocabulary });
    for (const side of ['A', 'B'] as const) {
      expect(restored.voterCount(side)).toBe(r.voterCount(side));
      expect(restored.displayBuckets(side)).toEqual(r.displayBuckets(side));
    }
    expect(restored.endsAt).toBe(90_000);
    expect(restored.vote('A', 'u1', 'Paris', 10_000)).toBe('unchanged');
  });

  it('refuses a viewer on the other side once they have voted, and never restores them on both', () => {
    const r = round();
    expect(r.vote('A', '7', 'Paris', 0)).toBe('voted');
    expect(r.vote('B', '7', 'Paris', 5_000)).toBe('wrong-side');
    expect(r.voterCount('B')).toBe(0);
    expect(r.vote('A', '7', 'Rome', 5_000)).toBe('voted');
    const saved = r.serialize();
    saved.votesB.push(['7', 0]);
    const restored = Round.restore(saved, { vocabulary });
    expect(restored.voterCount('A') + restored.voterCount('B')).toBe(1);
  });

  it('ends unscored with not enough voters below the per-side minimum (default 2), even when both sides are right', () => {
    const r = new Round(puzzleFixture, { vocabulary });
    r.start(0, 90_000);
    r.vote('A', '1', 'Paris', 0);
    r.vote('A', '2', 'Paris', 0);
    r.vote('B', '3', 'Paris', 0);
    r.timeout(1_000);
    expect(r.status).toBe('unscored');
    expect(r.unscoredReason).toBe('not-enough-voters');
    expect(r.result?.B.correct).toBe(true);
    const enough = new Round(puzzleFixture, { vocabulary });
    enough.start(0, 90_000);
    for (const [side, id] of [['A', '1'], ['A', '2'], ['B', '3'], ['B', '4']] as const) enough.vote(side, id, 'Paris', 0);
    enough.timeout(1_000);
    expect(enough.status).toBe('won');
    const strict = new Round(puzzleFixture, { vocabulary, minVotersToWin: 3 });
    strict.start(0, 90_000);
    for (const [side, id] of [['A', '1'], ['A', '2'], ['B', '3'], ['B', '4']] as const) strict.vote(side, id, 'Paris', 0);
    strict.lock(1_000);
    expect(strict.status).toBe('unscored');
  });

  it('records a skip as unscored, whatever the votes say', () => {
    const r = round();
    r.vote('A', '1', 'Paris', 0);
    r.vote('B', '2', 'Paris', 0);
    r.finish(1_000, 'skip');
    expect(r.status).toBe('unscored');
    expect(r.unscoredReason).toBe('skipped');
  });
});
