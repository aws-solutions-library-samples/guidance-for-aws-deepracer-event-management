import { initStore } from './store';
import { GlobalState } from './storeTypes';

const configureStore = (): void => {
  const actions = {
    SIDE_NAV_IS_OPEN: (curState: GlobalState, isOpen: boolean): Partial<GlobalState> => {
      console.debug('SIDE_NAV_IS_OPEN DISPATCH FUNCTION', isOpen);
      const updatedSideNav = { ...curState.sideNav, isOpen };
      return { sideNav: updatedSideNav };
    },
  };

  initStore(actions, { sideNav: { isOpen: true } });
};

export default configureStore;
