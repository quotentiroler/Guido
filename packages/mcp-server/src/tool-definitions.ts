/**
 * MCP Tool Definitions
 * 
 * Declarative definitions for MCP tools. These are used by the generator
 * to produce the actual tool registration code.
 * 
 * Each tool definition specifies:
 * - name: Tool identifier
 * - title: Human-readable title
 * - description: What the tool does
 * - inputs: Parameter definitions with types and descriptions
 * - implementation: Reference to a core function or inline handler
 */

// ============================================================================
// Input Type Definitions
// ============================================================================

export type InputType = 
  | 'string'
  | 'number' 
  | 'boolean'
  | 'string[]'
  | 'number[]'
  | 'FieldValue'      // string | number | boolean | string[]
  | 'RuleDomain'      // { name, state, value?, not? }
  | 'RuleDomain[]'
  | 'Field'
  | 'FieldUpdate'     // { name, value?, checked? }
  | 'FieldUpdate[]'
  | 'Rule'
  | 'RuleUpdate';

export interface InputDef {
  type: InputType;
  required?: boolean;
  description: string;
  default?: unknown;
}

/**
 * Implementation reference - points to a function in @guido/core or inline code
 */
export interface Implementation {
  /** 
   * Import path: '@guido/core' or '../template-utils' 
   */
  from: string;
  /** 
   * Function name to call 
   */
  fn: string;
  /**
   * How to map tool inputs to function args.
   * Keys are function param names, values are tool input names or expressions.
   */
  args?: Record<string, string>;
  /**
   * Transform the result before returning
   */
  transform?: string;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  category: 'template' | 'field' | 'rule' | 'validation' | 'export' | 'analysis';
  inputs: Record<string, InputDef>;
  /** 
   * If true, this tool modifies the template and needs save logic.
   * If false or undefined, it's read-only.
   */
  mutates?: boolean;
  /**
   * Implementation reference (optional - for auto-generation)
   */
  impl?: Implementation;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const toolDefinitions: ToolDef[] = [
  // ---------------------------------------------------------------------------
  // Template Tools
  // ---------------------------------------------------------------------------
  {
    name: 'get_template_info',
    title: 'Get Template Info',
    description: 'Get metadata about the guido template (name, version, description, etc.)',
    category: 'template',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
    },
  },
  {
    name: 'create_template',
    title: 'Create Template',
    description: 'Create a new guido template file. Use this to start a fresh template when no template exists.',
    category: 'template',
    inputs: {
      filePath: { type: 'string', required: true, description: 'Path where the new template file will be created' },
      name: { type: 'string', required: true, description: 'Template name (e.g., "My App Settings")' },
      version: { type: 'string', required: false, description: 'Template version (default: "1.0.0")' },
      description: { type: 'string', required: false, description: 'Template description' },
      owner: { type: 'string', required: false, description: 'Template owner/author' },
      application: { type: 'string', required: false, description: 'Target application name' },
    },
    mutates: true,
  },
  {
    name: 'set_template',
    title: 'Set Active Template',
    description: 'Set the active template file for subsequent operations. Use this to switch between templates or when starting without a --template argument.',
    category: 'template',
    inputs: {
      filePath: { type: 'string', required: true, description: 'Path to an existing guido.json template file' },
    },
    mutates: false,
  },
  {
    name: 'merge_templates',
    title: 'Merge Templates',
    description: 'Merge another template into the current template. Fields from the source template override existing fields with the same name. Rules are combined, avoiding duplicates by description. Metadata from source takes priority if it exists.',
    category: 'template',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the target guido.json template file (current active template if not provided)' },
      sourceTemplatePath: { type: 'string', required: true, description: 'Path to the source template to merge from' },
    },
    mutates: true,
  },
  {
    name: 'fetch_template_docs',
    title: 'Fetch Template Docs',
    description: 'Fetch the documentation for the current template from its configured docs URL. Returns the documentation content as text. Only works if the template has a docs URL configured.',
    category: 'template',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
    },
  },
  {
    name: 'fetch_field_docs',
    title: 'Fetch Field Docs',
    description: 'Fetch the documentation for a specific field from its configured link URL. Returns the documentation content as text. Only works if the field has a link configured.',
    category: 'field',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      name: { type: 'string', required: true, description: 'The field name to fetch documentation for' },
    },
  },

  // ---------------------------------------------------------------------------
  // Field Tools
  // ---------------------------------------------------------------------------
  {
    name: 'list_fields',
    title: 'List Fields',
    description: 'List all fields in the template with optional filtering',
    category: 'field',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      filter: { type: 'string', required: false, description: 'Filter fields by name (substring match)' },
      onlyChecked: { type: 'boolean', required: false, description: 'Only return checked fields' },
      limit: { type: 'number', required: false, description: 'Maximum number of fields to return' },
    },
  },
  {
    name: 'get_field',
    title: 'Get Field',
    description: 'Get detailed information about a specific field by name',
    category: 'field',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      name: { type: 'string', required: true, description: 'The field name to retrieve' },
    },
  },
  {
    name: 'set_field',
    title: 'Set Field',
    description: 'Update a field value, checked status, and/or metadata (example, info, range, link). Rules are automatically applied.',
    category: 'field',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      name: { type: 'string', required: true, description: 'The field name to update' },
      value: { type: 'FieldValue', required: false, description: 'New value for the field' },
      checked: { type: 'boolean', required: false, description: 'Whether the field is checked/enabled' },
      example: { type: 'string', required: false, description: 'Example value for the field' },
      info: { type: 'string', required: false, description: 'Description/help text for the field' },
      range: { type: 'string', required: false, description: 'Validation range (e.g., "string", "boolean", "1..100")' },
      link: { type: 'string', required: false, description: 'Documentation link for the field' },
    },
    mutates: true,
  },
  {
    name: 'set_fields',
    title: 'Set Multiple Fields',
    description: 'Update multiple fields at once. Rules are applied after all changes.',
    category: 'field',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      updates: { type: 'FieldUpdate[]', required: true, description: 'Array of field updates' },
    },
    mutates: true,
  },
  {
    name: 'add_field',
    title: 'Add Field',
    description: 'Add a new field to the template',
    category: 'field',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      field: { type: 'Field', required: true, description: 'The field to add' },
      insertAfter: { type: 'string', required: false, description: 'Insert after this field name' },
    },
    mutates: true,
  },
  {
    name: 'delete_field',
    title: 'Delete Field',
    description: 'Delete a field from the template',
    category: 'field',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      name: { type: 'string', required: true, description: 'The field name to delete' },
      deleteRelatedRules: { type: 'boolean', required: false, description: 'Also delete rules referencing this field' },
    },
    mutates: true,
  },

  // ---------------------------------------------------------------------------
  // Rule Tools  
  // ---------------------------------------------------------------------------
  {
    name: 'list_rules',
    title: 'List Rules',
    description: 'List all rules in a ruleset with optional filtering. Use includeInherited to see rules from parent rulesets.',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      ruleSetIndex: { type: 'number', required: false, description: 'Index of ruleset (default: 0)' },
      filter: { type: 'string', required: false, description: 'Filter by field name in conditions/targets' },
      includeInherited: { type: 'boolean', required: false, description: 'Include rules inherited from parent rulesets via extends (default: false)' },
    },
  },
  {
    name: 'get_rule',
    title: 'Get Rule',
    description: 'Get detailed information about a specific rule by its 1-based rule number',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      ruleSetIndex: { type: 'number', required: false, description: 'Index of ruleset (default: 0)' },
      ruleNumber: { type: 'number', required: true, description: 'The rule number (1-based, as shown in validation messages and list_rules)' },
    },
  },
  {
    name: 'add_rule',
    title: 'Add Rule',
    description: 'Add a new rule to a ruleset',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      ruleSetIndex: { type: 'number', required: false, description: 'Index of ruleset (default: 0)' },
      conditions: { type: 'RuleDomain[]', required: false, description: 'Rule conditions' },
      targets: { type: 'RuleDomain[]', required: true, description: 'Rule targets' },
      description: { type: 'string', required: false, description: 'Human-readable description' },
      validate: { type: 'boolean', required: false, description: 'Validate rules after adding (default: true)' },
    },
    mutates: true,
  },
  {
    name: 'update_rule',
    title: 'Update Rule',
    description: 'Update an existing rule by its 1-based rule number',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      ruleSetIndex: { type: 'number', required: false, description: 'Index of ruleset (default: 0)' },
      ruleNumber: { type: 'number', required: true, description: 'The rule number to update (1-based, as shown in validation messages and list_rules)' },
      conditions: { type: 'RuleDomain[]', required: false, description: 'New conditions (replaces existing)' },
      targets: { type: 'RuleDomain[]', required: false, description: 'New targets (replaces existing)' },
      description: { type: 'string', required: false, description: 'New description' },
      validate: { type: 'boolean', required: false, description: 'Validate rules after updating (default: true)' },
    },
    mutates: true,
  },
  {
    name: 'delete_rule',
    title: 'Delete Rule',
    description: 'Delete a rule from a ruleset by its 1-based rule number',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      ruleSetIndex: { type: 'number', required: false, description: 'Index of ruleset (default: 0)' },
      ruleNumber: { type: 'number', required: true, description: 'The rule number to delete (1-based, as shown in validation messages and list_rules)' },
    },
    mutates: true,
  },
  {
    name: 'merge_rules',
    title: 'Merge Rules',
    description: 'Safely merge rules that have identical conditions into a single rule. Only merges rules flagged as mergeable by validate_rules. The merged rule combines all targets from the source rules.',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      ruleSetIndex: { type: 'number', required: false, description: 'Index of ruleset (default: 0)' },
      ruleNumbers: { type: 'number[]', required: true, description: 'Array of rule numbers (1-based) to merge. Must be at least 2 rules with identical conditions.' },
      newDescription: { type: 'string', required: false, description: 'Optional description for the merged rule. If not provided, combines descriptions from source rules.' },
    },
    mutates: true,
  },

  // ---------------------------------------------------------------------------
  // RuleSet Management Tools
  // ---------------------------------------------------------------------------
  {
    name: 'list_rulesets',
    title: 'List RuleSets',
    description: 'List all rulesets in the template with their metadata',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
    },
  },
  {
    name: 'add_ruleset',
    title: 'Add RuleSet',
    description: 'Add a new ruleset to the template',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      name: { type: 'string', required: true, description: 'RuleSet name' },
      description: { type: 'string', required: false, description: 'RuleSet description' },
      tags: { type: 'string[]', required: false, description: 'Tags for categorizing the ruleset' },
      extends: { type: 'string', required: false, description: 'Name of another ruleset to inherit rules from' },
    },
    mutates: true,
  },
  {
    name: 'update_ruleset',
    title: 'Update RuleSet',
    description: 'Update a ruleset\'s metadata (name, description, tags, extends)',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      index: { type: 'number', required: true, description: 'Index of the ruleset to update' },
      name: { type: 'string', required: false, description: 'New name for the ruleset' },
      description: { type: 'string', required: false, description: 'New description' },
      tags: { type: 'string[]', required: false, description: 'New tags (replaces existing)' },
      extends: { type: 'string', required: false, description: 'Name of another ruleset to inherit rules from (set to empty string to remove)' },
    },
    mutates: true,
  },
  {
    name: 'delete_ruleset',
    title: 'Delete RuleSet',
    description: 'Delete an entire ruleset and all its rules',
    category: 'rule',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      index: { type: 'number', required: true, description: 'Index of the ruleset to delete' },
    },
    mutates: true,
  },

  // ---------------------------------------------------------------------------
  // Validation Tools
  // ---------------------------------------------------------------------------
  {
    name: 'validate_rules',
    title: 'Validate Rules',
    description: 'Check all rules for contradictions, cycles, and invalid references',
    category: 'validation',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      ruleSetIndex: { type: 'number', required: false, description: 'Index of ruleset to validate (default: all)' },
    },
  },
  {
    name: 'validate_fields',
    title: 'Validate Fields',
    description: 'Validate all field values against their range specifications',
    category: 'validation',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      onlyChecked: { type: 'boolean', required: false, description: 'Only validate checked fields' },
    },
  },
  {
    name: 'validate_field',
    title: 'Validate Single Field',
    description: 'Validate a single field value against its range specification',
    category: 'validation',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      name: { type: 'string', required: true, description: 'The field name to validate' },
      value: { type: 'FieldValue', required: false, description: 'Value to validate (uses current value if not provided)' },
    },
  },
  {
    name: 'validate_template',
    title: 'Validate Template',
    description: 'Comprehensive template validation: structure, metadata, fields, and rules',
    category: 'validation',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
    },
  },
  {
    name: 'validate_settings',
    title: 'Validate Settings',
    description: 'Validate a settings file against the template - checks required fields and value constraints',
    category: 'validation',
    inputs: {
      filePath: { type: 'string', required: false, description: 'Path to the guido.json template file' },
      settingsPath: { type: 'string', required: true, description: 'Path to settings file (.json, .yaml, .properties, .env)' },
      rulesetName: { type: 'string', required: false, description: 'Use a specific ruleset by name' },
      rulesetTag: { type: 'string', required: false, description: 'Use rulesets with a specific tag' },
      strict: { type: 'boolean', required: false, description: 'Fail on warnings (extra fields not in template)' },
    },
  },

  // Note: export_config is in import-export-tools.ts with multi-format support
];

// ============================================================================
// Helper to get tool by name
// ============================================================================

export function getToolDef(name: string): ToolDef | undefined {
  return toolDefinitions.find(t => t.name === name);
}

export function getToolsByCategory(category: ToolDef['category']): ToolDef[] {
  return toolDefinitions.filter(t => t.category === category);
}
