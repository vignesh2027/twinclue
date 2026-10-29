import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { GameController } from './controller.js';
import { Session } from '../game/session.js';
import { forgedPack } from '../puzzle/forged-pack.js';
import { isVideoSafe } from '../puzzle/showcase.js';
import { puzzleFixture } from '../test/puzzle-fixture.js';

const controllers: GameController[] = [];
afterEach(() => { for (const controller of controllers.splice(0)) controller.close(); vi.useRealTimers(); });
const make = (options: ConstructorParameters<typeof GameController>[2] = {}, pack = [puzzleFixture]) => {
  const controller = new GameController(new Session(), pack, { minVotersToWin: 1, ...options });
  controllers.push(controller);
  return controller;
};

describe('the swap moment', () => {
  it('fires once, the moment the two chats lead with different answers, with the same server time on both overlays', () => {
    let now = 1_000;
    const controller = make({ now: () => now });
    controller.startRound();
    controller.vote('A', '1', 'Rome');
    expect(controller.snapshot('a').swapCue).toBeNull();
    now = 4_000;
    controller.vote('B', '2', 'Vienna');
    expect(controller.snapshot('a').swapCue).toEqual({ at: 4_000, until: 8_000 });
    expect(controller.snapshot('b').swapCue).toEqual(controller.snapshot('a').swapCue);
    now = 6_000;
    controller.vote('B', '3', 'Prague');
    controller.vote('B', '4', 'Prague');
    expect(controller.snapshot('b').swapCue?.at).toBe(4_000);
  });

  it('fires about 15 seconds in when the chats have not disagreed yet, and never after the round ends', () => {
    vi.useFakeTimers();
    let now = 0;
    const controller = make({ now: () => now });
    controller.startRound();
    now = 14_000; vi.advanceTimersByTime(14_000);
    expect(controller.snapshot('a').swapCue).toBeNull();
    now = 15_000; vi.advanceTimersByTime(1_000);
    expect(controller.snapshot('a').swapCue).toEqual({ at: 15_000, until: 19_000 });
    controller.lockRound();
    expect(controller.snapshot('a').swapCue).toBeNull();
  });

  it('stamps the reveal with the server end time so both celebrations start together', () => {
    let now = 50;
    const controller = make({ now: () => now });
    controller.startRound();
    for (const side of ['A', 'B'] as const) controller.vote(side, side, 'Paris');
    now = 9_000;
    controller.lockRound();
    expect(controller.snapshot('a').reveal?.revealAt).toBe(9_000);
    expect(controller.snapshot('b').reveal?.revealAt).toBe(9_000);
  });

  it('overlay script schedules the banner and the centre stage from server time', () => {
    const script = readFileSync('public/overlay.js', 'utf8');
    expect(script).toMatch(/const startAt = \(reveal\.revealAt \?\? serverNow\) \+ REVEAL_BEAT_MS;/);
    expect(script).toMatch(/now >= cueWindow\.at && now < cueWindow\.until/);
    expect(readFileSync('public/overlay.html', 'utf8')).toContain('SWAP CLUES');
  });
});

describe('video-safe rounds', () => {
  it('only deals puzzles from non-trademark tables when video-safe is on, and can be switched', () => {
    const controller = make({ videoSafe: true }, forgedPack);
    for (let i = 0; i < 40; i++) {
      const round = controller.startRound();
      expect(isVideoSafe(round.puzzle), round.puzzle.answer).toBe(true);
      controller.skipRound();
    }
    expect(controller.panelState().options.categories).not.toContain('games');
    controller.setVideoSafe(false);
    expect(controller.panelState().options.categories).toContain('games');
    expect(controller.panelState().videoSafe).toBe(false);
  });
});
