import { createServer } from 'http';
import { Server } from 'socket.io';
import { setupSocketHandlers } from './socket-handlers.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

setupSocketHandlers(io);

httpServer.listen(PORT, () => {
  console.log(`Magical Athlete server running on port ${PORT}`);
});
