import React, { useEffect, useState } from 'react';
import { Auth } from 'aws-amplify';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from "react-router-dom";

import { Home } from '../home.js';
import { Models } from '../models.js';
import { AdminHome } from '../admin/home.js';
import { AdminModels } from '../admin/models.js';
import { AdminQuarantine } from '../admin/quarantine.js';
import { AdminCars } from '../admin/cars.js';
import { AdminEvents } from '../admin/events.js';
import { AdminFleets } from '../admin/fleets.js';
import { AdminGroups } from '../admin/groups.js';
import { AdminGroupsDetail } from '../admin/groups/detail.js';
import { AdminActivation } from '../admin/carActivation.js';
import { Upload } from '../upload.js';
//import { ListOfEvents } from './ListOfEvents.js';

import {
  TopNavigation,
  AppLayout,
  SideNavigation
} from "@cloudscape-design/components";

function cwr(operation, payload) {
  // Instrument Routing to Record Page Views
  // https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_react.md
  return void 0;
};

function usePageViews() {
  let location = useLocation();
  React.useEffect(() => {
    // console.log(location.pathname);
    cwr("recordPageView", location.pathname);
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
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

export function TopNav(props) {
  const [groups, setGroups] = useState([]);
  const [navigationOpen, setNavigationOpen] = useState(true);

  // Config Groups
  useEffect(() => {
    Auth.currentAuthenticatedUser().then(user => {
      const groups = user.signInUserSession.accessToken.payload["cognito:groups"];
      if (groups !== undefined) {
        setGroups(groups)
      }
    })

    return () => {
      // Unmounting
    }
  }, [])

  let navItems = [
    { type: "link", text: "Upload", href: "/upload" },
    { type: "link", text: "Models", href: "/models" },
  ];

  if (groups.includes('admin')) {
    navItems.push({
      type: 'section',
      text: 'Admin',
      items: [
        { type: "link", text: "All Models", href: "/admin/models" },
        { type: "link", text: "Quarantined models", href: "/admin/quarantine" },
        { type: "link", text: "Events", href: "/admin/events" },
        { type: "link", text: "Fleets", href: "/admin/fleets" },
        { type: "link", text: "Cars", href: "/admin/cars" },
        { type: "link", text: "Car activiation", href: "/admin/car_activation" },
        { type: "link", text: "Groups", href: "/admin/groups" }
      ],
    })
  }

  return (
    <div>
      <div id="h" style={{ position: 'sticky', top: 0, zIndex: 1002 }}>
        <TopNavigation
          identity={{
            href: "/",
            title: "DREM",
            logo: {
              src: "/logo.png",
              alt: "DREM"
            }
          }}
          utilities={[
            {
              type: "menu-dropdown",
              text: props.user,
              iconName: "user-profile",
              items: [
                {
                  id: "signout",
                  text: "Sign out",
                }
              ],
              onItemClick: ({ detail }) => {
                // Perform actions based on the clicked item details
                if (detail.id === 'signout') {
                  props.signout();
                }
              }
            }
          ]}
          i18nStrings={{
            searchIconAriaLabel: "Search",
            searchDismissIconAriaLabel: "Close search",
            overflowMenuTriggerText: "More",
            overflowMenuTitleText: "All",
            overflowMenuBackIconAriaLabel: "Back",
            overflowMenuDismissIconAriaLabel: "Close menu"
          }}
        />

      </div>
      <AppLayout
        //stickyNotifications
        toolsHide
        //headerSelector="#header"
        ariaLabels={{ navigationClose: 'close' }}
        navigationOpen={navigationOpen}
        navigation={
          <SideNavigation
            activeHref={window.location.pathname}
            items={navItems}
          />
        }
        //breadcrumbs={<BreadcrumbGroup items={breadcrumbs} expandAriaLabel="Show path" ariaLabel="Breadcrumbs" />}
        contentType="table"
        content={<Router><MenuRoutes /></Router>}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
      />
    </div>
  )

}

export default TopNav
