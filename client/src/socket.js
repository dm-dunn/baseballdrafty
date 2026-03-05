// socket.js — Singleton Socket.io client instance

import { io } from 'socket.io-client';

// In production the client is served from the same origin as the server,
// so passing undefined lets Socket.io connect to window.location.origin.
// In local dev the Vite proxy forwards /socket.io → localhost:3001 automatically.
// Set VITE_SERVER_URL only if you need to point at a different host.
const URL = import.meta.env.VITE_SERVER_URL || undefined;

const socket = io(URL, {
  autoConnect: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
});

export default socket;
