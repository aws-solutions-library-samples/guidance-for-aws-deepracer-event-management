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

import { PageLayout } from '../../components/pageLayout';
import useMutation from '../../hooks/useMutation';
import { useNotificationsDispatch } from '../../store/appLayoutProvider';
import { LapTable } from './lapTable';
import { breadcrumbs } from './supportFunctions';

export const RaceFinishPage = ({ raceInfo, fastestLap = [], onAction, onNext }) => {
  const { t } = useTranslation();
  const [buttonsIsDisabled, SetButtonsIsDisabled] = useState(false);
  const [sendMutation, loading, errorMessage, data] = useMutation();
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const setNotifications = useNotificationsDispatch();

  console.info(loading);
  console.info(data);
  console.info(errorMessage);
  const messageDisplayTime = 2500;

  const raceDiscardedNotification = [
    {
      type: 'warning',
      content: 'Race Discarded!',
      id: 'discarding_race',
      dismissible: true,
      onDismiss: () => {
        setNotifications([]);
      },
    },
  ];
  const raceSubmitInProgressNotification = [
    {
      type: 'success',
      loading: true,
      content: 'Submitting race...',
      id: 'submitting_race',
      dismissible: true,
      onDismiss: () => {
        setNotifications([]);
      },
    },
  ];
  const raceSubmittedSucessNotification = [
    {
      type: 'success',
      content: 'Race Submitted',
      id: 'submitting_race',
      dismissible: true,
      onDismiss: (event) => {
        setNotifications([]);
      },
    },
  ];

  const raceSubmittedFailedNotification = [
    {
      type: 'error',
      content: 'Could not submit race, please try again',
      id: 'submitting_race',
      dismissible: true,
      onDismiss: (event) => {
        setNotifications([]);
      },
    },
  ];

  // Update submit message in modal depending on addRace mutation result
  useEffect(() => {
    console.info(data);
    if (!loading && errorMessage) {
      setNotifications(raceSubmittedFailedNotification);
      setTimeout(() => {
        SetButtonsIsDisabled(false);
      }, messageDisplayTime);
    } else if (!loading && data) {
      setNotifications(raceSubmittedSucessNotification);
      setTimeout(() => {
        setNotifications([]);
        SetButtonsIsDisabled(false);
        onNext();
      }, messageDisplayTime);
    }
  }, [data, errorMessage, loading]);

  const submitRaceHandler = async () => {
    console.info('Submiting Race...');
    console.info(raceInfo);
    SetButtonsIsDisabled(true);
    setNotifications(raceSubmitInProgressNotification);
    sendMutation('addRace', { ...raceInfo });
  };

  const discardRaceHandler = () => {
    SetButtonsIsDisabled(true);
    setWarningModalVisible(false);
    setNotifications(raceDiscardedNotification);
    setTimeout(() => {
      SetButtonsIsDisabled(false);
      setNotifications([]);
      onNext();
    }, messageDisplayTime);
  };

  const raceInfoPanel = (
    <Container header={<Header>Race Info</Header>}>
      <SpaceBetween direction="vertical" size="l">
        <Box>
          <Header variant="h3">Event:</Header>
          {raceInfo.eventId}
        </Box>
        <Box>
          <Header variant="h3">Track:</Header>
          {raceInfo.trackId}
        </Box>
        <Box>
          <Header variant="h3">Customer:</Header>
          {raceInfo.username}
        </Box>
        <Box>
          <Header variant="h3">Raced By Proxy:</Header>
          {raceInfo.racedByProxy ? 'Yes' : 'No'}
        </Box>
      </SpaceBetween>
    </Container>
  );

  const lapsPanel = (
    <Container header={<Header>Laps</Header>}>
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
              {t('button.ok')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Warning!"
    >
      Clicking Ok will delete the race without saving it!
    </Modal>
  );
  return (
    <PageLayout
      breadcrumbs={breadcrumbs}
      header="Review Race"
      description="Verify that all laps and racer details are accurate before submitting the race."
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
