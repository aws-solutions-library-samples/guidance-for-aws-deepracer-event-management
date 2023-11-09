import { initStore } from './store';

const configureStore = () => {
  const actions = {
    SIDE_NAV_IS_OPEN: (curState, isOpen) => {
      console.debug('SIDE_NAV_IS_OPEN DISPATCH FUNCTION', isOpen);
      const updatedSideNav = { ...curState.sideNav };
      updatedSideNav.isOpen = isOpen;
      return { sideNav: updatedSideNav };
    },
  };

  initStore(actions, { sideNav: { isOpen: true } });
};

export default configureStore;
