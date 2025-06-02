import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
// import { ListOfFleets } from '../components/listOfFleets';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import * as mutations from '../graphql/mutations';
import { Breadcrumbs } from './fleets/support-functions/supportFunctions';

import {
  Badge,
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
  Toggle,
} from '@cloudscape-design/components';
import { PageLayout } from '../components/pageLayout';
import { useStore } from '../store/store';

const AdminCarActivation = (props) => {
  const { t } = useTranslation(['translation', 'help-admin-car-activation']);

  const [hostname, setHostname] = useState('');
  const [password, setPassword] = useState('');
  const [ssid, setSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiActivation, setWifiActivation] = useState('');
  const [installCustomConsole, setInstallCustomConsole] = useState(false);
  const [ssmCommand, setSsmCommand] = useState('');
  const [updateCommand, setUpdateCommand] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [loading, setLoading] = useState('');
  const [hostnameErrorMessage, setHostnameErrorMessage] = useState('');
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('');

  const [dropDownFleets, setDropDownFleets] = useState([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState({
    fleetName: t('fleets.edit-cars.select-fleet'),
  });

  const [state] = useStore();
  const fleets = state.fleets.fleets;

  const [dremUrl] = useState(
    window.location.protocol +
      '//' +
      window.location.hostname +
      (window.location.port ? ':' + window.location.port : '')
  );

  // convert fleets data to dropdown format
  useEffect(() => {
    if (fleets.length > 0) {
      setDropDownFleets(
        fleets
          .map((thisFleet) => {
            return {
              id: thisFleet.fleetId,
              text: thisFleet.fleetName,
            };
          })
          .sort((a, b) => (a.text.toLowerCase() > b.text.toLowerCase() ? 1 : -1))
      );
    }

    return () => {
      // Unmounting
    };
  }, [fleets]);

  useEffect(() => {
    if (ssid !== '' && wifiPass !== '') {
      setWifiActivation(' -s ' + ssid + ' -w ' + wifiPass);
    } else {
      setWifiActivation('');
    }
    return () => {
      // Unmounting
    };
  }, [ssid, wifiPass]);

  // watch properties for changes and enable generate button if required
  useEffect(() => {
    if (
      password !== '' &&
      hostname !== '' &&
      dropDownSelectedItem.fleetName !== t('fleets.edit-cars.select-fleet')
    ) {
      setButtonDisabled(false);
    }
    return () => {
      // Unmounting
    };
  }, [t, password, hostname, dropDownSelectedItem]);

  async function getActivation() {
    const apiResponse = await API.graphql({
      query: mutations.deviceActivation,
      variables: {
        hostname: hostname,
        deviceType: 'deepracer',
        fleetId: dropDownSelectedItem.fleetId,
        fleetName: dropDownSelectedItem.fleetName,
        deviceUiPassword: password,
      },
    });
    const response = apiResponse['data']['deviceActivation'];
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
        dremUrl +
        '/login.html && curl -O ' +
        dremUrl +
        '/car_activation.sh && chmod +x ./car_activation.sh && sudo ./car_activation.sh -p ' +
        password +
        ' -h ' +
        hostname +
        ' -c ' +
        response['activationCode'] +
        ' -i ' +
        response['activationId'] +
        ' -r ' +
        response['region'] +
        wifiActivation +
        (installCustomConsole ? ' -u' : '')
    );
    setLoading('');
  }

  const breadcrumbs = Breadcrumbs();
  breadcrumbs.push({ text: t('AdminActivation.car-activation.breadcrumb') });

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-car-activation' })}
          bodyContent={t('content', { ns: 'help-admin-car-activation' })}
          footerContent={t('footer', { ns: 'help-admin-car-activation' })}
        />
      }
      header={t('AdminActivation.car-activation.header')}
      description={t('AdminActivation.car-activation.description')}
      breadcrumbs={breadcrumbs}
    >
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
                {t('AdminActivation.car-activation.generate')}
              </Button>
            </SpaceBetween>
          }
        >
          <Container textAlign="center">
            <SpaceBetween direction="vertical" size="l">
              <FormField label={t('AdminActivation.car-activation.fleet')}>
                <ButtonDropdown
                  items={dropDownFleets}
                  onItemClick={({ detail }) => {
                    const index = fleets.map((e) => e.fleetId).indexOf(detail.id);
                    if (detail.id !== 'none') {
                      setDropDownSelectedItem(fleets[index]);
                    }
                  }}
                >
                  {dropDownSelectedItem.fleetName}
                </ButtonDropdown>
              </FormField>
              <FormField
                label={t('AdminActivation.car-activation.hostname')}
                errorText={hostnameErrorMessage}
              >
                <Input
                  value={hostname}
                  placeholder={t('AdminActivation.car-activation.hostname-placeholder')}
                  onChange={(fleet) => {
                    setHostname(fleet.detail.value);
                  }}
                />
              </FormField>
              <FormField
                label={t('AdminActivation.car-activation.password')}
                errorText={passwordErrorMessage}
              >
                <Input
                  value={password}
                  placeholder={t('AdminActivation.car-activation.password-placeholder')}
                  onChange={(fleet) => {
                    setPassword(fleet.detail.value);
                  }}
                />
              </FormField>
              <FormField label={t('AdminActivation.car-activation.custom-console')}>
                <Toggle
                  checked={installCustomConsole}
                  onChange={({ detail }) => {
                    setInstallCustomConsole(detail.checked);
                  }}
                >
                  <Badge color="blue">{t('topnav.beta')}</Badge>
                </Toggle>
              </FormField>

              <ExpandableSection header={t('AdminActivation.car-activation.wifi-config')}>
                <FormField label={t('AdminActivation.car-activation.ssid')}>
                  <Input
                    value={ssid}
                    placeholder={t('AdminActivation.car-activation.ssid-placeholder')}
                    onChange={(fleet) => {
                      setSsid(fleet.detail.value);
                    }}
                  />
                </FormField>
                <FormField label={t('AdminActivation.car-activation.wifi')}>
                  <Input
                    value={wifiPass}
                    placeholder={t('AdminActivation.car-activation.wifi-placeholder')}
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
            <Header variant="h3">{t('AdminActivation.car-activation.script')}</Header>
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
              content={
                <StatusIndicator type="success">{t('common.copied-to-clipboard')}</StatusIndicator>
              }
            >
              <Button
                iconName="copy"
                onClick={() => {
                  navigator.clipboard.writeText(updateCommand);
                }}
              >
                {t('common.button.copy')}
              </Button>
            </Popover>
          </Grid>

          <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
            <Header variant="h3">{t('AdminActivation.car-activation.ssm-only')}</Header>
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
              content={
                <StatusIndicator type="success">{t('common.copied-to-clipboard')}</StatusIndicator>
              }
            >
              <Button
                iconName="copy"
                onClick={() => {
                  navigator.clipboard.writeText(ssmCommand);
                }}
              >
                {t('common.button.copy')}
              </Button>
            </Popover>
          </Grid>
        </Container>

        <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }]}>
          <div></div>
          <div>
            <Button href="/car_activation.sh" iconAlign="right" iconName="external">
              car_activation.sh {t('AdminActivation.car-activation.script-lower')}
            </Button>
            <TextContent>
              <p>{t('AdminActivation.car-activation.script-warning')}</p>
            </TextContent>
          </div>
        </Grid>

        <TextContent>
          <p>{t('AdminActivation.car-activation.version-warning')}</p>
        </TextContent>
      </SpaceBetween>
    </PageLayout>
  );
};

export { AdminCarActivation };
