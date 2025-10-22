/**
 * Comprehensive logging utility for debugging the extension
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
  error?: Error;
}

class Logger {
  private static instance: Logger;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  private constructor() {
    this.loadLogs();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async loadLogs() {
    try {
      const result = await chrome.storage.local.get('debugLogs');
      if (result.debugLogs) {
        this.logBuffer = result.debugLogs;
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  private async saveLogs() {
    try {
      await chrome.storage.local.set({ debugLogs: this.logBuffer });
    } catch (error) {
      console.error('Failed to save logs:', error);
    }
  }

  private log(level: LogLevel, context: string, message: string, data?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as any : undefined,
    };

    this.logBuffer.push(entry);

    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // Console output with styling
    const style = this.getConsoleStyle(level);
    console.log(
      `%c[${level}] ${context}%c ${message}`,
      style,
      'color: inherit',
      data || '',
      error || ''
    );

    this.saveLogs();
  }

  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'color: #6b7280; font-weight: bold';
      case LogLevel.INFO:
        return 'color: #3b82f6; font-weight: bold';
      case LogLevel.WARN:
        return 'color: #f59e0b; font-weight: bold';
      case LogLevel.ERROR:
        return 'color: #ef4444; font-weight: bold';
    }
  }

  debug(context: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, context, message, data);
  }

  info(context: string, message: string, data?: any) {
    this.log(LogLevel.INFO, context, message, data);
  }

  warn(context: string, message: string, data?: any) {
    this.log(LogLevel.WARN, context, message, data);
  }

  error(context: string, message: string, error?: Error, data?: any) {
    this.log(LogLevel.ERROR, context, message, data, error);
  }

  async getLogs(): Promise<LogEntry[]> {
    return [...this.logBuffer];
  }

  async clearLogs() {
    this.logBuffer = [];
    await chrome.storage.local.remove('debugLogs');
    this.info('Logger', 'Logs cleared');
  }

  async exportLogs(): Promise<string> {
    return JSON.stringify(this.logBuffer, null, 2);
  }
}

export const logger = Logger.getInstance();

