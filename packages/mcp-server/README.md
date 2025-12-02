# Guido MCP Server

MCP (Model Context Protocol) Server for managing guido.json templates. Enables LLMs to read, modify, and validate configuration templates through structured tool calls.

## Features

- **Field Management**: List, get, set, add, and delete configuration fields
- **Rule Management**: List, get, add, update, delete, and validate rules
- **Automatic Rule Application**: Rules are automatically applied when fields change
- **Validation**: Detect contradictions and issues in rule definitions
- **Export**: Convert templates to target configuration format (e.g., `appsettings.json`)

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Usage

### As a standalone MCP server

```bash
# With a specific template (default for all operations)
npx tsx src/index.ts --template ./path/to/template.guido.json

# Without a template (use create_template to start fresh)
npx tsx src/index.ts
```

### With VS Code Copilot

Add to your workspace `.vscode/mcp.json`:

```json
{
  "servers": {
    "guido": {
      "command": "npx",
      "args": [
        "tsx",
        "${workspaceFolder}/guido/packages/mcp-server/src/index.ts",
        "--template",
        "${workspaceFolder}/guido/public/templates/Example Template.guido.json"
      ],
      "type": "stdio"
    }
  }
}
```

Or without a default template (LLM can create templates or specify filePath per tool call):

```json
{
  "servers": {
    "guido": {
      "command": "npx",
      "args": [
        "tsx",
        "${workspaceFolder}/guido/packages/mcp-server/src/index.ts"
      ],
      "type": "stdio"
    }
  }
}
```

### With Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "guido": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/guido/packages/mcp-server/src/index.ts",
        "--template",
        "/path/to/template.guido.json"
      ]
    }
  }
}
```

## Available Tools

### Template Operations
- `get_template_info` - Get metadata about the template (name, version, description, etc.)
- `create_template` - Create a new empty guido template file
- `set_template` - Set the active template file (switch between templates)

### Field Operations
- `list_fields` - List all fields with optional filtering by name pattern or checked status
- `get_field` - Get detailed information about a specific field
- `set_field` - Update a field value, checked status, and/or metadata (rules auto-applied)
- `set_fields` - Update multiple fields at once
- `add_field` - Add a new field to the template
- `delete_field` - Delete a field (optionally remove related rules)

### Rule Operations
- `list_rules` - List all rules with optional filtering
- `get_rule` - Get detailed information about a rule by index
- `add_rule` - Add a new rule with validation
- `update_rule` - Update an existing rule
- `delete_rule` - Delete a rule by index

### RuleSet Operations
- `list_rulesets` - List all rulesets in the template
- `add_ruleset` - Add a new ruleset (with optional `extends` for inheritance)
- `update_ruleset` - Update ruleset metadata (name, description, tags, extends)
- `delete_ruleset` - Delete an entire ruleset

### RuleSet Inheritance

RuleSets can inherit rules from other rulesets using the `extends` property:

```
User: "Create a production ruleset that extends the base rules"

LLM calls: add_ruleset({
  name: "Production",
  description: "Production environment configuration",
  tags: ["production"],
  extends: "Base Rules"
})
```

When listing rules with `includeInherited: true`, inherited rules are shown with their source:

### Validation
- `validate_rules` - Validate all rules for contradictions
- `validate_fields` - Validate all field values against their range specifications
- `validate_field` - Validate a single field value
- `validate_template` - Comprehensive template validation: structure, metadata, fields, and rules
- `validate_settings` - Validate a settings file against the template

### Import/Export
- `import_settings` - Import settings from a file (.json, .yaml, .properties, .env)
- `export_config` - Export the template as target configuration (e.g., appsettings.json)

### Analysis
- `get_required_fields` - List all unconditionally required fields
- `check_completeness` - Check if all required fields have valid values

### Change Tracking
- `get_change_summary` - Get a summary of all changes made since template was loaded
- `clear_change_log` - Clear the change log for a template
- `diff_with_saved` - Compare current state with the last saved version

## Example Interactions

### Setting a field value
```
User: "Change the repository type to MongoDB"

LLM calls: set_field({ name: "Repository", value: "MongoDb", checked: true })

Result: Field updated, rules applied (MongoDB connection settings now required)
```

### Adding a new rule
```
User: "Add a rule that requires TLS when HTTPS is enabled"

LLM calls: add_rule({
  rule: {
    description: "TLS required when HTTPS enabled",
    conditions: [
      { name: "Hosting.HttpsPort", state: "set" }
    ],
    targets: [
      { name: "Hosting.SslProtocols.1", state: "set" }
    ]
  }
})
```

### Exporting configuration
```
User: "Export the current settings"

LLM calls: export_config({ onlyChecked: true })

Result: JSON configuration with nested structure
```

## Rule States

- `set` - Field must be set (non-empty and checked)
- `set_to_value` - Field must be set to a specific value
- `contains` - Field value must contain a specific string/value

## Development

```bash
# Watch mode
npm run watch

# Run directly with tsx
npm run dev
```

## License

MIT
