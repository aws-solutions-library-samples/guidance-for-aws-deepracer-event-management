// Helper functions
// TODO solve deep merge of objects using standard lib like lodash to avoid copy right issues, code copied from stackoverflow
function clone(obj, isStrictlySafe = false) {
  /* Clones an object. First attempt is safe. If it errors (e.g. from a circular reference),
          'isStrictlySafe' determines if error is thrown or an unsafe clone is returned. */
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (err) {
    if (isStrictlySafe) {
      throw new Error(err);
    }
    // console.warn(`Unsafe clone of object`, obj);
    return { ...obj };
  }
}

export function merge(target, source, { isMutatingOk = false, isStrictlySafe = false } = {}) {
  /* Returns a deep merge of source into target.
          Does not mutate target unless isMutatingOk = true. */
  target = isMutatingOk ? target : clone(target, isStrictlySafe);
  for (const [key, val] of Object.entries(source)) {
    if (val !== null && typeof val === `object`) {
      if (target[key] === undefined) {
        target[key] = new val.__proto__.constructor();
      }
      /* even where isMutatingOk = false, recursive calls only work on clones, so they can always
              safely mutate --- saves unnecessary cloning */
      target[key] = merge(target[key], val, { isMutatingOk: true, isStrictlySafe });
    } else {
      target[key] = val;
    }
  }
  return target;
}
