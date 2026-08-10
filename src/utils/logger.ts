/**
 * Logger utility for the GUI
 * 
 * Re-exports from @quotentiroler/guido-logger with development mode enabled by default.
 */

// Re-export all types and classes from @quotentiroler/guido-logger
export {
  type LogLevel,
  type LoggerOptions,
  type TriggerAction,
  type FieldChange,
  type HistoryCallback,
  type ILogger,
  Logger,
  SilentLogger,
  UNDOABLE_ACTIONS,
  createLogger,
} from '@quotentiroler/guido-logger';

// Import the Logger class to create a dev-enabled instance
import { Logger } from '@quotentiroler/guido-logger';

// Check if we're in development mode
const isDev = typeof import.meta !== 'undefined' && 
  'env' in import.meta && 
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

// Create and export a logger instance with dev mode enabled
export const logger = new Logger({ 
  enabled: isDev,
  prefix: '[Guido]',
  showTimestamp: true,
});
