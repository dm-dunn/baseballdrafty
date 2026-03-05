// App.jsx — Root component managing screen state

import { useState, useEffect, useRef } from 'react';
import socket from './socket.js';
import Home   from './Home.jsx';
import Lobby  from './Lobby.jsx';
import Race   from './Race.jsx';

// Screens: 'home' | 'lobby' | 'race'
export default function App() {
  const [screen, setScreen] = useState('home');

  // Shared session state
  const [lobbyCode, setLobbyCode]   = useState('');
  const [myPlayer,  setMyPlayer]    = useState(null);  // { id, name, color, isHost }
  const [lobby,     setLobby]       = useState(null);  // full lobby state
  const [raceData,  setRaceData]    = useState(null);  // initial marble data from raceStarted

  // Keep a ref to lobbyCode so reconnect handler can read it without stale closure
  const lobbyCodeRef = useRef('');

  // ── Global socket listeners ─────────────────────────────────────────
  useEffect(() => {
    // When race starts, switch to Race screen
    function onRaceStarted(data) {
      setRaceData(data);
      setScreen('race');
    }

    // After host resets, return to lobby
    function onLobbyReset(lobbyState) {
      setLobby(lobbyState);
      setRaceData(null);
      setScreen('lobby');
    }

    // Keep myPlayer color in sync when player changes it in the lobby
    function onLobbyUpdate(lobbyState) {
      setMyPlayer(prev => {
        if (!prev) return prev;
        const me = lobbyState.players.find(p => p.id === prev.id);
        if (!me || me.color === prev.color) return prev;
        return { ...prev, color: me.color };
      });
    }

    // On reconnect, re-sync with the server in case we missed raceStarted
    function onReconnect() {
      const code = lobbyCodeRef.current;
      if (!code) return;
      socket.emit('getLobbyState', { code }, ({ lobby: lobbyState, error }) => {
        if (error || !lobbyState) return;
        setLobby(lobbyState);
        if (lobbyState.status === 'racing' || lobbyState.status === 'finished') {
          setScreen('race');
        } else if (lobbyState.status === 'waiting') {
          setScreen('lobby');
        }
      });
    }

    socket.on('raceStarted', onRaceStarted);
    socket.on('lobbyReset',  onLobbyReset);
    socket.on('lobbyUpdate', onLobbyUpdate);
    socket.on('reconnect',   onReconnect);

    return () => {
      socket.off('raceStarted', onRaceStarted);
      socket.off('lobbyReset',  onLobbyReset);
      socket.off('lobbyUpdate', onLobbyUpdate);
      socket.off('reconnect',   onReconnect);
    };
  }, []);

  // ── Screen transitions ──────────────────────────────────────────────
  function handleGameCreated({ code, player, lobbyState }) {
    lobbyCodeRef.current = code;
    setLobbyCode(code);
    setMyPlayer(player);
    setLobby(lobbyState);
    setScreen('lobby');
  }

  function handleGameJoined({ code, player, lobbyState }) {
    lobbyCodeRef.current = code;
    setLobbyCode(code);
    setMyPlayer(player);
    setLobby(lobbyState);
    setScreen('lobby');
  }

  function handleRaceOver() {
    // Handled by lobbyReset or stay on race screen for results
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] font-body relative overflow-hidden">
      {/* Subtle scanline effect */}
      <div className="scanlines" />

      {/* Radial glow backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,197,94,0.25) 0%, transparent 70%)',
        }}
      />

      {screen === 'home' && (
        <Home
          onGameCreated={handleGameCreated}
          onGameJoined={handleGameJoined}
        />
      )}

      {screen === 'lobby' && lobby && (
        <Lobby
          lobbyCode={lobbyCode}
          myPlayer={myPlayer}
          lobby={lobby}
          setLobby={setLobby}
        />
      )}

      {screen === 'race' && (
        <Race
          lobbyCode={lobbyCode}
          myPlayer={myPlayer}
          initialMarbles={raceData?.marbles || []}
        />
      )}
    </div>
  );
}
