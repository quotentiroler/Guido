/**
 * Built-in Templates Loader
 *
 * Discovers and loads .guido.json templates from the public/templates folder.
 * Templates are auto-discovered at build time by the vite-plugin-templates plugin.
 */

import { Template, isTemplate } from '@guido/types';
import { logger } from './logger';
import { BUNDLED_TEMPLATES } from 'virtual:bundled-templates';

/**
 * Represents a built-in template bundled with the app
 */
export interface BuiltInTemplateEntry {
  /** File path relative to public folder (e.g., "/templates/MyTemplate.guido.json") */
  path: string;
  /** The URL to fetch the template from */
  url: string;
  /** Extracted template name from filename */
  name: string;
  /** The loaded template content (loaded on demand) */
  template?: Template;
}

/**
 * Base path for templates (respects the base URL for GitHub Pages deployment)
 */
const getTemplateBasePath = () => {
  // Use import.meta.env.BASE_URL which Vite sets based on the `base` config
  // In dev mode, public files are served from root regardless of base config
  // In production, they're served from the base path
  let base = import.meta.env.BASE_URL || '/';
  if (!base.endsWith('/')) {
    base = base + '/';
  }
  logger.debug(`Template base path: ${base}templates/`);
  return `${base}templates/`;
};

/**
 * Cache of loaded built-in templates
 */
let cachedTemplates: BuiltInTemplateEntry[] | null = null;
let loadPromise: Promise<BuiltInTemplateEntry[]> | null = null;

/**
 * Extract a human-readable name from the template file path
 */
function extractTemplateName(filename: string): string {
  return filename.replace(/\.guido\.json$/, '');
}

/**
 * Get all built-in templates from the public/templates folder.
 * Templates are verified by attempting to fetch them.
 * 
 * @returns Array of built-in template entries with their metadata
 */
export function getBuiltInTemplates(): BuiltInTemplateEntry[] {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  // Build entries from known templates (synchronous for initial render)
  const basePath = getTemplateBasePath();
  const entries: BuiltInTemplateEntry[] = BUNDLED_TEMPLATES.map(filename => ({
    path: `/templates/${filename}`,
    url: `${basePath}${encodeURIComponent(filename)}`,
    name: extractTemplateName(filename),
  }));

  cachedTemplates = entries;
  logger.info(`Registered ${entries.length} built-in template(s)`);
  
  return entries;
}

/**
 * Verify and load all built-in templates (validates they actually exist)
 * Call this once at startup to verify templates are accessible
 */
export async function verifyBuiltInTemplates(): Promise<BuiltInTemplateEntry[]> {
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    const entries = getBuiltInTemplates();
    const verified: BuiltInTemplateEntry[] = [];

    for (const entry of entries) {
      try {
        const response = await fetch(entry.url, { method: 'HEAD' });
        if (response.ok) {
          verified.push(entry);
          logger.debug(`Verified built-in template: ${entry.name}`);
        } else {
          logger.warn(`Built-in template not found: ${entry.name} (${response.status})`);
        }
      } catch (error) {
        logger.warn(`Failed to verify built-in template: ${entry.name}`, error);
      }
    }

    cachedTemplates = verified;
    logger.info(`Verified ${verified.length}/${entries.length} built-in template(s)`);
    return verified;
  })();

  return loadPromise;
}

/**
 * Load a template by fetching its content from the URL
 * 
 * @param entry - The built-in template entry to load
 * @returns The loaded template
 */
export async function loadBuiltInTemplate(entry: BuiltInTemplateEntry): Promise<Template | undefined> {
  if (entry.template) {
    return entry.template;
  }

  try {
    logger.debug(`Fetching template from URL: ${entry.url}`);
    const response = await fetch(entry.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    const template = await response.json() as unknown;
    
    if (isTemplate(template)) {
      entry.template = template;
      // Update name from template if available
      if (template.name) {
        entry.name = template.name;
      }
      return template;
    } else {
      logger.warn(`Invalid template structure in ${entry.path}`);
      return undefined;
    }
  } catch (error) {
    logger.error(`Failed to load built-in template: ${entry.path}`, error);
    return undefined;
  }
}

/**
 * Search built-in templates by query string.
 * Matches against template name (from filename).
 * 
 * @param query - Search query (case-insensitive)
 * @returns Matching built-in template entries
 */
export function searchBuiltInTemplates(query: string): BuiltInTemplateEntry[] {
  const templates = getBuiltInTemplates();
  const lowerQuery = query.toLowerCase().trim();
  
  if (!lowerQuery) {
    return templates;
  }

  return templates.filter(entry => {
    const name = entry.name.toLowerCase();
    return name.includes(lowerQuery);
  });
}

/**
 * Get a specific built-in template by its path or name
 * 
 * @param identifier - Template path or name
 * @returns The template entry if found, undefined otherwise
 */
export function getBuiltInTemplateEntry(identifier: string): BuiltInTemplateEntry | undefined {
  const templates = getBuiltInTemplates();
  
  return templates.find(
    t => t.path === identifier || t.name === identifier
  );
}

/**
 * Get and load a specific built-in template by its path or name
 * 
 * @param identifier - Template path or name
 * @returns The loaded template if found, undefined otherwise
 */
export async function getBuiltInTemplate(identifier: string): Promise<Template | undefined> {
  const entry = getBuiltInTemplateEntry(identifier);
  if (!entry) return undefined;
  return loadBuiltInTemplate(entry);
}

/**
 * Check if any built-in templates are available
 */
export function hasBuiltInTemplates(): boolean {
  return getBuiltInTemplates().length > 0;
}
