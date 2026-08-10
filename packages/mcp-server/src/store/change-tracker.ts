/**
 * @guido/mcp-server - In-process change tracking.
 *
 * Suitable for the stdio server, where one process serves one user. A hosted
 * server needs a tenant-scoped implementation of the same port, because module
 * state on a Worker is per-isolate and shared across requests.
 */

import type { Template } from '@guido/types';
import type { ChangeEntry, ChangeTracker, ChangeType, TemplateSnapshot } from './types.js';

const deepCopy = (template: Template): Template => JSON.parse(JSON.stringify(template)) as Template;

export class InMemoryChangeTracker implements ChangeTracker {
  private readonly log = new Map<string, ChangeEntry[]>();
  private readonly snapshots = new Map<string, TemplateSnapshot>();

  record(ref: string, type: ChangeType, details: Record<string, unknown>): Promise<void> {
    const entries = this.log.get(ref) ?? [];
    entries.push({ timestamp: new Date().toISOString(), type, details });
    this.log.set(ref, entries);
    return Promise.resolve();
  }

  changes(ref: string): Promise<ChangeEntry[]> {
    return Promise.resolve(this.log.get(ref) ?? []);
  }

  clear(ref: string): Promise<void> {
    this.log.delete(ref);
    return Promise.resolve();
  }

  snapshot(ref: string): Promise<TemplateSnapshot | undefined> {
    return Promise.resolve(this.snapshots.get(ref));
  }

  captureSnapshot(ref: string, template: Template): Promise<void> {
    if (!this.snapshots.has(ref)) {
      this.snapshots.set(ref, { loadedAt: new Date().toISOString(), template: deepCopy(template) });
    }
    return Promise.resolve();
  }
}
