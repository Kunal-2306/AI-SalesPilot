import 'dotenv/config';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { getJwtSecret } from './config/env.js';

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();

    const app = createApp();
    const server = http.createServer(app);

    const io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) return next();
      try {
        const decoded = jwt.verify(token, getJwtSecret());
        socket.userId = decoded.id;
      } catch {
        // Allow anonymous connection if token invalid; rooms won't join
      }
      next();
    });

    io.on('connection', (socket) => {
      if (socket.userId) {
        socket.join(String(socket.userId));
      }
    });

    app.set('io', io);

    server.listen(PORT, () => {
      console.log(`SalesPilot AI server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
