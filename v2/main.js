/**
 * V2 entry point (loaded by index.html when ?v=2). Native ES module, no build.
 */
import { GameApp } from './app/GameApp.js';

function boot() {
  const canvas = document.getElementById('gameCanvas');
  const params = new URLSearchParams(location.search);
  const bench = params.get('bench') === '1';

  // Hide V1-only chrome that lives in the shared index.html (V2 draws its own UI).
  for (const id of ['debug-info', 'audio-hint']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  const app = new GameApp(canvas, { bench });
  if (bench) app.installBench();
  app.start();
  window.__app = app; // handy for debugging / visual harness
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
