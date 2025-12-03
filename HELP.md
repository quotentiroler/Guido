## Expert Mode Guide

Expert Mode unlocks advanced features for creating and managing Guido templates.

---

## Template Management

### Loading Templates

**From Registries:**
- Search GitHub, NPM, or Simplifier in the search bar
- Select a package → choose version → select template
- Enable/disable registries in the Registry panel

**From File/Clipboard:**
- Click **"Load Template"** to upload a `.guido.json` file
- Use the 📋 paste button to import from clipboard

**Via URL Parameters:**
- `?template=https://url/to/template.guido.json`
- `?package=https://url/to/package.tgz`

### Creating Templates

1. Click **"Edit"** on the template panel (works even with no template loaded)
2. Fill in the metadata:
   - **Name**: Template display name
   - **Application**: Target application name
   - **Version**: Template version
   - **Owner**: Organization or author
   - **File Name**: Output filename (e.g., `appsettings.json`)
   - **Description**: What this template configures
   - **Command**: Docker/CLI command (click to copy)

### Exporting Templates

- **Download Template**: Save as `.guido.json` file
- **Copy to Clipboard**: Use the 📋 button next to Download

---

## Registry Configuration

### Built-in Registries

| Registry | Description |
|----------|-------------|
| **GitHub** | Search GitHub repositories for `.guido.json` files |
| **NPM** | Search npm packages containing Guido templates |
| **Simplifier** | Search Simplifier.net FHIR packages |

Toggle each registry on/off with the checkboxes. Status badges show connection state.

### Custom Registries

Add custom registries by:
1. **URL Discovery**: Enter a base URL — Guido auto-discovers via `/.well-known/guido.json`
2. **File Import**: Upload a registry definition JSON file

Registry definition files follow the schema in `public/registries/registry.schema.json`.

---

## Field Management

### Creating Fields

**From Import:**
- Import a settings file — fields are auto-created from the data
- New fields are added, existing fields are updated

**Manually:**
1. Click **"Add Field"** in the Fields tab
2. Configure field properties (see below)

### Field Properties

| Property | Description |
|----------|-------------|
| `name` | Field identifier. Use dots for nesting: `Database.Connection.Host` |
| `value` | Default value (string, number, boolean, or array) |
| `info` | Description shown in ℹ️ tooltip |
| `example` | Example value shown in 📄 tooltip |
| `range` | Validation rule (see table below) |
| `link` | URL opened when clicking ℹ️ icon |
| `checked` | Whether field is included in export |

### Range Validation Types

| Range | Description |
|-------|-------------|
| `string` | Any string value (unbounded) |
| `boolean` | Must be `true` or `false` |
| `integer` | Must be a whole number |
| `integer(min..max)` | Integer within range (e.g., `integer(1..65535)`) |
| `string(min..max)` | String with length limits (e.g., `string(0..255)`) |
| `url` | Must be a valid URL |
| `string[]` | Array of strings |
| `integer[]` | Array of integers |
| `string[min..max]` | Array with size limits (e.g., `string[1..10]`) |
| `opt1\|\|opt2\|\|opt3` | Must match one of the pipe-separated options |
| `^regex$` | Must match the regex pattern |

### Editing Fields

- Click the ✏️ icon next to any field to edit its properties
- Click the 🗑️ icon to delete a field
- Use **"Delete All Fields"** to clear all fields

---

## Rule Management

### Understanding Rules

Rules define conditional logic: **If conditions are met, then apply targets.**

```
If "Repository" equals "MongoDb"
Then "MongoDbOptions.ConnectionString" must be set
```

### Creating Rules

1. Go to the **Rules** tab
2. Click **"Add Rule"**
3. Add **Conditions** (IF) — what must be true
4. Add **Targets** (THEN) — what happens when conditions are met
5. Click **Save**

### Rule States

| State | As Condition | As Target |
|-------|--------------|-----------|
| `set` | Field is checked and has a value | Field must be checked |
| `set_to_value` | Field equals specific value | Set field to specific value |
| `contains` | Field contains substring/item | Field must contain value |

### Negation (`not`)

Toggle the **NOT** checkbox to negate any condition or target:
- `NOT set` = field is unchecked or empty
- `NOT set_to_value "X"` = field does not equal "X"

### Required Fields

Click **"Edit Required Fields"** in the rule modal to define fields that must always be set (rules without conditions).

### Contrapositive

After adding at least one condition, click **"Add Contrapositive"** to automatically create the logical inverse:
- Original: `If A then B`
- Contrapositive: `If NOT B then NOT A`

This ensures rules work "both ways".

---

## Rule Engine Features

### Automatic Rule Application

Rules are applied immediately when:
- Field values change
- Fields are checked/unchecked
- Templates are loaded

### Change History Panel

The floating panel (bottom-right) shows:
- What fields were changed
- Why they changed (which rule applied)
- Toggle **"Show user actions"** to see all changes

Click **"Undo"** to revert the last change.

### Validation & Detection

The rule engine automatically detects:
- **Circular dependencies**: Rules that would loop forever
- **Contradictions**: Rules that conflict with each other

### Disabled Field Tooltips

When a rule disables a field, hover over it to see which rule caused it.

---

## Import/Export Formats

### Supported Input Formats

| Format | Extensions |
|--------|------------|
| JSON | `.json` |
| YAML | `.yaml`, `.yml` |
| CSV | `.csv` |
| Environment | `.env` |
| Properties | `.properties` |
| Plain Text | `.txt` |

### Import Methods

- **File Upload**: Click "Import Settings"
- **Clipboard Paste**: Click the 📋 paste button

### Export Options

- **Download**: Saves to your default downloads folder
- **Copy to Clipboard**: For pasting elsewhere

Output format is determined by the template's `fileName` extension.

---

## CLI Tools

### Validate Templates

```bash
npm run validate "path/to/template.guido.json"
```

Checks for:
- Rule contradictions
- Circular dependencies
- Invalid rule structures

### Convert JSON Schema to Guido

```bash
npm run schema-to-guido "schema.json" -o "output.guido.json" \
  --name "My Template" \
  --version "1.0.0" \
  --owner "MyOrg" \
  --filename "config.json" \
  --application "My App" \
  --docs "https://docs.example.com" \
  --command "docker run myapp"
```

### Convert Guido to JSON Schema

```bash
npm run guido-to-schema "template.guido.json" -o "output.schema.json"
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Execute search in template search bar |
| `Escape` | Close modals |

---

## Data Structure Reference

### Template

```json
{
  "name": "Template Name",
  "fileName": "output.json",
  "version": "1.0.0",
  "description": "What this configures",
  "owner": "Organization",
  "application": "App Name",
  "docs": "https://docs.example.com",
  "command": "docker run ...",
  "fields": [...],
  "ruleSets": [...]
}
```

### Field

```json
{
  "name": "Section.Setting",
  "value": "default",
  "info": "Description",
  "example": "example value",
  "range": "string",
  "link": "https://docs.example.com",
  "checked": true
}
```

### RuleSet

A RuleSet is a named collection of rules with optional inheritance.

```json
{
  "name": "Security Rules",
  "description": "Security-related configuration rules",
  "tags": ["security", "required"],
  "extends": "Base Rules",
  "enabled": true,
  "rules": [...]
}
```

| Property | Description |
|----------|-------------|
| `name` | Unique identifier for the ruleset |
| `description` | Human-readable description |
| `tags` | Array of tags for categorization |
| `extends` | Name of another ruleset to inherit rules from |
| `enabled` | Whether the ruleset is active (default: true) |
| `rules` | Array of Rule objects |

#### RuleSet Inheritance

RuleSets can inherit rules from other rulesets using the `extends` property:

```json
{
  "ruleSets": [
    {
      "name": "Base Rules",
      "description": "Common rules for all configurations",
      "tags": ["base"],
      "rules": [
        { "targets": [{ "name": "Version", "state": "set" }] }
      ]
    },
    {
      "name": "Production Rules",
      "description": "Production environment rules",
      "tags": ["production"],
      "extends": "Base Rules",
      "rules": [
        { "targets": [{ "name": "Debug", "state": "set_to_value", "value": "false" }] }
      ]
    }
  ]
}
```

In this example, "Production Rules" inherits all rules from "Base Rules" plus adds its own. Inherited rules are applied first, then the ruleset's own rules.

**Inheritance behavior:**
- Parent rules are applied before child rules
- Child rules can override parent behavior
- Circular inheritance is detected and prevented
- Multi-level inheritance is supported (A extends B extends C)

### Rule

```json
{
  "description": "Optional human-readable description",
  "conditions": [
    { "name": "FieldA", "state": "set_to_value", "value": "X", "not": false }
  ],
  "targets": [
    { "name": "FieldB", "state": "set", "not": false }
  ]
}
```

---

## Current Limitations

### Dynamic Arrays of Complex Objects

Guido currently **cannot** describe configuration structures with dynamic arrays of complex objects. For example:

```json
{
  "plugins": [
    { "name": "PluginA", "enabled": true, "settings": { "timeout": 30 } },
    { "name": "PluginB", "enabled": false, "settings": { "retries": 3 } }
  ]
}
```

**Why?** The dot notation flattening (`Plugins.0.Name`, `Plugins.1.Settings.Timeout`) works for *fixed* arrays where the number of elements is known at template design time. However, it cannot:

1. Allow users to **add/remove** array items dynamically
2. Define **item schemas** that apply to all elements (like JSON Schema's `items`)
3. Support **unbounded** arrays where the count is unknown

**Workarounds:**

- **Fixed arrays**: Use indexed field names (`Plugins.0.Name`, `Plugins.1.Name`) if the array size is predictable
- **String arrays**: The `string[]` range type works for simple value arrays
- **JSON string**: Store complex structures as a JSON string value with `range: "any"`

**What does work well:**

| Pattern | Example | Works? |
|---------|---------|--------|
| Nested objects | `Database.Connection.Host` | ✅ |
| Simple arrays | `AllowedOrigins` with `range: "string[]"` | ✅ |
| Fixed-size object arrays | `Servers.0.Host`, `Servers.1.Host` | ✅ |
| Dynamic object arrays | Unlimited plugin definitions | ❌ |
| Array item schemas | "Each item must have name + enabled" | ❌ |

This limitation is architectural and would require significant changes to support properly. For now, configuration structures with dynamic object arrays should either use a fixed maximum or store the array as a JSON/YAML string.
