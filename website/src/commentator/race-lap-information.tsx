import { Grid } from '@cloudscape-design/components';
import Container from '@cloudscape-design/components/container';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LapTable } from '../pages/timekeeper/components/lapTable';
import { RaceGraph } from './race-graph';
import { getFacestAvgFromOverlayInfo } from './support-functions';

interface Lap {
  lapId: number;
  lapTime?: number;
  time?: number;
}

interface AverageLap {
  startLapId: number;
  endLapId: number;
  avgTime: number;
}

interface OverlayInformation {
  raceStatus: 'READY_TO_START' | 'RACE_IN_PROGRESS' | 'RACE_PAUSED' | 'NO_RACER_SELECTED' | 'RACE_FINSIHED' | string;
  laps: Record<string, Lap>;
  averageLaps: AverageLap[];
}

interface RaceConfig {
  rankingMethod: string;
}

interface SelectedEvent {
  raceConfig: RaceConfig;
}

interface LeaderboardEntry {
  fastestLapTime?: number;
  fastestAverageLap?: AverageLap;
}

interface RaceLapInformationProps {
  overlayInformation: OverlayInformation;
  selectedEvent: SelectedEvent;
  sortedLeaderboard: LeaderboardEntry[];
}

const RaceLapInformation: React.FC<RaceLapInformationProps> = ({ 
  overlayInformation, 
  selectedEvent, 
  sortedLeaderboard 
}) => {
  const { t } = useTranslation();

  const [laps, SetLaps] = useState<Record<string, Lap>>({});
  const [thresholds, setThresholds] = useState<LeaderboardEntry>({});
  const [fastestRaceAvgLap, SetFastestRaceAvgLap] = useState<AverageLap | Record<string, never>>({});

  const updateUI = (overlayInfo: OverlayInformation): void => {
    SetLaps(overlayInfo.laps);
    SetFastestRaceAvgLap(getFacestAvgFromOverlayInfo(overlayInfo));
  };

  useEffect(() => {
    console.debug('Leaderboard: ', sortedLeaderboard);
    if (sortedLeaderboard?.length > 0) {
      const fastest = sortedLeaderboard[0];
      setThresholds(fastest);
    }
  }, [sortedLeaderboard]);

  useLayoutEffect(() => {
    if (!overlayInformation) return;
    const raceStatus = overlayInformation.raceStatus;
    switch (raceStatus) {
      case 'READY_TO_START':
      case 'RACE_IN_PROGRESS':
      case 'RACE_PAUSED':
      default:
        updateUI(overlayInformation);
        break;
      case 'NO_RACER_SELECTED':
        //reset UI
        break;
      case 'RACE_FINSIHED':
    }
  }, [overlayInformation]);

  return (
    <Grid gridDefinition={[{ colspan: 4 }, { colspan: 8 }]}>
      <Container>
        <LapTable
          variant="embedded"
          header={t('timekeeper.recorded-laps')}
          laps={Object.values(laps).map(lap => ({ ...lap, time: lap.lapTime ?? lap.time ?? 0, isValid: true }))}
          averageLapInformation={overlayInformation?.averageLaps}
          rankingMethod={selectedEvent.raceConfig.rankingMethod}
          readonly={true}
        />
      </Container>
      <Container>
        <RaceGraph
          laps={Object.values(laps).map(lap => ({ ...lap, time: lap.lapTime ?? lap.time ?? 0, isValid: true }))}
          fastestEventLapTime={thresholds.fastestLapTime}
          fastestEventAvgLap={thresholds.fastestAverageLap}
          raceFormat={selectedEvent.raceConfig.rankingMethod}
          fastestRaceAvgLap={fastestRaceAvgLap.avgTime !== undefined ? fastestRaceAvgLap as AverageLap : undefined}
        ></RaceGraph>
      </Container>
    </Grid>
  );
};

export { RaceLapInformation };
