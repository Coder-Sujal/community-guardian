import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { initDb } from './db/database.js';
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feed.js';
import circleRoutes from './routes/circles.js';
import chatRoutes from './routes/chat.js';
import alertsRoutes from './routes/alerts.js';
import phishingRoutes from './routes/phishing.js';
import { setupSocketHandlers } from './socket.js';
import { startScheduler } from '../server/scheduler.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/phishing', phishingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and start server
const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();
  setupSocketHandlers(io);

  // Start the scheduler (CISA, RBI, and per-user weather fetchers with cron)
  startScheduler();

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);

export { io };
