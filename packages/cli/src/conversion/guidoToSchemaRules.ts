import { RuleState, type Rule, type JSONSchema } from '@quotentiroler/guido-types';
import { getParentPath, getFieldName, navigateToPath } from './guidoToSchemaFields.js';

/**
 * Extract unconditionally required fields from Guido rules
 * These are rules with no conditions and a target with state: "set"
 */
export function extractRequiredFields(rules: Rule[]): Set<string> {
  const required = new Set<string>();
  
  for (const rule of rules) {
    // Only unconditional rules (no conditions or empty conditions)
    if (!rule.conditions || rule.conditions.length === 0) {
      for (const target of rule.targets) {
        // Target must be "set" state (meaning field must be filled)
        if (target.state === RuleState.Set && !target.not) {
          required.add(target.name);
        }
      }
    }
  }
  
  return required;
}

/**
 * Extract conditional rules that can be converted to dependentRequired
 * Pattern: if fieldA is set → fieldB is required
 */
export function extractDependentRequired(rules: Rule[]): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  
  for (const rule of rules) {
    // Must have exactly one condition with state "set" and no negation
    if (rule.conditions?.length === 1) {
      const cond = rule.conditions[0];
      if (cond.state === RuleState.Set && !cond.not && !cond.value) {
        // Collect all targets that are "set" requirements
        for (const target of rule.targets) {
          if (target.state === RuleState.Set && !target.not) {
            // Get the parent path for both condition and target
            const condParent = getParentPath(cond.name);
            const targetParent = getParentPath(target.name);
            
            // dependentRequired only works within the same object level
            if (condParent === targetParent) {
              // Note: condField and targetField would be used for nested object support
              // const condField = getFieldName(cond.name);
              // const targetField = getFieldName(target.name);
              
              if (!deps.has(cond.name)) {
                deps.set(cond.name, new Set());
              }
              deps.get(cond.name)!.add(target.name);
            }
          }
        }
      }
    }
  }
  
  return deps;
}

/**
 * Conditional rules that need if/then (Guido has no else); multiple conditions are AND-chained.
 */
export function extractIfThen(rules: Rule[]): Array<{
  conditions: Array<{ field: string; value: string; state: RuleState }>;
  requiredFields: string[];
  parentPath: string;
}> {
  const conditionals: Array<{
    conditions: Array<{ field: string; value: string; state: RuleState }>;
    requiredFields: string[];
    parentPath: string;
  }> = [];
  
  for (const rule of rules) {
    // Must have at least one condition with state "set_to_value"
    if (rule.conditions && rule.conditions.length > 0) {
      // Conditions convertible to a JSON Schema `if` clause: an exact value, a numeric
      // comparison, or array membership. All must carry a value and not be negated.
      const validConditions = rule.conditions.filter(
        // Cross-field conditions (valueField) cannot be expressed in JSON Schema, so skip them.
        c => CONVERTIBLE_CONDITION_STATES.has(c.state) && c.value && !c.not && !c.valueField
      );
      
      if (validConditions.length === rule.conditions.length && validConditions.length > 0) {
        // All conditions must be at the same parent level
        const firstParent = getParentPath(validConditions[0].name);
        const allSameParent = validConditions.every(
          c => getParentPath(c.name) === firstParent
        );
        
        if (allSameParent) {
          const requiredFields: string[] = [];
          
          // Collect all targets that are "set" requirements at the same level
          for (const target of rule.targets) {
            if (target.state === RuleState.Set && !target.not) {
              const targetParent = getParentPath(target.name);
              if (targetParent === firstParent) {
                requiredFields.push(getFieldName(target.name));
              }
            }
          }
          
          if (requiredFields.length > 0) {
            conditionals.push({
              conditions: validConditions.map(c => ({
                field: getFieldName(c.name),
                value: c.value!,
                state: c.state,
              })),
              requiredFields,
              parentPath: firstParent,
            });
          }
        }
      }
    }
  }
  
  return conditionals;
}

/**
 * Extract const rules - fields that must have a specific value
 * Pattern: fieldA must be set to "value" (unconditional)
 */
export function extractConstFields(rules: Rule[]): Map<string, string> {
  const consts = new Map<string, string>();
  
  for (const rule of rules) {
    // Only unconditional rules
    if (!rule.conditions || rule.conditions.length === 0) {
      for (const target of rule.targets) {
        if (target.state === RuleState.SetToValue && target.value && !target.not) {
          consts.set(target.name, target.value);
        }
      }
    }
  }
  
  return consts;
}

/**
 * Apply dependentRequired to the schema at the correct nesting level
 */
export function applyDependentRequired(
  schema: JSONSchema, 
  deps: Map<string, Set<string>>
): void {
  // Group by parent path
  const depsByParent = new Map<string, Map<string, string[]>>();
  
  for (const [triggerPath, requiredPaths] of deps) {
    const parentPath = getParentPath(triggerPath);
    const triggerField = getFieldName(triggerPath);
    
    if (!depsByParent.has(parentPath)) {
      depsByParent.set(parentPath, new Map());
    }
    
    const requiredFields = Array.from(requiredPaths).map(getFieldName);
    depsByParent.get(parentPath)!.set(triggerField, requiredFields);
  }
  
  // Apply at each level
  for (const [parentPath, fieldDeps] of depsByParent) {
    const target = navigateToPath(schema, parentPath);
    if (target) {
      if (!target.dependentRequired) {
        target.dependentRequired = {};
      }
      for (const [trigger, required] of fieldDeps) {
        target.dependentRequired[trigger] = required;
      }
    }
  }
}

/** Rule condition states that translate to a JSON Schema `if` clause keyword. */
const CONVERTIBLE_CONDITION_STATES = new Set<RuleState>([
  RuleState.SetToValue,
  RuleState.GreaterThan,
  RuleState.LessThan,
  RuleState.GreaterOrEqual,
  RuleState.LessOrEqual,
  RuleState.Contains,
]);

/** Condition predicate → `if` keyword: value → const, comparisons → minimum/maximum, membership → contains. */
function conditionPredicateToSchema(state: RuleState, value: string): JSONSchema {
  switch (state) {
    case RuleState.GreaterThan: return { exclusiveMinimum: Number(value) };
    case RuleState.LessThan: return { exclusiveMaximum: Number(value) };
    case RuleState.GreaterOrEqual: return { minimum: Number(value) };
    case RuleState.LessOrEqual: return { maximum: Number(value) };
    case RuleState.Contains: return { contains: { const: value } };
    default: return { const: value };
  }
}

/**
 * Apply if/then conditionals to the schema (no else - Guido doesn't support it)
 * Multiple conditions in the same rule are AND-chained using allOf in the if clause
 */
export function applyIfThen(
  schema: JSONSchema,
  conditionals: Array<{
    conditions: Array<{ field: string; value: string; state: RuleState }>;
    requiredFields: string[];
    parentPath: string;
  }>
): void {
  // Group by parent path
  const condsByParent = new Map<string, Array<{
    conditions: Array<{ field: string; value: string; state: RuleState }>;
    requiredFields: string[];
  }>>();
  
  for (const cond of conditionals) {
    if (!condsByParent.has(cond.parentPath)) {
      condsByParent.set(cond.parentPath, []);
    }
    condsByParent.get(cond.parentPath)!.push({
      conditions: cond.conditions,
      requiredFields: cond.requiredFields,
    });
  }
  
  // Apply at each level using allOf to combine multiple if/then rules
  for (const [parentPath, conds] of condsByParent) {
    const target = navigateToPath(schema, parentPath);
    if (target) {
      if (!target.allOf) {
        target.allOf = [];
      }
      
      for (const cond of conds) {
        // Build the if clause - AND-chain multiple conditions using allOf
        let ifClause: JSONSchema;
        
        if (cond.conditions.length === 1) {
          // Single condition - simple if
          ifClause = {
            properties: {
              [cond.conditions[0].field]: conditionPredicateToSchema(cond.conditions[0].state, cond.conditions[0].value)
            }
          };
        } else {
          // Multiple conditions - AND-chain with allOf inside if
          ifClause = {
            allOf: cond.conditions.map(c => ({
              properties: {
                [c.field]: conditionPredicateToSchema(c.state, c.value)
              }
            }))
          };
        }
        
        target.allOf.push({
          if: ifClause,
          then: {
            required: cond.requiredFields
          }
          // Note: no else - Guido doesn't support else clauses
        });
      }
    }
  }
}

/**
 * Apply const values to the schema
 */
export function applyConstFields(
  schema: JSONSchema,
  consts: Map<string, string>
): void {
  for (const [fieldPath, constValue] of consts) {
    const parentPath = getParentPath(fieldPath);
    const fieldName = getFieldName(fieldPath);
    const target = navigateToPath(schema, parentPath);
    
    if (target?.properties?.[fieldName]) {
      target.properties[fieldName].const = constValue;
      // Remove default if const is set
      delete target.properties[fieldName].default;
    }
  }
}

/**
 * Apply required fields to the schema at the correct nesting level
 */
export function applyRequiredFields(schema: JSONSchema, requiredFields: Set<string>): void {
  // Group required fields by their parent path
  const requiredByParent = new Map<string, string[]>();
  
  for (const fieldPath of requiredFields) {
    const parts = fieldPath.split('.');
    const fieldName = parts.pop()!;
    const parentPath = parts.join('.');
    
    if (!requiredByParent.has(parentPath)) {
      requiredByParent.set(parentPath, []);
    }
    requiredByParent.get(parentPath)!.push(fieldName);
  }
  
  // Apply required arrays at each level
  for (const [parentPath, fieldNames] of requiredByParent) {
    const target = navigateToPath(schema, parentPath);
    if (target && target.properties) {
      // Only add fields that actually exist in the schema
      const validRequired = fieldNames.filter(name => target.properties![name]);
      if (validRequired.length > 0) {
        target.required = [...(target.required || []), ...validRequired];
      }
    }
  }
}
