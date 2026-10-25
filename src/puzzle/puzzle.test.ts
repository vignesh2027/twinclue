import { describe,it,expect } from 'vitest';
import { puzzlePack } from './pack.js';
import { validatePuzzle } from './validate.js';
import { judgeGuess } from '../game/referee.js';
describe('puzzle pack',()=>{it('contains at least 40 fair puzzles',()=>{expect(puzzlePack.length).toBeGreaterThanOrEqual(40);for(const puzzle of puzzlePack)expect(validatePuzzle(puzzle),puzzle.id).toEqual([]);});});
describe('referee',()=>{it('accepts accents, articles, and small typos',()=>{expect(judgeGuess('the cafe','café')).toBe('accepted');expect(judgeGuess('Pariss','Paris')).toBe('accepted');expect(judgeGuess('Jupitr','Jupiter')).toBe('accepted');});it('marks close guesses unclear',()=>{expect(judgeGuess('Jupitezzz','Jupiter')).toBe('unclear');});});
