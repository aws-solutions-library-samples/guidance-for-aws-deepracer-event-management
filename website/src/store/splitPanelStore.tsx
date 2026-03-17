import React from 'react';
import { initStore } from './store';
import { GlobalState, SplitPanelState } from './storeTypes';

const splitPanelDefaultSettings: SplitPanelState = {
  isOpen: false,
  content: <></>,
};

/**
 * Configure the split panel store with typed actions
 */
const configureStore = (): void => {
  const actions = {
    SPLIT_PANEL_IS_OPEN: (curState: GlobalState, isOpen: boolean): Partial<GlobalState> => {
      console.debug('SPLIT_PANEL_IS_OPEN DISPATCH FUNCTION');
      const updatedSplitPanel: SplitPanelState = { ...curState.splitPanel };
      updatedSplitPanel.isOpen = isOpen;
      return { splitPanel: updatedSplitPanel };
    },
    UPDATE_SPLIT_PANEL: (curState: GlobalState, settings: SplitPanelState): Partial<GlobalState> => {
      console.debug('UPDATE_SPLIT_PANEL DISPATCH FUNCTION');
      return { splitPanel: settings };
    },
    RESET_SPLIT_PANEL: (): Partial<GlobalState> => {
      console.debug('RESET_SPLIT_PANEL DISPATCH FUNCTION');
      return { splitPanel: splitPanelDefaultSettings };
    },
  };

  initStore(actions, { splitPanel: splitPanelDefaultSettings });
};

export default configureStore;
