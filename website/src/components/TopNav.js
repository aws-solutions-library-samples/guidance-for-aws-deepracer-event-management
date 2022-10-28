import React, { useEffect, useState } from 'react';
import { Auth,  API, graphqlOperation } from 'aws-amplify';
import { getAllEvents } from '../graphql/queries'

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
import { AdminGroups } from '../admin/groups.js';
import { AdminGroupsDetail } from '../admin/groups/detail.js';
import { AdminActivation } from '../admin/carActivation.js';
import { Upload } from '../upload.js';

import {
  Container,
  TopNavigation,
  AppLayout,
  SideNavigation
} from "@cloudscape-design/components";

function cwr(operation, payload){
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
      <Route path="/admin/groups" element={<AdminGroups />} />
      <Route path="/admin/groups/:groupName" element={<AdminGroupsDetail />} />
      <Route path="/admin/car_activation" element={<AdminActivation />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

async function getEvents()  {
  const response = await API.graphql(graphqlOperation(getAllEvents));
  console.log(response.data.getAllEvents)
  // TODO implement logic for setting the active event
};

class TopNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      groups: [],
      navigationOpen: true,
    };
  }
  _isMounted = false;

  componentDidMount() {
    this._isMounted = true;

    Auth.currentAuthenticatedUser().then(user => {
      // Returns an array of groups
      const groups = user.signInUserSession.accessToken.payload["cognito:groups"];
      // console.log("User Groups: ")
      // console.log(groups)
      if (this._isMounted && groups !== undefined ) {
        this.setState({ groups: groups })
        this.setState( {events: getEvents()})
      }
    })
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    let navItems = [
      {type: "link", text: "Upload", href: "/upload"},
      {type: "link", text: "Models", href: "/models"},
    ];

    if ( this.state.groups.includes('admin') ) {
      navItems.push({
        type: 'section',
        text: 'Admin',
        items: [
          {type: "link",text: "All Models",href: "/admin/models"},
          {type: "link",text: "Quarantined models",href: "/admin/quarantine"},
          {type: "link",text: "Cars",href: "/admin/cars"},
          {type: "link",text: "Car activiation",href: "/admin/car_activation"},
          {type: "link",text: "Groups",href: "/admin/groups"}
        ],
      })
    }

    return (
      <Router>
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
                text: this.props.user,
                iconName:"user-profile",
                items: [
                  {
                    id: "signout",
                    text: "Sign out",
                  }
                ],
                onItemClick: ({detail}) => {
                  // Perform actions based on the clicked item details
                  if (detail.id === 'signout') {
                    this.props.signout();
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
          navigationOpen={this.state.navigationOpen}
          navigation={
            <SideNavigation
              activeHref={window.location.pathname}
              items={navItems}
            />
          }
          //breadcrumbs={<BreadcrumbGroup items={breadcrumbs} expandAriaLabel="Show path" ariaLabel="Breadcrumbs" />}
          contentType="table"
          content={<MenuRoutes />}
          onNavigationChange={({ detail }) => this.setState({ navigationOpen: detail.open })}
        />
      </Router>
    )
  }
}

export default TopNav
