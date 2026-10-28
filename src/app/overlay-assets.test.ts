import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('public/overlay.css', 'utf8');
const script = readFileSync('public/overlay.js', 'utf8');
const html = readFileSync('public/overlay.html', 'utf8');
const zIndexOf = (selector: string) => Number(css.match(new RegExp(`(?:^|\\n|\\})${selector.replace('.', '\\.')}\\{[^}]*z-index:(\\d+)`))?.[1]);

describe('overlay assets', () => {
  it('keeps every text size at 14 px or more on the 1920 canvas (one rem is 16 px there)', () => {
    const sizes = [...css.matchAll(/font-size:([\d.]+)rem/g)].map(match => Number(match[1]));
    expect(sizes.length).toBeGreaterThan(10);
    expect(css).not.toMatch(/font-size:[\d.]+px/);
    expect(sizes.filter(size => size * 16 < 14)).toEqual([]);
  });

  it('declares an icon, so opening the overlay in a browser logs no favicon 404', () => {
    expect(html).toMatch(/<link rel="icon" href="\/logo\.svg"/);
  });

  it('never writes chat-derived text as HTML', () => {
    expect(script).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/);
  });

  it('draws the win confetti behind the centred card and stills it for reduced motion', () => {
    expect(zIndexOf('.burst')).toBeLessThan(zIndexOf('.card'));
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation:none!important;transition:none!important\}/);
  });
});

describe('overlay sound cues', () => {
  it('stays silent unless ?sound=1 and synthesises every cue with WebAudio, with no audio files', () => {
    expect(script).toMatch(/const soundOn = params\.get\('sound'\) === '1';/);
    expect(script).toMatch(/AudioContext/);
    for (const name of ['start', 'tenSeconds', 'hint', 'reveal', 'win']) expect(script).toContain(`${name}: () =>`);
    expect(script).not.toMatch(/\.(mp3|wav|ogg|m4a)\b/);
    expect(html).not.toMatch(/<audio/);
  });

  it('shows a hint prompt and an animated unlocked hint line', () => {
    expect(html).toContain('id="hint"');
    expect(script).toContain('HINT UNLOCKED');
    expect(css).toMatch(/\.hint\.unlocked\{[^}]*animation:hint-in/);
  });
});
