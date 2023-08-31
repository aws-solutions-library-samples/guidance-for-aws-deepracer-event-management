import {
  AppLayout,
  Badge,
  Flashbar,
  SideNavigation,
  TopNavigation,
} from '@cloudscape-design/components';

import React, { useEffect, useState } from 'react';

import { Route, Routes, useLocation } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { AdminActivation } from '../admin/carActivation';
import { AdminCars } from '../admin/cars';
import { AdminEvents } from '../admin/events/adminEvents';
import { CreateEvent } from '../admin/events/pages/createEvent';
import { EditEvent } from '../admin/events/pages/editEvent';
import { AdminFleets } from '../admin/fleets/adminFleets';
import { CreateFleet } from '../admin/fleets/createFleet';
import { EditFleet } from '../admin/fleets/editFleet';
import { GroupMembersPage } from '../admin/groups/groupMembersPage';
import { GroupsPage } from '../admin/groups/groupsPage';
import { AdminHome } from '../admin/home';
import { AdminModels } from '../admin/model-management/models';
import { AdminQuarantine } from '../admin/model-management/quarantine';
import { EditRace } from '../admin/race-admin/pages/editRace';
import { RaceAdmin } from '../admin/race-admin/raceAdmin';
import { ProfileHome } from '../admin/user-profile/profile';
import { CreateUser } from '../admin/users/createUser';
import { UsersList } from '../admin/users/usersList';
import { CommentatorRaceStats } from '../commentator/race-stats';
import { Home } from '../home';
import { useCarsApi } from '../hooks/useCarsApi';
import { useEventsApi } from '../hooks/useEventsApi';
import { useFleetsApi } from '../hooks/useFleetsApi';
import useLink from '../hooks/useLink';
import { usePermissions } from '../hooks/usePermissions';
import { useRacesApi } from '../hooks/useRacesApi';
import { useUsersApi } from '../hooks/useUsersApi';
import { useWindowSize } from '../hooks/useWindowsSize';
import { ModelMangement } from '../pages/model-management/modelManagement';
import { Timekeeper } from '../pages/timekeeper/timeKeeper';
import {
  useSelectedEventContext,
  useSelectedEventDispatch,
  useSelectedTrackContext,
} from '../store/contexts/storeProvider';
import { useStore } from '../store/store';
import { EventSelectorModal } from './eventSelectorModal';

function cwr(operation, payload) {
  // Instrument Routing to Record Page Views
  // https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_react.md
  return void 0;
}

function usePageViews() {
  const location = useLocation();
  React.useEffect(() => {
    // console.debug(location.pathname);
    cwr('recordPageView', location.pathname);
  }, [location]);
}
const defaultRoutes = [
  <Route path="/" element={<Home />} />,
  <Route path="*" element={<Home />} />,
  <Route path="/user/profile" element={<ProfileHome />} />,
  <Route path="/models/view" element={<ModelMangement />} />,
];

const registrationRoutes = [<Route path="/registration/createuser" element={<CreateUser />} />];

const commentatorRoutes = [<Route path="/commentator" element={<CommentatorRaceStats />} />];

const operatorRoutes = [
  <Route path="/admin/home" element={<AdminHome />} />,
  <Route path="/admin/models" element={<AdminModels />} />,
  <Route path="/admin/quarantine" element={<AdminQuarantine />} />,
  <Route path="/admin/cars" element={<AdminCars />} />,
  <Route path="/admin/events" element={<AdminEvents />} />,
  <Route path="/admin/events/create" element={<CreateEvent />} />,
  <Route path="/admin/events/edit" element={<EditEvent />} />,
  <Route path="/admin/fleets" element={<AdminFleets />} />,
  <Route path="/admin/fleets/create" element={<CreateFleet />} />,
  <Route path="/admin/fleets/edit" element={<EditFleet />} />,
  <Route path="/admin/car_activation" element={<AdminActivation />} />,
  <Route path="/admin/timekeeper" element={<Timekeeper />} />,
  <Route path="/admin/races" element={<RaceAdmin />} />,
  <Route path="/admin/races/edit" element={<EditRace />} />,
];

const adminRoutes = [
  <Route path="/admin/users" element={<UsersList />} />,
  <Route path="/admin/groups" element={<GroupsPage />} />,
  <Route path="/admin/groups/:groupName" element={<GroupMembersPage />} />,
];

const MenuRoutes = ({ permissions }) => {
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

export function TopNav(props) {
  const { t } = useTranslation();
  const windowSize = useWindowSize();

  const { handleFollow } = useLink();

  const selectedEvent = useSelectedEventContext();
  const setSelectedEvent = useSelectedEventDispatch();
  const selectedTrack = useSelectedTrackContext();
  const [state, dispatch] = useStore();

  const permissions = usePermissions();
  useUsersApi(permissions.api.users);
  useRacesApi(permissions.api.races, selectedEvent.eventId);
  useCarsApi(permissions.api.cars);
  useFleetsApi(permissions.api.fleets);
  useEventsApi(selectedEvent, setSelectedEvent, permissions.api.events);

  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  useEffect(() => {
    if (windowSize.width < 900) dispatch('SIDE_NAV_IS_OPEN', false);
    else if (windowSize.width >= 900) dispatch('SIDE_NAV_IS_OPEN', true);
  }, [windowSize]);

  const defaultSideNavItems = [
    {
      type: 'link',
      text: t('topnav.models-own'),
      href: '/models/view',
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
          text: t('topnav.models'),
          items: [
            { type: 'link', text: t('topnav.all-models'), href: '/admin/models' },
            {
              type: 'link',
              text: t('topnav.quarantined-models'),
              href: '/admin/quarantine',
            },
          ],
        },
        {
          type: 'expandable-link-group',
          text: t('topnav.car-management'),
          items: [
            { type: 'link', text: t('topnav.fleets'), href: '/admin/fleets' },
            { type: 'link', text: t('topnav.cars'), href: '/admin/cars' },
            {
              type: 'link',
              text: t('topnav.car-activation'),
              href: '/admin/car_activation',
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
      ],
    },
  ];

  const adminSideNavItems = [
    {
      type: 'section',
      text: t('topnav.admin'),
      href: '/admin',
      items: [
        { type: 'link', text: t('topnav.users'), href: '/admin/users' },
        { type: 'link', text: t('topnav.groups'), href: '/admin/groups' },
      ],
    },
  ];

  const SideNavItems = () => {
    let items = defaultSideNavItems;
    if (permissions.sideNavItems.registration) {
      items = items.concat(registrationSideNavItems);
    }
    if (permissions.sideNavItems.commentator) {
      items = items.concat(commentatorSideNavItems);
    }
    if (permissions.sideNavItems.operator) {
      items = items.concat(operatorSideNavItems);
    }
    if (permissions.sideNavItems.admin) {
      items = items.concat(adminSideNavItems);
    }
    return items;
  };

  const topNavItems = [
    {
      type: 'menu-dropdown',
      text: props.user,
      iconName: 'user-profile',
      items: [
        {
          id: 'user-profile',
          text: t('topnav.user-profile'),
          type: 'link',
          href: '/user/profile',
        },
        {
          id: 'signout',
          text: t('topnav.sign-out'),
        },
      ],
      onItemClick: ({ detail }) => {
        if (detail.id === 'signout') {
          props.signout();
        }
      },
    },
  ];

  if (permissions.topNavItems.eventSelection) {
    // race track selector
    topNavItems.unshift({
      type: 'button',
      text: selectedTrack ? selectedTrack.leaderBoardTitle : 'No track selected',
      onClick: () => setEventSelectModalVisible(true),
    });

    // event selector
    topNavItems.unshift({
      type: 'button',
      text: selectedEvent.eventName,
      onClick: () => setEventSelectModalVisible(true),
    });
  }

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
          <Flashbar items={state.notifications} stackItems={state.notifications.length > 3} />
        }
        tools={state.helpPanel.content}
        toolsOpen={state.helpPanel.isOpen}
        toolsHide={state.helpPanel.isHidden}
        onToolsChange={(item) => dispatch('HELP_PANEL_IS_OPEN', item.detail.open)}
        headerSelector="#h"
        ariaLabels={{ navigationClose: 'close' }}
        navigationOpen={state.sideNav.isOpen}
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
        splitPanel={state.splitPanel.content}
        splitPanelOpen={state.splitPanel.isOpen}
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
