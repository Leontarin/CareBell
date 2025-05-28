// Debug logging utility for video calling
class DebugLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 100;
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data ? JSON.stringify(data, null, 2) : null
    };
    
    this.logs.push(logEntry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Console logging with colors
    const colors = {
      error: '\x1b[31m', // red
      warn: '\x1b[33m',  // yellow
      info: '\x1b[36m',  // cyan
      debug: '\x1b[90m', // gray
      success: '\x1b[32m' // green
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || colors.info;
    
    console.log(`${color}[${level.toUpperCase()}] ${timestamp} - ${message}${reset}`, data || '');
  }

  error(message, data) { this.log('error', message, data); }
  warn(message, data) { this.log('warn', message, data); }
  info(message, data) { this.log('info', message, data); }
  debug(message, data) { this.log('debug', message, data); }
  success(message, data) { this.log('success', message, data); }

  // Get logs for specific time range or level
  getLogs(filter = {}) {
    let filteredLogs = this.logs;
    
    if (filter.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filter.level);
    }
    
    if (filter.since) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= filter.since);
    }
    
    return filteredLogs;
  }

  // Export logs as text
  exportLogs() {
    return this.logs.map(log => 
      `[${log.level.toUpperCase()}] ${log.timestamp} - ${log.message}${log.data ? '\n' + log.data : ''}`
    ).join('\n\n');
  }

  // Clear all logs
  clear() {
    this.logs = [];
  }
}

// Create a singleton instance
const debugLogger = new DebugLogger();

export default debugLogger;
