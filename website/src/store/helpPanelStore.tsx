import React from 'react';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { initStore } from './store';
import { GlobalState, HelpPanelState } from './storeTypes';

const helpPanelDefaultSettings: HelpPanelState = {
  isOpen: false,
  isHidden: true,
  content: <SimpleHelpPanelLayout headerContent="No info available" />,
};

/**
 * Configure the help panel store with typed actions
 */
const configureStore = (): void => {
  const actions = {
    HELP_PANEL_IS_OPEN: (curState: GlobalState, isOpen: boolean): Partial<GlobalState> => {
      console.debug('HELP_PANEL_IS_OPEN DISPATCH FUNCTION', isOpen);
      const updatedSplitPanel: HelpPanelState = { ...curState.helpPanel };
      updatedSplitPanel.isOpen = isOpen;
      return { helpPanel: updatedSplitPanel };
    },
    UPDATE_HELP_PANEL: (curState: GlobalState, settings: Partial<HelpPanelState>): Partial<GlobalState> => {
      console.debug('UPDATE_HELP_PANEL DISPATCH FUNCTION', settings);
      return { helpPanel: { ...curState.helpPanel, ...settings } };
    },
    RESET_HELP_PANEL: (): Partial<GlobalState> => {
      console.debug('RESET_HELP_PANEL DISPATCH FUNCTION');
      return { helpPanel: helpPanelDefaultSettings };
    },
  };

  initStore(actions, { helpPanel: helpPanelDefaultSettings });
};

export default configureStore;
