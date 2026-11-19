'use strict';
/* Front-end integration test: loads the real index.html + app.js in jsdom and
   plays through all four cooking stages, plus a host dashboard render. */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const PUB = path.join(__dirname, '..', 'public');
const failures = [];
const check = (cond, label) => {
  if (cond) console.log('  ✓', label);
  else {
    failures.push(label);
    console.log('  ✗', label);
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8')
  .replace(/<script[^>]*><\/script>/g, '') // scripts are injected manually below
  .replace(/<script[\s\S]*?<\/script>/g, '');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:3000/' });
const { window } = dom;
const doc = window.document;
const $ = (id) => doc.getElementById(id);

/* fake socket.io client ------------------------------------------------ */
const handlers = {};
const emitted = [];
const fakeSocket = {
  on(event, fn) {
    (handlers[event] = handlers[event] || []).push(fn);
  },
  emit(event, payload, ack) {
    emitted.push({ event, payload });
    if (typeof payload === 'function') ack = payload;
    if (!ack) return;
    if (event === 'player:join') {
      if (payload.code === 'GOOD') ack({ ok: true, playerId: 'p1', code: 'GOOD', player: { id: 'p1', name: payload.name } });
      else ack({ ok: false, error: 'No kitchen with that code.' });
    } else if (event === 'player:stage_complete') {
      const finished = payload.stage === 3;
      ack({ ok: true, gained: 1500, score: 1500 + payload.stage * 100, finished, place: finished ? 2 : null });
    } else if (event === 'player:progress') {
      /* fire and forget */
    } else {
      ack({ ok: true });
    }
  }
};
window.io = () => fakeSocket;
const fire = (event, data) => (handlers[event] || []).forEach((fn) => fn(data));

/* load the real client scripts ----------------------------------------- */
window.eval(fs.readFileSync(path.join(PUB, 'recipes.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(PUB, 'app.js'), 'utf8'));

(async () => {
  console.log('\n– landing + join –');
  check($('view-landing').classList.contains('active'), 'landing view is visible');

  $('playerName').value = 'Yassine';
  $('roomCode').value = 'ZZZZ';
  $('joinForm').dispatchEvent(new window.Event('submit', { cancelable: true }));
  check($('joinError').textContent.includes('No kitchen'), 'bad code shows an error, not a crash');

  $('roomCode').value = 'good';
  $('joinForm').dispatchEvent(new window.Event('submit', { cancelable: true }));
  check($('joinError').textContent === '', 'valid join clears the error');
  check($('view-lobby').classList.contains('active'), 'lobby shown after joining');
  check($('lobbyCode').textContent === 'GOOD', 'room code shown in lobby');

  fire('room:state', { code: 'GOOD', phase: 'lobby', players: [{ id: 'p1', name: 'Yassine', connected: true }] });
  check($('lobbyRoster').children.length === 1, 'lobby roster lists the chef');

  console.log('\n– stage 1: prep & chop –');
  const recipe = window.RECIPES.tagine;
  const meta = window.STAGE_META;
  fire('match:start', { recipe, stages: meta, startedAt: Date.now() });
  check($('view-game').classList.contains('active'), 'game view is visible');
  check($('stage-prep').classList.contains('active'), 'prep panel active');
  check($('chopList').querySelectorAll('.chop-item').length === recipe.prep.ingredients.length, 'every ingredient listed');
  check($('knifeZone').style.width === '42%', 'knife green band positioned');
  check(/CHOP ONION/.test($('chopBtn').textContent), 'button names the current ingredient');

  const before = parseFloat($('stageProgress').style.width || '0');
  let chopMistakes = 0;
  for (let i = 0; i < 26; i += 1) {
    const btn = $('chopBtn');
    const ev = new window.Event('pointerdown', { bubbles: true, cancelable: true });
    btn.dispatchEvent(ev);
    await wait(45); // let the blade travel between taps
  }
  check(parseFloat($('stageProgress').style.width) > before, 'chopping advances progress');
  check(emitted.filter((e) => e.event === 'player:event' && e.payload.type === 'chop_good').length > 0, 'clean chops reported');
  check(doc.querySelector('.chop-item .tally').textContent !== '0/8', 'chop tally updates on the ingredient chip');
  check(doc.querySelectorAll('.chop-item.done').length > 0, 'finished ingredients get marked done');

  console.log('\n– stage 2: spices –');
  fire('player:stage', { stage: 1, recipe, player: { id: 'p1', score: 1534, stageRemaining: 45 } });
  check($('stage-spice').classList.contains('active'), 'spice panel active');
  check($('spiceRows').querySelectorAll('.spice-row').length === recipe.spice.spices.length, 'every spice has a row');
  // hit the exact targets
  recipe.spice.spices.forEach((s) => {
    const row = $('spiceRows').querySelector(`[data-id="${s.id}"]`);
    const plus = row.querySelector('[data-act="plus"]');
    for (let i = 0; i < s.target / 5; i += 1) plus.dispatchEvent(new window.Event('click', { bubbles: true }));
  });
  check($('spiceTotal').textContent === '100', 'mix totals 100 when targets are matched');
  check(doc.querySelectorAll('.spice-row.hit').length === recipe.spice.spices.length, 'matched spices flagged as on target');
  $('spiceSubmit').dispatchEvent(new window.Event('click', { bubbles: true }));
  check(emitted.some((e) => e.event === 'player:stage_complete' && e.payload.stage === 1), 'balanced mix completes the stage');

  console.log('\n– stage 3: heat –');
  fire('player:stage', { stage: 2, recipe, player: { id: 'p1', score: 3100, stageRemaining: 28 } });
  check($('stage-heat').classList.contains('active'), 'heat panel active');
  const band = doc.querySelector('.sweet-band');
  check(band.style.left === '58%' && band.style.width === '24%', 'sweet spot band matches the recipe');
  const needleBefore = $('needle').style.left;
  await wait(250);
  check($('needle').style.left !== needleBefore, 'flame needle animates');
  // hold the bellows in the sweet spot
  $('bellowsBtn').dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  await wait(600);
  check(parseFloat($('holdFill').style.width) > 0, 'holding in the sweet spot fills the gauge');
  $('bellowsBtn').dispatchEvent(new window.Event('pointerup', { bubbles: true }));

  console.log('\n– stage 4: plating –');
  fire('player:stage', { stage: 3, recipe, player: { id: 'p1', score: 4600, stageRemaining: 35 } });
  check($('stage-plate').classList.contains('active'), 'plating panel active');
  const tray = $('garnishTray').querySelectorAll('.garnish');
  check(tray.length === recipe.plate.required.length + recipe.plate.extras.length, 'tray mixes correct garnishes with decoys');
  const decoy = [...tray].find((b) => recipe.plate.extras.some((e) => e.id === b.dataset.id));
  decoy.dispatchEvent(new window.Event('click', { bubbles: true }));
  check(emitted.some((e) => e.event === 'player:event' && e.payload.type === 'garnish_wrong'), 'wrong garnish is reported as a mistake');
  check(doc.querySelectorAll('.plate-item').length === 0, 'wrong garnish is not plated');
  recipe.plate.required.forEach((g) => {
    const btn = [...$('garnishTray').querySelectorAll('.garnish')].find((b) => b.dataset.id === g.id);
    btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  });
  check(doc.querySelectorAll('.plate-item').length === recipe.plate.required.length, 'required garnishes land on the plate');

  console.log('\n– results –');
  await wait(100);
  const results = emitted.filter((e) => e.event === 'player:stage_complete');
  check(results.length >= 2, 'stage completions were submitted');
  check($('view-results').classList.contains('active'), 'results view shown after the final stage');
  check(parseInt($('resultScore').textContent, 10) > 0, 'final score rendered');

  console.log('\n– admin dashboard render –');
  const adminDom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost:3000/#host' });
  const aWin = adminDom.window;
  const aHandlers = {};
  const aSocket = {
    on: (ev, fn) => ((aHandlers[ev] = aHandlers[ev] || []).push(fn)),
    emit: (ev, payload, ack) => {
      if (ev === 'host:create' && ack) ack({ ok: true, code: 'TEST' });
      else if (ev === 'host:resume' && ack) ack({ ok: false });
      else if (ack) ack({ ok: true });
    }
  };
  aWin.io = () => aSocket;
  aWin.eval(fs.readFileSync(path.join(PUB, 'recipes.js'), 'utf8'));
  aWin.eval(fs.readFileSync(path.join(PUB, 'app.js'), 'utf8'));
  check(aWin.document.getElementById('view-admin').classList.contains('active'), 'host dashboard opens in host mode');
  check(aWin.document.getElementById('recipePick').options.length === 3, 'all three recipes offered');
  check(aWin.document.getElementById('adminCode').textContent === 'TEST', 'room code displayed');

  const sample = {
    code: 'TEST',
    phase: 'playing',
    recipeId: 'tagine',
    playerCount: 3,
    finishedCount: 1,
    elapsed: 73,
    players: [
      { id: 'a', name: 'Yassine', connected: true, stage: 1, stageName: 'Spice Balancing', progress: 62, score: 1534, mistakes: 2, hits: 18, finished: false, place: null, stageRemaining: 21, finishTimeMs: null },
      { id: 'b', name: 'Fatima', connected: true, stage: 4, stageName: 'Plated', progress: 100, score: 6900, mistakes: 0, hits: 30, finished: true, place: 1, stageRemaining: 0, finishTimeMs: 61000 },
      { id: 'c', name: 'Omar', connected: false, stage: 0, stageName: 'Prep & Chopping', progress: 20, score: 0, mistakes: 4, hits: 6, finished: false, place: null, stageRemaining: 4, finishTimeMs: null }
    ],
    log: [
      { id: 1, ts: Date.now() - 5000, player: 'Kitchen', kind: 'system', severity: 'good', text: 'Service started: Chicken Tagine with Preserved Lemon with 3 chef(s).' },
      { id: 2, ts: Date.now() - 4000, player: 'Omar', kind: 'chop_bad', severity: 'warn', text: 'sloppy chop, uneven pieces' },
      { id: 3, ts: Date.now() - 3000, player: 'Yassine', kind: 'burn', severity: 'bad', text: 'burned the pot!' },
      { id: 4, ts: Date.now() - 2000, player: 'Fatima', kind: 'finish', severity: 'good', text: 'plated and served! Finished #1 with 6900 pts' }
    ]
  };
  aHandlers['admin:state'].forEach((fn) => fn(sample));
  const grid = aWin.document.getElementById('playersGrid');
  check(grid.querySelectorAll('.player-card').length === 3, 'one card per chef');
  check(grid.querySelectorAll('.player-card.done').length === 1, 'finished chef marked done');
  check(grid.querySelectorAll('.player-card.offline').length === 1, 'disconnected chef marked offline');
  check(grid.textContent.includes('6900') || grid.textContent.includes('6 900'), 'scores shown on cards');
  check(aWin.document.getElementById('statDone').textContent === '1/3', 'finished count shown');
  check(aWin.document.getElementById('statTime').textContent === '1:13', 'elapsed clock formatted');
  const feed = aWin.document.getElementById('feed');
  check(feed.children.length === 4, 'feed rendered all entries');
  check(feed.querySelectorAll('li.bad').length === 1, 'mistakes styled red in the feed');
  check(feed.textContent.includes('burned the pot'), 'feed carries the mistake text');

  // filter chips
  aWin.document.querySelector('#feedFilters [data-filter="errors"]').dispatchEvent(new aWin.Event('click', { bubbles: true }));
  check(aWin.document.getElementById('feed').children.length === 2, 'error filter narrows the feed');

  console.log(
    failures.length ? `\nFAILURES (${failures.length}): ${failures.join(' | ')}` : '\nALL UI CHECKS PASSED'
  );
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('UI TEST CRASHED', err);
  process.exit(1);
});
