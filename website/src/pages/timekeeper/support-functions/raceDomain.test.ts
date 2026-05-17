import { describe, expect, it } from 'vitest';
import { extractUserAttribute } from './raceDomain';

describe('extractUserAttribute', () => {
  const attributes = [
    { Name: 'custom:countryCode', Value: 'GB' },
    { Name: 'email', Value: 'test@example.com' },
  ];

  it('returns value for existing attribute', () => {
    expect(extractUserAttribute(attributes, 'custom:countryCode')).toBe('GB');
  });

  it('returns undefined for missing attribute', () => {
    expect(extractUserAttribute(attributes, 'custom:missing')).toBeUndefined();
  });

  it('returns undefined for undefined attributes array', () => {
    expect(extractUserAttribute(undefined, 'custom:countryCode')).toBeUndefined();
  });

  it('returns undefined for empty attributes array', () => {
    expect(extractUserAttribute([], 'custom:countryCode')).toBeUndefined();
  });
});
