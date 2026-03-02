// EventFeed.jsx — Animated event notification stream

import { useState, useEffect, useRef } from 'react';
import socket from '../socket.js';

const COLOR_CSS = {
  Red:'#ef4444',Blue:'#3b82f6',Green:'#22c55e',Yellow:'#eab308',
  Orange:'#f97316',Purple:'#a855f7',Pink:'#ec4899',Teal:'#14b8a6',
  Cyan:'#06b6d4',Lime:'#84cc16',Maroon:'#9b2226',Navy:'#1e40af',
  Gold:'#d97706',Black:'#4b5563',
};

const EVENT_COLORS = {
  boost:   { bg: 'rgba(34,197,94,0.15)',  border: '#22c55e', glow: '#22c55e' },
  stun:    { bg: 'rgba(239,68,68,0.15)',  border: '#ef4444', glow: '#ef4444' },
  reverse: { bg: 'rgba(168,85,247,0.15)', border: '#a855f7', glow: '#a855f7' },
};

function guessType(eventId) {
  if (['mvp','bat_flip'].includes(eventId))        return 'boost';
  if (['double_play'].includes(eventId))            return 'reverse';
  return 'stun';
}

let nextId = 0;

export default function EventFeed() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    socket.on('gameEvent', (ev) => {
      const id   = nextId++;
      const type = guessType(ev.eventId);

      setEvents(prev => [{
        id,
        text:        ev.eventText,
        targetName:  ev.targetName,
        targetColor: ev.targetColor,
        type,
        ts: Date.now(),
      }, ...prev].slice(0, 8)); // keep last 8

      // Auto-remove after 6s
      setTimeout(() => {
        setEvents(prev => prev.filter(e => e.id !== id));
      }, 6000);
    });

    return () => socket.off('gameEvent');
  }, []);

  return (
    <div className="flex flex-col gap-2 pointer-events-none">
      {events.map((ev, i) => {
        const style = EVENT_COLORS[ev.type] || EVENT_COLORS.stun;
        return (
          <div
            key={ev.id}
            className="slide-in rounded-xl px-3 py-2 text-xs font-semibold"
            style={{
              background:  style.bg,
              border:      `1px solid ${style.border}`,
              boxShadow:   `0 0 10px ${style.glow}44`,
              opacity:     Math.max(0.4, 1 - i * 0.12),
            }}
          >
            <div className="flex items-center gap-2">
              {/* Player color dot */}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLOR_CSS[ev.targetColor] || '#888' }}
              />
              <span className="text-white font-bold truncate">{ev.targetName}</span>
            </div>
            <div className="text-[#e6edf3] mt-0.5 leading-tight">{ev.text}</div>
          </div>
        );
      })}
    </div>
  );
}
