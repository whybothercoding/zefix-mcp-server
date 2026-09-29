/**
 * @fileoverview Structured logging configuration using Pino.
 * All logs are routed to STDERR so STDOUT remains clean for MCP JSON-RPC.
 *
 * @module utils/logger
 */

import pino from 'pino';
import { config } from '../config.js';

/**
 * Singleton logger instance configured with Pino.
 *
 * - Development: pretty-printed, colorized logs via pino-pretty → STDERR
 * - Production: structured logs → STDERR
 * - Keeps MCP STDOUT free of human-readable logs so JSON-RPC framing is valid
 *
 * @type {pino.Logger}
 */
export const logger = process.env.NODE_ENV === 'development'
  ? pino({
      level: config.logging.level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
          destination: 2, // STDERR
        },
      },
    })
  : pino(
      { level: config.logging.level },
      pino.destination(2) // STDERR
    );
