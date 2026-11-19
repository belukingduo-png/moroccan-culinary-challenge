'use strict';
/* Moroccan Culinary Challenge — client */
const socket = io();
const $ = (id) => document.getElementById(id);
const LS_PLAYER = 'mcc.player';
const LS_HOST = 'mcc.host';

const state = {
  role: null,
  code: null,
  playerId: null,
  name: null,
  recipe: null,
  stages: [],
  stage: 0,
  phase: 'landing',
  player: null,
  startedAt: null,
  admin: null,
  logFilter: 'all',
  seenLog: new Set(),
  completing: false,
  sound: true
};

/* ------------------------------------------------------------------ utils */

function show(view) {
  document.querySelectorAll('.view').forEach((el) => el.classList.toggle('active', el.id === 'view-' + view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* tiny synth so the game has a voice */
let audioCtx = null;
function blip(freq = 520, dur = 0.09, type = 'sine', gain = 0.05) {
  if (!state.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(g).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (_) { /* audio is a bonus, never a blocker */ }
}

$('soundToggle').addEventListener('click', () => {
  state.sound = !state.sound;
  $('soundToggle').innerHTML = `${state.sound ? '🔔' : '🔇'} <span>sound</span>`;
  if (state.sound) blip(660, 0.07);
});

/* --------------------------------------------------------------- landing */

document.querySelectorAll('.role-card').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.role === 'host') {
      startHost();
    } else {
      $('playerName').focus();
      $('joinCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
});

$('joinForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('playerName').value.trim();
  const code = $('roomCode').value.trim().toUpperCase();
  if (!name) return ($('joinError').textContent = 'Give your chef a name.');
  if (code.length !== 4) return ($('joinError').textContent = 'Room codes are 4 characters.');
  joinRoom(name, code);
});

function joinRoom(name, code) {
  $('joinError').textContent = '';
  socket.emit('player:join', { name, code }, (res) => {
    if (!res || !res.ok) {
      $('joinError').textContent = (res && res.error) || 'Could not join.';
      return;
    }
    state.role = 'player';
    state.code = res.code;
    state.playerId = res.playerId;
    state.name = res.player.name;
    state.phase = 'lobby';
    localStorage.setItem(LS_PLAYER, JSON.stringify({ code: res.code, playerId: res.playerId, name: res.player.name }));
    $('lobbyCode').textContent = res.code;
    $('lobbyName').textContent = res.player.name;
    show('lobby');
    blip(720, 0.08);
  });
}

/* ------------------------------------------------------------------ host */

function startHost(resumeCode) {
  const payload = { code: resumeCode || null };
  socket.emit(resumeCode ? 'host:resume' : 'host:create', payload, (res) => {
    if (!res || !res.ok) {
      if (resumeCode) {
        localStorage.removeItem(LS_HOST);
        return startHost();
      }
      toast((res && res.error) || 'Could not open a kitchen.');
      return;
    }
    state.role = 'host';
    state.code = res.code;
    state.phase = 'lobby';
    localStorage.setItem(LS_HOST, res.code);
    $('adminCode').textContent = res.code;
    buildRecipePicker();
    history.replaceState(null, '', '#host');
    show('admin');
    blip(600, 0.1, 'triangle');
  });
}

function buildRecipePicker() {
  const sel = $('recipePick');
  if (sel.options.length) return;
  Object.values(RECIPES).forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.emoji}  ${r.name}`;
    sel.appendChild(opt);
  });
}

$('startBtn').addEventListener('click', () => {
  socket.emit('host:start', { recipeId: $('recipePick').value }, (res) => {
    if (!res || !res.ok) toast((res && res.error) || 'Cannot start yet.');
  });
});

$('resetBtn').addEventListener('click', () => {
  socket.emit('host:reset', {}, (res) => {
    if (res && res.ok) toast('Kitchen reset. Chefs can join again.');
  });
});

$('copyCode').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.code || '');
    toast('Room code copied.');
  } catch (_) {
    toast('Code: ' + (state.code || ''));
  }
});

$('copyLink').addEventListener('click', async () => {
  const url = `${location.origin}${location.pathname}?room=${state.code}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Join link copied. Send it to your chefs.');
  } catch (_) {
    toast(url);
  }
});

$('feedFilters').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.logFilter = chip.dataset.filter;
  document.querySelectorAll('#feedFilters .chip').forEach((c) => c.classList.toggle('active', c === chip));
  renderFeed(true);
});

/* ------------------------------------------------------------ admin draw */

socket.on('admin:state', (data) => {
  if (state.role !== 'host') return;
  state.code = data.code;
  state.admin = data;
  state.phase = data.phase;
  $('adminCode').textContent = data.code;
  $('statChefs').textContent = data.playerCount;
  $('statDone').textContent = `${data.finishedCount}/${data.playerCount}`;
  $('statTime').textContent = fmtClock(data.elapsed);
  const phaseEl = $('statPhase');
  phaseEl.textContent = data.phase;
  phaseEl.className = 'phase-chip ' + data.phase;
  $('startBtn').disabled = data.phase === 'playing' || data.playerCount === 0;
  $('startBtn').textContent = data.phase === 'lobby' ? 'Start service' : data.phase === 'playing' ? 'Service running' : 'Run it again';
  if (data.recipeId && $('recipePick').value !== data.recipeId) $('recipePick').value = data.recipeId;
  renderPlayers(data.players);
  mergeLog(data.log || []);
});

function renderPlayers(players) {
  const grid = $('playersGrid');
  if (!players || !players.length) {
    grid.innerHTML = '<p class="empty-note">No chefs yet. Share the room code.</p>';
    return;
  }
  const frag = document.createDocumentFragment();
  players.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'player-card';
    if (!p.connected) card.classList.add('offline');
    if (p.finished) card.classList.add('done');
    else if (p.stageRemaining <= 5 && state.phase === 'playing') card.classList.add('warning');
    const medal = p.place ? ['🥇', '🥈', '🥉'][p.place - 1] || '' : '';
    card.innerHTML = `
      <div class="pc-top">
        <span class="pc-name">${medal} ${escapeHtml(p.name)}</span>
        <span class="pc-stage">${p.finished ? 'plated' : escapeHtml(p.stageName)}</span>
      </div>
      <div class="pc-bar"><span style="width:${p.progress}%"></span></div>
      <div class="pc-meta">
        <span><b>${p.score}</b> pts</span>
        <span>${p.hits} clean · <b>${p.mistakes}</b> bad</span>
      </div>
      <div class="pc-foot">
        <span>${p.finished ? `finished · ${(p.finishTimeMs / 1000).toFixed(0)}s` : `time left ${p.stageRemaining}s`}</span>
        <span class="pc-score">#${i + 1}</span>
      </div>`;
    frag.appendChild(card);
  });
  grid.innerHTML = '';
  grid.appendChild(frag);
}

function mergeLog(entries) {
  const feed = $('feed');
  const fresh = entries.filter((e) => !state.seenLog.has(e.id));
  fresh.forEach((entry) => {
    state.seenLog.add(entry.id);
    if (!passesFilter(entry)) return;
    feed.appendChild(feedItem(entry));
  });
  while (feed.children.length > 140) feed.removeChild(feed.firstChild);
  trimLogMemory(entries);
  feed.scrollTop = feed.scrollHeight;
}

function trimLogMemory(entries) {
  if (state.seenLog.size > 600) {
    state.seenLog = new Set(entries.map((e) => e.id));
  }
}

socket.on('log:entry', (entry) => {
  if (state.role !== 'host' || state.seenLog.has(entry.id)) return;
  state.seenLog.add(entry.id);
  if (!passesFilter(entry)) return;
  const feed = $('feed');
  feed.appendChild(feedItem(entry));
  feed.scrollTop = feed.scrollHeight;
  if (entry.severity === 'bad') blip(180, 0.16, 'sawtooth', 0.045);
});

function passesFilter(entry) {
  if (state.logFilter === 'all') return true;
  if (state.logFilter === 'errors') return ['warn', 'bad', 'timeout'].includes(entry.severity) || ['burn', 'chop_bad', 'spice_wrong', 'garnish_wrong', 'timeout'].includes(entry.kind);
  if (state.logFilter === 'joins') return entry.kind === 'join' || entry.kind === 'system';
  return true;
}

function feedItem(entry) {
  const li = document.createElement('li');
  li.className = entry.severity;
  li.innerHTML = `<time>${fmtTime(entry.ts)}</time><div><span class="who">${escapeHtml(entry.player)}</span> ${escapeHtml(entry.text)}</div>`;
  return li;
}

function renderFeed(reset) {
  const feed = $('feed');
  feed.innerHTML = '';
  const entries = (state.admin && state.admin.log) || [];
  entries.filter(passesFilter).forEach((e) => feed.appendChild(feedItem(e)));
  if (!feed.children.length && !reset) return;
  feed.scrollTop = feed.scrollHeight;
}

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ----------------------------------------------------------- player flow */

socket.on('room:state', (data) => {
  if (state.code !== data.code) return;
  if (state.role === 'player' && data.phase === 'lobby') {
    $('lobbyCode').textContent = data.code;
    $('lobbyRoster').innerHTML = data.players
      .map((p) => `<li>${escapeHtml(p.name)}${p.connected ? '' : ' · offline'}</li>`)
      .join('');
  }
});

socket.on('match:start', (data) => {
  if (state.role !== 'player') return;
  state.recipe = data.recipe;
  state.stages = data.stages;
  state.startedAt = data.startedAt;
  state.player = { score: 0, stageScores: [0, 0, 0, 0] };
  beginStage(0, data.recipe.prep.seconds);
  show('game');
  blip(880, 0.12, 'triangle');
  toast(`${data.recipe.emoji} Cooking: ${data.recipe.name}`, 3200);
});

socket.on('player:reset', () => { /* fresh service; match:start follows */ });

socket.on('player:stage', (data) => {
  if (state.role !== 'player') return;
  state.recipe = data.recipe || state.recipe;
  state.player = { ...(state.player || {}), ...(data.player || {}) };
  const seconds = stageSeconds(state.recipe, data.stage);
  beginStage(data.stage, data.player && data.player.stageRemaining ? data.player.stageRemaining : seconds);
  updateScoreHud();
});

socket.on('player:state', (data) => {
  if (state.role !== 'player') return;
  state.player = data.player;
  updateScoreHud();
});

socket.on('match:reset', () => {
  if (state.role === 'player') {
    cancelStageLoops();
    state.phase = 'lobby';
    show('lobby');
    toast('The host reset the kitchen.');
  }
});

socket.on('match:over', (data) => {
  if (state.role !== 'player') return;
  const mine = (data.players || []).find((p) => p.id === state.playerId);
  if (mine) showResults(mine);
});

socket.on('room:closed', () => {
  cancelStageLoops();
  localStorage.removeItem(LS_PLAYER);
  state.role = null;
  toast('The host closed the kitchen.');
  show('landing');
});

socket.on('player:kicked', (data) => {
  cancelStageLoops();
  localStorage.removeItem(LS_PLAYER);
  state.role = null;
  toast((data && data.reason) || 'You left the kitchen.');
  show('landing');
});

function stageSeconds(recipe, stage) {
  if (!recipe) return 40;
  if (stage === 0) return recipe.prep.seconds;
  if (stage === 1) return recipe.spice.seconds;
  if (stage === 2) return recipe.heat.seconds;
  if (stage === 3) return recipe.plate.seconds;
  return 40;
}

/* -------------------------------------------------------------- game loop */

let rafId = null;
let tickId = null;
let stageDeadline = 0;
let progressTimer = null;
let localProgress = 0;

function cancelStageLoops() {
  if (rafId) cancelAnimationFrame(rafId);
  if (tickId) clearInterval(tickId);
  if (progressTimer) clearInterval(progressTimer);
  rafId = tickId = progressTimer = null;
}

function beginStage(stage, seconds) {
  cancelStageLoops();
  state.stage = stage;
  state.completing = false;
  localProgress = 0;
  stageDeadline = Date.now() + seconds * 1000;

  const meta = (state.stages && state.stages[stage]) || { name: 'Cooking', icon: '🍳', hint: '' };
  $('stageIcon').textContent = meta.icon;
  $('stageLabel').textContent = meta.name;
  $('stageHint').textContent = meta.hint || '';
  document.querySelectorAll('.stage-panel').forEach((p) => p.classList.remove('active'));
  const panels = ['stage-prep', 'stage-spice', 'stage-heat', 'stage-plate'];
  $(panels[stage]).classList.add('active');
  setProgress(0);

  tickId = setInterval(() => {
    const left = Math.max(0, (stageDeadline - Date.now()) / 1000);
    $('timerValue').textContent = left.toFixed(1);
    $('timerValue').parentElement.classList.toggle('urgent', left <= 7);
    if (left <= 0) $('timerValue').textContent = '0.0';
  }, 100);

  progressTimer = setInterval(() => {
    socket.emit('player:progress', { stage, progress: localProgress });
  }, 250);

  if (stage === 0) startPrep();
  else if (stage === 1) startSpice();
  else if (stage === 2) startHeat();
  else if (stage === 3) startPlate();
}

function setProgress(pct) {
  localProgress = Math.max(localProgress, Math.min(100, pct));
  $('stageProgress').style.width = `${localProgress}%`;
  if (localProgress >= 100) finishStage();
}

function finishStage() {
  if (state.completing) return;
  state.completing = true;
  cancelStageLoops();
  blip(980, 0.14, 'triangle');
  socket.emit('player:stage_complete', { stage: state.stage, progress: 100 }, (res) => {
    if (!res || !res.ok) return;
    state.player = state.player || {};
    state.player.score = res.score;
    updateScoreHud();
    if (res.finished) {
      showResults({
        score: res.score,
        place: res.place,
        stageScores: state.player.stageScores || [0, 0, 0, 0],
        mistakes: state.player.mistakes || 0,
        hits: state.player.hits || 0,
        name: state.name
      });
      confetti();
    } else {
      toast(`Stage cleared · +${res.gained} pts`, 1600);
    }
  });
}

function updateScoreHud() {
  if (!state.player) return;
  $('scoreValue').textContent = Math.round(state.player.score || 0);
}

/* ---- stage 1: prep & chop ---- */
let prepState = null;
function startPrep() {
  const recipe = state.recipe;
  const ingredients = recipe.prep.ingredients;
  const counts = {};
  ingredients.forEach((i) => (counts[i.id] = 0));
  prepState = {
    ingredients,
    counts,
    index: 0,
    selected: ingredients[0].id,
    pos: 0,
    dir: 1,
    zoneCenter: 0.5,
    zoneWidth: 0.42,
    lastT: performance.now()
  };
  const total = ingredients.reduce((sum, i) => sum + i.chops, 0);
  prepState.total = total;

  $('chopList').innerHTML = ingredients
    .map(
      (ing) => `<button class="chop-item" data-id="${ing.id}">
        <em>${ing.emoji}</em> ${ing.name}
        <span class="tally" data-tally="${ing.id}">0/${ing.chops}</span>
      </button>`
    )
    .join('');
  $('chopList').querySelectorAll('.chop-item').forEach((el) => {
    el.addEventListener('click', () => {
      prepState.selected = el.dataset.id;
      paintPrepChips();
    });
  });
  paintPrepChips();

  const zone = $('knifeZone');
  zone.style.left = `${(prepState.zoneCenter - prepState.zoneWidth / 2) * 100}%`;
  zone.style.width = `${prepState.zoneWidth * 100}%`;

  $('chopBtn').textContent = `CHOP ${ingredients[0].name.toUpperCase()} (${ingredients[0].chops})`;

  // respond to pointer taps immediately, and still work for plain clicks /
  // keyboard / assistive tech that never sends a pointerdown
  const chopBtn = $('chopBtn');
  let lastPointer = 0;
  chopBtn.onpointerdown = (e) => {
    lastPointer = Date.now();
    e.preventDefault();
    doChop();
  };
  chopBtn.onclick = () => {
    if (Date.now() - lastPointer < 400) return; // already handled by pointerdown
    doChop();
  };
  document.onkeydown = (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      doChop();
    }
  };

  const cursor = $('knifeCursor');
  const step = (now) => {
    if (!prepState) return;
    const dt = Math.min(0.05, (now - prepState.lastT) / 1000);
    prepState.lastT = now;
    prepState.pos += prepState.dir * dt * 1.15;
    if (prepState.pos >= 1) {
      prepState.pos = 1;
      prepState.dir = -1;
    } else if (prepState.pos <= 0) {
      prepState.pos = 0;
      prepState.dir = 1;
    }
    cursor.style.left = `${prepState.pos * 100}%`;
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}

function paintPrepChips() {
  const ps = prepState;
  ps.ingredients.forEach((ing, i) => {
    const el = $('chopList').querySelector(`[data-id="${ing.id}"]`);
    if (!el) return;
    el.classList.toggle('current', i === ps.index);
    el.classList.toggle('done', ps.counts[ing.id] >= ing.chops);
    el.classList.toggle('selected', ps.selected === ing.id && i === ps.index);
    const tally = el.querySelector('[data-tally]');
    if (tally) tally.textContent = `${ps.counts[ing.id]}/${ing.chops}`;
  });
  const cur = ps.ingredients[ps.index];
  if (cur) $('chopBtn').textContent = `CHOP ${cur.name.toUpperCase()} (${cur.chops})`;
}

function doChop() {
  const ps = prepState;
  if (!ps || state.completing) return;
  const cur = ps.ingredients[ps.index];
  if (!cur) return;
  if (ps.selected !== cur.id) {
    socket.emit('player:event', { type: 'chop_bad', stage: 0 });
    blip(200, 0.1, 'square', 0.04);
    toast(`Wrong ingredient. You need ${cur.name}.`, 1200);
    return;
  }
  const inZone = Math.abs(ps.pos - ps.zoneCenter) <= ps.zoneWidth / 2;
  ps.counts[cur.id] += 1;
  if (!inZone) {
    socket.emit('player:event', { type: 'chop_bad', stage: 0 });
    blip(200, 0.08, 'square', 0.035);
  } else {
    socket.emit('player:event', { type: 'chop_good', stage: 0 });
    blip(660 + ps.counts[cur.id] * 14, 0.05, 'sine', 0.03);
  }
  const chopped = Object.values(ps.counts).reduce((a, b) => a + b, 0);
  setProgress((chopped / ps.total) * 100);

  if (ps.counts[cur.id] >= cur.chops) {
    const nextIdx = ps.ingredients.findIndex((ing) => ps.counts[ing.id] < ing.chops);
    if (nextIdx >= 0) {
      ps.index = nextIdx;
      ps.selected = ps.ingredients[nextIdx].id;
      blip(820, 0.09, 'triangle', 0.04);
    }
  }
  paintPrepChips();
}

/* ---- stage 2: spice balancing ---- */
let spiceState = null;
function startSpice() {
  const recipe = state.recipe;
  const spices = recipe.spice.spices;
  spiceState = { spices, values: {}, tolerance: recipe.spice.tolerance };
  spices.forEach((s) => (spiceState.values[s.id] = 0));

  $('spiceRows').innerHTML = spices
    .map(
      (s) => `<div class="spice-row" data-id="${s.id}">
        <div class="spice-name"><span>${s.emoji}</span>${s.name}
          <span class="spice-target">target ${s.target}</span>
        </div>
        <button class="step-btn" data-act="minus" aria-label="less ${s.name}">−</button>
        <div class="spice-val" data-val="${s.id}">0</div>
        <button class="step-btn" data-act="plus" aria-label="more ${s.name}">+</button>
      </div>`
    )
    .join('');

  $('spiceRows').querySelectorAll('.step-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.spice-row');
      const id = row.dataset.id;
      const delta = btn.dataset.act === 'plus' ? 5 : -5;
      spiceState.values[id] = Math.max(0, Math.min(100, spiceState.values[id] + delta));
      paintSpice();
      blip(delta > 0 ? 620 : 420, 0.04, 'sine', 0.025);
    });
  });
  paintSpice();
  $('spiceSubmit').onclick = submitSpice;
}

function paintSpice() {
  const ss = spiceState;
  let total = 0;
  ss.spices.forEach((s) => {
    total += ss.values[s.id];
    const row = $('spiceRows').querySelector(`[data-id="${s.id}"]`);
    const valEl = row.querySelector(`[data-val="${s.id}"]`);
    valEl.textContent = ss.values[s.id];
    row.classList.toggle('hit', Math.abs(ss.values[s.id] - s.target) <= ss.tolerance);
  });
  $('spiceTotal').textContent = total;
  const accuracy = ss.spices.reduce(
    (sum, s) => sum + Math.max(0, 1 - Math.abs(ss.values[s.id] - s.target) / 40),
    0
  ) / ss.spices.length;
  setProgress(accuracy * 100);
}

function submitSpice() {
  const ss = spiceState;
  if (!ss || state.completing) return;
  let off = 0;
  ss.spices.forEach((s) => {
    if (Math.abs(ss.values[s.id] - s.target) > ss.tolerance) off += 1;
  });
  const total = ss.spices.reduce((sum, s) => sum + ss.values[s.id], 0);
  if (off === 0 && Math.abs(total - 100) <= 8) {
    setProgress(100);
  } else {
    socket.emit('player:event', { type: 'spice_wrong', stage: 1 });
    blip(190, 0.14, 'square', 0.045);
    toast(off ? `${off} spice${off > 1 ? 's' : ''} off target. Keep adjusting.` : `The mix totals ${total}, not 100.`, 2200);
  }
}

/* ---- stage 3: heat control ---- */
let heatState = null;
function startHeat() {
  const cfg = state.recipe.heat;
  heatState = {
    value: (cfg.low + cfg.high) / 2,
    cfg,
    inZone: 0,
    burnAcc: 0,
    burnCooldown: 0,
    holding: false,
    lastT: performance.now(),
    noiseT: 0
  };
  const band = document.querySelector('.sweet-band');
  band.style.left = `${cfg.low}%`;
  band.style.width = `${cfg.high - cfg.low}%`;
  $('lowLabel').textContent = cfg.low;
  $('highLabel').textContent = cfg.high;
  $('holdFill').style.width = '0%';
  $('holdProgress').textContent = '0%';

  const btn = $('bellowsBtn');
  const down = (e) => {
    e.preventDefault();
    heatState.holding = true;
    btn.classList.add('pressed');
  };
  const up = () => {
    heatState.holding = false;
    btn.classList.remove('pressed');
  };
  btn.onpointerdown = (e) => {
    heatState.lastPointer = Date.now();
    down(e);
  };
  btn.onpointerup = up;
  btn.onpointerleave = up;
  btn.onpointercancel = up;
  // click / keyboard fallback: a short burst of fanning instead of a held press
  btn.onclick = () => {
    if (Date.now() - (heatState.lastPointer || 0) < 400) return;
    heatState.holding = true;
    btn.classList.add('pressed');
    setTimeout(() => {
      if (!heatState) return;
      heatState.holding = false;
      btn.classList.remove('pressed');
    }, 500);
  };
  document.onkeydown = (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      heatState.holding = true;
      btn.classList.add('pressed');
    }
  };
  document.onkeyup = (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      heatState.holding = false;
      btn.classList.remove('pressed');
    }
  };

  const needle = $('needle');
  const step = (now) => {
    if (!heatState) return;
    const dt = Math.min(0.05, (now - heatState.lastT) / 1000);
    heatState.lastT = now;
    heatState.noiseT += dt;
    const hs = heatState;
    const drift = hs.holding ? 28 : -15;
    hs.value += drift * dt + Math.sin(hs.noiseT * 2.4) * 7 * dt;
    hs.value = Math.max(0, Math.min(100, hs.value));
    needle.style.left = `calc(${hs.value}% - 2px)`;

    if (hs.value >= hs.cfg.low && hs.value <= hs.cfg.high) {
      hs.inZone += dt;
      hs.burnAcc = Math.max(0, hs.burnAcc - dt);
      hs.burnCooldown = Math.max(0, hs.burnCooldown - dt);
    }
    if (hs.value > 93) {
      hs.burnAcc += dt;
      if (hs.burnAcc > 0.6 && hs.burnCooldown <= 0) {
        hs.burnCooldown = 1.6;
        hs.burnAcc = 0;
        socket.emit('player:event', { type: 'burn', stage: 2 });
        blip(150, 0.2, 'sawtooth', 0.05);
        toast('🔥 Burning! Ease off the flame.', 1500);
      }
    }
    const pct = Math.min(100, (hs.inZone / hs.cfg.holdSeconds) * 100);
    $('holdFill').style.width = `${pct}%`;
    $('holdProgress').textContent = `${Math.round(pct)}%`;
    setProgress(pct);
    rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
}

/* ---- stage 4: plating ---- */
let plateState = null;
function startPlate() {
  const cfg = state.recipe.plate;
  plateState = { required: cfg.required, placed: new Set() };
  const all = shuffle([...cfg.required, ...cfg.extras]);
  $('plateRecipe').textContent = state.recipe.short || state.recipe.name;
  $('plate').innerHTML = '<span class="plate-empty">tap garnishes below</span>';
  $('garnishTray').innerHTML = all
    .map(
      (g) => `<button class="garnish" data-id="${g.id}"><em>${g.emoji}</em>${g.name}</button>`
    )
    .join('');
  $('garnishTray').querySelectorAll('.garnish').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const isRequired = plateState.required.some((r) => r.id === id);
      if (isRequired && !plateState.placed.has(id)) {
        plateState.placed.add(id);
        btn.classList.add('used');
        addToPlate(plateState.required.find((r) => r.id === id));
        blip(760, 0.07, 'triangle', 0.04);
        setProgress((plateState.placed.size / plateState.required.length) * 100);
      } else if (isRequired) {
        toast('Already plated.', 1000);
      } else {
        socket.emit('player:event', { type: 'garnish_wrong', stage: 3 });
        blip(180, 0.13, 'square', 0.045);
        toast(`${btn.textContent.trim()} does not belong on this dish.`, 1600);
      }
    });
  });
}

function addToPlate(garnish) {
  const plate = $('plate');
  const empty = plate.querySelector('.plate-empty');
  if (empty) empty.remove();
  const span = document.createElement('span');
  span.className = 'plate-item';
  span.textContent = garnish.emoji;
  span.title = garnish.name;
  plate.appendChild(span);
}

/* ---------------------------------------------------------------- results */

function showResults(p) {
  cancelStageLoops();
  const place = p.place || null;
  $('resultTitle').textContent = place
    ? place === 1
      ? 'Master Chef of the Medina!'
      : `You plated at #${place}`
    : 'Service complete';
  $('resultScore').textContent = Math.round(p.score || 0);
  const stageNames = ['Prep', 'Spices', 'Heat', 'Plating'];
  const scores = p.stageScores || [0, 0, 0, 0];
  $('resultBreakdown').innerHTML =
    stageNames
      .map((n, i) => `<li><span>${n}</span><b>+${Math.round(scores[i] || 0)}</b></li>`)
      .join('') +
    `<li><span>Clean moves</span><b>${p.hits || 0}</b></li>` +
    `<li><span>Mistakes</span><b>${p.mistakes || 0}</b></li>`;
  show('results');
  if (place === 1) confetti();
}

/* --------------------------------------------------------------- confetti */

function confetti() {
  const canvas = $('confetti');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return; // no canvas support: celebration is optional, never a crash
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ['#e8b44a', '#68c39f', '#cf6a45', '#f8f1e3', '#e06c78'];
  const parts = Array.from({ length: 90 }, () => ({
    x: canvas.width / 2 + (Math.random() - 0.5) * 160,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: Math.random() * -9 - 2,
    size: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * Math.PI
  }));
  let frames = 0;
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach((p) => {
      p.vy += 0.28;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    frames += 1;
    if (frames < 130) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  draw();
}

/* ------------------------------------------------------------ boot & urls */

function boot() {
  const params = new URLSearchParams(location.search);
  const roomParam = (params.get('room') || '').toUpperCase();
  if (roomParam.length === 4) $('roomCode').value = roomParam;

  if (location.hash === '#host') {
    const saved = localStorage.getItem(LS_HOST);
    startHost(saved || null);
    return;
  }
  const savedPlayer = localStorage.getItem(LS_PLAYER);
  if (savedPlayer) {
    try {
      const p = JSON.parse(savedPlayer);
      socket.emit('player:rejoin', { code: p.code, playerId: p.playerId }, (res) => {
        if (!res || !res.ok) {
          localStorage.removeItem(LS_PLAYER);
          show('landing');
          return;
        }
        state.role = 'player';
        state.code = res.code;
        state.playerId = res.playerId;
        state.name = p.name;
        if (res.phase === 'playing') {
          state.recipe = res.recipe;
          state.stages = STAGE_META;
          state.player = res.player;
          show('game');
          // refresh landed mid-service: pick the stage back up where the server has us
          const stage = res.player && typeof res.player.stage === 'number' ? res.player.stage : 0;
          if (stage < 4) {
            const remaining = res.player && res.player.stageRemaining ? res.player.stageRemaining : stageSeconds(state.recipe, stage);
            beginStage(stage, remaining);
          }
        } else {
          $('lobbyCode').textContent = res.code;
          $('lobbyName').textContent = p.name;
          show('lobby');
        }
      });
      return;
    } catch (_) {
      localStorage.removeItem(LS_PLAYER);
    }
  }
  show('landing');
}

window.addEventListener('beforeunload', () => {
  if (state.role === 'player' && state.playerId) {
    socket.emit('player:progress', { stage: state.stage, progress: localProgress });
  }
});

window.addEventListener('hashchange', () => {
  if (location.hash === '#host' && state.role !== 'host') {
    startHost(localStorage.getItem(LS_HOST) || null);
  }
});

boot();
