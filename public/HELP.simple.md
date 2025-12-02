# Guido - Quick Start Guide

## Step 1: Load a Template

Search for templates from multiple sources:

- **GitHub** repositories
- **NPM** packages
- **Simplifier** (FHIR packages)

Or load directly via URL parameters:

- `?template=https://url/to/template.guido.json`
- `?package=https://url/to/package.tgz`

## Step 2: Import Your Settings (Optional)

Click **"Import Settings"** or use the 📋 paste button to load your existing configuration.

**Supported formats:** `.json`, `.yaml`, `.yml`, `.csv`, `.env`, `.properties`, `.txt`

Your values will be matched to template fields automatically.

## Step 3: Configure Your Settings

- **Edit values** in the input fields
- **Check/uncheck** fields to include or exclude them from export
- **Rules are applied automatically** — some fields may be enabled/disabled based on your choices
- **Validation** runs in real-time — invalid values show a red border

### Understanding the Icons

| Icon | Meaning                                                   |
| ---- | --------------------------------------------------------- |
| ℹ️ | View field description (click to open documentation link) |
| 📄   | View example value                                        |
| 🔍   | View validation range (red = validation failed)           |

## Step 4: Download Your Settings

Click **"Download Settings"** or use the 📋 copy button.

- Only checked fields are included
- Invalid fields must be fixed before download
- Output format matches the template's `fileName` extension

## Tips

- **Expert Mode**: Enable for advanced features (template editing, rule management)
- **Change History**: View applied rules in the floating panel (bottom-right)
- **Undo**: Revert the last change from the history panel
