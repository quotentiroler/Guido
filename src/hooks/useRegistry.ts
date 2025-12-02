import { useState, useEffect, useRef, useCallback } from 'react';
import localforage from 'localforage';
import { TarReader } from '@gera2ld/tarjs';
import { Template, RegistryDefinition, RegistryItem, BuiltInRegistryType, isTemplate } from '@guido/types';
import { 
  loadBuiltInRegistry, 
  loadCustomRegistry, 
  searchRegistry,
  fetchTemplate,
  getTemplateVersions
} from '@/utils/registryAdapter';
import { searchBuiltInTemplates, getBuiltInTemplate } from '@/utils/builtInTemplates';
import { logger } from '@/utils/logger';

/**
 * Alternative config file found in a tarball when no .guido.json files exist
 */
export interface AlternativeFile {
  name: string;
  path: string;
  size: number;
  /** Direct download URL for the file (e.g., from GitHub) */
  downloadUrl?: string;
}

/**
 * Custom error thrown when no .guido.json files are found in a tarball
 * Includes list of alternative config files that can be imported as settings
 */
export class NoGuidoTemplatesError extends Error {
  alternatives: AlternativeFile[];
  tarballData: ArrayBuffer;
  /** If true, tarballData contains raw text content (e.g., JSON), not a gzipped tarball */
  isRawContent: boolean;

  constructor(alternatives: AlternativeFile[], tarballData: ArrayBuffer, isRawContent = false) {
    super('No .guido.json files found in the tarball');
    this.name = 'NoGuidoTemplatesError';
    this.alternatives = alternatives;
    this.tarballData = tarballData;
    this.isRawContent = isRawContent;
  }
}

/**
 * Extended registry item with source information
 */
export interface SearchResultItem extends RegistryItem {
  source: BuiltInRegistryType | 'custom';
  registryName?: string;
  versions?: string[];
}

/**
 * Custom registry entry with URL and loaded definition
 */
interface CustomRegistryEntry {
  url: string;
  definition: RegistryDefinition | null;
  enabled: boolean;
}

const STORAGE_KEY = 'custom-registries';
const REGISTRY_TOGGLES_KEY = 'registry-toggles';

/**
 * Registry toggle states for persistence
 */
interface RegistryToggles {
  github: boolean;
  npm: boolean;
  simplifier: boolean;
  builtIn: boolean;
}

/**
 * Save custom registries to localforage
 */
async function saveCustomRegistriesToStorage(registries: CustomRegistryEntry[]): Promise<void> {
  try {
    // Only save URL and enabled state, not the full definition
    const toStore = registries.map(r => ({ url: r.url, enabled: r.enabled }));
    await localforage.setItem(STORAGE_KEY, toStore);
  } catch (error) {
    logger.error('Failed to save custom registries to storage', error);
  }
}

/**
 * Save registry toggle states to localforage
 */
async function saveRegistryTogglesToStorage(toggles: RegistryToggles): Promise<void> {
  try {
    await localforage.setItem(REGISTRY_TOGGLES_KEY, toggles);
  } catch (error) {
    logger.error('Failed to save registry toggles to storage', error);
  }
}

const useRegistry = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [customRegistryUrl, setCustomRegistryUrl] = useState<string | null>(null);
  const [isGitHubEnabled, setIsGitHubEnabledState] = useState<boolean>(true);
  const [isNpmEnabled, setIsNpmEnabledState] = useState<boolean>(true);
  const [isFhirEnabled, setIsFhirEnabledState] = useState<boolean>(true);
  const [isBuiltInEnabled, setIsBuiltInEnabledState] = useState<boolean>(true);
  
  // Registry definitions cache
  const [registryDefinitions, setRegistryDefinitions] = useState<Map<string, RegistryDefinition>>(new Map());
  const [customRegistryDefinition, setCustomRegistryDefinition] = useState<RegistryDefinition | null>(null);
  const [isLoadingDefinitions, setIsLoadingDefinitions] = useState<boolean>(true);
  
  // Multiple custom registries support
  const [customRegistries, setCustomRegistries] = useState<CustomRegistryEntry[]>([]);

  const [isConnected, setIsConnected] = useState(false);
  const hasCheckedConnection = useRef(false);

  // Wrapper functions to persist toggle changes
  const setIsGitHubEnabled = (enabled: boolean) => {
    setIsGitHubEnabledState(enabled);
    void saveRegistryTogglesToStorage({ github: enabled, npm: isNpmEnabled, simplifier: isFhirEnabled, builtIn: isBuiltInEnabled });
  };
  const setIsNpmEnabled = (enabled: boolean) => {
    setIsNpmEnabledState(enabled);
    void saveRegistryTogglesToStorage({ github: isGitHubEnabled, npm: enabled, simplifier: isFhirEnabled, builtIn: isBuiltInEnabled });
  };
  const setIsFhirEnabled = (enabled: boolean) => {
    setIsFhirEnabledState(enabled);
    void saveRegistryTogglesToStorage({ github: isGitHubEnabled, npm: isNpmEnabled, simplifier: enabled, builtIn: isBuiltInEnabled });
  };
  const setIsBuiltInEnabled = (enabled: boolean) => {
    setIsBuiltInEnabledState(enabled);
    void saveRegistryTogglesToStorage({ github: isGitHubEnabled, npm: isNpmEnabled, simplifier: isFhirEnabled, builtIn: enabled });
  };

  // Load registry toggles from storage on mount
  useEffect(() => {
    const loadToggles = async () => {
      try {
        const stored = await localforage.getItem<RegistryToggles>(REGISTRY_TOGGLES_KEY);
        if (stored) {
          setIsGitHubEnabledState(stored.github);
          setIsNpmEnabledState(stored.npm);
          setIsFhirEnabledState(stored.simplifier);
          setIsBuiltInEnabledState(stored.builtIn);
        }
      } catch (error) {
        logger.error('Failed to load registry toggles from storage', error);
      }
    };
    void loadToggles();
  }, []);

  // Load built-in registry definitions on mount
  useEffect(() => {
    const loadDefinitions = async () => {
      setIsLoadingDefinitions(true);
      try {
        const definitions = new Map<string, RegistryDefinition>();
        
        const [npm, github, simplifier] = await Promise.allSettled([
          loadBuiltInRegistry('npm'),
          loadBuiltInRegistry('github'),
          loadBuiltInRegistry('simplifier'),
        ]);

        if (npm.status === 'fulfilled') definitions.set('npm', npm.value);
        if (github.status === 'fulfilled') definitions.set('github', github.value);
        if (simplifier.status === 'fulfilled') definitions.set('simplifier', simplifier.value);

        setRegistryDefinitions(definitions);
      } catch (error) {
        logger.error('Failed to load registry definitions', error);
      } finally {
        setIsLoadingDefinitions(false);
      }
    };

    void loadDefinitions();
  }, []);

  // Load custom registries from localforage on mount
  useEffect(() => {
    const loadStoredRegistries = async () => {
      try {
        const stored = await localforage.getItem<{ url: string; enabled: boolean }[]>(STORAGE_KEY);
        if (!stored) return;
        
        // Load definitions for each stored registry
        const loadedRegistries = await Promise.all(
          stored.map(async (entry) => {
            try {
              const definition = await loadCustomRegistry(entry.url);
              return { ...entry, definition };
            } catch (error) {
              logger.error(`Failed to load custom registry: ${entry.url}`, error);
              return { ...entry, definition: null };
            }
          })
        );
        
        setCustomRegistries(loadedRegistries);
      } catch (error) {
        logger.error('Failed to load custom registries from storage', error);
      }
    };

    void loadStoredRegistries();
  }, []);

  // Load custom registry definition when URL changes (legacy single URL support)
  useEffect(() => {
    const loadCustomDef = async () => {
      if (customRegistryUrl) {
        try {
          const definition = await loadCustomRegistry(customRegistryUrl);
          setCustomRegistryDefinition(definition);
          logger.info(`Loaded custom registry: ${definition.name}`);
        } catch (error) {
          logger.error('Failed to load custom registry', error);
          setCustomRegistryDefinition(null);
        }
      } else {
        setCustomRegistryDefinition(null);
      }
    };

    void loadCustomDef();
  }, [customRegistryUrl]);

  const checkConnection = useCallback(async () => {
    try {
      if (customRegistryUrl) {
        const response = await fetch(customRegistryUrl, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error('Custom registry URL is unreachable');
        }
      }
      setIsConnected(true);
    } catch (error) {
      console.error('Error connecting to registry:', error);
      setIsConnected(false);
    }
  }, [customRegistryUrl]);

  useEffect(() => {
    if (!hasCheckedConnection.current) {
      void checkConnection();
      hasCheckedConnection.current = true;
    }
  }, [checkConnection]);

  /**
   * Add a custom registry by URL
   * Will attempt to discover definition via .well-known/guido.json
   */
  const addCustomRegistry = async (url: string, providedDefinition?: RegistryDefinition): Promise<void> => {
    // Check if already exists
    if (customRegistries.some(r => r.url === url)) {
      throw new Error('Registry already added');
    }

    let definition: RegistryDefinition | null = providedDefinition || null;
    
    if (!definition) {
      try {
        definition = await loadCustomRegistry(url);
      } catch (error) {
        logger.warn(`Could not load registry definition for ${url}`, error);
        // Create a minimal definition for the URL
        definition = {
          name: 'Custom Registry',
          description: `Custom registry at ${url}`,
          baseUrl: url,
          api: {}
        } as RegistryDefinition;
      }
    }

    const newEntry: CustomRegistryEntry = {
      url,
      definition,
      enabled: true,
    };

    const updatedRegistries = [...customRegistries, newEntry];
    setCustomRegistries(updatedRegistries);
    void saveCustomRegistriesToStorage(updatedRegistries);
    
    logger.info(`Added custom registry: ${definition?.name || url}`);
  };

  /**
   * Remove a custom registry by URL
   */
  const removeCustomRegistry = (url: string): void => {
    const updatedRegistries = customRegistries.filter(r => r.url !== url);
    setCustomRegistries(updatedRegistries);
    void saveCustomRegistriesToStorage(updatedRegistries);
    
    logger.info(`Removed custom registry: ${url}`);
  };

  /**
   * Toggle a custom registry enabled/disabled
   */
  const toggleCustomRegistry = (url: string, enabled: boolean): void => {
    const updatedRegistries = customRegistries.map(r => 
      r.url === url ? { ...r, enabled } : r
    );
    setCustomRegistries(updatedRegistries);
    void saveCustomRegistriesToStorage(updatedRegistries);
  };

  /**
   * Search all enabled registries and return unified results
   */
  const searchAllRegistries = async (query: string): Promise<void> => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const searchPromises: Promise<SearchResultItem[]>[] = [];

      // Search built-in registries
      if (isGitHubEnabled && registryDefinitions.has('github')) {
        const def = registryDefinitions.get('github')!;
        searchPromises.push(
          searchRegistry(def, query)
            .then(result => result.items.map(item => ({
              ...item,
              source: 'github' as BuiltInRegistryType,
              registryName: def.name,
            })))
            .catch(error => {
              logger.error('GitHub search failed', error);
              return [];
            })
        );
      }

      if (isNpmEnabled && registryDefinitions.has('npm')) {
        const def = registryDefinitions.get('npm')!;
        searchPromises.push(
          searchRegistry(def, query)
            .then(result => result.items.map(item => ({
              ...item,
              source: 'npm' as BuiltInRegistryType,
              registryName: def.name,
            })))
            .catch(error => {
              logger.error('NPM search failed', error);
              return [];
            })
        );
      }

      if (isFhirEnabled && registryDefinitions.has('simplifier')) {
        const def = registryDefinitions.get('simplifier')!;
        searchPromises.push(
          searchRegistry(def, query)
            .then(result => result.items.map(item => ({
              ...item,
              source: 'simplifier' as BuiltInRegistryType,
              registryName: def.name,
            })))
            .catch(error => {
              logger.error('Simplifier search failed', error);
              return [];
            })
        );
      }

      // Search custom registries
      for (const customReg of customRegistries) {
        if (customReg.enabled && customReg.definition) {
          searchPromises.push(
            searchRegistry(customReg.definition, query)
              .then(result => result.items.map(item => ({
                ...item,
                source: 'custom' as const,
                registryName: customReg.definition?.name || 'Custom',
              })))
              .catch(error => {
                logger.error(`Custom registry search failed: ${customReg.url}`, error);
                return [];
              })
          );
        }
      }

      const results = await Promise.all(searchPromises);
      let allResults = results.flat();
      
      // Search built-in templates (synchronous, no network call)
      if (isBuiltInEnabled) {
        const builtInResults = searchBuiltInTemplates(query);
        const builtInItems: SearchResultItem[] = builtInResults.map(entry => ({
          name: entry.name,
          description: entry.template?.description || '',
          source: 'builtIn' as BuiltInRegistryType,
          registryName: 'Built-in Templates',
          // Store the path for fetching later
          downloadUrl: entry.path,
        }));
        allResults = [...builtInItems, ...allResults]; // Built-in templates first
      }
      
      setSearchResults(allResults);
      logger.info(`Search completed: ${allResults.length} results from ${searchPromises.length + (isBuiltInEnabled ? 1 : 0)} sources`);
    } catch (error) {
      logger.error('Search failed', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get versions for a package from a specific registry
   */
  const getPackageVersions = async (
    item: SearchResultItem
  ): Promise<string[]> => {
    // Built-in templates don't have versions
    if (item.source === 'builtIn') {
      return [];
    }
    
    const definition = item.source === 'custom' 
      ? customRegistries.find(r => r.definition?.name === item.registryName)?.definition
      : registryDefinitions.get(item.source);

    if (!definition) {
      logger.warn(`No definition found for registry: ${item.source}`);
      return [];
    }

    try {
      return await getTemplateVersions(definition, item.name);
    } catch (error) {
      logger.error(`Failed to get versions for ${item.name}`, error);
      return [];
    }
  };

  /**
   * Fetch templates from a package (handles tarball extraction)
   */
  const fetchPackageTemplates = async (
    item: SearchResultItem,
    version?: string
  ): Promise<Template[]> => {
    // Handle built-in templates - direct load, no network call
    if (item.source === 'builtIn') {
      const template = await getBuiltInTemplate(item.downloadUrl || item.name);
      if (template) {
        return [template];
      }
      throw new Error(`Built-in template not found: ${item.name}`);
    }
    
    const definition = item.source === 'custom'
      ? customRegistries.find(r => r.definition?.name === item.registryName)?.definition
      : registryDefinitions.get(item.source);

    if (!definition) {
      throw new Error(`No definition found for registry: ${item.source}`);
    }

    try {
      // Fetch the template/package content
      const content = await fetchTemplate(definition, item.name, version);
      
      // Handle binary content (tarballs returned directly from fetchTemplate)
      if (content instanceof ArrayBuffer) {
        logger.debug(`Received ArrayBuffer (${content.byteLength} bytes), extracting templates...`);
        return await extractGuidosFromTarball(content);
      }
      
      // Handle NPM packages - content will be NPM metadata with versions.{version}.dist.tarball
      if (content && typeof content === 'object' && !Array.isArray(content)) {
        const contentObj = content as Record<string, unknown>;
        
        // Check if this is NPM metadata (has versions object with tarball URLs)
        if (contentObj.versions && typeof contentObj.versions === 'object') {
          const versions = contentObj.versions as Record<string, Record<string, unknown>>;
          const targetVersion = version || (contentObj['dist-tags'] as Record<string, string>)?.latest;
          const versionData = versions[targetVersion];
          
          if (versionData?.dist && typeof versionData.dist === 'object') {
            const tarballUrl = (versionData.dist as Record<string, string>).tarball;
            if (tarballUrl) {
              logger.debug(`Fetching NPM tarball: ${tarballUrl}`);
              return await fetchTarballFromUrl(tarballUrl);
            }
          }
        }
        
        // Check if it's a valid Guido Template (must have fields array AND ruleSets)
        // This distinguishes Guido templates from regular JSON config files
        if (isTemplate(contentObj)) {
          return [content as Template];
        }
        
        // If it's a JSON object but NOT a valid Guido template, 
        // offer it as an alternative config file to import as settings
        const fileName = item.name.split('/').pop() || 'config.json';
        const jsonContent = JSON.stringify(content, null, 2);
        throw new NoGuidoTemplatesError(
          [{ name: fileName, path: item.name, size: jsonContent.length }],
          new TextEncoder().encode(jsonContent).buffer,
          true // Mark as raw content, not a tarball
        );
      }
      
      // If content is already an array of templates
      if (Array.isArray(content)) {
        // Validate each item is a proper Guido template
        const validTemplates = content.filter(t => isTemplate(t));
        if (validTemplates.length > 0) {
          return validTemplates;
        }
        
        // Check if this is a GitHub directory listing (array of file objects with 'name', 'path', 'type')
        const isGitHubDirectoryListing = content.length > 0 && 
          content.every((f: unknown) => 
            typeof f === 'object' && f !== null && 
            'name' in f && 'path' in f && 'type' in f
          );
        
        if (isGitHubDirectoryListing) {
          // Extract config files from the directory listing
          const configFiles = (content as Array<{ name: string; path: string; type: string; size?: number; download_url?: string }>)
            .filter(f => f.type === 'file' && CONFIG_FILE_PATTERNS.test(f.name))
            .filter(f => !f.name.startsWith('.') && 
                        f.name !== 'package.json' && 
                        f.name !== 'tsconfig.json' &&
                        f.name !== 'package-lock.json')
            .map(f => ({
              name: f.name,
              path: f.path,
              size: f.size || 0,
              downloadUrl: f.download_url,
            }));
          
          if (configFiles.length > 0) {
            // Store the directory listing for later file fetching
            throw new NoGuidoTemplatesError(
              configFiles,
              new TextEncoder().encode(JSON.stringify(content)).buffer,
              true // Mark as raw content (the directory listing JSON)
            );
          }
        }
      }

      // If we got a download URL from the item, try to fetch the tarball
      if (item.downloadUrl) {
        return await fetchTarballFromUrl(item.downloadUrl);
      }

      throw new Error('Could not extract template from package');
    } catch (error) {
      logger.error(`Failed to fetch templates for ${item.name}`, error);
      throw error;
    }
  };

  /**
   * Fetch and extract templates from a tarball URL
   */
  const fetchTarballFromUrl = async (url: string): Promise<Template[]> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch tarball: ${response.statusText}`);
    }

    const tarball = await response.arrayBuffer();
    return extractGuidosFromTarball(tarball);
  };

  // Regex patterns for config files we can import as settings
  const CONFIG_FILE_PATTERNS = /\.(json|yml|yaml|txt|properties|env|config|ini|conf|xml|toml)$/i;

  /**
   * Extract .guido.json files from a tarball
   * If none found, throws NoGuidoTemplatesError with list of alternative config files
   */
  const extractGuidosFromTarball = async (tarball: ArrayBuffer): Promise<Template[]> => {
    const dataStream = new ReadableStream({
      start(controller) {
        controller.enqueue(tarball);
        controller.close();
      },
    });

    const decompressionStream = dataStream.pipeThrough<Uint8Array>(new DecompressionStream('gzip'));
    const decompressed = await new Response(decompressionStream).arrayBuffer();
    const untared = await TarReader.load(decompressed);

    const result: Template[] = [];
    const alternatives: AlternativeFile[] = [];

    for (const entry of untared.fileInfos) {
      // Skip directories (they end with /)
      if (entry.name.endsWith('/')) continue;
      
      if (entry.name.endsWith('.guido.json')) {
        const templateData = untared.getTextFile(entry.name);
        if (templateData) {
          const template = JSON.parse(templateData) as Template;
          result.push(template);
        }
      } else if (CONFIG_FILE_PATTERNS.test(entry.name)) {
        // Collect alternative config files (exclude package.json and other meta files)
        const fileName = entry.name.split('/').pop() || entry.name;
        if (!fileName.startsWith('.') && 
            fileName !== 'package.json' && 
            fileName !== 'tsconfig.json' &&
            fileName !== 'package-lock.json') {
          alternatives.push({
            name: fileName,
            path: entry.name,
            size: entry.size || 0,
          });
        }
      }
    }
    
    if (result.length === 0) {
      // Sort alternatives by name for consistent display
      alternatives.sort((a, b) => a.name.localeCompare(b.name));
      throw new NoGuidoTemplatesError(alternatives, tarball);
    }
    
    return result;
  };

  /**
   * Extract a specific file from a tarball and return its content
   * If isRawContent is true, the data is raw text (not a tarball)
   */
  const extractFileFromTarball = async (
    tarball: ArrayBuffer, 
    filePath: string,
    isRawContent = false
  ): Promise<string | null> => {
    // If it's raw content (e.g., JSON from GitHub), just decode and return
    if (isRawContent) {
      return new TextDecoder().decode(tarball);
    }
    
    const dataStream = new ReadableStream({
      start(controller) {
        controller.enqueue(tarball);
        controller.close();
      },
    });

    const decompressionStream = dataStream.pipeThrough<Uint8Array>(new DecompressionStream('gzip'));
    const decompressed = await new Response(decompressionStream).arrayBuffer();
    const untared = await TarReader.load(decompressed);

    return untared.getTextFile(filePath) || null;
  };

  return {
    // Connection state
    isConnected, 
    isLoading, 
    checkConnection,
    
    // Registry toggles
    setIsGitHubEnabled, 
    setIsNpmEnabled, 
    setIsFhirEnabled,
    setIsBuiltInEnabled,
    isGitHubEnabled, 
    isNpmEnabled, 
    isFhirEnabled,
    isBuiltInEnabled,
    
    // Custom registry (legacy single URL)
    customRegistryUrl,
    setCustomRegistryUrl,
    customRegistryDefinition,
    
    // Multiple custom registries
    customRegistries,
    addCustomRegistry,
    removeCustomRegistry,
    toggleCustomRegistry,
    
    // Registry definitions
    registryDefinitions,
    isLoadingDefinitions,
    
    // Search results
    searchResults,
    
    // New unified methods (using registry definitions)
    searchAllRegistries,
    getPackageVersions,
    fetchPackageTemplates,
    fetchTarballFromUrl,
    extractFileFromTarball,
  };
};

export default useRegistry;
export type { CustomRegistryEntry };