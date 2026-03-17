import {
  AppLayout,
  Badge,
  Flashbar,
  SideNavigation,
  SideNavigationProps,
  TopNavigation,
  TopNavigationProps,
} from '@cloudscape-design/components';

import React, { ReactElement, useCallback, useEffect, useMemo, useState } from 'react';

import { Route, Routes, useLocation } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { AdminCarActivation } from '../admin/carActivation';
import { AdminDevices } from '../admin/devices';
import { AdminEvents } from '../admin/events/adminEvents';
import { CreateEvent } from '../admin/events/pages/createEvent';
import { EditEvent } from '../admin/events/pages/editEvent';
import { AdminFleets } from '../admin/fleets/adminFleets';
import { CreateFleet } from '../admin/fleets/createFleet';
import { EditFleet } from '../admin/fleets/editFleet';
import { AdminHome } from '../admin/home';
import { EditRace } from '../admin/race-admin/pages/editRace';
import { RaceAdmin } from '../admin/race-admin/raceAdmin';
import { AdminTimerActivation } from '../admin/timerActivation';
import { UploadToCarStatus } from '../admin/uploadToCarStatus';
import { ProfileHome } from '../admin/user-profile/profile';
import { CreateUser } from '../admin/users/createUser';
import { CommentatorStats } from '../commentator/commentator-stats';
import { Home } from '../home';
import { useCarLogsApi } from '../hooks/useCarLogsApi';
import { useCarsApi } from '../hooks/useCarsApi';
import { useEventsApi } from '../hooks/useEventsApi';
import { useFleetsApi } from '../hooks/useFleetsApi';
import useLink from '../hooks/useLink';
import { useModelsApi } from '../hooks/useModelsApi';
import { Permissions, usePermissions } from '../hooks/usePermissions';
import { useRacesApi } from '../hooks/useRacesApi';
import { useUsersApi } from '../hooks/useUsersApi';
import { useWindowSize } from '../hooks/useWindowsSize';
import { CarLogsManagement } from '../pages/car-logs-management/carLogsManagement';
import { ModelManagement } from '../pages/model-management/modelManagement';
import { Timekeeper } from '../pages/timekeeper/timeKeeper';
import { TimekeeperWizard } from '../pages/timekeeper/timeKeeperWizard';
import { UserManagement } from '../pages/user-manager/userManagement';
import {
  useSelectedEventContext,
  useSelectedEventDispatch,
  useSelectedTrackContext,
} from '../store/contexts/storeProvider';
import { useStore } from '../store/store';
import { EventSelectorModal } from './eventSelectorModal';

// Type definitions
interface TopNavProps {
  user: string;
  signout: ((data?: any) => void) | (() => void) | undefined;
}

interface MenuRoutesProps {
  permissions: Permissions;
}

function cwr(operation: string, payload: string): void {
  // Instrument Routing to Record Page Views
  // https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_react.md
  return void 0;
}

function usePageViews(): void {
  const location = useLocation();
  React.useEffect(() => {
    // console.debug(location.pathname);
    cwr('recordPageView', location.pathname);
  }, [location]);
}
const defaultRoutes: ReactElement[] = [
  <Route key="home" path="/" element={<Home />} />,
  <Route key="home-wildcard" path="*" element={<Home />} />,
  <Route key="user-profile" path="/user/profile" element={<ProfileHome />} />,
  <Route key="models-view" path="/models/view" element={<ModelManagement />} />,
  <Route key="models-assets" path="/models/assets" element={<CarLogsManagement />} />,
];

const registrationRoutes: ReactElement[] = [
  <Route key="registration-createuser" path="/registration/createuser" element={<CreateUser />} />,
];

const commentatorRoutes: ReactElement[] = [
  <Route key="commentator" path="/commentator" element={<CommentatorStats />} />,
];

const operatorRoutes: ReactElement[] = [
  <Route key="admin-home" path="/admin/home" element={<AdminHome />} />,
  <Route key="admin-devices" path="/admin/devices" element={<AdminDevices />} />,
  <Route key="admin-events" path="/admin/events" element={<AdminEvents />} />,
  <Route key="admin-events-create" path="/admin/events/create" element={<CreateEvent />} />,
  <Route key="admin-events-edit" path="/admin/events/edit" element={<EditEvent />} />,
  <Route key="admin-fleets" path="/admin/fleets" element={<AdminFleets />} />,
  <Route key="admin-fleets-create" path="/admin/fleets/create" element={<CreateFleet />} />,
  <Route key="admin-fleets-edit" path="/admin/fleets/edit" element={<EditFleet />} />,
  <Route
    key="admin-car-activation"
    path="/admin/car_activation"
    element={<AdminCarActivation />}
  />,
  <Route
    key="admin-timer-activation"
    path="/admin/timer_activation"
    element={<AdminTimerActivation />}
  />,
  <Route key="admin-timekeeper" path="/admin/timekeeper" element={<Timekeeper />} />,
  <Route
    key="admin-timekeeper-wizard"
    path="/admin/timekeeper-wizard"
    element={<TimekeeperWizard />}
  />,
  <Route key="admin-races" path="/admin/races" element={<RaceAdmin />} />,
  <Route key="admin-races-edit" path="/admin/races/edit" element={<EditRace />} />,
  <Route
    key="admin-upload-to-car-status"
    path="/admin/upload_to_car_status"
    element={<UploadToCarStatus />}
  />,
  <Route
    key="admin-models"
    path="/admin/models"
    element={<ModelManagement isOperatorView={true} onlyDisplayOwnModels={false} />}
  />,
  <Route
    key="admin-models-assets"
    path="/admin/models/assets"
    element={<CarLogsManagement isOperatorView={true} onlyDisplayOwnAssets={false} />}
  />,
];

const adminRoutes: ReactElement[] = [
  <Route key="admin-user-management" path="/admin/user-management" element={<UserManagement />} />,
];

const MenuRoutes: React.FC<MenuRoutesProps> = ({ permissions }) => {
  usePageViews();
  let routes = defaultRoutes;
  if (permissions.sideNavItems.registration) {
    routes = routes.concat(registrationRoutes);
  }
  if (permissions.sideNavItems.commentator) {
    routes = routes.concat(commentatorRoutes);
  }
  if (permissions.sideNavItems.operator) {
    routes = routes.concat(operatorRoutes);
  }
  if (permissions.sideNavItems.admin) {
    routes = routes.concat(adminRoutes);
  }

  return <Routes>{routes}</Routes>;
};

export function TopNav({ user, signout }: TopNavProps): JSX.Element {
  const { t } = useTranslation();
  const windowSize = useWindowSize();

  const { handleFollow } = useLink();

  const selectedEvent = useSelectedEventContext();
  const setSelectedEvent = useSelectedEventDispatch();
  const selectedTrack = useSelectedTrackContext();
  const [state, dispatch] = useStore();

  const permissions = usePermissions();
  useUsersApi(permissions.api.users);
  useRacesApi(permissions.api.races, selectedEvent?.eventId);
  useCarsApi(permissions.api.cars);
  useCarLogsApi(false); // TODO: Add carLogs permission to Permissions interface
  useFleetsApi(permissions.api.fleets);
  useEventsApi(selectedEvent as any, setSelectedEvent as any, permissions.api.events);
  useModelsApi(permissions.api.allModels);

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (windowSize.width && windowSize.width < 900) dispatch('SIDE_NAV_IS_OPEN', false);
    else if (windowSize.width && windowSize.width >= 900) dispatch('SIDE_NAV_IS_OPEN', true);
  }, [windowSize.width, dispatch]);

  const defaultSideNavItems = [
    {
      type: 'section',
      text: t('topnav.models-own'),
      items: [
        { type: 'link', text: t('topnav.models'), href: '/models/view' },
        {
          type: 'link',
          text: t('topnav.models-logsvideo'),
          info: <Badge color="blue">{t('topnav.beta')}</Badge>,
          href: '/models/assets',
        },
      ],
    },
  ];

  const registrationSideNavItems = [
    {
      type: 'section',
      text: t('topnav.registration'),
      href: '/registration',
      items: [{ type: 'link', text: t('topnav.create-user'), href: '/registration/createuser' }],
    },
  ];

  const commentatorSideNavItems = [
    {
      type: 'section',
      text: t('topnav.commentator'),
      items: [
        {
          type: 'link',
          text: t('topnav.commentator-race'),
          info: <Badge color="blue">Beta</Badge>,
          href: '/commentator',
        },
      ],
    },
  ];

  const operatorSideNavItems = [
    {
      type: 'section',
      text: t('topnav.operator'),
      href: '/operator',
      items: [
        {
          type: 'expandable-link-group',
          text: t('topnav.models-management'),
          items: [
            {
              type: 'link',
              text: t('topnav.models'),
              href: '/admin/models',
            },
            {
              type: 'link',
              text: t('topnav.upload-to-car-status'),
              info: <Badge color="blue">{t('topnav.beta')}</Badge>,
              href: '/admin/upload_to_car_status',
            },
            {
              type: 'link',
              text: t('topnav.models-logsvideo'),
              info: <Badge color="blue">{t('topnav.beta')}</Badge>,
              href: '/admin/models/assets',
            },
          ],
        },
        {
          type: 'expandable-link-group',
          text: t('topnav.device-management'),
          items: [
            { type: 'link', text: t('topnav.fleets'), href: '/admin/fleets' },
            { type: 'link', text: t('topnav.cars'), href: '/admin/devices' },
            {
              type: 'link',
              text: t('topnav.car-activation'),
              href: '/admin/car_activation',
            },
            {
              type: 'link',
              text: t('topnav.timer-activation'),
              href: '/admin/timer_activation',
            },
          ],
        },
        {
          type: 'expandable-link-group',
          text: t('topnav.event'),
          items: [
            {
              type: 'link',
              text: t('topnav.events'),
              href: '/admin/events',
            },
            {
              type: 'link',
              text: t('topnav.race-admin'),
              href: '/admin/races',
            },
          ],
        },
        {
          type: 'link',
          text: t('topnav.time-keeper'),
          href: '/admin/timekeeper',
        },
        {
          type: 'link',
          text: t('topnav.time-keeper-wizard'),
          info: <Badge color="blue">{t('topnav.beta')}</Badge>,
          href: '/admin/timekeeper-wizard',
        },
      ],
    },
  ];

  const adminSideNavItems = [
    {
      type: 'section',
      text: t('topnav.admin'),
      href: '/admin',
      items: [{ type: 'link', text: t('topnav.users'), href: '/admin/user-management' }],
    },
  ];

  const SideNavItems = (): SideNavigationProps.Item[] => {
    let items: SideNavigationProps.Item[] = defaultSideNavItems as SideNavigationProps.Item[];
    if (permissions.sideNavItems.registration) {
      items = items.concat(registrationSideNavItems as SideNavigationProps.Item[]);
    }
    if (permissions.sideNavItems.commentator) {
      items = items.concat(commentatorSideNavItems as SideNavigationProps.Item[]);
    }
    if (permissions.sideNavItems.operator) {
      items = items.concat(operatorSideNavItems as SideNavigationProps.Item[]);
    }
    if (permissions.sideNavItems.admin) {
      items = items.concat(adminSideNavItems as SideNavigationProps.Item[]);
    }
    return items;
  };

  const handleItemClick = useCallback(({ detail }: { detail: { id: string } }) => {
    if (detail.id === 'signout' && signout) {
      signout();
    }
  }, [signout]);

  const handleEventSelectClick = useCallback(() => {
    setEventSelectModalVisible(true);
  }, []);

  const topNavItems: TopNavigationProps.Utility[] = useMemo(() => {
    const items: TopNavigationProps.Utility[] = [
      {
        type: 'menu-dropdown',
        text: user,
        iconName: 'user-profile',
        items: [
          {
            id: 'user-profile',
            text: t('topnav.user-profile'),
            href: '/user/profile',
          },
          {
            id: 'signout',
            text: t('topnav.sign-out'),
          },
        ],
        onItemClick: handleItemClick,
      },
    ];

    if (permissions.topNavItems.eventSelection) {
      // race track selector
      items.unshift({
        type: 'button',
        text: selectedTrack ? selectedTrack.leaderBoardTitle : 'No track selected',
        onClick: handleEventSelectClick,
      });

      // event selector
      items.unshift({
        type: 'button',
        text: selectedEvent?.eventName || 'No event selected',
        onClick: handleEventSelectClick,
      });
    }

    return items;
  }, [user, t, signout, selectedEvent?.eventName, selectedTrack, permissions.topNavItems.eventSelection, handleItemClick, handleEventSelectClick]);

  return (
    <div>
      <div id="h" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
        <TopNavigation
          identity={{
            href: '/',
            title: 'DREM',
            logo: {
              src: '/logo.png',
              alt: 'DREM',
            },
          }}
          utilities={topNavItems}
          i18nStrings={{
            searchIconAriaLabel: t('topnav.search'),
            searchDismissIconAriaLabel: t('topnav.close-search'),
            overflowMenuTriggerText: t('topnav.more'),
            overflowMenuTitleText: t('topnav.all'),
            overflowMenuBackIconAriaLabel: t('topnav.back'),
            overflowMenuDismissIconAriaLabel: t('topnav.close-menu'),
          }}
        />
      </div>
      <AppLayout
        stickyNotifications
        notifications={
          <Flashbar 
            items={state.notifications?.notifications || []} 
            stackItems={((state.notifications?.notifications?.length || 0) > 3)} 
          />
        }
        tools={state.helpPanel?.content}
        toolsOpen={state.helpPanel?.isOpen}
        toolsHide={state.helpPanel?.isHidden}
        onToolsChange={(item) => dispatch('HELP_PANEL_IS_OPEN', item.detail.open)}
        headerSelector="#h"
        ariaLabels={{ navigationClose: 'close' }}
        navigationOpen={state.sideNav?.isOpen}
        navigation={
          <SideNavigation
            activeHref={window.location.pathname}
            onFollow={handleFollow}
            items={SideNavItems()}
          />
        }
        contentType="table"
        content={<MenuRoutes permissions={permissions} />}
        onNavigationChange={({ detail }) => dispatch('SIDE_NAV_IS_OPEN', detail.open)}
        splitPanel={state.splitPanel?.content}
        splitPanelOpen={state.splitPanel?.isOpen}
        onSplitPanelToggle={(item) => dispatch('SPLIT_PANEL_IS_OPEN', item.detail.open)}
      />

      <EventSelectorModal
        visible={eventSelectModalVisible}
        onDismiss={() => setEventSelectModalVisible(false)}
        onOk={() => setEventSelectModalVisible(false)}
      />
    </div>
  );
}

export default TopNav;
