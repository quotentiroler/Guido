/**
 * Public exports for @guido/mcp-server
 * 
 * These are the types and utilities that can be imported by other packages,
 * particularly for sharing tool definitions with the AI assistant.
 */

import { z } from 'zod';
import { 
  RuleDomainSchema,
  RuleSchema,
  RuleUpdateSchema,
  FieldSchema,
  FieldValueSchema,
  FieldUpdateSchema,
} from '@guido/types/schemas';

// Re-export tool definitions
export { 
  toolDefinitions, 
  type ToolDef, 
  type InputDef, 
  type InputType,
  getToolDef,
  getToolsByCategory,
} from './tool-definitions.js';

// ============================================================================
// Input Type to Zod Schema Mapping
// ============================================================================

/**
 * Maps an InputType to its corresponding Zod schema
 */
export function inputTypeToZod(type: string, required: boolean): z.ZodType {
  let schema: z.ZodType;
  
  switch (type) {
    case 'string': schema = z.string(); break;
    case 'number': schema = z.number(); break;
    case 'boolean': schema = z.boolean(); break;
    case 'string[]': schema = z.array(z.string()); break;
    case 'number[]': schema = z.array(z.number()); break;
    case 'FieldValue': schema = FieldValueSchema; break;
    case 'RuleDomain': schema = RuleDomainSchema; break;
    case 'RuleDomain[]': schema = z.array(RuleDomainSchema); break;
    case 'Field': schema = FieldSchema; break;
    case 'FieldUpdate': schema = FieldUpdateSchema; break;
    case 'FieldUpdate[]': schema = z.array(FieldUpdateSchema); break;
    case 'Rule': schema = RuleSchema; break;
    case 'RuleUpdate': schema = RuleUpdateSchema; break;
    default: schema = z.unknown();
  }
  
  return required ? schema : schema.optional();
}

/**
 * Builds a Zod object schema from InputDef records
 */
export function buildInputSchema(inputs: Record<string, { type: string; required?: boolean; description: string }>): Record<string, z.ZodType> {
  const schema: Record<string, z.ZodType> = {};
  for (const [name, def] of Object.entries(inputs)) {
    schema[name] = inputTypeToZod(def.type, def.required ?? false).describe(def.description);
  }
  return schema;
}
