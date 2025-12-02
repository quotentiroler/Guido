/**
 * Vite Plugin: Auto-discover Guido Templates
 * 
 * Scans the public/templates directory for .guido.json files and injects
 * the list as a virtual module that can be imported at runtime.
 * 
 * This eliminates the need to manually maintain a list of bundled templates.
 */

import { Plugin } from 'vite';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

const VIRTUAL_MODULE_ID = 'virtual:bundled-templates';
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID;

export interface TemplateDiscoveryOptions {
  /**
   * Directory containing templates relative to the public folder
   * @default 'templates'
   */
  templatesDir?: string;
  
  /**
   * File extension pattern for template files
   * @default '.guido.json'
   */
  extension?: string;
}

/**
 * Vite plugin that auto-discovers .guido.json templates in the public directory
 * and provides them as a virtual module.
 * 
 * Usage in code:
 * ```ts
 * import { BUNDLED_TEMPLATES } from 'virtual:bundled-templates';
 * ```
 */
export function guidoTemplatesPlugin(options: TemplateDiscoveryOptions = {}): Plugin {
  const { templatesDir = 'templates', extension = '.guido.json' } = options;
  
  let templates: string[] = [];
  let publicDir: string;

  return {
    name: 'guido-templates',
    
    configResolved(config) {
      // Get the public directory path
      publicDir = config.publicDir || join(config.root, 'public');
    },
    
    buildStart() {
      // Scan for templates
      const templatesPath = join(publicDir, templatesDir);
      
      if (existsSync(templatesPath)) {
        try {
          const files = readdirSync(templatesPath);
          templates = files
            .filter(file => file.endsWith(extension))
            .sort();
          
          console.log(`[guido-templates] Discovered ${templates.length} template(s):`);
          templates.forEach(t => console.log(`  - ${t}`));
        } catch (error) {
          console.warn(`[guido-templates] Failed to scan templates directory:`, error);
          templates = [];
        }
      } else {
        console.warn(`[guido-templates] Templates directory not found: ${templatesPath}`);
        templates = [];
      }
    },

    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
    },

    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        // Generate the virtual module with discovered templates
        return `
/**
 * Auto-generated list of bundled templates.
 * Discovered at build time from public/${templatesDir}/*.guido.json
 */
export const BUNDLED_TEMPLATES = ${JSON.stringify(templates, null, 2)};
`;
      }
    },

    // Handle HMR - re-scan when templates change
    handleHotUpdate({ file, server }) {
      if (file.includes(templatesDir) && file.endsWith(extension)) {
        // Re-scan templates
        const templatesPath = join(publicDir, templatesDir);
        if (existsSync(templatesPath)) {
          const files = readdirSync(templatesPath);
          templates = files
            .filter(f => f.endsWith(extension))
            .sort();
          
          console.log(`[guido-templates] Templates updated: ${templates.length} found`);
          
          // Trigger module reload
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
            return [mod];
          }
        }
      }
    },
  };
}

export default guidoTemplatesPlugin;
