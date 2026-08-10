/**
 * Storage ports for the Guido MCP server.
 *
 * Tools address templates through a `ref` (an opaque string) rather than a file
 * path, so the same tool implementation serves the stdio server (refs are
 * filesystem paths) and a hosted server (refs are tenant-scoped storage keys).
 */

import type { Template } from '@quotentiroler/guido-types';

export type ChangeType =
  | 'field_update'
  | 'field_add'
  | 'field_delete'
  | 'rule_add'
  | 'rule_update'
  | 'rule_delete'
  | 'import'
  | 'export';

export interface ChangeEntry {
  timestamp: string;
  type: ChangeType;
  details: Record<string, unknown>;
}

export interface TemplateSnapshot {
  loadedAt: string;
  template: Template;
}

export interface TemplateStore {
  /**
   * Canonicalize a caller-supplied ref, falling back to the active one.
   * Throws when neither is available.
   */
  resolveRef(ref?: string): string;
  /** The active ref, if one has been set. */
  activeRef(): string | undefined;
  /** Make `ref` the default for subsequent operations. */
  setActiveRef(ref: string): void;
  load(ref: string): Promise<Template>;
  save(ref: string, template: Template): Promise<void>;
  exists(ref: string): Promise<boolean>;
}

export interface ChangeTracker {
  record(ref: string, type: ChangeType, details: Record<string, unknown>): Promise<void>;
  changes(ref: string): Promise<ChangeEntry[]>;
  clear(ref: string): Promise<void>;
  snapshot(ref: string): Promise<TemplateSnapshot | undefined>;
  /** Record the template as first seen. Later calls for the same ref are ignored. */
  captureSnapshot(ref: string, template: Template): Promise<void>;
}

export class TemplateNotFoundError extends Error {
  constructor(public readonly ref: string) {
    super(`Template not found: ${ref}`);
    this.name = 'TemplateNotFoundError';
  }
}

export class NoTemplateRefError extends Error {
  constructor() {
    super(
      'No template ref provided. Use set_template, create_template, or pass filePath on the tool call.'
    );
    this.name = 'NoTemplateRefError';
  }
}

/**
 * Ensure a template has at least one ruleSet. The old top-level `rules` array
 * format is no longer supported.
 */
export function ensureRuleSets(template: Template): Template {
  if (template.ruleSets && template.ruleSets.length > 0) {
    return template;
  }
  return {
    ...template,
    ruleSets: [{ name: 'Default', description: 'Default rule set', tags: [], rules: [] }],
  };
}
