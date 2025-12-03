# Guido Registry Definitions

This folder contains registry adapter definitions that tell Guido how to interact with different template registries.

## Built-in Registries

- `npm.registry.json` - NPM Registry (registry.npmjs.org)
- `github.registry.json` - GitHub Packages API
- `simplifier.registry.json` - Simplifier FHIR Registry

## Custom Registries

To add a custom registry:

1. Copy `_template.registry.json` as a starting point
2. Rename it to `your-registry-name.registry.json`
3. Configure the endpoints and response mappings
4. Add the registry URL in Guido's settings

## Schema

All registry files should follow the schema defined in `registry.schema.json`.

## File Format

```json
{
  "$schema": "./registry.schema.json",
  "name": "My Registry",
  "description": "Description of the registry",
  "baseUrl": "https://my-registry.com/api",
  "api": {
    "search": { ... },
    "list": { ... },
    "fetch": { ... }
  },
  "auth": { ... }
}
```

See individual registry files for complete examples.
