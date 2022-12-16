import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { ContentHeader } from '../components/ContentHeader';
import { ListOfFleets } from '../components/ListOfFleets';
//import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
//import * as subscriptions from '../graphql/subscriptions'

import {
  Box,
  Button,
  ButtonDropdown,
  Container,
  ExpandableSection,
  Form,
  FormField,
  Grid,
  Header,
  Input,
  Popover,
  SpaceBetween,
  StatusIndicator,
  TextContent,
} from '@cloudscape-design/components';

export function AdminActivation(props) {
  const [result, setResult] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [activationId, setActivationId] = useState('');
  const [region, setRegion] = useState('');
  const [hostname, setHostname] = useState('');
  const [password, setPassword] = useState('');
  const [ssid, setSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [ssmCommand, setSsmCommand] = useState('');
  const [updateCommand, setUpdateCommand] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [loading, setLoading] = useState('');
  const [hostnameErrorMessage, setHostnameErrorMessage] = useState('');
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');

  const [dropDownFleets, setDropDownFleets] = useState([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState({ fleetName: 'Select Fleet' });

  const [isLoading, setIsLoading] = useState(true);
  const fleets = ListOfFleets(setIsLoading);

  // convert fleets data to dropdown format
  useEffect(() => {
    if (fleets.length > 0) {
      setDropDownFleets(
        fleets.map((thisFleet) => {
          return {
            id: thisFleet.fleetId,
            text: thisFleet.fleetName,
          };
        })
      );
    }
    return () => {
      // Unmounting
    };
  }, [fleets]);

  // watch properties for changes and enable generate button if required
  useEffect(() => {
    if (password !== '' && hostname !== '' && dropDownSelectedItem.fleetName !== 'Select Fleet') {
      setButtonDisabled(false);
    }
    return () => {
      // Unmounting
    };
  }, [password, hostname, dropDownSelectedItem]);

  async function getActivation() {
    const apiResponse = await API.graphql({
      query: mutations.carActivation,
      variables: {
        fleetId: dropDownSelectedItem.fleetId,
        fleetName: dropDownSelectedItem.fleetName,
        hostname: hostname,
      },
    });
    const response = apiResponse['data']['carActivation'];
    setResult(response);
    setActivationCode(response['activationCode']);
    setActivationId(response['activationId']);
    setRegion(response['region']);
    setSsmCommand(
      'sudo amazon-ssm-agent -register -code "' +
        response['activationCode'] +
        '" -id "' +
        response['activationId'] +
        '" -region "' +
        response['region'] +
        '"'
    );
    setUpdateCommand(
      'curl -O ' +
        window.location.protocol +
        '//' +
        window.location.hostname +
        (window.location.port ? ':' + window.location.port : '') +
        '/manual_update.sh && chmod +x ./manual_update.sh && sudo ./manual_update.sh -p ' +
        password +
        ' -h ' +
        hostname +
        ' -c ' +
        response['activationCode'] +
        ' -i ' +
        response['activationId'] +
        ' -r ' +
        response['region'] +
        ' -s ' +
        ssid +
        ' -w ' +
        wifiPass
    );
    setLoading('');
  }

  return (
    <>
      <ContentHeader
        header="Car activation"
        description="Create systems manager activation to register and update cars."
        breadcrumbs={[
          { text: 'Home', href: '/' },
          { text: 'Admin', href: '/admin/home' },
          { text: 'Car activiation' },
        ]}
      />
      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <SpaceBetween direction="vertical" size="l">
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="primary"
                  onClick={() => {
                    getActivation();
                  }}
                  disabled={buttonDisabled}
                >
                  Generate
                </Button>
              </SpaceBetween>
            }
          >
            <Container textAlign="center">
              <SpaceBetween direction="vertical" size="l">
                <FormField label="Fleet">
                  <ButtonDropdown
                    items={dropDownFleets}
                    onItemClick={({ detail }) => {
                      const index = fleets.map((e) => e.fleetId).indexOf(detail.id);
                      setDropDownSelectedItem(fleets[index]);
                    }}
                  >
                    {dropDownSelectedItem.fleetName}
                  </ButtonDropdown>
                </FormField>
                <FormField label="Hostname" errorText={hostnameErrorMessage}>
                  <Input
                    value={hostname}
                    placeholder="deepracer01"
                    onChange={(fleet) => {
                      setHostname(fleet.detail.value);
                    }}
                  />
                </FormField>
                <FormField label="Password" errorText={passwordErrorMessage}>
                  <Input
                    value={password}
                    placeholder="password"
                    onChange={(fleet) => {
                      setPassword(fleet.detail.value);
                    }}
                  />
                </FormField>

                <ExpandableSection header="Optional WiFi config for networks with hidden SSIDs">
                  <FormField label="SSID">
                    <Input
                      value={ssid}
                      placeholder="ssid"
                      onChange={(fleet) => {
                        setSsid(fleet.detail.value);
                      }}
                    />
                  </FormField>
                  <FormField label="WiFi Password">
                    <Input
                      value={wifiPass}
                      placeholder="wifimagic"
                      onChange={(fleet) => {
                        setWifiPass(fleet.detail.value);
                      }}
                    />
                  </FormField>
                </ExpandableSection>
              </SpaceBetween>
            </Container>
          </Form>

          <Container>
            <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
              <Header variant="h3">Script</Header>
              <Container>
                <Box color="text-status-info" textAlign="center">
                  {loading}
                  <code>{updateCommand}</code>
                </Box>
              </Container>
              <Popover
                dismissButton={false}
                position="right"
                size="small"
                triggerType="custom"
                content={<StatusIndicator type="success">copied to clipboard</StatusIndicator>}
              >
                <Button
                  iconName="copy"
                  onClick={() => {
                    navigator.clipboard.writeText(updateCommand);
                  }}
                >
                  Copy
                </Button>
              </Popover>
            </Grid>

            <ExpandableSection header="Advanced">
              <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                <Header variant="h3">Code</Header>
                <Container>
                  <Box color="text-status-info" textAlign="center">
                    {loading}
                    <code>{activationCode}</code>
                  </Box>
                </Container>
                <Popover
                  dismissButton={false}
                  position="right"
                  size="small"
                  triggerType="custom"
                  content={<StatusIndicator type="success">copied to clipboard</StatusIndicator>}
                >
                  <Button
                    iconName="copy"
                    onClick={() => {
                      navigator.clipboard.writeText(activationCode);
                    }}
                  >
                    Copy
                  </Button>
                </Popover>
              </Grid>

              <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                <Header variant="h3">Id</Header>
                <Container>
                  <Box color="text-status-info" textAlign="center">
                    {loading}
                    <code>{activationId}</code>
                  </Box>
                </Container>
                <Popover
                  dismissButton={false}
                  position="right"
                  size="small"
                  triggerType="custom"
                  content={<StatusIndicator type="success">copied to clipboard</StatusIndicator>}
                >
                  <Button
                    iconName="copy"
                    onClick={() => {
                      navigator.clipboard.writeText(activationId);
                    }}
                  >
                    Copy
                  </Button>
                </Popover>
              </Grid>

              <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
                <Header variant="h3">SSM Only</Header>
                <Container>
                  <Box color="text-status-info" textAlign="center">
                    {loading}
                    <code>{ssmCommand}</code>
                  </Box>
                </Container>
                <Popover
                  dismissButton={false}
                  position="right"
                  size="small"
                  triggerType="custom"
                  content={<StatusIndicator type="success">copied to clipboard</StatusIndicator>}
                >
                  <Button
                    iconName="copy"
                    onClick={() => {
                      navigator.clipboard.writeText(ssmCommand);
                    }}
                  >
                    Copy
                  </Button>
                </Popover>
              </Grid>
            </ExpandableSection>
          </Container>

          <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
            <div></div>
            <div>
              <Button href="/manual_update.sh" iconAlign="right" iconName="external">
                manual_update.sh script
              </Button>
              <TextContent>
                <p>
                  <b>Note:</b> This script will disable the car GUI
                </p>
              </TextContent>
            </div>
          </Grid>
        </SpaceBetween>
        <div></div>
      </Grid>
    </>
  );
}
