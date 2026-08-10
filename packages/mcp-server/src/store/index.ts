/**
 * @guido/mcp-server - Storage ports and adapters
 */

export {
  ensureRuleSets,
  NoTemplateRefError,
  TemplateNotFoundError,
} from './types.js';
export type {
  ChangeEntry,
  ChangeTracker,
  ChangeType,
  TemplateSnapshot,
  TemplateStore,
} from './types.js';

export { InMemoryChangeTracker } from './change-tracker.js';
export { MemoryTemplateStore } from './memory-store.js';
export { FsTemplateStore } from './fs-store.js';
