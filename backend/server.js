// ─── server.js ────────────────────────────────────────────────────────────────
// Express + Socket.io entry point.

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { setupSocketHandlers } = require('./gameManager');

const app = express();
const server = http.createServer(app);

// Allow FRONTEND_URL env var (e.g. your Vercel domain), fallback to '*'
const FRONTEND_URL = process.env.FRONTEND_URL || '*';
const allowedOrigins = FRONTEND_URL.includes(',')
  ? FRONTEND_URL.split(',').map((u) => u.trim())
  : FRONTEND_URL;

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: allowedOrigins !== '*',
  },
  // Prefer WebSocket, fall back to polling for proxied environments (Render)
  transports: ['websocket', 'polling'],
});

// ─── Express middleware ───────────────────────────────────────────────────────
app.use(
  cors({
    origin: allowedOrigins,
    credentials: allowedOrigins !== '*',
  })
);
app.use(express.json());

// ─── REST routes (minimal — game logic is all via WebSocket) ─────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Wire up game logic ───────────────────────────────────────────────────────
setupSocketHandlers(io);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎭  Mafia for Cousins — server running`);
  console.log(`   Port     : ${PORT}`);
  console.log(`   CORS     : ${FRONTEND_URL}`);
  console.log(`   Health   : http://localhost:${PORT}/health\n`);
});
