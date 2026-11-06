import type { ToolHandler } from './types.js';
import { reqString } from './args.js';
import { findField } from '../template-utils.js';

export const templateHandlers: Record<string, ToolHandler> = {
  get_template_info: (args, template) => {
    const defaultRuleSet = template.ruleSets?.[0];
    return {
      name: template.name,
      fileName: template.fileName,
      version: template.version,
      description: template.description,
      owner: template.owner,
      application: template.application,
      docs: template.docs,
      command: template.command,
      fieldCount: template.fields.length,
      ruleSetCount: template.ruleSets?.length ?? 0,
      ruleCount: defaultRuleSet?.rules?.length ?? 0,
      ruleSets: template.ruleSets?.map((rs, i) => ({
        index: i,
        name: rs.name,
        description: rs.description,
        tags: rs.tags,
        extends: rs.extends,
        ruleCount: rs.rules?.length ?? 0,
      })),
    };
  },

  // create_template is handled specially in registerAllTools - see below

  // Documentation Fetch Tools
  fetch_template_docs: async (args, template) => {
    const docsUrl = template.docs;
    
    if (!docsUrl) {
      return {
        success: false,
        error: 'This template does not have a documentation URL configured. The "docs" field is not set in the template metadata.',
      };
    }
    
    try {
      const response = await fetch(docsUrl);
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch documentation: HTTP ${response.status} ${response.statusText}`,
          url: docsUrl,
        };
      }
      
      const content = await response.text();
      return {
        success: true,
        url: docsUrl,
        content: content.substring(0, 50000), // Limit to 50KB to avoid overwhelming the context
        truncated: content.length > 50000,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`,
        url: docsUrl,
      };
    }
  },

  fetch_field_docs: async (args, template) => {
    const name = reqString(args, 'name');
    const field = findField(template, name);
    
    if (!field) {
      return {
        success: false,
        error: `Field "${name}" not found in the template.`,
      };
    }
    
    if (!field.link) {
      return {
        success: false,
        error: `Field "${name}" does not have a documentation link configured.`,
        field: {
          name: field.name,
          info: field.info,
          example: field.example,
        },
      };
    }
    
    try {
      const response = await fetch(field.link);
      if (!response.ok) {
        return {
          success: false,
          error: `Failed to fetch documentation: HTTP ${response.status} ${response.statusText}`,
          url: field.link,
          field: {
            name: field.name,
            info: field.info,
          },
        };
      }
      
      const content = await response.text();
      return {
        success: true,
        fieldName: name,
        url: field.link,
        content: content.substring(0, 50000), // Limit to 50KB
        truncated: content.length > 50000,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`,
        url: field.link,
        field: {
          name: field.name,
          info: field.info,
        },
      };
    }
  },
};
