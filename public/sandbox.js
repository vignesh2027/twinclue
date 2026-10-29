(() => {
  const $ = selector => document.querySelector(selector);
  let state;
  let clockOffset = 0;
  let toastTimer;
  const say = text => { $('#message').textContent = text; clearTimeout(toastTimer); if (text) toastTimer = setTimeout(() => { $('#message').textContent = ''; }, 3500); };
  const STATUS = { active: 'VOTING LIVE', won: 'BOTH LOCKED IN', 'timed-out': 'TIME UP', unscored: 'NOT SCORED', idle: 'NEXT ROUND SOON', pending: 'NEXT ROUND SOON' };

  async function api(method, path, body) {
    const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, credentials: 'same-origin', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? 'That did not work.');
    if (data.state) render(data.state);
    return data;
  }
  function render(s) {
    state = s;
    clockOffset = s.serverNow - Date.now();
    const active = s.roundStatus === 'active';
    $('#status').dataset.state = s.roundStatus;
    $('#status').textContent = STATUS[s.roundStatus] ?? s.roundStatus.toUpperCase();
    $('#start').disabled = active;
    $('#lock').disabled = !active;
    $('#watch').disabled = active;
    for (const button of document.querySelectorAll('[data-hint]')) button.disabled = !active || s.hints[button.dataset.hint.toLowerCase()].unlocked || !s.hints[button.dataset.hint.toLowerCase()].available;
    $('#score').textContent = `${s.scoreboard.wins} ${s.scoreboard.wins === 1 ? 'win' : 'wins'} · ${s.scoreboard.points ?? 0} points`;
  }
  // The overlays are drawn on a 1920 x 1080 canvas and scaled into each 16:9 screen.
  function fit() { for (const screen of document.querySelectorAll('.screen')) screen.querySelector('iframe').style.transform = `scale(${screen.clientWidth / 1920})`; }
  function tick() {
    if (state?.roundStatus === 'active' && state.endsAt) {
      const seconds = Math.ceil(Math.max(0, state.endsAt - (Date.now() + clockOffset)) / 1000);
      $('#time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    } else $('#time').textContent = '0:00';
    requestAnimationFrame(tick);
  }
  const run = action => async () => { try { await action(); } catch (error) { say(error.message); } };
  $('#start').onclick = run(async () => { await api('POST', '/sandbox/api/start', {}); say('Round started. Read both halves, then vote on both sides.'); });
  $('#lock').onclick = run(() => api('POST', '/sandbox/api/lock', {}));
  const watch = run(async () => { await api('POST', '/sandbox/api/watch', {}); say('Watch both overlays: two halves, one answer.'); });
  $('#watch').onclick = watch;
  for (const form of document.querySelectorAll('form.chat')) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const input = form.querySelector('input');
      const text = input.value.trim();
      if (!text) return;
      run(async () => { await api('POST', '/sandbox/api/vote', { side: form.dataset.side, text }); input.value = ''; })();
    });
  }
  for (const button of document.querySelectorAll('[data-hint]')) button.onclick = run(() => api('POST', '/sandbox/api/hint', { side: button.dataset.hint }));
  addEventListener('resize', fit);
  fit();
  // A link ending in #watch starts the sample round on arrival.
  if (location.hash === '#watch') watch(); else run(() => api('GET', '/sandbox/api/state'))();
  setInterval(() => { run(() => api('GET', '/sandbox/api/state'))(); }, 1500);
  tick();
})();
