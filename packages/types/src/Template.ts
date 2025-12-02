/**
 * Template Types - Re-exported from Zod schemas (source of truth).
 * This file keeps the isTemplate() type guard.
 * 
 * @see schemas.ts for the canonical Zod schema definitions.
 */

// ============================================================================
// Types from Zod Schemas (source of truth)
// ============================================================================

export type { Template } from './schemas.js';

import type { Template } from './schemas.js';

/**
 * Type guard to check if an unknown value is a valid Guido Template.
 * Performs a quick structural check without deep validation.
 */
export function isTemplate(obj: unknown): obj is Template {
    if (!obj || typeof obj !== 'object') return false;
    const t = obj as Partial<Template>;
    return Array.isArray(t.fields) && t.fields.length > 0 && Array.isArray(t.ruleSets);
}
