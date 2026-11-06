import {
  type Explanation,
  explainField,
  resolveRuleSetRules,
  validateCardinality,
  validateRuleSetInheritance,
  validateRules,
  validateRulesAgainstFields,
  validateFieldSamples,
  validateValue,
} from '@quotentiroler/guido-core';
import type { ToolHandler } from './types.js';
import { FieldValueSchema, optArg, optBoolean, optNumber, reqString } from './args.js';
import { findField } from '../template-utils.js';

function renderExplanation(ex: Explanation, depth = 0): string {
  const pad = '  '.repeat(depth);
  if (ex.outcome === 'unconstrained') {
    return `${pad}${ex.field}: no rule constrains this field (its value comes from the config as given).`;
  }
  const valueText = ex.value !== undefined ? ` ('${ex.value}')` : '';
  const lines = [`${pad}${ex.field} is ${ex.outcome}${valueText} because:`];
  for (const step of ex.because) {
    lines.push(`${pad}  - rule ${step.ruleIndex}: ${step.rule}`);
    for (const c of step.conditions) {
      if (c.satisfiedBy === 'rule' && c.chain) {
        lines.push(`${pad}    - ${c.text}, which is forced by a rule:`);
        lines.push(renderExplanation(c.chain, depth + 3));
      } else {
        lines.push(`${pad}    - ${c.text} (from the config)`);
      }
    }
  }
  return lines.join('\n');
}

export const validationHandlers: Record<string, ToolHandler> = {
  validate_rules: (args, template) => {
    const ruleSetIndex = optNumber(args, 'ruleSetIndex');
    
    // First check for inheritance issues
    const inheritanceValidation = validateRuleSetInheritance(template);
    
    if (ruleSetIndex !== undefined) {
      const ruleSet = template.ruleSets?.[ruleSetIndex];
      if (!ruleSet) {
        throw new Error(`RuleSet at index ${ruleSetIndex} not found`);
      }
      // Validate with inherited rules included: logical consistency (contradictions,
      // cycles) AND schema consistency (a rule must not set/require a value the target
      // field's range forbids).
      const allRules = resolveRuleSetRules(template, ruleSetIndex);
      const validation = validateRules(allRules);
      const schema = validateRulesAgainstFields(allRules, template.fields);
      const cardinality = validateCardinality(ruleSet.constraints ?? [], template.fields);
      return {
        isValid: validation.isValid && schema.isValid && cardinality.isValid,
        errors: [...validation.errors, ...schema.errors, ...cardinality.errors],
        warnings: validation.warnings,
        ruleSet: ruleSet.name,
        extends: ruleSet.extends,
        ownRuleCount: ruleSet.rules?.length ?? 0,
        totalRuleCount: allRules.length,
        inheritanceErrors: inheritanceValidation.errors.filter(e => e.includes(ruleSet.name)),
      };
    }

    // Validate all rulesets with resolved (inherited) rules
    const results = template.ruleSets?.map((ruleSet, i) => {
      const allRules = resolveRuleSetRules(template, i);
      const validation = validateRules(allRules);
      const schema = validateRulesAgainstFields(allRules, template.fields);
      const cardinality = validateCardinality(ruleSet.constraints ?? [], template.fields);
      return {
        ruleSet: ruleSet.name,
        index: i,
        extends: ruleSet.extends,
        ownRuleCount: ruleSet.rules?.length ?? 0,
        totalRuleCount: allRules.length,
        isValid: validation.isValid && schema.isValid && cardinality.isValid,
        errors: [...validation.errors, ...schema.errors, ...cardinality.errors],
        warnings: validation.warnings,
      };
    });

    return {
      isValid: (results?.every(r => r.isValid) ?? true) && inheritanceValidation.isValid,
      inheritanceErrors: inheritanceValidation.errors,
      results,
    };
  },

  explain_field: (args, template) => {
    const fieldName = reqString(args, 'field');
    const ruleSetIndex = optNumber(args, 'ruleSetIndex') ?? 0;
    const rules = resolveRuleSetRules(template, ruleSetIndex);
    const explanation = explainField(fieldName, template.fields, rules);
    return {
      ...explanation,
      text: renderExplanation(explanation),
    };
  },

  validate_fields: (args, template) => {
    const onlyChecked = optBoolean(args, 'onlyChecked');
    
    let fields = template.fields;
    if (onlyChecked) {
      fields = fields.filter(f => f.checked === true);
    }

    const results = fields.map(field => {
      const isValid = validateValue(field.value, field.range);
      return {
        name: field.name,
        valid: isValid,
        value: field.value,
        range: field.range,
      };
    });

    return {
      valid: results.every(r => r.valid),
      invalidFields: results.filter(r => !r.valid),
      totalChecked: fields.length,
    };
  },

  validate_field: (args, template) => {
    const name = reqString(args, 'name');
    const providedValue = optArg(args, 'value', FieldValueSchema);

    const field = findField(template, name);
    if (!field) {
      throw new Error(`Field "${name}" not found`);
    }

    const valueToValidate = providedValue !== undefined ? providedValue : field.value;
    const isValid = validateValue(valueToValidate, field.range);

    return {
      name: field.name,
      valid: isValid,
      value: valueToValidate,
      range: field.range,
      currentValue: field.value,
      checked: field.checked ?? false,
    };
  },

  validate_template: (args, template) => {
    const issues: { type: 'error' | 'warning'; message: string }[] = [];

    // Check metadata
    if (!template.name) issues.push({ type: 'error', message: 'Missing template name' });
    if (!template.fileName) issues.push({ type: 'warning', message: 'Missing fileName' });
    if (!template.version) issues.push({ type: 'warning', message: 'Missing version' });

    // Check fields
    if (!template.fields || template.fields.length === 0) {
      issues.push({ type: 'warning', message: 'No fields defined' });
    } else {
      const fieldNames = new Set<string>();
      for (const field of template.fields) {
        if (!field.name) {
          issues.push({ type: 'error', message: 'Field with missing name' });
        } else if (fieldNames.has(field.name)) {
          issues.push({ type: 'error', message: `Duplicate field name: ${field.name}` });
        } else {
          fieldNames.add(field.name);
        }

        if (!field.info) {
          issues.push({ type: 'warning', message: `Field "${field.name}" missing info` });
        }
        if (!field.range) {
          issues.push({ type: 'warning', message: `Field "${field.name}" missing range` });
        }
      }
      for (const sample of validateFieldSamples(template.fields)) {
        issues.push({ type: 'error', message: sample.message });
      }
    }

    // Validate ruleset inheritance (check for circular extends)
    const inheritanceValidation = validateRuleSetInheritance(template);
    for (const error of inheritanceValidation.errors) {
      issues.push({ type: 'error', message: error });
    }

    // Validate rules - use resolved rules (including inherited) for each ruleset
    const ruleSetResults = template.ruleSets?.map((ruleSet, i) => {
      // Get all rules including inherited ones
      const allRules = resolveRuleSetRules(template, i);
      const validation = validateRules(allRules);
      return {
        index: i,
        name: ruleSet.name,
        extends: ruleSet.extends,
        ownRuleCount: ruleSet.rules?.length ?? 0,
        totalRuleCount: allRules.length,
        ...validation,
      };
    }) ?? [];

    for (const result of ruleSetResults) {
      for (const error of result.errors) {
        issues.push({ type: 'error', message: `RuleSet "${result.name}": ${error}` });
      }
      for (const warning of result.warnings) {
        issues.push({ type: 'warning', message: `RuleSet "${result.name}": ${warning}` });
      }
    }

    const errors = issues.filter(i => i.type === 'error');
    const warnings = issues.filter(i => i.type === 'warning');

    return {
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.map(e => e.message),
      warnings: warnings.map(w => w.message),
      summary: {
        name: template.name,
        version: template.version,
        fieldCount: template.fields?.length ?? 0,
        ruleSetCount: template.ruleSets?.length ?? 0,
        checkedFields: template.fields?.filter(f => f.checked).length ?? 0,
      },
      ruleSetDetails: ruleSetResults.map(r => ({
        name: r.name,
        extends: r.extends,
        ownRules: r.ownRuleCount,
        totalRules: r.totalRuleCount,
        isValid: r.isValid,
      })),
    };
  },
};
