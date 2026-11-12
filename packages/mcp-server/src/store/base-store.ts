import type { Template } from '@quotentiroler/guido-types';
import {
  ensureRuleSets,
  NoTemplateRefError,
  TemplateNotFoundError,
  type ChangeTracker,
  type TemplateStore,
} from './types.js';

export abstract class BaseTemplateStore implements TemplateStore {
  private active: string | undefined;

  protected constructor(protected readonly tracker?: ChangeTracker) {}

  protected canonical(ref: string): string {
    return ref;
  }

  protected abstract read(ref: string): Promise<Template | undefined>;

  abstract save(ref: string, template: Template): Promise<void>;

  abstract exists(ref: string): Promise<boolean>;

  resolveRef(ref?: string): string {
    const resolved = ref ?? this.active;
    if (!resolved) throw new NoTemplateRefError();
    return this.canonical(resolved);
  }

  activeRef(): string | undefined {
    return this.active;
  }

  setActiveRef(ref: string): void {
    this.active = this.canonical(ref);
  }

  async load(ref: string): Promise<Template> {
    const key = this.canonical(ref);
    const stored = await this.read(key);
    if (!stored) throw new TemplateNotFoundError(key);

    const template = ensureRuleSets(stored);
    await this.tracker?.captureSnapshot(key, template);
    return template;
  }
}
