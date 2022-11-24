import React, { useEffect, useState } from 'react';
import { API, } from 'aws-amplify';
import { ContentHeader } from '../components/ContentHeader';
import { ListOfEvents } from '../components/ListOfEvents.js';
//import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
//import * as subscriptions from '../graphql/subscriptions'

import {
  Grid,
  Input,
  FormField,
  Form,
  Button,
  ButtonDropdown,
  Header,
  SpaceBetween,
  Container,
  ExpandableSection,
  Popover,
  StatusIndicator,
  TextContent,
  Box,
} from '@cloudscape-design/components';

export function AdminActivation(props) {
  const [result, setResult] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [activationId, setActivationId] = useState("");
  const [region, setRegion] = useState("");
  const [hostname, setHostname] = useState("");
  const [password, setPassword] = useState("");
  const [ssid, setSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [ssmCommand, setSsmCommand] = useState("");
  const [updateCommand, setUpdateCommand] = useState("");
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [loading, setLoading] = useState("");
  const [hostnameErrorMessage, setHostnameErrorMessage] = useState("");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");

  const [dropDownEvents, setDropDownEvents] = useState([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState({ eventName: 'Select Event' })

  const [isLoading, setIsLoading] = useState(true);
  const events = ListOfEvents(setIsLoading);


  // convert events data to dropdown format
  useEffect(() => {
    if (events.length > 0) {
      setDropDownEvents(events.map(thisEvent => {
        return {
          id: thisEvent.eventId,
          text: thisEvent.eventName
        };
      }));
    }
    return () => {
      // Unmounting
    }
  }, [events])

  // watch properties for changes and enable generate button if required
  useEffect(() => {
    if (password !== '' && hostname !== '' && dropDownSelectedItem.eventName !== 'Select Event') {
      setButtonDisabled(false);
    }
    return () => {
      // Unmounting
    }
  }, [password, hostname, dropDownSelectedItem])

  async function getActivation() {
    const apiResponse = await API.graphql({
      query: mutations.carActivation,
      variables: {
        eventId: dropDownSelectedItem.eventId,
        eventName: dropDownSelectedItem.eventName,
        hostname: hostname
      }
    });
    const response = apiResponse['data']['carActivation']
    setResult(response);
    setActivationCode(response['activationCode']);
    setActivationId(response['activationId']);
    setRegion(response['region']);
    setSsmCommand('sudo amazon-ssm-agent -register -code "' + response['activationCode'] + '" -id "' + response['activationId'] + '" -region "' + response['region'] + '"');
    setUpdateCommand('curl -O ' + window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '') + '/manual_update.sh && chmod +x ./manual_update.sh && sudo ./manual_update.sh -p ' + password + ' -h ' + hostname + ' -c ' + response['activationCode'] + ' -i ' + response['activationId'] + ' -r ' + response['region'] + ' -s ' + ssid + ' -w ' + wifiPass);
    setLoading("");
  }



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
                <Button variant='primary' onClick={() => { getActivation(); }} disabled={buttonDisabled}>Generate</Button>
              </SpaceBetween>
            }
          >
            <Container textAlign='center'>
              <SpaceBetween direction="vertical" size="l">
                <FormField label='Event'>
                  <ButtonDropdown
                    items={dropDownEvents}
                    onItemClick={({ detail }) => {
                      const index = events.map(e => e.eventId).indexOf(detail.id);
                      setDropDownSelectedItem(events[index]);
                    }}
                  >
                    {dropDownSelectedItem.eventName}
                  </ButtonDropdown>
                </FormField>
                <FormField label="Hostname" errorText={hostnameErrorMessage}>
                  <Input value={hostname} placeholder='deepracer01' onChange={event => {
                    setHostname(event.detail.value);
                  }} />
                </FormField>
                <FormField label="Password" errorText={passwordErrorMessage}>
                  <Input value={password} placeholder='password' onChange={event => {
                    setPassword(event.detail.value);
                  }} />
                </FormField>


                <ExpandableSection header="Optional WiFi config for networks with hidden SSIDs">
                  <FormField label='SSID'>
                    <Input value={ssid} placeholder='ssid' onChange={event => {
                      setSsid(event.detail.value);
                    }} />
                  </FormField>
                  <FormField label='WiFi Password'>
                    <Input value={wifiPass} placeholder='wifimagic' onChange={event => {
                      setWifiPass(event.detail.value);
                    }} />
                  </FormField>
                </ExpandableSection>
              </SpaceBetween>
            </Container>
          </Form>

          <Container>

            <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
              <Header variant='h3'>Script</Header>
              <Container>
                <Box color='text-status-info' textAlign='center'>
                  {loading}
                  <code>
                    {updateCommand}
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
                <Button iconName='copy' onClick={() => { navigator.clipboard.writeText(updateCommand) }}>Copy</Button>
              </Popover>
            </Grid>

            <ExpandableSection header="Advanced">
              <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                <Header variant='h3'>Code</Header>
                <Container>
                  <Box color='text-status-info' textAlign='center'>
                    {loading}
                    <code>
                      {activationCode}
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
                  <Button iconName='copy' onClick={() => { navigator.clipboard.writeText(activationCode) }}>Copy</Button>
                </Popover>
              </Grid>

              <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                <Header variant='h3'>Id</Header>
                <Container>
                  <Box color='text-status-info' textAlign='center'>
                    {loading}
                    <code>
                      {activationId}
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
                  <Button iconName='copy' onClick={() => { navigator.clipboard.writeText(activationId) }}>Copy</Button>
                </Popover>
              </Grid>

              <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                <Header variant='h3'>SSM Only</Header>
                <Container>
                  <Box color='text-status-info' textAlign='center'>
                    {loading}
                    <code>
                      {ssmCommand}
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
                  <Button iconName='copy' onClick={() => { navigator.clipboard.writeText(ssmCommand) }}>Copy</Button>
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
