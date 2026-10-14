import type { Field, FieldValue } from '@quotentiroler/guido-types';

const isScalarItem = (v: unknown): v is string | number => typeof v === 'string' || typeof v === 'number';

/** The items of a list value (an array, or a string holding a JSON array); null for a scalar. */
export const listItems = (value: FieldValue | undefined): (string | number)[] | null => {
  if (Array.isArray(value)) return [...value];
  if (typeof value !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(isScalarItem) ? parsed : null;
  } catch {
    return null;
  }
};

/** Whether a value holds the item: a list element, or for a string scalar the value itself. Never a substring. */
export const hasItem = (value: FieldValue | undefined, item: string): boolean => {
  const items = listItems(value);
  return items ? items.map(String).includes(item) : typeof value === 'string' && value === item;
};

/** Store items back in the field's own list form: an array stays an array, a JSON string stays a string. */
export const writeItems = (field: Field, items: (string | number)[]): void => {
  if (!Array.isArray(field.value)) {
    field.value = JSON.stringify(items);
    return;
  }
  const numbers = items.filter((v): v is number => typeof v === 'number');
  field.value = numbers.length === items.length ? numbers : items.map(String);
};
