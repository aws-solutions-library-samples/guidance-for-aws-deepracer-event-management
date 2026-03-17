import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
// import { ListOfFleets } from '../components/listOfFleets';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { graphqlMutate } from '../graphql/graphqlHelpers';
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

interface Fleet {
  fleetId: string;
  fleetName: string;
}

interface DropDownItem {
  id: string;
  text: string;
}

interface AdminTimerActivationProps {
  // No props currently used
}

const AdminTimerActivation: React.FC<AdminTimerActivationProps> = (props) => {
  const { t } = useTranslation(['translation', 'help-admin-timer-activation']);

  const [result, setResult] = useState<string>('');
  const [activationCode, setActivationCode] = useState<string>('');
  const [activationId, setActivationId] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [hostname, setHostname] = useState<string>('');
  const [ssmCommand, setSsmCommand] = useState<string>('');
  const [updateCommand, setUpdateCommand] = useState<string>('');
  const [buttonDisabled, setButtonDisabled] = useState<boolean>(true);
  const [loading, setLoading] = useState<string>('');
  const [hostnameErrorMessage, setHostnameErrorMessage] = useState<string>('');

  const [dropDownFleets, setDropDownFleets] = useState<DropDownItem[]>([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState<Fleet | { fleetName: string }>({
    fleetName: t('fleets.edit-cars.select-fleet'),
  });

  const [state] = useStore();
  const fleets = state.fleets?.fleets || [];

  const [dremUrl, setDremUrl] = useState<string>(
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
    const apiResponse = await graphqlMutate<{ deviceActivation: any }>(
      mutations.deviceActivation,
      {
        hostname: hostname,
        deviceType: 'timer',
        fleetId: 'fleetId' in dropDownSelectedItem ? dropDownSelectedItem.fleetId : '',
        fleetName: dropDownSelectedItem.fleetName,
        deviceUiPassword: '',
      }
    );
    const response = apiResponse.deviceActivation;
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
  breadcrumbs.push({ text: t('AdminActivation.timer-activation.breadcrumb'), href: '#' });

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
      header={t('AdminActivation.timer-activation.header')}
      description={t('AdminActivation.timer-activation.description')}
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
                {t('AdminActivation.timer-activation.generate')}
              </Button>
            </SpaceBetween>
          }
        >
          <Container>
            <SpaceBetween direction="vertical" size="l">
              <FormField label={t('AdminActivation.timer-activation.fleet')}>
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
              <FormField label={t('AdminActivation.timer-activation.hostname')} errorText={hostnameErrorMessage}>
                <Input
                  value={hostname}
                  placeholder={t('AdminActivation.timer-activation.hostname-placeholder')}
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
            <Header variant="h3">{t('AdminActivation.timer-activation.script')}</Header>
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
            <Header variant="h3">{t('AdminActivation.timer-activation.ssm-only')}</Header>
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
              timer_activation.sh {t('AdminActivation.timer-activation.script-lower')}
            </Button>
          </div>
        </Grid>
      </SpaceBetween>
    </PageLayout>
  );
};

export { AdminTimerActivation };
