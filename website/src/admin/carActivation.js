import React, { Component } from 'react';
import { API } from 'aws-amplify';
import { ContentHeader } from '../components/ContentHeader';
import {
  Grid,
  Input,
  FormField,
  Form,
  Button,
  Header,
  SpaceBetween,
  Container,
  ExpandableSection,
  Popover,
  StatusIndicator,
  TextContent,
  Box,
  Spinner
} from '@cloudscape-design/components';

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
      loading: ""
    };
  }

  getActivation = async () => {
    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/create_ssm_activation';

    this.setState({
      buttonDisabled: true,
      loading: <Spinner />,
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
      loading: "",
    });
    //return response
  }

  checkForEmptyFields = (e) => {
    // if (this.state.hostname.length < 1) {
    //   console.log('error')
    //   this.setState({hostnameErrorMessage: "This Field can not be empty"})
    // } else {
    //   console.log('no error')
    //   this.setState({hostnameErrorMessage: ""})
    // }

    // if (this.state.password.length < 1 ) {
    //   this.setState({stateErrorMessage: "This Field can not be empty"})
    // } else {
    //   this.setState({stateErrorMessage: ""})
    // }

    if (this.state.password!=='' && this.state.hostname!=='') {
      this.setState({
        buttonDisabled: false,
      })
    }
    // console.log(this.state.hostname)
    // console.log(this.state.password)
    //console.log(this.state.hostnameErrorMessage)
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
      <>
        <ContentHeader
          header="Car activation"
          description="Create systems manager activation to register and update cars."
          breadcrumbs={[
            { text: "Home", href: "/" },
            { text: "Admin", href: "/admin/home" },
            { text: "Car activiation" }
          ]}
        />
        <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
          <div></div>
          <SpaceBetween direction="vertical" size="l">

            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant='primary' onClick={() => {this.getActivation();}} disabled={this.state.buttonDisabled}>Generate</Button>
                </SpaceBetween>
              }
              >
              <Container textAlign='center'>
                <SpaceBetween direction="vertical" size="l">
                  <FormField label="Hostname" errorText={this.state.hostnameErrorMessage}>
                    <Input value={this.state.hostname} placeholder='deepracer01' onChange={event => {
                      this.setState({hostname: (event.detail.value)});
                      this.checkForEmptyFields();
                    }}/>
                  </FormField>
                  <FormField label="Password" errorText={this.state.passwordErrorMessage}>
                    <Input value={this.state.password} placeholder='password' onChange={event => {
                      this.setState({password: (event.detail.value)});
                      this.checkForEmptyFields();
                    }}/>
                  </FormField>
                  <ExpandableSection header="Optional WiFi config for networks with hidden SSIDs">
                    <FormField label='SSID'>
                      <Input value={this.state.ssid} placeholder='ssid' onChange={event => {
                      this.setState({ssid: (event.detail.value)});
                    }}/>
                    </FormField>
                    <FormField label='WiFi Password'>
                      <Input value={this.state.wifiPass} placeholder='wifimagic' onChange={event => {
                      this.setState({wifiPass: (event.detail.value)});
                    }}/>
                    </FormField>
                  </ExpandableSection>
                </SpaceBetween>
              </Container>
            </Form>

            <Container>

            <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2}]}>
                <Header variant='h3'>Script</Header>
                <Container>
                  <Box color='text-status-info' textAlign='center'>
                    {this.state.loading}
                    <code>
                      {this.state.UpdateCommand}
                    </code>
                  </Box>
                </Container>
                <Popover dismissButton={false} position="right" size="small" triggerType="custom"
                  content={
                    <StatusIndicator type="success">
                      copied to clipboard
                    </StatusIndicator>
                  }
                >
                  <Button iconName='copy' onClick={() => {navigator.clipboard.writeText(this.state.UpdateCommand)}}>Copy</Button>
                </Popover>
              </Grid>

              <ExpandableSection header="Advanced">
                <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2}]}>
                  <Header variant='h3'>Code</Header>
                  <Container>
                    <Box color='text-status-info' textAlign='center'>
                      {this.state.loading}
                      <code>
                        {this.state.ActivationCode}
                      </code>
                    </Box>
                  </Container>
                  <Popover dismissButton={false} position="right" size="small" triggerType="custom"
                    content={
                      <StatusIndicator type="success">
                        copied to clipboard
                      </StatusIndicator>
                    }
                  >
                    <Button iconName='copy' onClick={() => {navigator.clipboard.writeText(this.state.ActivationCode)}}>Copy</Button>
                  </Popover>
                </Grid>

                <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2}]}>
                  <Header variant='h3'>Id</Header>
                  <Container>
                    <Box color='text-status-info' textAlign='center'>
                      {this.state.loading}
                      <code>
                        {this.state.ActivationId}
                      </code>
                    </Box>
                  </Container>
                  <Popover dismissButton={false} position="right" size="small" triggerType="custom"
                    content={
                      <StatusIndicator type="success">
                        copied to clipboard
                      </StatusIndicator>
                    }
                  >
                    <Button iconName='copy' onClick={() => {navigator.clipboard.writeText(this.state.ActivationId)}}>Copy</Button>
                  </Popover>
                </Grid>

                <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2}]}>
                  <Header variant='h3'>SSM Only</Header>
                  <Container>
                    <Box color='text-status-info' textAlign='center'>
                      {this.state.loading}
                      <code>
                        {this.state.SSMCommand}
                      </code>
                    </Box>
                  </Container>
                  <Popover dismissButton={false} position="right" size="small" triggerType="custom"
                    content={
                      <StatusIndicator type="success">
                        copied to clipboard
                      </StatusIndicator>
                    }
                  >
                    <Button iconName='copy' onClick={() => {navigator.clipboard.writeText(this.state.SSMCommand)}}>Copy</Button>
                  </Popover>
                </Grid>
              </ExpandableSection>

              
            </Container>

            <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
              <div></div>
              <div>
            <Button href="/manual_update.sh" iconAlign="right" iconName="external">manual_update.sh script</Button>
            <TextContent><p><b>Note:</b> This script will disable the car GUI</p></TextContent>
            </div>
          </Grid>
        </SpaceBetween>
        <div></div>
        </Grid>
      </>
    )
  }
}

export {AdminActivation}
