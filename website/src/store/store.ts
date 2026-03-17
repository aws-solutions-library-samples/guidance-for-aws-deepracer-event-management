import { useCallback, useEffect, useState } from 'react';
import { GlobalState } from './storeTypes';

// Store types - using typed state with flexible action handlers during migration
// TODO: Fully migrate to discriminated union of action types
type ActionIdentifier = string;
type ActionHandler = (state: GlobalState, payload: any) => Partial<GlobalState>;
type Actions = Record<ActionIdentifier, ActionHandler>;
type Listener = (state: GlobalState) => void;

export type Dispatch = (actionIdentifier: ActionIdentifier, payload?: any) => void;
type DispatchFunction = Dispatch;

let globalState: GlobalState = {};
let listeners: Listener[] = [];
let actions: Actions = {};

/**
 * low level custom hook for managing the global store.
 * use higher level hooks if possible ex: useUsers()
 * @returns array [state, dispatch] state is the global state, dispatch is the dispatch function for the store.
 *
 * @example
 * const [state, dispatch] = useStore();
 */
export const useStore = (): [GlobalState, DispatchFunction] => {
  const [, setState] = useState(globalState);

  const dispatch: DispatchFunction = useCallback((actionIdentifier, payload) => {
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

export const initStore = (userActions: Actions, initialState?: Partial<GlobalState>): void => {
  if (initialState) {
    globalState = { ...globalState, ...initialState };
  }
  actions = { ...actions, ...userActions };
};
