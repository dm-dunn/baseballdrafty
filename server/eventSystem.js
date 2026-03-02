// eventSystem.js — Manages random in-race events

const EVENTS = [
  { id: 'ped',           text: '🚫 Caught using PEDs!',          type: 'stun',    modifier: 0,    duration: 3000 },
  { id: 'mvp',           text: '⭐ MVP Vote!',                   type: 'boost',   modifier: 1.0,  duration: 1500 },
  { id: 'breaking_ball', text: '⚾ Hanging Breaking Ball!',       type: 'stun',    modifier: 0,    duration: 1500 },
  { id: 'bat_flip',      text: '🏏 Bat Flip!',                   type: 'boost',   modifier: 1.0,  duration: 500  },
  { id: 'double_play',   text: '😤 Double Play Dumbass!',        type: 'reverse', modifier: -2.0, duration: 250  },
  { id: 'line_drive',    text: '💀 Line Drive off the Head!',    type: 'stun',    modifier: 0,    duration: 5000 },
  { id: 'piss_sample',   text: '🚽 Piss Sample!',               type: 'stun',    modifier: 0,    duration: 250  },
  { id: 'walk_off',      text: '🏆 Walk-off Hero!',              type: 'boost',   modifier: 1.5,  duration: 1000 },
  { id: 'balk',          text: '🤦 Balk!',                       type: 'stun',    modifier: 0,    duration: 2000 },
  { id: 'stolen_base',   text: '💨 Stolen Base!',                type: 'boost',   modifier: 2.0,  duration: 400  },
  { id: 'hit_by_pitch',  text: '🤕 Hit by Pitch!',               type: 'stun',    modifier: 0,    duration: 2500 },
  { id: 'error',         text: '😬 Fielding Error!',             type: 'reverse', modifier: -1.5, duration: 400  },
  { id: 'grand_slam',    text: '💥 Grand Slam!',                 type: 'boost',   modifier: 3.0,  duration: 300  },
  { id: 'pine_tar',      text: '🍯 Illegal Pine Tar!',           type: 'stun',    modifier: 0,    duration: 3500 },
  { id: 'fan_interference', text: '👋 Fan Interference!',        type: 'stun',    modifier: 0,    duration: 1000 },
];

export function createEventSystem(marbles, lobbyCode, io) {
  let timer = null;

  function randomInterval() {
    return 1500 + Math.random() * 1500; // 1.5–3 seconds
  }

  function activeMarbles() {
    return Object.values(marbles).filter(m => !m.finished);
  }

  function trigger() {
    const pool = activeMarbles();
    if (pool.length === 0) return;

    const target = pool[Math.floor(Math.random() * pool.length)];
    const event  = EVENTS[Math.floor(Math.random() * EVENTS.length)];

    // Push effect onto marble
    target.effects.push({
      type:      event.type,
      modifier:  event.modifier,
      expiresAt: Date.now() + event.duration,
    });

    // Broadcast the event to all clients
    io.to(lobbyCode).emit('gameEvent', {
      eventId:     event.id,
      eventText:   event.text,
      targetId:    target.id,
      targetName:  target.name,
      targetColor: target.color,
      duration:    event.duration,
      timestamp:   Date.now(),
    });

    timer = setTimeout(trigger, randomInterval());
  }

  return {
    start() { timer = setTimeout(trigger, randomInterval()); },
    stop()  { if (timer) clearTimeout(timer); },
  };
}
