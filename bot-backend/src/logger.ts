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

  if (data !== undefined) {
    console.log(prefix, message, JSON.stringify(data));
  } else {
    console.log(prefix, message);
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
