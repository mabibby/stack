import pino from "pino";
import { env, isDev } from "@/lib/env";

/**
 * Structured logger. Use `logger.info({ ...context }, "event.name")` — a short
 * dotted event name plus context fields, never string interpolation.
 * Pretty-printed in development, JSON in production (Railway parses it).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }
    : {}),
});

export type Logger = typeof logger;
