// Home.jsx — Landing screen: create or join a game

import { useState } from 'react';
import socket from './socket.js';

export default function Home({ onGameCreated, onGameJoined }) {
  const [tab,         setTab]         = useState('create'); // 'create' | 'join'
  const [playerCount, setPlayerCount] = useState(6);
  const [joinCode,    setJoinCode]    = useState('');
  const [name,        setName]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // ── Create game ──────────────────────────────────────────────────────
  async function handleCreate() {
    if (!name.trim()) return setError('Enter your name.');
    setError(''); setLoading(true);

    try {
      const res = await fetch('/api/lobbies', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ playerCount }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      socket.emit('joinLobby', { code: data.code, name: name.trim() }, (reply) => {
        setLoading(false);
        if (reply.error) return setError(reply.error);

        socket.emit('getLobbyState', { code: data.code }, (ls) => {
          onGameCreated({ code: data.code, player: { ...reply.player, isHost: true }, lobbyState: ls.lobby });
        });
      });
    } catch (e) {
      setLoading(false);
      setError(e.message);
    }
  }

  // ── Join game ─────────────────────────────────────────────────────────
  function handleJoin() {
    if (!name.trim() || joinCode.length !== 6) return setError('Enter your name and a 6-character lobby code.');
    setError(''); setLoading(true);

    socket.emit('joinLobby', { code: joinCode, name: name.trim() }, (reply) => {
      setLoading(false);
      if (reply.error) return setError(reply.error);

      socket.emit('getLobbyState', { code: joinCode }, (ls) => {
        onGameJoined({ code: joinCode, player: reply.player, lobbyState: ls.lobby });
      });
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="text-center mb-10 portrait:mb-5">
        <div className="text-7xl mb-2 portrait:text-5xl">⚾</div>
        <h1 className="font-display text-6xl tracking-widest text-[#f59e0b] portrait:text-4xl" style={{letterSpacing:'0.15em'}}>
          DRAFT RANDOMIZER
        </h1>
        <p className="text-[#7d8590] font-body mt-1 text-sm tracking-widest uppercase portrait:text-xs">
          Who picks first? Let the diamond decide.
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-[#161b22] border border-[#30363d] rounded-2xl p-8 shadow-2xl">
        {/* Tab toggle */}
        <div className="flex rounded-lg overflow-hidden border border-[#30363d] mb-7">
          {['create','join'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-semibold uppercase tracking-widest transition-colors ${
                tab === t
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-transparent text-[#7d8590] hover:text-white'
              }`}
            >
              {t === 'create' ? 'Create Game' : 'Join Game'}
            </button>
          ))}
        </div>

        {/* Player count (create only) */}
        {tab === 'create' && (
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-widest text-[#7d8590] mb-2">
              Number of Players
            </label>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: 13 }, (_, i) => i + 2).map(n => (
                <button
                  key={n}
                  onClick={() => setPlayerCount(n)}
                  className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${
                    playerCount === n
                      ? 'bg-[#f59e0b] border-[#f59e0b] text-black'
                      : 'border-[#30363d] text-[#7d8590] hover:border-[#f59e0b] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Join code (join only) */}
        {tab === 'join' && (
          <div className="mb-5">
            <label className="block text-xs uppercase tracking-widest text-[#7d8590] mb-2">Lobby Code</label>
            <input
              maxLength={6}
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 font-mono text-xl text-center tracking-[0.4em] text-[#f59e0b] placeholder-[#30363d] focus:outline-none focus:border-[#f59e0b] uppercase"
            />
          </div>
        )}

        {/* Name */}
        <div className="mb-7">
          <label className="block text-xs uppercase tracking-widest text-[#7d8590] mb-2">Your Name</label>
          <input
            maxLength={20}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? handleCreate() : handleJoin())}
            placeholder="Commissioner Flex"
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#f59e0b] text-white placeholder-[#30363d]"
          />
          <p className="text-[#7d8590] text-[11px] mt-1.5">You'll pick your color in the lobby.</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
            ⚠ {error}
          </p>
        )}

        {/* Action button */}
        <button
          onClick={tab === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          className="w-full bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold rounded-xl py-3 text-sm uppercase tracking-widest transition-all glow-amber"
        >
          {loading ? 'Connecting…' : tab === 'create' ? 'Create Lobby' : 'Join Game'}
        </button>
      </div>

      <p className="text-[#30363d] text-xs mt-8 tracking-widest">
        SUPPORTS UP TO 14 PLAYERS
      </p>
    </div>
  );
}
