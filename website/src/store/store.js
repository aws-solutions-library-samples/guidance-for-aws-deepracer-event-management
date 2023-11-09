import { useCallback, useEffect, useState } from 'react';

let globalState = {};
let listeners = [];
let actions = {};

/**
 * low level custom hook for managing the global store.
 * use higher level hooks if possible ex: useUsers()
 * @returns array [state, dispatch] state is the global state, dispatch is the dispatch function for the store.
 *
 * @example
 * const [state, dispatch] = useStore();
 */
export const useStore = () => {
  const [, setState] = useState(globalState);

  const dispatch = useCallback((actionIdentifier, payload) => {
    const newState = actions[actionIdentifier](globalState, payload);
    globalState = { ...globalState, ...newState };

    for (const listener of listeners) {
      listener(globalState);
    }
  }, []);

  useEffect(() => {
    listeners.push(setState);

    return () => {
      listeners = listeners.filter((li) => li !== setState);
    };
  }, []);

  return [globalState, dispatch];
};

export const initStore = (userActions, initialState) => {
  if (initialState) {
    globalState = { ...globalState, ...initialState };
  }
  actions = { ...actions, ...userActions };
};
