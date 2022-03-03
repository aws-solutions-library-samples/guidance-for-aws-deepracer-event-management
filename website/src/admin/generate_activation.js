import React, { Component } from 'react';
import { API } from 'aws-amplify';
import {  Header } from 'semantic-ui-react';

class AdminActivation extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      result: "",
      ActivationCode: "",
      ActivationId: ""
    };
  }

  componentDidMount = async () => {
    async function getActivation() {
      const apiName = 'deepracerEventManager';
      const apiPath = 'cars/create_ssm_activation';
  
      let response = await API.get(apiName, apiPath);
      //console.log(response)
      return response
    }

    let activation = await getActivation();
    this.setState({ 
      result: activation,
      ActivationCode: activation['ActivationCode'],
      ActivationId: activation['ActivationId']
    });

    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    return (
      <div>
        <Header as='h1' icon textAlign='center'>Activation Key</Header>
        <div>Activation Code: {this.state.ActivationCode}</div>
        <div>Activation Id: {this.state.ActivationId}</div>
      </div>
    )
  }
}

export {AdminActivation}