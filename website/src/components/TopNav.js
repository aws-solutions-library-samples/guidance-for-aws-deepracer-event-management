import { AppLayout, Badge, SideNavigation, TopNavigation } from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';

import { Route, Routes, useLocation } from 'react-router-dom';

import { AdminActivation } from '../admin/carActivation.js';
import { AdminCars } from '../admin/cars.js';
import { AdminEvents } from '../admin/events/events.js';
import { AdminFleets } from '../admin/fleets.js';
import { AdminGroups } from '../admin/groups.js';
import { AdminGroupsDetail } from '../admin/groups/detail.js';
import { AdminHome } from '../admin/home.js';
import { Leaderboard } from '../admin/leaderboard/leaderboard.js';
import { AdminModels } from '../admin/models.js';
import { AdminQuarantine } from '../admin/quarantine.js';
import { Timekeeper } from '../admin/timekeeper/timekeeper';
import { Home } from '../home.js';
import { Models } from '../models.js';
import { Upload } from '../upload.js';
// import { ListOfEvents } from './ListOfEvents.js';
import useQuery from '../hooks/useQuery.js';
import { eventContext } from '../store/EventProvider';
import SideNavContext from '../store/SideNavContext.js';

import useLink from '../hooks/useLink.js';

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

function MenuRoutes() {
  usePageViews();
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/models" element={<Models />} />
      <Route path="/upload" element={<Upload />} />
      <Route path="/admin/home" element={<AdminHome />} />
      <Route path="/admin/models" element={<AdminModels />} />
      <Route path="/admin/quarantine" element={<AdminQuarantine />} />
      <Route path="/admin/cars" element={<AdminCars />} />
      <Route path="/admin/events" element={<AdminEvents />} />
      <Route path="/admin/fleets" element={<AdminFleets />} />
      <Route path="/admin/groups" element={<AdminGroups />} />
      <Route path="/admin/groups/:groupName" element={<AdminGroupsDetail />} />
      <Route path="/admin/car_activation" element={<AdminActivation />} />
      <Route path="/admin/timekeeper" element={<Timekeeper />} />
      <Route path="/admin/leaderboard" element={<Leaderboard />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

export function TopNav(props) {
  const [groups, setGroups] = useState([]);
  const [navigationOpen, setNavigationOpen] = useState(true);
  const { handleFollow } = useLink();
  const [allEventsFromBackend] = useQuery('getAllEvents');

  const { events, setEvents, selectedEvent, setSelectedEvent } = useContext(eventContext);

  // Get all events from backend on inital load
  useEffect(() => {
    if (allEventsFromBackend) {
      setEvents(allEventsFromBackend);
    }
  }, [allEventsFromBackend, setEvents]);

  // Config Groups
  useEffect(() => {
    Auth.currentAuthenticatedUser().then((user) => {
      const groups = user.signInUserSession.accessToken.payload['cognito:groups'];
      if (groups !== undefined) {
        setGroups(groups);
      }
    });

    return () => {
      // Unmounting
    };
  }, []);

  const navItems = [
    { type: 'link', text: 'Upload', href: '/upload' },
    { type: 'link', text: 'Models', href: '/models' },
  ];

  if (groups.includes('admin')) {
    navItems.push({
      type: 'section',
      text: 'Admin',
      href: '/admin',
      items: [
        {
          type: 'expandable-link-group',
          text: 'Models',
          items: [
            { type: 'link', text: 'All Models', href: '/admin/models' },
            { type: 'link', text: 'Quarantined models', href: '/admin/quarantine' },
          ],
        },
        {
          type: 'expandable-link-group',
          text: 'Car management',
          items: [
            { type: 'link', text: 'Fleets', href: '/admin/fleets' },
            { type: 'link', text: 'Cars', href: '/admin/cars' },
            { type: 'link', text: 'Car activiation', href: '/admin/car_activation' },
          ],
        },
        {
          type: 'expandable-link-group',
          text: 'Event',
          items: [
            {
              type: 'link',
              text: 'Events',
              info: <Badge color="blue">Beta</Badge>,
              href: '/admin/events',
            },
            {
              type: 'link',
              text: 'Time Keeper',
              info: <Badge color="blue">Beta</Badge>,
              href: '/admin/timekeeper',
            },
            {
              type: 'link',
              text: 'Leaderboard',
              info: <Badge color="blue">Beta</Badge>,
              href: '/admin/leaderboard',
            },
          ],
        },
        { type: 'link', text: 'Groups', href: '/admin/groups' },
      ],
    });
  }

  return (
    <div>
      <SideNavContext.Provider value={{ navigationOpen, setNavigationOpen }}>
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
            utilities={[
              {
                type: 'menu-dropdown',
                text: selectedEvent.eventName,
                items: events.map((event) => {
                  return { id: event.eventId, text: event.eventName };
                }),
                onItemClick: ({ detail }) => {
                  setSelectedEvent(events.find((item) => item.eventId === detail.id));
                },
              },
              {
                type: 'menu-dropdown',
                text: props.user,
                iconName: 'user-profile',
                items: [
                  {
                    id: 'signout',
                    text: 'Sign out',
                  },
                ],
                onItemClick: ({ detail }) => {
                  if (detail.id === 'signout') {
                    props.signout();
                  }
                },
              },
            ]}
            i18nStrings={{
              searchIconAriaLabel: 'Search',
              searchDismissIconAriaLabel: 'Close search',
              overflowMenuTriggerText: 'More',
              overflowMenuTitleText: 'All',
              overflowMenuBackIconAriaLabel: 'Back',
              overflowMenuDismissIconAriaLabel: 'Close menu',
            }}
          />
        </div>
        <AppLayout
          // stickyNotifications
          toolsHide
          // headerSelector="#header"
          ariaLabels={{ navigationClose: 'close' }}
          navigationOpen={navigationOpen}
          navigation={
            <SideNavigation
              activeHref={window.location.pathname}
              onFollow={handleFollow}
              items={navItems}
            />
          }
          // breadcrumbs={<BreadcrumbGroup items={breadcrumbs} expandAriaLabel="Show path" ariaLabel="Breadcrumbs" />}
          contentType="table"
          content={<MenuRoutes />}
          onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        />
      </SideNavContext.Provider>
    </div>
  );
}

export default TopNav;
