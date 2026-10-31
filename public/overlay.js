(() => {
  const side = location.pathname.endsWith('/b') ? 'b' : 'a';
  const params = new URLSearchParams(location.search);
  // Sound is off unless ?sound=1, so an OBS source never makes noise the streamer did not ask for.
  const soundOn = params.get('sound') === '1';
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
  const REVEAL_BEAT_MS = 400;
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
    $('#points').textContent = plural(s.scoreboard.points ?? 0, 'point');
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

  // The two newest votes, newest first: three chips at a readable size truncated every name.
  const TICKER_CHIPS = 2;
  const tickerItems = new Map();
  function renderTicker(samples) {
    const rows = samples.slice(-TICKER_CHIPS).reverse();
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
    const hints = reveal.hintsUsed ? ` · ${plural(reveal.hintsUsed, 'hint')} used` : '';
    $('#solve-time').textContent = `${how}Round time: ${fmtTime(reveal.solveTimeMs)}${hints}`;
    // Centre stage once per finished round, then the card settles back into its corner.
    // Both overlays start from the server's end time (plus a short beat), so the two celebrations fire together.
    const id = `${s.roundStatus}|${reveal.answer}|${reveal.solveTimeMs}`;
    if (id !== revealKey) {
      revealKey = id;
      clearTimeout(centreTimer);
      const serverNow = Date.now() + clockOffset;
      const startAt = (reveal.revealAt ?? serverNow) + REVEAL_BEAT_MS;
      const endAt = startAt + CENTRE_STAGE_MS;
      if (serverNow >= endAt) return;
      const begin = () => {
        root.classList.add('is-centered');
        cue(s.roundStatus === 'won' ? 'win' : 'reveal');
        centreTimer = setTimeout(() => root.classList.remove('is-centered'), Math.max(0, endAt - (Date.now() + clockOffset)));
      };
      if (startAt > serverNow) centreTimer = setTimeout(begin, startAt - serverNow); else begin();
    }
  }

  // Short cues synthesised with WebAudio: no audio files, nothing to license.
  let audio;
  function ensureAudio() {
    if (!soundOn) return undefined;
    if (!audio) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return undefined;
      audio = new Context();
      // A normal browser starts audio suspended until the first click; OBS does not.
      if (audio.state === 'suspended') document.addEventListener('pointerdown', () => audio.resume(), { once: true });
    }
    return audio;
  }
  function tone(frequency, at, duration, type = 'sine', volume = 0.08) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const start = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }
  const CUES = {
    start: () => { tone(523.25, 0, 0.18, 'triangle'); tone(783.99, 0.12, 0.28, 'triangle'); },
    tenSeconds: () => { tone(880, 0, 0.08, 'square', 0.03); tone(880, 0.16, 0.08, 'square', 0.03); },
    hint: () => { tone(739.99, 0, 0.14, 'sine', 0.06); tone(987.77, 0.1, 0.24, 'sine', 0.06); },
    swap: () => { tone(392, 0, 0.12, 'sawtooth', 0.04); tone(587.33, 0.1, 0.12, 'sawtooth', 0.04); tone(392, 0.22, 0.12, 'sawtooth', 0.04); tone(587.33, 0.32, 0.22, 'sawtooth', 0.04); },
    reveal: () => { [659.25, 880, 1318.5].forEach((f, i) => tone(f, i * 0.07, 0.35, 'triangle', 0.05)); },
    win: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.5, 'triangle', 0.07)); },
  };
  const cue = name => { if (soundOn) CUES[name](); };
  let lastStatus = '';
  let lastHintUnlocked = false;
  let tenSecondCue = false;

  // The hint row: a quiet prompt while it is locked, a highlighted line once this community unlocks it.
  function renderHint(hint) {
    const box = $('#hint');
    const unlocked = Boolean(hint?.text);
    box.hidden = !hint || (!hint.available && !unlocked);
    if (box.hidden) return;
    box.classList.toggle('unlocked', unlocked);
    $('#hint-label').textContent = unlocked ? 'HINT UNLOCKED' : 'STUCK?';
    $('#hint-text').textContent = unlocked ? hint.text : `Type !hint in chat. ${hint.asks} of ${hint.needed} ${hint.needed === 1 ? 'viewer' : 'viewers'} asked.`;
    if (unlocked && !lastHintUnlocked) cue('hint');
    lastHintUnlocked = unlocked;
  }

  function render(s) {
    if (s.type !== 'state') return;
    state = s;
    if (s.roundStatus !== lastStatus) {
      if (s.roundStatus === 'active' && lastStatus) { cue('start'); tenSecondCue = false; lastHintUnlocked = false; }
      lastStatus = s.roundStatus;
    }
    if (typeof s.serverNow === 'number') clockOffset = s.serverNow - Date.now();
    const tags = [];
    if (s.demo) tags.push(s.unauditedDemo ? 'DEMO MODE, UNAUDITED PUZZLE' : 'DEMO');
    if (s.sandbox) tags.push('SANDBOX');
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
      // One voter is not a chat converging; the line waits for at least two on this side.
      const converging = Boolean(s.leading) && (s.voters ?? 0) >= 2;
      el.phase.textContent = converging ? 'YOUR CHAT IS CONVERGING' : 'YOUR CLUE';
      el.hook.textContent = `Community ${side === 'a' ? 'B' : 'A'} has the other half. Ask your streamer to swap clues.`;
      el.cta.textContent = `Type ${s.commandPrefix || '!g'} and your answer in chat`;
      el.wait.hidden = !converging;
      if (converging) el.wait.textContent = 'Chat is converging on a leading answer';
      renderVotes(s);
      renderTicker(s.recentVotes ?? []);
      renderHint(s.hint);
    }
    if (finished && s.reveal) showReveal(s);
  }

  // The ring drains as time runs out.
  // The swap banner shows during the same server-time window on both overlays.
  let swapCueSeen = 0;
  function renderSwap() {
    const cueWindow = state?.roundStatus === 'active' ? state.swapCue : null;
    const now = Date.now() + clockOffset;
    const show = Boolean(cueWindow && now >= cueWindow.at && now < cueWindow.until);
    if (show && cueWindow.at !== swapCueSeen) { swapCueSeen = cueWindow.at; cue('swap'); }
    root.classList.toggle('is-swapping', show);
  }
  function tick() {
    renderSwap();
    if (state?.roundStatus === 'active' && state.endsAt && state.startedAt) {
      const now = Date.now() + clockOffset;
      const remaining = Math.max(0, state.endsAt - now);
      const left = Math.min(1, Math.max(0, remaining / (state.endsAt - state.startedAt)));
      el.time.textContent = String(Math.ceil(remaining / 1000));
      el.ring.style.strokeDashoffset = String(RING * (1 - left));
      el.card.classList.toggle('urgent', remaining <= 10_000);
      if (remaining <= 10_000 && remaining > 0 && !tenSecondCue) { tenSecondCue = true; cue('tenSeconds'); }
    } else el.card.classList.remove('urgent');
    requestAnimationFrame(tick);
  }
  function connect() {
    // The sandbox gives each visitor their own game, found by a cookie on its own socket path.
    const path = params.get('sandbox') === '1' ? `/sandbox/ws/${side}` : `/overlay/ws/${side}${key ? `?k=${encodeURIComponent(key)}` : ''}`;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${path}`);
    ws.onmessage = event => render(JSON.parse(event.data));
    ws.onclose = () => setTimeout(connect, 1500);
  }
  connect();
  tick();
})();
