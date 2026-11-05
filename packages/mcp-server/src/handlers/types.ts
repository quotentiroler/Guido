import type { Template } from '@quotentiroler/guido-types';
import type { ToolArgs } from './args.js';

export interface HandlerContext {
  filePath: string;
  save: () => void;
}

export type ToolHandler = (args: ToolArgs, template: Template, ctx: HandlerContext) => unknown;
