import { describe, it, expect } from 'vitest';
import { translateRangeToHumanReadable } from './index.js';

describe('translateRangeToHumanReadable for patterns', () => {
  it.each([
    ['^#[0-9a-fA-F]{6}$'],
    ['^#?([A-Fa-f0-9]{3}){1,2}$'],
  ])('labels the colour pattern %s a colour code', (range) => {
    expect(translateRangeToHumanReadable(range)).toBe('A color code (e.g., #FF5733)');
  });

  it.each([
    ['^sha256-[A-Za-z0-9+/=]{44}$'],
    ['^[a-z]{2,3}-abc$'],
    ['^(?=.*[0-9])(?=.*[!@#$%^&*]).*$'],
  ])('does not call %s a colour code', (range) => {
    expect(translateRangeToHumanReadable(range)).not.toBe('A color code (e.g., #FF5733)');
  });

  it.each([
    ['^[^@\\s]+@[^@\\s]+$', 'A valid email address'],
    ['^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', 'A unique identifier (UUID/GUID)'],
    ['^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$', 'An IP address'],
    ['^\\d{4}-\\d{2}-\\d{2}$', 'A date'],
    ['^\\d+\\.\\d+\\.\\d+$', 'A version number (e.g., 1.0.0)'],
    ['^[A-Z]{3}$', 'Letters only'],
    ['^[a-zA-Z0-9]+$', 'Letters and numbers only'],
    ['^\\d+$', 'Numbers only'],
  ])('describes %s as %s', (range, description) => {
    expect(translateRangeToHumanReadable(range)).toBe(description);
  });

  it.each([
    ['^profile-[a-z]+$'],
    ['^(add|commit)$'],
    ['^address-[0-9]+$'],
  ])('reads %s by its structure, not by words it happens to contain', (range) => {
    expect(translateRangeToHumanReadable(range)).toBe('Text matching a specific format');
  });
});
