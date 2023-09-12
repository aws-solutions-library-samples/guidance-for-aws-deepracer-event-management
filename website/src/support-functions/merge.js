// Helper functions
export function merge(target, source) {
  // iterate through `source` properties and if an `Object` set property to merge of `target` and `source` properties
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object) {
      Object.assign(source[key], merge(target[key], source[key]));
    }
  }

  // join `target` and modified `source`
  Object.assign(target || {}, source);
  return target;
}
