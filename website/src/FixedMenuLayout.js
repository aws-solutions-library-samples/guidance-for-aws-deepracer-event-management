import React, { Component } from 'react';
import {
  Container,
  Image,
  Menu,
} from 'semantic-ui-react'

import { Models } from './models.js';
import { Uploader } from './uploader.js';

class FixedMenuLayout extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      activeItem: 'Models'
    };
  }
  _isMounted = false;

  handleItemClick = (e, { name }) => this.setState({ activeItem: name })

  render() {
    //const { activeItem } = this.state

    var content = <Models />
    if (this.state.activeItem === 'Upload') {
      content = <Uploader />
    }
    else{
      content = <Models />
    }

    return (
      <div>
        <Menu fixed='top' inverted>
          <Container>
            <Menu.Item as='a' header>
              <Image size='mini' src='logo.png' style={{ marginRight: '1.5em' }} />
              DREM
            </Menu.Item>

            <Menu.Item as='a' name='Models' onClick={this.handleItemClick}></Menu.Item>
            <Menu.Item as='a' name='Upload' onClick={this.handleItemClick}></Menu.Item>

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
