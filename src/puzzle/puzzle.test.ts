import { describe,it,expect } from 'vitest';
import { puzzlePack } from './pack.js';
import { validatePuzzle } from './validate.js';
import { judgeGuess } from '../game/referee.js';
describe('puzzle pack',()=>{it('contains 60 fair puzzles with unique ids and meaningful alternatives',()=>{expect(puzzlePack).toHaveLength(60);expect(new Set(puzzlePack.map(p=>p.id)).size).toBe(60);for(const puzzle of puzzlePack){expect(validatePuzzle(puzzle),puzzle.id).toEqual([]);expect(puzzle.halfAAlsoFits.length).toBeGreaterThanOrEqual(2);expect(puzzle.halfBAlsoFits.length).toBeGreaterThanOrEqual(2);}});});
describe('referee',()=>{it('accepts accents, articles, and small typos',()=>{expect(judgeGuess('the cafe','café')).toBe('accepted');expect(judgeGuess('Pariss','Paris')).toBe('accepted');expect(judgeGuess('Jupitr','Jupiter')).toBe('accepted');});it('marks close guesses unclear',()=>{expect(judgeGuess('Jupitezzz','Jupiter')).toBe('unclear');});});
