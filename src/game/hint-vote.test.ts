import { describe, it, expect, afterEach } from 'vitest';
import { Round } from './round.js';
import { Session } from './session.js';
import { GameController } from '../app/controller.js';
import { parseCommand } from '../app/commands.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';
import { Metrics } from '../obs/metrics.js';

const puzzle = { ...puzzleFixture, hintA: 'A city with a famous iron tower.', hintB: 'A city that hosted the 2024 Summer Olympics.' };
const round = (options = {}) => { const r = new Round(puzzle, { minVotersToWin: 1, ...options }); r.start(0, 90_000); return r; };
const controllers: GameController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.close(); });

describe('!hint vote', () => {
  it('parses !hint for any viewer', () => {
    expect(parseCommand({ channel: 'B', userId: '9', user: 'viewer', text: '!hint' })).toMatchObject({ type: 'hint', channel: 'B', userId: '9' });
    expect(parseCommand({ channel: 'B', userId: '9', user: 'viewer', text: '!hint please' }).type).toBe('ignored');
  });

  it('unlocks one side after three distinct viewers ask, counting each viewer once', () => {
    const r = round();
    expect(r.requestHint('A', '1')).toBe('asked');
    expect(r.requestHint('A', '1')).toBe('repeat');
    expect(r.requestHint('A', '2')).toBe('asked');
    expect(r.requestHint('A', '3')).toBe('unlocked');
    expect(r.requestHint('A', '4')).toBe('already-unlocked');
    expect(r.hintUnlocked).toEqual({ A: true, B: false });
    expect(r.hintsUsed).toBe(1);
  });

  it('scales the threshold with the side voters and keeps one person on one side', () => {
    const r = round();
    for (let i = 0; i < 30; i++) r.vote('B', `b${i}`, 'Rome', 0);
    expect(r.hintNeeded('B')).toBe(6);
    expect(r.hintNeeded('A')).toBe(3);
    expect(r.requestHint('A', 'b1')).toBe('wrong-side');
    r.requestHint('A', 'x');
    expect(r.requestHint('B', 'x')).toBe('wrong-side');
    expect(round({ hintThreshold: 1 }).requestHint('B', 'y')).toBe('unlocked');
  });

  it('is unavailable for a puzzle without a hint and outside an active round', () => {
    const plain = new Round(puzzleFixture, {});
    expect(plain.requestHint('A', '1')).toBe('inactive');
    plain.start(0);
    expect(plain.requestHint('A', '1')).toBe('unavailable');
  });

  it('survives a snapshot and restore', () => {
    const r = round();
    r.requestHint('B', '1');
    r.requestHint('A', '1'.repeat(2));
    const restored = Round.restore(JSON.parse(JSON.stringify(r.serialize())));
    expect(restored.hintAsks.B.has('1')).toBe(true);
    expect(restored.requestHint('B', '1')).toBe('repeat');
  });

  it('drops the win from 3 points to 2 when one side used its hint, and tracks best streak', () => {
    const session = new Session();
    const plainWin = round();
    plainWin.vote('A', '1', 'Paris', 0); plainWin.vote('B', '2', 'Paris', 0); plainWin.finish(1);
    session.recordResult(plainWin);
    const hinted = round({ hintThreshold: 1 });
    hinted.requestHint('A', '1');
    hinted.vote('A', '1', 'Paris', 0); hinted.vote('B', '2', 'Paris', 0); hinted.finish(1);
    session.recordResult(hinted);
    expect(session.scoreboard).toMatchObject({ wins: 2, points: 5, streak: 2, bestStreak: 2 });
  });

  it('shows only the asking side its own hint text, and gives the panel progress without text', () => {
    const controller = new GameController(new Session(), [puzzle], { minVotersToWin: 1 });
    controllers.push(controller);
    controller.startRound();
    for (const id of ['1', '2']) controller.requestHint('A', id);
    expect(controller.snapshot('a').hint).toEqual({ available: true, asks: 2, needed: 3, text: null });
    expect(controller.requestHint('A', '3')).toBe('unlocked');
    expect(controller.snapshot('a').hint.text).toBe(puzzle.hintA);
    expect(controller.snapshot('b').hint).toEqual({ available: true, asks: 0, needed: 3, text: null });
    expect(JSON.stringify(controller.snapshot('b'))).not.toContain(puzzle.hintA);
    const panel = controller.panelState();
    expect(panel.hints.a).toEqual({ available: true, asks: 3, needed: 3, unlocked: true });
    expect(JSON.stringify(panel)).not.toContain(puzzle.hintA);
  });

  it('binds a viewer who asked for one side\'s hint to that side, counted as wrong_side, and keeps the binding across a restart', () => {
    const metrics = new Metrics();
    const controller = new GameController(new Session(), [puzzle], { minVotersToWin: 1, metrics });
    controllers.push(controller);
    controller.startRound();
    expect(controller.requestHint('A', 'asker')).toBe('asked');
    expect(controller.vote('B', 'asker', 'Paris')).toBe('wrong-side');
    expect(controller.activeRound!.voterCount('B')).toBe(0);
    expect(controller.vote('A', 'asker', 'Paris')).toBe('voted');
    expect(metrics.render()).toMatch(/twinclue_votes_total\{result="wrong_side"\} 1/);
    const restored = Round.restore({ ...controller.activeRound!.serialize(), votesB: [['asker', 0]] });
    expect(restored.voterCount('B')).toBe(0);
  });
});
