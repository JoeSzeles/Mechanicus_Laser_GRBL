class Logger {
  constructor(maxEntries = 500) {
    this.logs = [];
    this.maxEntries = maxEntries;
    this.broadcastCallback = null;
  }

  setBroadcastCallback(callback) {
    this.broadcastCallback = callback;
  }

  log(level, category, message, metadata = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }

    const emoji = {
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      debug: '🔍'
    }[level] || 'ℹ️';

    const prefix = `[${category.toUpperCase()}]`;
    console.log(`${emoji} ${prefix} ${message}`, metadata && Object.keys(metadata).length > 0 ? metadata : '');

    if (this.broadcastCallback) {
      this.broadcastCallback(entry);
    }

    return entry;
  }

  getLogs(filters = {}) {
    let result = [...this.logs];

    if (filters.level) {
      result = result.filter(log => log.level === filters.level);
    }

    if (filters.category) {
      result = result.filter(log => log.category === filters.category);
    }

    if (filters.limit) {
      const limit = parseInt(filters.limit);
      result = result.slice(-limit);
    }

    return result;
  }

  clearLogs() {
    this.logs = [];
  }
}

const logger = new Logger();

module.exports = {
  log: (level, category, message, metadata) => logger.log(level, category, message, metadata),
  getLogs: (filters) => logger.getLogs(filters),
  clearLogs: () => logger.clearLogs(),
  setBroadcastCallback: (callback) => logger.setBroadcastCallback(callback)
};
