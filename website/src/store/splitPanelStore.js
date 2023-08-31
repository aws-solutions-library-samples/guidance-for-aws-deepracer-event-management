import { initStore } from './store';

const splitPanelDefaultSettings = {
  isOpen: false,
  content: <></>,
};

const configureStore = () => {
  const actions = {
    SPLIT_PANEL_IS_OPEN: (curState, isOpen) => {
      console.debug('SPLIT_PANEL_IS_OPEN DISPATCH FUNCTION');
      const updatedSplitPanel = { ...curState.splitPanel };
      updatedSplitPanel.isOpen = isOpen;
      return { splitPanel: updatedSplitPanel };
    },
    UPDATE_SPLIT_PANEL: (curState, settings) => {
      console.debug('UPDATE_SPLIT_PANEL DISPATCH FUNCTION');
      return { splitPanel: settings };
    },
    RESET_SPLIT_PANEL: () => {
      console.debug('RESET_SPLIT_PANEL DISPATCH FUNCTION');
      return { splitPanel: splitPanelDefaultSettings };
    },
  };

  initStore(actions, { splitPanel: splitPanelDefaultSettings });
};

export default configureStore;
