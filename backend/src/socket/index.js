const logger = require('../utils/logger');

let io = null;

function init(server, corsOrigin) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => logger.info(`Client disconnected: ${socket.id}`));
  });

  return io;
}

function emitBusUpdate(bus) {
  if (io) io.emit('bus:update', bus);
}

function emitBusesAdded(buses) {
  if (io) io.emit('bus:added', buses);
}

function emitBusesRemoved(vehicleNos) {
  if (io) io.emit('bus:removed', vehicleNos);
}

function emitStats(stats) {
  if (io) io.emit('stats:update', stats);
}

module.exports = { init, emitBusUpdate, emitBusesAdded, emitBusesRemoved, emitStats };
