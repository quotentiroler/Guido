# Guido - Configuration Template Manager

<p align="center">
  <img src="src/assets/guido.png" alt="Guido" width="400">
</p>

<p align="center">
  <strong>A visual configuration management tool for creating, editing, and validating application settings with intelligent rule-based automation.</strong>
</p>

<!-- Dynamic badges from GitHub Actions -->
<p align="center">
  <a href="https://github.com/quotentiroler/Guido/releases"><img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/quotentiroler/d02ddd8605a95c2217ab1a49e0a99b4d/raw/version.json" alt="Version"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Vite-7-646cff?logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/github/license/quotentiroler/Guido" alt="License">
</p>

<p align="center">
  <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/quotentiroler/d02ddd8605a95c2217ab1a49e0a99b4d/raw/coverage.json" alt="Coverage">
  <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/quotentiroler/d02ddd8605a95c2217ab1a49e0a99b4d/raw/tests.json" alt="Tests">
  <img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/quotentiroler/d02ddd8605a95c2217ab1a49e0a99b4d/raw/build-size.json" alt="Build Size">
</p>

<p align="center">
  <a href="https://quotentiroler.github.io/Guido/">Live Demo</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#features">Features</a> •
  <a href="#documentation">Documentation</a>
</p>

---

## What is Guido?

Guido is a web-based GUI application that simplifies the management of complex configuration files. Instead of manually editing JSON, YAML, or other config formats, Guido provides:

- **Visual editing** of configuration fields with validation
- **Intelligent rules** that automatically enable/disable settings based on conditions
- **Template system** with reusable configuration schemas
- **Multi-format support** for JSON, YAML, CSV, .env, .properties, and .txt files

## Quick Start

### Use the Hosted App

Visit **[quotentiroler.github.io/Guido](https://quotentiroler.github.io/Guido/)** to use Guido directly in your browser.

### Run Locally

```bash
# Clone the repository
git clone https://github.com/quotentiroler/Guido.git
cd Guido

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

### 🎛️ Visual Configuration Editor

Edit configuration fields through an intuitive UI with:

- Field metadata (descriptions, examples, documentation links)
- Real-time validation (integers, booleans, URLs, regex patterns, enums)
- Checkbox-based field selection for export

### 🔗 Rule Engine

Define conditional logic that automatically manages field dependencies:

```
If "Repository" is set to "MongoDb"
Then "MongoDbOptions.ConnectionString" must be set
```

**Rule States:**

| State            | Description                               |
| ---------------- | ----------------------------------------- |
| `set`          | Field must be enabled and have a value    |
| `set_to_value` | Field must equal a specific value         |
| `contains`     | Field value must contain a substring/item |

### 🤖 MCP Server (AI Integration)

The included MCP (Model Context Protocol) server enables AI assistants like Claude to manage Guido templates programmatically.

## Documentation

### Template Structure

A `.guido.json` template consists of:

```json
{
  "name": "My App Settings",
  "fileName": "appsettings.json",
  "version": "1.0.0",
  "description": "Configuration template for My App",
  "owner": "MyOrganization",
  "application": "My App",
  "docs": "https://docs.example.com",
  "command": "docker run myapp:latest",
  "fields": [...],
  "ruleSets": [...]
}
```

### Field Definition

Each field describes a configuration option:

```json
{
  "name": "Database.ConnectionString",
  "value": "Server=localhost;Database=mydb",
  "info": "Connection string for the primary database",
  "example": "Server=localhost;Database=mydb;User=admin",
  "range": "string",
  "link": "https://docs.example.com/connection-strings",
  "checked": true
}
```

**Field Properties:**

| Property    | Type                                   | Description                                                        |
| ----------- | -------------------------------------- | ------------------------------------------------------------------ |
| `name`    | string                                 | Field identifier (use dots for nesting:`Section.Subsection.Key`) |
| `value`   | string\| number \| boolean \| string[] | Default value                                                      |
| `info`    | string                                 | Description shown in tooltip                                       |
| `example` | string                                 | Example value                                                      |
| `range`   | string                                 | Validation rule (see below)                                        |
| `link`    | string?                                | URL to documentation                                               |
| `checked` | boolean?                               | Whether field is enabled for export                                |

**Range Types:**

| Range                   | Description                              |
| ----------------------- | ---------------------------------------- |
| `string`                | Any string value (unbounded)             |
| `boolean`               | Must be `true` or `false`                |
| `integer`               | Must be a whole number                   |
| `integer(min..max)`     | Integer within range (e.g., `integer(1..65535)`) |
| `string(min..max)`      | String with length limits (e.g., `string(0..255)`) |
| `url`                   | Must be a valid URL                      |
| `string[]`              | Array of strings                         |
| `integer[]`             | Array of integers                        |
| `string[min..max]`      | Array with size limits (e.g., `string[1..10]`) |
| `opt1\|\|opt2\|\|opt3`    | Must match one of the options            |
| `^regex$`               | Must match the regex pattern             |

### Rule Definition

Rules define conditional relationships between fields:

```json
{
  "description": "MongoDB requires connection string",
  "conditions": [
    { "name": "Repository", "state": "set_to_value", "value": "MongoDb" }
  ],
  "targets": [
    { "name": "MongoDbOptions.ConnectionString", "state": "set" }
  ]
}
```

**Logic**: `If ALL conditions are true, then ALL targets are enforced`

**RuleDomain Properties:**

| Property  | Type                                        | Description                                |
| --------- | ------------------------------------------- | ------------------------------------------ |
| `name`  | string                                      | Field name to evaluate/affect              |
| `state` | `set` \| `set_to_value` \| `contains` | Condition type                             |
| `value` | string?                                     | Value for `set_to_value` or `contains` |
| `not`   | boolean?                                    | Negate the condition/target                |

## Known Limitations

### Dynamic Arrays of Complex Objects

Guido cannot describe configuration structures with dynamic arrays of complex objects where users need to add/remove items at runtime. The dot notation flattening (e.g., `Plugins.0.Name`, `Plugins.1.Name`) works for **fixed-size arrays** but not for unbounded collections.

| Pattern | Example | Supported |
|---------|---------|-----------|
| Nested objects | `Database.Connection.Host` | ✅ |
| Simple arrays | `AllowedOrigins` with `range: "string[]"` | ✅ |
| Fixed-size object arrays | `Servers.0.Host`, `Servers.1.Host` | ✅ |
| Dynamic object arrays | Unlimited plugin definitions | ❌ |

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
- Field validation issues

### Convert JSON Schema to Guido

```bash
npm run schema-to-guido "schema.json" -o "output.guido.json" \
  --name "My Template" \
  --version "1.0.0" \
  --owner "MyOrg" \
  --application "My App" \
  --docs "https://docs.example.com"
```

### Convert Guido to JSON Schema

```bash
npm run guido-to-schema "template.guido.json" -o "output.schema.json"
```

## Available Scripts

| Script                 | Description              |
| ---------------------- | ------------------------ |
| `npm run dev`        | Start development server |
| `npm run build`      | Build for production     |
| `npm run preview`    | Preview production build |
| `npm run test`       | Run tests                |
| `npm run test:watch` | Run tests in watch mode  |
| `npm run lint`       | Run ESLint               |
| `npm run deploy`     | Deploy to GitHub Pages   |

## Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build**: Vite, npm workspaces (monorepo)
- **Testing**: Vitest
- **Deployment**: GitHub Pages

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

Before contributing, please read our [Code of Conduct](CODE_OF_CONDUCT.md).

### Quick Start for Contributors

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/Guido.git
cd Guido

# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
```

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

```
Copyright 2024-2025 Maximilian Nussbaumer

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
