/**
 * JSON Schema type definitions.
 * 
 * This is a subset of JSON Schema Draft 2020-12 that Guido supports
 * for conversion between Guido templates and JSON Schema.
 */

/**
 * JSON Schema structure for configuration validation.
 * 
 * @see https://json-schema.org/specification
 */
export interface JSONSchema {
  // Schema metadata
  $schema?: string;
  $id?: string;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  definitions?: Record<string, JSONSchema>;
  
  // Annotations
  title?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];
  $comment?: string;
  
  // Type constraints
  type?: string | string[];
  enum?: (string | number | boolean)[];
  const?: unknown;
  
  // String constraints
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  
  // Number constraints
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;
  
  // Object constraints
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  propertyNames?: JSONSchema;
  minProperties?: number;
  maxProperties?: number;
  
  // Array constraints
  items?: JSONSchema | JSONSchema[];
  prefixItems?: JSONSchema[];
  contains?: JSONSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  
  // Schema composition
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  not?: JSONSchema;
  
  // Conditional schemas
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  
  // Dependencies (legacy and modern)
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, JSONSchema>;
  dependencies?: Record<string, string[] | JSONSchema>;
}

/**
 * Context for tracking schema conversion state.
 */
export interface SchemaConversionContext {
  /** Schema definitions ($defs or definitions) */
  definitions: Record<string, JSONSchema>;
  /** The root schema being converted */
  rootSchema: JSONSchema;
  /** Warnings encountered during conversion */
  warnings: string[];
}
