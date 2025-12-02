/* eslint-disable @typescript-eslint/require-await */
/**
 * Change tracking tools
 */
import { z } from 'zod';
import { ToolContext } from './types';
import { Field } from '@guido/types';
import { loadTemplate, getChanges, clearChanges, getSnapshot } from '../template-utils';

export function registerChangeTrackingTools({ server, getTemplatePath }: ToolContext) {
  // ============================================================================
  // GET CHANGE SUMMARY
  // ============================================================================
  server.registerTool(
    'get_change_summary',
    {
      title: 'Get Change Summary',
      description: 'Get a summary of all changes made since the template was loaded',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
        includeDetails: z.boolean().optional().describe('Include full change details (default: false)'),
      },
    },
    async (args) => {
      const filePath = args.filePath as string | undefined;
      const includeDetails = (args.includeDetails as boolean | undefined) ?? false;

      const tPath = getTemplatePath(filePath);
      const changes = getChanges(tPath);
      const snapshot = getSnapshot(tPath);
      const currentTemplate = loadTemplate(tPath);

      // Count changes by type
      const typeCounts: Record<string, number> = {};
      for (const change of changes) {
        typeCounts[change.type] = (typeCounts[change.type] || 0) + 1;
      }

      // Compare with snapshot if available
      let fieldsDiff: {
        added: number;
        removed: number;
        modified: number;
      } | undefined;

      if (snapshot) {
        const originalFields = new Map<string, Field>(snapshot.template.fields.map((f: Field) => [f.name, f]));
        const currentFields = new Map<string, Field>(currentTemplate.fields.map((f: Field) => [f.name, f]));

        const added = [...currentFields.keys()].filter(n => !originalFields.has(n)).length;
        const removed = [...originalFields.keys()].filter(n => !currentFields.has(n)).length;
        let modified = 0;

        for (const [name, field] of currentFields) {
          const original = originalFields.get(name);
          if (original && JSON.stringify(original) !== JSON.stringify(field)) {
            modified++;
          }
        }

        fieldsDiff = { added, removed, modified };
      }

      const result: Record<string, unknown> = {
        loadedAt: snapshot?.loadedAt,
        totalChanges: changes.length,
        changesByType: typeCounts,
        fieldsDiff,
      };

      if (includeDetails) {
        result.changes = changes;
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  // ============================================================================
  // CLEAR CHANGE LOG
  // ============================================================================
  server.registerTool(
    'clear_change_log',
    {
      title: 'Clear Change Log',
      description: 'Clear the change log for a template (resets tracking)',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
      },
    },
    async (args) => {
      const filePath = args.filePath as string | undefined;
      const tPath = getTemplatePath(filePath);
      
      const previousCount = getChanges(tPath).length;
      clearChanges(tPath);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            clearedEntries: previousCount,
          }, null, 2),
        }],
      };
    }
  );

  // ============================================================================
  // DIFF WITH SAVED
  // ============================================================================
  server.registerTool(
    'diff_with_saved',
    {
      title: 'Diff With Saved',
      description: 'Compare current state with the last saved version on disk',
      inputSchema: {
        filePath: z.string().optional().describe('Path to the guido.json template file'),
      },
    },
    async (args) => {
      const filePath = args.filePath as string | undefined;
      const tPath = getTemplatePath(filePath);
      
      const snapshot = getSnapshot(tPath);
      const current = loadTemplate(tPath);

      if (!snapshot) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              message: 'No snapshot available - template was just loaded',
              hasDifferences: false,
            }, null, 2),
          }],
        };
      }

      const originalFields = new Map<string, Field>(snapshot.template.fields.map((f: Field) => [f.name, f]));
      const currentFields = new Map<string, Field>(current.fields.map((f: Field) => [f.name, f]));

      const differences: Array<{
        field: string;
        type: 'added' | 'removed' | 'value_changed' | 'checked_changed';
        before?: unknown;
        after?: unknown;
      }> = [];

      // Check for added/modified fields
      for (const [name, field] of currentFields.entries()) {
        const original = originalFields.get(name);
        if (!original) {
          differences.push({ field: name, type: 'added', after: field.value });
        } else {
          if (JSON.stringify(original.value) !== JSON.stringify(field.value)) {
            differences.push({ field: name, type: 'value_changed', before: original.value, after: field.value });
          } else if (original.checked !== field.checked) {
            differences.push({ field: name, type: 'checked_changed', before: original.checked, after: field.checked });
          }
        }
      }

      // Check for removed fields
      for (const [name, originalField] of originalFields.entries()) {
        if (!currentFields.has(name)) {
          differences.push({ field: name, type: 'removed', before: originalField.value });
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            loadedAt: snapshot.loadedAt,
            hasDifferences: differences.length > 0,
            differenceCount: differences.length,
            differences,
          }, null, 2),
        }],
      };
    }
  );
}
