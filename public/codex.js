// Renders docs/codex/replay.json as a timeline. Every string from the replay is escaped before it reaches the page.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = n => Number(n).toLocaleString('en-US');
  const when = iso => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)).replace(',', '') + ' IST';
  function duration(seconds) {
    const s = Math.round(seconds || 0);
    if (s < 60) return s + ' s';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (h) return h + ' h ' + Math.round((s % 3600) / 60) + ' min';
    return m < 10 && r ? m + ' min ' + r + ' s' : m + ' min';
  }
  const OUTCOME = { completed: 'Completed', interrupted: 'Interrupted', 'usage-limit': 'Usage limit reached' };

  /** A small Markdown subset: paragraphs, lists, tables, headings, bold, code and links. Input is escaped first. */
  function inline(text) {
    return esc(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => /^https:\/\//.test(url)
        ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>'
        : '<span class="path">' + label + '</span>');
  }
  function markdown(source) {
    const out = [];
    for (const block of String(source).split(/\n\s*\n/)) {
      const lines = block.split('\n').filter(line => line.trim());
      if (!lines.length) continue;
      if (lines.every(line => line.trim().startsWith('|'))) {
        const rows = lines.filter(line => !/^\s*\|[\s:|-]+\|\s*$/.test(line)).map(line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => inline(cell.trim())));
        out.push('<div class="table"><table>' + rows.map((cells, i) => '<tr>' + cells.map(c => i ? '<td>' + c + '</td>' : '<th>' + c + '</th>').join('') + '</tr>').join('') + '</table></div>');
        continue;
      }
      let html = '', list = null;
      const close = () => { if (list) { html += '</' + list + '>'; list = null; } };
      for (const line of lines) {
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (heading) { close(); html += '<h4>' + inline(heading[1]) + '</h4>'; }
        else if (bullet || numbered) {
          const kind = bullet ? 'ul' : 'ol';
          if (list !== kind) { close(); html += '<' + kind + '>'; list = kind; }
          html += '<li>' + inline((bullet || numbered)[1]) + '</li>';
        } else if (list) html = html.replace(/<\/li>$/, ' ' + inline(line.trim()) + '</li>');
        else html += '<p>' + inline(line) + '</p>';
      }
      close();
      out.push(html.replace(/<\/p><p>/g, '<br>'));
    }
    return out.join('');
  }

  function eventClass(event) {
    if (event.t !== 'command') return event.t;
    if (event.tests) return event.tests.failed === 0 ? 'test' : 'fail';
    return event.exit !== null && event.exit !== 0 ? 'fail' : 'command';
  }

  /** Long turns are folded into at most 96 ticks; each tick shows the most telling event inside it. */
  const RANK = ['fail', 'test', 'error', 'search', 'message', 'edit', 'command'];
  function stripTicks(events) {
    const kinds = events.map(eventClass);
    const size = Math.max(1, Math.ceil(kinds.length / 96));
    const ticks = [];
    for (let i = 0; i < kinds.length; i += size) ticks.push(kinds.slice(i, i + size).sort((a, b) => RANK.indexOf(a) - RANK.indexOf(b))[0]);
    return ticks;
  }

  function renderEvent(event) {
    if (event.t === 'message') return '<li class="ev ev-message"><span class="who">Codex</span><div class="md">' + markdown(event.text) + '</div></li>';
    if (event.t === 'edit') {
      const label = event.files.length === 1 ? 'Edited 1 file' : 'Edited ' + event.files.length + ' files';
      return '<li class="ev ev-edit"><span class="lbl">' + label + '</span><ul class="files">' + event.files.map(f => '<li data-kind="' + esc(f.kind) + '" title="' + esc(f.kind) + '">' + esc(f.path) + '</li>').join('') + '</ul></li>';
    }
    if (event.t === 'search') return '<li class="ev ev-search"><span class="lbl">Web search</span>' + esc(event.query) + '</li>';
    if (event.t === 'error') return '<li class="ev ev-error"><span class="lbl">Codex runtime</span>' + esc(event.text) + (event.repeats ? '<span class="times">x' + event.repeats + '</span>' : '') + '</li>';
    const isTest = event.kinds.includes('test');
    const exit = event.exit === null ? '<span class="exit none" title="Did not finish">...</span>' : '<span class="exit' + (event.exit ? ' bad' : '') + '" title="Exit code">' + event.exit + '</span>';
    const kinds = event.kinds.filter(k => k !== 'other' && k !== 'read').map(k => '<span class="kind">' + esc(k) + '</span>').join('');
    let result = '';
    if (event.tests) {
      const t = event.tests;
      result = t.failed ? '<span class="result fail">' + t.failed + ' failed, ' + t.passed + ' passed</span>' : '<span class="result pass">' + t.passed + ' passed</span>';
    }
    const classes = 'ev ev-command' + (isTest ? ' ev-test' : '') + (event.tests && event.tests.failed ? ' red' : '');
    const tail = event.tail.length ? '<pre class="tail">' + esc(event.tail.join('\n')) + '</pre>' : '';
    return '<li class="' + classes + '"><div class="cmdline">' + exit + '<code>$ ' + esc(event.cmd) + '</code>' + kinds + result + '</div>' + tail + '</li>';
  }

  function renderBody(slice, body) {
    const events = slice.events;
    const counts = {
      all: events.length,
      message: events.filter(e => e.t === 'message').length,
      command: events.filter(e => e.t === 'command').length,
      test: events.filter(e => e.t === 'command' && e.kinds.includes('test')).length,
      edit: events.filter(e => e.t === 'edit').length,
      error: events.filter(e => e.t === 'error').length,
    };
    const names = { all: 'All', message: 'Messages', command: 'Commands', test: 'Test runs', edit: 'Edits', error: 'Errors' };
    const filters = Object.keys(names).filter(k => k === 'all' || counts[k]).map(k => '<button type="button" data-filter="' + k + '" aria-pressed="' + (k === 'all') + '">' + names[k] + ' ' + counts[k] + '</button>').join('');
    body.innerHTML = (slice.brief ? '<details class="brief"><summary>The brief Codex was given</summary><div class="md">' + markdown(slice.brief) + '</div></details>' : '') +
      '<div class="filters" role="toolbar" aria-label="Show">' + filters + '</div>' +
      '<ol class="events" data-filter="all">' + events.map(renderEvent).join('') + '</ol>';
    const list = body.querySelector('.events');
    body.querySelector('.filters').addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      list.dataset.filter = button.dataset.filter;
      for (const other of body.querySelectorAll('.filters button')) other.setAttribute('aria-pressed', String(other === button));
    });
  }

  function renderSlice(slice) {
    const s = slice.stats, c = slice.commitInfo, u = slice.usage;
    const last = s.lastFullRun;
    const testChip = last ? '<li class="' + (last.failed ? 'amber' : 'green') + '"><b>' + last.passed + ' of ' + last.total + '</b>passing in the last npm test</li>' : '';
    const strip = stripTicks(slice.events).map(kind => '<i class="s-' + kind + '"></i>').join('');
    const commit = c ? '<p class="commit">Committed as <code>' + esc(c.sha) + '</code> on ' + esc(when(c.date)) + ': "' + esc(c.subject) + '". ' + c.filesChanged + ' files, +' + num(c.insertions) + ' / -' + num(c.deletions) + ' lines.</p>' : '';
    const li = document.createElement('li');
    li.className = 'turn';
    li.id = slice.id;
    li.dataset.outcome = slice.outcome;
    li.innerHTML = '<span class="node" aria-hidden="true"></span><article class="card">' +
      '<div class="meta"><span class="label">' + esc(slice.label) + '</span>' + (slice.startedAt ? '<span>' + esc(when(slice.startedAt)) + '</span>' : '') +
      '<span class="dur">' + duration(slice.durationSeconds) + '</span><span class="badge ' + esc(slice.outcome) + '">' + OUTCOME[slice.outcome] + '</span></div>' +
      '<h2>' + esc(slice.title) + '</h2>' +
      '<div class="strip" aria-hidden="true">' + strip + '</div>' +
      '<ul class="chips"><li><b>' + s.commands + '</b>commands, ' + s.commandsFailed + ' non-zero</li>' + testChip +
      '<li><b>' + s.testRuns + '</b>test runs</li><li><b>' + s.messages + '</b>messages</li>' +
      (u ? '<li><b>' + num(u.output) + '</b>output tokens</li>' : '') + '</ul>' +
      commit + (slice.note ? '<p class="note">' + esc(slice.note) + '</p>' : '') +
      '<button class="replay" type="button" aria-expanded="false" aria-controls="' + esc(slice.id) + '-body">Replay this turn</button>' +
      '<div class="body" id="' + esc(slice.id) + '-body" hidden></div></article>';
    const button = li.querySelector('.replay');
    const body = li.querySelector('.body');
    button.addEventListener('click', () => toggle(slice, button, body));
    return li;
  }

  function toggle(slice, button, body, open) {
    const next = open !== undefined ? open : button.getAttribute('aria-expanded') !== 'true';
    if (next && !body.dataset.ready) { renderBody(slice, body); body.dataset.ready = '1'; }
    body.hidden = !next;
    button.setAttribute('aria-expanded', String(next));
    button.textContent = next ? 'Close this turn' : 'Replay this turn';
  }

  function renderTotals(replay) {
    const t = replay.totals;
    const first = replay.slices[0], last = replay.slices[replay.slices.length - 1];
    const cached = t.usage.input ? Math.round((t.usage.cachedInput / t.usage.input) * 1000) / 10 : 0;
    const cells = [
      ['Working time', duration(t.durationSeconds), replay.slices.length + ' turns'],
      ['Commands', num(t.commands), num(t.commandsFailed) + ' with a non-zero exit'],
      ['Test runs', num(t.testRuns), 'last npm test ' + (last.stats.lastFullRun ? last.stats.lastFullRun.passed + ' of ' + last.stats.lastFullRun.total : 'none')],
      ['Messages', num(t.messages), num(t.fileEdits) + ' file edits'],
      ['Output tokens', num(t.usage.output), cached + '% of input cached'],
    ];
    $('totals').innerHTML = cells.map(([k, v, small]) => '<div><dt>' + k + '</dt><dd>' + v + '<small>' + small + '</small></dd></div>').join('');
    if (first.startedAt) document.querySelector('.eyebrow').textContent = 'OpenAI Codex · one session · ' + when(first.startedAt).replace(/ \d\d:\d\d IST$/, '') + ' to ' + when(last.endedAt).replace(/ \d\d:\d\d IST$/, '') + ' 2026';
  }

  async function load() {
    try {
      const response = await fetch('/codex/replay.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error('missing');
      const replay = await response.json();
      $('session-id').textContent = replay.sessionId;
      $('model').textContent = replay.model || '-';
      $('cli').textContent = replay.cliVersion || '-';
      renderTotals(replay);
      const timeline = $('timeline');
      for (const slice of replay.slices) timeline.appendChild(renderSlice(slice));
      $('loading').textContent = '';
      const target = location.hash.slice(1);
      const item = target && document.getElementById(target);
      if (item && item.classList.contains('turn')) {
        const slice = replay.slices.find(s => s.id === target);
        toggle(slice, item.querySelector('.replay'), item.querySelector('.body'), true);
        item.scrollIntoView();
      }
    } catch {
      $('loading').textContent = 'The replay is not available on this server. Run npm run codex:replay to generate it.';
    }
  }

  $('copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('session-id').textContent); $('copy').textContent = 'Copied'; } catch { $('copy').textContent = 'Select it'; }
    setTimeout(() => { $('copy').textContent = 'Copy'; }, 1600);
  });
  load();
})();
