import type { Field, Rule } from "@quotentiroler/guido-types";
import { applyRules as coreApplyRules, type ApplyRulesResult } from '@quotentiroler/guido-core';
import type { TriggerAction } from '@quotentiroler/guido-logger';
import { logger } from "./logger";

export const applyRules = (
  fields: Field[],
  rules: Rule[] = [],
  trigger?: TriggerAction,
  originalFields?: Field[]
): ApplyRulesResult => coreApplyRules(fields, rules, { logger, trigger, originalFields });
