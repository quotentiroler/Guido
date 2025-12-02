/* eslint-disable no-console */
/**
 * @guido/logger - Logging utilities for Guido packages
 * 
 * Provides structured logging with different levels and field change tracking.
 */

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  enabled?: boolean;
  prefix?: string;
  showTimestamp?: boolean;
}

/**
 * What triggered a rule application or field change
 */
export interface TriggerAction {
  type: 'field_check' | 'field_uncheck' | 'field_value_change' | 'check_all' | 'uncheck_all' | 'import' | 'template_load' | 'rules_changed' | 'ai_change';
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  /** For AI changes, optionally include the tool name */
  aiTool?: string;
}

/**
 * Actions that can be undone (user-initiated field changes, including AI changes)
 */
export const UNDOABLE_ACTIONS: TriggerAction['type'][] = [
  'field_check',
  'field_uncheck', 
  'field_value_change',
  'check_all',
  'uncheck_all',
  'ai_change'
];

/**
 * Represents a change to a field
 */
export interface FieldChange {
  fieldName: string;
  property: 'checked' | 'value';
  oldValue: unknown;
  newValue: unknown;
  reason: string;
}

/**
 * Callback type for receiving field changes
 */
export type HistoryCallback = (trigger: TriggerAction, changes: FieldChange[]) => void;

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Logger interface that can be implemented for different environments
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  group(label: string): void;
  groupCollapsed(label: string): void;
  groupEnd(): void;
  table(data: unknown): void;
  logFieldChanges(changes: FieldChange[], trigger?: TriggerAction): void;
  logRuleEvaluation(ruleName: string, conditionsMet: boolean, conditions: unknown[]): void;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  onFieldChanges(callback: HistoryCallback | null): void;
  setTrigger(trigger: TriggerAction): void;
  getTrigger(): TriggerAction;
  resetTrigger(): void;
}

/**
 * Default logger implementation using console
 */
export class Logger implements ILogger {
  private enabled: boolean;
  private prefix: string;
  private showTimestamp: boolean;
  private historyCallback: HistoryCallback | null = null;
  private currentTrigger: TriggerAction = { type: 'rules_changed' };

  constructor(options: LoggerOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.prefix = options.prefix ?? '[Guido]';
    this.showTimestamp = options.showTimestamp ?? true;
  }

  private getTimestamp(): string {
    return new Date().toISOString().split('T')[1].slice(0, -1);
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = this.showTimestamp ? `[${this.getTimestamp()}]` : '';
    return `${this.prefix}${timestamp}[${level.toUpperCase()}] ${message}`;
  }

  onFieldChanges(callback: HistoryCallback | null): void {
    this.historyCallback = callback;
  }

  setTrigger(trigger: TriggerAction): void {
    this.currentTrigger = trigger;
  }

  getTrigger(): TriggerAction {
    return this.currentTrigger;
  }

  resetTrigger(): void {
    this.currentTrigger = { type: 'rules_changed' };
  }

  debug(message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    console.debug(this.formatMessage('debug', message), ...args);
  }

  info(message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    console.info(this.formatMessage('info', message), ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    console.warn(this.formatMessage('warn', message), ...args);
  }

  error(message: string, ...args: unknown[]): void {
    if (!this.enabled) return;
    console.error(this.formatMessage('error', message), ...args);
  }

  group(label: string): void {
    if (!this.enabled) return;
    console.group(this.formatMessage('info', label));
  }

  groupCollapsed(label: string): void {
    if (!this.enabled) return;
    console.groupCollapsed(this.formatMessage('info', label));
  }

  groupEnd(): void {
    if (!this.enabled) return;
    console.groupEnd();
  }

  table(data: unknown): void {
    if (!this.enabled) return;
    console.table(data);
  }

  logFieldChanges(changes: FieldChange[], trigger?: TriggerAction): void {
    const effectiveTrigger = trigger || this.currentTrigger;
    
    // Always notify UI callback if registered
    if (this.historyCallback && changes.length > 0) {
      this.historyCallback(effectiveTrigger, changes);
    }

    if (!this.enabled || changes.length === 0) return;

    this.info(`applyRules [${effectiveTrigger.type}${effectiveTrigger.fieldName ? `: ${effectiveTrigger.fieldName}` : ''}]: ${changes.length} field(s) modified`);
  }

  logRuleEvaluation(ruleName: string, conditionsMet: boolean, _conditions: unknown[]): void {
    // Skip logging - rule evaluation is too noisy
    void ruleName;
    void conditionsMet;
    void _conditions;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * Silent logger that does nothing - useful for testing or production
 */
export class SilentLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
  group(): void {}
  groupCollapsed(): void {}
  groupEnd(): void {}
  table(): void {}
  logFieldChanges(): void {}
  logRuleEvaluation(): void {}
  setEnabled(): void {}
  isEnabled(): boolean { return false; }
  onFieldChanges(): void {}
  setTrigger(): void {}
  getTrigger(): TriggerAction { return { type: 'rules_changed' }; }
  resetTrigger(): void {}
}

// ============================================================================
// Default Instance
// ============================================================================

/**
 * Default logger instance - disabled by default, enable in dev mode
 */
export const logger = new Logger({ enabled: false });

/**
 * Create a new logger with custom options
 */
export function createLogger(options: LoggerOptions = {}): ILogger {
  return new Logger(options);
}
