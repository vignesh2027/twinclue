(() => {
  const side = location.pathname.endsWith('/b') ? 'b' : 'a';
  const params = new URLSearchParams(location.search);
  const key = params.get('k') || '';
  // Preview mode: opened directly in a browser rather than in OBS or embedded in the panel. ?preview=0|1 forces it.
  const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const forced = params.get('preview');
  const preview = forced === '1' ? true : forced === '0' ? false : !window.obsstudio && !embedded;
  const $ = selector => document.querySelector(selector);
  const root = $('#overlay');
  root.classList.add(`side-${side}`);
  root.classList.toggle('preview', preview);
  $('#stage').hidden = !preview;
  $('#preview-banner').hidden = !preview;
  $('#preview-side').textContent = `COMMUNITY ${side.toUpperCase()}`;
  $('#community').textContent = `COMMUNITY ${side.toUpperCase()}`;

  const el = { demo: $('#demo'), card: $('#card'), play: $('#play'), reveal: $('#reveal'), category: $('#category'), clue: $('#clue'), phase: $('#phase'),
    status: $('#status-pill'), statusText: $('#status-text'), previewStatus: $('#preview-status'), wait: $('#wait-message'), time: $('#time-left'), ring: $('#timer-ring'),
    hook: $('#hook'), cta: $('#cta'), ticker: $('#ticker'), bars: $('#vote-bars'), verdict: $('#verdict'), kicker: $('#kicker') };
  const STATUS = { active: 'VOTING LIVE', won: 'BOTH LOCKED IN', 'timed-out': 'TIME UP', unscored: 'NOT SCORED', idle: 'NEXT ROUND SOON' };
  const RING = 131.95;
  const CENTRE_STAGE_MS = 8000;
  let state;
  let clockOffset = 0;
  let revealKey = '';
  let centreTimer;

  const fmtTime = ms => { if (ms == null) return 'Not available'; const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };
  const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

  function setStatus(s) {
    const text = STATUS[s.roundStatus] || STATUS.idle;
    el.status.dataset.state = s.roundStatus;
    el.statusText.textContent = text;
    el.previewStatus.textContent = text;
    $('#wins').textContent = plural(s.scoreboard.wins, 'win');
    $('#streak').textContent = `${s.scoreboard.streak} streak`;
  }

  // Bars are keyed by answer and moved, not rebuilt, so their widths animate smoothly between frames.
  // They come from a closed list: entities in this round's fact table. Anything else is one "other answers" row.
  const barRows = new Map();
  function bar(label, extraClass) {
    let row = barRows.get(label);
    if (!row) {
      row = document.createElement('div');
      row.className = `vote-bar${extraClass ? ` ${extraClass}` : ''}`;
      const name = document.createElement('span');
      name.textContent = label;
      const track = document.createElement('i');
      const fill = document.createElement('em');
      fill.style.transform = 'scaleX(0)';
      track.append(fill);
      row.append(name, track, document.createElement('b'));
      barRows.set(label, row);
    }
    return row;
  }
  function renderVotes(s) {
    $(`#side-${side}-label`).textContent = s.leading ? `Leading: ${s.leading}` : 'Still searching';
    $(`#side-${side}-count`).textContent = plural(s.voters, 'voter');
    const other = side === 'a' ? 'b' : 'a';
    $(`#side-${other}-label`).textContent = 'Other community is voting';
    $(`#side-${other}-count`).textContent = 'Their clue stays hidden';
    const entries = s.buckets.map(bucket => [bucket.answer, bucket.count, '']);
    if (s.otherVotes > 0) entries.push(['other answers', s.otherVotes, 'vote-bar-other']);
    const max = Math.max(1, ...entries.map(([, count]) => count));
    const keep = new Set(entries.map(([label]) => label));
    for (const [label, row] of barRows) if (!keep.has(label)) { row.remove(); barRows.delete(label); }
    entries.forEach(([label, count, extra], index) => {
      const row = bar(label, extra);
      row.querySelector('b').textContent = String(count);
      if (el.bars.children[index] !== row) el.bars.insertBefore(row, el.bars.children[index] ?? null);
      requestAnimationFrame(() => { row.querySelector('em').style.transform = `scaleX(${count / max})`; });
    });
  }

  const tickerItems = new Map();
  function renderTicker(rows) {
    const keys = rows.map(row => `${row.user}|${row.label}`);
    for (const [k, item] of tickerItems) if (!keys.includes(k)) { item.remove(); tickerItems.delete(k); }
    rows.forEach((row, index) => {
      const k = keys[index];
      let item = tickerItems.get(k);
      if (!item) {
        item = document.createElement('li');
        const user = document.createElement('b');
        user.textContent = `@${row.user}`;
        const text = document.createElement('span');
        text.textContent = row.label === 'other answers' ? 'cast a vote' : `voted ${row.label}`;
        item.append(user, text);
        tickerItems.set(k, item);
      }
      if (el.ticker.children[index] !== item) el.ticker.insertBefore(item, el.ticker.children[index] ?? null);
    });
  }

  function showReveal(s) {
    const reveal = s.reveal;
    el.kicker.textContent = s.roundStatus === 'won' ? 'TOGETHER, YOU GOT IT' : s.roundStatus === 'timed-out' ? 'SO CLOSE' : '';
    // A clear pill says why a round did not count.
    const verdict = reveal.unscoredReason === 'skipped' ? 'Round skipped, so it does not count'
      : reveal.unscoredReason === 'not-enough-voters' ? 'Too few voters on one side, so this round does not count' : '';
    el.verdict.hidden = !verdict;
    el.verdict.textContent = verdict;
    $('#answer').textContent = reveal.answer;
    $('#half-a').textContent = reveal.halfA;
    $('#half-b').textContent = reveal.halfB;
    // The aha moment: how many answers this community's half alone allowed.
    const alternatives = (side === 'a' ? reveal.alsoFitsA : reveal.alsoFitsB).slice(0, 3);
    const setSize = side === 'a' ? reveal.setSizeA : reveal.setSizeB;
    const count = document.createElement('strong');
    count.textContent = `${setSize} answers`;
    $('#also-fits').replaceChildren('Your half alone fit ', count, alternatives.length ? `, including ${alternatives.join(', ')}.` : '.');
    for (const [name, result] of [['a', reveal.sideA], ['b', reveal.sideB]]) {
      const answerName = document.createElement('span');
      answerName.className = 'name';
      answerName.textContent = result.topAnswer ?? 'No clear choice';
      const mark = document.createElement('span');
      mark.className = `mark ${result.correct ? 'right' : 'wrong'}`;
      mark.textContent = result.correct ? '✓ right' : '✗ not right';
      $(`#result-${name}`).replaceChildren(answerName, mark);
      $(`#voters-${name}`).textContent = plural(result.voters, 'voter');
    }
    const how = reveal.finishReason === 'consensus' ? 'Both chats agreed, so votes locked early. ' : '';
    $('#solve-time').textContent = `${how}Round time: ${fmtTime(reveal.solveTimeMs)}`;
    // Centre stage once per finished round, then the card settles back into its corner.
    const id = `${s.roundStatus}|${reveal.answer}|${reveal.solveTimeMs}`;
    if (id !== revealKey) {
      revealKey = id;
      root.classList.add('is-centered');
      clearTimeout(centreTimer);
      centreTimer = setTimeout(() => root.classList.remove('is-centered'), CENTRE_STAGE_MS);
    }
  }

  function render(s) {
    if (s.type !== 'state') return;
    state = s;
    if (typeof s.serverNow === 'number') clockOffset = s.serverNow - Date.now();
    const tags = [];
    if (s.demo) tags.push(s.unauditedDemo ? 'DEMO MODE, UNAUDITED PUZZLE' : 'DEMO');
    if (s.rehearsal) tags.push('REHEARSAL');
    el.demo.hidden = tags.length === 0;
    el.demo.textContent = tags.join(' · ');
    setStatus(s);
    const active = s.roundStatus === 'active';
    const finished = s.roundStatus === 'won' || s.roundStatus === 'timed-out' || s.roundStatus === 'unscored';
    root.classList.toggle('is-idle', !active && !finished);
    root.classList.toggle('is-active', active);
    root.classList.toggle('is-revealed', finished);
    root.classList.toggle('is-won', s.roundStatus === 'won');
    el.play.hidden = !active;
    el.reveal.hidden = !finished;
    if (!finished) { clearTimeout(centreTimer); root.classList.remove('is-centered'); revealKey = ''; }
    if (active) {
      el.category.textContent = s.category ?? '';
      el.clue.textContent = s.half ?? '';
      el.phase.textContent = s.leading ? 'YOUR CHAT IS CONVERGING' : 'YOUR CLUE';
      el.hook.textContent = `Community ${side === 'a' ? 'B' : 'A'} has the other half. Ask your streamer to swap clues.`;
      el.cta.textContent = `Type ${s.commandPrefix || '!g'} and your answer in chat`;
      el.wait.hidden = !s.leading;
      if (s.leading) el.wait.textContent = 'Chat is converging on a leading answer';
      renderVotes(s);
      renderTicker(s.recentVotes ?? []);
    }
    if (finished && s.reveal) showReveal(s);
  }

  // The ring drains as time runs out.
  function tick() {
    if (state?.roundStatus === 'active' && state.endsAt && state.startedAt) {
      const now = Date.now() + clockOffset;
      const remaining = Math.max(0, state.endsAt - now);
      const left = Math.min(1, Math.max(0, remaining / (state.endsAt - state.startedAt)));
      el.time.textContent = String(Math.ceil(remaining / 1000));
      el.ring.style.strokeDashoffset = String(RING * (1 - left));
      el.card.classList.toggle('urgent', remaining <= 10_000);
    } else el.card.classList.remove('urgent');
    requestAnimationFrame(tick);
  }
  function connect() {
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/overlay/ws/${side}${key ? `?k=${encodeURIComponent(key)}` : ''}`);
    ws.onmessage = event => render(JSON.parse(event.data));
    ws.onclose = () => setTimeout(connect, 1500);
  }
  connect();
  tick();
})();
