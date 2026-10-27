import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameController, type OverlayState, type PanelState } from './controller.js';
import { Session } from '../game/session.js';
import { Round } from '../game/round.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';
import { Metrics } from '../obs/metrics.js';

const vocabularies = new Map([['fixture', [{ name: 'Paris', aliases: [] }, { name: 'Rome', aliases: [] }, { name: 'Vienna', aliases: [] }]]]);
const puzzle = { ...puzzleFixture, sourceTable: 'fixture' };
const controllers: GameController[] = [];
function make(options: ConstructorParameters<typeof GameController>[2] = {}, session = new Session()) {
  const controller = new GameController(session, [puzzle], { vocabularies, ...options });
  controllers.push(controller);
  return controller;
}
afterEach(() => { for (const controller of controllers.splice(0)) controller.close(); vi.useRealTimers(); });

describe('game controller', () => {
  it('labels only demo-only puzzles as unaudited', () => {
    const demo = new GameController(new Session(), [{ ...puzzleFixture, id: 'demo-fixture' }], { demo: true });
    demo.startRound();
    expect(demo.snapshot('a').unauditedDemo).toBe(true);
    demo.close();
    const audited = make({ demo: true });
    audited.startRound();
    expect(audited.snapshot('a').unauditedDemo).toBe(false);
  });

  it('coalesces vote frames to one per interval but sends round transitions at once', async () => {
    const controller = make({ frameIntervalMs: 50 });
    const frames: Array<{ state: OverlayState; critical: boolean }> = [];
    controller.subscribe('a', (frame, critical) => frames.push({ state: JSON.parse(frame), critical }));
    frames.length = 0;
    controller.startRound();
    expect(frames).toHaveLength(1);
    expect(frames[0]!.critical).toBe(true);
    for (let i = 0; i < 200; i++) controller.vote('A', `u${i}`, i % 2 ? 'Rome' : 'Paris');
    expect(frames).toHaveLength(1);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(frames).toHaveLength(2);
    expect(frames[1]!.state.voters).toBe(200);
    controller.lockRound();
    expect(frames).toHaveLength(3);
    expect(frames[2]!.state.reveal?.answer).toBe('Paris');
  });

  it('never sends the answer key, the other half, or raw chat text in an active overlay frame', () => {
    const controller = make();
    const round = controller.startRound();
    controller.vote('A', '1', 'Paris', { displayName: 'alice' });
    controller.vote('A', '2', 'visit my channel', { displayName: 'spam' });
    const frame = JSON.stringify(controller.snapshot('a'));
    expect(frame).toContain(round.puzzle.halfA);
    expect(frame).not.toContain(round.puzzle.halfB);
    expect(frame).not.toContain('__answer__');
    expect(frame).not.toContain('visit my channel');
    expect(controller.snapshot('a').otherVotes).toBe(1);
  });

  it('never gives the panel either clue half', () => {
    const controller = make();
    const round = controller.startRound();
    let panel: PanelState | undefined;
    controller.subscribe('panel', frame => { panel = JSON.parse(frame); });
    const text = JSON.stringify(panel);
    expect(panel?.type).toBe('panel-state');
    expect(text).not.toContain(round.puzzle.halfA);
    expect(text).not.toContain(round.puzzle.halfB);
    expect(text).not.toContain(round.puzzle.answer);
  });

  it('locks on consensus after the hold and reveals a wrong consensus as not right', async () => {
    const controller = make({ consensus: { holdMs: 30, minVotes: 2 } });
    controller.startRound();
    for (const id of ['1', '2']) controller.vote('A', id, 'Rome');
    for (const id of ['3', '4']) controller.vote('B', id, 'Rome');
    expect(controller.activeRound?.status).toBe('active');
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(controller.activeRound?.status).toBe('timed-out');
    expect(controller.activeRound?.finishReason).toBe('consensus');
    expect(controller.snapshot('a').reveal?.sideA).toEqual({ topAnswer: 'Rome', correct: false, voters: 2 });
  });

  it('resumes a restored round with its real remaining time, not a fresh default length', () => {
    vi.useFakeTimers();
    let now = 1_000_000;
    const session = new Session();
    const round = new Round(puzzle);
    round.start(now - 250_000, 300_000);
    round.vote('A', '1', 'Paris', now - 1000);
    session.addRound(round);
    const controller = make({ now: () => now }, session);
    expect(controller.snapshot('a').endsAt).toBe(1_050_000);
    now += 49_000;
    vi.advanceTimersByTime(49_000);
    expect(controller.activeRound?.status).toBe('active');
    now += 1_100;
    vi.advanceTimersByTime(1_100);
    expect(controller.activeRound?.status).toBe('timed-out');
  });

  it('feeds rehearsal votes into community B, labels them, and keeps them out of the score', () => {
    const metrics = new Metrics();
    const controller = make({ metrics });
    expect(() => controller.rehearsalVote('Paris')).toThrow(/off/);
    controller.setRehearsal(true);
    controller.startRound();
    controller.vote('A', '1', 'Paris');
    expect(controller.rehearsalVote('Paris')).toBe('voted');
    expect(controller.snapshot('b').rehearsal).toBe(true);
    expect(controller.snapshot('a').rehearsal).toBe(true);
    expect(controller.panelState().rehearsal).toBe(true);
    controller.lockRound();
    expect(controller.activeRound?.status).toBe('won');
    expect(controller.session.scoreboard.wins).toBe(0);
    expect(metrics.votes.get({ result: 'voted' })).toBe(2);
  });

  it('refuses rehearsal votes in a real round when rehearsal is switched on mid-round', () => {
    const controller = make();
    controller.startRound();
    controller.vote('A', '1', 'Paris');
    controller.setRehearsal(true);
    expect(() => controller.rehearsalVote('Paris')).toThrow(/counts for real/);
    expect(controller.activeRound!.voterCount('B')).toBe(0);
    expect(controller.snapshot('a').rehearsal).toBe(false);
    controller.lockRound();
    expect(controller.session.scoreboard).toMatchObject({ rounds: 1, wins: 0 });
  });
});
