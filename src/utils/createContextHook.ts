import { useContext, Context } from 'react';

/**
 * Factory function to create type-safe context hooks with consistent error handling.
 * Eliminates boilerplate for context hook creation.
 * 
 * @example
 * // Before:
 * export const useAppContext = (): AppContextType => {
 *   const context = useContext(AppContext);
 *   if (!context) {
 *     throw new Error("useAppContext must be used within an AppProvider");
 *   }
 *   return context;
 * };
 * 
 * // After:
 * export const useAppContext = createContextHook(AppContext, 'AppProvider');
 */
export function createContextHook<T>(
  context: Context<T | undefined>,
  providerName: string
): () => T {
  const hookName = `use${providerName.replace('Provider', 'Context')}`;
  
  return function useContextHook(): T {
    const value = useContext(context);
    if (value === undefined) {
      throw new Error(`${hookName} must be used within a ${providerName}`);
    }
    return value;
  };
}
