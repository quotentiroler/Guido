import { 
  RegistryDefinition, 
  RegistryItem, 
  RegistrySearchResult,
  EndpointConfig,
  BuiltInRegistryType
} from '@guido/types';
import { logger } from './logger';

/**
 * Cache for loaded registry definitions
 */
const registryCache = new Map<string, RegistryDefinition>();

/**
 * Get the base path for public assets (respects Vite's base config)
 */
function getBasePath(): string {
  // import.meta.env.BASE_URL is automatically set by Vite based on the 'base' config
  const basePath = import.meta.env.BASE_URL || '/';
  // Ensure it ends with a slash
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

/**
 * Load a built-in registry definition from the public folder
 */
export async function loadBuiltInRegistry(type: BuiltInRegistryType): Promise<RegistryDefinition> {
  const cacheKey = `builtin:${type}`;
  
  if (registryCache.has(cacheKey)) {
    return registryCache.get(cacheKey)!;
  }

  const basePath = getBasePath();
  const url = `${basePath}registries/${type}.registry.json`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load registry definition for ${type}: ${response.statusText}`);
  }

  const definition = await response.json() as RegistryDefinition;
  registryCache.set(cacheKey, definition);
  
  return definition;
}

/**
 * Load a custom registry definition from a URL
 */
export async function loadCustomRegistry(url: string): Promise<RegistryDefinition> {
  const cacheKey = `custom:${url}`;
  
  if (registryCache.has(cacheKey)) {
    return registryCache.get(cacheKey)!;
  }

  // Try well-known endpoint first
  const wellKnownUrl = new URL('/.well-known/guido.json', url).toString();
  
  try {
    const response = await fetch(wellKnownUrl);
    if (response.ok) {
      const definition = await response.json() as RegistryDefinition;
      // Use the provided baseUrl or fall back to the custom URL
      if (definition.baseUrl === '{baseUrl}') {
        definition.baseUrl = url;
      }
      registryCache.set(cacheKey, definition);
      logger.debug(`Loaded custom registry from well-known: ${definition.name}`);
      return definition;
    }
  } catch {
    logger.debug(`No well-known endpoint found for ${url}, using template`);
  }

  // Fall back to template registry with the custom URL
  const basePath = getBasePath();
  const templateResponse = await fetch(`${basePath}registries/_template.registry.json`);
  if (!templateResponse.ok) {
    throw new Error('Failed to load template registry definition');
  }

  const template = await templateResponse.json() as RegistryDefinition;
  template.name = 'Custom Registry';
  template.baseUrl = url;
  
  registryCache.set(cacheKey, template);
  return template;
}

/**
 * Interpolate placeholders in a string
 */
function interpolate(template: string, values: Record<string, string | number | undefined>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value !== undefined ? String(value) : '';
  });
}

/**
 * Apply search filter to a query string based on endpoint filter config
 */
function applySearchFilter(query: string, filter?: EndpointConfig['filter']): string {
  // If no filter or filter is disabled, return query as-is
  if (!filter || filter.enabled === false) {
    return query;
  }
  
  let result = query;
  
  if (filter.prefix) {
    result = `${filter.prefix} ${result}`;
  }
  
  if (filter.suffix) {
    result = `${result} ${filter.suffix}`;
  }
  
  return result.trim();
}

/**
 * Extract value from object using a simple JSONPath-like expression
 * Supports: $.field, $.field.nested, $.array[*], $.array[*].field, $.array[0]
 */
function extractValue(obj: unknown, path: string): unknown {
  if (!path || path === '$') return obj;
  
  // Remove leading $. if present
  const normalizedPath = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path;
  
  if (!normalizedPath) return obj;

  const parts = normalizedPath.split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = obj;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (current === null || current === undefined) return undefined;
    
    if (part === '*') {
      // Array wildcard - return all items, then continue extracting remaining path from each
      let items: unknown[];
      if (Array.isArray(current)) {
        items = current;
      } else if (typeof current === 'object') {
        items = Object.values(current);
      } else {
        return undefined;
      }
      
      // If there are more path parts after *, extract them from each item
      const remainingParts = parts.slice(i + 1);
      if (remainingParts.length > 0) {
        const remainingPath = remainingParts.join('.');
        return items.map(item => extractValue(item, remainingPath));
      }
      return items;
    }

    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Map response data to RegistryItem using response mapping
 */
function mapResponseItem(data: unknown, mapping: EndpointConfig['response']['item']): RegistryItem {
  if (!mapping) {
    // Try to extract common fields directly
    const obj = data as Record<string, unknown>;
    const nameValue = obj.name ?? obj.Name ?? '';
    const versionValue = obj.version ?? obj.Version;
    const descValue = obj.description ?? obj.Description;
    const authorValue = obj.author;
    const distValue = obj.dist as Record<string, unknown> | undefined;
    
    const safeStr = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'number' || typeof val === 'boolean') return String(val);
      return JSON.stringify(val);
    };
    
    return {
      name: typeof nameValue === 'string' ? nameValue : JSON.stringify(nameValue),
      version: versionValue !== undefined ? (typeof versionValue === 'string' ? versionValue : JSON.stringify(versionValue)) : undefined,
      description: descValue !== undefined ? (typeof descValue === 'string' ? descValue : JSON.stringify(descValue)) : undefined,
      author: authorValue ? (typeof authorValue === 'object' ? safeStr((authorValue as Record<string, unknown>).name) : safeStr(authorValue)) : undefined,
      downloadUrl: obj.downloadUrl ? safeStr(obj.downloadUrl) : distValue?.tarball ? safeStr(distValue.tarball) : undefined,
      homepage: obj.homepage ? safeStr(obj.homepage) : undefined,
      repository: obj.repository ? (typeof obj.repository === 'string' ? obj.repository : JSON.stringify(obj.repository)) : undefined,
    };
  }

  const safeString = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    return JSON.stringify(val);
  };

  return {
    name: mapping.name ? safeString(extractValue(data, mapping.name)) : '',
    version: mapping.version ? safeString(extractValue(data, mapping.version)) || undefined : undefined,
    description: mapping.description ? safeString(extractValue(data, mapping.description)) || undefined : undefined,
    author: mapping.author ? safeString(extractValue(data, mapping.author)) || undefined : undefined,
    downloadUrl: mapping.downloadUrl ? safeString(extractValue(data, mapping.downloadUrl)) || undefined : undefined,
    homepage: mapping.homepage ? safeString(extractValue(data, mapping.homepage)) || undefined : undefined,
    repository: mapping.repository ? safeString(extractValue(data, mapping.repository)) || undefined : undefined,
  };
}

/**
 * Execute a registry API call
 */
async function executeEndpoint(
  baseUrl: string,
  endpoint: EndpointConfig,
  params: Record<string, string | number | undefined>,
  headers: Record<string, string> = {},
  authToken?: string,
  authConfig?: RegistryDefinition['auth']
): Promise<Response> {
  // Build URL with path interpolation
  // Note: For NPM scoped packages (@scope/name), we need to URL-encode the name in the path
  const encodedParams = { ...params };
  if (typeof params.name === 'string' && params.name.startsWith('@')) {
    // NPM scoped packages need URL encoding for the path
    encodedParams.name = encodeURIComponent(params.name);
  }
  const path = interpolate(endpoint.path, encodedParams);
  const url = new URL(path, baseUrl);

  // Add query parameters
  if (endpoint.queryParams) {
    for (const [key, value] of Object.entries(endpoint.queryParams)) {
      const interpolatedValue = interpolate(value, params);
      if (interpolatedValue) {
        url.searchParams.set(key, interpolatedValue);
      }
    }
  }

  // Build headers
  const requestHeaders: Record<string, string> = {
    ...headers,
    ...endpoint.headers,
  };

  // Add authentication
  if (authToken && authConfig && authConfig.type !== 'none') {
    if (authConfig.location === 'query' && authConfig.name) {
      url.searchParams.set(authConfig.name, authToken);
    } else if (authConfig.name) {
      const prefix = authConfig.prefix || '';
      requestHeaders[authConfig.name] = `${prefix}${authToken}`;
    }
  }

  logger.debug(`Registry API call: ${endpoint.method} ${url.toString()}`);

  const response = await fetch(url.toString(), {
    method: endpoint.method,
    headers: requestHeaders,
    body: endpoint.method === 'POST' && endpoint.body 
      ? JSON.stringify(interpolate(JSON.stringify(endpoint.body), params))
      : undefined,
  });

  return response;
}

/**
 * Search a registry for templates
 */
export async function searchRegistry(
  definition: RegistryDefinition,
  query: string,
  options: {
    limit?: number;
    offset?: number;
    page?: number;
    authToken?: string;
  } = {}
): Promise<RegistrySearchResult> {
  const endpoint = definition.api.search || definition.api.list;
  
  if (!endpoint) {
    throw new Error(`Registry ${definition.name} does not support search or list`);
  }

  const { limit = endpoint.pagination?.defaultLimit || 20, offset = 0, page = 1, authToken } = options;

  // Apply search filter if configured
  const filteredQuery = applySearchFilter(query, endpoint.filter);

  const response = await executeEndpoint(
    definition.baseUrl,
    endpoint,
    { query: filteredQuery, limit, offset, page },
    definition.headers || {},
    authToken,
    definition.auth
  );

  if (!response.ok) {
    throw new Error(`Registry search failed: ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  // Extract items using response mapping
  const itemsPath = endpoint.response.items || '$';
  const rawItems = extractValue(data, itemsPath);
  
  const items: RegistryItem[] = Array.isArray(rawItems)
    ? rawItems.map(item => mapResponseItem(item, endpoint.response.item))
    : [];

  // Extract total count if available
  const total = endpoint.response.total 
    ? Number(extractValue(data, endpoint.response.total)) 
    : undefined;

  logger.info(`Registry search: found ${items.length} items${total ? ` of ${total} total` : ''}`);

  return {
    items,
    total,
    hasMore: total ? (offset + items.length) < total : items.length === limit,
  };
}

/**
 * Fetch a specific template from a registry
 * Returns JSON data, ArrayBuffer (for tarballs), or extracted template content
 */
export async function fetchTemplate(
  definition: RegistryDefinition,
  name: string,
  version?: string,
  authToken?: string
): Promise<unknown> {
  const endpoint = definition.api.fetch;
  
  if (!endpoint) {
    throw new Error(`Registry ${definition.name} does not support fetching templates`);
  }

  // Parse owner/repo for GitHub-style names
  const [owner, repo] = name.includes('/') ? name.split('/') : [undefined, name];

  const response = await executeEndpoint(
    definition.baseUrl,
    endpoint,
    { name, version: version || 'latest', owner, repo },
    definition.headers || {},
    authToken,
    definition.auth
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }

  // Auto-detect content type and handle accordingly
  const contentType = response.headers.get('content-type') || '';
  
  // Binary content (tarballs, gzip, etc.) - return as ArrayBuffer
  if (
    contentType.includes('gzip') || 
    contentType.includes('octet-stream') || 
    contentType.includes('tar') ||
    contentType.includes('application/x-tgz')
  ) {
    logger.debug(`Fetching binary content (${contentType}) for ${name}`);
    return await response.arrayBuffer();
  }

  // JSON content - parse and extract
  const data = await response.json() as Record<string, unknown>;

  // Extract template content if mapping specified
  if (endpoint.response.template) {
    return extractValue(data, endpoint.response.template);
  }

  return data;
}

/**
 * Get available versions of a template
 */
export async function getTemplateVersions(
  definition: RegistryDefinition,
  name: string,
  authToken?: string
): Promise<string[]> {
  const endpoint = definition.api.versions;
  
  if (!endpoint) {
    // Fall back to fetch endpoint which might include version info
    logger.debug(`Registry ${definition.name} does not support version listing`);
    return [];
  }

  // Parse owner/repo for GitHub-style names
  const [owner, repo] = name.includes('/') ? name.split('/') : [undefined, name];

  const response = await executeEndpoint(
    definition.baseUrl,
    endpoint,
    { name, owner, repo },
    definition.headers || {},
    authToken,
    definition.auth
  );

  if (!response.ok) {
    throw new Error(`Failed to get versions: ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  // Extract versions using response mapping
  const itemsPath = endpoint.response.items || '$';
  const rawItems = extractValue(data, itemsPath);
  
  if (Array.isArray(rawItems)) {
    return rawItems.map(item => {
      if (typeof item === 'string') return item;
      if (endpoint.response.item?.version) {
        const val = extractValue(item, endpoint.response.item.version);
        return typeof val === 'string' ? val : typeof val === 'number' ? String(val) : '';
      }
      const itemObj = item as Record<string, unknown>;
      const version = itemObj.version;
      return typeof version === 'string' ? version : typeof version === 'number' ? String(version) : '';
    }).filter(Boolean);
  }

  // Handle object with version keys (like NPM's versions object)
  if (typeof rawItems === 'object' && rawItems !== null) {
    return Object.keys(rawItems);
  }

  return [];
}

/**
 * Clear the registry cache
 */
export function clearRegistryCache(): void {
  registryCache.clear();
  logger.debug('Registry cache cleared');
}

/**
 * Get all loaded registries
 */
export function getLoadedRegistries(): string[] {
  return Array.from(registryCache.keys());
}
