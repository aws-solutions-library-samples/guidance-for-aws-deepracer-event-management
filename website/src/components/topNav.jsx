import {
  AppLayout,
  Badge,
  Flashbar,
  SideNavigation,
  TopNavigation,
} from '@cloudscape-design/components';

import React from 'react';

import { Route, Routes, useLocation } from 'react-router-dom';

import { useTranslation } from 'react-i18next';
import { AdminActivation } from '../admin/carActivation';
import { AdminCars } from '../admin/cars';
import { AdminEvents } from '../admin/events/adminEvents';
import { CreateEvent } from '../admin/events/createEvent';
import { EditEvent } from '../admin/events/editEvent';
import { AdminFleets } from '../admin/fleets/adminFleets';
import { CreateFleet } from '../admin/fleets/createFleet';
import { EditFleet } from '../admin/fleets/editFleet';
import { AdminGroupsDetail } from '../admin/groups/detail';
import { AdminGroups } from '../admin/groups/groups';
import { AdminHome } from '../admin/home';
import { AdminModels } from '../admin/models';
import { AdminQuarantine } from '../admin/quarantine';
import { EditRace } from '../admin/race-admin/editRace';
import { RaceAdmin } from '../admin/race-admin/raceAdmin';
import { Timekeeper } from '../admin/timekeeper/timeKeeper';
import { ProfileHome } from '../admin/user-profile/profile';
import { CreateUser } from '../admin/users/createUser';
import { CommentatorRaceStats } from '../commentator/race-stats';
import { Home } from '../home';
import useLink from '../hooks/useLink';
import { Models } from '../models';
import {
  useNotifications,
  useSideNavOptions,
  useSideNavOptionsDispatch,
  useSplitPanelOptions,
  useSplitPanelOptionsDispatch,
} from '../store/appLayoutProvider';
import { usePermissionsContext } from '../store/permissions/permissionsProvider';
import {
  useEventsContext,
  useSelectedEventContext,
  useSelectedEventDispatch,
} from '../store/storeProvider';
import { Upload } from '../upload';

function cwr(operation, payload) {
  // Instrument Routing to Record Page Views
  // https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_react.md
  return void 0;
}

function usePageViews() {
  const location = useLocation();
  React.useEffect(() => {
    // console.log(location.pathname);
    cwr('recordPageView', location.pathname);
  }, [location]);
}
const defaultRoutes = [
  <Route path="/" element={<Home />} />,
  <Route path="*" element={<Home />} />,
  <Route path="/user/profile" element={<ProfileHome />} />,
  <Route path="/models/view" element={<Models />} />,
  <Route path="/models/upload" element={<Upload />} />,
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
  <Route path="/admin/groups" element={<AdminGroups />} />,
  <Route path="/admin/groups/:groupName" element={<AdminGroupsDetail />} />,
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

  const splitPanelOptions = useSplitPanelOptions();
  const splitPanelOptionsDispatch = useSplitPanelOptionsDispatch();
  const notifications = useNotifications();

  const { handleFollow } = useLink();

  const [events] = useEventsContext();
  const selectedEvent = useSelectedEventContext();
  const setSelectedEvent = useSelectedEventDispatch();
  const sideNavOptions = useSideNavOptions();
  const sideNavOptionsDispatch = useSideNavOptionsDispatch();

  const permissions = usePermissionsContext();

  const defaultSideNavItems = [
    {
      type: 'section',
      text: t('topnav.models'),
      href: '/models',
      items: [
        { type: 'link', text: t('topnav.upload'), href: '/models/upload' },
        { type: 'link', text: t('topnav.models'), href: '/models/view' },
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
              info: <Badge color="blue">Beta</Badge>,
              href: '/admin/events',
            },
            {
              type: 'link',
              text: t('topnav.race-admin'),
              info: <Badge color="blue">Beta</Badge>,
              href: '/admin/races',
            },
          ],
        },
        {
          type: 'link',
          text: t('topnav.time-keeper'),
          info: <Badge color="blue">Beta</Badge>,
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
        {
          type: 'expandable-link-group',
          text: t('topnav.users'),
          items: [{ type: 'link', text: t('topnav.groups'), href: '/admin/groups' }],
        },
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
    topNavItems.unshift({
      type: 'menu-dropdown',
      text: selectedEvent.eventName,
      items: events.map((event) => {
        return { id: event.eventId, text: event.eventName };
      }),
      onItemClick: ({ detail }) => {
        setSelectedEvent(events.find((item) => item.eventId === detail.id));
      },
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
        notifications={
          <Flashbar
            items={notifications}
            i18nStrings={{
              ariaLabel: 'Notifications',
              notificationBarAriaLabel: 'View all notifications',
              notificationBarText: 'Notifications',
              errorIconAriaLabel: 'Error',
              warningIconAriaLabel: 'Warning',
              successIconAriaLabel: 'Success',
              infoIconAriaLabel: 'Info',
              inProgressIconAriaLabel: 'In progress',
            }}
            //stackItems
          />
        }
        stickyNotifications
        toolsHide
        // headerSelector="#header"
        ariaLabels={{ navigationClose: 'close' }}
        navigationOpen={sideNavOptions.isOpen}
        navigation={
          <SideNavigation
            activeHref={window.location.pathname}
            onFollow={handleFollow}
            items={SideNavItems()}
          />
        }
        // breadcrumbs={<BreadcrumbGroup items={breadcrumbs} expandAriaLabel="Show path" ariaLabel="Breadcrumbs" />}
        contentType="table"
        content={<MenuRoutes permissions={permissions} />}
        onNavigationChange={({ detail }) =>
          sideNavOptionsDispatch({ type: 'SIDE_NAV_IS_OPEN', value: detail.open })
        }
        splitPanel={splitPanelOptions.content}
        splitPanelOpen={splitPanelOptions.isOpen}
        onSplitPanelToggle={(item) =>
          splitPanelOptionsDispatch({ type: 'UPDATE', value: { isOpen: item.detail.open } })
        }
      />
    </div>
  );
}

export default TopNav;
