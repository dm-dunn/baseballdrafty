// server.js — Express + Socket.io entry point

import express      from 'express';
import { createServer } from 'http';
import { Server }   from 'socket.io';
import cors         from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';

import {
  createLobby, getLobby, deleteLobby,
  addPlayer, removePlayer, setPlayerReady,
  setPlayerColor, allPlayersReady, getLobbyState, addBot,
} from './lobbyManager.js';
import { createGameEngine } from './gameEngine.js';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../client/dist');

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// ── Serve built client (production) ──────────────────────────────────────
app.use(express.static(clientDist));

// Active game engines keyed by lobby code
const engines = new Map();

// ── REST: Create Lobby ────────────────────────────────────────────────────
app.post('/api/lobbies', (req, res) => {
  const count = parseInt(req.body.playerCount);
  if (!count || count < 2 || count > 14) {
    return res.status(400).json({ error: 'Player count must be 2–14' });
  }
  const lobby = createLobby(count);
  res.json({ code: lobby.code, maxPlayers: lobby.maxPlayers });
});

// ── REST: Health check ────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Socket.io ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  let myLobbyCode = null;

  // ── Join lobby ─────────────────────────────────────────────────────────
  socket.on('joinLobby', ({ code, name }, cb) => {
    const uCode = (code || '').toUpperCase().trim();
    const lobby = getLobby(uCode);
    if (!lobby) return cb({ error: 'Lobby not found' });

    const result = addPlayer(lobby, { socketId: socket.id, name: name.trim() });
    if (result.error) return cb({ error: result.error });

    myLobbyCode = uCode;
    socket.join(uCode);

    cb({ success: true, player: result.player, isHost: result.player.isHost });

    // Notify everyone in room about updated lobby state
    io.to(uCode).emit('lobbyUpdate', getLobbyState(lobby));
  });

  // ── Toggle ready ────────────────────────────────────────────────────────
  socket.on('setReady', ({ code, ready }) => {
    const lobby = getLobby(code);
    if (!lobby || lobby.status !== 'waiting') return;
    setPlayerReady(lobby, socket.id, ready);
    io.to(code).emit('lobbyUpdate', getLobbyState(lobby));
  });

  // ── Change color ─────────────────────────────────────────────────────────
  socket.on('setColor', ({ code, color }, cb) => {
    const lobby = getLobby(code);
    if (!lobby) return cb && cb({ error: 'Lobby not found' });
    const result = setPlayerColor(lobby, socket.id, color);
    if (result.error) return cb && cb({ error: result.error });
    io.to(code).emit('lobbyUpdate', getLobbyState(lobby));
    cb && cb({ success: true });
  });

  // ── Host starts race ────────────────────────────────────────────────────
  socket.on('startRace', ({ code }) => {
    const lobby = getLobby(code);
    if (!lobby)                          return;
    if (lobby.hostId !== socket.id)      return;
    if (!allPlayersReady(lobby))         return;
    if (lobby.status !== 'waiting')      return;

    const engine = createGameEngine(lobby, io);
    engines.set(code, engine);
    engine.start();
  });

  // ── Host adds a bot ─────────────────────────────────────────────────────
  socket.on('addBot', ({ code, name }, cb) => {
    const lobby = getLobby(code);
    if (!lobby) return cb?.({ error: 'Lobby not found' });
    if (lobby.hostId !== socket.id) return cb?.({ error: 'Only the host can add bots' });
    if (lobby.status !== 'waiting') return cb?.({ error: 'Game has already started' });

    const result = addBot(lobby, name);
    if (result.error) return cb?.({ error: result.error });

    io.to(code).emit('lobbyUpdate', getLobbyState(lobby));
    cb?.({ success: true });
  });

  // ── Host restarts race ──────────────────────────────────────────────────
  socket.on('restartRace', ({ code }) => {
    const lobby = getLobby(code);
    if (!lobby)                     return;
    if (lobby.hostId !== socket.id) return;

    const old = engines.get(code);
    if (old) { old.stop(); engines.delete(code); }

    lobby.status     = 'waiting';
    lobby.draftOrder = null;
    lobby.players.forEach(p => { p.ready = false; });

    io.to(code).emit('lobbyReset', getLobbyState(lobby));
  });

  // ── Fetch lobby state (used on reconnect / page refresh) ───────────────
  socket.on('getLobbyState', ({ code }, cb) => {
    const lobby = getLobby(code);
    if (!lobby) return cb({ error: 'Lobby not found' });
    cb({ lobby: getLobbyState(lobby) });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
    if (!myLobbyCode) return;

    const lobby = getLobby(myLobbyCode);
    if (!lobby) return;

    removePlayer(lobby, socket.id);

    if (lobby.players.length === 0) {
      // Clean up empty lobby
      const engine = engines.get(myLobbyCode);
      if (engine) { engine.stop(); engines.delete(myLobbyCode); }
      deleteLobby(myLobbyCode);
      console.log(`[lobby] ${myLobbyCode} deleted (empty)`);
    } else {
      io.to(myLobbyCode).emit('lobbyUpdate', getLobbyState(lobby));
    }
  });
});

// ── SPA fallback — must be after all API routes ───────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(join(clientDist, 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Fun Draft Randomizer server running on port ${PORT}`);
});
