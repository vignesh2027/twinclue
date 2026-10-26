import {describe,it,expect} from 'vitest';
import {GameController} from './controller.js';
import {Session} from '../game/session.js';
import {puzzleFixture} from '../test/puzzle-fixture.js';

describe('demo fallback marking',()=>{
 it('labels the unaudited demo-only puzzle in overlay state',()=>{const puzzle={...puzzleFixture,id:'demo-fixture'};const controller=new GameController(new Session(),[puzzle],true,()=>1_000,false);controller.startRound();expect(controller.snapshot('a').unauditedDemo).toBe(true);controller.close();});
 it('does not label audited pack puzzles as unaudited',()=>{const controller=new GameController(new Session(),[puzzleFixture],true,()=>1_000,false);controller.startRound();expect(controller.snapshot('a').unauditedDemo).toBe(false);controller.close();});
});
