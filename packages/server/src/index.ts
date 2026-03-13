import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { setupSocketHandlers } from './socket-handlers.js';
import { loadConfig } from './config.js';
import { requireAuth, loginHandler, isAuthenticated } from './auth.js';

const config = loadConfig();
const app = express();
const httpServer = createServer(app);

// --- Auth ---
if (config.password) {
  app.post('/api/login', loginHandler(config.password, config.cookieSecret));
  app.use(requireAuth(config.password, config.cookieSecret));
  console.log('Auth enabled — password required');
} else {
  console.log('Auth disabled — no password in config');
}

// --- Static files (production) ---
const clientDistCandidates = [
  resolve(import.meta.dirname, '../../client/dist'),
  resolve(process.cwd(), 'client-dist'),
];
for (const dir of clientDistCandidates) {
  if (existsSync(dir)) {
    app.use(express.static(dir));
    app.get('*', (_req, res) => {
      res.sendFile(resolve(dir, 'index.html'));
    });
    console.log(`Serving static files from ${dir}`);
    break;
  }
}

// --- Socket.io ---
const io = new Server(httpServer, {
  cors: config.password
    ? undefined
    : { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET', 'POST'] },
});

// Socket.io auth middleware
if (config.password) {
  io.use((socket, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    if (isAuthenticated(cookieHeader, config.cookieSecret)) {
      return next();
    }
    return next(new Error('Authentication required'));
  });
}

setupSocketHandlers(io);

httpServer.listen(config.port, () => {
  console.log(`Magical Athlete server running on port ${config.port}`);
});
