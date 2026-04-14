function formatMeta(meta) {
  if (!meta || typeof meta !== 'object' || !Object.keys(meta).length) {
    return '';
  }

  return ` ${JSON.stringify(meta)}`;
}

function createRequestLogger(requestId) {
  return (message, meta) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${requestId}] ${message}${formatMeta(meta)}`);
  };
}

module.exports = { createRequestLogger };
