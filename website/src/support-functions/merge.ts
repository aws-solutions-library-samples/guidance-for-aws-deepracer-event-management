// Helper functions

/**
 * Deep merge two objects
 * @param target The target object to merge into
 * @param source The source object to merge from
 * @returns The merged object
 */
export function merge<T extends Record<string, any>>(
  target: T | null | undefined,
  source: Partial<T>
): T {
  // iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    if (sourceValue !== null && sourceValue !== undefined && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      const targetValue = target?.[key as keyof T];
      Object.assign(sourceValue, merge(targetValue as any, sourceValue as any));
    }
  }

  // join `target` and modified `source`
  Object.assign(target || {}, source);
  return target as T;
}
