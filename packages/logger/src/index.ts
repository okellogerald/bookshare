import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import pino, { type Logger, type LoggerOptions } from "pino";
import pinoPretty from "pino-pretty";

/* Paths pino will automatically replace with "[REDACTED]". */
const DEFAULT_REDACT_PATHS = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "sessionSecret",
  "clientSecret",
  "token",
  "apiToken",
  "accessToken",
  "refreshToken",
  "idToken",
  "code",
  "state",
  "codeVerifier",
  "expectedState",
  "loginChallenge",
  "logoutChallenge",
  "consentChallenge",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['set-cookie']",
  "res.headers['set-cookie']",
  "request.headers.authorization",
  "request.headers.cookie",
  "response.headers['set-cookie']",
];

type CreateLoggerOptions = {
  service: string;
  level?: string;
  pretty?: boolean;
  base?: Record<string, unknown>;
};

type HeaderValue = string | string[] | undefined;

function resolveLogLevel(level?: string): string {
  if (level) return level;
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldUsePrettyLogs(pretty?: boolean): boolean {
  if (typeof pretty === "boolean") return pretty;
  return process.env.LOG_PRETTY === "true";
}

function normalizeHeaderValue(value: HeaderValue): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const loggerOptions: LoggerOptions = {
    level: resolveLogLevel(options.level),
    base: {
      service: options.service,
      env: process.env.NODE_ENV ?? "development",
      ...options.base,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: DEFAULT_REDACT_PATHS,
      censor: "[REDACTED]",
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
    },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  };

  if (!shouldUsePrettyLogs(options.pretty)) {
    return pino(loggerOptions);
  }

  return pino(
    loggerOptions,
    pinoPretty({
      colorize: true,
      ignore: "pid,hostname",
      sync: true,
      translateTime: "SYS:standard",
    })
  );
}

export function createPinoHttpLoggerOptions(
  service: string,
  options: Omit<CreateLoggerOptions, "service"> = {}
) {
  return {
    logger: createLogger({ service, ...options }),
    quietReqLogger: true,
    genReqId(req: IncomingMessage, res: ServerResponse) {
      const requestId =
        normalizeHeaderValue(req.headers["x-request-id"]) ??
        normalizeHeaderValue(req.headers["x-correlation-id"]) ??
        randomUUID();

      res.setHeader("x-request-id", requestId);
      return requestId;
    },
    customLogLevel(
      _req: IncomingMessage,
      res: ServerResponse,
      error: Error | undefined
    ) {
      if (error || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    customReceivedMessage(req: IncomingMessage) {
      return `${req.method ?? "UNKNOWN"} ${req.url ?? ""} started`;
    },
    customSuccessMessage(req: IncomingMessage, res: ServerResponse) {
      return `${req.method ?? "UNKNOWN"} ${req.url ?? ""} completed with ${
        res.statusCode
      }`;
    },
    customErrorMessage(req: IncomingMessage, res: ServerResponse) {
      return `${req.method ?? "UNKNOWN"} ${req.url ?? ""} failed with ${
        res.statusCode
      }`;
    },
  };
}

export function redactValue(
  value: string | null | undefined,
  visibleStart = 6,
  visibleEnd = 4
): string | null {
  if (!value) return null;
  if (value.length <= visibleStart + visibleEnd) return "***";
  return `${value.slice(0, visibleStart)}...${value.slice(-visibleEnd)}`;
}

export function truncateForLog(value: string, maxLength = 500): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
