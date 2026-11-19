'use strict';
/* Multiplayer Moroccan Culinary Challenge
 * Real-time game server: rooms, players, 4 cooking stages, live admin dashboard.
 * Node + Express + Socket.IO. No database: rooms live in memory.
 */
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { RECIPES, STAGE_META } = require('./public/recipes.js');

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 12;
const MAX_LOG = 400;
const FINISH_BONUS = [600, 400, 250]; // 1st, 2nd, 3rd

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingTimeout: 25000 });

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const rooms = new Map(); // code -> room

app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) });
});

app.get('/api/room/:code', (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ ok: false, error: 'no such room' });
  res.json({
    ok: true,
    code: room.code,
    phase: room.phase,
    recipe: room.recipeId,
    hostConnected: Boolean(room.hostSocketId),
    players: [...room.players.values()].map((p) => ({
      name: p.name,
      stage: p.stage,
      progress: Math.round(p.progress),
      hits: p.hits,
      attempts: p.attempts,
      mistakes: p.mistakes,
      score: Math.round(p.score),
      finished: p.finished,
      remaining: p.stageDeadline ? Math.max(0, Math.round((p.stageDeadline - Date.now()) / 1000)) : null
    })),
    log: room.log.slice(-12)
  });
});

app.get('/api/rooms', (_req, res) => {
  res.json({
    rooms: [...rooms.values()].map((r) => ({
      code: r.code,
      phase: r.phase,
      players: r.players.size,
      recipe: r.recipeId
    }))
  });
});

/* ---------------------------------------------------------------- helpers */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode() {
  let code;
  let guard = 0;
  do {
    code = Array.from({ length: 4 }, () =>
      CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
    ).join('');
    guard += 1;
  } while (rooms.has(code) && guard < 500);
  return code;
}

function cleanName(raw) {
  const name = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 16);
  return name || 'Unknown Chef';
}

function stageSeconds(recipe, stage) {
  if (stage === 0) return recipe.prep.seconds;
  if (stage === 1) return recipe.spice.seconds;
  if (stage === 2) return recipe.heat.seconds;
  if (stage === 3) return recipe.plate.seconds;
  return 0;
}

function addLog(room, entry) {
  const item = {
    id: (room.logSeq = (room.logSeq || 0) + 1),
    ts: Date.now(),
    player: entry.player || 'Kitchen',
    kind: entry.kind || 'info',
    severity: entry.severity || 'info',
    text: String(entry.text || '').slice(0, 180)
  };
  room.log.push(item);
  if (room.log.length > MAX_LOG) room.log.splice(0, room.log.length - MAX_LOG);
  if (room.hostSocketId) io.to(room.hostSocketId).emit('log:entry', item);
  return item;
}

function newPlayer(id, name, socketId) {
  return {
    id,
    name,
    socketId,
    connected: true,
    stage: 0,
    progress: 0,
    score: 0,
    stageScores: [0, 0, 0, 0],
    mistakes: 0,
    stageMistakes: 0,
    hits: 0,
    attempts: 0,
    burnMs: 0,
    stageStartedAt: null,
    stageDeadline: null,
    finished: false,
    finishTimeMs: null,
    place: null,
    scoreFlash: null
  };
}

function playerView(p, now) {
  return {
    id: p.id,
    name: p.name,
    connected: p.connected,
    stage: p.stage,
    stageName: p.stage < STAGE_META.length ? STAGE_META[p.stage].name : 'Plated',
    progress: Math.round(p.progress),
    score: Math.round(p.score),
    stageScores: p.stageScores,
    mistakes: p.mistakes,
    hits: p.hits,
    accuracy: p.attempts + p.hits > 0
      ? Math.round((p.hits / Math.max(1, p.hits + p.mistakes)) * 100)
      : 100,
    finished: p.finished,
    finishTimeMs: p.finishTimeMs,
    place: p.place,
    stageRemaining: p.finished || !p.stageDeadline
      ? 0
      : Math.max(0, Math.round((p.stageDeadline - now) / 1000)),
    scoreFlash: p.scoreFlash
  };
}

function roomView(room) {
  const now = Date.now();
  const players = [...room.players.values()]
    .map((p) => playerView(p, now))
    .sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return (a.place || 99) - (b.place || 99);
      return b.score - a.score;
    });
  const recipe = RECIPES[room.recipeId] || null;
  return {
    code: room.code,
    phase: room.phase,
    recipeId: room.recipeId,
    recipe,
    stages: STAGE_META,
    startedAt: room.startedAt,
    now,
    elapsed: room.startedAt ? Math.round((now - room.startedAt) / 1000) : 0,
    playerCount: room.players.size,
    finishedCount: [...room.players.values()].filter((p) => p.finished).length,
    players,
    log: room.log.slice(-120)
  };
}

function broadcastRoom(room) {
  if (room.hostSocketId) io.to(room.hostSocketId).emit('admin:state', roomView(room));
  const lobby = {
    code: room.code,
    phase: room.phase,
    recipeId: room.recipeId,
    players: [...room.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      ready: true
    })),
    startedAt: room.startedAt,
    stages: STAGE_META
  };
  io.to(room.playerRoom).emit('room:state', lobby);
}

function startPlayerStage(room, player, stage) {
  const recipe = RECIPES[room.recipeId];
  player.stage = stage;
  player.progress = 0;
  player.stageMistakes = 0;
  player.stageStartedAt = Date.now();
  player.stageDeadline = Date.now() + stageSeconds(recipe, stage) * 1000;
}

/* ------------------------------------------------------------ socket API */

io.on('connection', (socket) => {
  socket.data.events = 0;
  socket.data.windowStart = Date.now();
  socket.data.role = null; // 'host' | 'player'
  socket.data.roomCode = null;
  socket.data.playerId = null;

  // crude flood guard: 40 messages / second per socket
  function floodBlocked() {
    const now = Date.now();
    if (now - socket.data.windowStart > 1000) {
      socket.data.windowStart = now;
      socket.data.events = 0;
    }
    socket.data.events += 1;
    return socket.data.events > 40;
  }

  // the room a socket belongs to is tracked at join time; progress events do
  // not carry the code, so never rely on the payload for it
  function boundRoom() {
    return rooms.get(socket.data.roomCode || '') || null;
  }

  /* ---- host ---- */

  socket.on('host:create', (payload, ack) => {
    const room = {
      code: makeCode(),
      hostSocketId: socket.id,
      playerRoom: 'x', // filled below
      phase: 'lobby',
      recipeId: 'tagine',
      startedAt: null,
      endedAt: null,
      players: new Map(),
      log: [],
      logSeq: 0
    };
    room.playerRoom = 'room:' + room.code;
    rooms.set(room.code, room);
    socket.join(room.playerRoom);
    socket.data.role = 'host';
    socket.data.roomCode = room.code;
    addLog(room, { kind: 'system', text: 'Kitchen opened. Waiting for chefs.', severity: 'good' });
    if (typeof ack === 'function') ack({ ok: true, code: room.code });
    broadcastRoom(room);
  });

  socket.on('host:resume', (payload, ack) => {
    const room = rooms.get(String((payload && payload.code) || '').toUpperCase());
    if (!room) return ack && ack({ ok: false, error: 'That kitchen has closed.' });
    room.hostSocketId = socket.id;
    socket.join(room.playerRoom);
    socket.data.role = 'host';
    socket.data.roomCode = room.code;
    addLog(room, { kind: 'system', text: 'Host dashboard reconnected.', severity: 'info' });
    if (typeof ack === 'function') ack({ ok: true, code: room.code });
    broadcastRoom(room);
  });

  socket.on('host:start', (payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== 'host') return ack && ack({ ok: false, error: 'No kitchen.' });
    if (room.phase === 'playing') return ack && ack({ ok: false, error: 'Already cooking.' });
    if (!room.players.size) return ack && ack({ ok: false, error: 'No chefs have joined yet.' });
    const wanted = payload && RECIPES[payload.recipeId] ? payload.recipeId : room.recipeId;
    room.recipeId = wanted;
    const recipe = RECIPES[room.recipeId];
    room.phase = 'playing';
    room.startedAt = Date.now();
    room.endedAt = null;
    for (const p of room.players.values()) {
      p.score = 0;
      p.stageScores = [0, 0, 0, 0];
      p.mistakes = 0;
      p.hits = 0;
      p.attempts = 0;
      p.burnMs = 0;
      p.finished = false;
      p.finishTimeMs = null;
      p.place = null;
      startPlayerStage(room, p, 0);
    }
    addLog(room, {
      kind: 'system',
      text: `Service started: ${recipe.name} with ${room.players.size} chef(s).`,
      severity: 'good'
    });
    io.to(room.playerRoom).emit('match:start', { recipe, stages: STAGE_META, startedAt: room.startedAt });
    for (const p of room.players.values()) {
      if (p.connected) io.to(p.socketId).emit('player:reset', { recipe, player: p });
    }
    ack && ack({ ok: true });
    broadcastRoom(room);
  });

  socket.on('host:reset', (_payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== 'host') return ack && ack({ ok: false, error: 'No kitchen.' });
    room.phase = 'lobby';
    room.startedAt = null;
    room.endedAt = null;
    for (const p of room.players.values()) {
      p.stage = 0;
      p.progress = 0;
      p.score = 0;
      p.stageScores = [0, 0, 0, 0];
      p.mistakes = 0;
      p.stageMistakes = 0;
      p.hits = 0;
      p.attempts = 0;
      p.finished = false;
      p.finishTimeMs = null;
      p.place = null;
      p.stageDeadline = null;
      p.stageStartedAt = null;
    }
    addLog(room, { kind: 'system', text: 'Kitchen reset. Chefs can rejoin for a new service.', severity: 'info' });
    io.to(room.playerRoom).emit('match:reset', {});
    ack && ack({ ok: true });
    broadcastRoom(room);
  });

  socket.on('host:close', (_payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== 'host') return ack && ack({ ok: false });
    io.to(room.playerRoom).emit('room:closed', {});
    rooms.delete(room.code);
    ack && ack({ ok: true });
  });

  socket.on('host:kick', (payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || socket.data.role !== 'host') return ack && ack({ ok: false });
    const player = room.players.get(String(payload && payload.playerId));
    if (!player) return ack && ack({ ok: false, error: 'No such chef.' });
    addLog(room, { player: player.name, kind: 'system', text: `${player.name} was removed from the kitchen.`, severity: 'warn' });
    io.to(player.socketId).emit('player:kicked', { reason: 'The host removed you from this kitchen.' });
    room.players.delete(player.id);
    ack && ack({ ok: true });
    broadcastRoom(room);
  });

  /* ---- player ---- */

  socket.on('player:join', (payload, ack) => {
    const code = String((payload && payload.code) || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: 'No kitchen with that code.' });
    if (room.phase === 'playing') return ack && ack({ ok: false, error: 'That service already started.' });
    if (room.players.size >= MAX_PLAYERS) return ack && ack({ ok: false, error: 'This kitchen is full.' });
    const name = cleanName(payload && payload.name);
    const dupe = [...room.players.values()].some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    const playerId = 'p' + Math.random().toString(36).slice(2, 9);
    const player = newPlayer(playerId, dupe ? `${name} II` : name, socket.id);
    room.players.set(playerId, player);
    socket.join(room.playerRoom);
    socket.data.role = 'player';
    socket.data.roomCode = room.code;
    socket.data.playerId = playerId;
    addLog(room, {
      player: player.name,
      kind: 'join',
      text: `${player.name} entered the kitchen.`,
      severity: 'info'
    });
    ack &&
      ack({
        ok: true,
        playerId,
        code: room.code,
        recipeId: room.recipeId,
        player: { id: playerId, name: player.name }
      });
    broadcastRoom(room);
  });

  socket.on('player:rejoin', (payload, ack) => {
    const code = String((payload && payload.code) || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack && ack({ ok: false, error: 'That kitchen has closed.' });
    const player = room.players.get(String(payload && payload.playerId));
    if (!player) return ack && ack({ ok: false, error: 'Your seat is gone. Join again.' });
    player.socketId = socket.id;
    player.connected = true;
    socket.join(room.playerRoom);
    socket.data.role = 'player';
    socket.data.roomCode = room.code;
    socket.data.playerId = player.id;
    addLog(room, { player: player.name, kind: 'system', text: `${player.name} reconnected.`, severity: 'info' });
    ack && ack({ ok: true, playerId: player.id, code: room.code, phase: room.phase, recipe: RECIPES[room.recipeId], player: playerView(player, Date.now()) });
    if (room.phase === 'playing' && !player.finished) {
      io.to(socket.id).emit('match:start', { recipe: RECIPES[room.recipeId], stages: STAGE_META, startedAt: room.startedAt });
      io.to(socket.id).emit('player:state', { player: playerView(player, Date.now()), recipe: RECIPES[room.recipeId] });
    }
    broadcastRoom(room);
  });

  socket.on('player:progress', (payload) => {
    if (floodBlocked()) return;
    const room = boundRoom();
    const player = room && room.players.get(socket.data.playerId);
    if (!room || !player || player.finished || room.phase !== 'playing') return;
    const stage = Number(payload.stage);
    if (stage !== player.stage) return;
    const progress = Math.max(0, Math.min(100, Number(payload.progress) || 0));
    player.progress = Math.max(player.progress, progress);
    if (payload.detail && typeof payload.detail === 'object') {
      player.detail = payload.detail;
    }
  });

  const EVENT_TEXT = {
    chop_good: { text: 'clean chop', severity: 'info', hit: true },
    chop_bad: { text: 'sloppy chop, uneven pieces', severity: 'warn' },
    spice_wrong: { text: 'wrong spice balance', severity: 'warn' },
    burn: { text: 'burned the pot!', severity: 'bad' },
    heat_recover: { text: 'rescued the flame', severity: 'good' },
    garnish_wrong: { text: 'plated a garnish that does not belong', severity: 'bad' }
  };

  socket.on('player:event', (payload) => {
    if (floodBlocked()) return;
    const room = rooms.get(socket.data.roomCode);
    const player = room && room.players.get(socket.data.playerId);
    if (!room || !player || room.phase !== 'playing' || player.finished) return;
    const meta = EVENT_TEXT[String(payload && payload.type)];
    if (!meta) return;
    if (meta.hit) {
      player.hits += 1;
      player.attempts += 1;
      return; // too chatty for the feed
    }
    player.mistakes += 1;
    player.stageMistakes += 1;
    player.attempts += 1;
    addLog(room, { player: player.name, kind: String(payload.type), text: meta.text, severity: meta.severity });
  });

  socket.on('player:stage_complete', (payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && room.players.get(socket.data.playerId);
    if (!room || !player || room.phase !== 'playing' || player.finished)
      return ack && ack({ ok: false, error: 'Not cooking.' });
    const stage = Number(payload && payload.stage);
    if (stage !== player.stage) return ack && ack({ ok: false, error: 'Wrong stage.' });
    const recipe = RECIPES[room.recipeId];
    const allowed = stageSeconds(recipe, stage);
    const used = player.stageStartedAt ? (Date.now() - player.stageStartedAt) / 1000 : allowed;
    const progress = Math.max(0, Math.min(100, Number(payload && payload.progress) || player.progress));

    const base = 1000 * (progress / 100);
    const speedBonus = Math.max(0, 1 - used / allowed) * 600;
    const penalty = (player.stageMistakes || 0) * 60;
    const gained = Math.round(Math.max(0, base + speedBonus - penalty));

    player.stageScores[stage] = gained;
    player.score += gained;
    player.progress = 100;
    player.scoreFlash = { stage, gained, at: Date.now() };
    addLog(room, {
      player: player.name,
      kind: 'stage',
      text: `${STAGE_META[stage].name} done in ${used.toFixed(1)}s · +${gained} pts${player.stageMistakes ? ` · ${player.stageMistakes} mistake(s)` : ' · flawless'}`,
      severity: player.stageMistakes ? 'info' : 'good'
    });

    const nextStage = stage + 1;
    if (nextStage >= STAGE_META.length) {
      player.finished = true;
      player.stage = STAGE_META.length;
      player.stageDeadline = null;
      player.finishTimeMs = room.startedAt ? Date.now() - room.startedAt : 0;
      const finishers = [...room.players.values()].filter((p) => p.finished && p.place);
      player.place = finishers.length + 1;
      const bonus = FINISH_BONUS[player.place - 1] || 0;
      player.score += bonus;
      addLog(room, {
        player: player.name,
        kind: 'finish',
        text: `plated and served! Finished #${player.place} with ${Math.round(player.score)} pts${bonus ? ` (incl. +${bonus} finishing bonus)` : ''}`,
        severity: 'good'
      });
    } else {
      startPlayerStage(room, player, nextStage);
      io.to(player.socketId).emit('player:stage', {
        stage: nextStage,
        player: playerView(player, Date.now()),
        recipe
      });
    }
    ack && ack({ ok: true, gained, score: Math.round(player.score), finished: player.finished, place: player.place });
    broadcastRoom(room);
  });

  socket.on('player:leave', () => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && room.players.get(socket.data.playerId);
    if (!room || !player) return;
    addLog(room, { player: player.name, kind: 'system', text: `${player.name} left the kitchen.`, severity: 'warn' });
    room.players.delete(player.id);
    socket.data.playerId = null;
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    if (socket.data.role === 'host' && room.hostSocketId === socket.id) {
      room.hostSocketId = null;
      addLog(room, { kind: 'system', text: 'Host dashboard disconnected. Room kept open for reconnecting.', severity: 'warn' });
      return;
    }
    const player = room.players.get(socket.data.playerId);
    if (player && player.socketId === socket.id) {
      player.connected = false;
      addLog(room, { player: player.name, kind: 'system', text: `${player.name} lost connection.`, severity: 'warn' });
      broadcastRoom(room);
    }
  });
});

/* --------------------------------------------------------------- game loop */

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === 'playing') {
      for (const player of room.players.values()) {
        if (!player.finished && player.stageDeadline && now > player.stageDeadline) {
          // stage clock ran out: score what was achieved, then push forward
          const stage = player.stage;
          const recipe = RECIPES[room.recipeId];
          const partial = Math.round(player.progress * 0.35 * 10); // heavily damped
          player.stageScores[stage] = partial;
          player.score += partial;
          player.stageMistakes += 1;
          player.mistakes += 1;
          player.progress = 100;
          addLog(room, {
            player: player.name,
            kind: 'timeout',
            text: `ran out of time on ${STAGE_META[stage].name} · +${partial} pts`,
            severity: 'bad'
          });
          const nextStage = stage + 1;
          if (nextStage >= STAGE_META.length) {
            player.finished = true;
            player.stage = STAGE_META.length;
            player.stageDeadline = null;
            player.finishTimeMs = room.startedAt ? now - room.startedAt : 0;
            const finishers = [...room.players.values()].filter((p) => p.finished && p.place);
            player.place = finishers.length + 1;
            player.score += FINISH_BONUS[player.place - 1] || 0;
            addLog(room, {
              player: player.name,
              kind: 'finish',
              text: `service ended early for them · finished #${player.place} with ${Math.round(player.score)} pts`,
              severity: 'warn'
            });
          } else {
            startPlayerStage(room, player, nextStage);
            io.to(player.socketId).emit('player:stage', {
              stage: nextStage,
              player: playerView(player, now),
              recipe
            });
          }
        }
      }
      const all = [...room.players.values()];
      if (all.length && all.every((p) => p.finished)) {
        room.phase = 'finished';
        room.endedAt = now;
        const top = [...all].sort((a, b) => b.score - a.score)[0];
        addLog(room, {
          kind: 'system',
          text: `Service over. Master Chef of the Medina: ${top.name} (${Math.round(top.score)} pts)`,
          severity: 'good'
        });
        io.to(room.playerRoom).emit('match:over', { players: all.map((p) => playerView(p, now)) });
      }
    }
    // keep the admin dashboard live (timers, progress bars, final standings)
    if (room.hostSocketId) {
      io.to(room.hostSocketId).emit('admin:state', roomView(room));
    }
  }
  // GC: drop rooms idle for 6h
  for (const [code, room] of rooms.entries()) {
    const touched = Math.max(room.startedAt || 0, ...room.log.map((l) => l.ts), 0);
    if (touched && now - touched > 6 * 3600 * 1000) rooms.delete(code);
  }
}, 700);

server.listen(PORT, () => {
  console.log(`Moroccan Culinary Challenge listening on http://localhost:${PORT}`);
  console.log(`Host dashboard: http://localhost:${PORT}/#host`);
});
