import { type FieldRange, parseRange, type ParsedRange } from '@quotentiroler/guido-types';

/**
 * Translates a technical range specification to a user-friendly description.
 * 
 * @param range - The range specification (DSL string)
 * @returns A human-readable description of what values are accepted
 * 
 * @example
 * translateRangeToHumanReadable('string')           // 'Any text'
 * translateRangeToHumanReadable('boolean')          // 'Yes or No (true/false)'
 * translateRangeToHumanReadable('integer(1..100)')  // 'A whole number between 1 and 100'
 * translateRangeToHumanReadable('string[]')         // 'A list of text values'
 * translateRangeToHumanReadable('debug||info||warn')// 'One of: debug, info, warn'
 */
export const translateRangeToHumanReadable = (range: FieldRange): string => {
  if (!range || range.trim() === '') {
    return 'Any value';
  }

  const parsed = parseRange(range);
  return formatParsedRange(parsed);
};

/**
 * Format a parsed range into human-readable text.
 */
function formatParsedRange(parsed: ParsedRange): string {
  switch (parsed.rangeType) {
    case 'scalar':
      return formatScalarRange(parsed);
    case 'array':
      return formatArrayRange(parsed);
    case 'enum':
      return formatEnumRange(parsed);
    case 'enum-array':
      return formatEnumArrayRange(parsed);
    case 'pattern':
      return formatPatternRange(parsed);
  }
}

/**
 * Format scalar ranges (string, boolean, integer, url) with optional bounds.
 */
function formatScalarRange(range: { dataType: string; min?: number; max?: number }): string {
  const { dataType, min, max } = range;

  switch (dataType) {
    case 'string':
      if (min !== undefined && max !== undefined) {
        if (min === max) {
          return `Text with exactly ${min} character${min !== 1 ? 's' : ''}`;
        }
        return `Text between ${min} and ${max} characters`;
      }
      if (min !== undefined) {
        return `Text with at least ${min} character${min !== 1 ? 's' : ''}`;
      }
      if (max !== undefined) {
        return `Text with up to ${max} character${max !== 1 ? 's' : ''}`;
      }
      return 'Any text';

    case 'boolean':
      return 'Yes or No (true/false)';

    case 'url':
      return 'A valid web address (URL)';

    case 'integer':
      if (min !== undefined && max !== undefined) {
        return `A whole number between ${min} and ${max}`;
      }
      if (min !== undefined) {
        return `A whole number of ${min} or more`;
      }
      if (max !== undefined) {
        return `A whole number up to ${max}`;
      }
      return 'A whole number';

    default:
      return 'Any value';
  }
}

/**
 * Format array ranges with optional size constraints.
 */
function formatArrayRange(range: { itemType: 'string' | 'integer'; minSize?: number; maxSize?: number }): string {
  const { itemType, minSize, maxSize } = range;
  const itemDescription = itemType === 'string' ? 'text values' : 'whole numbers';

  if (minSize !== undefined && maxSize !== undefined) {
    if (minSize === maxSize) {
      return `A list of exactly ${minSize} ${itemDescription}`;
    }
    return `A list of ${minSize} to ${maxSize} ${itemDescription}`;
  }
  if (minSize !== undefined) {
    return `A list of at least ${minSize} ${itemDescription}`;
  }
  if (maxSize !== undefined) {
    return `A list of up to ${maxSize} ${itemDescription}`;
  }
  return `A list of ${itemDescription}`;
}

/**
 * Format enum ranges (list of allowed options).
 */
function formatEnumRange(range: { options: string[] }): string {
  const { options } = range;
  
  if (options.length === 0) {
    return 'Any value';
  }
  if (options.length === 1) {
    return `Must be: ${options[0]}`;
  }
  if (options.length === 2) {
    return `Either "${options[0]}" or "${options[1]}"`;
  }
  if (options.length <= 5) {
    return `One of: ${options.join(', ')}`;
  }
  // For many options, show first few and count
  const shown = options.slice(0, 3).join(', ');
  return `One of: ${shown}, ... (${options.length} options)`;
}

/**
 * Format enum array ranges (list of multiple allowed options).
 */
function formatEnumArrayRange(range: { options: string[]; minSize?: number; maxSize?: number }): string {
  const { options, minSize, maxSize } = range;
  
  let optionsDesc: string;
  if (options.length === 0) {
    optionsDesc = 'any values';
  } else if (options.length <= 5) {
    optionsDesc = options.join(', ');
  } else {
    const shown = options.slice(0, 3).join(', ');
    optionsDesc = `${shown}, ... (${options.length} options)`;
  }
  
  let sizeConstraint = '';
  if (minSize !== undefined && maxSize !== undefined) {
    if (minSize === maxSize) {
      sizeConstraint = ` (exactly ${minSize})`;
    } else {
      sizeConstraint = ` (${minSize} to ${maxSize} items)`;
    }
  } else if (minSize !== undefined) {
    sizeConstraint = ` (at least ${minSize})`;
  } else if (maxSize !== undefined) {
    sizeConstraint = ` (up to ${maxSize})`;
  }
  
  return `Multiple of: ${optionsDesc}${sizeConstraint}`;
}

const DIGIT = String.raw`(?:\\d|\[0-9\])`;
const CHAR_CLASS = /\[(?:\\.|[^\]\\])*\]/g;
const HEX_CLASS = /\[(?=[^\]]*(?:0-9|\\d))(?=[^\]]*(?:a-f|A-F))[^\]]*\]/;
const SIMPLE_CLASS = /^\^?\[([^\]]+)\](?:[+*?]|\{\d+(?:,\d*)?\})?\$?$/;
const DIGITS_ONLY = /^\^?\\d(?:[+*?]|\{\d+(?:,\d*)?\})?\$?$/;
const UUID = /\{8\}.*\{4\}.*\{4\}.*\{4\}.*\{12\}/;
const IP_ADDRESS = /\{1,3\}.*\\\..*\{1,3\}/;
const DATE = new RegExp(String.raw`${DIGIT}\{4\}.*${DIGIT}\{2\}.*${DIGIT}\{2\}`);
const VERSION = new RegExp(String.raw`${DIGIT}\+\\\.${DIGIT}\+\\\.${DIGIT}\+`);

const outsideCharClasses = (regex: string): string => regex.replace(CHAR_CLASS, '');

const PATTERN_DESCRIPTIONS: ReadonlyArray<{ matches: (regex: string) => boolean; description: string }> = [
  { matches: (r) => UUID.test(r), description: 'A unique identifier (UUID/GUID)' },
  { matches: (r) => outsideCharClasses(r).includes('#') && HEX_CLASS.test(r), description: 'A color code (e.g., #FF5733)' },
  { matches: (r) => outsideCharClasses(r).includes('@'), description: 'A valid email address' },
  { matches: (r) => DATE.test(r), description: 'A date' },
  { matches: (r) => IP_ADDRESS.test(r), description: 'An IP address' },
  { matches: (r) => VERSION.test(r), description: 'A version number (e.g., 1.0.0)' },
  { matches: (r) => DIGITS_ONLY.test(r), description: 'Numbers only' },
];

function describeCharClass(content: string): string {
  const letters = /a-z|A-Z/.test(content);
  const digits = /0-9|\\d/.test(content);
  if (content.replace(/a-z|A-Z|0-9|\\d/g, '') === '') {
    if (letters && digits) return 'Letters and numbers only';
    if (letters) return 'Letters only';
    if (digits) return 'Numbers only';
  }
  return `Text containing only: ${content}`;
}

/** Describe a regex by its structure (anchors, classes, quantifiers), never by characters it happens to contain. */
function formatPatternRange({ regex }: { regex: string }): string {
  const known = PATTERN_DESCRIPTIONS.find(({ matches }) => matches(regex));
  if (known) return known.description;

  const simpleCharClass = regex.match(SIMPLE_CLASS);
  if (simpleCharClass) return describeCharClass(simpleCharClass[1]);

  const lengthMatch = regex.match(/\{(\d+),?(\d*)?\}/);
  if (lengthMatch) {
    const [, min, max] = lengthMatch;
    return max
      ? `Text matching a specific format (${min}-${max} characters)`
      : `Text matching a specific format (${min}+ characters)`;
  }

  return 'Text matching a specific format';
}
