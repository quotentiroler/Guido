/**
 * @guido/mcp-server - In-memory template store.
 *
 * Backs stateless HTTP requests, where the caller passes a template in and gets
 * the modified one back, and serves as the test double for the port.
 */

import type { Template } from '@guido/types';
import {
  ensureRuleSets,
  NoTemplateRefError,
  TemplateNotFoundError,
  type ChangeTracker,
  type TemplateStore,
} from './types.js';

const deepCopy = (template: Template): Template => JSON.parse(JSON.stringify(template)) as Template;

export class MemoryTemplateStore implements TemplateStore {
  private readonly templates = new Map<string, Template>();
  private active: string | undefined;

  constructor(
    seed: Record<string, Template> = {},
    private readonly tracker?: ChangeTracker
  ) {
    for (const [ref, template] of Object.entries(seed)) {
      this.templates.set(ref, deepCopy(template));
    }
  }

  resolveRef(ref?: string): string {
    const resolved = ref ?? this.active;
    if (!resolved) throw new NoTemplateRefError();
    return resolved;
  }

  activeRef(): string | undefined {
    return this.active;
  }

  setActiveRef(ref: string): void {
    this.active = ref;
  }

  async load(ref: string): Promise<Template> {
    const stored = this.templates.get(ref);
    if (!stored) throw new TemplateNotFoundError(ref);

    const template = ensureRuleSets(deepCopy(stored));
    await this.tracker?.captureSnapshot(ref, template);
    return template;
  }

  save(ref: string, template: Template): Promise<void> {
    this.templates.set(ref, deepCopy(template));
    return Promise.resolve();
  }

  exists(ref: string): Promise<boolean> {
    return Promise.resolve(this.templates.has(ref));
  }

  /** Everything held, for handing state back to a stateless caller. */
  entries(): Record<string, Template> {
    return Object.fromEntries([...this.templates].map(([ref, t]) => [ref, deepCopy(t)]));
  }
}
