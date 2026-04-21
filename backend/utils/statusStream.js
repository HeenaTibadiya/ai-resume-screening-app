const streams = new Map();

function getStream(requestId) {
  if (!streams.has(requestId)) {
    streams.set(requestId, {
      clients: new Set(),
      history: [],
      cleanupTimer: null,
    });
  }

  return streams.get(requestId);
}

function sendEvent(response, payload) {
  response.write(`event: status\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function scheduleCleanup(requestId, delay = 5 * 60 * 1000) {
  const stream = streams.get(requestId);
  if (!stream || stream.clients.size || stream.cleanupTimer) {
    return;
  }

  stream.cleanupTimer = setTimeout(() => {
    streams.delete(requestId);
  }, delay);
}

function publishStatus(requestId, payload) {
  const stream = getStream(requestId);

  if (stream.cleanupTimer) {
    clearTimeout(stream.cleanupTimer);
    stream.cleanupTimer = null;
  }

  const event = {
    requestId,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  stream.history.push(event);
  if (stream.history.length > 50) {
    stream.history.shift();
  }

  for (const client of stream.clients) {
    sendEvent(client, event);
  }

  if (payload.type === 'pipeline' && (payload.state === 'completed' || payload.state === 'failed')) {
    scheduleCleanup(requestId);
  }
}

function createStatusStream(requestId, response) {
  const stream = getStream(requestId);

  if (stream.cleanupTimer) {
    clearTimeout(stream.cleanupTimer);
    stream.cleanupTimer = null;
  }

  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders?.();

  stream.clients.add(response);

  sendEvent(response, {
    requestId,
    timestamp: new Date().toISOString(),
    type: 'connection',
    state: 'connected',
    message: 'Status stream connected',
  });

  for (const event of stream.history) {
    sendEvent(response, event);
  }

  const heartbeat = setInterval(() => {
    response.write(': heartbeat\n\n');
  }, 15000);

  response.on('close', () => {
    clearInterval(heartbeat);
    stream.clients.delete(response);
    scheduleCleanup(requestId);
  });
}

module.exports = {
  createStatusStream,
  publishStatus,
};