/**
 * @guido/core - Configuration formats
 */

export { serializeIni, parseIni } from './ini.js';
export type { IniSerializeOptions } from './ini.js';

export { serializeArgs, parseArgs } from './args.js';
export type { ArgsSerializeOptions } from './args.js';

export { serializeKeyValue, parseKeyValueFormat } from './keyValue.js';
export type { KeyValueSerializeOptions } from './keyValue.js';

export {
  CONFIG_FORMATS,
  serializeFields,
  parseSettings,
  detectFormat,
  formatMeta,
} from './registry.js';
export type { ConfigFormat, FormatMeta, SerializeOptions } from './registry.js';
