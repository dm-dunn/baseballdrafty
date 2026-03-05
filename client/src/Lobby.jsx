// Lobby.jsx — Waiting room: color picker, player list, ready toggle, host controls

import { useState, useEffect } from 'react';
import socket from './socket.js';

const ALL_COLORS = [
  'Red','Blue','Green','Yellow','Orange','Purple','Pink',
  'Teal','Cyan','Lime','Maroon','Navy','Gold','Black',
];

const COLOR_CSS = {
  Red:'#ef4444',Blue:'#3b82f6',Green:'#22c55e',Yellow:'#eab308',
  Orange:'#f97316',Purple:'#a855f7',Pink:'#ec4899',Teal:'#14b8a6',
  Cyan:'#06b6d4',Lime:'#84cc16',Maroon:'#9b2226',Navy:'#1e40af',
  Gold:'#d97706',Black:'#374151',
};

export default function Lobby({ lobbyCode, myPlayer, lobby, setLobby }) {
  const [isMeReady,      setIsMeReady]      = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [colorConfirmed, setColorConfirmed] = useState(false); // did user explicitly pick?
  const [colorError,     setColorError]     = useState('');
  const [showBotInput,   setShowBotInput]   = useState(false); // inline bot-name panel
  const [botNameInput,   setBotNameInput]   = useState('');    // draft name for new bot

  const isHost   = myPlayer?.isHost;
  const canStart = lobby.allReady && lobby.players.length >= 2;
  const me       = lobby.players.find(p => p.id === socket.id);
  const myColor  = me?.color || '';

  // Ready requires an explicit color pick
  const canReady = colorConfirmed && !colorError;

  // ── Socket: lobby updates ───────────────────────────────────────────
  useEffect(() => {
    function onLobbyUpdate(newLobby) {
      setLobby(newLobby);
      const meNow = newLobby.players.find(p => p.id === socket.id);
      if (meNow) setIsMeReady(meNow.ready);
    }

    socket.on('lobbyUpdate', onLobbyUpdate);
    return () => socket.off('lobbyUpdate', onLobbyUpdate);
  }, [setLobby]);

  // ── Pick a color ────────────────────────────────────────────────────
  function handlePickColor(color) {
    if (color === myColor) return; // already selected
    setColorError('');

    socket.emit('setColor', { code: lobbyCode, color }, (reply) => {
      if (reply?.error) {
        setColorError(reply.error);
      } else {
        setColorConfirmed(true);
        // Un-ready if they change color after marking ready
        if (isMeReady) {
          setIsMeReady(false);
          socket.emit('setReady', { code: lobbyCode, ready: false });
        }
      }
    });
  }

  // ── Toggle ready ────────────────────────────────────────────────────
  function toggleReady() {
    if (!canReady) return;
    const next = !isMeReady;
    setIsMeReady(next);
    socket.emit('setReady', { code: lobbyCode, ready: next });
  }

  // ── Start race ──────────────────────────────────────────────────────
  function startRace() {
    if (!canStart) return;
    socket.emit('startRace', { code: lobbyCode });
  }

  // ── Add bot ─────────────────────────────────────────────────────────
  function handleAddBot() {
    setBotNameInput('');
    setShowBotInput(true);
  }

  function submitBot() {
    const name = botNameInput.trim();
    if (!name) return;
    socket.emit('addBot', { code: lobbyCode, name });
    setShowBotInput(false);
    setBotNameInput('');
  }

  function cancelBot() {
    setShowBotInput(false);
    setBotNameInput('');
  }

  // ── Copy code ───────────────────────────────────────────────────────
  function copyCode() {
    navigator.clipboard.writeText(lobbyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Build color state ───────────────────────────────────────────────
  // Map color → player who owns it (excluding self, so we can show taken slots)
  const takenBy = {};
  lobby.players.forEach(p => {
    if (p.id !== socket.id) takenBy[p.color] = p.name;
  });

  // ── UI ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-[#7d8590] mb-1">Lobby Code</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-mono text-5xl font-bold text-[#f59e0b] tracking-[0.2em]">
              {lobbyCode}
            </span>
            <button
              onClick={copyCode}
              className="text-[#7d8590] hover:text-white text-xs px-3 py-1.5 border border-[#30363d] rounded-lg transition-colors"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-[#7d8590] text-xs mt-2">
            Share this code with your league members
          </p>
        </div>

        {/* Player list */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-[#7d8590]">Players</span>
            <span className="text-xs text-[#7d8590]">
              {lobby.players.length} / {lobby.maxPlayers}
            </span>
          </div>

          {lobby.players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-[#30363d] last:border-0"
            >
              {/* Color marble */}
              <div
                className="w-8 h-8 rounded-full border-2 border-black/30 flex-shrink-0 shadow"
                style={{ backgroundColor: COLOR_CSS[p.color] }}
              />

              {/* Name + color label */}
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm truncate block">
                  {p.name}
                  {p.id === socket.id && (
                    <span className="ml-2 text-[10px] text-[#7d8590] font-normal">(you)</span>
                  )}
                </span>
                <span className="text-[11px] text-[#7d8590]">{p.color}</span>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2">
                {p.isHost && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 rounded">
                    HOST
                  </span>
                )}
                {p.isBot && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded">
                    BOT
                  </span>
                )}
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                  p.ready
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-[#30363d]/50 text-[#7d8590] border-[#30363d]'
                }`}>
                  {p.ready ? 'Ready' : 'Waiting'}
                </span>
              </div>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, lobby.maxPlayers - lobby.players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-4 px-5 py-3.5 border-b border-[#30363d] last:border-0 opacity-30">
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-[#30363d]" />
              <span className="text-sm text-[#30363d]">Waiting for player…</span>
            </div>
          ))}
        </div>

        {/* Bot name input panel — host only, appears when adding a bot */}
        {isHost && showBotInput && (
          <div className="bg-[#161b22] border border-blue-500/30 rounded-2xl p-4 mb-4">
            <p className="text-xs uppercase tracking-widest text-blue-400 mb-3">Name this bot</p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                maxLength={30}
                placeholder="Enter their name…"
                value={botNameInput}
                onChange={e => setBotNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitBot(); if (e.key === 'Escape') cancelBot(); }}
                className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-sm text-white placeholder-[#7d8590] focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={submitBot}
                disabled={!botNameInput.trim()}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all border ${
                  botNameInput.trim()
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30 cursor-pointer'
                    : 'bg-transparent border-[#30363d] text-[#30363d] cursor-not-allowed'
                }`}
              >
                Add
              </button>
              <button
                onClick={cancelBot}
                className="px-3 py-2 rounded-lg text-sm text-[#7d8590] hover:text-white border border-[#30363d] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Color picker */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase tracking-widest text-[#7d8590]">Pick Your Color</span>
            {!colorConfirmed && (
              <span className="text-[11px] text-[#f59e0b] animate-pulse">← Choose to confirm</span>
            )}
            {colorConfirmed && (
              <span className="text-[11px] text-green-400">✓ Color locked in</span>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {ALL_COLORS.map(c => {
              const isMe    = c === myColor;
              const isTaken = !!takenBy[c];
              const css     = COLOR_CSS[c];

              return (
                <button
                  key={c}
                  title={isTaken ? `Taken by ${takenBy[c]}` : c}
                  disabled={isTaken}
                  onClick={() => handlePickColor(c)}
                  style={{ backgroundColor: css }}
                  className={`relative w-10 h-10 rounded-full transition-all border-2 ${
                    isMe
                      ? 'border-white scale-125 shadow-lg shadow-white/20'
                      : isTaken
                        ? 'opacity-25 cursor-not-allowed border-transparent'
                        : 'border-transparent hover:scale-110 hover:border-white/50 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Crown for "currently mine" */}
                  {isMe && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] leading-none">
                      👑
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {colorError && (
            <p className="text-red-400 text-xs mt-3 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-1.5">
              ⚠ {colorError}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {/* Ready toggle */}
          {!isHost && (
            <button
              onClick={toggleReady}
              disabled={!canReady}
              title={!colorConfirmed ? 'Pick a color first' : ''}
              className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all border ${
                !canReady
                  ? 'border-[#30363d] text-[#30363d] cursor-not-allowed bg-transparent'
                  : isMeReady
                    ? 'bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30'
                    : 'bg-[#161b22] border-[#30363d] text-[#7d8590] hover:border-white hover:text-white'
              }`}
            >
              {isMeReady ? '✓ Ready!' : canReady ? 'Mark Ready' : 'Pick a color first'}
            </button>
          )}

          {isHost && (
            <>
              <button
                onClick={toggleReady}
                disabled={!canReady}
                title={!colorConfirmed ? 'Pick a color first' : ''}
                className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all border ${
                  !canReady
                    ? 'border-[#30363d] text-[#30363d] cursor-not-allowed bg-transparent'
                    : isMeReady
                      ? 'bg-green-500/20 border-green-500/50 text-green-400'
                      : 'bg-[#161b22] border-[#30363d] text-[#7d8590] hover:border-white hover:text-white'
                }`}
              >
                {isMeReady ? '✓ Ready' : canReady ? 'Mark Ready' : 'Pick a color first'}
              </button>

              <button
                onClick={handleAddBot}
                disabled={lobby.players.length >= lobby.maxPlayers || showBotInput}
                title={lobby.players.length >= lobby.maxPlayers ? 'Lobby is full' : showBotInput ? 'Finish naming the current bot first' : 'Add a bot player'}
                className={`px-4 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all border ${
                  lobby.players.length < lobby.maxPlayers && !showBotInput
                    ? 'bg-[#161b22] border-[#30363d] text-[#7d8590] hover:border-blue-400 hover:text-blue-400 cursor-pointer'
                    : 'border-[#30363d] text-[#30363d] cursor-not-allowed bg-transparent'
                }`}
              >
                + Bot
              </button>

              <button
                onClick={startRace}
                disabled={!canStart}
                className={`flex-1 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all ${
                  canStart
                    ? 'bg-[#f59e0b] hover:bg-[#d97706] text-black glow-amber cursor-pointer'
                    : 'bg-[#161b22] border border-[#30363d] text-[#30363d] cursor-not-allowed'
                }`}
              >
                {canStart ? '🏁 Start Race!' : 'Waiting for all…'}
              </button>
            </>
          )}
        </div>

        {!canStart && lobby.players.length >= 2 && (
          <p className="text-center text-[#7d8590] text-xs mt-3">
            All players must pick a color and mark ready before the race can begin
          </p>
        )}
      </div>
    </div>
  );
}
