import { createContext } from 'react';

const SideNavContext = createContext({
  navigationOpen: true,
  setNavigationOpen: undefined,
});

export default SideNavContext;
