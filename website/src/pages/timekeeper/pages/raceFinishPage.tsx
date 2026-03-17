import {
  Box,
  Button,
  Container,
  Grid,
  Header,
  Modal,
  SpaceBetween,
  ToggleButton,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaceTypeEnum } from '../../../admin/events/support-functions/raceConfig';
import { SimpleHelpPanelLayout } from '../../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../../components/pageLayout';
import { useCarCmdApi } from '../../../hooks/useCarsApi';
import useMutation from '../../../hooks/useMutation';
import { useStore } from '../../../store/store';
import { Lap as BaseLap, Race as BaseRace, RaceConfig } from '../../../types/domain';
import { FastestAverageLapTable } from '../components/fastesAverageLapTable';
import { LapTable } from '../components/lapTable';
import { Breadcrumbs } from '../support-functions/supportFunctions';

interface AverageLap {
  averagelapId: string;
  lapTime: number;
  lapCount: number;
  lapTimeString?: string;
}

// Extended Lap interface with additional fields used in timekeeper
interface TimekeeperLap extends BaseLap {
  carName?: string;
}

// Extended Race interface with additional fields used in timekeeper
interface TimekeeperRace extends BaseRace {
  averageLaps?: AverageLap[];
  laps?: TimekeeperLap[];
}

interface RaceFinishPageProps {
  eventName: string;
  raceInfo: TimekeeperRace;
  fastestLap?: any[];  // Use any to avoid type conflicts with LapTable
  fastestAverageLap?: AverageLap[];
  raceConfig: RaceConfig & { eventName: string };
  onAction?: (lapId: number) => void;
  onNext: () => void;
  startTime: Date;
  fetchLogsEnable: boolean;
}

export const RaceFinishPage: React.FC<RaceFinishPageProps> = ({
  eventName,
  raceInfo,
  fastestLap = [],
  fastestAverageLap = [],
  raceConfig,
  onAction,
  onNext,
  startTime,
  fetchLogsEnable,
}) => {
  const { t } = useTranslation(['translation', 'help-admin-timekeeper-race-finish']);
  const { carFetchLogs } = useCarCmdApi();
  const [buttonsIsDisabled, SetButtonsIsDisabled] = useState<boolean>(false);
  const [sendMutation, loading, errorMessage, data] = useMutation();
  const [warningModalVisible, setWarningModalVisible] = useState<boolean>(false);
  const [state, dispatch] = useStore();
  const [fetchLogs, setFetchLogs] = React.useState<boolean>(fetchLogsEnable);
  const messageDisplayTime = 4000;
  const notificationId = '';

  // Clear the notification is submit is successful and go back to racer selector page again
  useEffect(() => {
    if (!loading && !errorMessage && data) {
      setTimeout(() => {
        dispatch('DISMISS_NOTIFICATION', notificationId);
        SetButtonsIsDisabled(false);
        onNext();
      }, messageDisplayTime);
    }
  }, [errorMessage, loading, data, dispatch, notificationId, onNext]);

  const submitRaceHandler = async (): Promise<void> => {
    SetButtonsIsDisabled(true);
    console.log(raceInfo);

    sendMutation('updateOverlayInfo', {
      eventId: raceInfo.eventId,
      eventName: raceConfig.eventName,
      trackId: raceInfo.trackId,
      username: raceInfo.username,
      userId: raceInfo.userId,
      laps: raceInfo.laps,
      averageLaps: raceInfo.averageLaps,
      timeLeftInMs: 0,
      raceStatus: 'RACE_SUBMITTED',
    });
    // Note: 'addRace' may be a custom mutation not in the standard set
    sendMutation('addRace' as any, { ...raceInfo });

    if (fetchLogs && raceInfo.laps) {
      const uniqueCars = new Set();
      raceInfo.laps.forEach((lap) => {
        const car = state.cars?.cars.find((car) => {
          return car.ComputerName === lap.carName && car.LoggingCapable;
        });
        if (car) {
          uniqueCars.add(car);
        }
      });

      console.debug(Array.from(uniqueCars));

      (carFetchLogs as any)(
        uniqueCars,
        { eventId: raceInfo.eventId, eventName: raceConfig.eventName },
        new Date(startTime.getTime()).toISOString(),
        raceInfo.username,
        { ...raceInfo }
      );
    }
  };

  const discardRaceHandler = (): void => {
    SetButtonsIsDisabled(true);
    setWarningModalVisible(false);
    dispatch('ADD_NOTIFICATION', {
      type: 'warning',
      content: t('timekeeper.end-session.race-discarded'),
      id: notificationId,
      dismissible: true,
      onDismiss: () => {
        dispatch('DISMISS_NOTIFICATION', notificationId);
      },
    });
    setTimeout(() => {
      SetButtonsIsDisabled(false);
      dispatch('DISMISS_NOTIFICATION', notificationId);
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

  let fastestAverageLapInformation = <></>;
  if (raceConfig.rankingMethod === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
    fastestAverageLapInformation = <FastestAverageLapTable fastestAverageLap={fastestAverageLap as any} />;
  }

  const lapsPanel = (
    <Container header={<Header>{t('timekeeper.end-session.laps-panel-header')}</Header>}>
      <SpaceBetween size="m" direction="vertical">
        <LapTable
          header={t('timekeeper.fastest-lap')}
          variant="embedded"
          laps={fastestLap}
          rankingMethod={raceConfig.rankingMethod || ''}
          onAction={onAction}
        />
        {fastestAverageLapInformation}
        <hr></hr>
        <LapTable
          header={t('timekeeper.recorded-laps')}
          variant="embedded"
          laps={(raceInfo.laps as any) || []}
          averageLapInformation={raceInfo.averageLaps as any}
          rankingMethod={raceConfig.rankingMethod || ''}
          onAction={onAction}
        />
      </SpaceBetween>
    </Container>
  );

  const actionButtons = (
    <Box float="right">
      <SpaceBetween direction="horizontal" size="xs">
        <ToggleButton
          onChange={({ detail }) => setFetchLogs(detail.pressed)}
          pressed={fetchLogs}
          disabled={!fetchLogsEnable}
          iconName="upload"
          pressedIconName="upload"
        >
          {t('timekeeper.end-session.fetch-logs')}
        </ToggleButton>
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

  const breadcrumbs = Breadcrumbs();
  return (
    <PageLayout
      helpPanelHidden={true}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-timekeeper-race-finish' })}
          bodyContent={t('content', { ns: 'help-admin-timekeeper-race-finish' })}
          footerContent={t('footer', { ns: 'help-admin-timekeeper-race-finish' })}
        />
      }
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
