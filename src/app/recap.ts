import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { Session } from '../game/session.js';

const VoterSchema = z.object({ name: z.string(), correct: z.number(), rounds: z.number() });
const MomentSchema = z.object({ community: z.enum(['A', 'B']), setSize: z.number(), examples: z.array(z.string()), answer: z.string(), won: z.boolean() });
export const RecapSchema = z.object({
  id: z.string(), createdAt: z.number(), rounds: z.number(), wins: z.number(), points: z.number(), bestStreak: z.number(),
  fastest: z.object({ answer: z.string(), ms: z.number() }).nullable(),
  topVoters: z.object({ A: z.array(VoterSchema), B: z.array(VoterSchema) }),
  moments: z.array(MomentSchema),
});
export type Recap = z.infer<typeof RecapSchema>;

const ID_PATTERN = /^[a-f0-9]{12}$/;
export const newRecapId = () => randomBytes(6).toString('hex');

/** Everything a recap shows comes from the session's bounded history and voter table: display names only. */
export function buildRecap(session: Session, id: string, now = Date.now()): Recap {
  const scored = session.recent.filter(round => !round.rehearsal);
  const wins = scored.filter(round => round.status === 'won' && round.startedAt !== undefined && round.endedAt !== undefined);
  const fastest = wins.reduce<{ answer: string; ms: number } | null>((best, round) => {
    const ms = round.endedAt! - round.startedAt!;
    return !best || ms < best.ms ? { answer: round.answer, ms } : best;
  }, null);
  const top = (community: 'A' | 'B') => Session.rankVoters(session.voters[community]).slice(0, 5).map(([name, row]) => ({ name, correct: row.correct, rounds: row.rounds }));
  // The aha moments: the halves that alone allowed the most answers, from rounds that were played for real.
  const moments = scored.flatMap(round => (['A', 'B'] as const).flatMap(community => {
    const setSize = community === 'A' ? round.setSizeA : round.setSizeB;
    const examples = (community === 'A' ? round.alsoFitsA : round.alsoFitsB) ?? [];
    return setSize ? [{ community, setSize, examples: examples.slice(0, 3), answer: round.answer, won: round.status === 'won' }] : [];
  })).sort((a, b) => b.setSize - a.setSize || Number(b.won) - Number(a.won)).slice(0, 3);
  return { id, createdAt: now, rounds: session.stats.rounds, wins: session.stats.wins, points: session.stats.points, bestStreak: session.stats.bestStreak, fastest,
    topVoters: { A: top('A'), B: top('B') }, moments };
}

export class RecapStore {
  constructor(private readonly directory = 'data/recaps') {}
  async save(recap: Recap): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, `${recap.id}.json`), JSON.stringify(recap, null, 2), 'utf8');
  }
  /** Ids are checked before they touch the file system, so a crafted id cannot read another file. */
  async load(id: string): Promise<Recap | undefined> {
    if (!ID_PATTERN.test(id)) return undefined;
    try { return RecapSchema.parse(JSON.parse(await readFile(join(this.directory, `${id}.json`), 'utf8'))); } catch { return undefined; }
  }
}

const escape = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
const fmt = (ms: number) => { const seconds = Math.round(ms / 1000); return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`; };
const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

export function recapSummary(recap: Recap): string {
  return `${plural(recap.rounds, 'round')} played, ${plural(recap.wins, 'win')} together, best streak ${recap.bestStreak}.`;
}

/** A self-contained page in the overlay's teal and coral style, with Open Graph tags for link previews. */
export function renderRecapPage(recap: Recap, baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const url = `${base}/recap/${recap.id}`;
  const voters = (community: 'A' | 'B') => recap.topVoters[community].length
    ? recap.topVoters[community].map((row, index) => `<li><span class="rank">${index + 1}</span><b>${escape(row.name)}</b><small>${row.correct} right of ${plural(row.rounds, 'round')}</small></li>`).join('')
    : '<li class="empty">No votes yet</li>';
  const moments = recap.moments.length
    ? recap.moments.map(moment => `<article class="moment moment-${moment.community.toLowerCase()}"><span>COMMUNITY ${moment.community}'S HALF ALONE FIT</span><strong>${moment.setSize} answers</strong><p>including ${escape(moment.examples.join(', '))}. Together, both halves pointed to <b>${escape(moment.answer)}</b>${moment.won ? ', and both chats got it.' : '.'}</p></article>`).join('')
    : '<p class="empty">Play a round to see the best moments here.</p>';
  const stat = (value: string, label: string) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`;
  const title = `Twinclue session recap: ${plural(recap.wins, 'win')} together`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(recapSummary(recap))}">
<meta property="og:type" content="website"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(recapSummary(recap))}">
<meta property="og:url" content="${escape(url)}"><meta property="og:image" content="${escape(`${base}/og-recap.png`)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/logo.svg">
<style>
:root{--a:#2dd4bf;--b:#fb8a7a;--text:#e6eef3;--muted:#b9c7d2}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,"SF Pro Display",system-ui,sans-serif;color:#fff;background:radial-gradient(60rem 40rem at 10% -10%,rgba(45,212,191,.25),transparent 60%),radial-gradient(60rem 40rem at 100% 110%,rgba(251,138,122,.22),transparent 60%),linear-gradient(135deg,#070d18,#121a33 50%,#1b1230)}
main{max-width:960px;margin:0 auto;padding:48px 20px 64px}
header{display:flex;align-items:center;gap:14px}header img{width:44px;height:44px}
.word{font-weight:900;letter-spacing:.24em;font-size:18px}.word em{font-style:normal;background:linear-gradient(90deg,var(--a),var(--b));-webkit-background-clip:text;background-clip:text;color:transparent}
h1{font-size:clamp(32px,6vw,56px);line-height:1.05;letter-spacing:-.02em;margin:28px 0 8px}
.lede{color:var(--text);font-size:18px;margin:0 0 28px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:28px}
.stat{padding:18px;border-radius:18px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.stat strong{display:block;font-size:34px;line-height:1}.stat span{display:block;margin-top:8px;color:var(--muted);font-size:14px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
h2{font-size:15px;letter-spacing:.16em;color:var(--muted);margin:32px 0 12px}
.moments{display:grid;gap:12px}
.moment{padding:18px 20px;border-radius:18px;background:rgba(255,255,255,.05);border-left:5px solid var(--a)}
.moment-b{border-left-color:var(--b)}
.moment span{font-size:13px;font-weight:900;letter-spacing:.14em;color:var(--a)}.moment-b span{color:var(--b)}
.moment strong{display:block;font-size:30px;margin:4px 0}.moment p{margin:0;color:var(--text);font-size:16px;line-height:1.45}
.voters{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.voters section{padding:18px;border-radius:18px;background:rgba(255,255,255,.05)}
.voters h3{margin:0 0 10px;font-size:14px;letter-spacing:.14em}.voters .a h3{color:var(--a)}.voters .b h3{color:var(--b)}
ol{list-style:none;margin:0;padding:0;display:grid;gap:8px}li{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:10px;font-size:16px}
.rank{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.1);font-weight:900;font-size:13px}
li small{color:var(--muted);font-size:14px}.empty{color:var(--muted)}li.empty{display:block}
footer{margin-top:40px;color:var(--muted);font-size:14px}
@media(max-width:640px){.voters{grid-template-columns:1fr}}
</style></head><body><main>
<header><img src="/logo.svg" alt=""><span class="word">TWIN<em>CLUE</em></span></header>
<h1>Two communities.<br>${escape(plural(recap.wins, 'shared answer'))}.</h1>
<p class="lede">Session recap from ${escape(new Date(recap.createdAt).toUTCString().replace(' GMT', ' UTC'))}. ${escape(recapSummary(recap))}</p>
<div class="stats">${stat(String(recap.rounds), 'Rounds played')}${stat(String(recap.wins), 'Won together')}${stat(String(recap.bestStreak), 'Best streak')}${stat(recap.fastest ? fmt(recap.fastest.ms) : 'None yet', recap.fastest ? `Fastest solve: ${escape(recap.fastest.answer)}` : 'Fastest solve')}${stat(String(recap.points), 'Points')}</div>
<h2>THE BEST "YOUR HALF ALONE" MOMENTS</h2><div class="moments">${moments}</div>
<h2>TOP VOTERS</h2><div class="voters"><section class="a"><h3>COMMUNITY A</h3><ol>${voters('A')}</ol></section><section class="b"><h3>COMMUNITY B</h3><ol>${voters('B')}</ol></section></div>
<footer>Twinclue is a cooperative puzzle show for Twitch collabs: each stream holds half of every clue.</footer>
</main></body></html>`;
}
