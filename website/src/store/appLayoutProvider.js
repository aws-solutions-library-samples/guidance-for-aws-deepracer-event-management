import { Flashbar } from '@cloudscape-design/components';
import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { useWindowSize } from '../hooks/useWindowsSize';

const NavigationOptionsHandler = (state, action) => {
  if (action.type === 'SIDE_NAV_IS_OPEN') {
    return { isOpen: action.value };
  }
  return { isOpen: true };
};

const sideNavOptionsContext = createContext();
export function useSideNavOptions() {
  return useContext(sideNavOptionsContext);
}

const sideNavOptionsDispatch = createContext();
export function useSideNavOptionsDispatch() {
  return useContext(sideNavOptionsDispatch);
}

const splitPanelOptionsContext = createContext();
export function useSplitPanelOptions() {
  return useContext(splitPanelOptionsContext);
}

const splitPanelOptionsDispatchContext = createContext();
export function useSplitPanelOptionsDispatch() {
  return useContext(splitPanelOptionsDispatchContext);
}

const toolsOptionsContext = createContext();
export function useToolsOptions() {
  return useContext(toolsOptionsContext);
}

const toolsOptionsDispatchContext = createContext();
export function useToolsOptionsDispatch() {
  return useContext(toolsOptionsDispatchContext);
}

const notificationContext = createContext();
export function useNotifications() {
  return useContext(notificationContext);
}

const notificationDispatchContext = createContext();
export function useNotificationsDispatch() {
  return useContext(notificationDispatchContext);
}

const splitPanelDefaultSettings = {
  isOpen: false,
  content: <></>,
};

const SplitPanelOptionsHandler = (state, action) => {
  if (action.type === 'UPDATE') {
    return { ...state, ...action.value };
  } else if (action.type === 'RESET') {
    return splitPanelDefaultSettings;
  }
};

const toolsDefaultSettings = {
  isOpen: false,
  isHidden: true,
  content: <SimpleHelpPanelLayout headerContent="No info available" />,
};

const ToolsOptionsHandler = (state, action) => {
  if (action.type === 'UPDATE') {
    return { ...state, ...action.value };
  } else if (action.type === 'RESET') {
    return { ...state, content: <SimpleHelpPanelLayout headerContent="No info available" /> };
  }
};

export const AppLayoutProvider = (props) => {
  const windowSize = useWindowSize();
  const [sideNavOptions, dispatchNavigationOptions] = useReducer(NavigationOptionsHandler, {
    isOpen: true,
  });
  const [splitPanelOptions, dispatchSplitPanelOptions] = useReducer(
    SplitPanelOptionsHandler,
    splitPanelDefaultSettings
  );

  const [toolOptions, dispatchToolOptions] = useReducer(ToolsOptionsHandler, toolsDefaultSettings);

  const [notifications, setNotifications] = useState([]);

  // open/close based on the window size
  useEffect(() => {
    if (windowSize.width < 900)
      dispatchNavigationOptions({ type: 'SIDE_NAV_IS_OPEN', value: false });
    else if (windowSize.width >= 900)
      dispatchNavigationOptions({ type: 'SIDE_NAV_IS_OPEN', value: true });
  }, [windowSize]);

  const addNotification = (notificationToAdd) => {
    setNotifications((notifications) => {
      const index = notifications.findIndex((index) => index.id === notificationToAdd.id);

      if (index === -1) return notifications.concat(notificationToAdd);
      else {
        const notificationsCopy = [...notifications];
        notificationsCopy[index] = notificationToAdd;
        return notificationsCopy;
      }
    });
  };

  const dismissNotification = (idToDismiss) => {
    console.info(idToDismiss);
    setNotifications((notifications) =>
      notifications.filter((notification) => notification.id !== idToDismiss)
    );
  };

  return (
    // this is the provider providing state
    <splitPanelOptionsContext.Provider value={splitPanelOptions}>
      <splitPanelOptionsDispatchContext.Provider value={dispatchSplitPanelOptions}>
        <sideNavOptionsContext.Provider value={sideNavOptions}>
          <sideNavOptionsDispatch.Provider value={dispatchNavigationOptions}>
            <toolsOptionsContext.Provider value={toolOptions}>
              <toolsOptionsDispatchContext.Provider value={dispatchToolOptions}>
                <notificationContext.Provider
                  value={<Flashbar items={notifications} stackItems={notifications.length > 3} />}
                >
                  <notificationDispatchContext.Provider
                    value={[addNotification, dismissNotification]}
                  >
                    {props.children}
                  </notificationDispatchContext.Provider>
                </notificationContext.Provider>
              </toolsOptionsDispatchContext.Provider>
            </toolsOptionsContext.Provider>
          </sideNavOptionsDispatch.Provider>
        </sideNavOptionsContext.Provider>
      </splitPanelOptionsDispatchContext.Provider>
    </splitPanelOptionsContext.Provider>
  );
};
