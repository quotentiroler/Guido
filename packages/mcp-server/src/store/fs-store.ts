/**
 * @quotentiroler/guido-mcp-server - Filesystem template store.
 *
 * The stdio adapter: refs are file paths, canonicalized to absolute so the same
 * template reached by two relative paths is one entry.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Template } from '@quotentiroler/guido-types';
import {
  ensureRuleSets,
  NoTemplateRefError,
  TemplateNotFoundError,
  type ChangeTracker,
  type TemplateStore,
} from './types.js';

export class FsTemplateStore implements TemplateStore {
  private active: string | undefined;

  constructor(
    activeRef?: string,
    private readonly tracker?: ChangeTracker
  ) {
    if (activeRef) this.active = path.resolve(activeRef);
  }

  resolveRef(ref?: string): string {
    const resolved = ref ?? this.active;
    if (!resolved) throw new NoTemplateRefError();
    return path.resolve(resolved);
  }

  activeRef(): string | undefined {
    return this.active;
  }

  setActiveRef(ref: string): void {
    this.active = path.resolve(ref);
  }

  async load(ref: string): Promise<Template> {
    const absolute = path.resolve(ref);
    if (!fs.existsSync(absolute)) throw new TemplateNotFoundError(absolute);

    const raw = JSON.parse(await fs.promises.readFile(absolute, 'utf-8')) as Template;
    const template = ensureRuleSets(raw);
    await this.tracker?.captureSnapshot(absolute, template);
    return template;
  }

  async save(ref: string, template: Template): Promise<void> {
    await fs.promises.writeFile(path.resolve(ref), JSON.stringify(template, null, 2), 'utf-8');
  }

  exists(ref: string): Promise<boolean> {
    return Promise.resolve(fs.existsSync(path.resolve(ref)));
  }
}
