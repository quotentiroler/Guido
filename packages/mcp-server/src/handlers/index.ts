import { templateHandlers } from './template.js';
import { fieldHandlers } from './fields.js';
import { ruleHandlers } from './rules.js';
import { ruleSetHandlers } from './rulesets.js';
import { validationHandlers } from './validation.js';
import type { ToolHandler } from './types.js';

export type { HandlerContext, ToolHandler } from './types.js';
export type { ToolArgs } from './args.js';

export const templateToolHandlers: Record<string, ToolHandler> = {
  ...templateHandlers,
  ...fieldHandlers,
  ...ruleHandlers,
  ...ruleSetHandlers,
  ...validationHandlers,
};
