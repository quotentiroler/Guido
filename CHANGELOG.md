# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Apache 2.0 license for open source release
- Contributing guidelines (CONTRIBUTING.md)
- Code of Conduct (CODE_OF_CONDUCT.md)
- Semantic versioning CI workflow with release automation
- PR validation workflow

### Changed
- Improved rule application to update immediately when rules are added/edited
- Fixed "contains" rule enforcement for the `not` flag
- Easter egg animation now maintains proper timing regardless of speech settings

## [1.0.0-alpha] - 2024-12-10

### Added
- Initial alpha release
- Visual configuration editor with field validation
- Rule engine with `set`, `set_to_value`, and `contains` states
- Template system with import/export support
- Multi-format export (JSON, YAML, CSV, .env, .properties, .txt)
- AI integration via MCP server
- Dark/light theme support
- Registry system for template discovery
- RuleSet inheritance with `extends` keyword
- Natural language rule parsing
- Undo/redo support for field changes

### Technical
- React 19 with TypeScript
- Vite 7 build system
- Tailwind CSS 4 for styling
- Monorepo structure with npm workspaces
- Comprehensive test coverage (370+ tests)

---

## Version History

For detailed release notes, see [GitHub Releases](https://github.com/quotentiroler/Guido/releases).
