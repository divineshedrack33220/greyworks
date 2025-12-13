// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');
const apiRoutes = require('./src/routes/api');
const solarman = require('./src/services/solarmanService'); // ← now auto-reads HAR token

async function start() {
  // MongoDB Connection
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to MongoDB');

  const app = express();

  // Middleware
  app.use(cors({ origin: '*', credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  // Serve frontend
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  // API routes
  app.use('/api', apiRoutes);

  const PORT = process.env.PORT || 3000;
  const SERVER_URL = `http://localhost:${PORT}`;

  // No more solarman.setToken() → token is auto-extracted from HAR file
  console.log('Solarman service ready → token auto-extracted from HAR file');

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`Server running at ${SERVER_URL}`);
    console.log(`Dashboard: ${SERVER_URL}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close(() => mongoose.connection.close());
  });

  // AUTO SYNC EVERY 5 MINUTES
  cron.schedule(process.env.POLL_CRON || '*/5 * * * *', async () => {
    console.log('[cron] Starting full real-time sync...');
    try {
      const res = await fetch(`${SERVER_URL}/api/sync/plants`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        console.log(`[cron] Sync complete → ${data.saved} stations | ${data.realTimeUpdated || 0} live`);
      } else {
        console.error('[cron] Sync HTTP error:', res.status);
      }
    } catch (err) {
      console.error('[cron] Sync failed:', err.message);
    }
  });

  // Initial sync on startup
  setTimeout(async () => {
    console.log('[startup] Running initial sync...');
    try {
      await fetch(`${SERVER_URL}/api/sync/plants`, { method: 'POST' });
      console.log('[startup] Initial real-time sync complete');
    } catch (err) {
      console.error('[startup] Initial sync failed:', err.message);
    }
  }, 8000);
}

start().catch(err => {
  console.error('Server failed to start:', err);
  process.exit(1);
});