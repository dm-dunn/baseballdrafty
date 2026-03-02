// botWaiter.js — Waits for the server to be ready, then launches botRunner.js
// Used by the root `npm run test:bots` script via concurrently.
//
// Pass bot count as first arg:  node botWaiter.js 5
// Default is 3 bots (leaving 1 slot open for you in a 4-player lobby).

const BOT_COUNT  = parseInt(process.argv[2]) || 3;
const SERVER_URL = 'http://localhost:3001';
const MAX_WAIT   = 20_000; // 20s timeout
const POLL_MS    = 500;

async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT) {
    try {
      const res = await fetch(`${SERVER_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
  throw new Error(`Server did not start within ${MAX_WAIT / 1000}s`);
}

console.log('[bots] Waiting for server to be ready...');
waitForServer()
  .then(async () => {
    console.log('[bots] Server is up — launching bot runner');
    // Dynamically import so argv is already set before botRunner reads it
    process.argv[2] = String(BOT_COUNT);
    await import('./botRunner.js');
  })
  .catch((err) => {
    console.error('[bots]', err.message);
    process.exit(1);
  });
