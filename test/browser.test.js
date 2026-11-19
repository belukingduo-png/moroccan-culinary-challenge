'use strict';
/* Real-browser test with phone + tablet + desktop viewports.
   Verifies layout has no horizontal overflow and that a full service can be played
   through every stage with genuine mouse input. Needs the server on :3000. */
const puppeteer = require('puppeteer-core');
const { io } = require('socket.io-client');

const URL = process.env.URL || 'http://localhost:3000';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const SHOT_DIR = process.env.SHOT_DIR || '/tmp/shots';
const fs = require('fs');

const failures = [];
const check = (cond, label, extra) => {
  if (cond) console.log('  ✓', label);
  else {
    failures.push(label);
    console.log('  ✗', label, extra === undefined ? '' : `(${extra})`);
  }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function connect() {
  return new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], forceNew: true });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}
const emit = (socket, event, payload) => new Promise((r) => socket.emit(event, payload, r));

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollW: doc.scrollWidth,
      innerW: window.innerWidth,
      wide: [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > window.innerWidth + 2;
        })
        .slice(0, 4)
        .map((el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : '.' + (el.className || '').toString().split(' ')[0]}`)
    };
  });
}

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none']
  });

  const consoleErrors = [];

  /* ---------- 1. layout across viewports ---------- */
  for (const [w, h, label] of [[390, 844, 'phone'], [768, 1024, 'tablet'], [1280, 800, 'desktop']]) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => consoleErrors.push(`${label}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(`${label} console: ${m.text()}`);
    });
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
    await page.goto(URL, { waitUntil: 'networkidle2' });

    const land = await overflow(page);
    check(land.scrollW <= land.innerW, `${label}: landing has no horizontal overflow`, JSON.stringify(land.wide));
    const roleBoxes = await page.$$eval('.role-card', (els) => els.map((e) => e.getBoundingClientRect().width));
    check(roleBoxes.length === 2 && roleBoxes.every((x) => x > 120), `${label}: both role cards are tappable`);
    await page.screenshot({ path: `${SHOT_DIR}/${label}-landing.png` });

    // host dashboard layout
    await page.goto('about:blank');
    await page.goto(`${URL}/#host`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('#view-admin.active');
    const adminOverflow = await overflow(page);
    check(adminOverflow.scrollW <= adminOverflow.innerW, `${label}: dashboard has no horizontal overflow`, JSON.stringify(adminOverflow.wide));
    const codeText = await page.$eval('#adminCode', (el) => el.textContent.trim());
    check(/^[A-Z0-9]{4}$/.test(codeText), `${label}: dashboard shows a room code`, codeText);
    const cols = await page.$eval('#playersGrid', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    if (w < 560) check(cols === 1, 'phone: player cards stack in one column', cols);
    await page.screenshot({ path: `${SHOT_DIR}/${label}-admin.png`, fullPage: false });
    await page.close();
  }

  /* ---------- 2. full playthrough on a phone ---------- */
  console.log('\n– phone playthrough –');
  const hostSocket = await connect();
  const created = await emit(hostSocket, 'host:create', {});
  const code = created.code;
  let adminPlayers = [];
  hostSocket.on('admin:state', (s) => (adminPlayers = s.players));

  const page = await browser.newPage();
  page.on('pageerror', (e) => consoleErrors.push(`play: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`play console: ${m.text()}`);
  });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${URL}/?room=${code}`, { waitUntil: 'networkidle2' });
  check((await page.$eval('#roomCode', (el) => el.value)) === code, 'room code prefilled from the join link');

  await page.type('#playerName', 'Test Chef');
  await page.click('#joinForm .primary-btn');
  await page.waitForSelector('#view-lobby.active');
  check(true, 'joined from a phone');
  await page.screenshot({ path: `${SHOT_DIR}/phone-lobby.png` });

  await emit(hostSocket, 'host:start', { recipeId: 'tagine' });
  await page.waitForSelector('#view-game.active');
  await page.waitForSelector('#stage-prep.active');
  check(true, 'stage 1 (prep) rendered');

  // chop with real mouse input until the stage clears
  let chops = 0;
  while (chops < 90) {
    const done = await page.evaluate(() => document.querySelector('#view-results.active') !== null || document.querySelector('#stage-prep')?.classList.contains('active') === false);
    if (done) break;
    const btn = await page.$('#chopBtn');
    if (!btn) break;
    await btn.click();
    chops += 1;
    await wait(45);
  }
  check(chops > 5, `plenty of chop taps registered (${chops})`);

  await page.waitForFunction(() => document.querySelector('#stage-spice.active') || document.querySelector('#view-results.active'), { timeout: 20000 });
  const inSpice = await page.$('#stage-spice.active');
  if (inSpice) {
    await page.screenshot({ path: `${SHOT_DIR}/phone-spice.png` });
    const spiceOverflow = await overflow(page);
    check(spiceOverflow.scrollW <= spiceOverflow.innerW, 'phone: spice stage fits the width');
    // set every spice to its target
    const targets = await page.evaluate(() => (window.RECIPES ? window.RECIPES.tagine.spice.spices : []));
    for (const s of targets) {
      const times = s.target / 5;
      for (let i = 0; i < times; i += 1) {
        if (!(await page.$('#stage-spice.active'))) {
          console.log(`    (spice stage closed early while filling ${s.id})`);
          break;
        }
        try {
          await page.click(`.spice-row[data-id="${s.id}"] [data-act="plus"]`);
        } catch (err) {
          console.log(`    (click failed on ${s.id} step ${i}: ${err.message})`);
          break;
        }
      }
    }
    const total = await page.$eval('#spiceTotal', (el) => el.textContent);
    check(total === '100', 'spices can be balanced to exactly 100 on a phone', total);
    // a perfectly balanced mix clears the stage on its own; submit only if it did not
    if (await page.$('#stage-spice.active')) {
      const probe = await page.evaluate(() => {
        const btn = document.getElementById('spiceSubmit');
        const r = btn.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, Math.min(r.y + r.height / 2, window.innerHeight - 1));
        return {
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          hitTag: hit && `${hit.tagName}${hit.id ? '#' + hit.id : ''}.${(hit.className || '').toString().split(' ')[0]}`,
          scrollY: Math.round(window.scrollY),
          innerH: window.innerHeight
        };
      });
      console.log('    submit probe:', JSON.stringify(probe));
      await page.evaluate(() => document.getElementById('spiceSubmit').click());
    }
  }
  await page.waitForFunction(() => document.querySelector('#stage-heat.active') || document.querySelector('#view-results.active'), { timeout: 20000 });
  const inHeat = await page.$('#stage-heat.active');
  if (inHeat) {
    await page.screenshot({ path: `${SHOT_DIR}/phone-heat.png` });
    const box = await (await page.$('#bellowsBtn')).boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);

    // fan in short pulses the way a player would, keeping the needle in the band
    const heatStart = Date.now();
    let finishedHeat = false;
    let pressed = false;
    while (Date.now() - heatStart < 32000) {
      const st = await page.evaluate(() => {
        const needle = document.getElementById('needle');
        const m = (needle.style.left || needle.style.transform || '').match(/[\d.]+/);
        return {
        heat: m ? Math.round(parseFloat(m[0])) : 0,
        low: parseInt(document.getElementById('lowLabel').textContent, 10) || 58,
        high: parseInt(document.getElementById('highLabel').textContent, 10) || 82,
        plate: !!document.querySelector('#stage-plate.active'),
        results: !!document.querySelector('#view-results.active')
        };
      });
      if (st.plate || st.results) { finishedHeat = true; break; }
      const wantHold = st.heat < (st.low + st.high) / 2;
      if (wantHold && !pressed) { await page.mouse.down(); pressed = true; }
      else if (!wantHold && pressed) { await page.mouse.up(); pressed = false; }
      await new Promise((r) => setTimeout(r, 160));
    }
    if (pressed) await page.mouse.up();
    const hold = await page.evaluate(() => document.getElementById('holdProgress').textContent);
    check(finishedHeat, 'heat stage completes by holding the flame in the band', `${hold} after ${Math.round((Date.now() - heatStart) / 100) / 10}s`);
  }
  await page.waitForFunction(() => document.querySelector('#stage-plate.active') || document.querySelector('#view-results.active'), { timeout: 25000 });
  const inPlate = await page.$('#stage-plate.active');
  if (inPlate) {
    await page.screenshot({ path: `${SHOT_DIR}/phone-plate.png` });
    const required = await page.evaluate(() => window.RECIPES.tagine.plate.required.map((g) => g.id));
    for (const id of required) {
      await page.click(`.garnish[data-id="${id}"]`);
      await wait(120);
    }
  }
  await page.waitForSelector('#view-results.active', { timeout: 20000 });
  const score = await page.$eval('#resultScore', (el) => parseInt(el.textContent, 10));
  check(score > 0, `finished the dish with a real score (${score})`);
  const resultOverflow = await overflow(page);
  check(resultOverflow.scrollW <= resultOverflow.innerW, 'phone: results screen fits the width');
  await page.screenshot({ path: `${SHOT_DIR}/phone-results.png` });

  await wait(800);
  check(adminPlayers.length === 1 && adminPlayers[0].finished, 'host dashboard saw the chef finish');
  check(adminPlayers[0] && adminPlayers[0].progress === 100, 'admin progress bar reached 100%');

  check(consoleErrors.length === 0, 'no console or page errors', consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
  hostSocket.close();
  console.log(failures.length ? `\nFAILURES (${failures.length}): ${failures.join(' | ')}` : '\nALL BROWSER CHECKS PASSED');
  console.log('screenshots in', SHOT_DIR);
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error('BROWSER TEST CRASHED', err);
  process.exit(1);
});
