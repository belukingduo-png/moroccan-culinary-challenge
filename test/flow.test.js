'use strict';
/* End-to-end socket test: one host dashboard + three chefs play a full service. */
const { io } = require('socket.io-client');

const URL = process.env.URL || 'http://localhost:3000';
const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

function emit(socket, event, payload) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

(async () => {
  const failures = [];
  const check = (cond, label) => {
    if (cond) log('  ✓', label);
    else {
      failures.push(label);
      log('  ✗', label);
    }
  };

  const host = await connect();
  let latestAdmin = null;
  const feed = [];
  host.on('admin:state', (s) => (latestAdmin = s));
  host.on('log:entry', (e) => feed.push(e));

  const created = await emit(host, 'host:create', {});
  check(created && created.ok && /^[A-Z0-9]{4}$/.test(created.code), `room created (${created.code})`);
  const code = created.code;

  const players = [];
  for (const name of ['Yassine', 'Fatima', 'Omar']) {
    const s = await connect();
    const res = await emit(s, 'player:join', { name, code });
    check(res && res.ok, `${name} joined`);
    players.push({ socket: s, id: res.playerId, name });
  }

  await wait(400);
  check(latestAdmin && latestAdmin.playerCount === 3, 'admin sees 3 chefs');

  const badJoin = await emit(await connect(), 'player:join', { name: 'Ghost', code: 'ZZZZ' });
  check(badJoin && !badJoin.ok, 'bad room code rejected');

  const started = await emit(host, 'host:start', { recipeId: 'tagine' });
  check(started && started.ok, 'service started');
  await wait(300);
  check(latestAdmin.phase === 'playing', 'admin phase = playing');
  check(latestAdmin.recipe && latestAdmin.recipe.id === 'tagine', 'recipe broadcast to admin');

  // live progress must reach the dashboard while the stage is running
  players.forEach((p) => p.socket.emit('player:progress', { stage: 0, progress: 42 }));
  await wait(900);
  check(latestAdmin.players.every((p) => p.progress >= 42), 'live progress reaches the admin dashboard');

  // each chef cooks all four stages
  for (const p of players) {
    for (let stage = 0; stage < 4; stage += 1) {
      p.socket.emit('player:progress', { stage, progress: 60 });
      if (stage === 0) p.socket.emit('player:event', { type: 'chop_bad', stage });
      if (stage === 2) p.socket.emit('player:event', { type: 'burn', stage });
      await wait(120);
      const done = await emit(p.socket, 'player:stage_complete', { stage, progress: 100 });
      check(done && done.ok && done.gained > 0, `${p.name} cleared stage ${stage} (+${done.gained})`);
      await wait(160);
    }
  }

  await wait(900);
  check(latestAdmin.phase === 'finished', 'admin phase = finished');
  check(latestAdmin.finishedCount === 3, 'all three chefs plated');
  const places = latestAdmin.players.map((p) => p.place).sort();
  check(JSON.stringify(places) === '[1,2,3]', 'places assigned 1,2,3');
  check(latestAdmin.players.every((p) => p.score > 0), 'everyone scored');
  check(feed.some((e) => e.severity === 'bad' && e.kind === 'burn'), 'burn event reached the admin feed');
  check(feed.some((e) => e.kind === 'chop_bad'), 'sloppy chop reached the admin feed');
  check(feed.some((e) => e.kind === 'stage'), 'stage completions logged');
  check(feed.some((e) => e.kind === 'finish'), 'finishes logged');
  check(feed.every((e) => typeof e.ts === 'number' && e.player), 'every feed entry timestamped + attributed');

  // wrong-stage and post-finish actions must be refused
  const cheat = await emit(players[0].socket, 'player:stage_complete', { stage: 0, progress: 100 });
  check(cheat && !cheat.ok, 'post-finish stage completion refused');

  // host reset returns everyone to the lobby
  await emit(host, 'host:reset', {});
  await wait(400);
  check(latestAdmin.phase === 'lobby', 'host reset back to lobby');

  // rejoin flow
  const rejoin = await emit(players[1].socket, 'player:rejoin', { code, playerId: players[1].id });
  check(rejoin && rejoin.ok, 'player can rejoin their seat');

  // kick flow
  await emit(host, 'host:kick', { playerId: players[2].id });
  await wait(400);
  check(latestAdmin.playerCount === 2, 'kick removed a chef');

  // close flow
  await emit(host, 'host:close', {});
  await wait(200);
  const afterClose = require('http');
  log(failures.length ? `\nFAILURES (${failures.length}): ${failures.join(' | ')}` : '\nALL CHECKS PASSED');
  players.forEach((p) => p.socket.close());
  host.close();
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('TEST CRASHED', err);
  process.exit(1);
});
