import { parseRange, type Field, type FieldValue } from '@quotentiroler/guido-types';
import { listItems } from '../membership.js';

type ItemType = 'string' | 'integer';

const listItemType = (range: string): ItemType | null => {
  if (!range) return null;
  const parsed = parseRange(range);
  if (parsed.rangeType === 'array') return parsed.itemType;
  if (parsed.rangeType === 'enum-array') return 'string';
  return null;
};

const toList = (items: string[], itemType: ItemType): FieldValue => {
  const trimmed = items.map((item) => item.trim()).filter((item) => item !== '');
  return itemType === 'integer' && trimmed.every((item) => /^-?\d+$/.test(item)) ? trimmed.map(Number) : trimmed;
};

const asList = (value: FieldValue, itemType: ItemType): FieldValue => {
  if (Array.isArray(value)) return toList(value.map(String), itemType);
  if (typeof value !== 'string' || value.trim() === '' || listItems(value)) return value;
  return toList(value.split(','), itemType);
};

/** Flat formats have no list syntax: a comma-separated value of an array-typed field becomes its items. */
export const splitListValues = (settings: Record<string, FieldValue>, fields: readonly Field[]): Record<string, FieldValue> => {
  const result = { ...settings };
  for (const field of fields) {
    const itemType = listItemType(field.range);
    if (itemType && field.name in result) result[field.name] = asList(result[field.name], itemType);
  }
  return result;
};
