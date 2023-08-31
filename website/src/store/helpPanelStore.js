import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { initStore } from './store';

const helpPanelDefaultSettings = {
  isOpen: false,
  isHidden: true,
  content: <SimpleHelpPanelLayout headerContent="No info available" />,
};

const configureStore = () => {
  const actions = {
    HELP_PANEL_IS_OPEN: (curState, isOpen) => {
      console.debug('HELP_PANEL_IS_OPEN DISPATCH FUNCTION', isOpen);
      const updatedSplitPanel = { ...curState.helpPanel };
      updatedSplitPanel.isOpen = isOpen;
      return { helpPanel: updatedSplitPanel };
    },
    UPDATE_HELP_PANEL: (curState, settings) => {
      console.debug('UPDATE_HELP_PANEL DISPATCH FUNCTION', settings);
      return { helpPanel: { ...curState.helpPanel, ...settings } };
    },
    RESET_HELP_PANEL: () => {
      console.debug('RESET_HELP_PANEL DISPATCH FUNCTION');
      return { helpPanel: helpPanelDefaultSettings };
    },
  };

  initStore(actions, { helpPanel: helpPanelDefaultSettings });
};

export default configureStore;
