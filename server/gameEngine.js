// gameEngine.js — Authoritative server-side race simulation

import { createEventSystem } from './eventSystem.js';

const TICK_MS        = 33;            // ~30 fps tick rate
const BASE_SPEED_MIN = 0.00095;       // min speed per tick (fraction of lap)
const BASE_SPEED_MAX = 0.00135;       // max speed per tick
const FLUCTUATION    = 0.00018;       // random micro-fluctuation per tick

export function createGameEngine(lobby, io) {
  const { code: lobbyCode, players } = lobby;

  // ── Build initial marble state ──────────────────────────────────────
  const marbles = {};
  players.forEach((player, index) => {
    marbles[player.id] = {
      id:          player.id,
      name:        player.name,
      color:       player.color,
      position:    0,               // 0–1 fraction of full lap
      baseSpeed:   BASE_SPEED_MIN + Math.random() * (BASE_SPEED_MAX - BASE_SPEED_MIN),
      effects:     [],              // [{type, modifier, expiresAt}]
      finished:    false,
      finishTime:  null,
      finishRank:  null,
      // laneOffset is computed client-side per frame based on clustering
    };
  });

  let finishCount  = 0;
  let totalPlayers = players.length;
  let gameLoop     = null;
  let startTime    = null;

  const events = createEventSystem(marbles, lobbyCode, io);

  // ── Compute effective velocity for one marble ───────────────────────
  function resolveVelocity(marble) {
    const now = Date.now();

    // Expire old effects
    marble.effects = marble.effects.filter(e => e.expiresAt > now);

    let multiplier = 1;
    let isStunned  = false;

    for (const eff of marble.effects) {
      if (eff.modifier === 0) {
        isStunned = true;
      } else {
        multiplier += eff.modifier;
      }
    }

    if (isStunned) return 0;

    const micro = (Math.random() - 0.5) * 2 * FLUCTUATION;
    return (marble.baseSpeed + micro) * multiplier;
  }

  // ── Single game tick ─────────────────────────────────────────────────
  function tick() {
    let allDone = true;

    for (const marble of Object.values(marbles)) {
      if (marble.finished) continue;

      allDone = false;
      marble.position += resolveVelocity(marble);

      // Clamp so reverse cannot go below 0
      if (marble.position < 0) marble.position = 0;

      // ── Detect finish ────────────────────────────────────────────────
      if (marble.position >= 1) {
        marble.position  = 1;
        marble.finished  = true;
        marble.finishTime  = Date.now() - startTime;
        marble.finishRank  = ++finishCount;

        io.to(lobbyCode).emit('playerFinished', {
          id:         marble.id,
          name:       marble.name,
          color:      marble.color,
          rank:       marble.finishRank,
          finishTime: marble.finishTime,
        });
      }
    }

    // ── Broadcast state snapshot ─────────────────────────────────────
    io.to(lobbyCode).emit('gameState', {
      marbles: Object.values(marbles).map(m => ({
        id:           m.id,
        name:         m.name,
        color:        m.color,
        position:     m.position,
        finished:     m.finished,
        finishRank:   m.finishRank,
        activeEffects: m.effects.map(e => e.type),
      })),
      ts: Date.now(),
    });

    // ── End game when everyone finishes ─────────────────────────────
    if (finishCount === totalPlayers) {
      endGame();
    }
  }

  // ── Wrap up the race ─────────────────────────────────────────────────
  function endGame() {
    clearInterval(gameLoop);
    events.stop();

    const draftOrder = Object.values(marbles)
      .sort((a, b) => a.finishRank - b.finishRank)
      .map(m => ({
        rank:       m.finishRank,
        id:         m.id,
        name:       m.name,
        color:      m.color,
        finishTime: m.finishTime,
      }));

    lobby.status     = 'finished';
    lobby.draftOrder = draftOrder;

    io.to(lobbyCode).emit('gameOver', { draftOrder });
  }

  // ── Public API ────────────────────────────────────────────────────────
  return {
    start() {
      lobby.status = 'racing';

      // Send initial marble snapshot — clients show countdown for 3 seconds
      io.to(lobbyCode).emit('raceStarted', {
        marbles: Object.values(marbles).map(m => ({
          id:         m.id,
          name:       m.name,
          color:      m.color,
          position:   0,
          finished:   false,
        })),
      });

      // Delay the simulation by 3 seconds to match the client countdown
      setTimeout(() => {
        startTime = Date.now();
        gameLoop  = setInterval(tick, TICK_MS);
        events.start();
      }, 3000);
    },

    stop() {
      if (gameLoop) clearInterval(gameLoop);
      events.stop();
    },
  };
}
