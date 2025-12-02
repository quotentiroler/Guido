/**
 * Registry Definition Types
 * These types match the registry.schema.json format
 */

export type AuthType = 'none' | 'bearer' | 'apiKey' | 'basic';
export type AuthLocation = 'header' | 'query';
export type PaginationType = 'offset' | 'cursor' | 'page';
export type HttpMethod = 'GET' | 'POST';

export interface RegistryAuth {
  type: AuthType;
  location?: AuthLocation;
  name?: string;
  prefix?: string;
}

export interface PaginationConfig {
  type: PaginationType;
  params: {
    page?: string;
    limit?: string;
    offset?: string;
    cursor?: string;
  };
  defaultLimit?: number;
}

export interface ResponseItemMapping {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  downloadUrl?: string;
  homepage?: string;
  repository?: string;
}

export interface ResponseMapping {
  items?: string;
  item?: ResponseItemMapping;
  total?: string;
  template?: string;
}

export interface SearchFilter {
  /** Text to append to the search query (e.g., 'topic:guido-template') */
  suffix?: string;
  /** Text to prepend to the search query */
  prefix?: string;
  /** Whether the filter is enabled. Set to false to disable filtering. Default: true */
  enabled?: boolean;
}

export interface EndpointConfig {
  path: string;
  method: HttpMethod;
  filter?: SearchFilter;
  queryParams?: Record<string, string>;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  pagination?: PaginationConfig;
  response: ResponseMapping;
}

export interface TemplateDetection {
  filePattern?: string;
  keyword?: string;
  packageType?: string;
}

export interface RegistryDefinition {
  $schema?: string;
  name: string;
  description?: string;
  baseUrl: string;
  headers?: Record<string, string>;
  api: {
    search?: EndpointConfig;
    list?: EndpointConfig;
    fetch?: EndpointConfig;
    versions?: EndpointConfig;
  };
  auth?: RegistryAuth;
  templateDetection?: TemplateDetection;
}

/**
 * Registry search result item
 */
export interface RegistryItem {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  downloadUrl?: string;
  homepage?: string;
  repository?: string;
}

/**
 * Registry search response
 */
export interface RegistrySearchResult {
  items: RegistryItem[];
  total?: number;
  hasMore?: boolean;
}

/**
 * Built-in registry types
 */
export type BuiltInRegistryType = 'npm' | 'github' | 'simplifier' | 'builtIn';

/**
 * Registry configuration (used in app state)
 */
export interface RegistryConfig {
  type: BuiltInRegistryType | 'custom';
  enabled: boolean;
  customUrl?: string;
  customDefinition?: RegistryDefinition;
  authToken?: string;
}
