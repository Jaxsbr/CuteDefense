// Full in-browser playthrough to the WIN condition, driving the REAL renderer
// (where the addColorStop crash occurred). Fast-forwards sim ticks, renders
// periodically, and explicitly re-creates the original crash scenario (rendering
// warning/expired coins). Fails loudly on any uncaught page error.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile } from 'node:fs/promises';

const server = await startServer({ port: 0 });
const chrome = await launchChrome();
const page = await chrome.openPage('about:blank');
const errors = [];
await page.send('Runtime.enable'); await page.send('Page.enable'); await page.send('Log.enable');
page.on('Runtime.exceptionThrown', p => errors.push('EXC: ' + (p.exceptionDetails?.exception?.description || p.exceptionDetails?.text)));
page.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') errors.push('CONSOLE.ERROR: ' + p.args.map(a => a.value || a.description).join(' ')); });
page.on('Log.entryAdded', p => { if (p.entry.level === 'error' && !/favicon/.test(p.entry.text)) errors.push('LOG: ' + p.entry.text); });

await page.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
const loaded = new Promise(r => page.on('Page.loadEventFired', r));
await page.send('Page.navigate', { url: server.url + '/?v=2' });
await loaded; await new Promise(r => setTimeout(r, 600));

// 1) Crash repro: render warning + expired coins (the exact failing path).
const crashRepro = await page.evaluate(`(() => {
  try {
    const app = window.__app, s = app.sim.state;
    s.status = 'playing'; s.wave.phase = 'idle';
    s.coinsList = [
      { id: 1, x: 5.5, y: 6.5, value: 3, age: 12000, phase: 'warning', anim: 0, bounceSeed: 0.1 },
      { id: 2, x: 6.5, y: 6.5, value: 5, age: 16000, phase: 'expired', anim: 100, bounceSeed: 0.2 },
    ];
    app.renderer.render(s);
    app.ctx.getImageData(0,0,1,1);
    return 'ok';
  } catch (e) { return 'THREW: ' + e.message; }
})()`);
console.log('crash-repro (warning+expired coin render):', crashRepro);

// 2) Full playthrough to a win, driving the real renderer.
const result = await page.evaluate(`(() => {
  const app = window.__app, sim = app.sim;
  app.stop();
  sim.restart({ seed: 12345 });
  const s = sim.state;
  s.coins = 1e9;
  // overwhelming loadout on every buildable tile adjacent to the path
  const adj = (x,y) => s.map.path.some(p => Math.abs(p.x-x)+Math.abs(p.y-y) === 1);
  let built = 0;
  for (let y=0;y<s.map.rows;y++) for (let x=0;x<s.map.cols;x++) {
    if (s.map.buildable[y][x] && adj(x,y) && sim.canPlace(x,y)) {
      s.placement = { gx:x, gy:y, towerType: (built%2? 'basic':'strong') };
      if (sim.placementPlace()) { s.selected={kind:'tower',id:sim.towerAt(x,y).id}; sim.upgradeSelected(); sim.upgradeSelected(); built++; }
    }
  }
  s.coins = 40; // back to a normal wallet; bonuses + kills must sustain it
  const dt = sim.config.timestepMs;
  let bonuses = 0, bonusTotal = 0, maxOnBoard = 0, ticks = 0;
  let everCoinDrop = false;
  for (; ticks < 120000; ticks++) {
    sim.tick(dt);
    for (const ev of s.frameEvents) if (ev.type === 'wave:bonus') { bonuses++; bonusTotal += ev.amount; }
    if (s.coinsList.length > maxOnBoard) maxOnBoard = s.coinsList.length;
    if (s.coinsList.length > 0) everCoinDrop = true;
    if (ticks % 8 === 0 || s.frameEvents.length) { app.renderer.render(s); }
    if (s.status === 'won' || s.status === 'lost') break;
  }
  app.renderer.render(s);
  return { status: s.status, wavesCleared: s.stats.wavesCleared, coins: s.coins, lives: s.lives,
           enemiesKilled: s.stats.enemiesKilled, bonuses, bonusTotal, maxCoinsOnBoard: maxOnBoard,
           everCoinDrop, ticks, builtTowers: built };
})()`);
console.log('playthrough:', JSON.stringify(result));

const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
await writeFile('/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/09-playthrough-win.png', Buffer.from(data, 'base64'));
console.log('errors:', errors.length ? errors.slice(0, 10).join('\n  ') : 'NONE');

await chrome.kill(); await server.close();
process.exit(errors.length || result.status !== 'won' || result.everCoinDrop ? 1 : 0);
