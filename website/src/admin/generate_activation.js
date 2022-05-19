import React, { Component } from 'react';
import { API } from 'aws-amplify';
import {  Input, Header, Button, Grid, Container, Divider, Message, Dimmer, Loader } from 'semantic-ui-react';

class AdminActivation extends Component {
  constructor(props) {
    super(props);
    this.containerDiv = React.createRef();
    this.state = {
      result: "",
      ActivationCode: "",
      ActivationId: "",
      region: "",
      hostname: "",
      password: "",
      ssid: "",
      wifiPass: "",
      SSMCommand: "",
      UpdateCommand: "",
      buttonDisabled: true,
      loading: false
    };
  }

  getActivation = async () => {
    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/create_ssm_activation';

    this.setState({
      buttonDisabled: true,
      loading: true,
    });

    const myInit = {
      body: {
        hostname: this.state.hostname,
        password: this.state.password,
        ssid: this.state.ssid,
        wifiPass: this.state.wifiPass
      }
    };

    let response = await API.post(apiName, apiPath, myInit);
    //console.log(response)

    this.setState({
      result: response,
      ActivationCode: response['ActivationCode'],
      ActivationId: response['ActivationId'],
      region: response['region'],
      SSMCommand: 'sudo amazon-ssm-agent -register -code "'+ response['ActivationCode'] +'" -id "'+ response['ActivationId'] +'" -region "'+ response['region'] +'"',
      UpdateCommand: 'curl -O ' + window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port: '') + '/manual_update.sh && chmod +x ./manual_update.sh && sudo ./manual_update.sh -p ' + this.state.password + ' -h ' + this.state.hostname + ' -c '+ response['ActivationCode'] +' -i '+ response['ActivationId'] +' -r '+ response['region'] +' -s '+ this.state.ssid +' -w '+ this.state.wifiPass,
      loading: false,
    });
    //return response
  }

  handleChange = (e) => {
    this.setState({
      [e.target.name]: e.target.value
    })

    if (this.state.password!=='' && this.state.hostname!=='') {
      this.setState({
        buttonDisabled: false,
      })
    }
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
                <Header as='h3'>SSM Only</Header>
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

            <Grid.Row>
              <Grid.Column width={3}>
                <Header as='h3'>Script</Header>
              </Grid.Column>
              <Grid.Column width={10} textAlign='center'>
                <Message id="code" color='black'>
                  <Dimmer active={this.state.loading} inverted>
                    <Loader/>
                  </Dimmer>
                  {this.state.UpdateCommand}
                </Message>
              </Grid.Column>
              <Grid.Column width={3} textAlign='right'>
                <Button content='Copy' icon='copy' onClick={() => {navigator.clipboard.writeText(this.state.UpdateCommand)}}/>
              </Grid.Column>
            </Grid.Row>

          </Grid>
        </Container>
        <Divider />
        <Container textAlign='center'>
          <div>
            <p><Input label='Hostname' name='hostname' placeholder='deepracer01' onChange={this.handleChange}/></p>
            <p><Input label='Password' name='password' placeholder='password' onChange={this.handleChange}/></p>
            <Divider />
            <p>Optional WiFi config for networks with hidden SSIDs</p>
            <p><Input label='SSID' name='ssid' placeholder='ssid' onChange={this.handleChange}/></p>
            <p><Input label='WiFi Password' name='wifiPass' placeholder='wifimagic' onChange={this.handleChange}/></p>
            <Divider />
            <p><Button content='Generate' color='green' onClick={() => {this.getActivation();}} disabled={this.state.buttonDisabled}/></p>
            <p><a href="/manual_update.sh">manual_update.sh script</a></p>
            <p><b>Note:</b> this script will disable the GUI.</p>
          </div>
        </Container>
      </div>
    )
  }
}

export {AdminActivation}
