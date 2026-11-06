import { createLogger } from '@quotentiroler/guido-logger';

export const logger = createLogger({
  enabled: import.meta.env.DEV,
  prefix: '[Guido]',
  showTimestamp: true,
});
