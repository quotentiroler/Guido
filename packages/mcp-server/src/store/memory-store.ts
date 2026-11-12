/**
 * @quotentiroler/guido-mcp-server - In-memory template store.
 *
 * Backs stateless HTTP requests, where the caller passes a template in and gets
 * the modified one back, and serves as the test double for the port.
 */

import type { Template } from '@quotentiroler/guido-types';
import { BaseTemplateStore } from './base-store.js';
import type { ChangeTracker } from './types.js';

export class MemoryTemplateStore extends BaseTemplateStore {
  private readonly templates = new Map<string, Template>();

  constructor(seed: Record<string, Template> = {}, tracker?: ChangeTracker) {
    super(tracker);
    for (const [ref, template] of Object.entries(seed)) {
      this.templates.set(ref, structuredClone(template));
    }
  }

  protected read(ref: string): Promise<Template | undefined> {
    const stored = this.templates.get(ref);
    return Promise.resolve(stored && structuredClone(stored));
  }

  save(ref: string, template: Template): Promise<void> {
    this.templates.set(ref, structuredClone(template));
    return Promise.resolve();
  }

  exists(ref: string): Promise<boolean> {
    return Promise.resolve(this.templates.has(ref));
  }

  /** Everything held, for handing state back to a stateless caller. */
  entries(): Record<string, Template> {
    return Object.fromEntries([...this.templates].map(([ref, t]) => [ref, structuredClone(t)]));
  }
}
