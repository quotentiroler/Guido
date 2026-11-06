/**
 * Analysis and discovery tools for templates
 */
import { z } from 'zod';
import { type ToolContext, textResult } from './types.js';
import { optBoolean, optNumber, optString, optStrings, reqString } from '../handlers/args.js';
import type { Field } from '@quotentiroler/guido-types';
import { translateRangeToHumanReadable, isFieldRequired } from '@quotentiroler/guido-core';


export function registerAnalysisTools({ server, store }: ToolContext) {
  // ============================================================================
  // GET REQUIRED FIELDS
  // ============================================================================
  server.registerTool(
    'get_required_fields',
    {
      title: 'Get Required Fields',
      description: 'List all unconditionally required fields (fields targeted by rules without conditions)',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
      },
    },
    async (args) => {
      const filePath = optString(args, 'filePath');
      const template = await store.load(store.resolveRef(filePath));
      const rules = template.ruleSets?.[0]?.rules ?? [];

      const requiredFields = template.fields
        .filter((field: Field) => isFieldRequired(field.name, rules))
        .map((field: Field) => ({
          name: field.name,
          value: field.value,
          checked: field.checked ?? false,
          info: field.info,
        }));

      return textResult({
        count: requiredFields.length,
        fields: requiredFields,
      });
    }
  );

  // ============================================================================
  // CHECK COMPLETENESS
  // ============================================================================
  server.registerTool(
    'check_completeness',
    {
      title: 'Check Template Completeness',
      description: 'Report incomplete fields (missing info, example, or range)',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        checkInfo: z.boolean().optional().describe('Check for missing info (default: true)'),
        checkExample: z.boolean().optional().describe('Check for missing example (default: true)'),
        checkRange: z.boolean().optional().describe('Check for missing range (default: true)'),
      },
    },
    async (args) => {
      const filePath = optString(args, 'filePath');
      const checkInfo = optBoolean(args, 'checkInfo') ?? true;
      const checkExample = optBoolean(args, 'checkExample') ?? true;
      const checkRange = optBoolean(args, 'checkRange') ?? true;

      const template = await store.load(store.resolveRef(filePath));

      const incompleteFields = template.fields
        .map((field: Field) => {
          const missing: string[] = [];
          if (checkInfo && (!field.info || field.info.trim() === '')) missing.push('info');
          if (checkExample && (!field.example || field.example.trim() === '')) missing.push('example');
          if (checkRange && (!field.range || field.range.trim() === '')) missing.push('range');
          return { name: field.name, missing };
        })
        .filter((f: { name: string; missing: string[] }) => f.missing.length > 0);

      const completeCount = template.fields.length - incompleteFields.length;
      const completenessPercent = Math.round((completeCount / template.fields.length) * 100);

      return textResult({
        totalFields: template.fields.length,
        completeFields: completeCount,
        incompleteFields: incompleteFields.length,
        completenessPercent,
        incomplete: incompleteFields,
      });
    }
  );

  // ============================================================================
  // SEARCH FIELDS
  // ============================================================================
  server.registerTool(
    'search_fields',
    {
      title: 'Search Fields',
      description: 'Full-text search across field names, info, and examples',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        query: z.string().describe('Search query (case-insensitive)'),
        searchIn: z.array(z.enum(['name', 'info', 'example', 'range', 'value']))
          .optional()
          .describe('Fields to search in (default: all)'),
        limit: z.number().optional().describe('Maximum results to return'),
      },
    },
    async (args) => {
      const filePath = optString(args, 'filePath');
      const query = reqString(args, 'query').toLowerCase();
      const searchIn = optStrings(args, 'searchIn') ?? ['name', 'info', 'example', 'range', 'value'];
      const limit = optNumber(args, 'limit');

      const template = await store.load(store.resolveRef(filePath));

      let results = template.fields
        .map((field: Field) => {
          const matches: string[] = [];
          const lowerQuery = query;

          if (searchIn.includes('name') && field.name.toLowerCase().includes(lowerQuery)) {
            matches.push('name');
          }
          if (searchIn.includes('info') && field.info?.toLowerCase().includes(lowerQuery)) {
            matches.push('info');
          }
          if (searchIn.includes('example') && field.example?.toLowerCase().includes(lowerQuery)) {
            matches.push('example');
          }
          if (searchIn.includes('range') && field.range?.toLowerCase().includes(lowerQuery)) {
            matches.push('range');
          }
          if (searchIn.includes('value') && String(field.value).toLowerCase().includes(lowerQuery)) {
            matches.push('value');
          }

          if (matches.length > 0) {
            return {
              name: field.name,
              value: field.value,
              info: field.info,
              checked: field.checked ?? false,
              matchedIn: matches,
            };
          }
          return null;
        })
        .filter((r: { name: string; value: unknown; info?: string; checked: boolean; matchedIn: string[] } | null): r is { name: string; value: unknown; info?: string; checked: boolean; matchedIn: string[] } => r !== null);

      if (limit && limit > 0) {
        results = results.slice(0, limit);
      }

      return textResult({
        query,
        resultCount: results.length,
        results,
      });
    }
  );

  // ============================================================================
  // SUGGEST FIELDS
  // ============================================================================
  server.registerTool(
    'suggest_fields',
    {
      title: 'Suggest Fields',
      description: 'Suggest fields based on partial input (autocomplete)',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        prefix: z.string().describe('Partial field name to complete'),
        limit: z.number().optional().describe('Maximum suggestions (default: 10)'),
        onlyUnchecked: z.boolean().optional().describe('Only suggest unchecked fields'),
      },
    },
    async (args) => {
      const filePath = optString(args, 'filePath');
      const prefix = reqString(args, 'prefix').toLowerCase();
      const limit = optNumber(args, 'limit') ?? 10;
      const onlyUnchecked = optBoolean(args, 'onlyUnchecked');

      const template = await store.load(store.resolveRef(filePath));

      const suggestions = template.fields
        .filter((field: Field) => {
          const matchesPrefix = field.name.toLowerCase().startsWith(prefix) ||
            field.name.toLowerCase().includes('.' + prefix);
          const checkFilter = onlyUnchecked ? !field.checked : true;
          return matchesPrefix && checkFilter;
        })
        .slice(0, limit)
        .map((field: Field) => ({
          name: field.name,
          value: field.value,
          info: field.info?.substring(0, 100) + (field.info && field.info.length > 100 ? '...' : ''),
          checked: field.checked ?? false,
          rangeHint: translateRangeToHumanReadable(field.range || ''),
        }));

      return textResult({
        prefix,
        count: suggestions.length,
        suggestions,
      });
    }
  );

  // ============================================================================
  // COMPARE TEMPLATES
  // ============================================================================
  server.registerTool(
    'compare_templates',
    {
      title: 'Compare Templates',
      description: 'Diff two templates - compare fields and rules',
      inputSchema: {
        filePath1: z.string().describe('Path to first template'),
        filePath2: z.string().describe('Path to second template'),
        compareFields: z.boolean().optional().describe('Compare fields (default: true)'),
        compareRules: z.boolean().optional().describe('Compare rules (default: true)'),
      },
    },
    async (args) => {
      const filePath1 = reqString(args, 'filePath1');
      const filePath2 = reqString(args, 'filePath2');
      const compareFields = optBoolean(args, 'compareFields') ?? true;
      const compareRules = optBoolean(args, 'compareRules') ?? true;

      const template1 = await store.load(store.resolveRef(filePath1));
      const template2 = await store.load(store.resolveRef(filePath2));

      const result: {
        template1: { name: string; fieldCount: number; ruleCount: number };
        template2: { name: string; fieldCount: number; ruleCount: number };
        fieldDiff?: {
          onlyIn1: string[];
          onlyIn2: string[];
          inBoth: number;
          valueDifferences: Array<{ name: string; value1: unknown; value2: unknown }>;
        };
        ruleDiff?: {
          rule1Count: number;
          rule2Count: number;
        };
      } = {
        template1: {
          name: template1.name || 'Template 1',
          fieldCount: template1.fields.length,
          ruleCount: template1.ruleSets?.[0]?.rules?.length ?? 0,
        },
        template2: {
          name: template2.name || 'Template 2',
          fieldCount: template2.fields.length,
          ruleCount: template2.ruleSets?.[0]?.rules?.length ?? 0,
        },
      };

      if (compareFields) {
        const fields1 = new Map<string, Field>(template1.fields.map((f: Field) => [f.name, f]));
        const fields2 = new Map<string, Field>(template2.fields.map((f: Field) => [f.name, f]));

        const onlyIn1: string[] = [...fields1.keys()].filter((name: string) => !fields2.has(name));
        const onlyIn2: string[] = [...fields2.keys()].filter((name: string) => !fields1.has(name));
        const inBoth: string[] = [...fields1.keys()].filter((name: string) => fields2.has(name));

        const valueDifferences: Array<{ name: string; value1: unknown; value2: unknown }> = inBoth
          .filter((name: string) => {
            const f1 = fields1.get(name)!;
            const f2 = fields2.get(name)!;
            return JSON.stringify(f1.value) !== JSON.stringify(f2.value);
          })
          .map((name: string) => ({
            name,
            value1: fields1.get(name)!.value,
            value2: fields2.get(name)!.value,
          }));

        result.fieldDiff = {
          onlyIn1,
          onlyIn2,
          inBoth: inBoth.length,
          valueDifferences,
        };
      }

      if (compareRules) {
        result.ruleDiff = {
          rule1Count: template1.ruleSets?.[0]?.rules?.length ?? 0,
          rule2Count: template2.ruleSets?.[0]?.rules?.length ?? 0,
        };
      }

      return textResult(result);
    }
  );
}
