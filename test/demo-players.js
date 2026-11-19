'use strict';
/* Simulated chefs: join a room and cook, so the host dashboard can be watched
   filling up in real time. Usage: CODE=ABCD node test/demo-players.js */
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3000';
const CODE = (process.env.CODE || '').toUpperCase();
if (!CODE) {
  console.error('Set CODE=ABCD');
  process.exit(1);
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NAMES = (process.env.NAMES || 'Yassine,Fatima,Omar,Salma').split(',');
const SKILL = [1.0, 0.82, 0.65, 0.9];

function connect() {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

(async () => {
  const chefs = [];
  for (let i = 0; i < NAMES.length; i += 1) {
    const socket = await connect();
    const res = await new Promise((resolve) => socket.emit('player:join', { name: NAMES[i], code: CODE }, resolve));
    if (!res || !res.ok) {
      console.log(`${NAMES[i]}: ${(res && res.error) || 'failed'}`);
      socket.close();
      continue;
    }
    console.log(`${NAMES[i]} joined ${CODE}`);
    chefs.push({ name: NAMES[i], socket, skill: SKILL[i % SKILL.length], stage: 0 });
    socket.on('player:stage', (d) => {
      const c = chefs.find((x) => x.socket === socket);
      if (c) c.stage = d.stage;
    });
    socket.on('match:start', () => {
      const c = chefs.find((x) => x.socket === socket);
      if (c) c.stage = 0;
      play(c);
    });
    socket.on('match:reset', () => {
      const c = chefs.find((x) => x.socket === socket);
      if (c) c.stage = 0;
    });
  }

  async function play(chef) {
    let stage = 0;
    while (stage < 4) {
      const stepMs = 320 - chef.skill * 170;
      let progress = 0;
      while (progress < 100) {
        await wait(stepMs);
        progress += 12 + Math.random() * 16 * chef.skill;
        chef.socket.emit('player:progress', { stage, progress: Math.min(100, progress) });
        if (Math.random() < 0.12) {
          const kind = ['chop_bad', 'chop_good', 'spice_wrong', 'burn', 'garnish_wrong'][Math.floor(Math.random() * 5)];
          chef.socket.emit('player:event', { type: kind, stage });
        }
      }
      const done = await new Promise((resolve) =>
        chef.socket.emit('player:stage_complete', { stage, progress: 100 }, resolve)
      );
      console.log(`${chef.name} stage ${stage} -> +${done && done.gained}`);
      stage += 1;
      await wait(250);
    }
    console.log(`${chef.name} finished`);
  }

  process.on('SIGTERM', () => chefs.forEach((c) => c.socket.close()));
  setInterval(() => {}, 1 << 30);
})();
