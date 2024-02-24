import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
// import { ListOfFleets } from '../components/listOfFleets';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import * as mutations from '../graphql/mutations';
import { Breadcrumbs } from './fleets/support-functions/supportFunctions';

import {
  Box,
  Button,
  ButtonDropdown,
  Container,
  Form,
  FormField,
  Grid,
  Header,
  Input,
  Popover,
  SpaceBetween,
  StatusIndicator,
} from '@cloudscape-design/components';
import { PageLayout } from '../components/pageLayout';
import { useStore } from '../store/store';

const AdminTimerActivation = (props) => {
  const { t } = useTranslation(['translation', 'help-admin-timer-activation']);

  const [result, setResult] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [activationId, setActivationId] = useState('');
  const [region, setRegion] = useState('');
  const [hostname, setHostname] = useState('');
  const [ssmCommand, setSsmCommand] = useState('');
  const [updateCommand, setUpdateCommand] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(true);
  const [loading, setLoading] = useState('');
  const [hostnameErrorMessage, setHostnameErrorMessage] = useState('');

  const [dropDownFleets, setDropDownFleets] = useState([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState({
    fleetName: t('fleets.edit-cars.select-fleet'),
  });

  const [state] = useStore();
  const fleets = state.fleets.fleets;

  const [dremUrl, setDremUrl] = useState(
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

  // watch properties for changes and enable generate button if required
  useEffect(() => {
    if (hostname !== '' && dropDownSelectedItem.fleetName !== t('fleets.edit-cars.select-fleet')) {
      setButtonDisabled(false);
    }
    return () => {
      // Unmounting
    };
  }, [hostname, dropDownSelectedItem]);

  async function getActivation() {
    const apiResponse = await API.graphql({
      query: mutations.deviceActivation,
      variables: {
        hostname: hostname,
        deviceType: 'timer',
        fleetId: dropDownSelectedItem.fleetId,
        fleetName: dropDownSelectedItem.fleetName,
        deviceUiPassword: '',
      },
    });
    const response = apiResponse['data']['deviceActivation'];
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
        dremUrl +
        '/leaderboard-timer.zip && curl -O ' +
        dremUrl +
        '/timer_activation.sh && chmod +x ./timer_activation.sh && sudo ./timer_activation.sh  -h ' +
        hostname +
        ' -c ' +
        response['activationCode'] +
        ' -i ' +
        response['activationId'] +
        ' -r ' +
        response['region'] +
        ' -d ' +
        window.location.hostname +
        (window.location.port ? ':' + window.location.port : '')
    );
    setLoading('');
  }

  const breadcrumbs = Breadcrumbs();
  breadcrumbs.push({ text: t('timer-activation.breadcrumb') });

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-timer-activation' })}
          bodyContent={t('content', { ns: 'help-admin-timer-activation' })}
          footerContent={t('footer', { ns: 'help-admin-timer-activation' })}
        />
      }
      header={t('timer-activation.header')}
      description={t('timer-activation.description')}
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
                {t('timer-activation.generate')}
              </Button>
            </SpaceBetween>
          }
        >
          <Container textAlign="center">
            <SpaceBetween direction="vertical" size="l">
              <FormField label={t('timer-activation.fleet')}>
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
              <FormField label={t('timer-activation.hostname')} errorText={hostnameErrorMessage}>
                <Input
                  value={hostname}
                  placeholder={t('timer-activation.hostname-placeholder')}
                  onChange={(fleet) => {
                    setHostname(fleet.detail.value);
                  }}
                />
              </FormField>
            </SpaceBetween>
          </Container>
        </Form>

        <Container>
          <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
            <Header variant="h3">{t('timer-activation.script')}</Header>
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
            <Header variant="h3">{t('timer-activation.ssm-only')}</Header>
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
            <Button href="/timer_activation.sh" iconAlign="right" iconName="external">
              timer_activation.sh {t('timer-activation.script-lower')}
            </Button>
          </div>
        </Grid>
      </SpaceBetween>
    </PageLayout>
  );
};

export { AdminTimerActivation };
