(() => {
  const side = location.pathname.endsWith('/b') ? 'b' : 'a';
  const key = new URLSearchParams(location.search).get('k') || '';
  const root = document.querySelector('#overlay');
  root.classList.add(`side-${side}`);
  const $ = selector => document.querySelector(selector);
  $('#community').textContent = `COMMUNITY ${side.toUpperCase()}`;
  const el = { demo: $('#demo'), card: $('#card'), idle: $('#idle-badge'), play: $('#play'), category: $('#category'), clue: $('#clue'), phase: $('#phase'), status: $('#status-pill'), wait: $('#wait-message'), time: $('#time-left'), ring: $('#timer-ring'), hook: $('#hook'), cta: $('#cta'), ticker: $('#ticker'), celebration: $('#celebration'), reveal: $('#reveal'), timeout: $('#timeout'), meters: $('#meters') };
  let state;
  let stageTimer;
  let clockOffset = 0;

  const fmtTime = ms => { if (ms == null) return 'Not available'; const seconds = Math.floor(ms / 1000); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };

  function setStatus(s) {
    const text = { active: 'VOTING LIVE', won: 'BOTH SIDES LOCKED', 'timed-out': 'TIME UP', unscored: 'NOT SCORED', idle: 'NEXT ROUND SOON' };
    el.status.textContent = text[s.roundStatus] || text.idle;
    el.status.dataset.state = s.roundStatus;
    el.idle.hidden = s.roundStatus !== 'idle';
    $('#wins').textContent = `${s.scoreboard.wins} ${s.scoreboard.wins === 1 ? 'win' : 'wins'}`;
    $('#streak').textContent = `${s.scoreboard.streak} streak`;
  }

  function bar(label, count, max, extraClass) {
    const row = document.createElement('div');
    row.className = `vote-bar vote-bar-${side}${extraClass ? ` ${extraClass}` : ''}`;
    const name = document.createElement('span');
    name.textContent = label;
    const total = document.createElement('b');
    total.textContent = String(count);
    const track = document.createElement('i');
    const fill = document.createElement('em');
    fill.style.transform = `scaleX(${count / max})`;
    track.append(fill);
    row.append(name, track, total);
    return row;
  }

  // Bars come from a closed list: entities in this round's fact table. Anything else is one "other answers" row.
  function renderVotes(s) {
    $(`#side-${side}-label`).textContent = s.leading ? `Leading: ${s.leading}` : 'Still searching';
    $(`#side-${side}-count`).textContent = `${s.voters} ${s.voters === 1 ? 'voter' : 'voters'}`;
    const other = side === 'a' ? 'b' : 'a';
    $(`#side-${other}-label`).textContent = 'Other community is voting';
    $(`#side-${other}-count`).textContent = 'Their clue stays hidden';
    const max = Math.max(1, s.otherVotes || 0, ...s.buckets.map(bucket => bucket.count));
    const rows = s.buckets.map(bucket => bar(bucket.answer, bucket.count, max));
    if (s.otherVotes > 0) rows.push(bar('other answers', s.otherVotes, max, 'vote-bar-other'));
    $('#vote-bars').replaceChildren(...rows);
    $(`#side-${side}-status`).setAttribute('aria-label', `${s.voters} voters in this community`);
  }

  function renderTicker(rows) {
    el.ticker.replaceChildren(...rows.map(row => {
      const item = document.createElement('li');
      item.className = 'ticker-vote';
      const user = document.createElement('b');
      user.textContent = `@${row.user}`;
      const text = document.createElement('span');
      text.textContent = row.label === 'other answers' ? 'cast a vote' : `voted ${row.label}`;
      item.append(user, text);
      return item;
    }));
  }

  function showReveal(s) {
    const reveal = s.reveal;
    el.celebration.hidden = true;
    el.reveal.hidden = false;
    el.timeout.hidden = s.roundStatus !== 'timed-out' && s.roundStatus !== 'unscored';
    el.timeout.textContent = reveal.unscoredReason === 'skipped' ? 'Round skipped. It does not count.'
      : reveal.unscoredReason === 'not-enough-voters' ? 'Too few voters on one side, so this round does not count.'
      : 'So close. Here is how the clues fit.';
    $('#answer').textContent = reveal.answer;
    $('#half-a').textContent = reveal.halfA;
    $('#half-b').textContent = reveal.halfB;
    const alternatives = side === 'a' ? reveal.alsoFitsA : reveal.alsoFitsB;
    const setSize = side === 'a' ? reveal.setSizeA : reveal.setSizeB;
    $('#also-fits').textContent = `Your half alone fit ${setSize} answers, including ${alternatives.slice(0, 3).join(', ')}.`;
    const describe = (name, result) => `Community ${name}: ${result.topAnswer ?? 'no clear choice'} (${result.correct ? 'right' : 'not right'}, ${result.voters} ${result.voters === 1 ? 'voter' : 'voters'})`;
    $('#solvers').textContent = `${describe('A', reveal.sideA)}. ${describe('B', reveal.sideB)}.`;
    const how = reveal.finishReason === 'consensus' ? 'Both chats agreed, so votes locked early. ' : '';
    $('#solve-time').textContent = `${how}Round time: ${fmtTime(reveal.solveTimeMs)}`;
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
    el.category.textContent = s.category ?? '';
    setStatus(s);
    const active = s.roundStatus === 'active';
    el.play.hidden = !active;
    el.clue.textContent = s.half ?? '';
    renderVotes(s);
    renderTicker(s.recentVotes ?? []);
    el.wait.hidden = !(active && Boolean(s.leading));
    if (active && s.leading) el.wait.textContent = 'Chat is converging on a leading answer';
    el.phase.textContent = s.leading ? 'YOUR CHAT IS CONVERGING' : 'YOUR CLUE';
    el.hook.textContent = `Community ${side === 'a' ? 'B' : 'A'} has the other half. Ask your streamer to swap clues.`;
    el.cta.textContent = `Type ${s.commandPrefix || '!g'} and your answer in chat`;
    if (active) { clearTimeout(stageTimer); root.classList.remove('expanded'); el.celebration.hidden = true; el.reveal.hidden = true; el.timeout.hidden = true; return; }
    if (s.roundStatus === 'won') {
      el.celebration.hidden = false;
      $('#solver-a').textContent = 'Community A is locked';
      $('#solver-b').textContent = 'Community B is locked';
      el.reveal.hidden = true;
      el.timeout.hidden = true;
      root.classList.add('expanded');
      clearTimeout(stageTimer);
      stageTimer = setTimeout(() => { if (state === s) showReveal(s); setTimeout(() => { if (state === s) root.classList.remove('expanded'); }, 4500); }, 2200);
      return;
    }
    if (s.roundStatus === 'timed-out' || s.roundStatus === 'unscored') {
      root.classList.add('expanded');
      showReveal(s);
      clearTimeout(stageTimer);
      stageTimer = setTimeout(() => { if (state === s) root.classList.remove('expanded'); }, 7000);
      return;
    }
    el.celebration.hidden = true;
    el.reveal.hidden = true;
    el.timeout.hidden = true;
  }

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick() {
    if (state?.roundStatus === 'active' && state.endsAt && state.startedAt) {
      const now = Date.now() + clockOffset;
      const remaining = Math.max(0, state.endsAt - now);
      el.time.textContent = String(Math.ceil(remaining / 1000));
      el.card.classList.toggle('urgent', remaining <= 10_000);
      const progress = Math.min(1, Math.max(0, (now - state.startedAt) / (state.endsAt - state.startedAt)));
      if (!reduceMotion) el.ring.style.transform = `rotate(${progress * 360}deg)`;
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
