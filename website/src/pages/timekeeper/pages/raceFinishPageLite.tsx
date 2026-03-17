import {
  Box,
  Button,
  Container,
  Grid,
  Header,
  Modal,
  SpaceBetween,
  Toggle,
} from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaceType, RaceTypeEnum } from '../../../admin/events/support-functions/raceConfig';
import { FastestAverageLapTable } from '../components/fastesAverageLapTable';
import { LapTable } from '../components/lapTable';

interface Lap {
  lapId: number;
  time: number;
  isValid: boolean;
  resets?: number;
  carName?: string;
}

interface AverageLapInfo {
  startLapId: number;
  endLapId: number;
  avgTime: number;
  laps?: Lap[];
}

interface RaceInfo {
  trackId: string;
  username: string;
  racedByProxy: boolean;
  laps: Lap[];
  averageLaps?: AverageLapInfo[];
  [key: string]: any;
}

interface RaceConfig {
  rankingMethod: RaceType;
  [key: string]: any;
}

interface RaceFinishPageProps {
  eventName: string;
  raceInfo: RaceInfo;
  fastestLap?: Lap[];
  fastestAverageLap?: AverageLapInfo[];
  raceConfig: RaceConfig;
  onAction: (lapId: number) => void;
  discardRaceHandler: () => void;
  fetchLogsEnable: boolean;
  fetchLogs: boolean;
  setFetchLogs: (value: boolean) => void;
}

export const RaceFinishPage: React.FC<RaceFinishPageProps> = ({
  eventName,
  raceInfo,
  fastestLap = [],
  fastestAverageLap = [],
  raceConfig,
  onAction,
  discardRaceHandler,
  fetchLogsEnable,
  fetchLogs,
  setFetchLogs,
}) => {
  const { t } = useTranslation(['translation', 'help-admin-timekeeper-race-finish']);
  const [buttonsIsDisabled] = useState<boolean>(false);
  const [warningModalVisible, setWarningModalVisible] = useState<boolean>(false);

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
        <Box>
          <Header variant="h3">{t('timekeeper.end-session.fetch-logs')}</Header>
          <Toggle
            onChange={({ detail }) => setFetchLogs(detail.checked)}
            checked={fetchLogs}
            disabled={!fetchLogsEnable}
          />
        </Box>
      </SpaceBetween>
    </Container>
  );

  let fastestAverageLapInformation = <></>;
  if (raceConfig.rankingMethod === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
    fastestAverageLapInformation = <FastestAverageLapTable fastestAverageLap={fastestAverageLap} />;
  }

  const lapsPanel = (
    <Container header={<Header>{t('timekeeper.end-session.laps-panel-header')}</Header>}>
      <SpaceBetween size="m" direction="vertical">
        <LapTable
          header={t('timekeeper.fastest-lap')}
          variant="embedded"
          laps={fastestLap}
          rankingMethod={raceConfig.rankingMethod}
          onAction={onAction}
        />
        {fastestAverageLapInformation}
        <hr></hr>
        <LapTable
          header={t('timekeeper.recorded-laps')}
          variant="embedded"
          laps={raceInfo.laps}
          averageLapInformation={raceInfo.averageLaps}
          rankingMethod={raceConfig.rankingMethod}
          onAction={onAction}
        />
      </SpaceBetween>
    </Container>
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
    <>
      <Grid gridDefinition={[{ colspan: 5 }, { colspan: 7 }, { colspan: 12 }]}>
        {raceInfoPanel}
        {lapsPanel}
      </Grid>

      {warningModal}
    </>
  );
};
