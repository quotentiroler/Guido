/**
 * @quotentiroler/guido-mcp-server - Filesystem template store.
 *
 * The stdio adapter: refs are file paths, canonicalized to absolute so the same
 * template reached by two relative paths is one entry.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Template } from '@quotentiroler/guido-types';
import { parseTemplate } from '@quotentiroler/guido-types/schemas';
import { BaseTemplateStore } from './base-store.js';
import type { ChangeTracker } from './types.js';

export class FsTemplateStore extends BaseTemplateStore {
  constructor(activeRef?: string, tracker?: ChangeTracker) {
    super(tracker);
    if (activeRef) this.setActiveRef(activeRef);
  }

  protected override canonical(ref: string): string {
    return path.resolve(ref);
  }

  protected async read(ref: string): Promise<Template | undefined> {
    if (!fs.existsSync(ref)) return undefined;
    return parseTemplate(JSON.parse(await fs.promises.readFile(ref, 'utf-8')), ref);
  }

  async save(ref: string, template: Template): Promise<void> {
    await fs.promises.writeFile(this.canonical(ref), JSON.stringify(template, null, 2), 'utf-8');
  }

  exists(ref: string): Promise<boolean> {
    return Promise.resolve(fs.existsSync(this.canonical(ref)));
  }
}
