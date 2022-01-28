import React, { Component } from 'react';
import {
  Container,
  Image,
  Menu,
} from 'semantic-ui-react'
import { Auth } from 'aws-amplify';

import { Models } from './models.js';
import { AdminModels } from './adminModels.js';
import { Uploader } from './uploader.js';

class FixedMenuLayout extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      activeItem: 'Uploader',
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

  handleItemClick = (e, { name }) => {
    console.log(name)
    this.setState({ activeItem: name })
  }

  render() {
    //const { activeItem } = this.state

    var content = <Uploader />
    if (this.state.activeItem === 'Models') {
      content = <Models />
    }
    else if (this.state.activeItem === 'Admin Models') {
      content = <AdminModels />
    }
    else {
      content = <Uploader />
    }

    var menuItems = [<Menu.Item as='a' name='Upload' onClick={this.handleItemClick}></Menu.Item>]
    menuItems.push(<Menu.Item as='a' name='Models' onClick={this.handleItemClick}></Menu.Item>)
    if(this.state.groups.includes('admin')){
      menuItems.push(<Menu.Item as='a' name='Admin Models' onClick={this.handleItemClick}></Menu.Item>)
    }

    return (
      <div>
        <Menu fixed='top' inverted>
          <Container>
            <Menu.Item as='a' header>
              <Image size='mini' src='logo.png' style={{ marginRight: '1.5em' }} />
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
          {content}
        </Container>

        
      </div>
    )
  }
}

export default FixedMenuLayout
