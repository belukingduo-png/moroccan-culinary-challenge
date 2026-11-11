'use strict';
/* Headless host: opens a room, prints the code, and starts the service when
   /tmp/go appears. Keeps the dashboard socket alive so the room persists.
   Usage: node test/host-bot.js [recipeId] */
const fs = require('fs');
const { io } = require('socket.io-client');

const socket = io(process.env.URL || 'http://localhost:3000', { transports: ['websocket'], forceNew: true });
const recipeId = process.argv[2] || 'tagine';
let started = false;

socket.on('connect', () => {
  socket.emit('host:create', {}, (res) => {
    if (!res || !res.ok) {
      console.error('could not open room', res);
      process.exit(1);
    }
    fs.writeFileSync('/tmp/roomcode', res.code);
    console.log('ROOM ' + res.code);
  });
});

socket.on('log:entry', (e) => console.log(`[${e.severity}] ${e.player}: ${e.text}`));

setInterval(() => {
  if (started || !fs.existsSync('/tmp/roomcode')) return;
  if (!fs.existsSync('/tmp/go')) return;
  started = true;
  socket.emit('host:start', { recipeId }, (res) => console.log('start ->', JSON.stringify(res)));
}, 400);
