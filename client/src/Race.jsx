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

const EVENT_SHOW_MS = 3000; // total visible duration
const EVENT_FADE_MS = 500;  // fade+slide duration (at end of life)
const ASPECT_RATIO  = CANVAS_WIDTH / CANVAS_HEIGHT; // 800/480 ≈ 1.667

// ── Component ─────────────────────────────────────────────────────────────────
export default function Race({ lobbyCode, myPlayer, initialMarbles }) {
  const canvasRef    = useRef(null);
  const canvasAreaRef = useRef(null);     // measures available space
  const marblesRef   = useRef(initialMarbles || []); // latest state, no re-render cost
  const rafRef       = useRef(null);
  const audioRef     = useRef(null);

  const [draftOrder,   setDraftOrder]   = useState(null);
  const [showResults,  setShowResults]  = useState(false);
  const [countdown,    setCountdown]    = useState(3);
  const [racing,       setRacing]       = useState(false);
  const [eventBanners, setEventBanners] = useState([]);

  // ── Canvas pixel dimensions — kept in sync with available space ─────
  // ResizeObserver watches the flex area and computes the largest canvas
  // that fits while maintaining the 5:3 aspect ratio.  Works correctly at
  // any screen size or orientation without any CSS aspect-ratio tricks.
  const [canvasSize, setCanvasSize] = useState({ w: CANVAS_WIDTH, h: CANVAS_HEIGHT });

  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      if (w / h > ASPECT_RATIO) {
        // Available area is wider than 5:3 → height is the constraint
        const ch = h;
        setCanvasSize({ w: Math.round(ch * ASPECT_RATIO), h: ch });
      } else {
        // Available area is taller or equal → width is the constraint
        const cw = w;
        setCanvasSize({ w: cw, h: Math.round(cw / ASPECT_RATIO) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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
    function onGameState({ marbles }) {
      marblesRef.current = marbles;
    }

    function onGameEvent(ev) {
      const id     = `${Date.now()}-${Math.random()}`;
      const type   = guessEventType(ev.eventId);
      const banner = { id, text: ev.eventText, targetName: ev.targetName, targetColor: ev.targetColor, type, bornAt: Date.now() };
      setEventBanners(prev => [banner, ...prev]);
      setTimeout(() => {
        setEventBanners(prev => prev.filter(b => b.id !== id));
      }, EVENT_SHOW_MS);
    }

    function onGameOver({ draftOrder }) {
      audioRef.current?.stopBackgroundMusic();
      setDraftOrder(draftOrder);
      setTimeout(() => setShowResults(true), 800);
    }

    socket.on('gameState', onGameState);
    socket.on('gameEvent', onGameEvent);
    socket.on('gameOver',  onGameOver);

    return () => {
      socket.off('gameState', onGameState);
      socket.off('gameEvent', onGameEvent);
      socket.off('gameOver',  onGameOver);
    };
  }, []);

  // ── Restart race (host) ─────────────────────────────────────────────
  function handleRestart() {
    socket.emit('restartRace', { code: lobbyCode });
    setShowResults(false);
    setDraftOrder(null);
  }

  // Scale UI elements inside the canvas relative to the reference height
  const uiScale = canvasSize.h / CANVAS_HEIGHT;

  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>

      {/* Title bar — compact, fixed height. Keeps its own horizontal padding
          so the canvas area can go fully edge-to-edge on small screens. */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0 px-2 pt-1 sm:px-3 sm:pt-2 sm:mb-2">
        <div>
          <h1 className="font-display text-2xl tracking-widest text-[#f59e0b] leading-none">
            RACE IN PROGRESS
          </h1>
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

      {/*
       * Canvas area — fills all remaining vertical space.
       * The ResizeObserver on this div computes the exact canvas dimensions
       * so the 5:3 diamond always fills as much of the space as possible
       * without ever stretching, regardless of screen size or orientation.
       */}
      <div
        ref={canvasAreaRef}
        className="flex-1 min-h-0 flex items-center justify-center"
      >
        {/* Canvas container — exact pixel-perfect size, all overlays inside */}
        <div
          className="relative bg-[#0d1117] border border-[#30363d] rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: canvasSize.w, height: canvasSize.h }}
        >
          {/* Countdown overlay */}
          {!racing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 rounded-2xl">
              <div
                className="font-display text-[#f59e0b]"
                style={{
                  fontSize:   `${Math.round(128 * uiScale)}px`,
                  textShadow: '0 0 40px rgba(245,158,11,0.8)',
                }}
              >
                {countdown > 0 ? countdown : 'GO!'}
              </div>
            </div>
          )}

          {/* Event banners — positioned relative to the canvas */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none w-full px-2">
            {eventBanners.map((ev) => {
              const s         = EVENT_STYLES[ev.type] || EVENT_STYLES.stun;
              const fadeDelay = Math.max(0, EVENT_SHOW_MS - EVENT_FADE_MS);
              return (
                <div
                  key={ev.id}
                  className="rounded-2xl text-center font-semibold whitespace-nowrap"
                  style={{
                    background: s.bg,
                    border:     `1px solid ${s.border}`,
                    boxShadow:  `0 0 24px ${s.glow}88`,
                    animation:  `event-enter 0.25s ease-out, event-exit ${EVENT_FADE_MS}ms ease-in ${fadeDelay}ms forwards`,
                    padding:    `${Math.round(6 * uiScale)}px ${Math.round(20 * uiScale)}px`,
                    fontSize:   `${Math.round(13 * uiScale)}px`,
                  }}
                >
                  <div className="font-bold" style={{ fontSize: `${Math.round(15 * uiScale)}px` }}>
                    {ev.targetName}
                  </div>
                  <div className="text-[#e6edf3] mt-0.5">{ev.text}</div>
                </div>
              );
            })}
          </div>

          {/* Canvas element — fills the container exactly.
              On small screens scale up 1.2× so the diamond appears zoomed;
              overflow:hidden on the container clips the outer empty border. */}
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full sm:scale-100 scale-[1.2]"
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
