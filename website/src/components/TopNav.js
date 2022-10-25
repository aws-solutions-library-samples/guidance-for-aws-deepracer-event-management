import React from 'react';
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
import { AdminGroups } from '../admin/groups.js';
import { AdminGroupsDetail } from '../admin/groups/detail.js';
import { AdminActivation } from '../admin/carActivation.js';
import { Upload } from '../upload.js';

import { Container, TopNavigation } from "@cloudscape-design/components";

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

class TopNav extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      groups: []
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
      }
    })
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    var menuAdminDropdown = {}
    if ( this.state.groups.includes('admin') ) {
      menuAdminDropdown = {
        type: "menu-dropdown",
        text: "Admin",
        iconName: "key",
        items: [
          {
            id: "admin-all-models",
            iconName: "folder",
            text: "All Models",
            href: "/admin/models"
          },
          {
            id: "admin-quarantined-models",
            iconName: "bug",
            text: "Quarantined models",
            href: "/admin/quarantine"
          },
          {
            id: "admin-cars",
            iconName: "car",
            text: "Cars",
            href: "/admin/cars"
          },
          {
            id: "admin-generate-activiation",
            iconName: "plus",
            text: "Car activiation",
            href: "/admin/car_activation"
          },
          {
            id: "admin-groups",
            iconName: "users",
            text: "Groups",
            href: "/admin/groups"
          }
        ]
      }
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
                type: "button",
                iconName: "upload",
                text: "Upload",
                ariaLabel: "Upload",
                href: "/upload"
              },
              {
                type: "button",
                iconName: "folder",
                text: "Models",
                ariaLabel: "Models",
                href: "/models"
              },
              menuAdminDropdown,
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

        <Container>
          <MenuRoutes />
        </Container>
      </Router>
    )
  }
}

export default TopNav
