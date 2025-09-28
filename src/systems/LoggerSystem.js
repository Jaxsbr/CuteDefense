/**
 * CuteDefense - Logger System
 * Centralized logging system with debug toggle control
 */
class LoggerSystem {
    constructor() {
        this.debugEnabled = false; // Start with debug OFF - no console output
        this.logs = [];
        this.maxLogs = 1000; // Keep last 1000 logs in memory
    }
    
    /**
     * Set debug mode (toggled by D key)
     * @param {boolean} enabled - Whether debug mode is enabled
     */
    setDebugMode(enabled) {
        this.debugEnabled = enabled;
        if (enabled) {
            this.log('info', 'Debug mode enabled - logs will be emitted to console');
        } else {
            this.log('info', 'Debug mode disabled - logs will be stored in memory only');
        }
    }
    
    /**
     * Log a message with specified level
     * @param {string} level - Log level: 'info', 'warn', 'error'
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments to log
     */
    log(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            args: args.length > 0 ? args : undefined
        };
        
        // Add to memory log
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift(); // Remove oldest log
        }
        
        // ONLY emit to console if debug is enabled
        if (this.debugEnabled) {
            const consoleMethod = this.getConsoleMethod(level);
            if (args.length > 0) {
                consoleMethod(`[${timestamp}] ${message}`, ...args);
            } else {
                consoleMethod(`[${timestamp}] ${message}`);
            }
        }
        // If debug is disabled, NO console output at all
    }
    
    /**
     * Get console method based on log level
     * @param {string} level - Log level
     * @returns {Function} Console method
     */
    getConsoleMethod(level) {
        switch (level) {
            case 'warn':
                return console.warn;
            case 'error':
                return console.error;
            case 'info':
            default:
                return console.log;
        }
    }
    
    /**
     * Log info message
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    
    /**
     * Log warning message
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    
    /**
     * Log error message
     * @param {string} message - Log message
     * @param {...any} args - Additional arguments
     */
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    
    /**
     * Get all logs from memory
     * @returns {Array} Array of log entries
     */
    getLogs() {
        return [...this.logs];
    }
    
    /**
     * Get logs filtered by level
     * @param {string} level - Log level to filter by
     * @returns {Array} Filtered log entries
     */
    getLogsByLevel(level) {
        return this.logs.filter(log => log.level === level);
    }
    
    /**
     * Clear all logs from memory
     */
    clearLogs() {
        this.logs = [];
    }
    
    /**
     * Get log statistics
     * @returns {Object} Log statistics
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            info: 0,
            warn: 0,
            error: 0
        };
        
        this.logs.forEach(log => {
            stats[log.level]++;
        });
        
        return stats;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoggerSystem;
}
