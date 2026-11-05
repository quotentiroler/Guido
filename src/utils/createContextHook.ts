import { useContext, type Context } from 'react';

export function createContextHook<T>(context: Context<T | undefined>, hookName: string, providerName: string): () => T {
  const useContextHook = (): T => {
    const value = useContext(context);
    if (value === undefined) {
      throw new Error(`${hookName} must be used within ${providerName}`);
    }
    return value;
  };
  return useContextHook;
}
