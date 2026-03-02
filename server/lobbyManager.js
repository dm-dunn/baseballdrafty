// lobbyManager.js — Creates and manages game lobbies

const BOT_NAMES = [
  'Babe Bot', 'Cy Bot', 'Lou Bot', 'Ty Bot', 'Hank Bot',
  'Willie Bot', 'Ted Bot', 'Mickey Bot', 'Sandy Bot', 'Walter Bot',
  'Roger Bot', 'Josh Bot', 'Satchel Bot', 'Honus Bot',
];

const ALL_COLORS = [
  'Red','Blue','Green','Yellow','Orange','Purple','Pink',
  'Teal','Cyan','Lime','Maroon','Navy','Gold','Black',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Map of lobbyCode → lobby object
const lobbies = new Map();

export function createLobby(playerCount) {
  let code;
  do { code = generateCode(); } while (lobbies.has(code));

  const lobby = {
    code,
    status: 'waiting',          // 'waiting' | 'racing' | 'finished'
    maxPlayers: playerCount,
    players: [],
    hostId: null,
    availableColors: shuffle(ALL_COLORS),
    draftOrder: null,
  };

  lobbies.set(code, lobby);
  return lobby;
}

export function getLobby(code) {
  return lobbies.get(code) || null;
}

export function deleteLobby(code) {
  lobbies.delete(code);
}

export function addPlayer(lobby, { socketId, name }) {
  if (lobby.players.length >= lobby.maxPlayers) return { error: 'Lobby is full' };
  if (lobby.status !== 'waiting')               return { error: 'Game has already started' };

  // Auto-assign the first available color; player can change it in the lobby
  const color = lobby.availableColors[0];
  if (!color) return { error: 'No colors available' };
  lobby.availableColors.splice(0, 1);

  const isHost = lobby.players.length === 0;
  const player = { id: socketId, name, color, ready: false, isHost };
  if (isHost) lobby.hostId = socketId;

  lobby.players.push(player);
  return { player };
}

export function setPlayerColor(lobby, socketId, newColor) {
  if (lobby.status !== 'waiting') return { error: 'Cannot change color once the race has started' };

  const player = lobby.players.find(p => p.id === socketId);
  if (!player) return { error: 'Player not found' };
  if (player.color === newColor) return { player }; // no-op

  // Make sure the requested color is available
  const idx = lobby.availableColors.indexOf(newColor);
  if (idx === -1) return { error: 'Color is no longer available' };

  // Return old color to pool
  lobby.availableColors.push(player.color);

  // Assign new color
  lobby.availableColors.splice(idx, 1);
  player.color = newColor;
  return { player };
}

export function removePlayer(lobby, socketId) {
  const idx = lobby.players.findIndex(p => p.id === socketId);
  if (idx === -1) return null;

  const [player] = lobby.players.splice(idx, 1);
  lobby.availableColors.push(player.color); // return color to pool

  // Transfer host if needed
  if (player.isHost && lobby.players.length > 0) {
    lobby.players[0].isHost = true;
    lobby.hostId = lobby.players[0].id;
  }

  return player;
}

export function setPlayerReady(lobby, socketId, ready) {
  const player = lobby.players.find(p => p.id === socketId);
  if (player) player.ready = ready;
}

export function allPlayersReady(lobby) {
  return lobby.players.length >= 2 && lobby.players.every(p => p.ready);
}

export function addBot(lobby, customName) {
  if (lobby.players.length >= lobby.maxPlayers) return { error: 'Lobby is full' };
  if (lobby.status !== 'waiting')               return { error: 'Game has already started' };

  const color = lobby.availableColors[0];
  if (!color) return { error: 'No colors available' };
  lobby.availableColors.splice(0, 1);

  let name;
  if (customName && customName.trim()) {
    name = customName.trim().slice(0, 30);
  } else {
    const takenNames = new Set(lobby.players.map(p => p.name));
    name = BOT_NAMES.find(n => !takenNames.has(n)) || `Bot ${lobby.players.length + 1}`;
  }

  const id = `bot-${Math.random().toString(36).substring(2, 10)}`;
  const player = { id, name, color, ready: true, isHost: false, isBot: true };
  lobby.players.push(player);
  return { player };
}

export function getLobbyState(lobby) {
  return {
    code: lobby.code,
    status: lobby.status,
    maxPlayers: lobby.maxPlayers,
    players: lobby.players.map(p => ({ ...p })),
    availableColors: [...lobby.availableColors],
    allReady: allPlayersReady(lobby),
    draftOrder: lobby.draftOrder,
  };
}
