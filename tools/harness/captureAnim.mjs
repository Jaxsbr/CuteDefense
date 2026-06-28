// Animation-proof captures: zoomed close-ups that make the TRANSIENT expression
// frames inspectable in a still — closing the taste panel's "can't verify from
// stills" gap for (d) enemy ouch and (k) tower shock + slow puff + projectile.
// Forces every tower into mid-puff/shock and every enemy into the ouch frame,
// then 3x-crops the board so the baked frames are unmistakable.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/v2/captures/after/';
const server = await startServer({ port: 0 });
const chrome = await launchChrome();

async function newPage(url, w, h) {
  const page = await chrome.openPage('about:blank');
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const loaded = new Promise(r => page.on('Page.loadEventFired', r));
  await page.send('Page.navigate', { url });
  await loaded; await new Promise(r => setTimeout(r, 700));
  return page;
}

// 3x nearest-neighbour crop of a backing-store rect, saved as PNG.
async function cropSnap(page, name, sx, sy, sw, sh, z = 3) {
  const dataUrl = await page.evaluate(`(()=>{
    const src=document.getElementById('gameCanvas');
    const out=document.createElement('canvas'); out.width=${sw}*${z}; out.height=${sh}*${z};
    const o=out.getContext('2d'); o.imageSmoothingEnabled=true;
    o.drawImage(src, ${sx}, ${sy}, ${sw}, ${sh}, 0,0, ${sw}*${z}, ${sh}*${z});
    return out.toDataURL('image/png');
  })()`);
  await writeFile(OUT + name, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
  console.log('saved', name);
}

const page = await newPage(server.url + '/?v=2&bench=1', 1366, 768);
// build the busy fixture and let towers actually fire (projectiles spawn & fly)
await page.evaluate(`window.__bench.buildFixture()`);
await new Promise(r => setTimeout(r, 1600));
// freeze a demonstrative animation moment: every tower mid-puff+shock, every
// (non-dying) enemy showing ouch+recoil. Then render ONCE with no further tick.
const info = await page.evaluate(`(()=>{
  const app=window.__app, s=app.sim.state, A=s.config.visual.anim;
  for(const t of s.towers) t.fireAnimMs = A.towerFireAnimMs*0.6;   // p≈0.4 → near peak puff + shock face
  for(const e of s.enemies) if(!e.dying) e.ouchMs = A.enemyOuchMs;  // full ouch face + recoil
  app.renderer.render(s);
  return { towers:s.towers.length, enemies:s.enemies.length, projectiles:s.projectiles.length };
})()`);
console.log('forced-frame scene:', JSON.stringify(info));
// full board (context) + two zoomed crops near the top path where towers cluster
await page.send('Page.captureScreenshot', { format: 'png' }).then(({ data }) => writeFile(OUT + '11-anim-fire-ouch-full.png', Buffer.from(data, 'base64'))).then(() => console.log('saved 11-anim-fire-ouch-full.png'));
await cropSnap(page, '12-anim-tower-fire-zoom.png', 420, 60, 560, 360, 3);
await cropSnap(page, '13-anim-enemy-ouch-zoom.png', 560, 120, 520, 420, 3);

await chrome.kill(); await server.close();
console.log('ANIM CAPTURE DONE.');
process.exit(0);
