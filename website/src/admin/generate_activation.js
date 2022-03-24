import React, { Component } from 'react';
import { API } from 'aws-amplify';
import {  Header, Button, Grid, Container, Divider, Message, Dimmer, Loader } from 'semantic-ui-react';

class AdminActivation extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      result: "",
      ActivationCode: "",
      ActivationId: "",
      region: "",
      SSMCommand: "",
      loading: false
    };
  }

  getActivation = async () => {
    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/create_ssm_activation';

    this.setState({
      loading: true,
    });

    let response = await API.get(apiName, apiPath);
    //console.log(response)

    this.setState({
      result: response,
      ActivationCode: response['ActivationCode'],
      ActivationId: response['ActivationId'],
      region: response['region'],
      SSMCommand: 'sudo amazon-ssm-agent -register -code "'+ response['ActivationCode'] +'" -id "'+ response['ActivationId'] +'" -region "'+ response['region'] +'"',
      loading: false,
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
        <Header as='h1' icon textAlign='center'>Systems Manager Hybrid Activation</Header>
        <Divider />
        <Container>
          <Grid columns={3} centered>

            <Grid.Row>
              <Grid.Column width={3}>
                <Header as='h3'>Code</Header>
              </Grid.Column>
              <Grid.Column width={10} textAlign='center'>
                <Message id="code" color='black'>
                  <Dimmer active={this.state.loading} inverted>
                    <Loader/>
                  </Dimmer>
                  {this.state.ActivationCode}
                </Message>
              </Grid.Column>
              <Grid.Column width={3} textAlign='right'>
                <Button content='Copy' icon='copy' onClick={() => {navigator.clipboard.writeText(this.state.ActivationCode)}}/>
              </Grid.Column>
            </Grid.Row>

            <Grid.Row>
              <Grid.Column width={3}>
                <Header as='h3'>Id</Header>
              </Grid.Column>
              <Grid.Column width={10} textAlign='center'>
                <Message id="code" color='black'>
                  <Dimmer active={this.state.loading} inverted>
                    <Loader/>
                  </Dimmer>
                  {this.state.ActivationId}
                </Message>
              </Grid.Column>
              <Grid.Column width={3} textAlign='right'>
                <Button content='Copy' icon='copy' onClick={() => {navigator.clipboard.writeText(this.state.ActivationId)}}/>
              </Grid.Column>
            </Grid.Row>

            <Grid.Row>
              <Grid.Column width={3}>
                <Header as='h3'>Command</Header>
              </Grid.Column>
              <Grid.Column width={10} textAlign='center'>
                <Message id="code" color='black'>
                  <Dimmer active={this.state.loading} inverted>
                    <Loader/>
                  </Dimmer>
                  {this.state.SSMCommand}
                </Message>
              </Grid.Column>
              <Grid.Column width={3} textAlign='right'>
                <Button content='Copy' icon='copy' onClick={() => {navigator.clipboard.writeText(this.state.SSMCommand)}}/>
              </Grid.Column>
            </Grid.Row>

          </Grid>
        </Container>
        <Divider />
        <Container textAlign='center'>
          <Button content='Generate' color='green' onClick={() => {this.getActivation();}} disabled={this.state.loading}/>
        </Container>
      </div>
    )
  }
}

export {AdminActivation}
