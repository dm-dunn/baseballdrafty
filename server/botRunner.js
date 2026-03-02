// botRunner.js — Simulate a game with bot players for testing
//
// Standalone usage:
//   node botRunner.js [botCount] [serverUrl]
//
// Via root package (recommended):
//   npm run test:bots           → 3 bots, leaving 1 slot for you in a 4-player lobby
//   npm run test:bots -- 5      → 5 bots, leaving 1 slot for you in a 6-player lobby
//
// The first bot becomes host and starts the race once ALL players (bots + you) are ready.

import { io }   from 'socket.io-client';
import { exec } from 'child_process';

// ── Config ────────────────────────────────────────────────────────────────────

const BOT_COUNT   = parseInt(process.argv[2]) || 3;
const SERVER_URL  = process.argv[3] || 'http://localhost:3001';
const CLIENT_URL  = 'http://localhost:5173';
// Lobby gets one extra slot so the user can join and race
const LOBBY_SIZE  = BOT_COUNT + 1;

const BOT_NAMES = [
  'Babe Bot', 'Cy Young Bot', 'Hank A-Bot', 'Willie A-Bot',
  'Ted Williams Bot', 'Lou Gehrig Bot', 'Mickey Mantle Bot', 'Sandy Koufax Bot',
  'Roberto Clemente Bot', 'Nolan Ryan Bot', 'Roger Maris Bot', 'Cal Ripken Bot',
  'Tony Gwynn Bot', 'Greg Maddux Bot',
];


// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function log(botName, msg) {
  console.log(`[${new Date().toLocaleTimeString()}] [${botName}] ${msg}`);
}

function formatRank(n) {
  const suffix = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (suffix[(v - 20) % 10] || suffix[v] || suffix[0]);
}

function openBrowser(url) {
  const cmd = { win32: `start "" "${url}"`, darwin: `open "${url}"` }[process.platform]
              ?? `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) console.warn('[bots] Could not auto-open browser. Open manually:', url);
  });
}

// ── Create lobby via REST ─────────────────────────────────────────────────────

async function createLobby(playerCount) {
  const res = await fetch(`${SERVER_URL}/api/lobbies`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ playerCount }),
  });
  if (!res.ok) throw new Error(`Failed to create lobby: ${res.status} ${await res.text()}`);
  return res.json();
}

// ── Bot class ─────────────────────────────────────────────────────────────────

class Bot {
  constructor(name, isHost) {
    this.name   = name;
    this.isHost = isHost;
    this.socket = null;
  }

  connect(code) {
    return new Promise((resolve, reject) => {
      const socket = io(SERVER_URL, { transports: ['websocket'] });
      this.socket  = socket;

      socket.on('connect', () => {
        log(this.name, `connected (id=${socket.id})`);
        // Color is auto-assigned by the server; no need to send one
        socket.emit('joinLobby', { code, name: this.name }, (res) => {
          if (res.error) reject(new Error(`joinLobby failed: ${res.error}`));
          else {
            log(this.name, `joined lobby${res.isHost ? ' as HOST' : ''} (color: ${res.player.color})`);
            resolve();
          }
        });
      });

      socket.on('connect_error', (err) => reject(err));
    });
  }

  markReady(code) {
    return new Promise((resolve) => {
      const delay = 300 + Math.random() * 700;
      setTimeout(() => {
        this.socket.emit('setReady', { code, ready: true });
        log(this.name, 'marked ready ✓');
        resolve();
      }, delay);
    });
  }

  startRace(code) {
    this.socket.emit('startRace', { code });
    log(this.name, '🚀 sent startRace');
  }

  watchRace() {
    return new Promise((resolve) => {
      this.socket.on('raceStarted', () => {
        log(this.name, '🏁 race started!');
      });

      this.socket.on('gameEvent', ({ eventText, targetName }) => {
        if (targetName === this.name) {
          log(this.name, `⚡ event → ${eventText}`);
        }
      });

      this.socket.on('playerFinished', ({ name, rank }) => {
        const marker = name === this.name ? ' ← ME' : '';
        log(this.name, `🏅 ${name} finished ${formatRank(rank)}${marker}`);
      });

      this.socket.on('gameOver', ({ draftOrder }) => {
        if (this.isHost) {
          console.log('\n══════════════════════════════════════════');
          console.log('           🏆  FINAL DRAFT ORDER  🏆       ');
          console.log('══════════════════════════════════════════');
          draftOrder.forEach(({ rank, name, color, finishTime }) => {
            const secs = (finishTime / 1000).toFixed(2);
            console.log(`  ${formatRank(rank).padEnd(5)}  ${name.padEnd(22)} (${color}) — ${secs}s`);
          });
          console.log('══════════════════════════════════════════\n');
        }
        resolve(draftOrder);
      });
    });
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (BOT_COUNT < 1 || BOT_COUNT > 13) {
    console.error('Bot count must be between 1 and 13 (leaving 1 slot for you).');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════╗');
  console.log('║       BaseballDrafty Bot Runner          ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Server : ${SERVER_URL}`);
  console.log(`  Bots   : ${BOT_COUNT}  (+1 slot reserved for YOU)`);
  console.log('');

  // 1. Create lobby (one extra slot for the human)
  let lobbyCode;
  try {
    const data = await createLobby(LOBBY_SIZE);
    lobbyCode  = data.code;
    console.log(`✅ Lobby created — ${LOBBY_SIZE} total slots (${BOT_COUNT} bots + 1 for you)\n`);
  } catch (err) {
    console.error(`❌ Could not create lobby: ${err.message}`);
    console.error('   Is the server running?');
    process.exit(1);
  }

  // 2. Build bots — colors are auto-assigned by the server
  const bots = BOT_NAMES.slice(0, BOT_COUNT)
    .map((name, i) => new Bot(name, i === 0));

  // 3. Connect all bots (stagger slightly)
  console.log('Connecting bots...');
  for (const bot of bots) {
    try {
      await bot.connect(lobbyCode);
      await sleep(150);
    } catch (err) {
      console.error(`❌ ${bot.name} failed to connect: ${err.message}`);
      bots.forEach(b => b.disconnect());
      process.exit(1);
    }
  }

  // 4. All bots mark ready
  console.log('\nAll bots connected. Marking ready...\n');
  await Promise.all(bots.map(bot => bot.markReady(lobbyCode)));

  // 5. Open browser and prompt user to join
  openBrowser(CLIENT_URL);

  console.log('');
  console.log('┌─────────────────────────────────────────────┐');
  console.log('│                                             │');
  console.log(`│  🌐 Browser opening: ${CLIENT_URL}   │`);
  console.log('│                                             │');
  console.log(`│  📋 Lobby code:  ${lobbyCode.padEnd(6)}                     │`);
  console.log('│                                             │');
  console.log('│  1. Click "Join Game" in the browser        │');
  console.log(`│  2. Enter code:  ${lobbyCode.padEnd(6)}                     │`);
  console.log('│  3. Enter your name, then join               │');
  console.log('│  4. Pick your color in the lobby, mark Ready │');
  console.log('│  5. The race starts automatically!          │');
  console.log('│                                             │');
  console.log('└─────────────────────────────────────────────┘');
  console.log('');
  console.log('Waiting for you to join and mark ready...');

  // 6. Host bot waits for the lobby to be FULL and all players ready.
  //    allReady alone isn't enough — it fires as soon as all *connected* players
  //    are ready, which would trigger before the human has joined.
  const hostBot = bots[0];
  await new Promise((resolve) => {
    hostBot.socket.on('lobbyUpdate', (state) => {
      const lobbyFull = state.players.length === LOBBY_SIZE;
      if (lobbyFull && state.allReady) resolve();
    });
  });

  console.log('\n✅ All players ready — starting race!\n');
  await sleep(500);
  hostBot.startRace(lobbyCode);

  // 7. Watch race to completion
  await hostBot.watchRace();

  // 8. Clean up
  await sleep(1000);
  bots.forEach(b => b.disconnect());
  console.log('Bots disconnected. Done!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
