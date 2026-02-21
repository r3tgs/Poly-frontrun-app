export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: " INFO",
  [LogLevel.WARN]: " WARN",
  [LogLevel.ERROR]: "ERROR",
};

let currentLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

// ---- Log broadcast listeners ----

export interface LogLine {
  ts: string;
  level: string;
  context: string;
  message: string;
  timestamp: number;
}

type LogListener = (line: LogLine) => void;
const logListeners = new Set<LogListener>();

export function addLogListener(fn: LogListener): () => void {
  logListeners.add(fn);
  return () => logListeners.delete(fn);
}

function log(
  level: LogLevel,
  context: string,
  message: string,
  data?: unknown,
): void {
  if (level < currentLevel) return;

  const ts = new Date().toISOString();
  const label = LEVEL_LABELS[level];
  const prefix = `[${ts}] [${label}] [${context}]`;

  const fullMessage = data !== undefined
    ? `${message} ${JSON.stringify(data)}`
    : message;

  const line = `${prefix} ${fullMessage}`;

  // WARN/ERROR → stderr (unbuffered in Docker, always flushed before exit).
  // DEBUG/INFO  → stdout.
  if (level >= LogLevel.WARN) {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }

  // Broadcast to all registered listeners (e.g. WebSocket dashboard clients).
  if (logListeners.size > 0) {
    const entry: LogLine = {
      ts,
      level: label.trim(),
      context,
      message: fullMessage,
      timestamp: Date.now(),
    };
    for (const fn of logListeners) fn(entry);
  }
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, data?: unknown) =>
      log(LogLevel.DEBUG, context, msg, data),
    info: (msg: string, data?: unknown) =>
      log(LogLevel.INFO, context, msg, data),
    warn: (msg: string, data?: unknown) =>
      log(LogLevel.WARN, context, msg, data),
    error: (msg: string, data?: unknown) =>
      log(LogLevel.ERROR, context, msg, data),
  };
}
