import {
  Box,
  Button,
  Container,
  Grid,
  Header,
  Modal,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SimpleHelpPanelLayout } from '../../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../../components/pageLayout';
import useMutation from '../../../hooks/useMutation';
import {
  useNotificationsDispatch,
  useToolsOptionsDispatch,
} from '../../../store/appLayoutProvider';
import { LapTable } from '../components/lapTable';
import { breadcrumbs } from '../support-functions/supportFunctions';

export const RaceFinishPage = ({ eventName, raceInfo, fastestLap = [], onAction, onNext }) => {
  const { t } = useTranslation();
  const [buttonsIsDisabled, SetButtonsIsDisabled] = useState(false);
  const [sendMutation, loading, errorMessage, data] = useMutation();
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [addNotification, dismissNotification] = useNotificationsDispatch();

  const messageDisplayTime = 2500;
  const notificationId = 'race_submition';

  // Help panel
  const toolsOptionsDispatch = useToolsOptionsDispatch();
  const helpPanelHidden = true;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        content: (
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-admin-race-finish' })}
            bodyContent={t('content', { ns: 'help-admin-race-finish' })}
            footerContent={t('footer', { ns: 'help-admin-race-finish' })}
          />
        ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

  // Update submit message in modal depending on addRace mutation result
  useEffect(() => {
    console.info(data);
    if (!loading && errorMessage) {
      addNotification({
        type: 'error',
        content: t('timekeeper.end-session.error'),
        id: notificationId,
        dismissible: true,
        onDismiss: (event) => {
          dismissNotification(notificationId);
        },
      });
      setTimeout(() => {
        SetButtonsIsDisabled(false);
      }, messageDisplayTime);
    } else if (!loading && data) {
      addNotification({
        type: 'success',
        content: t('timekeeper.end-session.info'),
        id: notificationId,
        dismissible: true,
        onDismiss: (event) => {
          dismissNotification(notificationId);
        },
      });
      setTimeout(() => {
        dismissNotification(notificationId);
        SetButtonsIsDisabled(false);
        onNext();
      }, messageDisplayTime);
    }
  }, [data, errorMessage, loading]);

  const submitRaceHandler = async () => {
    console.info(raceInfo);
    SetButtonsIsDisabled(true);
    addNotification({
      type: 'success',
      loading: true,
      content: t('timekeeper.end-session.submitting-race'),
      id: notificationId,
      dismissible: true,
      onDismiss: () => {
        dismissNotification(notificationId);
      },
    });
    sendMutation('addRace', { ...raceInfo });
  };

  const discardRaceHandler = () => {
    SetButtonsIsDisabled(true);
    setWarningModalVisible(false);
    addNotification({
      type: 'warning',
      content: t('timekeeper.end-session.race-discarded'),
      id: 'race_submition',
      dismissible: true,
      onDismiss: () => {
        dismissNotification(notificationId);
      },
    });
    setTimeout(() => {
      SetButtonsIsDisabled(false);
      dismissNotification(notificationId);
      onNext();
    }, messageDisplayTime);
  };

  const raceInfoPanel = (
    <Container header={<Header>{t('timekeeper.end-session.race-info')}</Header>}>
      <SpaceBetween direction="vertical" size="l">
        <Box>
          <Header variant="h3">{t('topnav.event')}</Header>
          {eventName}
        </Box>
        <Box>
          <Header variant="h3">{t('events.track-type')}</Header>
          {raceInfo.trackId}
        </Box>
        <Box>
          <Header variant="h3">{t('timekeeper.end-session.customer')}</Header>
          {raceInfo.username}
        </Box>
        <Box>
          <Header variant="h3">{t('timekeeper.end-session.raced-by-proxy')}</Header>
          {raceInfo.racedByProxy ? t('common.yes') : t('common.no')}
        </Box>
      </SpaceBetween>
    </Container>
  );

  const lapsPanel = (
    <Container header={<Header>{t('timekeeper.end-session.laps-panel-header')}</Header>}>
      <SpaceBetween size="m" direction="vertical">
        <LapTable
          header={t('timekeeper.fastest-lap')}
          variant="embedded"
          laps={fastestLap}
          onAction={onAction}
        />
        <hr></hr>
        <LapTable
          header={t('timekeeper.recorded-laps')}
          variant="embedded"
          laps={raceInfo.laps}
          onAction={onAction}
        />
      </SpaceBetween>
    </Container>
  );

  const actionButtons = (
    <Box float="right">
      <SpaceBetween direction="horizontal" size="xs">
        <Button
          variant="link"
          disabled={buttonsIsDisabled}
          onClick={() => setWarningModalVisible(true)}
        >
          {t('timekeeper.end-session.discard-race')}
        </Button>
        <Button variant="primary" disabled={buttonsIsDisabled} onClick={submitRaceHandler}>
          {t('timekeeper.end-session.submit-race')}
        </Button>
      </SpaceBetween>
    </Box>
  );

  const warningModal = (
    <Modal
      onDismiss={() => setWarningModalVisible(false)}
      visible={warningModalVisible}
      closeAriaLabel="Warning"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              disabled={buttonsIsDisabled}
              onClick={() => setWarningModalVisible(false)}
            >
              {t('button.cancel')}
            </Button>
            <Button variant="primary" disabled={buttonsIsDisabled} onClick={discardRaceHandler}>
              {t('timekeeper.end-session.discard-race')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Warning!"
    >
      {t('timekeeper.end-session.warning-message')}
    </Modal>
  );
  return (
    <PageLayout
      helpPanelHidden={helpPanelHidden}
      breadcrumbs={breadcrumbs}
      header={t('timekeeper.end-session.page-header')}
      description={t('timekeeper.end-session.page-description')}
    >
      <Grid gridDefinition={[{ colspan: 5 }, { colspan: 7 }, { colspan: 12 }]}>
        {raceInfoPanel}
        {lapsPanel}
        {actionButtons}
      </Grid>

      {warningModal}
    </PageLayout>
  );
};
