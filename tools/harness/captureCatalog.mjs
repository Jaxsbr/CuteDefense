// Regenerate captures/enemy-catalog-preview.png from enemy-catalog.html.
// Serves the repo root, loads the catalog in headless Chrome over CDP, waits for
// the canvas portraits to bake + animate one frame, then takes a FULL-PAGE
// screenshot (captureBeyondViewport) at a 1200px content width. Reuses the same
// staticServer + cdp.mjs pattern as every other harness. Exits non-zero on a
// console error.
import { startServer } from './staticServer.mjs';
import { launchChrome } from './cdp.mjs';
import { writeFile } from 'node:fs/promises';

const OUT = '/Users/jacobusbrink/Jaxs/projects/CuteDefense/captures/enemy-catalog-preview.png';
const WIDTH = 1200;

const server = await startServer({ port: 0 });
const chrome = await launchChrome();
const errors = [];

const page = await chrome.openPage('about:blank');
await page.send('Page.enable');
await page.send('Runtime.enable');
page.on('Runtime.consoleAPICalled', (e) => { if (e.type === 'error') errors.push(JSON.stringify(e.args?.map((a) => a.value))); });
page.on('Runtime.exceptionThrown', (e) => errors.push('EXCEPTION: ' + (e.exceptionDetails?.exception?.description || e.exceptionDetails?.text)));

// Tall viewport at the target width so the responsive grid lays out exactly as
// the saved preview (1200px content column).
await page.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 2000, deviceScaleFactor: 1, mobile: false });

const loaded = new Promise((r) => page.on('Page.loadEventFired', r));
await page.send('Page.navigate', { url: server.url + '/enemy-catalog.html' });
await loaded;
// let the canvas portraits bake + run a couple of animation frames
await new Promise((r) => setTimeout(r, 1200));

// Measure the full document height so the full-page shot is exact.
const fullH = await page.evaluate('Math.ceil(document.documentElement.scrollHeight)');
console.log('content height:', fullH);

const { data } = await page.send('Page.captureScreenshot', {
  format: 'png',
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: WIDTH, height: fullH, scale: 1 },
});
await writeFile(OUT, Buffer.from(data, 'base64'));
console.log('saved', OUT);

page.close();
await chrome.kill();
await server.close();

if (errors.length) {
  console.log('CONSOLE ERRORS (' + errors.length + '):');
  errors.forEach((e) => console.log('  ' + e));
  process.exit(2);
}
console.log('No console errors. CAPTURE DONE.');
process.exit(0);
