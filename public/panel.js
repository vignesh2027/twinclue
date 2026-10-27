(() => {
  const $ = selector => document.querySelector(selector);
  const store = { get() { try { return sessionStorage.getItem('twinclue-admin') || ''; } catch { return ''; } }, set(value) { try { sessionStorage.setItem('twinclue-admin', value); } catch { /* private window */ } } };
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('token');
  if (fromHash) { store.set(fromHash); history.replaceState(null, '', location.pathname); }
  let token = fromHash || store.get();
  let socket;
  let links;

  const headers = () => ({ 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) });
  async function api(method, path, body) {
    const response = await fetch(path, { method, headers: headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) { showLogin('That admin token was not accepted.'); throw new Error('Admin token required.'); }
    if (!response.ok) throw new Error(data.error ?? 'Action failed.');
    return data;
  }
  const say = text => { $('#message').textContent = text; };
  const run = action => async () => { try { await action(); say(''); } catch (error) { say(error.message); } };

  function showLogin(text) { $('#login').hidden = false; $('#app').hidden = true; if (text) say(text); }
  function setOptions(element, values, selected) {
    element.replaceChildren(...values.map(value => { const option = document.createElement('option'); option.value = value; option.textContent = value; return option; }));
    element.value = selected;
  }
  function fillVotes(target, rows) {
    $(target).replaceChildren(...rows.map(row => { const li = document.createElement('li'); const name = document.createElement('b'); name.textContent = row.user; const text = document.createElement('span'); text.textContent = row.label; li.append(name, text); return li; }));
  }
  function describeSide(side, health, demo) {
    if (demo) return 'Demo chat';
    if (!health.configured) return side === 'b' ? 'No channel B yet (set CHANNEL_B)' : 'Not configured';
    if (health.connected && health.subscribed) return 'Connected';
    if (health.connected) return 'Connecting to chat';
    return 'Not connected';
  }

  function render(state) {
    if (state.type !== 'panel-state') return;
    $('#login').hidden = true; $('#app').hidden = false;
    setOptions($('#category'), state.options.categories, state.category);
    setOptions($('#difficulty'), state.options.difficultiesByCategory[state.category] ?? ['medium'], state.difficulty);
    $('#demo').hidden = !state.demo;
    $('#rehearsal-tag').hidden = !state.rehearsal;
    $('#rehearsal').checked = state.rehearsal;
    $('#rehearsal-form').hidden = !state.rehearsal;
    for (const side of ['a', 'b']) {
      const health = state.health[side];
      $(`#status-${side}`).classList.toggle('connected', state.demo || (health.connected && health.subscribed));
      $(`#channel-${side}`).textContent = describeSide(side, health, state.demo);
      $(`#error-${side}`).textContent = health.error ? `${health.error}${health.reauthorize ? ' Use "Connect bot account" below.' : ''}` : '';
    }
    $('#bot-status').textContent = state.demo ? 'Demo mode: no Twitch account needed' : state.health.tokenValid ? 'Bot account: authorised' : 'Bot account: not authorised';
    $('#shared-status').textContent = state.health.sharedChat ? 'Shared Chat is on: the bot posts once' : '';
    $('#connect-bot').hidden = state.demo;
    $('#wins').textContent = state.scoreboard.wins;
    $('#wins-label').textContent = state.scoreboard.wins === 1 ? 'win' : 'wins';
    $('#streak').textContent = state.scoreboard.streak;
    $('#duration').value = state.roundLengthSeconds;
    $('#duration-label').textContent = `${state.roundLengthSeconds} seconds`;
    $('#start').disabled = state.roundStatus === 'active';
    $('#lock').disabled = state.roundStatus !== 'active';
    fillVotes('#votes-a', state.recentVotes.a);
    fillVotes('#votes-b', state.recentVotes.b);
    if (!state.packSize) say('No audited puzzles are loaded yet. Run the Puzzle Forge before going live.');
  }

  function connect() {
    socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/overlay/ws/panel`);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token }));
    socket.onmessage = event => render(JSON.parse(event.data));
    socket.onclose = event => { if (event.code === 4401) showLogin('That admin token was not accepted.'); else setTimeout(connect, 1000); };
  }

  async function start() {
    const state = await api('GET', '/api/state');
    render(state);
    links = await api('GET', '/api/overlay-links');
    $('#preview-a').src = links.a;
    connect();
  }

  $('#login-form').onsubmit = event => { event.preventDefault(); token = $('#token').value.trim(); store.set(token); start().catch(error => say(error.message)); };
  $('#start').onclick = run(() => api('POST', '/api/round/start', {}));
  $('#lock').onclick = run(() => api('POST', '/api/round/lock', {}));
  $('#skip').onclick = run(() => api('POST', '/api/round/skip', {}));
  $('#recap').onclick = run(async () => { const result = await api('POST', '/api/recap', {}); say(result.sent ? 'Recap posted.' : 'The recap could not be posted.'); });
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

  start().catch(() => { if (!token) showLogin(); });
})();
