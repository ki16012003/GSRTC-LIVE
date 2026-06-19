const express = require('express');
const http = require('http');
const cors = require('cors');
const config = require('./config');
const logger = require('./utils/logger');
require('./database/db');

const socket = require('./socket');
const trackingEngine = require('./tracking-engine/engine');

const busesRouter = require('./routes/buses');
const adminRouter = require('./routes/admin');
const settingsRouter = require('./routes/settings');
const statsRouter = require('./routes/stats');
const { basicAuth } = require('./middleware/auth');

const app = express();
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.use('/api/buses', busesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin', basicAuth, adminRouter);

app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.stack || err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
socket.init(server, config.CORS_ORIGIN);

server.listen(config.PORT, () => {
  logger.info(`GSRTC tracking server listening on port ${config.PORT}`);
  trackingEngine.start();
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.stack || err.message}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});
