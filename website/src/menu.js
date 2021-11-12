
import React, { Component } from 'react';
import { Tab } from 'semantic-ui-react';

import { Models } from './models.js';
import { Uploader } from './uploader.js';

class Menu extends Component {
    constructor(props) {
      super(props);
      this.containerDiv = React.createRef();
      this.state = {
        activeIndex: 0
      };
    }
    _isMounted = false;
  
    componentDidMount() {
      this._isMounted = true;
    }
  
    componentWillUnmount() {
      this._isMounted = false;
    }
  
    handleTabChange = (e, { activeIndex }) => this.setState({ activeIndex })
  
    render() {
      var panes = [
        {
          menuItem: 'Models',
          render: () => <Tab.Pane attached={false}><Models /></Tab.Pane>,
        },
        {
          menuItem: 'Upload',
          render: () => <Tab.Pane attached={false}><Uploader /></Tab.Pane>,
        },
      ]
      
      var Tabs = () => <Tab 
        menu={{ pointing: true }} 
        activeIndex={this.state.activeIndex}
        panes={panes} 
        onTabChange={this.handleTabChange}
      />;
  
      return (
        <div>
          <Tabs />
        </div>
      );
    }
}

export {Menu}