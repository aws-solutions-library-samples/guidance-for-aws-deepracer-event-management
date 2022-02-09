import React, { Component } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import {
  Container,
  Image,
  Menu,
} from 'semantic-ui-react'
import { Auth } from 'aws-amplify';

import { Home } from './home.js';
import { Models } from './models.js';
import { AdminModels } from './adminModels.js';
import { Upload } from './upload.js';

function cwr(operation, payload){
  // Instrument Routing to Record Page Views
  // https://github.com/aws-observability/aws-rum-web/blob/main/docs/cdn_react.md
  return void 0;
};

function usePageViews() {
  let location = useLocation();
  React.useEffect(() => {
    console.log(location.pathname);
    cwr("recordPageView", location.pathname);
  }, [location]);
}

function MenuRoutes() {
  usePageViews();
  return <Routes>
    <Route path="/models" element={<Models />} />
    <Route path="/upload" element={<Upload />} />
    <Route path="/admin/models" element={<AdminModels />} />
    <Route exact path="/" element={<Home />} />
  </Routes>;
}

class FixedMenuLayout extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
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
      console.log("User Groups: ")
      console.log(groups)
      if (this._isMounted && groups !== undefined ) {
        this.setState({ groups: groups })
      }
    })
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  componentDidCatch(error, info) {
    console.log(error);
    cwr('recordError', error);
  };

  render() {
    var menuItems = [<Menu.Item as={Link} name='Upload' to='/upload' ></Menu.Item>]
    menuItems.push(<Menu.Item as={Link} name='Models' to='/models'></Menu.Item>)
    if(this.state.groups.includes('admin')){
      menuItems.push(<Menu.Item as={Link} name='Admin Models' to='/admin/models'></Menu.Item>)
    }
  
    return (
      <div>
        <Router>
          <Menu fixed='top' inverted>
            <Container>
              <Menu.Item as={Link} to='/' header>
                <Image size='mini' src='/logo.png' style={{ marginRight: '1.5em' }} />
                DREM
              </Menu.Item>

              {menuItems}

              <Menu.Menu position='right'>
                <Menu.Item as='a' name={this.props.user}></Menu.Item>
                <Menu.Item as='a' name='Sign Out' onClick={this.props.signout}></Menu.Item>
              </Menu.Menu>
            </Container>
          </Menu>

          <Container text style={{ marginTop: '7em' }}>
            <MenuRoutes />
          </Container>
        </Router>
      </div>
    )
  }
}

export default FixedMenuLayout
