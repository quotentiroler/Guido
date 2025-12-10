import { describe, it, expect } from 'vitest';
import { validateRules } from '@guido/core';
import { RuleState, Rule } from '@guido/types';

describe('validateRules', () => {
  describe('Basic validation', () => {
    it('should pass with no rules', () => {
      const result = validateRules([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with valid simple rule', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repository', state: RuleState.Set }],
          targets: [{ name: 'ConnectionString', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Contains state validation', () => {
    it('should handle contains state correctly', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'InformationModel.IncludeFhirVersion', state: RuleState.Contains, value: 'Fhir5.0' }],
          targets: [{ name: 'Validation.AllowedProfiles', state: RuleState.Contains, value: 'http://example.com' }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });

    it('should allow multiple contains values (they are additive)', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Field1', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value1' }],
        },
        {
          conditions: [{ name: 'Field1', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value2' }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true); // Contains values are additive, not contradictory
    });

    it('should allow same contains value under same conditions', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Field1', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value1' }],
        },
        {
          conditions: [{ name: 'Field1', state: RuleState.Set }],
          targets: [{ name: 'ArrayField', state: RuleState.Contains, value: 'value1' }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true); // No errors, just a merge suggestion
      expect(result.warnings?.some(e => e.includes('can be merged'))).toBe(true);
    });
  });

  describe('not-flag validation', () => {
    it('should detect not-flag contradiction', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.Set, not: false }],
        },
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.Set, not: true }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot be both required'))).toBe(true);
    });

    it('should allow same not-flag under same conditions', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.Set, not: false }],
        },
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field2', state: RuleState.Set, not: false }],
        },
      ];
      const result = validateRules(rules);
      // These are two different fields (Field1 and Field2), valid but should suggest merge
      expect(result.isValid).toBe(true);
      expect(result.warnings?.some(e => e.includes('can be merged'))).toBe(true);
      expect(result.errors.some(e => e.includes('Contradiction'))).toBe(false);
    });
  });

  describe('State contradiction detection', () => {
    it('should detect conflicting states for same field', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.SetToValue, value: 'test' }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('conflicting states'))).toBe(true);
    });

    it('should allow different states for different fields', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [
            { name: 'Field1', state: RuleState.Set },
            { name: 'Field2', state: RuleState.SetToValue, value: 'test' },
          ],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Internal rule contradiction detection', () => {
    it('should detect duplicate conditions with different states', () => {
      const rules: Rule[] = [
        {
          conditions: [
            { name: 'Field1', state: RuleState.Set },
            { name: 'Field1', state: RuleState.SetToValue, value: 'test' },
          ],
          targets: [{ name: 'Target', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Contradiction detected in rule'))).toBe(true);
    });

    it('should detect duplicate targets with different states', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition', state: RuleState.Set }],
          targets: [
            { name: 'Field1', state: RuleState.Set },
            { name: 'Field1', state: RuleState.SetToValue, value: 'test' },
          ],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Contradiction detected in rule'))).toBe(true);
    });
  });

  describe('Circular dependency detection', () => {
    it('should detect simple circular dependency', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'A', state: RuleState.Set }],
          targets: [{ name: 'B', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'B', state: RuleState.Set }],
          targets: [{ name: 'A', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular dependency'))).toBe(true);
    });

    it('should detect complex circular dependency', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'A', state: RuleState.Set }],
          targets: [{ name: 'B', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'B', state: RuleState.Set }],
          targets: [{ name: 'C', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'C', state: RuleState.Set }],
          targets: [{ name: 'A', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Circular dependency'))).toBe(true);
    });

    it('should not flag non-circular dependencies', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'A', state: RuleState.Set }],
          targets: [{ name: 'B', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'B', state: RuleState.Set }],
          targets: [{ name: 'C', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Merge suggestions', () => {
    it('should suggest merging rules with identical conditions', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.SetToValue, value: 'SQLite' }],
          targets: [{ name: 'Field1', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'Repo', state: RuleState.SetToValue, value: 'SQLite' }],
          targets: [{ name: 'Field2', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.warnings?.some(e => e.includes('can be merged'))).toBe(true);
    });

    it('should suggest merging rules with no conditions', () => {
      const rules: Rule[] = [
        {
          conditions: [],
          targets: [{ name: 'Field1', state: RuleState.Set }],
        },
        {
          conditions: [],
          targets: [{ name: 'Field2', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.warnings?.some(e => e.includes('can be merged'))).toBe(true);
    });

    it('should NOT suggest merging rules with contradictory targets', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'Repo', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.SetToValue, value: 'test' }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      // Should have contradiction error, not merge suggestion
      expect(result.errors.some(e => e.includes('conflicting states'))).toBe(true);
      expect(result.errors.some(e => e.includes('can be merged'))).toBe(false);
    });

    it('should NOT suggest merging rules with different condition values', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.SetToValue, value: 'SQLite' }],
          targets: [{ name: 'Field1', state: RuleState.Set }],
        },
        {
          conditions: [{ name: 'Repo', state: RuleState.SetToValue, value: 'MongoDB' }],
          targets: [{ name: 'Field1', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.errors.some(e => e.includes('can be merged'))).toBe(false);
    });
  });

  describe('Value-aware validation for set_to_value', () => {
    it('should detect value contradiction for set_to_value', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Condition1', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.SetToValue, value: 'value1' }],
        },
        {
          conditions: [{ name: 'Condition1', state: RuleState.Set }],
          targets: [{ name: 'Field1', state: RuleState.SetToValue, value: 'value2' }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('conflicting values'))).toBe(true);
    });

    it('should allow same set_to_value under different conditions', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Repo', state: RuleState.SetToValue, value: 'SQLite' }],
          targets: [{ name: 'Port', state: RuleState.SetToValue, value: '4080' }],
        },
        {
          conditions: [{ name: 'Repo', state: RuleState.SetToValue, value: 'MongoDB' }],
          targets: [{ name: 'Port', state: RuleState.SetToValue, value: '4080' }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle rules with undefined not flag', () => {
      const rules: Rule[] = [
        {
          conditions: [{ name: 'Field1', state: RuleState.Set }],
          targets: [{ name: 'Field2', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });

    it('should handle empty conditions array', () => {
      const rules: Rule[] = [
        {
          conditions: [],
          targets: [{ name: 'Field1', state: RuleState.Set }],
        },
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });

    it('should handle undefined conditions', () => {
      const rules: Rule[] = [
        {
          targets: [{ name: 'Field1', state: RuleState.Set }],
        } as Rule,
      ];
      const result = validateRules(rules);
      expect(result.isValid).toBe(true);
    });
  });
});
