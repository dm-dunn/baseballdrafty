// Race.jsx — Live race screen: canvas + event banner + results

import { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket.js';
import { renderFrame, CANVAS_WIDTH, CANVAS_HEIGHT, buildPath } from './CanvasRenderer.js';
import Results from './components/Results.jsx';
import AudioManager from './AudioManager.js';

// ── Event banner helpers ──────────────────────────────────────────────────────
function guessEventType(eventId) {
  if (['mvp', 'bat_flip', 'walk_off', 'stolen_base', 'grand_slam'].includes(eventId)) return 'boost';
  if (['double_play', 'error'].includes(eventId)) return 'reverse';
  return 'stun';
}

const EVENT_STYLES = {
  boost:   { bg: 'rgba(34,197,94,0.25)',  border: '#22c55e', glow: '#22c55e' },
  stun:    { bg: 'rgba(239,68,68,0.25)',  border: '#ef4444', glow: '#ef4444' },
  reverse: { bg: 'rgba(168,85,247,0.25)', border: '#a855f7', glow: '#a855f7' },
};

const EVENT_SHOW_MS  = 3000; // total visible duration
const EVENT_FADE_MS  = 500;  // fade+slide duration (at end of life)

// ── Component ─────────────────────────────────────────────────────────────────
export default function Race({ lobbyCode, myPlayer, initialMarbles }) {
  const canvasRef       = useRef(null);
  const marblesRef      = useRef(initialMarbles || []); // always latest, no re-render cost
  const rafRef          = useRef(null);
  const audioRef        = useRef(null);

  const [draftOrder,    setDraftOrder]    = useState(null);
  const [showResults,   setShowResults]   = useState(false);
  const [countdown,     setCountdown]     = useState(3);
  const [racing,        setRacing]        = useState(false);
  const [eventBanners,  setEventBanners]  = useState([]); // stacked event banners

  const isHost = myPlayer?.isHost;

  // ── Audio manager lifecycle ─────────────────────────────────────────
  useEffect(() => {
    audioRef.current = new AudioManager();
    return () => audioRef.current?.dispose();
  }, []);

  // ── Precompute path on mount ────────────────────────────────────────
  useEffect(() => { buildPath(); }, []);

  // ── Countdown before race starts ────────────────────────────────────
  useEffect(() => {
    let n = 3;
    const t = setInterval(() => {
      n--;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        setRacing(true);
        // Fire horn + play ball then start background music
        audioRef.current?.playGameStart();
        setTimeout(() => audioRef.current?.playBackgroundMusic(), 1800);
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Animation loop ──────────────────────────────────────────────────
  const loop = useCallback(() => {
    renderFrame(canvasRef.current, marblesRef.current);
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // ── Socket: live game state ─────────────────────────────────────────
  useEffect(() => {
    socket.on('gameState', ({ marbles }) => {
      marblesRef.current = marbles;
    });

    socket.on('gameEvent', (ev) => {
      const id   = `${Date.now()}-${Math.random()}`;
      const type = guessEventType(ev.eventId);
      const banner = { id, text: ev.eventText, targetName: ev.targetName, targetColor: ev.targetColor, type, bornAt: Date.now() };

      // Add to top of stack
      setEventBanners(prev => [banner, ...prev]);

      // Remove after full display duration
      setTimeout(() => {
        setEventBanners(prev => prev.filter(b => b.id !== id));
      }, EVENT_SHOW_MS);
    });

    socket.on('gameOver', ({ draftOrder }) => {
      audioRef.current?.stopBackgroundMusic();
      setDraftOrder(draftOrder);
      setTimeout(() => setShowResults(true), 800); // brief pause
    });

    return () => {
      socket.off('gameState');
      socket.off('gameEvent');
      socket.off('gameOver');
    };
  }, []);

  // ── Restart race (host) ─────────────────────────────────────────────
  function handleRestart() {
    socket.emit('restartRace', { code: lobbyCode });
    setShowResults(false);
    setDraftOrder(null);
  }

  return (
    <div className="flex flex-col px-3 py-2" style={{ height: '100dvh' }}>
      {/* Title bar — compact, fixed height */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div>
          <h1 className="font-display text-2xl tracking-widest text-[#f59e0b] leading-none">RACE IN PROGRESS</h1>
          <p className="text-[10px] text-[#7d8590] uppercase tracking-widest mt-0.5">
            Lobby: <span className="font-mono text-[#f59e0b]">{lobbyCode}</span>
          </p>
        </div>
        {draftOrder && !showResults && (
          <button
            onClick={() => setShowResults(true)}
            className="text-xs px-4 py-2 bg-[#161b22] border border-[#30363d] rounded-lg text-[#7d8590] hover:text-white hover:border-white transition-all"
          >
            View Results
          </button>
        )}
      </div>

      {/* Canvas area — grows to fill remaining vertical space, never overflows */}
      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        {/* Countdown overlay */}
        {!racing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 rounded-2xl">
            <div
              className="font-display text-9xl text-[#f59e0b]"
              style={{ textShadow: '0 0 40px rgba(245,158,11,0.8)' }}
            >
              {countdown > 0 ? countdown : 'GO!'}
            </div>
          </div>
        )}

        {/* Event banners — stacked, newest on top, fade+slide out at end of life */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 pointer-events-none">
          {eventBanners.map((ev) => {
            const s = EVENT_STYLES[ev.type] || EVENT_STYLES.stun;
            // Fade+slide starts EVENT_FADE_MS before removal
            const fadeDelay = Math.max(0, EVENT_SHOW_MS - EVENT_FADE_MS);
            return (
              <div
                key={ev.id}
                className="px-8 py-3 rounded-2xl text-center font-semibold text-sm whitespace-nowrap"
                style={{
                  background:  s.bg,
                  border:      `1px solid ${s.border}`,
                  boxShadow:   `0 0 24px ${s.glow}88`,
                  animation:   `event-enter 0.25s ease-out, event-exit ${EVENT_FADE_MS}ms ease-in ${fadeDelay}ms forwards`,
                }}
              >
                <div className="text-white font-bold text-base">{ev.targetName}</div>
                <div className="text-[#e6edf3] mt-0.5">{ev.text}</div>
              </div>
            );
          })}
        </div>

        {/* Canvas — constrained by both width AND height, aspect ratio preserved */}
        <div
          className="bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xl w-full h-full"
          style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`, maxHeight: '100%', maxWidth: '100%' }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Results modal */}
      {showResults && draftOrder && (
        <Results
          draftOrder={draftOrder}
          isHost={isHost}
          lobbyCode={lobbyCode}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
}

