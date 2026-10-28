(() => {
  const $ = selector => document.querySelector(selector);
  const store = { get() { try { return sessionStorage.getItem('twinclue-admin') || ''; } catch { return ''; } }, set(value) { try { sessionStorage.setItem('twinclue-admin', value); } catch { /* private window */ } } };
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('token');
  if (fromHash) { store.set(fromHash); history.replaceState(null, '', location.pathname); }
  let token = fromHash || store.get();
  let socket;
  let links;
  let state;
  let clockOffset = 0;
  let toastTimer;

  const headers = () => ({ 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) });
  async function api(method, path, body) {
    const response = await fetch(path, { method, headers: headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { showLogin('That admin token was not accepted.'); throw new Error('Admin token required.'); }
    if (!response.ok) throw new Error(data.error ?? 'Action failed.');
    return data;
  }
  function say(text) {
    $('#message').textContent = text;
    clearTimeout(toastTimer);
    if (text) toastTimer = setTimeout(() => { $('#message').textContent = ''; }, 4500);
  }
  const run = action => async () => { try { await action(); } catch (error) { say(error.message); } };
  const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

  function showLogin(text) { $('#login').hidden = false; $('#app').hidden = true; if (text) say(text); }
  function setOptions(element, values, selected) {
    element.replaceChildren(...values.map(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; return option; }));
    element.value = selected;
  }
  function fillVotes(target, rows) {
    const list = $(target);
    if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'No votes yet'; list.replaceChildren(li); return; }
    list.replaceChildren(...rows.map(row => { const li = document.createElement('li'); const name = document.createElement('b'); name.textContent = row.user; const text = document.createElement('span'); text.textContent = row.label; li.append(name, text); return li; }));
  }

  // Connection health in plain words, one line per thing that can break.
  function setHealth(id, level, text) {
    const item = $(id);
    item.className = level;
    item.querySelector('span').textContent = text;
  }
  function describeSide(side, health, demo) {
    if (demo) return ['ok', 'Demo chat: scripted votes'];
    if (!health.configured) return side === 'b' ? ['warn', 'No partner set yet. Add CHANNEL_B, or use Rehearsal.'] : ['bad', 'Not configured'];
    if (health.error) return ['bad', `${health.error}${health.reauthorize ? ' Use Connect bot account.' : ''}`];
    if (health.connected && health.subscribed) return ['ok', 'Connected and reading chat'];
    if (health.connected) return ['warn', 'Connected, subscribing to chat'];
    return ['bad', 'Not connected to Twitch chat'];
  }
  function renderHealth(s) {
    const a = describeSide('a', s.health.a, s.demo);
    const b = describeSide('b', s.health.b, s.demo);
    setHealth('#health-a', ...a);
    setHealth('#health-b', ...b);
    setHealth('#health-bot', s.demo || s.health.tokenValid ? 'ok' : 'bad', s.demo ? 'Not needed in demo mode' : s.health.tokenValid ? 'Signed in and validated' : 'Not signed in. Use Connect bot account.');
    setHealth('#health-shared', s.health.sharedChat ? 'ok' : '', s.health.sharedChat ? 'On: one message reaches both chats' : 'Off: the bot posts in each chat');
    $('#connect-bot').hidden = s.demo;
    const good = [a[0], b[0]].every(level => level === 'ok') && (s.demo || s.health.tokenValid);
    $('#health-summary').className = `summary ${good ? 'ok' : 'warn'}`;
    $('#health-summary span').textContent = good ? 'All systems go' : 'Needs attention';
  }

  function hintLine(hint, active) {
    if (hint.unlocked) return ['unlocked', 'Hint unlocked for this community'];
    if (!active) return ['', 'Hint: not used'];
    if (!hint.available) return ['', 'Hint: not available this round'];
    return ['', `Hint: ${hint.asks} of ${hint.needed} viewers asked (!hint)`];
  }

  const STATUS = { active: 'VOTING LIVE', won: 'BOTH LOCKED IN', 'timed-out': 'TIME UP', unscored: 'NOT SCORED', idle: 'NEXT ROUND SOON', pending: 'NEXT ROUND SOON' };
  function render(s) {
    if (s.type !== 'panel-state') return;
    state = s;
    if (typeof s.serverNow === 'number') clockOffset = s.serverNow - Date.now();
    $('#login').hidden = true; $('#app').hidden = false;
    setOptions($('#category'), s.options.categories, s.category);
    setOptions($('#difficulty'), s.options.difficultiesByCategory[s.category] ?? ['medium'], s.difficulty);
    $('#duration').value = s.roundLengthSeconds;
    $('#duration-label').textContent = `${s.roundLengthSeconds} seconds`;
    $('#next-up').textContent = `Next: ${s.category}, ${s.difficulty}, ${s.roundLengthSeconds} seconds`;
    $('#demo').hidden = !s.demo;
    $('#rehearsal-tag').hidden = !s.rehearsal;
    $('#rehearsal').checked = s.rehearsal;
    $('#rehearsal-form').hidden = !s.rehearsal;
    renderHealth(s);
    const active = s.roundStatus === 'active';
    $('#start').disabled = active || !s.packSize;
    $('#lock').disabled = !active;
    $('#skip').disabled = !active;
    $('#round-status').dataset.state = s.roundStatus;
    $('#round-status').textContent = STATUS[s.roundStatus] ?? s.roundStatus.toUpperCase();
    for (const side of ['a', 'b']) {
      $(`#voters-${side}`).textContent = plural(s.voters[side], 'voter');
      $(`#leader-${side}`).textContent = s.leading[side] ?? 'No leader yet';
      const [level, text] = hintLine(s.hints[side], active);
      $(`#hint-${side}`).className = `hint-status ${level}`;
      $(`#hint-${side}`).textContent = text;
      fillVotes(`#votes-${side}`, s.recentVotes[side]);
    }
    $('#stat-rounds').textContent = s.scoreboard.rounds;
    $('#stat-wins').textContent = s.scoreboard.wins;
    $('#stat-points').textContent = s.scoreboard.points ?? 0;
    $('#stat-streak').textContent = s.scoreboard.streak;
    $('#stat-best').textContent = s.scoreboard.bestStreak ?? 0;
    if (!s.packSize) say('No audited puzzles are loaded yet. Run the Puzzle Forge before going live.');
  }

  // The timer counts down locally between frames, corrected by the server's clock.
  function tick() {
    const s = state;
    const timer = $('.timer');
    if (s?.roundStatus === 'active' && s.endsAt && s.startedAt) {
      const now = Date.now() + clockOffset;
      const remaining = Math.max(0, s.endsAt - now);
      const seconds = Math.ceil(remaining / 1000);
      $('#time-left').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      $('#time-bar').style.width = `${Math.min(100, Math.max(0, (remaining / (s.endsAt - s.startedAt)) * 100))}%`;
      $('#round-meta').textContent = `${s.category}, ${s.difficulty}. Ends automatically, or when both chats agree.`;
      timer.classList.toggle('urgent', remaining <= 10_000);
      timer.classList.remove('idle');
    } else if (s) {
      timer.classList.add('idle');
      $('#time-left').textContent = '0:00';
      $('#time-bar').style.width = '0%';
      $('#round-meta').textContent = s.roundStatus === 'idle' || s.roundStatus === 'pending' ? 'No round running. Press Start or S.' : 'Round over. The overlays are showing the reveal.';
      timer.classList.remove('urgent');
    }
    requestAnimationFrame(tick);
  }

  function connect() {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/overlay/ws/panel`);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = event => render(JSON.parse(event.data));
    socket.onclose = event => { if (event.code === 4401) showLogin('That admin token was not accepted.'); else setTimeout(connect, 1000); };
  }

  async function start() {
    render(await api('GET', '/api/state'));
    links = await api('GET', '/api/overlay-links');
    $('#preview-a').src = links.a;
    connect();
  }

  const actions = {
    start: run(async () => { await api('POST', '/api/round/start', {}); say('Round started.'); }),
    lock: run(async () => { await api('POST', '/api/round/lock', {}); say('Votes locked.'); }),
    skip: run(async () => { await api('POST', '/api/round/skip', {}); say('Round skipped. It does not count.'); }),
  };
  const openDrawer = open => { $('#drawer').hidden = !open; };
  const openHelp = open => { $('#help').hidden = !open; };

  $('#login-form').onsubmit = event => { event.preventDefault(); token = $('#token').value.trim(); store.set(token); start().catch(error => say(error.message)); };
  $('#start').onclick = actions.start;
  $('#lock').onclick = actions.lock;
  $('#skip').onclick = actions.skip;
  $('#recap').onclick = run(async () => {
    const result = await api('POST', '/api/recap', {});
    const link = document.createElement('a');
    link.href = result.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = result.url;
    $('#recap-link').replaceChildren(result.sent ? 'Posted in chat: ' : 'Recap ready (chat is not connected): ', link);
    $('#recap-link').hidden = false;
    say(result.sent ? 'Recap posted in chat.' : 'Recap page is ready.');
  });
  $('#connect-bot').onclick = run(async () => { const result = await api('POST', '/auth/start', { role: 'bot' }); location.href = result.url; });
  $('#rehearsal').onchange = run(() => api('POST', '/api/rehearsal', { enabled: $('#rehearsal').checked }));
  $('#rehearsal-form').onsubmit = event => { event.preventDefault(); const text = $('#rehearsal-text').value.trim(); if (!text) return; run(async () => { await api('POST', '/api/rehearsal/vote', { text }); $('#rehearsal-text').value = ''; })(); };
  const copy = side => run(async () => { await navigator.clipboard.writeText(links[side]); say(`Overlay ${side.toUpperCase()} link copied.`); });
  $('#copy-a').onclick = copy('a');
  $('#copy-b').onclick = copy('b');
  const save = run(() => api('POST', '/api/settings', { category: $('#category').value, difficulty: $('#difficulty').value, roundLengthSeconds: Number($('#duration').value) }));
  $('#category').onchange = save;
  $('#difficulty').onchange = save;
  $('#duration').oninput = () => { $('#duration-label').textContent = `${$('#duration').value} seconds`; };
  $('#duration').onchange = save;
  $('#open-settings').onclick = () => openDrawer(true);
  $('#close-settings').onclick = () => openDrawer(false);
  $('#open-help').onclick = () => openHelp(true);
  $('#close-help').onclick = () => openHelp(false);

  // Keyboard shortcuts, ignored while typing in a field.
  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) return;
    if ($('#app').hidden) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') { openDrawer(false); openHelp(false); return; }
    const button = { s: '#start', l: '#lock', k: '#skip' }[key];
    if (button) { event.preventDefault(); if (!$(button).disabled) $(button).click(); return; }
    if (key === ',') { event.preventDefault(); openDrawer($('#drawer').hidden); return; }
    if (key === '?') { event.preventDefault(); openHelp($('#help').hidden); }
  });

  start().catch(() => { if (!token) showLogin(); });
  tick();
})();
