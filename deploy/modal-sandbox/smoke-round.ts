// Plays one full sandbox round against a deployed sandbox, the way public/sandbox.js does:
// cookie from the page, same-origin JSON POSTs, both overlays over WebSocket.
// Usage: npx tsx deploy/modal-sandbox/smoke-round.ts https://your-sandbox-url
import WebSocket from 'ws';
import { puzzlePack } from '../../src/puzzle/pack.js';
const U = process.argv[2];
const t0 = Date.now(); const ms = () => `${Date.now() - t0} ms`;
const page = await fetch(U + '/');
const cookie = page.headers.get('set-cookie')!.split(';')[0];
console.log('page', page.status, ms());
const H = { origin: U, cookie, 'content-type': 'application/json' };
// The browser loads both overlay pages (iframes) before their sockets open; that is what creates the game.
for (const side of ['a', 'b']) console.log('overlay page', side, (await fetch(`${U}/overlay/${side}`, { headers: { cookie } })).status, ms());
const post = async (path: string, body: unknown) => { const r = await fetch(U + path, { method: 'POST', headers: H, body: JSON.stringify(body) }); const j = await r.json(); console.log('POST', path, JSON.stringify(body), r.status, j.state?.roundStatus ?? j.error, ms()); return j; };
const last: Record<string, any> = {};
const sockets = ['a', 'b'].map(side => { const ws = new WebSocket(U.replace('https', 'wss') + '/sandbox/ws/' + side, { headers: { origin: U, cookie } }); ws.on('message', m => { const f = JSON.parse(String(m)); last[side] = f; }); return ws; });
await Promise.all(sockets.map(ws => new Promise(r => ws.on('open', r))));
console.log('both overlay sockets open', ms());
await post('/sandbox/api/start', {});
await new Promise(r => setTimeout(r, 800));
const halfA = last.a.half, halfB = last.b.half;
console.log('overlay A half:', halfA, '| overlay B half:', halfB);
const puzzle = puzzlePack.find(p => p.halfA === halfA && p.halfB === halfB)!;
const wrongA = puzzle.halfAAlsoFits.find(x => x !== puzzle.answer)!;
await post('/sandbox/api/vote', { side: 'A', text: wrongA });
await post('/sandbox/api/hint', { side: 'B' });
await new Promise(r => setTimeout(r, 500));
console.log('B hint on overlay:', last.b.hint?.text);
await post('/sandbox/api/vote', { side: 'A', text: puzzle.answer });
await post('/sandbox/api/vote', { side: 'A', text: puzzle.answer });
await post('/sandbox/api/vote', { side: 'B', text: puzzle.answer });
await post('/sandbox/api/lock', {});
await new Promise(r => setTimeout(r, 1000));
console.log('final overlay A:', last.a.roundStatus, 'answer', last.a.answer ?? last.a.reveal?.answer ?? '(see frame)', 'scoreboard', JSON.stringify(last.a.scoreboard));
console.log('final overlay B:', last.b.roundStatus, 'scoreboard', JSON.stringify(last.b.scoreboard));
sockets.forEach(ws => ws.close());
