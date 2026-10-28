import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('public/panel.html', 'utf8');
const script = readFileSync('public/panel.js', 'utf8');
const css = readFileSync('public/panel.css', 'utf8');

describe('control panel assets', () => {
  it('has big Start, Lock and Skip controls with S, L and K shortcuts that ignore typing in fields', () => {
    for (const [id, key] of [['start', 'S'], ['lock', 'L'], ['skip', 'K']]) expect(html).toMatch(new RegExp(`id="${id}"[^>]*>.*?<kbd>${key}</kbd>`));
    expect(script).toContain("{ s: '#start', l: '#lock', k: '#skip' }");
    expect(script).toMatch(/closest\('input, select, textarea'\)/);
  });

  it('shows the live round, per-channel health, the scoreboard, overlay links, settings and a separate rehearsal box', () => {
    for (const id of ['round-status', 'time-left', 'leader-a', 'leader-b', 'hint-a', 'health-a', 'health-b', 'health-bot', 'stat-points', 'stat-best', 'recap', 'copy-a', 'copy-b', 'drawer', 'rehearsal']) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('In OBS:');
    expect(css).toMatch(/\.rehearsal-box\{[^}]*dashed/);
  });

  it('never renders either clue: there is no element or field for clue or hint text', () => {
    expect(script).not.toMatch(/\.half\b|halfA|halfB|hintA|hintB|hint\.text/);
    expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });

  it('keeps every text colour readable: no grey below the muted token on the dark card', () => {
    expect(css).toMatch(/--muted:#a9b8c5/);
    expect(html).not.toMatch(/—|->(?!\s*$)/m);
  });
});
