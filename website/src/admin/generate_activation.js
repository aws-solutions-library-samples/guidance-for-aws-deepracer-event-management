import React, { Component } from 'react';
import { API } from 'aws-amplify';
import {  Header, Button, Grid, Container, Divider } from 'semantic-ui-react';

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

  getActivation = async () => {
    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/create_ssm_activation';

    let response = await API.get(apiName, apiPath);
    //console.log(response)
    
    this.setState({ 
      result: response,
      ActivationCode: response['ActivationCode'],
      ActivationId: response['ActivationId']
    });
    //return response
  }

  componentDidMount = async () => {
    //await this.getActivation();
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    return (
      <div>
        <Header as='h1' icon textAlign='center'>Activation Key</Header>
        <Divider />
        <Container>
          <Grid columns={3} centered>

            <Grid.Row>
              <Grid.Column width={4}>
                <Header as='h3'>Activation Code</Header>
              </Grid.Column>
              <Grid.Column width={8} textAlign='center'>
                {this.state.ActivationCode}
              </Grid.Column>
              <Grid.Column width={4} textAlign='right'>
                <Button content='Copy' icon='copy' onClick={() => {navigator.clipboard.writeText(this.state.ActivationCode)}}/>
              </Grid.Column>
            </Grid.Row>

            <Grid.Row>
              <Grid.Column width={4}>
                <Header as='h3'>Activation Id</Header>
              </Grid.Column>
              <Grid.Column width={8} textAlign='center'>
                {this.state.ActivationId}
              </Grid.Column>
              <Grid.Column width={4} textAlign='right'>
                <Button content='Copy' icon='copy' onClick={() => {navigator.clipboard.writeText(this.state.ActivationId)}}/>
              </Grid.Column>
            </Grid.Row>

          </Grid>
        </Container>
        <Divider />
        <Container textAlign='center'>
          <Button content='Generate' color='green' onClick={() => {this.getActivation();}}/>
        </Container>
      </div>
    )
  }
}

export {AdminActivation}