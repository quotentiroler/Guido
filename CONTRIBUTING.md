# Contributing to Guido

Thank you for your interest in contributing to Guido! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (template files, rule configurations, etc.)
- **Describe the behavior you observed and what you expected**
- **Include screenshots** if applicable
- **Include your environment details** (browser, OS, Node.js version)

### Suggesting Features

Feature suggestions are tracked as GitHub issues. When creating a feature request:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the proposed feature
- **Explain why this feature would be useful**
- **Include mockups or examples** if possible

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding standards** described below
3. **Add tests** for any new functionality
4. **Ensure all tests pass** (`npm test`)
5. **Run linting** (`npm run lint`)
6. **Update documentation** if needed
7. **Write a clear PR description** explaining your changes

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Guido.git
cd Guido

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint
```

## Project Structure

```
Guido/
├── src/                    # Main web application source
│   ├── components/         # React components
│   ├── context/            # React contexts
│   ├── hooks/              # Custom React hooks
│   ├── provider/           # Context providers
│   ├── services/           # Business logic services
│   └── utils/              # Utility functions
├── packages/               # Monorepo packages
│   ├── cli/                # CLI tools
│   ├── core/               # Core rule engine logic
│   ├── logger/             # Logging utilities
│   ├── mcp-server/         # MCP server for AI integration
│   └── types/              # Shared TypeScript types
├── public/                 # Static assets
│   ├── registries/         # Registry definitions
│   └── templates/          # Template files
└── .github/                # GitHub Actions workflows
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Document public APIs with JSDoc comments

### React

- Use functional components with hooks
- Follow the existing component patterns
- Keep components focused and composable
- Use proper TypeScript typing for props

### Testing

- Write tests for new functionality
- Maintain test coverage above 70%
- Use descriptive test names
- Test edge cases and error conditions

### Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(rules): add support for regex validation in contains rules
fix(ui): resolve field flickering on rule application
docs(readme): update installation instructions
```

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

Pre-release versions use suffixes: `1.0.0-alpha`, `1.0.0-beta.1`

## Release Process

Releases are automated through GitHub Actions:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a PR with version bump
4. After merge, the CI will:
   - Run tests and linting
   - Build the project
   - Create a GitHub release
   - Deploy to GitHub Pages

## License

By contributing to Guido, you agree that your contributions will be licensed under the Apache License 2.0.

## Questions?

Feel free to open an issue for any questions or join discussions in existing issues.

Thank you for contributing! 🎉
