import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('public/panel.html', 'utf8');
const script = readFileSync('public/panel.js', 'utf8');
const css = readFileSync('public/panel.css', 'utf8');

describe('control panel assets', () => {
  it('has big Start, Lock and Skip controls with S, L and K shortcuts that ignore typing in fields', () => {
    for (const [id, key] of [['start', 'S'], ['lock', 'L'], ['skip', 'K']]) expect(html).toMatch(new RegExp(`id="${id}"[^>]*>.*?<kbd>${key}</kbd>`));
    expect(script).toContain("{ s: '#start', l: '#lock' }");
    // Skip voids the round, so it needs a press and hold or K twice.
    expect(script).toMatch(/SKIP_HOLD_MS = 900/);
    expect(script).toMatch(/function keyboardSkip\(\)/);
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

  it('does not rebuild dropdowns on every state push, scales the preview into a true 16:9 box, and stacks at OBS dock width', () => {
    expect(script).toMatch(/if \(document\.activeElement === element\) return;/);
    expect(script).toMatch(/element\.dataset\.options !== signature/);
    expect(css).toMatch(/\.preview iframe\{[^}]*width:1920px;height:1080px/);
    expect(script).toContain('box.clientWidth / 1920');
    expect(css).toMatch(/@media\(max-width:480px\)\{/);
    expect(css).toMatch(/\.btn-skip\{[^}]*rgba\(248,113,113/);
  });

  it('lays the wide panel out as two independent columns, so the overlay preview sits right under the live round', () => {
    const main = html.slice(html.indexOf('class="col col-main"'), html.indexOf('class="col col-side"'));
    expect(main).toContain('class="card round"');
    expect(main).toContain('class="card links"');
    expect(css).toMatch(/\.col\{display:flex;flex-direction:column/);
    expect(css).not.toMatch(/grid-row:span/);
    expect(css).toMatch(/@media\(max-width:1100px\)\{[^\n]*\.col\{display:contents\}/);
  });
});
